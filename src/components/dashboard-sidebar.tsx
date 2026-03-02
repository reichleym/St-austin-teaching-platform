import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";
import { dashboardModules } from "@/lib/dashboard-modules";

type DashboardSidebarProps = {
  role: Role;
  selectedSlug: string;
};

export function DashboardSidebar({ role, selectedSlug }: DashboardSidebarProps) {
  const availableModules = dashboardModules.filter((item) => item.roles.includes(role));
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
      const active = item.slug === selectedSlug || hasSelectedDescendant(item.slug);
      const isTopLevel = depth === 0;

      return (
        <div key={item.slug} style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}>
          <Link
            href={item.href ?? `/dashboard?module=${item.slug}`}
            className={
              isTopLevel
                ? `brand-nav-link ${active ? "brand-nav-link-active !text-white" : ""}`
                : `brand-nav-sublink ${active ? "brand-nav-sublink-active !text-[#002f74]" : ""}`
            }
          >
            {item.title}
          </Link>
          {hasChildren ? <div className="mt-1 space-y-1">{renderTree(item.slug, depth + 1)}</div> : null}
        </div>
      );
    });
  };

  return (
    <aside className="brand-grid-bg sticky top-0 z-20 max-h-screen w-full overflow-y-auto border-b border-[#9bc4f6] bg-gradient-to-b from-[#e8f3ff] to-[#d9ebff] p-5 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="brand-glass p-3">
        <Image src="/logo/image.png" alt="St. Austin logo" width={188} height={92} className="mx-auto" priority />
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[#2b5699]">St. Austin</p>
      <h1 className="text-2xl font-semibold text-[#07316b]">Control Center</h1>
      <p className="mt-1 text-xs text-[#3b6aa5]">Navigate by role-specific modules</p>

      <p className="brand-section-title mt-6">Navigation</p>
      <nav className="mt-2 space-y-1">{renderTree(rootKey)}</nav>
    </aside>
  );
}
