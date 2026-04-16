"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";

type ProgramDetails = {
  overview: string | null;
  tuitionAndFees: string | null;
  curriculum: string[];
  admissionRequirements: string[];
  careerOpportunities: string[];
};

type Props = {
  courseId: string;
  initialProgramDetails: ProgramDetails | null;
};

const toMultilineValue = (items: string[] | undefined) => (items && items.length ? items.join("\n") : "");

const toListFromMultiline = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function CourseProgramContentEditor({ courseId, initialProgramDetails }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [overview, setOverview] = useState(initialProgramDetails?.overview ?? "");
  const [tuitionAndFees, setTuitionAndFees] = useState(initialProgramDetails?.tuitionAndFees ?? "");
  const [curriculum, setCurriculum] = useState(toMultilineValue(initialProgramDetails?.curriculum));
  const [admissionRequirements, setAdmissionRequirements] = useState(
    toMultilineValue(initialProgramDetails?.admissionRequirements)
  );
  const [careerOpportunities, setCareerOpportunities] = useState(
    toMultilineValue(initialProgramDetails?.careerOpportunities)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyProgramDetails = (details: ProgramDetails | null) => {
    setOverview(details?.overview ?? "");
    setTuitionAndFees(details?.tuitionAndFees ?? "");
    setCurriculum(toMultilineValue(details?.curriculum));
    setAdmissionRequirements(toMultilineValue(details?.admissionRequirements));
    setCareerOpportunities(toMultilineValue(details?.careerOpportunities));
  };

  const previewStats = useMemo(
    () => ({
      curriculum: toListFromMultiline(curriculum).length,
      admissionRequirements: toListFromMultiline(admissionRequirements).length,
      careerOpportunities: toListFromMultiline(careerOpportunities).length,
    }),
    [admissionRequirements, careerOpportunities, curriculum]
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          programDetails: {
            overview,
            tuitionAndFees,
            curriculum: toListFromMultiline(curriculum),
            admissionRequirements: toListFromMultiline(admissionRequirements),
            careerOpportunities: toListFromMultiline(careerOpportunities),
          },
        }),
      });

      const raw = await response.text();
      const result = raw
        ? (JSON.parse(raw) as { error?: string; course?: { programDetails?: ProgramDetails | null } })
        : {};

      if (!response.ok) {
        setError(result.error ?? "Unable to update program content.");
        return;
      }

      applyProgramDetails(result.course?.programDetails ?? null);
      setSuccess("Program content updated successfully.");
      router.refresh();
    } catch {
      setError("Unable to update program content.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="brand-card p-5">
      <ToastMessage type="error" message={error} />
      <ToastMessage type="success" message={success} />

      <p className="brand-section-title">Program Content</p>
      <p className="brand-muted mt-2 text-sm">
        Update the website-facing program overview, tuition, curriculum, admission requirements, and career opportunities.
      </p>

      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-1.5">
          <span className="brand-label">{t("program.overview") || "Program Overview"}</span>
          <textarea
            className="brand-input min-h-[110px]"
            value={overview}
            onChange={(event) => setOverview(event.currentTarget.value)}
            maxLength={3000}
            placeholder="Short summary shown in Program Overview section."
          />
        </label>

        <label className="grid gap-1.5 md:max-w-sm">
          <span className="brand-label">Tuition & Fees</span>
          <input
            className="brand-input"
            value={tuitionAndFees}
            onChange={(event) => setTuitionAndFees(event.currentTarget.value)}
            maxLength={160}
            placeholder="$12,500 / year"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.curriculum") || "Curriculum (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={curriculum}
              onChange={(event) => setCurriculum(event.currentTarget.value)}
              placeholder="Introduction to Business"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.admissionRequirements") || "Admission Requirements (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={admissionRequirements}
              onChange={(event) => setAdmissionRequirements(event.currentTarget.value)}
              placeholder="High school diploma or equivalent"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="brand-label">{t("program.careerOpportunities") || "Career Opportunities (one per line)"}</span>
            <textarea
              className="brand-input min-h-[130px]"
              value={careerOpportunities}
              onChange={(event) => setCareerOpportunities(event.currentTarget.value)}
              placeholder="Business Manager"
            />
          </label>
        </div>

        <p className="text-xs text-[#3a689f]">
          Preview counts: Curriculum {previewStats.curriculum}, Requirements {previewStats.admissionRequirements}, Careers {previewStats.careerOpportunities}
        </p>

        <div className="flex items-center gap-2">
          <button
            className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={pending}
          >
            {pending ? "Saving..." : "Save Program Content"}
          </button>
        </div>
      </form>
    </section>
  );
}
