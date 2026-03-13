// src/app/dashboard/instructions/page.tsx
import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { InstructionTeacherInbox } from "@/components/instruction-teacher-inbox";
import { StudentInstructionEntry } from "@/components/student-instruction-entry";

export default async function InstructionsPage() {
  const session = await auth();
  console.log("session >>>>>>", session);

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/login");
  }

  const roleText = String(session.user.role);

  // Only students and staff use this page
  if (!["STUDENT", "TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"].includes(roleText)) {
    redirect("/dashboard/overview");
  }

  const isStudent = roleText === "STUDENT";
  const isStaff = ["TEACHER", "DEPARTMENT_HEAD", "SUPER_ADMIN"].includes(roleText);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <DashboardSidebar role={roleText} selectedSlug="instructions" />
      <div className="flex-1 space-y-6 p-6 lg:p-8">
        <DashboardTopbar name={session.user.name} email={session.user.email} role={roleText} />
        <main className="brand-glass brand-animate p-6">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {isStaff ? (
              <InstructionTeacherInbox
                currentUserId={session.user.id}
                currentUserRole={roleText}
              />
            ) : (
              <StudentInstructionEntry
                currentUserId={session.user.id}
                currentUserRole={roleText}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
