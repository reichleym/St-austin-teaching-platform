"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ConfirmModal } from "@/components/confirm-modal";

export function LogoutButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        onConfirm={() => {
          setConfirmOpen(false);
          void signOut({ callbackUrl: "/login" });
        }}
      />
    </>
  );
}
