"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";

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

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export function DepartmentHeadOversightModule() {
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
        setError(result.error ?? "Unable to load oversight data.");
        return;
      }
      setCourses(result.courses ?? []);
      setCourseId((prev) => prev || result.courses?.[0]?.id || "");
    } catch {
      setError("Unable to load oversight data.");
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
        setMessageError(result.error ?? "Unable to load messages.");
        return;
      }
      setMessages(result.messages ?? []);
    } catch {
      setMessageError("Unable to load messages.");
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
      setMessageError("Select a course before sending a message.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessageError("Subject and message are required.");
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
        setMessageError(result.error ?? "Unable to send message.");
        return;
      }
      setSubject("");
      setBody("");
      setMessageInfo("Message sent to the course teacher.");
      await loadMessages();
    } catch {
      setMessageError("Unable to send message.");
    } finally {
      setPendingSend(false);
    }
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <p className="brand-section-title">Oversight Summary</p>
        {loading ? <div className="mt-3"><LoadingIndicator label="Loading assigned courses..." /></div> : null}
        <ToastMessage type="error" message={error} />
        {!loading && !courses.length ? (
          <p className="brand-muted mt-3 text-sm">No courses assigned yet.</p>
        ) : null}
        {courses.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {courses.map((course) => (
              <article key={course.id} className="rounded-xl border border-[#dbe9fb] bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3b6aa5]">
                  {course.code}
                </p>
                <p className="text-lg font-semibold text-[#0d3f80]">{course.title}</p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  Teacher: {course.teacher?.name || "Unassigned"} {course.teacher ? `(${course.teacher.email})` : ""}
                </p>
                <div className="mt-3 grid gap-2 text-sm text-[#2f5f98]">
                  <span>Enrolled Students: {course.enrollmentCount}</span>
                  <span>Assignments: {course.assignmentCount}</span>
                  <span>Submissions: {course.submissionCount}</span>
                  <span>Grades Published: {course.gradedCount}</span>
                  <span>
                    Average Grade: {course.averageGrade !== null ? course.averageGrade.toFixed(1) : "N/A"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="brand-card p-5">
        <p className="brand-section-title">Message a Teacher</p>
        <form className="mt-3 grid gap-3" onSubmit={onSendMessage}>
          <label className="grid gap-1.5">
            <span className="brand-label">Course</span>
            <select
              className="brand-input"
              value={courseId}
              onChange={(event) => setCourseId(event.currentTarget.value)}
              required
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </label>
          {selectedCourse?.teacher ? (
            <p className="text-xs text-[#3a689f]">
              Sending to: {selectedCourse.teacher.name || "Teacher"} ({selectedCourse.teacher.email})
            </p>
          ) : (
            <p className="text-xs text-amber-700">This course has no assigned teacher.</p>
          )}
          <label className="grid gap-1.5">
            <span className="brand-label">Subject</span>
            <input className="brand-input" value={subject} onChange={(event) => setSubject(event.currentTarget.value)} required />
          </label>
          <label className="grid gap-1.5">
            <span className="brand-label">Message</span>
            <textarea className="brand-input min-h-[110px]" value={body} onChange={(event) => setBody(event.currentTarget.value)} required />
          </label>
          <ToastMessage type="error" message={messageError} />
          <ToastMessage type="success" message={messageInfo} />
          <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={pendingSend || !selectedCourse?.teacher}>
            {pendingSend ? "Sending..." : "Send Message"}
          </button>
        </form>
      </section>

      <section className="brand-card p-5">
        <p className="brand-section-title">Recent Messages Sent</p>
        {messages.length ? (
          <div className="mt-3 space-y-3">
            {messages.map((message) => (
              <article key={message.id} className="rounded-md border border-[#dbe9fb] bg-white/80 p-3">
                <p className="text-sm font-semibold text-[#0d3f80]">{message.subject}</p>
                <p className="mt-1 text-xs text-[#3a689f]">
                  Course: {message.courseTitle} | Teacher: {message.recipientName || "Teacher"} ({message.recipientEmail})
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5f98]">{message.body}</p>
                <p className="mt-2 text-xs text-[#3a689f]">
                  Sent: {formatDateTime(message.createdAt)} | Read: {message.readAt ? formatDateTime(message.readAt) : "Unread"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="brand-muted mt-3 text-sm">No messages sent yet.</p>
        )}
      </section>
    </section>
  );
}
