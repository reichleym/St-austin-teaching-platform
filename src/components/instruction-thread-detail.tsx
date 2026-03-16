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
        className={`brand-input resize-none text-sm ${compact ? "min-h-[70px]" : "min-h-[110px]"}`}
      />
      {error && (
        <p className="rounded-md border border-[#f1c4c4] bg-[#fff4f4] px-3 py-1.5 text-xs text-[#9c1e1e]">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className={`btn-brand-primary font-semibold disabled:opacity-60
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
        <div className="absolute -left-3 bottom-2 top-0 w-px bg-[#c6ddfa]" />
      )}

      <div
        className={`mb-2 p-4 transition-all
          ${isTeacher ? "brand-panel" : "rounded-xl border border-[#dbe9fb] bg-white/85"}
          ${isDeleted ? "opacity-60" : ""}`}
      >
        {/* Header row */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
                ${isTeacher ? "bg-[#0b3e81] text-white" : "bg-[#e8f2ff] text-[#4b6fa6]"}`}
            >
              {initials}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0b3e81]">
                {message.author.name ?? "Unknown"}
              </span>
              {isTeacher && (
                <span className="brand-chip">Teacher</span>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="text-xs text-[#6c8fbe]">
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
                className="text-xs text-[#6c8fbe] transition-colors hover:text-[#b21d1d]"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Message body */}
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed
            ${isDeleted ? "italic text-[#7c99c6]" : "text-[#2f5d96]"}`}
        >
          {message.body}
        </p>

        {/* Reply button */}
        {canReply && !isDeleted && (
          <button
            onClick={() => setShowReply((v) => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-[#1f518f] transition-colors hover:text-[#083e8a]"
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
      <section className="brand-card p-5">
        <p className="brand-section-title">Thread</p>
        <div className="mt-4 space-y-3 animate-pulse">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-28 rounded-xl border border-[#dbe9fb] bg-white/80" />
          <div className="h-24 rounded-xl border border-[#dbe9fb] bg-white/80" />
        </div>
      </section>
    );
  }

  if (error || !thread) {
    return (
      <section className="brand-card p-5 text-center">
        <p className="text-sm text-[#9c1e1e]">{error ?? "Thread not found."}</p>
        <button onClick={onBack} className="mt-3 text-sm font-semibold text-[#1f518f] underline">
          Go back
        </button>
      </section>
    );
  }

  const s = STATUS_CONFIG[thread.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.CLOSED;
  const canReply = thread.status !== "CLOSED";

  return (
    <section className="brand-card p-5">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1f518f] transition-colors hover:text-[#083e8a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to questions
      </button>

      {/* Thread header card */}
      <div className="brand-panel mb-5 p-5">
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
                <span className="brand-chip">Pinned</span>
              )}
              {!thread.isPrivate && (
                <span className="brand-chip brand-chip-accent">Public</span>
              )}
            </div>

            <h2 className="text-lg font-bold text-[#0b3e81]">{thread.subject}</h2>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#3a689f]">
              <span>by {thread.student.name ?? "Student"}</span>
              {thread.module && (
                <>
                  <span>·</span>
                  <span className="text-[#2f5d96]">📚 {thread.module.title}</span>
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
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors
                  ${thread.isPinned
                    ? "border-[#b8d3fb] bg-[#eef6ff] text-[#1f518f] hover:border-[#8fb7eb]"
                    : "border-[#dbe9fb] bg-white/80 text-[#2f5d96] hover:border-[#8fb7eb]"}`}
              >
                {thread.isPinned ? "Unpin" : "Pin"}
              </button>
              {thread.status !== "CLOSED" && (
                <button
                  onClick={() => handleAction("close")}
                  disabled={actionPending}
                  className="rounded-md border border-[#f1c4c4] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#a12525] transition-colors hover:bg-[#fff1f1]"
                >
                  Close
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
        <div className="brand-panel mb-5 px-5 py-4 text-center text-sm text-[#5c7cab]">
          This thread is closed and no longer accepts replies.
        </div>
      )}

      {/* Top-level reply box */}
      {canReply && (
        <div className="brand-panel p-4">
          <p className="brand-section-title mb-3">Add a reply</p>
          <ReplyBox threadId={threadId} parentId={null} onSuccess={loadThread} />
        </div>
      )}
    </section>
  );
}
