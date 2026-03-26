"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { LoadingIndicator } from "@/components/loading-indicator";
import { toast } from "@/lib/toast";
import { useLanguage } from "@/components/language-provider";
import { translateContent } from "@/lib/i18n";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

type CourseOption = {
  id: string;
  code: string;
  title: string;
  endDate: string | null;
  teacherId: string | null;
  teacher?: {
    name: string | null;
    email: string;
  } | null;
};

type AssignmentConfig = {
  assignmentId: string;
  assignmentType: "HOMEWORK" | "QUIZ" | "EXAM";
  rubricSteps: string[];
  allowedSubmissionTypes: Array<"TEXT" | "FILE">;
  maxAttempts: number;
  autoGrade: boolean;
  allowLateSubmissions: boolean;
  attemptScoringStrategy: "LATEST" | "HIGHEST";
  timerMinutes: number | null;
  startAt?: string | null;
  moduleId: string | null;
  lessonId: string | null;
  completionRule: "SUBMISSION_OR_GRADE" | "SUBMISSION_ONLY" | "GRADE_ONLY";
};

type LessonOption = {
  id: string;
  title: string;
};

type ModuleOption = {
  id: string;
  title: string;
  lessons: LessonOption[];
};

type AssignmentItem = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  dueAt?: string | null;
  maxPoints: number;
  createdAt: string;
  updatedAt: string;
  course: CourseOption;
  config: AssignmentConfig;
  submissionCount?: number;
};

type SubmissionItem = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string | null;
  studentEmail?: string;
  attemptNumber: number;
  textResponse: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  submittedAt: string;
  isLate: boolean;
  lateByMinutes: number;
  latePenaltyPct: number;
  rawScore: number | null;
  finalScore: number | null;
  feedback: string | null;
  letterGrade?: string | null;
  publishedAt: string | null;
  status: string;
  plagiarismStatus?: "PENDING" | "COMPLETED" | "FAILED" | null;
  plagiarismScore?: number | null;
  plagiarismSummary?: string | null;
  plagiarismCheckedAt?: string | null;
};

type QuizQuestion = {
  id: string;
  assignmentId: string;
  prompt: string;
  questionType?: "MCQ" | "SHORT_ANSWER";
  options: string[];
  correctOptionIndexes?: number[];
  shortAnswerKey?: string | null;
  points: number;
  position: number;
};

type DraftQuizQuestion = {
  questionType: "MCQ" | "SHORT_ANSWER";
  prompt: string;
  options: string[];
  correctOptionIndexes: number[];
  shortAnswerKey?: string | null;
  points: number;
};

type GradeEditRequestItem = {
  id: string;
  assignmentId: string;
  studentId: string;
  reason: string;
  proposedPoints: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  assignment?: { id: string; title: string; courseId: string };
  student?: { id: string; name: string | null; email: string };
  requestedBy?: { id: string; name: string | null; email: string };
};

