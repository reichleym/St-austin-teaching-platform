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
      <section className="brand-card p-5">
        <p className="brand-section-title">Ask Your Teacher</p>
        <div className="mt-4 space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#dbe9fb] bg-white/80 p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── No courses ──
  if (!loading && courses.length === 0) {
    return (
      <section className="brand-card p-5">
        <p className="brand-section-title">Ask Your Teacher</p>
        <div className="brand-panel mt-4 py-12 text-center">
          <div className="mb-3 text-3xl">📚</div>
          <p className="text-base font-semibold text-[#0b3e81]">No enrolled courses</p>
          <p className="brand-muted mt-1 text-sm">
            Enroll in a course to ask your teacher questions.
          </p>
        </div>
      </section>
    );
  }

  // ── Course selected → show thread list ──
  if (selectedCourseId) {
    return (
      <div>
        {/* Course breadcrumb — only shown if more than one course */}
        {courses.length > 1 && (
          <button
            onClick={() => setSelectedCourseId(null)}
            className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-[#1f518f] transition-colors hover:text-[#083e8a]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">{selectedCourse?.code}</span>
            <span className="text-[#6c8fbe]">— {selectedCourse?.title}</span>
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
    <section className="">
      <div className="mb-5">
        <p className="brand-section-title">Ask Your Teacher</p>
        <p className="brand-muted mt-2 text-sm">Select a course to view or post questions</p>
      </div>

      <div className="space-y-2">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setSelectedCourseId(course.id)}
            className="group w-full rounded-xl border border-[#dbe9fb] bg-white/80 p-4 text-left transition-all hover:border-[#93b9e8] hover:shadow-[0_8px_24px_rgba(11,62,129,0.08)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="brand-chip">{course.code}</span>
                <span className="font-semibold text-[#0b3e81] transition-colors group-hover:text-[#083e8a]">
                  {course.title}
                </span>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-[#6c8fbe] transition-colors group-hover:text-[#083e8a]"
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
    </section>
  );
}
