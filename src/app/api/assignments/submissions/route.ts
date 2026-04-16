import { Prisma, Role } from "@prisma/client";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
// import { Dolos } from "@dodona/dolos-lib"; // Moved to dynamic import
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_VISIBILITY_PUBLISHED, isCourseExpired } from "@/lib/courses";

type GradeLifecycleState =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "GRADED_DRAFT"
  | "GRADE_PUBLISHED"
  | "GRADE_EDIT_REQUESTED"
  | "GRADE_EDIT_APPROVED"
  | "GRADE_EDIT_REJECTED";

type CreateSubmissionBody = {
  assignmentId?: string;
  textResponse?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  quizStartedAt?: string | null;
  quizAnswers?: Array<{
    questionId: string;
    selectedOptionIndex?: number;
    selectedOptionIndices?: number[];
    shortAnswerText?: string | null;
  }>;
};

type UpdateSubmissionBody = {
  submissionId?: string;
  rawScore?: number | string;
  feedback?: string | null;
  publish?: boolean;
  action?: "GRADE" | "INVALIDATE_ATTEMPT";
  reason?: string | null;
};

type PlagiarismStatus = "PENDING" | "COMPLETED" | "FAILED";
type AttemptScoringStrategy = "LATEST" | "HIGHEST";
type PlagiarismProvider = "DOLOS" | "INTERNAL_HEURISTIC";

const PUBLISHED_STATES: GradeLifecycleState[] = [
  "GRADE_PUBLISHED",
  "GRADE_EDIT_REQUESTED",
  "GRADE_EDIT_APPROVED",
  "GRADE_EDIT_REJECTED",
];
const ATTEMPT_CANCELLED = "ATTEMPT_CANCELLED";

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
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "attemptScoringStrategy" TEXT;
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);
`);

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

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "GradeHistory" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "submissionId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "oldRawScore" DOUBLE PRECISION,
  "newRawScore" DOUBLE PRECISION,
  "oldFinalScore" DOUBLE PRECISION,
  "newFinalScore" DOUBLE PRECISION,
  "oldState" TEXT,
  "newState" TEXT,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GradeHistory_assignment_student_idx" ON "GradeHistory"("assignmentId","studentId","createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "NotificationEvent" (
  "id" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NotificationEvent_recipient_created_idx" ON "NotificationEvent"("recipientId","createdAt");
`);
}

