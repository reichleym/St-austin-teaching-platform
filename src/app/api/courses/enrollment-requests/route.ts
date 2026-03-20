import { randomUUID } from "crypto";
import { Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { COURSE_VISIBILITY_PUBLISHED, isCourseExpired } from "@/lib/courses";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  courseId?: string;
};

type DecisionBody = {
  requestId?: string;
  decision?: "APPROVE" | "REJECT";
};

type EnrollmentRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

async function ensureEnrollmentRequestSchema() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "EnrollmentRequest" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "EnrollmentRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnrollmentRequest_course_student_pending_key"
  ON "EnrollmentRequest" ("courseId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "EnrollmentRequest_status_created_idx"
  ON "EnrollmentRequest" ("status", "createdAt");
  `);
}

function normalizeStatus(input: unknown): EnrollmentRequestStatus {
  if (input === "APPROVED" || input === "REJECTED" || input === "PENDING") return input;
  return "PENDING";
}

export async function GET() {
  try {
    await ensureEnrollmentRequestSchema();
    const user = await requireAuthenticatedUser();

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can view enrollment requests." }, { status: 403 });
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        courseId: string;
        studentId: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        reviewedById: string | null;
        reviewedAt: Date | null;
        courseCode: string;
        courseTitle: string;
        studentName: string | null;
        studentEmail: string;
      }>
    >`
      SELECT
        r."id",
        r."courseId",
        r."studentId",
        r."status",
        r."createdAt",
        r."updatedAt",
        r."reviewedById",
        r."reviewedAt",
        c."code" AS "courseCode",
        c."title" AS "courseTitle",
        u."name" AS "studentName",
        u."email" AS "studentEmail"
      FROM "EnrollmentRequest" r
      JOIN "Course" c ON c."id" = r."courseId"
      JOIN "User" u ON u."id" = r."studentId"
      ORDER BY
        CASE WHEN r."status" = 'PENDING' THEN 0 ELSE 1 END ASC,
        r."createdAt" DESC
    `;

    return NextResponse.json({
      requests: rows.map((row) => ({
        ...row,
        status: normalizeStatus(row.status),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load enrollment requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureEnrollmentRequestSchema();
    const user = await requireAuthenticatedUser();
    if (user.role !== Role.STUDENT) {
      return NextResponse.json({ error: "Only students can create enrollment requests." }, { status: 403 });
    }

    const body = (await request.json()) as CreateBody;
    const courseId = body.courseId?.trim() ?? "";
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const [course, student] = await Promise.all([
      prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, code: true, title: true, visibility: true, endDate: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, status: true },
      }),
    ]);

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (isCourseExpired(course.endDate ?? null)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }
    if (course.visibility !== COURSE_VISIBILITY_PUBLISHED) {
      return NextResponse.json({ error: "Only published courses can be requested." }, { status: 400 });
    }
    if (!student || student.role !== Role.STUDENT || student.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Student account is not eligible." }, { status: 400 });
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { courseId, studentId: user.id, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingEnrollment) {
      return NextResponse.json({ error: "You are already enrolled in this course." }, { status: 400 });
    }

    const existingPending = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "EnrollmentRequest"
      WHERE "courseId" = ${courseId} AND "studentId" = ${user.id} AND "status" = 'PENDING'
      LIMIT 1
    `;

    if (existingPending[0]) {
      return NextResponse.json({ error: "Enrollment request already pending." }, { status: 400 });
    }

    const requestId = `enr_${randomUUID()}`;
    await prisma.$executeRaw`
      INSERT INTO "EnrollmentRequest"
        ("id", "courseId", "studentId", "status", "createdAt", "updatedAt")
      VALUES
        (${requestId}, ${courseId}, ${user.id}, 'PENDING', NOW(), NOW())
    `;

    return NextResponse.json({
      ok: true,
      request: {
        id: requestId,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        studentId: user.id,
        status: "PENDING",
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create enrollment request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureEnrollmentRequestSchema();
    const user = await requireAuthenticatedUser();
    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can review requests." }, { status: 403 });
    }

    const body = (await request.json()) as DecisionBody;
    const requestId = body.requestId?.trim() ?? "";
    const decision = body.decision;

    if (!requestId || (decision !== "APPROVE" && decision !== "REJECT")) {
      return NextResponse.json({ error: "requestId and valid decision are required." }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        courseId: string;
        studentId: string;
        status: string;
        courseVisibility: string;
        studentStatus: string;
        courseEndDate: Date | null;
      }>
    >`
      SELECT
        r."id",
        r."courseId",
        r."studentId",
        r."status",
        c."visibility"::text AS "courseVisibility",
        c."endDate" AS "courseEndDate",
        u."status"::text AS "studentStatus"
      FROM "EnrollmentRequest" r
      JOIN "Course" c ON c."id" = r."courseId"
      JOIN "User" u ON u."id" = r."studentId"
      WHERE r."id" = ${requestId}
      LIMIT 1
    `;

    const existing = rows[0];
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (isCourseExpired(existing.courseEndDate ?? null)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Request already reviewed." }, { status: 400 });
    }

    if (decision === "APPROVE") {
      if (existing.courseVisibility !== COURSE_VISIBILITY_PUBLISHED) {
        return NextResponse.json({ error: "Course must be published before approval." }, { status: 400 });
      }
      if (existing.studentStatus !== "ACTIVE") {
        return NextResponse.json({ error: "Student account is not active." }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.enrollment.upsert({
          where: {
            courseId_studentId: {
              courseId: existing.courseId,
              studentId: existing.studentId,
            },
          },
          create: {
            courseId: existing.courseId,
            studentId: existing.studentId,
            status: "ACTIVE",
          },
          update: {
            status: "ACTIVE",
          },
        });

        await tx.$executeRaw`
          UPDATE "EnrollmentRequest"
          SET "status" = 'APPROVED', "updatedAt" = NOW(), "reviewedById" = ${user.id}, "reviewedAt" = NOW()
          WHERE "id" = ${requestId}
        `;
      });
    } else {
      await prisma.$executeRaw`
        UPDATE "EnrollmentRequest"
        SET "status" = 'REJECTED', "updatedAt" = NOW(), "reviewedById" = ${user.id}, "reviewedAt" = NOW()
        WHERE "id" = ${requestId}
      `;
    }

    return NextResponse.json({ ok: true, requestId, status: decision === "APPROVE" ? "APPROVED" : "REJECTED" });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to review enrollment request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
