"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; message?: string; resetUrl?: string }) : {};
      if (!response.ok) {
        setError(result.error ?? "Unable to process request.");
        return;
      }
      const baseMessage = result.message ?? "If this account exists, a reset link has been sent.";
      setInfo(result.resetUrl ? `${baseMessage} Reset link: ${result.resetUrl}` : baseMessage);
    } catch {
      setError("Unable to process request.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">Password Reset</span>
        </div>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">Forgot Password</h1>
        <p className="brand-muted mt-2 text-sm">Enter your teacher/student account email to receive a reset link.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-[#0f3a74]">Email</span>
            <input
              className="brand-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              autoComplete="email"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}

          <button className="btn-brand-primary px-4 py-2 disabled:opacity-60" disabled={isPending}>
            {isPending ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <Link href="/login" className="font-semibold underline">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
