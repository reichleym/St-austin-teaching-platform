import { randomUUID } from "crypto";
import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isCourseExpired } from "@/lib/courses";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function ensureMessageSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "DepartmentHeadMessage" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "departmentHeadId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "DepartmentHeadMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DepartmentHeadMessage_teacher_idx" ON "DepartmentHeadMessage"("teacherId","createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentHeadMessage_head_idx" ON "DepartmentHeadMessage"("departmentHeadId","createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentHeadMessage_course_idx" ON "DepartmentHeadMessage"("courseId","createdAt");
  `);
}

async function ensureDepartmentHeadCourseSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "DepartmentHeadCourseAssignment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "departmentHeadId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentHeadCourseAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHeadCourseAssignment_course_head_key"
  ON "DepartmentHeadCourseAssignment"("courseId","departmentHeadId");
CREATE INDEX IF NOT EXISTS "DepartmentHeadCourseAssignment_head_idx"
  ON "DepartmentHeadCourseAssignment"("departmentHeadId","createdAt");
  `);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    await ensureMessageSchema();
    await ensureDepartmentHeadCourseSchema();

    if (user.role === Role.TEACHER) {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          courseId: string;
          courseTitle: string;
          departmentHeadId: string;
          departmentHeadName: string | null;
          departmentHeadEmail: string;
          subject: string;
          body: string;
          createdAt: Date;
          readAt: Date | null;
        }>
      >`
        SELECT m."id", m."courseId", c."title" AS "courseTitle",
               m."departmentHeadId", u."name" AS "departmentHeadName", u."email" AS "departmentHeadEmail",
               m."subject", m."body", m."createdAt", m."readAt"
        FROM "DepartmentHeadMessage" m
        JOIN "Course" c ON c."id" = m."courseId"
        JOIN "User" u ON u."id" = m."departmentHeadId"
        WHERE m."teacherId" = ${user.id}
        ORDER BY m."createdAt" DESC
      `;

      return NextResponse.json({
        messages: rows.map((row) => ({
          id: row.id,
          courseId: row.courseId,
          courseTitle: row.courseTitle,
          senderId: row.departmentHeadId,
          senderName: row.departmentHeadName,
          senderEmail: row.departmentHeadEmail,
          subject: row.subject,
          body: row.body,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString() ?? null,
        })),
      });
    }

    if (user.role === Role.DEPARTMENT_HEAD || isSuperAdminRole(user.role)) {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          courseId: string;
          courseTitle: string;
          teacherId: string;
          teacherName: string | null;
          teacherEmail: string;
          subject: string;
          body: string;
          createdAt: Date;
          readAt: Date | null;
        }>
      >`
        SELECT m."id", m."courseId", c."title" AS "courseTitle",
               m."teacherId", t."name" AS "teacherName", t."email" AS "teacherEmail",
               m."subject", m."body", m."createdAt", m."readAt"
        FROM "DepartmentHeadMessage" m
        JOIN "Course" c ON c."id" = m."courseId"
        JOIN "User" t ON t."id" = m."teacherId"
        WHERE m."departmentHeadId" = ${user.id}
        ORDER BY m."createdAt" DESC
      `;

      return NextResponse.json({
        messages: rows.map((row) => ({
          id: row.id,
          courseId: row.courseId,
          courseTitle: row.courseTitle,
          recipientId: row.teacherId,
          recipientName: row.teacherName,
          recipientEmail: row.teacherEmail,
          subject: row.subject,
          body: row.body,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString() ?? null,
        })),
      });
    }

    return NextResponse.json({ error: "Not authorized to view messages." }, { status: 403 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load messages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    await ensureMessageSchema();
    await ensureDepartmentHeadCourseSchema();

    if (user.role !== Role.DEPARTMENT_HEAD && !isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only department heads can send messages." }, { status: 403 });
    }

    const body = (await request.json()) as {
      action?: "send";
      courseId?: string;
      subject?: string;
      body?: string;
    };

    if (body.action && body.action !== "send") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const courseId = body.courseId?.trim() ?? "";
    const subject = body.subject?.trim() ?? "";
    const messageBody = body.body?.trim() ?? "";

    if (!courseId || !subject || !messageBody) {
      return NextResponse.json({ error: "courseId, subject, and message are required." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, endDate: true },
    });
    if (!course || !course.teacherId) {
      return NextResponse.json({ error: "Course teacher not found." }, { status: 400 });
    }
    if (isCourseExpired(course.endDate ?? null)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }

    if (user.role === Role.DEPARTMENT_HEAD) {
      const assigned = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(
          SELECT 1
          FROM "DepartmentHeadCourseAssignment"
          WHERE "courseId" = ${courseId} AND "departmentHeadId" = ${user.id}
        ) AS "exists"
      `;
      if (!assigned[0]?.exists) {
        return NextResponse.json({ error: "You are not assigned to this course." }, { status: 403 });
      }
    }

    const id = `dhm_${randomUUID()}`;
    await prisma.$executeRaw`
      INSERT INTO "DepartmentHeadMessage"
        ("id","courseId","departmentHeadId","teacherId","subject","body","createdAt")
      VALUES
        (${id}, ${courseId}, ${user.id}, ${course.teacherId}, ${subject}, ${messageBody}, NOW())
    `;

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to send message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    await ensureMessageSchema();

    if (user.role !== Role.TEACHER) {
      return NextResponse.json({ error: "Only teachers can update messages." }, { status: 403 });
    }

    const body = (await request.json()) as { messageId?: string };
    const messageId = body.messageId?.trim() ?? "";
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required." }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "DepartmentHeadMessage"
      SET "readAt" = NOW()
      WHERE "id" = ${messageId} AND "teacherId" = ${user.id}
    `;

    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
