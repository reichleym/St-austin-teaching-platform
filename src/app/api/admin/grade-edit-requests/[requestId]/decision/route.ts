import { AdminActionType, GradeEditRequestStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Decision = "APPROVE" | "REJECT";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
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
