"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/confirm-modal";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import {
  createEmptyProgramLocalizationDrafts,
  getProgramLocalizationDrafts,
  parseProgramLanguage,
  type ProgramLocalization,
} from "@/lib/programs-translations";

type ProgramDetails = {
  overview: string | null;
  tuitionAndFees: string | null;
  curriculum: string[];
  admissionRequirements: string[];
  careerOpportunities: string[];
};

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type ProgramItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  sourceLanguage: string;
  translations: unknown;
  programDetails: ProgramDetails | null;
  visibility: "DRAFT" | "PUBLISHED";
  courseCount: number;
  courses: CourseOption[];
  createdAt: string;
};

type Props = {
  programId: string;
};

const toMultilineValue = (items: string[] | undefined) => (items && items.length ? items.join("\n") : "");

const toListFromMultiline = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function ProgramManageEditor({ programId }: Props) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const initialSourceLanguage = parseProgramLanguage(language);

  const [program, setProgram] = useState<ProgramItem | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [editSourceLanguage, setEditSourceLanguage] = useState<Language>(initialSourceLanguage);
  const [editLocalizations, setEditLocalizations] = useState<Record<Language, ProgramLocalization>>(
    createEmptyProgramLocalizationDrafts()
  );
  const [editVisibility, setEditVisibility] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [editTuitionAndFees, setEditTuitionAndFees] = useState("");
  const [editDegreeLevel, setEditDegreeLevel] = useState<"Bachelor’s Degree" | "Master’s Degree" | "Higher National Diploma (HND)" | "">("");
  const [editFieldOfStudy, setEditFieldOfStudy] = useState("");
  const [editCourseIds, setEditCourseIds] = useState<string[]>([]);
  const [editCourseSearch, setEditCourseSearch] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const applyProgramToForm = useCallback((nextProgram: ProgramItem) => {
    setEditSourceLanguage(parseProgramLanguage(nextProgram.sourceLanguage));
    setEditLocalizations(getProgramLocalizationDrafts(nextProgram));
    setEditVisibility(nextProgram.visibility);
    setEditTuitionAndFees(nextProgram.programDetails?.tuitionAndFees ?? "");
    setEditDegreeLevel((nextProgram as any).degreeLevel ?? "");
    setEditFieldOfStudy((nextProgram as any).fieldOfStudy ?? "");
    setEditCourseIds(nextProgram.courses.map((course) => course.id));
    setEditCourseSearch("");
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", { method: "GET" });
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as { programs?: ProgramItem[]; courses?: CourseOption[]; error?: string })
        : {};

      if (!response.ok) {
        setProgram(null);
        setCourses([]);
        setError(result.error ?? t("error.loadPrograms") ?? "Unable to load programs.");
        return;
      }

      const allPrograms = result.programs ?? [];
      const selected = allPrograms.find((item) => item.id === programId) ?? null;
      const availableCourses = result.courses ?? [];

      setCourses(availableCourses);
      setProgram(selected);

      if (!selected) {
        setError("Program not found.");
        return;
      }

      applyProgramToForm(selected);
    } catch {
      setProgram(null);
      setCourses([]);
      setError(t("error.loadPrograms") ?? "Unable to load programs.");
    } finally {
      setIsLoading(false);
    }
  }, [applyProgramToForm, programId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredEditCourses = useMemo(() => {
    const query = editCourseSearch.trim().toLowerCase();
    if (!query) return [];
    return courses.filter((course) => {
      const code = (course.code ?? "").toLowerCase();
      const title = course.title.toLowerCase();
      return code.includes(query) || title.includes(query);
    });
  }, [courses, editCourseSearch]);

  const selectedEditCourses = useMemo(
    () => editCourseIds.map((id) => courses.find((course) => course.id === id)).filter(Boolean) as CourseOption[],
    [courses, editCourseIds]
  );

  const editContentPreview = useMemo(() => {
    const localization = editLocalizations[editSourceLanguage];
    return {
      curriculum: toListFromMultiline(localization.curriculum ?? "").length,
      admissionRequirements: toListFromMultiline(localization.admissionRequirements ?? "").length,
      careerOpportunities: toListFromMultiline(localization.careerOpportunities ?? "").length,
    };
  }, [editLocalizations, editSourceLanguage]);

  const languageLabel = (value: Language) => (value === "fr" ? t("french") : t("english"));

  const updateLocalization = (
    targetLanguage: Language,
    field:
      | "title"
      | "description"
      | "overview"
      | "curriculum"
      | "admissionRequirements"
      | "careerOpportunities",
    value: string
  ) => {
    setEditLocalizations((prev) => ({
      ...prev,
      [targetLanguage]: {
        ...prev[targetLanguage],
        [field]: value,
      },
    }));
  };

  const renderLocalizationFields = (draftSourceLanguage: Language, draftLocalizations: Record<Language, ProgramLocalization>) => (
    <div className="grid gap-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">{t("announcement.sourceLanguage")}</span>
        <select
          className="brand-input"
          value={draftSourceLanguage}
          onChange={(event) => setEditSourceLanguage(parseProgramLanguage(event.currentTarget.value))}
        >
          {supportedLanguages.map((entryLanguage) => (
            <option key={entryLanguage} value={entryLanguage}>
              {languageLabel(entryLanguage)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === draftSourceLanguage;
          const fields = draftLocalizations[entryLanguage];
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <legend className="text-sm font-semibold text-[#0b3e81]">
                  {t("announcement.languageVersion", { language: languageLabel(entryLanguage) })}
                </legend>
                {isPrimary ? (
                  <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">
                    {t("announcement.primaryLanguage")}
                  </span>
                ) : null}
              </div>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.title")}</span>
                <input
                  className="brand-input"
                  value={fields.title}
                  onChange={(event) => updateLocalization(entryLanguage, "title", event.currentTarget.value)}
                  required={isPrimary}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.descriptionOptional")}</span>
                <textarea
                  className="brand-input min-h-[90px]"
                  value={fields.description ?? ""}
                  onChange={(event) => updateLocalization(entryLanguage, "description", event.currentTarget.value)}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("program.overview") || "Program Overview"}</span>
                <textarea
                  className="brand-input min-h-[90px]"
                  value={fields.overview ?? ""}
                  onChange={(event) => updateLocalization(entryLanguage, "overview", event.currentTarget.value)}
                  placeholder="Short summary shown in Program Overview section."
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("program.curriculum") || "Curriculum (one per line)"}</span>
                <textarea
                  className="brand-input min-h-[90px]"
                  value={fields.curriculum ?? ""}
                  onChange={(event) => updateLocalization(entryLanguage, "curriculum", event.currentTarget.value)}
                  placeholder="Introduction to Business"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("program.admissionRequirements") || "Admission Requirements (one per line)"}</span>
                <textarea
                  className="brand-input min-h-[90px]"
                  value={fields.admissionRequirements ?? ""}
                  onChange={(event) => updateLocalization(entryLanguage, "admissionRequirements", event.currentTarget.value)}
                  placeholder="High school diploma or equivalent"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("program.careerOpportunities") || "Career Opportunities (one per line)"}</span>
                <textarea
                  className="brand-input min-h-[90px]"
                  value={fields.careerOpportunities ?? ""}
                  onChange={(event) => updateLocalization(entryLanguage, "careerOpportunities", event.currentTarget.value)}
                  placeholder="Business Manager"
                />
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );

  const toggleEditCourse = (courseId: string) => {
    setEditCourseIds((prev) => (prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]));
  };

  const selectAllEditCourses = () => {
    setEditCourseIds(courses.map((course) => course.id));
  };

  const clearEditCourses = () => {
    setEditCourseIds([]);
  };

  const onUpdateProgram = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!program) return;

    setEditPending(true);
    setError("");
    const primaryLocalization = editLocalizations[editSourceLanguage];
    // Validation: require primary title, degree level, field of study, overview and lists
    const curriculumList = toListFromMultiline(primaryLocalization.curriculum ?? "");
    const admissionList = toListFromMultiline(primaryLocalization.admissionRequirements ?? "");
    const careerList = toListFromMultiline(primaryLocalization.careerOpportunities ?? "");
    if (!primaryLocalization.title?.trim() || !editDegreeLevel || !editFieldOfStudy.trim() || !(primaryLocalization.overview?.trim()) || !curriculumList.length || !admissionList.length || !careerList.length) {
      setError(t("error.requiredFields") || "All fields are required.");
      setEditPending(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: program.id,
          title: primaryLocalization.title.trim(),
          description: (primaryLocalization.description ?? "").trim() || null,
          sourceLanguage: editSourceLanguage,
          translations: editLocalizations,
            degreeLevel: editDegreeLevel || null,
            fieldOfStudy: editFieldOfStudy.trim() || null,
          visibility: editVisibility,
          programDetails: {
            overview: primaryLocalization.overview?.trim() || null,
            tuitionAndFees: editTuitionAndFees.trim() || null,
            curriculum: toListFromMultiline(primaryLocalization.curriculum ?? ""),
            admissionRequirements: toListFromMultiline(primaryLocalization.admissionRequirements ?? ""),
            careerOpportunities: toListFromMultiline(primaryLocalization.careerOpportunities ?? ""),
          },
          courseIds: editCourseIds,
        }),
      });

      if (!response.ok) {
        return;
      }

      await loadData();
      router.refresh();
    } catch {
      // Global app toast provider handles mutation failure notifications.
    } finally {
      setEditPending(false);
    }
  };

  const onDeleteProgram = async () => {
    if (!program) return;
    setDeletePending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/programs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: program.id }),
      });
      if (!response.ok) {
        return;
      }
      router.push("/dashboard/programs");
      router.refresh();
    } catch {
      // Global app toast provider handles mutation failure notifications.
    } finally {
      setDeletePending(false);
      setConfirmDelete(false);
    }
  };

  if (isLoading) {
    return (
      <section className="brand-card p-5">
        <LoadingIndicator label="Loading program..." />
      </section>
    );
  }

  if (!program) {
    return (
      <section className="brand-card p-5">
        <ToastMessage type="error" message={error || "Program not found."} />
      </section>
    );
  }

  return (
    <section className="brand-card p-5">
      <ToastMessage type="error" message={error} />

      <p className="brand-section-title">{t("program.editTitle") || "Manage Program"}</p>
      <p className="brand-muted mt-2 text-sm">
        {program.code} - {program.title}
      </p>

      <form className="mt-4 grid gap-4" onSubmit={onUpdateProgram}>
        <label className="grid gap-1.5">
          <span className="brand-label">{t("label.programCode") || "Code"}</span>
          <input className="brand-input" value={program.code} disabled />
        </label>

        {renderLocalizationFields(editSourceLanguage, editLocalizations)}

        {/* <label className="grid gap-1.5">
          <span className="brand-label">{t("program.overview") || "Program Overview"}</span>
          <textarea
            className="brand-input min-h-[110px]"
            value={editOverview}
            onChange={(event) => setEditOverview(event.currentTarget.value)}
            maxLength={3000}
            placeholder="Short summary shown in Program Overview section."
          />
        </label> */}

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

        <label className="grid gap-1.5 md:max-w-sm">
          <span className="brand-label">Degree Level</span>
          <select
            className="brand-input"
            value={editDegreeLevel}
            onChange={(e) => setEditDegreeLevel(e.currentTarget.value as any)}
          >
            <option value="">Select degree level</option>
            <option value="Bachelor’s Degree">Bachelor’s Degree</option>
            <option value="Master’s Degree">Master’s Degree</option>
            <option value="Higher National Diploma (HND)">Higher National Diploma (HND)</option>
          </select>
        </label>
        <label className="grid gap-1.5 md:max-w-sm">
          <span className="brand-label">Field of Study</span>
          <input className="brand-input" value={editFieldOfStudy} onChange={(e) => setEditFieldOfStudy(e.currentTarget.value)} maxLength={120} />
        </label>

        {/* <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.curriculum") || "Curriculum (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={editCurriculum}
              onChange={(event) => setEditCurriculum(event.currentTarget.value)}
              placeholder="Introduction to Business"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.admissionRequirements") || "Admission Requirements (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={editAdmissionRequirements}
              onChange={(event) => setEditAdmissionRequirements(event.currentTarget.value)}
              placeholder="High school diploma or equivalent"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.careerOpportunities") || "Career Opportunities (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={editCareerOpportunities}
              onChange={(event) => setEditCareerOpportunities(event.currentTarget.value)}
              placeholder="Business Manager"
            />
          </label>
        </div> */}

        <p className="text-xs text-[#3a689f]">
          Preview counts: Curriculum {editContentPreview.curriculum}, Requirements {editContentPreview.admissionRequirements}, Careers{" "}
          {editContentPreview.careerOpportunities}
        </p>

        <label className="grid gap-1.5">
          <span className="brand-label">{t("label.visibility") || "Visibility"}</span>
          <select className="brand-input" value={editVisibility} onChange={(event) => setEditVisibility(event.currentTarget.value as "DRAFT" | "PUBLISHED")}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="brand-label">{t("label.assignedCourses") || "Assigned Courses"}</span>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
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
                    x
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <input
                className="brand-input"
                placeholder={t("placeholder.courseSearch") || "Search courses..."}
                value={editCourseSearch}
                onChange={(event) => setEditCourseSearch(event.currentTarget.value)}
              />
              {editCourseSearch.trim() ? (
                <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded-md border border-[#c6ddfa] bg-white p-2 shadow-lg">
                  {filteredEditCourses
                    .filter((course) => !editCourseIds.includes(course.id))
                    .map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-[#eff6ff]"
                        onClick={() => {
                          toggleEditCourse(course.id);
                          setEditCourseSearch("");
                        }}
                      >
                        <span className="truncate">
                          {course.code} - {course.title}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={editPending}>
            {editPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
            onClick={() => setConfirmDelete(true)}
            disabled={deletePending}
          >
            {deletePending ? "Deleting..." : "Delete Program"}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmDelete}
        title="Delete Program?"
        message="This action cannot be undone."
        confirmLabel={deletePending ? "Deleting..." : "Delete Program"}
        cancelLabel="Cancel"
        onCancel={() => (deletePending ? null : setConfirmDelete(false))}
        onConfirm={onDeleteProgram}
        destructive
      />
    </section>
  );
}
