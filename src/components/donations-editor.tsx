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

function createDraftDonationsPage(): DynamicPage {
  return {
    id: "",
    slug: "donations",
    title: "Donations Page",
    published: false,
    sections: [
      {
        sectionKey: "banner",
        componentType: "BannerSection",
        position: 0,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Support Our Mission Through Donations", description: "Help Us Make Education Accessible to Everyone", bgImg: "/bannerImg.jpg" },
            fr: { title: "Support Our Mission Through Donations", description: "Help Us Make Education Accessible to Everyone", bgImg: "/bannerImg.jpg" },
          },
        },
      },
      {
        sectionKey: "donationForm",
        componentType: "DonationFormSection",
        position: 1,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Choose Your Donation Amount",
              oneTimeAmounts: ["XAF 2,500", "XAF 5,000", "XAF 10,000", "XAF 25,000", "XAF 50,000", "XAF 100,000"],
              designationOptions: ["Where It's Needed Most", "Student Scholarships", "Campus Ministry", "Academic Programs"],
              paymentMethods: [
                { value: "mtn_mobile_money", label: "MTN Mobile Money (CamPay)" },
                { value: "orange_money", label: "Orange Money (CamPay)" },
                { value: "credit_card", label: "Credit Card (CamPay)" },
                { value: "bank_transfer", label: "Bank Payment" },
              ],
            },
            fr: {
              title: "Choose Your Donation Amount",
              oneTimeAmounts: ["XAF 2,500", "XAF 5,000", "XAF 10,000"],
              designationOptions: ["Where It's Needed Most"],
              paymentMethods: [{ value: "mtn_mobile_money", label: "MTN Mobile Money (CamPay)" }],
            },
          },
        },
      },
      {
        sectionKey: "whyGive",
        componentType: "WhyGiveSection",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { stats: { raised: "$2.4M", students: "1,200+" }, description: "Your generosity directly impacts students' lives. Last year, donor-funded scholarships helped over 1,200 students complete their degrees and launch successful careers." },
            fr: { stats: { raised: "$2.4M", students: "1,200+" }, description: "Your generosity directly impacts students' lives." },
          },
        },
      },
      {
        sectionKey: "otherWays",
        componentType: "OtherWaysSection",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Other Ways to Give", items: ["Mail a check to St. Austin University, Office of Advancement", "Donate stock, securities, or cryptocurrency", "Include St. Austin in your estate plans", "Set up a donor-advised fund gift"] },
            fr: { title: "Other Ways to Give", items: ["Mail a check to St. Austin University, Office of Advancement"] },
          },
        },
      },
      {
        sectionKey: "impact",
        componentType: "Accreditation",
        position: 4,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Your Impact", blockContent: [ { cardTitle: "Student Scholarships", cardDescription: "Every dollar donated funds scholarships to help students achieve their degrees and transform their careers.", icon: "/carbon_gui-management.png" }, { cardTitle: "Academic Programs", cardDescription: "Support the development of innovative programs that prepare students for the demands of a modern workforce.", icon: "/tabler_message-check.png" }, { cardTitle: "Student Support Services", cardDescription: "Help fund mentoring, tutoring, career counseling, and wellness resources for our diverse student body.", icon: "/hugeicons_progress-04.png" } ] },
            fr: { title: "Your Impact", blockContent: [] },
          },
        },
      },
      { sectionKey: "matchingGift", componentType: "MatchingGiftSection", position: 5, content: { sourceLanguage: "en", translations: { en: {}, fr: {} } } },
      { sectionKey: "cta", componentType: "CtaSection", position: 6, content: { sourceLanguage: "en", translations: { en: {}, fr: {} } } },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const languageLabelFallback = (language: Language) => (language === "fr" ? "French" : "English");

