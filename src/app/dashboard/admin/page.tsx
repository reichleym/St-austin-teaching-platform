import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const roleText = String(session.user.role);
  if (roleText !== "SUPER_ADMIN" && roleText !== "ADMIN") {
    redirect("/dashboard/student");
  }

  redirect("/dashboard?module=overview");
}
