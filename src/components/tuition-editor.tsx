"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import { getLocalizedSectionEnvelopeDraft } from "@/lib/dynamic-page-localization";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asArrayOfObjects(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}

async function uploadAdminImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData,
  });

  const raw = await res.text();
  const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

  if (!res.ok) {
    const message = typeof parsed.error === "string" ? parsed.error : "Upload failed.";
    throw new Error(message);
  }

  const publicUrl = typeof parsed.publicUrl === "string" ? parsed.publicUrl : "";
  const storageKey = typeof parsed.storageKey === "string" ? parsed.storageKey : "";
  if (!publicUrl || !storageKey) throw new Error("Upload failed: missing publicUrl or storageKey.");
  return { publicUrl, storageKey };
}

function AdminImagePicker({
  label,
  value,
  onChange,
  onUpload,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onUpload?: (result: { publicUrl: string; storageKey: string }) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "flex items-center justify-between gap-3" : "flex flex-wrap items-center justify-between gap-3"}>
        <span className="brand-label">{label}</span>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              setError("");
              setIsUploading(true);
              void uploadAdminImage(file)
                .then((result) => {
                  onChange(result.publicUrl);
                  onUpload?.(result);
                })
                .catch((err: unknown) => {
                  const message = err instanceof Error ? err.message : "Failed to upload image.";
                  setError(message);
                })
                .finally(() => setIsUploading(false));
            }}
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
            disabled={isUploading}
          >
            {isUploading ? "Uploading…" : "Pick image"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
              disabled={isUploading}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className={compact ? "brand-input text-sm" : "brand-input"}
        placeholder="Paste an image URL or use Pick image"
        disabled={isUploading}
      />

      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className={compact ? "h-12 w-12 rounded object-cover" : "h-20 w-20 rounded object-cover"} />
          {compact ? null : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700">Current image</p>
              <p className="text-xs text-gray-500 break-all">{value}</p>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

interface PageSection {
  id?: string;
  sectionKey: string;
  componentType: string;
  position: number;
  content: JsonObject;
}

interface DynamicPage {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  sections: PageSection[];
  createdAt: string;
  updatedAt: string;
}

function createDraftTuitionPage(): DynamicPage {
  return {
    id: "",
    slug: "tuition",
    title: "Tuition & Financial Aid Page",
    published: false,
    sections: [
      {
        sectionKey: "hero",
        componentType: "BannerSection",
        position: 0,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Tuition & Financial Aid", description: "Affordable Education Options", bgImg: "/bannerImg.jpg" },
            fr: { title: "Tuition & Financial Aid", description: "Affordable Education Options", bgImg: "/bannerImg.jpg" },
          },
        },
      },
      {
        sectionKey: "tuitionTable",
        componentType: "TuitionTableSection",
        position: 1,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Tuition & Financial Aid",
              tableHeadings: ["Program Tuition", "Per Year", "Per Semester"],
              tableData: [
                { program: "Undergraduate (Online)", perYear: "$12,500", perCredit: "$12,500" },
                { program: "Computer Science", perYear: "$14,000", perCredit: "$14,000" },
                { program: "Data Science", perYear: "$13,000", perCredit: "$13,000" },
                { program: "Master of Business Administration", perYear: "$20,000", perCredit: "$20,000" },
              ],
            },
            fr: {
              title: "Tableau des frais",
              tableHeadings: ["Programme", "Par an", "Par semestre"],
              tableData: [{ program: "Licence (En ligne)", perYear: "$12,300", perCredit: "$12,300" }],
            },
          },
        },
      },
      {
        sectionKey: "scholarships",
        componentType: "WhyAustin",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              secTitle: "Scholarships & Grants",
              whiteCards: [
                { icon: "/wedding-certificate.svg", title: "Academic Excellence", description: "Reward Orientation Carriere" },
                { icon: "/global-learning.svg", title: "Flexible Learning", description: "Learn from experts and accomplished researchers" },
                { icon: "/workspace-premium.svg", title: "Career-Focused", description: "92% placement rate with services of dedicated career and industry partnerships" },
                { icon: "/award-trophy.svg", title: "Expert Faculty", description: "Learn from industry practitioners and accomplished researchers" },
              ],
            },
            fr: { secTitle: "Bourses", whiteCards: [{ icon: "/wedding-certificate.svg", title: "Excellence académique", description: "Récompense" }] },
          },
        },
      },
      {
        sectionKey: "paymentPlans",
        componentType: "PaymentPlansSection",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Payment Plans",
              listContent: [
                "Monthly installment plans with no interest",
                "Military and veteran benefits accepted",
                "Employer tuition reimbursement processing",
                "Federal and state financial aid eligible",
              ],
              buttonText: "Contact the financial aid office",
            },
            fr: { title: "Plans de paiement", listContent: ["Plans d'échelonnement mensuels sans intérêt"], buttonText: "Contactez le bureau d'aide financière" },
          },
        },
      },
      { sectionKey: "cta", componentType: "CtaSection", position: 4, content: { sourceLanguage: "en", translations: { en: {}, fr: {} } } },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const languageLabelFallback = (language: Language) => (language === "fr" ? "French" : "English");

