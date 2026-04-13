"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLanguage } from "@/components/language-provider";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type ProgramDetails = {
  overview: string | null;
  tuitionAndFees: string | null;
  curriculum: string[];
  admissionRequirements: string[];
  careerOpportunities: string[];
};

type ProgramItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  programDetails: ProgramDetails | null;
  visibility: "DRAFT" | "PUBLISHED";
  courseCount: number;
  courses: CourseOption[];
  createdAt: string;
};

type Props = {
  role: AppRole;
};

const toMultilineValue = (items: string[] | undefined) => (items && items.length ? items.join("\n") : "");

const toListFromMultiline = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function ProgramsModule({ role }: Props) {
  const { t } = useLanguage();
  const isSuperAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const canManage = isSuperAdmin;

  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editProgramId, setEditProgramId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [createCourseIds, setCreateCourseIds] = useState<string[]>([]);
  const [createCourseSearch, setCreateCourseSearch] = useState("");
  const [createPending, setCreatePending] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [editOverview, setEditOverview] = useState("");
  const [editTuitionAndFees, setEditTuitionAndFees] = useState("");
  const [editCurriculum, setEditCurriculum] = useState("");
  const [editAdmissionRequirements, setEditAdmissionRequirements] = useState("");
  const [editCareerOpportunities, setEditCareerOpportunities] = useState("");
  const [editCourseIds, setEditCourseIds] = useState<string[]>([]);
  const [editCourseSearch, setEditCourseSearch] = useState("");
  const [editPending, setEditPending] = useState(false);

  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState<{ id: string; label: string } | null>(null);

  const filteredCreateCourses = useMemo(() => {
    const query = createCourseSearch.trim().toLowerCase();
    if (!query) return [];
    return courses.filter((course) => {
      const code = (course.code ?? "").toLowerCase();
      const title = course.title.toLowerCase();
      return code.includes(query) || title.includes(query);
    });
  }, [createCourseSearch, courses]);

  const filteredEditCourses = useMemo(() => {
    const query = editCourseSearch.trim().toLowerCase();
    if (!query) return [];
    return courses.filter((course) => {
      const code = (course.code ?? "").toLowerCase();
      const title = course.title.toLowerCase();
      return code.includes(query) || title.includes(query);
    });
  }, [editCourseSearch, courses]);

  const selectedCreateCourses = useMemo(
    () => createCourseIds.map((id) => courses.find((course) => course.id === id)).filter(Boolean) as CourseOption[],
    [createCourseIds, courses]
  );

  const selectedEditCourses = useMemo(
    () => editCourseIds.map((id) => courses.find((course) => course.id === id)).filter(Boolean) as CourseOption[],
    [editCourseIds, courses]
  );

  const totalAssociations = useMemo(() => programs.reduce((sum, item) => sum + item.courseCount, 0), [programs]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", { method: "GET" });
      const raw = await response.text();
      const result: { programs?: ProgramItem[]; courses?: CourseOption[]; error?: string } = raw
        ? (JSON.parse(raw) as { programs?: ProgramItem[]; courses?: CourseOption[]; error?: string })
        : {};

      if (!response.ok) {
        setError(result.error ?? t("error.loadPrograms"));
        return;
      }

      setPrograms(result.programs ?? []);
      setCourses(result.courses ?? []);
    } catch {
      setError(t("error.loadPrograms"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editProgramId) return;
    const selected = programs.find((item) => item.id === editProgramId);
    if (!selected) return;
    setEditTitle(selected.title);
    setEditDescription(selected.description ?? "");
    setEditVisibility(selected.visibility);
    setEditOverview(selected.programDetails?.overview ?? "");
    setEditTuitionAndFees(selected.programDetails?.tuitionAndFees ?? "");
    setEditCurriculum(toMultilineValue(selected.programDetails?.curriculum));
    setEditAdmissionRequirements(toMultilineValue(selected.programDetails?.admissionRequirements));
    setEditCareerOpportunities(toMultilineValue(selected.programDetails?.careerOpportunities));
    setEditCourseIds(selected.courses.map((c) => c.id));
    setEditCourseSearch("");
  }, [programs, editProgramId]);

  const editContentPreview = useMemo(
    () => ({
      curriculum: toListFromMultiline(editCurriculum).length,
      admissionRequirements: toListFromMultiline(editAdmissionRequirements).length,
      careerOpportunities: toListFromMultiline(editCareerOpportunities).length,
    }),
    [editAdmissionRequirements, editCareerOpportunities, editCurriculum]
  );

  const onCreateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim() || null,
          visibility: createVisibility,
          courseIds: createCourseIds,
        }),
      });
      const raw = await response.text();
      const result: { error?: string } = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.createProgram"));
        return;
      }
      setShowCreate(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateVisibility("DRAFT");
      setCreateCourseIds([]);
      setCreateCourseSearch("");
      await loadData();
    } catch {
      setError(t("error.createProgram"));
    } finally {
      setCreatePending(false);
    }
  };

  const onUpdateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editProgramId) return;
    setEditPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          programId: editProgramId,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          visibility: editVisibility,
          programDetails: {
            overview: editOverview.trim() || null,
            tuitionAndFees: editTuitionAndFees.trim() || null,
            curriculum: toListFromMultiline(editCurriculum),
            admissionRequirements: toListFromMultiline(editAdmissionRequirements),
            careerOpportunities: toListFromMultiline(editCareerOpportunities),
          },
          courseIds: editCourseIds,
        }),
      });
      const raw = await response.text();
      const result: { error?: string } = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateProgram"));
        return;
      }
      setEditProgramId("");
      await loadData();
    } catch {
      setError(t("error.updateProgram"));
    } finally {
      setEditPending(false);
    }
  };

  const onDeleteProgram = async (programId: string) => {
    setError("");
    try {
      const response = await fetch("/api/admin/programs", {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ programId }),
      });
      const raw = await response.text();
      const result: { error?: string } = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.deleteProgram"));
        return;
      }
      await loadData();
    } catch {
      setError(t("error.deleteProgram"));
    }
  };

  const toggleCreateCourse = (courseId: string) => {
    setCreateCourseIds((prev) => prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]);
  };

  const toggleEditCourse = (courseId: string) => {
    setEditCourseIds((prev) => prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]);
  };

  const selectAllEditCourses = () => {
    setEditCourseIds(courses.map((course) => course.id));
  };

  const clearEditCourses = () => {
    setEditCourseIds([]);
  };

  if (!canManage) {
    return <p className="brand-muted">Admin access required.</p>;
  }

  const visibilityLabel = (value: ProgramItem["visibility"]) =>
    value === "DRAFT" ? t("visibility.draft") : t("visibility.published");

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("programs") || "Programs"}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{programs.length}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">{t("table.courseCount") || "Total Courses"}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{totalAssociations}</p>
        </article>
      </div>
      <section className="brand-card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="brand-section-title">{t("program.list") || "Program List"}</p>
          <button
            className="btn-brand-primary px-4 py-2 text-sm font-semibold"
            onClick={() => {
              setCreateCourseSearch("");
              setShowCreate(true);
            }}
          >
            Create Program
          </button>
        </div>

        <ToastMessage type="error" message={error} />
        {isLoading ? (
          <div className="mt-3">
            <LoadingIndicator label="Loading programs..." />
          </div>
        ) : null}

        {programs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Title</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 font-semibold">{t("table.courseCount") || "Courses"}</th>
                  <th className="px-3 py-2 font-semibold">Visibility</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => (
                  <Fragment key={program.id}>
                    <tr className="border-b border-[#e7f0fc] text-[#0d3f80]">
                      <td className="px-3 py-2 font-semibold">{program.code}</td>
                      <td className="px-3 py-2">
                        <p>{program.title}</p>
                        {program.programDetails?.tuitionAndFees ? (
                          <p className="mt-1 text-xs text-[#3768ac]">Tuition & Fees: {program.programDetails.tuitionAndFees}</p>
                        ) : null}
                        {program.programDetails ? (
                          <p className="mt-1 text-xs text-[#3768ac]">
                            Program: {program.programDetails.curriculum.length} curriculum,{" "}
                            {program.programDetails.admissionRequirements.length} requirements,{" "}
                            {program.programDetails.careerOpportunities.length} careers
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 max-w-md truncate">{program.description || '-'}</td>
                      <td className="px-3 py-2">
                        <div>
                          <span className="font-semibold">{program.courseCount}</span>
                          {program.courses.slice(0,3).map((c) => (
                            <div key={c.id} className="text-xs">{c.code} - {c.title}</div>
                          ))}
                          {program.courseCount > 3 && <div className="text-xs text-gray-500">+{program.courseCount - 3} more</div>}
                        </div>
                      </td>
                      <td className="px-3 py-2">{visibilityLabel(program.visibility)}</td>
                      <td className="px-3 py-2 text-xs">{new Date(program.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/programs/${program.id}`}
                            className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          >
                            Manage Program
                          </Link>
                          <button
                            onClick={() => setConfirmDeleteProgram({ id: program.id, label: `${program.code} - ${program.title}` })}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && !programs.length ? (
          <p className="brand-muted mt-3 text-sm">
            {t("empty.noPrograms") || "No programs yet."}
          </p>
        ) : null}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
          <section className="brand-card w-full max-w-3xl p-5">
            <p className="brand-section-title">{t("program.createTitle") || "Create Program"}</p>
            <form className="mt-3 grid gap-4" onSubmit={onCreateProgram}>
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input 
                  className="brand-input" 
                  value={createTitle} 
                  onChange={(e) => setCreateTitle(e.target.value)} 
                  required 
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description (optional)</span>
                <textarea 
                  className="brand-input min-h-[90px]" 
                  value={createDescription} 
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.visibility") || "Visibility"}</span>
                <select 
                  className="brand-input" 
                  value={createVisibility} 
                  onChange={(e) => setCreateVisibility(e.target.value as "DRAFT" | "PUBLISHED")}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.selectCourses") || "Select Courses"}</span>
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedCreateCourses.map((course) => (
                      <span key={course.id} className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]">
                        {course.code} - {course.title}
                        <button
                          type="button"
                          className="text-[#1f518f] hover:text-[#0b3e81]"
                          onClick={() => toggleCreateCourse(course.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      className="brand-input"
                      placeholder={t("placeholder.courseSearch") || "Search courses by code or title"}
                      value={createCourseSearch}
                      onChange={(e) => setCreateCourseSearch(e.target.value)}
                    />
                    {createCourseSearch.trim() && (
                      <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                        {filteredCreateCourses.filter((c) => !createCourseIds.includes(c.id)).map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-[#eff6ff]"
                            onClick={() => {
                              toggleCreateCourse(course.id);
                              setCreateCourseSearch("");
                            }}
                          >
                            <span className="truncate">{course.code} - {course.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </label>
              <div className="flex items-center gap-2">
                <button 
                  className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" 
                  disabled={createPending}
                >
                  {createPending ? "Creating..." : "Create Program"}
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
      )}

      {editProgramId && (
        <section className="brand-card p-5">
          <p className="brand-section-title">{t("program.editTitle") || "Manage Program"}</p>
          <form className="mt-3 grid gap-4" onSubmit={onUpdateProgram}>
            <label className="grid gap-1.5">
              <span className="brand-label">Code</span>
              <input className="brand-input" value={programs.find((p) => p.id === editProgramId)?.code ?? ""} disabled />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description (optional)</span>
              <textarea className="brand-input min-h-[90px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Program Overview</span>
              <textarea
                className="brand-input min-h-[110px]"
                value={editOverview}
                onChange={(event) => setEditOverview(event.currentTarget.value)}
                maxLength={3000}
                placeholder="Short summary shown in Program Overview section."
              />
            </label>
            <label className="grid gap-1.5 md:max-w-sm">
              <span className="brand-label">Tuition & Fees</span>
              <input
                className="brand-input"
                value={editTuitionAndFees}
                onChange={(event) => setEditTuitionAndFees(event.currentTarget.value)}
                maxLength={160}
                placeholder="$12,500 / year"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="brand-label">Curriculum (one per line)</span>
                <textarea
                  className="brand-input min-h-[130px]"
                  value={editCurriculum}
                  onChange={(event) => setEditCurriculum(event.currentTarget.value)}
                  placeholder="Introduction to Business"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Admission Requirements (one per line)</span>
                <textarea
                  className="brand-input min-h-[130px]"
                  value={editAdmissionRequirements}
                  onChange={(event) => setEditAdmissionRequirements(event.currentTarget.value)}
                  placeholder="High school diploma or equivalent"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Career Opportunities (one per line)</span>
                <textarea
                  className="brand-input min-h-[130px]"
                  value={editCareerOpportunities}
                  onChange={(event) => setEditCareerOpportunities(event.currentTarget.value)}
                  placeholder="Business Manager"
                />
              </label>
            </div>
            <p className="text-xs text-[#3a689f]">
              Preview counts: Curriculum {editContentPreview.curriculum}, Requirements {editContentPreview.admissionRequirements}, Careers {editContentPreview.careerOpportunities}
            </p>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.visibility") || "Visibility"}</span>
              <select className="brand-input" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as "DRAFT" | "PUBLISHED")}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.assignedCourses") || "Assigned Courses"}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <button type="button" className="rounded-md border border-[#9bbfed] px-2 py-1 font-semibold text-[#1f518f]" onClick={selectAllEditCourses}>
                  Select All
                </button>
                <button type="button" className="rounded-md border border-[#c6ddfa] px-2 py-1 font-semibold text-[#1f518f]" onClick={clearEditCourses}>
                  Clear
                </button>
                <span className="text-[#3a689f]">Selected: {editCourseIds.length}</span>
              </div>
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedEditCourses.map((course) => (
                    <span key={course.id} className="inline-flex items-center gap-2 rounded-full border border-[#9bbfed] bg-[#eff6ff] px-3 py-1 font-semibold text-[#0b3e81]">
                      {course.code} - {course.title}
                      <button type="button" className="text-[#1f518f] hover:text-[#0b3e81]" onClick={() => toggleEditCourse(course.id)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    className="brand-input"
                    placeholder={t("placeholder.courseSearch") || "Search courses..."}
                    value={editCourseSearch}
                    onChange={(e) => setEditCourseSearch(e.target.value)}
                  />
                  {editCourseSearch.trim() && (
                    <div className="absolute z-10 mt-2 w-full max-h-48 overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                      {filteredEditCourses.filter((c) => !editCourseIds.includes(c.id)).map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-[#eff6ff]"
                          onClick={() => {
                            toggleEditCourse(course.id);
                            setEditCourseSearch("");
                          }}
                        >
                          <span className="truncate">{course.code} - {course.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </label>
            <div className="flex items-center gap-2">
              <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={editPending}>
                {editPending ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setEditProgramId("")}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <ConfirmModal
        open={!!confirmDeleteProgram}
        title={t("program.deleteTitle") || "Delete Program"}
        message={confirmDeleteProgram ? t("program.deleteMessage", { title: confirmDeleteProgram.label }) : ""}
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteProgram(null)}
        onConfirm={() => {
          const target = confirmDeleteProgram;
          setConfirmDeleteProgram(null);
          if (target) onDeleteProgram(target.id);
        }}
      />
    </section>
  );
}
