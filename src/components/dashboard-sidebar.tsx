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
  const topLevelModules = availableModules.filter((item) => !item.parentSlug);
  const subModulesByParent = new Map(
    topLevelModules.map((parent) => [
      parent.slug,
      availableModules.filter((item) => item.parentSlug === parent.slug),
    ])
  );
  return (
    <aside className="brand-grid-bg w-full border-b border-[#9bc4f6] bg-gradient-to-b from-[#e8f3ff] to-[#d9ebff] p-5 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="brand-glass p-3">
        <Image src="/logo/image.png" alt="St. Austin logo" width={188} height={92} className="mx-auto" priority />
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[#2b5699]">St. Austin</p>
      <h1 className="text-2xl font-semibold text-[#07316b]">Control Center</h1>
      <p className="mt-1 text-xs text-[#3b6aa5]">Navigate by role-specific modules</p>

      <p className="brand-section-title mt-6">Navigation</p>
      <nav className="mt-2 space-y-1">
        {topLevelModules.map((item) => {
          const subModules = subModulesByParent.get(item.slug) ?? [];
          const hasActiveChild = subModules.some((subItem) => subItem.slug === selectedSlug);
          const active = item.slug === selectedSlug || hasActiveChild;
          return (
            <div key={item.slug}>
              <Link
                href={item.href ?? `/dashboard?module=${item.slug}`}
                className={`brand-nav-link ${active ? "brand-nav-link-active !text-white" : ""}`}
              >
                {item.title}
              </Link>
              {subModules.length ? (
                <div className="mt-1 space-y-1 pl-4">
                  {subModules.map((subItem) => {
                    const subActive = subItem.slug === selectedSlug;
                    return (
                      <Link
                        key={subItem.slug}
                        href={subItem.href ?? `/dashboard?module=${subItem.slug}`}
                        className={`brand-nav-sublink ${subActive ? "brand-nav-sublink-active !text-[#002f74]" : ""}`}
                      >
                        {subItem.title}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
