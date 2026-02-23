import { GradeEditRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { PermissionError, requireSuperAdminUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireSuperAdminUser();
    const requests = await prisma.gradeEditRequest.findMany({
      where: { status: GradeEditRequestStatus.PENDING },
      orderBy: { createdAt: "asc" },
      include: {
        assignment: { select: { id: true, title: true, courseId: true } },
        student: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load grade edit requests.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
