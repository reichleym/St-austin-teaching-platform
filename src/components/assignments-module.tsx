"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";

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
  dueAt: string | null;
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
  options: string[];
  correctOptionIndex: number;
  points: number;
  position: number;
};

type DraftQuizQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
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

const toDateInput = (value: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const formatMinutes = (minutes: number) => {
  if (!minutes) return "0m";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
};

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
  const canManage = role === "TEACHER";
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdminReadOnly = role === "SUPER_ADMIN" || role === "ADMIN" || role === "DEPARTMENT_HEAD";

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState<"ALL" | "SUBMITTED">("ALL");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const [createCourseId, setCreateCourseId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createDueAt, setCreateDueAt] = useState("");
  const [createMaxPoints, setCreateMaxPoints] = useState("100");
  const [createType, setCreateType] = useState<"HOMEWORK" | "QUIZ" | "EXAM">("HOMEWORK");
  const [createAllowedText, setCreateAllowedText] = useState(true);
  const [createAllowedFile, setCreateAllowedFile] = useState(true);
  const [createAttempts, setCreateAttempts] = useState("1");
  const [createAllowLateSubmissions, setCreateAllowLateSubmissions] = useState(true);
  const [createAttemptScoringStrategy, setCreateAttemptScoringStrategy] = useState<"LATEST" | "HIGHEST">("LATEST");
  const [createTimerMinutes, setCreateTimerMinutes] = useState("");
  const [createRubric, setCreateRubric] = useState("");
  const [createModuleId, setCreateModuleId] = useState("");
  const [createLessonId, setCreateLessonId] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [createDraftQuestions, setCreateDraftQuestions] = useState<DraftQuizQuestion[]>([]);
  const [createQuestionPrompt, setCreateQuestionPrompt] = useState("");
  const [createQuestionOptionA, setCreateQuestionOptionA] = useState("");
  const [createQuestionOptionB, setCreateQuestionOptionB] = useState("");
  const [createQuestionOptionC, setCreateQuestionOptionC] = useState("");
  const [createQuestionOptionD, setCreateQuestionOptionD] = useState("");
  const [createQuestionCorrectIndex, setCreateQuestionCorrectIndex] = useState("0");
  const [createQuestionPoints, setCreateQuestionPoints] = useState("1");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editMaxPoints, setEditMaxPoints] = useState("100");
  const [editType, setEditType] = useState<"HOMEWORK" | "QUIZ" | "EXAM">("HOMEWORK");
  const [editAllowedText, setEditAllowedText] = useState(true);
  const [editAllowedFile, setEditAllowedFile] = useState(true);
  const [editAttempts, setEditAttempts] = useState("1");
  const [editAllowLateSubmissions, setEditAllowLateSubmissions] = useState(true);
  const [editAttemptScoringStrategy, setEditAttemptScoringStrategy] = useState<"LATEST" | "HIGHEST">("LATEST");
  const [editTimerMinutes, setEditTimerMinutes] = useState("");
  const [editRubric, setEditRubric] = useState("");
  const [editModuleId, setEditModuleId] = useState("");
  const [editLessonId, setEditLessonId] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState("");
  const [confirmDeleteAssignmentId, setConfirmDeleteAssignmentId] = useState("");

  const [studentTextResponse, setStudentTextResponse] = useState("");
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentQuizAnswers, setStudentQuizAnswers] = useState<Record<string, number>>({});
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
  const [newQuestionCorrectIndex, setNewQuestionCorrectIndex] = useState("0");
  const [newQuestionPoints, setNewQuestionPoints] = useState("1");
  const [createQuestionPending, setCreateQuestionPending] = useState(false);
  const [deleteQuestionPendingId, setDeleteQuestionPendingId] = useState("");
  const [gradeEditRequests, setGradeEditRequests] = useState<GradeEditRequestItem[]>([]);
  const [gradeEditRequestsLoading, setGradeEditRequestsLoading] = useState(false);
  const [requestEditForSubmissionId, setRequestEditForSubmissionId] = useState("");
  const [requestEditReason, setRequestEditReason] = useState("");
  const [requestEditProposedPoints, setRequestEditProposedPoints] = useState("");
  const [requestEditPendingId, setRequestEditPendingId] = useState("");
  const [reviewPendingId, setReviewPendingId] = useState("");
  const [reviewApprovedPointsByRequest, setReviewApprovedPointsByRequest] = useState<Record<string, string>>({});
  const [reviewNoteByRequest, setReviewNoteByRequest] = useState<Record<string, string>>({});

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId]
  );
  const editAssignment = useMemo(
    () => assignments.find((item) => item.id === editId) ?? null,
    [assignments, editId]
  );
  const filteredAssignments = useMemo(() => {
    if (activeMenu === "SUBMITTED") {
      return assignments.filter((item) => (item.submissionCount ?? 0) > 0);
    }
    return assignments;
  }, [activeMenu, assignments]);

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
      setSelectedAssignmentId((prev) => prev || nextAssignments[0]?.id || "");
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
    if (selectedAssignmentId) {
      void loadSubmissions(selectedAssignmentId);
    }
  }, [loadSubmissions, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignmentId || selectedAssignment?.config.assignmentType !== "QUIZ") {
      setQuizQuestions([]);
      setStudentQuizAnswers({});
      setStudentQuizStartedAt(null);
      return;
    }
    void loadQuizQuestions(selectedAssignmentId);
    if (isStudent && !studentQuizStartedAt) {
      setStudentQuizStartedAt(new Date().toISOString());
    }
  }, [isStudent, loadQuizQuestions, selectedAssignment?.config.assignmentType, selectedAssignmentId, studentQuizStartedAt]);

  useEffect(() => {
    if (!isStudent || selectedAssignment?.config.assignmentType !== "QUIZ" || !selectedAssignment.config.timerMinutes) {
      return;
    }
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStudent, selectedAssignment?.config.assignmentType, selectedAssignment?.config.timerMinutes]);

  useEffect(() => {
    if (!editId) return;
    const selected = assignments.find((item) => item.id === editId);
    if (!selected) return;
    setEditTitle(selected.title);
    setEditDescription(selected.description ?? "");
    setEditDueAt(toDateInput(selected.dueAt));
    setEditMaxPoints(String(selected.maxPoints));
    setEditType(selected.config.assignmentType);
    setEditAllowedText(selected.config.allowedSubmissionTypes.includes("TEXT"));
    setEditAllowedFile(selected.config.allowedSubmissionTypes.includes("FILE"));
    setEditAttempts(String(selected.config.maxAttempts));
    setEditAllowLateSubmissions(selected.config.allowLateSubmissions !== false);
    setEditAttemptScoringStrategy(selected.config.attemptScoringStrategy ?? "LATEST");
    setEditTimerMinutes(selected.config.timerMinutes ? String(selected.config.timerMinutes) : "");
    setEditRubric(selected.config.rubricSteps.join("\n"));
    setEditModuleId(selected.config.moduleId ?? "");
    setEditLessonId(selected.config.lessonId ?? "");
    void loadCourseStructure(selected.courseId);
  }, [assignments, editId, loadCourseStructure]);

  const buildAllowedTypes = (allowText: boolean, allowFile: boolean) => {
    const allowed: Array<"TEXT" | "FILE"> = [];
    if (allowText) allowed.push("TEXT");
    if (allowFile) allowed.push("FILE");
    return allowed.length ? allowed : (["TEXT"] as Array<"TEXT" | "FILE">);
  };

  const addDraftQuestion = () => {
    const prompt = createQuestionPrompt.trim();
    const options = [createQuestionOptionA, createQuestionOptionB, createQuestionOptionC, createQuestionOptionD]
      .map((item) => item.trim())
      .filter(Boolean);
    const correctOptionIndex = Number(createQuestionCorrectIndex);
    const points = Number(createQuestionPoints);

    if (!prompt || options.length < 2) {
      setError("Quiz question needs a prompt and at least two options.");
      return;
    }
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      setError("Select a valid correct option for the quiz question.");
      return;
    }
    if (!Number.isFinite(points) || points <= 0) {
      setError("Quiz question points must be greater than zero.");
      return;
    }

    setCreateDraftQuestions((prev) => [...prev, { prompt, options, correctOptionIndex, points }]);
    setCreateQuestionPrompt("");
    setCreateQuestionOptionA("");
    setCreateQuestionOptionB("");
    setCreateQuestionOptionC("");
    setCreateQuestionOptionD("");
    setCreateQuestionCorrectIndex("0");
    setCreateQuestionPoints("1");
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatePending(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: createCourseId,
          title: createTitle,
          description: createDescription,
          dueAt: createDueAt || null,
          maxPoints: createMaxPoints,
          assignmentType: createType,
          allowedSubmissionTypes: buildAllowedTypes(createAllowedText, createAllowedFile),
          maxAttempts: Number(createAttempts),
          allowLateSubmissions: createAllowLateSubmissions,
          attemptScoringStrategy: createAttemptScoringStrategy,
          timerMinutes: createType === "QUIZ" ? Number(createTimerMinutes || 0) || null : null,
          rubricSteps: createRubric.split("\n").map((item) => item.trim()).filter(Boolean),
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
      if (createType === "QUIZ" && createdAssignmentId && createDraftQuestions.length > 0) {
        for (const question of createDraftQuestions) {
          const questionResponse = await fetch("/api/assignments/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignmentId: createdAssignmentId,
              prompt: question.prompt,
              options: question.options,
              correctOptionIndex: question.correctOptionIndex,
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
      setCreateDueAt("");
      setCreateMaxPoints("100");
      setCreateType("HOMEWORK");
      setCreateAttempts("1");
      setCreateAllowLateSubmissions(true);
      setCreateAttemptScoringStrategy("LATEST");
      setCreateTimerMinutes("");
      setCreateRubric("");
      setCreateModuleId("");
      setCreateLessonId("");
      setCreateAllowedText(true);
      setCreateAllowedFile(true);
      setCreateDraftQuestions([]);
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
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: editId,
          title: editTitle,
          description: editDescription,
          dueAt: editDueAt || null,
          maxPoints: editMaxPoints,
          assignmentType: editType,
          allowedSubmissionTypes: buildAllowedTypes(editAllowedText, editAllowedFile),
          maxAttempts: Number(editAttempts),
          allowLateSubmissions: editAllowLateSubmissions,
          attemptScoringStrategy: editAttemptScoringStrategy,
          timerMinutes: editType === "QUIZ" ? Number(editTimerMinutes || 0) || null : null,
          rubricSteps: editRubric.split("\n").map((item) => item.trim()).filter(Boolean),
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
    if (!selectedAssignment || selectedAssignment.config.assignmentType !== "QUIZ") return;
    setCreateQuestionPending(true);
    setError("");
    try {
      const options = [newQuestionOptionA, newQuestionOptionB, newQuestionOptionC, newQuestionOptionD]
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/assignments/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          prompt: newQuestionPrompt,
          options,
          correctOptionIndex: Number(newQuestionCorrectIndex),
          points: Number(newQuestionPoints),
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
      setNewQuestionCorrectIndex("0");
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
          assignmentId: selectedAssignment.id,
          textResponse: studentTextResponse,
          fileUrl,
          fileName,
          mimeType,
          quizStartedAt: selectedAssignment.config.assignmentType === "QUIZ" ? studentQuizStartedAt : null,
          quizAnswers:
            selectedAssignment.config.assignmentType === "QUIZ"
              ? Object.entries(studentQuizAnswers).map(([questionId, selectedOptionIndex]) => ({
                  questionId,
                  selectedOptionIndex,
                }))
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
      setStudentQuizStartedAt(new Date().toISOString());
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
      const response = await fetch("/api/assignments/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          rawScore: gradeRawScoreBySubmission[submissionId] ?? undefined,
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
    if (
      !isStudent ||
      selectedAssignment?.config.assignmentType !== "QUIZ" ||
      !selectedAssignment.config.timerMinutes ||
      !studentQuizStartedAt
    ) {
      return null;
    }
    const startedAt = new Date(studentQuizStartedAt).getTime();
    if (Number.isNaN(startedAt)) return null;
    const limitMs = selectedAssignment.config.timerMinutes * 60 * 1000;
    const remainingMs = Math.max(0, startedAt + limitMs - nowTick);
    return Math.floor(remainingMs / 1000);
  }, [isStudent, nowTick, selectedAssignment, studentQuizStartedAt]);

  const studentAttemptCount = isStudent ? submissions.length : 0;
  const studentCanSubmit = useMemo(() => {
    if (!isStudent || !selectedAssignment) return false;
    if (selectedAssignment.config.assignmentType === "QUIZ") {
      return studentAttemptCount < selectedAssignment.config.maxAttempts;
    }
    return studentAttemptCount === 0;
  }, [isStudent, selectedAssignment, studentAttemptCount]);

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
                  <input
                    className="brand-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Approved points (optional)"
                    value={reviewApprovedPointsByRequest[request.id] ?? ""}
                    onChange={(event) =>
                      setReviewApprovedPointsByRequest((prev) => ({ ...prev, [request.id]: event.currentTarget.value }))
                    }
                  />
                  <input
                    className="brand-input"
                    placeholder="Review note (optional)"
                    value={reviewNoteByRequest[request.id] ?? ""}
                    onChange={(event) =>
                      setReviewNoteByRequest((prev) => ({ ...prev, [request.id]: event.currentTarget.value }))
                    }
                  />
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${activeMenu === "ALL" ? "border-[#2d6fbf] bg-[#edf5ff] text-[#114b8d]" : "border-[#9bbfed] text-[#1f518f]"}`}
              onClick={() => setActiveMenu("ALL")}
            >
              All Assignments
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${activeMenu === "SUBMITTED" ? "border-[#2d6fbf] bg-[#edf5ff] text-[#114b8d]" : "border-[#9bbfed] text-[#1f518f]"}`}
              onClick={() => setActiveMenu("SUBMITTED")}
            >
              Submitted Only
            </button>
            {canManage ? (
              <button type="button" className="btn-brand-primary px-3 py-1.5 text-xs font-semibold" onClick={() => setShowCreateModal(true)}>
                Create Assignment
              </button>
            ) : null}
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
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
                <th className="px-3 py-2 font-semibold">Due</th>
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
                  onClick={() => setSelectedAssignmentId(item.id)}
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
                  <td className="px-3 py-2">{formatDate(item.dueAt)}</td>
                  <td className="px-3 py-2">{item.maxPoints}</td>
                  <td className="px-3 py-2">{item.submissionCount ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
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
          <p className="brand-muted mt-3 text-sm">{activeMenu === "SUBMITTED" ? "No submitted assignments yet." : "No assignments found."}</p>
        ) : null}
      </section>

      {selectedAssignment ? (
        <section className="brand-card min-w-0 overflow-hidden p-5">
          <p className="brand-section-title">Assignment Workspace: {selectedAssignment.title}</p>
          <p className="brand-muted mt-2 break-words text-sm">
            Submission Types: {selectedAssignment.config.allowedSubmissionTypes.join(", ")} | Rubric Steps: {selectedAssignment.config.rubricSteps.length}
            {selectedAssignment.config.assignmentType === "QUIZ" && selectedAssignment.config.timerMinutes
              ? ` | Timer: ${selectedAssignment.config.timerMinutes} min`
              : ""}
          </p>

          {isStudent ? (
            <form className="mt-3 grid gap-3" onSubmit={onStudentSubmit}>
              {submissionsLoading ? <p className="brand-muted text-sm">Checking your submission status...</p> : null}
              {!submissionsLoading && !studentCanSubmit ? (
                <p className="rounded-md border border-[#dbe9fb] bg-[#f8fbff] px-3 py-2 text-sm text-[#1f518f]">
                  {selectedAssignment.config.assignmentType === "QUIZ"
                    ? "You have reached the maximum quiz attempts."
                    : "You already submitted this assignment. Resubmission is not allowed."}
                </p>
              ) : null}
              {selectedAssignment.config.assignmentType === "QUIZ" ? (
                <>
                  {quizRemainingSeconds !== null ? (
                    <p className="text-sm font-semibold text-[#1f518f]">
                      Time Remaining: {Math.floor(quizRemainingSeconds / 60)}m {quizRemainingSeconds % 60}s
                    </p>
                  ) : null}
                  {quizQuestionsLoading ? <p className="brand-muted text-sm">Loading quiz questions...</p> : null}
                  {quizQuestions.map((question, index) => (
                    <div key={question.id} className="rounded-md border border-[#dbe9fb] p-3">
                      <p className="text-sm font-semibold text-[#0d3f80]">
                        Q{index + 1}. {question.prompt} ({question.points} pts)
                      </p>
                      <div className="mt-2 grid gap-2">
                        {question.options.map((option, optionIndex) => (
                          <label key={`${question.id}_${optionIndex}`} className="inline-flex items-center gap-2 text-sm text-[#234f8f]">
                            <input
                              type="radio"
                              name={`quiz_${question.id}`}
                              checked={studentQuizAnswers[question.id] === optionIndex}
                              onChange={() =>
                                setStudentQuizAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                              }
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
              {selectedAssignment.config.assignmentType !== "QUIZ" && selectedAssignment.config.allowedSubmissionTypes.includes("TEXT") ? (
                <textarea
                  className="brand-input min-h-[100px]"
                  placeholder="Text response"
                  value={studentTextResponse}
                  onChange={(event) => setStudentTextResponse(event.currentTarget.value)}
                />
              ) : null}
              {selectedAssignment.config.assignmentType !== "QUIZ" && selectedAssignment.config.allowedSubmissionTypes.includes("FILE") ? (
                <input type="file" className="brand-input" onChange={(event) => setStudentFile(event.currentTarget.files?.[0] ?? null)} />
              ) : null}
              {studentCanSubmit ? (
                <button
                  className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold"
                  disabled={studentPending || submissionsLoading || (selectedAssignment.config.assignmentType === "QUIZ" && quizRemainingSeconds === 0)}
                >
                  {studentPending ? "Submitting..." : "Submit Attempt"}
                </button>
              ) : null}
            </form>
          ) : null}

          {canManage && selectedAssignment.config.assignmentType === "QUIZ" ? (
            <div className="mt-4 rounded-md border border-[#dbe9fb] p-3">
              <p className="brand-label">Quiz Questions (MCQ)</p>
              <form className="mt-2 grid gap-2" onSubmit={onCreateQuestion}>
                <input
                  className="brand-input"
                  placeholder="Question prompt"
                  value={newQuestionPrompt}
                  onChange={(event) => setNewQuestionPrompt(event.currentTarget.value)}
                  required
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <input className="brand-input" placeholder="Option A" value={newQuestionOptionA} onChange={(event) => setNewQuestionOptionA(event.currentTarget.value)} required />
                  <input className="brand-input" placeholder="Option B" value={newQuestionOptionB} onChange={(event) => setNewQuestionOptionB(event.currentTarget.value)} required />
                  <input className="brand-input" placeholder="Option C (optional)" value={newQuestionOptionC} onChange={(event) => setNewQuestionOptionC(event.currentTarget.value)} />
                  <input className="brand-input" placeholder="Option D (optional)" value={newQuestionOptionD} onChange={(event) => setNewQuestionOptionD(event.currentTarget.value)} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select className="brand-input" value={newQuestionCorrectIndex} onChange={(event) => setNewQuestionCorrectIndex(event.currentTarget.value)}>
                    <option value="0">Correct: Option A</option>
                    <option value="1">Correct: Option B</option>
                    <option value="2">Correct: Option C</option>
                    <option value="3">Correct: Option D</option>
                  </select>
                  <input className="brand-input" type="number" min="0.5" step="0.5" value={newQuestionPoints} onChange={(event) => setNewQuestionPoints(event.currentTarget.value)} />
                </div>
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
                      <button
                        type="button"
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700"
                        disabled={deleteQuestionPendingId === question.id}
                        onClick={() => void onDeleteQuestion(question.id)}
                      >
                        {deleteQuestionPendingId === question.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-[#3768ac]">Points: {question.points}</p>
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
                          <td className="px-3 py-2">{submission.status}</td>
                          <td className="px-3 py-2">
                            {submission.plagiarismStatus === "COMPLETED"
                              ? `${plagiarismBand(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)`
                              : submission.plagiarismStatus ?? "-"}
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
                      Plagiarism: {submission.plagiarismStatus ?? "PENDING"}
                      {submission.plagiarismStatus === "COMPLETED" ? ` | ${plagiarismBand(submission.plagiarismScore)} (${submission.plagiarismScore ?? 0}%)` : ""}
                      {submission.plagiarismSummary ? ` | ${submission.plagiarismSummary}` : ""}
                    </p>
                  ) : null}
                  {submission.textResponse ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#0d3f80]">{submission.textResponse}</p> : null}
                  {submission.fileUrl ? (
                    <a href={submission.fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-[#1f518f] underline">
                      {submission.fileName || "Open submitted file"}
                    </a>
                  ) : null}

                  {canManage && submission.status !== "ATTEMPT_CANCELLED" && !isPublishedOrLockedState(submission.status) ? (
                    <div className="mt-3 grid gap-2">
                      <input
                        className="brand-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Raw score"
                        value={gradeRawScoreBySubmission[submission.id] ?? (submission.rawScore?.toString() ?? "")}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setGradeRawScoreBySubmission((prev) => ({ ...prev, [submission.id]: nextValue }));
                        }}
                      />
                      <textarea
                        className="brand-input min-h-[72px]"
                        placeholder="Feedback"
                        value={gradeFeedbackBySubmission[submission.id] ?? (submission.feedback ?? "")}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;
                          setGradeFeedbackBySubmission((prev) => ({ ...prev, [submission.id]: nextValue }));
                        }}
                      />
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
                              <textarea
                                className="brand-input min-h-[78px]"
                                placeholder="Reason for grade edit request"
                                value={requestEditReason}
                                onChange={(event) => setRequestEditReason(event.currentTarget.value)}
                              />
                              <input
                                className="brand-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Proposed points"
                                value={requestEditProposedPoints}
                                onChange={(event) => setRequestEditProposedPoints(event.currentTarget.value)}
                                required
                              />
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
            <select className="brand-input" value={createCourseId} onChange={(event) => setCreateCourseId(event.currentTarget.value)} required>
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.code} - {course.title}</option>
              ))}
            </select>
            <input className="brand-input" placeholder="Assignment title" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} required />
            <textarea className="brand-input min-h-[84px]" placeholder="Instructions" value={createDescription} onChange={(event) => setCreateDescription(event.currentTarget.value)} />
            <textarea className="brand-input min-h-[84px]" placeholder="Rubric steps (one per line)" value={createRubric} onChange={(event) => setCreateRubric(event.currentTarget.value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <input className="brand-input" type="date" value={createDueAt} onChange={(event) => setCreateDueAt(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="0.01" value={createMaxPoints} onChange={(event) => setCreateMaxPoints(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="1" value={createAttempts} onChange={(event) => setCreateAttempts(event.currentTarget.value)} />
            </div>
            <select
              className="brand-input"
              value={createAttemptScoringStrategy}
              onChange={(event) => setCreateAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
            >
              <option value="LATEST">Attempt Rule: Latest attempt counts</option>
              <option value="HIGHEST">Attempt Rule: Highest attempt counts</option>
            </select>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={createAllowLateSubmissions}
                onChange={(event) => setCreateAllowLateSubmissions(event.currentTarget.checked)}
              />
              Allow late submissions
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <select className="brand-input" value={createType} onChange={(event) => setCreateType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                <option value="HOMEWORK">HOMEWORK</option>
                <option value="QUIZ">QUIZ</option>
                <option value="EXAM">EXAM</option>
              </select>
              <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={createAllowedText} onChange={(event) => setCreateAllowedText(event.currentTarget.checked)} /> TEXT</label>
              <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={createAllowedFile} onChange={(event) => setCreateAllowedFile(event.currentTarget.checked)} /> FILE</label>
            </div>
            {createType === "QUIZ" ? (
              <div className="grid gap-3">
                <input
                  className="brand-input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Quiz timer (minutes)"
                  value={createTimerMinutes}
                  onChange={(event) => setCreateTimerMinutes(event.currentTarget.value)}
                />
                <div className="rounded-md border border-[#dbe9fb] p-3">
                  <p className="brand-label">Quiz MCQ Builder</p>
                  <div className="mt-2 grid gap-2">
                    <input
                      className="brand-input"
                      placeholder="Question prompt"
                      value={createQuestionPrompt}
                      onChange={(event) => setCreateQuestionPrompt(event.currentTarget.value)}
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input className="brand-input" placeholder="Option A" value={createQuestionOptionA} onChange={(event) => setCreateQuestionOptionA(event.currentTarget.value)} />
                      <input className="brand-input" placeholder="Option B" value={createQuestionOptionB} onChange={(event) => setCreateQuestionOptionB(event.currentTarget.value)} />
                      <input className="brand-input" placeholder="Option C (optional)" value={createQuestionOptionC} onChange={(event) => setCreateQuestionOptionC(event.currentTarget.value)} />
                      <input className="brand-input" placeholder="Option D (optional)" value={createQuestionOptionD} onChange={(event) => setCreateQuestionOptionD(event.currentTarget.value)} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <select className="brand-input" value={createQuestionCorrectIndex} onChange={(event) => setCreateQuestionCorrectIndex(event.currentTarget.value)}>
                        <option value="0">Correct: Option A</option>
                        <option value="1">Correct: Option B</option>
                        <option value="2">Correct: Option C</option>
                        <option value="3">Correct: Option D</option>
                      </select>
                      <input className="brand-input" type="number" min="0.5" step="0.5" value={createQuestionPoints} onChange={(event) => setCreateQuestionPoints(event.currentTarget.value)} />
                    </div>
                    <button type="button" className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold" onClick={addDraftQuestion}>
                      Add To Quiz Draft
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
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="brand-input"
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
              <select
                className="brand-input"
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
            <input className="brand-input" value={editTitle} onChange={(event) => setEditTitle(event.currentTarget.value)} required />
            <textarea className="brand-input min-h-[84px]" value={editDescription} onChange={(event) => setEditDescription(event.currentTarget.value)} />
            <textarea className="brand-input min-h-[84px]" value={editRubric} onChange={(event) => setEditRubric(event.currentTarget.value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <input className="brand-input" type="date" value={editDueAt} onChange={(event) => setEditDueAt(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="0.01" value={editMaxPoints} onChange={(event) => setEditMaxPoints(event.currentTarget.value)} />
              <input className="brand-input" type="number" min="1" step="1" value={editAttempts} onChange={(event) => setEditAttempts(event.currentTarget.value)} />
            </div>
            <select
              className="brand-input"
              value={editAttemptScoringStrategy}
              onChange={(event) => setEditAttemptScoringStrategy(event.currentTarget.value as "LATEST" | "HIGHEST")}
            >
              <option value="LATEST">Attempt Rule: Latest attempt counts</option>
              <option value="HIGHEST">Attempt Rule: Highest attempt counts</option>
            </select>
            <label className="brand-input inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={editAllowLateSubmissions}
                onChange={(event) => setEditAllowLateSubmissions(event.currentTarget.checked)}
              />
              Allow late submissions
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <select className="brand-input" value={editType} onChange={(event) => setEditType(event.currentTarget.value as "HOMEWORK" | "QUIZ" | "EXAM") }>
                <option value="HOMEWORK">HOMEWORK</option>
                <option value="QUIZ">QUIZ</option>
                <option value="EXAM">EXAM</option>
              </select>
              <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedText} onChange={(event) => setEditAllowedText(event.currentTarget.checked)} /> TEXT</label>
              <label className="brand-input inline-flex items-center gap-2"><input type="checkbox" checked={editAllowedFile} onChange={(event) => setEditAllowedFile(event.currentTarget.checked)} /> FILE</label>
            </div>
            {editType === "QUIZ" ? (
              <input
                className="brand-input"
                type="number"
                min="1"
                step="1"
                placeholder="Quiz timer (minutes)"
                value={editTimerMinutes}
                onChange={(event) => setEditTimerMinutes(event.currentTarget.value)}
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="brand-input"
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
              <select
                className="brand-input"
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
