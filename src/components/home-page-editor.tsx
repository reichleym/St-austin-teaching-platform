"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";
import { uploadAdminImage } from "@/lib/admin-image-upload";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function localizedString(value: unknown, lang: Language) {
  if (typeof value === "string") return lang === "en" ? value : "";
  if (isJsonObject(value)) {
    const v = value as Record<string, unknown>;
    return typeof v[lang] === "string" ? (v[lang] as string) : "";
  }
  return "";
}

function setLocalized(content: JsonObject, key: string, lang: Language, val: string) {
  const next: JsonObject = { ...(content ?? {}) };
  const prev = next[key];

  if (typeof prev === "string") {
    const obj: Record<Language, string> = { en: "", fr: "" } as Record<Language, string>;
    obj[lang] = val;
    next[key] = obj;
    return next;
  }

  if (isJsonObject(prev)) {
    const p = prev as Record<string, unknown>;
    const updated: Record<Language, string> = { en: "", fr: "" } as Record<Language, string>;
    if (typeof p.en === "string") updated.en = p.en as string;
    if (typeof p.fr === "string") updated.fr = p.fr as string;
    updated[lang] = val;
    next[key] = updated;
    return next;
  }

  // No previous value: create a new localized object
  const obj: Record<Language, string> = { en: "", fr: "" } as Record<Language, string>;
  obj[lang] = val;
  next[key] = obj;
  return next;
}

const languageLabelFallback = (language: Language) => (language === "fr" ? "French" : "English");

