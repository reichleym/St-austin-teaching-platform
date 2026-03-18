import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { dashboardModules, type DashboardRole } from "@/lib/dashboard-modules";
import { EngagementDiscussionDetail } from "@/components/engagement-discussion-detail";

type EngagementDetailSearchParams = {
  courseId?: string;
};

type Props = {
  params: Promise<{ discussionId: string }>;
  searchParams?: Promise<EngagementDetailSearchParams>;
};

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const session = await auth();

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

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug="engagement" />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass brand-animate overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Active Module
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{engagementModule.title}</h2>
            </div>
          </div>
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
