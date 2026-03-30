"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";

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
  degreeLevel: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  visibility: "DRAFT" | "PUBLISHED";
  teacherId: string | null;
  studentIds: string[];
  departmentHeadIds: string[];
};

const DEGREE_LEVEL_OPTIONS = [
  "Bachelor’s Degree",
  "Master’s Degree",
  "Higher National Diploma (HND)",
] as const;
type DegreeLevelValue = (typeof DEGREE_LEVEL_OPTIONS)[number];

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
  const { t } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [title, setTitle] = useState(course.title);
  const [degreeLevel, setDegreeLevel] = useState<DegreeLevelValue | "">(
    course.degreeLevel && DEGREE_LEVEL_OPTIONS.includes(course.degreeLevel as DegreeLevelValue)
      ? (course.degreeLevel as DegreeLevelValue)
      : ""
  );
  const [description, setDescription] = useState(course.description ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(course.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(course.endDate));
  const [visibility, setVisibility] = useState<"DRAFT" | "PUBLISHED">(course.visibility);
  const [teacherId, setTeacherId] = useState(course.teacherId ?? "");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>(course.studentIds ?? []);
  const [departmentHeadIds, setDepartmentHeadIds] = useState<string[]>(course.departmentHeadIds ?? []);
  const [departmentHeadSearch, setDepartmentHeadSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const renderPersonLabel = (person: PersonOption) =>
    `${person.name || t("label.unnamed")} - ${person.email}${person.status === "DISABLED" ? ` (${t("status.disabled")})` : ""}`;

  const renderStudentLabel = (student: PersonOption) =>
    `${student.name || t("label.unnamedStudent")} - ${student.studentId ? `${student.studentId} - ` : ""}${
      student.phone ? `${student.phone} - ` : ""
    }${student.email}${student.status === "DISABLED" ? ` (${t("status.disabled")})` : ""}`;

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
    setDegreeLevel(
      course.degreeLevel && DEGREE_LEVEL_OPTIONS.includes(course.degreeLevel as DegreeLevelValue)
        ? (course.degreeLevel as DegreeLevelValue)
        : ""
    );
    setDescription(course.description ?? "");
    setStartDate(toDateInputValue(course.startDate));
    setEndDate(toDateInputValue(course.endDate));
    setVisibility(course.visibility);
    setTeacherId(course.teacherId ?? "");
    setStudentIds(course.studentIds ?? []);
    setDepartmentHeadIds(course.departmentHeadIds ?? []);
    setTeacherSearch("");
    setDepartmentHeadSearch("");
    setStudentSearch("");
    setOpen(true);
  };

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return [];
    return students.filter((student) => {
      const name = (student.name ?? "").toLowerCase();
      const email = (student.email ?? "").toLowerCase();
      const phone = (student.phone ?? "").toLowerCase();
      const studentId = (student.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [studentSearch, students]);

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return [];
    return teachers.filter((teacher) => {
      const name = (teacher.name ?? "").toLowerCase();
      const email = (teacher.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [teacherSearch, teachers]);

  const filteredDepartmentHeads = useMemo(() => {
    const query = departmentHeadSearch.trim().toLowerCase();
    if (!query) return [];
    return departmentHeads.filter((head) => {
      const name = (head.name ?? "").toLowerCase();
      const email = (head.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [departmentHeadSearch, departmentHeads]);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === teacherId) ?? null,
    [teacherId, teachers]
  );
  const selectedDepartmentHeads = useMemo(
    () => departmentHeadIds.map((id) => departmentHeads.find((head) => head.id === id)).filter(Boolean) as PersonOption[],
    [departmentHeadIds, departmentHeads]
  );
  const selectedStudents = useMemo(
    () => studentIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as PersonOption[],
    [studentIds, students]
  );

  const toggleStudent = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (student?.status === "DISABLED") return;
    setStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const selectAllStudents = () => {
    setStudentIds(students.filter((student) => student.status !== "DISABLED").map((student) => student.id));
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
      setError(t("error.courseTitleRequired"));
      return;
    }
    if (!startDate || !endDate) {
      setError(t("error.courseDatesRequired"));
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
          degreeLevel: degreeLevel || null,
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
        setError(result.error ?? t("error.updateCourse"));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t("error.updateCourse"));
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
        {t("action.editCourse")}
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
              <section className="brand-card w-full max-w-3xl p-5">
                <p className="brand-section-title">{t("course.editTitle")}</p>
                <form className="mt-3 grid gap-4" onSubmit={onSubmit}>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("label.course")}</span>
                    <input className="brand-input" value={course.code} disabled />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("label.courseTitle")}</span>
                    <input className="brand-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} maxLength={120} required />
                  </label>
                  <label className="grid gap-1.5 md:max-w-sm">
                    <span className="brand-label">{t("label.degreeLevel", undefined, "Degree Level")}</span>
                    <select
                      className="brand-input"
                      value={degreeLevel}
                      onChange={(event) => setDegreeLevel(event.currentTarget.value as DegreeLevelValue | "")}
                      required
                    >
                      <option value="" disabled>
                        Select degree level
                      </option>
                      {DEGREE_LEVEL_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("label.startDate")}</span>
                      <input className="brand-input" type="date" value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} required />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("label.endDate")}</span>
                      <input className="brand-input" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.currentTarget.value)} required />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("label.visibility")}</span>
                      <select className="brand-input" value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                        <option value="DRAFT">{t("visibility.draft")}</option>
                        <option value="PUBLISHED">{t("visibility.published")}</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1.5 md:max-w-sm">
                    <span className="brand-label">{t("label.assignedTeacher")}</span>
                    <div className="grid gap-2">
                      {selectedTeacher ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]">
                            {renderPersonLabel(selectedTeacher)}
                            <button
                              type="button"
                              className="text-[#1f518f] hover:text-[#0b3e81]"
                              aria-label={t("action.clear")}
                              onClick={() => setTeacherId("")}
                            >
                              ×
                            </button>
                          </span>
                        </div>
                      ) : null}
                      <div className="relative">
                        <input
                          className="brand-input"
                          placeholder={t("placeholder.teacherSearch")}
                          value={teacherSearch}
                          onChange={(event) => setTeacherSearch(event.currentTarget.value)}
                        />
                        {teacherSearch.trim() ? (
                          <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                            {filteredTeachers.length ? (
                              filteredTeachers.map((teacher) => (
                                <button
                                  key={teacher.id}
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setTeacherId(teacher.id);
                                    setTeacherSearch("");
                                  }}
                                >
                                  <span className="truncate">{renderPersonLabel(teacher)}</span>
                                </button>
                              ))
                            ) : (
                              <p className="px-2 py-1 text-xs text-[#3f70ae]">{t("course.noTeachersMatch")}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("label.descriptionOptional")}</span>
                    <textarea className="brand-input min-h-[90px]" value={description} onChange={(event) => setDescription(event.currentTarget.value)} maxLength={2000} />
                  </label>

                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("label.assignedDepartmentHeads")}</span>
                    <div className="grid gap-2">
                      {selectedDepartmentHeads.length ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {selectedDepartmentHeads.map((head) => (
                            <span
                              key={head.id}
                              className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]"
                            >
                              {renderPersonLabel(head)}
                              <button
                                type="button"
                                className="text-[#1f518f] hover:text-[#0b3e81]"
                                aria-label={t("action.clear")}
                                onClick={() => toggleDepartmentHead(head.id)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="relative">
                        <input
                          className="brand-input"
                          placeholder={t("placeholder.departmentHeadSearch")}
                          value={departmentHeadSearch}
                          onChange={(event) => setDepartmentHeadSearch(event.currentTarget.value)}
                        />
                        {departmentHeadSearch.trim() ? (
                          <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                            {filteredDepartmentHeads.filter((head) => !departmentHeadIds.includes(head.id)).length ? (
                              filteredDepartmentHeads
                                .filter((head) => !departmentHeadIds.includes(head.id))
                                .map((head) => (
                                  <button
                                    key={head.id}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      toggleDepartmentHead(head.id);
                                      setDepartmentHeadSearch("");
                                    }}
                                  >
                                    <span className="truncate">{renderPersonLabel(head)}</span>
                                  </button>
                                ))
                            ) : (
                              <p className="px-2 py-1 text-xs text-[#3f70ae]">{t("course.noDepartmentHeadsMatch")}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("label.enrolledStudents")}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-md border border-[#9bbfed] px-2 py-1 font-semibold text-[#1f518f]"
                        onClick={selectAllStudents}
                      >
                        {t("action.selectAll")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[#c6ddfa] px-2 py-1 font-semibold text-[#1f518f]"
                        onClick={clearStudents}
                      >
                        {t("action.clear")}
                      </button>
                      <span className="text-[#3a689f]">{t("selectedCount", { count: studentIds.length })}</span>
                    </div>
                    <div className="grid gap-2">
                      {selectedStudents.length ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {selectedStudents.map((student) => (
                            <span
                              key={student.id}
                              className={`inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81] ${student.status === "DISABLED" ? "opacity-60" : ""}`}
                            >
                              {renderStudentLabel(student)}
                              {student.status === "DISABLED" ? null : (
                                <button
                                  type="button"
                                  className="text-[#1f518f] hover:text-[#0b3e81]"
                                  aria-label={t("action.clear")}
                                  onClick={() => toggleStudent(student.id)}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="relative">
                        <input
                          className="brand-input"
                          placeholder={t("placeholder.studentSearch")}
                          value={studentSearch}
                          onChange={(event) => setStudentSearch(event.currentTarget.value)}
                        />
                        {studentSearch.trim() ? (
                          <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                            {filteredStudents.filter((student) => !studentIds.includes(student.id)).length ? (
                              filteredStudents
                                .filter((student) => !studentIds.includes(student.id))
                                .map((student) => (
                                  <button
                                    key={student.id}
                                    type="button"
                                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${
                                      student.status === "DISABLED"
                                        ? "cursor-not-allowed text-[#9bbfed]"
                                        : "text-[#0d3f80] hover:bg-[#eff6ff]"
                                    }`}
                                    disabled={student.status === "DISABLED"}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      if (student.status === "DISABLED") return;
                                      toggleStudent(student.id);
                                      setStudentSearch("");
                                    }}
                                  >
                                    <span className="truncate">{renderStudentLabel(student)}</span>
                                  </button>
                                ))
                            ) : (
                              <p className="px-2 py-1 text-xs text-[#3f70ae]">{t("course.noStudentsMatch")}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
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
                      {t("action.cancel")}
                    </button>
                    <button className="btn-brand-primary px-2 py-2 text-sm font-semibold disabled:opacity-60" disabled={pending}>
                      {pending ? t("status.saving") : t("action.saveChanges")}
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
