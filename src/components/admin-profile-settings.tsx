"use client";

import { FormEvent, useEffect, useState } from "react";
import { PasswordField } from "@/components/password-field";

type AdminProfile = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  country: string | null;
  state: string | null;
  updatedAt: string;
};

export function AdminProfileSettings() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/profile");
        const raw = await response.text();
        const result = raw ? (JSON.parse(raw) as { error?: string; profile?: AdminProfile }) : {};
        if (!response.ok || !result.profile) {
          if (active) setError(result.error ?? "Unable to load admin profile.");
          return;
        }
        if (!active) return;
        setProfile(result.profile);
        setName(result.profile.name ?? "");
        setPhone(result.profile.phone ?? "");
        setCountry(result.profile.country ?? "");
        setState(result.profile.state ?? "");
      } catch {
        if (active) setError("Unable to load admin profile.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      setError("Provide both current and new password to update password.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          country,
          state,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; profile?: AdminProfile }) : {};
      if (!response.ok || !result.profile) {
        setError(result.error ?? "Unable to update profile.");
        return;
      }
      setProfile(result.profile);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Profile updated successfully.");
    } catch {
      setError("Unable to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">Admin Profile Settings</p>
        <p className="brand-muted mt-2 text-sm">Update your profile details used across the admin panel.</p>
        {profile ? <p className="mt-1 text-xs text-[#3a689f]">Account: {profile.email}</p> : null}
        {profile ? (
          <p className="mt-1 text-xs text-[#3a689f]">Last updated: {new Date(profile.updatedAt).toLocaleString()}</p>
        ) : null}
      </article>

      <article className="brand-card p-5">
        {isLoading ? <p className="brand-muted text-sm">Loading profile...</p> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mb-2 text-sm text-green-700">{success}</p> : null}

        {!isLoading ? (
          <form className="grid gap-3" onSubmit={onSubmit}>
            <input
              className="brand-input"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              required
            />
            <input
              className="brand-input"
              placeholder="Phone number"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="brand-input"
                placeholder="Country"
                value={country}
                onChange={(event) => setCountry(event.currentTarget.value)}
              />
              <input
                className="brand-input"
                placeholder="State"
                value={state}
                onChange={(event) => setState(event.currentTarget.value)}
              />
            </div>
            <p className="brand-label mt-1">Change Password</p>
            <div className="grid gap-3 md:grid-cols-2">
              <PasswordField
                placeholder="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                wrapperClassName="grid gap-1"
                inputClassName="brand-input pr-11"
              />
              <PasswordField
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                wrapperClassName="grid gap-1"
                inputClassName="brand-input pr-11"
              />
            </div>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={isSaving}>
              {isSaving ? "Saving..." : "Update Profile"}
            </button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
