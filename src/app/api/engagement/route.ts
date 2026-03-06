import { Prisma, Role } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { COURSE_VISIBILITY_PUBLISHED } from "@/lib/courses";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ActionBody =
  | {
      action: "createDiscussion";
      courseId?: string;
      moduleId?: string | null;
      title?: string;
      prompt?: string;
      openAt?: string | null;
      closeAt?: string | null;
      allowLate?: boolean;
      isGraded?: boolean;
      maxPoints?: number | string | null;
    }
  | {
      action: "createPost";
      discussionId?: string;
      content?: string;
      parentPostId?: string | null;
    }
  | {
      action: "toggleLock";
      discussionId?: string;
      isLocked?: boolean;
    }
  | {
      action: "pinPost";
      postId?: string;
      isPinned?: boolean;
    }
  | {
      action: "deletePost";
      postId?: string;
    }
  | {
      action: "editPost";
      postId?: string;
      content?: string;
    };

type StudentIndicator = {
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  hasInitialPost: boolean;
  replyCount: number;
  status: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED";
  score: number | null;
};

function parseOptionalDate(input: string | null | undefined) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function ensureOpenWindow(
  discussion: { openAt: Date | null; closeAt: Date | null; allowLate: boolean; isLocked: boolean },
  role: Role | string
) {
  if (discussion.isLocked && !isSuperAdminRole(role) && role !== Role.TEACHER) {
    return "Discussion is locked.";
  }
  const now = new Date();
  if (discussion.openAt && now < discussion.openAt) {
    return "Discussion is not open yet.";
  }
  if (discussion.closeAt && now > discussion.closeAt && !discussion.allowLate) {
    return "Discussion is closed.";
  }
  return null;
}

async function ensureEngagementSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "EngagementDiscussion" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "moduleId" TEXT,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "openAt" TIMESTAMP(3),
  "closeAt" TIMESTAMP(3),
  "allowLate" BOOLEAN NOT NULL DEFAULT false,
  "isGraded" BOOLEAN NOT NULL DEFAULT false,
  "maxPoints" DOUBLE PRECISION,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngagementDiscussion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EngagementDiscussion_course_created_idx" ON "EngagementDiscussion"("courseId","createdAt");
