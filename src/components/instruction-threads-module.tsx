"use client";
// src/components/instruction-threads-module.tsx

import { useCallback, useEffect, useState } from "react";
import type { ThreadSummary } from "@/types/instruction-threads";
import { NewThreadModal } from "./instruction-new-thread-modal";
import { ThreadDetailView } from "./instruction-thread-detail";

const STATUS_CONFIG = {
  OPEN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400", label: "Open" },
  ANSWERED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", label: "Answered" },
  CLOSED: { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400", label: "Closed" },
} as const;

type Props = {
  courseId: string;
  currentUserId: string;
  currentUserRole: string;
};

export function InstructionThreadsModule({ courseId, currentUserId, currentUserRole }: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const isStudent = currentUserRole === "STUDENT";

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructions/threads?courseId=${courseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setThreads(data.threads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  if (selectedThreadId) {
    return (
      <ThreadDetailView
        threadId={selectedThreadId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onBack={() => {
          setSelectedThreadId(null);
          loadThreads();
        }}
      />
    );
  }

  return (
    <div>
      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#07316b]">Ask Your Teacher</h3>
          <p className="mt-0.5 text-xs text-[#3b6aa5]">
            {loading ? "Loading..." : `${threads.length} thread${threads.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isStudent && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#07316b] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#083e8a]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ask a Question
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && threads.length === 0 && (
        <div className="rounded-xl border border-[#9bc4f6] bg-[#e8f3ff] py-14 text-center">
          <div className="mb-3 text-4xl">💬</div>
          <p className="font-medium text-[#07316b]">No questions yet</p>
          {isStudent && (
            <p className="mt-1 text-sm text-[#3b6aa5]">
              Tap &ldquo;Ask a Question&rdquo; to get started.
            </p>
          )}
        </div>
      )}

      {/* Thread list */}
      {!loading && threads.length > 0 && (
        <div className="space-y-2">
          {threads.map((thread) => {
            const s = STATUS_CONFIG[thread.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.CLOSED;
            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#9bc4f6] hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Badges */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {thread.isPinned && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                          📌 Pinned
                        </span>
                      )}
                      {!thread.isPrivate && (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-600">
                          Public
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold
                          ${s.bg} ${s.text} ${s.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>

                    <p className="truncate text-sm font-semibold text-[#07316b] transition-colors group-hover:text-[#083e8a]">
                      {thread.subject}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{thread.student.name ?? "Student"}</span>
                      {thread.module && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500">📚 {thread.module.title}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(thread.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Message count */}
                  <div className="flex flex-shrink-0 items-center gap-1 pt-0.5 text-xs text-slate-400">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    {thread._count.messages}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New thread modal */}
      {showNewModal && (
        <NewThreadModal
          courseId={courseId}
          onClose={() => setShowNewModal(false)}
          onCreated={(threadId) => {
            setShowNewModal(false);
            setSelectedThreadId(threadId);
            loadThreads();
          }}
        />
      )}
    </div>
  );
}
