"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ConfirmModal } from "@/components/confirm-modal";
import { toast } from "@/lib/toast";
import { useLanguage } from "@/components/language-provider";

type LogoutButtonProps = {
  role?: string | null;
  callbackUrl?: string;
};

function resolveLogoutCallbackUrl({ role, callbackUrl }: LogoutButtonProps) {
  if (callbackUrl) return callbackUrl;
  if (role === "SUPER_ADMIN") return "/admin/login";
  return "/login";
}

export function LogoutButton({ role, callbackUrl }: LogoutButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { t } = useLanguage();

  const handleConfirm = async () => {
    setConfirmOpen(false);
    const resolvedCallbackUrl = resolveLogoutCallbackUrl({ role, callbackUrl });
    toast.success(t("logoutSuccess"));
    try {
      const result = await signOut({ redirect: false, callbackUrl: resolvedCallbackUrl });
      const nextUrl = result?.url ?? resolvedCallbackUrl;
      window.setTimeout(() => {
        window.location.assign(nextUrl);
      }, 150);
    } catch (error) {
      console.error("Logout failed", error);
      toast.error(t("logoutError"));
    }
  };

  return (
    <>
      <button type="button" onClick={() => setConfirmOpen(true)} className="btn-brand-primary px-2 py-2">
        {t("logout")}
      </button>
      <ConfirmModal
        open={confirmOpen}
        title={t("confirmLogoutTitle")}
        message={t("confirmLogoutMessage")}
        confirmLabel={t("confirmLogoutCta")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