CREATE INDEX IF NOT EXISTS "EngagementDiscussion_module_idx" ON "EngagementDiscussion"("moduleId");
ALTER TABLE "EngagementDiscussion" ADD COLUMN IF NOT EXISTS "isGraded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EngagementDiscussion" ADD COLUMN IF NOT EXISTS "maxPoints" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "EngagementPost" (
  "id" TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentPostId" TEXT,
  "content" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "lateByMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngagementPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EngagementPost_discussion_created_idx" ON "EngagementPost"("discussionId","createdAt");
CREATE INDEX IF NOT EXISTS "EngagementPost_parent_idx" ON "EngagementPost"("parentPostId");
ALTER TABLE "EngagementPost" ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EngagementPost" ADD COLUMN IF NOT EXISTS "lateByMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "EngagementModerationLog" (
  "id" TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "postId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngagementModerationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EngagementModerationLog_discussion_created_idx" ON "EngagementModerationLog"("discussionId","createdAt");
  `);
}

async function listAccessibleCourses(user: { id: string; role: Role | string }) {
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
      visibility: COURSE_VISIBILITY_PUBLISHED,
      enrollments: { some: { studentId: user.id, status: "ACTIVE" } },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, code: true, title: true, teacherId: true },
  });
}

async function ensureCourseManageAccess(courseId: string, user: { id: string; role: Role | string }) {
  if (isSuperAdminRole(user.role)) return { ok: true as const };
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { teacherId: true } });
  if (!course) return { ok: false as const, status: 404, error: "Course not found." };
  if (user.role !== Role.TEACHER || course.teacherId !== user.id) {
    return { ok: false as const, status: 403, error: "Only admin or assigned teacher can manage discussions." };
  }
  return { ok: true as const };
}

function computeIndicators(
  students: Array<{ id: string; name: string | null; email: string }>,
  posts: Array<{ id: string; authorId: string; parentPostId: string | null; parentAuthorId: string | null }>,
  grading?: { isGraded: boolean; maxPoints: number | null }
): StudentIndicator[] {
  return students.map((student) => {
    const mine = posts.filter((post) => post.authorId === student.id);
    const hasInitialPost = mine.some((post) => post.parentPostId === null);
    const uniqueClassmateReplies = new Set(
      mine
        .filter((post) => post.parentPostId !== null && post.parentAuthorId !== student.id && post.parentAuthorId)
        .map((post) => post.parentAuthorId as string)
    );
    const replyCount = uniqueClassmateReplies.size;
    const status: StudentIndicator["status"] = hasInitialPost && replyCount >= 2 ? "COMPLETED" : hasInitialPost || replyCount > 0 ? "PARTIAL" : "NOT_PARTICIPATED";
    let score: number | null = null;
    if (grading?.isGraded && Number.isFinite(grading.maxPoints) && (grading.maxPoints ?? 0) > 0) {
      const maxPoints = Number(grading.maxPoints);
      const rawScore = status === "COMPLETED" ? maxPoints : status === "PARTIAL" ? maxPoints * 0.5 : 0;
      score = Math.round(rawScore * 10) / 10;
    }
    return {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      hasInitialPost,
      replyCount,
      status,
      score,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    await ensureEngagementSchema();
    const user = await requireAuthenticatedUser();
    const canManageGlobal = isSuperAdminRole(user.role) || user.role === Role.TEACHER;

    const courseIdParam = request.nextUrl.searchParams.get("courseId")?.trim() ?? "";
    const discussionIdParam = request.nextUrl.searchParams.get("discussionId")?.trim() ?? "";

    const courses = await listAccessibleCourses(user);
    const selectedCourseId = courseIdParam || courses[0]?.id || "";

    const discussions = selectedCourseId
      ? await prisma.$queryRaw<
          Array<{
            id: string;
            courseId: string;
            moduleId: string | null;
            title: string;
            prompt: string;
            openAt: Date | null;
            closeAt: Date | null;
            allowLate: boolean;
            isGraded: boolean;
            maxPoints: number | null;
            isLocked: boolean;
            createdAt: Date;
            updatedAt: Date;
          }>
        >`
          SELECT "id", "courseId", "moduleId", "title", "prompt", "openAt", "closeAt", "allowLate", "isGraded", "maxPoints", "isLocked", "createdAt", "updatedAt"
          FROM "EngagementDiscussion"
          WHERE "courseId" = ${selectedCourseId}
          ORDER BY "createdAt" DESC
        `
      : [];

    const selectedDiscussionId = discussionIdParam || discussions[0]?.id || "";
    const selectedDiscussion = discussions.find((item) => item.id === selectedDiscussionId) ?? null;

    const modules = selectedCourseId
      ? await prisma.$queryRaw<Array<{ id: string; title: string }>>`
          SELECT "id", "title"
          FROM "CourseModule"
          WHERE "courseId" = ${selectedCourseId}
          ORDER BY "position" ASC, "createdAt" ASC
        `.catch(() => [])
      : [];

    const students = selectedCourseId
      ? await prisma.$queryRaw<Array<{ id: string; name: string | null; email: string }>>`
          SELECT u."id", u."name", u."email"
          FROM "Enrollment" e
          JOIN "User" u ON u."id" = e."studentId"
          WHERE e."courseId" = ${selectedCourseId} AND e."status" = CAST('ACTIVE' AS "EnrollmentStatus")
          ORDER BY u."name" ASC NULLS LAST, u."email" ASC
        `
      : [];

    const discussionIds = discussions.map((item) => item.id);
    const postsAll = discussionIds.length
      ? await prisma.$queryRaw<
          Array<{ id: string; discussionId: string; authorId: string; parentPostId: string | null; isDeleted: boolean }>
        >`
          SELECT "id", "discussionId", "authorId", "parentPostId", "isDeleted"
          FROM "EngagementPost"
          WHERE "discussionId" IN (${Prisma.join(discussionIds)})
        `
      : [];

    const postsByDiscussion = new Map<string, Array<{ id: string; authorId: string; parentPostId: string | null; parentAuthorId: string | null }>>();
    const postAuthorById = new Map(postsAll.filter((p) => !p.isDeleted).map((p) => [p.id, p.authorId]));
    for (const post of postsAll) {
      if (post.isDeleted) continue;
      const list = postsByDiscussion.get(post.discussionId) ?? [];
      list.push({
        id: post.id,
        authorId: post.authorId,
        parentPostId: post.parentPostId,
        parentAuthorId: post.parentPostId ? postAuthorById.get(post.parentPostId) ?? null : null,
      });
      postsByDiscussion.set(post.discussionId, list);
    }

    const discussionSummaries = discussions.map((discussion) => {
      const indicators = computeIndicators(
        students,
        postsByDiscussion.get(discussion.id) ?? [],
        { isGraded: discussion.isGraded, maxPoints: discussion.maxPoints }
      );
      const completed = indicators.filter((item) => item.status === "COMPLETED").length;
      const partial = indicators.filter((item) => item.status === "PARTIAL").length;
      const notParticipated = indicators.filter((item) => item.status === "NOT_PARTICIPATED").length;
      const viewer = indicators.find((item) => item.studentId === user.id) ?? null;
      return {
        id: discussion.id,
        courseId: discussion.courseId,
        moduleId: discussion.moduleId,
        title: discussion.title,
        prompt: discussion.prompt,
        openAt: discussion.openAt?.toISOString() ?? null,
        closeAt: discussion.closeAt?.toISOString() ?? null,
        allowLate: discussion.allowLate,
        isGraded: !!discussion.isGraded,
        maxPoints: discussion.maxPoints !== null ? Number(discussion.maxPoints) : null,
        isLocked: discussion.isLocked,
        createdAt: discussion.createdAt.toISOString(),
        updatedAt: discussion.updatedAt.toISOString(),
        stats: {
          totalEnrolled: students.length,
          completed,
          partial,
          notParticipated,
        },
        viewer: viewer
          ? {
              hasInitialPost: viewer.hasInitialPost,
              replyCount: viewer.replyCount,
              status: viewer.status,
            }
          : null,
      };
    });

    const selectedPosts = selectedDiscussion
      ? await prisma.$queryRaw<
          Array<{
            id: string;
            discussionId: string;
            authorId: string;
            parentPostId: string | null;
            content: string;
            isPinned: boolean;
            isLate: boolean;
            lateByMinutes: number;
            createdAt: Date;
            updatedAt: Date;
            authorName: string | null;
            authorEmail: string;
          }>
        >`
          SELECT p."id", p."discussionId", p."authorId", p."parentPostId", p."content", p."isPinned", p."isLate", p."lateByMinutes", p."createdAt", p."updatedAt",
                 u."name" AS "authorName", u."email" AS "authorEmail"
          FROM "EngagementPost" p
          JOIN "User" u ON u."id" = p."authorId"
          WHERE p."discussionId" = ${selectedDiscussion.id} AND p."isDeleted" = false
          ORDER BY p."isPinned" DESC, p."createdAt" ASC
        `
      : [];

    const selectedIndicators = selectedDiscussion
      ? computeIndicators(
          students,
          postsByDiscussion.get(selectedDiscussion.id) ?? [],
          { isGraded: selectedDiscussion.isGraded, maxPoints: selectedDiscussion.maxPoints }
        )
      : [];

    const selectedViewer = selectedIndicators.find((item) => item.studentId === user.id) ?? null;
    const missingStudents = selectedIndicators.filter((item) => item.status === "NOT_PARTICIPATED");
    const partialStudents = selectedIndicators.filter((item) => item.status === "PARTIAL");

    return NextResponse.json({
      canManageGlobal,
      courses,
      modules,
      selectedCourseId,
      selectedDiscussionId,
      discussions: discussionSummaries,
      selectedDiscussion: selectedDiscussion
        ? {
            id: selectedDiscussion.id,
            title: selectedDiscussion.title,
            prompt: selectedDiscussion.prompt,
            openAt: selectedDiscussion.openAt?.toISOString() ?? null,
            closeAt: selectedDiscussion.closeAt?.toISOString() ?? null,
            allowLate: selectedDiscussion.allowLate,
            isGraded: !!selectedDiscussion.isGraded,
            maxPoints: selectedDiscussion.maxPoints !== null ? Number(selectedDiscussion.maxPoints) : null,
            isLocked: selectedDiscussion.isLocked,
            posts: selectedPosts.map((post) => ({
              id: post.id,
              discussionId: post.discussionId,
              authorId: post.authorId,
              parentPostId: post.parentPostId,
              content: post.content,
              isPinned: post.isPinned,
              isLate: post.isLate,
              lateByMinutes: post.lateByMinutes,
              createdAt: post.createdAt.toISOString(),
              updatedAt: post.updatedAt.toISOString(),
              author: {
                id: post.authorId,
                name: post.authorName,
                email: post.authorEmail,
              },
              canEdit: post.authorId === user.id,
            })),
            indicators: selectedIndicators,
            alerts: {
              missingStudents,
              partialStudents,
            },
            viewer: selectedViewer
              ? {
                  hasInitialPost: selectedViewer.hasInitialPost,
                  replyCount: selectedViewer.replyCount,
                  status: selectedViewer.status,
                }
              : null,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load engagement module.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureEngagementSchema();
    const user = await requireAuthenticatedUser();
    const body = (await request.json()) as ActionBody;

    if (!body?.action) {
      return NextResponse.json({ error: "action is required." }, { status: 400 });
    }

    async function logModerationAction(params: {
      discussionId: string;
      postId?: string | null;
      actorId: string;
      action: string;
      details?: Record<string, unknown>;
    }) {
      const logId = `dml_${randomUUID()}`;
      const detailsJson = JSON.stringify(params.details ?? {});
      await prisma.$executeRaw`
        INSERT INTO "EngagementModerationLog"
          ("id","discussionId","postId","actorId","action","details","createdAt")
        VALUES
          (${logId},${params.discussionId},${params.postId ?? null},${params.actorId},${params.action},${detailsJson}::jsonb,NOW())
      `;
    }

    if (body.action === "createDiscussion") {
      const courseId = body.courseId?.trim() ?? "";
      const title = body.title?.trim() ?? "";
      const prompt = body.prompt?.trim() ?? "";
      const moduleId = body.moduleId?.trim() || null;
      const openAt = parseOptionalDate(body.openAt ?? null);
      const closeAt = parseOptionalDate(body.closeAt ?? null);
      const allowLate = body.allowLate ?? true;
      const isGraded = body.isGraded === true;
      const maxPointsValue =
        typeof body.maxPoints === "number" ? body.maxPoints : typeof body.maxPoints === "string" ? Number(body.maxPoints) : NaN;
      const maxPoints = Number.isFinite(maxPointsValue) && maxPointsValue > 0 ? Math.round(maxPointsValue * 100) / 100 : null;

      if (!courseId || !title || !prompt || !moduleId) {
        return NextResponse.json({ error: "courseId, moduleId, title and prompt are required." }, { status: 400 });
      }
      if (!openAt || !closeAt) {
        return NextResponse.json({ error: "open date and close date are required." }, { status: 400 });
      }
      if (openAt && closeAt && closeAt < openAt) {
        return NextResponse.json({ error: "close date must be after open date." }, { status: 400 });
      }
      if (isGraded && !maxPoints) {
        return NextResponse.json({ error: "Max points are required for graded discussions." }, { status: 400 });
      }

      const access = await ensureCourseManageAccess(courseId, user);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }

      const moduleRow = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "CourseModule" WHERE "id" = ${moduleId} AND "courseId" = ${courseId} LIMIT 1
      `;
      if (!moduleRow[0]) {
        return NextResponse.json({ error: "Selected module does not belong to this course." }, { status: 400 });
      }

      const id = `dsc_${randomUUID()}`;
      await prisma.$executeRaw`
        INSERT INTO "EngagementDiscussion"
          ("id","courseId","moduleId","title","prompt","openAt","closeAt","allowLate","isGraded","maxPoints","isLocked","createdById","createdAt","updatedAt")
        VALUES
          (${id},${courseId},${moduleId},${title},${prompt},${openAt},${closeAt},${allowLate},${isGraded},${maxPoints},false,${user.id},NOW(),NOW())
      `;

      return NextResponse.json({ ok: true, discussionId: id }, { status: 201 });
    }

    if (body.action === "createPost") {
      const discussionId = body.discussionId?.trim() ?? "";
      const content = body.content?.trim() ?? "";
      const parentPostId = body.parentPostId?.trim() || null;
      if (!discussionId || !content) {
        return NextResponse.json({ error: "discussionId and content are required." }, { status: 400 });
      }

      const discussionRows = await prisma.$queryRaw<
        Array<{ id: string; courseId: string; isLocked: boolean; openAt: Date | null; closeAt: Date | null; allowLate: boolean; teacherId: string | null; visibility: string }>
      >`
        SELECT d."id", d."courseId", d."isLocked", d."openAt", d."closeAt", d."allowLate", c."teacherId", c."visibility"::text AS "visibility"
        FROM "EngagementDiscussion" d
        JOIN "Course" c ON c."id" = d."courseId"
        WHERE d."id" = ${discussionId}
        LIMIT 1
      `;
      const discussion = discussionRows[0];
      if (!discussion) {
        return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
      }

      const canManage = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && discussion.teacherId === user.id);
      if (user.role === Role.STUDENT) {
        const enrolled = await prisma.enrollment.count({ where: { courseId: discussion.courseId, studentId: user.id, status: "ACTIVE" } });
        if (!enrolled || discussion.visibility !== COURSE_VISIBILITY_PUBLISHED) {
          return NextResponse.json({ error: "You are not allowed to participate in this discussion." }, { status: 403 });
        }
      } else if (!canManage && user.role !== Role.TEACHER) {
        return NextResponse.json({ error: "You are not allowed to post in this discussion." }, { status: 403 });
      }

      const windowError = ensureOpenWindow(discussion, user.role);
      if (windowError && !canManage) {
        return NextResponse.json({ error: windowError }, { status: 400 });
      }

      if (parentPostId) {
        const parentRows = await prisma.$queryRaw<Array<{ id: string; discussionId: string; authorId: string; isDeleted: boolean }>>`
          SELECT "id", "discussionId", "authorId", "isDeleted"
          FROM "EngagementPost"
          WHERE "id" = ${parentPostId}
          LIMIT 1
        `;
        const parent = parentRows[0];
        if (!parent || parent.discussionId !== discussionId || parent.isDeleted) {
          return NextResponse.json({ error: "Invalid reply target." }, { status: 400 });
        }
        if (user.role === Role.STUDENT && parent.authorId === user.id) {
          return NextResponse.json({ error: "Reply must target a classmate post." }, { status: 400 });
        }
      } else if (user.role === Role.STUDENT) {
        const existingInitial = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "EngagementPost"
          WHERE "discussionId" = ${discussionId} AND "authorId" = ${user.id} AND "parentPostId" IS NULL AND "isDeleted" = false
          LIMIT 1
        `;
        if (existingInitial[0]) {
          return NextResponse.json({ error: "Initial post already submitted for this discussion." }, { status: 400 });
        }
      }

      const now = new Date();
      const isLate = !!(discussion.closeAt && now > discussion.closeAt);
      const lateByMinutes =
        isLate && discussion.closeAt
          ? Math.max(0, Math.floor((now.getTime() - discussion.closeAt.getTime()) / (1000 * 60)))
          : 0;

      const id = `dsp_${randomUUID()}`;
      await prisma.$executeRaw`
        INSERT INTO "EngagementPost"
          ("id","discussionId","authorId","parentPostId","content","isPinned","isDeleted","isLate","lateByMinutes","createdAt","updatedAt")
        VALUES
          (${id},${discussionId},${user.id},${parentPostId},${content},false,false,${isLate},${lateByMinutes},NOW(),NOW())
      `;

      return NextResponse.json({ ok: true, postId: id }, { status: 201 });
    }

    if (body.action === "toggleLock") {
      const discussionId = body.discussionId?.trim() ?? "";
      if (!discussionId || typeof body.isLocked !== "boolean") {
        return NextResponse.json({ error: "discussionId and isLocked are required." }, { status: 400 });
      }

      const rows = await prisma.$queryRaw<Array<{ id: string; teacherId: string | null }>>`
        SELECT d."id", c."teacherId"
        FROM "EngagementDiscussion" d
        JOIN "Course" c ON c."id" = d."courseId"
        WHERE d."id" = ${discussionId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
      }
      if (!isSuperAdminRole(user.role) && !(user.role === Role.TEACHER && row.teacherId === user.id)) {
        return NextResponse.json({ error: "Only admin or assigned teacher can lock discussions." }, { status: 403 });
      }

      await prisma.$executeRaw`
        UPDATE "EngagementDiscussion"
        SET "isLocked" = ${body.isLocked}, "updatedAt" = NOW()
        WHERE "id" = ${discussionId}
      `;
      await logModerationAction({
        discussionId,
        actorId: user.id,
        action: body.isLocked ? "LOCK_DISCUSSION" : "UNLOCK_DISCUSSION",
        details: { isLocked: body.isLocked },
      });

      return NextResponse.json({ ok: true, discussionId, isLocked: body.isLocked });
    }

    if (body.action === "pinPost") {
      const postId = body.postId?.trim() ?? "";
      if (!postId || typeof body.isPinned !== "boolean") {
        return NextResponse.json({ error: "postId and isPinned are required." }, { status: 400 });
      }

      const rows = await prisma.$queryRaw<Array<{ postId: string; teacherId: string | null; discussionId: string }>>`
        SELECT p."id" AS "postId", c."teacherId", d."id" AS "discussionId"
        FROM "EngagementPost" p
        JOIN "EngagementDiscussion" d ON d."id" = p."discussionId"
        JOIN "Course" c ON c."id" = d."courseId"
        WHERE p."id" = ${postId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }
      if (!isSuperAdminRole(user.role) && !(user.role === Role.TEACHER && row.teacherId === user.id)) {
        return NextResponse.json({ error: "Only admin or assigned teacher can pin posts." }, { status: 403 });
      }

      await prisma.$executeRaw`
        UPDATE "EngagementPost"
        SET "isPinned" = ${body.isPinned}, "updatedAt" = NOW()
        WHERE "id" = ${postId}
      `;
      await logModerationAction({
        discussionId: row.discussionId,
        postId,
        actorId: user.id,
        action: body.isPinned ? "PIN_POST" : "UNPIN_POST",
        details: { isPinned: body.isPinned },
      });
      return NextResponse.json({ ok: true, postId, isPinned: body.isPinned });
    }

    if (body.action === "deletePost") {
      const postId = body.postId?.trim() ?? "";
      if (!postId) {
        return NextResponse.json({ error: "postId is required." }, { status: 400 });
      }

      const rows = await prisma.$queryRaw<Array<{ postId: string; teacherId: string | null; discussionId: string }>>`
        SELECT p."id" AS "postId", c."teacherId", d."id" AS "discussionId"
        FROM "EngagementPost" p
        JOIN "EngagementDiscussion" d ON d."id" = p."discussionId"
        JOIN "Course" c ON c."id" = d."courseId"
        WHERE p."id" = ${postId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }
      if (!isSuperAdminRole(user.role) && !(user.role === Role.TEACHER && row.teacherId === user.id)) {
        return NextResponse.json({ error: "Only admin or assigned teacher can delete posts." }, { status: 403 });
      }

      await prisma.$executeRaw`
        UPDATE "EngagementPost"
        SET "isDeleted" = true, "updatedAt" = NOW()
        WHERE "id" = ${postId}
      `;
      await logModerationAction({
        discussionId: row.discussionId,
        postId,
        actorId: user.id,
        action: "DELETE_POST",
      });
      return NextResponse.json({ ok: true, postId });
    }

    if (body.action === "editPost") {
      const postId = body.postId?.trim() ?? "";
      const content = body.content?.trim() ?? "";
      if (!postId || !content) {
        return NextResponse.json({ error: "postId and content are required." }, { status: 400 });
      }

      const rows = await prisma.$queryRaw<Array<{ postId: string; authorId: string; teacherId: string | null; isLocked: boolean; openAt: Date | null; closeAt: Date | null; allowLate: boolean }>>`
        SELECT p."id" AS "postId", p."authorId", c."teacherId", d."isLocked", d."openAt", d."closeAt", d."allowLate"
        FROM "EngagementPost" p
        JOIN "EngagementDiscussion" d ON d."id" = p."discussionId"
        JOIN "Course" c ON c."id" = d."courseId"
        WHERE p."id" = ${postId}
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }

      const canModerate = isSuperAdminRole(user.role) || (user.role === Role.TEACHER && row.teacherId === user.id);
      const isOwner = row.authorId === user.id;
      if (!canModerate && !isOwner) {
        return NextResponse.json({ error: "You can only edit your own post." }, { status: 403 });
      }
      if (!canModerate) {
        const windowError = ensureOpenWindow(
          { openAt: row.openAt, closeAt: row.closeAt, allowLate: row.allowLate, isLocked: row.isLocked },
          user.role
        );
        if (windowError) {
          return NextResponse.json({ error: windowError }, { status: 400 });
        }
      }

      await prisma.$executeRaw`
        UPDATE "EngagementPost"
        SET "content" = ${content}, "updatedAt" = NOW()
        WHERE "id" = ${postId}
      `;

      return NextResponse.json({ ok: true, postId });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to process engagement action.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