type Props = {
  role: AppRole;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const isCourseExpiredForStudent = (endDate: string | null, nowMs: number) => {
  if (!endDate) return false;
  const endMs = new Date(endDate).getTime();
  if (!Number.isFinite(endMs)) return false;
  return nowMs > endMs;
};

const toBoundaryIso = (value: string, boundary: "start" | "end") => {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T${boundary === "end" ? "23:59:59.999" : "00:00:00.000"}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toDateTimeIso = (dateValue: string, timeValue: string) => {
  const normalizedDate = dateValue.trim();
  const normalizedTime = timeValue.trim();
  if (!normalizedDate || !normalizedTime) return null;
  const parsed = new Date(`${normalizedDate}T${normalizedTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatAssignmentWindow = (
  assignmentType: "HOMEWORK" | "QUIZ" | "EXAM",
  startAt: string | null,
  endAt: string | null
) => {
  if (assignmentType === "HOMEWORK") {
    return `${formatDate(startAt)} ${formatTime(startAt)} - ${formatDate(endAt)} ${formatTime(endAt)}`;
  }
  return `${formatDate(startAt)} - ${formatDate(endAt)}`;
};

const toggleOptionSelection = (selected: number[], index: number) => {
  if (selected.includes(index)) {
    return selected.filter((item) => item !== index);
  }
  return [...selected, index].sort((a, b) => a - b);
};

const formatOptionIndexes = (indexes: number[], labeler: (label: string) => string) =>
  indexes.map((index) => labeler(String.fromCharCode(65 + index))).join(", ");

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

const isQuestionAssignment = (assignmentType: "HOMEWORK" | "QUIZ" | "EXAM") =>
  assignmentType === "QUIZ" || assignmentType === "EXAM";

const formatMinutes = (
  minutes: number,
  labels: { day: string; hour: string; minute: string }
) => {
  if (!minutes) return `0${labels.minute}`;
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}${labels.day} ${hours}${labels.hour}`;
  return `${hours}${labels.hour} ${minutes % 60}${labels.minute}`;
};

const normalizeRubricText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");



const isPublishedOrLockedState = (state: string) =>
  state === "GRADE_PUBLISHED" ||
  state === "GRADE_EDIT_REQUESTED" ||
  state === "GRADE_EDIT_APPROVED" ||
  state === "GRADE_EDIT_REJECTED" ||
  state === "PUBLISHED";

export function AssignmentsModule({ role }: Props) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = role === "TEACHER";
  const isStudent = role === "STUDENT";

  const statusLabel = (value?: string | null) => {
    if (!value) return t("common.na");
    return t(`status.${value.toLowerCase()}`, undefined, formatEnumLabel(value));
  };
  const plagiarismBandLabel = (score: number | null | undefined) => {
    if (score === null || score === undefined) return t("common.na");
    if (score >= 70) return t("plagiarism.high");
    if (score >= 40) return t("plagiarism.medium");
    return t("plagiarism.low");
  };
  const isTeacher = role === "TEACHER";
  const translateText = (value: string | null | undefined) => translateContent(language, value);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdminReadOnly = role === "SUPER_ADMIN" || role === "ADMIN" || role === "DEPARTMENT_HEAD";
  const showInlineDetails = false;

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState<"ALL" | "SUBMITTED" | "DUE">("ALL");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const [createCourseId, setCreateCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createStartAt, setCreateStartAt] = useState("");
  const [createEndAt, setCreateEndAt] = useState("");
  const [createStartTime, setCreateStartTime] = useState("");
  const [createEndTime, setCreateEndTime] = useState("");
  const [createMaxPoints, setCreateMaxPoints] = useState("100");
  const [createType, setCreateType] = useState<"HOMEWORK" | "QUIZ" | "EXAM">("HOMEWORK");
  const [createAllowedText, setCreateAllowedText] = useState(true);
  const [createAllowedFile, setCreateAllowedFile] = useState(true);
  const [createAttempts, setCreateAttempts] = useState("1");
  const [createAllowLateSubmissions, setCreateAllowLateSubmissions] = useState(true);
  const [createAttemptScoringStrategy, setCreateAttemptScoringStrategy] = useState<"LATEST" | "HIGHEST">("LATEST");
  const [createTimerMinutes, setCreateTimerMinutes] = useState("");
  const [createRubric, setCreateRubric] = useState("");
  const [createRubricFileName, setCreateRubricFileName] = useState("");
  const [createModuleId, setCreateModuleId] = useState("");
  const [createLessonId, setCreateLessonId] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createDraftQuestions, setCreateDraftQuestions] = useState<DraftQuizQuestion[]>([]);
  const [createQuestionPrompt, setCreateQuestionPrompt] = useState("");
  const [createQuestionOptionA, setCreateQuestionOptionA] = useState("");
  const [createQuestionOptionB, setCreateQuestionOptionB] = useState("");
  const [createQuestionOptionC, setCreateQuestionOptionC] = useState("");
  const [createQuestionOptionD, setCreateQuestionOptionD] = useState("");
  const [createQuestionType, setCreateQuestionType] = useState<"MCQ" | "SHORT_ANSWER">("MCQ");
  const [createQuestionCorrectIndexes, setCreateQuestionCorrectIndexes] = useState<number[]>([0]);
  const [createQuestionShortAnswerKey, setCreateQuestionShortAnswerKey] = useState("");
  const [createQuestionPoints, setCreateQuestionPoints] = useState("1");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editMaxPoints, setEditMaxPoints] = useState("100");
  const [editType, setEditType] = useState<"HOMEWORK" | "QUIZ" | "EXAM">("HOMEWORK");
  const [editAllowedText, setEditAllowedText] = useState(true);
  const [editAllowedFile, setEditAllowedFile] = useState(true);
  const [editAttempts, setEditAttempts] = useState("1");
  const [editAllowLateSubmissions, setEditAllowLateSubmissions] = useState(true);
  const [editAttemptScoringStrategy, setEditAttemptScoringStrategy] = useState<"LATEST" | "HIGHEST">("LATEST");
  const [editTimerMinutes, setEditTimerMinutes] = useState("");
  const [editRubric, setEditRubric] = useState("");
  const [editRubricFileName, setEditRubricFileName] = useState("");
  const [editModuleId, setEditModuleId] = useState("");
  const [editLessonId, setEditLessonId] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState("");
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState("");

  const [studentTextResponse, setStudentTextResponse] = useState("");
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentQuizAnswers, setStudentQuizAnswers] = useState<Record<string, number[]>>({});
  const [studentShortAnswers, setStudentShortAnswers] = useState<Record<string, string>>({});
  const [studentQuizStartedAt, setStudentQuizStartedAt] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [studentPending, setStudentPending] = useState(false);

  const [gradeRawScoreBySubmission, setGradeRawScoreBySubmission] = useState<Record<string, string>>({});
  const [gradeFeedbackBySubmission, setGradeFeedbackBySubmission] = useState<Record<string, string>>({});
  const [gradePendingId, setGradePendingId] = useState("");
  const [invalidatePendingId, setInvalidatePendingId] = useState("");
  const [confirmInvalidateSubmissionId, setConfirmInvalidateSubmissionId] = useState("");
  const [structureByCourseId, setStructureByCourseId] = useState<Record<string, ModuleOption[]>>({});
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizQuestionsLoading, setQuizQuestionsLoading] = useState(false);
  const [newQuestionPrompt, setNewQuestionPrompt] = useState("");
  const [newQuestionOptionA, setNewQuestionOptionA] = useState("");
  const [newQuestionOptionB, setNewQuestionOptionB] = useState("");
  const [newQuestionOptionC, setNewQuestionOptionC] = useState("");
  const [newQuestionOptionD, setNewQuestionOptionD] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<"MCQ" | "SHORT_ANSWER">("MCQ");
  const [newQuestionCorrectIndexes, setNewQuestionCorrectIndexes] = useState<number[]>([0]);
  const [newQuestionShortAnswerKey, setNewQuestionShortAnswerKey] = useState("");
  const [newQuestionPoints, setNewQuestionPoints] = useState("1");
  const [createQuestionPending, setCreateQuestionPending] = useState(false);
  const [deleteQuestionPendingId, setDeleteQuestionPendingId] = useState("");
  const [editQuestionId, setEditQuestionId] = useState("");
  const [editQuestionPrompt, setEditQuestionPrompt] = useState("");
  const [editQuestionOptionA, setEditQuestionOptionA] = useState("");
  const [editQuestionOptionB, setEditQuestionOptionB] = useState("");
  const [editQuestionOptionC, setEditQuestionOptionC] = useState("");
  const [editQuestionOptionD, setEditQuestionOptionD] = useState("");
  const [editQuestionType, setEditQuestionType] = useState<"MCQ" | "SHORT_ANSWER">("MCQ");
  const [editQuestionCorrectIndexes, setEditQuestionCorrectIndexes] = useState<number[]>([0]);
  const [editQuestionShortAnswerKey, setEditQuestionShortAnswerKey] = useState("");
  const [editQuestionPoints, setEditQuestionPoints] = useState("1");
  const [editQuestionPendingId, setEditQuestionPendingId] = useState("");
  const [gradeEditRequests, setGradeEditRequests] = useState<GradeEditRequestItem[]>([]);
  const [gradeEditRequestsLoading, setGradeEditRequestsLoading] = useState(false);
  const [requestEditForSubmissionId, setRequestEditForSubmissionId] = useState("");
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditProposedPoints, setRequestEditProposedPoints] = useState("");
  const [requestEditPendingId, setRequestEditPendingId] = useState("");
  const [reviewPendingId, setReviewPendingId] = useState("");
  const [reviewApprovedPointsByRequest, setReviewApprovedPointsByRequest] = useState<Record<string, string>>({});
  const [reviewNoteByRequest, setReviewNoteByRequest] = useState<Record<string, string>>({});
  const assignmentIdParam = searchParams.get("assignmentId")?.trim() ?? "";

  useEffect(() => {
    if (!error.trim()) return;
    toast.error(error);
    setError("");
  }, [error]);

  useEffect(() => {
    if (!assignmentIdParam) return;
    if (!assignments.length) return;
    const exists = assignments.some((item) => item.id === assignmentIdParam);
    if (!exists) return;
    if (selectedAssignmentId !== assignmentIdParam) {
      setSelectedAssignmentId(assignmentIdParam);
      setActiveMenu("ALL");
    }
  }, [assignmentIdParam, assignments, selectedAssignmentId]);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId]
  );
  const editAssignment = useMemo(
    () => assignments.find((item) => item.id === editId) ?? null,
    [assignments, editId]
  );
  const studentAttemptCount = isStudent
    ? submissions.filter((submission) => submission.status !== "ATTEMPT_CANCELLED").length
    : 0;
  const studentCurrentAttemptNumber = studentAttemptCount + 1;
  const studentTimerKey = selectedAssignment
    ? `assignmentTimer:${selectedAssignment.id}:attempt:${studentCurrentAttemptNumber}`
    : "";
  const filteredAssignments = useMemo(() => {
    if (activeMenu === "SUBMITTED") {
      return assignments.filter((item) => (item.submissionCount ?? 0) > 0);
    }
    if (activeMenu === "DUE") {
      return assignments.filter((item) => {
        const dueAt = item.dueAt ?? item.endAt ?? item.startAt ?? item.config.startAt ?? null;
        if (!dueAt) return false;
        const dueMs = new Date(dueAt).getTime();
        return Number.isFinite(dueMs) && dueMs >= nowTick;
      });
    }
    return assignments;
  }, [activeMenu, assignments, nowTick]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", { method: "GET" });
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as { courses?: CourseOption[]; assignments?: AssignmentItem[]; error?: string })
        : {};

      if (!response.ok) {
        setError(result.error ?? t("error.loadAssignments"));
        setCourses([]);
        setAssignments([]);
        return;
      }

      const nextCourses = result.courses ?? [];
      const nextAssignments = result.assignments ?? [];
      setCourses(nextCourses);
      setAssignments(nextAssignments);
      setCreateCourseId((prev) => prev || nextCourses[0]?.id || "");
      setSelectedAssignmentId((prev) =>
        prev && nextAssignments.some((item) => item.id === prev) ? prev : ""
      );
    } catch {
      setError(t("error.loadAssignments"));
      setCourses([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadGradeEditRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
    setGradeEditRequestsLoading(true);
    try {
      const response = await fetch("/api/admin/grade-edit-requests", { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { requests?: GradeEditRequestItem[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadGradeEditRequests"));
        setGradeEditRequests([]);
        return;
      }
      setGradeEditRequests(result.requests ?? []);
    } catch {
      setError(t("error.loadGradeEditRequests"));
      setGradeEditRequests([]);
    } finally {
      setGradeEditRequestsLoading(false);
    }
  }, [isSuperAdmin, t]);

  const loadSubmissions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) {
      setSubmissions([]);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const response = await fetch(`/api/assignments/submissions?assignmentId=${encodeURIComponent(assignmentId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { submissions?: SubmissionItem[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadSubmissions"));
        setSubmissions([]);
        return;
      }
      setSubmissions(result.submissions ?? []);
    } catch {
      setError(t("error.loadSubmissions"));
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [t]);

  const loadCourseStructure = useCallback(async (courseId: string) => {
    if (!courseId) return;
    if (structureByCourseId[courseId]) return;
    try {
      const response = await fetch(`/api/courses/modules?courseId=${encodeURIComponent(courseId)}`);
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as {
            modules?: Array<{ id: string; title: string; lessons?: Array<{ id: string; title: string }> }>;
          })
        : {};
      if (!response.ok) return;
      setStructureByCourseId((prev) => ({
        ...prev,
        [courseId]: (result.modules ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          lessons: (item.lessons ?? []).map((lesson) => ({ id: lesson.id, title: lesson.title })),
        })),
      }));
    } catch {
      // Ignore structure prefetch failures; assignment CRUD remains available.
    }
  }, [structureByCourseId]);

  const loadQuizQuestions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) {
      setQuizQuestions([]);
      return;
    }
    setQuizQuestionsLoading(true);
    try {
      const response = await fetch(`/api/assignments/questions?assignmentId=${encodeURIComponent(assignmentId)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { questions?: QuizQuestion[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.loadQuizQuestions"));
        setQuizQuestions([]);
        return;
      }
      setQuizQuestions(result.questions ?? []);
    } catch {
      setError(t("error.loadQuizQuestions"));
      setQuizQuestions([]);
    } finally {
      setQuizQuestionsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isSuperAdmin) {
      void loadGradeEditRequests();
    }
  }, [isSuperAdmin, loadGradeEditRequests]);

  useEffect(() => {
    if (canManage && createCourseId) {
      void loadCourseStructure(createCourseId);
    }
  }, [canManage, createCourseId, loadCourseStructure]);

  useEffect(() => {
    if (createType !== "EXAM" && createQuestionType === "SHORT_ANSWER") {
      setCreateQuestionType("MCQ");
      setCreateQuestionShortAnswerKey("");
    }
  }, [createQuestionType, createType]);

  useEffect(() => {
    if (selectedAssignmentId) {
      void loadSubmissions(selectedAssignmentId);
    }
  }, [loadSubmissions, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      setQuizQuestions([]);
      setStudentQuizAnswers({});
      setStudentShortAnswers({});
      setStudentQuizStartedAt(null);
      return;
    }
    if (selectedAssignment && isQuestionAssignment(selectedAssignment.config.assignmentType)) {
      void loadQuizQuestions(selectedAssignmentId);
    } else {
      setQuizQuestions([]);
      setStudentQuizAnswers({});
      setStudentShortAnswers({});
    }
  }, [loadQuizQuestions, selectedAssignment?.config.assignmentType, selectedAssignmentId]);

  useEffect(() => {
    if (!isStudent || !selectedAssignment?.config.timerMinutes || !selectedAssignmentId) {
      setStudentQuizStartedAt(null);
      return;
    }
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(studentTimerKey) : null;
    setStudentQuizStartedAt(stored || null);
  }, [isStudent, selectedAssignment?.config.timerMinutes, selectedAssignmentId, studentTimerKey]);

  const startStudentQuizTimerIfNeeded = useCallback(() => {
    if (!isStudent || !selectedAssignment?.config.timerMinutes || studentQuizStartedAt || !studentTimerKey) {
      return;
    }
    const now = new Date().toISOString();
    setStudentQuizStartedAt(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(studentTimerKey, now);
    }
  }, [isStudent, selectedAssignment?.config.timerMinutes, studentQuizStartedAt, studentTimerKey]);

  useEffect(() => {
    if (selectedAssignment?.config.assignmentType !== "EXAM" && newQuestionType === "SHORT_ANSWER") {
      setNewQuestionType("MCQ");
      setNewQuestionShortAnswerKey("");
    }
  }, [newQuestionType, selectedAssignment?.config.assignmentType]);

  useEffect(() => {
    if (!isStudent || !selectedAssignment?.config.timerMinutes) {
      return;
    }
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStudent, selectedAssignment?.config.timerMinutes]);

  useEffect(() => {
    if (!isStudent || !selectedAssignment) return;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, [isStudent, selectedAssignment]);

  useEffect(() => {
    if (!editId) return;
    const selected = assignments.find((item) => item.id === editId);
    if (!selected) return;
    setEditTitle(selected.title);
    setEditDescription(selected.description ?? "");
    setEditStartAt(toDateInput(selected.startAt ?? selected.config.startAt ?? null));
    setEditEndAt(toDateInput(selected.endAt ?? selected.dueAt ?? null));
    setEditStartTime(toTimeInput(selected.startAt ?? selected.config.startAt ?? null));
    setEditEndTime(toTimeInput(selected.endAt ?? selected.dueAt ?? null));
    setEditMaxPoints(String(selected.maxPoints));
    setEditType(selected.config.assignmentType);
    setEditAllowedText(selected.config.allowedSubmissionTypes.includes("TEXT"));
    setEditAllowedFile(selected.config.allowedSubmissionTypes.includes("FILE"));
    setEditAttempts(String(selected.config.maxAttempts));
    setEditAllowLateSubmissions(selected.config.allowLateSubmissions !== false);
    setEditAttemptScoringStrategy(selected.config.attemptScoringStrategy ?? "LATEST");
    setEditTimerMinutes(selected.config.timerMinutes ? String(selected.config.timerMinutes) : "");
    setEditRubric(selected.config.rubricSteps.join("\n"));
    setEditRubricFileName("");
    setEditModuleId(selected.config.moduleId ?? "");
    setEditLessonId(selected.config.lessonId ?? "");
    void loadCourseStructure(selected.courseId);
  }, [assignments, editId, loadCourseStructure]);

  const buildAllowedTypes = (assignmentType: "HOMEWORK" | "QUIZ" | "EXAM", allowText: boolean, allowFile: boolean) => {
    if (assignmentType === "QUIZ") return [] as Array<"TEXT" | "FILE">;
    const allowed: Array<"TEXT" | "FILE"> = [];
    if (allowText) allowed.push("TEXT");
    if (allowFile) allowed.push("FILE");
    return allowed.length ? allowed : (["TEXT"] as Array<"TEXT" | "FILE">);
  };

  const addDraftQuestion = () => {
    const prompt = createQuestionPrompt.trim();
    if (createType === "QUIZ" && createQuestionType !== "MCQ") {
      setError(t("validation.quizMcqOnly"));
      return;
    }
    const options = [createQuestionOptionA, createQuestionOptionB, createQuestionOptionC, createQuestionOptionD]
      .map((item) => item.trim())
      .filter(Boolean);
    const correctOptionIndexes = Array.from(
      new Set(createQuestionCorrectIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length))
    ).sort((a, b) => a - b);
    const shortAnswerKey = createQuestionShortAnswerKey.trim() || null;
    const points = Number(createQuestionPoints);

    if (!prompt) {
      setError(t("validation.questionPromptRequired"));
      return;
    }
    if (createQuestionType === "MCQ") {
      if (options.length < 2) {
        setError(t("validation.mcqMinOptions"));
        return;
      }
      if (!correctOptionIndexes.length) {
        setError(t("validation.correctOptionRequired"));
        return;
      }
    }
    if (!Number.isFinite(points) || points <= 0) {
      setError(t("validation.questionPointsPositive"));
      return;
    }

    setCreateDraftQuestions((prev) => [
      ...prev,
      {
        questionType: createQuestionType,
        prompt,
        options: createQuestionType === "MCQ" ? options : [],
        correctOptionIndexes: createQuestionType === "MCQ" ? correctOptionIndexes : [],
        shortAnswerKey: createQuestionType === "SHORT_ANSWER" ? shortAnswerKey : null,
        points,
      },
    ]);
    setCreateQuestionPrompt("");
    setCreateQuestionOptionA("");
    setCreateQuestionOptionB("");
    setCreateQuestionOptionC("");
    setCreateQuestionOptionD("");
    setCreateQuestionType("MCQ");
    setCreateQuestionCorrectIndexes([0]);
    setCreateQuestionShortAnswerKey("");
    setCreateQuestionPoints("1");
  };

  const resetEditQuestion = () => {
    setEditQuestionId("");
    setEditQuestionPrompt("");
    setEditQuestionOptionA("");
    setEditQuestionOptionB("");
    setEditQuestionOptionC("");
    setEditQuestionOptionD("");
    setEditQuestionType("MCQ");
    setEditQuestionCorrectIndexes([0]);
    setEditQuestionShortAnswerKey("");
    setEditQuestionPoints("1");
    setEditQuestionPendingId("");
  };

  const startEditQuestion = (question: QuizQuestion) => {
    const resolvedType = selectedAssignment?.config.assignmentType === "QUIZ" ? "MCQ" : (question.questionType ?? "MCQ");
    setEditQuestionId(question.id);
    setEditQuestionPrompt(question.prompt);
    setEditQuestionType(resolvedType);
    setEditQuestionOptionA(question.options[0] ?? "");
    setEditQuestionOptionB(question.options[1] ?? "");
    setEditQuestionOptionC(question.options[2] ?? "");
    setEditQuestionOptionD(question.options[3] ?? "");
    setEditQuestionCorrectIndexes(question.correctOptionIndexes ?? [0]);
    setEditQuestionShortAnswerKey(question.shortAnswerKey ?? "");
    setEditQuestionPoints(String(question.points ?? 1));
  };

  const onUpdateQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editQuestionId || !selectedAssignment) return;
    setEditQuestionPendingId(editQuestionId);
    setError("");
    try {
      const prompt = editQuestionPrompt.trim();
      const options = [editQuestionOptionA, editQuestionOptionB, editQuestionOptionC, editQuestionOptionD]
        .map((item) => item.trim())
        .filter(Boolean);
      const correctOptionIndexes = Array.from(
        new Set(
          editQuestionCorrectIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length)
        )
      ).sort((a, b) => a - b);
      const shortAnswerKey = editQuestionShortAnswerKey.trim() || null;
      const points = Number(editQuestionPoints);

      if (!prompt) {
        setError(t("validation.questionPromptRequired"));
        return;
      }
      if (selectedAssignment.config.assignmentType === "QUIZ" && editQuestionType !== "MCQ") {
        setError(t("validation.quizMcqOnly"));
        return;
      }
      if (editQuestionType === "MCQ") {
        if (options.length < 2) {
          setError(t("validation.mcqMinOptions"));
          return;
        }
        if (!correctOptionIndexes.length) {
          setError(t("validation.correctOptionRequired"));
          return;
        }
      }
      if (!Number.isFinite(points) || points <= 0) {
        setError(t("validation.questionPointsPositive"));
        return;
      }

      const response = await fetch("/api/assignments/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: editQuestionId,
          prompt,
          questionType: editQuestionType,
          options: editQuestionType === "MCQ" ? options : [],
          correctOptionIndexes: editQuestionType === "MCQ" ? correctOptionIndexes : [],
          shortAnswerKey: editQuestionType === "SHORT_ANSWER" ? shortAnswerKey : null,
          points,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};

      if (!response.ok) {
        setError(result.error ?? t("error.updateQuizQuestion"));
        return;
      }

      await loadQuizQuestions(selectedAssignment.id);
      resetEditQuestion();
    } catch {
      setError(t("error.updateQuizQuestion"));
    } finally {
      setEditQuestionPendingId("");
    }
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setError("");
    try {
      const createRubricSteps = createRubric.split("\n").map((item) => item.trim()).filter(Boolean);
      const hasCreateContent = createDescription.trim().length > 0 || createRubricSteps.length > 0;
      if ((createType === "QUIZ" || createType === "EXAM") && !hasCreateContent) {
        setError(t("validation.assignmentNeedsContent"));
        return;
      }
      if (isQuestionAssignment(createType) && createDraftQuestions.length === 0) {
        setError(createType === "QUIZ" ? t("validation.quizNeedsQuestion") : t("validation.examNeedsQuestion"));
        return;
      }

      const createStartIso =
        createType === "HOMEWORK"
          ? toDateTimeIso(createStartAt, createStartTime)
          : toBoundaryIso(createStartAt, "start");
      const createEndIso =
        createType === "HOMEWORK"
          ? toDateTimeIso(createEndAt, createEndTime)
          : toBoundaryIso(createEndAt, "end");

      if (!createStartIso || !createEndIso) {
        setError(
          createType === "HOMEWORK"
            ? t("validation.homeworkDatesRequired")
            : t("validation.assignmentDatesRequired")
        );
        return;
      }
      if (new Date(createEndIso).getTime() <= new Date(createStartIso).getTime()) {
        setError(createType === "HOMEWORK" ? t("validation.homeworkEndAfterStart") : t("validation.endDateAfterStart"));
        return;
      }

      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: createCourseId,
          title: createTitle,
          description: createDescription,
          startAt: createStartIso,
          endAt: createEndIso,
          maxPoints: createMaxPoints,
          assignmentType: createType,
          allowedSubmissionTypes: buildAllowedTypes(createType, createAllowedText, createAllowedFile),
          maxAttempts: Number(createAttempts),
          allowLateSubmissions: createAllowLateSubmissions,
          attemptScoringStrategy: createAttemptScoringStrategy,
          timerMinutes: createType === "HOMEWORK" ? null : Number(createTimerMinutes || 0) || null,
          rubricSteps: createRubricSteps,
          autoGrade: createType === "QUIZ",
          moduleId: createModuleId || null,
          lessonId: createLessonId || null,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; assignment?: { id: string } }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.createAssignment"));
        return;
      }

      const createdAssignmentId = result.assignment?.id ?? "";
      if (isQuestionAssignment(createType) && createdAssignmentId && createDraftQuestions.length > 0) {
        for (const question of createDraftQuestions) {
          const questionResponse = await fetch("/api/assignments/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: createdAssignmentId,
              questionType: question.questionType,
              prompt: question.prompt,
              options: question.options,
              correctOptionIndexes: question.correctOptionIndexes,
              shortAnswerKey: question.shortAnswerKey ?? null,
              points: question.points,
            }),
          });
          if (!questionResponse.ok) {
            const questionRaw = await questionResponse.text();
            const questionResult = questionRaw ? (JSON.parse(questionRaw) as { error?: string }) : {};
            setError(questionResult.error ?? t("error.assignmentQuestionSavePartial"));
            break;
          }
        }
      }

      setCreateTitle("");
      setCreateDescription("");
      setCreateStartAt("");
      setCreateEndAt("");
      setCreateStartTime("");
      setCreateEndTime("");
      setCreateMaxPoints("100");
      setCreateType("HOMEWORK");
      setCreateAttempts("1");
      setCreateAllowLateSubmissions(true);
      setCreateAttemptScoringStrategy("LATEST");
      setCreateTimerMinutes("");
      setCreateRubric("");
      setCreateRubricFileName("");
      setCreateModuleId("");
      setCreateLessonId("");
      setCreateAllowedText(true);
      setCreateAllowedFile(true);
      setCreateDraftQuestions([]);
      setCreateQuestionPrompt("");
      setCreateQuestionOptionA("");
      setCreateQuestionOptionB("");
      setCreateQuestionOptionC("");
      setCreateQuestionOptionD("");
      setCreateQuestionType("MCQ");
      setCreateQuestionCorrectIndexes([0]);
      setCreateQuestionShortAnswerKey("");
      setCreateQuestionPoints("1");
      setShowCreateModal(false);
      await load();
    } catch {
      setError(t("error.createAssignment"));
    } finally {
      setCreatePending(false);
    }
  };

  const onUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId) return;
    setEditPending(true);
    setError("");
    try {
      const editRubricSteps = editRubric.split("\n").map((item) => item.trim()).filter(Boolean);
      const hasEditContent = editDescription.trim().length > 0 || editRubricSteps.length > 0;
      if ((editType === "QUIZ" || editType === "EXAM") && !hasEditContent) {
        setError(t("validation.assignmentNeedsContent"));
        return;
      }

      const editStartIso =
        editType === "HOMEWORK"
          ? toDateTimeIso(editStartAt, editStartTime)
          : toBoundaryIso(editStartAt, "start");
      const editEndIso =
        editType === "HOMEWORK"
          ? toDateTimeIso(editEndAt, editEndTime)
          : toBoundaryIso(editEndAt, "end");

      if (!editStartIso || !editEndIso) {
        setError(
          editType === "HOMEWORK"
            ? t("validation.homeworkDatesRequired")
            : t("validation.assignmentDatesRequired")
        );
        return;
      }
      if (new Date(editEndIso).getTime() <= new Date(editStartIso).getTime()) {
        setError(editType === "HOMEWORK" ? t("validation.homeworkEndAfterStart") : t("validation.endDateAfterStart"));
        return;
      }

      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: editId,
          title: editTitle,
          description: editDescription,
          startAt: editStartIso,
          endAt: editEndIso,
          maxPoints: editMaxPoints,
          assignmentType: editType,
          allowedSubmissionTypes: buildAllowedTypes(editType, editAllowedText, editAllowedFile),
          maxAttempts: Number(editAttempts),
          allowLateSubmissions: editAllowLateSubmissions,
          attemptScoringStrategy: editAttemptScoringStrategy,
          timerMinutes: editType === "HOMEWORK" ? null : Number(editTimerMinutes || 0) || null,
          rubricSteps: editRubricSteps,
          autoGrade: editType === "QUIZ",
          moduleId: editModuleId || null,
          lessonId: editLessonId || null,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateAssignment"));
        return;
      }
      setEditId("");
      setEditRubricFileName("");
      await load();
    } catch {
      setError(t("error.updateAssignment"));
    } finally {
      setEditPending(false);
    }
  };

  const onDelete = async (assignmentId: string) => {
    setDeletePendingId(assignmentId);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.deleteAssignment"));
        return;
      }
      await load();
    } catch {
      setError(t("error.deleteAssignment"));
    } finally {
      setDeletePendingId("");
    }
  };

  const onInvalidateAttempt = async (submissionId: string) => {
    setInvalidatePendingId(submissionId);
    setError("");
    try {
      const response = await fetch("/api/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action: "INVALIDATE_ATTEMPT",
          reason: t("assignment.invalidatedReason"),
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.invalidateAttempt"));
        return;
      }
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
      await load();
    } catch {
      setError(t("error.invalidateAttempt"));
    } finally {
      setInvalidatePendingId("");
    }
  };

  const onCreateQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAssignment || !isQuestionAssignment(selectedAssignment.config.assignmentType)) return;
    setCreateQuestionPending(true);
    setError("");
    try {
      const prompt = newQuestionPrompt.trim();
      if (selectedAssignment.config.assignmentType === "QUIZ" && newQuestionType !== "MCQ") {
        setError(t("validation.quizMcqOnly"));
        return;
      }
      const options = [newQuestionOptionA, newQuestionOptionB, newQuestionOptionC, newQuestionOptionD]
        .map((item) => item.trim())
        .filter(Boolean);
      const correctOptionIndexes = Array.from(
        new Set(newQuestionCorrectIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length))
      ).sort((a, b) => a - b);
      const shortAnswerKey = newQuestionShortAnswerKey.trim() || null;
      const points = Number(newQuestionPoints);
      if (!prompt) {
        setError(t("validation.questionPromptRequired"));
        return;
      }
      if (newQuestionType === "MCQ" && options.length < 2) {
        setError(t("validation.mcqMinOptions"));
        return;
      }
      if (newQuestionType === "MCQ" && !correctOptionIndexes.length) {
        setError(t("validation.correctOptionRequired"));
        return;
      }
      if (!Number.isFinite(points) || points <= 0) {
        setError(t("validation.questionPointsPositive"));
        return;
      }
      const response = await fetch("/api/assignments/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          questionType: newQuestionType,
          prompt,
          options: newQuestionType === "MCQ" ? options : [],
          correctOptionIndexes: newQuestionType === "MCQ" ? correctOptionIndexes : [],
          shortAnswerKey: newQuestionType === "SHORT_ANSWER" ? shortAnswerKey : null,
          points,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.createQuizQuestion"));
        return;
      }
      setNewQuestionPrompt("");
      setNewQuestionOptionA("");
      setNewQuestionOptionB("");
      setNewQuestionOptionC("");
      setNewQuestionOptionD("");
      setNewQuestionType("MCQ");
      setNewQuestionCorrectIndexes([0]);
      setNewQuestionShortAnswerKey("");
      setNewQuestionPoints("1");
      await loadQuizQuestions(selectedAssignment.id);
    } catch {
      setError(t("error.createQuizQuestion"));
    } finally {
      setCreateQuestionPending(false);
    }
  };

  const onDeleteQuestion = async (questionId: string) => {
    setDeleteQuestionPendingId(questionId);
    setError("");
    try {
      const response = await fetch("/api/assignments/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.deleteQuizQuestion"));
        return;
      }
      if (selectedAssignmentId) {
        await loadQuizQuestions(selectedAssignmentId);
      }
    } catch {
      setError(t("error.deleteQuizQuestion"));
    } finally {
      setDeleteQuestionPendingId("");
    }
  };

  const onStudentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAssignment) return;

    setStudentPending(true);
    setError("");
    try {
      const isQuestionBased = isQuestionAssignment(selectedAssignment.config.assignmentType);
      if (isQuestionBased) {
        if (!quizQuestions.length) {
          setError(t("validation.noQuestionsConfigured"));
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
          setError(t("validation.answerAllQuestions"));
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
          setError(uploadResult.error ?? t("error.uploadSubmissionFile"));
          return;
        }
        fileUrl = uploadResult.file.url;
        fileName = uploadResult.file.fileName;
        mimeType = uploadResult.file.mimeType;
      }

      const resolvedQuizStartedAt =
        selectedAssignment.config.timerMinutes && !studentQuizStartedAt ? new Date().toISOString() : studentQuizStartedAt;
      if (selectedAssignment.config.timerMinutes && !studentQuizStartedAt) {
        setStudentQuizStartedAt(resolvedQuizStartedAt);
        if (typeof window !== "undefined" && studentTimerKey) {
          window.localStorage.setItem(studentTimerKey, resolvedQuizStartedAt as string);
        }
      }

      const response = await fetch("/api/assignments/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          textResponse: studentTextResponse,
          fileUrl,
          fileName,
          mimeType,
          quizStartedAt: selectedAssignment.config.timerMinutes ? resolvedQuizStartedAt : null,
          quizAnswers:
            isQuestionBased
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
        setError(result.error ?? t("error.submitAssignment"));
        return;
      }

      setStudentTextResponse("");
      setStudentFile(null);
      setStudentQuizAnswers({});
      setStudentShortAnswers({});
      if (typeof window !== "undefined" && studentTimerKey) {
        window.localStorage.removeItem(studentTimerKey);
      }
      setStudentQuizStartedAt(null);
      await loadSubmissions(selectedAssignment.id);
    } catch {
      setError(t("error.submitAssignment"));
    } finally {
      setStudentPending(false);
    }
  };

  const onGrade = async (submissionId: string, publish: boolean) => {
    setGradePendingId(submissionId);
    setError("");
    try {
      const maxPoints = selectedAssignment?.maxPoints ?? null;
      const rawScoreInput = gradeRawScoreBySubmission[submissionId];
      if (rawScoreInput !== undefined && rawScoreInput !== "") {
        const parsed = Number(rawScoreInput);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setError(t("validation.rawScoreNonNegative"));
          return;
        }
        if (maxPoints !== null && parsed > maxPoints) {
          setError(t("validation.rawScoreExceedsMax", { maxPoints }));
          return;
        }
      }

      const response = await fetch("/api/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          rawScore: rawScoreInput ?? undefined,
          feedback: gradeFeedbackBySubmission[submissionId] ?? undefined,
          publish,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.gradeSubmission"));
        return;
      }
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
    } catch {
      setError(t("error.gradeSubmission"));
    } finally {
      setGradePendingId("");
    }
  };

  const onRequestGradeEdit = async (submission: SubmissionItem) => {
    if (!selectedAssignment || !isTeacher) return;
    const proposedPointsValue = Number(requestEditProposedPoints);
    if (!Number.isFinite(proposedPointsValue) || proposedPointsValue < 0) {
      setError(t("validation.proposedPointsNonNegative"));
      return;
    }
    setRequestEditPendingId(submission.id);
    setError("");
    try {
      const response = await fetch("/api/teacher/grade-edit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          studentId: submission.studentId,
          reason: requestEditReason,
          proposedPoints: proposedPointsValue,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.gradeEditRequest"));
        return;
      }
      setRequestEditForSubmissionId("");
      setRequestEditReason("");
      setRequestEditProposedPoints("");
    } catch {
      setError(t("error.gradeEditRequest"));
    } finally {
      setRequestEditPendingId("");
    }
  };

  const onReviewGradeEditRequest = async (requestId: string, decision: "APPROVE" | "REJECT") => {
    setReviewPendingId(requestId);
    setError("");
    try {
      const approvedPointsRaw = reviewApprovedPointsByRequest[requestId];
      const response = await fetch(`/api/admin/grade-edit-requests/${encodeURIComponent(requestId)}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewNote: reviewNoteByRequest[requestId] ?? undefined,
          approvedPoints: approvedPointsRaw !== undefined && approvedPointsRaw !== "" ? Number(approvedPointsRaw) : undefined,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.gradeEditDecision"));
        return;
      }
      await loadGradeEditRequests();
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
    } catch {
      setError(t("error.gradeEditDecision"));
    } finally {
      setReviewPendingId("");
    }
  };

  const quizRemainingSeconds = useMemo(() => {
    const timerMinutes = selectedAssignment?.config.timerMinutes ?? null;
    if (
      !isStudent ||
      !timerMinutes ||
      !studentQuizStartedAt
    ) {
      return null;
    }
    const startedAt = new Date(studentQuizStartedAt).getTime();
    if (Number.isNaN(startedAt)) return null;
    const limitMs = timerMinutes * 60 * 1000;
    const remainingMs = Math.max(0, startedAt + limitMs - nowTick);
    return Math.floor(remainingMs / 1000);
  }, [isStudent, nowTick, selectedAssignment?.config.timerMinutes, studentQuizStartedAt]);

  const selectedAssignmentStartAt = selectedAssignment?.startAt ?? selectedAssignment?.config.startAt ?? null;
  const selectedAssignmentEndAt = selectedAssignment?.endAt ?? selectedAssignment?.dueAt ?? null;
  const selectedCourseEndAt = selectedAssignment?.course.endDate ?? null;
  const selectedStartAtMs = selectedAssignmentStartAt ? new Date(selectedAssignmentStartAt).getTime() : NaN;
  const selectedEndAtMs = selectedAssignmentEndAt ? new Date(selectedAssignmentEndAt).getTime() : NaN;
  const isCourseExpired =
    isStudent && selectedCourseEndAt
      ? isCourseExpiredForStudent(selectedCourseEndAt, nowTick)
      : false;
  const isSubmissionBeforeWindow =
    isStudent && selectedAssignmentStartAt ? Number.isFinite(selectedStartAtMs) && nowTick < selectedStartAtMs : false;
  const isSubmissionAfterWindow =
    isStudent && selectedAssignmentEndAt ? Number.isFinite(selectedEndAtMs) && nowTick > selectedEndAtMs : false;
  const isSubmissionBlockedByWindow = isSubmissionBeforeWindow || (isSubmissionAfterWindow && !selectedAssignment?.config.allowLateSubmissions);

  const studentCanSubmit = useMemo(() => {
    if (!isStudent || !selectedAssignment) return false;
    if (isCourseExpired) return false;
    if (isSubmissionBlockedByWindow) return false;
    return studentAttemptCount < selectedAssignment.config.maxAttempts;
  }, [isCourseExpired, isStudent, isSubmissionBlockedByWindow, selectedAssignment, studentAttemptCount]);
  const hasStartedTimedAttempt = !!studentQuizStartedAt;

  return (
    <section className="grid min-w-0 gap-4">
      {isSuperAdmin ? (
        <section className="brand-card min-w-0 overflow-hidden p-5">
          <p className="brand-section-title">{t("gradeEdit.pendingTitle")}</p>
          {gradeEditRequestsLoading ? (
            <div className="mt-3">
              <LoadingIndicator label={t("loading.requests")} lines={2} />
            </div>
          ) : null}
          {!gradeEditRequestsLoading && gradeEditRequests.length === 0 ? (
            <p className="brand-muted mt-3 text-sm">{t("gradeEdit.none")}</p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {gradeEditRequests.map((request) => (
              <article key={request.id} className="rounded-md border border-[#dbe9fb] p-3">
                <p className="text-sm font-semibold text-[#0d3f80]">
                  {translateText(request.assignment?.title) || t("assignment.label")} - {request.student?.name || request.student?.email || t("student.label")}
                </p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  {t("gradeEdit.reason")}: {translateText(request.reason)}
                </p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  {t("gradeEdit.proposed")}: {request.proposedPoints ?? t("gradeEdit.na")} | {t("gradeEdit.requestedBy")}:{" "}
                  {request.requestedBy?.name || request.requestedBy?.email || t("teacher.label")}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("gradeEdit.approvedPoints")}</span>
                    <input
                      className="brand-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t("gradeEdit.approvedPointsPlaceholder")}
                      aria-label={t("gradeEdit.approvedPointsAria", { title: request.assignment?.title ?? t("assignment.labelLower") })}
                      value={reviewApprovedPointsByRequest[request.id] ?? ""}
                      onChange={(event) => {
                        const value = (event.target as HTMLInputElement | null)?.value ?? "";
                        setReviewApprovedPointsByRequest((prev) => ({ ...prev, [request.id]: value }));
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("gradeEdit.reviewNote")}</span>
                    <input
                      className="brand-input"
                      placeholder={t("gradeEdit.reviewNotePlaceholder")}
                      aria-label={t("gradeEdit.reviewNoteAria", { title: request.assignment?.title ?? t("assignment.labelLower") })}
                      value={reviewNoteByRequest[request.id] ?? ""}
                      onChange={(event) => {
                        const value = (event.target as HTMLInputElement | null)?.value ?? "";
                        setReviewNoteByRequest((prev) => ({ ...prev, [request.id]: value }));
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                    disabled={reviewPendingId === request.id}
                    onClick={() => void onReviewGradeEditRequest(request.id, "APPROVE")}
                  >
                    {reviewPendingId === request.id ? t("status.processing") : t("action.approve")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                    disabled={reviewPendingId === request.id}
                    onClick={() => void onReviewGradeEditRequest(request.id, "REJECT")}
                  >
                    {t("action.reject")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="brand-card min-w-0 overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="brand-section-title">{t("assignment.listTitle")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1.5">
              <span className="brand-label">{t("filter.label")}</span>
              <select
                className="brand-input min-w-[200px]"
                value={activeMenu}
                onChange={(event) => setActiveMenu(event.currentTarget.value as "ALL" | "SUBMITTED" | "DUE")}
              >
                <option value="ALL">{t("filter.allAssignments")}</option>
                <option value="SUBMITTED">{t("filter.submittedOnly")}</option>
                <option value="DUE">{t("filter.dueAssignments")}</option>
              </select>
            </label>
            {canManage ? (
              <button type="button" className="btn-brand-primary px-3 py-1.5 text-xs font-semibold" onClick={() => setShowCreateModal(true)}>
                {t("action.createAssignment")}
              </button>
            ) : null}
          </div>
        </div>
        {loading ? (
          <div className="mt-3">
            <LoadingIndicator label={t("loading.assignments")} lines={2} />
          </div>
        ) : null}

        {!loading && filteredAssignments.length ? (
          <div className="mt-3 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm lg:min-w-full">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">{t("table.course")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.title")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.type")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.linkedTo")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.attempts")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.window")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.maxPoints")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.submissions")}</th>
                <th className="px-3 py-2 font-semibold">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#e7f0fc] text-[#0d3f80] transition ${selectedAssignmentId === item.id ? "bg-[#f4f9ff]" : "hover:bg-[#f8fbff]"} ${canManage || isStudent || isAdminReadOnly ? "cursor-pointer" : ""}`}
                  onClick={() => router.push(`/dashboard/assessment/${item.id}`)}
                >
                  <td className="px-3 py-2">{item.course.code} - {translateText(item.course.title)}</td>
                  <td className="px-3 py-2">
                    <p>{translateText(item.title)}</p>
                    {item.description ? <p className="mt-1 text-xs text-[#3768ac]">{translateText(item.description)}</p> : null}
                  </td>
                  <td className="px-3 py-2">{t(`assignment.type.${item.config.assignmentType.toLowerCase()}`)}</td>
                  <td className="px-3 py-2">
                    {item.config.moduleId || item.config.lessonId
                      ? t("assignment.linkedTo", {
                          module: item.config.moduleId ? t("assignment.linked") : t("assignment.none"),
                          lesson: item.config.lessonId ? t("assignment.linked") : t("assignment.none"),
                        })
                      : t("assignment.courseOnly")}
                  </td>
                  <td className="px-3 py-2">{item.config.maxAttempts}</td>
                  <td className="px-3 py-2">
                    {formatAssignmentWindow(item.config.assignmentType, item.startAt, item.endAt ?? item.dueAt ?? null)}
                  </td>
                  <td className="px-3 py-2">{item.maxPoints}</td>
                  <td className="px-3 py-2">{item.submissionCount ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/assessment/${item.id}`}
                        className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t("action.manage")}
                      </Link>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditId(item.id);
                            }}
                          >
                            {t("action.edit")}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                            disabled={deletePendingId === item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmDeleteAssignmentId(item.id);
                            }}
                          >
                            {deletePendingId === item.id ? t("status.deleting") : t("action.delete")}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : null}

        {!loading && !filteredAssignments.length ? (
          <p className="brand-muted mt-3 text-sm">
            {activeMenu === "SUBMITTED"
              ? t("assignment.empty.submitted")
              : activeMenu === "DUE"
                ? t("assignment.empty.due")
                : t("assignment.empty.all")}
          </p>
        ) : null}
      </section>

      {selectedAssignment && showInlineDetails ? (
        <section className="brand-card min-w-0 overflow-hidden p-5">
          <p className="brand-section-title">
            {t("assignment.workspace")}: {translateText(selectedAssignment.title)}
          </p>
          <p className="brand-muted mt-2 break-words text-sm">
            {t("assignment.submissionTypes")}: {selectedAssignment.config.allowedSubmissionTypes.length
              ? selectedAssignment.config.allowedSubmissionTypes
                  .map((type) => (type === "TEXT" ? t("assignment.submissionTypeText") : t("assignment.submissionTypeFile")))
                  .join(", ")
              : selectedAssignment.config.assignmentType === "QUIZ"
                ? t("assignment.quizQuestions")
                : t("common.na")}{" "}
            | {t("assignment.rubricSteps")}: {selectedAssignment.config.rubricSteps.length}
            {` | ${t("assignment.window")}: ${formatAssignmentWindow(selectedAssignment.config.assignmentType, selectedAssignmentStartAt, selectedAssignmentEndAt)}`}
            {selectedAssignment.config.timerMinutes
              ? ` | ${t("assignment.timeFrame")}: ${selectedAssignment.config.timerMinutes} ${t("assignment.minutes")}`
              : ""}
          </p>

          {isStudent ? (
            <form className="mt-3 grid gap-3" onSubmit={onStudentSubmit} onFocusCapture={startStudentQuizTimerIfNeeded}>
              {submissionsLoading ? (
                <div className="mt-1">
                  <LoadingIndicator label={t("loading.submissionStatus")} lines={1} />
                </div>
              ) : null}
              {!submissionsLoading && !studentCanSubmit ? (
                <p className="rounded-md border border-[#dbe9fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#1f518f]">
                  {isCourseExpired
                    ? t("assignment.courseExpired")
                    : isSubmissionBeforeWindow
                    ? t("assignment.submissionOpens", { date: formatDate(selectedAssignmentStartAt) })
                    : isSubmissionAfterWindow && !selectedAssignment.config.allowLateSubmissions
                      ? t("assignment.submissionClosed")
                      : t("assignment.maxAttemptsReached", {
                          type: t(`assignment.type.${selectedAssignment.config.assignmentType.toLowerCase()}`),
                        })}
                </p>
              ) : null}
              {!submissionsLoading && studentCanSubmit && isSubmissionAfterWindow && selectedAssignment.config.allowLateSubmissions ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t("assignment.lateSubmissionWarning", { date: formatDate(selectedAssignmentEndAt) })}
                </p>
              ) : null}
              {selectedAssignment.config.timerMinutes ? (
                <p className="text-sm font-semibold text-[#1f518f]">
                  {t("assignment.timeRemaining")}:{" "}
                  {quizRemainingSeconds !== null
                    ? `${Math.floor(quizRemainingSeconds / 60)}${t("time.minuteShort")} ${quizRemainingSeconds % 60}${t("time.secondShort")}`
                    : `${selectedAssignment.config.timerMinutes}${t("time.minuteShort")} 0${t("time.secondShort")}`}
                  {!hasStartedTimedAttempt ? ` (${t("assignment.startsWhenBegin")})` : null}
                </p>
              ) : null}
              {selectedAssignment.config.timerMinutes && !hasStartedTimedAttempt && studentCanSubmit ? (
                <button
                  type="button"
                  className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold"
                  onClick={startStudentQuizTimerIfNeeded}
                >
                  {t("assignment.startAttempt")}
                </button>
              ) : null}
              {isQuestionAssignment(selectedAssignment.config.assignmentType) ? (
                <>
                  {quizQuestionsLoading ? (
                    <div className="mt-2">
                      <LoadingIndicator label={t("loading.questions")} lines={2} />
                    </div>
                  ) : null}
                  {quizQuestions.map((question, index) => (
                    <div key={question.id} className="rounded-md border border-[#dbe9fb] p-3">
                      <p className="text-sm font-semibold text-[#0d3f80]">
                        {t("assignment.questionPrefix", { index: index + 1 })} {translateText(question.prompt)} ({question.points} {t("assignment.points")})
                      </p>
                      {(question.questionType ?? "MCQ") === "SHORT_ANSWER" ? (
                        <label className="mt-2 grid gap-1.5">
                          <span className="brand-label">{t("assignment.shortAnswer")}</span>
                          <textarea
                            className="brand-input min-h-[90px]"
                            placeholder={t("assignment.typeAnswer")}
                            value={studentShortAnswers[question.id] ?? ""}
                            onChange={(event) => {
                              startStudentQuizTimerIfNeeded();
                              setStudentShortAnswers((prev) => ({ ...prev, [question.id]: event.currentTarget.value }));
                            }}
                          />
                        </label>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {question.options.map((option, optionIndex) => (
                            <label key={`${question.id}_${optionIndex}`} className="inline-flex items-center gap-2 text-sm text-[#234f8f]">
                              <input
                                type="checkbox"
                                checked={studentQuizAnswers[question.id]?.includes(optionIndex) ?? false}
                                onChange={() => {
                                  startStudentQuizTimerIfNeeded();
                                  setStudentQuizAnswers((prev) => ({
                                    ...prev,
                                    [question.id]: toggleOptionSelection(prev[question.id] ?? [], optionIndex),
                                  }));
                                }}
                              />
                              <span>{translateText(option)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : null}
              {!isQuestionAssignment(selectedAssignment.config.assignmentType) && selectedAssignment.config.allowedSubmissionTypes.includes("TEXT") ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.textResponse")}</span>
                  <textarea
                    className="brand-input min-h-[100px]"
                    placeholder={t("assignment.textResponsePlaceholder")}
                    aria-label={t("assignment.textResponse")}
                    value={studentTextResponse}
                    onChange={(event) => {
                      startStudentQuizTimerIfNeeded();
                      setStudentTextResponse(event.currentTarget.value);
                    }}
                  />
                </label>
              ) : null}
              {!isQuestionAssignment(selectedAssignment.config.assignmentType) && selectedAssignment.config.allowedSubmissionTypes.includes("FILE") ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.uploadFile")}</span>
                  <input
                    type="file"
                    className="brand-input"
                    aria-label={t("assignment.uploadFile")}
                    onChange={(event) => {
                      startStudentQuizTimerIfNeeded();
                      setStudentFile(event.currentTarget.files?.[0] ?? null);
                    }}
                  />
                </label>
              ) : null}
              {studentCanSubmit ? (
                <button
                  className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold"
                  disabled={studentPending || submissionsLoading || (!!selectedAssignment.config.timerMinutes && quizRemainingSeconds === 0)}
                >
                  {studentPending ? t("status.submitting") : t("assignment.submitAttempt", { count: studentCurrentAttemptNumber })}
                </button>
              ) : null}
            </form>
          ) : null}

          {canManage && isQuestionAssignment(selectedAssignment.config.assignmentType) ? (
            <div id="assignment-questions" className="mt-4 rounded-md border border-[#dbe9fb] p-3">
              <p className="brand-label">
                {selectedAssignment.config.assignmentType === "QUIZ"
                  ? t("assignment.quizQuestionsLabel")
                  : t("assignment.examQuestionsLabel")}
              </p>
              <form className="mt-2 grid gap-2" onSubmit={onCreateQuestion}>
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.questionPrompt")}</span>
                  <input
                    className="brand-input"
                    placeholder={t("assignment.questionPromptPlaceholder")}
                    aria-label={t("assignment.questionPromptAria")}
                    value={newQuestionPrompt}
                    onChange={(event) => setNewQuestionPrompt(event.currentTarget.value)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.questionType")}</span>
                  <select
                    className="brand-input"
                    value={newQuestionType}
                    onChange={(event) => setNewQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                  >
                    <option value="MCQ">{t("assignment.multipleChoice")}</option>
                    {selectedAssignment.config.assignmentType === "EXAM" ? <option value="SHORT_ANSWER">{t("assignment.shortAnswer")}</option> : null}
                  </select>
                </label>
                {newQuestionType === "MCQ" ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.option", { label: "A" })}</span>
                        <input className="brand-input" placeholder={t("assignment.option", { label: "A" })} aria-label={t("assignment.option", { label: "A" })} value={newQuestionOptionA} onChange={(event) => setNewQuestionOptionA(event.currentTarget.value)} required />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.option", { label: "B" })}</span>
                        <input className="brand-input" placeholder={t("assignment.option", { label: "B" })} aria-label={t("assignment.option", { label: "B" })} value={newQuestionOptionB} onChange={(event) => setNewQuestionOptionB(event.currentTarget.value)} required />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.option", { label: "C" })}</span>
                        <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "C" })} aria-label={t("assignment.option", { label: "C" })} value={newQuestionOptionC} onChange={(event) => setNewQuestionOptionC(event.currentTarget.value)} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.option", { label: "D" })}</span>
                        <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "D" })} aria-label={t("assignment.option", { label: "D" })} value={newQuestionOptionD} onChange={(event) => setNewQuestionOptionD(event.currentTarget.value)} />
                      </label>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.correctOptions")}</span>
                        <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                          {[
                            { label: t("assignment.option", { label: "A" }), value: newQuestionOptionA, index: 0 },
                            { label: t("assignment.option", { label: "B" }), value: newQuestionOptionB, index: 1 },
                            { label: t("assignment.option", { label: "C" }), value: newQuestionOptionC, index: 2 },
                            { label: t("assignment.option", { label: "D" }), value: newQuestionOptionD, index: 3 },
                          ].map((option) => (
                            <label key={`new_correct_${option.index}`} className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={newQuestionCorrectIndexes.includes(option.index)}
                                disabled={!option.value.trim()}
                                onChange={() =>
                                  setNewQuestionCorrectIndexes((prev) => toggleOptionSelection(prev, option.index))
                                }
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.points")}</span>
                        <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.questionPointsAria")} value={newQuestionPoints} onChange={(event) => setNewQuestionPoints(event.currentTarget.value)} />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("assignment.referenceAnswerOptional")}</span>
                      <input
                        className="brand-input"
                        placeholder={t("assignment.referenceAnswerPlaceholder")}
                        value={newQuestionShortAnswerKey}
                        onChange={(event) => setNewQuestionShortAnswerKey(event.currentTarget.value)}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("assignment.points")}</span>
                      <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.questionPointsAria")} value={newQuestionPoints} onChange={(event) => setNewQuestionPoints(event.currentTarget.value)} />
                    </label>
                  </div>
                )}
                <button className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" disabled={createQuestionPending}>
                  {createQuestionPending ? t("status.adding") : t("action.addQuestion")}
                </button>
              </form>

              <div className="mt-3 grid gap-2">
                {quizQuestionsLoading ? <LoadingIndicator label={t("loading.questions")} lines={2} /> : null}
                {!quizQuestionsLoading && quizQuestions.length === 0 ? <p className="brand-muted text-sm">{t("assignment.noQuizQuestions")}</p> : null}
                {quizQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-md border border-[#e7f0fc] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0d3f80]">
                        {t("assignment.questionPrefix", { index: index + 1 })} {translateText(question.prompt)}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          disabled={editQuestionPendingId === question.id}
                          onClick={() => startEditQuestion(question)}
                        >
                          {t("action.edit")}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                          disabled={deleteQuestionPendingId === question.id || editQuestionId === question.id}
                          onClick={() => void onDeleteQuestion(question.id)}
                        >
                          {deleteQuestionPendingId === question.id ? t("status.deleting") : t("action.delete")}
                        </button>
                      </div>
                    </div>
                    {editQuestionId === question.id ? (
                      <form className="mt-2 grid gap-2" onSubmit={onUpdateQuestion}>
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("assignment.questionPrompt")}</span>
                          <input
                            className="brand-input"
                            placeholder={t("assignment.questionPromptPlaceholder")}
                            aria-label={t("assignment.questionPromptAria")}
                            value={editQuestionPrompt}
                            onChange={(event) => setEditQuestionPrompt(event.currentTarget.value)}
                            required
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("assignment.questionType")}</span>
                          <select
                            className="brand-input"
                            value={editQuestionType}
                            onChange={(event) => setEditQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                          >
                            <option value="MCQ">{t("assignment.multipleChoice")}</option>
                            {selectedAssignment?.config.assignmentType === "EXAM" ? <option value="SHORT_ANSWER">{t("assignment.shortAnswer")}</option> : null}
                          </select>
                        </label>
                        {editQuestionType === "MCQ" ? (
                          <>
                            <div className="grid gap-2 md:grid-cols-2">
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.option", { label: "A" })}</span>
                                <input className="brand-input" placeholder={t("assignment.option", { label: "A" })} aria-label={t("assignment.option", { label: "A" })} value={editQuestionOptionA} onChange={(event) => setEditQuestionOptionA(event.currentTarget.value)} required />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.option", { label: "B" })}</span>
                                <input className="brand-input" placeholder={t("assignment.option", { label: "B" })} aria-label={t("assignment.option", { label: "B" })} value={editQuestionOptionB} onChange={(event) => setEditQuestionOptionB(event.currentTarget.value)} required />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.option", { label: "C" })}</span>
                                <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "C" })} aria-label={t("assignment.option", { label: "C" })} value={editQuestionOptionC} onChange={(event) => setEditQuestionOptionC(event.currentTarget.value)} />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.option", { label: "D" })}</span>
                                <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "D" })} aria-label={t("assignment.option", { label: "D" })} value={editQuestionOptionD} onChange={(event) => setEditQuestionOptionD(event.currentTarget.value)} />
                              </label>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.correctOptions")}</span>
                                <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                                  {[
                                    { label: t("assignment.option", { label: "A" }), value: editQuestionOptionA, index: 0 },
                                    { label: t("assignment.option", { label: "B" }), value: editQuestionOptionB, index: 1 },
                                    { label: t("assignment.option", { label: "C" }), value: editQuestionOptionC, index: 2 },
                                    { label: t("assignment.option", { label: "D" }), value: editQuestionOptionD, index: 3 },
                                  ].map((option) => (
                                    <label key={`edit_correct_${option.index}`} className="inline-flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={editQuestionCorrectIndexes.includes(option.index)}
                                        disabled={!option.value.trim()}
                                        onChange={() =>
                                          setEditQuestionCorrectIndexes((prev) => toggleOptionSelection(prev, option.index))
                                        }
                                      />
                                      <span>{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.points")}</span>
                                <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.questionPointsAria")} value={editQuestionPoints} onChange={(event) => setEditQuestionPoints(event.currentTarget.value)} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1.5">
                              <span className="brand-label">{t("assignment.referenceAnswerOptional")}</span>
                              <input
                                className="brand-input"
                                placeholder={t("assignment.referenceAnswerPlaceholder")}
                                value={editQuestionShortAnswerKey}
                                onChange={(event) => setEditQuestionShortAnswerKey(event.currentTarget.value)}
                              />
                            </label>
                            <label className="grid gap-1.5">
                              <span className="brand-label">{t("assignment.points")}</span>
                              <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.questionPointsAria")} value={editQuestionPoints} onChange={(event) => setEditQuestionPoints(event.currentTarget.value)} />
                            </label>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                            onClick={resetEditQuestion}
                          >
                            {t("action.cancel")}
                          </button>
                          <button
                            type="submit"
                            className="btn-brand-secondary px-3 py-1.5 text-xs font-semibold"
                            disabled={editQuestionPendingId === question.id}
                          >
                            {editQuestionPendingId === question.id ? t("status.saving") : t("action.saveChanges")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="mt-1 text-xs text-[#3768ac]">{t("assignment.points")}: {question.points}</p>
                        <p className="mt-1 text-xs text-[#3768ac]">
                          {t("assignment.typeLabel")}: {(question.questionType ?? "MCQ") === "SHORT_ANSWER" ? t("assignment.shortAnswer") : t("assignment.multipleChoiceShort")}
                        </p>
                        {(question.questionType ?? "MCQ") === "MCQ" && question.correctOptionIndexes?.length ? (
                          <p className="mt-1 text-xs text-[#3768ac]">
                            {t("assignment.correct")}: {formatOptionIndexes(question.correctOptionIndexes, (label) => t("assignment.optionLabel", { label }))}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(canManage || isStudent || isAdminReadOnly) ? (
            <div className="mt-4 space-y-2">
              <p className="brand-label">{t("assignment.submissions")}</p>
              {submissionsLoading ? <LoadingIndicator label={t("loading.submissions")} lines={2} /> : null}
              {!submissionsLoading && submissions.length === 0 ? <p className="brand-muted text-sm">{t("assignment.noSubmissions")}</p> : null}
              {isAdminReadOnly && submissions.length ? (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                        <th className="px-3 py-2 font-semibold">{t("table.course")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.teacher")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.student")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.attempt")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.score")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.letter")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.status")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.plagiarism")}</th>
                        <th className="px-3 py-2 font-semibold">{t("table.submitted")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                          <td className="px-3 py-2">
                            {selectedAssignment?.course.code} - {translateText(selectedAssignment?.course.title)}
                          </td>
                          <td className="px-3 py-2">
                            {selectedAssignment?.course.teacher?.name || selectedAssignment?.course.teacher?.email || t("course.unassigned")}
                          </td>
                          <td className="px-3 py-2">{submission.studentName || submission.studentEmail || t("student.label")}</td>
                          <td className="px-3 py-2">{submission.attemptNumber}</td>
                          <td className="px-3 py-2">{submission.finalScore ?? t("common.na")}</td>
                          <td className="px-3 py-2">{submission.letterGrade ?? t("common.na")}</td>
                          <td className="px-3 py-2">{statusLabel(submission.status)}</td>
                          <td className="px-3 py-2">
                            {submission.plagiarismStatus === "COMPLETED"
                              ? `${plagiarismBandLabel(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)`
                              : statusLabel(submission.plagiarismStatus)}
                          </td>
                          <td className="px-3 py-2">{formatDate(submission.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {!isAdminReadOnly ? submissions.map((submission) => (
                <div key={submission.id} className="rounded-md border border-[#dbe9fb] p-3">
                  <p className="text-xs font-semibold text-[#285f9f]">
                    {t("assignment.attemptLabel", { count: submission.attemptNumber })}
                    {submission.studentEmail
                      ? ` - ${submission.studentName || t("student.label")} (${submission.studentEmail})`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#3a689f]">
                    {t("assignment.submittedLabel")}: {formatDate(submission.submittedAt)} | {t("assignment.lateLabel")}:{" "}
                    {submission.isLate
                      ? `${formatMinutes(submission.lateByMinutes, {
                          day: t("time.dayShort"),
                          hour: t("time.hourShort"),
                          minute: t("time.minuteShort"),
                        })} (${submission.latePenaltyPct}%)`
                      : t("common.no")}
                  </p>
                  {submission.status === "ATTEMPT_CANCELLED" ? (
                    <p className="mt-1 text-xs font-semibold text-[#9b1c1c]">
                      {t("assignment.invalidatedAttempt")}
                    </p>
                  ) : null}
                  {submission.finalScore !== null ? (
                    <p className="mt-1 text-xs text-[#3a689f]">
                      {t("assignment.finalScore")}: {submission.finalScore}
                      {submission.letterGrade ? ` | ${t("assignment.letter")}: ${submission.letterGrade}` : ""}
                    </p>
                  ) : null}
                  {canManage ? (
                    <p className="mt-1 text-xs text-[#3a689f]">
                      {t("assignment.plagiarism")}: {formatEnumLabel(submission.plagiarismStatus ?? "PENDING")}
                      {submission.plagiarismStatus === "COMPLETED"
                        ? ` | ${plagiarismBandLabel(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)`
                        : ""}
                      {submission.plagiarismSummary ? ` | ${submission.plagiarismSummary}` : ""}
                    </p>
                  ) : null}
                  {submission.textResponse ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[#0d3f80]">{translateText(submission.textResponse)}</p>
                  ) : null}
                  {submission.fileUrl ? (
                    <a
                      href={`/api/assignments/uploads/${submission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-[#1f518f] underline"
                    >
                      {submission.fileName || t("assignment.openSubmittedFile")}
                    </a>
                  ) : null}

                  {canManage && submission.status !== "ATTEMPT_CANCELLED" && !isPublishedOrLockedState(submission.status) ? (
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.rawScore")}</span>
                      <input
                        className="brand-input"
                        type="number"
                        min="0"
                        max={selectedAssignment?.maxPoints ?? undefined}
                        step="0.01"
                        placeholder={t("assignment.rawScorePlaceholder")}
                        aria-label={t("assignment.rawScoreAria", { count: submission.attemptNumber })}
                        value={gradeRawScoreBySubmission[submission.id] ?? (submission.rawScore?.toString() ?? "")}
                        onChange={(event) => {
                          const rawValue = event.currentTarget.value;
                          const maxPoints = selectedAssignment?.maxPoints ?? null;
                          if (!rawValue.trim()) {
                            setGradeRawScoreBySubmission((prev) => ({ ...prev, [submission.id]: "" }));
                            return;
                          }
                          const nextNumber = Number(rawValue);
                          if (Number.isFinite(nextNumber) && maxPoints !== null && nextNumber > maxPoints) {
                            setGradeRawScoreBySubmission((prev) => ({ ...prev, [submission.id]: String(maxPoints) }));
                            return;
                          }
                          setGradeRawScoreBySubmission((prev) => ({ ...prev, [submission.id]: rawValue }));
                        }}
                      />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("assignment.feedback")}</span>
                        <textarea
                          className="brand-input min-h-[72px]"
                          placeholder={t("assignment.feedbackPlaceholder")}
                          aria-label={t("assignment.feedbackAria", { count: submission.attemptNumber })}
                          value={gradeFeedbackBySubmission[submission.id] ?? (submission.feedback ?? "")}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value;
                            setGradeFeedbackBySubmission((prev) => ({ ...prev, [submission.id]: nextValue }));
                          }}
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                          disabled={invalidatePendingId === submission.id}
                          onClick={() => setConfirmInvalidateSubmissionId(submission.id)}
                        >
                          {invalidatePendingId === submission.id ? t("status.updating") : t("assignment.invalidateAttempt")}
                        </button>
                        <button
                          type="button"
                          className="btn-brand-secondary px-3 py-1.5 text-xs font-semibold"
                          disabled={gradePendingId === submission.id}
                          onClick={() => void onGrade(submission.id, false)}
                        >
                          {t("assignment.saveGrade")}
                        </button>
                        <button
                          type="button"
                          className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                          disabled={gradePendingId === submission.id}
                          onClick={() => void onGrade(submission.id, true)}
                        >
                          {t("assignment.publishGrade")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {canManage && isPublishedOrLockedState(submission.status) ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-xs font-semibold text-[#285f9f]">
                        {t("assignment.publishedLocked")}
                      </p>
                      {isTeacher && submission.status === "GRADE_PUBLISHED" ? (
                        <>
                          <button
                            type="button"
                            className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold"
                            onClick={() =>
                              setRequestEditForSubmissionId((prev) => (prev === submission.id ? "" : submission.id))
                            }
                          >
                            {requestEditForSubmissionId === submission.id
                              ? t("assignment.cancelRequest")
                              : t("assignment.requestGradeEdit")}
                          </button>
                          {requestEditForSubmissionId === submission.id ? (
                            <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-3">
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.gradeEditReason")}</span>
                                <textarea
                                  className="brand-input min-h-[78px]"
                                  placeholder={t("assignment.gradeEditReasonPlaceholder")}
                                  aria-label={t("assignment.gradeEditReasonAria")}
                                  value={requestEditReason}
                                  onChange={(event) => setRequestEditReason(event.currentTarget.value)}
                                />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">{t("assignment.proposedPoints")}</span>
                                <input
                                  className="brand-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder={t("assignment.proposedPointsPlaceholder")}
                                  aria-label={t("assignment.proposedPointsAria")}
                                  value={requestEditProposedPoints}
                                  onChange={(event) => setRequestEditProposedPoints(event.currentTarget.value)}
                                  required
                                />
                              </label>
                              <button
                                type="button"
                                className="btn-brand-primary w-fit px-3 py-1.5 text-xs font-semibold"
                                disabled={requestEditPendingId === submission.id}
                                onClick={() => void onRequestGradeEdit(submission)}
                              >
                                {requestEditPendingId === submission.id
                                  ? t("assignment.submittingRequest")
                                  : t("assignment.submitRequest")}
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {isTeacher && submission.status !== "GRADE_PUBLISHED" ? (
                        <p className="text-xs text-[#3a689f]">{t("assignment.gradeEditInReview")}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {canManage && showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
        <section className="brand-card min-w-0 w-full max-w-5xl overflow-hidden p-5">
          <p className="brand-section-title">{t("assignment.createTitle")}</p>
          <form className="mt-3 grid gap-3" onSubmit={onCreate}>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.course")}</span>
              <select className="brand-input" aria-label={t("label.course")} value={createCourseId} onChange={(event) => setCreateCourseId(event.currentTarget.value)} required>
                <option value="">{t("assignment.selectCourse")}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.code} - {translateText(course.title)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.assignmentTitle")}</span>
              <input className="brand-input" placeholder={t("assignment.assignmentTitlePlaceholder")} aria-label={t("assignment.assignmentTitle")} value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.instructions")}</span>
              <textarea className="brand-input min-h-[84px]" placeholder={t("assignment.instructionsPlaceholder")} aria-label={t("assignment.instructions")} value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.rubricStepsLabel")}</span>
              <textarea className="brand-input min-h-[84px]" placeholder={t("assignment.rubricStepsPlaceholder")} aria-label={t("assignment.rubricStepsLabel")} value={createRubric} onChange={(event) => setCreateRubric(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.rubricFile")}</span>
              <input
                className="brand-input"
                type="file"
                accept=".txt,.csv"
                aria-label={t("assignment.uploadRubricAria")}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) {
                    setCreateRubricFileName("");
                    return;
                  }
                  setCreateRubricFileName(file.name);
                  void file.text().then((text) => {
                    setCreateRubric(normalizeRubricText(text));
                  });
                }}
              />
              {createRubricFileName ? (
                <span className="text-xs text-[#3a689f]">{t("assignment.rubricLoaded", { name: createRubricFileName })}</span>
              ) : (
                <span className="text-xs text-[#3a689f]">{t("assignment.rubricUploadHint")}</span>
              )}
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {createType !== "HOMEWORK" ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.timeFrameMinutes")}</span>
                  <input
                    className="brand-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("assignment.timeFramePlaceholder")}
                    aria-label={t("assignment.timeFramePlaceholder")}
                    value={createTimerMinutes}
                    onChange={(event) => setCreateTimerMinutes(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.attemptScoringStrategy")}</span>
              <select
                className="brand-input"
                aria-label={t("assignment.attemptScoringStrategy")}
                value={createAttemptScoringStrategy}
                onChange={(event) => setCreateAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
              >
                <option value="LATEST">{t("assignment.attemptRuleLatest")}</option>
                <option value="HIGHEST">{t("assignment.attemptRuleHighest")}</option>
              </select>
            </label>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={createAllowLateSubmissions}
                onChange={(event) => setCreateAllowLateSubmissions(event.currentTarget.checked)}
              />
              {t("assignment.allowLateSubmissions")}
            </label>
            <div className={`grid gap-3 ${createType === "QUIZ" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.assignmentType")}</span>
                <select className="brand-input" aria-label={t("assignment.assignmentType")} value={createType} onChange={(event) => setCreateType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                  <option value="HOMEWORK">{t("assignment.type.homework")}</option>
                  <option value="QUIZ">{t("assignment.type.quiz")}</option>
                  <option value="EXAM">{t("assignment.type.exam")}</option>
                </select>
              </label>
              {createType !== "QUIZ" ? (
                <>
                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.allowTextSubmissions")}</span>
                    <label className="brand-input inline-flex items-center gap-2">
                      <input type="checkbox" checked={createAllowedText} onChange={(event) => setCreateAllowedText(event.currentTarget.checked)} /> {t("assignment.submissionTypeText")}
                    </label>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.allowFileSubmissions")}</span>
                    <label className="brand-input inline-flex items-center gap-2">
                      <input type="checkbox" checked={createAllowedFile} onChange={(event) => setCreateAllowedFile(event.currentTarget.checked)} /> {t("assignment.submissionTypeFile")}
                    </label>
                  </div>
                </>
              ) : null}
            </div>
            {isQuestionAssignment(createType) ? (
              <div className="grid gap-3">
                <div className="rounded-md border border-[#dbe9fb] p-3">
                  <p className="brand-label">
                    {createType === "QUIZ" ? t("assignment.quizBuilder") : t("assignment.examBuilder")}
                  </p>
                  <div className="mt-2 grid gap-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("assignment.questionPrompt")}</span>
                      <input
                        className="brand-input"
                        placeholder={t("assignment.questionPromptPlaceholder")}
                        aria-label={t("assignment.draftQuestionPromptAria")}
                        value={createQuestionPrompt}
                        onChange={(event) => setCreateQuestionPrompt(event.currentTarget.value)}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">{t("assignment.questionType")}</span>
                      <select
                        className="brand-input"
                        value={createQuestionType}
                        onChange={(event) => setCreateQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                      >
                        <option value="MCQ">{t("assignment.multipleChoice")}</option>
                        {createType === "EXAM" ? <option value="SHORT_ANSWER">{t("assignment.shortAnswer")}</option> : null}
                      </select>
                    </label>
                    {createQuestionType === "MCQ" ? (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.option", { label: "A" })}</span>
                            <input className="brand-input" placeholder={t("assignment.option", { label: "A" })} aria-label={t("assignment.draftOptionAria", { label: "A" })} value={createQuestionOptionA} onChange={(event) => setCreateQuestionOptionA(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.option", { label: "B" })}</span>
                            <input className="brand-input" placeholder={t("assignment.option", { label: "B" })} aria-label={t("assignment.draftOptionAria", { label: "B" })} value={createQuestionOptionB} onChange={(event) => setCreateQuestionOptionB(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.option", { label: "C" })}</span>
                            <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "C" })} aria-label={t("assignment.draftOptionAria", { label: "C" })} value={createQuestionOptionC} onChange={(event) => setCreateQuestionOptionC(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.option", { label: "D" })}</span>
                            <input className="brand-input" placeholder={t("assignment.optionOptional", { label: "D" })} aria-label={t("assignment.draftOptionAria", { label: "D" })} value={createQuestionOptionD} onChange={(event) => setCreateQuestionOptionD(event.currentTarget.value)} />
                          </label>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.correctOptions")}</span>
                            <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                              {[
                                { label: t("assignment.option", { label: "A" }), value: createQuestionOptionA, index: 0 },
                                { label: t("assignment.option", { label: "B" }), value: createQuestionOptionB, index: 1 },
                                { label: t("assignment.option", { label: "C" }), value: createQuestionOptionC, index: 2 },
                                { label: t("assignment.option", { label: "D" }), value: createQuestionOptionD, index: 3 },
                              ].map((option) => (
                                <label key={`draft_correct_${option.index}`} className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={createQuestionCorrectIndexes.includes(option.index)}
                                    disabled={!option.value.trim()}
                                    onChange={() =>
                                      setCreateQuestionCorrectIndexes((prev) => toggleOptionSelection(prev, option.index))
                                    }
                                  />
                                  <span>{option.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <label className="grid gap-1.5">
                            <span className="brand-label">{t("assignment.questionPoints")}</span>
                            <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.draftQuestionPointsAria")} value={createQuestionPoints} onChange={(event) => setCreateQuestionPoints(event.currentTarget.value)} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("assignment.referenceAnswerOptional")}</span>
                          <input
                            className="brand-input"
                            placeholder={t("assignment.referenceAnswerPlaceholder")}
                            value={createQuestionShortAnswerKey}
                            onChange={(event) => setCreateQuestionShortAnswerKey(event.currentTarget.value)}
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("assignment.questionPoints")}</span>
                          <input className="brand-input" type="number" min="0.5" step="0.5" aria-label={t("assignment.draftQuestionPointsAria")} value={createQuestionPoints} onChange={(event) => setCreateQuestionPoints(event.currentTarget.value)} />
                        </label>
                      </div>
                    )}
                    <button type="button" className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" onClick={addDraftQuestion}>
                      {t("assignment.addToDraft")}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {createDraftQuestions.length === 0 ? <p className="brand-muted text-sm">{t("assignment.noDraftQuestions")}</p> : null}
                    {createDraftQuestions.map((question, index) => (
                      <div key={`${question.prompt}_${index}`} className="rounded-md border border-[#e7f0fc] p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0d3f80]">
                            {t("assignment.questionPrefix", { index: index + 1 })} {translateText(question.prompt)}
                          </p>
                          <button
                            type="button"
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                            onClick={() =>
                              setCreateDraftQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            {t("action.remove")}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-[#3768ac]">{t("assignment.pointsLabel")}: {question.points}</p>
                        <p className="mt-1 text-xs text-[#3768ac]">{t("assignment.typeLabel")}: {question.questionType === "SHORT_ANSWER" ? t("assignment.shortAnswer") : t("assignment.multipleChoiceShort")}</p>
                        {question.questionType === "MCQ" ? (
                          <p className="mt-1 text-xs text-[#3768ac]">
                            {t("assignment.correct")}: {formatOptionIndexes(question.correctOptionIndexes, (label) => t("assignment.optionLabel", { label }))}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className={`grid gap-3 ${createType === "HOMEWORK" ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.startDate")}</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label={t("label.startDate")}
                  value={createStartAt}
                  onChange={(event) => setCreateStartAt(event.currentTarget.value)}
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.endDate")}</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label={t("label.endDate")}
                  value={createEndAt}
                  onChange={(event) => setCreateEndAt(event.currentTarget.value)}
                  required
                />
              </label>
              {createType === "HOMEWORK" ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.startTime")}</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label={t("assignment.startTime")}
                      value={createStartTime}
                      onChange={(event) => setCreateStartTime(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.endTime")}</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label={t("assignment.endTime")}
                      value={createEndTime}
                      onChange={(event) => setCreateEndTime(event.currentTarget.value)}
                      required
                    />
                  </label>
                </>
              ) : null}
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.maxPoints")}</span>
                <input className="brand-input" type="number" min="1" step="0.01" aria-label={t("assignment.maxPoints")} value={createMaxPoints} onChange={(event) => setCreateMaxPoints(event.currentTarget.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.maxAttempts")}</span>
                <input className="brand-input" type="number" min="1" step="1" aria-label={t("assignment.maxAttempts")} value={createAttempts} onChange={(event) => setCreateAttempts(event.currentTarget.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.moduleLink")}</span>
                <select
                  className="brand-input"
                  aria-label={t("assignment.moduleLink")}
                  value={createModuleId}
                  onChange={(event) => {
                    const nextModuleId = event.currentTarget.value;
                    setCreateModuleId(nextModuleId);
                    setCreateLessonId("");
                  }}
                >
                  <option value="">{t("assignment.noModuleLink")}</option>
                  {(structureByCourseId[createCourseId] ?? []).map((module) => (
                    <option key={module.id} value={module.id}>
                      {translateText(module.title)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.lessonLink")}</span>
                <select
                  className="brand-input"
                  aria-label={t("assignment.lessonLink")}
                  value={createLessonId}
                  onChange={(event) => setCreateLessonId(event.currentTarget.value)}
                  disabled={!createModuleId}
                >
                  <option value="">{t("assignment.noLessonLink")}</option>
                  {(structureByCourseId[createCourseId] ?? [])
                    .find((module) => module.id === createModuleId)
                    ?.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {translateText(lesson.title)}
                      </option>
                    )) ?? null}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={createPending}>
                {createPending ? t("status.creating") : t("action.createAssignment")}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setShowCreateModal(false)}>
                {t("action.cancel")}
              </button>
            </div>
          </form>
        </section>
        </div>
      ) : null}

      {canManage && editId ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
        <section className="brand-card min-w-0 w-full max-w-4xl overflow-hidden p-5">
          <p className="brand-section-title">{t("assignment.editTitle")}</p>
          <form className="mt-3 grid gap-3" onSubmit={onUpdate}>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.assignmentTitle")}</span>
              <input className="brand-input" aria-label={t("assignment.assignmentTitle")} value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.instructions")}</span>
              <textarea className="brand-input min-h-[84px]" aria-label={t("assignment.instructions")} value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.rubricStepsLabel")}</span>
              <textarea className="brand-input min-h-[84px]" aria-label={t("assignment.rubricStepsLabel")} value={editRubric} onChange={(event) => setEditRubric(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.rubricFile")}</span>
              <input
                className="brand-input"
                type="file"
                accept=".txt,.csv"
                aria-label={t("assignment.uploadRubricAria")}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) {
                    setEditRubricFileName("");
                    return;
                  }
                  setEditRubricFileName(file.name);
                  void file.text().then((text) => {
                    setEditRubric(normalizeRubricText(text));
                  });
                }}
              />
              {editRubricFileName ? (
                <span className="text-xs text-[#3a689f]">{t("assignment.rubricLoaded", { name: editRubricFileName })}</span>
              ) : (
                <span className="text-xs text-[#3a689f]">{t("assignment.rubricUploadHint")}</span>
              )}
            </label>
            
            <div className="grid gap-3 md:grid-cols-3">
              {editType !== "HOMEWORK" ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">{t("assignment.timeFrameMinutes")}</span>
                  <input
                    className="brand-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("assignment.timeFramePlaceholder")}
                    aria-label={t("assignment.timeFramePlaceholder")}
                    value={editTimerMinutes}
                    onChange={(event) => setEditTimerMinutes(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("assignment.attemptScoringStrategy")}</span>
              <select
                className="brand-input"
                aria-label={t("assignment.attemptScoringStrategy")}
                value={editAttemptScoringStrategy}
                onChange={(event) => setEditAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
              >
                <option value="LATEST">{t("assignment.attemptRuleLatest")}</option>
                <option value="HIGHEST">{t("assignment.attemptRuleHighest")}</option>
              </select>
            </label>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={editAllowLateSubmissions}
                onChange={(event) => setEditAllowLateSubmissions(event.currentTarget.checked)}
              />
              {t("assignment.allowLateSubmissions")}
            </label>
            <div className={`grid gap-3 ${editType === "QUIZ" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.assignmentType")}</span>
                <select className="brand-input" aria-label={t("assignment.assignmentType")} value={editType} onChange={(event) => setEditType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                  <option value="HOMEWORK">{t("assignment.type.homework")}</option>
                  <option value="QUIZ">{t("assignment.type.quiz")}</option>
                  <option value="EXAM">{t("assignment.type.exam")}</option>
                </select>
              </label>
              {editType !== "QUIZ" ? (
                <>
                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.allowTextSubmissions")}</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedText} onChange={(event) => setEditAllowedText(event.currentTarget.checked)} /> {t("assignment.submissionTypeText")}</label>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.allowFileSubmissions")}</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedFile} onChange={(event) => setEditAllowedFile(event.currentTarget.checked)} /> {t("assignment.submissionTypeFile")}</label>
                  </div>
                </>
              ) : null}
            </div>
            <div className={`grid gap-3 ${editType === "HOMEWORK" ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.startDate")}</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label={t("label.startDate")}
                  value={editStartAt}
                  onChange={(event) => setEditStartAt(event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.endDate")}</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label={t("label.endDate")}
                  value={editEndAt}
                  onChange={(event) => setEditEndAt(event.currentTarget.value)}
                />
              </label>
              {editType === "HOMEWORK" ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.startTime")}</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label={t("assignment.startTime")}
                      value={editStartTime}
                      onChange={(event) => setEditStartTime(event.currentTarget.value)}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">{t("assignment.endTime")}</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label={t("assignment.endTime")}
                      value={editEndTime}
                      onChange={(event) => setEditEndTime(event.currentTarget.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.maxPoints")}</span>
                <input className="brand-input" type="number" min="1" step="0.01" aria-label={t("assignment.maxPoints")} value={editMaxPoints} onChange={(event) => setEditMaxPoints(event.currentTarget.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.maxAttempts")}</span>
                <input className="brand-input" type="number" min="1" step="1" aria-label={t("assignment.maxAttempts")} value={editAttempts} onChange={(event) => setEditAttempts(event.currentTarget.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.moduleLink")}</span>
                <select
                  className="brand-input"
                  aria-label={t("assignment.moduleLink")}
                  value={editModuleId}
                  onChange={(event) => {
                    const nextModuleId = event.currentTarget.value;
                    setEditModuleId(nextModuleId);
                    setEditLessonId("");
                  }}
                >
                  <option value="">{t("assignment.noModuleLink")}</option>
                  {(structureByCourseId[editAssignment?.courseId ?? ""] ?? []).map((module) => (
                    <option key={module.id} value={module.id}>
                      {translateText(module.title)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("assignment.lessonLink")}</span>
                <select
                  className="brand-input"
                  aria-label={t("assignment.lessonLink")}
                  value={editLessonId}
                  onChange={(event) => setEditLessonId(event.currentTarget.value)}
                  disabled={!editModuleId}
                >
                  <option value="">{t("assignment.noLessonLink")}</option>
                  {(structureByCourseId[editAssignment?.courseId ?? ""] ?? [])
                    .find((module) => module.id === editModuleId)
                    ?.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {translateText(lesson.title)}
                      </option>
                    )) ?? null}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-secondary px-4 py-2 text-sm font-semibold" disabled={editPending}>
                {editPending ? t("status.saving") : t("action.saveChanges")}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setEditId("")}>
                {t("action.cancel")}
              </button>
            </div>
          </form>
        </section>
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirmDeleteAssignmentId}
        title={t("assignment.deleteTitle")}
        message={t("assignment.deleteMessage")}
        confirmLabel={t("action.delete")}
        onCancel={() => setConfirmDeleteAssignmentId("")}
        onConfirm={() => {
          const assignmentId = confirmDeleteAssignmentId;
          setConfirmDeleteAssignmentId("");
          if (assignmentId) {
            void onDelete(assignmentId);
          }
        }}
      />

      <ConfirmModal
        open={!!confirmInvalidateSubmissionId}
        title={t("assignment.invalidateTitle")}
        message={t("assignment.invalidateMessage")}
        confirmLabel={t("assignment.invalidateConfirm")}
        onCancel={() => setConfirmInvalidateSubmissionId("")}
        onConfirm={() => {
          const submissionId = confirmInvalidateSubmissionId;
          setConfirmInvalidateSubmissionId("");
          if (submissionId) {
            void onInvalidateAttempt(submissionId);
          }
        }}
      />
    </section>
  );
}
