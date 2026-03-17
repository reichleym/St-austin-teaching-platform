import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { AssignmentSubmissionsTable } from "@/components/assignment-submissions-table";
import { CourseModulesList } from "@/components/course-modules-list";
import { CourseEditModalTrigger } from "@/components/course-edit-modal";
import { COURSE_VISIBILITY_PUBLISHED, isTeacherRole } from "@/lib/courses";
import { isSuperAdminRole } from "@/lib/permissions";

type Props = {
  params: Promise<{ module: string; id: string }>;
};

type AssignmentType = "HOMEWORK" | "QUIZ" | "EXAM";

type AssignmentConfigRecord = {
  assignmentId: string;
  assignmentType: AssignmentType;
  rubricSteps: string[];
  allowedSubmissionTypes: Array<"TEXT" | "FILE">;
  maxAttempts: number;
  autoGrade: boolean;
  allowLateSubmissions: boolean;
  attemptScoringStrategy: "LATEST" | "HIGHEST";
  timerMinutes: number | null;
  startAt: Date | null;
  moduleId: string | null;
  lessonId: string | null;
  completionRule: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type SubmissionListItem = {
  id: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  attemptNumber: number;
  submittedAt: Date | null;
  status: string;
  rawScore: number | null;
  finalScore: number | null;
  feedback: string | null;
  isLate: boolean;
  lateByMinutes: number;
  quizAnswers?: Prisma.JsonValue | null;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatRange = (start?: Date | null, end?: Date | null) => {
  if (!start && !end) return "-";
  return `${formatDateTime(start)} to ${formatDateTime(end)}`;
};

const formatEnumLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((segment) => {
      if (!segment) return "";
      if (segment.toUpperCase() === segment && segment.length <= 3) return segment;
      return `${segment[0]}${segment.slice(1).toLowerCase()}`;
    })
    .join(" ");
};

const parseAssignmentType = (input: unknown): AssignmentType => {
  if (input === "QUIZ" || input === "EXAM" || input === "HOMEWORK") return input;
  return "HOMEWORK";
};

const parseSubmissionTypes = (input: unknown, options?: { allowEmpty?: boolean }): Array<"TEXT" | "FILE"> => {
  if (!Array.isArray(input)) return options?.allowEmpty ? [] : ["TEXT", "FILE"];
  const values = Array.from(new Set(input.filter((item) => item === "TEXT" || item === "FILE")));
  if (values.length) return values as Array<"TEXT" | "FILE">;
  return options?.allowEmpty ? [] : ["TEXT"];
};

const parseRubricSteps = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 50);
};

const parseMaxAttempts = (input: unknown, assignmentType: AssignmentType) => {
  if (assignmentType === "EXAM") return 1;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, 20);
};

const parseCompletionRule = (input: unknown): AssignmentConfigRecord["completionRule"] => {
  if (input === "SUBMISSION_ONLY" || input === "GRADE_ONLY" || input === "SUBMISSION_OR_GRADE") return input;
  return "SUBMISSION_OR_GRADE";
};

const parseAttemptScoringStrategy = (input: unknown): "LATEST" | "HIGHEST" => (input === "HIGHEST" ? "HIGHEST" : "LATEST");

const normalizeLifecycleState = (input: string | null | undefined) => {
  if (!input) return "SUBMITTED";
  if (input === "PUBLISHED") return "GRADE_PUBLISHED";
  if (input === "GRADED") return "GRADED_DRAFT";
  if (
    input === "NOT_SUBMITTED" ||
    input === "SUBMITTED" ||
    input === "GRADED_DRAFT" ||
    input === "GRADE_PUBLISHED" ||
    input === "GRADE_EDIT_REQUESTED" ||
    input === "GRADE_EDIT_APPROVED" ||
    input === "GRADE_EDIT_REJECTED"
  ) {
    return input;
  }
  return "SUBMITTED";
};

const defaultConfig = (assignmentId: string): AssignmentConfigRecord => ({
  assignmentId,
  assignmentType: "HOMEWORK",
  rubricSteps: [],
  allowedSubmissionTypes: ["TEXT", "FILE"],
  maxAttempts: 1,
  autoGrade: false,
  allowLateSubmissions: true,
  attemptScoringStrategy: "LATEST",
  timerMinutes: null,
  startAt: null,
  moduleId: null,
  lessonId: null,
  completionRule: "SUBMISSION_OR_GRADE",
});

