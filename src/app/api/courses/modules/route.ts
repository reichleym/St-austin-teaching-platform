import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  COURSE_VISIBILITY_PUBLISHED,
  MODULE_VISIBILITY_ALL,
  MODULE_VISIBILITY_LIMITED,
  parseModuleVisibility,
  type ModuleVisibilityValue,
} from "@/lib/courses";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateModuleBody = {
  courseId?: string;
  title?: string;
  description?: string | null;
  releaseAt?: string | null;
  visibilityRule?: "ALL_VISIBLE" | "LIMITED_ACCESS";
};

type UpdateModuleBody = {
  moduleId?: string;
  title?: string;
  description?: string | null;
  releaseAt?: string | null;
  visibilityRule?: "ALL_VISIBLE" | "LIMITED_ACCESS";
  position?: number;
};

type DeleteModuleBody = {
  moduleId?: string;
};

type RawModule = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  releaseAt: Date | null;
  visibilityRule: ModuleVisibilityValue;
};

type RawLesson = {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  position: number;
  visibility: "VISIBLE" | "HIDDEN";
  isRequired: boolean;
  embedUrl: string | null;
};

type RawAttachment = {
  id: string;
  lessonId: string;
  kind: string;
  label: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  publicUrl: string | null;
  createdAt: Date;
};

type RawCompletion = {
  lessonId: string;
  completedAt: Date;
};

function isCourseVisibilityCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `visibility`") ||
    error.message.includes("Unknown argument `visibility`") ||
    error.message.includes('column "visibility" does not exist') ||
    (error.message.includes("CourseVisibility") && error.message.includes("Invalid value for argument"))
  );
}

