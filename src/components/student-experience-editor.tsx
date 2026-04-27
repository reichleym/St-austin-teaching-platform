"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import { getLocalizedSectionEnvelopeDraft } from "@/lib/dynamic-page-localization";
import { uploadAdminImage } from "@/lib/admin-image-upload";

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

function createDraftStudentExperiencePage(): DynamicPage {
  return {
    id: "",
    slug: "studentExperience",
    title: "Student Experience",
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
              title: "Student Experience",
              description: "Discover the vibrant community and enriching experiences at St. Austin's International University.",
              bgImg: "/bannerImg.jpg",
            },
            fr: {
              title: "Student Experience",
              description: "Discover the vibrant community and enriching experiences at St. Austin's International University.",
              bgImg: "/bannerImg.jpg",
            },
          },
        },
      },
      {
        sectionKey: "how-youll-learn",
        componentType: "IconCard",
        position: 1,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "How You'll Learn",
              blockContent: [
                {
                  cardTitle: "Flexible Online Learning",
                  cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Collaborative Community",
                  cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Career Services",
                  cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                  icon: "/nursing-icon.png",
                },
                {
                  cardTitle: "24/7 Support",
                  cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Rich Resources",
                  cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Global Network",
                  cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                  icon: "/nursing-icon.png",
                },
              ],
            },
            fr: {
              title: "How You'll Learn",
              blockContent: [
                {
                  cardTitle: "Flexible Online Learning",
                  cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Collaborative Community",
                  cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Career Services",
                  cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                  icon: "/nursing-icon.png",
                },
                {
                  cardTitle: "24/7 Support",
                  cardDescription: "Study from anywhere with our state-of-the-art virtual classroom and asynchronous course materials.",
                  icon: "/awards-icon.png",
                },
                {
                  cardTitle: "Rich Resources",
                  cardDescription: "Engage with peers through discussion forums, group projects, and networking events.",
                  icon: "/business-icon.png",
                },
                {
                  cardTitle: "Global Network",
                  cardDescription: "Resume workshops, mock interviews, job fairs, and direct employer connections for every student.",
                  icon: "/nursing-icon.png",
                },
              ],
            },
          },
        },
      },
      {
        sectionKey: "learn-schedule",
        componentType: "LearnSchedule",
        position: 2,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              image: "/cta-img.png",
              title: "Learn on Your Schedule",
              description: "Whether you're a working professional, a parent, or a career changer, our programs are designed to fit your life. Study anytime, anywhere with our award-winning online platform.",
              list: [
                "Academic advising and mentorship",
                "Writing center and tutoring",
                "Disability and accessibility services",
                "Mental health and wellness programs",
                "Library and research support",
                "Technology help desk"
              ],
            },
            fr: {
              image: "/cta-img.png",
              title: "Learn on Your Schedule",
              description: "Whether you're a working professional, a parent, or a career changer, our programs are designed to fit your life. Study anytime, anywhere with our award-winning online platform.",
              list: [
                "Academic advising and mentorship",
                "Writing center and tutoring",
                "Disability and accessibility services",
                "Mental health and wellness programs",
                "Library and research support",
                "Technology help desk"
              ],
            },
          },
        },
      },
      {
        sectionKey: "learning-dashboard",
        componentType: "LearningDashboardCta",
        position: 3,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              image: "/cta-img.png",
              title: "Your Learning Dashboard",
              description: "Our integrated portal gives you access to assignments, discussions, messaging, grades, and more — all in one place.",
              button: {
                label: "Access the Portal",
                href: "",
              },
            },
            fr: {
              image: "/cta-img.png",
              title: "Your Learning Dashboard",
              description: "Our integrated portal gives you access to assignments, discussions, messaging, grades, and more — all in one place.",
              button: {
                label: "Access the Portal",
                href: "",
              },
            },
          },
        },
      },
      {
        sectionKey: "studentTestimonials",
        componentType: "StudentTestimonialsSection",
        position: 4,
        content: {
          sourceLanguage: "en",
          translations: {
            en: {
              title: "Student Testimonials",
              description: "Hear from our students about their experiences at St. Austin's International University.",
              testimonials: [
                {
                  name: "John Smith",
                  course: "Computer Science",
                  experience: "Studying at St. Austin's has been transformative. The flexible online format allowed me to balance work and education while gaining practical skills that advanced my career.",
                  profileImage: "",
                },
              ],
            },
            fr: {
              title: "Témoignages d'étudiants",
              description: "Découvrez les expériences de nos étudiants à l'Université Internationale St. Austin.",
              testimonials: [
                {
                  name: "John Smith",
                  course: "Informatique",
                  experience: "Étudier à St. Austin a été transformateur. Le format en ligne flexible m'a permis de concilier travail et éducation tout en acquérant des compétences pratiques qui ont fait progresser ma carrière.",
                  profileImage: "",
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

export default function StudentExperienceEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchStudentExperiencePage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/studentExperience");
      if (res.ok) {
        const data = (await res.json()) as Partial<DynamicPage> & { sections?: unknown };
        const hasSections =
          Array.isArray(data.sections) && (data.sections as unknown[]).length > 0;

        if (hasSections) {
          setPage(data as DynamicPage);
          return;
        }

        const draft = createDraftStudentExperiencePage();
        // Keep persisted page metadata, but ensure we have visible sections to edit.
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
        setPage(createDraftStudentExperiencePage());
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(apiErrorMessage(parsed, "Failed to load Student Experience page."));
      setPage(createDraftStudentExperiencePage());
    } catch (error) {
      console.error("Error fetching student experience page:", error);
      setError("Failed to load Student Experience page.");
      setPage(createDraftStudentExperiencePage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudentExperiencePage();
  }, [fetchStudentExperiencePage]);

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
      setError(apiErrorMessage(parsed, "Failed to save Student Experience page."));
    } catch (error) {
      console.error("Error saving page:", error);
      setError(error instanceof Error && error.message.trim() ? error.message : "Failed to save Student Experience page.");
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
        <p className="text-sm font-semibold text-[#2e5f9e]">Loading Student Experience page…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">Student Experience Page Management</h3>
          <p className="brand-muted text-sm">Edit sections, images, and content.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchStudentExperiencePage}
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
          <p className="text-sm font-semibold text-[#083672]">Student Experience page data is unavailable.</p>
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
    BannerSection: {
      label: "Hero Banner",
      description: "Intro hero banner with overlay image background, centered title and description.",
    },
    IconCard: {
      label: "How You'll Learn",
      description: "6-column grid (md) of feature cards with icons, titles, descriptions.",
    },
    LearnSchedule: {
      label: "Learn on Your Schedule",
      description: "Two-column layout with image left, title/description/checklist right.",
    },
    LearningDashboardCta: {
      label: "Your Learning Dashboard",
      description: "Two-column layout with content left, image right, primary button.",
    },
    StudentTestimonialsSection: {
      label: "Student Testimonials",
      description: "Student testimonials with name, course, experience text, and profile image.",
    },
    CtaSection: {
      label: "Call to Action",
      description: "Full-width blue CTA with gradient image overlay and 3 buttons.",
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
      {section.componentType === "IconCard" && (
        <IconCardSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "LearnSchedule" && (
        <LearnScheduleForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "LearningDashboardCta" && (
        <LearningDashboardCtaForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "StudentTestimonialsSection" && (
        <StudentTestimonialsSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {section.componentType === "CtaSection" && (
        <CtaSectionForm content={section.content} onUpdate={onUpdate} />
      )}
      {/* Raw JSON fallback for unknown sections */}
      {![
        "BannerSection",
        "IconCard",
        "LearnSchedule",
        "LearningDashboardCta",
        "StudentTestimonialsSection",
        "CtaSection",
      ].includes(section.componentType) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Unsupported section</p>
          <p className="text-sm text-slate-500">This section type is not supported by the visual editor.</p>
        </div>
      )}
    </section>
  );
}

function LearnScheduleForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

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

  const sourceList = Array.isArray(translations[sourceLanguage]?.list) ? (translations[sourceLanguage].list as unknown[]) : [];

  const addListItem = () => {
    updateAllTranslations((current) => ({
      ...current,
      list: [...(Array.isArray(current.list) ? current.list : []), ""],
    }));
  };

  const removeListItem = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      list: (Array.isArray(current.list) ? current.list : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateListItem = (language: Language, index: number, value: string) => {
    const fields = translations[language] ?? {};
    const list = Array.isArray(fields.list) ? [...fields.list] : [];
    list[index] = value;
    updateTranslation(language, { ...fields, list });
  };

  return (
    <div className="space-y-4">
      <AdminImagePicker
        label="Image (shared)"
        value={sharedImage}
        onChange={(next) =>
          updateAllTranslations((current) => ({ ...current, image: next, imageStorageKey: undefined }))
        }
        onUpload={(result) =>
          updateAllTranslations((current) => ({
            ...current,
            image: result.publicUrl,
            imageStorageKey: result.storageKey,
          }))
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const fields = translations[entryLanguage] ?? {};
          const list: string[] = Array.isArray(fields.list) ? (fields.list as string[]) : [];
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={entryLanguage === sourceLanguage} />

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

              <div className="flex justify-between items-center">
                <label className="brand-label">Checklist Items</label>
                {entryLanguage === sourceLanguage ? (
                  <button
                    type="button"
                    onClick={addListItem}
                    className="btn-brand-secondary px-2 py-1 text-sm font-semibold"
                  >
                    + Add Item
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                {(entryLanguage === sourceLanguage ? sourceList : list).map((_, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={list[i] ?? ""}
                      onChange={(e) => updateListItem(entryLanguage, i, e.target.value)}
                      className="brand-input flex-1 text-sm"
                      placeholder="Checklist item..."
                    />
                    {entryLanguage === sourceLanguage ? (
                      <button
                        type="button"
                        onClick={() => removeListItem(i)}
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

function LearningDashboardCtaForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
  const envelope = getLocalizedSectionEnvelopeDraft(content);
  const sourceLanguage = envelope.sourceLanguage;
  const translations = envelope.translations;

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
        onChange={(next) =>
          updateAllTranslations((current) => ({ ...current, image: next, imageStorageKey: undefined }))
        }
        onUpload={(result) =>
          updateAllTranslations((current) => ({
            ...current,
            image: result.publicUrl,
            imageStorageKey: result.storageKey,
          }))
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {supportedLanguages.map((entryLanguage) => {
          const fields = translations[entryLanguage] ?? {};
          const button = isJsonObject(fields.button) ? (fields.button as JsonObject) : {};
          return (
            <fieldset key={entryLanguage} className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4">
              <LanguageLegend language={entryLanguage} isPrimary={entryLanguage === sourceLanguage} />

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
                  rows={3}
                />
              </label>

              <div className="space-y-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Button Label</span>
                  <input
                    className="brand-input"
                    value={asString(button.label)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, { ...fields, button: { ...button, label: e.target.value } })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Button URL (href)</span>
                  <input
                    className="brand-input"
                    value={asString(button.href)}
                    onChange={(e) =>
                      updateTranslation(entryLanguage, { ...fields, button: { ...button, href: e.target.value } })
                    }
                    placeholder="/portal"
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
        onChange={(next) =>
          updateAllTranslations((current) => ({ ...current, bgImg: next, bgImgStorageKey: undefined }))
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
              <fieldset
                key={entryLanguage}
                className="grid gap-3 rounded-2xl border border-[#c6ddfa] bg-[#f8fbff] p-4"
              >
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
      blockContent: [
        ...(Array.isArray(current.blockContent) ? current.blockContent : []),
        { cardTitle: "", cardDescription: "", icon: "" },
      ],
    }));
  };

  const removeCard = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      blockContent: (Array.isArray(current.blockContent) ? current.blockContent : []).filter((_, i: number) => i !== index),
    }));
  };

  const updateSharedCardField = (index: number, field: "icon", value: string, storageKey?: string) => {
    updateAllTranslations((current) => {
      const cards = Array.isArray(current.blockContent) ? [...current.blockContent] : [];
      const existing = cards[index] ?? {};
      const nextCard = { ...existing, [field]: value } as JsonObject;
      if (storageKey === undefined) {
        delete nextCard.iconStorageKey;
      } else {
        nextCard.iconStorageKey = storageKey;
      }
      cards[index] = nextCard;
      return { ...current, blockContent: cards };
    });
  };

  const updateCardField = (
    language: Language,
    index: number,
    field: "cardTitle" | "cardDescription",
    value: string
  ) => {
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
                <h3 className="font-semibold">Feature Cards</h3>
                {entryLanguage === sourceLanguage ? (
                  <button type="button" onClick={addCard} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">
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
                            onUpload={(result) => updateSharedCardField(i, "icon", result.publicUrl, result.storageKey)}
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

function StudentTestimonialsSectionForm({
  content,
  onUpdate,
}: {
  content: unknown;
  onUpdate: (content: JsonObject) => void;
}) {
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

  const sourceTestimonials = asArrayOfObjects(translations[sourceLanguage]?.testimonials);

  const addTestimonial = () => {
    updateAllTranslations((current) => ({
      ...current,
      testimonials: [
        ...(Array.isArray(current.testimonials) ? current.testimonials : []),
        { name: "", course: "", experience: "", profileImage: "" },
      ],
    }));
  };

  const removeTestimonial = (index: number) => {
    updateAllTranslations((current) => ({
      ...current,
      testimonials: (Array.isArray(current.testimonials) ? current.testimonials : []).filter((_: any, i: number) => i !== index),
    }));
  };

  const updateTestimonialField = (
    language: Language,
    index: number,
    field: "name" | "course" | "experience" | "profileImage",
    value: string
  ) => {
    const fields = translations[language] ?? {};
    const testimonials = Array.isArray(fields.testimonials) ? [...fields.testimonials] : [];
    const testimonial = { ...testimonials[index] };
    testimonial[field] = value;
    testimonials[index] = testimonial;
    updateTranslation(language, { ...fields, testimonials });
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
          const testimonials = asArrayOfObjects(fields.testimonials);
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
                  rows={3}
                />
              </label>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Testimonials</span>
                {isPrimary && <button type="button" onClick={addTestimonial} className="btn-brand-secondary px-3 py-1 text-sm font-semibold">+ Add Testimonial</button>}
              </div>
              <div className="space-y-4">
                {(isPrimary ? sourceTestimonials : testimonials).map((t: JsonObject, i: number) => (
                  <div key={i} className="brand-panel rounded-lg p-4 space-y-3">
                    <input
                      type="text"
                      placeholder="Student Name"
                      value={asString(testimonials[i]?.name)}
                      onChange={(e) => updateTestimonialField(lang, i, "name", e.target.value)}
                      className="brand-input text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Course"
                      value={asString(testimonials[i]?.course)}
                      onChange={(e) => updateTestimonialField(lang, i, "course", e.target.value)}
                      className="brand-input text-sm"
                    />
                    <textarea
                      placeholder="Student Experience"
                      value={asString(testimonials[i]?.experience)}
                      onChange={(e) => updateTestimonialField(lang, i, "experience", e.target.value)}
                      className="brand-input text-sm"
                      rows={3}
                    />
                    <AdminImagePicker
                      label="Profile Image"
                      value={asString(testimonials[i]?.profileImage)}
                      onChange={(next) => updateTestimonialField(lang, i, "profileImage", next)}
                      compact
                    />
                    {isPrimary && (
                      <button type="button" onClick={() => removeTestimonial(i)} className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-900">Remove Testimonial</button>
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
    ? (translations[sourceLanguage].buttons as string[])
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
          const buttons: string[] = Array.isArray(fields.buttons) ? (fields.buttons as string[]) : [];
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
                  <button type="button" onClick={addButton} className="btn-brand-secondary px-2 py-1 text-sm font-semibold">
                    + Add Button
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                {(entryLanguage === sourceLanguage ? sourceButtons : buttons).map((_, i: number) => (
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
