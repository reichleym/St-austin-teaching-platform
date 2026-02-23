import { GradeEditRequestStatus, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
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

    if (!assignmentId || !studentId || !reason) {
      return NextResponse.json({ error: "assignmentId, studentId, and reason are required." }, { status: 400 });
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
        proposedPoints: body.proposedPoints,
      },
    });

    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create grade edit request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
