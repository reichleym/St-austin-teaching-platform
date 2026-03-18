"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { AppRole, formatDateTime } from "@/components/engagement-shared";

type CourseOption = {
  id: string;
  code: string;
  title: string;
};

type ModuleOption = {
  id: string;
  title: string;
};

type DiscussionItem = {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  prompt: string;
  openAt: string | null;
  closeAt: string | null;
  allowLate: boolean;
  isGraded: boolean;
  maxPoints: number | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalEnrolled: number;
    completed: number;
    partial: number;
    notParticipated: number;
  };
  viewer: {
    hasInitialPost: boolean;
    replyCount: number;
    status: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED";
  } | null;
};

type EngagementResponse = {
  canManageGlobal: boolean;
  courses: CourseOption[];
  modules: ModuleOption[];
  selectedCourseId: string;
  selectedDiscussionId: string;
  discussions: DiscussionItem[];
  selectedDiscussion: unknown;
  error?: string;
};

type Props = {
  role: AppRole;
};

export function EngagementModule({ role }: Props) {
  const router = useRouter();
  const canModerate = role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEACHER";

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  const [createTitle, setCreateTitle] = useState("");
  const [createPrompt, setCreatePrompt] = useState("");
  const [createModuleId, setCreateModuleId] = useState("");
  const [createOpenAt, setCreateOpenAt] = useState("");
  const [createCloseAt, setCreateCloseAt] = useState("");
  const [createAllowLate, setCreateAllowLate] = useState(true);
  const [createIsGraded, setCreateIsGraded] = useState(false);
  const [createMaxPoints, setCreateMaxPoints] = useState("");

  const load = useCallback(async (courseId?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (courseId) query.set("courseId", courseId);
      const response = await fetch(`/api/engagement${query.toString() ? `?${query.toString()}` : ""}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as EngagementResponse) : ({} as EngagementResponse);
      if (!response.ok) {
        setError(result.error ?? "Unable to load engagement module.");
        return;
      }
      setCourses(result.courses ?? []);
      setModules(result.modules ?? []);
      setDiscussions(result.discussions ?? []);
      setSelectedCourseId(result.selectedCourseId ?? "");
    } catch {
      setError("Unable to load engagement module.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateDiscussion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourseId || !createModuleId) {
      setError("Module link is required.");
      return;
    }
    setPending("create-discussion");
    setError("");
    try {
      const response = await fetch("/api/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createDiscussion",
          courseId: selectedCourseId,
          moduleId: createModuleId || null,
          title: createTitle,
          prompt: createPrompt,
          openAt: createOpenAt || null,
          closeAt: createCloseAt || null,
          allowLate: createAllowLate,
          isGraded: createIsGraded,
          maxPoints: createIsGraded ? Number(createMaxPoints || 0) || null : null,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; discussionId?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to create discussion.");
        return;
      }
      setCreateTitle("");
      setCreatePrompt("");
      setCreateModuleId("");
      setCreateOpenAt("");
      setCreateCloseAt("");
      setCreateAllowLate(true);
      setCreateIsGraded(false);
      setCreateMaxPoints("");
      if (result.discussionId) {
        const courseParam = selectedCourseId ? `?courseId=${selectedCourseId}` : "";
        router.push(`/dashboard/engagement/${result.discussionId}${courseParam}`);
        return;
      }
      await load(selectedCourseId);
    } catch {
      setError("Unable to create discussion.");
    } finally {
      setPending("");
    }
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="brand-section-title">Discussion Topics</p>
          <label className="grid gap-1.5">
            <span className="brand-label">Course</span>
            <select
              className="brand-input w-[320px]"
              value={selectedCourseId}
              onChange={(event) => {
                const next = event.currentTarget.value;
                setSelectedCourseId(next);
                void load(next);
              }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ToastMessage type="error" message={error} />
        {loading ? (
          <div className="mt-3">
            <LoadingIndicator label="Loading discussions..." />
          </div>
        ) : null}

        {canModerate ? (
          <form className="mt-4 grid gap-2 rounded-md border border-[#dbe9fb] p-3" onSubmit={onCreateDiscussion}>
            <p className="brand-label">Create Discussion Topic</p>
            <label className="grid gap-1.5">
              <span className="brand-label">Discussion Title</span>
              <input className="brand-input" placeholder="Discussion title" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Prompt</span>
              <textarea className="brand-input min-h-[84px]" placeholder="Prompt / question" value={createPrompt} onChange={(event) => setCreatePrompt(event.currentTarget.value)} required />
            </label>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="brand-label">Module</span>
                <select className="brand-input" value={createModuleId} onChange={(event) => setCreateModuleId(event.currentTarget.value)}>
                  <option value="">Select module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="brand-label">Open At</span>
                <input className="brand-input" type="datetime-local" value={createOpenAt} onChange={(event) => setCreateOpenAt(event.currentTarget.value)} required />
              </label>
              <label className="grid gap-1">
                <span className="brand-label">Close At</span>
                <input className="brand-input" type="datetime-local" value={createCloseAt} onChange={(event) => setCreateCloseAt(event.currentTarget.value)} required />
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="brand-input inline-flex items-center gap-2">
                <input type="checkbox" checked={createAllowLate} onChange={(event) => setCreateAllowLate(event.currentTarget.checked)} /> Allow late
              </label>
              <label className="brand-input inline-flex items-center gap-2">
                <input type="checkbox" checked={createIsGraded} onChange={(event) => setCreateIsGraded(event.currentTarget.checked)} />
                Graded discussion
              </label>
              <input
                className="brand-input"
                type="number"
                min={1}
                step={1}
                value={createMaxPoints}
                onChange={(event) => setCreateMaxPoints(event.currentTarget.value)}
                placeholder="Max points"
                disabled={!createIsGraded}
                required={createIsGraded}
              />
            </div>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={pending === "create-discussion" || !createModuleId || !modules.length}>
              {pending === "create-discussion" ? "Creating..." : "Create Topic"}
            </button>
            {!modules.length ? <p className="text-xs text-red-600">Create course modules first. Discussion topics require a module link.</p> : null}
          </form>
        ) : null}

        <div className="mt-4 space-y-2">
          {discussions.map((discussion) => (
            <Link
              key={discussion.id}
              href={selectedCourseId ? `/dashboard/engagement/${discussion.id}?courseId=${selectedCourseId}` : `/dashboard/engagement/${discussion.id}`}
              className="block rounded-md border border-[#dbe9fb] p-3 transition hover:border-[#8fb5ea] hover:bg-[#f6faff]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#0d3f80]">{discussion.title}</p>
                <div className="flex items-center gap-2 text-xs text-[#2f5f98]">
                  <span>Completed: {discussion.stats.completed}</span>
                  <span>Partial: {discussion.stats.partial}</span>
                  <span>Missing: {discussion.stats.notParticipated}</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#3768ac]">{discussion.prompt}</p>
              <p className="mt-1 text-xs text-[#3a689f]">
                Open: {formatDateTime(discussion.openAt)} | Close: {formatDateTime(discussion.closeAt)} |{" "}
                {discussion.isGraded ? `Graded (${discussion.maxPoints ?? 0} pts)` : "Ungraded"} |{" "}
                {discussion.isLocked ? "Locked" : "Open"}
              </p>
            </Link>
          ))}
          {!loading && !discussions.length ? <p className="brand-muted text-sm">No discussion topics yet.</p> : null}
        </div>
      </section>
    </section>
  );
}
