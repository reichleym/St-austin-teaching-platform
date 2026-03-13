"use client";
// src/components/instruction-thread-detail.tsx

import { useCallback, useEffect, useState, useTransition } from "react";
import type { MessageNode, ThreadDetail } from "@/types/instruction-threads";

// ─── Reply Box ────────────────────────────────────────────────────────────────

function ReplyBox({
  threadId,
  parentId,
  compact = false,
  onSuccess,
}: {
  threadId: string;
  parentId: string | null;
  compact?: boolean;
  onSuccess: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/instructions/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, parentId, body: body.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to post.");
        setBody("");
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={compact ? "Write a reply..." : "Write your reply..."}
        rows={compact ? 2 : 3}
        className="w-full resize-none rounded-xl border border-[#9bc4f6] bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#07316b] focus:outline-none focus:ring-2 focus:ring-[#07316b]/20"
      />
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className={`rounded-lg bg-[#07316b] font-semibold text-white hover:bg-[#083e8a] transition-colors disabled:opacity-40
            ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
        >
          {isPending ? "Posting..." : "Post Reply"}
        </button>
      </div>
    </form>
  );
}

// ─── Message Bubble (recursive) ───────────────────────────────────────────────

function MessageBubble({
  message,
  currentUserId,
  threadId,
  canReply,
  onRefresh,
  depth = 0,
}: {
  message: MessageNode;
  currentUserId: string;
  threadId: string;
  canReply: boolean;
  onRefresh: () => void;
  depth?: number;
}) {
  const [showReply, setShowReply] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isTeacher = message.isTeacherReply;
  const isOwn = message.authorId === currentUserId;
  const isDeleted = message.isDeleted;
  const indent = Math.min(depth, 5) * 24;

  const initials = message.author.name
    ? message.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  function handleDelete() {
    if (!confirm("Delete this message?")) return;
    startTransition(async () => {
      await fetch(`/api/instructions/messages?messageId=${message.id}`, { method: "DELETE" });
      onRefresh();
    });
  }

  return (
    <div style={{ marginLeft: `${indent}px` }} className="relative">
      {depth > 0 && (
        <div className="absolute -left-3 bottom-2 top-0 w-px bg-[#9bc4f6]/50" />
      )}

      <div
        className={`mb-2 rounded-xl border p-4 transition-all
          ${isTeacher ? "border-[#9bc4f6] bg-[#e8f3ff]" : "border-slate-200 bg-white"}
          ${isDeleted ? "opacity-50" : ""}`}
      >
        {/* Header row */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
                ${isTeacher ? "bg-[#07316b] text-white" : "bg-slate-200 text-slate-600"}`}
            >
              {initials}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                {message.author.name ?? "Unknown"}
              </span>
              {isTeacher && (
                <span className="rounded bg-[#07316b] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Teacher
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="text-xs text-slate-400">
              {new Date(message.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {isOwn && !isDeleted && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-slate-400 transition-colors hover:text-red-500"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Message body */}
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed
            ${isDeleted ? "italic text-slate-400" : "text-slate-700"}`}
        >
          {message.body}
        </p>

        {/* Reply button */}
        {canReply && !isDeleted && (
          <button
            onClick={() => setShowReply((v) => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs font-medium text-[#2b5699] transition-colors hover:text-[#07316b]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {showReply ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      {/* Inline reply box */}
      {showReply && (
        <div className="mb-2" style={{ marginLeft: `${Math.min(depth + 1, 5) * 24}px` }}>
          <ReplyBox
            threadId={threadId}
            parentId={message.id}
            compact
            onSuccess={() => {
              setShowReply(false);
              onRefresh();
            }}
          />
        </div>
      )}

      {/* Nested replies */}
      {message.replies?.length > 0 && (
        <div>
          {message.replies.map((reply) => (
            <MessageBubble
              key={reply.id}
              message={reply}
              currentUserId={currentUserId}
              threadId={threadId}
              canReply={canReply}
              onRefresh={onRefresh}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OPEN: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
    label: "Open",
  },
  ANSWERED: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-400",
    label: "Answered",
  },
  CLOSED: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
    label: "Closed",
  },
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  threadId: string;
  currentUserId: string;
  currentUserRole: string;
  onBack: () => void;
};

export function ThreadDetailView({ threadId, currentUserId, currentUserRole, onBack }: Props) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, startAction] = useTransition();

  const isStaff = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"].includes(currentUserRole);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/instructions/threads/${threadId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load thread.");
      setThread(data.thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread.");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  function handleAction(action: "close" | "togglePin") {
    startAction(async () => {
      await fetch(`/api/instructions/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      loadThread();
    });
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="h-28 rounded-xl border border-slate-200 bg-white" />
        <div className="h-24 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error ?? "Thread not found."}</p>
        <button onClick={onBack} className="mt-3 text-sm text-[#07316b] underline">
          Go back
        </button>
      </div>
    );
  }

  const s = STATUS_CONFIG[thread.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.CLOSED;
  const canReply = thread.status !== "CLOSED";

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-[#2b5699] transition-colors hover:text-[#07316b]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to questions
      </button>

      {/* Thread header card */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold
                  ${s.bg} ${s.text} ${s.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
              {thread.isPinned && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                  📌 Pinned
                </span>
              )}
              {!thread.isPrivate && (
                <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-600">
                  🌐 Public
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-[#07316b]">{thread.subject}</h2>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>by {thread.student.name ?? "Student"}</span>
              {thread.module && (
                <>
                  <span>·</span>
                  <span className="text-slate-500">📚 {thread.module.title}</span>
                </>
              )}
              <span>·</span>
              <span>
                {new Date(thread.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Teacher controls */}
          {isStaff && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => handleAction("togglePin")}
                disabled={actionPending}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                  ${thread.isPinned
                    ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                📌 {thread.isPinned ? "Unpin" : "Pin"}
              </button>
              {thread.status !== "CLOSED" && (
                <button
                  onClick={() => handleAction("close")}
                  disabled={actionPending}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  🔒 Close
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="mb-5 space-y-1">
        {thread.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            currentUserId={currentUserId}
            threadId={threadId}
            canReply={canReply}
            onRefresh={loadThread}
          />
        ))}
      </div>

      {/* Closed notice */}
      {thread.status === "CLOSED" && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-center text-sm text-slate-500">
          🔒 This thread is closed and no longer accepts replies.
        </div>
      )}

      {/* Top-level reply box */}
      {canReply && (
        <div className="rounded-xl border border-[#9bc4f6] bg-[#e8f3ff] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#2b5699]">
            Add a reply
          </p>
          <ReplyBox threadId={threadId} parentId={null} onSuccess={loadThread} />
        </div>
      )}
    </div>
  );
}
