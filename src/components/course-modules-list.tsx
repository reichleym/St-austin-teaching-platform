"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { toast } from "@/lib/toast";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

type LessonItem = {
  id: string;
  title: string;
  position: number;
  visibility: "VISIBLE" | "HIDDEN";
  isRequired: boolean;
  completedByViewer: boolean;
};

type ModuleItem = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  releaseAt: string | null;
  visibilityRule: "ALL_VISIBLE" | "LIMITED_ACCESS";
  accessState: "LOCKED" | "OPEN";
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  lessons: LessonItem[];
};

type ModulesResponse = {
  modules?: ModuleItem[];
  error?: string;
};

type Props = {
  courseId: string;
  role: AppRole;
  assignmentsAnchorId?: string;
  showManageActions?: boolean;
  showAssignmentsLink?: boolean;
  showViewAllLink?: boolean;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

export function CourseModulesList({
  courseId,
  role,
  assignmentsAnchorId = "course-assignments",
  showManageActions = false,
  showAssignmentsLink = true,
  showViewAllLink = false,
}: Props) {
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEACHER";
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [showCreateLesson, setShowCreateLesson] = useState(false);
  const [createModuleTitle, setCreateModuleTitle] = useState("");
  const [createModuleDescription, setCreateModuleDescription] = useState("");
  const [createModuleReleaseAt, setCreateModuleReleaseAt] = useState("");
  const [createLessonModuleId, setCreateLessonModuleId] = useState("");
  const [createLessonTitle, setCreateLessonTitle] = useState("");
  const [createLessonContent, setCreateLessonContent] = useState("");
  const [createLessonVisibility, setCreateLessonVisibility] = useState<"VISIBLE" | "HIDDEN">("VISIBLE");
  const [createLessonRequired, setCreateLessonRequired] = useState(true);
  const [createLessonEmbedUrl, setCreateLessonEmbedUrl] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [showEditModule, setShowEditModule] = useState(false);
  const [editModuleId, setEditModuleId] = useState("");
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [editModuleDescription, setEditModuleDescription] = useState("");
  const [editModuleReleaseAt, setEditModuleReleaseAt] = useState("");
  const [updatePending, setUpdatePending] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/modules?courseId=${encodeURIComponent(courseId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ModulesResponse) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load modules.");
      }
      setModules(result.modules ?? []);
    } catch {
      setError("Unable to load modules.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    void loadModules();
  }, [courseId, loadModules]);


  const hasModules = useMemo(() => modules.length > 0, [modules]);
  const moduleOptions = useMemo(
    () => modules.map((moduleItem) => ({ id: moduleItem.id, label: `${moduleItem.position + 1}. ${moduleItem.title}` })),
    [modules]
  );

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    const shouldLock = showCreateModule || showCreateLesson || showEditModule;
    if (shouldLock) {
      document.body.classList.add("overflow-hidden", "modal-open");
    } else {
      document.body.classList.remove("overflow-hidden", "modal-open");
    }
    return () => {
      document.body.classList.remove("overflow-hidden", "modal-open");
    };
  }, [showCreateLesson, showCreateModule, showEditModule]);

  const resetModuleForm = () => {
    setCreateModuleTitle("");
    setCreateModuleDescription("");
    setCreateModuleReleaseAt("");
  };

  const resetLessonForm = () => {
    setCreateLessonModuleId("");
    setCreateLessonTitle("");
    setCreateLessonContent("");
    setCreateLessonVisibility("VISIBLE");
    setCreateLessonRequired(true);
    setCreateLessonEmbedUrl("");
  };

  const resetEditModuleForm = () => {
    setEditModuleId("");
    setEditModuleTitle("");
    setEditModuleDescription("");
    setEditModuleReleaseAt("");
  };

  const openEditModule = (moduleItem: ModuleItem) => {
    if (!canManage) return;
    setEditModuleId(moduleItem.id);
    setEditModuleTitle(moduleItem.title);
    setEditModuleDescription(moduleItem.description ?? "");
    setEditModuleReleaseAt(
      moduleItem.releaseAt
        ? new Date(moduleItem.releaseAt).toISOString().slice(0, 10)
        : ""
    );
    setShowEditModule(true);
  };

  const onCreateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    const title = createModuleTitle.trim();
    if (!title) {
      toast.error("Module title is required.");
      return;
    }
    setCreatePending(true);
    setError("");
    try {
      const response = await fetch("/api/courses/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title,
          description: createModuleDescription.trim() || undefined,
          releaseAt: createModuleReleaseAt || undefined,
          visibilityRule: "ALL_VISIBLE",
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create module.");
        return;
      }
      resetModuleForm();
      setShowCreateModule(false);
      await loadModules();
    } catch {
      setError("Unable to create module.");
    } finally {
      setCreatePending(false);
    }
  };

  const onCreateLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    const title = createLessonTitle.trim();
    if (!createLessonModuleId) {
      toast.error("Select a module for the lesson.");
      return;
    }
    if (!title) {
      toast.error("Lesson title is required.");
      return;
    }
    setCreatePending(true);
    setError("");
    try {
      const response = await fetch("/api/courses/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: createLessonModuleId,
          title,
          content: createLessonContent.trim() || undefined,
          visibility: createLessonVisibility,
          isRequired: createLessonRequired,
          embedUrl: createLessonEmbedUrl.trim() || undefined,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create lesson.");
        return;
      }
      resetLessonForm();
      setShowCreateLesson(false);
      await loadModules();
    } catch {
      setError("Unable to create lesson.");
    } finally {
      setCreatePending(false);
    }
  };

  const onUpdateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !editModuleId) return;
    const title = editModuleTitle.trim();
    if (!title) {
      toast.error("Module title is required.");
      return;
    }
    setUpdatePending(true);
    setError("");
    try {
      const response = await fetch("/api/courses/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: editModuleId,
          title,
          description: editModuleDescription.trim(),
          releaseAt: editModuleReleaseAt,
          visibilityRule: "ALL_VISIBLE",
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update module.");
        return;
      }
      setShowEditModule(false);
      resetEditModuleForm();
      await loadModules();
    } catch {
      setError("Unable to update module.");
    } finally {
      setUpdatePending(false);
    }
  };

  return (
    <article className="brand-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-section-title">Modules & Lessons</p>
          <p className="brand-muted mt-1 text-xs">Review modules and lessons for this course.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showViewAllLink && canManage ? (
            <a
              href={`/dashboard/courses/${courseId}/structure`}
              className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
            >
              Manage Modules
            </a>
          ) : null}
          {showManageActions && canManage ? (
            <>
              <button
                type="button"
                className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                onClick={() => setShowCreateModule(true)}
              >
                Create Module
              </button>
              <button
                type="button"
                className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                onClick={() => setShowCreateLesson(true)}
                disabled={!modules.length}
              >
                Create Lesson
              </button>
            </>
          ) : null}
          {showAssignmentsLink ? (
            <a
              href={`#${assignmentsAnchorId}`}
              className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
            >
              Assignments
            </a>
          ) : null}
        </div>
      </div>

      <ToastMessage type="error" message={error} />

      {loading ? (
        <div className="mt-3">
          <LoadingIndicator label="Loading modules..." />
        </div>
      ) : null}

      {!loading && !hasModules ? (
        <p className="brand-muted mt-3 text-sm">No modules configured yet.</p>
      ) : null}

      {!loading && hasModules ? (
        <div className="mt-4 space-y-4">
          {modules.map((moduleItem) => {
            const hasLessons = moduleItem.lessons.length > 0;

            return (
              <div key={moduleItem.id} className="rounded-lg border border-[#d6e7fb] bg-white/80 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0b3e81]">
                      {moduleItem.position + 1}. {moduleItem.title}
                    </p>
                    <p className="brand-muted mt-1 text-xs">
                      Release: {formatDate(moduleItem.releaseAt)}
                    </p>
                    {moduleItem.description ? (
                      <p className="mt-2 text-xs text-[#2f5d96]">{moduleItem.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#edf5ff] px-3 py-1 text-xs font-semibold text-[#1f518f]">
                      {moduleItem.completedLessons}/{moduleItem.lessonCount} lessons
                    </span>
                    {showManageActions && canManage ? (
                      <button
                        type="button"
                        className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                        onClick={() => openEditModule(moduleItem)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>

                {hasLessons ? (
                  <div className="mt-3 space-y-2">
                    {moduleItem.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#dbe9fb] bg-white px-3 py-2 text-xs text-[#2f5d96]">
                        <div>
                          <span className="font-semibold text-[#0b3e81]">
                            {lesson.position + 1}. {lesson.title}
                          </span>
                          <span className="ml-2">
                            ({lesson.visibility}{lesson.isRequired ? ", required" : ""})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="brand-muted mt-3 text-xs">No lessons yet.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {portalRoot && showCreateModule && showManageActions && canManage
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
              <section className="brand-card w-full max-w-2xl p-5">
                <p className="brand-section-title">Create Module</p>
                <form className="mt-3 grid gap-4" onSubmit={onCreateModule}>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Module Title</span>
                    <input
                      className="brand-input"
                      value={createModuleTitle}
                      onChange={(event) => setCreateModuleTitle(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Description</span>
                    <textarea
                      className="brand-input min-h-[90px]"
                      value={createModuleDescription}
                      onChange={(event) => setCreateModuleDescription(event.currentTarget.value)}
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Release Date</span>
                      <input
                        className="brand-input"
                        type="date"
                        value={createModuleReleaseAt}
                        onChange={(event) => setCreateModuleReleaseAt(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-sm font-semibold text-[#1f518f]"
                      onClick={() => {
                        setShowCreateModule(false);
                        resetModuleForm();
                      }}
                      disabled={createPending}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-brand-primary px-2 py-2 text-sm font-semibold" disabled={createPending}>
                      {createPending ? "Creating..." : "Create Module"}
                    </button>
                  </div>
                </form>
              </section>
            </div>,
            portalRoot
          )
        : null}

      {portalRoot && showEditModule && showManageActions && canManage
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
              <section className="brand-card w-full max-w-2xl p-5">
                <p className="brand-section-title">Edit Module</p>
                <form className="mt-3 grid gap-4" onSubmit={onUpdateModule}>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Module Title</span>
                    <input
                      className="brand-input"
                      value={editModuleTitle}
                      onChange={(event) => setEditModuleTitle(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Description</span>
                    <textarea
                      className="brand-input min-h-[90px]"
                      value={editModuleDescription}
                      onChange={(event) => setEditModuleDescription(event.currentTarget.value)}
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Release Date</span>
                      <input
                        className="brand-input"
                        type="date"
                        value={editModuleReleaseAt}
                        onChange={(event) => setEditModuleReleaseAt(event.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-sm font-semibold text-[#1f518f]"
                      onClick={() => {
                        setShowEditModule(false);
                        resetEditModuleForm();
                      }}
                      disabled={updatePending}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-brand-primary px-2 py-2 text-sm font-semibold" disabled={updatePending}>
                      {updatePending ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>
            </div>,
            portalRoot
          )
        : null}

      {portalRoot && showCreateLesson && showManageActions && canManage
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
              <section className="brand-card w-full max-w-2xl p-5">
                <p className="brand-section-title">Create Lesson</p>
                <form className="mt-3 grid gap-4" onSubmit={onCreateLesson}>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Module</span>
                    <select
                      className="brand-input"
                      value={createLessonModuleId}
                      onChange={(event) => setCreateLessonModuleId(event.currentTarget.value)}
                      required
                    >
                      <option value="">Select module</option>
                      {moduleOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Lesson Title</span>
                    <input
                      className="brand-input"
                      value={createLessonTitle}
                      onChange={(event) => setCreateLessonTitle(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Content</span>
                    <textarea
                      className="brand-input min-h-[90px]"
                      value={createLessonContent}
                      onChange={(event) => setCreateLessonContent(event.currentTarget.value)}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Embed URL (optional)</span>
                    <input
                      className="brand-input"
                      value={createLessonEmbedUrl}
                      onChange={(event) => setCreateLessonEmbedUrl(event.currentTarget.value)}
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Visibility</span>
                      <select
                        className="brand-input"
                        value={createLessonVisibility}
                        onChange={(event) =>
                          setCreateLessonVisibility(event.currentTarget.value as "VISIBLE" | "HIDDEN")
                        }
                      >
                        <option value="VISIBLE">Visible</option>
                        <option value="HIDDEN">Hidden</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">Required</span>
                      <select
                        className="brand-input"
                        value={createLessonRequired ? "yes" : "no"}
                        onChange={(event) => setCreateLessonRequired(event.currentTarget.value === "yes")}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-sm font-semibold text-[#1f518f]"
                      onClick={() => {
                        setShowCreateLesson(false);
                        resetLessonForm();
                      }}
                      disabled={createPending}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-brand-primary px-2 py-2 text-sm font-semibold" disabled={createPending}>
                      {createPending ? "Creating..." : "Create Lesson"}
                    </button>
                  </div>
                </form>
              </section>
            </div>,
            portalRoot
          )
        : null}
    </article>
  );
}
