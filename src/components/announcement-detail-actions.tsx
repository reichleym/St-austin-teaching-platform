"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import { getAnnouncementLocalizedValue } from "@/lib/announcement-translations";

type Props = {
  id: string;
  title: string;
  sourceLanguage?: string | null;
  translations?: unknown;
  backHref: string;
};

export function AnnouncementDetailActions({ id, title, sourceLanguage, translations, backHref }: Props) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onDelete = async () => {
    setError("");
    const confirmMessage = t("announcement.deleteMessage", {
      title: getAnnouncementLocalizedValue({ title, sourceLanguage, translations }, language, "title"),
    });
    if (!window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.deleteAnnouncement"));
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError(t("error.deleteAnnouncement"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-2">
      <ToastMessage type="error" message={error} />
      <button
        type="button"
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
        onClick={onDelete}
        disabled={pending}
      >
        {pending ? t("status.deleting") : t("action.delete")}
      </button>
    </div>
  );
}
