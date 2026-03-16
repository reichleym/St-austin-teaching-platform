"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { toast } from "@/lib/toast";

type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

type CourseOption = {
  id: string;
  code: string;
  title: string;
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

const formatOptionIndexes = (indexes: number[]) =>
  indexes
    .map((index) => `Option ${String.fromCharCode(65 + index)}`)
    .join(", ");

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

const formatMinutes = (minutes: number) => {
  if (!minutes) return "0m";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
};

const normalizeRubricText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

const plagiarismBand = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "N/A";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
};

const isPublishedOrLockedState = (state: string) =>
  state === "GRADE_PUBLISHED" ||
  state === "GRADE_EDIT_REQUESTED" ||
  state === "GRADE_EDIT_APPROVED" ||
  state === "GRADE_EDIT_REJECTED" ||
  state === "PUBLISHED";

export function AssignmentsModule({ role }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = role === "TEACHER";
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
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
        setError(result.error ?? "Unable to load assignments.");
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
      setError("Unable to load assignments.");
      setCourses([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGradeEditRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
    setGradeEditRequestsLoading(true);
    try {
      const response = await fetch("/api/admin/grade-edit-requests", { method: "GET" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { requests?: GradeEditRequestItem[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load grade edit requests.");
        setGradeEditRequests([]);
        return;
      }
      setGradeEditRequests(result.requests ?? []);
    } catch {
      setError("Unable to load grade edit requests.");
      setGradeEditRequests([]);
    } finally {
      setGradeEditRequestsLoading(false);
    }
  }, [isSuperAdmin]);

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
        setError(result.error ?? "Unable to load submissions.");
        setSubmissions([]);
        return;
      }
      setSubmissions(result.submissions ?? []);
    } catch {
      setError("Unable to load submissions.");
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

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
        setError(result.error ?? "Unable to load quiz questions.");
        setQuizQuestions([]);
        return;
      }
      setQuizQuestions(result.questions ?? []);
    } catch {
      setError("Unable to load quiz questions.");
      setQuizQuestions([]);
    } finally {
      setQuizQuestionsLoading(false);
    }
  }, []);

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
      setError("Quiz supports MCQ questions only.");
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
      setError("Question prompt is required.");
      return;
    }
    if (createQuestionType === "MCQ") {
      if (options.length < 2) {
        setError("MCQ question needs at least two options.");
        return;
      }
      if (!correctOptionIndexes.length) {
        setError("Select at least one valid correct option for the quiz question.");
        return;
      }
    }
    if (!Number.isFinite(points) || points <= 0) {
      setError("Question points must be greater than zero.");
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
        setError("Question prompt is required.");
        return;
      }
      if (selectedAssignment.config.assignmentType === "QUIZ" && editQuestionType !== "MCQ") {
        setError("Quiz supports MCQ questions only.");
        return;
      }
      if (editQuestionType === "MCQ") {
        if (options.length < 2) {
          setError("MCQ question needs at least two options.");
          return;
        }
        if (!correctOptionIndexes.length) {
          setError("Select at least one valid correct option for the quiz question.");
          return;
        }
      }
      if (!Number.isFinite(points) || points <= 0) {
        setError("Question points must be greater than zero.");
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
        setError(result.error ?? "Unable to update quiz question.");
        return;
      }

      await loadQuizQuestions(selectedAssignment.id);
      resetEditQuestion();
    } catch {
      setError("Unable to update quiz question.");
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
        setError("Quiz and exam assignments cannot be empty. Add instructions or rubric steps.");
        return;
      }
      if (isQuestionAssignment(createType) && createDraftQuestions.length === 0) {
        setError(createType === "QUIZ" ? "Add at least one quiz question before creating the quiz assignment." : "Add at least one question before creating the exam assignment.");
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
            ? "Provide a valid start date, end date, start time, and end time for homework."
            : "Provide valid start and end dates."
        );
        return;
      }
      if (new Date(createEndIso).getTime() <= new Date(createStartIso).getTime()) {
        setError(createType === "HOMEWORK" ? "Homework end time must be after start time." : "End date must be after start date.");
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
        setError(result.error ?? "Unable to create assignment.");
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
            setError(questionResult.error ?? "Assignment created but some quiz questions failed to save.");
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
      setError("Unable to create assignment.");
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
        setError("Quiz and exam assignments cannot be empty. Add instructions or rubric steps.");
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
            ? "Provide a valid start date, end date, start time, and end time for homework."
            : "Provide valid start and end dates."
        );
        return;
      }
      if (new Date(editEndIso).getTime() <= new Date(editStartIso).getTime()) {
        setError(editType === "HOMEWORK" ? "Homework end time must be after start time." : "End date must be after start date.");
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
        setError(result.error ?? "Unable to update assignment.");
        return;
      }
      setEditId("");
      setEditRubricFileName("");
      await load();
    } catch {
      setError("Unable to update assignment.");
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
        setError(result.error ?? "Unable to delete assignment.");
        return;
      }
      await load();
    } catch {
      setError("Unable to delete assignment.");
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
          reason: "Attempt invalidated by teacher for controlled resubmission.",
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to invalidate attempt.");
        return;
      }
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
      await load();
    } catch {
      setError("Unable to invalidate attempt.");
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
        setError("Quiz supports MCQ questions only.");
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
        setError("Question prompt is required.");
        return;
      }
      if (newQuestionType === "MCQ" && options.length < 2) {
        setError("At least two options are required for MCQ.");
        return;
      }
      if (newQuestionType === "MCQ" && !correctOptionIndexes.length) {
        setError("Select at least one valid correct option.");
        return;
      }
      if (!Number.isFinite(points) || points <= 0) {
        setError("Question points must be greater than zero.");
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
        setError(result.error ?? "Unable to create quiz question.");
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
      setError("Unable to create quiz question.");
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
        setError(result.error ?? "Unable to delete quiz question.");
        return;
      }
      if (selectedAssignmentId) {
        await loadQuizQuestions(selectedAssignmentId);
      }
    } catch {
      setError("Unable to delete quiz question.");
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
        setError(result.error ?? "Unable to submit assignment.");
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
      setError("Unable to submit assignment.");
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
          setError("Raw score must be a non-negative number.");
          return;
        }
        if (maxPoints !== null && parsed > maxPoints) {
          setError(`Raw score cannot exceed max points (${maxPoints}).`);
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
        setError(result.error ?? "Unable to grade submission.");
        return;
      }
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
    } catch {
      setError("Unable to grade submission.");
    } finally {
      setGradePendingId("");
    }
  };

  const onRequestGradeEdit = async (submission: SubmissionItem) => {
    if (!selectedAssignment || !isTeacher) return;
    const proposedPointsValue = Number(requestEditProposedPoints);
    if (!Number.isFinite(proposedPointsValue) || proposedPointsValue < 0) {
      setError("Proposed points are required and must be non-negative.");
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
        setError(result.error ?? "Unable to process grade edit decision.");
        return;
      }
      await loadGradeEditRequests();
      if (selectedAssignmentId) {
        await loadSubmissions(selectedAssignmentId);
      }
    } catch {
      setError("Unable to process grade edit decision.");
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
  const selectedStartAtMs = selectedAssignmentStartAt ? new Date(selectedAssignmentStartAt).getTime() : NaN;
  const selectedEndAtMs = selectedAssignmentEndAt ? new Date(selectedAssignmentEndAt).getTime() : NaN;
  const isSubmissionBeforeWindow =
    isStudent && selectedAssignmentStartAt ? Number.isFinite(selectedStartAtMs) && nowTick < selectedStartAtMs : false;
  const isSubmissionAfterWindow =
    isStudent && selectedAssignmentEndAt ? Number.isFinite(selectedEndAtMs) && nowTick > selectedEndAtMs : false;
  const isSubmissionBlockedByWindow = isSubmissionBeforeWindow || (isSubmissionAfterWindow && !selectedAssignment?.config.allowLateSubmissions);

  const studentCanSubmit = useMemo(() => {
    if (!isStudent || !selectedAssignment) return false;
    if (isSubmissionBlockedByWindow) return false;
    return studentAttemptCount < selectedAssignment.config.maxAttempts;
  }, [isStudent, isSubmissionBlockedByWindow, selectedAssignment, studentAttemptCount]);
  const hasStartedTimedAttempt = !!studentQuizStartedAt;

  return (
    <section className="grid min-w-0 gap-4">
      {isSuperAdmin ? (
        <section className="brand-card min-w-0 overflow-hidden p-5">
          <p className="brand-section-title">Pending Grade Edit Requests</p>
          {gradeEditRequestsLoading ? <p className="brand-muted mt-3 text-sm">Loading requests...</p> : null}
          {!gradeEditRequestsLoading && gradeEditRequests.length === 0 ? (
            <p className="brand-muted mt-3 text-sm">No pending requests.</p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {gradeEditRequests.map((request) => (
              <article key={request.id} className="rounded-md border border-[#dbe9fb] p-3">
                <p className="text-sm font-semibold text-[#0d3f80]">
                  {request.assignment?.title ?? "Assignment"} - {request.student?.name || request.student?.email || "Student"}
                </p>
                <p className="mt-1 text-xs text-[#3a689f]">Reason: {request.reason}</p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  Proposed: {request.proposedPoints ?? "N/A"} | Requested by: {request.requestedBy?.name || request.requestedBy?.email || "Teacher"}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="brand-label">Approved Points</span>
                    <input
                      className="brand-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Approved points (optional)"
                      aria-label={`Approved points for ${request.assignment?.title ?? "assignment"}`}
                      value={reviewApprovedPointsByRequest[request.id] ?? ""}
                      onChange={(event) => {
                        const value = (event.target as HTMLInputElement | null)?.value ?? "";
                        setReviewApprovedPointsByRequest((prev) => ({ ...prev, [request.id]: value }));
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Review Note</span>
                    <input
                      className="brand-input"
                      placeholder="Review note (optional)"
                      aria-label={`Review note for ${request.assignment?.title ?? "assignment"}`}
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
                    {reviewPendingId === request.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                    disabled={reviewPendingId === request.id}
                    onClick={() => void onReviewGradeEditRequest(request.id, "REJECT")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="brand-card min-w-0 overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="brand-section-title">Assignment List</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="grid gap-1.5">
              <span className="brand-label">Filter</span>
              <select
                className="brand-input min-w-[200px]"
                value={activeMenu}
                onChange={(event) => setActiveMenu(event.currentTarget.value as "ALL" | "SUBMITTED" | "DUE")}
              >
                <option value="ALL">All Assignments</option>
                <option value="SUBMITTED">Submitted Only</option>
                <option value="DUE">Due Assignments</option>
              </select>
            </label>
            {canManage ? (
              <button type="button" className="btn-brand-primary px-3 py-1.5 text-xs font-semibold" onClick={() => setShowCreateModal(true)}>
                Create Assignment
              </button>
            ) : null}
          </div>
        </div>
        {loading ? <p className="brand-muted mt-3 text-sm">Loading assignments...</p> : null}

        {!loading && filteredAssignments.length ? (
          <div className="mt-3 w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm lg:min-w-full">
            <thead>
              <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Linked To</th>
                <th className="px-3 py-2 font-semibold">Attempts</th>
                <th className="px-3 py-2 font-semibold">Window</th>
                <th className="px-3 py-2 font-semibold">Max Points</th>
                <th className="px-3 py-2 font-semibold">Submissions</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#e7f0fc] text-[#0d3f80] transition ${selectedAssignmentId === item.id ? "bg-[#f4f9ff]" : "hover:bg-[#f8fbff]"} ${canManage || isStudent || isAdminReadOnly ? "cursor-pointer" : ""}`}
                  onClick={() => router.push(`/dashboard/assessment/${item.id}`)}
                >
                  <td className="px-3 py-2">{item.course.code} - {item.course.title}</td>
                  <td className="px-3 py-2">
                    <p>{item.title}</p>
                    {item.description ? <p className="mt-1 text-xs text-[#3768ac]">{item.description}</p> : null}
                  </td>
                  <td className="px-3 py-2">{item.config.assignmentType}</td>
                  <td className="px-3 py-2">
                    {item.config.moduleId || item.config.lessonId
                      ? `Module ${item.config.moduleId ? "Linked" : "None"} / Lesson ${item.config.lessonId ? "Linked" : "None"}`
                      : "Course Only"}
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
                        Manage
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
                            Edit
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
                            {deletePendingId === item.id ? "Deleting..." : "Delete"}
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
              ? "No submitted assignments yet."
              : activeMenu === "DUE"
                ? "No due assignments right now."
                : "No assignments found."}
          </p>
        ) : null}
      </section>

      {selectedAssignment && showInlineDetails ? (
        <section className="brand-card min-w-0 overflow-hidden p-5">
          <p className="brand-section-title">Assignment Workspace: {selectedAssignment.title}</p>
          <p className="brand-muted mt-2 break-words text-sm">
            Submission Types: {selectedAssignment.config.allowedSubmissionTypes.length
              ? selectedAssignment.config.allowedSubmissionTypes.join(", ")
              : selectedAssignment.config.assignmentType === "QUIZ"
                ? "Quiz Questions"
                : "N/A"}{" "}
            | Rubric Steps: {selectedAssignment.config.rubricSteps.length}
            {` | Window: ${formatAssignmentWindow(selectedAssignment.config.assignmentType, selectedAssignmentStartAt, selectedAssignmentEndAt)}`}
            {selectedAssignment.config.timerMinutes
              ? ` | Time Frame: ${selectedAssignment.config.timerMinutes} min`
              : ""}
          </p>

          {isStudent ? (
            <form className="mt-3 grid gap-3" onSubmit={onStudentSubmit} onFocusCapture={startStudentQuizTimerIfNeeded}>
              {submissionsLoading ? <p className="brand-muted text-sm">Checking your submission status...</p> : null}
              {!submissionsLoading && !studentCanSubmit ? (
                <p className="rounded-md border border-[#dbe9fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#1f518f]">
                  {isSubmissionBeforeWindow
                    ? `Submission opens on ${formatDate(selectedAssignmentStartAt)}.`
                    : isSubmissionAfterWindow && !selectedAssignment.config.allowLateSubmissions
                      ? "Submission window has ended. Late submissions are blocked."
                      : `You have reached the maximum ${selectedAssignment.config.assignmentType.toLowerCase()} attempts.`}
                </p>
              ) : null}
              {!submissionsLoading && studentCanSubmit && isSubmissionAfterWindow && selectedAssignment.config.allowLateSubmissions ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Submission window ended on {formatDate(selectedAssignmentEndAt)}. Late penalties may apply.
                </p>
              ) : null}
              {selectedAssignment.config.timerMinutes ? (
                <p className="text-sm font-semibold text-[#1f518f]">
                  Time Remaining:{" "}
                  {quizRemainingSeconds !== null
                    ? `${Math.floor(quizRemainingSeconds / 60)}m ${quizRemainingSeconds % 60}s`
                    : `${selectedAssignment.config.timerMinutes}m 0s`}
                  {!hasStartedTimedAttempt ? " (starts when you begin)" : null}
                </p>
              ) : null}
              {selectedAssignment.config.timerMinutes && !hasStartedTimedAttempt && studentCanSubmit ? (
                <button
                  type="button"
                  className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold"
                  onClick={startStudentQuizTimerIfNeeded}
                >
                  Start Attempt
                </button>
              ) : null}
              {isQuestionAssignment(selectedAssignment.config.assignmentType) ? (
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
                              <span>{option}</span>
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
                  <span className="brand-label">Text Response</span>
                  <textarea
                    className="brand-input min-h-[100px]"
                    placeholder="Text response"
                    aria-label="Text response"
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
                  <span className="brand-label">Upload File</span>
                  <input
                    type="file"
                    className="brand-input"
                    aria-label="Upload assignment file"
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
                  {studentPending ? "Submitting..." : `Submit Attempt ${studentCurrentAttemptNumber}`}
                </button>
              ) : null}
            </form>
          ) : null}

          {canManage && isQuestionAssignment(selectedAssignment.config.assignmentType) ? (
            <div id="assignment-questions" className="mt-4 rounded-md border border-[#dbe9fb] p-3">
              <p className="brand-label">
                {selectedAssignment.config.assignmentType === "QUIZ" ? "Quiz Questions (MCQ)" : "Exam Questions (MCQ + Short Answer)"}
              </p>
              <form className="mt-2 grid gap-2" onSubmit={onCreateQuestion}>
                <label className="grid gap-1.5">
                  <span className="brand-label">Question Prompt</span>
                  <input
                    className="brand-input"
                    placeholder="Question prompt"
                    aria-label="Quiz question prompt"
                    value={newQuestionPrompt}
                    onChange={(event) => setNewQuestionPrompt(event.currentTarget.value)}
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Question Type</span>
                  <select
                    className="brand-input"
                    value={newQuestionType}
                    onChange={(event) => setNewQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                  >
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    {selectedAssignment.config.assignmentType === "EXAM" ? <option value="SHORT_ANSWER">Short Answer</option> : null}
                  </select>
                </label>
                {newQuestionType === "MCQ" ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="brand-label">Option A</span>
                        <input className="brand-input" placeholder="Option A" aria-label="Option A" value={newQuestionOptionA} onChange={(event) => setNewQuestionOptionA(event.currentTarget.value)} required />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">Option B</span>
                        <input className="brand-input" placeholder="Option B" aria-label="Option B" value={newQuestionOptionB} onChange={(event) => setNewQuestionOptionB(event.currentTarget.value)} required />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">Option C</span>
                        <input className="brand-input" placeholder="Option C (optional)" aria-label="Option C" value={newQuestionOptionC} onChange={(event) => setNewQuestionOptionC(event.currentTarget.value)} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">Option D</span>
                        <input className="brand-input" placeholder="Option D (optional)" aria-label="Option D" value={newQuestionOptionD} onChange={(event) => setNewQuestionOptionD(event.currentTarget.value)} />
                      </label>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="grid gap-1.5">
                        <span className="brand-label">Correct Options</span>
                        <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                          {[
                            { label: "Option A", value: newQuestionOptionA, index: 0 },
                            { label: "Option B", value: newQuestionOptionB, index: 1 },
                            { label: "Option C", value: newQuestionOptionC, index: 2 },
                            { label: "Option D", value: newQuestionOptionD, index: 3 },
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
                        <span className="brand-label">Points</span>
                        <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Question points" value={newQuestionPoints} onChange={(event) => setNewQuestionPoints(event.currentTarget.value)} />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Reference Answer (Optional)</span>
                      <input
                        className="brand-input"
                        placeholder="Reference answer for teacher"
                        value={newQuestionShortAnswerKey}
                        onChange={(event) => setNewQuestionShortAnswerKey(event.currentTarget.value)}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">Points</span>
                      <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Question points" value={newQuestionPoints} onChange={(event) => setNewQuestionPoints(event.currentTarget.value)} />
                    </label>
                  </div>
                )}
                <button className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" disabled={createQuestionPending}>
                  {createQuestionPending ? "Adding..." : "Add Question"}
                </button>
              </form>

              <div className="mt-3 grid gap-2">
                {quizQuestionsLoading ? <p className="brand-muted text-sm">Loading questions...</p> : null}
                {!quizQuestionsLoading && quizQuestions.length === 0 ? <p className="brand-muted text-sm">No quiz questions yet.</p> : null}
                {quizQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-md border border-[#e7f0fc] p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0d3f80]">Q{index + 1}. {question.prompt}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-2 py-1 text-xs font-semibold text-[#1f518f]"
                          disabled={editQuestionPendingId === question.id}
                          onClick={() => startEditQuestion(question)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                          disabled={deleteQuestionPendingId === question.id || editQuestionId === question.id}
                          onClick={() => void onDeleteQuestion(question.id)}
                        >
                          {deleteQuestionPendingId === question.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                    {editQuestionId === question.id ? (
                      <form className="mt-2 grid gap-2" onSubmit={onUpdateQuestion}>
                        <label className="grid gap-1.5">
                          <span className="brand-label">Question Prompt</span>
                          <input
                            className="brand-input"
                            placeholder="Question prompt"
                            aria-label="Edit question prompt"
                            value={editQuestionPrompt}
                            onChange={(event) => setEditQuestionPrompt(event.currentTarget.value)}
                            required
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="brand-label">Question Type</span>
                          <select
                            className="brand-input"
                            value={editQuestionType}
                            onChange={(event) => setEditQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                          >
                            <option value="MCQ">Multiple Choice (MCQ)</option>
                            {selectedAssignment?.config.assignmentType === "EXAM" ? <option value="SHORT_ANSWER">Short Answer</option> : null}
                          </select>
                        </label>
                        {editQuestionType === "MCQ" ? (
                          <>
                            <div className="grid gap-2 md:grid-cols-2">
                              <label className="grid gap-1.5">
                                <span className="brand-label">Option A</span>
                                <input className="brand-input" placeholder="Option A" aria-label="Edit option A" value={editQuestionOptionA} onChange={(event) => setEditQuestionOptionA(event.currentTarget.value)} required />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">Option B</span>
                                <input className="brand-input" placeholder="Option B" aria-label="Edit option B" value={editQuestionOptionB} onChange={(event) => setEditQuestionOptionB(event.currentTarget.value)} required />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">Option C</span>
                                <input className="brand-input" placeholder="Option C (optional)" aria-label="Edit option C" value={editQuestionOptionC} onChange={(event) => setEditQuestionOptionC(event.currentTarget.value)} />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">Option D</span>
                                <input className="brand-input" placeholder="Option D (optional)" aria-label="Edit option D" value={editQuestionOptionD} onChange={(event) => setEditQuestionOptionD(event.currentTarget.value)} />
                              </label>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <div className="grid gap-1.5">
                                <span className="brand-label">Correct Options</span>
                                <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                                  {[
                                    { label: "Option A", value: editQuestionOptionA, index: 0 },
                                    { label: "Option B", value: editQuestionOptionB, index: 1 },
                                    { label: "Option C", value: editQuestionOptionC, index: 2 },
                                    { label: "Option D", value: editQuestionOptionD, index: 3 },
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
                                <span className="brand-label">Points</span>
                                <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Edit question points" value={editQuestionPoints} onChange={(event) => setEditQuestionPoints(event.currentTarget.value)} />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="grid gap-1.5">
                              <span className="brand-label">Reference Answer (Optional)</span>
                              <input
                                className="brand-input"
                                placeholder="Reference answer for teacher"
                                value={editQuestionShortAnswerKey}
                                onChange={(event) => setEditQuestionShortAnswerKey(event.currentTarget.value)}
                              />
                            </label>
                            <label className="grid gap-1.5">
                              <span className="brand-label">Points</span>
                              <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Edit question points" value={editQuestionPoints} onChange={(event) => setEditQuestionPoints(event.currentTarget.value)} />
                            </label>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                            onClick={resetEditQuestion}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-brand-secondary px-3 py-1.5 text-xs font-semibold"
                            disabled={editQuestionPendingId === question.id}
                          >
                            {editQuestionPendingId === question.id ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="mt-1 text-xs text-[#3768ac]">Points: {question.points}</p>
                        <p className="mt-1 text-xs text-[#3768ac]">Type: {(question.questionType ?? "MCQ") === "SHORT_ANSWER" ? "Short Answer" : "MCQ"}</p>
                        {(question.questionType ?? "MCQ") === "MCQ" && question.correctOptionIndexes?.length ? (
                          <p className="mt-1 text-xs text-[#3768ac]">Correct: {formatOptionIndexes(question.correctOptionIndexes)}</p>
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
              <p className="brand-label">Submissions</p>
              {submissionsLoading ? <p className="brand-muted text-sm">Loading submissions...</p> : null}
              {!submissionsLoading && submissions.length === 0 ? <p className="brand-muted text-sm">No submissions yet.</p> : null}
              {isAdminReadOnly && submissions.length ? (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                        <th className="px-3 py-2 font-semibold">Course</th>
                        <th className="px-3 py-2 font-semibold">Teacher</th>
                        <th className="px-3 py-2 font-semibold">Student</th>
                        <th className="px-3 py-2 font-semibold">Attempt</th>
                        <th className="px-3 py-2 font-semibold">Score</th>
                        <th className="px-3 py-2 font-semibold">Letter</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Plagiarism</th>
                        <th className="px-3 py-2 font-semibold">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                          <td className="px-3 py-2">
                            {selectedAssignment?.course.code} - {selectedAssignment?.course.title}
                          </td>
                          <td className="px-3 py-2">
                            {selectedAssignment?.course.teacher?.name || selectedAssignment?.course.teacher?.email || "Unassigned"}
                          </td>
                          <td className="px-3 py-2">{submission.studentName || submission.studentEmail || "Student"}</td>
                          <td className="px-3 py-2">{submission.attemptNumber}</td>
                          <td className="px-3 py-2">{submission.finalScore ?? "-"}</td>
                          <td className="px-3 py-2">{submission.letterGrade ?? "-"}</td>
                          <td className="px-3 py-2">{formatEnumLabel(submission.status)}</td>
                          <td className="px-3 py-2">
                            {submission.plagiarismStatus === "COMPLETED"
                              ? `${plagiarismBand(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)`
                              : formatEnumLabel(submission.plagiarismStatus)}
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
                    Attempt {submission.attemptNumber}
                    {submission.studentEmail ? ` - ${submission.studentName || "Student"} (${submission.studentEmail})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#3a689f]">
                    Submitted: {formatDate(submission.submittedAt)} | Late: {submission.isLate ? `${formatMinutes(submission.lateByMinutes)} (${submission.latePenaltyPct}%)` : "No"}
                  </p>
                  {submission.status === "ATTEMPT_CANCELLED" ? (
                    <p className="mt-1 text-xs font-semibold text-[#9b1c1c]">
                      This attempt was invalidated for controlled resubmission.
                    </p>
                  ) : null}
                  {submission.finalScore !== null ? (
                    <p className="mt-1 text-xs text-[#3a689f]">
                      Final Score: {submission.finalScore}
                      {submission.letterGrade ? ` | Letter: ${submission.letterGrade}` : ""}
                    </p>
                  ) : null}
                  {canManage ? (
                    <p className="mt-1 text-xs text-[#3a689f]">
                      Plagiarism: {formatEnumLabel(submission.plagiarismStatus ?? "PENDING")}
                      {submission.plagiarismStatus === "COMPLETED" ? ` | ${plagiarismBand(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)` : ""}
                      {submission.plagiarismSummary ? ` | ${submission.plagiarismSummary}` : ""}
                    </p>
                  ) : null}
                  {submission.textResponse ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#0d3f80]">{submission.textResponse}</p> : null}
                  {submission.fileUrl ? (
                    <a
                      href={`/api/assignments/uploads/${submission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-[#1f518f] underline"
                    >
                      {submission.fileName || "Open submitted file"}
                    </a>
                  ) : null}

                  {canManage && submission.status !== "ATTEMPT_CANCELLED" && !isPublishedOrLockedState(submission.status) ? (
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1.5">
                        <span className="brand-label">Raw Score</span>
                      <input
                        className="brand-input"
                        type="number"
                        min="0"
                        max={selectedAssignment?.maxPoints ?? undefined}
                        step="0.01"
                        placeholder="Raw score"
                        aria-label={`Raw score for attempt ${submission.attemptNumber}`}
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
                        <span className="brand-label">Feedback</span>
                        <textarea
                          className="brand-input min-h-[72px]"
                          placeholder="Feedback"
                          aria-label={`Feedback for attempt ${submission.attemptNumber}`}
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
                          {invalidatePendingId === submission.id ? "Updating..." : "Invalidate Attempt"}
                        </button>
                        <button
                          type="button"
                          className="btn-brand-secondary px-3 py-1.5 text-xs font-semibold"
                          disabled={gradePendingId === submission.id}
                          onClick={() => void onGrade(submission.id, false)}
                        >
                          Save Grade
                        </button>
                        <button
                          type="button"
                          className="btn-brand-primary px-3 py-1.5 text-xs font-semibold"
                          disabled={gradePendingId === submission.id}
                          onClick={() => void onGrade(submission.id, true)}
                        >
                          Publish Grade
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {canManage && isPublishedOrLockedState(submission.status) ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-xs font-semibold text-[#285f9f]">
                        Published grade is locked. Use grade edit request flow for changes.
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
                            {requestEditForSubmissionId === submission.id ? "Cancel Request" : "Request Grade Edit"}
                          </button>
                          {requestEditForSubmissionId === submission.id ? (
                            <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-3">
                              <label className="grid gap-1.5">
                                <span className="brand-label">Reason for Grade Edit</span>
                                <textarea
                                  className="brand-input min-h-[78px]"
                                  placeholder="Reason for grade edit request"
                                  aria-label="Grade edit request reason"
                                  value={requestEditReason}
                                  onChange={(event) => setRequestEditReason(event.currentTarget.value)}
                                />
                              </label>
                              <label className="grid gap-1.5">
                                <span className="brand-label">Proposed Points</span>
                                <input
                                  className="brand-input"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Proposed points"
                                  aria-label="Proposed points"
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
                                {requestEditPendingId === submission.id ? "Submitting..." : "Submit Request"}
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {isTeacher && submission.status !== "GRADE_PUBLISHED" ? (
                        <p className="text-xs text-[#3a689f]">Grade edit is already under admin review or processed.</p>
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
          <p className="brand-section-title">Create Assignment</p>
          <form className="mt-3 grid gap-3" onSubmit={onCreate}>
            <label className="grid gap-1.5">
              <span className="brand-label">Course</span>
              <select className="brand-input" aria-label="Course" value={createCourseId} onChange={(event) => setCreateCourseId(event.currentTarget.value)} required>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.code} - {course.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Assignment Title</span>
              <input className="brand-input" placeholder="Assignment title" aria-label="Assignment title" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Instructions</span>
              <textarea className="brand-input min-h-[84px]" placeholder="Instructions" aria-label="Instructions" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Rubric Steps</span>
              <textarea className="brand-input min-h-[84px]" placeholder="Rubric steps (one per line)" aria-label="Rubric steps" value={createRubric} onChange={(event) => setCreateRubric(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Rubric File</span>
              <input
                className="brand-input"
                type="file"
                accept=".txt,.csv"
                aria-label="Upload rubric file"
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
                <span className="text-xs text-[#3a689f]">Loaded: {createRubricFileName}</span>
              ) : (
                <span className="text-xs text-[#3a689f]">Upload a text file with one rubric step per line.</span>
              )}
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {createType !== "HOMEWORK" ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">Time Frame (Minutes)</span>
                  <input
                    className="brand-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Assignment time frame in minutes"
                    aria-label="Assignment time frame in minutes"
                    value={createTimerMinutes}
                    onChange={(event) => setCreateTimerMinutes(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">Attempt Scoring Strategy</span>
              <select
                className="brand-input"
                aria-label="Attempt scoring strategy"
                value={createAttemptScoringStrategy}
                onChange={(event) => setCreateAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
              >
                <option value="LATEST">Attempt Rule: Latest attempt counts</option>
                <option value="HIGHEST">Attempt Rule: Highest attempt counts</option>
              </select>
            </label>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={createAllowLateSubmissions}
                onChange={(event) => setCreateAllowLateSubmissions(event.currentTarget.checked)}
              />
              Allow late submissions
            </label>
            <div className={`grid gap-3 ${createType === "QUIZ" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">Assignment Type</span>
                <select className="brand-input" aria-label="Assignment type" value={createType} onChange={(event) => setCreateType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                  <option value="HOMEWORK">HOMEWORK</option>
                  <option value="QUIZ">QUIZ</option>
                  <option value="EXAM">EXAM</option>
                </select>
              </label>
              {createType !== "QUIZ" ? (
                <>
                  <div className="grid gap-1.5">
                    <span className="brand-label">Allow Text Submissions</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={createAllowedText} onChange={(event) => setCreateAllowedText(event.currentTarget.checked)} /> TEXT</label>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="brand-label">Allow File Submissions</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={createAllowedFile} onChange={(event) => setCreateAllowedFile(event.currentTarget.checked)} /> FILE</label>
                  </div>
                </>
              ) : null}
            </div>
            {isQuestionAssignment(createType) ? (
              <div className="grid gap-3">
                <div className="rounded-md border border-[#dbe9fb] p-3">
                  <p className="brand-label">
                    {createType === "QUIZ" ? "Quiz MCQ Builder" : "Exam Question Builder (MCQ + Short Answer)"}
                  </p>
                  <div className="mt-2 grid gap-2">
                    <label className="grid gap-1.5">
                      <span className="brand-label">Question Prompt</span>
                      <input
                        className="brand-input"
                        placeholder="Question prompt"
                        aria-label="Draft question prompt"
                        value={createQuestionPrompt}
                        onChange={(event) => setCreateQuestionPrompt(event.currentTarget.value)}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="brand-label">Question Type</span>
                      <select
                        className="brand-input"
                        value={createQuestionType}
                        onChange={(event) => setCreateQuestionType(event.currentTarget.value as "MCQ" | "SHORT_ANSWER")}
                      >
                        <option value="MCQ">Multiple Choice (MCQ)</option>
                        {createType === "EXAM" ? <option value="SHORT_ANSWER">Short Answer</option> : null}
                      </select>
                    </label>
                    {createQuestionType === "MCQ" ? (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="grid gap-1.5">
                            <span className="brand-label">Option A</span>
                            <input className="brand-input" placeholder="Option A" aria-label="Draft option A" value={createQuestionOptionA} onChange={(event) => setCreateQuestionOptionA(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">Option B</span>
                            <input className="brand-input" placeholder="Option B" aria-label="Draft option B" value={createQuestionOptionB} onChange={(event) => setCreateQuestionOptionB(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">Option C</span>
                            <input className="brand-input" placeholder="Option C (optional)" aria-label="Draft option C" value={createQuestionOptionC} onChange={(event) => setCreateQuestionOptionC(event.currentTarget.value)} />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="brand-label">Option D</span>
                            <input className="brand-input" placeholder="Option D (optional)" aria-label="Draft option D" value={createQuestionOptionD} onChange={(event) => setCreateQuestionOptionD(event.currentTarget.value)} />
                          </label>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="grid gap-1.5">
                            <span className="brand-label">Correct Options</span>
                            <div className="grid gap-2 rounded-md border border-[#dbe9fb] p-2 text-sm text-[#234f8f]">
                              {[
                                { label: "Option A", value: createQuestionOptionA, index: 0 },
                                { label: "Option B", value: createQuestionOptionB, index: 1 },
                                { label: "Option C", value: createQuestionOptionC, index: 2 },
                                { label: "Option D", value: createQuestionOptionD, index: 3 },
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
                            <span className="brand-label">Question Points</span>
                            <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Draft question points" value={createQuestionPoints} onChange={(event) => setCreateQuestionPoints(event.currentTarget.value)} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="brand-label">Reference Answer (Optional)</span>
                          <input
                            className="brand-input"
                            placeholder="Reference answer for teacher"
                            value={createQuestionShortAnswerKey}
                            onChange={(event) => setCreateQuestionShortAnswerKey(event.currentTarget.value)}
                          />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="brand-label">Question Points</span>
                          <input className="brand-input" type="number" min="0.5" step="0.5" aria-label="Draft question points" value={createQuestionPoints} onChange={(event) => setCreateQuestionPoints(event.currentTarget.value)} />
                        </label>
                      </div>
                    )}
                    <button type="button" className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" onClick={addDraftQuestion}>
                      Add To Draft
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {createDraftQuestions.length === 0 ? <p className="brand-muted text-sm">No draft questions added yet.</p> : null}
                    {createDraftQuestions.map((question, index) => (
                      <div key={`${question.prompt}_${index}`} className="rounded-md border border-[#e7f0fc] p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0d3f80]">
                            Q{index + 1}. {question.prompt}
                          </p>
                          <button
                            type="button"
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                            onClick={() =>
                              setCreateDraftQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-[#3768ac]">Points: {question.points}</p>
                        <p className="mt-1 text-xs text-[#3768ac]">Type: {question.questionType === "SHORT_ANSWER" ? "Short Answer" : "MCQ"}</p>
                        {question.questionType === "MCQ" ? (
                          <p className="mt-1 text-xs text-[#3768ac]">Correct: {formatOptionIndexes(question.correctOptionIndexes)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className={`grid gap-3 ${createType === "HOMEWORK" ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">Start Date</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label="Start date"
                  value={createStartAt}
                  onChange={(event) => setCreateStartAt(event.currentTarget.value)}
                  required
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">End Date</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label="End date"
                  value={createEndAt}
                  onChange={(event) => setCreateEndAt(event.currentTarget.value)}
                  required
                />
              </label>
              {createType === "HOMEWORK" ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Start Time</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label="Start time"
                      value={createStartTime}
                      onChange={(event) => setCreateStartTime(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">End Time</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label="End time"
                      value={createEndTime}
                      onChange={(event) => setCreateEndTime(event.currentTarget.value)}
                      required
                    />
                  </label>
                </>
              ) : null}
              <label className="grid gap-1.5">
                <span className="brand-label">Maximum Points</span>
                <input className="brand-input" type="number" min="1" step="0.01" aria-label="Maximum points" value={createMaxPoints} onChange={(event) => setCreateMaxPoints(event.currentTarget.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Maximum Attempts</span>
                <input className="brand-input" type="number" min="1" step="1" aria-label="Maximum attempts" value={createAttempts} onChange={(event) => setCreateAttempts(event.currentTarget.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">Module Link</span>
                <select
                  className="brand-input"
                  aria-label="Module link"
                  value={createModuleId}
                  onChange={(event) => {
                    const nextModuleId = event.currentTarget.value;
                    setCreateModuleId(nextModuleId);
                    setCreateLessonId("");
                  }}
                >
                  <option value="">No module link</option>
                  {(structureByCourseId[createCourseId] ?? []).map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Lesson Link</span>
                <select
                  className="brand-input"
                  aria-label="Lesson link"
                  value={createLessonId}
                  onChange={(event) => setCreateLessonId(event.currentTarget.value)}
                  disabled={!createModuleId}
                >
                  <option value="">No lesson link</option>
                  {(structureByCourseId[createCourseId] ?? [])
                    .find((module) => module.id === createModuleId)
                    ?.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    )) ?? null}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={createPending}>
                {createPending ? "Creating..." : "Create Assignment"}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
        </div>
      ) : null}

      {canManage && editId ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#06254d]/40 p-4 md:p-8">
        <section className="brand-card min-w-0 w-full max-w-4xl overflow-hidden p-5">
          <p className="brand-section-title">Edit Assignment</p>
          <form className="mt-3 grid gap-3" onSubmit={onUpdate}>
            <label className="grid gap-1.5">
              <span className="brand-label">Assignment Title</span>
              <input className="brand-input" aria-label="Assignment title" value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} required />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Instructions</span>
              <textarea className="brand-input min-h-[84px]" aria-label="Instructions" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Rubric Steps</span>
              <textarea className="brand-input min-h-[84px]" aria-label="Rubric steps" value={editRubric} onChange={(event) => setEditRubric(event.currentTarget.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Rubric File</span>
              <input
                className="brand-input"
                type="file"
                accept=".txt,.csv"
                aria-label="Upload rubric file"
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
                <span className="text-xs text-[#3a689f]">Loaded: {editRubricFileName}</span>
              ) : (
                <span className="text-xs text-[#3a689f]">Upload a text file with one rubric step per line.</span>
              )}
            </label>
            
            <div className="grid gap-3 md:grid-cols-3">
              {editType !== "HOMEWORK" ? (
                <label className="grid gap-1.5">
                  <span className="brand-label">Time Frame (Minutes)</span>
                  <input
                    className="brand-input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Assignment time frame in minutes"
                    aria-label="Assignment time frame in minutes"
                    value={editTimerMinutes}
                    onChange={(event) => setEditTimerMinutes(event.currentTarget.value)}
                  />
                </label>
              ) : null}
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">Attempt Scoring Strategy</span>
              <select
                className="brand-input"
                aria-label="Attempt scoring strategy"
                value={editAttemptScoringStrategy}
                onChange={(event) => setEditAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
              >
                <option value="LATEST">Attempt Rule: Latest attempt counts</option>
                <option value="HIGHEST">Attempt Rule: Highest attempt counts</option>
              </select>
            </label>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={editAllowLateSubmissions}
                onChange={(event) => setEditAllowLateSubmissions(event.currentTarget.checked)}
              />
              Allow late submissions
            </label>
            <div className={`grid gap-3 ${editType === "QUIZ" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">Assignment Type</span>
                <select className="brand-input" aria-label="Assignment type" value={editType} onChange={(event) => setEditType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                  <option value="HOMEWORK">HOMEWORK</option>
                  <option value="QUIZ">QUIZ</option>
                  <option value="EXAM">EXAM</option>
                </select>
              </label>
              {editType !== "QUIZ" ? (
                <>
                  <div className="grid gap-1.5">
                    <span className="brand-label">Allow Text Submissions</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedText} onChange={(event) => setEditAllowedText(event.currentTarget.checked)} /> TEXT</label>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="brand-label">Allow File Submissions</span>
                    <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedFile} onChange={(event) => setEditAllowedFile(event.currentTarget.checked)} /> FILE</label>
                  </div>
                </>
              ) : null}
            </div>
            <div className={`grid gap-3 ${editType === "HOMEWORK" ? "md:grid-cols-6" : "md:grid-cols-4"}`}>
              <label className="grid gap-1.5">
                <span className="brand-label">Start Date</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label="Start date"
                  value={editStartAt}
                  onChange={(event) => setEditStartAt(event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">End Date</span>
                <input
                  className="brand-input"
                  type="date"
                  aria-label="End date"
                  value={editEndAt}
                  onChange={(event) => setEditEndAt(event.currentTarget.value)}
                />
              </label>
              {editType === "HOMEWORK" ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="brand-label">Start Time</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label="Start time"
                      value={editStartTime}
                      onChange={(event) => setEditStartTime(event.currentTarget.value)}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="brand-label">End Time</span>
                    <input
                      className="brand-input"
                      type="time"
                      aria-label="End time"
                      value={editEndTime}
                      onChange={(event) => setEditEndTime(event.currentTarget.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className="grid gap-1.5">
                <span className="brand-label">Maximum Points</span>
                <input className="brand-input" type="number" min="1" step="0.01" aria-label="Maximum points" value={editMaxPoints} onChange={(event) => setEditMaxPoints(event.currentTarget.value)} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Maximum Attempts</span>
                <input className="brand-input" type="number" min="1" step="1" aria-label="Maximum attempts" value={editAttempts} onChange={(event) => setEditAttempts(event.currentTarget.value)} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">Module Link</span>
                <select
                  className="brand-input"
                  aria-label="Module link"
                  value={editModuleId}
                  onChange={(event) => {
                    const nextModuleId = event.currentTarget.value;
                    setEditModuleId(nextModuleId);
                    setEditLessonId("");
                  }}
                >
                  <option value="">No module link</option>
                  {(structureByCourseId[editAssignment?.courseId ?? ""] ?? []).map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Lesson Link</span>
                <select
                  className="brand-input"
                  aria-label="Lesson link"
                  value={editLessonId}
                  onChange={(event) => setEditLessonId(event.currentTarget.value)}
                  disabled={!editModuleId}
                >
                  <option value="">No lesson link</option>
                  {(structureByCourseId[editAssignment?.courseId ?? ""] ?? [])
                    .find((module) => module.id === editModuleId)
                    ?.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    )) ?? null}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-brand-secondary px-4 py-2 text-sm font-semibold" disabled={editPending}>
                {editPending ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]" onClick={() => setEditId("")}>Cancel</button>
            </div>
          </form>
        </section>
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirmDeleteAssignmentId}
        title="Delete Assignment"
        message="Delete this assignment and related submissions?"
        confirmLabel="Delete"
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
        title="Invalidate Attempt"
        message="This will cancel the selected attempt and allow student resubmission if attempt limit allows."
        confirmLabel="Invalidate"
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
