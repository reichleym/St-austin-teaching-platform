// src/app/api/instructions/inbox/route.ts
import { NextResponse } from "next/server";
import { InstructionThreadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";
import { getDepartmentHeadAssignedCourseIds } from "@/lib/department-head-access";

const STAFF_ROLES = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"];
const INBOX_STATUSES: InstructionThreadStatus[] = [InstructionThreadStatus.OPEN, InstructionThreadStatus.ANSWERED];

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    if (!STAFF_ROLES.includes(String(user.role))) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const role = String(user.role);
    const departmentHeadCourseIds =
      role === "DEPARTMENT_HEAD" ? await getDepartmentHeadAssignedCourseIds(user.id) : [];

    const where =
      role === "SUPER_ADMIN"
        ? { status: { in: INBOX_STATUSES } }
        : role === "DEPARTMENT_HEAD"
          ? {
              courseId: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] },
              status: { in: INBOX_STATUSES },
            }
          : { course: { teacherId: user.id }, status: { in: INBOX_STATUSES } };

    const threads = await prisma.instructionThread.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        student: { select: { id: true, name: true, image: true } },
        course: { select: { id: true, title: true, code: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load inbox." },
      { status: 500 }
    );
  }
}