function LanguageLegend({
  language,
  isPrimary,
}: {
  language: Language;
  isPrimary: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[#0b3e81]">
        {t("announcement.languageVersion", { language: languageLabelFallback(language) }) || `${languageLabelFallback(language)} version`}
      </span>
      {isPrimary ? (
        <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">
          {t("announcement.primaryLanguage") || "Primary"}
        </span>
      ) : null}
    </div>
  );
}

export default function TuitionEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTuitionPage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/tuition");
      if (res.ok) {
        const data = (await res.json()) as Partial<DynamicPage> & { sections?: unknown };
        const hasSections = Array.isArray(data.sections) && (data.sections as unknown[]).length > 0;

        if (hasSections) {
          setPage(data as DynamicPage);
          return;
        }

        const draft = createDraftTuitionPage();
        setPage({
          ...draft,
          id: typeof data.id === "string" ? data.id : draft.id,
          slug: typeof data.slug === "string" ? data.slug : draft.slug,
          title: typeof data.title === "string" ? data.title : draft.title,
          published: typeof data.published === "boolean" ? data.published : draft.published,
          createdAt: typeof data.createdAt === "string" ? data.createdAt : draft.createdAt,
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : draft.updatedAt,
        });
        return;
      }

      if (res.status === 404) {
        setPage(createDraftTuitionPage());
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to load Tuition page."));
      setPage(createDraftTuitionPage());
    } catch (error) {
      console.error("Error fetching tuition page:", error);
      setError("Failed to load Tuition page.");
      setPage(createDraftTuitionPage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTuitionPage();
  }, [fetchTuitionPage]);

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    setError("");

    try {
      const sanitizedPage: DynamicPage = {
        ...page,
        sections: page.sections.map((section) => {
          const rawContent = section.content as unknown;
          if (!isJsonObject(rawContent) || !("translations" in rawContent)) return section;
          const translationsCandidate = (rawContent as Record<string, unknown>).translations;
          if (!isJsonObject(translationsCandidate)) return section;
          const translations = translationsCandidate as Record<string, unknown>;
          const cleanedTranslations: Record<string, unknown> = { ...translations };
          for (const [language, value] of Object.entries(translations)) {
            if (!isJsonObject(value)) continue;
            const next = { ...value };
            delete next["className"];
            delete next["classNameCard"];
            cleanedTranslations[language] = next;
          }
          return {
            ...section,
            content: {
              ...(rawContent as JsonObject),
              translations: cleanedTranslations,
            },
          };
        }),
      };

      const method = "PUT";
      const endpoint = `/api/admin/pages/${page.slug}`;

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedPage),
      });

      if (res.ok) {
        const updated = await res.json();
        setPage(updated);
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to save Tuition page."));
    } catch (error) {
      console.error("Error saving page:", error);
      setError(error instanceof Error && error.message.trim() ? error.message : "Failed to save Tuition page.");
    } finally {
      setSaving(false);
    }
  };

  function apiErrorMessage(parsed: Record<string, unknown>, fallback: string) {
    const message = typeof parsed.error === "string" ? parsed.error : fallback;
    const database =
      parsed.database && typeof parsed.database === "object"
        ? (parsed.database as Record<string, unknown>)
        : null;
    const host = database && typeof database.host === "string" ? database.host : "";
    const dbName = database && typeof database.database === "string" ? database.database : "";
    const nodeEnv = typeof parsed.nodeEnv === "string" ? parsed.nodeEnv : "";

    if (!host && !dbName && !nodeEnv) return message;
    const dbLabel = host || dbName ? `${host || "?"}${dbName ? `/${dbName}` : ""}` : "";
    const envLabel = nodeEnv ? `env:${nodeEnv}` : "";
    const suffix = [dbLabel && `db:${dbLabel}`, envLabel].filter(Boolean).join(", ");
    return suffix ? `${message} (${suffix})` : message;
  }

  const updateSectionContent = (sectionId: string | undefined, sectionKey: string, newContent: JsonObject) => {
    setPage((prev) => {
      if (!prev) return prev;
      const nextSections = prev.sections.map((section) => {
        if (sectionId && section.id === sectionId) return { ...section, content: newContent };
        if (!sectionId && section.sectionKey === sectionKey) return { ...section, content: newContent };
        return section;
      });
      return { ...prev, sections: nextSections };
    });
  };

  if (loading) {
    return (
      <section className="brand-card p-6">
        <p className="text-sm font-semibold text-[#2e5f9e]">Loading Tuition page…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">Tuition Page Management</h3>
          <p className="brand-muted text-sm">Edit sections, images, and content.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchTuitionPage}
            disabled={loading || saving}
            className="btn-brand-secondary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !page}
            className="btn-brand-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      {error ? (
        <section className="brand-card border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">{error}</p>
        </section>
      ) : null}

      {!page ? (
        <section className="brand-card p-6">
          <p className="text-sm font-semibold text-[#083672]">Tuition page data is unavailable.</p>
          <p className="brand-muted mt-1 text-sm">Press Refresh to try again.</p>
        </section>
      ) : (
        <>
          <section className="brand-card p-6">
            <h4 className="brand-title text-xl font-black">Page Settings</h4>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5">
                <span className="brand-label">Page title</span>
                <input
                  type="text"
                  value={page.title}
                  onChange={(e) => setPage({ ...page, title: e.target.value })}
                  className="brand-input"
                />
              </label>
            </div>
          </section>

          <section className="space-y-6">
            {page.sections
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((section) => (
                <SectionCard
                  key={section.id || section.sectionKey}
                  section={section}
                  onUpdate={(content) => updateSectionContent(section.id, section.sectionKey, content)}
                />
              ))}
          </section>
        </>
      )}
    </section>
  );
}

