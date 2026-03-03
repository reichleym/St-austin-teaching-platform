import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateQuestionBody = {
  assignmentId?: string;
  prompt?: string;
  options?: string[];
  correctOptionIndex?: number;
  points?: number;
};

type DeleteQuestionBody = {
  questionId?: string;
};

function canManage(role: Role | string) {
  return isSuperAdminRole(role) || role === Role.TEACHER;
}

function normalizeOptions(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

async function getAssignmentAccess(assignmentId: string, user: { id: string; role: Role | string }) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { id: true, teacherId: true } } },
  });
  if (!assignment) return { assignment: null, allowed: false };

  if (isSuperAdminRole(user.role)) return { assignment, allowed: true };
  if (user.role === Role.TEACHER) {
    return { assignment, allowed: assignment.course.teacherId === user.id };
  }
  if (user.role === Role.STUDENT) {
    const enrolled = await prisma.enrollment.count({
      where: {
        courseId: assignment.course.id,
        studentId: user.id,
        status: "ACTIVE",
      },
    });
    return { assignment, allowed: enrolled > 0 };
  }
  return { assignment, allowed: false };
}

async function ensureQuizQuestionSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "AssignmentQuizQuestion" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "correctOptionIndex" INTEGER NOT NULL,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentQuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssignmentQuizQuestion_assignmentId_idx" ON "AssignmentQuizQuestion"("assignmentId");
  `);
}

export async function GET(request: NextRequest) {
  try {
    await ensureQuizQuestionSchema();
    const user = await requireAuthenticatedUser();

    const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }
    const access = await getAssignmentAccess(assignmentId, user);
    if (!access.assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "You do not have access to this assignment." }, { status: 403 });
    }

    const questions = await prisma.$queryRaw<
      Array<{
        id: string;
        assignmentId: string;
        prompt: string;
        options: unknown;
        correctOptionIndex: number;
        points: number;
        position: number;
      }>
    >`
      SELECT "id","assignmentId","prompt","options","correctOptionIndex","points","position"
      FROM "AssignmentQuizQuestion"
      WHERE "assignmentId" = ${assignmentId}
      ORDER BY "position" ASC, "createdAt" ASC
    `;

    return NextResponse.json({
      questions: questions.map((item) => {
        const base = {
          id: item.id,
          assignmentId: item.assignmentId,
          prompt: item.prompt,
          options: Array.isArray(item.options) ? item.options : [],
          points: item.points,
          position: item.position,
        };
        if (user.role === Role.STUDENT) {
          return base;
        }
        return {
          ...base,
          correctOptionIndex: item.correctOptionIndex,
        };
      }),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load quiz questions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureQuizQuestionSchema();
    const user = await requireAuthenticatedUser();
    if (!canManage(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can create quiz questions." }, { status: 403 });
    }

    const body = (await request.json()) as CreateQuestionBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    const prompt = body.prompt?.trim() ?? "";
    const options = normalizeOptions(body.options);
    const correctOptionIndex = Number(body.correctOptionIndex);
    const points = Number(body.points ?? 1);

    if (!assignmentId || !prompt || options.length < 2) {
      return NextResponse.json({ error: "assignmentId, prompt and at least 2 options are required." }, { status: 400 });
    }
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      return NextResponse.json({ error: "Invalid correctOptionIndex." }, { status: 400 });
    }
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ error: "points must be > 0." }, { status: 400 });
    }

    const access = await getAssignmentAccess(assignmentId, user);
    if (!access.assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "You can only manage quiz questions in your assigned courses." }, { status: 403 });
    }

    const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AssignmentQuizQuestion"
      WHERE "assignmentId" = ${assignmentId}
    `;
    const position = Number(countRows[0]?.count ?? 0);
    const id = `aq_${randomUUID()}`;

    await prisma.$executeRaw`
      INSERT INTO "AssignmentQuizQuestion"
      ("id","assignmentId","prompt","options","correctOptionIndex","points","position","createdAt","updatedAt")
      VALUES
      (${id}, ${assignmentId}, ${prompt}, ${JSON.stringify(options)}::jsonb, ${correctOptionIndex}, ${points}, ${position}, NOW(), NOW())
    `;

    return NextResponse.json({ ok: true, questionId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create quiz question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureQuizQuestionSchema();
    const user = await requireAuthenticatedUser();
    if (!canManage(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can delete quiz questions." }, { status: 403 });
    }

    const body = (await request.json()) as DeleteQuestionBody;
    const questionId = body.questionId?.trim() ?? "";
    if (!questionId) {
      return NextResponse.json({ error: "questionId is required." }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      Array<{ id: string; assignmentId: string; teacherId: string | null }>
    >`
      SELECT q."id", q."assignmentId", c."teacherId"
      FROM "AssignmentQuizQuestion" q
      JOIN "Assignment" a ON a."id" = q."assignmentId"
      JOIN "Course" c ON c."id" = a."courseId"
      WHERE q."id" = ${questionId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }
    if (user.role === Role.TEACHER && row.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only delete quiz questions in your assigned courses." }, { status: 403 });
    }

    await prisma.$executeRaw`DELETE FROM "AssignmentQuizQuestion" WHERE "id" = ${questionId}`;
    return NextResponse.json({ ok: true, questionId });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to delete quiz question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
