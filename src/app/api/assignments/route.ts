import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_VISIBILITY_PUBLISHED, isCourseExpired } from "@/lib/courses";

type AssignmentType = "HOMEWORK" | "QUIZ" | "EXAM";
type SubmissionType = "TEXT" | "FILE";

type AssignmentConfigRecord = {
  assignmentId: string;
  assignmentType: AssignmentType;
  rubricSteps: string[];
  allowedSubmissionTypes: SubmissionType[];
  maxAttempts: number;
  autoGrade: boolean;
  allowLateSubmissions: boolean;
  attemptScoringStrategy: "LATEST" | "HIGHEST";
  timerMinutes: number | null;
  startAt: Date | null;
  moduleId: string | null;
  lessonId: string | null;
  completionRule: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type SubmissionCountRow = {
  assignmentId: string;
  count: bigint | number;
};

type CreateAssignmentBody = {
  courseId?: string;
  title?: string;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
  assignmentType?: AssignmentType;
  rubricSteps?: string[];
  allowedSubmissionTypes?: SubmissionType[];
  maxAttempts?: number;
  autoGrade?: boolean;
  allowLateSubmissions?: boolean;
  attemptScoringStrategy?: "LATEST" | "HIGHEST";
  timerMinutes?: number | string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  completionRule?: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type UpdateAssignmentBody = {
  assignmentId?: string;
  title?: string;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
  assignmentType?: AssignmentType;
  rubricSteps?: string[];
  allowedSubmissionTypes?: SubmissionType[];
  maxAttempts?: number;
  autoGrade?: boolean;
  allowLateSubmissions?: boolean;
  attemptScoringStrategy?: "LATEST" | "HIGHEST";
  timerMinutes?: number | string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  completionRule?: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type DeleteAssignmentBody = {
  assignmentId?: string;
};

function parseOptionalDateTime(input: unknown) {
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseMaxPoints(input: unknown) {
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseAssignmentType(input: unknown): AssignmentType {
  if (input === "QUIZ" || input === "EXAM" || input === "HOMEWORK") return input;
  return "HOMEWORK";
}

function parseSubmissionTypes(input: unknown, options?: { allowEmpty?: boolean }): SubmissionType[] {
  if (!Array.isArray(input)) return options?.allowEmpty ? [] : ["TEXT", "FILE"];
  const values = Array.from(new Set(input.filter((item) => item === "TEXT" || item === "FILE")));
  if (values.length) return values as SubmissionType[];
  return options?.allowEmpty ? [] : ["TEXT"];
}

function resolveSubmissionTypes(assignmentType: AssignmentType, input: unknown): SubmissionType[] {
  if (assignmentType === "QUIZ") {
    return parseSubmissionTypes(input, { allowEmpty: true });
  }
  return parseSubmissionTypes(input);
}

function parseRubricSteps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 50);
}

function hasRequiredAssessmentContent(assignmentType: AssignmentType, description: string | null, rubricSteps: string[]) {
  if (assignmentType === "HOMEWORK") return true;
  return !!(description?.trim() || rubricSteps.length > 0);
}

function parseMaxAttempts(input: unknown, assignmentType: AssignmentType) {
  if (assignmentType === "EXAM") return 1;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, 20);
}

function parseCompletionRule(input: unknown): AssignmentConfigRecord["completionRule"] {
  if (input === "SUBMISSION_ONLY" || input === "GRADE_ONLY" || input === "SUBMISSION_OR_GRADE") return input;
  return "SUBMISSION_OR_GRADE";
}

function parseTimerMinutes(input: unknown) {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 1440);
}

function parseAttemptScoringStrategy(input: unknown): "LATEST" | "HIGHEST" {
  return input === "HIGHEST" ? "HIGHEST" : "LATEST";
}

function canManageByRole(role: Role | string) {
  return isSuperAdminRole(role) || role === Role.TEACHER;
}

async function ensureAssignmentSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "AssignmentConfig" (
  "assignmentId" TEXT NOT NULL,
  "assignmentType" TEXT NOT NULL DEFAULT 'HOMEWORK',
  "rubricSteps" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "allowedSubmissionTypes" JSONB NOT NULL DEFAULT '["TEXT","FILE"]'::jsonb,
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "autoGrade" BOOLEAN NOT NULL DEFAULT false,
  "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true,
  "attemptScoringStrategy" TEXT NOT NULL DEFAULT 'LATEST',
  "timerMinutes" INTEGER,
  "startAt" TIMESTAMP(3),
  "moduleId" TEXT,
  "lessonId" TEXT,
  "completionRule" TEXT NOT NULL DEFAULT 'SUBMISSION_OR_GRADE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentConfig_pkey" PRIMARY KEY ("assignmentId")
);
CREATE INDEX IF NOT EXISTS "AssignmentConfig_moduleId_idx" ON "AssignmentConfig"("moduleId");
CREATE INDEX IF NOT EXISTS "AssignmentConfig_lessonId_idx" ON "AssignmentConfig"("lessonId");
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "timerMinutes" INTEGER;
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "attemptScoringStrategy" TEXT;
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "allowLateSubmissions" BOOLEAN;
ALTER TABLE "AssignmentConfig" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3);
`);
}

async function getAccessibleCourses(user: { id: string; role: Role | string }) {
  if (isSuperAdminRole(user.role)) {
    return prisma.course.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        title: true,
        endDate: true,
        teacherId: true,
        teacher: { select: { name: true, email: true } },
      },
    });
  }

  if (user.role === Role.TEACHER) {
    return prisma.course.findMany({
      where: { teacherId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        title: true,
        endDate: true,
        teacherId: true,
        teacher: { select: { name: true, email: true } },
      },
    });
  }

  return prisma.course.findMany({
    where: {
      visibility: COURSE_VISIBILITY_PUBLISHED,
      enrollments: {
        some: {
          studentId: user.id,
          status: "ACTIVE",
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        title: true,
        endDate: true,
        teacherId: true,
        teacher: { select: { name: true, email: true } },
      },
    });
}

async function loadAssignmentConfigs(assignmentIds: string[]) {
  if (!assignmentIds.length) return new Map<string, AssignmentConfigRecord>();

  const rows = await prisma.$queryRaw<
    Array<{
      assignmentId: string;
      assignmentType: string;
      rubricSteps: Prisma.JsonValue;
      allowedSubmissionTypes: Prisma.JsonValue;
      maxAttempts: number;
      autoGrade: boolean;
      allowLateSubmissions: boolean | null;
      attemptScoringStrategy: string | null;
      timerMinutes: number | null;
      startAt: Date | null;
      moduleId: string | null;
      lessonId: string | null;
      completionRule: string;
    }>
  >`
    SELECT
      "assignmentId",
      "assignmentType",
      "rubricSteps",
      "allowedSubmissionTypes",
      "maxAttempts",
      "autoGrade",
      "allowLateSubmissions",
      "attemptScoringStrategy",
      "timerMinutes",
      "startAt",
      "moduleId",
      "lessonId",
      "completionRule"
    FROM "AssignmentConfig"
    WHERE "assignmentId" IN (${Prisma.join(assignmentIds)})
  `;

  const map = new Map<string, AssignmentConfigRecord>();
  for (const row of rows) {
    const assignmentType = parseAssignmentType(row.assignmentType);
    map.set(row.assignmentId, {
      assignmentId: row.assignmentId,
      assignmentType,
      rubricSteps: parseRubricSteps(row.rubricSteps as unknown[]),
      allowedSubmissionTypes: resolveSubmissionTypes(assignmentType, row.allowedSubmissionTypes as unknown[]),
      maxAttempts: parseMaxAttempts(row.maxAttempts, assignmentType),
      autoGrade: !!row.autoGrade,
      allowLateSubmissions: row.allowLateSubmissions !== false,
      attemptScoringStrategy: parseAttemptScoringStrategy(row.attemptScoringStrategy),
      timerMinutes: row.timerMinutes !== null && Number.isInteger(Number(row.timerMinutes)) ? Number(row.timerMinutes) : null,
      startAt: row.startAt ?? null,
      moduleId: row.moduleId,
      lessonId: row.lessonId,
      completionRule: parseCompletionRule(row.completionRule),
    });
  }
  return map;
}

async function upsertAssignmentConfig(assignmentId: string, input: CreateAssignmentBody | UpdateAssignmentBody) {
  const assignmentType = parseAssignmentType(input.assignmentType);
  const rubricSteps = parseRubricSteps(input.rubricSteps);
  const allowedSubmissionTypes = resolveSubmissionTypes(assignmentType, input.allowedSubmissionTypes);
  const maxAttempts = parseMaxAttempts(input.maxAttempts, assignmentType);
  const autoGrade = assignmentType === "QUIZ" ? !!input.autoGrade : false;
  const allowLateSubmissions = input.allowLateSubmissions !== false;
  const attemptScoringStrategy = parseAttemptScoringStrategy(input.attemptScoringStrategy);
  const timerMinutes = parseTimerMinutes(input.timerMinutes);
  const startAt = parseOptionalDateTime(input.startAt);
  const moduleId = typeof input.moduleId === "string" && input.moduleId.trim() ? input.moduleId.trim() : null;
  const lessonId = typeof input.lessonId === "string" && input.lessonId.trim() ? input.lessonId.trim() : null;
  const completionRule = parseCompletionRule(input.completionRule);

  await prisma.$executeRaw`
    INSERT INTO "AssignmentConfig"
      ("assignmentId","assignmentType","rubricSteps","allowedSubmissionTypes","maxAttempts","autoGrade","allowLateSubmissions","attemptScoringStrategy","timerMinutes","startAt","moduleId","lessonId","completionRule","updatedAt")
    VALUES
      (${assignmentId}, ${assignmentType}, ${JSON.stringify(rubricSteps)}::jsonb, ${JSON.stringify(allowedSubmissionTypes)}::jsonb, ${maxAttempts}, ${autoGrade}, ${allowLateSubmissions}, ${attemptScoringStrategy}, ${timerMinutes}, ${startAt ?? null}, ${moduleId}, ${lessonId}, ${completionRule}, NOW())
    ON CONFLICT ("assignmentId")
    DO UPDATE SET
      "assignmentType" = EXCLUDED."assignmentType",
      "rubricSteps" = EXCLUDED."rubricSteps",
      "allowedSubmissionTypes" = EXCLUDED."allowedSubmissionTypes",
      "maxAttempts" = EXCLUDED."maxAttempts",
      "autoGrade" = EXCLUDED."autoGrade",
      "allowLateSubmissions" = EXCLUDED."allowLateSubmissions",
      "attemptScoringStrategy" = EXCLUDED."attemptScoringStrategy",
      "timerMinutes" = EXCLUDED."timerMinutes",
      "startAt" = EXCLUDED."startAt",
      "moduleId" = EXCLUDED."moduleId",
      "lessonId" = EXCLUDED."lessonId",
      "completionRule" = EXCLUDED."completionRule",
      "updatedAt" = NOW()
  `;
}

async function validateModuleLessonLink(courseId: string, moduleId: string | null, lessonId: string | null) {
  if (!moduleId && !lessonId) {
    return { moduleId: null, lessonId: null as string | null };
  }

  let resolvedModuleId = moduleId;
  const resolvedLessonId = lessonId;

  if (resolvedModuleId) {
    const courseModule = await prisma.courseModule.findUnique({
      where: { id: resolvedModuleId },
      select: { id: true, courseId: true },
    });
    if (!courseModule || courseModule.courseId !== courseId) {
      return { error: "Selected module does not belong to this course." };
    }
  }

  if (resolvedLessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: resolvedLessonId },
      select: { id: true, moduleId: true, module: { select: { courseId: true } } },
    });
    if (!lesson || lesson.module.courseId !== courseId) {
      return { error: "Selected lesson does not belong to this course." };
    }
    if (!resolvedModuleId) {
      resolvedModuleId = lesson.moduleId;
    } else if (lesson.moduleId !== resolvedModuleId) {
      return { error: "Selected lesson does not belong to the selected module." };
    }
  }

  return { moduleId: resolvedModuleId, lessonId: resolvedLessonId };
}

function defaultConfig(assignmentId: string): AssignmentConfigRecord {
  return {
    assignmentId,
    assignmentType: "HOMEWORK",
    rubricSteps: [],
    allowedSubmissionTypes: ["TEXT", "FILE"],
    maxAttempts: 1,
    autoGrade: false,
    allowLateSubmissions: true,
    attemptScoringStrategy: "LATEST",
    timerMinutes: null,
    startAt: null,
    moduleId: null,
    lessonId: null,
    completionRule: "SUBMISSION_OR_GRADE",
  };
}

export async function GET() {
  try {
    await ensureAssignmentSchema();
    const user = await requireAuthenticatedUser();

    const courses = await getAccessibleCourses(user);
    const courseIds = courses.map((item) => item.id);

    const assignments = courseIds.length
      ? await prisma.assignment.findMany({
          where: { courseId: { in: courseIds } },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          include: {
            course: {
              select: {
                id: true,
                code: true,
                title: true,
                endDate: true,
                teacherId: true,
                teacher: { select: { name: true, email: true } },
              },
            },
          },
        })
      : [];

    const configByAssignmentId = await loadAssignmentConfigs(assignments.map((item) => item.id));
    const submissionCountByAssignmentId = new Map<string, number>();
    if (assignments.length) {
      const tableExistsRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public."AssignmentSubmission"') IS NOT NULL AS "exists"
      `;
      if (tableExistsRows[0]?.exists) {
        const rows = await prisma.$queryRaw<SubmissionCountRow[]>`
          SELECT "assignmentId", COUNT(*)::bigint AS count
          FROM "AssignmentSubmission"
          WHERE "assignmentId" IN (${Prisma.join(assignments.map((item) => item.id))})
          GROUP BY "assignmentId"
        `;
        for (const row of rows) {
          submissionCountByAssignmentId.set(row.assignmentId, Number(row.count));
        }
      }
    }

    return NextResponse.json({
      courses,
      assignments: assignments.map((item) => {
        const config = configByAssignmentId.get(item.id) ?? defaultConfig(item.id);
        const serializedStartAt = config.startAt?.toISOString() ?? null;
        const serializedEndAt = item.dueAt?.toISOString() ?? null;
        return {
          id: item.id,
          courseId: item.courseId,
          title: item.title,
          description: item.description,
          startAt: serializedStartAt,
          endAt: serializedEndAt,
          dueAt: serializedEndAt,
          maxPoints: Number(item.maxPoints),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          course: item.course,
          config: {
            ...config,
            startAt: serializedStartAt,
          },
          submissionCount: submissionCountByAssignmentId.get(item.id) ?? 0,
        };
      }),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load assignments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureAssignmentSchema();
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can create assignments." }, { status: 403 });
    }

    const body = (await request.json()) as CreateAssignmentBody;
    const courseId = body.courseId?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() || null;
    const assignmentType = parseAssignmentType(body.assignmentType);
    const rubricSteps = parseRubricSteps(body.rubricSteps);
    const startAt = parseOptionalDateTime(body.startAt);
    const endAtInput = body.endAt !== undefined ? body.endAt : body.dueAt;
    const endAt = parseOptionalDateTime(endAtInput);
    const maxPoints = parseMaxPoints(body.maxPoints) ?? 100;

    if (!courseId || !title) {
      return NextResponse.json({ error: "courseId and title are required." }, { status: 400 });
    }
    if (body.startAt !== undefined && startAt === undefined) {
      return NextResponse.json({ error: "Invalid start date/time." }, { status: 400 });
    }
    if ((body.endAt !== undefined || body.dueAt !== undefined) && endAt === undefined) {
      return NextResponse.json({ error: "Invalid end date/time." }, { status: 400 });
    }
    if (!startAt || !endAt) {
      return NextResponse.json({ error: "startAt and endAt are required." }, { status: 400 });
    }
    if (startAt.getTime() > endAt.getTime()) {
      return NextResponse.json({ error: "Start date/time must be before end date/time." }, { status: 400 });
    }
    if (!hasRequiredAssessmentContent(assignmentType, description, rubricSteps)) {
      return NextResponse.json(
        { error: "Quiz and exam assignments cannot be empty. Add instructions or rubric steps." },
        { status: 400 }
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, endDate: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (isCourseExpired(course.endDate)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }
    if (user.role === Role.TEACHER && course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only create assignments for your assigned courses." }, { status: 403 });
    }

    const normalizedModuleId =
      typeof body.moduleId === "string" && body.moduleId.trim() ? body.moduleId.trim() : null;
    const normalizedLessonId =
      typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;

    const moduleLessonValidation = await validateModuleLessonLink(course.id, normalizedModuleId, normalizedLessonId);
    if ("error" in moduleLessonValidation) {
      return NextResponse.json({ error: moduleLessonValidation.error }, { status: 400 });
    }

    const created = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description,
        dueAt: endAt,
        maxPoints: new Prisma.Decimal(maxPoints),
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            teacherId: true,
            teacher: { select: { name: true, email: true } },
          },
        },
      },
    });

    await upsertAssignmentConfig(created.id, {
      ...body,
      assignmentType,
      rubricSteps,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      dueAt: endAt.toISOString(),
      moduleId: moduleLessonValidation.moduleId,
      lessonId: moduleLessonValidation.lessonId,
    });
    const configByAssignmentId = await loadAssignmentConfigs([created.id]);
    const config = configByAssignmentId.get(created.id) ?? defaultConfig(created.id);
    const serializedStartAt = config.startAt?.toISOString() ?? null;
    const serializedEndAt = created.dueAt?.toISOString() ?? null;

    return NextResponse.json(
      {
        ok: true,
        assignment: {
          id: created.id,
          courseId: created.courseId,
          title: created.title,
          description: created.description,
          startAt: serializedStartAt,
          endAt: serializedEndAt,
          dueAt: serializedEndAt,
          maxPoints: Number(created.maxPoints),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          course: created.course,
          config: {
            ...config,
            startAt: serializedStartAt,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureAssignmentSchema();
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can update assignments." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateAssignmentBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            teacherId: true,
            endDate: true,
            teacher: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (isCourseExpired(existing.course.endDate)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }
    if (user.role === Role.TEACHER && existing.course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only update assignments in your assigned courses." }, { status: 403 });
    }
    const existingConfig = (await loadAssignmentConfigs([assignmentId])).get(assignmentId) ?? defaultConfig(assignmentId);
    const resolvedAssignmentType = parseAssignmentType(body.assignmentType ?? existingConfig.assignmentType);
    const resolvedDescription =
      body.description !== undefined ? body.description?.trim() || null : existing.description?.trim() || null;
    const resolvedRubricSteps = body.rubricSteps !== undefined ? parseRubricSteps(body.rubricSteps) : existingConfig.rubricSteps;
    if (!hasRequiredAssessmentContent(resolvedAssignmentType, resolvedDescription, resolvedRubricSteps)) {
      return NextResponse.json(
        { error: "Quiz and exam assignments cannot be empty. Add instructions or rubric steps." },
        { status: 400 }
      );
    }

    const normalizedModuleId =
      typeof body.moduleId === "string" && body.moduleId.trim() ? body.moduleId.trim() : null;
    const normalizedLessonId =
      typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
    const moduleLessonValidation = await validateModuleLessonLink(
      existing.course.id,
      normalizedModuleId,
      normalizedLessonId
    );
    if ("error" in moduleLessonValidation) {
      return NextResponse.json({ error: moduleLessonValidation.error }, { status: 400 });
    }

    const data: Prisma.AssignmentUpdateInput = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = resolvedDescription;
    }
    const hasStartAtInput = body.startAt !== undefined;
    const hasEndAtInput = body.endAt !== undefined || body.dueAt !== undefined;
    let resolvedStartAt = existingConfig.startAt;
    let resolvedEndAt = existing.dueAt;
    if (hasStartAtInput) {
      const startAt = parseOptionalDateTime(body.startAt);
      if (startAt === undefined) return NextResponse.json({ error: "Invalid start date/time." }, { status: 400 });
      resolvedStartAt = startAt;
    }
    if (hasEndAtInput) {
      const endAt = parseOptionalDateTime(body.endAt !== undefined ? body.endAt : body.dueAt);
      if (endAt === undefined) return NextResponse.json({ error: "Invalid end date/time." }, { status: 400 });
      resolvedEndAt = endAt;
      data.dueAt = endAt;
    }
    if (resolvedStartAt && resolvedEndAt && resolvedStartAt.getTime() > resolvedEndAt.getTime()) {
      return NextResponse.json({ error: "Start date/time must be before end date/time." }, { status: 400 });
    }
    if (body.maxPoints !== undefined) {
      const maxPoints = parseMaxPoints(body.maxPoints);
      if (!maxPoints) return NextResponse.json({ error: "maxPoints must be greater than 0." }, { status: 400 });
      data.maxPoints = new Prisma.Decimal(maxPoints);
    }

    const shouldUpdateAssignment = Object.keys(data).length > 0;
    let updated = existing;
    if (shouldUpdateAssignment) {
      updated = await prisma.assignment.update({
        where: { id: assignmentId },
        data,
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              teacherId: true,
              endDate: true,
              teacher: { select: { name: true, email: true } },
            },
          },
        },
      });
    } else {
      updated = await prisma.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              teacherId: true,
              endDate: true,
              teacher: { select: { name: true, email: true } },
            },
          },
        },
      });
    }

    await upsertAssignmentConfig(assignmentId, {
      ...body,
      assignmentType: resolvedAssignmentType,
      rubricSteps: resolvedRubricSteps,
      startAt: resolvedStartAt ? resolvedStartAt.toISOString() : null,
      endAt: resolvedEndAt ? resolvedEndAt.toISOString() : null,
      dueAt: resolvedEndAt ? resolvedEndAt.toISOString() : null,
      moduleId: moduleLessonValidation.moduleId,
      lessonId: moduleLessonValidation.lessonId,
    });
    const configByAssignmentId = await loadAssignmentConfigs([assignmentId]);
    const config = configByAssignmentId.get(assignmentId) ?? defaultConfig(assignmentId);
    const serializedStartAt = config.startAt?.toISOString() ?? null;
    const serializedEndAt = updated.dueAt?.toISOString() ?? null;

    return NextResponse.json({
      ok: true,
      assignment: {
        id: updated.id,
        courseId: updated.courseId,
        title: updated.title,
        description: updated.description,
        startAt: serializedStartAt,
        endAt: serializedEndAt,
        dueAt: serializedEndAt,
        maxPoints: Number(updated.maxPoints),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        course: updated.course,
        config: {
          ...config,
          startAt: serializedStartAt,
        },
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureAssignmentSchema();
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can delete assignments." }, { status: 403 });
    }

    const body = (await request.json()) as DeleteAssignmentBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: { select: { teacherId: true, endDate: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (isCourseExpired(existing.course.endDate)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }
    if (user.role === Role.TEACHER && existing.course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only delete assignments in your assigned courses." }, { status: 403 });
    }

    await prisma.$executeRaw`DELETE FROM "AssignmentConfig" WHERE "assignmentId" = ${assignmentId}`;
    await prisma.assignment.delete({ where: { id: assignmentId } });
    return NextResponse.json({ ok: true, assignmentId });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to delete assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
