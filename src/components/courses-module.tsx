"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

type CourseItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  visibility: "DRAFT" | "PUBLISHED";
  accessState: "DRAFT" | "LOCKED" | "ACTIVE" | "READ_ONLY" | "SCHEDULED";
  createdAt: string;
  teacher: {
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DISABLED";
  } | null;
  assignmentCount: number;
  enrollmentCount: number;
  enrolledStudents: Array<{
    id: string;
    name: string | null;
    email: string;
    status: "ACTIVE" | "DROPPED" | "COMPLETED";
  }>;
  departmentHeads: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
  myEnrollmentStatus: "ACTIVE" | "DROPPED" | "COMPLETED" | null;
  myEnrollmentRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  courseProgressPercent: number | null;
};

type PersonOption = {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  status?: "ACTIVE" | "DISABLED";
  studentId?: string | null;
};

type Props = {
  role: AppRole;
  viewMode?: "all" | "enrolled";
  showModuleManagement?: boolean;
};

const formatRoleLabel = (value: string) => value.replace(/_/g, " ");

const toDateInputValue = (input: string | null) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatDurationYmd = (startIso: string | null, endIso: string | null) => {
  if (!startIso || !endIso) return "-";
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  if (end < start) return "0Y 0M 0D";

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  let years = target.getFullYear() - cursor.getFullYear();
  const yearCandidate = new Date(cursor);
  yearCandidate.setFullYear(cursor.getFullYear() + years);
  if (yearCandidate > target) {
    years -= 1;
  }
  cursor.setFullYear(cursor.getFullYear() + years);

  let months = 0;
  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next > target) break;
    months += 1;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.floor((target.getTime() - cursor.getTime()) / dayMs));

  return `${years}Y ${months}M ${days}D`;
};

function PersonLabel({ person }: { person: PersonOption }) {
  return <>{(person.name || "Unnamed") + " - " + person.email + (person.status === "DISABLED" ? " (DISABLED)" : "")}</>;
}

