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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Modal header — matches brand-glass style */}
        <div className="bg-gradient-to-r from-[#07316b] to-[#083e8a] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Ask Your Teacher</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Module */}
          <div>
            <label className="block text-sm font-medium text-[#07316b] mb-1">
              Related Module{" "}
              <span className="text-[#3b6aa5] font-normal">(optional)</span>
            </label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full rounded-lg border border-[#9bc4f6] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#07316b] focus:outline-none focus:ring-2 focus:ring-[#07316b]/20"
            >
              <option value="">— General course question —</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[#07316b] mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Confused about recursion in Week 3"
              maxLength={200}
              className="w-full rounded-lg border border-[#9bc4f6] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#07316b] focus:outline-none focus:ring-2 focus:ring-[#07316b]/20"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-[#07316b] mb-1">
              Your Question <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Describe your question in detail..."
              className="w-full resize-none rounded-lg border border-[#9bc4f6] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#07316b] focus:outline-none focus:ring-2 focus:ring-[#07316b]/20"
            />
          </div>

          {/* Privacy toggle */}
          <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-[#9bc4f6] bg-[#e8f3ff] px-4 py-3">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#07316b]"
            />
            <div>
              <p className="text-sm font-medium text-[#07316b]">Private question</p>
              <p className="text-xs text-[#3b6aa5]">
                Only visible to you and your teacher
              </p>
            </div>
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-[#07316b] py-2 text-sm font-semibold text-white hover:bg-[#083e8a] transition-colors disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
