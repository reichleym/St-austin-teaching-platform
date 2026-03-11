"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ConfirmModal } from "@/components/confirm-modal";
import { toast } from "@/lib/toast";

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

  const handleConfirm = async () => {
    setConfirmOpen(false);
    const resolvedCallbackUrl = resolveLogoutCallbackUrl({ role, callbackUrl });
    toast.success("Logged out successfully.");
    try {
      const result = await signOut({ redirect: false, callbackUrl: resolvedCallbackUrl });
      const nextUrl = result?.url ?? resolvedCallbackUrl;
      window.setTimeout(() => {
        window.location.assign(nextUrl);
      }, 150);
    } catch (error) {
      console.error("Logout failed", error);
      toast.error("Unable to log out. Please try again.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setConfirmOpen(true)} className="btn-brand-primary px-4 py-2">
        Logout
      </button>
      <ConfirmModal
        open={confirmOpen}
        title="Confirm Logout"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
