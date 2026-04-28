"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";

interface PageSection {
  id?: string;
  sectionKey: string;
  componentType: string;
  position: number;
  content: Record<string, any>;
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

// Simple toast notification function
function showToast(message: string, type: "success" | "error" = "success") {
  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";
  const toast = document.createElement("div");
  toast.className = `fixed top-4 right-4 px-6 py-3 ${bgColor} text-white rounded-lg shadow-lg z-50`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export default function AdminDynamicPagesManager() {
  const { t } = useLanguage();
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<DynamicPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const res = await fetch("/api/admin/pages");
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      } else {
        showToast(t("dynamicPages.toast.loadFailed"), "error");
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
      showToast(t("dynamicPages.toast.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;

    try {
      const method = selectedPage.id ? "PUT" : "POST";
      const endpoint = selectedPage.id
        ? `/api/admin/pages/${selectedPage.slug}`
        : "/api/admin/pages";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedPage),
      });

      if (res.ok) {
        const updated = await res.json();
        setPages((prev) =>
          selectedPage.id
            ? prev.map((p) => (p.id === updated.id ? updated : p))
            : [...prev, updated]
        );
        setSelectedPage(null);
        setIsEditing(false);
        showToast(
          selectedPage.id
            ? t("dynamicPages.toast.updated", { title: updated.title })
            : t("dynamicPages.toast.created", { title: updated.title })
        );
      } else {
        showToast(t("dynamicPages.toast.saveFailed"), "error");
      }
    } catch (error) {
      console.error("Error saving page:", error);
      showToast(t("dynamicPages.toast.saveFailed"), "error");
    }
  };

