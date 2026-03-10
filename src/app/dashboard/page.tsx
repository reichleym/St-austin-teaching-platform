import type { PageProps } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dashboardModules, type DashboardRole } from "@/lib/dashboard-modules";

type DashboardSearchParams = {
  module?: string;
};

export default async function DashboardEntryPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const resolvedSearchParams = (searchParams ? await searchParams : undefined) as
    | DashboardSearchParams
    | undefined;
  const moduleParam = resolvedSearchParams?.module?.trim();
  if (moduleParam) {
    redirect(`/dashboard/${moduleParam}`);
  }

  const roleKey = String(session.user.role ?? "");
  const moduleRoleKey = (roleKey === "ADMIN" ? "SUPER_ADMIN" : roleKey) as DashboardRole;
  const availableModules = dashboardModules.filter((item) => item.roles.includes(moduleRoleKey));
  const defaultSlug = (availableModules[0] ?? dashboardModules[0])?.slug ?? "overview";

  redirect(`/dashboard/${defaultSlug}`);
}
