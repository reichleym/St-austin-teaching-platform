import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { dashboardModules, type DashboardRole } from "@/lib/dashboard-modules";
import { EngagementDiscussionDetail } from "@/components/engagement-discussion-detail";
import { createServerTranslator } from "@/lib/i18n-server";
import Link from "next/link";

type EngagementDetailSearchParams = {
  courseId?: string;
};

type Props = {
  params: Promise<{ discussionId: string }>;
  searchParams?: Promise<EngagementDetailSearchParams>;
};

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const session = await auth();
  const t = await createServerTranslator();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  const moduleRoleKey = (roleKey === "ADMIN" ? "SUPER_ADMIN" : roleKey) as DashboardRole;
  const roleForModules = (roleKey === "SUPER_ADMIN" ||
  roleKey === "ADMIN" ||
  roleKey === "DEPARTMENT_HEAD" ||
  roleKey === "TEACHER" ||
  roleKey === "STUDENT"
    ? roleKey
    : "STUDENT") as "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT";

  const availableModules = dashboardModules.filter((item) => item.roles.includes(moduleRoleKey));
  const engagementModule = availableModules.find((item) => item.slug === "engagement");
  if (!engagementModule) {
    const fallbackSlug = (availableModules[0] ?? dashboardModules[0])?.slug ?? "overview";
    redirect(`/dashboard/${fallbackSlug}`);
  }

  const resolvedParams = await params;
  const resolvedSearchParams = (searchParams ? await searchParams : undefined) as
    | EngagementDetailSearchParams
    | undefined;

  const courseId = resolvedSearchParams?.courseId?.trim() || undefined;
  const engagementTitle = engagementModule
    ? t("module.engagement", undefined, engagementModule.title)
    : t("module.engagement");

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug="engagement" />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass flex items-center justify-between brand-animate overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                {t("activeModule")}
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{engagementTitle}</h2>
            </div>
          </div>

          <Link
                        href={`/dashboard/engagement`}
                        aria-label="Back to engagement"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                      </Link>
        </section>

        <EngagementDiscussionDetail
          role={roleForModules}
          discussionId={resolvedParams.discussionId}
          courseId={courseId}
        />
      </div>
    </main>
  );
}
