"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import { getLocalizedSectionEnvelopeDraft } from "@/lib/dynamic-page-localization";
import { uploadAdminImage } from "@/lib/admin-image-upload";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject { return !!value && typeof value === "object" && !Array.isArray(value); }
function asString(value: unknown) { return typeof value === "string" ? value : ""; }

function AdminImagePicker({ label, value, onChange, onUpload, compact = false }: { label: string; value: string; onChange: (next: string) => void; onUpload?: (result: { publicUrl: string; storageKey: string }) => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={compact ? "flex items-center justify-between gap-3" : "flex flex-wrap items-center justify-between gap-3"}>
        <span className="brand-label">{label}</span>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (!file) return; setError(""); setIsUploading(true); void uploadAdminImage(file).then((result) => { onChange(result.publicUrl); onUpload?.(result); }).catch((err: unknown) => { const message = err instanceof Error ? err.message : "Failed to upload image."; setError(message); }).finally(() => setIsUploading(false)); }} disabled={isUploading} />
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-60" disabled={isUploading}>{isUploading ? "Uploading…" : "Pick image"}</button>
          {value ? <button type="button" onClick={() => onChange("")} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700" disabled={isUploading}>Clear</button> : null}
        </div>
      </div>
      <input type="text" value={value} onChange={(e) => onChange(e.currentTarget.value)} className={compact ? "brand-input text-sm" : "brand-input"} placeholder="Paste an image URL or use Pick image" disabled={isUploading} />
      {value ? (<div className="flex items-center gap-3"><img src={value} alt="" className={compact ? "h-12 w-12 rounded object-cover" : "h-20 w-20 rounded object-cover"} /><div className="min-w-0"><p className="text-sm font-semibold text-gray-700">Current image</p><p className="text-xs text-gray-500 break-all">{value}</p></div></div>) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function asArrayOfObjects(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}

interface PageSection { id?: string; sectionKey: string; componentType: string; position: number; content: JsonObject; }
interface DynamicPage { id: string; slug: string; title: string; published: boolean; sections: PageSection[]; createdAt: string; updatedAt: string; }

function createDraftAdmissionsPage(): DynamicPage {
  const now = new Date().toISOString();
  return {
    id: "",
    slug: "admissions",
    title: "Admissions",
    published: false,
    sections: [
      {
        sectionKey: "hero",
        componentType: "BannerSection",
        position: 0,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Admissions", description: "Start your application to St. Austin's.", bgImg: "/bannerImg.jpg" },
            fr: { title: "Admissions", description: "Commencez votre demande à St. Austin.", bgImg: "/bannerImg.jpg" },
          },
        },
      },
      // {
      //   sectionKey: "requirements",
      //   componentType: "IconCard",
      //   position: 1,
      //   content: {
      //     sourceLanguage: "en",
      //     translations: {
      //       en: {
      //         title: "Admission Requirements",
      //         blockContent: [
      //           { cardTitle: "Undergraduate", cardDescription: "High school transcript and completed application.", icon: "/icons/undergrad.png" },
      //           { cardTitle: "Graduate", cardDescription: "Official transcripts and letters of recommendation.", icon: "/icons/graduate.png" },
      //         ],
      //       },
      //       fr: {
      //         title: "Exigences d'admission",
      //         blockContent: [
      //           { cardTitle: "Premier cycle", cardDescription: "Relevé de notes et formulaire de demande.", icon: "/icons/undergrad.png" },
      //           { cardTitle: "Deuxième cycle", cardDescription: "Relevés officiels et lettres de recommandation.", icon: "/icons/graduate.png" },
      //         ],
      //       },
      //     },
      //   },
      // },
      {
        sectionKey: "steps",
        componentType: "StepsSection",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "How to Apply",
              stepsContent: [
                { cardTitle: "Create an account", cardDescription: "Start your application by creating an account.", stepNum: "1" },
                { cardTitle: "Submit documents", cardDescription: "Upload transcripts and test scores.", stepNum: "2" },
                { cardTitle: "Receive decision", cardDescription: "Admissions will notify you by email.", stepNum: "3" },
              ],
            },
            fr: {
              title: "Comment postuler",
              stepsContent: [
                { cardTitle: "Créer un compte", cardDescription: "Commencez votre demande en créant un compte.", stepNum: "1" },
                { cardTitle: "Soumettre des documents", cardDescription: "Téléversez relevés et résultats.", stepNum: "2" },
                { cardTitle: "Recevoir la décision", cardDescription: "Les admissions vous informeront par courriel.", stepNum: "3" },
              ],
            },
          },
        },
      },
      {
        sectionKey: "deadlines",
        componentType: "DeadlinesSection",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Important Deadlines",
              deadlineItem: [
                { title: "Early Decision", headingOne: "Apply by", headingTwo: "Notification", dateOne: "Nov 1", dateTwo: "Dec 15" },
                { title: "Regular Decision", headingOne: "Apply by", headingTwo: "Notification", dateOne: "Jan 15", dateTwo: "Mar 1" },
              ],
            },
            fr: {
              title: "Dates importantes",
              deadlineItem: [
                { title: "Décision anticipée", headingOne: "Date limite", headingTwo: "Notification", dateOne: "1 nov.", dateTwo: "15 déc." },
                { title: "Décision régulière", headingOne: "Date limite", headingTwo: "Notification", dateOne: "15 janv.", dateTwo: "1 mars" },
              ],
            },
          },
        },
      },
      {
        sectionKey: "faqs",
        componentType: "FaqSection",
        position: 4,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Frequently Asked Questions",
              accordionsContent: [
                { title: "Do I need test scores?", description: "Test score requirements vary by program." },
                { title: "How do I submit transcripts?", description: "Upload scanned copies through the application portal." },
              ],
            },
            fr: {
              title: "Questions fréquentes",
              accordionsContent: [
                { title: "Ai-je besoin de résultats aux tests?", description: "Les exigences varient selon le programme." },
                { title: "Comment soumettre mes relevés?", description: "Téléversez des copies numérisées via le portail." },
              ],
            },
          },
        },
      },
      {
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 5,
        content: {
          sourceLanguage: "en",
          translations: {
            en: { title: "Ready to apply?", desc: "Start your application today.", buttons: ["Apply now"] },
            fr: { title: "Prêt à postuler?", desc: "Commencez votre demande aujourd'hui.", buttons: ["Postuler"] },
          },
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

const languageLabelFallback = (language: Language) => (language === "fr" ? "French" : "English");

function LanguageLegend({ language, isPrimary }: { language: Language; isPrimary: boolean }) {
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

export default function AdmissionsEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/admissions");
      if (res.ok) { const data = (await res.json()) as Partial<DynamicPage> & { sections?: unknown }; const hasSections = Array.isArray(data.sections) && (data.sections as unknown[]).length > 0; if (hasSections) { setPage(data as DynamicPage); return; } const draft = createDraftAdmissionsPage(); setPage({ ...draft, id: typeof data.id === "string" ? data.id : draft.id, slug: typeof data.slug === "string" ? data.slug : draft.slug, title: typeof data.title === "string" ? data.title : draft.title, published: typeof data.published === "boolean" ? data.published : draft.published, createdAt: typeof data.createdAt === "string" ? data.createdAt : draft.createdAt, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : draft.updatedAt }); return; }
      if (res.status === 404) { setPage(createDraftAdmissionsPage()); return; }
      const raw = await res.text(); const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; setError(apiErrorMessage(parsed, "Failed to load Admissions page.")); setPage(createDraftAdmissionsPage());
    } catch (err) { console.error(err); setError("Failed to load Admissions page."); setPage(createDraftAdmissionsPage()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchPage(); }, [fetchPage]);

  const handleSave = async () => {
    if (!page) return; setSaving(true); setError("");
    try {
      const sanitizedPage: DynamicPage = { ...page, sections: page.sections.map((section) => { const rawContent = section.content as unknown; if (!isJsonObject(rawContent) || !("translations" in rawContent)) return section; const translationsCandidate = (rawContent as Record<string, unknown>).translations; if (!isJsonObject(translationsCandidate)) return section; const translations = translationsCandidate as Record<string, unknown>; const cleanedTranslations: Record<string, unknown> = { ...translations }; for (const [language, value] of Object.entries(translations)) { if (!isJsonObject(value)) continue; const next = { ...value }; delete next["className"]; delete next["classNameCard"]; cleanedTranslations[language] = next; } return { ...section, content: { ...(rawContent as JsonObject), translations: cleanedTranslations } }; }), };
      const res = await fetch(`/api/admin/pages/${page.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sanitizedPage) }); if (res.ok) { const updated = await res.json(); setPage(updated); return; } const raw = await res.text(); const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}; setError(apiErrorMessage(parsed, "Failed to save Admissions page."));
    } catch (err) { console.error(err); setError(err instanceof Error && err.message ? err.message : "Failed to save Admissions page."); } finally { setSaving(false); }
  };

  function apiErrorMessage(parsed: Record<string, unknown>, fallback: string) { const message = typeof parsed.error === "string" ? parsed.error : fallback; const database = parsed.database && typeof parsed.database === "object" ? (parsed.database as Record<string, unknown>) : null; const host = database && typeof database.host === "string" ? database.host : ""; const dbName = database && typeof database.database === "string" ? database.database : ""; const nodeEnv = typeof parsed.nodeEnv === "string" ? parsed.nodeEnv : ""; if (!host && !dbName && !nodeEnv) return message; const dbLabel = host || dbName ? `${host || "?"}${dbName ? `/${dbName}` : ""}` : ""; const envLabel = nodeEnv ? `env:${nodeEnv}` : ""; const suffix = [dbLabel && `db:${dbLabel}`, envLabel].filter(Boolean).join(", "); return suffix ? `${message} (${suffix})` : message; }

  if (loading) return (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#2e5f9e]">Loading Admissions page…</p></section>);

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="brand-title text-2xl font-black">Admissions Page Management</h3><p className="brand-muted text-sm">Edit sections, images, and content.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={fetchPage} disabled={loading || saving} className="btn-brand-secondary px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button><button type="button" onClick={handleSave} disabled={saving || !page} className="btn-brand-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div></header>

      {error ? (<section className="brand-card border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">{error}</p></section>) : null}

      {!page ? (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#083672]">Page data is unavailable.</p><p className="brand-muted mt-1 text-sm">Press Refresh to try again.</p></section>) : (<section className="space-y-6">{page.sections.slice().sort((a, b) => a.position - b.position).map((section,index) => (<SectionCard key={section.id || section.sectionKey} section={section} index={index} onUpdate={(content) => setPage((prev) => { if (!prev) return prev; const nextSections = prev.sections.map((s) => (s.id && s.id === section.id) || (!s.id && s.sectionKey === section.sectionKey) ? { ...s, content } : s); return { ...prev, sections: nextSections }; })} />))}</section>)}
    </section>
  );
}

function SectionCard({ section,index, onUpdate }: { section: PageSection; index: number; onUpdate: (content: JsonObject) => void }) {
  const sectionConfig: Record<string, { label: string; description: string }> = {
    BannerSection: { label: "Hero Banner", description: "Intro banner with title, description, and background image." },
    IconCard: { label: "Admission Requirements", description: "List of admission requirements and steps." },
    StepsSection: { label: "Application Steps", description: "Ordered steps that describe how to apply." },
    RequirementsSection: { label: "Admission Requirements", description: "Admission requirements list with optional image." },
    DeadlinesSection: { label: "Important Deadlines", description: "Application intake deadlines and dates." },
    FaqSection: { label: "Frequently Asked Questions", description: "Accordion list of common questions." },
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
        <span className="brand-chip">SECTION {index + 1}</span>
        {/* <span className="brand-chip">SECTION {section.position + 1}</span> */}
      </div>

      {section.componentType === "BannerSection" && <BannerSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "IconCard" && <IconCardSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "StepsSection" && <StepsSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "RequirementsSection" && <RequirementsSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "DeadlinesSection" && <DeadlinesSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "FaqSection" && <FaqSectionForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "CtaSection" && <CtaSectionForm content={section.content} onUpdate={onUpdate} />}

      {!["BannerSection", "IconCard", "StepsSection", "RequirementsSection", "DeadlinesSection", "FaqSection", "CtaSection"].includes(section.componentType) && (
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

  return (
    <div className="space-y-4">
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

              <AdminImagePicker
                label="Background image"
                value={asString(fields.bgImg)}
                onChange={(next) => updateTranslation(entryLanguage, { ...fields, bgImg: next, bgImgStorageKey: undefined })}
                onUpload={(result) => updateTranslation(entryLanguage, { ...fields, bgImg: result.publicUrl, bgImgStorageKey: result.storageKey })}
                compact
              />

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

function StepsSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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

  const sourceSteps = asArrayOfObjects(translations[sourceLanguage]?.stepsContent);

  const addStep = () => updateAllTranslations((current) => ({ ...current, stepsContent: [...(Array.isArray(current.stepsContent) ? current.stepsContent : []), { cardTitle: "", cardDescription: "", stepNum: "" }] }));

  const removeStep = (index: number) => updateAllTranslations((current) => ({ ...current, stepsContent: (Array.isArray(current.stepsContent) ? current.stepsContent : []).filter((_, i: number) => i !== index) }));

  const updateStepField = (language: Language, index: number, field: "cardTitle" | "cardDescription" | "stepNum", value: string) => {
    const fields = translations[language] ?? {};
    const items = Array.isArray(fields.stepsContent) ? [...fields.stepsContent] : [];
    items[index] = { ...(items[index] ?? {}), [field]: value };
    updateTranslation(language, { ...fields, stepsContent: items });
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
          const fields = translations[lang] ?? {};
          const items = asArrayOfObjects(fields.stepsContent);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Steps</h3>
                {isPrimary && <button type="button" onClick={addStep} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Step</button>}
              </div>

              <div className="space-y-4">
                {(isPrimary ? sourceSteps : items).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4 space-y-2">
                    <input type="text" placeholder="Card Title" value={asString(items[i]?.cardTitle)} onChange={(e) => updateStepField(lang, i, "cardTitle", e.target.value)} className="brand-input text-sm" />
                    <textarea placeholder="Description" value={asString(items[i]?.cardDescription)} onChange={(e) => updateStepField(lang, i, "cardDescription", e.target.value)} className="brand-input text-sm" rows={2} />
                    <input type="text" placeholder="Step number" value={asString(items[i]?.stepNum)} onChange={(e) => updateStepField(lang, i, "stepNum", e.target.value)} className="brand-input text-sm" />
                    {isPrimary && <button type="button" onClick={() => removeStep(i)} className="text-xs font-semibold text-red-700">Remove Step</button>}
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

function RequirementsSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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
  const listForPrimary = Array.isArray(translations[sourceLanguage]?.listContent) ? translations[sourceLanguage].listContent as string[] : [];

  const addListItem = () => updateAllTranslations((current) => ({ ...current, listContent: [...(Array.isArray(current.listContent) ? current.listContent : []), ""] }));
  const removeListItem = (index: number) => updateAllTranslations((current) => ({ ...current, listContent: (Array.isArray(current.listContent) ? current.listContent : []).filter((_, i: number) => i !== index) }));
  const updateListItem = (language: Language, index: number, value: string) => {
    const fields = translations[language] ?? {};
    const list = Array.isArray(fields.listContent) ? [...fields.listContent] : [];
    list[index] = value;
    updateTranslation(language, { ...fields, listContent: list });
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
          const fields = translations[lang] ?? {};
          const list = Array.isArray(fields.listContent) ? fields.listContent as string[] : [];
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <AdminImagePicker
                label="Image"
                value={asString(fields.image)}
                onChange={(next) => updateTranslation(lang, { ...fields, image: next, imageStorageKey: undefined })}
                onUpload={(result) => updateTranslation(lang, { ...fields, image: result.publicUrl, imageStorageKey: result.storageKey })}
                compact
              />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea className="brand-input" value={asString(fields.requirementsDesc)} onChange={(e) => updateTranslation(lang, { ...fields, requirementsDesc: e.target.value })} rows={3} />
              </label>

              <div className="flex justify-between items-center mt-2">
                <h3 className="font-semibold">List</h3>
                {isPrimary && <button type="button" onClick={addListItem} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Item</button>}
              </div>
              <div className="space-y-2">
                {(isPrimary ? listForPrimary : list).map((_, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input type="text" value={list[i] ?? ""} onChange={(e) => updateListItem(lang, i, e.target.value)} className="brand-input flex-1 text-sm" />
                    {isPrimary && <button type="button" onClick={() => removeListItem(i)} className="text-xs font-semibold text-red-700">Remove</button>}
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

function DeadlinesSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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

  const sourceItems = asArrayOfObjects(translations[sourceLanguage]?.deadlineItem);

  const addItem = () => updateAllTranslations((current) => ({ ...current, deadlineItem: [...(Array.isArray(current.deadlineItem) ? current.deadlineItem : []), { title: "", headingOne: "", headingTwo: "", dateOne: "", dateTwo: "" }] }));
  const removeItem = (index: number) => updateAllTranslations((current) => ({ ...current, deadlineItem: (Array.isArray(current.deadlineItem) ? current.deadlineItem : []).filter((_, i: number) => i !== index) }));
  const updateItemField = (language: Language, index: number, field: string, value: string) => {
    const fields = translations[language] ?? {};
    const items = Array.isArray(fields.deadlineItem) ? [...fields.deadlineItem] : [];
    items[index] = { ...(items[index] ?? {}), [field]: value };
    updateTranslation(language, { ...fields, deadlineItem: items });
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
          const fields = translations[lang] ?? {};
          const items = asArrayOfObjects(fields.deadlineItem);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Deadline items</h3>
                {isPrimary && <button type="button" onClick={addItem} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Item</button>}
              </div>

              <div className="space-y-4">
                {(isPrimary ? sourceItems : items).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4 space-y-2">
                    <input type="text" placeholder="Title" value={asString(items[i]?.title)} onChange={(e) => updateItemField(lang, i, "title", e.target.value)} className="brand-input text-sm" />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input type="text" placeholder="Heading One" value={asString(items[i]?.headingOne)} onChange={(e) => updateItemField(lang, i, "headingOne", e.target.value)} className="brand-input text-sm" />
                      <input type="text" placeholder="Heading Two" value={asString(items[i]?.headingTwo)} onChange={(e) => updateItemField(lang, i, "headingTwo", e.target.value)} className="brand-input text-sm" />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input type="text" placeholder="Date One" value={asString(items[i]?.dateOne)} onChange={(e) => updateItemField(lang, i, "dateOne", e.target.value)} className="brand-input text-sm" />
                      <input type="text" placeholder="Date Two" value={asString(items[i]?.dateTwo)} onChange={(e) => updateItemField(lang, i, "dateTwo", e.target.value)} className="brand-input text-sm" />
                    </div>
                    {isPrimary && <button type="button" onClick={() => removeItem(i)} className="text-xs font-semibold text-red-700">Remove</button>}
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

function FaqSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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

  const sourceItems = asArrayOfObjects(translations[sourceLanguage]?.accordionsContent);

  const addItem = () => updateAllTranslations((current) => ({ ...current, accordionsContent: [...(Array.isArray(current.accordionsContent) ? current.accordionsContent : []), { title: "", description: "" }] }));
  const removeItem = (index: number) => updateAllTranslations((current) => ({ ...current, accordionsContent: (Array.isArray(current.accordionsContent) ? current.accordionsContent : []).filter((_, i: number) => i !== index) }));
  const updateItemField = (language: Language, index: number, field: "title" | "description", value: string) => {
    const fields = translations[language] ?? {};
    const items = Array.isArray(fields.accordionsContent) ? [...fields.accordionsContent] : [];
    items[index] = { ...(items[index] ?? {}), [field]: value };
    updateTranslation(language, { ...fields, accordionsContent: items });
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
          const fields = translations[lang] ?? {};
          const items = asArrayOfObjects(fields.accordionsContent);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input className="brand-input" value={asString(fields.title)} onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })} required={isPrimary} />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Accordions</h3>
                {isPrimary && <button type="button" onClick={addItem} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Item</button>}
              </div>

              <div className="space-y-4">
                {(isPrimary ? sourceItems : items).map((_, i) => (
                  <div key={i} className="brand-panel rounded-lg p-4 space-y-2">
                    <input type="text" placeholder="Question" value={asString(items[i]?.title)} onChange={(e) => updateItemField(lang, i, "title", e.target.value)} className="brand-input text-sm" />
                    <textarea placeholder="Answer" value={asString(items[i]?.description)} onChange={(e) => updateItemField(lang, i, "description", e.target.value)} className="brand-input text-sm" rows={3} />
                    {isPrimary && <button type="button" onClick={() => removeItem(i)} className="text-xs font-semibold text-red-700">Remove</button>}
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

  const updateCardField = (language: Language, index: number, field: "cardTitle" | "cardDescription" | "icon", value: string) => {
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
                      label="Icon"
                      value={asString(cards[i]?.icon)}
                      onChange={(next) => updateCardField(lang, i, "icon", next)}
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
