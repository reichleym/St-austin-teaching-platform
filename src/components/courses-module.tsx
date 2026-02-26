"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";

type CourseItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  createdAt: string;
  teacher: {
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DISABLED";
  } | null;
  assignmentCount: number;
  enrollmentCount: number;
  myEnrollmentStatus: "ACTIVE" | "DROPPED" | "COMPLETED" | null;
};

type PersonOption = {
  id: string;
  name: string | null;
  email: string;
};

type Props = {
  role: Role;
};

const formatDate = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

export function CoursesModule({ role }: Props) {
  const isSuperAdmin = role === Role.SUPER_ADMIN;
  const isTeacher = role === Role.TEACHER;
  const canManage = isSuperAdmin || isTeacher;

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<PersonOption[]>([]);
  const [students, setStudents] = useState<PersonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [createCode, setCreateCode] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createInfo, setCreateInfo] = useState("");

  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollPending, setEnrollPending] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [enrollInfo, setEnrollInfo] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/courses", { method: "GET" });
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as {
            courses?: CourseItem[];
            teachers?: PersonOption[];
            students?: PersonOption[];
            error?: string;
          })
        : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to load courses.");
        setCourses([]);
        setTeachers([]);
        setStudents([]);
        return;
      }

      setCourses(result.courses ?? []);
      setTeachers(result.teachers ?? []);
      setStudents(result.students ?? []);
    } catch {
      setError("Unable to load courses.");
      setCourses([]);
      setTeachers([]);
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!enrollCourseId && courses.length > 0 && canManage) {
      setEnrollCourseId(courses[0].id);
    }
  }, [canManage, courses, enrollCourseId]);

  const totalEnrollments = useMemo(
    () => courses.reduce((sum, item) => sum + item.enrollmentCount, 0),
    [courses]
  );

  const onCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setCreateInfo("");
    setError("");

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createCode,
          title: createTitle,
          description: createDescription,
          teacherId: isSuperAdmin ? createTeacherId || null : undefined,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to create course.");
        return;
      }

      setCreateInfo("Course created.");
      setCreateCode("");
      setCreateTitle("");
      setCreateDescription("");
      if (isSuperAdmin) {
        setCreateTeacherId("");
      }
      await loadData();
    } catch {
      setError("Unable to create course.");
    } finally {
      setCreatePending(false);
    }
  };

  const onEnrollStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEnrollPending(true);
    setEnrollError("");
    setEnrollInfo("");

    try {
      const response = await fetch("/api/courses/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: enrollCourseId,
          studentId: enrollStudentId,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setEnrollError(result.error ?? "Unable to enroll student.");
        return;
      }

      setEnrollInfo("Student enrolled successfully.");
      setEnrollStudentId("");
      await loadData();
    } catch {
      setEnrollError("Unable to enroll student.");
    } finally {
      setEnrollPending(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="brand-card p-5">
          <p className="brand-section-title">Courses</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{courses.length}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">Total Enrollments</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{totalEnrollments}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">Role</p>
          <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{role}</p>
        </article>
      </div>

      {canManage ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Create Course</p>
          <form className="mt-3 grid gap-4" onSubmit={onCreateCourse}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">Course Code</span>
                <input
                  className="brand-input"
                  value={createCode}
                  onChange={(event) => setCreateCode(event.currentTarget.value)}
                  placeholder="MATH-101"
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Course Title</span>
                <input
                  className="brand-input"
                  value={createTitle}
                  onChange={(event) => setCreateTitle(event.currentTarget.value)}
                  placeholder="Algebra I"
                  required
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="brand-label">Description (optional)</span>
              <textarea
                className="brand-input min-h-[90px]"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.currentTarget.value)}
              />
            </label>

            {isSuperAdmin ? (
              <label className="grid gap-1.5 md:max-w-sm">
                <span className="brand-label">Assign Teacher (optional)</span>
                <select
                  className="brand-input"
                  value={createTeacherId}
                  onChange={(event) => setCreateTeacherId(event.currentTarget.value)}
                >
                  <option value="">No teacher assigned</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {(teacher.name || "Unnamed Teacher") + " - " + teacher.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {createInfo ? <p className="text-sm text-emerald-700">{createInfo}</p> : null}
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={createPending}>
              {createPending ? "Creating..." : "Create Course"}
            </button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Enroll Student</p>
          <form className="mt-3 grid gap-4 md:grid-cols-3" onSubmit={onEnrollStudent}>
            <label className="grid gap-1.5">
              <span className="brand-label">Course</span>
              <select
                className="brand-input"
                value={enrollCourseId}
                onChange={(event) => setEnrollCourseId(event.currentTarget.value)}
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Student</span>
              <select
                className="brand-input"
                value={enrollStudentId}
                onChange={(event) => setEnrollStudentId(event.currentTarget.value)}
                required
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {(student.name || "Unnamed Student") + " - " + student.email}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={enrollPending}>
                {enrollPending ? "Enrolling..." : "Enroll"}
              </button>
            </div>
          </form>
          {enrollError ? <p className="mt-2 text-sm text-red-600">{enrollError}</p> : null}
          {enrollInfo ? <p className="mt-2 text-sm text-emerald-700">{enrollInfo}</p> : null}
        </section>
      ) : null}

      <section className="brand-card overflow-x-auto p-5">
        <p className="brand-section-title">Course List</p>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {isLoading ? <p className="brand-muted mt-3 text-sm">Loading courses...</p> : null}

        {!isLoading && courses.length ? (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Teacher</th>
                <th className="px-3 py-2 font-semibold">Enrollments</th>
                <th className="px-3 py-2 font-semibold">Assignments</th>
                <th className="px-3 py-2 font-semibold">Created</th>
                {role === Role.STUDENT ? <th className="px-3 py-2 font-semibold">My Status</th> : null}
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                  <td className="px-3 py-2 font-semibold">{course.code}</td>
                  <td className="px-3 py-2">
                    <p>{course.title}</p>
                    {course.description ? <p className="mt-1 text-xs text-[#3768ac]">{course.description}</p> : null}
                  </td>
                  <td className="px-3 py-2">{course.teacher?.name ?? course.teacher?.email ?? "Unassigned"}</td>
                  <td className="px-3 py-2">{course.enrollmentCount}</td>
                  <td className="px-3 py-2">{course.assignmentCount}</td>
                  <td className="px-3 py-2">{formatDate(course.createdAt)}</td>
                  {role === Role.STUDENT ? <td className="px-3 py-2">{course.myEnrollmentStatus ?? "-"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {!isLoading && !courses.length ? (
          <p className="brand-muted mt-3 text-sm">
            {role === Role.STUDENT
              ? "You are not enrolled in any courses yet."
              : "No courses found yet. Create your first course above."}
          </p>
        ) : null}
      </section>
    </section>
  );
}
