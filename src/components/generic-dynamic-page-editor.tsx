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

async function uploadAdminImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: formData });
  const raw = await res.text();
  const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  if (!res.ok) throw new Error(typeof parsed.error === "string" ? parsed.error : "Upload failed.");
  const publicUrl = typeof parsed.publicUrl === "string" ? parsed.publicUrl : "";
  const storageKey = typeof parsed.storageKey === "string" ? parsed.storageKey : "";
  if (!publicUrl || !storageKey) throw new Error("Upload failed: missing publicUrl or storageKey.");
  return { publicUrl, storageKey };
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

function createDraftDynamicPage(slug: string): DynamicPage {
  return {
    id: "",
    slug,
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Page`,
    published: false,
    sections: [
      {
        sectionKey: "hero",
        componentType: "BannerSection",
        position: 0,
        content: { sourceLanguage: "en", translations: { en: { title: "Welcome", description: "..." }, fr: { title: "Welcome", description: "..." } } },
      },
      {
        sectionKey: "cta",
        componentType: "CtaSection",
        position: 1,
        content: { sourceLanguage: "en", translations: { en: { title: "Get Started", desc: "..." }, fr: { title: "Get Started", desc: "..." } } },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const languageLabelFallback = (language: Language) => language === "fr" ? "French" : "English";

function LanguageLegend({ language, isPrimary }: { language: Language; isPrimary: boolean; }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[#0b3e81]">{languageLabelFallback(language)} version</span>
      {isPrimary ? <span className="rounded-full border border-[#b8d3f6] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f518f]">Primary</span> : null}
    </div>
  );
}

function apiErrorMessage(parsed: Record<string, unknown>, fallback: string) {
  const message = typeof parsed.error === "string" ? parsed.error : fallback;
  return message; // Simplified
}

export default function GenericDynamicPageEditor({ slug, draft: initialDraft }: { slug: string; draft: DynamicPage; }) {
  const [page, setPage] = useState<DynamicPage | null>(initialDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages/${slug}`);
      if (res.ok) {
        const data = await res.json() as DynamicPage;
        const hasSections = Array.isArray(data?.sections) && data.sections.length > 0;
        if (!hasSections) {
          const newDraft = createDraftDynamicPage(slug);
          setPage({ ...data, sections: newDraft.sections });
          return;
        }
        setPage(data);
        return;
      }
      if (res.status === 404) {
        setPage(createDraftDynamicPage(slug));
        return;
      }
      const raw = await res.text();
      const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      setError(apiErrorMessage(parsed, "Failed to load page."));
      setPage(createDraftDynamicPage(slug));
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load page.");
      setPage(createDraftDynamicPage(slug));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      if (res.ok) {
        const updated = await res.json();
        setPage(updated);
      } else {
        const raw = await res.text();
        const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        setError(apiErrorMessage(parsed, "Failed to save."));
      }
    } catch (err) {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const updateSectionContent = (sectionId: string | undefined, sectionKey: string, newContent: JsonObject) => {
    setPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((section) => 
          (sectionId && section.id === sectionId) || (!sectionId && section.sectionKey === sectionKey)
            ? { ...section, content: newContent }
            : section
        ),
      };
    });
  };

  if (loading) return <section className="brand-card p-6"><p>Loading {slug} page…</p></section>;

  return (
    <section className="space-y-6">
      <header className="brand-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="brand-title text-2xl font-black">{slug} Editor</h3>
          <p className="brand-muted text-sm">Manage content.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={fetchPage} disabled={loading} className="btn-brand-secondary px-4 py-2 text-sm disabled:opacity-60">Refresh</button>
          <button type="button" onClick={handleSave} disabled={saving || !page} className="btn-brand-primary px-5 py-2.5 text-sm disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {error ? <section className="brand-card border-red-200 bg-red-50 p-4"><p className="text-red-700 font-semibold">{error}</p></section> : null}

      {page ? (
        <>
          <section className="brand-card p-6">
            <h4 className="brand-title text-xl font-black">Settings</h4>
            <div className="grid gap-4 mt-4">
              <label className="grid gap-1.5">
                <span className="brand-label">Title</span>
                <input type="text" value={page.title} onChange={(e) => setPage({...page, title: e.target.value})} className="brand-input" />
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={page.published} onChange={(e) => setPage({...page, published: e.target.checked})} />
                <span>Published</span>
              </label>
            </div>
          </section>
          <section className="space-y-6">
            {page.sections.sort((a, b) => a.position - b.position).map((section) => (
              <section key={section.id || section.sectionKey} className="brand-card p-6">
                <div className="mb-6 flex justify-between items-center">
                  <h3 className="text-2xl font-black">{section.componentType} ({section.sectionKey})</h3>
                  <span>Pos {section.position}</span>
                </div>
                <pre className="bg-slate-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-auto">
                  {JSON.stringify(section.content, null, 2)}
                </pre>
                {/* Fallback JSON editor */}
                <textarea
                  value={JSON.stringify(section.content, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateSectionContent(section.id, section.sectionKey, parsed);
                    } catch {}
                  }}
                  className="brand-input w-full mt-4 p-3 font-mono text-sm"
                  rows={10}
                  placeholder="Edit JSON content here..."
                />
              </section>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