function LanguageLegend({ language, isPrimary }: { language: Language; isPrimary: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[#0b3e81]">{t("announcement.languageVersion", { language: languageLabelFallback(language) }) || `${languageLabelFallback(language)} version`}</span>
      {isPrimary ? <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">{t("announcement.primaryLanguage") || "Primary"}</span> : null}
    </div>
  );
}

export default function DonationsEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchDonationsPage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/donations");
      if (res.ok) {
        const data = (await res.json()) as Partial<DynamicPage> & { sections?: unknown };
        const hasSections = Array.isArray(data.sections) && (data.sections as unknown[]).length > 0;
        if (hasSections) { setPage(data as DynamicPage); return; }
        const draft = createDraftDonationsPage();
        setPage({ ...draft, id: typeof data.id === "string" ? data.id : draft.id, slug: typeof data.slug === "string" ? data.slug : draft.slug, title: typeof data.title === "string" ? data.title : draft.title, published: typeof data.published === "boolean" ? data.published : draft.published, createdAt: typeof data.createdAt === "string" ? data.createdAt : draft.createdAt, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : draft.updatedAt });
        return;
      }
      if (res.status === 404) { setPage(createDraftDonationsPage()); return; }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to load Donations page."));
      setPage(createDraftDonationsPage());
    } catch (error) { console.error("Error fetching donations page:", error); setError("Failed to load Donations page."); setPage(createDraftDonationsPage()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchDonationsPage(); }, [fetchDonationsPage]);

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    setError("");
    try {
      const sanitizedPage: DynamicPage = { ...page, sections: page.sections.map((section) => { const rawContent = section.content as unknown; if (!isJsonObject(rawContent) || !("translations" in rawContent)) return section; const translationsCandidate = (rawContent as Record<string, unknown>).translations; if (!isJsonObject(translationsCandidate)) return section; const translations = translationsCandidate as Record<string, unknown>; const cleanedTranslations: Record<string, unknown> = { ...translations }; for (const [language, value] of Object.entries(translations)) { if (!isJsonObject(value)) continue; const next = { ...value }; delete next["className"]; delete next["classNameCard"]; cleanedTranslations[language] = next; } return { ...section, content: { ...(rawContent as JsonObject), translations: cleanedTranslations } }; }), };

      const method = "PUT";
      const endpoint = `/api/admin/pages/${page.slug}`;
      const res = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(sanitizedPage) });
      if (res.ok) { const updated = await res.json(); setPage(updated); return; }
      const raw = await res.text(); const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; setError(apiErrorMessage(parsed, "Failed to save Donations page."));
    } catch (error) { console.error("Error saving page:", error); setError(error instanceof Error && error.message.trim() ? error.message : "Failed to save Donations page."); } finally { setSaving(false); }
  };

  function apiErrorMessage(parsed: Record<string, unknown>, fallback: string) {
    const message = typeof parsed.error === "string" ? parsed.error : fallback;
    const database = parsed.database && typeof parsed.database === "object" ? (parsed.database as Record<string, unknown>) : null;
    const host = database && typeof database.host === "string" ? database.host : "";
    const dbName = database && typeof database.database === "string" ? database.database : "";
    const nodeEnv = typeof parsed.nodeEnv === "string" ? parsed.nodeEnv : "";
    if (!host && !dbName && !nodeEnv) return message;
    const dbLabel = host || dbName ? `${host || "?"}${dbName ? `/${dbName}` : ""}` : "";
    const envLabel = nodeEnv ? `env:${nodeEnv}` : "";
    const suffix = [dbLabel && `db:${dbLabel}`, envLabel].filter(Boolean).join(", ");
    return suffix ? `${message} (${suffix})` : message;
  }

  const updateSectionContent = (sectionId: string | undefined, sectionKey: string, newContent: JsonObject) => { setPage((prev) => { if (!prev) return prev; const nextSections = prev.sections.map((section) => { if (sectionId && section.id === sectionId) return { ...section, content: newContent }; if (!sectionId && section.sectionKey === sectionKey) return { ...section, content: newContent }; return section; }); return { ...prev, sections: nextSections }; }); };

  if (loading) { return (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#2e5f9e]">Loading Donations page…</p></section>); }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">Donations Page Management</h3>
          <p className="brand-muted text-sm">Edit sections, images, and content.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={fetchDonationsPage} disabled={loading || saving} className="btn-brand-secondary px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button>
          <button type="button" onClick={handleSave} disabled={saving || !page} className="btn-brand-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </header>

      {error ? (<section className="brand-card border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">{error}</p></section>) : null}

      {!page ? (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#083672]">Donations page data is unavailable.</p><p className="brand-muted mt-1 text-sm">Press Refresh to try again.</p></section>) : (
        <>
          <section className="brand-card p-6"><h4 className="brand-title text-xl font-black">Page Settings</h4><div className="mt-4 grid gap-4"><label className="grid gap-1.5"><span className="brand-label">Page title</span><input type="text" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} className="brand-input" /></label></div></section>

          <section className="space-y-6">{page.sections.slice().sort((a, b) => a.position - b.position).map((section) => (<SectionCard key={section.id || section.sectionKey} section={section} onUpdate={(content) => updateSectionContent(section.id, section.sectionKey, content)} />))}</section>
        </>
      )}
    </section>
  );
}

