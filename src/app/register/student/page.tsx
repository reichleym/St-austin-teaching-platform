"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { getStudentSelfSignupCutoffLabel, isStudentSelfSignupAllowed } from "@/lib/onboarding-policy";
import { PasswordField } from "@/components/password-field";
import { ToastMessage } from "@/components/toast-message";

export default function StudentRegistrationPage() {
  type LocationOption = {
    name: string;
    code: string;
  };

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [warning, setWarning] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const studentSelfSignupAllowed = isStudentSelfSignupAllowed();
  const cutoffLabel = getStudentSelfSignupCutoffLabel();

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      try {
        const response = await fetch("/api/locations");
        const raw = await response.text();
        const result = raw ? (JSON.parse(raw) as { countries?: LocationOption[] }) : {};
        if (active) {
          setCountries(result.countries ?? []);
        }
      } catch {
        if (active) {
          setCountries([]);
        }
      }
    };
    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  const loadStates = async (countryName: string) => {
    const selectedCountry = countries.find((item) => item.name === countryName);
    if (!selectedCountry) {
      setStates([]);
      return;
    }

    try {
      const response = await fetch(`/api/locations?countryCode=${encodeURIComponent(selectedCountry.code)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { states?: LocationOption[] }) : {};
      setStates(result.states ?? []);
    } catch {
      setStates([]);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setInfo("");
    setWarning("");
    setIsPending(true);

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    const phone = String(formData.get("phone") ?? "");
    const department = String(formData.get("department") ?? "");
    const guardianName = String(formData.get("guardianName") ?? "");
    const guardianPhone = String(formData.get("guardianPhone") ?? "");
    const country = String(formData.get("country") ?? "");
    const state = String(formData.get("state") ?? "");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    const normalizedGuardianPhone = guardianPhone.replace(/[^\d+]/g, "");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const phoneOk = /^\+?\d{7,15}$/.test(normalizedPhone);
    const guardianPhoneOk = /^\+?\d{7,15}$/.test(normalizedGuardianPhone);

    if (!emailOk) {
      setIsPending(false);
      setError("Enter a valid email address.");
      return;
    }
    if (!phoneOk) {
      setIsPending(false);
      setError("Enter a valid phone number (7-15 digits, optional +).");
      return;
    }
    if (!guardianPhoneOk) {
      setIsPending(false);
      setError("Enter a valid guardian phone number (7-15 digits, optional +).");
      return;
    }
    const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordPolicy.test(password)) {
      setIsPending(false);
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
      return;
    }
    if (password !== confirmPassword) {
      setIsPending(false);
      setError("Password and confirmation do not match.");
      return;
    }

    const response = await fetch("/api/register/student", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        firstName,
        lastName,
        phone: normalizedPhone,
        department,
        guardianName,
        guardianPhone: normalizedGuardianPhone,
        country,
        state,
      }),
    });

    const raw = await response.text();
    const result = raw ? (JSON.parse(raw) as { error?: string; warning?: string; verifyUrl?: string }) : {};

    if (!response.ok) {
      setIsPending(false);
      setError(result.error ?? "Unable to register student account.");
      return;
    }

    setIsPending(false);
    if (result.warning) {
      setWarning(result.warning);
    }
    setInfo(
      result.verifyUrl
        ? `Account created. Verify your email using this local link: ${result.verifyUrl}`
        : "Account created. Please check your email and verify before logging in."
    );
    form.reset();
    setCountry("");
    setState("");
    setStates([]);
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
                <label className="grid gap-1.5">
                  <span className="brand-label">Country</span>
                  <select
                    className="brand-input"
                    name="country"
                    value={country}
                    onChange={async (event) => {
                      const value = event.currentTarget.value;
                      setCountry(value);
                      setState("");
                      if (value) {
                        await loadStates(value);
                      } else {
                        setStates([]);
                      }
                    }}
                    required
                  >
                    <option value="">Select country</option>
                    {countries.map((item) => (
                      <option key={item.code} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="brand-label">State</span>
                  <select
                    className="brand-input"
                    name="state"
                    value={state}
                    onChange={(event) => setState(event.currentTarget.value)}
                    disabled={!country}
                    required
                  >
                    <option value="">Select state</option>
                    {states.map((item) => (
                      <option key={item.code} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="brand-panel p-4">
              <p className="brand-section-title">Academic & Guardian</p>
              <div className="mt-3 grid gap-5 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="brand-label">Department</span>
                  <input className="brand-input" type="text" name="department" required placeholder="Science" />
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

            <PasswordField
              label="Password"
              name="password"
              minLength={8}
              required
              wrapperClassName="grid gap-1.5"
              inputClassName="brand-input pr-11"
            />
            <span className="brand-helper -mt-3">Use at least 8 characters.</span>
            <PasswordField
              label="Confirm Password"
              name="confirmPassword"
              minLength={8}
              required
              wrapperClassName="grid gap-1.5"
              inputClassName="brand-input pr-11"
            />

            <div className="rounded-xl border border-[#bcd8fb] bg-white/75 p-3">
              <p className="brand-helper">
                These details will be used by school admins for student verification and communication.
              </p>
            </div>

            <ToastMessage type="error" message={error} />
            <ToastMessage type="warning" message={warning} />
            <ToastMessage type="success" message={info} />

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
