"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  pushToast: (toast: { type: ToastType; message: string }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const MANUAL_TOAST_EVENT = "app:manual-toast";

function ToastCard({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const { t } = useLanguage();
  const styles =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : toast.type === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : toast.type === "info"
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "border-red-200 bg-red-50 text-red-900";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-[0_10px_26px_rgba(15,55,110,0.18)] ${styles}`}
    >
      <div className="min-w-0 flex-1 whitespace-pre-wrap">{toast.message}</div>
      <button
        type="button"
        className="text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100"
        onClick={() => onClose(toast.id)}
        aria-label={t("dismiss")}
      >
        {t("close")}
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((toast: { type: ToastType; message: string }) => {
    if (!toast.message) return;
    const id = `toast_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    setToasts((prev) => [...prev, { id, type: toast.type, message: toast.message }]);
    window.dispatchEvent(
      new CustomEvent(MANUAL_TOAST_EVENT, {
        detail: {
          ts: Date.now(),
          type: toast.type,
          message: toast.message,
        },
      })
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[9999] flex w-[min(360px,90vw)] flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
