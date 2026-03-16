"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

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

type Indicator = {
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  hasInitialPost: boolean;
  replyCount: number;
  status: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED";
  score: number | null;
};

type PostItem = {
  id: string;
  discussionId: string;
  authorId: string;
  parentPostId: string | null;
  content: string;
  isPinned: boolean;
  isLate: boolean;
  lateByMinutes: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  canEdit: boolean;
};

type SelectedDiscussion = {
  id: string;
  title: string;
  prompt: string;
  openAt: string | null;
  closeAt: string | null;
  allowLate: boolean;
  isGraded: boolean;
  maxPoints: number | null;
  isLocked: boolean;
  posts: PostItem[];
  indicators: Indicator[];
  alerts: {
    missingStudents: Indicator[];
    partialStudents: Indicator[];
  };
  viewer: {
    hasInitialPost: boolean;
    replyCount: number;
    status: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED";
  } | null;
} | null;

type EngagementResponse = {
  canManageGlobal: boolean;
  courses: CourseOption[];
  modules: ModuleOption[];
  selectedCourseId: string;
  selectedDiscussionId: string;
  discussions: DiscussionItem[];
  selectedDiscussion: SelectedDiscussion;
  error?: string;
};

type Props = {
  role: AppRole;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatEngagementStatus = (value: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED") => value.replace(/_/g, " ");

const getPostingBlockReason = (
  discussion: { openAt: string | null; closeAt: string | null; allowLate: boolean; isLocked: boolean } | null,
  canModerate: boolean
) => {
  if (!discussion) return null;
  if (canModerate) return null;
  if (discussion.isLocked) return "Discussion is locked.";
  const now = new Date();
  if (discussion.openAt) {
    const openAt = new Date(discussion.openAt);
    if (!Number.isNaN(openAt.getTime()) && now < openAt) {
      return "Discussion is not open yet.";
    }
  }
  if (discussion.closeAt && !discussion.allowLate) {
    const closeAt = new Date(discussion.closeAt);
    if (!Number.isNaN(closeAt.getTime()) && now > closeAt) {
      return "Discussion is closed.";
    }
  }
  return null;
};

export function EngagementModule({ role }: Props) {
  const canModerate = role === "SUPER_ADMIN" || role === "ADMIN" || role === "TEACHER";

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<SelectedDiscussion>(null);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedDiscussionId, setSelectedDiscussionId] = useState("");

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

  const [postContent, setPostContent] = useState("");
  const [replyToPostId, setReplyToPostId] = useState("");

  const load = useCallback(async (courseId?: string, discussionId?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (courseId) query.set("courseId", courseId);
      if (discussionId) query.set("discussionId", discussionId);
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
      setSelectedDiscussion(result.selectedDiscussion ?? null);
      setSelectedCourseId(result.selectedCourseId ?? "");
      setSelectedDiscussionId(result.selectedDiscussionId ?? "");
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
      await load(selectedCourseId, result.discussionId);
    } catch {
      setError("Unable to create discussion.");
    } finally {
      setPending("");
    }
  };

  const onCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDiscussionId || !postContent.trim()) return;
    const blockedReason = getPostingBlockReason(selectedDiscussion, canModerate);
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    setPending("create-post");
    setError("");
    try {
      const response = await fetch("/api/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createPost",
          discussionId: selectedDiscussionId,
          content: postContent,
          parentPostId: replyToPostId || null,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to post.");
        return;
      }
      setPostContent("");
      setReplyToPostId("");
      await load(selectedCourseId, selectedDiscussionId);
    } catch {
      setError("Unable to post.");
    } finally {
      setPending("");
    }
  };

  const postAction = async (payload: Record<string, unknown>, pendingKey: string) => {
    setPending(pendingKey);
    setError("");
    try {
      const response = await fetch("/api/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to process action.");
        return;
      }
      await load(selectedCourseId, selectedDiscussionId);
    } catch {
      setError("Unable to process action.");
    } finally {
      setPending("");
    }
  };

  const postingBlockReason = getPostingBlockReason(selectedDiscussion, canModerate);
  const canPostInCurrentDiscussion = !postingBlockReason;

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
                void load(next, "");
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
        {loading ? <div className="mt-3"><LoadingIndicator label="Loading discussions..." /></div> : null}

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
            <article
              key={discussion.id}
              className={`cursor-pointer rounded-md border p-3 ${selectedDiscussionId === discussion.id ? "border-[#8fb5ea] bg-[#f6faff]" : "border-[#dbe9fb]"}`}
              onClick={() => {
                setSelectedDiscussionId(discussion.id);
                void load(selectedCourseId, discussion.id);
              }}
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
            </article>
          ))}
          {!loading && !discussions.length ? <p className="brand-muted text-sm">No discussion topics yet.</p> : null}
        </div>
      </section>

      {selectedDiscussion ? (
        <section className="brand-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="brand-section-title">Discussion Workspace</p>
              <h3 className="mt-1 text-lg font-bold text-[#0d3f80]">{selectedDiscussion.title}</h3>
              <p className="mt-1 text-sm text-[#3768ac]">{selectedDiscussion.prompt}</p>
              <p className="mt-1 text-xs text-[#3a689f]">
                {selectedDiscussion.isGraded ? `Graded (${selectedDiscussion.maxPoints ?? 0} pts)` : "Ungraded"}
              </p>
            </div>
            {canModerate ? (
              <button
                type="button"
                className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                disabled={pending === "toggle-lock"}
                onClick={() =>
                  void postAction(
                    { action: "toggleLock", discussionId: selectedDiscussion.id, isLocked: !selectedDiscussion.isLocked },
                    "toggle-lock"
                  )
                }
              >
                {selectedDiscussion.isLocked ? "Unlock Thread" : "Lock Thread"}
              </button>
            ) : null}
          </div>

          {selectedDiscussion.viewer ? (
            <p className="mt-2 text-sm text-[#2f5f98]">
              Your status: {formatEngagementStatus(selectedDiscussion.viewer.status)} | Initial post: {selectedDiscussion.viewer.hasInitialPost ? "Yes" : "No"} | Replies: {selectedDiscussion.viewer.replyCount}/2
            </p>
          ) : null}

          <form className="mt-3 grid gap-2" onSubmit={onCreatePost}>
            {!canPostInCurrentDiscussion ? (
              <p className="text-xs font-semibold text-red-600">{postingBlockReason}</p>
            ) : null}
            {replyToPostId ? (
              <p className="text-xs text-[#2f5f98]">Reply mode active. <button type="button" className="underline" onClick={() => setReplyToPostId("")}>Cancel reply</button></p>
            ) : null}
            <label className="grid gap-1.5">
              <span className="brand-label">Post Content</span>
              <textarea className="brand-input min-h-[90px]" placeholder="Write your post" value={postContent} onChange={(event) => setPostContent(event.currentTarget.value)} disabled={!canPostInCurrentDiscussion} />
            </label>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={pending === "create-post" || !canPostInCurrentDiscussion}>
              {pending === "create-post" ? "Posting..." : replyToPostId ? "Reply" : "Post"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {selectedDiscussion.posts.map((post) => (
              <article key={post.id} className="rounded-md border border-[#dbe9fb] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0d3f80]">
                    {(post.author.name || "User") + " - " + post.author.email} {post.isPinned ? "(Pinned)" : ""}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" className="text-[#1f518f] underline disabled:opacity-60" onClick={() => setReplyToPostId(post.id)} disabled={!canPostInCurrentDiscussion}>Reply</button>
                    {post.canEdit ? (
                      <button
                        type="button"
                        className="text-[#1f518f] underline"
                        onClick={() => {
                          const next = window.prompt("Edit post", post.content);
                          if (next === null) return;
                          void postAction({ action: "editPost", postId: post.id, content: next }, `edit-${post.id}`);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canModerate ? (
                      <>
                        <button type="button" className="text-[#1f518f] underline" onClick={() => void postAction({ action: "pinPost", postId: post.id, isPinned: !post.isPinned }, `pin-${post.id}`)}>
                          {post.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button type="button" className="text-red-700 underline" onClick={() => void postAction({ action: "deletePost", postId: post.id }, `delete-${post.id}`)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#2a5a93]">{post.content}</p>
                <p className="mt-1 text-xs text-[#5a7fb1]">
                  {formatDateTime(post.createdAt)}
                  {post.isLate ? ` | Late by ${post.lateByMinutes} min` : ""}
                </p>
              </article>
            ))}
            {!selectedDiscussion.posts.length ? <p className="brand-muted text-sm">No posts yet.</p> : null}
          </div>

          {canModerate ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-md border border-[#dbe9fb] p-3">
                <p className="brand-label">Engagement Alerts</p>
                <p className="mt-1 text-xs text-[#2f5f98]">
                  Missing: {selectedDiscussion.alerts.missingStudents.length} | Partial: {selectedDiscussion.alerts.partialStudents.length}
                </p>
                {selectedDiscussion.alerts.missingStudents.length ? (
                  <p className="mt-1 text-xs text-red-700">
                    Missing:{" "}
                    {selectedDiscussion.alerts.missingStudents
                      .map((item) => item.studentName || item.studentEmail)
                      .join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#2f5f98]">No missing students.</p>
                )}
                {selectedDiscussion.alerts.partialStudents.length ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Partial:{" "}
                    {selectedDiscussion.alerts.partialStudents
                      .map((item) => `${item.studentName || item.studentEmail} (${item.replyCount}/2 replies)`)
                      .join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#2f5f98]">No partial students.</p>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border border-[#dbe9fb] p-3">
                <p className="brand-label">Participation Indicators</p>
              <table className="mt-2 min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e1edfc] text-[#2f5f98]">
                    <th className="px-2 py-1.5">Student</th>
                    <th className="px-2 py-1.5">Initial Post</th>
                    <th className="px-2 py-1.5">Replies</th>
                    <th className="px-2 py-1.5">Status</th>
                    {selectedDiscussion.isGraded ? <th className="px-2 py-1.5">Score</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {selectedDiscussion.indicators.map((item) => (
                    <tr key={item.studentId} className="border-b border-[#edf4fe] text-[#0d3f80]">
                      <td className="px-2 py-1.5">{(item.studentName || "Student") + " - " + item.studentEmail}</td>
                      <td className="px-2 py-1.5">{item.hasInitialPost ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5">{item.replyCount}</td>
                      <td className="px-2 py-1.5">{formatEngagementStatus(item.status)}</td>
                      {selectedDiscussion.isGraded ? (
                        <td className="px-2 py-1.5">{item.score !== null ? item.score.toFixed(1) : "-"}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
