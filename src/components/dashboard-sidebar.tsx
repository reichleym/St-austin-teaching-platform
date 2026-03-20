"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { dashboardModules, type DashboardRole } from "@/lib/dashboard-modules";
import { useLanguage } from "@/components/language-provider";

type DashboardSidebarProps = {
  role: string;
  selectedSlug: string;
};

export function DashboardSidebar({ role, selectedSlug }: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();
  const roleKey = String(role) as DashboardRole;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(roleKey));
  const rootKey = "__root__";
  const modulesByParent = new Map<string, typeof availableModules>();

  for (const item of availableModules) {
    const key = item.parentSlug ?? rootKey;
    const group = modulesByParent.get(key) ?? [];
    group.push(item);
    modulesByParent.set(key, group);
  }

  const hasSelectedDescendant = (slug: string): boolean => {
    const children = modulesByParent.get(slug) ?? [];
    return children.some((item) => item.slug === selectedSlug || hasSelectedDescendant(item.slug));
  };

  const renderTree = (parentKey: string, depth = 0) => {
    const items = modulesByParent.get(parentKey) ?? [];
    return items.map((item) => {
      const hasChildren = (modulesByParent.get(item.slug) ?? []).length > 0;
      const firstChild = (modulesByParent.get(item.slug) ?? [])[0];
      const itemHref = hasChildren && firstChild ? firstChild.href ?? `/dashboard/${firstChild.slug}` : item.href ?? `/dashboard/${item.slug}`;
      const active = item.slug === selectedSlug || hasSelectedDescendant(item.slug);
      const isTopLevel = depth === 0;
      const isExpanded = expanded[item.slug] ?? active;

      return (
        <div key={item.slug} style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}>
          {(() => {
            const baseTitle =
              roleKey === "STUDENT" && item.slug === "courses"
                ? "All Courses"
                : roleKey === "STUDENT" && item.slug === "learning"
                  ? "My Learning"
                  : item.title;
            const translationKey =
              item.slug === "courses" && roleKey === "STUDENT"
                ? "module.courses.student"
                : item.slug === "learning" && roleKey === "STUDENT"
                  ? "module.learning.student"
                  : item.slug === "instructions" && roleKey === "STUDENT"
                    ? "module.instructions.student"
                    : item.slug === "instructions" && (roleKey === "TEACHER" || roleKey === "DEPARTMENT_HEAD")
                      ? "module.instructions.teacher"
                      : `module.${item.slug}`;
            const title = t(translationKey, undefined, baseTitle);
            return (
          <div className="flex items-center gap-2">
            <Link
              href={itemHref}
              className={`${isTopLevel ? "brand-nav-link" : "brand-nav-sublink"} flex-1 ${
                active
                  ? isTopLevel
                    ? "brand-nav-link-active !text-white"
                    : "brand-nav-sublink-active !text-[#002f74]"
                  : ""
              }`}
            >
              {title}
            </Link>
            {hasChildren ? (
              <button
                type="button"
                aria-label={t("toggleSubmenu", { name: title })}
                aria-expanded={isExpanded}
                onClick={() => setExpanded((prev) => ({ ...prev, [item.slug]: !isExpanded }))}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#0f3a74] transition ${
                  isTopLevel ? "hover:bg-[#cfe4ff]" : "hover:bg-[#dcedff]"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
          </div>
            );
          })()}
          {hasChildren && isExpanded ? (
            <div className="mt-1 space-y-1">{renderTree(item.slug, depth + 1)}</div>
          ) : null}
        </div>
      );
    });
  };

  return (
    <aside className="brand-grid-bg sticky top-0 z-30 w-full border-b border-[#9bc4f6] bg-[#e8f3ff] shadow-[0_8px_22px_rgba(0,59,143,0.12)] lg:max-h-screen lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:bg-gradient-to-b lg:from-[#e8f3ff] lg:to-[#d9ebff] lg:p-5 lg:shadow-none">
      <div className="flex items-center justify-between gap-3 p-4 lg:hidden">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#2b5699]">St. Austin</p>
          <h1 className="truncate text-lg font-semibold text-[#07316b]">{t("controlCenter")}</h1>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bc4f6] bg-white text-[#083672]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      <div className={`${mobileOpen ? "max-h-[80vh]" : "max-h-0"} overflow-hidden transition-all duration-300 lg:max-h-none lg:overflow-visible`}>
        <div className="px-4 pb-4 lg:px-0 lg:pb-0">
          <div className="brand-glass hidden p-3 lg:block">
            <Image src="/logo/image.png" alt="St. Austin logo" width={188} height={92} className="mx-auto" priority />
          </div>
          {/* <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#2b5699] lg:mt-4">St. Austin</p> */}
          {/* <h1 className="text-2xl font-semibold text-[#07316b]">{t("controlCenter")}</h1> */}
          {/* <p className="mt-1 text-xs text-[#3b6aa5]">{t("navigateByRole")}</p> */}

          {/* <p className="brand-section-title mt-6">{t("navigation")}</p> */}
          <nav className="mt-2 space-y-1">{renderTree(rootKey)}</nav>
        </div>
      </div>
    </aside>
  );
}
