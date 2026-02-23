import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleHomePath } from "@/lib/role-routing";
import LoginClient from "./login-client";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user) {
    redirect(getRoleHomePath(session.user.role));
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard/student";

  return <LoginClient callbackUrl={callbackUrl} />;
}
