import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { dashboardModules } from "@/lib/dashboard-modules";
import { RoleOverview } from "@/components/role-overview";

type Props = {
  searchParams: Promise<{ module?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const params = await searchParams;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(session.user.role));
  const selected =
    availableModules.find((item) => item.slug === params.module) ?? availableModules[0] ?? dashboardModules[0];
  const roleModules = availableModules.length;

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={session.user.role} selectedSlug={selected.slug} />

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={session.user.role} />

        <section className="brand-glass brand-animate overflow-hidden p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Active Module
              </span>
              <h2 className="brand-title brand-title-gradient mt-3 text-4xl font-black">{selected.title}</h2>
            </div>
            <div className="brand-accent-card min-w-[170px] px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-[#3f6fae]">Access Scope</p>
              <p className="mt-2 text-3xl font-bold text-[#916900]">{roleModules}</p>
              <p className="text-xs text-[#3a689f]">modules for your role</p>
            </div>
          </div>
        </section>

        {selected.slug === "overview" ? (
          <RoleOverview role={session.user.role} name={session.user.name} />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article className="brand-card p-5">
                <p className="brand-section-title">Workspace</p>
                <p className="mt-2 text-2xl font-bold text-[#0b3e81]">{session.user.role}</p>
                <p className="brand-muted mt-1 text-sm">Your tools are filtered to match your access level.</p>
              </article>
              <article className="brand-card p-5">
                <p className="brand-section-title">System State</p>
                <p className="mt-2 text-2xl font-bold text-[#0b3e81]">Ready</p>
                <p className="brand-muted mt-1 text-sm">Core modules loaded, access policies active.</p>
              </article>
              <article className="brand-card p-5 md:col-span-2 lg:col-span-1">
                <p className="brand-section-title">Quick Tip</p>
                <p className="mt-2 text-lg font-bold text-[#0b3e81]">Use left menu shortcuts</p>
                <p className="brand-muted mt-1 text-sm">Submenus under Admin help you move faster between controls.</p>
              </article>
            </section>

            <section className="brand-card p-8 text-center">
              <p className="text-lg font-semibold text-[#0a3d7f]">Module content is being finalized.</p>
              <p className="brand-muted mt-2 text-sm">
                Navigation and permissions are live. This area is ready for feature rollout next.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
