"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();
  const resolvedConfirmLabel = confirmLabel ?? t("confirm");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,30,61,0.45)] p-4">
      <div className="brand-card w-full max-w-md p-5">
        <p className="brand-section-title">{title}</p>
        <p className="brand-muted mt-2 text-sm">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className="rounded border border-[#9bbfed] px-3 py-1.5 text-sm font-semibold text-[#1f518f]" onClick={onCancel}>
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            className={
              destructive
                ? "rounded border border-red-300 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                : "btn-brand-primary px-3 py-1.5 text-sm font-semibold"
            }
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
