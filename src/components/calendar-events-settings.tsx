"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  dashboardCalendarRoles,
  getLocalDateString,
  normalizeDashboardCalendarEvents,
  type DashboardCalendarRole,
} from "@/lib/dashboard-calendar";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, translateContent, type Language } from "@/lib/i18n";
import {
  parseCalendarEventLanguage,
  parseCalendarEventTranslations,
  type CalendarEventLocalization,
} from "@/lib/calendar-event-translations";

type EditableCalendarEvent = {
  id: string;
  sourceLanguage: Language;
  localizations: Record<Language, CalendarEventLocalization>;
  date: string;
  startTime: string;
  endTime: string;
  roles: DashboardCalendarRole[];
};

const roleOptions: Array<{ value: DashboardCalendarRole; key: string; fallback: string }> = [
  { value: "SUPER_ADMIN", key: "calendarEvents.role.superAdmin", fallback: "Super Admins" },
  { value: "DEPARTMENT_HEAD", key: "calendarEvents.role.departmentHead", fallback: "Department Heads" },
  { value: "TEACHER", key: "calendarEvents.role.teacher", fallback: "Teachers" },
  { value: "STUDENT", key: "calendarEvents.role.student", fallback: "Students" },
];

function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNewEvent(defaultSourceLanguage: Language = "en"): EditableCalendarEvent {
  return {
    id: createEventId(),
    sourceLanguage: defaultSourceLanguage,
    localizations: {
      en: { title: "" },
      fr: { title: "" },
    },
    date: getLocalDateString(),
    startTime: "09:00",
    endTime: "",
    roles: [...dashboardCalendarRoles],
  };
}

