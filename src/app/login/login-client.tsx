"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getStudentSelfSignupCutoffLabel, isStudentSelfSignupAllowed } from "@/lib/onboarding-policy";

type Props = {
  callbackUrl: string;
};

export default function LoginClient({ callbackUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const studentSignupCutoff = getStudentSelfSignupCutoffLabel();
  const studentSelfSignupAllowed = isStudentSelfSignupAllowed();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    const nativeSubmitEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeSubmitEvent.submitter as HTMLButtonElement | null;
    const loginAs = submitter?.value === "TEACHER" ? "TEACHER" : "STUDENT";
    const defaultRoleCallbackUrl = loginAs === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
    const targetCallbackUrl = callbackUrl === "/dashboard" ? defaultRoleCallbackUrl : callbackUrl;

    const result = await signIn("user-credentials", {
      email,
      password,
      loginAs,
      redirect: false,
      callbackUrl: targetCallbackUrl,
    });

    setIsPending(false);

    if (!result || result.error) {
      setError("Invalid credentials, inactive account, or incorrect user type.");
      return;
    }

    router.push(result.url ?? targetCallbackUrl);
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">Login</span>
        </div>
        <span className="brand-chip brand-chip-accent">
          <span className="brand-accent-dot" />
          Access Portal
        </span>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">Teacher & Student Login</h1>
        <p className="brand-muted mt-2 text-sm">Sign in as Teacher or Student.</p>
        <p className="mt-1 text-xs text-[#3768ac]">Super Admin login is available at /admin/login.</p>
        <p className="brand-muted mt-1 text-xs">
          Teachers are invite-only. Student self-signup is open until {studentSignupCutoff}.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-[#0f3a74]">Email</span>
            <input
              className="brand-input"
              type="email"
              name="email"
              required
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-[#0f3a74]">Password</span>
            <input
              className="brand-input"
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              className="btn-brand-secondary px-4 py-2 disabled:opacity-60"
              disabled={isPending}
              type="submit"
              name="loginAs"
              value="STUDENT"
            >
              {isPending ? "Signing in..." : "Sign in as Student"}
            </button>
            <button
              className="btn-brand-primary px-4 py-2 disabled:opacity-60"
              disabled={isPending}
              type="submit"
              name="loginAs"
              value="TEACHER"
            >
              {isPending ? "Signing in..." : "Sign in as Teacher"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm">
          {studentSelfSignupAllowed ? (
            <Link href="/register/student" className="font-semibold underline">
              Register as Student
            </Link>
          ) : (
            <p className="text-[#3768ac]">Student self-signup is closed. Please request an invite from Admin.</p>
          )}
        </div>
      </div>
    </main>
  );
}
