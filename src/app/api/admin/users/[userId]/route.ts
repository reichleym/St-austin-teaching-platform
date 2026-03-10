import { AdminActionType, Prisma, Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCountryState } from "@/lib/csc-locations";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type RequestBody = {
  name?: string | null;
  email?: string;
  status?: UserStatus;
  phone?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  country?: string;
  state?: string;
  studentId?: string | null;
};

function isUserCountryStateCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `phone`") ||
    error.message.includes("Unknown argument `guardianName`") ||
    error.message.includes("Unknown argument `guardianPhone`") ||
    error.message.includes("Unknown argument `country`") ||
    error.message.includes("Unknown argument `state`") ||
    error.message.includes("Unknown argument `studentId`") ||
    error.message.includes("Unknown field `phone`") ||
    error.message.includes("Unknown field `guardianName`") ||
    error.message.includes("Unknown field `guardianPhone`") ||
    error.message.includes("Unknown field `country`") ||
    error.message.includes("Unknown field `state`") ||
    error.message.includes("Unknown field `studentId`")
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const superAdmin = await requireSuperAdminUser();
    const { userId } = await params;
    const body = (await request.json()) as RequestBody;

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const status = body.status;
    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const guardianName = typeof body.guardianName === "string" ? body.guardianName.trim() : undefined;
    const guardianPhone = typeof body.guardianPhone === "string" ? body.guardianPhone.trim() : undefined;
    const country = typeof body.country === "string" ? body.country.trim() : undefined;
    const state = typeof body.state === "string" ? body.state.trim() : undefined;
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : undefined;

    if (status !== undefined && status !== UserStatus.ACTIVE && status !== UserStatus.DISABLED) {
      return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
    }

    if (email !== undefined && !email) {
      return NextResponse.json({ error: "Email cannot be empty." }, { status: 400 });
    }
    if (country !== undefined && !country) {
      return NextResponse.json({ error: "Country cannot be empty." }, { status: 400 });
    }
    if (state !== undefined && !state) {
      return NextResponse.json({ error: "State cannot be empty." }, { status: 400 });
    }

    if (
      (country !== undefined && state !== undefined && !(await validateCountryState(country, state))) ||
      (country !== undefined && state === undefined) ||
      (country === undefined && state !== undefined)
    ) {
      return NextResponse.json({ error: "Country and state must be valid and updated together." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Super Admin account cannot be modified here." }, { status: 400 });
    }

    const data: Prisma.UserUpdateInput = {};
    if (name !== undefined) data.name = name || null;
    if (email !== undefined) data.email = email;
    if (status !== undefined) data.status = status;
    if (phone !== undefined) data.phone = phone || null;
    if (guardianName !== undefined) data.guardianName = guardianName || null;
    if (guardianPhone !== undefined) data.guardianPhone = guardianPhone || null;
    if (country !== undefined && state !== undefined) {
      data.country = country;
      data.state = state;
    }
    if (studentId !== undefined) {
      if (target.role !== Role.STUDENT) {
        return NextResponse.json({ error: "Student ID can only be assigned to students." }, { status: 400 });
      }
      const normalizedStudentId = studentId ? studentId : null;
      if (normalizedStudentId) {
        const existing = await prisma.user.findFirst({
          where: { studentId: normalizedStudentId, NOT: { id: userId } },
          select: { id: true },
        });
        if (existing) {
          return NextResponse.json({ error: "Student ID is already in use." }, { status: 409 });
        }
      }
      data.studentId = normalizedStudentId;
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "At least one field is required." }, { status: 400 });
    }

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            phone: true,
            guardianName: true,
            guardianPhone: true,
            country: true,
            state: true,
            studentId: true,
            role: true,
            createdAt: true,
          },
        });

        if (status !== undefined && status !== target.status) {
          await tx.adminActionLog.create({
            data: {
              action: status === UserStatus.ACTIVE ? AdminActionType.ENABLE_USER : AdminActionType.DISABLE_USER,
              actorId: superAdmin.id,
              targetUserId: user.id,
              entityType: "User",
              entityId: user.id,
              metadata: { previousStatus: target.status, nextStatus: status },
            },
          });
        }

        return user;
      });
    } catch (error) {
      if (!isUserCountryStateCompatibilityError(error)) {
        throw error;
      }

      const fallbackData: Prisma.UserUpdateInput = { ...data };
      delete fallbackData.country;
      delete fallbackData.state;
      delete fallbackData.phone;
      delete fallbackData.guardianName;
      delete fallbackData.guardianPhone;
      delete fallbackData.studentId;

      updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: fallbackData,
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
        });

        if (status !== undefined && status !== target.status) {
          await tx.adminActionLog.create({
            data: {
              action: status === UserStatus.ACTIVE ? AdminActionType.ENABLE_USER : AdminActionType.DISABLE_USER,
              actorId: superAdmin.id,
              targetUserId: user.id,
              entityType: "User",
              entityId: user.id,
              metadata: { previousStatus: target.status, nextStatus: status },
            },
          });
        }

        let patchedCountry: string | null = null;
        let patchedState: string | null = null;
        let patchedPhone: string | null = null;
        let patchedGuardianName: string | null = null;
        let patchedGuardianPhone: string | null = null;
        let patchedStudentId: string | null = null;

        if (country !== undefined && state !== undefined) {
          try {
            await tx.$executeRaw`UPDATE "User" SET "country" = ${country}, "state" = ${state} WHERE "id" = ${user.id}`;
            const rows = await tx.$queryRaw<Array<{ country: string | null; state: string | null }>>`
              SELECT "country", "state" FROM "User" WHERE "id" = ${user.id} LIMIT 1
            `;
            patchedCountry = rows[0]?.country ?? null;
            patchedState = rows[0]?.state ?? null;
          } catch {
            // Ignore when DB still lacks columns.
          }
        }

        if (phone !== undefined || guardianName !== undefined || guardianPhone !== undefined) {
          try {
            await tx.$executeRaw`UPDATE "User" SET "phone" = ${phone ?? null}, "guardianName" = ${guardianName ?? null}, "guardianPhone" = ${guardianPhone ?? null} WHERE "id" = ${user.id}`;
            const rows = await tx.$queryRaw<Array<{ phone: string | null; guardianName: string | null; guardianPhone: string | null }>>`
              SELECT "phone", "guardianName", "guardianPhone" FROM "User" WHERE "id" = ${user.id} LIMIT 1
            `;
            patchedPhone = rows[0]?.phone ?? null;
            patchedGuardianName = rows[0]?.guardianName ?? null;
            patchedGuardianPhone = rows[0]?.guardianPhone ?? null;
          } catch {
            // Ignore when DB still lacks columns.
          }
        }

        if (studentId !== undefined) {
          try {
            await tx.$executeRaw`UPDATE "User" SET "studentId" = ${studentId || null} WHERE "id" = ${user.id}`;
            const rows = await tx.$queryRaw<Array<{ studentId: string | null }>>`
              SELECT "studentId" FROM "User" WHERE "id" = ${user.id} LIMIT 1
            `;
            patchedStudentId = rows[0]?.studentId ?? null;
          } catch {
            // Ignore when DB still lacks columns.
          }
        }

        return {
          ...user,
          country: patchedCountry,
          state: patchedState,
          phone: patchedPhone,
          guardianName: patchedGuardianName,
          guardianPhone: patchedGuardianPhone,
          studentId: patchedStudentId,
        };
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email is already in use." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unable to update user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