interface SectionEditorProps {
  section: PageSection;
  onUpdate: (content: JsonObject) => void;
}

function SectionCard({ section, onUpdate }: SectionEditorProps) {
  const sectionConfig: Record<string, { label: string; description: string }> = {
    BannerSection: { label: "Hero Banner", description: "Intro banner with title, description, and background image." },
    IconCard: { label: "Tuition Overview", description: "Grid of tuition/fee highlights with icons and descriptions." },
    LearnSchedule: { label: "Financial Aid", description: "Two-column layout with image left, title/description/checklist right." },
    TuitionTableSection: { label: "Tuition Table", description: "Table of programs and tuition rates." },
    WhyAustin: { label: "Scholarships & Grants", description: "Highlight cards for scholarships and grants." },
    PaymentPlansSection: { label: "Payment Plans", description: "List of payment plan benefits and CTA." },
    CtaSection: { label: "Call to Action", description: "Bottom section with title, description, and buttons." },
  };

  const config = sectionConfig[section.componentType] || { label: section.sectionKey, description: "Edit this section." };

  return (
    <section className="brand-card p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="brand-title text-2xl font-black">{config.label}</h3>
          <p className="brand-muted text-sm">{config.description}</p>
        </div>
        <span className="brand-chip">SECTION {section.position + 1}</span>
      </div>

      {section.componentType === "BannerSection" && <BannerSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "IconCard" && <IconCardSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "TuitionTableSection" && <TuitionTableSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "WhyAustin" && <WhyAustinSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "LearnSchedule" && <LearnScheduleForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "PaymentPlansSection" && <PaymentPlansSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "CtaSection" && <CtaSectionForm content={section.content} onUpdate={onUpdate} />}

      {!["BannerSection", "IconCard", "TuitionTableSection", "WhyAustin", "LearnSchedule", "PaymentPlansSection", "CtaSection"].includes(section.componentType) && (
        <GenericSectionForm content={section.content} onUpdate={onUpdate} />
      )}
    </section>
  );
}

function GenericSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const [localJson, setLocalJson] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const lang of supportedLanguages) out[lang] = JSON.stringify(translations[lang] ?? {}, null, 2);
    return out;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const out: Record<string, string> = {};
    for (const lang of supportedLanguages) out[lang] = JSON.stringify((getLocalizedSectionEnvelopeDraft(content).translations[lang] ?? {}), null, 2);
    setLocalJson(out);
  }, [content]);

  const saveLang = (lang: string) => {
    try {
      const parsed = localJson[lang] ? JSON.parse(localJson[lang]) : {};
      onUpdate({ sourceLanguage, translations: { ...translations, [lang]: parsed } });
      setErrors((e) => ({ ...e, [lang]: "" }));
    } catch (err) {
      setErrors((e) => ({ ...e, [lang]: "Invalid JSON" }));
    }
  };

  return (
    <div className="space-y-4">
      {supportedLanguages.map((lang) => (
        <fieldset key={lang} className="grid gap-2 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#0b3e81]">{languageLabelFallback(lang)} JSON</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setLocalJson((s) => ({ ...s, [lang]: JSON.stringify(translations[lang] ?? {}, null, 2) })); }} className="btn-brand-secondary px-3 py-1 text-sm">Reset</button>
              <button type="button" onClick={() => saveLang(lang)} className="btn-brand-primary px-3 py-1 text-sm">Save</button>
            </div>
          </div>
          <textarea className="brand-input font-mono text-sm" rows={6} value={localJson[lang] ?? ""} onChange={(e) => setLocalJson((s) => ({ ...s, [lang]: e.target.value }))} />
          {errors[lang] ? <p className="text-xs text-red-700">{errors[lang]}</p> : null}
        </fieldset>
      ))}
    </div>
  );
}

