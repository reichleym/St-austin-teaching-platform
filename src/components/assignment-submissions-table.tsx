"use client";

import { useMemo, useState } from "react";
import { ToastMessage } from "@/components/toast-message";

type SubmissionRow = {
  id: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  attemptNumber: number;
  submittedAt: string | null;
  status: string;
  rawScore: number | null;
  finalScore: number | null;
  feedback: string | null;
  isLate: boolean;
  lateByMinutes: number;
};

type Props = {
  module: string;
  assignmentId: string;
  submissions: SubmissionRow[];
  canGrade: boolean;
  canViewAttempt?: boolean;
};

const PUBLISHED_STATES = new Set([
  "GRADE_PUBLISHED",
  "GRADE_EDIT_REQUESTED",
  "GRADE_EDIT_APPROVED",
  "GRADE_EDIT_REJECTED",
]);

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatEnumLabel = (value: string | null | undefined) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((segment) => {
      if (!segment) return "";
      if (segment.toUpperCase() === segment && segment.length <= 3) return segment;
      return `${segment[0]}${segment.slice(1).toLowerCase()}`;
    })
    .join(" ");
};

export function AssignmentSubmissionsTable({ module, assignmentId, submissions, canGrade, canViewAttempt = false }: Props) {
  const [rows, setRows] = useState<SubmissionRow[]>(submissions);
  const [error, setError] = useState("");
  const [gradePendingId, setGradePendingId] = useState("");
  const [requestEditPendingId, setRequestEditPendingId] = useState("");
  const [requestEditForSubmissionId, setRequestEditForSubmissionId] = useState("");
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditProposedPoints, setRequestEditProposedPoints] = useState("");

  const [gradeRawScoreById, setGradeRawScoreById] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of submissions) {
      initial[row.id] = row.rawScore !== null && row.rawScore !== undefined ? String(row.rawScore) : "";
    }
    return initial;
  });

  const [gradeFeedbackById, setGradeFeedbackById] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of submissions) {
      initial[row.id] = row.feedback ?? "";
    }
    return initial;
  });

  const refresh = async () => {
    try {
      const response = await fetch(`/api/assignments/submissions?assignmentId=${encodeURIComponent(assignmentId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { submissions?: SubmissionRow[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load submissions.");
        return;
      }
      const nextRows = (result.submissions ?? []).map((row) => ({
        ...row,
        submittedAt: row.submittedAt ?? null,
      }));
      setRows(nextRows);
      setGradeRawScoreById((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const row of nextRows) {
          next[row.id] = row.rawScore !== null && row.rawScore !== undefined ? String(row.rawScore) : "";
        }
        return next;
      });
      setGradeFeedbackById((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const row of nextRows) {
          next[row.id] = row.feedback ?? "";
        }
        return next;
      });
    } catch {
      setError("Unable to load submissions.");
    }
  };

  const onGrade = async (submissionId: string, publish: boolean) => {
    setGradePendingId(submissionId);
    setError("");
    try {
      const rawScoreInput = gradeRawScoreById[submissionId];
      const rawScore = rawScoreInput !== undefined && rawScoreInput !== "" ? Number(rawScoreInput) : undefined;
      if (rawScoreInput !== "" && (!Number.isFinite(rawScore) || Number(rawScore) < 0)) {
        setError("Score must be a non-negative number.");
        return;
      }
      const response = await fetch("/api/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          rawScore,
          feedback: gradeFeedbackById[submissionId] ?? undefined,
          publish,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to grade submission.");
        return;
      }
      await refresh();
    } catch {
      setError("Unable to grade submission.");
    } finally {
      setGradePendingId("");
    }
  };

  const onRequestGradeEdit = async (row: SubmissionRow) => {
    if (!row.studentId) {
      setError("Student information is missing.");
      return;
    }
    const proposedPointsValue = Number(requestEditProposedPoints);
    if (!Number.isFinite(proposedPointsValue) || proposedPointsValue < 0) {
      setError("Proposed points are required and must be non-negative.");
      return;
    }
    if (!requestEditReason.trim()) {
      setError("Reason is required.");
      return;
    }
    setRequestEditPendingId(row.id);
    setError("");
    try {
      const response = await fetch("/api/teacher/grade-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          studentId: row.studentId,
          reason: requestEditReason,
          proposedPoints: proposedPointsValue,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to submit grade edit request.");
        return;
      }
      setRequestEditForSubmissionId("");
      setRequestEditReason("");
      setRequestEditProposedPoints("");
    } catch {
      setError("Unable to submit grade edit request.");
    } finally {
      setRequestEditPendingId("");
    }
  };

  const displayRows = useMemo(() => rows, [rows]);

  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">Submissions</p>
      <ToastMessage type="error" message={error} />

      {displayRows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Attempt</th>
                <th className="px-3 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 font-semibold">Submitted</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Late</th>
                {canGrade || canViewAttempt ? <th className="px-3 py-2 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {displayRows.flatMap((row) => {
                const isPublished = PUBLISHED_STATES.has(row.status);
                const hasActions = canGrade || canViewAttempt;
                const mainRow = (
                  <tr key={row.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                    <td className="px-3 py-2 font-semibold">Attempt {row.attemptNumber}</td>
                    <td className="px-3 py-2">
                      {row.studentEmail
                        ? `${row.studentName || "Student"} - ${row.studentEmail}`
                        : "Your submission"}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(row.submittedAt)}</td>
                    <td className="px-3 py-2">{formatEnumLabel(row.status)}</td>
                      <td className="px-3 py-2">{row.finalScore !== null ? row.finalScore : "Ungraded"}</td>
                      <td className="px-3 py-2">{row.isLate ? `${row.lateByMinutes}m` : "No"}</td>
                    {hasActions ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {canViewAttempt ? (
                            <a
                              className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                              href={`/dashboard/${module}/${assignmentId}/submissions/${row.id}`}
                            >
                              View Attempt
                            </a>
                          ) : null}
                          {canGrade ? (
                            isPublished ? (
                              <button
                                type="button"
                                className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800"
                                onClick={() => setRequestEditForSubmissionId(row.id)}
                              >
                                Request Grade Edit
                              </button>
                            ) : (
                              <>
                                <input
                                  className="brand-input w-24"
                                  placeholder="Score"
                                  value={gradeRawScoreById[row.id] ?? ""}
                                  onChange={(event) =>
                                    setGradeRawScoreById((prev) => ({ ...prev, [row.id]: event.currentTarget.value }))
                                  }
                                />
                                <input
                                  className="brand-input w-48"
                                  placeholder="Feedback"
                                  value={gradeFeedbackById[row.id] ?? ""}
                                  onChange={(event) =>
                                    setGradeFeedbackById((prev) => ({ ...prev, [row.id]: event.currentTarget.value }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                                  disabled={gradePendingId === row.id}
                                  onClick={() => void onGrade(row.id, false)}
                                >
                                  {gradePendingId === row.id ? "Saving..." : "Save Draft"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-[#2d6fbf] bg-[#edf5ff] px-2 py-1 text-xs font-semibold text-[#114b8d]"
                                  disabled={gradePendingId === row.id}
                                  onClick={() => void onGrade(row.id, true)}
                                >
                                  {gradePendingId === row.id ? "Publishing..." : "Publish"}
                                </button>
                              </>
                            )
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );

                const requestRow =
                  canGrade && requestEditForSubmissionId === row.id ? (
                    <tr key={`${row.id}-request`} className="border-b border-[#e7f0fc]">
                      <td className="px-3 py-3" colSpan={7}>
                        <div className="grid gap-2 md:grid-cols-3">
                          <label className="grid gap-1.5">
                            <span className="brand-label">Proposed Points</span>
                            <input
                              className="brand-input"
                              value={requestEditProposedPoints}
                              onChange={(event) => setRequestEditProposedPoints(event.currentTarget.value)}
                            />
                          </label>
                          <label className="grid gap-1.5 md:col-span-2">
                            <span className="brand-label">Reason</span>
                            <input
                              className="brand-input"
                              value={requestEditReason}
                              onChange={(event) => setRequestEditReason(event.currentTarget.value)}
                            />
                          </label>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                            disabled={requestEditPendingId === row.id}
                            onClick={() => void onRequestGradeEdit(row)}
                          >
                            {requestEditPendingId === row.id ? "Submitting..." : "Submit Request"}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                            onClick={() => setRequestEditForSubmissionId("")}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null;

                return requestRow ? [mainRow, requestRow] : [mainRow];
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="brand-muted mt-3 text-sm">No submissions yet.</p>
      )}
    </section>
  );
}
