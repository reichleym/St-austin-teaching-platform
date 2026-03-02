import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type UpdateAssignmentBody = {
  moduleId?: string;
  studentId?: string;
  assigned?: boolean;
};

async function ensureModuleAssignmentSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "ModuleAssignment" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModuleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModuleAssignment_moduleId_studentId_key" ON "ModuleAssignment"("moduleId", "studentId");
CREATE INDEX IF NOT EXISTS "ModuleAssignment_moduleId_idx" ON "ModuleAssignment"("moduleId");
`);
}

async function getModuleAccess(moduleId: string, user: { id: string; role: Role | string }) {
  const rows = await prisma.$queryRaw<
    Array<{ moduleId: string; courseId: string; teacherId: string | null }>
  >`
    SELECT m."id" AS "moduleId", m."courseId", c."teacherId"
    FROM "CourseModule" m
    JOIN "Course" c ON c."id" = m."courseId"
    WHERE m."id" = ${moduleId}
    LIMIT 1
  `;
  const moduleRecord = rows[0];
  if (!moduleRecord) {
    return { ok: false as const, status: 404, error: "Module not found." };
  }

  const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && moduleRecord.teacherId === user.id);
  if (!canManage) {
    return { ok: false as const, status: 403, error: "Only admin or assigned teacher can manage module assignments." };
  }

  return { ok: true as const, module: moduleRecord };
}

export async function GET(request: NextRequest) {
  try {
    await ensureModuleAssignmentSchema();
    const user = await requireAuthenticatedUser();
    const moduleId = request.nextUrl.searchParams.get("moduleId")?.trim() ?? "";
    if (!moduleId) {
      return NextResponse.json({ error: "moduleId is required." }, { status: 400 });
    }

    const access = await getModuleAccess(moduleId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const students = await prisma.$queryRaw<
      Array<{ id: string; name: string | null; email: string; assigned: boolean }>
    >`
      SELECT
        u."id",
        u."name",
        u."email",
        (ma."id" IS NOT NULL) AS "assigned"
      FROM "Enrollment" e
      JOIN "User" u ON u."id" = e."studentId"
      LEFT JOIN "ModuleAssignment" ma ON ma."moduleId" = ${moduleId} AND ma."studentId" = u."id"
      WHERE e."courseId" = ${access.module.courseId} AND e."status" = CAST('ACTIVE' AS "EnrollmentStatus")
      ORDER BY u."name" ASC NULLS LAST, u."email" ASC
    `;

    return NextResponse.json({ students });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load module assignments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureModuleAssignmentSchema();
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as UpdateAssignmentBody;

    const moduleId = body.moduleId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const assigned = body.assigned ?? true;

    if (!moduleId || !studentId) {
      return NextResponse.json({ error: "moduleId and studentId are required." }, { status: 400 });
    }

    const access = await getModuleAccess(moduleId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const enrolled = await prisma.enrollment.findFirst({
      where: {
        courseId: access.module.courseId,
        studentId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!enrolled) {
      return NextResponse.json({ error: "Student is not actively enrolled in this course." }, { status: 400 });
    }

    if (assigned) {
      await prisma.$executeRaw`
        INSERT INTO "ModuleAssignment" ("id","moduleId","studentId","assignedById","createdAt","updatedAt")
        VALUES (${`mas_${randomUUID()}`}, ${moduleId}, ${studentId}, ${user.id}, NOW(), NOW())
        ON CONFLICT ("moduleId","studentId")
        DO UPDATE SET "assignedById" = ${user.id}, "updatedAt" = NOW()
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM "ModuleAssignment"
        WHERE "moduleId" = ${moduleId} AND "studentId" = ${studentId}
      `;
    }

    return NextResponse.json({ ok: true, moduleId, studentId, assigned });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update module assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
