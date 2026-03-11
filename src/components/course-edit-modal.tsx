"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ToastMessage } from "@/components/toast-message";

type PersonOption = {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  status?: "ACTIVE" | "DISABLED";
  studentId?: string | null;
};

type CourseSnapshot = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  visibility: "DRAFT" | "PUBLISHED";
  teacherId: string | null;
  studentIds: string[];
  departmentHeadIds: string[];
};

type Props = {
  course: CourseSnapshot;
  teachers: PersonOption[];
  students: PersonOption[];
  departmentHeads: PersonOption[];
};

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

export function CourseEditModalTrigger({ course, teachers, students, departmentHeads }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(course.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(course.endDate));
  const [visibility, setVisibility] = useState<"DRAFT" | "PUBLISHED">(course.visibility);
  const [teacherId, setTeacherId] = useState(course.teacherId ?? "");
  const [studentIds, setStudentIds] = useState<string[]>(course.studentIds ?? []);
  const [departmentHeadIds, setDepartmentHeadIds] = useState<string[]>(course.departmentHeadIds ?? []);
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("overflow-hidden", "modal-open");
    return () => {
      document.body.classList.remove("overflow-hidden", "modal-open");
    };
  }, [open]);

  const openModal = () => {
    setError("");
    setTitle(course.title);
    setDescription(course.description ?? "");
    setStartDate(toDateInputValue(course.startDate));
    setEndDate(toDateInputValue(course.endDate));
    setVisibility(course.visibility);
    setTeacherId(course.teacherId ?? "");
    setStudentIds(course.studentIds ?? []);
    setDepartmentHeadIds(course.departmentHeadIds ?? []);
    setStudentSearch("");
    setOpen(true);
  };

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const name = (student.name ?? "").toLowerCase();
      const email = (student.email ?? "").toLowerCase();
      const phone = (student.phone ?? "").toLowerCase();
      const studentId = (student.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [studentSearch, students]);

  const toggleStudent = (studentId: string) => {
    setStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const selectAllStudents = () => {
    setStudentIds(students.map((student) => student.id));
  };

  const clearStudents = () => {
    setStudentIds([]);
  };

  const toggleDepartmentHead = (departmentHeadId: string) => {
    setDepartmentHeadIds((prev) =>
      prev.includes(departmentHeadId) ? prev.filter((id) => id !== departmentHeadId) : [...prev, departmentHeadId]
    );
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Course title is required.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Course start and end dates are required.");
      return;
    }
    setPending(true);
    setError("");
    const availableDepartmentHeadIds = new Set(departmentHeads.map((head) => head.id));
    const nextDepartmentHeadIds =
      availableDepartmentHeadIds.size > 0 ? departmentHeadIds.filter((id) => availableDepartmentHeadIds.has(id)) : departmentHeadIds;
    try {
      const response = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          title: nextTitle,
          description: description.trim(),
          startDate,
          endDate,
          visibility,
          teacherId: teacherId || null,
          studentIds,
          departmentHeadIds: nextDepartmentHeadIds,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update course.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Unable to update course.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn-brand-secondary px-4 py-2 text-sm font-semibold"
        onClick={openModal}
      >
        Edit Course
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
              <section className="brand-card w-full max-w-3xl p-5">
                <p className="brand-section-title">Edit Course</p>
                <form className="mt-3 grid gap-4" onSubmit={onSubmit}>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Course</span>
                    <input className="brand-input" value={course.code} disabled />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Course Title</span>
                    <input className="brand-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} maxLength={120} required />
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Start Date</span>
                      <input className="brand-input" type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} required />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">End Date</span>
                      <input className="brand-input" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.currentTarget.value)} required />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">Visibility</span>
                      <select className="brand-input" value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                        <option value="DRAFT">DRAFT</option>
                        <option value="PUBLISHED">PUBLISHED</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1.5 md:max-w-sm">
                    <span className="brand-label">Assigned Teacher</span>
                    <select className="brand-input" value={teacherId} onChange={(event) => setTeacherId(event.currentTarget.value)}>
                      <option value="">No teacher assigned</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {(teacher.name || "Unnamed") + " - " + teacher.email + (teacher.status === "DISABLED" ? " (DISABLED)" : "")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Description (optional)</span>
                    <textarea className="brand-input min-h-[90px]" value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={2000} />
                  </label>

                  <div className="grid gap-1.5">
                    <span className="brand-label">Assigned Department Heads</span>
                    <div className="max-h-40 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                      {departmentHeads.length ? (
                        departmentHeads.map((head) => (
                          <label key={head.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                            <input
                              type="checkbox"
                              checked={departmentHeadIds.includes(head.id)}
                              onChange={() => toggleDepartmentHead(head.id)}
                            />
                            <span>{(head.name || "Unnamed") + " - " + head.email + (head.status === "DISABLED" ? " (DISABLED)" : "")}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-[#3f70ae]">No department heads found.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <span className="brand-label">Enrolled Students</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-md border border-[#9bbfed] px-2 py-1 font-semibold text-[#1f518f]"
                        onClick={selectAllStudents}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[#c6ddfa] px-2 py-1 font-semibold text-[#1f518f]"
                        onClick={clearStudents}
                      >
                        Clear
                      </button>
                      <span className="text-[#3a689f]">Selected: {studentIds.length}</span>
                    </div>
                    <input
                      className="brand-input"
                      placeholder="Search by name, student ID, phone, or email"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.currentTarget.value)}
                    />
                    <div className="max-h-52 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-3">
                      {filteredStudents.length ? (
                        filteredStudents.map((student) => (
                          <label key={student.id} className="flex items-center gap-2 py-1 text-sm text-[#0d3f80]">
                            <input
                              type="checkbox"
                              checked={studentIds.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
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

                  <ToastMessage type="error" message={error} />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
                      onClick={() => setOpen(false)}
                      disabled={pending}
                    >
                      Cancel
                    </button>
                    <button className="btn-brand-primary px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={pending}>
                      {pending ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
