"use client";

import { FormEvent, useEffect, useState } from "react";

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
          if (active) setError(result.error ?? "Unable to load academic policies.");
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
        if (active) setError("Unable to load academic policies.");
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
      setError("Add at least one valid grade scale band.");
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
        setError(result.error ?? "Unable to update academic policies.");
        return;
      }
      setSuccess("Academic policies updated.");
    } catch {
      setError("Unable to update academic policies.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">Academic Policies</p>
        <p className="brand-muted mt-2 text-sm">Configure numeric-to-letter grade mapping and automatic late submission penalties.</p>
      </article>

      <article className="brand-card p-5">
        {isLoading ? <p className="brand-muted text-sm">Loading academic policies...</p> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mb-2 text-sm text-green-700">{success}</p> : null}

        {!isLoading ? (
          <form className="grid gap-4" onSubmit={onSave}>
            <div className="grid gap-2">
              <p className="brand-label">Grade Scale Bands</p>
              <div className="hidden gap-2 text-xs font-semibold text-[#3a689f] md:grid md:grid-cols-[1fr_1fr_1fr_auto]">
                <p>Min Percentage</p>
                <p>Max Percentage</p>
                <p>Letter Grade</p>
                <p className="text-right">Action</p>
              </div>
              {gradeBands.map((band, index) => (
                <div key={`grade_band_${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    className="brand-input"
                    type="number"
                    step="0.01"
                    placeholder="Min %"
                    aria-label={`Grade band ${index + 1} minimum percentage`}
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
                    placeholder="Max %"
                    aria-label={`Grade band ${index + 1} maximum percentage`}
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
                    placeholder="Letter (A, B+, etc.)"
                    aria-label={`Grade band ${index + 1} letter grade`}
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
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold"
                onClick={() => setGradeBands((prev) => [...prev, { min: "", max: "", letter: "" }])}
              >
                Add Grade Band
              </button>
            </div>

            <div className="grid gap-2">
              <p className="brand-label">Late Penalty Rules</p>
              <div className="hidden gap-2 text-xs font-semibold text-[#3a689f] md:grid md:grid-cols-[1fr_1fr_auto]">
                <p>Late Window (Hours)</p>
                <p>Deduction (%)</p>
                <p className="text-right">Action</p>
              </div>
              {latePenaltyBands.map((rule, index) => (
                <div key={`late_rule_${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="brand-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Window hours (e.g., 24)"
                    aria-label={`Late penalty rule ${index + 1} window hours`}
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
                    placeholder="Deduction %"
                    aria-label={`Late penalty rule ${index + 1} deduction percentage`}
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
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-brand-secondary w-fit px-3 py-1.5 text-xs font-semibold"
                onClick={() => setLatePenaltyBands((prev) => [...prev, { windowHours: "", deductionPercent: "" }])}
              >
                Add Late Rule
              </button>
            </div>

            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={isSaving}>
              {isSaving ? "Saving Policies..." : "Save Academic Policies"}
            </button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
