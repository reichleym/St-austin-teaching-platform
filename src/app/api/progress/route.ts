import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { COURSE_VISIBILITY_PUBLISHED, LESSON_VISIBILITY_VISIBLE, MODULE_VISIBILITY_LIMITED } from "@/lib/courses";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole, PermissionError, requireAuthenticatedUser } from "@/lib/permissions";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type StudentOption = {
  id: string;
  name: string | null;
  email: string;
};

type ProgressModule = {
  id: string;
  title: string;
  position: number;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  accessState: "OPEN" | "LOCKED";
};

type ProgressPayload = {
  course: CourseOption;
  student: StudentOption;
  totals: {
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
  };
  modules: ProgressModule[];
};

async function listAccessibleCourses(user: { id: string; role: Role | string }): Promise<CourseOption[]> {
  if (isSuperAdminRole(user.role)) {
    return prisma.course.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true },
    });
  }

  if (user.role === Role.TEACHER) {
    return prisma.course.findMany({
      where: { teacherId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, title: true },
    });
  }

  return prisma.course.findMany({
    where: {
      visibility: COURSE_VISIBILITY_PUBLISHED,
      enrollments: { some: { studentId: user.id, status: "ACTIVE" } },
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, code: true, title: true },
  });
}

async function listCourseStudents(courseId: string): Promise<StudentOption[]> {
  return prisma.$queryRaw<
    Array<{ id: string; name: string | null; email: string }>
  >`
    SELECT u."id", u."name", u."email"
    FROM "Enrollment" e
    JOIN "User" u ON u."id" = e."studentId"
    WHERE e."courseId" = ${courseId}
      AND e."status" = CAST('ACTIVE' AS "EnrollmentStatus")
      AND u."status" = CAST('ACTIVE' AS "UserStatus")
    ORDER BY u."name" ASC NULLS LAST, u."email" ASC
  `;
}

async function ensureCourseAccess(courseId: string, user: { id: string; role: Role | string }) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, title: true, teacherId: true, visibility: true },
  });
  if (!course) return { ok: false as const, status: 404, error: "Course not found." };
  if (isSuperAdminRole(user.role)) return { ok: true as const, course };
  if (user.role === Role.TEACHER) {
    if (course.teacherId !== user.id) {
      return { ok: false as const, status: 403, error: "Only assigned teachers can view this course." };
    }
    return { ok: true as const, course };
  }

  if (course.visibility !== COURSE_VISIBILITY_PUBLISHED) {
    return { ok: false as const, status: 403, error: "Course is not available for students." };
  }
  const enrolled = await prisma.enrollment.count({
    where: { courseId, studentId: user.id, status: "ACTIVE" },
  });
  if (!enrolled) {
    return { ok: false as const, status: 403, error: "Not enrolled in this course." };
  }
  return { ok: true as const, course };
}