function LanguageLegend({ language, isPrimary }: { language: Language; isPrimary: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[#0b3e81]">{languageLabelFallback(language)} version</span>
      {isPrimary ? <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">Primary</span> : null}
    </div>
  );
}

function AdminImagePicker({ label, value, onChange, onUpload, compact = false }: {
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
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            setError("");
            setIsUploading(true);
            try {
              const result = await uploadAdminImage(file);
              onChange(result.publicUrl);
              onUpload?.(result);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to upload image.");
            } finally {
              setIsUploading(false);
            }
          }} disabled={isUploading} />
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-brand-secondary px-3 py-1.5 text-sm font-semibold disabled:opacity-60" disabled={isUploading}>
            {isUploading ? "Uploading…" : "Pick image"}
          </button>
          {value ? <button type="button" onClick={() => onChange("")} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700" disabled={isUploading}>Clear</button> : null}
        </div>
      </div>
      <input type="text" value={value} onChange={(e) => onChange(e.currentTarget.value)} className={compact ? "brand-input text-sm" : "brand-input"} placeholder="Paste image URL or pick" disabled={isUploading} />
      {value ? <div className="flex items-center gap-3"><img src={value} alt="" className={compact ? "h-12 w-12 rounded object-cover" : "h-20 w-20 rounded object-cover"} />{compact ? null : <div className="min-w-0"><p className="text-sm font-semibold text-gray-700">Current</p><p className="text-xs text-gray-500 break-all">{value}</p></div>}</div> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

interface PageSection {
  id?:string;
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

function createDraftHomePage(): DynamicPage {
  return {
    id: "",
    slug: "home",
    title: "Home Page",
    published: false,
    sections: [
      {
        sectionKey: "banner",
        componentType: "HeroSection",
        position: 0,
        content: {
          title: "Our Programs",
          description: "Discover career-focused programs designed for the modern professional.",
          bgImg: "",
        },
      },
      //   {
      //     sectionKey: "explore",
      //     componentType: "ExplorePrograms",
      //     position: 1,
      //     content: {
      //       title: "Explore Programs",
      //       degreeLevel: "",
      //       fieldOfStudy: "",
      //     },
      //   },
      //   {
      //     sectionKey: "featuredPrograms",
      //     componentType: "FeaturedPrograms",
      //     position: 2,
      //     content: {},
      //   },
      {
        sectionKey: "featuredStories",
        componentType: "FeaturedStories",
        position: 3,
        content: {},
      },
      {
        sectionKey: "whyAustin",
        componentType: "WhyAustin",
        position: 4,
        content: {
          title: "Why Choose Us",
          whyAustinDesc: "Learn from experienced faculty and flexible online options.",
          button: { label: "Learn More", href: "/about" },
        },
      },
      {
        sectionKey: "learnSomething",
        componentType: "LearnSomething",
        position: 5,
        content: { cards: [{ title: { en: "", fr: "" }, desc: { en: "", fr: "" } }] },
      },
      {
        sectionKey: "testimonial",
        componentType: "Testimonial",
        position: 6,
        content: { testimonials: [{ quote: "", author: "", authorRole: "", image: "" }] },
      },
      {
        sectionKey: "learningExp",
        componentType: "LearningExp",
        position: 7,
        content: { cards: [{ title: { en: "", fr: "" }, desc: { en: "", fr: "" }, image: "" }] },
      },
      {
        sectionKey: "newsAnnouncements",
        componentType: "NewsAnnouncements",
        position: 8,
        content: { items: [] },
      },
      {
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 5,
        content: {
          title: "Ready to Start?",
          description: "Apply today or request more information.",
          button: { label: "Apply Now", href: "/apply" },
        },
      },
      //   {
      //     sectionKey: "footer",
      //     componentType: "Footer",
      //     position: 6,
      //     content: {},
      //   },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function HomePageEditor() {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch("/api/admin/pages/home");
      if (res.ok) {
        const data = (await res.json()) as Partial<DynamicPage> & { sections?: unknown };
        const hasSections = Array.isArray(data.sections) && (data.sections as unknown[]).length > 0;
        if (hasSections) {
          setPage(data as DynamicPage);
          return;
        }
        const draft = createDraftHomePage();
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
        setPage(createDraftHomePage());
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(typeof parsed.error === "string" ? parsed.error : "Failed to load Home page.");
      setPage(createDraftHomePage());
    } catch (err) {
      console.error(err);
      setError("Failed to load Home page.");
      setPage(createDraftHomePage());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    setError("");
    try {
      const sanitized = { ...page } as DynamicPage;
      const res = await fetch(`/api/admin/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitized),
      });
      if (res.ok) {
        const updated = await res.json();
        setPage(updated);
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      setError(typeof parsed.error === "string" ? parsed.error : "Failed to save Home page.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : "Failed to save Home page.");
    } finally {
      setSaving(false);
    }
  };

  const updateSectionContent = (sectionId: string | undefined, sectionKey: string, newContent: JsonObject) => {
    setPage((prev) => {
      if (!prev) return prev;
      const nextSections = prev.sections.map((section: any) => {
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
        <p className="text-sm font-semibold text-[#2e5f9e]">Loading Home page…</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="brand-title text-2xl font-black">Home Page Editor</h3>
          <p className="brand-muted text-sm">Edit homepage sections and content.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchPage}
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
          <p className="text-sm font-semibold text-[#083672]">Home page data is unavailable.</p>
          <p className="brand-muted mt-1 text-sm">Press Refresh to try again.</p>
        </section>
      ) : (
        <>
          <section className="brand-card p-6">
            <h4 className="brand-title text-xl font-black">Page Settings</h4>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5">
                <span className="brand-label">Page title</span>
                <input type="text" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} className="brand-input" />
              </label>
            </div>
          </section>

          <section className="space-y-6">
            {page.sections
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((section) => (
                <SectionCard key={section.id || section.sectionKey} section={section} onUpdate={(content) => updateSectionContent(section.id, section.sectionKey, content)} />
              ))}
          </section>
        </>
      )}
    </section>
  );
}

function SectionCard({ section, onUpdate }: { section: PageSection; onUpdate: (content: JsonObject) => void }) {
  const config: Record<string, { label: string; description: string }> = {
    HeroSection: { label: "Hero Banner", description: "Intro hero banner with background image, centered title and description." },
    ExplorePrograms: { label: "Explore Programs", description: "Prominent callout to explore programs and filters." },
    // FeaturedPrograms: { label: "Featured Programs", description: "Highlight a small selection of programs." },
    FeaturedStories: { label: "Featured Stories", description: "Stories or testimonials." },
    WhyAustin: { label: "Why Choose Us", description: "Short reasons to choose the university." },
    CtaSection: { label: "Call to Action", description: "Full-width CTA with button." },
    LearnSomething: { label: "Learn Something", description: "Cards highlighting key benefits or features." },
    Testimonial: { label: "Testimonials", description: "Student or alumni testimonials." },
    LearningExp: { label: "Learning Experience", description: "Cards describing learning formats or experiences." },
    NewsAnnouncements: { label: "News & Announcements", description: "Recent news items or announcements." },
    Footer: { label: "Footer", description: "Site footer content." },
  };

  const meta = config[section.componentType] ?? { label: section.sectionKey, description: "Edit this section." };

  return (
    <section className="brand-card p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="brand-title text-2xl font-black">{meta.label}</h3>
          <p className="brand-muted text-sm">{meta.description}</p>
        </div>
        <span className="brand-chip">SECTION {section.position + 1}</span>
      </div>

      {section.componentType === "HeroSection" && <HeroForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "ExplorePrograms" && <ExploreForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "LearnSomething" && <LearnSomethingForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "Testimonial" && <TestimonialForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "LearningExp" && <LearningExpForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "NewsAnnouncements" && <NewsAnnouncementsForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "CtaSection" && <CtaForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "WhyAustin" && <WhyAustinForm content={section.content} onUpdate={onUpdate} />}
      {/* {section.componentType === "FeaturedPrograms" && <div className="text-sm text-gray-600">No visual editor for Featured Programs.</div>} */}
      {section.componentType === "FeaturedStories" && <FeaturedStoriesForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "Footer" && <div className="text-sm text-gray-600">Footer content managed elsewhere.</div>}
    </section>
  );
}

function HeroForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const titleEn = localizedString(c.title, "en");
  const titleFr = localizedString(c.title, "fr");
  const descEn = localizedString(c.description, "en");
  const descFr = localizedString(c.description, "fr");
  const bgImg = typeof c.bgImg === "string" ? c.bgImg : "";

  const button = typeof c.button === "object" && c.button ? (c.button as Record<string, unknown>) : {};
  const btnLabelEn = localizedString(button.label, "en");
  const btnLabelFr = localizedString(button.label, "fr");
  const btnHref = typeof button.href === "string" ? button.href : "";

  return (
    <div className="space-y-4">
      <AdminImagePicker label="Background Image" value={bgImg} onChange={(v) => onUpdate({ ...c, bgImg: v })} />

      <div className="mt-3">
        <label className="brand-label">Primary Language</label>
        <select className="brand-input w-48 mt-2">
          <option>English</option>
          <option>French</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="brand-panel p-4">
          <LanguageLegend language="en" isPrimary={true} />
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleEn} onChange={(e) => onUpdate(setLocalized(c, "title", "en", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={descEn} onChange={(e) => onUpdate(setLocalized(c, "description", "en", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Button label</span>
              <input className="brand-input" value={btnLabelEn} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), label: setLocalized(button, "label", "en", e.target.value).label } })} />
            </label>
          </div>
        </div>

        <div className="brand-panel p-4">
          <LanguageLegend language="fr" isPrimary={false} />
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleFr} onChange={(e) => onUpdate(setLocalized(c, "title", "fr", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={descFr} onChange={(e) => onUpdate(setLocalized(c, "description", "fr", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Button label</span>
              <input className="brand-input" value={btnLabelFr} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), label: setLocalized(button, "label", "fr", e.target.value).label } })} />
            </label>
          </div>
        </div>
      </div>

      {/* <div className="mt-3">
        <label className="brand-label">Button href</label>
        <input className="brand-input mt-2" value={btnHref} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), href: e.target.value } })} />
      </div> */}
    </div>
  );
}

function ExploreForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const title = typeof c.title === "string" ? c.title : "";
  const degreeLevel = typeof c.degreeLevel === "string" ? c.degreeLevel : "";
  const fieldOfStudy = typeof c.fieldOfStudy === "string" ? c.fieldOfStudy : "";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="brand-label">Title</span>
        <input className="brand-input" value={title} onChange={(e) => onUpdate({ ...c, title: e.target.value })} />
      </label>
      <label className="grid gap-1.5">
        <span className="brand-label">Degree Level</span>
        <input className="brand-input" value={degreeLevel} onChange={(e) => onUpdate({ ...c, degreeLevel: e.target.value })} />
      </label>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="brand-label">Field Of Study</span>
        <input className="brand-input" value={fieldOfStudy} onChange={(e) => onUpdate({ ...c, fieldOfStudy: e.target.value })} />
      </label>
    </div>
  );
}

function CtaForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const titleEn = localizedString(c.title, "en");
  const titleFr = localizedString(c.title, "fr");
  const descEn = localizedString(c.description, "en");
  const descFr = localizedString(c.description, "fr");
  const button = typeof c.button === "object" && c.button ? (c.button as Record<string, unknown>) : {};
  const labelEn = localizedString(button.label, "en");
  const labelFr = localizedString(button.label, "fr");
  const href = typeof button.href === "string" ? button.href : "";

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="brand-panel p-4">
          <LanguageLegend language="en" isPrimary={true} />
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleEn} onChange={(e) => onUpdate(setLocalized(c, "title", "en", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={descEn} onChange={(e) => onUpdate(setLocalized(c, "description", "en", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Button label</span>
              <input className="brand-input" value={labelEn} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), label: setLocalized(button, "label", "en", e.target.value).label } })} />
            </label>
          </div>
        </div>

        <div className="brand-panel p-4">
          <LanguageLegend language="fr" isPrimary={false} />
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleFr} onChange={(e) => onUpdate(setLocalized(c, "title", "fr", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={descFr} onChange={(e) => onUpdate(setLocalized(c, "description", "fr", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Button label</span>
              <input className="brand-input" value={labelFr} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), label: setLocalized(button, "label", "fr", e.target.value).label } })} />
            </label>
          </div>
        </div>
      </div>

      {/* <div className="mt-3">
        <label className="brand-label">Button href</label>
        <input className="brand-input mt-2" value={href} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), href: e.target.value } })} />
      </div> */}
    </div>
  );
}

function WhyAustinForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const titleEn = localizedString(c.title, "en");
  const titleFr = localizedString(c.title, "fr");
  const whyAustinDescEn = localizedString(c.whyAustinDesc, "en");
  const whyAustinDescFr = localizedString(c.whyAustinDesc, "fr");

  const cards = Array.isArray(c.cards) ? (c.cards as Array<Record<string, unknown>>) : [];
  const updateCard = (idx: number, next: Record<string, unknown>) => onUpdate({ ...c, cards: cards.map((it, i) => (i === idx ? next : it)) });
  const addCard = () => onUpdate({ ...c, cards: [...cards, { icon: "", title: { en: "", fr: "" }, desc: { en: "", fr: "" } }] });
  const removeCard = (idx: number) => onUpdate({ ...c, cards: cards.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="brand-panel p-3">
          <LanguageLegend language="en" isPrimary={true} />
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleEn} onChange={(e) => onUpdate(setLocalized(c, "title", "en", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={whyAustinDescEn} onChange={(e) => onUpdate(setLocalized(c, "whyAustinDesc", "en", e.target.value))} />
            </label>
          </div>
        </div>

        <div className="brand-panel p-3">
          <LanguageLegend language="fr" isPrimary={false} />
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1.5">
              <span className="brand-label">Title</span>
              <input className="brand-input" value={titleFr} onChange={(e) => onUpdate(setLocalized(c, "title", "fr", e.target.value))} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Description</span>
              <textarea className="brand-input" rows={3} value={whyAustinDescFr} onChange={(e) => onUpdate(setLocalized(c, "whyAustinDesc", "fr", e.target.value))} />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {cards.map((card, idx) => (
          <div key={idx} className="grid gap-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="brand-panel p-3">
                <LanguageLegend language="en" isPrimary={true} />
                <div className="mt-3 grid gap-2">
                  <input className="brand-input" placeholder="Card title" value={localizedString(card.title, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "en", e.target.value))} />
                  <input className="brand-input" placeholder="Card description" value={localizedString(card.desc, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "en", e.target.value))} />
                </div>
              </div>
              <div className="brand-panel p-3">
                <LanguageLegend language="fr" isPrimary={false} />
                <div className="mt-3 grid gap-2">
                  <input className="brand-input" placeholder="Card title" value={localizedString(card.title, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "fr", e.target.value))} />
                  <input className="brand-input" placeholder="Card description" value={localizedString(card.desc, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "fr", e.target.value))} />
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 items-end">
              <div>
                <AdminImagePicker label="Icon" value={String(card.icon ?? "")} compact onChange={(v) => updateCard(idx, { ...(card as object), icon: v })} />
              </div>
              <div className="flex justify-end items-center">
                <button type="button" className="btn-outline" onClick={() => removeCard(idx)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        <div>
          <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addCard}>
            Add card
          </button>
        </div>
      </div>
    </div>
  );
}


function LearnSomethingForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const cards = Array.isArray(c.cards) ? (c.cards as Array<Record<string, unknown>>) : [];

  const updateCard = (idx: number, next: Record<string, unknown>) => onUpdate({ ...c, cards: cards.map((it, i) => (i === idx ? next : it)) });
  const addCard = () => onUpdate({ ...c, cards: [...cards, { title: { en: "", fr: "" }, desc: { en: "", fr: "" } }] });
  const removeCard = (idx: number) => onUpdate({ ...c, cards: cards.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      {cards.map((card, idx) => (
        <div key={idx} className="grid gap-3 rounded-md border border-slate-100 p-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="brand-panel p-3">
              <LanguageLegend language="en" isPrimary={true} />
              <div className="mt-3 grid gap-2">
                <input className="brand-input" placeholder="Card title" value={localizedString(card.title, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "en", e.target.value))} />
                <input className="brand-input" placeholder="Card description" value={localizedString(card.desc, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "en", e.target.value))} />
              </div>
            </div>

            <div className="brand-panel p-3">
              <LanguageLegend language="fr" isPrimary={false} />
              <div className="mt-3 grid gap-2">
                <input className="brand-input" placeholder="Card title" value={localizedString(card.title, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "fr", e.target.value))} />
                <input className="brand-input" placeholder="Card description" value={localizedString(card.desc, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "fr", e.target.value))} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-outline" onClick={() => removeCard(idx)}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addCard}>
          Add card
        </button>
      </div>
    </div>
  );
}

function TestimonialForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const list = Array.isArray(c.testimonials) ? (c.testimonials as Array<Record<string, unknown>>) : [];

  const updateItem = (idx: number, next: Record<string, unknown>) => {
    const nextList = list.slice();
    nextList[idx] = next;
    onUpdate({ ...c, testimonials: nextList });
  };
  const addItem = () => onUpdate({ ...c, testimonials: [...list, { quote: { en: "", fr: "" }, author: { en: "", fr: "" }, authorRole: { en: "", fr: "" }, image: "" }] });
  const removeItem = (idx: number) => onUpdate({ ...c, testimonials: list.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      {list.map((item, idx) => (
        <div key={idx} className="grid gap-3 rounded-md border border-slate-100 p-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="brand-panel p-3">
              <LanguageLegend language="en" isPrimary={true} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Quote</span>
                  <textarea className="brand-input" rows={2} value={localizedString(item.quote, "en")} onChange={(e) => updateItem(idx, setLocalized(item, "quote", "en", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Author</span>
                  <input className="brand-input" value={localizedString(item.author, "en")} onChange={(e) => updateItem(idx, setLocalized(item, "author", "en", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Author role</span>
                  <input className="brand-input" value={localizedString(item.authorRole, "en")} onChange={(e) => updateItem(idx, setLocalized(item, "authorRole", "en", e.target.value))} />
                </label>
              </div>
            </div>

            <div className="brand-panel p-3">
              <LanguageLegend language="fr" isPrimary={false} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Quote</span>
                  <textarea className="brand-input" rows={2} value={localizedString(item.quote, "fr")} onChange={(e) => updateItem(idx, setLocalized(item, "quote", "fr", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Author</span>
                  <input className="brand-input" value={localizedString(item.author, "fr")} onChange={(e) => updateItem(idx, setLocalized(item, "author", "fr", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Author role</span>
                  <input className="brand-input" value={localizedString(item.authorRole, "fr")} onChange={(e) => updateItem(idx, setLocalized(item, "authorRole", "fr", e.target.value))} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <AdminImagePicker label="Author image" value={String(item.image ?? "")} compact onChange={(v) => updateItem(idx, { ...(item as object), image: v })} />
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-outline" onClick={() => removeItem(idx)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addItem}>
          Add testimonial
        </button>
      </div>
    </div>
  );
}

function LearningExpForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const cards = Array.isArray(c.cards) ? (c.cards as Array<Record<string, unknown>>) : [];

  const updateCard = (idx: number, next: Record<string, unknown>) => onUpdate({ ...c, cards: cards.map((it, i) => (i === idx ? next : it)) });
  const addCard = () => onUpdate({ ...c, cards: [...cards, { title: { en: "", fr: "" }, desc: { en: "", fr: "" }, image: "" }] });
  const removeCard = (idx: number) => onUpdate({ ...c, cards: cards.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      {cards.map((card, idx) => (
        <div key={idx} className="grid gap-3 rounded-md border border-slate-100 p-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="brand-panel p-3">
              <LanguageLegend language="en" isPrimary={true} />
              <div className="mt-3 grid gap-2">
                <input className="brand-input" placeholder="Title" value={localizedString(card.title, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "en", e.target.value))} />
                <input className="brand-input" placeholder="Description" value={localizedString(card.desc, "en")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "en", e.target.value))} />
              </div>
            </div>

            <div className="brand-panel p-3">
              <LanguageLegend language="fr" isPrimary={false} />
              <div className="mt-3 grid gap-2">
                <input className="brand-input" placeholder="Title" value={localizedString(card.title, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "title", "fr", e.target.value))} />
                <input className="brand-input" placeholder="Description" value={localizedString(card.desc, "fr")} onChange={(e) => updateCard(idx, setLocalized(card, "desc", "fr", e.target.value))} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <AdminImagePicker label="Image" value={String(card.image ?? "")} compact onChange={(v) => updateCard(idx, { ...(card as object), image: v })} />
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-outline" onClick={() => removeCard(idx)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addCard}>
          Add card
        </button>
      </div>
    </div>
  );
}

function NewsAnnouncementsForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const items = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : [];

  const updateItem = (idx: number, next: Record<string, unknown>) => {
    const nextItems = items.slice();
    nextItems[idx] = next;
    onUpdate({ ...c, items: nextItems });
  };
  const addItem = () => onUpdate({ ...c, items: [...items, { title: { en: "", fr: "" }, excerpt: { en: "", fr: "" }, image: "", date: "", tag: "" }] });
  const removeItem = (idx: number) => onUpdate({ ...c, items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="grid gap-3 rounded-md border border-slate-100 p-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="brand-panel p-3">
              <LanguageLegend language="en" isPrimary={true} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input className="brand-input" value={localizedString(it.title, "en")} onChange={(e) => updateItem(idx, setLocalized(it, "title", "en", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Excerpt</span>
                  <textarea className="brand-input" rows={2} value={localizedString(it.excerpt, "en")} onChange={(e) => updateItem(idx, setLocalized(it, "excerpt", "en", e.target.value))} />
                </label>
              </div>
            </div>

            <div className="brand-panel p-3">
              <LanguageLegend language="fr" isPrimary={false} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input className="brand-input" value={localizedString(it.title, "fr")} onChange={(e) => updateItem(idx, setLocalized(it, "title", "fr", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Excerpt</span>
                  <textarea className="brand-input" rows={2} value={localizedString(it.excerpt, "fr")} onChange={(e) => updateItem(idx, setLocalized(it, "excerpt", "fr", e.target.value))} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <AdminImagePicker label="Image" value={String(it.image ?? "")} compact onChange={(v) => updateItem(idx, { ...(it as object), image: v })} />
            </div>
            <label className="grid gap-1.5">
              <span className="brand-label">Date</span>
              <input type="date" className="brand-input" value={String(it.date ?? "")} onChange={(e) => updateItem(idx, { ...(it as object), date: e.target.value })} />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Tag</span>
              <input className="brand-input" value={String(it.tag ?? "")} onChange={(e) => updateItem(idx, { ...(it as object), tag: e.target.value })} />
            </label>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-outline" onClick={() => removeItem(idx)}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addItem}>
          Add item
        </button>
      </div>
    </div>
  );
}

function FeaturedStoriesForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const items = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : [];

  const updateItem = (idx: number, next: Record<string, unknown>) => {
    const nextItems = items.slice();
    nextItems[idx] = next;
    onUpdate({ ...c, items: nextItems });
  };

  const addItem = () => onUpdate({ ...c, items: [...items, { title: { en: "", fr: "" }, excerpt: { en: "", fr: "" }, image: "", href: "" }] });
  const removeItem = (idx: number) => onUpdate({ ...c, items: items.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {items.map((it, idx) => (
        <div key={idx} className="grid gap-3 rounded-md border border-slate-100 p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="brand-panel p-3">
              <LanguageLegend language="en" isPrimary={true} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input className="brand-input" value={localizedString(it.title, "en")} onChange={(e) => updateItem(idx, setLocalized(it, "title", "en", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Excerpt</span>
                  <textarea className="brand-input" rows={2} value={localizedString(it.excerpt, "en")} onChange={(e) => updateItem(idx, setLocalized(it, "excerpt", "en", e.target.value))} />
                </label>
              </div>
            </div>

            <div className="brand-panel p-3">
              <LanguageLegend language="fr" isPrimary={false} />
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Title</span>
                  <input className="brand-input" value={localizedString(it.title, "fr")} onChange={(e) => updateItem(idx, setLocalized(it, "title", "fr", e.target.value))} />
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">Excerpt</span>
                  <textarea className="brand-input" rows={2} value={localizedString(it.excerpt, "fr")} onChange={(e) => updateItem(idx, setLocalized(it, "excerpt", "fr", e.target.value))} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <AdminImagePicker label="Image" value={String(it.image ?? "")} compact onChange={(v) => updateItem(idx, { ...(it as object), image: v })} />
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-outline" onClick={() => removeItem(idx)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      <div>
        <button type="button" className="btn-brand-secondary w-fit px-4 py-2 text-sm font-semibold rounded-md shadow-sm" onClick={addItem}>
          Add story
        </button>
      </div>
    </div>
  );
}
