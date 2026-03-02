"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "success" | "error";

function StudentVerifyContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = searchParams.get("token")?.trim() ?? "";
  const hasParams = Boolean(email && token);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!hasParams) {
      return;
    }

    const run = async () => {
      try {
        const query = new URLSearchParams({ email, token }).toString();
        const response = await fetch(`/api/register/student/verify?${query}`, {
          method: "GET",
        });

        const raw = await response.text();
        const result = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : {};

        if (response.ok && result.ok) {
          setStatus("success");
          setMessage("Email verified. You can now log in as student.");
          return;
        }

        setStatus("error");
        setMessage(result.error ?? "Verification failed.");
      } catch {
        setStatus("error");
        setMessage("Unable to verify email right now.");
      }
    };

    void run();
  }, [email, hasParams, token]);

  const visibleStatus = hasParams ? status : "error";
  const visibleMessage = hasParams ? message : "Invalid verification link.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
      <section className="brand-glass p-6">
        <h1 className="brand-title brand-title-gradient text-2xl font-semibold">Student Email Verification</h1>
        <p
          className={`mt-3 text-sm ${visibleStatus === "success" ? "text-emerald-700" : visibleStatus === "error" ? "text-red-600" : "brand-muted"}`}
        >
          {visibleMessage}
        </p>
        <div className="mt-5">
          <Link href="/login" className="btn-brand-secondary inline-flex px-4 py-2 text-sm font-semibold no-underline">
            Go to Login
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function StudentVerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center p-6">
          <section className="brand-glass p-6">
            <h1 className="brand-title brand-title-gradient text-2xl font-semibold">Student Email Verification</h1>
            <p className="brand-muted mt-3 text-sm">Loading verification...</p>
          </section>
        </main>
      }
    >
      <StudentVerifyContent />
    </Suspense>
  );
}
