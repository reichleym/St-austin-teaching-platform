import { Prisma, Role, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  COURSE_VISIBILITY_DRAFT,
  COURSE_VISIBILITY_PUBLISHED,
  type CourseVisibilityValue,
  COURSE_DESCRIPTION_MAX_LENGTH,
  generateCourseCodeCandidate,
  isTeacherRole,
  normalizeDescription,
  parseCourseDateInput,
  parseCourseVisibility,
  validateCourseDuration,
  validateCourseTitle,
} from "@/lib/courses";
import { PermissionError, requireAuthenticatedUser, isSuperAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  title?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  visibility?: CourseVisibilityValue;
  teacherId?: string | null;
  studentIds?: string[];
};

type UpdateBody = {
  courseId?: string;
  title?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  visibility?: CourseVisibilityValue;
  teacherId?: string | null;
  studentIds?: string[];
};

type DeleteBody = {
  courseId?: string;
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

function getCourseAccessState(input: {
  visibility: CourseVisibilityValue;
  startDate: Date | null;
  endDate: Date | null;
}) {
  if (input.visibility === COURSE_VISIBILITY_DRAFT) return "DRAFT";
  if (!input.startDate || !input.endDate) return "SCHEDULED";
  const now = new Date();
  if (now < input.startDate) return "LOCKED";
  if (now > input.endDate) return "READ_ONLY";
  return "ACTIVE";
}

async function ensureTeacherIfProvided(teacherId: string | null) {
  if (!teacherId) return null;
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, status: true },
  });

  if (!teacher || teacher.role !== Role.TEACHER || teacher.status !== UserStatus.ACTIVE) {
    return { ok: false as const, status: 400, error: "Selected teacher is not active or not found." };
  }

  return { ok: true as const, teacherId: teacher.id };
}

async function hasTimelineOverlap(params: {
  teacherId: string;
  startDate: Date;
  endDate: Date;
  excludeCourseId?: string;
}) {
  const overlap = await prisma.course.findFirst({
    where: {
      teacherId: params.teacherId,
      ...(params.excludeCourseId ? { id: { not: params.excludeCourseId } } : {}),
      startDate: { lte: params.endDate },
      endDate: { gte: params.startDate },
    },
    select: { id: true, code: true, title: true },
  });

  return overlap;
}

async function canManageCourse(courseId: string, user: { id: string; role: Role | string }) {
  let course:
    | {
        id: string;
        teacherId: string | null;
        startDate: Date | null;
        endDate: Date | null;
        visibility: CourseVisibilityValue;
        legacySchema: boolean;
      }
    | null = null;

  try {
    const result = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true, startDate: true, endDate: true, visibility: true },
    });
    course = result ? { ...result, legacySchema: false } : null;
  } catch (error) {
    if (!isCourseSchemaCompatibilityError(error)) throw error;
    const legacy = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, teacherId: true },
    });
    course = legacy
      ? {
          ...legacy,
          startDate: null,
          endDate: null,
          visibility: COURSE_VISIBILITY_PUBLISHED,
          legacySchema: true,
        }
      : null;
  }

  if (!course) {
    return { ok: false as const, status: 404, error: "Course not found." };
  }

  if (isSuperAdminRole(user.role)) {
    return { ok: true as const, course };
  }

  if (isTeacherRole(user.role) && course.teacherId === user.id) {
    return { ok: true as const, course };
  }

  return { ok: false as const, status: 403, error: "You can only manage your own courses." };
}

