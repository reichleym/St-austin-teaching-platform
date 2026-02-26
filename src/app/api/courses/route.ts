import { Prisma, Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PermissionError, requireAuthenticatedUser, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  code?: string;
  title?: string;
  description?: string | null;
  teacherId?: string | null;
};

function normalizeCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

function isTeacherRole(role: Role | string | undefined | null) {
  return role === Role.TEACHER || role === "TEACHER";
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const role = user.role;

    const courseWhere: Prisma.CourseWhereInput = isSuperAdminRole(role)
      ? {}
      : isTeacherRole(role)
        ? { teacherId: user.id }
        : { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } };

    const enrollmentWhere: Prisma.EnrollmentWhereInput | undefined = isSuperAdminRole(role)
      ? undefined
      : isTeacherRole(role)
        ? { status: "ACTIVE" }
        : { studentId: user.id };

    const courses = await prisma.course.findMany({
      where: courseWhere,
      orderBy: [{ createdAt: "desc" }],
      include: {
        teacher: {
          select: { id: true, name: true, email: true, status: true },
        },
        assignments: { select: { id: true } },
        enrollments: {
          where: enrollmentWhere,
          select: { id: true, studentId: true, status: true },
        },
      },
    });

    const teachers = isSuperAdminRole(role)
      ? await prisma.user.findMany({
          where: { role: Role.TEACHER, status: UserStatus.ACTIVE },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
        })
      : [];

    const students = isSuperAdminRole(role) || isTeacherRole(role)
      ? await prisma.user.findMany({
          where: { role: Role.STUDENT, status: UserStatus.ACTIVE },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
        })
      : [];

    return NextResponse.json({
      courses: courses.map((course) => {
        const myEnrollment = course.enrollments.find((item) => item.studentId === user.id) ?? null;
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description,
          createdAt: course.createdAt.toISOString(),
          teacher: course.teacher
            ? {
                id: course.teacher.id,
                name: course.teacher.name,
                email: course.teacher.email,
                status: course.teacher.status,
              }
            : null,
          assignmentCount: course.assignments.length,
          enrollmentCount: course.enrollments.filter((item) => item.status === "ACTIVE").length,
          myEnrollmentStatus: myEnrollment?.status ?? null,
        };
      }),
      teachers,
      students,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load courses.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const role = user.role;

    if (!isSuperAdminRole(role) && !isTeacherRole(role)) {
      return NextResponse.json({ error: "Only Super Admin and Teacher can create courses." }, { status: 403 });
    }

    const body = (await request.json()) as CreateBody;
    const code = normalizeCode(body.code ?? "");
    const title = body.title?.trim() ?? "";
    const description = typeof body.description === "string" ? body.description.trim() || null : null;

    if (!code || !title) {
      return NextResponse.json({ error: "Course code and title are required." }, { status: 400 });
    }

    if (code.length < 2 || code.length > 24) {
      return NextResponse.json({ error: "Course code must be between 2 and 24 characters." }, { status: 400 });
    }

    let teacherId: string | null = null;
    if (isTeacherRole(role)) {
      teacherId = user.id;
    } else if (typeof body.teacherId === "string" && body.teacherId.trim()) {
      teacherId = body.teacherId.trim();
    }

    if (teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { id: true, role: true, status: true },
      });

      if (!teacher || teacher.role !== Role.TEACHER || teacher.status !== UserStatus.ACTIVE) {
        return NextResponse.json({ error: "Selected teacher is not active or not found." }, { status: 400 });
      }
    }

    const created = await prisma.course.create({
      data: {
        code,
        title,
        description,
        teacherId,
      },
      include: {
        teacher: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        course: {
          id: created.id,
          code: created.code,
          title: created.title,
          description: created.description,
          createdAt: created.createdAt.toISOString(),
          teacher: created.teacher,
          assignmentCount: 0,
          enrollmentCount: 0,
          myEnrollmentStatus: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Course code already exists." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unable to create course.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
