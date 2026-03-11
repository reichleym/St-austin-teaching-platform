"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";

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

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/progress", { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ProgressResponse) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load progress data.");
      }
      const nextCourses = result.courses ?? [];
      setCourses(nextCourses);
      if (isStudent && nextCourses.length) {
        setSelectedCourseId((prev) => prev || nextCourses[0].id);
      } else if (!courseId && queryCourseId && nextCourses.some((item) => item.id === queryCourseId)) {
        setSelectedCourseId((prev) => prev || queryCourseId);
      }
    } catch {
      setError("Unable to load progress data.");
    } finally {
      setLoading(false);
    }
  }, [courseId, isStudent, queryCourseId]);

  const loadCourse = useCallback(async (courseId: string) => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/progress?courseId=${encodeURIComponent(courseId)}`, { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ProgressResponse) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load course progress.");
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
      setError("Unable to load course progress.");
    } finally {
      setLoading(false);
    }
  }, [canSelectStudent, isStudent, queryStudentId]);

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
        setError(result.error ?? "Unable to load student progress.");
      }
      setProgress(result.progress ?? null);
      setStudents(result.students ?? []);
    } catch {
      setError("Unable to load student progress.");
    } finally {
      setLoading(false);
    }
  }, []);

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
        <p className="brand-section-title">Student Progress</p>
        <p className="brand-muted mt-2 text-sm">
          {canSelectStudent
            ? canPickCourse
              ? "Pick a course and student to review their progress."
              : "Select a student to review their progress in this course."
            : "Track your learning progress across lessons."}
        </p>
        <ToastMessage type="error" message={error} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {canPickCourse ? (
            <label className="grid gap-1.5">
              <span className="brand-label">Course</span>
              <select
                className="brand-input"
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.currentTarget.value)}
              >
                <option value="">Select a course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-1.5">
              <span className="brand-label">Course</span>
              <div className="brand-input flex items-center bg-[#f4f9ff] text-[#0b3e81]">
                {selectedCourse ? `${selectedCourse.code} - ${selectedCourse.title}` : "Loading course..."}
              </div>
            </div>
          )}
          {canSelectStudent ? (
            <label className="grid gap-1.5">
              <span className="brand-label">Student</span>
              <select
                className="brand-input"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.currentTarget.value)}
                disabled={!selectedCourseId || !students.length}
              >
                <option value="">Select a student</option>
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
          <LoadingIndicator label="Loading progress..." />
        </section>
      ) : null}

      {!loading && selectedCourseId && progress ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="brand-card p-5">
              <p className="brand-section-title">Course</p>
              <p className="mt-2 text-sm font-semibold text-[#0b3e81]">
                {progress.course.code} - {progress.course.title}
              </p>
              <p className="brand-muted mt-1 text-xs">
                {canSelectStudent && selectedStudent ? formatStudentLabel(selectedStudent) : "Your progress"}
              </p>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">Completion</p>
              <p className="mt-2 text-3xl font-bold text-[#0b3e81]">{progress.totals.progressPercent}%</p>
              <p className="brand-muted mt-1 text-xs">Overall course completion</p>
            </article>
            <article className="brand-card p-5">
              <p className="brand-section-title">Lessons</p>
              <p className="mt-2 text-3xl font-bold text-[#0b3e81]">
                {progress.totals.completedLessons}/{progress.totals.totalLessons}
              </p>
              <p className="brand-muted mt-1 text-xs">Lessons completed</p>
            </article>
          </section>

          <section className="brand-card p-5">
            <p className="brand-section-title">Module Progress</p>
            {progress.modules.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                      <th className="px-3 py-2 font-semibold">Module</th>
                      <th className="px-3 py-2 font-semibold">Lessons</th>
                      <th className="px-3 py-2 font-semibold">Completed</th>
                      <th className="px-3 py-2 font-semibold">Progress</th>
                      <th className="px-3 py-2 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.modules.map((module) => (
                      <tr key={module.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                        <td className="px-3 py-2 font-semibold">{module.position + 1}. {module.title}</td>
                        <td className="px-3 py-2">{module.totalLessons}</td>
                        <td className="px-3 py-2">{module.completedLessons}</td>
                        <td className="px-3 py-2">{module.progressPercent}%</td>
                        <td className="px-3 py-2">{module.accessState}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="brand-muted mt-3 text-sm">No lessons configured for this course yet.</p>
            )}
          </section>
        </>
      ) : null}

      {!loading && selectedCourseId && canSelectStudent && students.length === 0 ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">No active students are enrolled in this course yet.</p>
        </section>
      ) : null}

      {!loading && selectedCourseId && !progress && (!canSelectStudent || students.length > 0) ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">
            {canSelectStudent && !selectedStudentId
              ? "Select a student to view progress."
              : "Progress data will appear once the course has lessons and completions."}
          </p>
        </section>
      ) : null}

      {!loading && !selectedCourseId && courses.length === 0 && canPickCourse ? (
        <section className="brand-card p-5">
          <p className="brand-muted text-sm">No courses are available for progress tracking yet.</p>
        </section>
      ) : null}
    </section>
  );
}
