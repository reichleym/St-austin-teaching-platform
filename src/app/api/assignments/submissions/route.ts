import { Prisma, Role } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type SubmissionStatus = "SUBMITTED" | "GRADED" | "PUBLISHED";

type CreateSubmissionBody = {
  assignmentId?: string;
  textResponse?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  quizStartedAt?: string | null;
  quizAnswers?: Array<{ questionId: string; selectedOptionIndex: number }>;
};

type UpdateSubmissionBody = {
  submissionId?: string;
  rawScore?: number | string;
  feedback?: string | null;
  publish?: boolean;
};

type PlagiarismStatus = "PENDING" | "COMPLETED" | "FAILED";

export const runtime = "nodejs";

async function ensureSubmissionSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "AssignmentSubmission" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "textResponse" TEXT,
  "fileUrl" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "lateByMinutes" INTEGER NOT NULL DEFAULT 0,
  "latePenaltyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rawScore" DOUBLE PRECISION,
  "finalScore" DOUBLE PRECISION,
  "feedback" TEXT,
  "gradedById" TEXT,
  "gradedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssignmentSubmission_assignment_student_attempt_key" ON "AssignmentSubmission"("assignmentId", "studentId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "AssignmentSubmission_assignment_student_idx" ON "AssignmentSubmission"("assignmentId", "studentId");
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "quizAnswers" JSONB;
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "quizAutoScore" DOUBLE PRECISION;
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "quizMaxScore" DOUBLE PRECISION;
ALTER TABLE "AssignmentSubmission" ADD COLUMN IF NOT EXISTS "quizStartedAt" TIMESTAMP(3);
`);

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

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "PlagiarismReport" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'INTERNAL_HEURISTIC',
  "similarityScore" DOUBLE PRECISION,
  "summary" TEXT,
  "matchedSources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "errorMessage" TEXT,
  "checkedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlagiarismReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlagiarismReport_submissionId_key" ON "PlagiarismReport"("submissionId");
CREATE INDEX IF NOT EXISTS "PlagiarismReport_status_idx" ON "PlagiarismReport"("status");
`);
}

