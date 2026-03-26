"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import { translateContent } from "@/lib/i18n";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

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

type ProgressResponse = {
  courses?: CourseOption[];
  students?: StudentOption[];
  progress?: ProgressPayload | null;
  error?: string;
};

type Props = {
  role: AppRole;
  courseId?: string;
};

const formatStudentLabel = (student: StudentOption) => `${student.name || "Student"} - ${student.email}`;

export function StudentProgressModule({ role, courseId }: Props) {
  const { t, language } = useLanguage();
  const canSelectStudent = role === "TEACHER" || role === "SUPER_ADMIN" || role === "ADMIN";
  const isStudent = role === "STUDENT";
  const canPickCourse = !courseId;
  const searchParams = useSearchParams();
  const queryStudentId = searchParams.get("studentId")?.trim() ?? "";
  const queryCourseId = searchParams.get("courseId")?.trim() ?? "";

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingCompletionKey, setPendingCompletionKey] = useState("");
  const [completionDialog, setCompletionDialog] = useState<
    | null
    | { type: "course" }
    | { type: "module"; moduleId: string; moduleTitle: string }
  >(null);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/progress", { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ProgressResponse) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadProgressData"));
      }
      const nextCourses = result.courses ?? [];
      setCourses(nextCourses);
      if (isStudent && nextCourses.length) {
        setSelectedCourseId((prev) => prev || nextCourses[0].id);
      } else if (!courseId && queryCourseId && nextCourses.some((item) => item.id === queryCourseId)) {
        setSelectedCourseId((prev) => prev || queryCourseId);
      }
    } catch {
      setError(t("error.loadProgressData"));
    } finally {
      setLoading(false);
    }
  }, [courseId, isStudent, queryCourseId, t]);

  const loadCourse = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/progress?courseId=${encodeURIComponent(courseId)}`, { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ProgressResponse) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadCourseProgress"));
      }
      const courseStudents = result.students ?? [];
      setStudents(courseStudents);
      if (isStudent) {
        setProgress(result.progress ?? null);
      } else {
        setProgress(null);
      }
      if (canSelectStudent) {
        setSelectedStudentId((prev) => {
          if (!courseStudents.length) return "";
          if (queryStudentId && courseStudents.some((student) => student.id === queryStudentId)) return queryStudentId;
          if (prev && courseStudents.some((student) => student.id === prev)) return prev;
          return courseStudents[0].id;
        });
      }
    } catch {
      setError(t("error.loadCourseProgress"));
    } finally {
      setLoading(false);
    }
  }, [canSelectStudent, isStudent, queryStudentId, t]);

  const loadStudentProgress = useCallback(async (courseId: string, studentId: string) => {
    if (!courseId || !studentId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/progress?courseId=${encodeURIComponent(courseId)}&studentId=${encodeURIComponent(studentId)}`,
        { method: "GET" }
      );
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ProgressResponse) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadStudentProgress"));
      }
      setProgress(result.progress ?? null);
      setStudents(result.students ?? []);
    } catch {
      setError(t("error.loadStudentProgress"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const applyCompletion = async (payload: { courseId?: string; moduleId?: string }) => {
    if (!selectedCourseId || !selectedStudentId) return;
    const key = payload.moduleId ? `module:${payload.moduleId}` : "course";
    setPendingCompletionKey(key);
    setError("");
    try {
      const response = await fetch("/api/courses/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: payload.courseId,
          moduleId: payload.moduleId,
          studentId: selectedStudentId,
          completed: true,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateCompletion"));
        return;
      }
      await loadStudentProgress(selectedCourseId, selectedStudentId);
    } catch {
      setError(t("error.updateCompletion"));
    } finally {
      setPendingCompletionKey("");
    }
  };

  useEffect(() => {
    if (courseId) {
      setSelectedCourseId(courseId);
    }
  }, [courseId]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedCourseId) return;
    void loadCourse(selectedCourseId);
  }, [loadCourse, selectedCourseId]);

  useEffect(() => {
    if (!canSelectStudent) return;
    if (!selectedCourseId || !selectedStudentId) {
      setProgress(null);
      return;
    }
    void loadStudentProgress(selectedCourseId, selectedStudentId);
  }, [canSelectStudent, loadStudentProgress, selectedCourseId, selectedStudentId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <p className="brand-section-title">{t("progress.title")}</p>
        <p className="brand-muted mt-2 text-sm">
          {canSelectStudent
            ? canPickCourse
              ? t("progress.pickCourseStudent")
              : t("progress.selectStudentPrompt")
            : t("progress.trackOwn")}
        </p>
        <ToastMessage type="error" message={error} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {canPickCourse ? (
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.course")}</span>
              <select
                className="brand-input"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.currentTarget.value)}
              >
                <option value="">{t("progress.selectCourse")}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {translateContent(language, course.title)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-1.5">
              <span className="brand-label">{t("label.course")}</span>
              <div className="brand-input flex items-center bg-[#f4f9ff] text-[#0b3e81]">
                {selectedCourse ? (
                  `${selectedCourse.code} - ${translateContent(language, selectedCourse.title)}`
                ) : (
                  <span className="inline-flex items-center">
                    <span className="h-4 w-44 animate-pulse rounded bg-slate-200" />
                    <span className="sr-only">{t("common.loadingCourse")}</span>
                  </span>
                )}
              </div>
            </div>
          )}
          {canSelectStudent ? (
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.student")}</span>
              <select
                className="brand-input"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.currentTarget.value)}
                disabled={!selectedCourseId || !students.length}
              >
                <option value="">{t("progress.selectStudent")}</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatStudentLabel(student)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="brand-card p-5">
          <LoadingIndicator label={t("progress.loading")} />
        </section>
      ) : null}

      {!loading && selectedCourseId && progress ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("label.course")}</p>
              <p className="mt-2 text-sm font-semibold text-[#0b3e81]">
                {progress.course.code} - {translateContent(language, progress.course.title)}
              </p>
              <p className="brand-muted mt-1 text-xs">
                {canSelectStudent && selectedStudent ? formatStudentLabel(selectedStudent) : t("progress.yourProgress")}
              </p>
              {canSelectStudent && selectedStudent ? (
                <button
                  type="button"
                  className="mt-3 rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f] disabled:opacity-60"
                  disabled={!selectedStudentId || pendingCompletionKey === "course"}
                  onClick={() => setCompletionDialog({ type: "course" })}
                >
                  {pendingCompletionKey === "course" ? t("status.saving") : t("progress.markCourseComplete")}
                </button>
              ) : null}
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("progress.completion")}</p>
              <p className="mt-2 text-3xl font-bold text-[#0b3e81]">{progress.totals.progressPercent}%</p>
              <p className="brand-muted mt-1 text-xs">{t("progress.overallCourseCompletion")}</p>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">{t("progress.lessons")}</p>
              <p className="mt-2 text-3xl font-bold text-[#0b3e81]">
                {progress.totals.completedLessons}/{progress.totals.totalLessons}
              </p>
              <p className="brand-muted mt-1 text-xs">{t("progress.lessonsCompleted")}</p>
            </article>
          </section>

          <section className="brand-card p-5">
            <p className="brand-section-title">{t("progress.moduleProgress")}</p>
            {progress.modules.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                      <th className="px-3 py-2 font-semibold">{t("label.module")}</th>
                      <th className="px-3 py-2 font-semibold">{t("progress.lessons")}</th>
                      <th className="px-3 py-2 font-semibold">{t("engagement.completed")}</th>
                      <th className="px-3 py-2 font-semibold">{t("table.progress")}</th>
                      <th className="px-3 py-2 font-semibold">{t("progress.access")}</th>
                      {canSelectStudent ? <th className="px-3 py-2 font-semibold">{t("table.actions")}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {progress.modules.map((module) => (
                      <tr key={module.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                        <td className="px-3 py-2 font-semibold">{module.position + 1}. {translateContent(language, module.title)}</td>
                        <td className="px-3 py-2">{module.totalLessons}</td>
                        <td className="px-3 py-2">{module.completedLessons}</td>
                        <td className="px-3 py-2">{module.progressPercent}%</td>
                        <td className="px-3 py-2">{t(`progress.access.${module.accessState}`)}</td>
                        {canSelectStudent ? (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f] disabled:opacity-60"
                              disabled={!selectedStudentId || pendingCompletionKey === `module:${module.id}`}
                              onClick={() =>
                                setCompletionDialog({ type: "module", moduleId: module.id, moduleTitle: module.title })
                              }
                            >
                              {pendingCompletionKey === `module:${module.id}` ? t("status.saving") : t("progress.markModuleComplete")}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="brand-muted mt-3 text-sm">{t("progress.noLessons")}</p>
            )}
          </section>
        </>
      ) : null}

      {!loading && selectedCourseId && canSelectStudent && students.length === 0 ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">{t("progress.noActiveStudents")}</p>
        </section>
      ) : null}

      {!loading && selectedCourseId && !progress && (!canSelectStudent || students.length > 0) ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">
            {canSelectStudent && !selectedStudentId
              ? t("progress.selectStudentToView")
              : t("progress.awaitingData")}
          </p>
        </section>
      ) : null}

      {!loading && !selectedCourseId && courses.length === 0 && canPickCourse ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">{t("progress.noCourses")}</p>
        </section>
      ) : null}
      <ConfirmModal
        open={!!completionDialog}
        title={t("progress.confirmTitle")}
        message={
          completionDialog
            ? completionDialog.type === "course"
              ? t("progress.confirmCourseMessage", {
                  course: selectedCourse ? `${selectedCourse.code} - ${translateContent(language, selectedCourse.title)}` : "",
                  student: selectedStudent ? formatStudentLabel(selectedStudent) : t("label.student"),
                })
              : t("progress.confirmModuleMessage", {
                  module: translateContent(language, completionDialog.moduleTitle),
                  student: selectedStudent ? formatStudentLabel(selectedStudent) : t("label.student"),
                })
            : ""
        }
        confirmLabel={t("action.markComplete")}
        onCancel={() => setCompletionDialog(null)}
        onConfirm={() => {
          const dialog = completionDialog;
          setCompletionDialog(null);
          if (!dialog) return;
          if (dialog.type === "course") {
            void applyCompletion({ courseId: selectedCourseId });
            return;
          }
          void applyCompletion({ moduleId: dialog.moduleId });
        }}
      />
    </section>
  );
}
