"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import {
  createEmptyAnnouncementLocalizationDrafts,
  getAnnouncementLocalization,
  getAnnouncementLocalizationDrafts,
  parseAnnouncementLanguage,
  type AnnouncementLocalization,
} from "@/lib/announcement-translations";
import { getLanguageLocale, supportedLanguages, type Language } from "@/lib/i18n";

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
  initialAnnouncements: AnnouncementItem[];
  detailBaseHref?: string;
};

type EditDraft = {
  sourceLanguage: Language;
  localizations: Record<Language, AnnouncementLocalization>;
  audience: Audience;
  expiresAt: string;
};

function formatDate(value: string | null, noExpiryLabel: string, locale: string) {
  if (!value) return noExpiryLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return noExpiryLabel;
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createEmptyEditDraft(sourceLanguage: Language): EditDraft {
  return {
    sourceLanguage,
    localizations: createEmptyAnnouncementLocalizationDrafts(),
    audience: "BOTH",
    expiresAt: "",
  };
}

export function AdminAnnouncementsManager({ initialAnnouncements, detailBaseHref }: Props) {
  const { t, language } = useLanguage();
  const locale = getLanguageLocale(language);
  const detailBase = detailBaseHref ?? "/dashboard/announcements";
  const initialSourceLanguage = parseAnnouncementLanguage(language);

  const [items, setItems] = useState(initialAnnouncements);
  const [sourceLanguage, setSourceLanguage] = useState<Language>(initialSourceLanguage);
  const [localizations, setLocalizations] = useState<Record<Language, AnnouncementLocalization>>(
    createEmptyAnnouncementLocalizationDrafts()
  );
  const [audience, setAudience] = useState<Audience>("BOTH");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(createEmptyEditDraft(initialSourceLanguage));
  const [isEditPending, setIsEditPending] = useState(false);

  const languageLabel = (value: Language) => (value === "fr" ? t("french") : t("english"));

  const updateLocalization = (
    targetLanguage: Language,
    field: keyof AnnouncementLocalization,
    value: string,
    isEditing: boolean
  ) => {
    if (isEditing) {
      setEditDraft((prev) => ({
        ...prev,
        localizations: {
          ...prev.localizations,
          [targetLanguage]: {
            ...prev.localizations[targetLanguage],
            [field]: value,
          },
        },
      }));
      return;
    }

    setLocalizations((prev) => ({
      ...prev,
      [targetLanguage]: {
        ...prev[targetLanguage],
        [field]: value,
      },
    }));
  };

  const renderLocalizationFields = (
    draftSourceLanguage: Language,
    draftLocalizations: Record<Language, AnnouncementLocalization>,
    isEditing: boolean
  ) => (
    <div className="grid gap-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">{t("announcement.sourceLanguage")}</span>
        <select
          className="brand-input"
          value={draftSourceLanguage}
          onChange={(event) => {
            const value = parseAnnouncementLanguage(event.currentTarget.value);
            if (isEditing) {
              setEditDraft((prev) => ({ ...prev, sourceLanguage: value }));
            } else {
              setSourceLanguage(value);
            }
          }}
        >
          {supportedLanguages.map((entryLanguage) => (
            <option key={entryLanguage} value={entryLanguage}>
              {languageLabel(entryLanguage)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === draftSourceLanguage;
          const fields = draftLocalizations[entryLanguage];
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <legend className="text-sm font-semibold text-[#0b3e81]">
                  {t("announcement.languageVersion", { language: languageLabel(entryLanguage) })}
                </legend>
                {isPrimary ? (
                  <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">
                    {t("announcement.primaryLanguage")}
                  </span>
                ) : null}
              </div>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.title")}</span>
                <input
                  className="brand-input"
                  value={fields.title}
                  onChange={(event) => updateLocalization(entryLanguage, "title", event.currentTarget.value, isEditing)}
                  required={isPrimary}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.message")}</span>
                <textarea
                  className="brand-input min-h-[120px]"
                  value={fields.content}
                  onChange={(event) => updateLocalization(entryLanguage, "content", event.currentTarget.value, isEditing)}
                  required={isPrimary}
                />
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLanguage,
          translations: localizations,
          audience,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; announcement?: AnnouncementItem }) : {};

      if (!response.ok || !result.announcement) {
        setError(result.error ?? t("error.createAnnouncement"));
        return;
      }

      setItems((prev) => [result.announcement!, ...prev]);
      setSourceLanguage(initialSourceLanguage);
      setLocalizations(createEmptyAnnouncementLocalizationDrafts());
      setAudience("BOTH");
      setExpiresAt("");
    } catch {
      setError(t("error.createAnnouncement"));
    } finally {
      setIsPending(false);
    }
  };

  const onStartEdit = (item: AnnouncementItem) => {
    setError("");
    setEditingId(item.id);
    setEditDraft({
      sourceLanguage: parseAnnouncementLanguage(item.sourceLanguage),
      localizations: getAnnouncementLocalizationDrafts(item),
      audience: item.audience,
      expiresAt: toDateTimeLocalValue(item.expiresAt),
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditDraft(createEmptyEditDraft(initialSourceLanguage));
  };

  const onDelete = async (item: AnnouncementItem) => {
    setError("");
    const confirmMessage = t("announcement.deleteMessage", {
      title: getAnnouncementLocalization(item, language).title,
    });
    if (!window.confirm(confirmMessage)) return;
    try {
      const response = await fetch(`/api/admin/announcements/${item.id}`, { method: "DELETE" });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.deleteAnnouncement"));
        return;
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) {
        onCancelEdit();
      }
    } catch {
      setError(t("error.deleteAnnouncement"));
    }
  };

  const onSaveEdit = async () => {
    if (!editingId) return;

    setError("");
    setIsEditPending(true);
    try {
      const response = await fetch(`/api/admin/announcements/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLanguage: editDraft.sourceLanguage,
          translations: editDraft.localizations,
          audience: editDraft.audience,
          expiresAt: editDraft.expiresAt ? new Date(editDraft.expiresAt).toISOString() : null,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; announcement?: AnnouncementItem }) : {};

      if (!response.ok || !result.announcement) {
        setError(result.error ?? t("error.updateAnnouncement"));
        return;
      }

      setItems((prev) => prev.map((item) => (item.id === result.announcement!.id ? result.announcement! : item)));
      onCancelEdit();
    } catch {
      setError(t("error.updateAnnouncement"));
    } finally {
      setIsEditPending(false);
    }
  };

  return (
    <section className="grid gap-4">
      <section className="brand-card p-5">
        <p className="brand-section-title">{t("announcement.createTitle")}</p>
        <form className="mt-3 grid gap-4" onSubmit={onSubmit}>
          {renderLocalizationFields(sourceLanguage, localizations, false)}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.audience")}</span>
              <select className="brand-input" value={audience} onChange={(event) => setAudience(event.currentTarget.value as Audience)}>
                <option value="TEACHER_ONLY">{t("audience.teacherOnly")}</option>
                <option value="STUDENT_ONLY">{t("audience.studentOnly")}</option>
                <option value="DEPARTMENT_HEAD_ONLY">{t("audience.departmentHeadOnly")}</option>
                <option value="BOTH">{t("audience.teacherStudent")}</option>
                <option value="TEACHER_DEPARTMENT_HEAD">{t("audience.teacherDepartmentHead")}</option>
                <option value="STUDENT_DEPARTMENT_HEAD">{t("audience.studentDepartmentHead")}</option>
                <option value="ALL">{t("audience.all")}</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.expiresAtOptional")}</span>
              <input
                className="brand-input"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.currentTarget.value)}
              />
            </label>
          </div>

          <ToastMessage type="error" message={error} />

          <button className="btn-brand-primary px-2 py-2 text-sm font-semibold disabled:opacity-60" disabled={isPending}>
            {isPending ? t("status.publishing") : t("action.publishAnnouncement")}
          </button>
        </form>
      </section>

      <section className="brand-card p-5">
        <p className="brand-section-title">{t("announcement.recentTitle")}</p>
        <div className="mt-3 space-y-3">
          {items.length ? (
            items.map((item) => {
              const isEditing = editingId === item.id;
              const localizedItem = getAnnouncementLocalization(item, language);

              return (
                <article
                  id={`announcement-${item.id}`}
                  key={item.id}
                  className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4"
                >
                  {isEditing ? (
                    <div className="grid gap-3">
                      {renderLocalizationFields(editDraft.sourceLanguage, editDraft.localizations, true)}

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("label.audience")}</span>
                          <select
                            className="brand-input"
                            value={editDraft.audience}
                            onChange={(event) => {
                              const value = event.currentTarget.value as Audience;
                              setEditDraft((prev) => ({ ...prev, audience: value }));
                            }}
                          >
                            <option value="TEACHER_ONLY">{t("audience.teacherOnly")}</option>
                            <option value="STUDENT_ONLY">{t("audience.studentOnly")}</option>
                            <option value="DEPARTMENT_HEAD_ONLY">{t("audience.departmentHeadOnly")}</option>
                            <option value="BOTH">{t("audience.teacherStudent")}</option>
                            <option value="TEACHER_DEPARTMENT_HEAD">{t("audience.teacherDepartmentHead")}</option>
                            <option value="STUDENT_DEPARTMENT_HEAD">{t("audience.studentDepartmentHead")}</option>
                            <option value="ALL">{t("audience.all")}</option>
                          </select>
                        </label>
                        <label className="grid gap-1.5">
                          <span className="brand-label">{t("label.expiresAtOptional")}</span>
                          <input
                            className="brand-input"
                            type="datetime-local"
                            value={editDraft.expiresAt}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setEditDraft((prev) => ({ ...prev, expiresAt: value }));
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-brand-primary px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                          onClick={() => void onSaveEdit()}
                          disabled={isEditPending}
                        >
                          {isEditPending ? t("status.saving") : t("action.save")}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                          onClick={onCancelEdit}
                          disabled={isEditPending}
                        >
                          {t("action.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-base font-semibold text-[#0b3e81]">{localizedItem.title}</p>
                        <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-xs font-semibold text-[#1f518f]">
                          {t(`audience.label.${item.audience}`)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5d96]">{localizedItem.content}</p>
                      <div className="mt-2 text-xs text-[#3f70ae]">
                        <p>{t("created")}: {formatDate(item.createdAt, t("noExpiry"), locale)}</p>
                        <p>{t("expires")}: {formatDate(item.expiresAt, t("noExpiry"), locale)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                          href={`${detailBase}/${item.id}`}
                        >
                          {t("action.viewDetails")}
                        </Link>
                        <button
                          type="button"
                          className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                          onClick={() => onStartEdit(item)}
                        >
                          {t("action.edit")}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                          onClick={() => void onDelete(item)}
                        >
                          {t("action.delete")}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <p className="brand-muted text-sm">{t("announcement.noneYet")}</p>
          )}
        </div>
      </section>
    </section>
  );
}
