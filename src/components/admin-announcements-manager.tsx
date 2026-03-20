"use client";

import { FormEvent, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";

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
  audience: Audience;
  expiresAt: string | null;
  createdAt: string;
};

type Props = {
  initialAnnouncements: AnnouncementItem[];
};

type EditDraft = {
  title: string;
  content: string;
  audience: Audience;
  expiresAt: string;
};

function formatDate(value: string | null, noExpiryLabel: string) {
  if (!value) return noExpiryLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return noExpiryLabel;
  return date.toLocaleString("en-GB", {
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

export function AdminAnnouncementsManager({ initialAnnouncements }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState(initialAnnouncements);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("BOTH");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ title: "", content: "", audience: "BOTH", expiresAt: "" });
  const [isEditPending, setIsEditPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          audience,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });

      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as {
            error?: string;
            announcement?: Omit<AnnouncementItem, "expiresAt" | "createdAt"> & {
              expiresAt: string | null;
              createdAt: string;
            };
          })
        : {};

      if (!response.ok || !result.announcement) {
        setError(result.error ?? t("error.createAnnouncement"));
        return;
      }

      setItems((prev) => [result.announcement!, ...prev]);
      setTitle("");
      setContent("");
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
      title: item.title,
      content: item.content,
      audience: item.audience,
      expiresAt: toDateTimeLocalValue(item.expiresAt),
    });
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditDraft({ title: "", content: "", audience: "BOTH", expiresAt: "" });
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
          title: editDraft.title,
          content: editDraft.content,
          audience: editDraft.audience,
          expiresAt: editDraft.expiresAt ? new Date(editDraft.expiresAt).toISOString() : null,
        }),
      });

      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as {
            error?: string;
            announcement?: Omit<AnnouncementItem, "expiresAt" | "createdAt"> & {
              expiresAt: string | null;
              createdAt: string;
            };
          })
        : {};

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
          <label className="grid gap-1.5">
            <span className="brand-label">{t("label.title")}</span>
            <input className="brand-input" value={title} onChange={(event) => setTitle(event.currentTarget.value)} required />
          </label>

          <label className="grid gap-1.5">
            <span className="brand-label">{t("label.message")}</span>
            <textarea
              className="brand-input min-h-[120px]"
              value={content}
              onChange={(event) => setContent(event.currentTarget.value)}
              required
            />
          </label>

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
              return (
                <article
                  id={`announcement-${item.id}`}
                  key={item.id}
                  className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4"
                >
                  {isEditing ? (
                    <div className="grid gap-3">
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("label.title")}</span>
                        <input
                          className="brand-input"
                          value={editDraft.title}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setEditDraft((prev) => ({ ...prev, title: value }));
                          }}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="brand-label">{t("label.message")}</span>
                        <textarea
                          className="brand-input min-h-[120px]"
                          value={editDraft.content}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setEditDraft((prev) => ({ ...prev, content: value }));
                          }}
                        />
                      </label>
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
                          className="btn-brand-primary px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                          onClick={onSaveEdit}
                          disabled={isEditPending}
                        >
                          {isEditPending ? t("status.saving") : t("action.save")}
                        </button>
                        <button
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
                        <p className="text-base font-semibold text-[#0b3e81]">{item.title}</p>
                        <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-xs font-semibold text-[#1f518f]">
                          {t(`audience.label.${item.audience}`)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#2f5d96]">{item.content}</p>
                      <div className="mt-2 text-xs text-[#3f70ae]">
                        <p>{t("created")}: {formatDate(item.createdAt, t("noExpiry"))}</p>
                        <p>{t("expires")}: {formatDate(item.expiresAt, t("noExpiry"))}</p>
                      </div>
                      <button
                        className="mt-3 rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                        onClick={() => onStartEdit(item)}
                      >
                        {t("action.edit")}
                      </button>
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