async function getDepartmentHeadCourseIds(userId: string) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."DepartmentHeadCourseAssignment"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return [] as string[];
    const rows = await prisma.$queryRaw<Array<{ courseId: string }>>`
      SELECT "courseId"
      FROM "DepartmentHeadCourseAssignment"
      WHERE "departmentHeadId" = ${userId}
    `;
    return rows.map((row) => row.courseId);
  } catch {
    return [] as string[];
  }
}

async function getCourseDepartmentHeads(courseId: string) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."DepartmentHeadCourseAssignment"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return [] as Array<{ id: string; name: string | null; email: string }>;
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string | null; email: string }>>`
      SELECT u."id", u."name", u."email"
      FROM "DepartmentHeadCourseAssignment" a
      JOIN "User" u ON u."id" = a."departmentHeadId"
      WHERE a."courseId" = ${courseId}
    `;
    return rows;
  } catch {
    return [];
  }
}

async function getPendingEnrollmentRequestCount() {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."EnrollmentRequest"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return 0;
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "EnrollmentRequest"
      WHERE "status" = 'PENDING'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getAssignmentConfig(assignmentId: string) {
  try {
    const configTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."AssignmentConfig"') IS NOT NULL AS "exists"
    `;
    if (!configTableExists[0]?.exists) return defaultConfig(assignmentId);

    const rows = await prisma.$queryRaw<
      Array<{
        assignmentId: string;
        assignmentType: string;
        rubricSteps: Prisma.JsonValue;
        allowedSubmissionTypes: Prisma.JsonValue;
        maxAttempts: number;
        autoGrade: boolean;
        allowLateSubmissions: boolean | null;
        attemptScoringStrategy: string | null;
        timerMinutes: number | null;
        startAt: Date | null;
        moduleId: string | null;
        lessonId: string | null;
        completionRule: string;
      }>
    >`
      SELECT
        "assignmentId",
        "assignmentType",
        "rubricSteps",
        "allowedSubmissionTypes",
        "maxAttempts",
        "autoGrade",
        "allowLateSubmissions",
        "attemptScoringStrategy",
        "timerMinutes",
        "startAt",
        "moduleId",
        "lessonId",
        "completionRule"
      FROM "AssignmentConfig"
      WHERE "assignmentId" = ${assignmentId}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return defaultConfig(assignmentId);
    const assignmentType = parseAssignmentType(row.assignmentType);
    return {
      assignmentId: row.assignmentId,
      assignmentType,
      rubricSteps: parseRubricSteps(row.rubricSteps as unknown[]),
      allowedSubmissionTypes: assignmentType === "QUIZ"
        ? parseSubmissionTypes(row.allowedSubmissionTypes as unknown[], { allowEmpty: true })
        : parseSubmissionTypes(row.allowedSubmissionTypes as unknown[]),
      maxAttempts: parseMaxAttempts(row.maxAttempts, assignmentType),
      autoGrade: !!row.autoGrade,
      allowLateSubmissions: row.allowLateSubmissions !== false,
      attemptScoringStrategy: parseAttemptScoringStrategy(row.attemptScoringStrategy),
      timerMinutes: row.timerMinutes !== null && Number.isInteger(Number(row.timerMinutes)) ? Number(row.timerMinutes) : null,
      startAt: row.startAt ?? null,
      moduleId: row.moduleId,
      lessonId: row.lessonId,
      completionRule: parseCompletionRule(row.completionRule),
    };
  } catch {
    return defaultConfig(assignmentId);
  }
}

async function getAssignmentSubmissionCount(assignmentId: string) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."AssignmentSubmission"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return 0;
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${assignmentId}
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getAssignmentSubmissions(assignmentId: string, userId: string, isStudent: boolean) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."AssignmentSubmission"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return [] as SubmissionListItem[];

    if (isStudent) {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          studentId: string;
          attemptNumber: number;
          submittedAt: Date | null;
          status: string;
          rawScore: number | null;
          finalScore: number | null;
          feedback: string | null;
          quizAnswers: Prisma.JsonValue | null;
          isLate: boolean;
          lateByMinutes: number;
        }>
      >`
        SELECT "id","studentId","attemptNumber","submittedAt","status","rawScore","finalScore","feedback","quizAnswers","isLate","lateByMinutes"
        FROM "AssignmentSubmission"
        WHERE "assignmentId" = ${assignmentId} AND "studentId" = ${userId}
        ORDER BY "attemptNumber" ASC
      `;

      return rows.map((row) => ({
        id: row.id,
        studentId: row.studentId,
        studentName: null,
        studentEmail: null,
        attemptNumber: row.attemptNumber,
        submittedAt: row.submittedAt,
        status: normalizeLifecycleState(row.status),
        rawScore: row.rawScore,
        finalScore: row.finalScore,
        feedback: row.feedback,
        quizAnswers: row.quizAnswers,
        isLate: row.isLate,
        lateByMinutes: row.lateByMinutes,
      }));
    }

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        studentId: string;
        attemptNumber: number;
        submittedAt: Date | null;
        status: string;
        rawScore: number | null;
        finalScore: number | null;
        feedback: string | null;
        quizAnswers: Prisma.JsonValue | null;
        isLate: boolean;
        lateByMinutes: number;
        studentName: string | null;
        studentEmail: string;
      }>
    >`
      SELECT
        s."id",
        s."studentId",
        s."attemptNumber",
        s."submittedAt",
        s."status",
        s."rawScore",
        s."finalScore",
        s."feedback",
        s."quizAnswers",
        s."isLate",
        s."lateByMinutes",
        u."name" AS "studentName",
        u."email" AS "studentEmail"
      FROM "AssignmentSubmission" s
      JOIN "User" u ON u."id" = s."studentId"
      WHERE s."assignmentId" = ${assignmentId}
      ORDER BY u."email" ASC, s."attemptNumber" ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      attemptNumber: row.attemptNumber,
      submittedAt: row.submittedAt,
      status: normalizeLifecycleState(row.status),
      rawScore: row.rawScore,
      finalScore: row.finalScore,
      feedback: row.feedback,
      quizAnswers: row.quizAnswers,
      isLate: row.isLate,
      lateByMinutes: row.lateByMinutes,
    }));
  } catch {
    return [] as SubmissionListItem[];
  }
}

export default async function DashboardDetailPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  const module = routeParams.module;
  const recordId = routeParams.id;
  const roleKey = String(session.user.role ?? "");
  const isSuperAdmin = isSuperAdminRole(roleKey);
  const isDepartmentHead = roleKey === "DEPARTMENT_HEAD";
  const isTeacher = isTeacherRole(roleKey);
  const isStudent = roleKey === "STUDENT";

  if (module === "courses" || module === "learning") {
    const departmentHeadCourseIds = isDepartmentHead ? await getDepartmentHeadCourseIds(session.user.id) : [];
    const departmentHeadCourseId =
      isDepartmentHead && departmentHeadCourseIds.includes(recordId) ? recordId : "__none__";
    const courseWhere: Prisma.CourseWhereInput =
      isSuperAdmin
        ? { id: recordId }
        : isDepartmentHead
          ? { id: departmentHeadCourseId }
        : isTeacher
          ? { id: recordId, teacherId: session.user.id }
            : isStudent
              ? module === "learning"
                ? {
                    id: recordId,
                    visibility: COURSE_VISIBILITY_PUBLISHED,
                    enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } },
                  }
                : { id: recordId, visibility: COURSE_VISIBILITY_PUBLISHED }
              : { id: recordId, visibility: COURSE_VISIBILITY_PUBLISHED };

    const course = await prisma.course.findFirst({
      where: courseWhere,
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        teacher: { select: { id: true, name: true, email: true } },
        modules: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            position: true,
            releaseAt: true,
            visibilityRule: true,
            lessons: {
              orderBy: { position: "asc" },
              select: { id: true, title: true, position: true, visibility: true, isRequired: true },
            },
          },
        },
        assignments: {
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 50,
          select: { id: true, title: true, dueAt: true, maxPoints: true, createdAt: true },
        },
        _count: { select: { enrollments: true, assignments: true, modules: true, discussions: true } },
      },
    });

    if (!course) {
      redirect(`/dashboard/${module === "learning" ? "learning" : "courses"}`);
    }

    const [teachers, students, departmentHeads, enrolledStudents, assignedDepartmentHeads] = isSuperAdmin
      ? await Promise.all([
          prisma.user.findMany({
            where: { role: "TEACHER", status: "ACTIVE" },
            select: { id: true, name: true, email: true },
            orderBy: [{ name: "asc" }, { email: "asc" }],
          }),
          prisma.user.findMany({
            where: { role: "STUDENT", status: "ACTIVE" },
            select: { id: true, name: true, email: true, phone: true },
            orderBy: [{ name: "asc" }, { email: "asc" }],
          }),
          prisma.user.findMany({
            where: { role: "DEPARTMENT_HEAD", status: "ACTIVE" },
            select: { id: true, name: true, email: true },
            orderBy: [{ name: "asc" }, { email: "asc" }],
          }),
          prisma.enrollment.findMany({
            where: { courseId: course.id, status: "ACTIVE" },
            select: { studentId: true },
          }),
          getCourseDepartmentHeads(course.id),
        ])
      : [[], [], [], [], []];

    const courseSnapshot = {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      startDate: course.startDate ? course.startDate.toISOString() : null,
      endDate: course.endDate ? course.endDate.toISOString() : null,
      visibility: course.visibility,
      teacherId: course.teacher?.id ?? null,
      studentIds: enrolledStudents.map((item) => item.studentId),
      departmentHeadIds: assignedDepartmentHeads.map((item) => item.id),
    };

    const studentEnrollment = isStudent
      ? await prisma.enrollment.findFirst({
          where: { courseId: course.id, studentId: session.user.id, status: "ACTIVE" },
          select: { id: true },
        })
      : null;

    const canShowAssignments = !isStudent || Boolean(studentEnrollment);
    const canManageStructure = isSuperAdmin || isTeacher;
    const canViewStructure = canManageStructure || isDepartmentHead;
    const pendingEnrollmentRequestCount = isSuperAdmin ? await getPendingEnrollmentRequestCount() : 0;

    return (
      <main className="min-h-screen lg:flex">
        <DashboardSidebar role={roleKey} selectedSlug={module} />
        <div className="flex-1 space-y-6 p-6 lg:p-8">
          <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

          <section className="brand-glass brand-animate p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="brand-chip">
                  <span className="brand-accent-dot" />
                  Course Details
                </span>
                <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">{course.code} - {course.title}</h1>
                <p className="brand-muted mt-2 max-w-3xl text-sm">{course.description || "No description provided yet."}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isSuperAdmin ? (
                  <CourseEditModalTrigger
                    course={courseSnapshot}
                    teachers={teachers}
                    students={students}
                    departmentHeads={departmentHeads}
                  />
                ) : null}
                <Link
                  href={`/dashboard/${module === "learning" ? "learning" : "courses"}`}
                  aria-label="Back to courses"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="brand-card p-5">
              <p className="brand-section-title">Course Summary</p>
              <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
                <p><span className="font-semibold">Visibility:</span> {course.visibility}</p>
                <p><span className="font-semibold">Duration:</span> {formatDate(course.startDate)} to {formatDate(course.endDate)}</p>
                <p><span className="font-semibold">Teacher:</span> {course.teacher?.name ?? course.teacher?.email ?? "Unassigned"}</p>
                <p><span className="font-semibold">Created:</span> {formatDateTime(course.createdAt)}</p>
                <p><span className="font-semibold">Updated:</span> {formatDateTime(course.updatedAt)}</p>
              </div>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">Activity</p>
              <div className="mt-3 grid gap-2 text-sm text-[#0b3e81]">
                <p><span className="font-semibold">Modules:</span> {course._count.modules}</p>
                <p><span className="font-semibold">Assignments:</span> {course._count.assignments}</p>
                <p><span className="font-semibold">Discussions:</span> {course._count.discussions}</p>
                <p><span className="font-semibold">Enrollments:</span> {course._count.enrollments}</p>
              </div>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">Quick Actions</p>
              <div className="mt-3 grid gap-2 text-sm">
                {module === "courses" && canViewStructure ? (
                  <Link
                    href={`/dashboard/courses/${course.id}/structure`}
                    className="rounded-lg border border-[#9bbfed] bg-[#eff6ff] px-3 py-2 text-xs font-semibold text-[#0b3e81] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    {canManageStructure ? "Manage Modules & Lessons" : "View Modules & Lessons"}
                  </Link>
                ) : null}
                {isTeacher || isDepartmentHead ? (
                  <Link
                    href={`/dashboard/courses/${course.id}/progress`}
                    className="rounded-lg border border-[#9bbfed] bg-[#eff6ff] px-3 py-2 text-xs font-semibold text-[#0b3e81] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Student Progress
                  </Link>
                ) : null}
                {isSuperAdmin || isTeacher || isDepartmentHead ? (
                  <Link
                    href={`/dashboard/courses/${course.id}/students`}
                    className="rounded-lg border border-[#9bbfed] bg-[#eff6ff] px-3 py-2 text-xs font-semibold text-[#0b3e81] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Enrolled Students
                  </Link>
                ) : null}
                {isSuperAdmin ? (
                  <Link
                    href="/dashboard/courses/enrollment-requests"
                    className="flex items-center justify-between rounded-lg border border-[#f3b8b8] bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-[#9b1c1c] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Enrollment Requests
                    <span className="rounded-full bg-[#d92d20] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {pendingEnrollmentRequestCount}
                    </span>
                  </Link>
                ) : null}
                {isSuperAdmin ? (
                  <Link
                    href="/dashboard/view-students"
                    className="rounded-lg border border-[#9bbfed] bg-[#eff6ff] px-3 py-2 text-xs font-semibold text-[#0b3e81] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Manage Students
                  </Link>
                ) : null}
                {isStudent ? (
                  <Link
                    href={`/dashboard/courses/${course.id}/progress`}
                    className="rounded-lg border border-[#9bbfed] bg-[#eff6ff] px-3 py-2 text-xs font-semibold text-[#0b3e81] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    View Progress
                  </Link>
                ) : null}
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {!isStudent || studentEnrollment ? (
              <>
                <CourseModulesList
                  courseId={course.id}
                  role={roleKey as "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT"}
                  showManageActions={false}
                  showViewAllLink
                  showAssignmentsLink={false}
                />

                <article id="course-assignments" className="brand-card p-5">
                  <p className="brand-section-title">Assignments</p>
                  {canShowAssignments ? (
                    course.assignments.length ? (
                      <div className="mt-3 space-y-2">
                        {course.assignments.map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between rounded-lg border border-[#d6e7fb] bg-white/80 px-3 py-2 text-sm">
                            <div>
                              <p className="font-semibold text-[#0b3e81]">{assignment.title}</p>
                              <p className="brand-muted text-xs">Due: {formatDateTime(assignment.dueAt)}</p>
                            </div>
                            <Link
                              href={`/dashboard/assessment/${assignment.id}`}
                              className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                            >
                              Manage
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="brand-muted mt-3 text-sm">No assignments linked to this course yet.</p>
                    )
                  ) : (
                    <p className="brand-muted mt-3 text-sm">Enroll in the course to view assignments.</p>
                  )}
                </article>
              </>
            ) : (
              <article className="brand-card p-5 lg:col-span-2">
                <p className="brand-section-title">Course Access</p>
                <p className="brand-muted mt-3 text-sm">
                  Enroll in this course to view modules, lessons, and assignments.
                </p>
              </article>
            )}
          </section>
        </div>
      </main>
    );
  }

  if (module === "assessment") {
    const departmentHeadCourseIds = isDepartmentHead ? await getDepartmentHeadCourseIds(session.user.id) : [];

    const assignment = await prisma.assignment.findFirst({
      where: {
        id: recordId,
        course: isSuperAdmin
          ? {}
          : isDepartmentHead
            ? { id: { in: departmentHeadCourseIds.length ? departmentHeadCourseIds : ["__none__"] } }
            : isTeacher
              ? { teacherId: session.user.id }
              : isStudent
                ? {
                    visibility: COURSE_VISIBILITY_PUBLISHED,
                    enrollments: { some: { studentId: session.user.id, status: "ACTIVE" } },
                  }
                : { visibility: COURSE_VISIBILITY_PUBLISHED },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        maxPoints: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!assignment) {
      redirect(`/dashboard/${module}`);
    }

    const [config, submissionCount, submissions] = await Promise.all([
      getAssignmentConfig(assignment.id),
      getAssignmentSubmissionCount(assignment.id),
      getAssignmentSubmissions(assignment.id, session.user.id, isStudent),
    ]);
    const serializedSubmissions = submissions.map((submission) => ({
      id: submission.id,
      studentId: submission.studentId,
      studentName: submission.studentName,
      studentEmail: submission.studentEmail,
      attemptNumber: submission.attemptNumber,
      submittedAt: submission.submittedAt?.toISOString?.() ?? null,
      status: submission.status,
      rawScore: submission.rawScore ?? null,
      finalScore: submission.finalScore ?? null,
      feedback: submission.feedback ?? null,
      isLate: submission.isLate,
      lateByMinutes: submission.lateByMinutes,
      quizAnswers: submission.quizAnswers ?? null,
    }));
    const canGrade = roleKey === "TEACHER";
    const canEditQuestions = roleKey === "TEACHER" && (config.assignmentType === "QUIZ" || config.assignmentType === "EXAM");
    const canViewAttempt = canGrade || isSuperAdmin;

    return (
      <main className="min-h-screen lg:flex">
        <DashboardSidebar role={roleKey} selectedSlug={module} />
        <div className="flex-1 space-y-6 p-6 lg:p-8">
          <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

          <section className="brand-glass brand-animate p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="brand-chip">
                  <span className="brand-accent-dot" />
                  Assignment Details
                </span>
                <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">{assignment.title}</h1>
                <p className="brand-muted mt-2 max-w-3xl text-sm">{assignment.description || "No description provided yet."}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEditQuestions ? (
                  <Link
                    href={`/dashboard/assessment?assignmentId=${assignment.id}#assignment-questions`}
                    className="rounded-md border border-[#9bbfed] bg-white px-4 py-2 text-sm font-semibold text-[#1f518f]"
                  >
                    Edit Questions
                  </Link>
                ) : null}
                {isStudent ? (
                  <Link
                    href={`/dashboard/${module}/${assignment.id}/submit`}
                    className="btn-brand-primary px-4 py-2 text-sm font-semibold no-underline"
                  >
                    View Assignment
                  </Link>
                ) : null}
                <Link
                  href={`/dashboard/${module}`}
                  aria-label="Back to assessment"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="brand-card p-5">
              <p className="brand-section-title">Assignment Summary</p>
              <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
                <p><span className="font-semibold">Type:</span> {formatEnumLabel(config.assignmentType)}</p>
                <p><span className="font-semibold">Max Points:</span> {Number(assignment.maxPoints)}</p>
                <p><span className="font-semibold">Attempts:</span> {config.maxAttempts}</p>
                <p><span className="font-semibold">Window:</span> {formatRange(config.startAt, assignment.dueAt)}</p>
                <p><span className="font-semibold">Submissions:</span> {submissionCount}</p>
              </div>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">Delivery Settings</p>
              <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
                <p>
                  <span className="font-semibold">Submission Types:</span>{" "}
                  {config.allowedSubmissionTypes.length
                    ? config.allowedSubmissionTypes.join(", ")
                    : config.assignmentType === "QUIZ"
                      ? "Quiz Questions"
                      : "N/A"}
                </p>
                <p><span className="font-semibold">Auto Grade:</span> {config.autoGrade ? "Enabled" : "Disabled"}</p>
                <p><span className="font-semibold">Late Submissions:</span> {config.allowLateSubmissions ? "Allowed" : "Not allowed"}</p>
                <p><span className="font-semibold">Scoring Strategy:</span> {formatEnumLabel(config.attemptScoringStrategy)}</p>
                <p><span className="font-semibold">Timer:</span> {config.timerMinutes ? `${config.timerMinutes} min` : "No timer"}</p>
              </div>
            </article>
          </section>

          <section className="brand-card p-5">
            <p className="brand-section-title">Rubric & Completion</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[#0b3e81]">Completion Rule</p>
                <p className="brand-muted mt-1 text-sm">{formatEnumLabel(config.completionRule)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0b3e81]">Rubric Steps</p>
                {config.rubricSteps.length ? (
                  isStudent ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-sm font-semibold text-[#1f518f]">View Rubric</summary>
                      <ul className="mt-2 space-y-1 text-sm text-[#2f5d96]">
                        {config.rubricSteps.map((step, index) => (
                          <li key={step + index}>{index + 1}. {step}</li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm text-[#2f5d96]">
                      {config.rubricSteps.map((step, index) => (
                        <li key={step + index}>{index + 1}. {step}</li>
                      ))}
                    </ul>
                  )
                ) : (
                  <p className="brand-muted mt-1 text-sm">No rubric steps configured.</p>
                )}
              </div>
            </div>
          </section>

          <AssignmentSubmissionsTable
            module={module}
            assignmentId={assignment.id}
            submissions={serializedSubmissions}
            canGrade={canGrade}
            canViewAttempt={canViewAttempt}
          />
        </div>
      </main>
    );
  }

  redirect(`/dashboard/${module}`);
}
