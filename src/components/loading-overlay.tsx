"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";

export function LoadingOverlay({ active, label }: { active: boolean; label?: string }) {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t("loading.default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!active || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="rounded-xl border border-[#c6ddfa] bg-white px-5 py-4 text-sm font-semibold text-[#1f518f] shadow-[0_18px_36px_rgba(15,55,110,0.2)]">
        <div className="w-44 space-y-2 animate-pulse" role="status" aria-live="polite" aria-label={resolvedLabel}>
          <div className="h-3.5 w-32 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
          <span className="sr-only">{resolvedLabel}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
