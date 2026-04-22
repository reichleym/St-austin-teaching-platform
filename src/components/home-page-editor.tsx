"use client";

import { useEffect, useState } from "react";

export default function HomePageEditor() {
  const [page, setPage] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/home-page");
      const parsed = await res.json();
      if (!res.ok) {
        setError(parsed.error || "Unable to load home.json");
        return;
      }
      setPage(parsed.page);
      setRawJson(JSON.stringify(parsed.page, null, 2));
    } catch (e) {
      setError("Unable to load home.json");
    }
  }

  async function saveRaw() {
    setError("");
    setSaving(true);
    try {
      const parsed = JSON.parse(rawJson);
      const res = await fetch("/api/admin/home-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Unable to save");
        return;
      }
      await load();
    } catch (e) {
      setError("Invalid JSON or save failed.");
    } finally {
      setSaving(false);
    }
  }

  function updateExploreField(key: string, value: string) {
    if (!page) return;
    const next = { ...page };
    if (!Array.isArray(next.sections)) next.sections = [];
    const explore = next.sections.find((s: any) => s.sectionKey === "explore");
    if (!explore) return;
    explore.content = explore.content || {};
    explore.content[key] = value;
    setPage(next);
    setRawJson(JSON.stringify(next, null, 2));
  }

  if (!page) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Home Page Editor</h2>
        {error ? <p className="text-sm text-red-700">{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  const explore = (page.sections || []).find((s: any) => s.sectionKey === "explore");
  const degreeLevel = explore?.content?.degreeLevel ?? "";
  const fieldOfStudy = explore?.content?.fieldOfStudy ?? "";

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-2xl font-semibold mb-4">Home Page Editor</h2>
      <div className="mb-4">
        <h3 className="font-medium">Explore Section</h3>
        <label className="block mt-2">
          <span className="text-sm">Degree Level</span>
          <input className="brand-input mt-1" value={degreeLevel} onChange={(e) => updateExploreField("degreeLevel", e.currentTarget.value)} />
        </label>
        <label className="block mt-2">
          <span className="text-sm">Field of Study</span>
          <input className="brand-input mt-1" value={fieldOfStudy} onChange={(e) => updateExploreField("fieldOfStudy", e.currentTarget.value)} />
        </label>
      </div>

      <div className="mb-4">
        <h3 className="font-medium">Raw JSON</h3>
        <textarea className="w-full font-mono p-2 border rounded mt-2" rows={18} value={rawJson} onChange={(e) => setRawJson(e.currentTarget.value)} />
      </div>

      {error ? <p className="text-sm text-red-700 mb-2">{error}</p> : null}

      <div className="flex gap-2">
        <button className="btn-brand-primary px-4 py-2" onClick={saveRaw} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          className="rounded-md border px-4 py-2"
          onClick={() => {
            setRawJson(JSON.stringify(page, null, 2));
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
