"use client";
// src/components/instruction-threads-module.tsx

import { useCallback, useEffect, useState } from "react";
import type { ThreadSummary } from "@/types/instruction-threads";
import { NewThreadModal } from "./instruction-new-thread-modal";
import { ThreadDetailView } from "./instruction-thread-detail";
import { useLanguage } from "@/components/language-provider";
import { getLanguageLocale, translateContent } from "@/lib/i18n";

const STATUS_CONFIG = {
  OPEN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  ANSWERED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  CLOSED: { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
} as const;

type Props = {
  courseId: string;
  currentUserId: string;
  currentUserRole: string;
};

export function InstructionThreadsModule({ courseId, currentUserId, currentUserRole }: Props) {
  const { t, language } = useLanguage();
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
      if (!res.ok) throw new Error(data.error ?? t("instruction.failedLoad"));
      setThreads(data.threads);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("instruction.failedLoadThreads"));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

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
    <section className="brand-card p-5">
      {/* Section header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-section-title">{t("instruction.askTeacher")}</p>
          <p className="brand-muted mt-2 text-sm">
            {loading ? (
              <span className="inline-flex items-center">
                <span className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                <span className="sr-only">{t("instruction.loadingThreads")}</span>
              </span>
            ) : t(threads.length === 1 ? "instruction.threadCount.one" : "instruction.threadCount.other", { count: threads.length })}
          </p>
        </div>
        {isStudent && (
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-brand-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("instruction.askQuestion")}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-[#f1c4c4] bg-[#fff4f4] px-4 py-3 text-sm text-[#9c1e1e]">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[#dbe9fb] bg-white/80 p-4">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && threads.length === 0 && (
        <div className="brand-panel py-14 text-center">
          <div className="mb-3 text-3xl">💬</div>
          <p className="text-base font-semibold text-[#0b3e81]">{t("instruction.noQuestionsYet")}</p>
          {isStudent && (
            <p className="brand-muted mt-1 text-sm">
              {t("instruction.askQuestionHint")}
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
                className="group w-full rounded-xl border border-[#dbe9fb] bg-white/80 p-4 text-left transition-all hover:border-[#93b9e8] hover:shadow-[0_8px_24px_rgba(11,62,129,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Badges */}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {thread.isPinned && (
                        <span className="brand-chip">{t("instruction.badgePinned")}</span>
                      )}
                      {!thread.isPrivate && (
                        <span className="brand-chip brand-chip-accent">{t("instruction.badgePublic")}</span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold
                          ${s.bg} ${s.text} ${s.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {t(`instruction.status.${thread.status.toLowerCase()}`)}
                      </span>
                    </div>

                    <p className="truncate text-sm font-semibold text-[#0b3e81] transition-colors group-hover:text-[#083e8a]">
                      {translateContent(language, thread.subject)}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#3a689f]">
                      <span>{thread.student.name ?? t("student.label")}</span>
                      {thread.module && (
                        <>
                          <span>·</span>
                          <span className="text-[#2f5d96]">📚 {translateContent(language, thread.module.title)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(thread.updatedAt).toLocaleDateString(getLanguageLocale(language), {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Message count */}
                  <div className="flex flex-shrink-0 items-center gap-1 pt-0.5 text-xs text-[#3a689f]">
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
    </section>
  );
}
