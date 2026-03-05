import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";
import ForgotPasswordClient from "./forgot-password-client";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect(getRoleHomePath(session.user.role));
  }

  return <ForgotPasswordClient />;
}

