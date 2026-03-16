import { EnrollmentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isTeacherRole } from "@/lib/courses";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CompletionBody = {
  courseId?: string;
  moduleId?: string;
  studentId?: string;
  completed?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const isSuperAdmin = isSuperAdminRole(user.role);
    const isTeacher = isTeacherRole(user.role);

    if (!isSuperAdmin && !isTeacher) {
      return NextResponse.json({ error: "Only admin or teacher can update completion." }, { status: 403 });
    }

    const body = (await request.json()) as CompletionBody;
    const courseIdInput = body.courseId?.trim() ?? "";
    const moduleId = body.moduleId?.trim() ?? "";
    const studentId = body.studentId?.trim() ?? "";
    const completed = body.completed ?? true;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }
    if (!courseIdInput && !moduleId) {
      return NextResponse.json({ error: "courseId or moduleId is required." }, { status: 400 });
    }
    if (courseIdInput && moduleId) {
      return NextResponse.json({ error: "Provide either courseId or moduleId, not both." }, { status: 400 });
    }

    let courseId = courseIdInput;
    let lessonIds: string[] = [];
    let teacherId: string | null = null;

    if (moduleId) {
      const moduleRecord = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { id: true, courseId: true, course: { select: { teacherId: true } } },
      });
      if (!moduleRecord) {
        return NextResponse.json({ error: "Module not found." }, { status: 404 });
      }
      courseId = moduleRecord.courseId;
      teacherId = moduleRecord.course.teacherId;

      const lessons = await prisma.lesson.findMany({
        where: { moduleId },
        select: { id: true },
      });
      lessonIds = lessons.map((lesson) => lesson.id);
    } else {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true },
      });
      if (!course) {
        return NextResponse.json({ error: "Course not found." }, { status: 404 });
      }
      teacherId = course.teacherId;

      const lessons = await prisma.lesson.findMany({
        where: { module: { courseId } },
        select: { id: true },
      });
      lessonIds = lessons.map((lesson) => lesson.id);
    }

    if (isTeacher && !isSuperAdmin && teacherId !== user.id) {
      return NextResponse.json({ error: "You can only update completion for your assigned courses." }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        courseId,
        studentId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Student is not actively enrolled in this course." }, { status: 400 });
    }

    if (!lessonIds.length) {
      return NextResponse.json({ error: "No lessons found to update completion." }, { status: 400 });
    }

    if (completed) {
      await prisma.lessonCompletion.createMany({
        data: lessonIds.map((lessonId) => ({ lessonId, studentId })),
        skipDuplicates: true,
      });
    } else {
      await prisma.lessonCompletion.deleteMany({
        where: { studentId, lessonId: { in: lessonIds } },
      });
    }

    return NextResponse.json({
      ok: true,
      courseId,
      moduleId: moduleId || null,
      studentId,
      completed,
      lessonCount: lessonIds.length,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update completion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
