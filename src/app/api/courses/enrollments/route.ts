import { EnrollmentStatus, Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  COURSE_VISIBILITY_PUBLISHED,
  type CourseVisibilityValue,
  parseEnrollmentStatus,
} from "@/lib/courses";
import { PermissionError, requireAuthenticatedUser, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type EnrollBody = {
  courseId?: string;
  studentId?: string;
};

type EnrollmentStatusBody = {
  courseId?: string;
  studentId?: string;
  status?: "ACTIVE" | "DROPPED" | "COMPLETED";
};

function isCourseSchemaCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown field `visibility`") ||
    error.message.includes("Unknown argument `visibility`") ||
    error.message.includes("Unknown field `startDate`") ||
    error.message.includes("Unknown argument `startDate`") ||
    error.message.includes("Unknown field `endDate`") ||
    error.message.includes("Unknown argument `endDate`") ||
    error.message.includes("column \"visibility\" does not exist") ||
    error.message.includes("column \"startDate\" does not exist") ||
    error.message.includes("column \"endDate\" does not exist") ||
    (error.message.includes("CourseVisibility") && error.message.includes("Invalid value for argument"))
  );
}

async function getCourseForEnrollment(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, title: true, startDate: true, endDate: true, visibility: true },
  });
  if (!course) {
    return { ok: false as const, status: 404, error: "Course not found." };
  }
  return { ok: true as const, course };
}

function ensureEnrollmentWindow(course: {
  startDate: Date | null;
  endDate: Date | null;
  visibility: CourseVisibilityValue;
}) {
  if (course.visibility !== COURSE_VISIBILITY_PUBLISHED) {
    return "Course must be published before enrollment.";
  }
  if (!course.startDate || !course.endDate) {
    return "Course schedule is incomplete.";
  }
  const now = new Date();
  if (now > course.endDate) {
    return "Cannot enroll students after course end date.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can enroll students." }, { status: 403 });
    }

    const body = (await request.json()) as EnrollBody;
    const courseId = body.courseId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";

    if (!courseId || !studentId) {
      return NextResponse.json({ error: "courseId and studentId are required." }, { status: 400 });
    }

    const courseResult = await getCourseForEnrollment(courseId);
    if (!courseResult.ok) {
      return NextResponse.json({ error: courseResult.error }, { status: courseResult.status });
    }
    const course = courseResult.course;

    const windowError = ensureEnrollmentWindow(course);
    if (windowError) {
      return NextResponse.json({ error: windowError }, { status: 400 });
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
        status: EnrollmentStatus.ACTIVE,
      },
      update: {
        status: EnrollmentStatus.ACTIVE,
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
        status: EnrollmentStatus.ACTIVE,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isCourseSchemaCompatibilityError(error)) {
      return NextResponse.json(
        {
          error:
            "Course schema is outdated in the database. Please run latest Prisma migrations and regenerate Prisma client.",
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to enroll student.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can update enrollment status." }, { status: 403 });
    }

    const body = (await request.json()) as EnrollmentStatusBody;
    const courseId = body.courseId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const status = parseEnrollmentStatus(body.status);

    if (!courseId || !studentId || !status) {
      return NextResponse.json({ error: "courseId, studentId, and status are required." }, { status: 400 });
    }

    const courseResult = await getCourseForEnrollment(courseId);
    if (!courseResult.ok) {
      return NextResponse.json({ error: courseResult.error }, { status: courseResult.status });
    }

    if (status === EnrollmentStatus.ACTIVE) {
      const windowError = ensureEnrollmentWindow(courseResult.course);
      if (windowError) {
        return NextResponse.json({ error: windowError }, { status: 400 });
      }
    }

    const updated = await prisma.enrollment.updateMany({
      where: { courseId, studentId },
      data: { status },
    });

    if (!updated.count) {
      return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, enrollment: { courseId, studentId, status } });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isCourseSchemaCompatibilityError(error)) {
      return NextResponse.json(
        {
          error:
            "Course schema is outdated in the database. Please run latest Prisma migrations and regenerate Prisma client.",
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to update enrollment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
