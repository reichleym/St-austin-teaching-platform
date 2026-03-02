"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { CourseStructurePanel } from "@/components/course-structure-panel";

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

const toDateInputValue = (input: string | null) => {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

function PersonLabel({ person }: { person: PersonOption }) {
  return <>{(person.name || "Unnamed") + " - " + person.email}</>;
}

export function CoursesModule({ role }: Props) {
  const isSuperAdmin = role === Role.SUPER_ADMIN;
  const isStudent = role === Role.STUDENT;
  const canManage = isSuperAdmin;

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<PersonOption[]>([]);
  const [students, setStudents] = useState<PersonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editCourseId, setEditCourseId] = useState("");
  const [expandedCourseId, setExpandedCourseId] = useState("");

  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [createPending, setCreatePending] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [editPending, setEditPending] = useState(false);

  const [deletePendingCourseId, setDeletePendingCourseId] = useState("");

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");

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
    const selected = courses.find((item) => item.id === courseId);
    const label = selected ? `${selected.code} - ${selected.title}` : "this course";

    if (!window.confirm(`Delete ${label}? This removes related assignments, discussions, and enrollments.`)) {
      return;
    }

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

  const toggleEditStudent = (studentId: string) => {
    setEditStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="brand-section-title">Course List</p>
          {canManage ? (
            <button className="btn-brand-primary px-4 py-2 text-sm font-semibold" onClick={() => setShowCreate((prev) => !prev)}>
              {showCreate ? "Close Create" : "Create Course"}
            </button>
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
                    {(teacher.name || "Unnamed Teacher") + " - " + teacher.email}
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
                    {(student.name || "Unnamed Student") + " - " + student.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {isLoading ? <p className="brand-muted mt-3 text-sm">Loading courses...</p> : null}

        {!isLoading && filteredCourses.length ? (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Duration</th>
                <th className="px-3 py-2 font-semibold">Visibility</th>
                <th className="px-3 py-2 font-semibold">Teacher</th>
                <th className="px-3 py-2 font-semibold">Enrolled Students</th>
                <th className="px-3 py-2 font-semibold">Enrollments</th>
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
                      {course.startDate && course.endDate ? `${formatDate(course.startDate)} - ${formatDate(course.endDate)}` : "-"}
                    </td>
                    <td className="px-3 py-2">{course.visibility}</td>
                    <td className="px-3 py-2">{course.teacher?.name ?? course.teacher?.email ?? "Unassigned"}</td>
                    <td className="px-3 py-2">
                      {course.enrolledStudents.length ? (
                        <div className="max-w-[280px] space-y-1">
                          {course.enrolledStudents.slice(0, 5).map((student) => (
                            <p key={student.id} className="truncate text-xs text-[#2f5d96]">
                              {(student.name || "Unnamed Student") + " - " + student.email}
                            </p>
                          ))}
                          {course.enrolledStudents.length > 5 ? (
                            <p className="text-xs text-[#3f70ae]">+{course.enrolledStudents.length - 5} more</p>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2">{course.enrollmentCount}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          onClick={() => setExpandedCourseId((prev) => (prev === course.id ? "" : course.id))}
                        >
                          {expandedCourseId === course.id ? "Hide Modules" : "Modules"}
                        </button>
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                              onClick={() => {
                                setEditCourseId(course.id);
                                setShowCreate(false);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteCourse(course.id)}
                              disabled={deletePendingCourseId === course.id}
                              className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                            >
                              {deletePendingCourseId === course.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedCourseId === course.id ? (
                    <tr className="border-b border-[#e7f0fc]">
                      <td className="px-3 py-3" colSpan={8}>
                        <CourseStructurePanel
                          role={role}
                          courses={[{ id: course.id, code: course.code, title: course.title }]}
                          initialCourseId={course.id}
                          showCourseSelector={false}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : null}

        {!isLoading && !filteredCourses.length ? (
          <p className="brand-muted mt-3 text-sm">
            {isStudent ? "You are not enrolled in any courses yet." : "No courses match the current filters."}
          </p>
        ) : null}
      </section>

      {canManage && showCreate ? (
        <section className="brand-card p-5">
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
            <label className="grid gap-1.5">
              <span className="brand-label">Description (optional)</span>
              <textarea className="brand-input min-h-[90px]" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} maxLength={2000} />
            </label>
            <div className="grid gap-1.5">
              <span className="brand-label">Enroll Students During Creation</span>
              <div className="max-h-52 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                {students.length ? (
                  students.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                      <input
                        type="checkbox"
                        checked={createStudentIds.includes(student.id)}
                        onChange={() => toggleCreateStudent(student.id)}
                      />
                      <span>{(student.name || "Unnamed Student") + " - " + student.email}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[#3f70ae]">No active students found.</p>
                )}
              </div>
            </div>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={createPending}>
              {createPending ? "Creating..." : "Create Course"}
            </button>
          </form>
        </section>
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
            <label className="grid gap-1.5">
              <span className="brand-label">Description (optional)</span>
              <textarea className="brand-input min-h-[90px]" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} maxLength={2000} />
            </label>
            <div className="grid gap-1.5">
              <span className="brand-label">Enrolled Students</span>
              <div className="max-h-52 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                {students.length ? (
                  students.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                      <input
                        type="checkbox"
                        checked={editStudentIds.includes(student.id)}
                        onChange={() => toggleEditStudent(student.id)}
                      />
                      <span>{(student.name || "Unnamed Student") + " - " + student.email}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[#3f70ae]">No active students found.</p>
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
    </section>
  );
}
