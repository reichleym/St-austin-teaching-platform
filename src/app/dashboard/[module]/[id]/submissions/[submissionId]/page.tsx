import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { SubmissionGradePanel } from "@/components/submission-grade-panel";
import { COURSE_VISIBILITY_PUBLISHED, isTeacherRole } from "@/lib/courses";
import { isSuperAdminRole } from "@/lib/permissions";

type Props = {
  params: Promise<{ module: string; id: string; submissionId: string }>;
};

type GradeLifecycleState =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "GRADED_DRAFT"
  | "GRADE_PUBLISHED"
  | "GRADE_EDIT_REQUESTED"
  | "GRADE_EDIT_APPROVED"
  | "GRADE_EDIT_REJECTED";

const PUBLISHED_STATES: GradeLifecycleState[] = [
  "GRADE_PUBLISHED",
  "GRADE_EDIT_REQUESTED",
  "GRADE_EDIT_APPROVED",
  "GRADE_EDIT_REJECTED",
];

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const normalizeLifecycleState = (input: string | null | undefined): GradeLifecycleState => {
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

export default async function AssignmentSubmissionDetailPage({ params }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const routeParams = await params;
  const module = routeParams.module;
  const assignmentId = routeParams.id;
  const submissionId = routeParams.submissionId;

  if (module !== "assessment") {
    redirect(`/dashboard/${module}`);
  }

  const roleKey = String(session.user.role ?? "");
  const isSuperAdmin = isSuperAdminRole(roleKey);
  const isDepartmentHead = roleKey === "DEPARTMENT_HEAD";
  const isTeacher = isTeacherRole(roleKey);
  const isStudent = roleKey === "STUDENT";

  const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public."AssignmentSubmission"') IS NOT NULL AS "exists"
  `;
  if (!tableExists[0]?.exists) {
    redirect(`/dashboard/${module}/${assignmentId}`);
  }

  const submissionRows = await prisma.$queryRaw<
    Array<{
      id: string;
      assignmentId: string;
      studentId: string;
      attemptNumber: number;
      textResponse: string | null;
      fileUrl: string | null;
      fileName: string | null;
      mimeType: string | null;
      submittedAt: Date | null;
      isLate: boolean;
      lateByMinutes: number;
      latePenaltyPct: number;
      rawScore: number | null;
      finalScore: number | null;
      feedback: string | null;
      quizAnswers: Prisma.JsonValue | null;
      gradedAt: Date | null;
      publishedAt: Date | null;
      status: string;
      assignmentTitle: string;
      courseId: string;
      courseVisibility: string | null;
      teacherId: string | null;
      studentName: string | null;
      studentEmail: string;
    }>
  >`
    SELECT
      s.*,
      a."title" AS "assignmentTitle",
      a."courseId" AS "courseId",
      c."visibility"::text AS "courseVisibility",
      c."teacherId" AS "teacherId",
      u."name" AS "studentName",
      u."email" AS "studentEmail",
      s."quizAnswers" AS "quizAnswers"
    FROM "AssignmentSubmission" s
    JOIN "Assignment" a ON a."id" = s."assignmentId"
    JOIN "Course" c ON c."id" = a."courseId"
    JOIN "User" u ON u."id" = s."studentId"
    WHERE s."id" = ${submissionId} AND s."assignmentId" = ${assignmentId}
    LIMIT 1
  `;

  const submission = submissionRows[0];
  if (!submission) {
    redirect(`/dashboard/${module}/${assignmentId}`);
  }

  if (!isSuperAdmin) {
    if (isTeacher && submission.teacherId !== session.user.id) {
      redirect(`/dashboard/${module}/${assignmentId}`);
    }

    if (isDepartmentHead) {
      const departmentHeadCourseIds = await getDepartmentHeadCourseIds(session.user.id);
      if (!departmentHeadCourseIds.includes(submission.courseId)) {
        redirect(`/dashboard/${module}/${assignmentId}`);
      }
    }

    if (isStudent) {
      if (submission.studentId !== session.user.id) {
        redirect(`/dashboard/${module}/${assignmentId}`);
      }
      if (submission.courseVisibility !== COURSE_VISIBILITY_PUBLISHED) {
        redirect(`/dashboard/${module}/${assignmentId}`);
      }
      const enrolled = await prisma.enrollment.count({
        where: { courseId: submission.courseId, studentId: session.user.id, status: "ACTIVE" },
      });
      if (!enrolled) {
        redirect(`/dashboard/${module}/${assignmentId}`);
      }
    }
  }

  const normalizedStatus = normalizeLifecycleState(submission.status);
  const isPublished = PUBLISHED_STATES.includes(normalizedStatus);
  const canGrade = roleKey === "TEACHER";
  const quizAnswers = Array.isArray(submission.quizAnswers) ? (submission.quizAnswers as Array<Record<string, unknown>>) : [];

  let questionById = new Map<string, { prompt: string; questionType: string; options: string[] }>();
  if (quizAnswers.length) {
    try {
      const questionTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT to_regclass('public."AssignmentQuizQuestion"') IS NOT NULL AS "exists"
      `;
      if (questionTableExists[0]?.exists) {
        const questions = await prisma.$queryRaw<
          Array<{
            id: string;
            prompt: string;
            questionType: string;
            options: Prisma.JsonValue;
          }>
        >`
          SELECT "id","prompt","questionType","options"
          FROM "AssignmentQuizQuestion"
          WHERE "assignmentId" = ${assignmentId}
        `;
        questionById = new Map(
          questions.map((question) => [
            question.id,
            {
              prompt: question.prompt,
              questionType: question.questionType,
              options: Array.isArray(question.options) ? question.options.map((item) => String(item)) : [],
            },
          ])
        );
      }
    } catch {
      questionById = new Map();
    }
  }

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
                Submission Details
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">Attempt {submission.attemptNumber}</h1>
              <p className="brand-muted mt-2 text-sm">{submission.assignmentTitle}</p>
            </div>
            <Link
              href={`/dashboard/${module}/${assignmentId}`}
              aria-label="Back to assignment"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="brand-card p-5">
            <p className="brand-section-title">Submission Summary</p>
            <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
              <p><span className="font-semibold">Student:</span> {(submission.studentName || "Student")} - {submission.studentEmail}</p>
              <p><span className="font-semibold">Status:</span> {normalizedStatus}</p>
              <p><span className="font-semibold">Submitted At:</span> {formatDateTime(submission.submittedAt)}</p>
              <p><span className="font-semibold">Late:</span> {submission.isLate ? `Yes (${submission.lateByMinutes}m)` : "No"}</p>
              <p><span className="font-semibold">Late Penalty:</span> {submission.latePenaltyPct}%</p>
            </div>
          </article>
          <article className="brand-card p-5">
            <p className="brand-section-title">Scores & Feedback</p>
            <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
              <p><span className="font-semibold">Raw Score:</span> {isPublished ? (submission.rawScore ?? "-") : "Pending"}</p>
              <p><span className="font-semibold">Final Score:</span> {isPublished ? (submission.finalScore ?? "-") : "Pending"}</p>
              <p><span className="font-semibold">Graded At:</span> {isPublished ? formatDateTime(submission.gradedAt) : "-"}</p>
              <p><span className="font-semibold">Published At:</span> {isPublished ? formatDateTime(submission.publishedAt) : "-"}</p>
            </div>
          </article>
        </section>

        {quizAnswers.length ? (
          <section className="brand-card p-5">
            <p className="brand-section-title">Attempt Answers</p>
            <div className="mt-3 space-y-3">
              {quizAnswers.map((answer, index) => {
                const questionId = String(answer.questionId ?? "");
                const question = questionById.get(questionId);
                const questionType = question?.questionType ?? "MCQ";
                const selectedIndicesRaw = Array.isArray(answer.selectedOptionIndices)
                  ? answer.selectedOptionIndices
                  : typeof answer.selectedOptionIndex === "number"
                    ? [answer.selectedOptionIndex]
                    : [];
                const selectedIndices = selectedIndicesRaw
                  .map((item) => Number(item))
                  .filter((item) => Number.isInteger(item));
                const shortAnswerText = typeof answer.shortAnswerText === "string" ? answer.shortAnswerText : "";
                const optionLabels = question?.options ?? [];
                const selectedLabels = selectedIndices.map((idx) => optionLabels[idx]).filter(Boolean);

                return (
                  <div key={`${submission.id}-${questionId}-${index}`} className="rounded-md border border-[#dbe9fb] p-3">
                    <p className="text-sm font-semibold text-[#0d3f80]">
                      Q{index + 1}. {question?.prompt ?? "Question removed"}
                    </p>
                    {questionType === "SHORT_ANSWER" ? (
                      <p className="mt-2 text-sm text-[#234f8f]">{shortAnswerText || "No response."}</p>
                    ) : (
                      <p className="mt-2 text-sm text-[#234f8f]">
                        {selectedLabels.length ? selectedLabels.join(", ") : "No option selected."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="brand-card p-5">
            <p className="brand-section-title">Text Response</p>
            {submission.textResponse ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[#0b3e81]">{submission.textResponse}</pre>
            ) : (
              <p className="brand-muted mt-3 text-sm">No text response provided.</p>
            )}
          </article>
          <article className="brand-card p-5">
            <p className="brand-section-title">File Attachment</p>
            {submission.fileUrl ? (
              <div className="mt-3 space-y-2 text-sm text-[#0b3e81]">
                <p><span className="font-semibold">File:</span> {submission.fileName || "Uploaded file"}</p>
                <p><span className="font-semibold">Type:</span> {submission.mimeType || "-"}</p>
                <a
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f518f] underline"
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open file
                </a>
              </div>
            ) : (
              <p className="brand-muted mt-3 text-sm">No file uploaded.</p>
            )}
          </article>
        </section>

        <SubmissionGradePanel
          submissionId={submission.id}
          assignmentId={assignmentId}
          studentId={submission.studentId}
          status={normalizedStatus}
          rawScore={submission.rawScore}
          feedback={submission.feedback}
          canGrade={canGrade}
        />

        <section className="brand-card p-5">
          <p className="brand-section-title">Instructor Feedback</p>
          {isPublished && submission.feedback ? (
            <p className="mt-3 text-sm text-[#0b3e81]">{submission.feedback}</p>
          ) : (
            <p className="brand-muted mt-3 text-sm">No feedback available yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
