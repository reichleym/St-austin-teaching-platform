import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuthenticatedUser, PermissionError, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ submissionId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser();
    const { submissionId } = await params;

    if (!submissionId?.trim()) {
      return NextResponse.json({ error: "submissionId is required." }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        fileUrl: string | null;
        fileName: string | null;
        mimeType: string | null;
        studentId: string;
        teacherId: string | null;
      }>
    >`
      SELECT
        s."id",
        s."fileUrl",
        s."fileName",
        s."mimeType",
        s."studentId",
        c."teacherId"
      FROM "AssignmentSubmission" s
      JOIN "Assignment" a ON a."id" = s."assignmentId"
      JOIN "Course" c ON c."id" = a."courseId"
      WHERE s."id" = ${submissionId}
      LIMIT 1
    `;
    const submission = rows[0];

    if (!submission || !submission.fileUrl) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const isSuperAdmin = isSuperAdminRole(user.role);
    const isTeacher = user.role === Role.TEACHER;
    const isOwner = user.role === Role.STUDENT && submission.studentId === user.id;
    const isTeacherOwner = isTeacher && submission.teacherId === user.id;

    if (!isSuperAdmin && !isOwner && !isTeacherOwner) {
      return NextResponse.json({ error: "You do not have access to this file." }, { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(submission.fileUrl, { headers });

    if (!response.ok) {
      return NextResponse.json({ error: "Unable to retrieve file." }, { status: 502 });
    }

    const contentType = submission.mimeType || response.headers.get("content-type") || "application/octet-stream";
    const filename = submission.fileName || "submission";
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to download file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
