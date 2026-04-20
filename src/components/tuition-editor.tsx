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
    title: "Tuition & Financial Aid",
    published: false,
    sections: [
      {
        sectionKey: "hero",
        componentType: "BannerSection",
        position: 0,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Tuition & Financial Aid",
              description: "Learn about tuition, fees, and financial aid options at St. Austin's International University.",
              bgImg: "/bannerImg.jpg",
            },
            fr: {
              title: "Tuition & Financial Aid",
              description: "Learn about tuition, fees, and financial aid options at St. Austin's International University.",
              bgImg: "/bannerImg.jpg",
            },
          },
        },
      },
      {
        sectionKey: "tuition-fees",
        componentType: "IconCard",
        position: 1,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Tuition & Fees Overview",
              blockContent: [
                { cardTitle: "Undergraduate Tuition", cardDescription: "Competitive per-credit rates for undergraduate programs.", icon: "/awards-icon.png" },
                { cardTitle: "Graduate Tuition", cardDescription: "Graduate-level tuition and program fees.", icon: "/business-icon.png" },
                { cardTitle: "Payment Plans", cardDescription: "Flexible payment options and schedule plans.", icon: "/nursing-icon.png" },
              ],
            },
            fr: {
              title: "Tuition & Fees Overview",
              blockContent: [
                { cardTitle: "Undergraduate Tuition", cardDescription: "Competitive per-credit rates for undergraduate programs.", icon: "/awards-icon.png" },
                { cardTitle: "Graduate Tuition", cardDescription: "Graduate-level tuition and program fees.", icon: "/business-icon.png" },
                { cardTitle: "Payment Plans", cardDescription: "Flexible payment options and schedule plans.", icon: "/nursing-icon.png" },
              ],
            },
          },
        },
      },
      {
        sectionKey: "financial-aid",
        componentType: "LearnSchedule",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              image: "/cta-img.png",
              title: "Financial Aid & Scholarships",
              description: "Information on grants, scholarships, and loans to support your studies.",
              list: [
                "Scholarships based on merit and need",
                "Federal and private loan guidance",
                "Work-study and assistantships",
              ],
            },
            fr: {
              image: "/cta-img.png",
              title: "Financial Aid & Scholarships",
              description: "Information on grants, scholarships, and loans to support your studies.",
              list: [
                "Scholarships based on merit and need",
                "Federal and private loan guidance",
                "Work-study and assistantships",
              ],
            },
          },
        },
      },
      {
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Questions about Tuition?", desc: "Contact our Admissions team for personalized guidance.", buttons: ["Contact Admissions"] },
            fr: { title: "Questions about Tuition?", desc: "Contact our Admissions team for personalized guidance.", buttons: ["Contact Admissions"] },
          },
        },
      },
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
      {section.componentType === "LearnSchedule" && <LearnScheduleForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "CtaSection" && <CtaSectionForm content={section.content} onUpdate={onUpdate} />}

      {!["BannerSection", "IconCard", "LearnSchedule", "CtaSection"].includes(section.componentType) && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">Raw JSON editor</p>
          <textarea
            value={JSON.stringify(section.content, null, 2)}
            readOnly
            className="w-full min-h-[240px] resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-700"
          />
          <p className="text-sm text-slate-500">This section type is not supported by the visual editor.</p>
        </div>
      )}
    </section>
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

  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const buttons = Array.isArray(translations[sourceLanguage]?.buttons) ? translations[sourceLanguage].buttons : [];

  const updateButtons = (next: string[]) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), buttons: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <input type="text" value={asString(translations[sourceLanguage]?.title)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), title: e.currentTarget.value })} className="brand-input" placeholder="Title" />
        <textarea value={asString(translations[sourceLanguage]?.desc)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), desc: e.currentTarget.value })} className="brand-input" placeholder="Description" />
      </div>

      <div className="space-y-2">
        {buttons.map((b: unknown, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <input type="text" value={String(b ?? "")} onChange={(e) => {
              const next = buttons.slice();
              next[idx] = e.currentTarget.value;
              updateButtons(next);
            }} className="brand-input" />
            <button type="button" onClick={() => { const next = buttons.slice(); next.splice(idx, 1); updateButtons(next); }} className="text-sm font-semibold text-red-700">Remove</button>
          </div>
        ))}
        <div>
          <button type="button" onClick={() => updateButtons([...buttons, "New Button"])} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold">Add button</button>
        </div>
      </div>
    </div>
  );
}
