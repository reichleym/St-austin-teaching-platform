import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type AssignmentType = "HOMEWORK" | "QUIZ" | "EXAM";
type SubmissionType = "TEXT" | "FILE";

type AssignmentConfigRecord = {
  assignmentId: string;
  assignmentType: AssignmentType;
  rubricSteps: string[];
  allowedSubmissionTypes: SubmissionType[];
  maxAttempts: number;
  autoGrade: boolean;
  moduleId: string | null;
  lessonId: string | null;
  completionRule: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type CreateAssignmentBody = {
  courseId?: string;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
  assignmentType?: AssignmentType;
  rubricSteps?: string[];
  allowedSubmissionTypes?: SubmissionType[];
  maxAttempts?: number;
  autoGrade?: boolean;
  moduleId?: string | null;
  lessonId?: string | null;
  completionRule?: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type UpdateAssignmentBody = {
  assignmentId?: string;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
  assignmentType?: AssignmentType;
  rubricSteps?: string[];
  allowedSubmissionTypes?: SubmissionType[];
  maxAttempts?: number;
  autoGrade?: boolean;
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

function parseSubmissionTypes(input: unknown): SubmissionType[] {
  if (!Array.isArray(input)) return ["TEXT", "FILE"];
  const values = Array.from(new Set(input.filter((item) => item === "TEXT" || item === "FILE")));
  return values.length ? (values as SubmissionType[]) : ["TEXT"];
}

function parseRubricSteps(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 50);
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
  "moduleId" TEXT,
  "lessonId" TEXT,
  "completionRule" TEXT NOT NULL DEFAULT 'SUBMISSION_OR_GRADE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentConfig_pkey" PRIMARY KEY ("assignmentId")
);
CREATE INDEX IF NOT EXISTS "AssignmentConfig_moduleId_idx" ON "AssignmentConfig"("moduleId");
CREATE INDEX IF NOT EXISTS "AssignmentConfig_lessonId_idx" ON "AssignmentConfig"("lessonId");
`);
}

async function getAccessibleCourses(user: { id: string; role: Role | string }) {
  if (isSuperAdminRole(user.role)) {
    return prisma.course.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true, teacherId: true },
    });
  }

  if (user.role === Role.TEACHER) {
    return prisma.course.findMany({
      where: { teacherId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true, teacherId: true },
    });
  }

  return prisma.course.findMany({
    where: {
      enrollments: {
        some: {
          studentId: user.id,
          status: "ACTIVE",
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, code: true, title: true, teacherId: true },
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
      "moduleId",
      "lessonId",
      "completionRule"
    FROM "AssignmentConfig"
    WHERE "assignmentId" IN (${Prisma.join(assignmentIds)})
  `;

  const map = new Map<string, AssignmentConfigRecord>();
  for (const row of rows) {
    map.set(row.assignmentId, {
      assignmentId: row.assignmentId,
      assignmentType: parseAssignmentType(row.assignmentType),
      rubricSteps: parseRubricSteps(row.rubricSteps as unknown[]),
      allowedSubmissionTypes: parseSubmissionTypes(row.allowedSubmissionTypes as unknown[]),
      maxAttempts: parseMaxAttempts(row.maxAttempts, parseAssignmentType(row.assignmentType)),
      autoGrade: !!row.autoGrade,
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
  const allowedSubmissionTypes = parseSubmissionTypes(input.allowedSubmissionTypes);
  const maxAttempts = parseMaxAttempts(input.maxAttempts, assignmentType);
  const autoGrade = assignmentType === "QUIZ" ? !!input.autoGrade : false;
  const moduleId = typeof input.moduleId === "string" && input.moduleId.trim() ? input.moduleId.trim() : null;
  const lessonId = typeof input.lessonId === "string" && input.lessonId.trim() ? input.lessonId.trim() : null;
  const completionRule = parseCompletionRule(input.completionRule);

  await prisma.$executeRaw`
    INSERT INTO "AssignmentConfig"
      ("assignmentId","assignmentType","rubricSteps","allowedSubmissionTypes","maxAttempts","autoGrade","moduleId","lessonId","completionRule","updatedAt")
    VALUES
      (${assignmentId}, ${assignmentType}, ${JSON.stringify(rubricSteps)}::jsonb, ${JSON.stringify(allowedSubmissionTypes)}::jsonb, ${maxAttempts}, ${autoGrade}, ${moduleId}, ${lessonId}, ${completionRule}, NOW())
    ON CONFLICT ("assignmentId")
    DO UPDATE SET
      "assignmentType" = EXCLUDED."assignmentType",
      "rubricSteps" = EXCLUDED."rubricSteps",
      "allowedSubmissionTypes" = EXCLUDED."allowedSubmissionTypes",
      "maxAttempts" = EXCLUDED."maxAttempts",
      "autoGrade" = EXCLUDED."autoGrade",
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
              select: { id: true, code: true, title: true, teacherId: true },
            },
          },
        })
      : [];

    const configByAssignmentId = await loadAssignmentConfigs(assignments.map((item) => item.id));

    return NextResponse.json({
      courses,
      assignments: assignments.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        title: item.title,
        description: item.description,
        dueAt: item.dueAt?.toISOString() ?? null,
        maxPoints: Number(item.maxPoints),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        course: item.course,
        config: configByAssignmentId.get(item.id) ?? defaultConfig(item.id),
      })),
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
    const dueAt = parseOptionalDateTime(body.dueAt);
    const maxPoints = parseMaxPoints(body.maxPoints) ?? 100;

    if (!courseId || !title) {
      return NextResponse.json({ error: "courseId and title are required." }, { status: 400 });
    }
    if (body.dueAt !== undefined && dueAt === undefined) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
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
        dueAt: dueAt ?? null,
        maxPoints: new Prisma.Decimal(maxPoints),
      },
      include: {
        course: { select: { id: true, code: true, title: true, teacherId: true } },
      },
    });

    await upsertAssignmentConfig(created.id, {
      ...body,
      moduleId: moduleLessonValidation.moduleId,
      lessonId: moduleLessonValidation.lessonId,
    });
    const configByAssignmentId = await loadAssignmentConfigs([created.id]);

    return NextResponse.json(
      {
        ok: true,
        assignment: {
          id: created.id,
          courseId: created.courseId,
          title: created.title,
          description: created.description,
          dueAt: created.dueAt?.toISOString() ?? null,
          maxPoints: Number(created.maxPoints),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          course: created.course,
          config: configByAssignmentId.get(created.id) ?? defaultConfig(created.id),
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
      include: { course: { select: { id: true, teacherId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (user.role === Role.TEACHER && existing.course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only update assignments in your assigned courses." }, { status: 403 });
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
      data.description = body.description?.trim() || null;
    }
    if (body.dueAt !== undefined) {
      const dueAt = parseOptionalDateTime(body.dueAt);
      if (dueAt === undefined) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
      data.dueAt = dueAt;
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
          course: { select: { id: true, code: true, title: true, teacherId: true } },
        },
      });
    } else {
      updated = await prisma.assignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: {
          course: { select: { id: true, code: true, title: true, teacherId: true } },
        },
      });
    }

    await upsertAssignmentConfig(assignmentId, {
      ...body,
      moduleId: moduleLessonValidation.moduleId,
      lessonId: moduleLessonValidation.lessonId,
    });
    const configByAssignmentId = await loadAssignmentConfigs([assignmentId]);

    return NextResponse.json({
      ok: true,
      assignment: {
        id: updated.id,
        courseId: updated.courseId,
        title: updated.title,
        description: updated.description,
        dueAt: updated.dueAt?.toISOString() ?? null,
        maxPoints: Number(updated.maxPoints),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        course: updated.course,
        config: configByAssignmentId.get(assignmentId) ?? defaultConfig(assignmentId),
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
      include: { course: { select: { teacherId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
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