async function getAssignmentConfig(assignmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      assignmentType: string;
      allowedSubmissionTypes: Prisma.JsonValue;
      maxAttempts: number;
      completionRule: string;
      timerMinutes: number | null;
      dueAt: Date | null;
      maxPoints: Prisma.Decimal;
      courseId: string;
      teacherId: string | null;
    }>
  >`
    SELECT
      COALESCE(cfg."assignmentType", 'HOMEWORK') AS "assignmentType",
      COALESCE(cfg."allowedSubmissionTypes", '["TEXT","FILE"]'::jsonb) AS "allowedSubmissionTypes",
      COALESCE(cfg."maxAttempts", 1) AS "maxAttempts",
      COALESCE(cfg."completionRule", 'SUBMISSION_OR_GRADE') AS "completionRule",
      cfg."timerMinutes",
      a."dueAt",
      a."maxPoints",
      a."courseId",
      c."teacherId"
    FROM "Assignment" a
    JOIN "Course" c ON c."id" = a."courseId"
    LEFT JOIN "AssignmentConfig" cfg ON cfg."assignmentId" = a."id"
    WHERE a."id" = ${assignmentId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  const allowedRaw = Array.isArray(row.allowedSubmissionTypes) ? row.allowedSubmissionTypes : ["TEXT", "FILE"];
  const allowedSubmissionTypes = Array.from(new Set(allowedRaw.filter((item) => item === "TEXT" || item === "FILE"))) as Array<"TEXT" | "FILE">;

  return {
    assignmentType: row.assignmentType,
    allowedSubmissionTypes: allowedSubmissionTypes.length ? allowedSubmissionTypes : (["TEXT"] as Array<"TEXT" | "FILE">),
    maxAttempts: Math.max(1, Number(row.maxAttempts || 1)),
    completionRule: row.completionRule,
    timerMinutes:
      row.timerMinutes !== null && Number.isInteger(Number(row.timerMinutes)) ? Number(row.timerMinutes) : null,
    dueAt: row.dueAt,
    maxPoints: Number(row.maxPoints),
    courseId: row.courseId,
    teacherId: row.teacherId,
  };
}

function parsePenaltyPercent(rules: Prisma.JsonValue | null, lateMinutes: number) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return 0;
  const source = rules as Record<string, unknown>;

  const flat = Number(source.flatPercent ?? source.defaultPercent ?? 0);
  const perDay = Number(source.percentPerDay ?? 0);

  let penalty = Number.isFinite(flat) ? flat : 0;
  if (Number.isFinite(perDay) && perDay > 0 && lateMinutes > 0) {
    penalty += Math.ceil(lateMinutes / (60 * 24)) * perDay;
  }

  if (!Number.isFinite(penalty) || penalty < 0) return 0;
  return Math.min(100, penalty);
}

function parseScore(input: unknown) {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function parseQuizStartedAt(input: unknown) {
  if (typeof input !== "string" || !input.trim()) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
  );
}

function similarityPercent(a: string, b: string) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  if (!union) return 0;
  return Math.round((intersection / union) * 10000) / 100;
}

function canCheckFileType(fileName: string | null, mimeType: string | null) {
  const ext = (fileName ? path.extname(fileName) : "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();
  return ext === ".txt" || mime === "text/plain";
}

async function extractSubmissionContent(submission: {
  textResponse: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
}) {
  const chunks: string[] = [];
  if (submission.textResponse?.trim()) {
    chunks.push(submission.textResponse.trim());
  }
  if (submission.fileUrl && canCheckFileType(submission.fileName, submission.mimeType)) {
    const relative = submission.fileUrl.startsWith("/") ? submission.fileUrl.slice(1) : submission.fileUrl;
    const absolute = path.join(process.cwd(), "public", relative);
    try {
      const content = await fs.readFile(absolute, "utf8");
      if (content.trim()) chunks.push(content.trim());
    } catch {
      // Ignore file extraction failures and continue with available content.
    }
  }
  return chunks.join("\n\n").trim();
}

async function upsertPlagiarismReport(
  submissionId: string,
  payload: {
    status: PlagiarismStatus;
    similarityScore: number | null;
    summary: string;
    matchedSources: unknown[];
    errorMessage: string | null;
    checkedAt: Date | null;
  }
) {
  const id = `plg_${submissionId}`;
  await prisma.$executeRaw`
    INSERT INTO "PlagiarismReport"
      ("id","submissionId","status","provider","similarityScore","summary","matchedSources","errorMessage","checkedAt","updatedAt")
    VALUES
      (${id}, ${submissionId}, ${payload.status}, ${"INTERNAL_HEURISTIC"}, ${payload.similarityScore}, ${payload.summary}, ${JSON.stringify(payload.matchedSources)}::jsonb, ${payload.errorMessage}, ${payload.checkedAt}, NOW())
    ON CONFLICT ("submissionId")
    DO UPDATE SET
      "status" = EXCLUDED."status",
      "provider" = EXCLUDED."provider",
      "similarityScore" = EXCLUDED."similarityScore",
      "summary" = EXCLUDED."summary",
      "matchedSources" = EXCLUDED."matchedSources",
      "errorMessage" = EXCLUDED."errorMessage",
      "checkedAt" = EXCLUDED."checkedAt",
      "updatedAt" = NOW()
  `;
}

async function queuePlagiarismCheck(submissionId: string) {
  await upsertPlagiarismReport(submissionId, {
    status: "PENDING",
    similarityScore: null,
    summary: "Plagiarism check queued.",
    matchedSources: [],
    errorMessage: null,
    checkedAt: null,
  });
}

async function runPlagiarismCheck(submissionId: string) {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        assignmentId: string;
        studentId: string;
        textResponse: string | null;
        fileUrl: string | null;
        fileName: string | null;
        mimeType: string | null;
      }>
    >`
      SELECT "id","assignmentId","studentId","textResponse","fileUrl","fileName","mimeType"
      FROM "AssignmentSubmission"
      WHERE "id" = ${submissionId}
      LIMIT 1
    `;
    const submission = rows[0];
    if (!submission) {
      return;
    }

    const content = await extractSubmissionContent(submission);
    if (!content) {
      await upsertPlagiarismReport(submissionId, {
        status: "FAILED",
        similarityScore: null,
        summary: "No supported content found for plagiarism check.",
        matchedSources: [],
        errorMessage: "Only text and TXT files are checked in MVP.",
        checkedAt: new Date(),
      });
      return;
    }

    const candidates = await prisma.$queryRaw<
      Array<{ id: string; studentId: string; textResponse: string | null }>
    >`
      SELECT "id","studentId","textResponse"
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${submission.assignmentId} AND "id" <> ${submissionId}
      ORDER BY "submittedAt" DESC
      LIMIT 100
    `;

    const matches = candidates
      .map((item) => ({
        submissionId: item.id,
        studentId: item.studentId,
        similarity: similarityPercent(content, item.textResponse ?? ""),
      }))
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const similarityScore = matches.length ? matches[0].similarity : 0;
    const summary =
      similarityScore >= 70
        ? "High similarity detected. Teacher review recommended."
        : similarityScore >= 40
        ? "Medium similarity detected. Review context before grading."
        : "Low similarity detected.";

    await upsertPlagiarismReport(submissionId, {
      status: "COMPLETED",
      similarityScore,
      summary,
      matchedSources: matches,
      errorMessage: null,
      checkedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plagiarism check failed.";
    await upsertPlagiarismReport(submissionId, {
      status: "FAILED",
      similarityScore: null,
      summary: "Plagiarism check failed.",
      matchedSources: [],
      errorMessage: message,
      checkedAt: new Date(),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureSubmissionSchema();
    const user = await requireAuthenticatedUser();

    const assignmentId = request.nextUrl.searchParams.get("assignmentId")?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const config = await getAssignmentConfig(assignmentId);
    if (!config) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    if (user.role === Role.STUDENT) {
      const enrolled = await prisma.enrollment.count({
        where: { courseId: config.courseId, studentId: user.id, status: "ACTIVE" },
      });
      if (!enrolled) {
        return NextResponse.json({ error: "Not enrolled in this course." }, { status: 403 });
      }

      const submissions = await prisma.$queryRaw<
        Array<{
          id: string;
          assignmentId: string;
          studentId: string;
          attemptNumber: number;
          textResponse: string | null;
          fileUrl: string | null;
          fileName: string | null;
          mimeType: string | null;
          submittedAt: Date;
          isLate: boolean;
          lateByMinutes: number;
          latePenaltyPct: number;
          rawScore: number | null;
          finalScore: number | null;
          feedback: string | null;
          gradedById: string | null;
          gradedAt: Date | null;
          publishedAt: Date | null;
          status: string;
        }>
      >`
        SELECT * FROM "AssignmentSubmission"
        WHERE "assignmentId" = ${assignmentId} AND "studentId" = ${user.id}
        ORDER BY "attemptNumber" ASC
      `;

      return NextResponse.json({
        submissions: submissions.map((item) => ({
          ...item,
          submittedAt: item.submittedAt?.toISOString?.() ?? null,
          gradedAt: item.status === "PUBLISHED" ? item.gradedAt?.toISOString?.() ?? null : null,
          publishedAt: item.status === "PUBLISHED" ? item.publishedAt?.toISOString?.() ?? null : null,
          rawScore: item.status === "PUBLISHED" ? item.rawScore : null,
          finalScore: item.status === "PUBLISHED" ? item.finalScore : null,
          feedback: item.status === "PUBLISHED" ? item.feedback : null,
        })),
      });
    }

    if (!isSuperAdminRole(user.role) && !(user.role === Role.TEACHER && config.teacherId === user.id)) {
      return NextResponse.json({ error: "Only admin or assigned teacher can view submissions." }, { status: 403 });
    }

    const submissions = await prisma.$queryRaw<
      Array<{
        id: string;
        assignmentId: string;
        studentId: string;
        attemptNumber: number;
        textResponse: string | null;
        fileUrl: string | null;
        fileName: string | null;
        mimeType: string | null;
        submittedAt: Date;
        isLate: boolean;
        lateByMinutes: number;
        latePenaltyPct: number;
        rawScore: number | null;
        finalScore: number | null;
        feedback: string | null;
        gradedById: string | null;
        gradedAt: Date | null;
        publishedAt: Date | null;
        status: string;
        studentName: string | null;
        studentEmail: string;
        plagiarismStatus: string | null;
        plagiarismScore: number | null;
        plagiarismSummary: string | null;
        plagiarismCheckedAt: Date | null;
      }>
    >`
      SELECT
        s.*,
        u."name" AS "studentName",
        u."email" AS "studentEmail",
        p."status" AS "plagiarismStatus",
        p."similarityScore" AS "plagiarismScore",
        p."summary" AS "plagiarismSummary",
        p."checkedAt" AS "plagiarismCheckedAt"
      FROM "AssignmentSubmission" s
      JOIN "User" u ON u."id" = s."studentId"
      LEFT JOIN "PlagiarismReport" p ON p."submissionId" = s."id"
      WHERE s."assignmentId" = ${assignmentId}
      ORDER BY s."studentId" ASC, s."attemptNumber" ASC
    `;

    return NextResponse.json({
      submissions: submissions.map((item) => ({
        ...item,
        submittedAt: item.submittedAt.toISOString(),
        gradedAt: item.gradedAt?.toISOString() ?? null,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        plagiarismStatus: item.plagiarismStatus,
        plagiarismScore: item.plagiarismScore,
        plagiarismSummary: item.plagiarismSummary,
        plagiarismCheckedAt: item.plagiarismCheckedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load submissions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSubmissionSchema();
    const user = await requireAuthenticatedUser();
    if (user.role !== Role.STUDENT) {
      return NextResponse.json({ error: "Only students can submit assignments." }, { status: 403 });
    }

    const body = (await request.json()) as CreateSubmissionBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    const textResponse = body.textResponse?.trim() || null;
    const fileUrl = body.fileUrl?.trim() || null;
    const fileName = body.fileName?.trim() || null;
    const mimeType = body.mimeType?.trim() || null;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const config = await getAssignmentConfig(assignmentId);
    if (!config) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const enrolled = await prisma.enrollment.count({
      where: { courseId: config.courseId, studentId: user.id, status: "ACTIVE" },
    });
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled in this course." }, { status: 403 });
    }

    const hasText = !!textResponse;
    const hasFile = !!fileUrl;
    const quizAnswers = Array.isArray(body.quizAnswers)
      ? body.quizAnswers
          .map((item) => ({
            questionId: typeof item?.questionId === "string" ? item.questionId.trim() : "",
            selectedOptionIndex: Number(item?.selectedOptionIndex),
          }))
          .filter((item) => item.questionId && Number.isInteger(item.selectedOptionIndex))
      : [];

    if (config.assignmentType === "QUIZ") {
      if (!quizAnswers.length) {
        return NextResponse.json({ error: "Quiz answers are required." }, { status: 400 });
      }
    }

    if (config.assignmentType !== "QUIZ" && hasText && !config.allowedSubmissionTypes.includes("TEXT")) {
      return NextResponse.json({ error: "This assignment does not allow text submissions." }, { status: 400 });
    }
    if (config.assignmentType !== "QUIZ" && hasFile && !config.allowedSubmissionTypes.includes("FILE")) {
      return NextResponse.json({ error: "This assignment does not allow file submissions." }, { status: 400 });
    }
    if (config.assignmentType !== "QUIZ" && !hasText && !hasFile) {
      return NextResponse.json({ error: "Provide text response and/or file upload." }, { status: 400 });
    }

    const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${assignmentId} AND "studentId" = ${user.id}
    `;
    const attemptCount = Number(countRows[0]?.count ?? 0);
    if (attemptCount >= config.maxAttempts) {
      return NextResponse.json({ error: `Maximum attempts reached (${config.maxAttempts}).` }, { status: 400 });
    }

    let lateByMinutes = 0;
    let isLate = false;
    if (config.dueAt) {
      const now = new Date();
      if (now.getTime() > config.dueAt.getTime()) {
        isLate = true;
        lateByMinutes = Math.floor((now.getTime() - config.dueAt.getTime()) / (1000 * 60));
      }
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 1 },
      select: { lateSubmissionPenaltyRules: true },
    });
    const latePenaltyPct = isLate ? parsePenaltyPercent(settings?.lateSubmissionPenaltyRules ?? null, lateByMinutes) : 0;

    const id = `asb_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
    const attemptNumber = attemptCount + 1;

    if (config.assignmentType === "QUIZ") {
      const quizQuestions = await prisma.$queryRaw<
        Array<{ id: string; correctOptionIndex: number; points: number; options: Prisma.JsonValue }>
      >`
        SELECT "id","correctOptionIndex","points","options"
        FROM "AssignmentQuizQuestion"
        WHERE "assignmentId" = ${assignmentId}
        ORDER BY "position" ASC, "createdAt" ASC
      `;
      if (!quizQuestions.length) {
        return NextResponse.json({ error: "Quiz has no configured questions." }, { status: 400 });
      }

      const quizStartedAt = parseQuizStartedAt(body.quizStartedAt);
      if (config.timerMinutes && !quizStartedAt) {
        return NextResponse.json({ error: "Quiz start time is required for timed quizzes." }, { status: 400 });
      }
      if (config.timerMinutes && quizStartedAt) {
        const elapsedMs = Date.now() - quizStartedAt.getTime();
        if (elapsedMs > config.timerMinutes * 60 * 1000) {
          return NextResponse.json({ error: "Quiz timer expired. Submission rejected." }, { status: 400 });
        }
      }

      const answerMap = new Map(quizAnswers.map((item) => [item.questionId, item.selectedOptionIndex]));
      let earned = 0;
      let maxQuizScore = 0;
      for (const question of quizQuestions) {
        const points = Number(question.points || 0);
        if (points > 0) maxQuizScore += points;
        const selected = answerMap.get(question.id);
        if (selected !== undefined && selected === Number(question.correctOptionIndex)) {
          earned += Math.max(0, points);
        }
      }

      const normalizedRaw =
        maxQuizScore > 0 ? Math.round(((earned / maxQuizScore) * Number(config.maxPoints)) * 100) / 100 : 0;
      const penalty = Number(latePenaltyPct || 0);
      const finalScore = Math.max(0, Math.round(normalizedRaw * (1 - penalty / 100) * 100) / 100);

      await prisma.$executeRaw`
        INSERT INTO "AssignmentSubmission"
        ("id","assignmentId","studentId","attemptNumber","textResponse","fileUrl","fileName","mimeType","submittedAt","isLate","lateByMinutes","latePenaltyPct","rawScore","finalScore","quizAnswers","quizAutoScore","quizMaxScore","quizStartedAt","gradedAt","publishedAt","status")
        VALUES
        (${id}, ${assignmentId}, ${user.id}, ${attemptNumber}, ${null}, ${null}, ${null}, ${null}, NOW(), ${isLate}, ${lateByMinutes}, ${latePenaltyPct}, ${normalizedRaw}, ${finalScore}, ${JSON.stringify(quizAnswers)}::jsonb, ${earned}, ${maxQuizScore}, ${quizStartedAt}, NOW(), NOW(), ${"PUBLISHED"})
      `;

      await prisma.grade.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: user.id,
          },
        },
        create: {
          assignmentId,
          studentId: user.id,
          points: new Prisma.Decimal(finalScore),
          awardedById: null,
          publishedAt: new Date(),
        },
        update: {
          points: new Prisma.Decimal(finalScore),
          awardedById: null,
          publishedAt: new Date(),
        },
      });

      return NextResponse.json(
        { ok: true, assignmentId, attemptNumber, latePenaltyPct, rawScore: normalizedRaw, finalScore },
        { status: 201 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "AssignmentSubmission"
      ("id","assignmentId","studentId","attemptNumber","textResponse","fileUrl","fileName","mimeType","submittedAt","isLate","lateByMinutes","latePenaltyPct","status")
      VALUES
      (${id}, ${assignmentId}, ${user.id}, ${attemptNumber}, ${textResponse}, ${fileUrl}, ${fileName}, ${mimeType}, NOW(), ${isLate}, ${lateByMinutes}, ${latePenaltyPct}, ${"SUBMITTED"})
    `;

    await queuePlagiarismCheck(id);
    void runPlagiarismCheck(id);

    return NextResponse.json({ ok: true, assignmentId, attemptNumber, latePenaltyPct }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to submit assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSubmissionSchema();
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role) && user.role !== Role.TEACHER) {
      return NextResponse.json({ error: "Only admin/teacher can grade submissions." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateSubmissionBody;
    const submissionId = body.submissionId?.trim() ?? "";
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required." }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        assignmentId: string;
        studentId: string;
        latePenaltyPct: number;
        maxPoints: Prisma.Decimal;
        teacherId: string | null;
        rawScore: number | null;
        feedback: string | null;
        status: string;
      }>
    >`
      SELECT s."id", s."assignmentId", s."studentId", s."latePenaltyPct", s."rawScore", s."feedback", s."status", a."maxPoints", c."teacherId"
      FROM "AssignmentSubmission" s
      JOIN "Assignment" a ON a."id" = s."assignmentId"
      JOIN "Course" c ON c."id" = a."courseId"
      WHERE s."id" = ${submissionId}
      LIMIT 1
    `;

    const submission = rows[0];
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    if (user.role === Role.TEACHER && submission.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only grade submissions in your assigned courses." }, { status: 403 });
    }

    const parsedRawScore = body.rawScore !== undefined ? parseScore(body.rawScore) : null;
    if (body.rawScore !== undefined && parsedRawScore === null) {
      return NextResponse.json({ error: "rawScore must be a valid non-negative number." }, { status: 400 });
    }
    const nextRawScore = body.rawScore !== undefined ? parsedRawScore : submission.rawScore;
    const nextFeedback = body.feedback !== undefined ? body.feedback?.trim() || null : submission.feedback;
    const publishRequested = !!body.publish;
    if (publishRequested && nextRawScore === null) {
      return NextResponse.json({ error: "Cannot publish grade without rawScore." }, { status: 400 });
    }

    const maxPoints = Number(submission.maxPoints);
    const cappedRaw = nextRawScore === null ? null : Math.min(maxPoints, nextRawScore);
    const penalty = Number(submission.latePenaltyPct || 0);
    const finalScore = cappedRaw === null ? null : Math.max(0, Math.round(cappedRaw * (1 - penalty / 100) * 100) / 100);
    const wasPublished = submission.status === "PUBLISHED";

    const status: SubmissionStatus = publishRequested || wasPublished ? "PUBLISHED" : cappedRaw !== null || nextFeedback ? "GRADED" : "SUBMITTED";

    await prisma.$executeRaw`
      UPDATE "AssignmentSubmission"
      SET
        "rawScore" = ${cappedRaw},
        "finalScore" = ${finalScore},
        "feedback" = ${nextFeedback},
        "gradedById" = ${user.id},
        "gradedAt" = NOW(),
        "publishedAt" = CASE WHEN ${publishRequested} THEN NOW() ELSE "publishedAt" END,
        "status" = ${status}
      WHERE "id" = ${submissionId}
    `;

    if (finalScore !== null) {
      const nextPublishedAt = publishRequested || wasPublished ? new Date() : null;
      await prisma.grade.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: submission.assignmentId,
            studentId: submission.studentId,
          },
        },
        create: {
          assignmentId: submission.assignmentId,
          studentId: submission.studentId,
          points: new Prisma.Decimal(finalScore),
          awardedById: user.id,
          publishedAt: nextPublishedAt,
        },
        update: {
          points: new Prisma.Decimal(finalScore),
          awardedById: user.id,
          publishedAt: nextPublishedAt,
        },
      });
    }

    return NextResponse.json({ ok: true, submissionId, status, finalScore });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to grade submission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
