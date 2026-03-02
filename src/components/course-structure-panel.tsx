"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type LessonItem = {
  id: string;
  title: string;
  content: string | null;
  position: number;
  visibility: "VISIBLE" | "HIDDEN";
  isRequired: boolean;
  embedUrl: string | null;
  attachments?: Array<{
    id?: string;
    kind?: string;
    label?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    storageKey?: string | null;
    publicUrl?: string | null;
  }>;
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
  analytics?: {
    totalLessons: number;
    completedLessons: number;
    courseProgressPercent: number;
  } | null;
  error?: string;
};

type Props = {
  role: Role;
  courses: CourseOption[];
  initialCourseId?: string;
  showCourseSelector?: boolean;
};

type ModuleStudent = {
  id: string;
  name: string | null;
  email: string;
  assigned: boolean;
};

const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

export function CourseStructurePanel({ role, courses, initialCourseId, showCourseSelector = true }: Props) {
  const canManage = role === Role.SUPER_ADMIN || role === Role.TEACHER;
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || courses[0]?.id || "");

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [analytics, setAnalytics] = useState<ModulesResponse["analytics"]>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [createModuleTitle, setCreateModuleTitle] = useState("");
  const [createModuleDescription, setCreateModuleDescription] = useState("");
  const [createModuleReleaseAt, setCreateModuleReleaseAt] = useState("");
  const [createModuleVisibilityRule, setCreateModuleVisibilityRule] = useState<"ALL_VISIBLE" | "LIMITED_ACCESS">("ALL_VISIBLE");
  const [createModulePending, setCreateModulePending] = useState(false);

  const [lessonDraftByModule, setLessonDraftByModule] = useState<
    Record<
      string,
      {
        title: string;
        content: string;
        visibility: "VISIBLE" | "HIDDEN";
        embedUrl: string;
        youtubeUrl: string;
        files: File[];
      }
    >
  >({});

  const [pendingModuleId, setPendingModuleId] = useState("");
  const [pendingLessonId, setPendingLessonId] = useState("");
  const [moduleStudentsById, setModuleStudentsById] = useState<Record<string, ModuleStudent[]>>({});
  const [pendingAssignmentKey, setPendingAssignmentKey] = useState("");

  useEffect(() => {
    if (!selectedCourseId && courses.length) {
      setSelectedCourseId(initialCourseId || courses[0].id);
    }
  }, [courses, initialCourseId, selectedCourseId]);

  const loadModules = async (courseId: string) => {
    if (!courseId) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/modules?courseId=${encodeURIComponent(courseId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as ModulesResponse) : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to load modules.");
        setModules([]);
        setAnalytics(null);
        return;
      }

      setModules(result.modules ?? []);
      setAnalytics(result.analytics ?? null);
    } catch {
      setError("Unable to load modules.");
      setModules([]);
      setAnalytics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCourseId) return;
    void loadModules(selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!canManage || !modules.length) return;
    for (const moduleItem of modules) {
      if (!moduleStudentsById[moduleItem.id]) {
        void loadModuleStudents(moduleItem.id);
      }
    }
  }, [canManage, modules, moduleStudentsById]);

  const moduleCountLabel = useMemo(() => `${modules.length} module${modules.length === 1 ? "" : "s"}`, [modules]);

  const onCreateModule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId) return;

    setCreateModulePending(true);
    setError("");
    try {
      const response = await fetch("/api/courses/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourseId,
          title: createModuleTitle,
          description: createModuleDescription,
          releaseAt: createModuleReleaseAt || null,
          visibilityRule: createModuleVisibilityRule,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create module.");
        return;
      }

      setCreateModuleTitle("");
      setCreateModuleDescription("");
      setCreateModuleReleaseAt("");
      setCreateModuleVisibilityRule("ALL_VISIBLE");
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to create module.");
    } finally {
      setCreateModulePending(false);
    }
  };

  const patchModule = async (moduleId: string, body: Record<string, unknown>) => {
    setPendingModuleId(moduleId);
    setError("");
    try {
      const response = await fetch("/api/courses/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, ...body }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update module.");
        return;
      }
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to update module.");
    } finally {
      setPendingModuleId("");
    }
  };

  const deleteModule = async (moduleId: string) => {
    setPendingModuleId(moduleId);
    setError("");
    try {
      const response = await fetch("/api/courses/modules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to delete module.");
        return;
      }
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to delete module.");
    } finally {
      setPendingModuleId("");
    }
  };

  const createLesson = async (moduleId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = lessonDraftByModule[moduleId];
    if (!draft?.title.trim()) return;

    setPendingModuleId(moduleId);
    setError("");
    try {
      const uploadedAttachments: Array<{
        kind: "FILE" | "PDF" | "VIDEO_LINK";
        label: string;
        fileName?: string;
        mimeType?: string;
        sizeBytes?: number;
        storageKey?: string;
        publicUrl: string;
      }> = [];

      for (const file of draft.files ?? []) {
        const form = new FormData();
        form.set("file", file);
        const uploadResponse = await fetch("/api/courses/uploads", {
          method: "POST",
          body: form,
        });
        const uploadRaw = await uploadResponse.text();
        const uploadResult = uploadRaw
          ? (JSON.parse(uploadRaw) as { error?: string; attachment?: typeof uploadedAttachments[number] })
          : {};
        if (!uploadResponse.ok || !uploadResult.attachment) {
          setError(uploadResult.error ?? "Unable to upload lesson file.");
          return;
        }
        uploadedAttachments.push(uploadResult.attachment);
      }

      const response = await fetch("/api/courses/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          title: draft.title,
          content: draft.content,
          visibility: draft.visibility,
          embedUrl: draft.youtubeUrl || draft.embedUrl || null,
          attachments: uploadedAttachments,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create lesson.");
        return;
      }
      setLessonDraftByModule((prev) => ({
        ...prev,
        [moduleId]: {
          title: "",
          content: "",
          visibility: "VISIBLE",
          embedUrl: "",
          youtubeUrl: "",
          files: [],
        },
      }));
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to create lesson.");
    } finally {
      setPendingModuleId("");
    }
  };

  const patchLesson = async (lessonId: string, body: Record<string, unknown>) => {
    setPendingLessonId(lessonId);
    setError("");
    try {
      const response = await fetch("/api/courses/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, ...body }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update lesson.");
        return;
      }
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to update lesson.");
    } finally {
      setPendingLessonId("");
    }
  };

  const loadModuleStudents = async (moduleId: string) => {
    try {
      const response = await fetch(`/api/courses/modules/assignments?moduleId=${encodeURIComponent(moduleId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { students?: ModuleStudent[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load module students.");
        return;
      }
      setModuleStudentsById((prev) => ({ ...prev, [moduleId]: result.students ?? [] }));
    } catch {
      setError("Unable to load module students.");
    }
  };

  const setModuleAssignment = async (moduleId: string, studentId: string, assigned: boolean) => {
    setPendingAssignmentKey(`${moduleId}:${studentId}`);
    setError("");
    try {
      const response = await fetch("/api/courses/modules/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, studentId, assigned }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update module assignment.");
        return;
      }
      await loadModuleStudents(moduleId);
    } catch {
      setError("Unable to update module assignment.");
    } finally {
      setPendingAssignmentKey("");
    }
  };

  const setLessonCompletionForStudent = async (lessonId: string, studentId: string, completed: boolean) => {
    setPendingLessonId(`${lessonId}:${studentId}`);
    setError("");
    try {
      const response = await fetch("/api/courses/lessons/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, studentId, completed }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to update lesson completion.");
        return;
      }
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to update lesson completion.");
    } finally {
      setPendingLessonId("");
    }
  };

  const deleteLesson = async (lessonId: string) => {
    setPendingLessonId(lessonId);
    setError("");
    try {
      const response = await fetch("/api/courses/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to delete lesson.");
        return;
      }
      await loadModules(selectedCourseId);
    } catch {
      setError("Unable to delete lesson.");
    } finally {
      setPendingLessonId("");
    }
  };

  return (
    <section className="brand-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="brand-section-title">Module & Lesson Management</p>
        <div className="flex items-center gap-3">
          <span className="brand-muted text-xs">{moduleCountLabel}</span>
          {showCourseSelector ? (
            <select
              className="brand-input w-[300px]"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.currentTarget.value)}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {analytics ? (
        <div className="mt-3 rounded-lg border border-[#d4e5fa] bg-[#f8fcff] p-3 text-sm text-[#1f4f8e]">
          Progress: {analytics.completedLessons}/{analytics.totalLessons} lessons completed ({analytics.courseProgressPercent}%)
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {isLoading ? <p className="brand-muted mt-3 text-sm">Loading course structure...</p> : null}

      {canManage && selectedCourseId ? (
        <form className="mt-4 grid gap-3 rounded-lg border border-[#d4e5fa] bg-white p-4" onSubmit={onCreateModule}>
          <p className="brand-label">Create Module</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="brand-input"
              placeholder="Module title"
              value={createModuleTitle}
              onChange={(event) => setCreateModuleTitle(event.currentTarget.value)}
              required
            />
            <input
              className="brand-input"
              placeholder="Description (optional)"
              value={createModuleDescription}
              onChange={(event) => setCreateModuleDescription(event.currentTarget.value)}
            />
            <input
              className="brand-input"
              type="date"
              value={createModuleReleaseAt}
              onChange={(event) => setCreateModuleReleaseAt(event.currentTarget.value)}
            />
            <select
              className="brand-input"
              value={createModuleVisibilityRule}
              onChange={(event) => setCreateModuleVisibilityRule(event.currentTarget.value as "ALL_VISIBLE" | "LIMITED_ACCESS")}
            >
              <option value="ALL_VISIBLE">All visible</option>
              <option value="LIMITED_ACCESS">Limited access</option>
            </select>
          </div>
          <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={createModulePending}>
            {createModulePending ? "Creating..." : "Create Module"}
          </button>
        </form>
      ) : null}

      <div className="mt-4 space-y-4">
        {modules.map((module, moduleIndex) => (
          <article key={module.id} className="rounded-lg border border-[#cfe2fb] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#2d5f9a]">Module {module.position + 1}</p>
                <p className="text-lg font-bold text-[#0d3f80]">{module.title}</p>
                {module.description ? <p className="mt-1 text-sm text-[#345f95]">{module.description}</p> : null}
                <p className="mt-1 text-xs text-[#3d6da8]">
                  Release: {module.releaseAt ? new Date(module.releaseAt).toLocaleDateString() : "No schedule"} | Access: {module.accessState}
                </p>
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                    disabled={pendingModuleId === module.id || moduleIndex === 0}
                    onClick={() => void patchModule(module.id, { position: moduleIndex - 1 })}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                    disabled={pendingModuleId === module.id || moduleIndex === modules.length - 1}
                    onClick={() => void patchModule(module.id, { position: moduleIndex + 1 })}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                    disabled={pendingModuleId === module.id}
                    onClick={() => void deleteModule(module.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            {canManage ? (
              <form
                className="mt-3 grid gap-2 rounded-md border border-[#d9e8fb] bg-[#f8fbff] p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const title = (new FormData(form).get("title") as string) || "";
                  const description = (new FormData(form).get("description") as string) || "";
                  const releaseAt = (new FormData(form).get("releaseAt") as string) || "";
                  const visibilityRule = ((new FormData(form).get("visibilityRule") as string) || "ALL_VISIBLE") as
                    | "ALL_VISIBLE"
                    | "LIMITED_ACCESS";
                  void patchModule(module.id, {
                    title,
                    description,
                    releaseAt: releaseAt || null,
                    visibilityRule,
                  });
                }}
              >
                <input className="brand-input" name="title" defaultValue={module.title} required />
                <input className="brand-input" name="description" defaultValue={module.description ?? ""} placeholder="Description" />
                <div className="grid gap-2 md:grid-cols-2">
                  <input className="brand-input" type="date" name="releaseAt" defaultValue={toDateInput(module.releaseAt)} />
                  <select className="brand-input" name="visibilityRule" defaultValue={module.visibilityRule}>
                    <option value="ALL_VISIBLE">All visible</option>
                    <option value="LIMITED_ACCESS">Limited access</option>
                  </select>
                </div>
                <button className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" disabled={pendingModuleId === module.id}>
                  Save Module
                </button>
              </form>
            ) : null}

            {canManage ? (
              <div className="mt-3 rounded-md border border-[#d9e8fb] bg-[#f8fbff] p-3">
                <p className="brand-label">Assign Students to This Module</p>
                <div className="mt-2 grid gap-2">
                  {(moduleStudentsById[module.id] ?? []).map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded border border-[#e3eefc] bg-white px-3 py-2">
                      <p className="text-xs text-[#1c4f8f]">{(student.name || "Unnamed Student") + " - " + student.email}</p>
                      <button
                        type="button"
                        className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                        disabled={pendingAssignmentKey === `${module.id}:${student.id}`}
                        onClick={() => void setModuleAssignment(module.id, student.id, !student.assigned)}
                      >
                        {student.assigned ? "Unassign" : "Assign"}
                      </button>
                    </div>
                  ))}
                  {!moduleStudentsById[module.id]?.length ? (
                    <p className="text-xs text-[#3a689f]">No enrolled students found.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {module.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="rounded-md border border-[#dfecfc] bg-[#fbfdff] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#194d8e]">
                      {lessonIndex + 1}. {lesson.title} {lesson.visibility === "HIDDEN" ? "(Hidden)" : ""}
                    </p>
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          disabled={pendingLessonId === lesson.id || lessonIndex === 0}
                          onClick={() => void patchLesson(lesson.id, { position: lessonIndex - 1 })}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          disabled={pendingLessonId === lesson.id || lessonIndex === module.lessons.length - 1}
                          onClick={() => void patchLesson(lesson.id, { position: lessonIndex + 1 })}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                          disabled={pendingLessonId === lesson.id}
                          onClick={() => void deleteLesson(lesson.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {lesson.content ? <p className="mt-1 whitespace-pre-wrap text-xs text-[#345f95]">{lesson.content}</p> : null}
                  {lesson.embedUrl ? (
                    <p className="mt-1 text-xs text-[#2f64a4]">
                      Video:{" "}
                      <a className="underline" href={lesson.embedUrl} target="_blank" rel="noreferrer">
                        Open YouTube
                      </a>
                    </p>
                  ) : null}
                  {lesson.attachments?.length ? (
                    <div className="mt-2 space-y-1">
                      {lesson.attachments.map((attachment, index) => (
                        <p key={attachment.id ?? `${lesson.id}-${index}`} className="text-xs text-[#2f64a4]">
                          <a className="underline" href={attachment.publicUrl ?? "#"} target="_blank" rel="noreferrer">
                            {attachment.label || attachment.fileName || `Attachment ${index + 1}`}
                          </a>
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {canManage ? (
                    <form
                      className="mt-2 grid gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const title = (new FormData(form).get("title") as string) || "";
                        const content = (new FormData(form).get("content") as string) || "";
                        const visibility = ((new FormData(form).get("visibility") as string) || "VISIBLE") as
                          | "VISIBLE"
                          | "HIDDEN";
                        const embedUrl = (new FormData(form).get("embedUrl") as string) || "";
                        void patchLesson(lesson.id, {
                          title,
                          content,
                          visibility,
                          embedUrl: embedUrl || null,
                        });
                      }}
                    >
                      <input className="brand-input" name="title" defaultValue={lesson.title} required />
                      <textarea className="brand-input min-h-[72px]" name="content" defaultValue={lesson.content ?? ""} />
                      <div className="grid gap-2 md:grid-cols-2">
                        <select className="brand-input" name="visibility" defaultValue={lesson.visibility}>
                          <option value="VISIBLE">Visible</option>
                          <option value="HIDDEN">Hidden</option>
                        </select>
                        <input className="brand-input" name="embedUrl" defaultValue={lesson.embedUrl ?? ""} placeholder="YouTube URL" />
                      </div>
                      <button className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" disabled={pendingLessonId === lesson.id}>
                        Save Lesson
                      </button>
                    </form>
                  ) : null}

                  {canManage ? (
                    <div className="mt-2 rounded-md border border-[#e3eefc] bg-white p-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#2d5f9a]">Student Completion Controls</p>
                      <div className="mt-2 grid gap-2">
                        {(moduleStudentsById[module.id] ?? [])
                          .filter((student) => student.assigned)
                          .map((student) => (
                            <div key={`${lesson.id}-${student.id}`} className="flex items-center justify-between gap-3">
                              <p className="text-xs text-[#1c4f8f]">{(student.name || "Unnamed Student") + " - " + student.email}</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                                  disabled={pendingLessonId === `${lesson.id}:${student.id}`}
                                  onClick={() => void setLessonCompletionForStudent(lesson.id, student.id, true)}
                                >
                                  Mark Complete
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                                  disabled={pendingLessonId === `${lesson.id}:${student.id}`}
                                  onClick={() => void setLessonCompletionForStudent(lesson.id, student.id, false)}
                                >
                                  Mark Incomplete
                                </button>
                              </div>
                            </div>
                          ))}
                        {(moduleStudentsById[module.id] ?? []).filter((student) => student.assigned).length === 0 ? (
                          <p className="text-xs text-[#3a689f]">Assign students to this module first.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {canManage ? (
              <form className="mt-3 grid gap-2 rounded-md border border-dashed border-[#c3daf8] p-3" onSubmit={(event) => void createLesson(module.id, event)}>
                <p className="brand-label">Add Lesson</p>
                <input
                  className="brand-input"
                  placeholder="Lesson title"
                  value={lessonDraftByModule[module.id]?.title ?? ""}
                  onChange={(event) => {
                    const nextTitle = event.currentTarget.value;
                    setLessonDraftByModule((prev) => ({
                      ...prev,
                      [module.id]: {
                        title: nextTitle,
                        content: prev[module.id]?.content ?? "",
                        visibility: prev[module.id]?.visibility ?? "VISIBLE",
                        embedUrl: prev[module.id]?.embedUrl ?? "",
                        youtubeUrl: prev[module.id]?.youtubeUrl ?? "",
                        files: prev[module.id]?.files ?? [],
                      },
                    }));
                  }}
                  required
                />
                <textarea
                  className="brand-input min-h-[72px]"
                  placeholder="Lesson content"
                  value={lessonDraftByModule[module.id]?.content ?? ""}
                  onChange={(event) => {
                    const nextContent = event.currentTarget.value;
                    setLessonDraftByModule((prev) => ({
                      ...prev,
                      [module.id]: {
                        title: prev[module.id]?.title ?? "",
                        content: nextContent,
                        visibility: prev[module.id]?.visibility ?? "VISIBLE",
                        embedUrl: prev[module.id]?.embedUrl ?? "",
                        youtubeUrl: prev[module.id]?.youtubeUrl ?? "",
                        files: prev[module.id]?.files ?? [],
                      },
                    }));
                  }}
                />
                <div className="grid gap-2 md:grid-cols-[160px_minmax(260px,1fr)_auto] md:items-center">
                  <select
                    className="brand-input"
                    value={lessonDraftByModule[module.id]?.visibility ?? "VISIBLE"}
                    onChange={(event) => {
                      const nextVisibility = event.currentTarget.value as "VISIBLE" | "HIDDEN";
                      setLessonDraftByModule((prev) => ({
                        ...prev,
                        [module.id]: {
                          title: prev[module.id]?.title ?? "",
                          content: prev[module.id]?.content ?? "",
                          visibility: nextVisibility,
                          embedUrl: prev[module.id]?.embedUrl ?? "",
                          youtubeUrl: prev[module.id]?.youtubeUrl ?? "",
                          files: prev[module.id]?.files ?? [],
                        },
                      }));
                    }}
                  >
                    <option value="VISIBLE">Visible</option>
                    <option value="HIDDEN">Hidden</option>
                  </select>
                  <input
                    className="brand-input"
                    placeholder="YouTube URL"
                    value={lessonDraftByModule[module.id]?.youtubeUrl ?? ""}
                    onChange={(event) => {
                      const nextYouTubeUrl = event.currentTarget.value;
                      setLessonDraftByModule((prev) => ({
                        ...prev,
                        [module.id]: {
                          title: prev[module.id]?.title ?? "",
                          content: prev[module.id]?.content ?? "",
                          visibility: prev[module.id]?.visibility ?? "VISIBLE",
                          embedUrl: nextYouTubeUrl,
                          youtubeUrl: nextYouTubeUrl,
                          files: prev[module.id]?.files ?? [],
                        },
                      }));
                    }}
                  />
                  <label
                    htmlFor={`lesson-files-${module.id}`}
                    className="brand-input inline-flex h-[42px] w-fit cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-[#1f518f]"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M8 12.5l6.4-6.4a3 3 0 114.2 4.2l-8.5 8.5a5 5 0 11-7.1-7.1l8.5-8.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Choose Files
                  </label>
                  <input
                    id={`lesson-files-${module.id}`}
                    className="hidden"
                    type="file"
                    multiple
                    onChange={(event) => {
                      const nextFiles = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                      setLessonDraftByModule((prev) => ({
                        ...prev,
                        [module.id]: {
                          title: prev[module.id]?.title ?? "",
                          content: prev[module.id]?.content ?? "",
                          visibility: prev[module.id]?.visibility ?? "VISIBLE",
                          embedUrl: prev[module.id]?.embedUrl ?? "",
                          youtubeUrl: prev[module.id]?.youtubeUrl ?? "",
                          files: nextFiles,
                        },
                      }));
                    }}
                  />
                </div>
                {lessonDraftByModule[module.id]?.files?.length ? (
                  <p className="text-xs text-[#2f64a4]">
                    {lessonDraftByModule[module.id].files.length} file(s) selected
                  </p>
                ) : null}
                <button className="btn-brand-primary w-fit px-3 py-1.5 text-xs font-semibold" disabled={pendingModuleId === module.id}>
                  Add Lesson
                </button>
              </form>
            ) : null}
          </article>
        ))}

        {!isLoading && !modules.length ? <p className="brand-muted text-sm">No modules created for this course yet.</p> : null}
      </div>
    </section>
  );
}
