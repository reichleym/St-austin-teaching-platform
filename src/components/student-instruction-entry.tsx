"use client";
// src/components/student-instruction-entry.tsx
// Students pick a course first (reusing /api/courses?scope=enrolled),
// then see the InstructionThreadsModule for that course.

import { useEffect, useState } from "react";
import { InstructionThreadsModule } from "./instruction-threads-module";

type Course = {
  id: string;
  code: string;
  title: string;
  myEnrollmentStatus: string | null;
};

type Props = {
  currentUserId: string;
  currentUserRole: string;
};

export function StudentInstructionEntry({ currentUserId, currentUserRole }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses?scope=enrolled")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.courses)) {
          setCourses(
            (data.courses as Course[]).filter((c) => c.myEnrollmentStatus === "ACTIVE")
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-select if only one course
  useEffect(() => {
    if (!loading && courses.length === 1 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [loading, courses, selectedCourseId]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
      </div>
    );
  }

  // ── No courses ──
  if (!loading && courses.length === 0) {
    return (
      <div className="rounded-xl border border-[#9bc4f6] bg-[#e8f3ff] py-16 text-center">
        <div className="mb-3 text-4xl">📚</div>
        <p className="font-medium text-[#07316b]">No enrolled courses</p>
        <p className="mt-1 text-sm text-[#3b6aa5]">
          Enroll in a course to ask your teacher questions.
        </p>
      </div>
    );
  }

  // ── Course selected → show thread list ──
  if (selectedCourseId) {
    {console.log("hello")}
    return (
      <div>
        {/* Course breadcrumb — only shown if more than one course */}
        {courses.length > 1 && (
          <button
            onClick={() => setSelectedCourseId(null)}
            className="mb-5 flex items-center gap-1 text-sm text-[#2b5699] transition-colors hover:text-[#07316b]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">{selectedCourse?.code}</span>
            <span className="text-slate-400">— {selectedCourse?.title}</span>
          </button>
        )}

        <InstructionThreadsModule
          courseId={selectedCourseId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </div>
    );
  }

  // ── Course picker ──
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-[#07316b]">Ask Your Teacher</h3>
        <p className="mt-0.5 text-xs text-[#3b6aa5]">Select a course to view or post questions</p>
      </div>

      <div className="space-y-2">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setSelectedCourseId(course.id)}
            className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#9bc4f6] hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded bg-[#e8f3ff] px-2 py-0.5 text-xs font-semibold text-[#2b5699]">
                  {course.code}
                </span>
                <span className="font-semibold text-[#07316b] transition-colors group-hover:text-[#083e8a]">
                  {course.title}
                </span>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-[#07316b]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
