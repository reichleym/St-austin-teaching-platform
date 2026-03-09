import { AdminActionType, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCountryState } from "@/lib/csc-locations";
import { generateInviteToken, getInviteExpiry } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/mailer";
import { requireSuperAdminUser, PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type InvitableRole = "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "DEPARTMENT_HEAD";

function parseInvitableRole(value: unknown): InvitableRole | null {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
    if (normalized === "ADMIN" || normalized === "SUPER_ADMIN") return "SUPER_ADMIN";
    if (normalized === "TEACHER") return "TEACHER";
    if (normalized === "STUDENT") return "STUDENT";
    if (normalized === "DEPARTMENT_HEAD") return "DEPARTMENT_HEAD";
  }
  if (value === Role.SUPER_ADMIN) return "SUPER_ADMIN";
  if (value === Role.TEACHER) return "TEACHER";
  if (value === Role.STUDENT) return "STUDENT";
  if (value === Role.DEPARTMENT_HEAD) return "DEPARTMENT_HEAD";
  return null;
}

function isInvitationPhoneCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `phone`") ||
    error.message.includes("Unknown argument `name`") ||
    error.message.includes("Unknown argument `department`") ||
    error.message.includes("Unknown argument `guardianName`") ||
    error.message.includes("Unknown argument `guardianPhone`") ||
    error.message.includes("Unknown argument `country`") ||
    error.message.includes("Unknown argument `state`") ||
    error.message.includes("Unknown argument `studentId`") ||
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `name`") ||
    error.message.includes("Unknown field `department`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`") ||
    error.message.includes("Unknown field `studentId`")
  );
}

async function ensureInvitationRoleConstraint() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_role_check') THEN
    ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_role_check";
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_role_check"
  CHECK ("role" IN ('SUPER_ADMIN','TEACHER','DEPARTMENT_HEAD','STUDENT'));
  `);
}

async function ensureRoleEnum() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEPARTMENT_HEAD';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
  `);
}

async function ensureInvitationSchema() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "studentId" TEXT;`);
  } catch {
    // Ignore if table is missing or not yet migrated.
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentId" TEXT;`);
  } catch {
    // Ignore if table is missing or not yet migrated.
  }
  try {
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_studentId_key" ON "User"("studentId");`);
  } catch {
    // Ignore index creation errors to avoid blocking invites.
  }
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invitation_studentId_idx" ON "Invitation"("studentId");`);
  } catch {
    // Ignore index creation errors to avoid blocking invites.
  }
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

async function deleteExistingInvitationRaw(email: string, role: InvitableRole) {
  await prisma.$executeRaw`
    DELETE FROM "Invitation"
    WHERE "email" = ${email}
      AND "role" = CAST(${role} AS "Role")
      AND "acceptedAt" IS NULL
  `;
}

async function createInvitationRaw(params: {
  email: string;
  role: InvitableRole;
  token: string;
  expiresAt: Date;
  createdById: string;
  fullName?: string | null;
  phone?: string | null;
  department?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  country?: string | null;
  state?: string | null;
  studentId?: string | null;
}) {
  const id = makeId("inv");
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string; role: string; token: string; expiresAt: Date }>
    >`
      INSERT INTO "Invitation"
        ("id","email","name","phone","department","guardianName","guardianPhone","country","state","studentId","role","token","expiresAt","acceptedAt","createdById","createdAt","updatedAt")
      VALUES
        (
          ${id},
          ${params.email},
          ${params.fullName ?? null},
          ${params.phone ?? null},
          ${params.department ?? null},
          ${params.guardianName ?? null},
          ${params.guardianPhone ?? null},
          ${params.country ?? null},
          ${params.state ?? null},
          ${params.studentId ?? null},
          CAST(${params.role} AS "Role"),
          ${params.token},
          ${params.expiresAt},
          NULL,
          ${params.createdById},
          NOW(),
          NOW()
        )
      RETURNING "id","email","role"::text AS "role","token","expiresAt"
    `;
    return rows[0];
  } catch {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string; role: string; token: string; expiresAt: Date }>
    >`
      INSERT INTO "Invitation"
        ("id","email","role","token","expiresAt","acceptedAt","createdById","createdAt","updatedAt")
      VALUES
        (
          ${id},
          ${params.email},
          CAST(${params.role} AS "Role"),
          ${params.token},
          ${params.expiresAt},
          NULL,
          ${params.createdById},
          NOW(),
          NOW()
        )
      RETURNING "id","email","role"::text AS "role","token","expiresAt"
    `;
    return rows[0];
  }
}

async function ensureInvitationRoleConstraint() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_role_check') THEN
    ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_role_check";
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_role_check"
  CHECK ("role" IN ('SUPER_ADMIN','TEACHER','DEPARTMENT_HEAD','STUDENT'));
  `);
}

async function ensureRoleEnum() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEPARTMENT_HEAD';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
  `);
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

