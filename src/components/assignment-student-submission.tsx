"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ToastMessage } from "@/components/toast-message";

type AssignmentType = "HOMEWORK" | "QUIZ" | "EXAM";

type QuizQuestion = {
  id: string;
  prompt: string;
  questionType?: "MCQ" | "SHORT_ANSWER";
  options: string[];
  points: number;
};

type SubmissionListItem = {
  id: string;
  attemptNumber: number;
  submittedAt: string | null;
  status: string;
  finalScore: number | null;
  isLate: boolean;
  lateByMinutes: number;
};

type Props = {
  assignmentId: string;
  assignmentType: AssignmentType;
  allowedSubmissionTypes: Array<"TEXT" | "FILE">;
  maxAttempts: number;
  allowLateSubmissions: boolean;
  timerMinutes: number | null;
  startAt: string | null;
  endAt: string | null;
  initialSubmissions: SubmissionListItem[];
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const isQuestionAssignment = (assignmentType: AssignmentType) => assignmentType === "QUIZ" || assignmentType === "EXAM";

const toggleOptionSelection = (selected: number[], index: number) => {
  if (selected.includes(index)) {
    return selected.filter((item) => item !== index);
  }
  return [...selected, index].sort((a, b) => a - b);
};

export function AssignmentStudentSubmission(props: Props) {
  const {
    assignmentId,
    assignmentType,
    allowedSubmissionTypes,
    maxAttempts,
    allowLateSubmissions,
    timerMinutes,
    startAt,
    endAt,
    initialSubmissions,
  } = props;

  const [submissions, setSubmissions] = useState<SubmissionListItem[]>(initialSubmissions);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizQuestionsLoading, setQuizQuestionsLoading] = useState(false);
  const [studentQuizAnswers, setStudentQuizAnswers] = useState<Record<string, number[]>>({});
  const [studentShortAnswers, setStudentShortAnswers] = useState<Record<string, string>>({});
  const [studentTextResponse, setStudentTextResponse] = useState("");
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentPending, setStudentPending] = useState(false);
  const [error, setError] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [quizStartedAt, setQuizStartedAt] = useState<string | null>(null);

  const questionBased = isQuestionAssignment(assignmentType);
  const allowText = allowedSubmissionTypes.includes("TEXT");
  const allowFile = allowedSubmissionTypes.includes("FILE");
  const timerKey = `assignmentTimer:${assignmentId}`;

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const response = await fetch(`/api/assignments/submissions?assignmentId=${encodeURIComponent(assignmentId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { submissions?: SubmissionListItem[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load submissions.");
        return;
      }
      setSubmissions(result.submissions ?? []);
    } catch {
      setError("Unable to load submissions.");
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const loadQuizQuestions = async () => {
    if (!questionBased) return;
    setQuizQuestionsLoading(true);
    try {
      const response = await fetch(`/api/assignments/questions?assignmentId=${encodeURIComponent(assignmentId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { questions?: QuizQuestion[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load quiz questions.");
        return;
      }
      setQuizQuestions(result.questions ?? []);
    } catch {
      setError("Unable to load quiz questions.");
    } finally {
      setQuizQuestionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, [assignmentId]);

  useEffect(() => {
    void loadQuizQuestions();
  }, [assignmentId, questionBased]);

  useEffect(() => {
    if (!timerMinutes) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(timerKey) : null;
    if (stored) {
      setQuizStartedAt(stored);
      return;
    }
    const now = new Date().toISOString();
    setQuizStartedAt(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(timerKey, now);
    }
  }, [timerMinutes, timerKey]);

  useEffect(() => {
    const intervalMs = timerMinutes ? 1000 : 30000;
    const timer = window.setInterval(() => setNowTick(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [timerMinutes]);

  const quizRemainingSeconds = useMemo(() => {
    if (!timerMinutes || !quizStartedAt) return null;
    const startedAtMs = new Date(quizStartedAt).getTime();
    if (Number.isNaN(startedAtMs)) return null;
    const limitMs = timerMinutes * 60 * 1000;
    const remainingMs = Math.max(0, startedAtMs + limitMs - nowTick);
    return Math.floor(remainingMs / 1000);
  }, [timerMinutes, quizStartedAt, nowTick]);

  const startAtMs = startAt ? new Date(startAt).getTime() : NaN;
  const endAtMs = endAt ? new Date(endAt).getTime() : NaN;
  const isSubmissionBeforeWindow = startAt ? Number.isFinite(startAtMs) && nowTick < startAtMs : false;
  const isSubmissionAfterWindow = endAt ? Number.isFinite(endAtMs) && nowTick > endAtMs : false;
  const isSubmissionBlockedByWindow = isSubmissionBeforeWindow || (isSubmissionAfterWindow && !allowLateSubmissions);

  const attemptCount = submissions.length;
  const timerExpired = timerMinutes ? quizRemainingSeconds === 0 : false;
  const hasSubmittedOnce = !questionBased && attemptCount > 0;
  const reachedAttemptLimit = questionBased && attemptCount >= maxAttempts;
  const canSubmit = useMemo(() => {
    if (isSubmissionBlockedByWindow || timerExpired) return false;
    if (questionBased) return attemptCount < maxAttempts;
    return attemptCount === 0;
  }, [attemptCount, isSubmissionBlockedByWindow, maxAttempts, questionBased, timerExpired]);
  const showBlockedMessage = !canSubmit && !hasSubmittedOnce;
  const submitTooltip = hasSubmittedOnce
    ? "You have already submitted the assignment."
    : reachedAttemptLimit
      ? "You have reached the maximum attempts."
      : "";

  const onStudentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStudentPending(true);
    setError("");

    try {
      if (questionBased) {
        if (!quizQuestions.length) {
          setError("No questions are configured for this assignment.");
          return;
        }
        const hasUnansweredQuestion = quizQuestions.some((question) => {
          const questionType = question.questionType ?? "MCQ";
          if (questionType === "SHORT_ANSWER") {
            return !(studentShortAnswers[question.id]?.trim() ?? "");
          }
          return (studentQuizAnswers[question.id] ?? []).length === 0;
        });
        if (hasUnansweredQuestion) {
          setError("Answer all questions before submitting.");
          return;
        }
      } else {
        const hasText = studentTextResponse.trim().length > 0;
        const hasFile = !!studentFile;
        if (allowText && allowFile && !hasText && !hasFile) {
          setError("Provide a text response or upload a file.");
          return;
        }
        if (allowText && !allowFile && !hasText) {
          setError("Text response is required.");
          return;
        }
        if (!allowText && allowFile && !hasFile) {
          setError("File upload is required.");
          return;
        }
      }

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let mimeType: string | null = null;

      if (studentFile) {
        const form = new FormData();
        form.set("file", studentFile);
        const uploadResponse = await fetch("/api/assignments/uploads", { method: "POST", body: form });
        const uploadRaw = await uploadResponse.text();
        const uploadResult = uploadRaw
          ? (JSON.parse(uploadRaw) as { error?: string; file?: { url: string; fileName: string; mimeType: string } })
          : {};
        if (!uploadResponse.ok || !uploadResult.file) {
          setError(uploadResult.error ?? "Unable to upload submission file.");
          return;
        }
        fileUrl = uploadResult.file.url;
        fileName = uploadResult.file.fileName;
        mimeType = uploadResult.file.mimeType;
      }

      const response = await fetch("/api/assignments/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          textResponse: studentTextResponse,
          fileUrl,
          fileName,
          mimeType,
          quizStartedAt: timerMinutes ? quizStartedAt : null,
          quizAnswers: questionBased
            ? quizQuestions.map((question) => {
                const questionType = question.questionType ?? "MCQ";
                return {
                  questionId: question.id,
                  selectedOptionIndices: questionType === "SHORT_ANSWER" ? [] : (studentQuizAnswers[question.id] ?? []),
                  shortAnswerText: questionType === "SHORT_ANSWER" ? (studentShortAnswers[question.id] ?? "") : "",
                };
              })
            : [],
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to submit assignment.");
        return;
      }

      setStudentTextResponse("");
      setStudentFile(null);
      setStudentQuizAnswers({});
      setStudentShortAnswers({});

      if (timerMinutes) {
        const nextStart = new Date().toISOString();
        setQuizStartedAt(nextStart);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(timerKey, nextStart);
        }
      }

      await loadSubmissions();
    } catch {
      setError("Unable to submit assignment.");
    } finally {
      setStudentPending(false);
    }
  };

  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">Submit Assignment</p>
      <ToastMessage type="error" message={error} />
      {submissionsLoading ? <p className="brand-muted mt-2 text-sm">Refreshing submissions...</p> : null}

      <div className="mt-2 text-sm text-[#1f518f]">
        {timerMinutes ? (
          <p>
            Timer: {quizRemainingSeconds !== null ? `${Math.floor(quizRemainingSeconds / 60)}m ${quizRemainingSeconds % 60}s` : "-"}
          </p>
        ) : null}
        {isSubmissionBeforeWindow ? <p>Submission opens on {formatDate(startAt)}.</p> : null}
        {isSubmissionAfterWindow && allowLateSubmissions ? (
          <p>Submission window ended on {formatDate(endAt)}. Late penalties may apply.</p>
        ) : null}
        {isSubmissionAfterWindow && !allowLateSubmissions ? (
          <p>Submission window has ended. Late submissions are blocked.</p>
        ) : null}
      </div>

      <form className="mt-3 grid gap-3" onSubmit={onStudentSubmit}>
        {questionBased ? (
          <>
            {quizQuestionsLoading ? <p className="brand-muted text-sm">Loading questions...</p> : null}
            {quizQuestions.map((question, index) => (
              <div key={question.id} className="rounded-md border border-[#dbe9fb] p-3">
                <p className="text-sm font-semibold text-[#0d3f80]">
                  Q{index + 1}. {question.prompt} ({question.points} pts)
                </p>
                {(question.questionType ?? "MCQ") === "SHORT_ANSWER" ? (
                  <label className="mt-2 grid gap-1.5">
                    <span className="brand-label">Short Answer</span>
                    <textarea
                      className="brand-input min-h-[90px]"
                      placeholder="Type your answer"
                      value={studentShortAnswers[question.id] ?? ""}
                      onChange={(event) =>
                        setStudentShortAnswers((prev) => ({ ...prev, [question.id]: event.currentTarget.value }))
                      }
                    />
                  </label>
                ) : (
                  <div className="mt-2 grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={`${question.id}_${optionIndex}`} className="inline-flex items-center gap-2 text-sm text-[#234f8f]">
                        <input
                          type="checkbox"
                          checked={studentQuizAnswers[question.id]?.includes(optionIndex) ?? false}
                          onChange={() =>
                            setStudentQuizAnswers((prev) => ({
                              ...prev,
                              [question.id]: toggleOptionSelection(prev[question.id] ?? [], optionIndex),
                            }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            {allowText ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Text Response</span>
                <textarea
                  className="brand-input min-h-[100px]"
                  placeholder="Text response"
                  aria-label="Text response"
                  value={studentTextResponse}
                  onChange={(event) => setStudentTextResponse(event.currentTarget.value)}
                />
              </label>
            ) : null}
            {allowFile ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Upload File</span>
                <input
                  type="file"
                  className="brand-input"
                  aria-label="Upload assignment file"
                  onChange={(event) => setStudentFile(event.currentTarget.files?.[0] ?? null)}
                />
              </label>
            ) : null}
          </>
        )}

        <span title={submitTooltip || undefined} className="w-fit">
          <button
            className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit || studentPending}
          >
            {studentPending ? "Submitting..." : hasSubmittedOnce ? "Submitted" : "Submit Attempt"}
          </button>
        </span>
      </form>

      {showBlockedMessage ? (
        <p className="mt-2 rounded-md border border-[#dbe9fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#1f518f]">
          {timerExpired
            ? "Time is up for this attempt."
            : isSubmissionBeforeWindow
            ? `Submission opens on ${formatDate(startAt)}.`
            : isSubmissionAfterWindow && !allowLateSubmissions
              ? "Submission window has ended. Late submissions are blocked."
              : questionBased
                ? `You have reached the maximum ${assignmentType.toLowerCase()} attempts.`
                : "You already submitted this assignment. Resubmission is not allowed."}
        </p>
      ) : null}
    </section>
  );
}
