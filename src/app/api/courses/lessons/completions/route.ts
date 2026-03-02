import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CompletionBody = {
  lessonId?: string;
  studentId?: string;
  completed?: boolean;
};

function getLessonCompletionDelegate() {
  return (prisma as unknown as { lessonCompletion?: typeof prisma.lessonCompletion }).lessonCompletion;
}

async function ensureLessonCompletionSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "LessonCompletion" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LessonCompletion_lessonId_studentId_key" ON "LessonCompletion"("lessonId", "studentId");
`);
}

async function getLessonContext(lessonId: string, studentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      lessonId: string;
      courseId: string;
      teacherId: string | null;
      enrolledCount: bigint | number;
    }>
  >`
    SELECT
      l."id" AS "lessonId",
      m."courseId",
      c."teacherId",
      (
        SELECT COUNT(*)::bigint
        FROM "Enrollment" e
        WHERE e."courseId" = m."courseId"
          AND e."studentId" = ${studentId}
          AND e."status" = CAST('ACTIVE' AS "EnrollmentStatus")
      ) AS "enrolledCount"
    FROM "Lesson" l
    JOIN "CourseModule" m ON m."id" = l."moduleId"
    JOIN "Course" c ON c."id" = m."courseId"
    WHERE l."id" = ${lessonId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role) && user.role !== Role.TEACHER) {
      return NextResponse.json({ error: "Only admin/teacher can update lesson completion." }, { status: 403 });
    }

    await ensureLessonCompletionSchema();

    const body = (await request.json()) as CompletionBody;
    const lessonId = body.lessonId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const completed = body.completed ?? true;

    if (!lessonId || !studentId) {
      return NextResponse.json({ error: "lessonId and studentId are required." }, { status: 400 });
    }

    const ctx = await getLessonContext(lessonId, studentId);
    if (!ctx) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    if (user.role === Role.TEACHER && ctx.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only manage completion for your assigned courses." }, { status: 403 });
    }

    if (Number(ctx.enrolledCount) === 0) {
      return NextResponse.json({ error: "Student is not actively enrolled in this course." }, { status: 400 });
    }

    const lessonCompletion = getLessonCompletionDelegate();

    if (!lessonCompletion) {
      if (completed) {
        const id = `lcp_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
        await prisma.$executeRaw`
          INSERT INTO "LessonCompletion" ("id","lessonId","studentId","completedAt")
          VALUES (${id}, ${lessonId}, ${studentId}, NOW())
          ON CONFLICT ("lessonId","studentId")
          DO UPDATE SET "completedAt" = NOW()
        `;
      } else {
        await prisma.$executeRaw`
          DELETE FROM "LessonCompletion"
          WHERE "lessonId" = ${lessonId} AND "studentId" = ${studentId}
        `;
      }
    } else if (completed) {
      await lessonCompletion.upsert({
        where: { lessonId_studentId: { lessonId, studentId } },
        create: { lessonId, studentId },
        update: { completedAt: new Date() },
      });
    } else {
      await lessonCompletion.deleteMany({
        where: { lessonId, studentId },
      });
    }

    return NextResponse.json({ ok: true, lessonId, studentId, completed });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update lesson completion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
