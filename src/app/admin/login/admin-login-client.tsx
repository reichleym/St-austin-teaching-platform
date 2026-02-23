"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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

      const result = await signIn("super-admin-credentials", {
        email,
        password,
        loginAs: "SUPER_ADMIN",
        redirect: false,
        callbackUrl: adminDashboardUrl,
      });

      if (!result || result.error) {
        setError("Invalid admin credentials or inactive account.");
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
