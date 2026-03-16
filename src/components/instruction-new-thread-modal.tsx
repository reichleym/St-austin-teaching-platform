"use client";
// src/components/instruction-new-thread-modal.tsx

import { useEffect, useState, useTransition } from "react";

type Module = { id: string; title: string; position: number };

type Props = {
  courseId: string;
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

export function NewThreadModal({ courseId, onClose, onCreated }: Props) {
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Reuse the existing modules API
    fetch(`/api/courses/modules?courseId=${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.modules)) setModules(data.modules);
      })
      .catch(() => {});
  }, [courseId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) { setError("Subject is required."); return; }
    if (!body.trim()) { setError("Please write your question."); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/instructions/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            moduleId: moduleId || null,
            subject: subject.trim(),
            body: body.trim(),
            isPrivate,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to submit.");
        onCreated(data.thread.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#06254d]/40 backdrop-blur-sm" onClick={onClose} />

      <section className="brand-card relative z-10 w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="brand-section-title">Ask Your Teacher</p>
            <p className="brand-muted mt-2 text-sm">Send a question and choose the visibility.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#1f518f] transition-colors hover:text-[#083e8a]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          {/* Module */}
          <label className="grid gap-1.5">
            <span className="brand-label">
              Related Module <span className="brand-helper font-normal">(optional)</span>
            </span>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="brand-input"
            >
              <option value="">— General course question —</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </label>

          {/* Subject */}
          <label className="grid gap-1.5">
            <span className="brand-label">
              Subject <span className="text-[#b21d1d]">*</span>
            </span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Confused about recursion in Week 3"
              maxLength={200}
              className="brand-input"
            />
          </label>

          {/* Body */}
          <label className="grid gap-1.5">
            <span className="brand-label">
              Your Question <span className="text-[#b21d1d]">*</span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Describe your question in detail..."
              className="brand-input min-h-[140px] resize-none"
            />
          </label>

          {/* Privacy toggle */}
          <label className="brand-panel flex cursor-pointer select-none items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#003b8f]"
            />
            <div>
              <p className="text-sm font-semibold text-[#0b3e81]">Private question</p>
              <p className="text-xs text-[#3a689f]">
                Only visible to you and your teacher
              </p>
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-[#f1c4c4] bg-[#fff4f4] px-3 py-2 text-sm text-[#9c1e1e]">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-brand-secondary flex-1 px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-brand-primary flex-1 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isPending ? "Sending..." : "Send Question"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
