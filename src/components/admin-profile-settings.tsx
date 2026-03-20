"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { PasswordField } from "@/components/password-field";
import { useLanguage } from "@/components/language-provider";

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
  const { t } = useLanguage();
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
          if (active) setError(result.error ?? t("error.loadAdminProfile"));
          return;
        }
        if (!active) return;
        setProfile(result.profile);
        setName(result.profile.name ?? "");
        setPhone(result.profile.phone ?? "");
        setCountry(result.profile.country ?? "");
        setState(result.profile.state ?? "");
      } catch {
        if (active) setError(t("error.loadAdminProfile"));
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
      setError(t("error.nameRequired"));
      return;
    }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      setError(t("error.passwordPairRequired"));
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
        setError(result.error ?? t("error.updateProfile"));
        return;
      }
      setProfile(result.profile);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(t("success.profileUpdated"));
    } catch {
      setError(t("error.updateProfile"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <article className="brand-card p-5">
        <p className="brand-section-title">{t("adminProfile.title")}</p>
        <p className="brand-muted mt-2 text-sm">{t("adminProfile.subtitle")}</p>
        {profile ? <p className="mt-1 text-xs text-[#3a689f]">{t("adminProfile.account")}: {profile.email}</p> : null}
        {profile ? (
          <p className="mt-1 text-xs text-[#3a689f]">
            {t("adminProfile.lastUpdated")}: {new Date(profile.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </article>

      <article className="brand-card p-5">
        {isLoading ? (
          <div className="mt-2">
            <LoadingIndicator label={t("loading.profile")} lines={2} />
          </div>
        ) : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        {success ? <p className="mb-2 text-sm text-green-700">{success}</p> : null}

        {!isLoading ? (
          <form className="grid gap-3" onSubmit={onSubmit}>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.fullName")}</span>
              <input
                className="brand-input"
                placeholder={t("placeholder.fullName")}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">{t("label.phoneNumber")}</span>
              <input
                className="brand-input"
                placeholder={t("placeholder.phoneNumber")}
                value={phone}
                onChange={(event) => setPhone(event.currentTarget.value)}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.country")}</span>
                <input
                  className="brand-input"
                  placeholder={t("placeholder.country")}
                  value={country}
                  onChange={(event) => setCountry(event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="brand-label">{t("label.state")}</span>
                <input
                  className="brand-input"
                  placeholder={t("placeholder.state")}
                  value={state}
                  onChange={(event) => setState(event.currentTarget.value)}
                />
              </label>
            </div>
            <p className="brand-label mt-1">{t("label.changePassword")}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <PasswordField
                label={t("label.currentPassword")}
                placeholder={t("placeholder.currentPassword")}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                wrapperClassName="grid gap-1"
                inputClassName="brand-input pr-11"
              />
              <PasswordField
                label={t("label.newPassword")}
                placeholder={t("placeholder.newPassword")}
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                wrapperClassName="grid gap-1"
                inputClassName="brand-input pr-11"
              />
            </div>
            <button className="btn-brand-primary w-fit px-4 py-2 text-sm font-semibold" disabled={isSaving}>
              {isSaving ? t("status.saving") : t("action.updateProfile")}
            </button>
          </form>
        ) : null}
      </article>
    </section>
  );
}
