"use client";

import { useEffect, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLanguage } from "@/components/language-provider";
import { getLanguageLocale, translateContent } from "@/lib/i18n";

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

export function TeacherMessagesModule() {
  const { t, language } = useLanguage();
  const locale = getLanguageLocale(language);
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
        setError(result.error ?? t("messages.errorLoad"));
        return;
      }
      setMessages(result.messages ?? []);
    } catch {
      setError(t("messages.errorLoad"));
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
      <p className="brand-section-title">{t("messages.departmentHeadTitle")}</p>
      {loading ? <div className="mt-3"><LoadingIndicator label={t("messages.loading")} /></div> : null}
      <ToastMessage type="error" message={error} />
      {!loading && !messages.length ? <p className="brand-muted mt-3 text-sm">{t("messages.none")}</p> : null}
      {messages.length ? (
        <div className="mt-4 space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="rounded-md border border-[#dbe9fb] bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0d3f80]">{translateContent(language, message.subject)}</p>
                  <p className="mt-1 text-xs text-[#3a689f]">
                    {t("label.course")}: {translateContent(language, message.courseTitle)} | {t("messages.from")}: {message.senderName || t("role.department_head")} ({message.senderEmail})
                  </p>
                </div>
                <div className="text-xs text-[#3a689f]">
                  <p>{t("messages.sent")}: {formatDateTime(message.createdAt, locale)}</p>
                  <p>{t("messages.read")}: {message.readAt ? formatDateTime(message.readAt, locale) : t("common.unread")}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#2f5f98]">{translateContent(language, message.body)}</p>
              {!message.readAt ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-[#1f518f] underline disabled:opacity-60"
                  onClick={() => markRead(message.id)}
                  disabled={pendingId === message.id}
                >
                  {pendingId === message.id ? t("messages.marking") : t("messages.markRead")}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