async function getAssignmentConfig(assignmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      assignmentType: string;
      allowedSubmissionTypes: Prisma.JsonValue;
      maxAttempts: number;
      completionRule: string;
      attemptScoringStrategy: string | null;
      allowLateSubmissions: boolean | null;
      timerMinutes: number | null;
      startAt: Date | null;
      endAt: Date | null;
      maxPoints: Prisma.Decimal;
      courseId: string;
      courseVisibility: string | null;
      courseEndDate: Date | null;
      teacherId: string | null;
    }>
  >`
    SELECT
      COALESCE(cfg."assignmentType", 'HOMEWORK') AS "assignmentType",
      COALESCE(cfg."allowedSubmissionTypes", '["TEXT","FILE"]'::jsonb) AS "allowedSubmissionTypes",
      COALESCE(cfg."maxAttempts", 1) AS "maxAttempts",
      COALESCE(cfg."completionRule", 'SUBMISSION_OR_GRADE') AS "completionRule",
      COALESCE(cfg."attemptScoringStrategy", 'LATEST') AS "attemptScoringStrategy",
      COALESCE(cfg."allowLateSubmissions", true) AS "allowLateSubmissions",
      cfg."timerMinutes",
      cfg."startAt",
      a."dueAt" AS "endAt",
      a."maxPoints",
      a."courseId",
      c."visibility"::text AS "courseVisibility",
      c."endDate" AS "courseEndDate",
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
  const isQuizAssignment = row.assignmentType === "QUIZ";
  const resolvedSubmissionTypes = isQuizAssignment ? [] : allowedSubmissionTypes;

  return {
    assignmentType: row.assignmentType,
    allowedSubmissionTypes: resolvedSubmissionTypes.length
      ? resolvedSubmissionTypes
      : (isQuizAssignment ? ([] as Array<"TEXT" | "FILE">) : (["TEXT"] as Array<"TEXT" | "FILE">)),
    maxAttempts: Math.max(1, Number(row.maxAttempts || 1)),
    completionRule: row.completionRule,
    attemptScoringStrategy: (row.attemptScoringStrategy === "HIGHEST" ? "HIGHEST" : "LATEST") as AttemptScoringStrategy,
    allowLateSubmissions: row.allowLateSubmissions !== false,
    timerMinutes:
      row.timerMinutes !== null && Number.isInteger(Number(row.timerMinutes)) ? Number(row.timerMinutes) : null,
    startAt: row.startAt,
    endAt: row.endAt,
    maxPoints: Number(row.maxPoints),
    courseId: row.courseId,
    courseVisibility: row.courseVisibility,
    courseEndDate: row.courseEndDate ?? null,
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

function normalizeOptionIndexes(input: unknown, fallback: unknown) {
  const primary = Array.isArray(input) ? input.map((item) => Number(item)) : [];
  const values = primary.length ? primary : [Number(fallback)];
  return Array.from(new Set(values.filter((item) => Number.isInteger(item)))).sort((a, b) => a - b);
}

function parseQuestionType(input: unknown): "MCQ" | "SHORT_ANSWER" {
  return input === "SHORT_ANSWER" ? "SHORT_ANSWER" : "MCQ";
}

function hasExactOptionMatch(selected: number[], expected: number[]) {
  if (selected.length !== expected.length) return false;
  return selected.every((index) => expected.includes(index));
}

function normalizeLifecycleState(input: string | null | undefined): GradeLifecycleState {
  if (!input) return "SUBMITTED";
  if (input === "PUBLISHED") return "GRADE_PUBLISHED";
  if (input === "GRADED") return "GRADED_DRAFT";
  if (
    input === "NOT_SUBMITTED" ||
    input === "SUBMITTED" ||
    input === "GRADED_DRAFT" ||
    input === "GRADE_PUBLISHED" ||
    input === "GRADE_EDIT_REQUESTED" ||
    input === "GRADE_EDIT_APPROVED" ||
    input === "GRADE_EDIT_REJECTED"
  ) {
    return input;
  }
  return "SUBMITTED";
}

function normalizeGradeScale(input: Prisma.JsonValue | null) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const min = Number(record.min);
      const max = Number(record.max);
      const letter = typeof record.letter === "string" ? record.letter.trim() : "";
      if (!Number.isFinite(min) || !Number.isFinite(max) || !letter) return null;
      return { min, max, letter };
    })
    .filter((item): item is { min: number; max: number; letter: string } => !!item);
}

function deriveLetterGrade(finalScore: number | null, maxPoints: number, gradeScale: Array<{ min: number; max: number; letter: string }>) {
  if (finalScore === null || !Number.isFinite(maxPoints) || maxPoints <= 0 || gradeScale.length === 0) return null;
  const percent = (finalScore / maxPoints) * 100;
  const band = gradeScale.find((item) => percent >= item.min && percent <= item.max);
  return band?.letter ?? null;
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

function normalizeTextForPlagiarism(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function detectSubmissionFileKind(fileName: string | null, mimeType: string | null) {
  const ext = (fileName ? path.extname(fileName) : "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (ext === ".txt" || ext === ".md" || mime === "text/plain" || mime === "text/markdown") return "TEXT";
  if (ext === ".pdf" || mime === "application/pdf") return "PDF";
  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOCX";
  }
  if (ext === ".doc" || mime === "application/msword") return "DOC";
  return null;
}

function canCheckFileType(fileName: string | null, mimeType: string | null) {
  return detectSubmissionFileKind(fileName, mimeType) !== null;
}

async function readSubmissionFileBuffer(fileUrl: string) {
  if (fileUrl.startsWith("http")) {
    const token = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(fileUrl, { headers });
    if (!response.ok) return null;
    const content = await response.arrayBuffer();
    return Buffer.from(content);
  }

  const relative = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
  const absolute = path.join(process.cwd(), "public", relative);
  return fs.readFile(absolute);
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return typeof result.text === "string" ? result.text : "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return typeof result.value === "string" ? result.value : "";
}

async function extractDocText(buffer: Buffer) {
  // @ts-ignore
  const wordExtractorModule = await import("word-extractor");
  const WordExtractor = wordExtractorModule.default;
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const body = doc.getBody();
  return typeof body === "string" ? body : "";
}

function extractReadableAscii(buffer: Buffer) {
  return buffer
    .toString("utf8")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ");
}

async function extractSubmissionFileContent(submission: {
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
}) {
  if (!submission.fileUrl || !canCheckFileType(submission.fileName, submission.mimeType)) return "";
  const fileKind = detectSubmissionFileKind(submission.fileName, submission.mimeType);
  if (!fileKind) return "";

  try {
    const buffer = await readSubmissionFileBuffer(submission.fileUrl);
    if (!buffer) return "";

    if (fileKind === "TEXT") return normalizeTextForPlagiarism(buffer.toString("utf8"));
    if (fileKind === "PDF") return normalizeTextForPlagiarism(await extractPdfText(buffer));
    if (fileKind === "DOCX") return normalizeTextForPlagiarism(await extractDocxText(buffer));
    if (fileKind === "DOC") return normalizeTextForPlagiarism(await extractDocText(buffer));

    return "";
  } catch {
    try {
      const raw = await readSubmissionFileBuffer(submission.fileUrl);
      return normalizeTextForPlagiarism(extractReadableAscii(raw ?? Buffer.alloc(0)));
    } catch {
      return "";
    }
  }
}

async function extractSubmissionContent(submission: {
  textResponse: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
}) {
  const chunks: string[] = [];
  if (submission.textResponse?.trim()) {
    chunks.push(normalizeTextForPlagiarism(submission.textResponse));
  }

  const fileText = await extractSubmissionFileContent(submission);
  if (fileText) {
    chunks.push(fileText);
  }

  return normalizeTextForPlagiarism(chunks.join("\n\n"));
}

async function runDolosSimilarity(
  currentSubmissionId: string,
  currentContent: string,
  candidates: Array<{ submissionId: string; studentId: string; content: string }>
) {
  if (!candidates.length) return [];
  // @ts-ignore
  const { Dolos } = await import("@dodona/dolos-lib");
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dolos-"));
  try {
    const sanitizedId = currentSubmissionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const targetPath = path.join(tempRoot, `current-${sanitizedId}.txt`);
    await fs.writeFile(targetPath, currentContent, "utf8");

    const files = [targetPath];
    const pathMeta = new Map<string, { submissionId: string; studentId: string }>();
    pathMeta.set(targetPath, { submissionId: currentSubmissionId, studentId: "" });

    for (const candidate of candidates) {
      const candidatePath = path.join(
        tempRoot,
        `candidate-${candidate.submissionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`
      );
      await fs.writeFile(candidatePath, candidate.content, "utf8");
      files.push(candidatePath);
      pathMeta.set(candidatePath, { submissionId: candidate.submissionId, studentId: candidate.studentId });
    }

    const dolos = new Dolos({
      language: "char",
      minSimilarity: 0,
      limitResults: null,
    });

    const report = await dolos.analyzePaths(files);
    const allPairs = report.allPairs();
    const matches: Array<{ submissionId: string; studentId: string; similarity: number }> = [];

    for (const pair of allPairs) {
      const leftPath = pair.leftFile.path;
      const rightPath = pair.rightFile.path;
      const left = pathMeta.get(leftPath);
      const right = pathMeta.get(rightPath);
      if (!left || !right) continue;

      let candidateMeta: { submissionId: string; studentId: string } | null = null;
      if (left.submissionId === currentSubmissionId && right.submissionId !== currentSubmissionId) {
        candidateMeta = right;
      } else if (right.submissionId === currentSubmissionId && left.submissionId !== currentSubmissionId) {
        candidateMeta = left;
      }
      if (!candidateMeta) continue;

      const similarity = Math.max(0, Math.min(100, Math.round(pair.similarity * 10000) / 100));
      matches.push({
        submissionId: candidateMeta.submissionId,
        studentId: candidateMeta.studentId,
        similarity,
      });
    }

    return matches
      .filter((item) => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function runHeuristicSimilarity(
  content: string,
  candidates: Array<{ submissionId: string; studentId: string; content: string }>
) {
  return candidates
    .map((item) => ({
      submissionId: item.submissionId,
      studentId: item.studentId,
      similarity: similarityPercent(content, item.content),
    }))
    .filter((item) => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

async function upsertPlagiarismReport(
  submissionId: string,
  payload: {
    status: PlagiarismStatus;
    provider: PlagiarismProvider;
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
      (${id}, ${submissionId}, ${payload.status}, ${payload.provider}, ${payload.similarityScore}, ${payload.summary}, ${JSON.stringify(payload.matchedSources)}::jsonb, ${payload.errorMessage}, ${payload.checkedAt}, NOW())
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
    provider: "DOLOS",
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
        provider: "DOLOS",
        similarityScore: null,
        summary: "No supported content found for plagiarism check.",
        matchedSources: [],
        errorMessage: "Only text, PDF, DOC, and DOCX submissions can be checked.",
        checkedAt: new Date(),
      });
      return;
    }

    const candidates = await prisma.$queryRaw<
      Array<{
        id: string;
        studentId: string;
        textResponse: string | null;
        fileUrl: string | null;
        fileName: string | null;
        mimeType: string | null;
      }>
    >`
      SELECT "id","studentId","textResponse","fileUrl","fileName","mimeType"
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${submission.assignmentId} AND "id" <> ${submissionId}
      ORDER BY "submittedAt" DESC
      LIMIT 100
    `;

    const candidateContents: Array<{ submissionId: string; studentId: string; content: string }> = [];
    for (const item of candidates) {
      const candidateContent = await extractSubmissionContent({
        textResponse: item.textResponse,
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        mimeType: item.mimeType,
      });
      if (!candidateContent) continue;
      candidateContents.push({
        submissionId: item.id,
        studentId: item.studentId,
        content: candidateContent,
      });
    }

    let matches: Array<{ submissionId: string; studentId: string; similarity: number }> = [];
    let provider: PlagiarismProvider = "DOLOS";
    try {
      matches = await runDolosSimilarity(submissionId, content, candidateContents);
    } catch {
      provider = "INTERNAL_HEURISTIC";
      matches = runHeuristicSimilarity(content, candidateContents);
    }

    const similarityScore = matches.length ? matches[0].similarity : 0;
    const summary =
      similarityScore >= 70
        ? "High similarity detected. Teacher review recommended."
        : similarityScore >= 40
        ? "Medium similarity detected. Review context before grading."
        : "Low similarity detected.";

    await upsertPlagiarismReport(submissionId, {
      status: "COMPLETED",
      provider,
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
      provider: "DOLOS",
      similarityScore: null,
      summary: "Plagiarism check failed.",
      matchedSources: [],
      errorMessage: message,
      checkedAt: new Date(),
    });
  }
}

async function resolveFinalScoreForGrade(
  assignmentId: string,
  studentId: string,
  strategy: AttemptScoringStrategy
) {
  const scores = await prisma.$queryRaw<Array<{ finalScore: number | null; submittedAt: Date }>>`
    SELECT "finalScore","submittedAt"
    FROM "AssignmentSubmission"
    WHERE "assignmentId" = ${assignmentId}
      AND "studentId" = ${studentId}
      AND "finalScore" IS NOT NULL
      AND "status" <> ${ATTEMPT_CANCELLED}
    ORDER BY "submittedAt" DESC
  `;
  if (!scores.length) return null;
  if (strategy === "LATEST") return scores[0]?.finalScore ?? null;
  return scores.reduce<number | null>((acc, item) => {
    if (item.finalScore === null) return acc;
    if (acc === null) return item.finalScore;
    return Math.max(acc, item.finalScore);
  }, null);
}

async function logGradeHistory(input: {
  assignmentId: string;
  studentId: string;
  submissionId: string | null;
  actorId: string | null;
  action: string;
  oldRawScore: number | null;
  newRawScore: number | null;
  oldFinalScore: number | null;
  newFinalScore: number | null;
  oldState: GradeLifecycleState | null;
  newState: GradeLifecycleState | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = `gh_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  await prisma.$executeRaw`
    INSERT INTO "GradeHistory"
      ("id","assignmentId","studentId","submissionId","actorId","action","oldRawScore","newRawScore","oldFinalScore","newFinalScore","oldState","newState","reason","metadata")
    VALUES
      (${id}, ${input.assignmentId}, ${input.studentId}, ${input.submissionId}, ${input.actorId}, ${input.action}, ${input.oldRawScore}, ${input.newRawScore}, ${input.oldFinalScore}, ${input.newFinalScore}, ${input.oldState}, ${input.newState}, ${input.reason ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `;
}

