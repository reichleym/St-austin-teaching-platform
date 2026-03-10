"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";

type EnrollmentRequestItem = {
  id: string;
  courseId: string;
  studentId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  courseCode: string;
  courseTitle: string;
  studentName: string | null;
  studentEmail: string;
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

export function EnrollmentRequestsPanel() {
  const [requests, setRequests] = useState<EnrollmentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING").length,
    [requests]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/courses/enrollment-requests", { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { requests?: EnrollmentRequestItem[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load enrollment requests.");
        setRequests([]);
        return;
      }
      setRequests(result.requests ?? []);
    } catch {
      setError("Unable to load enrollment requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const onReviewRequest = async (requestId: string, decision: "APPROVE" | "REJECT") => {
    setActionId(requestId);
    setError("");
    try {
      const response = await fetch("/api/courses/enrollment-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to review enrollment request.");
        return;
      }
      await loadRequests();
    } catch {
      setError("Unable to review enrollment request.");
    } finally {
      setActionId("");
    }
  };

  return (
    <section className="brand-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="brand-section-title">Enrollment Requests</p>
          <p className="brand-muted mt-1 text-xs">
            {pendingCount} pending request{pendingCount === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
          onClick={() => void loadRequests()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <ToastMessage type="error" message={error} />

      {loading ? (
        <div className="mt-3">
          <LoadingIndicator label="Loading enrollment requests..." />
        </div>
      ) : null}

      {!loading && !requests.length ? (
        <p className="brand-muted mt-3 text-sm">No enrollment requests yet.</p>
      ) : null}

      {!loading && requests.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 font-semibold">Requested</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const isPending = request.status === "PENDING";
                return (
                  <tr key={request.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                    <td className="px-3 py-2">
                      <p className="font-semibold">{request.courseCode}</p>
                      <p className="text-xs text-[#3768ac]">{request.courseTitle}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{request.studentName || "Unnamed Student"}</p>
                      <p className="text-xs text-[#3768ac]">{request.studentEmail}</p>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(request.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-[#eef5ff] px-2 py-1 text-xs font-semibold text-[#1f518f]">
                        {request.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                            disabled={actionId === request.id}
                            onClick={() => void onReviewRequest(request.id, "APPROVE")}
                          >
                            {actionId === request.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                            disabled={actionId === request.id}
                            onClick={() => void onReviewRequest(request.id, "REJECT")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#3a689f]">Reviewed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