export function CoursesModule({ role, viewMode = "all", showModuleManagement = true }: Props) {
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isDepartmentHead = role === "DEPARTMENT_HEAD";
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
  const canManage = isSuperAdmin;
  const studentSimpleView = isStudent;

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<PersonOption[]>([]);
  const [students, setStudents] = useState<PersonOption[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<PersonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editCourseId, setEditCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [createDepartmentHeadIds, setCreateDepartmentHeadIds] = useState<string[]>([]);
  const [createStudentSearch, setCreateStudentSearch] = useState("");
  const [createPending, setCreatePending] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [editDepartmentHeadIds, setEditDepartmentHeadIds] = useState<string[]>([]);
  const [editPending, setEditPending] = useState(false);

  const [deletePendingCourseId, setDeletePendingCourseId] = useState("");
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<{ id: string; label: string } | null>(null);

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [enrollPendingCourseId, setEnrollPendingCourseId] = useState("");
  const availableDepartmentHeadIds = useMemo(
    () => new Set(departmentHeads.map((head) => head.id)),
    [departmentHeads]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const endpoint = viewMode === "enrolled" ? "/api/courses?scope=enrolled" : "/api/courses";
      const response = await fetch(endpoint, { method: "GET" });
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as {
          courses?: CourseItem[];
          teachers?: PersonOption[];
          students?: PersonOption[];
          departmentHeads?: PersonOption[];
          error?: string;
        })
        : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to load courses.");
      }

      setCourses(result.courses ?? []);
      setTeachers(result.teachers ?? []);
      setStudents(result.students ?? []);
      setDepartmentHeads(result.departmentHeads ?? []);
    } catch {
      setError("Unable to load courses.");
      setCourses([]);
      setTeachers([]);
      setStudents([]);
      setDepartmentHeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, viewMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editCourseId) return;
    const selected = courses.find((item) => item.id === editCourseId);
    if (!selected) return;

    setEditTitle(selected.title);
    setEditDescription(selected.description ?? "");
    setEditStartDate(toDateInputValue(selected.startDate));
    setEditEndDate(toDateInputValue(selected.endDate));
    setEditVisibility(selected.visibility);
    setEditTeacherId(selected.teacher?.id ?? "");
    setEditStudentIds(selected.enrolledStudents.map((item) => item.id));
    setEditDepartmentHeadIds(selected.departmentHeads.map((item) => item.id));
  }, [courses, editCourseId]);

  const totalEnrollments = useMemo(() => courses.reduce((sum, item) => sum + item.enrollmentCount, 0), [courses]);

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (filterCourseId && course.id !== filterCourseId) return false;
        if (filterTeacherId && course.teacher?.id !== filterTeacherId) return false;
        if (filterStudentId && !course.enrolledStudents.some((student) => student.id === filterStudentId)) return false;
        return true;
      }),
    [courses, filterCourseId, filterStudentId, filterTeacherId]
  );

  const filteredCreateStudents = useMemo(() => {
    const query = createStudentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const name = (student.name ?? "").toLowerCase();
      const email = (student.email ?? "").toLowerCase();
      const phone = (student.phone ?? "").toLowerCase();
      const studentId = (student.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [createStudentSearch, students]);

  const onCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setError("");

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          description: createDescription,
          startDate: createStartDate,
          endDate: createEndDate,
          visibility: createVisibility,
          teacherId: createTeacherId || null,
          studentIds: createStudentIds,
          departmentHeadIds: createDepartmentHeadIds,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to create course.");
        return;
      }

      setShowCreate(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateStartDate("");
      setCreateEndDate("");
      setCreateVisibility("DRAFT");
      setCreateTeacherId("");
      setCreateStudentIds([]);
      setCreateDepartmentHeadIds([]);
      setCreateStudentSearch("");
      await loadData();
    } catch {
      setError("Unable to create course.");
    } finally {
      setCreatePending(false);
    }
  };

  const onUpdateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editCourseId) return;

    setEditPending(true);
    setError("");
    const nextDepartmentHeadIds =
      availableDepartmentHeadIds.size > 0
        ? editDepartmentHeadIds.filter((id) => availableDepartmentHeadIds.has(id))
        : editDepartmentHeadIds;

    try {
      const response = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: editCourseId,
          title: editTitle,
          description: editDescription,
          startDate: editStartDate,
          endDate: editEndDate,
          visibility: editVisibility,
          teacherId: editTeacherId || null,
          studentIds: editStudentIds,
          departmentHeadIds: nextDepartmentHeadIds,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to update course.");
        return;
      }

      setEditCourseId("");
      await loadData();
    } catch {
      setError("Unable to update course.");
    } finally {
      setEditPending(false);
    }
  };

  const onDeleteCourse = async (courseId: string) => {
    setDeletePendingCourseId(courseId);
    setError("");

    try {
      const response = await fetch("/api/courses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to delete course.");
        return;
      }

      await loadData();
    } catch {
      setError("Unable to delete course.");
    } finally {
      setDeletePendingCourseId("");
    }
  };

  const toggleCreateStudent = (studentId: string) => {
    setCreateStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const toggleCreateDepartmentHead = (departmentHeadId: string) => {
    setCreateDepartmentHeadIds((prev) =>
      prev.includes(departmentHeadId) ? prev.filter((id) => id !== departmentHeadId) : [...prev, departmentHeadId]
    );
  };

  const toggleEditStudent = (studentId: string) => {
    setEditStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const toggleEditDepartmentHead = (departmentHeadId: string) => {
    setEditDepartmentHeadIds((prev) =>
      prev.includes(departmentHeadId) ? prev.filter((id) => id !== departmentHeadId) : [...prev, departmentHeadId]
    );
  };

  const selectAllEditStudents = () => {
    setEditStudentIds(students.map((student) => student.id));
  };

  const clearEditStudents = () => {
    setEditStudentIds([]);
  };

  const onRequestEnrollment = async (courseId: string) => {
    setEnrollPendingCourseId(courseId);
    setError("");
    try {
      const response = await fetch("/api/courses/enrollment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to submit enrollment request.");
        return;
      }
      await loadData();
    } catch {
      setError("Unable to submit enrollment request.");
    } finally {
      setEnrollPendingCourseId("");
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
          <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{formatRoleLabel(role)}</p>
        </article>
      </div>
      <section className="brand-card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="brand-section-title">Course List</p>
          {canManage ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/courses/enrollment-requests"
                className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
              >
                Enrollment Requests
              </Link>
              <button className="btn-brand-primary px-4 py-2 text-sm font-semibold" onClick={() => setShowCreate(true)}>
                Create Course
              </button>
            </div>
          ) : null}
        </div>

        {canManage ? (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="brand-label">Filter by Course</span>
              <select className="brand-input" value={filterCourseId} onChange={(event) => setFilterCourseId(event.currentTarget.value)}>
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Filter by Teacher</span>
              <select className="brand-input" value={filterTeacherId} onChange={(event) => setFilterTeacherId(event.currentTarget.value)}>
                <option value="">All teachers</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {(teacher.name || "Unnamed Teacher") + " - " + teacher.email + (teacher.status === "DISABLED" ? " (DISABLED)" : "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Filter by Student</span>
              <select className="brand-input" value={filterStudentId} onChange={(event) => setFilterStudentId(event.currentTarget.value)}>
                <option value="">All students</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {(student.name || "Unnamed Student") +
                      " - " +
                      (student.studentId ? `${student.studentId} - ` : "") +
                      student.email +
                      (student.status === "DISABLED" ? " (DISABLED)" : "")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <ToastMessage type="error" message={error} />
        {isLoading ? <div className="mt-3"><LoadingIndicator label="Loading courses..." /></div> : null}

        {!isLoading && filteredCourses.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Duration</th>
                  <th className="px-3 py-2 font-semibold">Teacher</th>
                  {!studentSimpleView ? <th className="px-3 py-2 font-semibold">Department Heads</th> : null}
                  {!studentSimpleView ? <th className="px-3 py-2 font-semibold">Visibility</th> : null}
                  {!studentSimpleView ? <th className="px-3 py-2 font-semibold">Enrollments</th> : null}
                  {isStudent && viewMode === "enrolled" ? <th className="px-3 py-2 font-semibold">Progress</th> : null}
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <Fragment key={course.id}>
                    <tr className="border-b border-[#e7f0fc] text-[#0d3f80]">
                      <td className="px-3 py-2 font-semibold">{course.code}</td>
                      <td className="px-3 py-2">
                        <p>{course.title}</p>
                        {course.description ? <p className="mt-1 text-xs text-[#3768ac]">{course.description}</p> : null}
                      </td>
                      <td className="px-3 py-2">
                        {formatDurationYmd(course.startDate, course.endDate)}
                      </td>
                      <td className="px-3 py-2">{course.teacher?.name ?? course.teacher?.email ?? "Unassigned"}</td>
                      {!studentSimpleView ? (
                        <td className="px-3 py-2">
                          {course.departmentHeads.length
                            ? course.departmentHeads.map((head) => head.name || head.email).join(", ")
                            : "-"}
                        </td>
                      ) : null}
                      {!studentSimpleView ? <td className="px-3 py-2">{course.visibility}</td> : null}
                      {!studentSimpleView ? <td className="px-3 py-2">{course.enrollmentCount}</td> : null}
                      {isStudent && viewMode === "enrolled" ? (
                        <td className="px-3 py-2">{course.courseProgressPercent ?? 0}%</td>
                      ) : null}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isStudent && viewMode === "all" ? (
                            <button
                              type="button"
                              className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f] disabled:opacity-60"
                              disabled={
                                enrollPendingCourseId === course.id ||
                                course.myEnrollmentStatus === "ACTIVE" ||
                                course.myEnrollmentRequestStatus === "PENDING"
                              }
                              onClick={() => void onRequestEnrollment(course.id)}
                            >
                              {course.myEnrollmentStatus === "ACTIVE"
                                ? "Enrolled"
                                : course.myEnrollmentRequestStatus === "PENDING"
                                  ? "Request Pending"
                                  : enrollPendingCourseId === course.id
                                    ? "Requesting..."
                                    : "Enroll Now"}
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/dashboard/${viewMode === "enrolled" ? "learning" : "courses"}/${course.id}`}
                                className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                              >
                                {canManage ? "Manage Course" : "Manage Course"}
                              </Link>
                              {showModuleManagement && canManage ? (
                                <Link
                                  href={`/dashboard/courses/${course.id}/structure`}
                                  className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                                >
                                  Manage Modules
                                </Link>
                              ) : null}
                              {canManage ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeleteCourse({
                                      id: course.id,
                                      label: `${course.code} - ${course.title}`,
                                    })
                                  }
                                  disabled={deletePendingCourseId === course.id}
                                  className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                                >
                                  {deletePendingCourseId === course.id ? "Deleting..." : "Delete"}
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && !filteredCourses.length ? (
          <p className="brand-muted mt-3 text-sm">
            {isStudent && viewMode === "enrolled"
              ? "You are not enrolled in any courses yet."
              : isStudent
                ? "No published courses available right now."
                : "No courses match the current filters."}
          </p>
        ) : null}
      </section>

      {canManage && showCreate ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
          <section className="brand-card w-full max-w-5xl p-5">
            <p className="brand-section-title">Create Course</p>
            <form className="mt-3 grid gap-4" onSubmit={onCreateCourse}>
              <label className="grid gap-1.5">
                <span className="brand-label">Course Title</span>
                <input className="brand-input" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} maxLength={120} required />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="brand-label">Start Date</span>
                  <input className="brand-input" type="date" value={createStartDate} onChange={(event) => setCreateStartDate(event.currentTarget.value)} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">End Date</span>
                  <input className="brand-input" type="date" value={createEndDate} min={createStartDate || undefined} onChange={(event) => setCreateEndDate(event.currentTarget.value)} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Visibility</span>
                  <select className="brand-input" value={createVisibility} onChange={(event) => setCreateVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 md:max-w-sm">
                <span className="brand-label">Assign Teacher</span>
                <select className="brand-input" value={createTeacherId} onChange={(event) => setCreateTeacherId(event.currentTarget.value)}>
                  <option value="">No teacher assigned</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      <PersonLabel person={teacher} />
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-1.5">
                <span className="brand-label">Assign Department Heads</span>
                <div className="max-h-40 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                  {departmentHeads.length ? (
                    departmentHeads.map((head) => (
                    <label key={head.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                      <input
                        type="checkbox"
                        checked={createDepartmentHeadIds.includes(head.id)}
                        onChange={() => toggleCreateDepartmentHead(head.id)}
                      />
                      <span>{(head.name || "Unnamed") + " - " + head.email + (head.status === "DISABLED" ? " (DISABLED)" : "")}</span>
                    </label>
                  ))
                  ) : (
                    <p className="text-sm text-[#3f70ae]">No department heads found.</p>
                  )}
                </div>
              </div>
              <label className="grid gap-1.5">
                <span className="brand-label">Description (optional)</span>
                <textarea className="brand-input min-h-[90px]" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} maxLength={2000} />
              </label>
              <div className="grid gap-1.5">
                <span className="brand-label">Enroll Students During Creation</span>
                <input
                  className="brand-input"
                  placeholder="Search by name, student ID, phone, or email"
                  value={createStudentSearch}
                  onChange={(event) => setCreateStudentSearch(event.currentTarget.value)}
                />
                <div className="max-h-52 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                  {filteredCreateStudents.length ? (
                    filteredCreateStudents.map((student) => (
                      <label key={student.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                        <input
                          type="checkbox"
                          checked={createStudentIds.includes(student.id)}
                          onChange={() => toggleCreateStudent(student.id)}
                        />
                        <span>
                          {(student.name || "Unnamed Student") +
                            " - " +
                            (student.studentId ? `${student.studentId} - ` : "") +
                            (student.phone ? `${student.phone} - ` : "") +
                            student.email +
                            (student.status === "DISABLED" ? " (DISABLED)" : "")}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-[#3f70ae]">
                      {students.length ? "No students match the search." : "No students found."}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={createPending}>
                  {createPending ? "Creating..." : "Create Course"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {canManage && editCourseId ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Edit Course</p>
          <form className="mt-3 grid gap-4" onSubmit={onUpdateCourse}>
            <label className="grid gap-1.5">
              <span className="brand-label">Course</span>
              <input className="brand-input" value={courses.find((course) => course.id === editCourseId)?.code ?? ""} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Course Title</span>
              <input className="brand-input" value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} maxLength={120} required />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="brand-label">Start Date</span>
                <input className="brand-input" type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.currentTarget.value)} required />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">End Date</span>
                <input className="brand-input" type="date" value={editEndDate} min={editStartDate || undefined} onChange={(event) => setEditEndDate(event.currentTarget.value)} required />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Visibility</span>
                <select className="brand-input" value={editVisibility} onChange={(event) => setEditVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1.5 md:max-w-sm">
              <span className="brand-label">Assigned Teacher</span>
              <select className="brand-input" value={editTeacherId} onChange={(event) => setEditTeacherId(event.currentTarget.value)}>
                <option value="">No teacher assigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    <PersonLabel person={teacher} />
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-1.5">
              <span className="brand-label">Assigned Department Heads</span>
              <div className="max-h-40 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                {departmentHeads.length ? (
                  departmentHeads.map((head) => (
                    <label key={head.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                      <input
                        type="checkbox"
                        checked={editDepartmentHeadIds.includes(head.id)}
                        onChange={() => toggleEditDepartmentHead(head.id)}
                      />
                      <span>{(head.name || "Unnamed") + " - " + head.email + (head.status === "DISABLED" ? " (DISABLED)" : "")}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[#3f70ae]">No department heads found.</p>
                )}
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">Description (optional)</span>
              <textarea className="brand-input min-h-[90px]" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} maxLength={2000} />
            </label>
            <div className="grid gap-1.5">
              <span className="brand-label">Manage Students</span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-md border border-[#9bbfed] px-2 py-1 font-semibold text-[#1f518f]"
                  onClick={selectAllEditStudents}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#c6ddfa] px-2 py-1 font-semibold text-[#1f518f]"
                  onClick={clearEditStudents}
                >
                  Clear
                </button>
                <span className="text-[#3a689f]">Selected: {editStudentIds.length}</span>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                {students.length ? (
                  students.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                      <input
                        type="checkbox"
                        checked={editStudentIds.includes(student.id)}
                        onChange={() => toggleEditStudent(student.id)}
                      />
                      <span>
                        {(student.name || "Unnamed Student") +
                          " - " +
                          (student.studentId ? `${student.studentId} - ` : "") +
                          student.email +
                          (student.status === "DISABLED" ? " (DISABLED)" : "")}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[#3f70ae]">No students found.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={editPending}>
                {editPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
                onClick={() => setEditCourseId("")}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}



      <ConfirmModal
        open={!!confirmDeleteCourse}
        title="Delete Course"
        message={
          confirmDeleteCourse
            ? `Delete ${confirmDeleteCourse.label}? This removes related assignments, discussions, and enrollments.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteCourse(null)}
        onConfirm={() => {
          const target = confirmDeleteCourse;
          setConfirmDeleteCourse(null);
          if (!target) return;
          void onDeleteCourse(target.id);
        }}
      />
    </section>
  );
}
