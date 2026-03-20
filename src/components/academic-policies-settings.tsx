"use client";

import { FormEvent, useEffect, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { LoadingIndicator } from "@/components/loading-indicator";
import { useLanguage } from "@/components/language-provider";

type GradeBand = {
  min: string;
  max: string;
  letter: string;
};

type LatePenaltyBand = {
  windowHours: string;
  deductionPercent: string;
};

export function AcademicPoliciesSettings() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [gradeBands, setGradeBands] = useState<GradeBand[]>([
    { min: "94", max: "100", letter: "A" },
    { min: "90", max: "93.99", letter: "A-" },
    { min: "87", max: "89.99", letter: "B+" },
  ]);
  const [latePenaltyBands, setLatePenaltyBands] = useState<LatePenaltyBand[]>([
    { windowHours: "24", deductionPercent: "5" },
    { windowHours: "48", deductionPercent: "10" },
    { windowHours: "72", deductionPercent: "20" },
  ]);

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
                gradeScale?: Array<{ min: number; max: number; letter: string }> | null;
                lateSubmissionPenaltyRules?: Array<{ windowHours: number; deductionPercent: number }> | null;
              };
            })
          : {};
        if (!response.ok || !result.settings) {
          if (active) setError(result.error ?? t("error.loadAcademicPolicies"));
          return;
        }
        if (!active) return;
        if (Array.isArray(result.settings.gradeScale) && result.settings.gradeScale.length) {
          setGradeBands(
            result.settings.gradeScale.map((band) => ({
              min: String(band.min),
              max: String(band.max),
              letter: band.letter,
            })),
          );
        }
        if (Array.isArray(result.settings.lateSubmissionPenaltyRules) && result.settings.lateSubmissionPenaltyRules.length) {
          setLatePenaltyBands(
            result.settings.lateSubmissionPenaltyRules.map((rule) => ({
              windowHours: String(rule.windowHours),
              deductionPercent: String(rule.deductionPercent),
            })),
          );
        }
      } catch {
        if (active) setError(t("error.loadAcademicPolicies"));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsedGradeBands = gradeBands
      .map((band) => ({
        min: Number(band.min),
        max: Number(band.max),
        letter: band.letter.trim(),
      }))
      .filter((band) => Number.isFinite(band.min) && Number.isFinite(band.max) && band.letter);
    const parsedLateRules = latePenaltyBands
      .map((rule) => ({
        windowHours: Number(rule.windowHours),
        deductionPercent: Number(rule.deductionPercent),
      }))
      .filter(
        (rule) =>
          Number.isFinite(rule.windowHours) &&
          rule.windowHours >= 0 &&
          Number.isFinite(rule.deductionPercent) &&
          rule.deductionPercent >= 0,
      );

    if (!parsedGradeBands.length) {
      setError(t("error.addGradeBand"));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeScale: parsedGradeBands,
          lateSubmissionPenaltyRules: parsedLateRules,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? t("error.updateAcademicPolicies"));
        return;
      }
      setSuccess(t("success.academicPoliciesUpdated"));
    } catch {
      setError(t("error.updateAcademicPolicies"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">{t("academicPolicies.title")}</p>
        <p className="brand-muted mt-2 text-sm">{t("academicPolicies.subtitle")}</p>
      </article>

      <article className="brand-card p-5">
        {isLoading ? <LoadingIndicator label={t("loading.academicPolicies")} /> : null}
        <ToastMessage type="error" message={error} />
        <ToastMessage type="success" message={success} />

        {!isLoading ? (
          <form className="grid gap-4" onSubmit={onSave}>
            <div className="grid gap-2">
              <p className="brand-label">{t("academicPolicies.gradeBands")}</p>
              <div className="hidden gap-2 text-xs font-semibold text-[#3a689f] md:grid md:grid-cols-[1fr_1fr_1fr_auto]">
                <p>{t("table.minPercentage")}</p>
                <p>{t("table.maxPercentage")}</p>
                <p>{t("table.letterGrade")}</p>
                <p className="text-right">{t("table.action")}</p>
              </div>
              {gradeBands.map((band, index) => (
                <div key={`grade_band_${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    className="brand-input"
                    type="number"
                    step="0.01"
                    placeholder={t("placeholder.minPercent")}
                    aria-label={t("aria.gradeBandMin", { index: index + 1 })}
                    value={band.min}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setGradeBands((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, min: value } : item)),
                      );
                    }}
                  />
                  <input
                    className="brand-input"
                    type="number"
                    step="0.01"
                    placeholder={t("placeholder.maxPercent")}
                    aria-label={t("aria.gradeBandMax", { index: index + 1 })}
                    value={band.max}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setGradeBands((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, max: value } : item)),
                      );
                    }}
                  />
                  <input
                    className="brand-input"
                    placeholder={t("placeholder.letterGrade")}
                    aria-label={t("aria.gradeBandLetter", { index: index + 1 })}
                    value={band.letter}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setGradeBands((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, letter: value } : item)),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700"
                    onClick={() => setGradeBands((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    {t("action.remove")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold"
                onClick={() => setGradeBands((prev) => [...prev, { min: "", max: "", letter: "" }])}
              >
                {t("action.addGradeBand")}
              </button>
            </div>

            <div className="grid gap-2">
              <p className="brand-label">{t("academicPolicies.lateRules")}</p>
              <div className="hidden gap-2 text-xs font-semibold text-[#3a689f] md:grid md:grid-cols-[1fr_1fr_auto]">
                <p>{t("table.lateWindowHours")}</p>
                <p>{t("table.deductionPercent")}</p>
                <p className="text-right">{t("table.action")}</p>
              </div>
              {latePenaltyBands.map((rule, index) => (
                <div key={`late_rule_${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="brand-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={t("placeholder.windowHours")}
                    aria-label={t("aria.lateRuleWindow", { index: index + 1 })}
                    value={rule.windowHours}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setLatePenaltyBands((prev) =>
                        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, windowHours: value } : item)),
                      );
                    }}
                  />
                  <input
                    className="brand-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("placeholder.deductionPercent")}
                    aria-label={t("aria.lateRuleDeduction", { index: index + 1 })}
                    value={rule.deductionPercent}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setLatePenaltyBands((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, deductionPercent: value } : item,
                        ),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700"
                    onClick={() => setLatePenaltyBands((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    {t("action.remove")}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold"
                onClick={() => setLatePenaltyBands((prev) => [...prev, { windowHours: "", deductionPercent: "" }])}
              >
                {t("action.addLateRule")}
              </button>
            </div>

            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={isSaving}>
              {isSaving ? t("status.savingPolicies") : t("action.saveAcademicPolicies")}
            </button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