async function createNotification(input: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const id = `ntf_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  await prisma.$executeRaw`
    INSERT INTO "NotificationEvent" ("id","recipientId","type","title","message","metadata")
    VALUES (${id}, ${input.recipientId}, ${input.type}, ${input.title}, ${input.message}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `;
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

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 1 },
      select: { gradeScale: true },
    });
    const gradeScale = normalizeGradeScale(settings?.gradeScale ?? null);

    if (user.role === Role.STUDENT) {
      if (config.courseVisibility !== COURSE_VISIBILITY_PUBLISHED) {
        return NextResponse.json({ error: "Course is not available for students." }, { status: 403 });
      }
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
          assignmentMaxPoints: Prisma.Decimal;
        }>
      >`
        SELECT s.*, a."maxPoints" AS "assignmentMaxPoints"
        FROM "AssignmentSubmission" s
        JOIN "Assignment" a ON a."id" = s."assignmentId"
        WHERE "assignmentId" = ${assignmentId} AND "studentId" = ${user.id}
        ORDER BY "attemptNumber" ASC
      `;

      return NextResponse.json({
        submissions: submissions.map((item) => ({
          ...item,
          status: normalizeLifecycleState(item.status),
          submittedAt: item.submittedAt?.toISOString?.() ?? null,
          gradedAt: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status))
            ? item.gradedAt?.toISOString?.() ?? null
            : null,
          publishedAt: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status))
            ? item.publishedAt?.toISOString?.() ?? null
            : null,
          rawScore: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status)) ? item.rawScore : null,
          finalScore: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status)) ? item.finalScore : null,
          feedback: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status)) ? item.feedback : null,
          letterGrade: PUBLISHED_STATES.includes(normalizeLifecycleState(item.status))
            ? deriveLetterGrade(item.finalScore, Number(item.assignmentMaxPoints), gradeScale)
            : null,
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
        assignmentMaxPoints: Prisma.Decimal;
      }>
    >`
      SELECT
        s.*,
        u."name" AS "studentName",
        u."email" AS "studentEmail",
        p."status" AS "plagiarismStatus",
        p."similarityScore" AS "plagiarismScore",
        p."summary" AS "plagiarismSummary",
        p."checkedAt" AS "plagiarismCheckedAt",
        a."maxPoints" AS "assignmentMaxPoints"
      FROM "AssignmentSubmission" s
      JOIN "User" u ON u."id" = s."studentId"
      JOIN "Assignment" a ON a."id" = s."assignmentId"
      LEFT JOIN "PlagiarismReport" p ON p."submissionId" = s."id"
      WHERE s."assignmentId" = ${assignmentId}
      ORDER BY s."studentId" ASC, s."attemptNumber" ASC
    `;

    return NextResponse.json({
      submissions: submissions.map((item) => ({
        ...item,
        status: normalizeLifecycleState(item.status),
        submittedAt: item.submittedAt.toISOString(),
        gradedAt: item.gradedAt?.toISOString() ?? null,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        plagiarismStatus: item.plagiarismStatus,
        plagiarismScore: item.plagiarismScore,
        plagiarismSummary: item.plagiarismSummary,
        plagiarismCheckedAt: item.plagiarismCheckedAt?.toISOString() ?? null,
        letterGrade: deriveLetterGrade(item.finalScore, Number(item.assignmentMaxPoints), gradeScale),
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

    if (config.courseVisibility !== COURSE_VISIBILITY_PUBLISHED) {
      return NextResponse.json({ error: "Course is not available for students." }, { status: 403 });
    }
    if (isCourseExpired(config.courseEndDate)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
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
            selectedOptionIndices: normalizeOptionIndexes(item?.selectedOptionIndices, item?.selectedOptionIndex),
            shortAnswerText: typeof item?.shortAnswerText === "string" ? item.shortAnswerText.trim() : "",
          }))
          .filter((item) => item.questionId && (item.selectedOptionIndices.length > 0 || item.shortAnswerText.length > 0))
      : [];

    if (config.assignmentType === "QUIZ" || config.assignmentType === "EXAM") {
      if (!quizAnswers.length) {
        return NextResponse.json({ error: "Question answers are required." }, { status: 400 });
      }
    }

    if (config.assignmentType !== "QUIZ" && config.assignmentType !== "EXAM" && hasText && !config.allowedSubmissionTypes.includes("TEXT")) {
      return NextResponse.json({ error: "This assignment does not allow text submissions." }, { status: 400 });
    }
    if (config.assignmentType !== "QUIZ" && config.assignmentType !== "EXAM" && hasFile && !config.allowedSubmissionTypes.includes("FILE")) {
      return NextResponse.json({ error: "This assignment does not allow file submissions." }, { status: 400 });
    }
    if (config.assignmentType !== "QUIZ" && config.assignmentType !== "EXAM" && !hasText && !hasFile) {
      return NextResponse.json({ error: "Provide text response and/or file upload." }, { status: 400 });
    }

    const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${assignmentId}
        AND "studentId" = ${user.id}
        AND "status" <> ${ATTEMPT_CANCELLED}
    `;
    const attemptCount = Number(countRows[0]?.count ?? 0);

    if (attemptCount >= config.maxAttempts) {
      return NextResponse.json({ error: `Maximum attempts reached (${config.maxAttempts}).` }, { status: 400 });
    }

    const now = new Date();
    if (config.startAt && now.getTime() < config.startAt.getTime()) {
      return NextResponse.json(
        { error: "Submission window has not opened yet for this assignment." },
        { status: 400 }
      );
    }

    let lateByMinutes = 0;
    let isLate = false;
    if (config.endAt) {
      if (now.getTime() > config.endAt.getTime()) {
        isLate = true;
        lateByMinutes = Math.floor((now.getTime() - config.endAt.getTime()) / (1000 * 60));
      }
    }
    if (isLate && config.allowLateSubmissions === false) {
      return NextResponse.json(
        { error: "Late submissions are blocked for this assignment." },
        { status: 400 }
      );
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 1 },
      select: { lateSubmissionPenaltyRules: true },
    });
    const latePenaltyPct = isLate ? parsePenaltyPercent(settings?.lateSubmissionPenaltyRules ?? null, lateByMinutes) : 0;
    const submissionStartedAt = parseQuizStartedAt(body.quizStartedAt);
    if (config.timerMinutes && !submissionStartedAt) {
      return NextResponse.json({ error: "Assignment start time is required for timed assignments." }, { status: 400 });
    }
    if (config.timerMinutes && submissionStartedAt) {
      const elapsedMs = Date.now() - submissionStartedAt.getTime();
      if (elapsedMs > config.timerMinutes * 60 * 1000) {
        return NextResponse.json({ error: "Assignment time frame expired. Submission rejected." }, { status: 400 });
      }
    }

    const id = `asb_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
    const attemptNumber = attemptCount + 1;

    const isQuestionBasedAssignment = config.assignmentType === "QUIZ" || config.assignmentType === "EXAM";
    const normalizedQuestionAnswers = quizAnswers.map((item) => ({
      questionId: item.questionId,
      selectedOptionIndices: item.selectedOptionIndices,
      shortAnswerText: item.shortAnswerText || "",
    }));
    if (isQuestionBasedAssignment) {
      const questions = await prisma.$queryRaw<
        Array<{
          id: string;
          questionType: string;
          correctOptionIndexes: Prisma.JsonValue;
          correctOptionIndex: number;
          points: number;
        }>
      >`
        SELECT "id","questionType","correctOptionIndexes","correctOptionIndex","points"
        FROM "AssignmentQuizQuestion"
        WHERE "assignmentId" = ${assignmentId}
        ORDER BY "position" ASC, "createdAt" ASC
      `;
      if (!questions.length) {
        return NextResponse.json(
          { error: config.assignmentType === "QUIZ" ? "Quiz has no configured questions." : "Exam has no configured questions." },
          { status: 400 }
        );
      }

      const answerMap = new Map<
        string,
        { selectedOptionIndices: number[]; shortAnswerText: string }
      >();
      for (const item of normalizedQuestionAnswers) {
        answerMap.set(item.questionId, {
          selectedOptionIndices: item.selectedOptionIndices,
          shortAnswerText: item.shortAnswerText,
        });
      }

      for (const question of questions) {
        const questionType = parseQuestionType(question.questionType);
        const answer = answerMap.get(question.id);
        if (!answer) {
          return NextResponse.json({ error: "Answer all questions before submitting." }, { status: 400 });
        }
        if (questionType === "MCQ" && answer.selectedOptionIndices.length === 0) {
          return NextResponse.json({ error: "Answer all questions before submitting." }, { status: 400 });
        }
        if (questionType === "SHORT_ANSWER" && !answer.shortAnswerText.trim()) {
          return NextResponse.json({ error: "Answer all questions before submitting." }, { status: 400 });
        }
      }

      if (config.assignmentType === "QUIZ") {
        let earned = 0;
        let maxQuizScore = 0;
        for (const question of questions) {
          const points = Number(question.points || 0);
          if (points > 0) maxQuizScore += points;
          const questionType = parseQuestionType(question.questionType);
          if (questionType !== "MCQ") {
            return NextResponse.json({ error: "Quiz contains unsupported non-MCQ question type." }, { status: 400 });
          }
          const answer = answerMap.get(question.id);
          const selected = answer?.selectedOptionIndices ?? [];
          const expected = normalizeOptionIndexes(question.correctOptionIndexes, question.correctOptionIndex);
          if (hasExactOptionMatch(selected, expected)) {
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
          (${id}, ${assignmentId}, ${user.id}, ${attemptNumber}, ${null}, ${null}, ${null}, ${null}, NOW(), ${isLate}, ${lateByMinutes}, ${latePenaltyPct}, ${normalizedRaw}, ${finalScore}, ${JSON.stringify(normalizedQuestionAnswers)}::jsonb, ${earned}, ${maxQuizScore}, ${submissionStartedAt}, NOW(), NOW(), ${"GRADE_PUBLISHED"})
        `;

        const resolvedFinalScore = await resolveFinalScoreForGrade(
          assignmentId,
          user.id,
          config.attemptScoringStrategy
        );
        if (resolvedFinalScore === null) {
          return NextResponse.json({ error: "Unable to resolve final score for grade publication." }, { status: 500 });
        }

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
            points: new Prisma.Decimal(resolvedFinalScore),
            awardedById: null,
            publishedAt: new Date(),
          },
          update: {
            points: new Prisma.Decimal(resolvedFinalScore),
            awardedById: null,
            publishedAt: new Date(),
          },
        });

        await logGradeHistory({
          assignmentId,
          studentId: user.id,
          submissionId: id,
          actorId: null,
          action: "QUIZ_AUTO_PUBLISHED",
          oldRawScore: null,
          newRawScore: normalizedRaw,
          oldFinalScore: null,
          newFinalScore: resolvedFinalScore,
          oldState: "SUBMITTED",
          newState: "GRADE_PUBLISHED",
          metadata: { latePenaltyPct, attemptNumber },
        });

        await createNotification({
          recipientId: user.id,
          type: "GRADE_PUBLISHED",
          title: "Quiz grade published",
          message: `Your quiz grade for assignment ${assignmentId} is now published.`,
          metadata: { assignmentId, submissionId: id, finalScore: resolvedFinalScore },
        });

        return NextResponse.json(
          { ok: true, assignmentId, attemptNumber, latePenaltyPct, rawScore: normalizedRaw, finalScore },
          { status: 201 }
        );
      }
    }

    await prisma.$executeRaw`
      INSERT INTO "AssignmentSubmission"
      ("id","assignmentId","studentId","attemptNumber","textResponse","fileUrl","fileName","mimeType","submittedAt","isLate","lateByMinutes","latePenaltyPct","quizAnswers","status")
      VALUES
      (${id}, ${assignmentId}, ${user.id}, ${attemptNumber}, ${textResponse}, ${fileUrl}, ${fileName}, ${mimeType}, NOW(), ${isLate}, ${lateByMinutes}, ${latePenaltyPct}, ${isQuestionBasedAssignment ? JSON.stringify(normalizedQuestionAnswers) : null}::jsonb, ${"SUBMITTED"})
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
    const isTeacher = user.role === Role.TEACHER;
    const isSuperAdmin = isSuperAdminRole(user.role);
    if (!isTeacher && !isSuperAdmin) {
      return NextResponse.json({ error: "Only teacher or super admin can update submissions." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateSubmissionBody;
    const action = body.action ?? "GRADE";
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
        courseEndDate: Date | null;
        rawScore: number | null;
        finalScore: number | null;
        feedback: string | null;
        status: string;
        attemptScoringStrategy: string | null;
      }>
    >`
      SELECT
        s."id",
        s."assignmentId",
        s."studentId",
        s."latePenaltyPct",
        s."rawScore",
        s."finalScore",
        s."feedback",
        s."status",
        a."maxPoints",
        c."teacherId",
        c."endDate" AS "courseEndDate",
        cfg."attemptScoringStrategy"
      FROM "AssignmentSubmission" s
      JOIN "Assignment" a ON a."id" = s."assignmentId"
      JOIN "Course" c ON c."id" = a."courseId"
      LEFT JOIN "AssignmentConfig" cfg ON cfg."assignmentId" = a."id"
      WHERE s."id" = ${submissionId}
      LIMIT 1
    `;

    const submission = rows[0];
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    if (isCourseExpired(submission.courseEndDate ?? null)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }

    if (!isSuperAdmin && submission.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only update submissions in your assigned courses." }, { status: 403 });
    }
    const currentState = normalizeLifecycleState(submission.status);

    if (action === "INVALIDATE_ATTEMPT") {
      if (PUBLISHED_STATES.includes(currentState)) {
        return NextResponse.json({ error: "Published/locked attempts cannot be invalidated." }, { status: 409 });
      }

      await prisma.$executeRaw`
        UPDATE "AssignmentSubmission"
        SET
          "status" = ${ATTEMPT_CANCELLED},
          "rawScore" = NULL,
          "finalScore" = NULL,
          "feedback" = NULL,
          "gradedById" = ${user.id},
          "gradedAt" = NOW(),
          "publishedAt" = NULL
        WHERE "id" = ${submissionId}
      `;

      await logGradeHistory({
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        submissionId,
        actorId: user.id,
        action: "ATTEMPT_INVALIDATED",
        oldRawScore: submission.rawScore,
        newRawScore: null,
        oldFinalScore: submission.finalScore,
        newFinalScore: null,
        oldState: currentState,
        newState: null,
        reason: body.reason?.trim() || "Attempt invalidated for resubmission.",
      });

      return NextResponse.json({ ok: true, submissionId, status: ATTEMPT_CANCELLED });
    }

    if (!isTeacher) {
      return NextResponse.json({ error: "Only teachers can grade submissions directly." }, { status: 403 });
    }

    if (PUBLISHED_STATES.includes(currentState)) {
      return NextResponse.json(
        { error: "Published grades are locked. Submit a grade edit request for admin approval." },
        { status: 409 }
      );
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
    const nextState: GradeLifecycleState =
      publishRequested ? "GRADE_PUBLISHED" : cappedRaw !== null || nextFeedback ? "GRADED_DRAFT" : "SUBMITTED";

    await prisma.$executeRaw`
      UPDATE "AssignmentSubmission"
      SET
        "rawScore" = ${cappedRaw},
        "finalScore" = ${finalScore},
        "feedback" = ${nextFeedback},
        "gradedById" = ${user.id},
        "gradedAt" = NOW(),
        "publishedAt" = CASE WHEN ${publishRequested} THEN NOW() ELSE "publishedAt" END,
        "status" = ${nextState}
      WHERE "id" = ${submissionId}
    `;

    if (finalScore !== null) {
      const strategy: AttemptScoringStrategy =
        submission.attemptScoringStrategy === "HIGHEST" ? "HIGHEST" : "LATEST";
      const resolvedFinalScore = publishRequested
        ? await resolveFinalScoreForGrade(submission.assignmentId, submission.studentId, strategy)
        : finalScore;
      if (resolvedFinalScore === null) {
        return NextResponse.json({ error: "Unable to resolve final score for grade record." }, { status: 500 });
      }
      const nextPublishedAt = publishRequested ? new Date() : null;
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
          points: new Prisma.Decimal(resolvedFinalScore),
          awardedById: user.id,
          publishedAt: nextPublishedAt,
        },
        update: {
          points: new Prisma.Decimal(resolvedFinalScore),
          awardedById: user.id,
          publishedAt: nextPublishedAt,
        },
      });

      await logGradeHistory({
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        submissionId,
        actorId: user.id,
        action: publishRequested ? "GRADE_PUBLISHED" : "GRADE_DRAFT_SAVED",
        oldRawScore: submission.rawScore,
        newRawScore: cappedRaw,
        oldFinalScore: submission.finalScore,
        newFinalScore: resolvedFinalScore,
        oldState: currentState,
        newState: nextState,
      });

      if (publishRequested) {
        await createNotification({
          recipientId: submission.studentId,
          type: "GRADE_PUBLISHED",
          title: "Grade published",
          message: `Your grade for assignment ${submission.assignmentId} has been published.`,
          metadata: {
            assignmentId: submission.assignmentId,
            submissionId,
            finalScore: resolvedFinalScore,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, submissionId, status: nextState, finalScore });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to grade submission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