  const handleDeletePage = async (pageId: string, slug: string) => {
    if (!confirm(t("dynamicPages.confirmDelete"))) return;

    try {
      const res = await fetch(`/api/admin/pages/${slug}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPages((prev) => prev.filter((p) => p.id !== pageId));
        setSelectedPage(null);
        showToast(t("dynamicPages.toast.deleted"));
      } else {
        showToast(t("dynamicPages.toast.deleteFailed"), "error");
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      showToast(t("dynamicPages.toast.deleteFailed"), "error");
    }
  };

  const addSection = () => {
    if (!selectedPage) return;
    const newSection: PageSection = {
      sectionKey: `section-${Date.now()}`,
      componentType: "CustomSection",
      position: selectedPage.sections.length,
      content: {},
    };
    setSelectedPage({
      ...selectedPage,
      sections: [...selectedPage.sections, newSection],
    });
  };

  const updateSection = (index: number, updatedSection: PageSection) => {
    if (!selectedPage) return;
    const newSections = [...selectedPage.sections];
    newSections[index] = updatedSection;
    setSelectedPage({ ...selectedPage, sections: newSections });
  };

  const removeSection = (index: number) => {
    if (!selectedPage) return;
    const newSections = selectedPage.sections.filter((_, i) => i !== index);
    setSelectedPage({ ...selectedPage, sections: newSections });
  };

  if (loading) {
    return <div className="p-6">{t("dynamicPages.loading")}</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t("dynamicPages.title")}</h1>
        <button
          onClick={() => {
            setSelectedPage({
              id: "",
              slug: "",
              title: "",
              published: false,
              sections: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            setIsEditing(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t("dynamicPages.createPage")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Pages List */}
        <div className="col-span-1 border rounded-lg p-4 bg-gray-50">
          <h2 className="text-lg font-semibold mb-4">{t("dynamicPages.pages")}</h2>
          <div className="space-y-2">
            {pages.map((page) => (
              <div
                key={page.id}
                className={`p-3 rounded cursor-pointer border transition ${
                  selectedPage?.id === page.id
                    ? "bg-blue-100 border-blue-500"
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => {
                  setSelectedPage(page);
                  setIsEditing(false);
                }}
              >
                <div className="font-medium">{page.title}</div>
                <div className="text-sm text-gray-500">{page.slug}</div>
                <div className="text-xs mt-1">
                  {page.published ? (
                    <span className="text-green-600">{t("dynamicPages.statusPublished")}</span>
                  ) : (
                    <span className="text-gray-500">{t("dynamicPages.statusDraft")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page Editor */}
        <div className="col-span-2">
          {selectedPage && isEditing ? (
            <div className="border rounded-lg p-6 bg-white">
              <h2 className="text-xl font-semibold mb-4">
                {selectedPage.id ? t("dynamicPages.editPage") : t("dynamicPages.createNewPage")}
              </h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("dynamicPages.pageTitle")}
                  </label>
                  <input
                    type="text"
                    value={selectedPage.title}
                    onChange={(e) =>
                      setSelectedPage({
                        ...selectedPage,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("dynamicPages.pageSlug")}
                  </label>
                  <input
                    type="text"
                    value={selectedPage.slug}
                    onChange={(e) =>
                      setSelectedPage({
                        ...selectedPage,
                        slug: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!!selectedPage.id}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedPage.published}
                    onChange={(e) =>
                      setSelectedPage({
                        ...selectedPage,
                        published: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <label className="text-sm font-medium">{t("dynamicPages.publishPage")}</label>
                </div>
              </div>

              {/* Sections Editor */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">{t("dynamicPages.sections")}</h3>
                  <button
                    onClick={addSection}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    {t("dynamicPages.addSection")}
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedPage.sections.map((section, index) => (
                    <div key={index} className="border rounded p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium mb-1">
                            {t("dynamicPages.sectionKey")}
                          </label>
                          <input
                            type="text"
                            value={section.sectionKey}
                            onChange={(e) =>
                              updateSection(index, {
                                ...section,
                                sectionKey: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">
                          {t("dynamicPages.componentType")}
                        </label>
                        <input
                          type="text"
                          value={section.componentType}
                          onChange={(e) =>
                            updateSection(index, {
                              ...section,
                              componentType: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">
                          {t("dynamicPages.contentJson")}
                        </label>
                        <textarea
                          value={JSON.stringify(section.content, null, 2)}
                          onChange={(e) => {
                            try {
                              const content = JSON.parse(e.target.value);
                              updateSection(index, {
                                ...section,
                                content,
                              });
                            } catch {
                              // Invalid JSON, keep typing
                            }
                          }}
                          className="w-full px-2 py-1 border rounded text-sm font-mono"
                          rows={6}
                        />
                      </div>

                      <button
                        onClick={() => removeSection(index)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        {t("dynamicPages.removeSection")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSavePage}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t("dynamicPages.savePage")}
                </button>
                <button
                  onClick={() => {
                    setSelectedPage(null);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  {t("action.cancel")}
                </button>
              </div>
            </div>
          ) : selectedPage ? (
            <div className="border rounded-lg p-6 bg-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">{selectedPage.title}</h2>
                  <p className="text-gray-600 text-sm">/{selectedPage.slug}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {t("dynamicPages.statusLabel")}:{" "}
                    {selectedPage.published ? (
                      <span className="text-green-600 font-medium">
                        {t("dynamicPages.statusPublished")}
                      </span>
                    ) : (
                      <span className="text-gray-600 font-medium">{t("dynamicPages.statusDraft")}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {t("action.edit")}
                  </button>
                  <button
                    onClick={() =>
                      handleDeletePage(selectedPage.id, selectedPage.slug)
                    }
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    {t("action.delete")}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">{t("dynamicPages.sections")}</h3>
                <div className="space-y-4">
                  {selectedPage.sections.map((section, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="font-medium text-blue-600">
                        {section.sectionKey}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t("dynamicPages.componentLabel")}: {section.componentType}
                      </div>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-40">
                        {JSON.stringify(section.content, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-gray-50 text-center text-gray-500">
              {t("dynamicPages.empty")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
