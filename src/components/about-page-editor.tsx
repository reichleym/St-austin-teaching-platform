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
  if (!publicUrl) throw new Error("Upload failed: missing publicUrl.");
  return publicUrl;
}

function AdminImagePicker({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
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
                .then((publicUrl) => onChange(publicUrl))
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

function createDraftAboutPage(): DynamicPage {
  return {
    id: "",
    slug: "about",
    title: "About St. Austin's International University",
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
              title: "About St. Austin's International University",
              description: "Our Mission",
              bgImg: "/bannerImg.jpg",
            },
            fr: {
              title: "About St. Austin's International University",
              description: "Our Mission",
              bgImg: "/bannerImg.jpg",
            },
          },
        },
      },
      {
        sectionKey: "history",
        componentType: "HistorySection",
        position: 1,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Our History",
              description:
                "Founded in 1995, St. Austin's International University has been dedicated to providing career-focused education for over 25 years. Starting as a small institution with just 50 students, we have grown to serve thousands of students annually while maintaining our commitment to personalized education and career success.",
              image: "/cta-img.png",
            },
            fr: {
              title: "Our History",
              description:
                "Founded in 1995, St. Austin's International University has been dedicated to providing career-focused education for over 25 years. Starting as a small institution with just 50 students, we have grown to serve thousands of students annually while maintaining our commitment to personalized education and career success.",
              image: "/cta-img.png",
            },
          },
        },
      },
      {
        sectionKey: "mission-vision",
        componentType: "MissionVisionSection",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              mission: {
                title: "Our Mission",
                desc: "To empower individuals through accessible, high-quality education that bridges academic excellence with practical career readiness.",
              },
              vision: {
                title: "Our Vision",
                desc: "To be a global leader in career-focused higher education, recognized for innovation, inclusivity, and student success.",
              },
            },
            fr: {
              mission: {
                title: "Our Mission",
                desc: "To empower individuals through accessible, high-quality education that bridges academic excellence with practical career readiness.",
              },
              vision: {
                title: "Our Vision",
                desc: "To be a global leader in career-focused higher education, recognized for innovation, inclusivity, and student success.",
              },
            },
          },
        },
      },
      {
        sectionKey: "accreditation",
        componentType: "IconCard",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Accreditation",
              blockContent: [
                {
                  cardTitle: "National Board of Higher Education",
                  cardDescription: "National Board of Higher Education",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Business Programs",
                  cardDescription: "International accreditation for business programs",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Nursing Programs",
                  cardDescription: "Commission on Collegiate Nursing Education",
                  icon: "/nursing-icon.png",
                },
              ],
            },
            fr: {
              title: "Accreditation",
              blockContent: [
                {
                  cardTitle: "National Board of Higher Education",
                  cardDescription: "National Board of Higher Education",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Business Programs",
                  cardDescription: "International accreditation for business programs",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Nursing Programs",
                  cardDescription: "Commission on Collegiate Nursing Education",
                  icon: "/nursing-icon.png",
                },
              ],
            },
          },
        },
      },
      {
        sectionKey: "leadership",
        componentType: "TeamGridSection",
        position: 4,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Leadership Team",
              teamMembers: [
                {
                  name: "Dr. Margaret Chen",
                  role: "President",
                  image: "/team1.jpg",
                  description:
                    "Dr. Chen brings over 25 years of academic leadership experience and a vision for accessible, career-oriented education.",
                },
                {
                  name: "Dr. Robert Williams",
                  role: "Provost & VP of Academic Affairs",
                  image: "/team1.jpg",
                  description:
                    "A distinguished scholar in educational innovation, Dr. Williams oversees curriculum development and academic quality.",
                },
                {
                  name: "Dr. Amara Osei",
                  role: "Dean of Student Affairs",
                  image: "/team1.jpg",
                  description:
                    "Dr. Osei is passionate about student success and leads initiatives in mentorship, career services, and community building.",
                },
                {
                  name: "Prof. David Nakamura",
                  role: "Dean of Technology",
                  image: "/team1.jpg",
                  description:
                    "Prof. Nakamura drives the university's technology programs and digital learning infrastructure with industry expertise.",
                },
              ],
            },
            fr: {
              title: "Leadership Team",
              teamMembers: [
                {
                  name: "Dr. Margaret Chen",
                  role: "President",
                  image: "/team1.jpg",
                  description:
                    "Dr. Chen brings over 25 years of academic leadership experience and a vision for accessible, career-oriented education.",
                },
                {
                  name: "Dr. Robert Williams",
                  role: "Provost & VP of Academic Affairs",
                  image: "/team1.jpg",
                  description:
                    "A distinguished scholar in educational innovation, Dr. Williams oversees curriculum development and academic quality.",
                },
                {
                  name: "Dr. Amara Osei",
                  role: "Dean of Student Affairs",
                  image: "/team1.jpg",
                  description:
                    "Dr. Osei is passionate about student success and leads initiatives in mentorship, career services, and community building.",
                },
                {
                  name: "Prof. David Nakamura",
                  role: "Dean of Technology",
                  image: "/team1.jpg",
                  description:
                    "Prof. Nakamura drives the university's technology programs and digital learning infrastructure with industry expertise.",
                },
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
            en: {
              title: "Ready to Start Your Journey?",
              desc: "Take the next step toward your future. Our admissions team is here to guide you through every step of the process.",
              buttons: ["Apply Now", "Request Info", "Talk to an Advisor"],
            },
            fr: {
              title: "Ready to Start Your Journey?",
              desc: "Take the next step toward your future. Our admissions team is here to guide you through every step of the process.",
              buttons: ["Apply Now", "Request Info", "Talk to an Advisor"],
            },
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

export default function AboutPageEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAboutPage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/about");
      if (res.ok) {
        const data = await res.json();
        setPage(data);
        return;
      }

      if (res.status === 404) {
        setPage(createDraftAboutPage());
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to load About page."));
      setPage(createDraftAboutPage());
    } catch (error) {
      console.error("Error fetching about page:", error);
      setError("Failed to load About page.");
      setPage(createDraftAboutPage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAboutPage();
  }, [fetchAboutPage]);

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

      const method = page.id ? "PUT" : "POST";
      const endpoint = page.id ? `/api/admin/pages/${page.slug}` : "/api/admin/pages";

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
      setError(apiErrorMessage(parsed, "Failed to save About page."));
    } catch (error) {
      console.error("Error saving page:", error);
      setError(error instanceof Error && error.message.trim() ? error.message : "Failed to save About page.");
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
        <p className="text-sm font-semibold text-[#2e5f9e]">Loading About page…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">About Page Management</h3>
          <p className="brand-muted text-sm">Edit sections, images, and content.</p>
          {/* {!page?.id ? (
            <p className="mt-1 text-xs font-semibold text-[#845d00]">
              This page hasn&apos;t been created yet — saving will create it.
            </p>
          ) : null} */}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchAboutPage}
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

      {!page ? (
        <section className="brand-card p-6">
          <p className="text-sm font-semibold text-[#083672]">About page data is unavailable.</p>
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
              {/* <label className="flex items-center gap-3 text-sm font-semibold text-[#0b3e81]">
                <input
                  type="checkbox"
                  checked={page.published}
                  onChange={(e) => setPage({ ...page, published: e.target.checked })}
                />
                <span>{page.published ? "✓ Published" : "Draft (Not visible to public)"}</span>
              </label> */}
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
    HistorySection: {
      label: "History",
      description: "Two-column layout with title, description, and image.",
    },
    MissionVisionSection: {
      label: "Mission & Vision",
      description: "Mission and vision blocks with localized content.",
    },
    IconCard: {
      label: "Accreditation",
      description: "Grid of accreditation cards with icons and descriptions.",
    },
    TeamGridSection: {
      label: "Leadership Team",
      description: "Team member cards with name, role, image, and description.",
    },
    CtaSection: {
      label: "Call to Action",
      description: "Bottom section with title, description, and buttons.",
    },
    CoreValuesSection: {
      label: "Core Values",
      description: "List of values with title and description.",
    },
    StatisticsSection: {
      label: "Statistics",
      description: "Numbered metrics with labels and optional descriptions.",
    },
  };

  const config =
    sectionConfig[section.componentType] || { label: section.sectionKey, description: "Edit this section." };

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
      {section.componentType === "HistorySection" && (
        <HistorySectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "MissionVisionSection" && (
        <MissionVisionSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "IconCard" && (
        <IconCardSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "TeamGridSection" && (
        <TeamGridSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "CtaSection" && (
        <CtaSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "CoreValuesSection" && (
        <CoreValuesSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "StatisticsSection" && (
        <StatisticsSectionForm content={section.content} onUpdate={onUpdate} />
      )}

      {![
        "BannerSection",
        "HistorySection",
        "MissionVisionSection",
        "IconCard",
        "TeamGridSection",
        "CtaSection",
        "CoreValuesSection",
        "StatisticsSection",
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

// Section-specific form components
function BannerSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
        onChange={(next) => updateAllTranslations((current) => ({ ...current, bgImg: next }))}
      />

      <div className="grid gap-3">
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          {supportedLanguages.map((entryLanguage) => {
            const isPrimary = entryLanguage === sourceLanguage;
            const fields = translations[entryLanguage] ?? {};
            return (
              <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
                <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input
                    className="brand-input"
                    value={asString(fields.title)}
                    onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                    required={isPrimary}
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
    </div>
  );
}

function HistorySectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sharedImage = asString(translations[sourceLanguage]?.image);

  return (
    <div className="space-y-4">
      <AdminImagePicker
        label="Image (shared)"
        value={sharedImage}
        onChange={(next) => updateAllTranslations((current) => ({ ...current, image: next }))}
      />

      <div className="grid gap-3">
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          {supportedLanguages.map((entryLanguage) => {
            const isPrimary = entryLanguage === sourceLanguage;
            const fields = translations[entryLanguage] ?? {};
            return (
              <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
                <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input
                    className="brand-input"
                    value={asString(fields.title)}
                    onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                    required={isPrimary}
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
    </div>
  );
}

function MissionVisionSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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

  return (
    <div className="space-y-6">
      <label className="grid gap-1.5 md:max-w-xs">
        <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
        <select
          className="brand-input"
          value={sourceLanguage}
          onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
        >
          {supportedLanguages.map((entryLanguage) => (
            <option key={entryLanguage} value={entryLanguage}>
              {languageLabelFallback(entryLanguage)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const mission = fields.mission ?? {};
          const vision = fields.vision ?? {};
          return (
            <fieldset key={entryLanguage} className="grid gap-4 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <div className="grid gap-3">
                <h3 className="font-semibold">Mission</h3>
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input
                    className="brand-input"
                    value={asString((mission as JsonObject)?.title)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, {
                        ...fields,
                        mission: { ...mission, title: e.target.value },
                      })
                    }
                    required={isPrimary}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Description</span>
                  <textarea
                    className="brand-input"
                    value={asString((mission as JsonObject)?.desc)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, {
                        ...fields,
                        mission: { ...mission, desc: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </label>
              </div>

              <div className="grid gap-3">
                <h3 className="font-semibold">Vision</h3>
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input
                    className="brand-input"
                    value={asString((vision as JsonObject)?.title)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, {
                        ...fields,
                        vision: { ...vision, title: e.target.value },
                      })
                    }
                    required={isPrimary}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Description</span>
                  <textarea
                    className="brand-input"
                    value={asString((vision as JsonObject)?.desc)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, {
                        ...fields,
                        vision: { ...vision, desc: e.target.value },
                      })
                    }
                    rows={3}
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function IconCardSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
      const existing = cards[index] ?? {};
      cards[index] = { ...existing, [field]: value };
      return { ...current, blockContent: cards };
    });
  };

  const updateCardField = (language: Language, index: number, field: "cardTitle" | "cardDescription", value: string) => {
    const fields = translations[language] ?? {};
    const cards = Array.isArray(fields.blockContent) ? [...fields.blockContent] : [];
    const existing = cards[index] ?? {};
    cards[index] = { ...existing, [field]: value };
    updateTranslation(language, { ...fields, blockContent: cards });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const cards = asArrayOfObjects(fields.blockContent);
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                  required={isPrimary}
                />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Accreditation Cards</h3>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addCard}
                    className="btn-brand-secondary px-3 py-1 text-sm font-semibold"
                  >
                    + Add Card
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                {(entryLanguage === sourceLanguage ? sourceCards : cards).map((_, i: number) => {
                  const sharedIcon = asString((cards[i] as JsonObject)?.icon || (sourceCards[i] as JsonObject)?.icon);
                  const titleValue = asString((cards[i] as JsonObject)?.cardTitle);
                  const descValue = asString((cards[i] as JsonObject)?.cardDescription);
                  return (
                    <div key={i} className="brand-panel rounded-lg p-4">
                      <div className="space-y-2">
                        <div>
                          <label className="brand-label block">Card Title</label>
                          <input
                            type="text"
                            value={titleValue}
                            onChange={(e) => updateCardField(entryLanguage, i, "cardTitle", e.target.value)}
                            className="brand-input mt-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="brand-label block">Description</label>
                          <textarea
                            value={descValue}
                            onChange={(e) => updateCardField(entryLanguage, i, "cardDescription", e.target.value)}
                            className="brand-input mt-2 text-sm"
                            rows={3}
                          />
                        </div>
                        <div>
                          <AdminImagePicker
                            label="Icon (shared)"
                            value={sharedIcon}
                            onChange={(next) => updateSharedCardField(i, "icon", next)}
                            compact
                          />
                        </div>
                        {entryLanguage === sourceLanguage ? (
                          <button
                            type="button"
                            onClick={() => removeCard(i)}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900"
                          >
                            Remove Card
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function TeamGridSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceMembers = asArrayOfObjects(translations[sourceLanguage]?.teamMembers);

  const addMember = () => {
    updateAllTranslations((current) => ({
      ...current,
      teamMembers: [...(Array.isArray(current.teamMembers) ? current.teamMembers : []), { name: "", role: "", image: "", description: "" }],
    }));
  };

  const removeMember = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      teamMembers: (Array.isArray(current.teamMembers) ? current.teamMembers : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateSharedMemberField = (index: number, field: "image", value: string) => {
    updateAllTranslations((current) => {
      const members = Array.isArray(current.teamMembers) ? [...current.teamMembers] : [];
      const existing = members[index] ?? {};
      members[index] = { ...existing, [field]: value };
      return { ...current, teamMembers: members };
    });
  };

  const updateMemberField = (language: Language, index: number, field: "name" | "role" | "description", value: string) => {
    const fields = translations[language] ?? {};
    const members = Array.isArray(fields.teamMembers) ? [...fields.teamMembers] : [];
    const existing = members[index] ?? {};
    members[index] = { ...existing, [field]: value };
    updateTranslation(language, { ...fields, teamMembers: members });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const members = asArrayOfObjects(fields.teamMembers);
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                  required={isPrimary}
                />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Team Members</h3>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addMember}
                    className="btn-brand-secondary px-3 py-1 text-sm font-semibold"
                  >
                    + Add Member
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                {(entryLanguage === sourceLanguage ? sourceMembers : members).map((_, i: number) => {
                  const sharedImage = asString((members[i] as JsonObject)?.image || (sourceMembers[i] as JsonObject)?.image);
                  const nameValue = asString((members[i] as JsonObject)?.name);
                  const roleValue = asString((members[i] as JsonObject)?.role);
                  const descValue = asString((members[i] as JsonObject)?.description);
                  return (
                    <div key={i} className="brand-panel rounded-lg p-4">
                      <div className="space-y-2">
                        <div>
                          <label className="brand-label block">Name</label>
                          <input
                            type="text"
                            value={nameValue}
                            onChange={(e) => updateMemberField(entryLanguage, i, "name", e.target.value)}
                            className="brand-input mt-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="brand-label block">Role</label>
                          <input
                            type="text"
                            value={roleValue}
                            onChange={(e) => updateMemberField(entryLanguage, i, "role", e.target.value)}
                            className="brand-input mt-2 text-sm"
                          />
                        </div>
                        <div>
                          <AdminImagePicker
                            label="Image (shared)"
                            value={sharedImage}
                            onChange={(next) => updateSharedMemberField(i, "image", next)}
                            compact
                          />
                        </div>
                        <div>
                          <label className="brand-label block">Description</label>
                          <textarea
                            value={descValue}
                            onChange={(e) => updateMemberField(entryLanguage, i, "description", e.target.value)}
                            rows={2}
                            className="brand-input mt-2 text-sm"
                          />
                        </div>
                        {entryLanguage === sourceLanguage ? (
                          <button
                            type="button"
                            onClick={() => removeMember(i)}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900"
                          >
                            Remove Member
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function CtaSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceButtons: string[] = Array.isArray(translations[sourceLanguage]?.buttons)
    ? translations[sourceLanguage].buttons
    : [];

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
      <div>
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const buttons: string[] = Array.isArray(fields.buttons) ? fields.buttons : [];
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                  required={isPrimary}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">Description</span>
                <textarea
                  className="brand-input"
                  value={asString(fields.desc)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, desc: e.target.value })}
                  rows={3}
                />
              </label>

              <div className="flex justify-between items-center">
                <label className="brand-label">Buttons</label>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addButton}
                    className="btn-brand-secondary px-2 py-1 text-sm font-semibold"
                  >
                    + Add Button
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                {(entryLanguage === sourceLanguage ? sourceButtons : buttons).map((btn: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={buttons[i] ?? ""}
                      onChange={(e) => updateButton(entryLanguage, i, e.target.value)}
                      className="brand-input flex-1 text-sm"
                    />
                    {entryLanguage === sourceLanguage ? (
                      <button
                        type="button"
                        onClick={() => removeButton(i)}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900"
                      >
                        Remove
                      </button>
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

function CoreValuesSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceValues = asArrayOfObjects(translations[sourceLanguage]?.values);

  const addValue = () => {
    updateAllTranslations((current) => ({
      ...current,
      values: [...(Array.isArray(current.values) ? current.values : []), { title: "", description: "" }],
    }));
  };

  const removeValue = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      values: (Array.isArray(current.values) ? current.values : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateValue = (language: Language, index: number, field: "title" | "description", value: string) => {
    const fields = translations[language] ?? {};
    const values = Array.isArray(fields.values) ? [...fields.values] : [];
    const existing = values[index] ?? {};
    values[index] = { ...existing, [field]: value };
    updateTranslation(language, { ...fields, values });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const values = asArrayOfObjects(fields.values);
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Core Values</h3>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addValue}
                    className="btn-brand-secondary px-3 py-1 text-sm font-semibold"
                  >
                    + Add Value
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                {(entryLanguage === sourceLanguage ? sourceValues : values).map((_, i: number) => (
                  <div key={i} className="brand-panel rounded-lg p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="brand-label block">Value Title</label>
                        <input
                          type="text"
                          value={asString(values[i]?.title)}
                          onChange={(e) => updateValue(entryLanguage, i, "title", e.target.value)}
                          className="brand-input mt-2 text-sm"
                          placeholder="e.g., Excellence, Integrity, Innovation"
                        />
                      </div>
                      <div>
                        <label className="brand-label block">Description</label>
                        <textarea
                          value={asString(values[i]?.description)}
                          onChange={(e) => updateValue(entryLanguage, i, "description", e.target.value)}
                          rows={2}
                          className="brand-input mt-2 text-sm"
                          placeholder="Describe this value..."
                        />
                      </div>
                      {entryLanguage === sourceLanguage ? (
                        <button
                          type="button"
                          onClick={() => removeValue(i)}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900"
                        >
                          Remove Value
                        </button>
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

function StatisticsSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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
    const nextTranslations = { ...translations } as Record<Language, JsonObject>;
    for (const language of supportedLanguages) {
      nextTranslations[language] = updater(translations[language] ?? {});
    }
    onUpdate({ sourceLanguage, translations: nextTranslations });
  };

  const sourceStats = asArrayOfObjects(translations[sourceLanguage]?.stats);

  const addStat = () => {
    updateAllTranslations((current) => ({
      ...current,
      stats: [...(Array.isArray(current.stats) ? current.stats : []), { number: "", label: "", description: "" }],
    }));
  };

  const removeStat = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      stats: (Array.isArray(current.stats) ? current.stats : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateStat = (
    language: Language,
    index: number,
    field: "number" | "label" | "description",
    value: string
  ) => {
    const fields = translations[language] ?? {};
    const stats = Array.isArray(fields.stats) ? [...fields.stats] : [];
    const existing = stats[index] ?? {};
    stats[index] = { ...existing, [field]: value };
    updateTranslation(language, { ...fields, stats });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="grid gap-1.5 md:max-w-xs">
          <span className="brand-label">{t("announcement.sourceLanguage") || "Primary Language"}</span>
          <select
            className="brand-input"
            value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.currentTarget.value as Language)}
          >
            {supportedLanguages.map((entryLanguage) => (
              <option key={entryLanguage} value={entryLanguage}>
                {languageLabelFallback(entryLanguage)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const isPrimary = entryLanguage === sourceLanguage;
          const fields = translations[entryLanguage] ?? {};
          const stats = asArrayOfObjects(fields.stats);
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={isPrimary} />

              <label className="grid gap-1.5">
                <span className="brand-label">Section Title</span>
                <input
                  className="brand-input"
                  value={asString(fields.title)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, title: e.target.value })}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="brand-label">Section Description</span>
                <textarea
                  className="brand-input"
                  value={asString(fields.description)}
                  onChange={(e) => updateTranslation(entryLanguage, { ...fields, description: e.target.value })}
                  rows={2}
                  placeholder="Optional description for the statistics section"
                />
              </label>

              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Statistics</h3>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addStat}
                    className="btn-brand-secondary px-3 py-1 text-sm font-semibold"
                  >
                    + Add Statistic
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                {(entryLanguage === sourceLanguage ? sourceStats : stats).map((_, i: number) => (
                  <div key={i} className="brand-panel rounded-lg p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="brand-label block">Number/Metric</label>
                        <input
                          type="text"
                          value={asString(stats[i]?.number)}
                          onChange={(e) => updateStat(entryLanguage, i, "number", e.target.value)}
                          className="brand-input mt-2 text-sm"
                          placeholder="e.g., 25+, 5000, 98%"
                        />
                      </div>
                      <div>
                        <label className="brand-label block">Label</label>
                        <input
                          type="text"
                          value={asString(stats[i]?.label)}
                          onChange={(e) => updateStat(entryLanguage, i, "label", e.target.value)}
                          className="brand-input mt-2 text-sm"
                          placeholder="e.g., Years of Excellence, Students Enrolled"
                        />
                      </div>
                      <div>
                        <label className="brand-label block">Description</label>
                        <textarea
                          value={asString(stats[i]?.description)}
                          onChange={(e) => updateStat(entryLanguage, i, "description", e.target.value)}
                          rows={2}
                          className="brand-input mt-2 text-sm"
                          placeholder="Additional context for this statistic"
                        />
                      </div>
                      {entryLanguage === sourceLanguage ? (
                        <button
                          type="button"
                          onClick={() => removeStat(i)}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900"
                        >
                          Remove Statistic
                        </button>
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
