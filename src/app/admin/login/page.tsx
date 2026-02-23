import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";
import AdminLoginClient from "./admin-login-client";

export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(getRoleHomePath(session.user.role));
  }

  return <AdminLoginClient />;
}
