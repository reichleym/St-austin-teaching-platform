"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { supportedLanguages, type Language } from "@/lib/i18n";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
      {
        sectionKey: "explore",
        componentType: "ExplorePrograms",
        position: 1,
        content: {
          title: "Explore Programs",
          degreeLevel: "",
          fieldOfStudy: "",
        },
      },
      {
        sectionKey: "featuredPrograms",
        componentType: "FeaturedPrograms",
        position: 2,
        content: {},
      },
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
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 5,
        content: {
          title: "Ready to Start?",
          description: "Apply today or request more information.",
          button: { label: "Apply Now", href: "/apply" },
        },
      },
      {
        sectionKey: "footer",
        componentType: "Footer",
        position: 6,
        content: {},
      },
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
    FeaturedPrograms: { label: "Featured Programs", description: "Highlight a small selection of programs." },
    FeaturedStories: { label: "Featured Stories", description: "Stories or testimonials." },
    WhyAustin: { label: "Why Choose Us", description: "Short reasons to choose the university." },
    CtaSection: { label: "Call to Action", description: "Full-width CTA with button." },
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
      {section.componentType === "CtaSection" && <CtaForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "WhyAustin" && <WhyAustinForm content={section.content} onUpdate={onUpdate} />}
      {section.componentType === "FeaturedPrograms" && <div className="text-sm text-gray-600">No visual editor for Featured Programs (edit raw JSON below).</div>}
      {section.componentType === "FeaturedStories" && <div className="text-sm text-gray-600">No visual editor for Featured Stories (edit raw JSON below).</div>}
      {section.componentType === "Footer" && <div className="text-sm text-gray-600">Footer content managed elsewhere.</div>}

      {/* Raw JSON fallback */}
      <div className="mt-4">
        <label className="block text-sm font-medium">Raw content (JSON)</label>
        <textarea
          className="w-full font-mono p-2 border rounded mt-2"
          rows={6}
          value={JSON.stringify(section.content ?? {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onUpdate(parsed);
            } catch {
              // ignore parse errors while typing
            }
          }}
        />
      </div>
    </section>
  );
}

function HeroForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const title = typeof c.title === "string" ? c.title : "";
  const description = typeof c.description === "string" ? c.description : "";
  const bgImg = typeof c.bgImg === "string" ? c.bgImg : "";

  return (
    <div className="space-y-4">
      <label className="grid gap-1.5">
        <span className="brand-label">Title</span>
        <input className="brand-input" value={title} onChange={(e) => onUpdate({ ...c, title: e.target.value })} />
      </label>
      <label className="grid gap-1.5">
        <span className="brand-label">Description</span>
        <textarea className="brand-input" rows={3} value={description} onChange={(e) => onUpdate({ ...c, description: e.target.value })} />
      </label>
      <AdminImagePicker label="Background Image" value={bgImg} onChange={(v) => onUpdate({ ...c, bgImg: v })} />
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
  const title = typeof c.title === "string" ? c.title : "";
  const description = typeof c.description === "string" ? c.description : "";
  const button = typeof c.button === "object" && c.button ? (c.button as Record<string, unknown>) : {};
  const label = typeof button.label === "string" ? button.label : "";
  const href = typeof button.href === "string" ? button.href : "";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="brand-label">Title</span>
        <input className="brand-input" value={title} onChange={(e) => onUpdate({ ...c, title: e.target.value })} />
      </label>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="brand-label">Description</span>
        <textarea className="brand-input" rows={3} value={description} onChange={(e) => onUpdate({ ...c, description: e.target.value })} />
      </label>
      <label className="grid gap-1.5">
        <span className="brand-label">Button label</span>
        <input className="brand-input" value={label} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), label: e.target.value } })} />
      </label>
      <label className="grid gap-1.5">
        <span className="brand-label">Button href</span>
        <input className="brand-input" value={href} onChange={(e) => onUpdate({ ...c, button: { ...(c.button as object), href: e.target.value } })} />
      </label>
    </div>
  );
}

function WhyAustinForm({ content, onUpdate }: { content: unknown; onUpdate: (content: JsonObject) => void }) {
  const c = isJsonObject(content) ? content : {};
  const title = typeof c.title === "string" ? c.title : "";
  const whyAustinDesc = typeof c.whyAustinDesc === "string" ? c.whyAustinDesc : "";

  return (
    <div className="space-y-3">
      <label className="grid gap-1.5">
        <span className="brand-label">Title</span>
        <input className="brand-input" value={title} onChange={(e) => onUpdate({ ...c, title: e.target.value })} />
      </label>
      <label className="grid gap-1.5">
        <span className="brand-label">Description</span>
        <textarea className="brand-input" rows={3} value={whyAustinDesc} onChange={(e) => onUpdate({ ...c, whyAustinDesc: e.target.value })} />
      </label>
    </div>
  );
}

