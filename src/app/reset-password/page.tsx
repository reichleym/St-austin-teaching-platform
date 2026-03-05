import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";
import ResetPasswordClient from "./reset-password-client";

type Props = {
  searchParams: Promise<{ email?: string; token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user) {
    redirect(getRoleHomePath(session.user.role));
  }

  const params = await searchParams;
  return <ResetPasswordClient email={params.email ?? ""} token={params.token ?? ""} />;
}

