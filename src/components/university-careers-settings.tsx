"use client";

import { FormEvent, useEffect, useState } from "react";
import { normalizeUniversityCareers, type UniversityCareer } from "@/lib/university-careers";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, translateContent, type Language } from "@/lib/i18n";
import {
  parseCareerLanguage,
  parseCareerTranslations,
  type CareerLocalization,
} from "@/lib/career-translations";

type EditableCareer = {
  id: string;
  sourceLanguage: Language;
  localizations: Record<Language, CareerLocalization>;
  isActive: boolean;
};

export function UniversityCareersSettings() {
  const { t, language } = useLanguage();
  const initialSourceLanguage = parseCareerLanguage(language);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [careers, setCareers] = useState<EditableCareer[]>([]);

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
                universityCareers?: unknown;
              };
            })
          : {};
        if (!response.ok || !result.settings) {
          if (active) setError(result.error ?? t("error.loadCareers", undefined, "Unable to load careers."));
          return;
        }
        if (!active) return;
        const normalized = normalizeUniversityCareers(result.settings.universityCareers);
        setCareers(
          normalized.map((career: UniversityCareer) => {
            const sourceLanguage = parseCareerLanguage(career.sourceLanguage);
            const sourceTitle = (career.sourceTitle ?? career.title ?? "").trim();
            const sourceDescription = (career.sourceDescription ?? career.description ?? "").trim();
            const translations = parseCareerTranslations(career.translations);

            const localizations: Record<Language, CareerLocalization> = {
              en: { title: "", description: "" },
              fr: { title: "", description: "" },
            };

            for (const entryLanguage of supportedLanguages) {
              const storedTitle = translations[entryLanguage]?.title?.trim() ?? "";
              const storedDescription = translations[entryLanguage]?.description?.trim() ?? "";

              if (storedTitle || storedDescription) {
                localizations[entryLanguage] = {
                  title: storedTitle,
                  description: storedDescription,
                };
                continue;
              }

              if (entryLanguage === sourceLanguage) {
                localizations[entryLanguage] = {
                  title: sourceTitle,
                  description: sourceDescription,
                };
                continue;
              }

              const translatedTitle = sourceTitle ? translateContent(entryLanguage, sourceTitle) : "";
              const translatedDescription = sourceDescription ? translateContent(entryLanguage, sourceDescription) : "";

              localizations[entryLanguage] = {
                title: translatedTitle && translatedTitle !== sourceTitle ? translatedTitle : "",
                description: translatedDescription && translatedDescription !== sourceDescription ? translatedDescription : "",
              };
            }

            return {
              id: career.id,
              sourceLanguage,
              localizations,
              isActive: career.isActive,
            };
          })
        );
      } catch {
        if (active) setError(t("error.loadCareers", undefined, "Unable to load careers."));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const hasMissingFields = careers.some(
      (item) => !item.localizations[item.sourceLanguage].title.trim() || !item.localizations[item.sourceLanguage].description.trim()
    );
    if (hasMissingFields) {
      setError(t("error.completeCareers", undefined, "Provide title and description for each career."));
      return;
    }

    const payload = careers.map((career) => {
      const translations: Record<string, { title?: string; description?: string }> = {};
      for (const entryLanguage of supportedLanguages) {
        const titleValue = career.localizations[entryLanguage].title.trim();
        const descriptionValue = career.localizations[entryLanguage].description.trim();
        if (!titleValue && !descriptionValue) continue;
        translations[entryLanguage] = {
          ...(titleValue ? { title: titleValue } : {}),
          ...(descriptionValue ? { description: descriptionValue } : {}),
        };
      }

      return {
        id: career.id,
        title: career.localizations[career.sourceLanguage].title.trim(),
        description: career.localizations[career.sourceLanguage].description.trim(),
        sourceLanguage: career.sourceLanguage,
        sourceTitle: career.localizations[career.sourceLanguage].title.trim(),
        sourceDescription: career.localizations[career.sourceLanguage].description.trim(),
        translations,
        isActive: career.isActive,
      };
    });

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityCareers: payload,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateCareers", undefined, "Unable to update careers."));
        return;
      }
      setSuccess(t("success.careersUpdated", undefined, "University careers updated."));
    } catch {
      setError(t("error.updateCareers", undefined, "Unable to update careers."));
    } finally {
      setIsSaving(false);
    }
  };

  const onAddCareer = () => {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 20)
        : `cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    setCareers((prev) => [
      ...prev,
      {
        id,
        sourceLanguage: initialSourceLanguage,
        localizations: {
          en: { title: "", description: "" },
          fr: { title: "", description: "" },
        },
        isActive: true,
      },
    ]);
  };

  const onRemoveCareer = (careerId: string) => {
    setCareers((prev) => prev.filter((career) => career.id !== careerId));
  };

  const languageLabel = (value: Language) => (value === "fr" ? t("french") : t("english"));

  const onUpdateSourceLanguage = (careerId: string, value: string) => {
    const nextLanguage = parseCareerLanguage(value);
    setCareers((prev) => prev.map((career) => (career.id === careerId ? { ...career, sourceLanguage: nextLanguage } : career)));
  };

  const onUpdateLocalization = (
    careerId: string,
    targetLanguage: Language,
    field: keyof CareerLocalization,
    value: string
  ) => {
    setCareers((prev) =>
      prev.map((career) => {
        if (career.id !== careerId) return career;
        return {
          ...career,
          localizations: {
            ...career.localizations,
            [targetLanguage]: {
              ...career.localizations[targetLanguage],
              [field]: value,
            },
          },
        };
      })
    );
  };

  const onUpdateActive = (careerId: string, checked: boolean) => {
    setCareers((prev) => prev.map((career) => (career.id === careerId ? { ...career, isActive: checked } : career)));
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">{t("careers.title")}</p>
        <p className="brand-muted mt-2 text-sm">
          {t("careers.subtitle")}
        </p>
      </article>

      <article className="brand-card p-5">
        {isLoading ? <LoadingIndicator label={t("loading.careers", undefined, "Loading careers...")} /> : null}
        <ToastMessage type="error" message={error} />
        <ToastMessage type="success" message={success} />

        {!isLoading ? (
          <form className="grid gap-4" onSubmit={onSave}>
            {careers.length ? (
              careers.map((career, index) => (
                <article key={career.id} className="rounded-xl border border-[#c6ddfa] bg-[#f4f9ff] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="brand-section-title">
                      {t("careers.eventItem", { index: index + 1 }, `Career ${index + 1}`)}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                      onClick={() => onRemoveCareer(career.id)}
                    >
                      {t("action.remove")}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-4">
                    <label className="grid gap-1.5 md:max-w-xs">
                      <span className="brand-label">{t("announcement.sourceLanguage")}</span>
                      <select
                        className="brand-input"
                        value={career.sourceLanguage}
                        onChange={(eventLanguage) => onUpdateSourceLanguage(career.id, eventLanguage.currentTarget.value)}
                      >
                        {supportedLanguages.map((entryLanguage) => (
                          <option key={`${career.id}_${entryLanguage}`} value={entryLanguage}>
                            {languageLabel(entryLanguage)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 xl:grid-cols-2">
                      {supportedLanguages.map((entryLanguage) => {
                        const isPrimary = entryLanguage === career.sourceLanguage;
                        const fields = career.localizations[entryLanguage];
                        return (
                          <fieldset
                            key={`${career.id}_${entryLanguage}_fields`}
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
                              <span className="brand-label">{t("careers.careerTitle")}</span>
                              <input
                                className="brand-input"
                                value={fields.title}
                                placeholder={t("careers.careerTitlePlaceholder")}
                                onChange={(eventTitle) => onUpdateLocalization(career.id, entryLanguage, "title", eventTitle.currentTarget.value)}
                                required={isPrimary}
                              />
                            </label>

                            <label className="grid gap-1.5">
                              <span className="brand-label">{t("careers.description")}</span>
                              <textarea
                                className="brand-input min-h-[100px]"
                                value={fields.description}
                                placeholder={t("careers.descriptionPlaceholder")}
                                onChange={(eventDesc) =>
                                  onUpdateLocalization(career.id, entryLanguage, "description", eventDesc.currentTarget.value)
                                }
                                required={isPrimary}
                              />
                            </label>
                          </fieldset>
                        );
                      })}
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#1f6fc7]"
                        checked={career.isActive}
                        onChange={(eventActive) => onUpdateActive(career.id, eventActive.currentTarget.checked)}
                      />
                      <span className="text-sm font-semibold text-[#1f518f]">{t("careers.active")}</span>
                    </label>
                  </div>
                </article>
              ))
            ) : (
              <p className="brand-muted text-sm">
                {t("careers.empty")}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-brand-secondary px-4 py-2 text-sm font-semibold"
                onClick={onAddCareer}
              >
                {t("action.addCareer", undefined, "Add Career")}
              </button>
              <button className="btn-brand-primary px-4 py-2 text-sm font-semibold" disabled={isSaving}>
                {isSaving
                  ? t("status.savingCareers", undefined, "Saving careers...")
                  : t("action.saveCareers", undefined, "Save Careers")}
              </button>
            </div>
          </form>
        ) : null}
      </article>
    </section>
  );
}
