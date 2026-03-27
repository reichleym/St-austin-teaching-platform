"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { getAnnouncementLocalization } from "@/lib/announcement-translations";
import { getLanguageLocale } from "@/lib/i18n";

type Audience =
  | "BOTH"
  | "TEACHER_ONLY"
  | "STUDENT_ONLY"
  | "DEPARTMENT_HEAD_ONLY"
  | "TEACHER_DEPARTMENT_HEAD"
  | "STUDENT_DEPARTMENT_HEAD"
  | "ALL";

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  sourceLanguage: string;
  translations: unknown;
  audience: Audience;
  expiresAt: string | null;
  createdAt: string;
};

type Props = {
  announcements: AnnouncementItem[];
  detailBaseHref?: string;
};

export function AnnouncementsFeed({ announcements, detailBaseHref }: Props) {
  const { t, language } = useLanguage();
  const detailBase = detailBaseHref ?? "";
  const formatDateLabel = (value: string | null) => {
    if (!value) return t("noExpiry");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("noExpiry");
    return date.toLocaleString(getLanguageLocale(language), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };
  return (
    <section className="brand-card p-5">
      <p className="brand-section-title">{t("announcements")}</p>
      <div className="mt-3 space-y-3">
        {announcements.length ? (
          announcements.map((item) => {
            const localizedItem = getAnnouncementLocalization(item, language);
            return (
              <article
                id={`announcement-${item.id}`}
                key={item.id}
                className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {detailBase ? (
                    <Link
                      href={`${detailBase}/${item.id}`}
                      className="text-base font-semibold text-[#0b3e81] underline decoration-transparent transition hover:decoration-current"
                    >
                      {localizedItem.title}
                    </Link>
                  ) : (
                    <p className="text-base font-semibold text-[#0b3e81]">{localizedItem.title}</p>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5d96]">{localizedItem.content}</p>
                <div className="mt-2 text-xs text-[#3f70ae]">
                  <p>{t("posted")}: {formatDateLabel(item.createdAt)}</p>
                  <p>{t("expires")}: {formatDateLabel(item.expiresAt)}</p>
                </div>
              </article>
            );
          })
        ) : (
          <p className="brand-muted text-sm">{t("noActiveAnnouncements")}</p>
        )}
      </div>
    </section>
  );
}
