"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PasswordField } from "@/components/password-field";

type Props = {
  token: string;
};

export default function AcceptInviteClient({ token }: Props) {
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const password = String(formData.get("password") ?? "");

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });

    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setIsPending(false);
      setError(result.error ?? "Could not accept invitation.");
      return;
    }

    setIsPending(false);
    setIsSuccess(true);
  };

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
        <div className="brand-glass brand-animate p-6">
          <span className="brand-chip brand-chip-accent">
            <span className="brand-accent-dot" />
            Invitation
          </span>
          <h1 className="brand-title brand-title-gradient mt-3 text-2xl font-semibold">Invalid Invitation Link</h1>
          <p className="brand-muted mt-2 text-sm">
            Missing token. Please use the invitation link provided by Admin.
          </p>
          <Link href="/login" className="mt-4 inline-flex text-sm font-semibold text-[#1f518f] underline">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <div className="brand-glass brand-animate p-6">
        <span className="brand-chip brand-chip-accent">
          <span className="brand-accent-dot" />
          Access Portal
        </span>
        <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-semibold">Accept Invitation</h1>
        <p className="brand-muted mt-2 text-sm">Set your name and password to activate your account.</p>

        {isSuccess ? (
          <div className="brand-accent-card mt-6 p-4 text-sm text-[#7e5900]">
            Account activated. You can now sign in from the user login page.
            <div className="mt-3">
              <Link href="/login" className="font-semibold text-[#1f518f] underline">
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-1.5">
              <span className="brand-label">Full Name</span>
              <input className="brand-input" type="text" name="name" required />
            </label>

            <PasswordField
              label="Password"
              name="password"
              minLength={8}
              required
              wrapperClassName="grid gap-1.5"
              inputClassName="brand-input pr-11"
            />

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button className="btn-brand-primary px-4 py-2 disabled:opacity-60" disabled={isPending}>
              {isPending ? "Activating..." : "Activate Account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
