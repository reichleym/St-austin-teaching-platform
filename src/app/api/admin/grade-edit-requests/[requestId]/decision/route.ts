import { AdminActionType, GradeEditRequestStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Decision = "APPROVE" | "REJECT";

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    await ensureGovernanceSchema();
    const superAdmin = await requireSuperAdminUser();
    const { requestId } = await params;
    const body = (await request.json()) as {
      decision?: Decision;
      reviewNote?: string;
      approvedPoints?: number;
    };

    if (body.decision !== "APPROVE" && body.decision !== "REJECT") {
      return NextResponse.json({ error: "decision must be APPROVE or REJECT." }, { status: 400 });
    }
    if (body.approvedPoints !== undefined && (!Number.isFinite(body.approvedPoints) || body.approvedPoints < 0)) {
      return NextResponse.json({ error: "approvedPoints must be a non-negative number." }, { status: 400 });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const requestRecord = await tx.gradeEditRequest.findUnique({
        where: { id: requestId },
        include: { assignment: true, student: true },
      });

      if (!requestRecord) {
        return { status: 404 as const, payload: { error: "Grade edit request not found." } };
      }

      if (requestRecord.status !== GradeEditRequestStatus.PENDING) {
        return {
          status: 409 as const,
          payload: { error: `Request already ${requestRecord.status.toLowerCase()}.` },
        };
      }

      const nextStatus =
        body.decision === "APPROVE" ? GradeEditRequestStatus.APPROVED : GradeEditRequestStatus.REJECTED;
      const updatedRequest = await tx.gradeEditRequest.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          reviewedById: superAdmin.id,
          reviewedAt: now,
        },
      });

      if (body.decision === "APPROVE") {
        const existingGrade = await tx.grade.findUnique({
          where: {
            assignmentId_studentId: {
              assignmentId: requestRecord.assignmentId,
              studentId: requestRecord.studentId,
            },
          },
        });

        const points = body.approvedPoints ?? requestRecord.proposedPoints ?? existingGrade?.points;
        if (points == null) {
          return {
            status: 400 as const,
            payload: { error: "No grade value available. Provide `approvedPoints`." },
          };
        }

        await tx.grade.upsert({
          where: {
            assignmentId_studentId: {
              assignmentId: requestRecord.assignmentId,
              studentId: requestRecord.studentId,
            },
          },
          create: {
            assignmentId: requestRecord.assignmentId,
            studentId: requestRecord.studentId,
            points,
            publishedAt: now,
          },
          update: {
            points,
            publishedAt: now,
          },
        });

        const submissionRows = await tx.$queryRaw<
          Array<{ id: string; rawScore: number | null; finalScore: number | null; status: string }>
        >`
          SELECT "id","rawScore","finalScore","status"
          FROM "AssignmentSubmission"
          WHERE "assignmentId" = ${requestRecord.assignmentId}
            AND "studentId" = ${requestRecord.studentId}
            AND "status" = ${"GRADE_EDIT_REQUESTED"}
          ORDER BY "publishedAt" DESC NULLS LAST, "submittedAt" DESC
          LIMIT 1
        `;
        const submission = submissionRows[0];
        if (submission) {
          await tx.$executeRaw`
            UPDATE "AssignmentSubmission"
            SET
              "rawScore" = ${Number(points)},
              "finalScore" = ${Number(points)},
              "feedback" = COALESCE("feedback", ${"Grade adjusted after admin-approved edit request."}),
              "status" = ${"GRADE_EDIT_APPROVED"},
              "gradedAt" = NOW(),
              "publishedAt" = NOW()
            WHERE "id" = ${submission.id}
          `;
          const historyId = `gh_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
          await tx.$executeRaw`
            INSERT INTO "GradeHistory"
              ("id","assignmentId","studentId","submissionId","actorId","action","oldRawScore","newRawScore","oldFinalScore","newFinalScore","oldState","newState","reason","metadata")
            VALUES
              (${historyId}, ${requestRecord.assignmentId}, ${requestRecord.studentId}, ${submission.id}, ${superAdmin.id}, ${"GRADE_EDIT_APPROVED"}, ${submission.rawScore}, ${Number(points)}, ${submission.finalScore}, ${Number(points)}, ${submission.status}, ${"GRADE_EDIT_APPROVED"}, ${body.reviewNote?.trim() || requestRecord.reason}, ${JSON.stringify({ requestId: requestRecord.id, approvedPoints: Number(points) })}::jsonb)
          `;
        }

        await tx.adminActionLog.create({
          data: {
            action: AdminActionType.APPROVE_GRADE_EDIT_REQUEST,
            actorId: superAdmin.id,
            targetUserId: requestRecord.studentId,
            entityType: "Grade",
            entityId: `${requestRecord.assignmentId}:${requestRecord.studentId}`,
            metadata: {
              assignmentId: requestRecord.assignmentId,
              previousPoints: existingGrade?.points ?? null,
              nextPoints: points,
              reviewedAt: now.toISOString(),
              reviewNote: body.reviewNote?.trim() || null,
            },
          },
        });
      }
      if (body.decision === "REJECT") {
        const submissionRows = await tx.$queryRaw<
          Array<{ id: string; rawScore: number | null; finalScore: number | null; status: string }>
        >`
          SELECT "id","rawScore","finalScore","status"
          FROM "AssignmentSubmission"
          WHERE "assignmentId" = ${requestRecord.assignmentId}
            AND "studentId" = ${requestRecord.studentId}
            AND "status" = ${"GRADE_EDIT_REQUESTED"}
          ORDER BY "publishedAt" DESC NULLS LAST, "submittedAt" DESC
          LIMIT 1
        `;
        const submission = submissionRows[0];
        if (submission) {
          await tx.$executeRaw`
            UPDATE "AssignmentSubmission"
            SET "status" = ${"GRADE_EDIT_REJECTED"}
            WHERE "id" = ${submission.id}
          `;
          const historyId = `gh_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
          await tx.$executeRaw`
            INSERT INTO "GradeHistory"
              ("id","assignmentId","studentId","submissionId","actorId","action","oldRawScore","newRawScore","oldFinalScore","newFinalScore","oldState","newState","reason","metadata")
            VALUES
              (${historyId}, ${requestRecord.assignmentId}, ${requestRecord.studentId}, ${submission.id}, ${superAdmin.id}, ${"GRADE_EDIT_REJECTED"}, ${submission.rawScore}, ${submission.rawScore}, ${submission.finalScore}, ${submission.finalScore}, ${submission.status}, ${"GRADE_EDIT_REJECTED"}, ${body.reviewNote?.trim() || requestRecord.reason}, ${JSON.stringify({ requestId: requestRecord.id })}::jsonb)
          `;
        }
      }

      await tx.adminActionLog.create({
        data: {
          action:
            body.decision === "APPROVE"
              ? AdminActionType.APPROVE_GRADE_EDIT_REQUEST
              : AdminActionType.REJECT_GRADE_EDIT_REQUEST,
          actorId: superAdmin.id,
          targetUserId: requestRecord.studentId,
          entityType: "GradeEditRequest",
          entityId: requestRecord.id,
          metadata: {
            assignmentId: requestRecord.assignmentId,
            reviewedAt: now.toISOString(),
            reviewNote: body.reviewNote?.trim() || null,
            approvedPoints: body.approvedPoints ?? null,
          },
        },
      });

      const notifyTeacherId = requestRecord.requestedById;
      const notifyStudentId = requestRecord.studentId;
      const teacherNotificationId = `ntf_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      const studentNotificationId = `ntf_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      const decisionLabel = body.decision === "APPROVE" ? "approved" : "rejected";
      await tx.$executeRaw`
        INSERT INTO "NotificationEvent" ("id","recipientId","type","title","message","metadata")
        VALUES
          (${teacherNotificationId}, ${notifyTeacherId}, ${"GRADE_EDIT_DECISION"}, ${"Grade edit request reviewed"}, ${`Your grade edit request was ${decisionLabel}.`}, ${JSON.stringify({ requestId: requestRecord.id, decision: body.decision })}::jsonb),
          (${studentNotificationId}, ${notifyStudentId}, ${"GRADE_EDIT_DECISION"}, ${"Grade update review completed"}, ${`A grade edit review for your assignment was ${decisionLabel}.`}, ${JSON.stringify({ requestId: requestRecord.id, decision: body.decision })}::jsonb)
      `;

      return { status: 200 as const, payload: { ok: true, request: updatedRequest } };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to process decision.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