async function generateUniqueCourseCode(title: string) {
  for (let nonce = 1; nonce <= 9999; nonce += 1) {
    const code = generateCourseCodeCandidate(title, nonce);
    const existing = await prisma.course.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Unable to generate a unique course code.");
}

async function validateStudentIds(studentIds: string[]) {
  const normalized = Array.from(
    new Set(studentIds.map((item) => item.trim()).filter(Boolean))
  );
  if (!normalized.length) {
    return { ok: true as const, ids: [] as string[] };
  }

  const matched = await prisma.user.findMany({
    where: { id: { in: normalized }, role: Role.STUDENT, status: UserStatus.ACTIVE },
    select: { id: true },
  });

  if (matched.length !== normalized.length) {
    return { ok: false as const, status: 400, error: "One or more selected students are invalid or inactive." };
  }

  return { ok: true as const, ids: normalized };
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const role = user.role;

    const courseWhere: Prisma.CourseWhereInput = isSuperAdminRole(role)
      ? {}
      : isTeacherRole(role)
        ? { teacherId: user.id }
        : {
            visibility: COURSE_VISIBILITY_PUBLISHED,
            enrollments: { some: { studentId: user.id, status: "ACTIVE" } },
          };

    const enrollmentWhere: Prisma.EnrollmentWhereInput | undefined = isSuperAdminRole(role)
      ? undefined
      : isTeacherRole(role)
        ? { status: "ACTIVE" }
        : { studentId: user.id };

    const teachers = isSuperAdminRole(role)
      ? await prisma.user.findMany({
          where: { role: Role.TEACHER, status: UserStatus.ACTIVE },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
        })
      : [];

    const students = isSuperAdminRole(role)
      ? await prisma.user.findMany({
          where: { role: Role.STUDENT, status: UserStatus.ACTIVE },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
        })
      : [];

    let courses: Array<{
      id: string;
      code: string;
      title: string;
      description: string | null;
      startDate: Date | null;
      endDate: Date | null;
      visibility: CourseVisibilityValue;
      createdAt: Date;
      teacher: { id: string; name: string | null; email: string; status: UserStatus } | null;
      assignments: Array<{ id: string }>;
      enrollments: Array<{
        id: string;
        studentId: string;
        status: "ACTIVE" | "DROPPED" | "COMPLETED";
        student: { id: string; name: string | null; email: string } | null;
      }>;
    }> = [];

    try {
      courses = await prisma.course.findMany({
        where: courseWhere,
        orderBy: [{ createdAt: "desc" }],
        include: {
          teacher: {
            select: { id: true, name: true, email: true, status: true },
          },
          assignments: { select: { id: true } },
          enrollments: {
            where: enrollmentWhere,
            select: {
              id: true,
              studentId: true,
              status: true,
              student: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    } catch (error) {
      if (!isCourseSchemaCompatibilityError(error)) {
        throw error;
      }
      const legacyWhere: Prisma.CourseWhereInput = isSuperAdminRole(role)
        ? {}
        : isTeacherRole(role)
          ? { teacherId: user.id }
          : { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } };
      const legacyCourses = await prisma.course.findMany({
        where: legacyWhere,
        orderBy: [{ createdAt: "desc" }],
        include: {
          teacher: {
            select: { id: true, name: true, email: true, status: true },
          },
          assignments: { select: { id: true } },
          enrollments: {
            where: enrollmentWhere,
            select: {
              id: true,
              studentId: true,
              status: true,
              student: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
      courses = legacyCourses.map((course) => ({
        ...course,
        startDate: null,
        endDate: null,
        visibility: COURSE_VISIBILITY_PUBLISHED,
      }));
    }

    return NextResponse.json({
      viewerId: user.id,
      courses: courses.map((course) => {
        const myEnrollment = course.enrollments.find((item) => item.studentId === user.id) ?? null;
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description,
          startDate: course.startDate?.toISOString() ?? null,
          endDate: course.endDate?.toISOString() ?? null,
          visibility: course.visibility,
          accessState: getCourseAccessState({
            visibility: course.visibility,
            startDate: course.startDate,
            endDate: course.endDate,
          }),
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
          enrolledStudents: isSuperAdminRole(role)
            ? course.enrollments
                .filter((item) => item.status === "ACTIVE")
                .map((item) => ({
                  id: item.studentId,
                  name: item.student?.name ?? null,
                  email: item.student?.email ?? "",
                  status: item.status,
                }))
            : [],
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

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can create courses." }, { status: 403 });
    }

    const body = (await request.json()) as CreateBody;
    const title = body.title?.trim() ?? "";
    const description = normalizeDescription(body.description);
    const startDate = parseCourseDateInput(body.startDate);
    const endDate = parseCourseDateInput(body.endDate);
    const visibility =
      parseCourseVisibility(body.visibility ?? COURSE_VISIBILITY_DRAFT) ?? COURSE_VISIBILITY_DRAFT;

    const titleError = validateCourseTitle(title);
    if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Course start date and end date are required." }, { status: 400 });
    }
    const durationError = validateCourseDuration(startDate, endDate);
    if (durationError) return NextResponse.json({ error: durationError }, { status: 400 });
    if ((body.description ?? "").toString().length > COURSE_DESCRIPTION_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Course description must not exceed ${COURSE_DESCRIPTION_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const teacherId = typeof body.teacherId === "string" && body.teacherId.trim() ? body.teacherId.trim() : null;
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const teacherValidation = await ensureTeacherIfProvided(teacherId);
    if (teacherValidation && !teacherValidation.ok) {
      return NextResponse.json({ error: teacherValidation.error }, { status: teacherValidation.status });
    }
    const studentsValidation = await validateStudentIds(studentIds);
    if (!studentsValidation.ok) {
      return NextResponse.json({ error: studentsValidation.error }, { status: studentsValidation.status });
    }

    if (teacherId) {
      const overlap = await hasTimelineOverlap({ teacherId, startDate, endDate });
      if (overlap) {
        return NextResponse.json(
          {
            error: `Teacher timeline overlaps with ${overlap.code} (${overlap.title}). Adjust dates or assignment.`,
          },
          { status: 409 }
        );
      }
    }

    const code = await generateUniqueCourseCode(title);

    const created = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code,
          title,
          description,
          startDate,
          endDate,
          visibility,
          teacherId,
        },
        include: {
          teacher: {
            select: { id: true, name: true, email: true, status: true },
          },
        },
      });

      if (studentsValidation.ids.length) {
        await tx.enrollment.createMany({
          data: studentsValidation.ids.map((studentId) => ({
            courseId: course.id,
            studentId,
            status: "ACTIVE",
          })),
          skipDuplicates: true,
        });
      }

      return course;
    });

    return NextResponse.json(
      {
        ok: true,
        course: {
          id: created.id,
          code: created.code,
          title: created.title,
          description: created.description,
          startDate: created.startDate?.toISOString() ?? null,
          endDate: created.endDate?.toISOString() ?? null,
          visibility: created.visibility,
          accessState: getCourseAccessState({
            visibility: created.visibility,
            startDate: created.startDate,
            endDate: created.endDate,
          }),
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
    if (isCourseSchemaCompatibilityError(error)) {
      return NextResponse.json(
        {
          error:
            "Course schema is outdated in the database. Please run latest Prisma migrations and regenerate Prisma client.",
        },
        { status: 503 }
      );
    }
    const message = error instanceof Error ? error.message : "Unable to create course.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can update courses." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateBody;
    const courseId = body.courseId?.trim() ?? "";
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const access = await canManageCourse(courseId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    let existing:
      | {
          id: string;
          title: string;
          description: string | null;
          startDate: Date | null;
          endDate: Date | null;
          teacherId: string | null;
          visibility: CourseVisibilityValue;
          legacySchema: boolean;
        }
      | null = null;
    try {
      const result = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, description: true, startDate: true, endDate: true, teacherId: true, visibility: true },
      });
      existing = result ? { ...result, legacySchema: false } : null;
    } catch (error) {
      if (!isCourseSchemaCompatibilityError(error)) throw error;
      const legacy = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, description: true, teacherId: true },
      });
      existing = legacy
        ? {
            ...legacy,
            startDate: null,
            endDate: null,
            visibility: COURSE_VISIBILITY_PUBLISHED,
            legacySchema: true,
          }
        : null;
    }
    if (!existing) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const data: Prisma.CourseUpdateInput = {};

    if (body.title !== undefined) {
      const title = body.title.trim();
      const titleError = validateCourseTitle(title);
      if (titleError) return NextResponse.json({ error: titleError }, { status: 400 });
      data.title = title;
    }

    if (body.description !== undefined) {
      if (typeof body.description === "string" && body.description.length > COURSE_DESCRIPTION_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Course description must not exceed ${COURSE_DESCRIPTION_MAX_LENGTH} characters.` },
          { status: 400 }
        );
      }
      data.description = normalizeDescription(body.description);
    }

    let nextStartDate = existing.startDate;
    let nextEndDate = existing.endDate;

    if (body.startDate !== undefined || body.endDate !== undefined) {
      if (existing.legacySchema) {
        nextStartDate = null;
        nextEndDate = null;
      } else {
      const startDate = parseCourseDateInput(body.startDate);
      const endDate = parseCourseDateInput(body.endDate);
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "Course start date and end date are required." }, { status: 400 });
      }
      const durationError = validateCourseDuration(startDate, endDate);
      if (durationError) return NextResponse.json({ error: durationError }, { status: 400 });
      data.startDate = startDate;
      data.endDate = endDate;
      nextStartDate = startDate;
      nextEndDate = endDate;
      }
    }

    let nextTeacherId = existing.teacherId;
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : undefined;

    if (body.teacherId !== undefined) {
      if (body.teacherId === null || body.teacherId === "") {
        data.teacher = { disconnect: true };
        nextTeacherId = null;
      } else {
        const teacherId = body.teacherId.trim();
        const teacherValidation = await ensureTeacherIfProvided(teacherId);
        if (teacherValidation && !teacherValidation.ok) {
          return NextResponse.json({ error: teacherValidation.error }, { status: teacherValidation.status });
        }
        data.teacher = { connect: { id: teacherId } };
        nextTeacherId = teacherId;
      }
    }

    if (body.visibility !== undefined) {
      if (!existing.legacySchema) {
      const visibility = parseCourseVisibility(body.visibility);
      if (!visibility) {
        return NextResponse.json({ error: "Invalid course visibility value." }, { status: 400 });
      }
      data.visibility = visibility;
      }
    }

    if (nextTeacherId && nextStartDate && nextEndDate) {
      const overlap = await hasTimelineOverlap({
        teacherId: nextTeacherId,
        startDate: nextStartDate,
        endDate: nextEndDate,
        excludeCourseId: courseId,
      });
      if (overlap) {
        return NextResponse.json(
          {
            error: `Teacher timeline overlaps with ${overlap.code} (${overlap.title}). Adjust dates or assignment.`,
          },
          { status: 409 }
        );
      }
    }

    if (!Object.keys(data).length) {
      if (!Array.isArray(studentIds)) {
        return NextResponse.json({ error: "At least one field is required to update." }, { status: 400 });
      }
    }
    const studentsValidation =
      studentIds === undefined ? null : await validateStudentIds(studentIds);
    if (studentsValidation && !studentsValidation.ok) {
      return NextResponse.json({ error: studentsValidation.error }, { status: studentsValidation.status });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (studentsValidation) {
        const desiredIds = new Set(studentsValidation.ids);
        await tx.enrollment.updateMany({
          where: { courseId, studentId: { notIn: Array.from(desiredIds) } },
          data: { status: "DROPPED" },
        });
        for (const studentId of studentsValidation.ids) {
          await tx.enrollment.upsert({
            where: { courseId_studentId: { courseId, studentId } },
            create: { courseId, studentId, status: "ACTIVE" },
            update: { status: "ACTIVE" },
          });
        }
      }

      if (existing.legacySchema) {
        return tx.course.update({
          where: { id: courseId },
          data,
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            createdAt: true,
            teacher: {
              select: { id: true, name: true, email: true, status: true },
            },
            assignments: { select: { id: true } },
            enrollments: {
              where: { status: "ACTIVE" },
              select: {
                id: true,
                studentId: true,
                status: true,
                student: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        });
      }

      return tx.course.update({
        where: { id: courseId },
        data,
        include: {
          teacher: {
            select: { id: true, name: true, email: true, status: true },
          },
          assignments: { select: { id: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              studentId: true,
              status: true,
              student: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      course: {
        id: updated.id,
        code: updated.code,
        title: updated.title,
        description: updated.description,
        startDate: existing.legacySchema ? null : updated.startDate?.toISOString() ?? null,
        endDate: existing.legacySchema ? null : updated.endDate?.toISOString() ?? null,
        visibility: existing.legacySchema ? COURSE_VISIBILITY_PUBLISHED : updated.visibility,
        accessState: getCourseAccessState({
          visibility: existing.legacySchema ? COURSE_VISIBILITY_PUBLISHED : updated.visibility,
          startDate: existing.legacySchema ? null : updated.startDate,
          endDate: existing.legacySchema ? null : updated.endDate,
        }),
        createdAt: updated.createdAt.toISOString(),
        teacher: updated.teacher,
        assignmentCount: updated.assignments.length,
        enrollmentCount: updated.enrollments.length,
        enrolledStudents: updated.enrollments.map((item) => ({
          id: item.studentId,
          name: item.student?.name ?? null,
          email: item.student?.email ?? "",
          status: item.status,
        })),
        myEnrollmentStatus: null,
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
    const message = error instanceof Error ? error.message : "Unable to update course.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json({ error: "Only Super Admin can delete courses." }, { status: 403 });
    }

    const body = (await request.json()) as DeleteBody;
    const courseId = body.courseId?.trim() ?? "";
    if (!courseId) {
      return NextResponse.json({ error: "courseId is required." }, { status: 400 });
    }

    const access = await canManageCourse(courseId, user);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [assignmentCount, discussionCount, enrollmentCount] = await Promise.all([
      prisma.assignment.count({ where: { courseId } }),
      prisma.discussion.count({ where: { courseId } }),
      prisma.enrollment.count({ where: { courseId } }),
    ]);

    await prisma.course.delete({ where: { id: courseId } });

    return NextResponse.json({
      ok: true,
      deleted: { courseId, assignmentCount, discussionCount, enrollmentCount },
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
    const message = error instanceof Error ? error.message : "Unable to delete course.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
