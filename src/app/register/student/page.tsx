"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getStudentSelfSignupCutoffLabel, isStudentSelfSignupAllowed } from "@/lib/onboarding-policy";

export default function StudentRegistrationPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const studentSelfSignupAllowed = isStudentSelfSignupAllowed();
  const cutoffLabel = getStudentSelfSignupCutoffLabel();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    const phone = String(formData.get("phone") ?? "");
    const gradeLevel = String(formData.get("gradeLevel") ?? "");
    const section = String(formData.get("section") ?? "");
    const guardianName = String(formData.get("guardianName") ?? "");
    const guardianPhone = String(formData.get("guardianPhone") ?? "");

    const response = await fetch("/api/register/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName,
        lastName,
        phone,
        gradeLevel,
        section,
        guardianName,
        guardianPhone,
      }),
    });

    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setIsPending(false);
      setError(result.error ?? "Unable to register student account.");
      return;
    }

    const signInResult = await signIn("user-credentials", {
      email,
      password,
      loginAs: "STUDENT",
      redirect: false,
      callbackUrl: "/dashboard/student",
    });

    setIsPending(false);

    if (!signInResult || signInResult.error) {
      router.push("/login");
      return;
    }

    router.push(signInResult.url ?? "/dashboard/student");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center p-6 lg:p-8">
      <div className="brand-glass brand-animate p-6 lg:p-8">
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[#c0daf8] bg-white/70 p-3">
          <Image src="/logo/image.png" alt="St. Austin logo" width={132} height={62} />
          <span className="brand-chip">Register</span>
        </div>
        <span className="brand-chip brand-chip-accent">
          <span className="brand-accent-dot" />
          Student Onboarding
        </span>
        <h1 className="brand-title brand-title-gradient text-3xl font-semibold">Register as Student</h1>
        <p className="brand-muted mt-2 text-sm">Create a student account for learning modules.</p>

        {!studentSelfSignupAllowed ? (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Student self-signup closed after {cutoffLabel}. Please request an invite from Admin.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 grid gap-5">
            <div className="brand-panel p-4">
              <p className="brand-section-title">Student Identity</p>
              <div className="mt-3 grid gap-5 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">First Name</span>
                  <input className="brand-input" type="text" name="firstName" required />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Last Name</span>
                  <input className="brand-input" type="text" name="lastName" required />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Phone Number</span>
                  <input className="brand-input" type="tel" name="phone" required placeholder="+1 000 000 0000" />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Email</span>
                  <input className="brand-input" type="email" name="email" required placeholder="student@staustin.edu" />
                </label>
              </div>
            </div>

            <div className="brand-panel p-4">
              <p className="brand-section-title">Academic & Guardian</p>
              <div className="mt-3 grid gap-5 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Grade Level</span>
                  <input className="brand-input" type="text" name="gradeLevel" required placeholder="Grade 10" />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Section</span>
                  <input className="brand-input" type="text" name="section" required placeholder="A" />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Guardian Name</span>
                  <input className="brand-input" type="text" name="guardianName" required />
                </label>

                <label className="grid gap-1.5">
                  <span className="brand-label">Guardian Phone</span>
                  <input className="brand-input" type="tel" name="guardianPhone" required placeholder="+1 000 000 0000" />
                </label>
              </div>
            </div>

            <label className="grid gap-1.5">
              <span className="brand-label">Password</span>
              <input className="brand-input" type="password" name="password" minLength={8} required />
              <span className="brand-helper">Use at least 8 characters.</span>
            </label>

            <div className="rounded-xl border border-[#bcd8fb] bg-white/75 p-3">
              <p className="brand-helper">
                These details will be used by school admins for student verification and communication.
              </p>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button className="btn-brand-secondary px-4 py-2.5 disabled:opacity-60" disabled={isPending}>
              {isPending ? "Registering..." : "Create Student Account"}
            </button>
          </form>
        )}

        <div className="mt-4 text-sm">
          <Link href="/login" className="font-semibold underline">
            Back to Teacher/Student Login
          </Link>
        </div>
      </div>
    </main>
  );
}
