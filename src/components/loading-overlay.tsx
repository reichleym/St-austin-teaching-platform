"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function LoadingOverlay({ active, label = "Loading..." }: { active: boolean; label?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!active || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl border border-[#c6ddfa] bg-white px-4 py-3 text-sm font-semibold text-[#1f518f] shadow-[0_18px_36px_rgba(15,55,110,0.2)]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#9bbfed] border-t-transparent" />
        <span>{label}</span>
      </div>
    </div>,
    document.body
  );
}