export function CalendarEventsSettings() {
  const { t, language } = useLanguage();
  const initialSourceLanguage = parseCalendarEventLanguage(language);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [events, setEvents] = useState<EditableCalendarEvent[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/settings");
        const raw = await response.text();
        const result = raw
          ? (JSON.parse(raw) as {
              error?: string;
              settings?: {
                dashboardCalendarEvents?: unknown;
              };
            })
          : {};
        if (!response.ok || !result.settings) {
          if (active) setError(result.error ?? t("error.loadCalendarEvents", undefined, "Unable to load calendar events."));
          return;
        }
        if (!active) return;
        const normalized = normalizeDashboardCalendarEvents(result.settings.dashboardCalendarEvents);
        setEvents(
          normalized.map((item) => {
            const sourceLanguage = parseCalendarEventLanguage(item.sourceLanguage);
            const sourceTitle = (item.sourceTitle ?? item.title ?? "").trim();
            const translations = parseCalendarEventTranslations(item.titleTranslations);

            const localizations: Record<Language, CalendarEventLocalization> = {
              en: { title: "" },
              fr: { title: "" },
            };

            for (const entryLanguage of supportedLanguages) {
              const stored = (translations[entryLanguage] as CalendarEventLocalization | undefined)?.title?.trim() ?? "";
              if (stored) {
                localizations[entryLanguage] = { title: stored };
                continue;
              }

              if (entryLanguage === sourceLanguage) {
                localizations[entryLanguage] = { title: sourceTitle };
                continue;
              }

              const translated = sourceTitle ? translateContent(entryLanguage, sourceTitle) : "";
              localizations[entryLanguage] = {
                title: translated && translated !== sourceTitle ? translated : "",
              };
            }

            return {
              id: item.id,
              sourceLanguage,
              localizations,
              date: item.date,
              startTime: item.startTime,
              endTime: item.endTime ?? "",
              roles: item.roles,
            };
          })
        );
      } catch {
        if (active) setError(t("error.loadCalendarEvents", undefined, "Unable to load calendar events."));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const onToggleRole = (eventId: string, role: DashboardCalendarRole, checked: boolean) => {
    setEvents((prev) =>
      prev.map((item) => {
        if (item.id !== eventId) return item;
        const nextRoles = checked ? Array.from(new Set([...item.roles, role])) : item.roles.filter((value) => value !== role);
        return { ...item, roles: nextRoles };
      })
    );
  };

  const languageLabel = (value: Language) => (value === "fr" ? t("french") : t("english"));

  const onUpdateSourceLanguage = (eventId: string, value: string) => {
    const nextLanguage = parseCalendarEventLanguage(value);
    setEvents((prev) => prev.map((item) => (item.id === eventId ? { ...item, sourceLanguage: nextLanguage } : item)));
  };

  const onUpdateTitle = (eventId: string, targetLanguage: Language, value: string) => {
    setEvents((prev) =>
      prev.map((item) => {
        if (item.id !== eventId) return item;
        return {
          ...item,
          localizations: {
            ...item.localizations,
            [targetLanguage]: {
              ...item.localizations[targetLanguage],
              title: value,
            },
          },
        };
      })
    );
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const hasMissingFields = events.some((item) => !item.localizations[item.sourceLanguage].title.trim() || !item.date || !item.startTime);
    if (hasMissingFields) {
      setError(
        t(
          "error.completeCalendarEvents",
          undefined,
          "Provide title, date, and start time for each calendar event."
        )
      );
      return;
    }
    if (events.some((item) => item.roles.length === 0)) {
      setError(t("error.calendarEventRoleRequired", undefined, "Select at least one role for each event."));
      return;
    }

    const payload = events.map((item) => {
      const titleTranslations: Record<string, { title: string }> = {};
      for (const entryLanguage of supportedLanguages) {
        const value = item.localizations[entryLanguage].title.trim();
        if (value) titleTranslations[entryLanguage] = { title: value };
      }

      return {
        id: item.id,
        title: item.localizations[item.sourceLanguage].title.trim(),
        sourceLanguage: item.sourceLanguage,
        titleTranslations,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime || null,
        roles: item.roles,
      };
    });

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardCalendarEvents: payload,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateCalendarEvents", undefined, "Unable to update calendar events."));
        return;
      }
      setSuccess(t("success.calendarEventsUpdated", undefined, "Calendar events updated."));
    } catch {
      setError(t("error.updateCalendarEvents", undefined, "Unable to update calendar events."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">{t("calendarEvents.title", undefined, "Calendar Events")}</p>
        <p className="brand-muted mt-2 text-sm">
          {t(
            "calendarEvents.subtitle",
            undefined,
            "Plan role-wise events for specific dates. Today's matching events are shown in Overview."
          )}
        </p>
      </article>

      <article className="brand-card p-5">
        {isLoading ? <LoadingIndicator label={t("loading.calendarEvents", undefined, "Loading calendar events...")} /> : null}
        <ToastMessage type="error" message={error} />
        <ToastMessage type="success" message={success} />

        {!isLoading ? (
          <form className="grid gap-4" onSubmit={onSave}>
            {events.length ? (
              events.map((item, index) => (
                <article key={item.id} className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="brand-section-title">
                      {t("calendarEvents.eventItem", { index: index + 1 }, `Event ${index + 1}`)}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                      onClick={() => setEvents((prev) => prev.filter((eventItem) => eventItem.id !== item.id))}
                    >
                      {t("action.remove")}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-4 md:col-span-2">
                      <label className="grid gap-1.5 md:max-w-xs">
                        <span className="brand-label">{t("announcement.sourceLanguage")}</span>
                        <select
                          className="brand-input"
                          value={item.sourceLanguage}
                          onChange={(eventLanguage) => onUpdateSourceLanguage(item.id, eventLanguage.currentTarget.value)}
                        >
                          {supportedLanguages.map((entryLanguage) => (
                            <option key={`${item.id}_${entryLanguage}`} value={entryLanguage}>
                              {languageLabel(entryLanguage)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-4 xl:grid-cols-2">
                        {supportedLanguages.map((entryLanguage) => {
                          const isPrimary = entryLanguage === item.sourceLanguage;
                          const fields = item.localizations[entryLanguage];
                          return (
                            <fieldset
                              key={`${item.id}_${entryLanguage}_title`}
                              className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4"
                            >
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
                                <span className="brand-label">{t("calendarEvents.eventTitle", undefined, "Event Title")}</span>
                                <input
                                  className="brand-input"
                                  value={fields.title}
                                  placeholder={t("calendarEvents.eventTitlePlaceholder", undefined, "Enter event title")}
                                  onChange={(eventTitle) => onUpdateTitle(item.id, entryLanguage, eventTitle.currentTarget.value)}
                                  required={isPrimary}
                                />
                              </label>
                            </fieldset>
                          );
                        })}
                      </div>
                    </div>

                    <label className="grid gap-1">
                      <span className="brand-label">{t("calendarEvents.eventDate", undefined, "Date")}</span>
                      <input
                        className="brand-input"
                        type="date"
                        value={item.date}
                        onChange={(inputEvent) => {
                          const value = inputEvent.currentTarget.value;
                          setEvents((prev) =>
                            prev.map((entry) => (entry.id === item.id ? { ...entry, date: value } : entry))
                          );
                        }}
                        required
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="brand-label">{t("calendarEvents.startTime", undefined, "Start Time")}</span>
                        <input
                          className="brand-input"
                          type="time"
                          value={item.startTime}
                          onChange={(inputEvent) => {
                            const value = inputEvent.currentTarget.value;
                            setEvents((prev) =>
                              prev.map((entry) => (entry.id === item.id ? { ...entry, startTime: value } : entry))
                            );
                          }}
                          required
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="brand-label">{t("calendarEvents.endTime", undefined, "End Time")}</span>
                        <input
                          className="brand-input"
                          type="time"
                          value={item.endTime}
                          onChange={(inputEvent) => {
                            const value = inputEvent.currentTarget.value;
                            setEvents((prev) =>
                              prev.map((entry) => (entry.id === item.id ? { ...entry, endTime: value } : entry))
                            );
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <p className="brand-label">{t("calendarEvents.roles", undefined, "Visible To")}</p>
                    <div className="flex flex-wrap gap-2">
                      {roleOptions.map((roleOption) => {
                        const checked = item.roles.includes(roleOption.value);
                        return (
                          <label
                            key={`${item.id}_${roleOption.value}`}
                            className="inline-flex items-center gap-2 rounded-md border border-[#b7d4f7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#1f6fc7]"
                              checked={checked}
                              onChange={(inputEvent) =>
                                onToggleRole(item.id, roleOption.value, inputEvent.currentTarget.checked)
                              }
                            />
                            {t(roleOption.key, undefined, roleOption.fallback)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="brand-muted text-sm">
                {t("calendarEvents.empty", undefined, "No calendar events added yet. Add your first event to populate Overview.")}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-brand-secondary px-4 py-2 text-sm font-semibold"
                onClick={() => setEvents((prev) => [...prev, createNewEvent(initialSourceLanguage)])}
              >
                {t("action.addCalendarEvent", undefined, "Add Calendar Event")}
              </button>
              <button className="btn-brand-primary px-4 py-2 text-sm font-semibold" disabled={isSaving}>
                {isSaving
                  ? t("status.savingCalendarEvents", undefined, "Saving calendar events...")
                  : t("action.saveCalendarEvents", undefined, "Save Calendar Events")}
              </button>
            </div>
          </form>
        ) : null}
      </article>
    </section>
  );
}
