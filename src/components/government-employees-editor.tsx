"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import { getLocalizedSectionEnvelopeDraft } from "@/lib/dynamic-page-localization";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function asArrayOfObjects(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}

async function uploadAdminImage(file: File): Promise<{ publicUrl: string; storageKey: string }> {
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

  const { t } = useLanguage();

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
              uploadAdminImage(file)
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
            {isUploading ? "Uploading…" : t("action.refresh") || "Pick image"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
              disabled={isUploading}
            >
              {t("action.clear") || "Clear"}
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
              <p className="text-sm font-semibold text-gray-700">{t("adminProfile.lastUpdated") || "Current image"}</p>
              <p className="text-xs text-gray-500 break-all">{value}</p>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
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

/* ---------------- TYPES ---------------- */

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
  createdAt?: string;
  updatedAt?: string;
}

function createDraftGovernmentEmployeesPage(): DynamicPage {
  return {
    id: "",
    slug: "government-employees",
    title: "Government Employees Page",
    published: false,
    sections: [
      {
        sectionKey: "banner",
        componentType: "BannerSection",
        position: 0,
        content: {
          sourceLanguage: "en" as Language,
          translations: {
            en: {
              title: "Special Programs for Government Employees",
              description: "Exclusive Benefits & Discounts",
              bgImg: "/bannerImg.jpg",
            },
            fr: {
              title: "Programmes spéciaux pour les employés du gouvernement",
              description: "Avantages et réductions exclusifs",
              bgImg: "/bannerImg.jpg",
            },
          },
        },
      },
      {
        sectionKey: "discountCard",
        componentType: "GovernmentEmployeeDiscountCard",
        position: 1,
        content: {
          sourceLanguage: "en" as Language,
          translations: {
            en: {
              discountPercent: 25,
              contactEmail: "govtservices@staustin.edu",
            },
            fr: {
              discountPercent: 25,
              contactEmail: "govtservices@staustin.edu",
            },
          },
        },
      },
      {
        sectionKey: "howItWorks",
        componentType: "HowItWorksSection",
        position: 2,
        content: {
          sourceLanguage: "en" as Language,
          translations: {
            en: {
              title: "How the Discount Works",
              steps: [
                "Sign in, select your category, and submit your government employee ID.",
                "Receive the application fee only after admin approval.",
                "Email your ID details to govtservices@staustin.edu for review before discount activation.",
              ],
            },
            fr: {
              title: "Comment fonctionne la réduction",
              steps: [
                "Connectez-vous, sélectionnez votre catégorie et soumettez votre ID d'employé du gouvernement.",
                "Recevez les frais de candidature uniquement après approbation admin.",
                "Envoyez vos détails d'ID à govtservices@staustin.edu pour examen avant activation de la réduction.",
              ],
            },
          },
        },
      },
      {
        sectionKey: "supportGroups",
        componentType: "SupportGroupsSection",
        position: 3,
        content: {
          sourceLanguage: "en" as Language,
          translations: {
            en: {
              title: "Support by Government Employee Group",
              description: "We have grouped public-sector learners so each team gets relevant guidance, benefits, and academic pathways.",
              groups: [
                {
                  title: "Civil Service Employees",
                  summary: "For ministry, council, and agency staff looking to strengthen management, policy, and digital skills.",
                  support: [
                    "Public administration pathways",
                    "Weekend and evening options",
                    "Employer-sponsored study support",
                  ],
                },
                {
                  title: "Veterans and Active-Duty Personnel",
                  summary: "For service members and veterans transitioning into civilian careers or advancing their qualifications.",
                  support: [
                    "Transition-focused advising",
                    "Recognition of prior service experience",
                    "Career planning and placement support",
                  ],
                },
                {
                  title: "Public Safety Personnel",
                  summary: "For police, emergency, and security professionals balancing duty schedules with academic goals.",
                  support: [
                    "Shift-friendly scheduling",
                    "Leadership and operations upskilling",
                    "Progress tracking with advisor support",
                  ],
                },
                {
                  title: "Public Health and Education Workers",
                  summary: "For government-employed teachers, health workers, and administrators seeking advancement.",
                  support: [
                    "Program tracks for service delivery roles",
                    "Practical, career-aligned curriculum",
                    "Support for long-term professional growth",
                  ],
                },
              ],
            },
            fr: {
              title: "Support par groupe d'employés du gouvernement",
              description: "Nous avons regroupé les apprenants du secteur public pour que chaque équipe reçoive des conseils, avantages et parcours académiques pertinents.",
              groups: [
                {
                  title: "Employés de la fonction publique",
                  summary: "Pour le personnel des ministères, conseils et agences cherchant à renforcer leurs compétences en gestion, politique et numérique.",
                  support: [
                    "Parcours d'administration publique",
                    "Options week-end et soir",
                    "Soutien à l'étude sponsorisé par l'employeur",
                  ],
                },
                // intentionally trimmed french translations for brevity
              ],
            },
          },
        },
      },
      {
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 4,
        content: {
          sourceLanguage: "en" as Language,
          translations: {
            en: {
              title: "Ready to Begin?",
              buttons: [
                { text: "Start Application", href: "/apply" },
                { text: "View Programs", href: "/program" },
              ],
            },
            fr: {
              title: "Prêt à commencer ?",
              buttons: [
                { text: "Commencer la candidature", href: "/apply" },
                { text: "Voir les programmes", href: "/program" },
              ],
            },
          },
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function apiErrorMessage(parsed: Record<string, unknown>, fallback: string): string {
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

export default function GovernmentEmployeesEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pages/government-employees");
      if (res.ok) {
        const data = (await res.json()) as DynamicPage;
        const hasSections = Array.isArray(data?.sections) && data.sections.length > 0;
        if (!hasSections) {
          const draft = createDraftGovernmentEmployeesPage();
          setPage({
            ...data,
            sections: draft.sections,
          });
          return;
        }
        setPage(data);
        return;
      }
      if (res.status === 404) {
        setPage(createDraftGovernmentEmployeesPage());
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to load Government Employees page."));
      setPage(createDraftGovernmentEmployeesPage());
    } catch (e) {
      console.error("Error fetching page:", e);
      setError("Failed to load Government Employees page.");
      setPage(createDraftGovernmentEmployeesPage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

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

      const res = await fetch(`/api/admin/pages/${page.slug}`, {
        method: "PUT",
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
      setError(apiErrorMessage(parsed, "Failed to save Government Employees page."));
    } catch (e) {
      console.error("Error saving page:", e);
      setError(e instanceof Error ? e.message : "Failed to save Government Employees page.");
    } finally {
      setSaving(false);
    }
  };

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
        <p className="text-sm font-semibold text-[#2e5f9e]">{t("loading.default") || "Loading Government Employees page…"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">Government Employees Page Management</h3>
          <p className="brand-muted text-sm">Edit sections, images, and bilingual content.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchPage}
            disabled={loading || saving}
            className="btn-brand-secondary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {t("action.refresh") || "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !page}
            className="btn-brand-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("status.saving") || "Saving…" : t("action.save") || "Save changes"}
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
          <p className="text-sm font-semibold text-[#083672]">{t("loading.default") || "Page data unavailable."}</p>
          <p className="brand-muted mt-1 text-sm">{t("action.refresh") || "Press Refresh to try again."}</p>
        </section>
      ) : (
        <>
          <section className="brand-card p-6">
            <h4 className="brand-title text-xl font-black">{t("label.title") || "Page Settings"}</h4>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.title") || "Page title"}</span>
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
    BannerSection: {
      label: "Hero Banner",
      description: "Intro banner with title, description, and background image.",
    },
    GovernmentEmployeeDiscountCard: {
      label: "Discount Card",
      description: "Government employee discount percentage and contact information.",
    },
    HowItWorksSection: {
      label: "How It Works",
      description: "Step-by-step discount application process.",
    },
    SupportGroupsSection: {
      label: "Support Groups",
      description: "Government employee categories with tailored support.",
    },
    CtaSection: {
      label: "Call to Action",
      description: "Final section with title and action buttons.",
    },
  };

  const config = sectionConfig[section.componentType] || {
    label: section.sectionKey.replace(/([A-Z])/g, " $1").trim(),
    description: "Edit this section.",
  };

  return (
    <section className="brand-card p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="brand-title text-2xl font-black">{config.label}</h3>
          <p className="brand-muted text-sm">{config.description}</p>
        </div>
        <span className="brand-chip">SECTION {section.position + 1}</span>
      </div>

      {section.componentType === "BannerSection" && (
        <BannerSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "GovernmentEmployeeDiscountCard" && (
        <DiscountCardSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "HowItWorksSection" && (
        <HowItWorksSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "SupportGroupsSection" && (
        <SupportGroupsSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "CtaSection" && (
        <CtaSectionForm content={section.content} onUpdate={onUpdate} />
      )}

      {![
        "BannerSection",
        "GovernmentEmployeeDiscountCard",
        "HowItWorksSection",
        "SupportGroupsSection",
        "CtaSection",
      ].includes(section.componentType) && (
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

function BannerSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const { t } = useLanguage();
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
    const nextTranslations: Record<Language, JsonObject> = {} as Record<Language, JsonObject>;
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
        onChange={(next) =>
          updateAllTranslations((current) => ({
            ...current,
            bgImg: next,
            bgImgStorageKey: undefined,
          }))
        }
        onUpload={(result) =>
          updateAllTranslations((current) => ({
            ...current,
            bgImg: result.publicUrl,
            bgImgStorageKey: result.storageKey,
          }))
        }
      />

      <div className="grid gap-3">
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.currentTarget.value as Language)}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageLabelFallback(lang)}
              </option>
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
                  <input
                    className="brand-input"
                    value={asString(fields.title)}
                    onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })}
                    required={isPrimary}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Description</span>
                  <textarea
                    className="brand-input"
                    value={asString(fields.description)}
                    onChange={(e) => updateTranslation(lang, { ...fields, description: e.target.value })}
                    rows={4}
                  />
                </label>
              </fieldset>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiscountCardSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select
          className="brand-input"
          value={sourceLanguage}
          onChange={(e) => setSourceLanguage(e.currentTarget.value as Language)}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {languageLabelFallback(lang)}
            </option>
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
                <span className="brand-label">Discount Percent</span>
                <input
                  type="number"
                  className="brand-input"
                  value={asNumber(fields.discountPercent)}
                  onChange={(e) => updateTranslation(lang, { ...fields, discountPercent: Number(e.target.value) })}
                  min={0}
                  max={100}
                  required={isPrimary}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Contact Email</span>
                <input
                  type="email"
                  className="brand-input"
                  value={asString(fields.contactEmail)}
                  onChange={(e) => updateTranslation(lang, { ...fields, contactEmail: e.target.value })}
                  required={isPrimary}
                />
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function HowItWorksSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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
    const nextTranslations: Record<Language, JsonObject> = {} as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };
  const sourceSteps = Array.isArray(translations[sourceLanguage]?.steps) ? (translations[sourceLanguage].steps as string[]) : [];

  const addStep = () => {
    updateAllTranslations((current) => ({
      ...current,
      steps: [...(Array.isArray(current.steps) ? current.steps : []), ""],
    }));
  };

  const removeStep = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      steps: (Array.isArray(current.steps) ? current.steps : []).filter((_: any, i: number) => i !== index),
    }));
  };

  const updateStep = (language: Language, index: number, value: string) => {
    const fields = translations[language] ?? {};
    const steps = Array.isArray(fields.steps) ? [...(fields.steps as string[])] : [];
    steps[index] = value;
    updateTranslation(language, { ...fields, steps });
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
          const steps: string[] = Array.isArray(fields.steps) ? (fields.steps as string[]) : [];
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={isPrimary} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })}
                  required={isPrimary}
                />
              </label>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Steps</span>
                {isPrimary && <button type="button" onClick={addStep} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Step</button>}
              </div>
              <div className="space-y-2">
                {(isPrimary ? sourceSteps : steps).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={steps[i] ?? ""} onChange={(e) => updateStep(lang, i, e.target.value)} className="brand-input flex-1 text-sm" placeholder={`Step ${i + 1}...`} />
                    {isPrimary && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
                      >
                        Remove
                      </button>
                    )}
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

function SupportGroupsSectionForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
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

  const sourceGroups = asArrayOfObjects(translations[sourceLanguage]?.groups);

  const addGroup = () => {
    updateAllTranslations((current) => ({
      ...current,
      groups: [...(Array.isArray(current.groups) ? current.groups : []), { title: "", summary: "", support: [] }],
    }));
  };

  const removeGroup = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      groups: (Array.isArray(current.groups) ? current.groups : []).filter((_: any, i: number) => i !== index),
    }));
  };

  const addSupport = (groupIndex: number) => {
    updateAllTranslations((current) => {
      const groups = Array.isArray(current.groups) ? [...current.groups] : [];
      const group = { ...groups[groupIndex] };
      group.support = [...(Array.isArray(group.support) ? group.support : []), ""];
      groups[groupIndex] = group;
      return { ...current, groups };
    });
  };

  const removeSupport = (groupIndex: number, supportIndex: number) => {
    updateAllTranslations((current) => {
      const groups = Array.isArray(current.groups) ? [...current.groups] : [];
      const group = { ...groups[groupIndex] };
      group.support = (Array.isArray(group.support) ? group.support : []).filter((_: any, i: number) => i !== supportIndex);
      groups[groupIndex] = group;
      return { ...current, groups };
    });
  };

  const updateGroupField = (
    language: Language,
    groupIndex: number,
    field: "title" | "summary",
    value: string
  ) => {
    const fields = translations[language] ?? {};
    const groups = Array.isArray(fields.groups) ? [...fields.groups] : [];
    const group = { ...groups[groupIndex] };
    group[field] = value;
    groups[groupIndex] = group;
    updateTranslation(language, { ...fields, groups });
  };

  const updateSupportItem = (language: Language, groupIndex: number, supportIndex: number, value: string) => {
    const fields = translations[language] ?? {};
    const groups = Array.isArray(fields.groups) ? [...fields.groups] : [];
    const group = { ...groups[groupIndex] };
    const support = Array.isArray(group.support) ? [...group.support] : [];
    support[supportIndex] = value;
    group.support = support;
    groups[groupIndex] = group;
    updateTranslation(language, { ...fields, groups });
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" disabled>
          <option>{sourceLanguage.toUpperCase()}</option>
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const fields = translations[lang] ?? {};
          const groups = asArrayOfObjects(fields.groups);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={lang === sourceLanguage} />
              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea
                  className="brand-input"
                  value={asString(fields.description)}
                  onChange={(e) => updateTranslation(lang, { ...fields, description: e.target.value })}
                  rows={3}
                />
              </label>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Support Groups</h3>
                {lang === sourceLanguage ? (
                  <button type="button" onClick={addGroup} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Group</button>
                ) : null}
              </div>
              <div className="space-y-4">
                {(lang === sourceLanguage ? sourceGroups : groups).map((group: JsonObject, gIndex: number) => (
                  <div key={gIndex} className="brand-panel rounded-lg p-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={asString(group.title)}
                        onChange={(e) => updateGroupField(lang, gIndex, "title", e.target.value)}
                        className="brand-input"
                        placeholder="Group Title"
                      />
                      <textarea
                        value={asString(group.summary)}
                        onChange={(e) => updateGroupField(lang, gIndex, "summary", e.target.value)}
                        className="brand-input"
                        rows={2}
                        placeholder="Group Summary"
                      />
                      <div>
                        <h4 className="font-semibold mb-2">Support Items</h4>
                        <div className="space-y-2">
                          {Array.isArray(group.support) ? (
                            group.support.map((supportItem: string, sIndex: number) => (
                              <div key={sIndex} className="flex gap-2">
                                <input
                                  type="text"
                                  value={supportItem}
                                  onChange={(e) => updateSupportItem(lang, gIndex, sIndex, e.target.value)}
                                  className="brand-input flex-1 text-sm"
                                  placeholder={`Support item ${sIndex + 1}`}
                                />
                                {lang === sourceLanguage ? (
                                  <button
                                    type="button"
                                    onClick={() => removeSupport(gIndex, sIndex)}
                                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            ))
                          ) : null}
                          {lang === sourceLanguage ? (
                            <button type="button" onClick={() => addSupport(gIndex)} className="btn-brand-secondary px-3 py-1 text-sm">+ Add Support Item</button>
                          ) : null}
                        </div>
                      </div>
                      {lang === sourceLanguage ? (
                        <button type="button" onClick={() => removeGroup(gIndex)} className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900">Remove Group</button>
                      ) : null}
                    </div>
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

  const sourceButtons = asArrayOfObjects(translations[sourceLanguage]?.buttons);

  const addButton = () => {
    updateAllTranslations((current) => ({
      ...current,
      buttons: [...(Array.isArray(current.buttons) ? current.buttons : []), { text: "", href: "" }],
    }));
  };

  const removeButton = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      buttons: (Array.isArray(current.buttons) ? current.buttons : []).filter((_: any, i: number) => i !== index),
    }));
  };

  const updateButtonField = (language: Language, index: number, field: "text" | "href", value: string) => {
    const fields = translations[language] ?? {};
    const buttons = Array.isArray(fields.buttons) ? [...fields.buttons] : [];
    const button = { ...buttons[index] };
    button[field] = value;
    buttons[index] = button;
    updateTranslation(language, { ...fields, buttons });
  };

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">Primary Language</span>
        <select className="brand-input" disabled>
          <option>{sourceLanguage.toUpperCase()}</option>
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((lang) => {
          const fields = translations[lang] ?? {};
          const buttons = asArrayOfObjects(fields.buttons);
          return (
            <fieldset key={lang} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={lang} isPrimary={lang === sourceLanguage} />
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(lang, { ...fields, title: e.target.value })}
                />
              </label>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Buttons</span>
                {lang === sourceLanguage ? (
                  <button type="button" onClick={addButton} className="btn-brand-secondary px-2 py-1 text-sm font-semibold">+ Add Button</button>
                ) : null}
              </div>
              <div className="space-y-2">
                {(lang === sourceLanguage ? sourceButtons : buttons).map((button: JsonObject, i: number) => (
                  <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      type="text"
                      value={asString(button.text)}
                      onChange={(e) => updateButtonField(lang, i, "text", e.target.value)}
                      className="brand-input"
                      placeholder="Button Text"
                    />
                    <input
                      type="text"
                      value={asString(button.href)}
                      onChange={(e) => updateButtonField(lang, i, "href", e.target.value)}
                      className="brand-input"
                      placeholder="/apply"
                    />
                    {lang === sourceLanguage ? (
                      <button type="button" onClick={() => removeButton(i)} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 md:col-span-2">Remove</button>
                    ) : null}
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
