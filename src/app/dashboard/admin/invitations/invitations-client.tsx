"use client";

import { FormEvent, useEffect, useState } from "react";

type InviteRole = "TEACHER" | "STUDENT";

type InvitationsClientProps = {
  initialRole?: InviteRole;
};

type LocationOption = {
  name: string;
  code: string;
};

export function InvitationsClient({ initialRole = "TEACHER" }: InvitationsClientProps) {
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [selectedRole, setSelectedRole] = useState<InviteRole>(initialRole);
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");

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
    void loadCountries();
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
    setError("");
    setWarning("");
    setInviteUrl("");
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "");
      const firstName = String(formData.get("firstName") ?? "");
      const lastName = String(formData.get("lastName") ?? "");
      const phone = String(formData.get("phone") ?? "");
      const role = String(formData.get("role") ?? "TEACHER") as InviteRole;
      const department = String(formData.get("department") ?? "");
      const subjects = String(formData.get("subjects") ?? "");
      const employeeId = String(formData.get("employeeId") ?? "");
      const guardianName = String(formData.get("guardianName") ?? "");
      const guardianPhone = String(formData.get("guardianPhone") ?? "");
      const country = String(formData.get("country") ?? "");
      const state = String(formData.get("state") ?? "");

      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          phone,
          role,
          department,
          subjects,
          employeeId,
          guardianName,
          guardianPhone,
          country,
          state,
        }),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; warning?: string; inviteUrl?: string }) : {};

      if (!response.ok) {
        if (result.inviteUrl) {
          setInviteUrl(result.inviteUrl);
        }
        setError(result.error ?? "Could not create invitation.");
        return;
      }

      setInviteUrl(result.inviteUrl ?? "");
      setWarning(result.warning ?? "");
    } catch {
      setError("Could not create invitation.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <span className="brand-chip brand-chip-accent">
        <span className="brand-accent-dot" />
        Enrollment
      </span>
      <h1 className="brand-title brand-title-gradient mt-3 text-3xl font-semibold">Admin Invitations</h1>
      <p className="brand-muted mt-2 text-sm">Invite teachers or students. Teachers are invite-only.</p>

      <p className="brand-section-title mt-6">Invite Details</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-5">
        <div className="brand-panel p-4">
          <p className="brand-section-title">Profile Basics</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 md:col-span-2">
              <span className="brand-label">Role</span>
              <select
                className="brand-input"
                name="role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.currentTarget.value as InviteRole)}
              >
                <option value="TEACHER">Teacher</option>
                <option value="STUDENT">Student</option>
              </select>
              <span className="brand-helper">Choose the invitation type first.</span>
            </label>

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
              <input className="brand-input" type="email" name="email" required placeholder="name@staustin.edu" />
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

        {selectedRole === "TEACHER" ? (
          <div className="brand-panel p-4">
            <p className="brand-section-title">Teacher Profile</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="brand-label">Department</span>
                <input className="brand-input" type="text" name="department" required placeholder="Science" />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Subjects</span>
                <input className="brand-input" type="text" name="subjects" placeholder="Math, Physics" required />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">Employee ID</span>
                <input className="brand-input" type="text" name="employeeId" required placeholder="TCH-1048" />
              </label>
            </div>
          </div>
        ) : null}

        {selectedRole === "STUDENT" ? (
          <div className="brand-panel p-4">
            <p className="brand-section-title">Student Profile</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
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
        ) : null}

        <div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {warning ? <p className="text-sm text-amber-700">{warning}</p> : null}
        </div>

        <button className="btn-brand-primary w-full px-4 py-2.5 disabled:opacity-60" disabled={isPending}>
          {isPending ? "Creating invite..." : "Create Invitation"}
        </button>
      </form>

      {inviteUrl ? (
        <section className="brand-accent-card mt-6 p-4">
          <p className="text-sm font-semibold text-[#7e5900]">Invitation Link</p>
          <p className="mt-2 break-all text-sm text-[#184989]">{inviteUrl}</p>
          <p className="mt-2 text-xs text-[#805900]">Share this link securely with the invited user.</p>
        </section>
      ) : null}
    </>
  );
}
