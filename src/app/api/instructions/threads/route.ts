// src/app/api/instructions/threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isCourseExpired } from "@/lib/courses";
import { PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const courseId = request.nextUrl.searchParams.get("courseId")?.trim();

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const where =
      user.role === Role.STUDENT
        ? { courseId, OR: [{ studentId: user.id }, { isPrivate: false }] }
        : { courseId };

    const threads = await prisma.instructionThread.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        student: { select: { id: true, name: true, image: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { messages: true } }
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load threads." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    if (user.role !== Role.STUDENT) {
      return NextResponse.json({ error: "Only students can open threads." }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, moduleId, subject, body: messageBody, isPrivate = true } = body as {
      courseId?: string;
      moduleId?: string;
      subject?: string;
      body?: string;
      isPrivate?: boolean;
    };

    if (!courseId?.trim()) return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    if (!subject?.trim()) return NextResponse.json({ error: "subject is required." }, { status: 400 });
    if (!messageBody?.trim()) return NextResponse.json({ error: "message body is required." }, { status: 400 });

    const course = await prisma.course.findUnique({
      where: { id: courseId.trim() },
      select: { endDate: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (isCourseExpired(course.endDate)) {
      return NextResponse.json({ error: "Course is expired and read-only." }, { status: 403 });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: user.id } },
      select: { status: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      return NextResponse.json({ error: "You are not enrolled in this course." }, { status: 403 });
    }

    const thread = await prisma.instructionThread.create({
      data: {
        studentId: user.id,
        courseId,
        moduleId: moduleId || null,
        subject: subject.trim(),
        status: "OPEN",
        isPrivate: Boolean(isPrivate),
        messages: {
          create: {
            authorId: user.id,
            body: messageBody.trim(),
            isTeacherReply: false,
            parentId: null,
          },
        },
      },
      include: {
        student: { select: { id: true, name: true, image: true } },
        module: { select: { id: true, title: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread." },
      { status: 500 }
    );
  }
}
