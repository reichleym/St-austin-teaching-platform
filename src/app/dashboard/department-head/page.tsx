import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DepartmentHeadDashboardEntryPage() {
  const session = await auth();

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/login");
  }

  const roleText = String(session.user.role);

  if (roleText === "SUPER_ADMIN" || roleText === "ADMIN") {
    redirect("/dashboard/admin");
  }

  if (roleText !== "DEPARTMENT_HEAD") {
    redirect("/dashboard");
  }

  redirect("/dashboard?module=overview");
}