function parseOptionalDate(input: unknown) {
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function clampIndex(value: number, maxLength: number) {
  if (!Number.isInteger(value)) return 0;
  if (value < 0) return 0;
  if (value > maxLength) return maxLength;
  return value;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
}

async function ensureCourseStructureSchema() {
  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "ModuleVisibilityRule" AS ENUM ('ALL_VISIBLE', 'LIMITED_ACCESS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LessonVisibility" AS ENUM ('VISIBLE', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LessonAttachmentKind" AS ENUM ('FILE', 'PDF', 'VIDEO_LINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CourseModule" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "releaseAt" TIMESTAMP(3),
  "visibilityRule" "ModuleVisibilityRule" NOT NULL DEFAULT 'ALL_VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Lesson" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "visibility" "LessonVisibility" NOT NULL DEFAULT 'VISIBLE',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "embedUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LessonAttachment" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "kind" "LessonAttachmentKind" NOT NULL DEFAULT 'FILE',
  "label" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storageKey" TEXT,
  "publicUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LessonCompletion" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourseModule_courseId_position_idx" ON "CourseModule"("courseId", "position");
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");
CREATE INDEX IF NOT EXISTS "LessonAttachment_lessonId_kind_idx" ON "LessonAttachment"("lessonId", "kind");
CREATE INDEX IF NOT EXISTS "LessonCompletion_studentId_completedAt_idx" ON "LessonCompletion"("studentId", "completedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LessonCompletion_lessonId_studentId_key" ON "LessonCompletion"("lessonId", "studentId");
`);
}

function getCourseModuleDelegate() {
  return (prisma as unknown as { courseModule?: typeof prisma.courseModule }).courseModule;
}

async function getCourseAccess(user: { id: string; role: Role | string }, courseId: string) {
  let course: {
    id: string;
    title: string;
    teacherId: string | null;
    visibility: "DRAFT" | "PUBLISHED";
    enrollments: Array<{ id: string }>;
  } | null = null;

  try {
    course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        teacherId: true,
        visibility: true,
        enrollments: {
          where: { studentId: user.id, status: "ACTIVE" },
          select: { id: true },
        },
      },
    });
  } catch (error) {
    if (!isCourseVisibilityCompatibilityError(error)) throw error;
    const legacy = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        teacherId: true,
        enrollments: {
          where: { studentId: user.id, status: "ACTIVE" },
          select: { id: true },
        },
      },
    });
    course = legacy ? { ...legacy, visibility: COURSE_VISIBILITY_PUBLISHED } : null;
  }

  if (!course) return { ok: false as const, status: 404, error: "Course not found." };

  const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && course.teacherId === user.id);
  const canViewAsStudent =
    user.role === Role.STUDENT && course.visibility === COURSE_VISIBILITY_PUBLISHED && course.enrollments.length > 0;

  if (!canManage && !canViewAsStudent) {
    return { ok: false as const, status: 403, error: "You do not have access to this course." };
  }

  return { ok: true as const, course, canManage, canViewAsStudent };
}

async function listModulesRaw(courseId: string, user: { id: string; role: Role | string }, canManage: boolean) {
  const modules = await prisma.$queryRaw<RawModule[]>`
    SELECT "id", "title", "description", "position", "releaseAt", "visibilityRule"::text AS "visibilityRule"
    FROM "CourseModule"
    WHERE "courseId" = ${courseId}
    ORDER BY "position" ASC, "createdAt" ASC
  `;

  const moduleIds = modules.map((item) => item.id);
  const lessons = moduleIds.length
    ? await prisma.$queryRaw<RawLesson[]>`
      SELECT "id", "moduleId", "title", "content", "position", "visibility"::text AS "visibility", "isRequired", "embedUrl"
      FROM "Lesson"
      WHERE "moduleId" IN (${Prisma.join(moduleIds)})
      ORDER BY "position" ASC, "createdAt" ASC
    `
    : [];

  const lessonIds = lessons.map((item) => item.id);
  const attachments = lessonIds.length
    ? await prisma.$queryRaw<RawAttachment[]>`
      SELECT "id", "lessonId", "kind"::text AS "kind", "label", "fileName", "mimeType", "sizeBytes", "storageKey", "publicUrl", "createdAt"
      FROM "LessonAttachment"
      WHERE "lessonId" IN (${Prisma.join(lessonIds)})
      ORDER BY "createdAt" ASC
    `
    : [];

  const completions = lessonIds.length && user.role === Role.STUDENT
    ? await prisma.$queryRaw<RawCompletion[]>`
      SELECT "lessonId", "completedAt"
      FROM "LessonCompletion"
      WHERE "studentId" = ${user.id} AND "lessonId" IN (${Prisma.join(lessonIds)})
    `
    : [];

  const now = new Date();
  let totalLessons = 0;
  let completedLessons = 0;

  const payload = modules.map((module) => {
    const moduleLessons = lessons.filter((item) => item.moduleId === module.id);
    const visibleLessons = moduleLessons.filter((item) => canManage || item.visibility === "VISIBLE");

    const lockedForStudent =
      !canManage &&
      user.role === Role.STUDENT &&
      module.visibilityRule === MODULE_VISIBILITY_LIMITED &&
      !!module.releaseAt &&
      now < module.releaseAt;

    const lessonsForResponse = lockedForStudent
      ? []
      : visibleLessons.map((lesson) => {
          const lessonAttachments = attachments.filter((item) => item.lessonId === lesson.id);
          const completion = completions.find((item) => item.lessonId === lesson.id);
          return {
            id: lesson.id,
            title: lesson.title,
            content: lesson.content,
            position: lesson.position,
            visibility: lesson.visibility,
            isRequired: lesson.isRequired,
            embedUrl: lesson.embedUrl,
            attachments: lessonAttachments,
            completedByViewer: !!completion,
            completedAt: completion ? completion.completedAt.toISOString() : null,
          };
        });

    if (user.role === Role.STUDENT) {
      totalLessons += visibleLessons.length;
      completedLessons += visibleLessons.filter((lesson) => completions.some((item) => item.lessonId === lesson.id)).length;
    }

    const moduleCompleted =
      user.role === Role.STUDENT
        ? visibleLessons.filter((lesson) => completions.some((item) => item.lessonId === lesson.id)).length
        : 0;

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      position: module.position,
      releaseAt: module.releaseAt?.toISOString() ?? null,
      visibilityRule: module.visibilityRule,
      accessState: lockedForStudent ? "LOCKED" : "OPEN",
      lessonCount: visibleLessons.length,
      completedLessons: moduleCompleted,
      progressPercent: visibleLessons.length ? Math.round((moduleCompleted / visibleLessons.length) * 100) : 0,
      lessons: lessonsForResponse,
    };
  });

  return {
    modules: payload,
    analytics:
      user.role === Role.STUDENT
        ? {
            totalLessons,
            completedLessons,
            courseProgressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
          }
        : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const courseId = request.nextUrl.searchParams.get("courseId")?.trim() ?? "";

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const access = await getCourseAccess(user, courseId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const courseModule = getCourseModuleDelegate();
    if (!courseModule) {
      await ensureCourseStructureSchema();
      return NextResponse.json(await listModulesRaw(courseId, user, access.canManage));
    }

    const modules = await courseModule.findMany({
      where: { courseId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        lessons: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            attachments: {
              orderBy: { createdAt: "asc" },
            },
            completions:
              user.role === Role.STUDENT
                ? {
                    where: { studentId: user.id },
                    select: { id: true, completedAt: true },
                  }
                : false,
          },
        },
      },
    });

    const now = new Date();
    let totalLessons = 0;
    let completedLessons = 0;

    const payload = modules.map((module) => {
      const lockedForStudent =
        !access.canManage &&
        user.role === Role.STUDENT &&
        module.visibilityRule === MODULE_VISIBILITY_LIMITED &&
        !!module.releaseAt &&
        now < module.releaseAt;

      const visibleLessons = module.lessons.filter((lesson) => access.canManage || lesson.visibility === "VISIBLE");
      const lessonsForResponse = lockedForStudent
        ? []
        : visibleLessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            content: lesson.content,
            position: lesson.position,
            visibility: lesson.visibility,
            isRequired: lesson.isRequired,
            embedUrl: lesson.embedUrl,
            attachments: lesson.attachments,
            completedByViewer: user.role === Role.STUDENT ? lesson.completions.length > 0 : false,
            completedAt:
              user.role === Role.STUDENT && lesson.completions.length ? lesson.completions[0].completedAt.toISOString() : null,
          }));

      if (user.role === Role.STUDENT) {
        totalLessons += visibleLessons.length;
        completedLessons += visibleLessons.filter((lesson) => lesson.completions.length > 0).length;
      }

      const moduleTotal = visibleLessons.length;
      const moduleCompleted =
        user.role === Role.STUDENT ? visibleLessons.filter((lesson) => lesson.completions.length > 0).length : 0;

      return {
        id: module.id,
        title: module.title,
        description: module.description,
        position: module.position,
        releaseAt: module.releaseAt?.toISOString() ?? null,
        visibilityRule: module.visibilityRule,
        accessState: lockedForStudent ? "LOCKED" : "OPEN",
        lessonCount: moduleTotal,
        completedLessons: moduleCompleted,
        progressPercent: moduleTotal ? Math.round((moduleCompleted / moduleTotal) * 100) : 0,
        lessons: lessonsForResponse,
      };
    });

    return NextResponse.json({
      modules: payload,
      analytics:
        user.role === Role.STUDENT
          ? {
              totalLessons,
              completedLessons,
              courseProgressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
            }
          : null,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load modules.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as CreateModuleBody;

    const courseId = body.courseId?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    if (!courseId || !title) {
      return NextResponse.json({ error: "courseId and title are required." }, { status: 400 });
    }

    const access = await getCourseAccess(user, courseId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can create modules." }, { status: 403 });
    }

    const releaseAt = parseOptionalDate(body.releaseAt);
    if (body.releaseAt !== undefined && releaseAt === undefined) {
      return NextResponse.json({ error: "Invalid releaseAt date." }, { status: 400 });
    }

    const visibilityRule = body.visibilityRule ? parseModuleVisibility(body.visibilityRule) : MODULE_VISIBILITY_ALL;
    if (!visibilityRule) {
      return NextResponse.json({ error: "Invalid visibility rule." }, { status: 400 });
    }

    const courseModule = getCourseModuleDelegate();
    if (!courseModule) {
      await ensureCourseStructureSchema();
      const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count FROM "CourseModule" WHERE "courseId" = ${courseId}
      `;
      const position = Number(countRows[0]?.count ?? 0);
      const moduleId = makeId("mod");

      await prisma.$executeRaw`
        INSERT INTO "CourseModule" ("id", "courseId", "title", "description", "position", "releaseAt", "visibilityRule", "createdAt", "updatedAt")
        VALUES (${moduleId}, ${courseId}, ${title}, ${body.description?.trim() || null}, ${position}, ${releaseAt}, CAST(${visibilityRule} AS "ModuleVisibilityRule"), NOW(), NOW())
      `;

      const createdRows = await prisma.$queryRaw<RawModule[]>`
        SELECT "id", "title", "description", "position", "releaseAt", "visibilityRule"::text AS "visibilityRule"
        FROM "CourseModule"
        WHERE "id" = ${moduleId}
      `;

      return NextResponse.json({ ok: true, module: createdRows[0] }, { status: 201 });
    }

    const position = await courseModule.count({ where: { courseId } });

    const created = await courseModule.create({
      data: {
        courseId,
        title,
        description: body.description?.trim() || null,
        releaseAt: releaseAt ?? null,
        visibilityRule,
        position,
      },
    });

    return NextResponse.json({ ok: true, module: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as UpdateModuleBody;

    const moduleId = body.moduleId?.trim() ?? "";
    if (!moduleId) {
      return NextResponse.json({ error: "moduleId is required." }, { status: 400 });
    }

    const courseModule = getCourseModuleDelegate();

    if (!courseModule) {
      await ensureCourseStructureSchema();
      const existingRows = await prisma.$queryRaw<Array<{ id: string; courseId: string; title: string; description: string | null; releaseAt: Date | null; visibilityRule: ModuleVisibilityValue }>>`
        SELECT "id", "courseId", "title", "description", "releaseAt", "visibilityRule"::text AS "visibilityRule"
        FROM "CourseModule"
        WHERE "id" = ${moduleId}
      `;
      const existing = existingRows[0];
      if (!existing) {
        return NextResponse.json({ error: "Module not found." }, { status: 404 });
      }

      const access = await getCourseAccess(user, existing.courseId);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      if (!access.canManage) {
        return NextResponse.json({ error: "Only admin or assigned teacher can update modules." }, { status: 403 });
      }

      if (body.position !== undefined) {
        const siblings = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "CourseModule"
          WHERE "courseId" = ${existing.courseId}
          ORDER BY "position" ASC, "createdAt" ASC
        `;
        const currentIndex = siblings.findIndex((item) => item.id === moduleId);
        if (currentIndex >= 0) {
          const next = [...siblings];
          const [moved] = next.splice(currentIndex, 1);
          const targetIndex = clampIndex(body.position, next.length);
          next.splice(targetIndex, 0, moved);
          for (let index = 0; index < next.length; index += 1) {
            await prisma.$executeRaw`
              UPDATE "CourseModule"
              SET "position" = ${index}, "updatedAt" = NOW()
              WHERE "id" = ${next[index].id}
            `;
          }
        }
      }

      const nextTitle = body.title !== undefined ? body.title.trim() : existing.title;
      if (!nextTitle) {
        return NextResponse.json({ error: "Module title is required." }, { status: 400 });
      }
      const nextDescription = body.description !== undefined ? body.description?.trim() || null : existing.description;
      const parsedRelease =
        body.releaseAt !== undefined ? parseOptionalDate(body.releaseAt) : existing.releaseAt;
      if (body.releaseAt !== undefined && parsedRelease === undefined) {
        return NextResponse.json({ error: "Invalid releaseAt date." }, { status: 400 });
      }
      const nextVisibility =
        body.visibilityRule !== undefined
          ? parseModuleVisibility(body.visibilityRule)
          : existing.visibilityRule;
      if (!nextVisibility) {
        return NextResponse.json({ error: "Invalid visibility rule." }, { status: 400 });
      }

      await prisma.$executeRaw`
        UPDATE "CourseModule"
        SET "title" = ${nextTitle},
            "description" = ${nextDescription},
            "releaseAt" = ${parsedRelease ?? null},
            "visibilityRule" = CAST(${nextVisibility} AS "ModuleVisibilityRule"),
            "updatedAt" = NOW()
        WHERE "id" = ${moduleId}
      `;

      const updatedRows = await prisma.$queryRaw<RawModule[]>`
        SELECT "id", "title", "description", "position", "releaseAt", "visibilityRule"::text AS "visibilityRule"
        FROM "CourseModule"
        WHERE "id" = ${moduleId}
      `;

      return NextResponse.json({ ok: true, module: updatedRows[0] });
    }

    const existing = await courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    const access = await getCourseAccess(user, existing.courseId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can update modules." }, { status: 403 });
    }

    const data: Prisma.CourseModuleUpdateInput = {};

    if (body.title !== undefined) {
      const value = body.title.trim();
      if (!value) return NextResponse.json({ error: "Module title is required." }, { status: 400 });
      data.title = value;
    }

    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }

    if (body.releaseAt !== undefined) {
      const releaseAt = parseOptionalDate(body.releaseAt);
      if (releaseAt === undefined) {
        return NextResponse.json({ error: "Invalid releaseAt date." }, { status: 400 });
      }
      data.releaseAt = releaseAt;
    }

    if (body.visibilityRule !== undefined) {
      const visibilityRule = parseModuleVisibility(body.visibilityRule);
      if (!visibilityRule) {
        return NextResponse.json({ error: "Invalid visibility rule." }, { status: 400 });
      }
      data.visibilityRule = visibilityRule;
    }

    const shouldReorder = body.position !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldReorder) {
        const siblings = await tx.courseModule.findMany({
          where: { courseId: existing.courseId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });

        const currentIndex = siblings.findIndex((item) => item.id === moduleId);
        if (currentIndex >= 0) {
          const next = [...siblings];
          const [moved] = next.splice(currentIndex, 1);
          const targetIndex = clampIndex(body.position as number, next.length);
          next.splice(targetIndex, 0, moved);

          for (let index = 0; index < next.length; index += 1) {
            await tx.courseModule.update({
              where: { id: next[index].id },
              data: { position: index },
            });
          }
        }
      }

      return tx.courseModule.update({
        where: { id: moduleId },
        data,
      });
    });

    return NextResponse.json({ ok: true, module: updated });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as DeleteModuleBody;

    const moduleId = body.moduleId?.trim() ?? "";
    if (!moduleId) {
      return NextResponse.json({ error: "moduleId is required." }, { status: 400 });
    }

    const courseModule = getCourseModuleDelegate();

    if (!courseModule) {
      await ensureCourseStructureSchema();
      const existingRows = await prisma.$queryRaw<Array<{ id: string; courseId: string }>>`
        SELECT "id", "courseId" FROM "CourseModule" WHERE "id" = ${moduleId}
      `;
      const existing = existingRows[0];
      if (!existing) {
        return NextResponse.json({ error: "Module not found." }, { status: 404 });
      }

      const access = await getCourseAccess(user, existing.courseId);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      if (!access.canManage) {
        return NextResponse.json({ error: "Only admin or assigned teacher can delete modules." }, { status: 403 });
      }

      await prisma.$executeRaw`DELETE FROM "CourseModule" WHERE "id" = ${moduleId}`;
      const siblings = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "CourseModule"
        WHERE "courseId" = ${existing.courseId}
        ORDER BY "position" ASC, "createdAt" ASC
      `;
      for (let index = 0; index < siblings.length; index += 1) {
        await prisma.$executeRaw`
          UPDATE "CourseModule"
          SET "position" = ${index}, "updatedAt" = NOW()
          WHERE "id" = ${siblings[index].id}
        `;
      }

      return NextResponse.json({ ok: true });
    }

    const existing = await courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 });
    }

    const access = await getCourseAccess(user, existing.courseId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can delete modules." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.courseModule.delete({ where: { id: moduleId } });
      const siblings = await tx.courseModule.findMany({
        where: { courseId: existing.courseId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      for (let index = 0; index < siblings.length; index += 1) {
        await tx.courseModule.update({ where: { id: siblings[index].id }, data: { position: index } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to delete module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
