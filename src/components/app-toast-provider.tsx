"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToasts, toast, ToastPayload } from "@/lib/toast";

type Props = {
  children: ReactNode;
};

type ToastItem = ToastPayload;

type MutationMethod = "POST" | "PATCH" | "PUT" | "DELETE";

const MUTATION_METHODS: MutationMethod[] = ["POST", "PATCH", "PUT", "DELETE"];
const TOAST_SUPPRESSED_PATHS = ["/api/auth/"];

function parsePayloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return null;
}

function getMutationMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof init?.method === "string" && init.method.trim()) return init.method.trim().toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
}

function isToastSuppressed(rawUrl: string): boolean {
  if (!rawUrl) return false;

  if (rawUrl.startsWith("/")) {
    return TOAST_SUPPRESSED_PATHS.some((path) => rawUrl.startsWith(path));
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.origin !== window.location.origin) return false;
      return TOAST_SUPPRESSED_PATHS.some((path) => parsed.pathname.startsWith(path));
    } catch {
      return false;
    }
  }

  return false;
}

function isApiMutation(method: string, rawUrl: string): method is MutationMethod {
  if (!MUTATION_METHODS.includes(method as MutationMethod)) return false;
  if (!rawUrl) return false;

  if (rawUrl.startsWith("/api/")) return true;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      const parsed = new URL(rawUrl);
      return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }
  return false;
}

function defaultSuccessMessage(method: MutationMethod) {
  if (method === "POST") return "Created successfully.";
  if (method === "PATCH" || method === "PUT") return "Updated successfully.";
  return "Deleted successfully.";
}

function defaultErrorMessage(method: MutationMethod) {
  if (method === "POST") return "Unable to create.";
  if (method === "PATCH" || method === "PUT") return "Unable to update.";
  return "Unable to delete.";
}

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

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const method = getMutationMethod(input, init);
      const url = getRequestUrl(input);
      const shouldToast = isApiMutation(method, url) && !isToastSuppressed(url);

      try {
        const response = await originalFetch(input, init);

        if (!shouldToast) return response;

        const clone = response.clone();
        let parsedPayload: unknown = null;
        try {
          const raw = await clone.text();
          parsedPayload = raw ? (JSON.parse(raw) as unknown) : null;
        } catch {
          parsedPayload = null;
        }

        const payloadMessage = parsePayloadMessage(parsedPayload);

        if (response.ok) {
          toast.success(payloadMessage ?? defaultSuccessMessage(method));
        } else {
          toast.error(payloadMessage ?? defaultErrorMessage(method));
        }

        return response;
      } catch (error) {
        if (shouldToast) {
          if (error instanceof Error && error.message.trim()) {
            toast.error(error.message);
          } else {
            toast.error("Network request failed.");
          }
        }
        throw error;
      }
    };

    window.fetch = wrappedFetch;

    return () => {
      window.fetch = originalFetch;
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
