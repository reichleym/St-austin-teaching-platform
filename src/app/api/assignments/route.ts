import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, isSuperAdminRole, requireAuthenticatedUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateAssignmentBody = {
  courseId?: string;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
};

type UpdateAssignmentBody = {
  assignmentId?: string;
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  maxPoints?: number | string;
};

type DeleteAssignmentBody = {
  assignmentId?: string;
};

function parseOptionalDateTime(input: unknown) {
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseMaxPoints(input: unknown) {
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function canManageByRole(role: Role | string) {
  return isSuperAdminRole(role) || role === Role.TEACHER;
}

async function getAccessibleCourses(user: { id: string; role: Role | string }) {
  if (isSuperAdminRole(user.role)) {
    return prisma.course.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true, teacherId: true },
    });
  }

  if (user.role === Role.TEACHER) {
    return prisma.course.findMany({
      where: { teacherId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true, teacherId: true },
    });
  }

  return prisma.course.findMany({
    where: {
      enrollments: {
        some: {
          studentId: user.id,
          status: "ACTIVE",
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, code: true, title: true, teacherId: true },
  });
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();

    const courses = await getAccessibleCourses(user);
    const courseIds = courses.map((item) => item.id);

    const assignments = courseIds.length
      ? await prisma.assignment.findMany({
          where: { courseId: { in: courseIds } },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          include: {
            course: {
              select: { id: true, code: true, title: true, teacherId: true },
            },
          },
        })
      : [];

    return NextResponse.json({
      courses,
      assignments: assignments.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        title: item.title,
        description: item.description,
        dueAt: item.dueAt?.toISOString() ?? null,
        maxPoints: Number(item.maxPoints),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        course: item.course,
      })),
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load assignments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can create assignments." }, { status: 403 });
    }

    const body = (await request.json()) as CreateAssignmentBody;
    const courseId = body.courseId?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() || null;
    const dueAt = parseOptionalDateTime(body.dueAt);
    const maxPoints = parseMaxPoints(body.maxPoints) ?? 100;

    if (!courseId || !title) {
      return NextResponse.json({ error: "courseId and title are required." }, { status: 400 });
    }
    if (body.dueAt !== undefined && dueAt === undefined) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (user.role === Role.TEACHER && course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only create assignments for your assigned courses." }, { status: 403 });
    }

    const created = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description,
        dueAt: dueAt ?? null,
        maxPoints: new Prisma.Decimal(maxPoints),
      },
      include: {
        course: { select: { id: true, code: true, title: true, teacherId: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      assignment: {
        id: created.id,
        courseId: created.courseId,
        title: created.title,
        description: created.description,
        dueAt: created.dueAt?.toISOString() ?? null,
        maxPoints: Number(created.maxPoints),
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        course: created.course,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to create assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can update assignments." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateAssignmentBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: { select: { id: true, teacherId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (user.role === Role.TEACHER && existing.course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only update assignments in your assigned courses." }, { status: 403 });
    }

    const data: Prisma.AssignmentUpdateInput = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.dueAt !== undefined) {
      const dueAt = parseOptionalDateTime(body.dueAt);
      if (dueAt === undefined) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
      data.dueAt = dueAt;
    }
    if (body.maxPoints !== undefined) {
      const maxPoints = parseMaxPoints(body.maxPoints);
      if (!maxPoints) return NextResponse.json({ error: "maxPoints must be greater than 0." }, { status: 400 });
      data.maxPoints = new Prisma.Decimal(maxPoints);
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "At least one field is required to update." }, { status: 400 });
    }

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data,
      include: {
        course: { select: { id: true, code: true, title: true, teacherId: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      assignment: {
        id: updated.id,
        courseId: updated.courseId,
        title: updated.title,
        description: updated.description,
        dueAt: updated.dueAt?.toISOString() ?? null,
        maxPoints: Number(updated.maxPoints),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        course: updated.course,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to update assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    if (!canManageByRole(user.role)) {
      return NextResponse.json({ error: "Only admin/teacher can delete assignments." }, { status: 403 });
    }

    const body = (await request.json()) as DeleteAssignmentBody;
    const assignmentId = body.assignmentId?.trim() ?? "";
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
    }

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: { select: { teacherId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }
    if (user.role === Role.TEACHER && existing.course.teacherId !== user.id) {
      return NextResponse.json({ error: "You can only delete assignments in your assigned courses." }, { status: 403 });
    }

    await prisma.assignment.delete({ where: { id: assignmentId } });
    return NextResponse.json({ ok: true, assignmentId });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to delete assignment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
