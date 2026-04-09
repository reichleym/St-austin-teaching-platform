"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { PasswordField } from "@/components/password-field";
import { ToastMessage } from "@/components/toast-message";
import { useLanguage } from "@/components/language-provider";

type Props = {
  callbackUrl: string;
};

type LoginFailureCode =
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "INCORRECT_USER_TYPE"
  | "EMAIL_NOT_VERIFIED";

export default function LoginClient({ callbackUrl }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendInfo, setResendInfo] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [isResendPending, setIsResendPending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [activeLoginAs, setActiveLoginAs] = useState<"STUDENT" | "TEACHER" | "DEPARTMENT_HEAD" | null>(null);
  const [selectedLoginAs, setSelectedLoginAs] = useState<"STUDENT" | "TEACHER" | "DEPARTMENT_HEAD">("STUDENT");
  const getLoginErrorMessage = (code: LoginFailureCode | string | undefined) => {
    if (code === "INACTIVE_ACCOUNT") return t("login.errorInactive");
    if (code === "INVALID_CREDENTIALS") return t("login.errorInvalidCredentials");
    if (code === "INCORRECT_USER_TYPE") return t("login.errorIncorrectUserType");
    if (code === "EMAIL_NOT_VERIFIED") return t("login.errorEmailNotVerified");
    return t("login.errorGeneric");
  };

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
    const submitterValue = submitter?.getAttribute("data-role") || submitter?.value;
    const loginAs =
      submitterValue === "DEPARTMENT_HEAD"
        ? "DEPARTMENT_HEAD"
        : submitterValue === "TEACHER"
          ? "TEACHER"
          : submitterValue === "STUDENT"
            ? "STUDENT"
            : selectedLoginAs;
    setActiveLoginAs(loginAs);
    const defaultRoleCallbackUrl =
      loginAs === "DEPARTMENT_HEAD" ? "/dashboard/department-head" : loginAs === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student";
    const targetCallbackUrl = callbackUrl === "/dashboard" ? defaultRoleCallbackUrl : callbackUrl;

    const precheck = await fetch("/api/auth/login-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, loginAs, audience: "USER" }),
    });
    const precheckRaw = await precheck.text();
    const precheckResult = precheckRaw
      ? (JSON.parse(precheckRaw) as { ok?: boolean; code?: LoginFailureCode; email?: string })
      : {};
    if (!precheck.ok || !precheckResult.ok) {
      setIsPending(false);
      setActiveLoginAs(null);
      if (precheckResult.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerificationEmail(precheckResult.email ?? String(email ?? ""));
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
      setError(t("login.errorGeneric"));
      return;
    }

    toast.success(t("login.success"));
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
        setResendError(result.error ?? t("login.errorResendVerification"));
        return;
      }

      const infoMessage = result.verifyUrl
        ? t("login.infoVerificationGenerated", { url: result.verifyUrl })
        : t("login.infoVerificationSent");
      setResendInfo(result.warning ? `${infoMessage} ${result.warning}` : infoMessage);
    } catch {
      setResendError(t("login.errorResendVerification"));
    } finally {
      setIsResendPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">{t("login.badge")}</span>
        </div>
        <span className="brand-chip brand-chip-accent">
          <span className="brand-accent-dot" />
          {t("login.accessPortal")}
        </span>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">{t("login.title")}</h1>
        <p className="brand-muted mt-2 text-sm">{t("login.subtitle")}</p>
        <p className="mt-1 text-xs text-[#3768ac]">{t("login.adminHint")}</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-[#0f3a74]">{t("label.email", undefined, "Email")}</span>
            <input
              className="brand-input"
              type="text"
              name="email"
              required
              autoComplete="username"
            />
          </label>

          <PasswordField
            label={t("password")}
            name="password"
            required
            autoComplete="current-password"
          />
          <div className="-mt-2 text-right">
            <Link href="/forgot-password" className="text-xs font-semibold text-[#1f518f] underline">
              {t("login.forgotPassword")}
            </Link>
          </div>

          <ToastMessage type="error" message={error} />
          {pendingVerificationEmail ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={onResendVerification}
                disabled={isResendPending}
                className="w-fit text-sm font-semibold text-[#1f518f] underline disabled:opacity-60"
              >
                {isResendPending ? t("login.resending") : t("login.resendVerification")}
              </button>
              <ToastMessage type="error" message={resendError} />
              <ToastMessage type="success" message={resendInfo} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              className="btn-brand-secondary w-full px-4 py-3 text-center text-sm font-semibold leading-tight disabled:opacity-60"
              disabled={isPending && activeLoginAs === "STUDENT"}
              type="submit"
              name="loginAs"
              value="STUDENT"
              data-role="STUDENT"
              onClick={() => setSelectedLoginAs("STUDENT")}
            >
              {isPending && activeLoginAs === "STUDENT" ? (
                t("login.signingIn")
              ) : (
                <>
                  <span className="block text-[10px] uppercase tracking-[0.2em] opacity-80">{t("login.signInAs")}</span>
                  <span className="block text-sm font-semibold">{t("role.student")}</span>
                </>
              )}
            </button>
            <button
              className="btn-brand-secondary w-full px-4 py-3 text-center text-sm font-semibold leading-tight disabled:opacity-60"
              disabled={isPending && activeLoginAs === "DEPARTMENT_HEAD"}
              type="submit"
              name="loginAs"
              value="DEPARTMENT_HEAD"
              data-role="DEPARTMENT_HEAD"
              onClick={() => setSelectedLoginAs("DEPARTMENT_HEAD")}
            >
              {isPending && activeLoginAs === "DEPARTMENT_HEAD" ? (
                t("login.signingIn")
              ) : (
                <>
                  <span className="block text-[10px] uppercase tracking-[0.2em] opacity-80">{t("login.signInAs")}</span>
                  <span className="block text-sm font-semibold">{t("role.department_head")}</span>
                </>
              )}
            </button>
            <button
              className="btn-brand-primary w-full px-4 py-3 text-center text-sm font-semibold leading-tight disabled:opacity-60"
              disabled={isPending && activeLoginAs === "TEACHER"}
              type="submit"
              name="loginAs"
              value="TEACHER"
              data-role="TEACHER"
              onClick={() => setSelectedLoginAs("TEACHER")}
            >
              {isPending && activeLoginAs === "TEACHER" ? (
                t("login.signingIn")
              ) : (
                <>
                  <span className="block text-[10px] uppercase tracking-[0.2em] opacity-80">{t("login.signInAs")}</span>
                  <span className="block text-sm font-semibold">{t("role.teacher")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
