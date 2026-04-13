"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToasts, ToastPayload } from "@/lib/toast";

type Props = {
  children: ReactNode;
};

type ToastItem = ToastPayload;

export function AppToastProvider({ children }: Props) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timerMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return subscribeToasts((payload) => {
      setItems((prev) => [...prev, payload]);
      const timeoutId = window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== payload.id));
        timerMapRef.current.delete(payload.id);
      }, payload.durationMs);

      timerMapRef.current.set(payload.id, timeoutId);
    });
  }, []);

  useEffect(() => {
    const timerMap = timerMapRef.current;
    return () => {
      for (const timeoutId of timerMap.values()) {
        window.clearTimeout(timeoutId);
      }
      timerMap.clear();
    };
  }, []);

  const hasItems = items.length > 0;
  const containerClassName = useMemo(
    () =>
      [
        "pointer-events-none fixed right-4 top-4 z-[100] w-[min(24rem,calc(100vw-2rem))]",
        hasItems ? "opacity-100" : "opacity-0",
      ].join(" "),
    [hasItems]
  );

  return (
    <>
      {children}
      <div className={containerClassName} aria-live="polite" aria-atomic="true">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const colorClass =
              item.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : item.type === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-200 bg-white text-slate-900";

            return (
              <div
                key={item.id}
                role={item.type === "error" ? "alert" : "status"}
                className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-sm ${colorClass}`}
              >
                {item.message}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
