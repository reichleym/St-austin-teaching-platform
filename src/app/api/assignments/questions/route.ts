import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateQuestionBody = {
  assignmentId?: string;
  prompt?: string;
  questionType?: "MCQ" | "SHORT_ANSWER";
  options?: string[];
  correctOptionIndexes?: number[];
  correctOptionIndex?: number;
  shortAnswerKey?: string | null;
  points?: number;
};

type UpdateQuestionBody = {
  questionId?: string;
  prompt?: string;
  questionType?: "MCQ" | "SHORT_ANSWER";
  options?: string[];
  correctOptionIndexes?: number[];
  correctOptionIndex?: number;
  shortAnswerKey?: string | null;
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

function normalizeCorrectOptionIndexes(input: unknown, fallback: unknown) {
  const primary = Array.isArray(input) ? input.map((item) => Number(item)) : [];
  const values = primary.length ? primary : [Number(fallback)];
  return Array.from(new Set(values.filter((item) => Number.isInteger(item)))).sort((a, b) => a - b);
}

function parseQuestionType(input: unknown): "MCQ" | "SHORT_ANSWER" {
  return input === "SHORT_ANSWER" ? "SHORT_ANSWER" : "MCQ";
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
  "questionType" TEXT NOT NULL DEFAULT 'MCQ',
  "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "correctOptionIndexes" JSONB NOT NULL DEFAULT '[0]'::jsonb,
  "correctOptionIndex" INTEGER NOT NULL,
  "shortAnswerKey" TEXT,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentQuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssignmentQuizQuestion_assignmentId_idx" ON "AssignmentQuizQuestion"("assignmentId");
ALTER TABLE "AssignmentQuizQuestion" ADD COLUMN IF NOT EXISTS "questionType" TEXT;
ALTER TABLE "AssignmentQuizQuestion" ADD COLUMN IF NOT EXISTS "correctOptionIndexes" JSONB;
ALTER TABLE "AssignmentQuizQuestion" ADD COLUMN IF NOT EXISTS "shortAnswerKey" TEXT;
UPDATE "AssignmentQuizQuestion"
SET "questionType" = 'MCQ'
WHERE "questionType" IS NULL;
ALTER TABLE "AssignmentQuizQuestion" ALTER COLUMN "questionType" SET DEFAULT 'MCQ';
ALTER TABLE "AssignmentQuizQuestion" ALTER COLUMN "questionType" SET NOT NULL;
UPDATE "AssignmentQuizQuestion"
SET "correctOptionIndexes" = jsonb_build_array("correctOptionIndex")
WHERE "correctOptionIndexes" IS NULL;
ALTER TABLE "AssignmentQuizQuestion" ALTER COLUMN "correctOptionIndexes" SET DEFAULT '[0]'::jsonb;
ALTER TABLE "AssignmentQuizQuestion" ALTER COLUMN "correctOptionIndexes" SET NOT NULL;
  `);
}

async function getAssignmentType(assignmentId: string) {
  const rows = await prisma.$queryRaw<Array<{ assignmentType: string | null }>>`
    SELECT COALESCE(cfg."assignmentType", 'HOMEWORK') AS "assignmentType"
    FROM "Assignment" a
    LEFT JOIN "AssignmentConfig" cfg ON cfg."assignmentId" = a."id"
    WHERE a."id" = ${assignmentId}
    LIMIT 1
  `;
  const assignmentType = rows[0]?.assignmentType;
  if (assignmentType === "QUIZ" || assignmentType === "EXAM" || assignmentType === "HOMEWORK") {
    return assignmentType;
  }
  return "HOMEWORK";
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
        questionType: string;
        options: unknown;
        correctOptionIndexes: unknown;
        correctOptionIndex: number;
        shortAnswerKey: string | null;
        points: number;
        position: number;
      }>
    >`
      SELECT "id","assignmentId","prompt","questionType","options","correctOptionIndexes","correctOptionIndex","shortAnswerKey","points","position"
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
          questionType: parseQuestionType(item.questionType),
          options: Array.isArray(item.options) ? item.options : [],
          points: item.points,
          position: item.position,
        };
        if (user.role === Role.STUDENT) {
          return base;
        }
        const correctOptionIndexes = normalizeCorrectOptionIndexes(item.correctOptionIndexes, item.correctOptionIndex);
        return {
          ...base,
          correctOptionIndexes,
          correctOptionIndex: correctOptionIndexes[0] ?? item.correctOptionIndex,
          shortAnswerKey: item.shortAnswerKey,
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
    const questionType = parseQuestionType(body.questionType);
    const options = normalizeOptions(body.options);
    const correctOptionIndexes = normalizeCorrectOptionIndexes(body.correctOptionIndexes, body.correctOptionIndex);
    const shortAnswerKey = typeof body.shortAnswerKey === "string" ? body.shortAnswerKey.trim() || null : null;
    const points = Number(body.points ?? 1);

    if (!assignmentId || !prompt) {
      return NextResponse.json({ error: "assignmentId and prompt are required." }, { status: 400 });
    }
    if (questionType === "MCQ" && options.length < 2) {
      return NextResponse.json({ error: "At least 2 options are required for MCQ." }, { status: 400 });
    }
    if (questionType === "MCQ" && !correctOptionIndexes.length) {
      return NextResponse.json({ error: "At least one correct option is required." }, { status: 400 });
    }
    if (questionType === "MCQ" && correctOptionIndexes.some((index) => index < 0 || index >= options.length)) {
      return NextResponse.json({ error: "Invalid correctOptionIndexes." }, { status: 400 });
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
    const assignmentType = await getAssignmentType(assignmentId);
    if (assignmentType !== "QUIZ" && assignmentType !== "EXAM") {
      return NextResponse.json({ error: "Questions can only be added to quiz or exam assignments." }, { status: 400 });
    }
    if (assignmentType === "QUIZ" && questionType !== "MCQ") {
      return NextResponse.json({ error: "Quiz assignments currently support MCQ questions only." }, { status: 400 });
    }

    const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AssignmentQuizQuestion"
      WHERE "assignmentId" = ${assignmentId}
    `;
    const position = Number(countRows[0]?.count ?? 0);
    const id = `aq_${randomUUID()}`;
    const normalizedCorrectOptionIndexes = questionType === "MCQ" ? correctOptionIndexes : [];
    const correctOptionIndex = normalizedCorrectOptionIndexes[0] ?? 0;

    await prisma.$executeRaw`
      INSERT INTO "AssignmentQuizQuestion"
      ("id","assignmentId","prompt","questionType","options","correctOptionIndexes","correctOptionIndex","shortAnswerKey","points","position","createdAt","updatedAt")
      VALUES
      (${id}, ${assignmentId}, ${prompt}, ${questionType}, ${JSON.stringify(options)}::jsonb, ${JSON.stringify(normalizedCorrectOptionIndexes)}::jsonb, ${correctOptionIndex}, ${shortAnswerKey}, ${points}, ${position}, NOW(), NOW())
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

export async function PATCH(request: NextRequest) {
  try {
    await ensureQuizQuestionSchema();
    const user = await requireAuthenticatedUser();
    if (!canManage(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can update quiz questions." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateQuestionBody;
    const questionId = body.questionId?.trim() ?? "";
    const prompt = body.prompt?.trim() ?? "";
    const questionType = parseQuestionType(body.questionType);
    const options = normalizeOptions(body.options);
    const correctOptionIndexes = normalizeCorrectOptionIndexes(body.correctOptionIndexes, body.correctOptionIndex);
    const shortAnswerKey = typeof body.shortAnswerKey === "string" ? body.shortAnswerKey.trim() || null : null;
    const points = Number(body.points ?? 1);

    if (!questionId || !prompt) {
      return NextResponse.json({ error: "questionId and prompt are required." }, { status: 400 });
    }
    if (questionType === "MCQ" && options.length < 2) {
      return NextResponse.json({ error: "At least 2 options are required for MCQ." }, { status: 400 });
    }
    if (questionType === "MCQ" && !correctOptionIndexes.length) {
      return NextResponse.json({ error: "At least one correct option is required." }, { status: 400 });
    }
    if (questionType === "MCQ" && correctOptionIndexes.some((index) => index < 0 || index >= options.length)) {
      return NextResponse.json({ error: "Invalid correctOptionIndexes." }, { status: 400 });
    }
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json({ error: "points must be > 0." }, { status: 400 });
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
      return NextResponse.json({ error: "You can only update quiz questions in your assigned courses." }, { status: 403 });
    }

    const assignmentType = await getAssignmentType(row.assignmentId);
    if (assignmentType !== "QUIZ" && assignmentType !== "EXAM") {
      return NextResponse.json({ error: "Questions can only be updated for quiz or exam assignments." }, { status: 400 });
    }
    if (assignmentType === "QUIZ" && questionType !== "MCQ") {
      return NextResponse.json({ error: "Quiz assignments currently support MCQ questions only." }, { status: 400 });
    }

    const normalizedCorrectOptionIndexes = questionType === "MCQ" ? correctOptionIndexes : [];
    const correctOptionIndex = normalizedCorrectOptionIndexes[0] ?? 0;

    await prisma.$executeRaw`
      UPDATE "AssignmentQuizQuestion"
      SET
        "prompt" = ${prompt},
        "questionType" = ${questionType},
        "options" = ${JSON.stringify(questionType === "MCQ" ? options : [])}::jsonb,
        "correctOptionIndexes" = ${JSON.stringify(normalizedCorrectOptionIndexes)}::jsonb,
        "correctOptionIndex" = ${correctOptionIndex},
        "shortAnswerKey" = ${questionType === "SHORT_ANSWER" ? shortAnswerKey : null},
        "points" = ${points},
        "updatedAt" = NOW()
      WHERE "id" = ${questionId}
    `;

    return NextResponse.json({ ok: true, questionId });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update quiz question.";
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
