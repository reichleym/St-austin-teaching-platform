"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast-provider";

type ToastMessageProps = {
  type: "success" | "error" | "warning" | "info";
  message?: string | null;
};

export function ToastMessage({ type, message }: ToastMessageProps) {
  const { pushToast } = useToast();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message) {
      lastMessageRef.current = null;
      return;
    }
    if (lastMessageRef.current === message) return;
    lastMessageRef.current = message;
    pushToast({ type, message });
  }, [message, pushToast, type]);

  return null;
}
