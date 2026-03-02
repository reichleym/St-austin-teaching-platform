import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { COURSE_VISIBILITY_PUBLISHED, parseLessonVisibility } from "@/lib/courses";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type AttachmentInput = {
  kind?: "FILE" | "PDF" | "VIDEO_LINK";
  label?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  publicUrl?: string;
};

type CreateLessonBody = {
  moduleId?: string;
  title?: string;
  content?: string | null;
  visibility?: "VISIBLE" | "HIDDEN";
  isRequired?: boolean;
  embedUrl?: string | null;
  attachments?: AttachmentInput[];
};

type UpdateLessonBody = {
  lessonId?: string;
  title?: string;
  content?: string | null;
  visibility?: "VISIBLE" | "HIDDEN";
  isRequired?: boolean;
  embedUrl?: string | null;
  position?: number;
  attachments?: AttachmentInput[];
};

type DeleteLessonBody = {
  lessonId?: string;
};

function isCourseVisibilityCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `visibility`") ||
    error.message.includes("Unknown argument `visibility`") ||
    error.message.includes("column \"visibility\" does not exist") ||
    (error.message.includes("CourseVisibility") && error.message.includes("Invalid value for argument"))
  );
}

function isCourseStructureCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Course lesson schema is outdated") ||
    error.message.includes("Cannot read properties of undefined")
  );
}

function getLessonDelegate() {
  return (prisma as unknown as { lesson?: typeof prisma.lesson }).lesson;
}

