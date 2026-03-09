"use client";

import { useEffect, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";

type InboxMessage = {
  id: string;
  courseId: string;
  courseTitle: string;
  senderId: string;
  senderName: string | null;
  senderEmail: string;
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

export function TeacherMessagesModule() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/messages");
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { messages?: InboxMessage[]; error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to load messages.");
        return;
      }
      setMessages(result.messages ?? []);
    } catch {
      setError("Unable to load messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (messageId: string) => {
    setPendingId(messageId);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!response.ok) return;
      await load();
    } finally {
      setPendingId("");
    }
  };

  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">Department Head Messages</p>
      {loading ? <div className="mt-3"><LoadingIndicator label="Loading messages..." /></div> : null}
      <ToastMessage type="error" message={error} />
      {!loading && !messages.length ? <p className="brand-muted mt-3 text-sm">No messages yet.</p> : null}
      {messages.length ? (
        <div className="mt-4 space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="rounded-md border border-[#dbe9fb] bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0d3f80]">{message.subject}</p>
                  <p className="mt-1 text-xs text-[#3a689f]">
                    Course: {message.courseTitle} | From: {message.senderName || "Department Head"} ({message.senderEmail})
                  </p>
                </div>
                <div className="text-xs text-[#3a689f]">
                  <p>Sent: {formatDateTime(message.createdAt)}</p>
                  <p>Read: {message.readAt ? formatDateTime(message.readAt) : "Unread"}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#2f5f98]">{message.body}</p>
              {!message.readAt ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-[#1f518f] underline disabled:opacity-60"
                  onClick={() => markRead(message.id)}
                  disabled={pendingId === message.id}
                >
                  {pendingId === message.id ? "Marking..." : "Mark as read"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
