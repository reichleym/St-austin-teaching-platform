import { redirect } from "next/navigation";
import { UserStatus } from "@prisma/client";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { auth } from "@/lib/auth";
import { InvitationsClient } from "./invitations-client";

export default async function AdminInvitationsPage() {
  const session = await auth();

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/admin/login");
  }

  const roleText = String(session.user.role);
  if (roleText !== "SUPER_ADMIN" && roleText !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={session.user.role} selectedSlug="invitations" />
      <div className="flex-1 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={session.user.role} />

        <section className="brand-glass brand-animate p-6">
          <InvitationsClient />
        </section>
      </div>
    </main>
  );
}
