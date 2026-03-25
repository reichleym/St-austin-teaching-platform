import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { AssignmentStudentSubmission } from "@/components/assignment-student-submission";
import { COURSE_VISIBILITY_PUBLISHED, isCourseExpired } from "@/lib/courses";

type Props = {
  params: Promise<{ module: string; id: string }>;
};

type AssignmentType = "HOMEWORK" | "QUIZ" | "EXAM";

type AssignmentConfigRecord = {
  assignmentId: string;
  assignmentType: AssignmentType;
  allowedSubmissionTypes: Array<"TEXT" | "FILE">;
  maxAttempts: number;
  allowLateSubmissions: boolean;
  timerMinutes: number | null;
  startAt: Date | null;
  endAt: Date | null;
  courseEndDate: Date | null;
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

const parseMaxAttempts = (input: unknown, assignmentType: AssignmentType) => {
  if (assignmentType === "EXAM") return 1;
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, 20);
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

async function getAssignmentConfig(assignmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      assignmentType: string;
      allowedSubmissionTypes: Prisma.JsonValue;
      maxAttempts: number;
      allowLateSubmissions: boolean | null;
      timerMinutes: number | null;
      startAt: Date | null;
      endAt: Date | null;
      courseId: string;
      courseVisibility: string | null;
      courseEndDate: Date | null;
    }>
  >`
    SELECT
      COALESCE(cfg."assignmentType", 'HOMEWORK') AS "assignmentType",
      COALESCE(cfg."allowedSubmissionTypes", '["TEXT","FILE"]'::jsonb) AS "allowedSubmissionTypes",
      COALESCE(cfg."maxAttempts", 1) AS "maxAttempts",
      COALESCE(cfg."allowLateSubmissions", true) AS "allowLateSubmissions",
      cfg."timerMinutes",
      cfg."startAt",
      a."dueAt" AS "endAt",
      a."courseId",
      c."visibility"::text AS "courseVisibility",
      c."endDate" AS "courseEndDate"
    FROM "Assignment" a
    JOIN "Course" c ON c."id" = a."courseId"
    LEFT JOIN "AssignmentConfig" cfg ON cfg."assignmentId" = a."id"
    WHERE a."id" = ${assignmentId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  const assignmentType = parseAssignmentType(row.assignmentType);
  return {
    assignmentId,
    assignmentType,
    allowedSubmissionTypes: assignmentType === "QUIZ"
      ? parseSubmissionTypes(row.allowedSubmissionTypes as unknown[], { allowEmpty: true })
      : parseSubmissionTypes(row.allowedSubmissionTypes as unknown[]),
    maxAttempts: parseMaxAttempts(row.maxAttempts, assignmentType),
    allowLateSubmissions: row.allowLateSubmissions !== false,
    timerMinutes: row.timerMinutes !== null && Number.isInteger(Number(row.timerMinutes)) ? Number(row.timerMinutes) : null,
    startAt: row.startAt ?? null,
    endAt: row.endAt ?? null,
    courseId: row.courseId,
    courseVisibility: row.courseVisibility,
    courseEndDate: row.courseEndDate ?? null,
  } as AssignmentConfigRecord & { courseId: string; courseVisibility: string | null };
}

async function getStudentSubmissions(assignmentId: string, studentId: string) {
  try {
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."AssignmentSubmission"') IS NOT NULL AS "exists"
    `;
    if (!tableExists[0]?.exists) return [] as Array<{
      id: string;
      attemptNumber: number;
      submittedAt: string | null;
      status: string;
      finalScore: number | null;
      isLate: boolean;
      lateByMinutes: number;
    }>;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        attemptNumber: number;
        submittedAt: Date | null;
        status: string;
        finalScore: number | null;
        isLate: boolean;
        lateByMinutes: number;
      }>
    >`
      SELECT "id","attemptNumber","submittedAt","status","finalScore","isLate","lateByMinutes"
      FROM "AssignmentSubmission"
      WHERE "assignmentId" = ${assignmentId} AND "studentId" = ${studentId}
      ORDER BY "attemptNumber" ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      attemptNumber: row.attemptNumber,
      submittedAt: row.submittedAt?.toISOString?.() ?? null,
      status: row.status,
      finalScore: row.finalScore,
      isLate: row.isLate,
      lateByMinutes: row.lateByMinutes,
    }));
  } catch {
    return [] as Array<{
      id: string;
      attemptNumber: number;
      submittedAt: string | null;
      status: string;
      finalScore: number | null;
      isLate: boolean;
      lateByMinutes: number;
    }>;
  }
}

export default async function AssignmentSubmitPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  if (routeParams.module !== "assessment") {
    redirect(`/dashboard/${routeParams.module}`);
  }

  if (session.user.role !== "STUDENT") {
    redirect(`/dashboard/assessment/${routeParams.id}`);
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: routeParams.id },
    select: { id: true, title: true, description: true },
  });

  if (!assignment) {
    redirect("/dashboard/assessment");
  }

  const config = await getAssignmentConfig(assignment.id);
  if (!config) {
    redirect("/dashboard/assessment");
  }

  if (config.courseVisibility !== COURSE_VISIBILITY_PUBLISHED) {
    redirect(`/dashboard/assessment/${assignment.id}`);
  }
  if (isCourseExpired(config.courseEndDate ?? null)) {
    redirect(`/dashboard/assessment/${assignment.id}`);
  }

  const enrolled = await prisma.enrollment.count({
    where: { courseId: config.courseId, studentId: session.user.id, status: "ACTIVE" },
  });

  if (!enrolled) {
    redirect(`/dashboard/assessment/${assignment.id}`);
  }

  const submissions = await getStudentSubmissions(assignment.id, session.user.id);

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={String(session.user.role ?? "")} selectedSlug="assessment" />
      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={String(session.user.role ?? "")} />

        <section className="brand-glass brand-animate p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Submit Assignment
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">{assignment.title}</h1>
              <p className="brand-muted mt-2 max-w-3xl text-sm">{assignment.description || "No description provided yet."}</p>
              <p className="brand-muted mt-2 text-xs">Window ends: {formatDateTime(config.endAt)}</p>
            </div>
            <Link
              href={`/dashboard/assessment/${assignment.id}`}
              aria-label="Back to assignment"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        </section>

        <AssignmentStudentSubmission
          assignmentId={assignment.id}
          assignmentType={config.assignmentType}
          allowedSubmissionTypes={config.allowedSubmissionTypes}
          maxAttempts={config.maxAttempts}
          allowLateSubmissions={config.allowLateSubmissions}
          timerMinutes={config.timerMinutes}
          startAt={config.startAt?.toISOString?.() ?? null}
          endAt={config.endAt?.toISOString?.() ?? null}
          initialSubmissions={submissions}
        />
      </div>
    </main>
  );
}
