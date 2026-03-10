import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/permissions";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { EnrollmentRequestsPanel } from "@/components/enrollment-requests-panel";

export default async function EnrollmentRequestsPage() {
  const session = await auth();

  if (!session?.user || session.user.status !== "ACTIVE") {
    redirect("/login");
  }

  const roleKey = String(session.user.role ?? "");
  if (!isSuperAdminRole(roleKey)) {
    redirect("/dashboard/courses");
  }

  return (
    <main className="min-h-screen lg:flex">
      <DashboardSidebar role={roleKey} selectedSlug="courses" />
      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleKey} />

        <section className="brand-glass brand-animate p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="brand-chip">
                <span className="brand-accent-dot" />
                Enrollment Requests
              </span>
              <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-black">Course Enrollment Requests</h1>
              <p className="brand-muted mt-2 text-sm">Approve or reject student enrollment requests.</p>
            </div>
            <Link
              href="/dashboard/courses"
              aria-label="Back to courses"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#9bbfed] bg-white text-[#1f518f] shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        </section>

        <EnrollmentRequestsPanel />
      </div>
    </main>
  );
}