async function deleteExistingInvitationRaw(email: string, role: InvitableRole) {
  await prisma.$executeRaw`
    DELETE FROM "Invitation"
    WHERE "email" = ${email}
      AND "role" = CAST(${role} AS "Role")
      AND "acceptedAt" IS NULL
  `;
}

async function createInvitationRaw(params: {
  email: string;
  role: InvitableRole;
  token: string;
  expiresAt: Date;
  createdById: string;
  fullName?: string | null;
  phone?: string | null;
  department?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  country?: string | null;
  state?: string | null;
}) {
  const id = makeId("inv");
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string; role: string; token: string; expiresAt: Date }>
    >`
      INSERT INTO "Invitation"
        ("id","email","name","phone","department","guardianName","guardianPhone","country","state","role","token","expiresAt","acceptedAt","createdById","createdAt","updatedAt")
      VALUES
        (
          ${id},
          ${params.email},
          ${params.fullName ?? null},
          ${params.phone ?? null},
          ${params.department ?? null},
          ${params.guardianName ?? null},
          ${params.guardianPhone ?? null},
          ${params.country ?? null},
          ${params.state ?? null},
          CAST(${params.role} AS "Role"),
          ${params.token},
          ${params.expiresAt},
          NULL,
          ${params.createdById},
          NOW(),
          NOW()
        )
      RETURNING "id","email","role"::text AS "role","token","expiresAt"
    `;
    return rows[0];
  } catch {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; email: string; role: string; token: string; expiresAt: Date }>
    >`
      INSERT INTO "Invitation"
        ("id","email","role","token","expiresAt","acceptedAt","createdById","createdAt","updatedAt")
      VALUES
        (
          ${id},
          ${params.email},
          CAST(${params.role} AS "Role"),
          ${params.token},
          ${params.expiresAt},
          NULL,
          ${params.createdById},
          NOW(),
          NOW()
        )
      RETURNING "id","email","role"::text AS "role","token","expiresAt"
    `;
    return rows[0];
  }
}