// Reuse forms from other editors where possible
function BannerSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

  const setSourceLanguage = (next: Language) => {
    onUpdate({ sourceLanguage: next, translations });
  };

  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const updateAllTranslations = (updater: (current: JsonObject) => JsonObject) => {
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sharedBgImg = asString(translations[sourceLanguage]?.bgImg);

  return (
    <div className="space-y-4">
      <AdminImagePicker
        label="Background image (shared)"
        value={sharedBgImg}
        onChange={(next) => updateAllTranslations((current) => ({ ...current, bgImg: next, bgImgStorageKey: undefined }))}
        onUpload={(result) => updateAllTranslations((current) => ({ ...current, bgImg: result.publicUrl, bgImgStorageKey: result.storageKey }))}
      />

      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value as Language)}>
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>{languageLabelFallback(lang)}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const fields = translations[lang] ?? {};
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea className="brand-input" value={asString(fields.description)} onChange={(e) => updateTranslation(lang, { ...fields, description: e.target.value })} rows={4} />
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function IconCardSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

  const setSourceLanguage = (next: Language) => {
    onUpdate({ sourceLanguage: next, translations });
  };

  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const updateAllTranslations = (updater: (current: JsonObject) => JsonObject) => {
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceCards = asArrayOfObjects(translations[sourceLanguage]?.blockContent);

  const addCard = () => {
    updateAllTranslations((current) => ({
      ...current,
      blockContent: [...(Array.isArray(current.blockContent) ? current.blockContent : []), { cardTitle: "", cardDescription: "", icon: "" }],
    }));
  };

  const removeCard = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      blockContent: (Array.isArray(current.blockContent) ? current.blockContent : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateSharedCardField = (index: number, field: "icon", value: string) => {
    updateAllTranslations((current) => {
      const cards = Array.isArray(current.blockContent) ? [...current.blockContent] : [];
      cards[index] = { ...(cards[index] ?? {}), [field]: value };
      return { ...current, blockContent: cards };
    });
  };

  const updateCardField = (language: Language, index: number, field: "cardTitle" | "cardDescription", value: string) => {
    const fields = translations[language] ?? {};
    const cards = Array.isArray(fields.blockContent) ? [...fields.blockContent] : [];
    cards[index] = { ...(cards[index] ?? {}), [field]: value };
    updateTranslation(language, { ...fields, blockContent: cards });
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value as Language)}>
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>{languageLabelFallback(lang)}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const fields = translations[lang] ?? {};
          const cards = asArrayOfObjects(fields.blockContent);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })}
                  required={isPrimary}
                />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Highlight Cards</h3>
                {isPrimary && <button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Card</button>}
              </div>

              <div className="space-y-4">
                {(isPrimary ? sourceCards : cards).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4 space-y-2">
                    <input type="text" placeholder="Card Title" value={asString(cards[i]?.cardTitle)} onChange={(e) => updateCardField(lang, i, "cardTitle", e.target.value)} className="brand-input text-sm" />
                    <textarea placeholder="Description" value={asString(cards[i]?.cardDescription)} onChange={(e) => updateCardField(lang, i, "cardDescription", e.target.value)} className="brand-input text-sm" rows={2} />
                    <AdminImagePicker
                      label="Icon (shared)"
                      value={asString(cards[i]?.icon || sourceCards[i]?.icon)}
                      onChange={(next) => updateSharedCardField(i, "icon", next)}
                      compact
                    />
                    {isPrimary && <button type="button" onClick={() => removeCard(i)} className="text-xs font-semibold text-red-700">Remove Card</button>}
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function LearnScheduleForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const list = Array.isArray(translations[sourceLanguage]?.list) ? translations[sourceLanguage].list : [];

  const addList = () => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), list: [...list, ""] });
  const updateList = (index: number, next: string) => {
    const nextList = list.slice();
    nextList[index] = next;
    updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), list: nextList });
  };
  const removeList = (index: number) => {
    const nextList = list.slice();
    nextList.splice(index, 1);
    updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), list: nextList });
  };

  return (
    <div className="space-y-4">
      <AdminImagePicker
        label="Image"
        value={asString(translations[sourceLanguage]?.image)}
        onChange={(next) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), image: next })}
        onUpload={(result) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), image: result.publicUrl })}
      />

      <div className="grid gap-3">
        <input type="text" value={asString(translations[sourceLanguage]?.title)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), title: e.currentTarget.value })} className="brand-input" placeholder="Title" />
        <textarea value={asString(translations[sourceLanguage]?.description)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), description: e.currentTarget.value })} className="brand-input" placeholder="Description" />
      </div>

      <div className="space-y-2">
        {list.map((item: unknown, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <input type="text" value={String(item ?? "")} onChange={(e) => updateList(idx, e.currentTarget.value)} className="brand-input" />
            <button type="button" onClick={() => removeList(idx)} className="text-sm font-semibold text-red-700">Remove</button>
          </div>
        ))}
        <div>
          <button type="button" onClick={addList} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold">Add item</button>
        </div>
      </div>
    </div>
  );
}

function CtaSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const setSourceLanguage = (next: Language) => onUpdate({ sourceLanguage: next, translations });

  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const updateAllTranslations = (updater: (current: JsonObject) => JsonObject) => {
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceButtons = Array.isArray(translations[sourceLanguage]?.buttons) ? (translations[sourceLanguage].buttons as string[]) : [];

  const addButton = () => {
    updateAllTranslations((current) => ({
      ...current,
      buttons: [...(Array.isArray(current.buttons) ? current.buttons : []), ""],
    }));
  };

  const removeButton = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      buttons: (Array.isArray(current.buttons) ? current.buttons : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateButton = (language: Language, index: number, value: string) => {
    const fields = translations[language] ?? {};
    const buttons = Array.isArray(fields.buttons) ? [...fields.buttons] : [];
    buttons[index] = value;
    updateTranslation(language, { ...fields, buttons });
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value as Language)}>
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>{languageLabelFallback(lang)}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const fields = translations[lang] ?? {};
          const buttons = Array.isArray(fields.buttons) ? (fields.buttons as string[]) : [];
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea className="brand-input" value={asString(fields.desc)} onChange={(e) => updateTranslation(lang, { ...fields, desc: e.target.value })} rows={3} />
              </label>

              <div className="flex justify-between items-center mt-2">
                <span className="brand-label">Buttons</span>
                {isPrimary && <button type="button" onClick={addButton} className="btn-brand-secondary px-2 py-1 text-xs font-semibold">+ Add Button</button>}
              </div>
              <div className="space-y-2">
                {(isPrimary ? sourceButtons : buttons).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={buttons[i] ?? ""} onChange={(e) => updateButton(lang, i, e.target.value)} className="brand-input flex-1 text-sm" />
                    {isPrimary && <button type="button" onClick={() => removeButton(i)} className="text-xs font-semibold text-red-700">Remove</button>}
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function TuitionTableSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });

  const headings = Array.isArray(translations[sourceLanguage]?.tableHeadings) ? translations[sourceLanguage].tableHeadings as string[] : [];
  const rows = Array.isArray(translations[sourceLanguage]?.tableData) ? translations[sourceLanguage].tableData as JsonObject[] : [];

  const addHeading = () => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableHeadings: [...headings, ""] });
  const updateHeading = (i: number, v: string) => { const next = headings.slice(); next[i] = v; updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableHeadings: next }); };

  const addRow = () => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableData: [...rows, { program: "", perYear: "", perCredit: "" }] });
  const updateRow = (i: number, key: string, v: string) => { const next = rows.slice(); next[i] = { ...(next[i] ?? {}), [key]: v }; updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableData: next }); };
  const removeRow = (i: number) => { const next = rows.slice(); next.splice(i, 1); updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableData: next }); };

  return (
    <div className="space-y-4">
      <fieldset className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
        <LanguageLegend language={sourceLanguage} isPrimary={true} />
        <label className="grid gap-1.5"><span className="brand-label">Title</span><input className="brand-input" value={asString(translations[sourceLanguage]?.title)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), title: e.target.value })} /></label>

        <div>
          <h4 className="font-semibold">Table Headings</h4>
          <div className="space-y-2">
            {headings.map((h, i) => (<div key={i} className="flex gap-2"><input className="brand-input flex-1" value={h} onChange={(e) => updateHeading(i, e.target.value)} /><button type="button" onClick={() => { const next = headings.slice(); next.splice(i, 1); updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), tableHeadings: next }); }} className="text-xs font-semibold text-red-700">Remove</button></div>))}
            <button type="button" onClick={addHeading} className="btn-brand-secondary px-3 py-1.5">+ Add heading</button>
          </div>
        </div>

        <div>
          <h4 className="font-semibold">Table Rows</h4>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="brand-panel rounded-lg p-3 grid gap-2">
                <input className="brand-input" placeholder="Program" value={asString(r.program)} onChange={(e) => updateRow(i, "program", e.target.value)} />
                <input className="brand-input" placeholder="Per Year" value={asString(r.perYear)} onChange={(e) => updateRow(i, "perYear", e.target.value)} />
                <input className="brand-input" placeholder="Per Credit/Semester" value={asString(r.perCredit)} onChange={(e) => updateRow(i, "perCredit", e.target.value)} />
                <div className="flex justify-end"><button type="button" onClick={() => removeRow(i)} className="text-xs font-semibold text-red-700">Remove row</button></div>
              </div>
            ))}
            <button type="button" onClick={addRow} className="btn-brand-secondary px-3 py-1.5">+ Add row</button>
          </div>
        </div>
      </fieldset>
    </div>
  );
}

function WhyAustinSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  // similar to IconCard / WhyGive
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  const cards = asArrayOfObjects(translations[sourceLanguage]?.whiteCards);
  const updateAll = (updater: (cur: JsonObject) => JsonObject) => {
    const next = { ...translations } as Record<Language, JsonObject>;
    for (const lang of supportedLanguages) next[lang] = updater(translations[lang] ?? {});
    onUpdate({ sourceLanguage, translations: next });
  };

  const addCard = () => updateAll((c) => ({ ...c, whiteCards: [...(Array.isArray(c.whiteCards) ? c.whiteCards : []), { icon: "", title: "", description: "" }] }));
  const updateCard = (lang: Language, idx: number, field: string, v: string) => { const f = translations[lang] ?? {}; const items = Array.isArray(f.whiteCards) ? [...f.whiteCards] : []; items[idx] = { ...(items[idx] ?? {}), [field]: v }; updateTranslation(lang, { ...f, whiteCards: items }); };
  const removeCard = (idx: number) => updateAll((c) => ({ ...c, whiteCards: (Array.isArray(c.whiteCards) ? c.whiteCards : []).filter((_: any, i: number) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const f = translations[lang] ?? {};
          const items = asArrayOfObjects(f.whiteCards);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5"><span className="brand-label">Section Title</span><input className="brand-input" value={asString(f.secTitle)} onChange={(e) => updateTranslation(lang, { ...f, secTitle: e.target.value })} required={isPrimary} /></label>
              <div className="space-y-4">{(isPrimary ? cards : items).map((_, i) => (<div key={i} className="brand-panel rounded-lg p-4"><input className="brand-input" placeholder="Card title" value={asString(items[i]?.title)} onChange={(e) => updateCard(lang, i, "title", e.target.value)} /><textarea className="brand-input" placeholder="Description" rows={2} value={asString(items[i]?.description)} onChange={(e) => updateCard(lang, i, "description", e.target.value)} /><AdminImagePicker label="Icon (shared)" value={asString(items[i]?.icon || cards[i]?.icon)} onChange={(next) => updateTranslation(lang, { ...f, whiteCards: (Array.isArray(f.whiteCards) ? f.whiteCards : []).map((it: any, idx: number) => idx === i ? { ...(it ?? {}), icon: next } : it) })} compact /><button type="button" onClick={() => removeCard(i)} className="text-xs font-semibold text-red-700">Remove</button></div>))}<button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1.5">+ Add card</button></div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function PaymentPlansSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const setSourceLanguage = (next: Language) => onUpdate({ sourceLanguage: next, translations });
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });

  const updateAllTranslations = (updater: (current: JsonObject) => JsonObject) => {
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceList = Array.isArray(translations[sourceLanguage]?.listContent) ? (translations[sourceLanguage].listContent as string[]) : [];
  const listFor = (lang: Language) => (Array.isArray(translations[lang]?.listContent) ? (translations[lang].listContent as string[]) : []);

  const addItem = () => updateAllTranslations((cur) => ({ ...cur, listContent: [...(Array.isArray(cur.listContent) ? cur.listContent : []), ""] }));
  const removeItem = (index: number) => updateAllTranslations((cur) => ({ ...cur, listContent: (Array.isArray(cur.listContent) ? cur.listContent : []).filter((_: unknown, i: number) => i !== index) }));
  const updateItem = (language: Language, index: number, value: string) => {
    const fields = translations[language] ?? {};
    const items = Array.isArray(fields.listContent) ? [...fields.listContent] : [];
    items[index] = value;
    updateTranslation(language, { ...fields, listContent: items });
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value as Language)}>
          {supportedLanguages.map((lang) => (<option key={lang} value={lang}>{languageLabelFallback(lang)}</option>))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const items = isPrimary ? sourceList : listFor(lang);
          const fields = translations[lang] ?? {};
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5"><span className="brand-label">Title</span><input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} /></label>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="brand-input flex-1" value={it} onChange={(e) => updateItem(lang, i, e.target.value)} />
                    {isPrimary ? <button type="button" onClick={() => removeItem(i)} className="text-xs font-semibold text-red-700">Remove</button> : null}
                  </div>
                ))}
                {isPrimary ? <button type="button" onClick={addItem} className="btn-brand-secondary px-3 py-1.5">+ Add item</button> : null}
              </div>
              <label className="grid gap-1.5 mt-2"><span className="brand-label">Button Text</span><input className="brand-input" value={asString(fields.buttonText)} onChange={(e) => updateTranslation(lang, { ...fields, buttonText: e.target.value })} /></label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
