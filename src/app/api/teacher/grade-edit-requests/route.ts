import { GradeEditRequestStatus, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

async function ensureGovernanceSchema() {
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

export async function POST(request: NextRequest) {
  try {
    await ensureGovernanceSchema();
    const user = await requireAuthenticatedUser();
    if (user.role !== Role.TEACHER) {
      return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
    }

    const body = (await request.json()) as {
      assignmentId?: string;
      studentId?: string;
      reason?: string;
      proposedPoints?: number;
    };

    const assignmentId = body.assignmentId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const reason = body.reason?.trim() ?? "";
    const proposedPoints = body.proposedPoints;

    if (!assignmentId || !studentId || !reason || proposedPoints == null) {
      return NextResponse.json({ error: "assignmentId, studentId, reason, and proposedPoints are required." }, { status: 400 });
    }

    if (
      !Number.isFinite(proposedPoints) ||
      proposedPoints < 0 ||
      proposedPoints > 9999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(proposedPoints.toString())
    ) {
      return NextResponse.json(
        { error: "proposedPoints must be a non-negative number with up to 2 decimal places (max 9999.99)." },
        { status: 400 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, course: { select: { teacherId: true } } },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (assignment.course.teacherId !== user.id) {
      return NextResponse.json({ error: "Cannot request grade edit outside your courses." }, { status: 403 });
    }

    const publishedGrade = await prisma.grade.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
      select: { id: true, publishedAt: true, points: true },
    });
    if (!publishedGrade?.publishedAt) {
      return NextResponse.json(
        { error: "Grade edit requests are only allowed for published grades." },
        { status: 400 }
      );
    }

    const existingPending = await prisma.gradeEditRequest.findFirst({
      where: {
        assignmentId,
        studentId,
        status: GradeEditRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json({ error: "A pending request already exists for this student/assignment." }, { status: 409 });
    }

    const created = await prisma.gradeEditRequest.create({
      data: {
        assignmentId,
        studentId,
        requestedById: user.id,
        reason,
        proposedPoints,
      },
    });

    const publishedSubmission = await prisma.$queryRaw<
      Array<{
        id: string;
        rawScore: number | null;
        finalScore: number | null;
        status: string;
      }>
    >`
      SELECT "id","rawScore","finalScore","status"
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${assignmentId}
        AND "studentId" = ${studentId}
        AND "status" IN ('GRADE_PUBLISHED','GRADE_EDIT_APPROVED','GRADE_EDIT_REJECTED')
      ORDER BY "publishedAt" DESC NULLS LAST, "submittedAt" DESC
      LIMIT 1
    `;
    const submission = publishedSubmission[0];
    if (submission) {
      await prisma.$executeRaw`
        UPDATE "AssignmentSubmission"
        SET "status" = ${"GRADE_EDIT_REQUESTED"}
        WHERE "id" = ${submission.id}
      `;
      const historyId = `gh_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      await prisma.$executeRaw`
        INSERT INTO "GradeHistory"
          ("id","assignmentId","studentId","submissionId","actorId","action","oldRawScore","newRawScore","oldFinalScore","newFinalScore","oldState","newState","reason","metadata")
        VALUES
          (${historyId}, ${assignmentId}, ${studentId}, ${submission.id}, ${user.id}, ${"GRADE_EDIT_REQUESTED"}, ${submission.rawScore}, ${submission.rawScore}, ${submission.finalScore}, ${submission.finalScore}, ${submission.status}, ${"GRADE_EDIT_REQUESTED"}, ${reason}, ${JSON.stringify({ proposedPoints })}::jsonb)
      `;
    }

    const adminRecipients = await prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, status: "ACTIVE" },
      select: { id: true },
      take: 20,
    });
    for (const admin of adminRecipients) {
      const notificationId = `ntf_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      await prisma.$executeRaw`
        INSERT INTO "NotificationEvent" ("id","recipientId","type","title","message","metadata")
        VALUES (
          ${notificationId},
          ${admin.id},
          ${"GRADE_EDIT_REQUESTED"},
          ${"Grade edit request pending"},
          ${"A teacher submitted a grade edit request requiring review."},
          ${JSON.stringify({ assignmentId, studentId, requestId: created.id })}::jsonb
        )
      `;
    }

    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create grade edit request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
