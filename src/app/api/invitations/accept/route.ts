import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isInvitationProfileCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `name`") ||
    error.message.includes("Unknown field `department`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`")
  );
}

function readMetadataString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
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

export async function POST(request: Request) {
  await ensureRoleEnum();
  const body = (await request.json()) as {
    token?: string;
    password?: string;
    name?: string;
  };

  const token = body.token?.trim();
  const password = body.password ?? "";
  const name = body.name?.trim() || null;

  if (!token || !password) {
    return NextResponse.json({ error: "Invitation token and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let invite:
    | {
        id: string;
        email: string;
        name: string | null;
        phone: string | null;
        department: string | null;
        guardianName: string | null;
        guardianPhone: string | null;
        country: string | null;
        state: string | null;
        role: Role | string;
        expiresAt: Date;
        acceptedAt: Date | null;
      }
    | null = null;

  try {
    invite = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        department: true,
        guardianName: true,
        guardianPhone: true,
        country: true,
        state: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const roleEnumMismatch =
      message.includes("Value 'DEPARTMENT_HEAD' not found in enum") ||
      message.includes("Invalid enum value") ||
      (error && (error as { code?: string }).code === "P2023");

    if (!isInvitationProfileCompatibilityError(error) && !roleEnumMismatch) {
      throw error;
    }

    const legacyRows = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        name: string | null;
        phone: string | null;
        department: string | null;
        guardianName: string | null;
        guardianPhone: string | null;
        country: string | null;
        state: string | null;
        role: string;
        expiresAt: Date;
        acceptedAt: Date | null;
      }>
    >`
      SELECT
        "id",
        "email",
        "name",
        "phone",
        "department",
        "guardianName",
        "guardianPhone",
        "country",
        "state",
        "role"::text AS "role",
        "expiresAt",
        "acceptedAt"
      FROM "Invitation"
      WHERE "token" = ${token}
      LIMIT 1
    `;
    invite = legacyRows[0] ?? null;
  }

  if (!invite) {
    return NextResponse.json({ error: "Invitation is invalid." }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invitation has already been accepted." }, { status: 409 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired." }, { status: 410 });
  }

  const inviteRoleText = String(invite.role);
  if (
    inviteRoleText !== "SUPER_ADMIN" &&
    inviteRoleText !== "TEACHER" &&
    inviteRoleText !== "STUDENT" &&
    inviteRoleText !== "DEPARTMENT_HEAD"
  ) {
    return NextResponse.json({ error: "Invitation is invalid." }, { status: 400 });
  }

  const inviteActionLog = await prisma.adminActionLog.findFirst({
    where: {
      entityType: "Invitation",
      entityId: invite.id,
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });

  const metadata = (inviteActionLog?.metadata ?? null) as Record<string, unknown> | null;
  const invitedName = invite.name ?? readMetadataString(metadata?.fullName);
  const invitedPhone = invite.phone ?? readMetadataString(metadata?.phone);
  const invitedDepartment = invite.department ?? readMetadataString(metadata?.department);
  const invitedGuardianName = invite.guardianName ?? readMetadataString(metadata?.guardianName);
  const invitedGuardianPhone = invite.guardianPhone ?? readMetadataString(metadata?.guardianPhone);
  const invitedCountry = invite.country ?? readMetadataString(metadata?.country);
  const invitedState = invite.state ?? readMetadataString(metadata?.state);

  const passwordHash = await bcrypt.hash(password, 10);
  const resolvedName = name || invitedName || null;
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, role: true },
  });

  const roleEnumMissing = Role.DEPARTMENT_HEAD === undefined;

  await prisma.$transaction(async (tx) => {
    if (existingUser?.role === Role.SUPER_ADMIN) {
      throw new Error("Cannot apply invitation to Super Admin account.");
    }

    if (existingUser) {
      if (inviteRoleText === "DEPARTMENT_HEAD" && roleEnumMissing) {
        await tx.$executeRaw`
          UPDATE "User"
          SET
            "name" = ${resolvedName},
            "passwordHash" = ${passwordHash},
            "role" = CAST(${inviteRoleText} AS "Role"),
            "status" = CAST('ACTIVE' AS "UserStatus"),
            "phone" = ${invitedPhone || null},
            "department" = ${invitedDepartment || null},
            "guardianName" = ${invitedGuardianName || null},
            "guardianPhone" = ${invitedGuardianPhone || null},
            "country" = ${invitedCountry || null},
            "state" = ${invitedState || null},
            "updatedAt" = NOW()
          WHERE "id" = ${existingUser.id}
        `;
      } else {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: resolvedName,
            passwordHash,
            role: invite.role as Role,
            status: UserStatus.ACTIVE,
            phone: invitedPhone || null,
            department: invitedDepartment || null,
            guardianName: invitedGuardianName || null,
            guardianPhone: invitedGuardianPhone || null,
            country: invitedCountry || null,
            state: invitedState || null,
          },
          select: { id: true },
        });
      }
    } else {
      if (inviteRoleText === "DEPARTMENT_HEAD" && roleEnumMissing) {
        const userId = makeId("usr");
        await tx.$executeRaw`
          INSERT INTO "User"
            ("id","email","name","passwordHash","role","status","phone","department","guardianName","guardianPhone","country","state","createdAt","updatedAt")
          VALUES
            (
              ${userId},
              ${invite.email},
              ${resolvedName},
              ${passwordHash},
              CAST(${inviteRoleText} AS "Role"),
              CAST('ACTIVE' AS "UserStatus"),
              ${invitedPhone || null},
              ${invitedDepartment || null},
              ${invitedGuardianName || null},
              ${invitedGuardianPhone || null},
              ${invitedCountry || null},
              ${invitedState || null},
              NOW(),
              NOW()
            )
        `;
      } else {
        await tx.user.create({
          data: {
            email: invite.email,
            name: resolvedName,
            passwordHash,
            role: invite.role as Role,
            status: UserStatus.ACTIVE,
            phone: invitedPhone || null,
            department: invitedDepartment || null,
            guardianName: invitedGuardianName || null,
            guardianPhone: invitedGuardianPhone || null,
            country: invitedCountry || null,
            state: invitedState || null,
          },
          select: { id: true },
        });
      }
    }

    if (inviteRoleText === "DEPARTMENT_HEAD" && roleEnumMissing) {
      await tx.$executeRaw`
        UPDATE "Invitation"
        SET "acceptedAt" = NOW(), "updatedAt" = NOW()
        WHERE "id" = ${invite.id}
      `;
    } else {
      await tx.invitation.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
