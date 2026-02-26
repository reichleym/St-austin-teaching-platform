import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { auth } from "@/lib/auth";
import { InvitationsClient } from "./invitations-client";

type Props = {
  searchParams: Promise<{ role?: string }>;
};

export default async function AdminInvitationsPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/admin/login");
  }

  const roleText = String(session.user.role);
  if (roleText !== "SUPER_ADMIN" && roleText !== "ADMIN") {
    redirect("/dashboard");
  }

  const initialRole = params.role === "STUDENT" ? "STUDENT" : "TEACHER";

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={session.user.role} selectedSlug="invitations" />
      <div className="flex-1 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={session.user.role} />

        <section className="brand-glass brand-animate p-6">
          <InvitationsClient initialRole={initialRole} />
        </section>
      </div>
    </main>
  );
}