async function tableExists(table: "CourseModule" | "Lesson" | "LessonCompletion" | "ModuleAssignment") {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('public."${table}"') IS NOT NULL AS "exists"`
  );
  return !!rows[0]?.exists;
}

async function buildProgress(courseId: string, studentId: string): Promise<ProgressPayload["totals"] & { modules: ProgressModule[] }> {
  const hasModules = await tableExists("CourseModule");
  const hasLessons = await tableExists("Lesson");
  if (!hasModules || !hasLessons) {
    return { totalLessons: 0, completedLessons: 0, progressPercent: 0, modules: [] };
  }

  const modules = await prisma.$queryRaw<
    Array<{ id: string; title: string; position: number; releaseAt: Date | null; visibilityRule: string }>
  >`
    SELECT "id","title","position","releaseAt","visibilityRule"::text AS "visibilityRule"
    FROM "CourseModule"
    WHERE "courseId" = ${courseId}
    ORDER BY "position" ASC, "createdAt" ASC
  `;

  if (!modules.length) {
    return { totalLessons: 0, completedLessons: 0, progressPercent: 0, modules: [] };
  }

  const moduleIds = modules.map((item) => item.id);
  const lessons = await prisma.$queryRaw<
    Array<{ id: string; moduleId: string; visibility: string }>
  >`
    SELECT "id","moduleId","visibility"::text AS "visibility"
    FROM "Lesson"
    WHERE "moduleId" IN (${Prisma.join(moduleIds)})
  `;

  const lessonIds = lessons.map((lesson) => lesson.id);

  let completionSet = new Set<string>();
  if (lessonIds.length && (await tableExists("LessonCompletion"))) {
    const completions = await prisma.$queryRaw<Array<{ lessonId: string }>>`
      SELECT "lessonId"
      FROM "LessonCompletion"
      WHERE "studentId" = ${studentId} AND "lessonId" IN (${Prisma.join(lessonIds)})
    `;
    completionSet = new Set(completions.map((item) => item.lessonId));
  }

  let assignedModuleSet: Set<string> | null = null;
  if (await tableExists("ModuleAssignment")) {
    try {
      const assignedRows = await prisma.$queryRaw<Array<{ moduleId: string }>>`
        SELECT "moduleId"
        FROM "ModuleAssignment"
        WHERE "studentId" = ${studentId} AND "moduleId" IN (${Prisma.join(moduleIds)})
      `;
      assignedModuleSet = new Set(assignedRows.map((row) => row.moduleId));
    } catch {
      assignedModuleSet = null;
    }
  }

  const lessonsByModule = new Map<string, Array<{ id: string; visibility: string }>>();
  for (const lesson of lessons) {
    const group = lessonsByModule.get(lesson.moduleId) ?? [];
    group.push({ id: lesson.id, visibility: lesson.visibility });
    lessonsByModule.set(lesson.moduleId, group);
  }

  const now = new Date();
  let totalLessons = 0;
  let completedLessons = 0;

  const moduleProgress: ProgressModule[] = modules.map((module) => {
    const moduleLessons = lessonsByModule.get(module.id) ?? [];
    const visibleLessons = moduleLessons.filter((lesson) => lesson.visibility === LESSON_VISIBILITY_VISIBLE);
    const notAssigned =
      module.visibilityRule === MODULE_VISIBILITY_LIMITED && assignedModuleSet !== null && !assignedModuleSet.has(module.id);
    const releaseLocked = module.visibilityRule === MODULE_VISIBILITY_LIMITED && !!module.releaseAt && now < module.releaseAt;
    const locked = notAssigned || releaseLocked;
    const activeLessons = locked ? [] : visibleLessons;

    const moduleTotal = activeLessons.length;
    const moduleCompleted = activeLessons.filter((lesson) => completionSet.has(lesson.id)).length;
    totalLessons += moduleTotal;
    completedLessons += moduleCompleted;

    const accessState: ProgressModule["accessState"] = locked ? "LOCKED" : "OPEN";

    return {
      id: module.id,
      title: module.title,
      position: module.position,
      totalLessons: moduleTotal,
      completedLessons: moduleCompleted,
      progressPercent: moduleTotal ? Math.round((moduleCompleted / moduleTotal) * 100) : 0,
      accessState,
    };
  });

  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    modules: moduleProgress,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const courseId = request.nextUrl.searchParams.get("courseId")?.trim() ?? "";
    const requestedStudentId = request.nextUrl.searchParams.get("studentId")?.trim() ?? "";

    const courses = await listAccessibleCourses(user);
    if (!courseId) {
      return NextResponse.json({ viewerId: user.id, courses, students: [], progress: null });
    }

    const access = await ensureCourseAccess(courseId, user);
    if (!access.ok) {
      return NextResponse.json({ viewerId: user.id, courses, students: [], progress: null, error: access.error }, { status: access.status });
    }

    let students = await listCourseStudents(courseId);
    const targetStudentId = user.role === Role.STUDENT ? user.id : requestedStudentId;
    if (user.role === Role.STUDENT) {
      students = [
        {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? "",
        },
      ];
    }

    if (!targetStudentId) {
      return NextResponse.json({ viewerId: user.id, courses, students, progress: null });
    }

    const student = students.find((item) => item.id === targetStudentId);
    if (!student) {
      return NextResponse.json({ viewerId: user.id, courses, students, progress: null, error: "Student not enrolled in this course." }, { status: 404 });
    }

    const totals = await buildProgress(courseId, targetStudentId);
    const progress: ProgressPayload = {
      course: { id: access.course.id, code: access.course.code, title: access.course.title },
      student,
      totals: {
        totalLessons: totals.totalLessons,
        completedLessons: totals.completedLessons,
        progressPercent: totals.progressPercent,
      },
      modules: totals.modules,
    };

    return NextResponse.json({ viewerId: user.id, courses, students, progress });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to load progress.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
