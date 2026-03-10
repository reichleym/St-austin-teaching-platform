"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToastMessage } from "@/components/toast-message";

type Props = {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  status: string;
  rawScore: number | null;
  feedback: string | null;
  canGrade: boolean;
};

const PUBLISHED_STATES = new Set([
  "GRADE_PUBLISHED",
  "GRADE_EDIT_REQUESTED",
  "GRADE_EDIT_APPROVED",
  "GRADE_EDIT_REJECTED",
]);

export function SubmissionGradePanel({ submissionId, assignmentId, studentId, status, rawScore, feedback, canGrade }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [scoreInput, setScoreInput] = useState(rawScore !== null && rawScore !== undefined ? String(rawScore) : "");
  const [feedbackInput, setFeedbackInput] = useState(feedback ?? "");
  const [showRequestEdit, setShowRequestEdit] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestPoints, setRequestPoints] = useState("");

  if (!canGrade) return null;

  const isPublished = PUBLISHED_STATES.has(status);

  const onGrade = async (publish: boolean) => {
    setPending(true);
    setError("");
    try {
      const scoreValue = scoreInput !== "" ? Number(scoreInput) : undefined;
      if (scoreInput !== "" && (!Number.isFinite(scoreValue) || Number(scoreValue) < 0)) {
        setError("Score must be a non-negative number.");
        return;
      }
      const response = await fetch("/api/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          rawScore: scoreValue,
          feedback: feedbackInput || undefined,
          publish,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to grade submission.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to grade submission.");
    } finally {
      setPending(false);
    }
  };

  const onRequestEdit = async () => {
    const pointsValue = Number(requestPoints);
    if (!Number.isFinite(pointsValue) || pointsValue < 0) {
      setError("Proposed points are required and must be non-negative.");
      return;
    }
    if (!requestReason.trim()) {
      setError("Reason is required.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/grade-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          studentId,
          reason: requestReason,
          proposedPoints: pointsValue,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to submit grade edit request.");
        return;
      }
      setShowRequestEdit(false);
      setRequestReason("");
      setRequestPoints("");
      router.refresh();
    } catch {
      setError("Unable to submit grade edit request.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">Grading</p>
      <ToastMessage type="error" message={error} />
      {isPublished ? (
        <div className="mt-3">
          <button
            type="button"
            className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800"
            onClick={() => setShowRequestEdit((prev) => !prev)}
            disabled={pending}
          >
            Request Grade Edit
          </button>
          {showRequestEdit ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="brand-label">Proposed Points</span>
                <input
                  className="brand-input"
                  value={requestPoints}
                  onChange={(event) => setRequestPoints(event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1.5 md:col-span-2">
                <span className="brand-label">Reason</span>
                <input
                  className="brand-input"
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.currentTarget.value)}
                />
              </label>
              <div className="md:col-span-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                  onClick={onRequestEdit}
                  disabled={pending}
                >
                  {pending ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                  onClick={() => setShowRequestEdit(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="brand-input w-24"
            placeholder="Score"
            value={scoreInput}
            onChange={(event) => setScoreInput(event.currentTarget.value)}
          />
          <input
            className="brand-input w-64"
            placeholder="Feedback"
            value={feedbackInput}
            onChange={(event) => setFeedbackInput(event.currentTarget.value)}
          />
          <button
            type="button"
            className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
            disabled={pending}
            onClick={() => void onGrade(false)}
          >
            {pending ? "Saving..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="rounded-md border border-[#2d6fbf] bg-[#edf5ff] px-2 py-1 text-xs font-semibold text-[#114b8d]"
            disabled={pending}
            onClick={() => void onGrade(true)}
          >
            {pending ? "Publishing..." : "Publish"}
          </button>
        </div>
      )}
    </section>
  );
}
