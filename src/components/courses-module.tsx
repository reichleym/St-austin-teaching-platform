"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLanguage } from "@/components/language-provider";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";
const DEGREE_LEVEL_OPTIONS = [
  "Bachelor’s Degree",
  "Master’s Degree",
  "Higher National Diploma (HND)",
] as const;
type DegreeLevelValue = (typeof DEGREE_LEVEL_OPTIONS)[number];

type CourseItem = {
  id: string;
  code: string;
  title: string;
  degreeLevel: string | null;
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

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}Y`);
  if (months > 0) parts.push(`${months}M`);
  parts.push(`${days}D`);
  return parts.join(" ");
};

export function CoursesModule({ role, viewMode = "all", showModuleManagement = true }: Props) {
  const { t } = useLanguage();
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isDepartmentHead = role === "DEPARTMENT_HEAD";
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
  const canManage = isSuperAdmin;
  const studentSimpleView = isStudent;
  const showTeacherColumn = !isTeacher;
  const showDepartmentHeadColumn = !isStudent && !isDepartmentHead;

  const renderPersonLabel = (person: PersonOption) =>
    `${person.name || t("label.unnamed")} - ${person.email}${person.status === "DISABLED" ? ` (${t("status.disabled")})` : ""}`;

  const renderStudentLabel = (student: PersonOption) =>
    `${student.name || t("label.unnamedStudent")} - ${student.studentId ? `${student.studentId} - ` : ""}${
      student.phone ? `${student.phone} - ` : ""
    }${student.email}${student.status === "DISABLED" ? ` (${t("status.disabled")})` : ""}`;

  const roleLabel =
    role === "SUPER_ADMIN" || role === "ADMIN"
      ? t("role.super_admin")
      : role === "DEPARTMENT_HEAD"
        ? t("role.department_head")
        : role === "TEACHER"
          ? t("role.teacher")
          : role === "STUDENT"
            ? t("role.student")
            : formatRoleLabel(role);

  const visibilityLabel = (value: CourseItem["visibility"]) =>
    value === "DRAFT" ? t("visibility.draft") : t("visibility.published");

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<PersonOption[]>([]);
  const [students, setStudents] = useState<PersonOption[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<PersonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingEnrollmentRequestCount, setPendingEnrollmentRequestCount] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [editCourseId, setEditCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDegreeLevel, setCreateDegreeLevel] = useState<DegreeLevelValue | "">("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createTeacherSearch, setCreateTeacherSearch] = useState("");
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [createDepartmentHeadIds, setCreateDepartmentHeadIds] = useState<string[]>([]);
  const [createDepartmentHeadSearch, setCreateDepartmentHeadSearch] = useState("");
  const [createStudentSearch, setCreateStudentSearch] = useState("");
  const [createPending, setCreatePending] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDegreeLevel, setEditDegreeLevel] = useState<DegreeLevelValue | "">("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editVisibility, setEditVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editTeacherSearch, setEditTeacherSearch] = useState("");
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [editStudentSearch, setEditStudentSearch] = useState("");
  const [editDepartmentHeadIds, setEditDepartmentHeadIds] = useState<string[]>([]);
  const [editDepartmentHeadSearch, setEditDepartmentHeadSearch] = useState("");
  const [editPending, setEditPending] = useState(false);

  const [deletePendingCourseId, setDeletePendingCourseId] = useState("");
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<{ id: string; label: string } | null>(null);

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [filterDepartmentHeadId, setFilterDepartmentHeadId] = useState("");
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
          pendingEnrollmentRequestCount?: number;
          error?: string;
        })
        : {};

      if (!response.ok) {
        setError(result.error ?? t("error.loadCourses"));
      }

      setCourses(result.courses ?? []);
      setTeachers(result.teachers ?? []);
      setStudents(result.students ?? []);
      setDepartmentHeads(result.departmentHeads ?? []);
      setPendingEnrollmentRequestCount(result.pendingEnrollmentRequestCount ?? 0);
    } catch {
      setError(t("error.loadCourses"));
      setCourses([]);
      setTeachers([]);
      setStudents([]);
      setDepartmentHeads([]);
      setPendingEnrollmentRequestCount(0);
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
    setEditDegreeLevel(
      selected.degreeLevel && DEGREE_LEVEL_OPTIONS.includes(selected.degreeLevel as DegreeLevelValue)
        ? (selected.degreeLevel as DegreeLevelValue)
        : ""
    );
    setEditDescription(selected.description ?? "");
    setEditStartDate(toDateInputValue(selected.startDate));
    setEditEndDate(toDateInputValue(selected.endDate));
    setEditVisibility(selected.visibility);
    setEditTeacherId(selected.teacher?.id ?? "");
    setEditStudentIds(selected.enrolledStudents.map((item) => item.id));
    setEditDepartmentHeadIds(selected.departmentHeads.map((item) => item.id));
    setEditTeacherSearch("");
    setEditStudentSearch("");
    setEditDepartmentHeadSearch("");
  }, [courses, editCourseId]);

  const totalEnrollments = useMemo(() => courses.reduce((sum, item) => sum + item.enrollmentCount, 0), [courses]);

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (filterCourseId && course.id !== filterCourseId) return false;
        if (filterTeacherId && course.teacher?.id !== filterTeacherId) return false;
        if (filterStudentId && !course.enrolledStudents.some((student) => student.id === filterStudentId)) return false;
        if (filterDepartmentHeadId && !course.departmentHeads.some((head) => head.id === filterDepartmentHeadId)) return false;
        return true;
      }),
    [courses, filterCourseId, filterDepartmentHeadId, filterStudentId, filterTeacherId]
  );

  const filteredCreateStudents = useMemo(() => {
    const query = createStudentSearch.trim().toLowerCase();
    if (!query) return [];
    return students.filter((student) => {
      const name = (student.name ?? "").toLowerCase();
      const email = (student.email ?? "").toLowerCase();
      const phone = (student.phone ?? "").toLowerCase();
      const studentId = (student.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [createStudentSearch, students]);

  const filteredCreateTeachers = useMemo(() => {
    const query = createTeacherSearch.trim().toLowerCase();
    if (!query) return [];
    return teachers.filter((teacher) => {
      const name = (teacher.name ?? "").toLowerCase();
      const email = (teacher.email ?? "").toLowerCase();
      const phone = (teacher.phone ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [createTeacherSearch, teachers]);

  const filteredEditTeachers = useMemo(() => {
    const query = editTeacherSearch.trim().toLowerCase();
    if (!query) return [];
    return teachers.filter((teacher) => {
      const name = (teacher.name ?? "").toLowerCase();
      const email = (teacher.email ?? "").toLowerCase();
      const phone = (teacher.phone ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [editTeacherSearch, teachers]);

  const filteredCreateDepartmentHeads = useMemo(() => {
    const query = createDepartmentHeadSearch.trim().toLowerCase();
    if (!query) return [];
    return departmentHeads.filter((head) => {
      const name = (head.name ?? "").toLowerCase();
      const email = (head.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [createDepartmentHeadSearch, departmentHeads]);

  const filteredEditDepartmentHeads = useMemo(() => {
    const query = editDepartmentHeadSearch.trim().toLowerCase();
    if (!query) return [];
    return departmentHeads.filter((head) => {
      const name = (head.name ?? "").toLowerCase();
      const email = (head.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [editDepartmentHeadSearch, departmentHeads]);

  const filteredEditStudents = useMemo(() => {
    const query = editStudentSearch.trim().toLowerCase();
    if (!query) return [];
    return students.filter((student) => {
      const name = (student.name ?? "").toLowerCase();
      const email = (student.email ?? "").toLowerCase();
      const phone = (student.phone ?? "").toLowerCase();
      const studentId = (student.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [editStudentSearch, students]);

  const selectedCreateDepartmentHeads = useMemo(
    () => createDepartmentHeadIds.map((id) => departmentHeads.find((head) => head.id === id)).filter(Boolean) as PersonOption[],
    [createDepartmentHeadIds, departmentHeads]
  );
  const selectedEditDepartmentHeads = useMemo(
    () => editDepartmentHeadIds.map((id) => departmentHeads.find((head) => head.id === id)).filter(Boolean) as PersonOption[],
    [departmentHeads, editDepartmentHeadIds]
  );
  const selectedCreateStudents = useMemo(
    () => createStudentIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as PersonOption[],
    [createStudentIds, students]
  );
  const selectedEditStudents = useMemo(
    () => editStudentIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as PersonOption[],
    [editStudentIds, students]
  );
  const selectedCreateTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === createTeacherId) ?? null,
    [createTeacherId, teachers]
  );
  const selectedEditTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === editTeacherId) ?? null,
    [editTeacherId, teachers]
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
          degreeLevel: createDegreeLevel,
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
        setError(result.error ?? t("error.createCourse"));
        return;
      }

      setShowCreate(false);
      setCreateTitle("");
      setCreateDegreeLevel("");
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
      setError(t("error.createCourse"));
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
          degreeLevel: editDegreeLevel,
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
        setError(result.error ?? t("error.updateCourse"));
        return;
      }

      setEditCourseId("");
      await loadData();
    } catch {
      setError(t("error.updateCourse"));
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
        setError(result.error ?? t("error.deleteCourse"));
        return;
      }

      await loadData();
    } catch {
      setError(t("error.deleteCourse"));
    } finally {
      setDeletePendingCourseId("");
    }
  };

  const toggleCreateStudent = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (student?.status === "DISABLED") return;
    setCreateStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const toggleCreateDepartmentHead = (departmentHeadId: string) => {
    setCreateDepartmentHeadIds((prev) =>
      prev.includes(departmentHeadId) ? prev.filter((id) => id !== departmentHeadId) : [...prev, departmentHeadId]
    );
  };

  const toggleEditStudent = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (student?.status === "DISABLED") return;
    setEditStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  };

  const toggleEditDepartmentHead = (departmentHeadId: string) => {
    setEditDepartmentHeadIds((prev) =>
      prev.includes(departmentHeadId) ? prev.filter((id) => id !== departmentHeadId) : [...prev, departmentHeadId]
    );
  };

  const selectAllEditStudents = () => {
    setEditStudentIds(students.filter((student) => student.status !== "DISABLED").map((student) => student.id));
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
        setError(result.error ?? t("error.enrollmentRequest"));
        return;
      }
      await loadData();
    } catch {
      setError(t("error.enrollmentRequest"));
    } finally {
      setEnrollPendingCourseId("");
    }
  };

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("courses")}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{courses.length}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("totalEnrollments")}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{totalEnrollments}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("role")}</p>
          <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{roleLabel}</p>
        </article>
      </div>
      <section className="brand-card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="brand-section-title">{t("courseList")}</p>
          {canManage ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/courses/enrollment-requests"
                className="inline-flex items-center gap-2 rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
              >
                {t("enrollmentRequests")}
                <span className="rounded-full bg-[#1f518f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {pendingEnrollmentRequestCount}
                </span>
              </Link>
              <button
                className="btn-brand-primary px-2 py-2 text-sm font-semibold"
                onClick={() => {
                  setCreateTeacherSearch("");
                  setCreateDepartmentHeadSearch("");
                  setCreateStudentSearch("");
                  setShowCreate(true);
                }}
              >
                {t("action.createCourse")}
              </button>
            </div>
          ) : null}
        </div>

        {canManage ? (
          <div className="mt-3 grid gap-4 md:grid-cols-4">
            <label className="grid gap-1.5">
              <span className="brand-label">{t("filter.byCourse")}</span>
              <select className="brand-input" value={filterCourseId} onChange={(event) => setFilterCourseId(event.currentTarget.value)}>
                <option value="">{t("filter.allCourses")}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("filter.byTeacher")}</span>
              <select className="brand-input" value={filterTeacherId} onChange={(event) => setFilterTeacherId(event.currentTarget.value)}>
                <option value="">{t("filter.allTeachers")}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {(teacher.name || t("label.unnamedTeacher")) +
                      " - " +
                      teacher.email +
                      (teacher.status === "DISABLED" ? ` (${t("status.disabled")})` : "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("filter.byDepartmentHead")}</span>
              <select
                className="brand-input"
                value={filterDepartmentHeadId}
                onChange={(event) => setFilterDepartmentHeadId(event.currentTarget.value)}
              >
                <option value="">{t("filter.allDepartmentHeads")}</option>
                {departmentHeads.map((head) => (
                  <option key={head.id} value={head.id}>
                    {(head.name || t("label.unnamedDepartmentHead")) + " - " + head.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("filter.byStudent")}</span>
              <select className="brand-input" value={filterStudentId} onChange={(event) => setFilterStudentId(event.currentTarget.value)}>
                <option value="">{t("filter.allStudents")}</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {(student.name || t("label.unnamedStudent")) +
                      " - " +
                      (student.studentId ? `${student.studentId} - ` : "") +
                      student.email +
                      (student.status === "DISABLED" ? ` (${t("status.disabled")})` : "")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <ToastMessage type="error" message={error} />
        {isLoading ? (
          <div className="mt-3">
            <LoadingIndicator label={t("loading.courses")} />
          </div>
        ) : null}

        {!isLoading && filteredCourses.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                  <th className="px-3 py-2 font-semibold">{t("table.code")}</th>
                  <th className="px-3 py-2 font-semibold">{t("table.title")}</th>
                  <th className="px-3 py-2 font-semibold">{t("table.duration")}</th>
                  {showTeacherColumn ? <th className="px-3 py-2 font-semibold">{t("table.teacher")}</th> : null}
                  {showDepartmentHeadColumn ? <th className="px-3 py-2 font-semibold">{t("table.departmentHeads")}</th> : null}
                  {!studentSimpleView ? <th className="px-3 py-2 font-semibold">{t("table.visibility")}</th> : null}
                  {!studentSimpleView ? <th className="px-3 py-2 font-semibold">{t("table.enrollments")}</th> : null}
                  {isStudent && viewMode === "enrolled" ? <th className="px-3 py-2 font-semibold">{t("table.progress")}</th> : null}
                  <th className="px-3 py-2 font-semibold">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <Fragment key={course.id}>
                    <tr className="border-b border-[#e7f0fc] text-[#0d3f80]">
                      <td className="px-3 py-2 font-semibold">{course.code}</td>
                      <td className="px-3 py-2">
                        <p>{course.title}</p>
                        {course.degreeLevel ? <p className="mt-1 text-xs text-[#3768ac]">Degree Level: {course.degreeLevel}</p> : null}
                        {course.description ? <p className="mt-1 text-xs text-[#3768ac]">{course.description}</p> : null}
                      </td>
                      <td className="px-3 py-2">
                        {formatDurationYmd(course.startDate, course.endDate)}
                      </td>
                      {showTeacherColumn ? (
                        <td className="px-3 py-2">{course.teacher?.name ?? course.teacher?.email ?? t("course.unassigned")}</td>
                      ) : null}
                      {showDepartmentHeadColumn ? (
                        <td className="px-3 py-2">
                          {course.departmentHeads.length
                            ? course.departmentHeads.map((head) => head.name || head.email).join(", ")
                            : t("table.none")}
                        </td>
                      ) : null}
                      {!studentSimpleView ? <td className="px-3 py-2">{visibilityLabel(course.visibility)}</td> : null}
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
                                ? t("status.enrolled")
                                : course.myEnrollmentRequestStatus === "PENDING"
                                  ? t("status.requestPending")
                                  : enrollPendingCourseId === course.id
                                    ? t("status.requesting")
                                    : t("action.enrollNow")}
                            </button>
                          ) : (
                            <>
                              <Link
                                href={`/dashboard/${viewMode === "enrolled" ? "learning" : "courses"}/${course.id}`}
                                className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                              >
                                {t("action.manageCourse")}
                              </Link>
                              {showModuleManagement && canManage ? (
                                <Link
                                  href={`/dashboard/courses/${course.id}/structure`}
                                  className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                                >
                                  {t("action.manageModules")}
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
                                  {deletePendingCourseId === course.id ? t("status.deleting") : t("action.delete")}
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
              ? t("empty.enrolledCourses")
              : isStudent
                ? t("empty.noPublishedCourses")
                : t("empty.noCoursesMatchFilters")}
          </p>
        ) : null}
      </section>

      {canManage && showCreate ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
          <section className="brand-card w-full max-w-5xl p-5">
            <p className="brand-section-title">{t("course.createTitle")}</p>
            <form className="mt-3 grid gap-4" onSubmit={onCreateCourse}>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.courseTitle")}</span>
                <input className="brand-input" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} maxLength={120} required />
              </label>
              <label className="grid gap-1.5 md:max-w-sm">
                <span className="brand-label">{t("label.degreeLevel", undefined, "Degree Level")}</span>
                <select
                  className="brand-input"
                  value={createDegreeLevel}
                  onChange={(event) => setCreateDegreeLevel(event.currentTarget.value as DegreeLevelValue | "")}
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
                  <input className="brand-input" type="date" value={createStartDate} onChange={(event) => setCreateStartDate(event.currentTarget.value)} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("label.endDate")}</span>
                  <input className="brand-input" type="date" value={createEndDate} min={createStartDate || undefined} onChange={(event) => setCreateEndDate(event.currentTarget.value)} required />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("label.visibility")}</span>
                  <select className="brand-input" value={createVisibility} onChange={(event) => setCreateVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                    <option value="DRAFT">{t("visibility.draft")}</option>
                    <option value="PUBLISHED">{t("visibility.published")}</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 md:max-w-sm">
                <span className="brand-label">{t("label.assignTeacher")}</span>
                <div className="grid gap-2">
                  {selectedCreateTeacher ? (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]">
                        {renderPersonLabel(selectedCreateTeacher)}
                        <button
                          type="button"
                          className="text-[#1f518f] hover:text-[#0b3e81]"
                          aria-label={t("action.clear")}
                          onClick={() => setCreateTeacherId("")}
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
                      value={createTeacherSearch}
                      onChange={(event) => setCreateTeacherSearch(event.currentTarget.value)}
                    />
                    {createTeacherSearch.trim() ? (
                      <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                        {filteredCreateTeachers.length ? (
                          filteredCreateTeachers.map((teacher) => (
                            <button
                              key={teacher.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setCreateTeacherId(teacher.id);
                                setCreateTeacherSearch("");
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
              <div className="grid gap-1.5">
                <span className="brand-label">{t("label.assignDepartmentHeads")}</span>
                <div className="grid gap-2">
                  {selectedCreateDepartmentHeads.length ? (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedCreateDepartmentHeads.map((head) => (
                        <span
                          key={head.id}
                          className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]"
                        >
                          {renderPersonLabel(head)}
                          <button
                            type="button"
                            className="text-[#1f518f] hover:text-[#0b3e81]"
                            aria-label={t("action.clear")}
                            onClick={() => toggleCreateDepartmentHead(head.id)}
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
                      value={createDepartmentHeadSearch}
                      onChange={(event) => setCreateDepartmentHeadSearch(event.currentTarget.value)}
                    />
                    {createDepartmentHeadSearch.trim() ? (
                      <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                        {filteredCreateDepartmentHeads.filter((head) => !createDepartmentHeadIds.includes(head.id)).length ? (
                          filteredCreateDepartmentHeads
                            .filter((head) => !createDepartmentHeadIds.includes(head.id))
                            .map((head) => (
                              <button
                                key={head.id}
                                type="button"
                                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  toggleCreateDepartmentHead(head.id);
                                  setCreateDepartmentHeadSearch("");
                                }}
                              >
                                <span className="truncate">
                                  {(head.name || t("label.unnamed")) +
                                    " - " +
                                    head.email +
                                    (head.status === "DISABLED" ? ` (${t("status.disabled")})` : "")}
                                </span>
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
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.descriptionOptional")}</span>
                <textarea className="brand-input min-h-[90px]" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} maxLength={2000} />
              </label>
              <div className="grid gap-1.5">
                <span className="brand-label">{t("label.enrollStudentsDuringCreation")}</span>
                <div className="grid gap-2">
                  {selectedCreateStudents.length ? (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedCreateStudents.map((student) => (
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
                              onClick={() => toggleCreateStudent(student.id)}
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
                      value={createStudentSearch}
                      onChange={(event) => setCreateStudentSearch(event.currentTarget.value)}
                    />
                    {createStudentSearch.trim() ? (
                      <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                        {filteredCreateStudents.filter((student) => !createStudentIds.includes(student.id)).length ? (
                          filteredCreateStudents
                            .filter((student) => !createStudentIds.includes(student.id))
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
                                  toggleCreateStudent(student.id);
                                  setCreateStudentSearch("");
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
              <div className="flex items-center gap-2">
                <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={createPending}>
                  {createPending ? t("status.creating") : t("action.createCourse")}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
                  onClick={() => setShowCreate(false)}
                >
                  {t("action.cancel")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {canManage && editCourseId ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">{t("course.editTitle")}</p>
          <form className="mt-3 grid gap-4" onSubmit={onUpdateCourse}>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.course")}</span>
              <input className="brand-input" value={courses.find((course) => course.id === editCourseId)?.code ?? ""} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.courseTitle")}</span>
              <input className="brand-input" value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} maxLength={120} required />
            </label>
            <label className="grid gap-1.5 md:max-w-sm">
              <span className="brand-label">{t("label.degreeLevel", undefined, "Degree Level")}</span>
              <select
                className="brand-input"
                value={editDegreeLevel}
                onChange={(event) => setEditDegreeLevel(event.currentTarget.value as DegreeLevelValue | "")}
              >
                <option value="">
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
                <input className="brand-input" type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.currentTarget.value)} required />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.endDate")}</span>
                <input className="brand-input" type="date" value={editEndDate} min={editStartDate || undefined} onChange={(event) => setEditEndDate(event.currentTarget.value)} required />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.visibility")}</span>
                <select className="brand-input" value={editVisibility} onChange={(event) => setEditVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
                  <option value="DRAFT">{t("visibility.draft")}</option>
                  <option value="PUBLISHED">{t("visibility.published")}</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1.5 md:max-w-sm">
              <span className="brand-label">{t("label.assignedTeacher")}</span>
              <div className="grid gap-2">
                {selectedEditTeacher ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]">
                      {renderPersonLabel(selectedEditTeacher)}
                      <button
                        type="button"
                        className="text-[#1f518f] hover:text-[#0b3e81]"
                        aria-label={t("action.clear")}
                        onClick={() => setEditTeacherId("")}
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
                    value={editTeacherSearch}
                    onChange={(event) => setEditTeacherSearch(event.currentTarget.value)}
                  />
                  {editTeacherSearch.trim() ? (
                    <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                      {filteredEditTeachers.length ? (
                        filteredEditTeachers.map((teacher) => (
                          <button
                            key={teacher.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setEditTeacherId(teacher.id);
                              setEditTeacherSearch("");
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
            <div className="grid gap-1.5">
              <span className="brand-label">{t("label.assignedDepartmentHeads")}</span>
              <div className="grid gap-2">
                {selectedEditDepartmentHeads.length ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedEditDepartmentHeads.map((head) => (
                      <span
                        key={head.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]"
                      >
                        {renderPersonLabel(head)}
                        <button
                          type="button"
                          className="text-[#1f518f] hover:text-[#0b3e81]"
                          aria-label={t("action.clear")}
                          onClick={() => toggleEditDepartmentHead(head.id)}
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
                    value={editDepartmentHeadSearch}
                    onChange={(event) => setEditDepartmentHeadSearch(event.currentTarget.value)}
                  />
                  {editDepartmentHeadSearch.trim() ? (
                    <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                      {filteredEditDepartmentHeads.filter((head) => !editDepartmentHeadIds.includes(head.id)).length ? (
                        filteredEditDepartmentHeads
                          .filter((head) => !editDepartmentHeadIds.includes(head.id))
                          .map((head) => (
                            <button
                              key={head.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm text-[#0d3f80] hover:bg-[#eff6ff]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                toggleEditDepartmentHead(head.id);
                                setEditDepartmentHeadSearch("");
                              }}
                            >
                              <span className="truncate">
                                {(head.name || t("label.unnamed")) +
                                  " - " +
                                  head.email +
                                  (head.status === "DISABLED" ? ` (${t("status.disabled")})` : "")}
                              </span>
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
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.descriptionOptional")}</span>
              <textarea className="brand-input min-h-[90px]" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} maxLength={2000} />
            </label>
            <div className="grid gap-1.5">
              <span className="brand-label">{t("label.manageStudents")}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-md border border-[#9bbfed] px-2 py-1 font-semibold text-[#1f518f]"
                  onClick={selectAllEditStudents}
                >
                  {t("action.selectAll")}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#c6ddfa] px-2 py-1 font-semibold text-[#1f518f]"
                  onClick={clearEditStudents}
                >
                  {t("action.clear")}
                </button>
                <span className="text-[#3a689f]">{t("selectedCount", { count: editStudentIds.length })}</span>
              </div>
              <div className="grid gap-2">
                {selectedEditStudents.length ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedEditStudents.map((student) => (
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
                            onClick={() => toggleEditStudent(student.id)}
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
                    value={editStudentSearch}
                    onChange={(event) => setEditStudentSearch(event.currentTarget.value)}
                  />
                  {editStudentSearch.trim() ? (
                    <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                      {filteredEditStudents.filter((student) => !editStudentIds.includes(student.id)).length ? (
                        filteredEditStudents
                          .filter((student) => !editStudentIds.includes(student.id))
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
                                toggleEditStudent(student.id);
                                setEditStudentSearch("");
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
            <div className="flex items-center gap-2">
              <button className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={editPending}>
                {editPending ? t("status.saving") : t("action.saveChanges")}
              </button>
              <button
                type="button"
                className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
                onClick={() => setEditCourseId("")}
              >
                {t("action.cancel")}
              </button>
            </div>
          </form>
        </section>
      ) : null}



      <ConfirmModal
        open={!!confirmDeleteCourse}
        title={t("course.deleteTitle")}
        message={
          confirmDeleteCourse
            ? t("course.deleteMessage", { title: confirmDeleteCourse.label })
            : ""
        }
        confirmLabel={t("action.delete")}
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