function getCourseModuleDelegate() {
  return (prisma as unknown as { courseModule?: typeof prisma.courseModule }).courseModule;
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
`);
}

function clampIndex(value: number, maxLength: number) {
  if (!Number.isInteger(value)) return 0;
  if (value < 0) return 0;
  if (value > maxLength) return maxLength;
  return value;
}

function normalizeAttachments(inputs: AttachmentInput[] | undefined) {
  if (!Array.isArray(inputs)) return [];
  return inputs
    .map((item) => ({
      kind: item.kind,
      label: item.label?.trim() || null,
      fileName: item.fileName?.trim() || null,
      mimeType: item.mimeType?.trim() || null,
      sizeBytes: typeof item.sizeBytes === "number" && Number.isFinite(item.sizeBytes) ? Math.max(0, Math.trunc(item.sizeBytes)) : null,
      storageKey: item.storageKey?.trim() || null,
      publicUrl: item.publicUrl?.trim() || null,
    }))
    .filter((item) => item.kind === "FILE" || item.kind === "PDF" || item.kind === "VIDEO_LINK");
}

async function getCourseAccessByModule(user: { id: string; role: Role | string }, moduleId: string) {
  if (!getCourseModuleDelegate()) {
    await ensureCourseStructureSchema();
    const moduleRows = await prisma.$queryRaw<
      Array<{ id: string; courseId: string; teacherId: string | null }>
    >`
      SELECT m."id", m."courseId", c."teacherId"
      FROM "CourseModule" m
      JOIN "Course" c ON c."id" = m."courseId"
      WHERE m."id" = ${moduleId}
      LIMIT 1
    `;
    const row = moduleRows[0];
    if (!row) return { ok: false as const, status: 404, error: "Module not found." };
    const enrollments = await prisma.enrollment.count({
      where: { courseId: row.courseId, studentId: user.id, status: "ACTIVE" },
    });
    const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && row.teacherId === user.id);
    const canViewAsStudent = user.role === Role.STUDENT && enrollments > 0;
    if (!canManage && !canViewAsStudent) {
      return { ok: false as const, status: 403, error: "You do not have access to this module." };
    }
    return {
      ok: true as const,
      module: { id: row.id, courseId: row.courseId, course: { teacherId: row.teacherId, visibility: COURSE_VISIBILITY_PUBLISHED, enrollments: enrollments ? [{ id: "x" }] : [] } },
      canManage,
      canViewAsStudent,
    };
  }

  let courseModule: {
    id: string;
    courseId: string;
    course: {
      teacherId: string | null;
      visibility: "DRAFT" | "PUBLISHED";
      enrollments: Array<{ id: string }>;
    };
  } | null = null;

  try {
    courseModule = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            teacherId: true,
            visibility: true,
            enrollments: {
              where: { studentId: user.id, status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!isCourseVisibilityCompatibilityError(error)) throw error;
    const legacy = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            teacherId: true,
            enrollments: {
              where: { studentId: user.id, status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
      },
    });
    courseModule = legacy
      ? {
          ...legacy,
          course: {
            ...legacy.course,
            visibility: COURSE_VISIBILITY_PUBLISHED,
          },
        }
      : null;
  }

  if (!courseModule) return { ok: false as const, status: 404, error: "Module not found." };

  const canManage =
    isSuperAdminRole(user.role) || (user.role === Role.TEACHER && courseModule.course.teacherId === user.id);
  const canViewAsStudent =
    user.role === Role.STUDENT &&
    courseModule.course.visibility === COURSE_VISIBILITY_PUBLISHED &&
    courseModule.course.enrollments.length > 0;

  if (!canManage && !canViewAsStudent) {
    return { ok: false as const, status: 403, error: "You do not have access to this module." };
  }

  return { ok: true as const, module: courseModule, canManage, canViewAsStudent };
}

async function getCourseAccessByLesson(user: { id: string; role: Role | string }, lessonId: string) {
  if (!getLessonDelegate()) {
    await ensureCourseStructureSchema();
    const lessonRows = await prisma.$queryRaw<
      Array<{ id: string; moduleId: string; courseId: string; teacherId: string | null }>
    >`
      SELECT l."id", l."moduleId", m."courseId", c."teacherId"
      FROM "Lesson" l
      JOIN "CourseModule" m ON m."id" = l."moduleId"
      JOIN "Course" c ON c."id" = m."courseId"
      WHERE l."id" = ${lessonId}
      LIMIT 1
    `;
    const row = lessonRows[0];
    if (!row) return { ok: false as const, status: 404, error: "Lesson not found." };
    const enrollments = await prisma.enrollment.count({
      where: { courseId: row.courseId, studentId: user.id, status: "ACTIVE" },
    });
    const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && row.teacherId === user.id);
    const canViewAsStudent = user.role === Role.STUDENT && enrollments > 0;
    if (!canManage && !canViewAsStudent) {
      return { ok: false as const, status: 403, error: "You do not have access to this lesson." };
    }
    return {
      ok: true as const,
      lesson: {
        id: row.id,
        moduleId: row.moduleId,
        module: { id: row.moduleId, courseId: row.courseId, course: { teacherId: row.teacherId, visibility: COURSE_VISIBILITY_PUBLISHED, enrollments: enrollments ? [{ id: "x" }] : [] } },
      },
      canManage,
      canViewAsStudent,
    };
  }

  let lesson: {
    id: string;
    moduleId: string;
    module: {
      id: string;
      courseId: string;
      course: {
        teacherId: string | null;
        visibility: "DRAFT" | "PUBLISHED";
        enrollments: Array<{ id: string }>;
      };
    };
  } | null = null;

  try {
    lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        moduleId: true,
        module: {
          select: {
            id: true,
            courseId: true,
            course: {
              select: {
                teacherId: true,
                visibility: true,
                enrollments: {
                  where: { studentId: user.id, status: "ACTIVE" },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (!isCourseVisibilityCompatibilityError(error)) throw error;
    const legacy = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        moduleId: true,
        module: {
          select: {
            id: true,
            courseId: true,
            course: {
              select: {
                teacherId: true,
                enrollments: {
                  where: { studentId: user.id, status: "ACTIVE" },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    lesson = legacy
      ? {
          ...legacy,
          module: {
            ...legacy.module,
            course: {
              ...legacy.module.course,
              visibility: COURSE_VISIBILITY_PUBLISHED,
            },
          },
        }
      : null;
  }

  if (!lesson) return { ok: false as const, status: 404, error: "Lesson not found." };

  const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && lesson.module.course.teacherId === user.id);
  const canViewAsStudent =
    user.role === Role.STUDENT &&
    lesson.module.course.visibility === COURSE_VISIBILITY_PUBLISHED &&
    lesson.module.course.enrollments.length > 0;

  if (!canManage && !canViewAsStudent) {
    return { ok: false as const, status: 403, error: "You do not have access to this lesson." };
  }

  return { ok: true as const, lesson, canManage, canViewAsStudent };
}

export async function POST(request: NextRequest) {
  try {
    const lessonModel = getLessonDelegate();
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as CreateLessonBody;

    const moduleId = body.moduleId?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    if (!moduleId || !title) {
      return NextResponse.json({ error: "moduleId and title are required." }, { status: 400 });
    }

    const access = await getCourseAccessByModule(user, moduleId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can create lessons." }, { status: 403 });
    }

    const visibility = body.visibility ? parseLessonVisibility(body.visibility) : "VISIBLE";
    if (!visibility) {
      return NextResponse.json({ error: "Invalid lesson visibility." }, { status: 400 });
    }

    if (!lessonModel) {
      await ensureCourseStructureSchema();
      const countRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*)::bigint AS count FROM "Lesson" WHERE "moduleId" = ${moduleId}
      `;
      const position = Number(countRows[0]?.count ?? 0);
      const lessonId = `les_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
      await prisma.$executeRaw`
        INSERT INTO "Lesson" ("id","moduleId","title","content","position","visibility","isRequired","embedUrl","createdAt","updatedAt")
        VALUES (${lessonId}, ${moduleId}, ${title}, ${body.content?.trim() || null}, ${position}, CAST(${visibility} AS "LessonVisibility"), ${body.isRequired ?? true}, ${body.embedUrl?.trim() || null}, NOW(), NOW())
      `;
      const attachments = normalizeAttachments(body.attachments);
      for (const item of attachments) {
        await prisma.$executeRaw`
          INSERT INTO "LessonAttachment" ("id","lessonId","kind","label","fileName","mimeType","sizeBytes","storageKey","publicUrl","createdAt")
          VALUES (${`att_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`}, ${lessonId}, CAST(${item.kind} AS "LessonAttachmentKind"), ${item.label}, ${item.fileName}, ${item.mimeType}, ${item.sizeBytes}, ${item.storageKey}, ${item.publicUrl}, NOW())
        `;
      }
      const lessonRows = await prisma.$queryRaw<Array<{ id: string; moduleId: string; title: string; content: string | null; position: number; visibility: "VISIBLE" | "HIDDEN"; isRequired: boolean; embedUrl: string | null }>>`
        SELECT "id","moduleId","title","content","position","visibility"::text AS "visibility","isRequired","embedUrl"
        FROM "Lesson" WHERE "id" = ${lessonId} LIMIT 1
      `;
      return NextResponse.json({ ok: true, lesson: { ...lessonRows[0], attachments } }, { status: 201 });
    }

    const position = await lessonModel.count({ where: { moduleId } });
    const attachments = normalizeAttachments(body.attachments);

    const created = await lessonModel.create({
      data: {
        moduleId,
        title,
        content: body.content?.trim() || null,
        visibility,
        isRequired: body.isRequired ?? true,
        embedUrl: body.embedUrl?.trim() || null,
        position,
        attachments: attachments.length
          ? {
              createMany: {
                data: attachments,
              },
            }
          : undefined,
      },
      include: {
        attachments: true,
      },
    });

    return NextResponse.json({ ok: true, lesson: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isCourseStructureCompatibilityError(error)) {
      const compatibilityMessage =
        error instanceof Error
          ? error.message
          : "Course lesson schema is outdated in the database/client. Please run latest Prisma migrations and regenerate Prisma client.";
      return NextResponse.json({ error: compatibilityMessage }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unable to create lesson.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const lessonModel = getLessonDelegate();
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as UpdateLessonBody;

    const lessonId = body.lessonId?.trim() ?? "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required." }, { status: 400 });
    }

    const access = await getCourseAccessByLesson(user, lessonId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can update lessons." }, { status: 403 });
    }

    const data: Prisma.LessonUpdateInput = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Lesson title is required." }, { status: 400 });
      data.title = title;
    }

    if (body.content !== undefined) {
      data.content = body.content?.trim() || null;
    }

    if (body.embedUrl !== undefined) {
      data.embedUrl = body.embedUrl?.trim() || null;
    }

    if (body.isRequired !== undefined) {
      data.isRequired = !!body.isRequired;
    }

    if (body.visibility !== undefined) {
      const visibility = parseLessonVisibility(body.visibility);
      if (!visibility) {
        return NextResponse.json({ error: "Invalid lesson visibility." }, { status: 400 });
      }
      data.visibility = visibility;
    }

    const attachments = body.attachments ? normalizeAttachments(body.attachments) : null;
    const shouldReorder = body.position !== undefined;

    if (!lessonModel) {
      await ensureCourseStructureSchema();
      const existingRows = await prisma.$queryRaw<Array<{ id: string; title: string; content: string | null; visibility: "VISIBLE" | "HIDDEN"; isRequired: boolean; embedUrl: string | null }>>`
        SELECT "id","title","content","visibility"::text AS "visibility","isRequired","embedUrl"
        FROM "Lesson" WHERE "id" = ${lessonId} LIMIT 1
      `;
      const existing = existingRows[0];
      if (!existing) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
      if (body.position !== undefined) {
        const siblings = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Lesson" WHERE "moduleId" = ${access.lesson.moduleId} ORDER BY "position" ASC, "createdAt" ASC
        `;
        const currentIndex = siblings.findIndex((item) => item.id === lessonId);
        if (currentIndex >= 0) {
          const next = [...siblings];
          const [moved] = next.splice(currentIndex, 1);
          const targetIndex = clampIndex(body.position as number, next.length);
          next.splice(targetIndex, 0, moved);
          for (let index = 0; index < next.length; index += 1) {
            await prisma.$executeRaw`UPDATE "Lesson" SET "position" = ${index}, "updatedAt" = NOW() WHERE "id" = ${next[index].id}`;
          }
        }
      }
      const nextTitle = body.title !== undefined ? body.title.trim() : existing.title;
      if (!nextTitle) return NextResponse.json({ error: "Lesson title is required." }, { status: 400 });
      const nextContent = body.content !== undefined ? body.content?.trim() || null : existing.content;
      const nextVisibility = body.visibility !== undefined ? parseLessonVisibility(body.visibility) : existing.visibility;
      if (!nextVisibility) return NextResponse.json({ error: "Invalid lesson visibility." }, { status: 400 });
      const nextRequired = body.isRequired !== undefined ? !!body.isRequired : existing.isRequired;
      const nextEmbedUrl = body.embedUrl !== undefined ? body.embedUrl?.trim() || null : existing.embedUrl;
      await prisma.$executeRaw`
        UPDATE "Lesson"
        SET "title" = ${nextTitle}, "content" = ${nextContent}, "visibility" = CAST(${nextVisibility} AS "LessonVisibility"), "isRequired" = ${nextRequired}, "embedUrl" = ${nextEmbedUrl}, "updatedAt" = NOW()
        WHERE "id" = ${lessonId}
      `;
      const attachments = body.attachments ? normalizeAttachments(body.attachments) : null;
      if (attachments) {
        await prisma.$executeRaw`DELETE FROM "LessonAttachment" WHERE "lessonId" = ${lessonId}`;
        for (const item of attachments) {
          await prisma.$executeRaw`
            INSERT INTO "LessonAttachment" ("id","lessonId","kind","label","fileName","mimeType","sizeBytes","storageKey","publicUrl","createdAt")
            VALUES (${`att_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`}, ${lessonId}, CAST(${item.kind} AS "LessonAttachmentKind"), ${item.label}, ${item.fileName}, ${item.mimeType}, ${item.sizeBytes}, ${item.storageKey}, ${item.publicUrl}, NOW())
          `;
        }
      }
      const lessonRows = await prisma.$queryRaw<Array<{ id: string; moduleId: string; title: string; content: string | null; position: number; visibility: "VISIBLE" | "HIDDEN"; isRequired: boolean; embedUrl: string | null }>>`
        SELECT "id","moduleId","title","content","position","visibility"::text AS "visibility","isRequired","embedUrl"
        FROM "Lesson" WHERE "id" = ${lessonId} LIMIT 1
      `;
      const lessonAttachments = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "LessonAttachment" WHERE "lessonId" = ${lessonId}
      `;
      return NextResponse.json({ ok: true, lesson: { ...lessonRows[0], attachments: lessonAttachments } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldReorder) {
        const siblings = await tx.lesson.findMany({
          where: { moduleId: access.lesson.moduleId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        });

        const currentIndex = siblings.findIndex((item) => item.id === lessonId);
        if (currentIndex >= 0) {
          const next = [...siblings];
          const [moved] = next.splice(currentIndex, 1);
          const targetIndex = clampIndex(body.position as number, next.length);
          next.splice(targetIndex, 0, moved);

          for (let index = 0; index < next.length; index += 1) {
            await tx.lesson.update({
              where: { id: next[index].id },
              data: { position: index },
            });
          }
        }
      }

      const lesson = await tx.lesson.update({
        where: { id: lessonId },
        data,
      });

      if (attachments) {
        await tx.lessonAttachment.deleteMany({ where: { lessonId } });
        if (attachments.length) {
          await tx.lessonAttachment.createMany({
            data: attachments.map((item) => ({ ...item, lessonId })),
          });
        }
      }

      return tx.lesson.findUnique({
        where: { id: lesson.id },
        include: { attachments: true },
      });
    });

    return NextResponse.json({ ok: true, lesson: updated });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isCourseStructureCompatibilityError(error)) {
      const compatibilityMessage =
        error instanceof Error
          ? error.message
          : "Course lesson schema is outdated in the database/client. Please run latest Prisma migrations and regenerate Prisma client.";
      return NextResponse.json({ error: compatibilityMessage }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unable to update lesson.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const lessonModel = getLessonDelegate();
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as DeleteLessonBody;

    const lessonId = body.lessonId?.trim() ?? "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required." }, { status: 400 });
    }

    const access = await getCourseAccessByLesson(user, lessonId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canManage) {
      return NextResponse.json({ error: "Only admin or assigned teacher can delete lessons." }, { status: 403 });
    }

    if (!lessonModel) {
      await ensureCourseStructureSchema();
      await prisma.$executeRaw`DELETE FROM "Lesson" WHERE "id" = ${lessonId}`;
      const siblings = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Lesson" WHERE "moduleId" = ${access.lesson.moduleId} ORDER BY "position" ASC, "createdAt" ASC
      `;
      for (let index = 0; index < siblings.length; index += 1) {
        await prisma.$executeRaw`UPDATE "Lesson" SET "position" = ${index}, "updatedAt" = NOW() WHERE "id" = ${siblings[index].id}`;
      }
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id: lessonId } });
      const siblings = await tx.lesson.findMany({
        where: { moduleId: access.lesson.moduleId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      for (let index = 0; index < siblings.length; index += 1) {
        await tx.lesson.update({ where: { id: siblings[index].id }, data: { position: index } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isCourseStructureCompatibilityError(error)) {
      const compatibilityMessage =
        error instanceof Error
          ? error.message
          : "Course lesson schema is outdated in the database/client. Please run latest Prisma migrations and regenerate Prisma client.";
      return NextResponse.json({ error: compatibilityMessage }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unable to delete lesson.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
