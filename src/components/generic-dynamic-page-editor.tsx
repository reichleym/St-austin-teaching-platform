"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type JsonObject = Record<string, unknown>;

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

export default function GenericDynamicPageEditor({
  slug,
  draft,
}: {
  slug: string;
  draft: DynamicPage;
}) {
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages/${slug}`);
      if (res.ok) {
        const data = (await res.json()) as DynamicPage;
        const hasSections = Array.isArray(data?.sections) && data.sections.length > 0;
        if (hasSections) {
          setPage(data);
          return;
        }
        setPage(draft);
        return;
      }
      if (res.status === 404) {
        setPage(draft);
        return;
      }
      const raw = await res.text();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      console.error("Failed to load page:", parsed);
    } catch (err) {
      console.error(err);
      setPage(draft);
    } finally {
      setLoading(false);
    }
  }, [slug, draft]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  if (loading) return (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#2e5f9e]">Loading page…</p></section>);

  if (!page) return (<section className="brand-card p-6"><p className="text-sm font-semibold text-[#083672]">Page data is unavailable.</p></section>);

  return (
    <section className="space-y-6">
      <header className="brand-card p-5">
        <h3 className="brand-title text-2xl font-black">{page.title}</h3>
        <p className="brand-muted text-sm">Generic editor for {slug}</p>
      </header>
      <section className="brand-card p-6">
        <p className="text-sm">Sections: {page.sections.length}</p>
      </section>
    </section>
  );
}
