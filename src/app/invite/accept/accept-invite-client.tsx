"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
        <h1 className="text-2xl font-semibold">Invalid Invitation Link</h1>
        <p className="mt-2 text-sm text-neutral-600">Missing token. Please use the invitation link provided by Admin.</p>
        <Link href="/login" className="mt-4 text-sm underline">
          Go to Login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <h1 className="text-3xl font-semibold">Accept Invitation</h1>
      <p className="mt-2 text-sm text-neutral-600">Set your name and password to activate your account.</p>

      {isSuccess ? (
        <div className="mt-6 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Account activated. You can now sign in from the user login page.
          <div className="mt-3">
            <Link href="/login" className="underline">
              Go to Login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Full Name</span>
            <input className="rounded-md border border-neutral-300 px-3 py-2" type="text" name="name" required />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Password</span>
            <input
              className="rounded-md border border-neutral-300 px-3 py-2"
              type="password"
              name="password"
              minLength={8}
              required
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-60" disabled={isPending}>
            {isPending ? "Activating..." : "Activate Account"}
          </button>
        </form>
      )}
    </main>
  );
}
