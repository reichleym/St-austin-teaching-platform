"use client";

import { FormEvent, useEffect, useState } from "react";
import { normalizeUniversityCareers, createNewCareer, type UniversityCareer } from "@/lib/university-careers";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";

type EditableCareer = UniversityCareer;

export function UniversityCareersSettings() {
  const { t } = useLanguage();
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
        setCareers(normalized);
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

    const hasMissingFields = careers.some((item) => !item.title.trim() || !item.description.trim());
    if (hasMissingFields) {
      setError(t("error.completeCareers", undefined, "Provide title and description for each career."));
      return;
    }

    const payload = careers;

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
    setCareers((prev) => [...prev, createNewCareer()]);
  };

  const onRemoveCareer = (careerId: string) => {
    setCareers((prev) => prev.filter((career) => career.id !== careerId));
  };

  const onUpdateCareer = (careerId: string, field: keyof EditableCareer, value: string | boolean) => {
    setCareers((prev) =>
      prev.map((career) =>
        career.id === careerId ? { ...career, [field]: value } : career
      )
    );
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

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="brand-label">{t("careers.careerTitle")}</span>
                      <input
                        className="brand-input"
                        value={career.title}
                        placeholder={t("careers.careerTitlePlaceholder")}
                        onChange={(e) => onUpdateCareer(career.id, "title", e.target.value)}
                        required
                      />
                    </label>

                    <label className="grid gap-1 md:col-span-2">
                      <span className="brand-label">{t("careers.description")}</span>
                      <textarea
                        className="brand-input min-h-[100px]"
                        value={career.description}
                        placeholder={t("careers.descriptionPlaceholder")}
                        onChange={(e) => onUpdateCareer(career.id, "description", e.target.value)}
                        required
                      />
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#1f6fc7]"
                        checked={career.isActive}
                        onChange={(e) => onUpdateCareer(career.id, "isActive", e.target.checked)}
                      />
                      <span className="text-sm font-semibold text-[#1f518f]">
                        {t("careers.active")}
                      </span>
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

