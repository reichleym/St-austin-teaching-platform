"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type LoginFailureCode =
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "INACTIVE_ACCOUNT"
  | "INCORRECT_USER_TYPE";

function getAdminLoginErrorMessage(code: LoginFailureCode | string | undefined) {
  if (code === "INACTIVE_ACCOUNT") return "This account is inactive. Contact your administrator.";
  if (code === "INVALID_CREDENTIALS") return "Invalid email or password.";
  if (code === "INCORRECT_USER_TYPE") return "This login is only for Super Admin accounts.";
  return "Unable to sign in right now.";
}

export default function AdminLoginClient() {
  const router = useRouter();
  const adminDashboardUrl = "/dashboard/admin";
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Prevent multiple submissions
    if (isPending) {
      return;
    }
    
    setError("");
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email");
      const password = formData.get("password");

      const precheck = await fetch("/api/auth/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, loginAs: "SUPER_ADMIN", audience: "SUPER_ADMIN" }),
      });
      const precheckRaw = await precheck.text();
      const precheckResult = precheckRaw ? (JSON.parse(precheckRaw) as { ok?: boolean; code?: LoginFailureCode }) : {};
      if (!precheck.ok || !precheckResult.ok) {
        setError(getAdminLoginErrorMessage(precheckResult.code));
        return;
      }

      const result = await signIn("super-admin-credentials", {
        email,
        password,
        loginAs: "SUPER_ADMIN",
        redirect: false,
        callbackUrl: adminDashboardUrl,
      });

      if (!result || result.error) {
        setError("Unable to sign in right now.");
        return;
      }

      router.push(adminDashboardUrl);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">Admin</span>
        </div>
        <span className="brand-chip brand-chip-accent">
          <span className="brand-accent-dot" />
          Admin Access
        </span>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">Admin Login</h1>
        <p className="brand-muted mt-2 text-sm">Only Super Admin and Admin accounts can sign in here.</p>

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

          <button
            className="btn-brand-primary px-4 py-2 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign in as Admin"}
          </button>
        </form>
      </div>
    </main>
  );
}
