import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { dashboardModules } from "@/lib/dashboard-modules";

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

  return (
    <main className="min-h-screen bg-neutral-50 lg:flex">
      <aside className="w-full border-b border-neutral-200 bg-white p-5 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <p className="text-xs uppercase tracking-wide text-neutral-500">St. Austin</p>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 truncate text-sm text-neutral-700">{session.user.email}</p>
        <p className="text-xs font-medium text-neutral-600">{session.user.role}</p>

        <nav className="mt-6 space-y-1">
          {availableModules.map((item) => {
            const active = item.slug === selected.slug;
            return (
              <Link
                key={item.slug}
                href={`/dashboard?module=${item.slug}`}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 p-6 lg:p-8">
        <section className="rounded-xl border border-neutral-200 bg-white p-6">
          <p className="text-sm uppercase tracking-wide text-neutral-500">Module</p>
          <h2 className="mt-1 text-3xl font-semibold">{selected.title}</h2>
          <p className="mt-3 text-neutral-700">{selected.description}</p>
        </section>

        <section className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-lg font-medium">Module content not built yet.</p>
          <p className="mt-2 text-sm text-neutral-600">Menu and access rules are finalized by role.</p>
        </section>
      </div>
    </main>
  );
}
