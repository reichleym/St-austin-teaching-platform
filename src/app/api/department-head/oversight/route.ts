import { Prisma, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function ensureDepartmentHeadCourseSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "DepartmentHeadCourseAssignment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "departmentHeadId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentHeadCourseAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHeadCourseAssignment_course_head_key"
  ON "DepartmentHeadCourseAssignment"("courseId","departmentHeadId");
CREATE INDEX IF NOT EXISTS "DepartmentHeadCourseAssignment_head_idx"
  ON "DepartmentHeadCourseAssignment"("departmentHeadId","createdAt");
  `);
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const isSuperAdmin = isSuperAdminRole(user.role);
    if (!isSuperAdmin && user.role !== Role.DEPARTMENT_HEAD) {
      return NextResponse.json({ error: "Only department heads can access oversight." }, { status: 403 });
    }

    await ensureDepartmentHeadCourseSchema();

    const assignedCourseIds = !isSuperAdmin
      ? await prisma
          .$queryRaw<Array<{ courseId: string }>>`
            SELECT "courseId"
            FROM "DepartmentHeadCourseAssignment"
            WHERE "departmentHeadId" = ${user.id}
          `
          .then((rows) => rows.map((row) => row.courseId))
          .catch(() => [])
      : [];

    const courses = await prisma.course.findMany({
      where: isSuperAdmin
        ? {}
        : { id: { in: assignedCourseIds.length ? assignedCourseIds : ["__none__"] } },
      select: {
        id: true,
        code: true,
        title: true,
        teacherId: true,
        teacher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const courseIds = courses.map((course) => course.id);
    const enrollmentCounts = new Map<string, number>();
    const assignmentCounts = new Map<string, number>();
    const submissionCounts = new Map<string, number>();
    const gradeStats = new Map<string, { count: number; avg: number | null }>();

    if (courseIds.length) {
      const enrollmentRows = await prisma.$queryRaw<Array<{ courseId: string; count: bigint | number }>>`
        SELECT "courseId", COUNT(*)::bigint AS count
        FROM "Enrollment"
        WHERE "courseId" IN (${Prisma.join(courseIds)}) AND "status" = CAST('ACTIVE' AS "EnrollmentStatus")
        GROUP BY "courseId"
      `;
      for (const row of enrollmentRows) {
        enrollmentCounts.set(row.courseId, Number(row.count));
      }

      const assignmentRows = await prisma.$queryRaw<Array<{ courseId: string; count: bigint | number }>>`
        SELECT "courseId", COUNT(*)::bigint AS count
        FROM "Assignment"
        WHERE "courseId" IN (${Prisma.join(courseIds)})
        GROUP BY "courseId"
      `;
      for (const row of assignmentRows) {
        assignmentCounts.set(row.courseId, Number(row.count));
      }

      try {
        const submissionRows = await prisma.$queryRaw<Array<{ courseId: string; count: bigint | number }>>`
          SELECT a."courseId", COUNT(*)::bigint AS count
          FROM "AssignmentSubmission" s
          JOIN "Assignment" a ON a."id" = s."assignmentId"
          WHERE a."courseId" IN (${Prisma.join(courseIds)})
          GROUP BY a."courseId"
        `;
        for (const row of submissionRows) {
          submissionCounts.set(row.courseId, Number(row.count));
        }
      } catch {
        // Ignore if submission table isn't available yet.
      }

      try {
        const gradeRows = await prisma.$queryRaw<
          Array<{ courseId: string; count: bigint | number; avg: number | null }>
        >`
          SELECT a."courseId", COUNT(*)::bigint AS count, AVG(g."points")::float AS avg
          FROM "Grade" g
          JOIN "Assignment" a ON a."id" = g."assignmentId"
          WHERE a."courseId" IN (${Prisma.join(courseIds)})
          GROUP BY a."courseId"
        `;
        for (const row of gradeRows) {
          gradeStats.set(row.courseId, {
            count: Number(row.count),
            avg: row.avg !== null && Number.isFinite(Number(row.avg)) ? Number(row.avg) : null,
          });
        }
      } catch {
        // Ignore if grade table isn't available yet.
      }
    }

    return NextResponse.json({
      courses: courses.map((course) => {
        const gradeStat = gradeStats.get(course.id);
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          teacher: course.teacher,
          enrollmentCount: enrollmentCounts.get(course.id) ?? 0,
          assignmentCount: assignmentCounts.get(course.id) ?? 0,
          submissionCount: submissionCounts.get(course.id) ?? 0,
          gradedCount: gradeStat?.count ?? 0,
          averageGrade: gradeStat?.avg ?? null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load oversight data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