export async function POST(request: NextRequest) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const body = (await request.json()) as {
      email?: string;
      role?: Role;
      firstName?: string;
      lastName?: string;
      phone?: string;
      department?: string;
      guardianName?: string;
      guardianPhone?: string;
      country?: string;
      state?: string;
      studentId?: string;
    };

    const email = body.email?.toLowerCase().trim();
    const role = parseInvitableRole(body.role) ?? parseInvitableRole(body.role?.toString());
    const fullName = `${body.firstName?.trim() ?? ""} ${body.lastName?.trim() ?? ""}`.trim();
    const phone = body.phone?.trim() ?? "";
    const department = body.department?.trim() ?? "";
    const guardianName = body.guardianName?.trim() ?? "";
    const guardianPhone = body.guardianPhone?.trim() ?? "";
    const country = body.country?.trim() ?? "";
    const state = body.state?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";

    if (!email || !role) {
      console.error("Invitation payload invalid", {
        email,
        rawRole: body.role,
        normalizedRole: role,
      });
      return NextResponse.json(
        { error: "Valid email and role (SUPER_ADMIN/TEACHER/STUDENT/DEPARTMENT_HEAD) are required." },
        { status: 400 }
      );
    }

    if (role === "SUPER_ADMIN") {
      if (!fullName || !phone || !country || !state) {
        return NextResponse.json(
          {
            error: "For admin invites, first name, last name, phone, country, and state are required.",
          },
          { status: 400 }
        );
      }
      if (!(await validateCountryState(country, state))) {
        return NextResponse.json({ error: "Invalid country/state selection." }, { status: 400 });
      }
    }

    if (role === "TEACHER") {
      if (!fullName || !phone || !department || !country || !state) {
        return NextResponse.json(
          {
            error:
              "For teacher invites, first name, last name, phone, department, country, and state are required.",
          },
          { status: 400 }
        );
      }
      if (!(await validateCountryState(country, state))) {
        return NextResponse.json({ error: "Invalid country/state selection." }, { status: 400 });
      }
    }

    if (role === "DEPARTMENT_HEAD") {
      if (!fullName || !phone || !country || !state) {
        return NextResponse.json(
          {
            error: "For department head invites, first name, last name, phone, country, and state are required.",
          },
          { status: 400 }
        );
      }
      if (!(await validateCountryState(country, state))) {
        return NextResponse.json({ error: "Invalid country/state selection." }, { status: 400 });
      }
    }

    if (role === "STUDENT") {
      if (!fullName || !phone || !department || !guardianName || !guardianPhone || !country || !state) {
        return NextResponse.json(
          {
            error:
              "For student invites, first name, last name, phone, department, guardian name, guardian phone, country, and state are required.",
          },
          { status: 400 }
        );
      }
      if (!(await validateCountryState(country, state))) {
        return NextResponse.json({ error: "Invalid country/state selection." }, { status: 400 });
      }
    }

    const normalizedStudentId = role === "STUDENT" && studentId ? studentId : null;
    if (normalizedStudentId) {
      try {
        const existingStudentId = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "User" WHERE "studentId" = ${normalizedStudentId} LIMIT 1
        `;
        if (existingStudentId[0]) {
          return NextResponse.json({ error: "Student ID is already in use." }, { status: 400 });
        }
        const existingInviteId = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Invitation" WHERE "studentId" = ${normalizedStudentId} AND "acceptedAt" IS NULL LIMIT 1
        `;
        if (existingInviteId[0]) {
          return NextResponse.json({ error: "Student ID already has a pending invitation." }, { status: 400 });
        }
      } catch {
        // Ignore if DB column is not available yet.
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, status: true },
    });

    if (existing?.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Cannot create invitation for Super Admin." }, { status: 400 });
    }

    const token = generateInviteToken();
    const expiresAt = getInviteExpiry();
    let invitation;
    try {
      invitation = await prisma.$transaction(async (tx) => {
        await tx.invitation.deleteMany({
          where: {
            email,
            role,
            acceptedAt: null,
          },
        });

        const created = await tx.invitation.create({
          data: {
            email,
            name: fullName || null,
            phone: phone || null,
            department: department || null,
            guardianName: role === Role.STUDENT ? guardianName : null,
            guardianPhone: role === Role.STUDENT ? guardianPhone : null,
            country: country || null,
            state: state || null,
            studentId: normalizedStudentId,
            role,
            token,
            expiresAt,
            createdById: superAdmin.id,
          },
        });

        await tx.adminActionLog.create({
          data: {
            action: role === "STUDENT" ? AdminActionType.INVITE_STUDENT : AdminActionType.INVITE_TEACHER,
            actorId: superAdmin.id,
            targetUserId: existing?.id,
            entityType: "Invitation",
            entityId: created.id,
            metadata: {
              email,
              role,
              fullName: fullName || null,
              phone: phone || null,
              department: department || null,
              guardianName: role === "STUDENT" ? guardianName || null : null,
              guardianPhone: role === "STUDENT" ? guardianPhone || null : null,
              country: country || null,
              state: state || null,
              studentId: normalizedStudentId,
            },
          },
        });

          return created;
        });
      } catch (error) {
        if (!isInvitationPhoneCompatibilityError(error)) {
          throw error;
        }

        invitation = await prisma.$transaction(async (tx) => {
          await tx.invitation.deleteMany({
            where: {
              email,
              role,
              acceptedAt: null,
            },
          });

          const created = await tx.invitation.create({
            data: {
              email,
              role,
              token,
              expiresAt,
              createdById: superAdmin.id,
            },
          });

        await tx.adminActionLog.create({
          data: {
            action: role === Role.TEACHER ? AdminActionType.INVITE_TEACHER : AdminActionType.INVITE_STUDENT,
            actorId: superAdmin.id,
            targetUserId: existing?.id,
            entityType: "Invitation",
            entityId: created.id,
            metadata: {
              email,
              role,
              fullName: fullName || null,
              phone: phone || null,
              department: department || null,
              guardianName: role === Role.STUDENT ? guardianName || null : null,
              guardianPhone: role === Role.STUDENT ? guardianPhone || null : null,
              country: country || null,
              state: state || null,
            },
          },
        });

          return created;
        });

      // Do this outside the transaction because a failed statement aborts the tx.
      try {
        await prisma.$executeRaw`UPDATE "Invitation" SET "name" = ${fullName || null}, "phone" = ${phone || null}, "department" = ${department || null}, "guardianName" = ${role === Role.STUDENT ? guardianName || null : null}, "guardianPhone" = ${role === Role.STUDENT ? guardianPhone || null : null}, "country" = ${country || null}, "state" = ${state || null} WHERE "id" = ${invitation.id}`;
      } catch {
        // Ignore if DB column is not available yet.
      }
    }

    const inviteUrl = `${request.nextUrl.origin}/invite/accept?token=${invitation.token}`;
    let warning: string | undefined;
    try {
      const details: Array<{ label: string; value: string }> = [];
      if (phone) details.push({ label: "Phone", value: phone });
      if (normalizedStudentId) details.push({ label: "Student ID", value: normalizedStudentId });
      await sendInvitationEmail({
        to: email,
        name: fullName || null,
        role,
        inviteUrl,
        inviteExpires: invitation.expiresAt,
        details: details.length ? details : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation email.";
      warning = `Invitation created, but email delivery failed: ${message}`;
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviteUrl,
      warning,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not create invitation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireSuperAdminUser();
    const invitations = await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ invitations });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Could not load invitations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
