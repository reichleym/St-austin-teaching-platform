"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLanguage } from "@/components/language-provider";
import { getLanguageLocale, translateContent } from "@/lib/i18n";

type CourseOverview = {
  id: string;
  code: string;
  title: string;
  teacher: { id: string; name: string | null; email: string } | null;
  enrollmentCount: number;
  assignmentCount: number;
  submissionCount: number;
  gradedCount: number;
  averageGrade: number | null;
};

type SentMessage = {
  id: string;
  courseId: string;
  courseTitle: string;
  recipientName: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export function DepartmentHeadOversightModule() {
  const { t, language } = useLanguage();
  const locale = getLanguageLocale(language);
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [messageInfo, setMessageInfo] = useState("");
  const [pendingSend, setPendingSend] = useState(false);

  const [courseId, setCourseId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/department-head/oversight");
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { courses?: CourseOverview[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("oversight.errorLoad"));
        return;
      }
      setCourses(result.courses ?? []);
      setCourseId((prev) => prev || result.courses?.[0]?.id || "");
    } catch {
      setError(t("oversight.errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch("/api/messages");
      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as { messages?: SentMessage[]; error?: string })
        : {};
      if (!response.ok) {
        setMessageError(result.error ?? t("messages.errorLoad"));
        return;
      }
      setMessages(result.messages ?? []);
    } catch {
      setMessageError(t("messages.errorLoad"));
    }
  };

  useEffect(() => {
    void load();
    void loadMessages();
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? null,
    [courseId, courses]
  );

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessageError("");
    setMessageInfo("");
    if (!courseId) {
      setMessageError(t("oversight.errorSelectCourse"));
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessageError(t("oversight.errorSubjectBodyRequired"));
      return;
    }
    setPendingSend(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", courseId, subject, body }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setMessageError(result.error ?? t("oversight.errorSendMessage"));
        return;
      }
      setSubject("");
      setBody("");
      setMessageInfo(t("oversight.messageSent"));
      await loadMessages();
    } catch {
      setMessageError(t("oversight.errorSendMessage"));
    } finally {
      setPendingSend(false);
    }
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <p className="brand-section-title">{t("oversight.summaryTitle")}</p>
        {loading ? (
          <div className="mt-3">
            <LoadingIndicator label={t("loading.departmentHeadCourses")} />
          </div>
        ) : null}
        <ToastMessage type="error" message={error} />
        {!loading && !courses.length ? (
          <p className="brand-muted mt-3 text-sm">{t("oversight.noCoursesAssigned")}</p>
        ) : null}
        {courses.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="rounded-xl border border-[#dbe9fb] bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3b6aa5]">
                  {course.code}
                </p>
                <p className="text-lg font-semibold text-[#0d3f80]">{translateContent(language, course.title)}</p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  {t("teacher.label")}: {course.teacher?.name || t("oversight.unassigned")} {course.teacher ? `(${course.teacher.email})` : ""}
                </p>
                <div className="mt-3 grid gap-2 text-sm text-[#2f5f98]">
                  <span>{t("oversight.enrolledStudents")}: {course.enrollmentCount}</span>
                  <span>{t("oversight.assignmentCount")}: {course.assignmentCount}</span>
                  <span>{t("oversight.submissionCount")}: {course.submissionCount}</span>
                  <span>{t("oversight.gradesPublished")}: {course.gradedCount}</span>
                  <span>
                    {t("oversight.averageGrade")}: {course.averageGrade !== null ? course.averageGrade.toFixed(1) : t("common.na")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="brand-card p-5">
        <p className="brand-section-title">{t("oversight.messageTeacher")}</p>
        <form className="mt-3 grid gap-3" onSubmit={onSendMessage}>
          <label className="grid gap-1.5">
            <span className="brand-label">{t("label.course")}</span>
            <select
              className="brand-input"
              value={courseId}
              onChange={(event) => setCourseId(event.currentTarget.value)}
              required
            >
              <option value="">{t("assignment.selectCourse")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {translateContent(language, course.title)}
                </option>
              ))}
            </select>
          </label>
          {selectedCourse?.teacher ? (
            <p className="text-xs text-[#3a689f]">
              {t("oversight.sendingTo")}: {selectedCourse.teacher.name || t("teacher.label")} ({selectedCourse.teacher.email})
            </p>
          ) : (
            <p className="text-xs text-amber-700">{t("oversight.noAssignedTeacher")}</p>
          )}
          <label className="grid gap-1.5">
            <span className="brand-label">{t("label.subject")}</span>
            <input className="brand-input" value={subject} onChange={(event) => setSubject(event.currentTarget.value)} required />
          </label>
          <label className="grid gap-1.5">
            <span className="brand-label">{t("label.message")}</span>
            <textarea className="brand-input min-h-[110px]" value={body} onChange={(event) => setBody(event.currentTarget.value)} required />
          </label>
          <ToastMessage type="error" message={messageError} />
          <ToastMessage type="success" message={messageInfo} />
          <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={pendingSend || !selectedCourse?.teacher}>
            {pendingSend ? t("oversight.sending") : t("action.sendMessage")}
          </button>
        </form>
      </section>

      <section className="brand-card p-5">
        <p className="brand-section-title">{t("oversight.recentMessages")}</p>
        {messages.length ? (
          <div className="mt-3 space-y-3">
            {messages.map((message) => (
              <article key={message.id} className="rounded-md border border-[#dbe9fb] bg-white/80 p-3">
                <p className="text-sm font-semibold text-[#0d3f80]">{translateContent(language, message.subject)}</p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  {t("label.course")}: {translateContent(language, message.courseTitle)} | {t("teacher.label")}: {message.recipientName || t("teacher.label")} ({message.recipientEmail})
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5f98]">{translateContent(language, message.body)}</p>
                <p className="mt-2 text-xs text-[#3a689f]">
                  {t("messages.sent")}: {formatDateTime(message.createdAt, locale)} | {t("messages.read")}: {message.readAt ? formatDateTime(message.readAt, locale) : t("common.unread")}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="brand-muted mt-3 text-sm">{t("oversight.noMessages")}</p>
        )}
      </section>
    </section>
  );
}
