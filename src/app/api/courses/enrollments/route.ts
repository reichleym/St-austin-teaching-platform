import { Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type EnrollBody = {
  courseId?: string;
  studentId?: string;
};

function isTeacherRole(role: Role | string | undefined | null) {
  return role === Role.TEACHER || role === "TEACHER";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const role = user.role;

    if (!isSuperAdminRole(role) && !isTeacherRole(role)) {
      return NextResponse.json({ error: "Only Super Admin and Teacher can enroll students." }, { status: 403 });
    }

    const body = (await request.json()) as EnrollBody;
    const courseId = body.courseId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";

    if (!courseId || !studentId) {
      return NextResponse.json({ error: "courseId and studentId are required." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, title: true, teacherId: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    if (isTeacherRole(role) && course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only enroll students in your own courses." }, { status: 403 });
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, status: true, name: true, email: true },
    });

    if (!student || student.role !== Role.STUDENT || student.status !== UserStatus.ACTIVE) {
      return NextResponse.json({ error: "Student is not active or not found." }, { status: 400 });
    }

    await prisma.enrollment.upsert({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
      create: {
        courseId,
        studentId,
        status: "ACTIVE",
      },
      update: {
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      ok: true,
      enrollment: {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to enroll student.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
