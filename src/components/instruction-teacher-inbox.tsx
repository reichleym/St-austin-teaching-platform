"use client";
// src/components/instruction-teacher-inbox.tsx

import { useCallback, useEffect, useState } from "react";
import type { ThreadSummary } from "@/types/instruction-threads";
import { ThreadDetailView } from "./instruction-thread-detail";

type Props = {
  currentUserId: string;
  currentUserRole: string;
};

type InboxThread = ThreadSummary & {
  course: { id: string; title: string; code: string };
};

function ThreadRow({ thread, onClick }: { thread: InboxThread; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#9bc4f6] hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {thread.course.code}
            </span>
            {thread.module && (
              <span className="truncate text-xs text-slate-400">📚 {thread.module.title}</span>
            )}
          </div>
          <p className="truncate text-sm font-semibold text-[#07316b] transition-colors group-hover:text-[#083e8a]">
            {thread.subject}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{thread.student.name ?? "Student"}</span>
            <span>·</span>
            <span>
              {new Date(thread.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
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
}

export function InstructionTeacherInbox({ currentUserId, currentUserRole }: Props) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ threadId: string } | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/instructions/inbox");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load.");
      setThreads(data.threads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  if (selected) {
    return (
      <ThreadDetailView
        threadId={selected.threadId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onBack={() => {
          setSelected(null);
          loadInbox();
        }}
      />
    );
  }

  const open = threads.filter((t) => t.status === "OPEN");
  const answered = threads.filter((t) => t.status === "ANSWERED");

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-[#07316b]">Student Questions</h3>
        {!loading && (
          <p className="mt-0.5 text-xs text-[#3b6aa5]">
            {open.length} awaiting reply · {answered.length} answered
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {!loading && threads.length === 0 && (
        <div className="rounded-xl border border-[#9bc4f6] bg-[#e8f3ff] py-14 text-center">
          <div className="mb-3 text-4xl">✅</div>
          <p className="font-medium text-[#07316b]">All caught up!</p>
          <p className="mt-1 text-sm text-[#3b6aa5]">No open questions from students.</p>
        </div>
      )}

      {!loading && threads.length > 0 && (
        <div className="space-y-6">
          {open.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Needs Your Reply
                </h4>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                  {open.length}
                </span>
              </div>
              <div className="space-y-2">
                {open.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    onClick={() => setSelected({ threadId: t.id })}
                  />
                ))}
              </div>
            </div>
          )}

          {answered.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Answered
                </h4>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                  {answered.length}
                </span>
              </div>
              <div className="space-y-2">
                {answered.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    onClick={() => setSelected({ threadId: t.id })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
