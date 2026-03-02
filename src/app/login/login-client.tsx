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

type LoginFailureCode =
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "INCORRECT_USER_TYPE"
  | "EMAIL_NOT_VERIFIED";

function getLoginErrorMessage(code: LoginFailureCode | string | undefined) {
  if (code === "INACTIVE_ACCOUNT") return "This account is inactive. Contact your administrator.";
  if (code === "INVALID_CREDENTIALS") return "Invalid email or password.";
  if (code === "INCORRECT_USER_TYPE") return "Incorrect user type selected.";
  if (code === "EMAIL_NOT_VERIFIED") return "Please verify your email before logging in.";
  return "Unable to sign in right now.";
}

export default function LoginClient({ callbackUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendInfo, setResendInfo] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [isResendPending, setIsResendPending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [activeLoginAs, setActiveLoginAs] = useState<"STUDENT" | "TEACHER" | null>(null);
  const studentSignupCutoff = getStudentSelfSignupCutoffLabel();
  const studentSelfSignupAllowed = isStudentSelfSignupAllowed();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    setError("");
    setResendError("");
    setResendInfo("");
    setPendingVerificationEmail("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    const nativeSubmitEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeSubmitEvent.submitter as HTMLButtonElement | null;
    const loginAs = submitter?.value === "TEACHER" ? "TEACHER" : "STUDENT";
    setActiveLoginAs(loginAs);
    const defaultRoleCallbackUrl = loginAs === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
    const targetCallbackUrl = callbackUrl === "/dashboard" ? defaultRoleCallbackUrl : callbackUrl;

    const precheck = await fetch("/api/auth/login-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, loginAs, audience: "USER" }),
    });
    const precheckRaw = await precheck.text();
    const precheckResult = precheckRaw ? (JSON.parse(precheckRaw) as { ok?: boolean; code?: LoginFailureCode }) : {};
    if (!precheck.ok || !precheckResult.ok) {
      setIsPending(false);
      setActiveLoginAs(null);
      if (precheckResult.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerificationEmail(String(email ?? ""));
      }
      setError(getLoginErrorMessage(precheckResult.code));
      return;
    }

    const result = await signIn("user-credentials", {
      email,
      password,
      loginAs,
      redirect: false,
      callbackUrl: targetCallbackUrl,
    });

    setIsPending(false);

    if (!result || result.error) {
      setActiveLoginAs(null);
      setError("Unable to sign in right now.");
      return;
    }

    router.push(result.url ?? targetCallbackUrl);
    router.refresh();
  };

  const onResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setResendError("");
    setResendInfo("");
    setIsResendPending(true);

    try {
      const response = await fetch("/api/auth/resend-student-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerificationEmail }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string; warning?: string; verifyUrl?: string }) : {};

      if (!response.ok) {
        setResendError(result.error ?? "Unable to resend verification email.");
        return;
      }

      const infoMessage = result.verifyUrl
        ? `Verification link generated: ${result.verifyUrl}`
        : "Verification email sent. Please check your inbox.";
      setResendInfo(result.warning ? `${infoMessage} ${result.warning}` : infoMessage);
    } catch {
      setResendError("Unable to resend verification email.");
    } finally {
      setIsResendPending(false);
    }
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
          {pendingVerificationEmail ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={onResendVerification}
                disabled={isResendPending}
                className="w-fit text-sm font-semibold text-[#1f518f] underline disabled:opacity-60"
              >
                {isResendPending ? "Resending..." : "Resend verification email"}
              </button>
              {resendError ? <p className="text-sm text-red-600">{resendError}</p> : null}
              {resendInfo ? <p className="text-sm text-emerald-700">{resendInfo}</p> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              className="btn-brand-secondary px-4 py-2 disabled:opacity-60"
              disabled={isPending && activeLoginAs === "STUDENT"}
              type="submit"
              name="loginAs"
              value="STUDENT"
            >
              {isPending && activeLoginAs === "STUDENT" ? "Signing in..." : "Sign in as Student"}
            </button>
            <button
              className="btn-brand-primary px-4 py-2 disabled:opacity-60"
              disabled={isPending && activeLoginAs === "TEACHER"}
              type="submit"
              name="loginAs"
              value="TEACHER"
            >
              {isPending && activeLoginAs === "TEACHER" ? "Signing in..." : "Sign in as Teacher"}
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