interface SectionEditorProps { section: PageSection; onUpdate: (content: JsonObject) => void; }

function SectionCard({ section, onUpdate }: SectionEditorProps) {
  const sectionConfig: Record<string, { label: string; description: string }> = {
    BannerSection: { label: "Hero Banner", description: "Intro banner with title, description, and background image." },
    IconCard: { label: "How to Give", description: "Grid of donation options and descriptions." },
    DonationFormSection: { label: "Donation Form", description: "Form settings for one-time amounts and payment methods." },
    WhyGiveSection: { label: "Why Give", description: "Statistics and description about donations." },
    OtherWaysSection: { label: "Other Ways to Give", description: "Alternate donation channels and instructions." },
    Accreditation: { label: "Your Impact", description: "Impact/blocks showing donor-funded results." },
    MatchingGiftSection: { label: "Matching Gift", description: "Matching gift info or CTA." },
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
      {section.componentType === "DonationFormSection" && <DonationFormSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "WhyGiveSection" && <WhyGiveSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "OtherWaysSection" && <OtherWaysSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "Accreditation" && <AccreditationSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "MatchingGiftSection" && <MatchingGiftSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "CtaSection" && <CtaSectionForm content={section.content} onUpdate={onUpdate} />}

      {!["BannerSection", "IconCard", "DonationFormSection", "WhyGiveSection", "OtherWaysSection", "Accreditation", "MatchingGiftSection", "CtaSection"].includes(section.componentType) && (
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

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const fields = translations[entryLanguage] ?? {};
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0b3e81]">{languageLabelFallback(entryLanguage)} version</span>
                  {entryLanguage === sourceLanguage ? (
                    <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">Primary</span>
                  ) : null}
                </div>
                {entryLanguage === sourceLanguage ? (
                  <div className="text-sm font-semibold text-slate-600">Primary language</div>
                ) : null}
              </div>

              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea
                  className="brand-input"
                  value={asString(fields.description)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, description: e.target.value })}
                  rows={4}
                />
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
                <h3 className="font-semibold">Items</h3>
                {isPrimary && <button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Item</button>}
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
                    {isPrimary && <button type="button" onClick={() => removeCard(i)} className="text-xs font-semibold text-red-700">Remove Item</button>}
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

function CtaSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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

function DonationFormSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const updateTranslation = (language: Language, nextValue: JsonObject) => {
    onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  };

  const updateAllTranslations = (updater: (current: JsonObject) => JsonObject) => {
    const nextTranslations: Record<Language, JsonObject> = {} as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const oneTimeFor = (lang: Language) => (Array.isArray(translations[lang]?.oneTimeAmounts) ? translations[lang].oneTimeAmounts as string[] : []);
  const designationsFor = (lang: Language) => (Array.isArray(translations[lang]?.designationOptions) ? translations[lang].designationOptions as string[] : []);
  const paymentMethodsFor = (lang: Language) => (Array.isArray(translations[lang]?.paymentMethods) ? translations[lang].paymentMethods as JsonObject[] : []);

  const addOneTime = () => updateAllTranslations((cur) => ({ ...cur, oneTimeAmounts: [...(Array.isArray(cur.oneTimeAmounts) ? cur.oneTimeAmounts : []), ""] }));
  const updateOneTime = (language: Language, index: number, value: string) => { const items = oneTimeFor(language).slice(); items[index] = value; updateTranslation(language, { ...(translations[language] ?? {}), oneTimeAmounts: items }); };
  const removeOneTime = (language: Language, index: number) => { const items = oneTimeFor(language).slice(); items.splice(index, 1); updateTranslation(language, { ...(translations[language] ?? {}), oneTimeAmounts: items }); };

  const addDesignation = () => updateAllTranslations((cur) => ({ ...cur, designationOptions: [...(Array.isArray(cur.designationOptions) ? cur.designationOptions : []), ""] }));
  const updateDesignation = (language: Language, index: number, value: string) => { const items = designationsFor(language).slice(); items[index] = value; updateTranslation(language, { ...(translations[language] ?? {}), designationOptions: items }); };
  const removeDesignation = (language: Language, index: number) => { const items = designationsFor(language).slice(); items.splice(index, 1); updateTranslation(language, { ...(translations[language] ?? {}), designationOptions: items }); };

  const addPaymentMethod = () => updateAllTranslations((cur) => ({ ...cur, paymentMethods: [...(Array.isArray(cur.paymentMethods) ? cur.paymentMethods : []), { value: "", label: "" }] }));
  const updatePaymentMethod = (language: Language, index: number, key: "value" | "label", value: string) => { const items = paymentMethodsFor(language).slice(); items[index] = { ...(items[index] ?? {}), [key]: value }; updateTranslation(language, { ...(translations[language] ?? {}), paymentMethods: items }); };
  const removePaymentMethod = (language: Language, index: number) => { const items = paymentMethodsFor(language).slice(); items.splice(index, 1); updateTranslation(language, { ...(translations[language] ?? {}), paymentMethods: items }); };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" value={sourceLanguage} onChange={(e) => onUpdate({ sourceLanguage: e.target.value as Language, translations })}>
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>{languageLabelFallback(lang)}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const fields = translations[lang] ?? {};
          const oneTime = oneTimeFor(lang);
          const designations = designationsFor(lang);
          const paymentMethods = paymentMethodsFor(lang);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...(translations[lang] ?? {}), title: e.target.value })} />
              </label>

              <div>
                <h4 className="font-semibold">One-time Amounts</h4>
                <div className="space-y-2">
                  {oneTime.map((amt, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="brand-input flex-1" value={amt} onChange={(e) => updateOneTime(lang, i, e.target.value)} />
                      {isPrimary ? <button type="button" onClick={() => removeOneTime(lang, i)} className="text-xs font-semibold text-red-700">Remove</button> : null}
                    </div>
                  ))}
                  {isPrimary ? <button type="button" onClick={addOneTime} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold">+ Add amount</button> : null}
                </div>
              </div>

              <div>
                <h4 className="font-semibold">Designation Options</h4>
                <div className="space-y-2">
                  {designations.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="brand-input flex-1" value={d} onChange={(e) => updateDesignation(lang, i, e.target.value)} />
                      {isPrimary ? <button type="button" onClick={() => removeDesignation(lang, i)} className="text-xs font-semibold text-red-700">Remove</button> : null}
                    </div>
                  ))}
                  {isPrimary ? <button type="button" onClick={addDesignation} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold">+ Add option</button> : null}
                </div>
              </div>

              <div>
                <h4 className="font-semibold">Payment Methods</h4>
                <div className="space-y-2">
                  {paymentMethods.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input className="brand-input" placeholder="value" value={asString(m.value)} onChange={(e) => updatePaymentMethod(lang, i, "value", e.target.value)} />
                      <input className="brand-input" placeholder="label" value={asString(m.label)} onChange={(e) => updatePaymentMethod(lang, i, "label", e.target.value)} />
                      <div className="flex items-center gap-2">
                        {isPrimary ? <button type="button" onClick={() => removePaymentMethod(lang, i)} className="text-xs font-semibold text-red-700">Remove</button> : null}
                      </div>
                    </div>
                  ))}
                  {isPrimary ? <button type="button" onClick={addPaymentMethod} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold">+ Add method</button> : null}
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function WhyGiveSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  const updateAll = (updater: (cur: JsonObject) => JsonObject) => { const next = { ...translations } as Record<Language, JsonObject>; for (const lang of supportedLanguages) next[lang] = updater(translations[lang] ?? {}); onUpdate({ sourceLanguage, translations: next }); };
  const cards = asArrayOfObjects(translations[sourceLanguage]?.blockContent);
  const addCard = () => updateAll((c) => ({ ...c, blockContent: [...(Array.isArray(c.blockContent) ? c.blockContent : []), { cardTitle: "", cardDescription: "", icon: "" }] }));
  const updateCard = (lang: Language, idx: number, field: string, value: string) => { const f = translations[lang] ?? {}; const items = Array.isArray(f.blockContent) ? [...f.blockContent] : []; items[idx] = { ...(items[idx] ?? {}), [field]: value }; updateTranslation(lang, { ...f, blockContent: items }); };
  const removeCard = (idx: number) => updateAll((c) => ({ ...c, blockContent: (Array.isArray(c.blockContent) ? c.blockContent : []).filter((_: any, i: number) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const f = translations[lang] ?? {};
          const items = asArrayOfObjects(f.blockContent);
          const primaryCards = asArrayOfObjects(translations[sourceLanguage]?.blockContent);
          const maxCount = Math.max(primaryCards.length, items.length);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(f.title)} onChange={(e) => updateTranslation(lang, { ...f, title: e.target.value })} required={isPrimary} />
              </label>
              <div className="space-y-4">
                {Array.from({ length: maxCount }).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4">
                    <input className="brand-input" placeholder="Card title" value={asString(items[i]?.cardTitle)} onChange={(e) => updateCard(lang, i, "cardTitle", e.target.value)} />
                    <textarea className="brand-input" placeholder="Card description" rows={2} value={asString(items[i]?.cardDescription)} onChange={(e) => updateCard(lang, i, "cardDescription", e.target.value)} />
                    <AdminImagePicker label="Icon (shared)" value={asString(items[i]?.icon || primaryCards[i]?.icon)} onChange={(next) => updateAll((c) => ({ ...c, blockContent: [...(Array.isArray(c.blockContent) ? c.blockContent : []).map((it: any, idx: number) => idx === i ? { ...(it ?? {}), icon: next } : it)] }))} compact />
                    {isPrimary && (
                      <button type="button" onClick={() => removeCard(i)} className="text-xs font-semibold text-red-700">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {lang === sourceLanguage && (
                  <button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1.5">
                    + Add card
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function OtherWaysSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  const list = Array.isArray(translations[sourceLanguage]?.items) ? translations[sourceLanguage].items as string[] : [];
  const addItem = () => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), items: [...list, ""] });
  const updateItem = (i: number, v: string) => { const next = list.slice(); next[i] = v; updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), items: next }); };
  const removeItem = (i: number) => { const next = list.slice(); next.splice(i, 1); updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), items: next }); };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs"><span className="brand-label">Primary Language</span><select className="brand-input" value={sourceLanguage} onChange={(e) => onUpdate({ sourceLanguage: e.target.value as Language, translations })}>{supportedLanguages.map((lang) => (<option key={lang} value={lang}>{languageLabelFallback(lang)}</option>))}</select></label>
      <fieldset className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
        <LanguageLegend language={sourceLanguage} isPrimary={true} />
        <label className="grid gap-1.5"><span className="brand-label">Title</span><input className="brand-input" value={asString(translations[sourceLanguage]?.title)} onChange={(e) => updateTranslation(sourceLanguage, { ...(translations[sourceLanguage] ?? {}), title: e.target.value })} /></label>
        <div className="space-y-2">
          {list.map((it, i) => (<div key={i} className="flex gap-2"><input className="brand-input flex-1" value={it} onChange={(e) => updateItem(i, e.target.value)} /><button type="button" onClick={() => removeItem(i)} className="text-xs font-semibold text-red-700">Remove</button></div>))}
          <button type="button" onClick={addItem} className="btn-brand-secondary px-3 py-1.5">+ Add item</button>
        </div>
      </fieldset>
    </div>
  );
}

function AccreditationSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  // reuse IconCard style for blockContent
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });
  const cards = asArrayOfObjects(translations[sourceLanguage]?.blockContent);
  const updateAll = (updater: (cur: JsonObject) => JsonObject) => {
    const next = { ...translations } as Record<Language, JsonObject>;
    for (const lang of supportedLanguages) next[lang] = updater(translations[lang] ?? {});
    onUpdate({ sourceLanguage, translations: next });
  };

  const addCard = () => updateAll((current) => ({ ...current, blockContent: [...(Array.isArray(current.blockContent) ? current.blockContent : []), { cardTitle: "", cardDescription: "", icon: "" }] }));
  const updateCard = (lang: Language, idx: number, field: string, v: string) => { const f = translations[lang] ?? {}; const items = Array.isArray(f.blockContent) ? [...f.blockContent] : []; items[idx] = { ...(items[idx] ?? {}), [field]: v }; updateTranslation(lang, { ...f, blockContent: items }); };
  const removeCard = (idx: number) => updateAll((current) => ({ ...current, blockContent: (Array.isArray(current.blockContent) ? current.blockContent : []).filter((_: any, i: number) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const isPrimary = lang === sourceLanguage;
          const f = translations[lang] ?? {};
          const items = asArrayOfObjects(f.blockContent);
          const primaryCards = asArrayOfObjects(translations[sourceLanguage]?.blockContent);
          const maxCount = Math.max(primaryCards.length, items.length);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(f.title)} onChange={(e) => updateTranslation(lang, { ...f, title: e.target.value })} required={isPrimary} />
              </label>
              <div className="space-y-4">
                {Array.from({ length: maxCount }).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4">
                    <input className="brand-input" placeholder="Card title" value={asString(items[i]?.cardTitle)} onChange={(e) => updateCard(lang, i, "cardTitle", e.target.value)} />
                    <textarea className="brand-input" placeholder="Card description" rows={2} value={asString(items[i]?.cardDescription)} onChange={(e) => updateCard(lang, i, "cardDescription", e.target.value)} />
                    <AdminImagePicker
                      label="Icon (shared)"
                      value={asString(items[i]?.icon || primaryCards[i]?.icon)}
                      onChange={(next) => updateAll((c) => ({ ...c, blockContent: [...(Array.isArray(c.blockContent) ? c.blockContent : []).map((it: any, idx: number) => idx === i ? { ...(it ?? {}), icon: next } : it)] }))}
                      compact
                    />
                    {isPrimary && (
                      <button type="button" onClick={() => removeCard(i)} className="text-xs font-semibold text-red-700">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {lang === sourceLanguage && (
                  <button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1.5">
                    + Add card
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function MatchingGiftSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;
  const setSourceLanguage = (next: Language) => onUpdate({ sourceLanguage: next, translations });
  const updateTranslation = (language: Language, nextValue: JsonObject) => onUpdate({ sourceLanguage, translations: { ...translations, [language]: nextValue } });

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
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea className="brand-input" value={asString(fields.description)} onChange={(e) => updateTranslation(lang, { ...fields, description: e.target.value })} rows={3} />
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
