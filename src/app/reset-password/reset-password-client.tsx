"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { ToastMessage } from "@/components/toast-message";
import { PasswordField } from "@/components/password-field";

type Props = {
  email: string;
  token: string;
};

export default function ResetPasswordClient({ email, token }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const hasParams = Boolean(email.trim() && token.trim());

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to reset password.");
        return;
      }
      setInfo("Password reset successful. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reset password.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">Reset Password</span>
        </div>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">Set New Password</h1>
        {!hasParams ? (
          <p className="mt-2 text-sm text-red-600">Invalid reset link. Please request a new one.</p>
        ) : (
          <p className="brand-muted mt-2 text-sm">Create a new password for your account.</p>
        )}

        {hasParams ? (
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              minLength={8}
              required
            />
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              minLength={8}
              required
            />

            <ToastMessage type="error" message={error} />
            <ToastMessage type="success" message={info} />

            <button className="btn-brand-primary px-4 py-2 disabled:opacity-60" disabled={isPending}>
              {isPending ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : null}

        <div className="mt-4 text-sm">
          <Link href="/login" className="font-semibold underline">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
