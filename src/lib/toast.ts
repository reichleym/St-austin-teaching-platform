export type AppToastType = "success" | "error" | "info";

export type ToastPayload = {
  id: string;
  type: AppToastType;
  message: string;
  durationMs: number;
};

type ToastListener = (payload: ToastPayload) => void;

const listeners = new Set<ToastListener>();

function emit(type: AppToastType, message: string, durationMs = 3500) {
  const trimmed = message.trim();
  if (!trimmed) return;

  const payload: ToastPayload = {
    id: `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    message: trimmed,
    durationMs,
  };

  for (const listener of listeners) {
    listener(payload);
  }
}

export const toast = {
  success(message: string, durationMs?: number) {
    emit("success", message, durationMs);
  },
  error(message: string, durationMs?: number) {
    emit("error", message, durationMs);
  },
  info(message: string, durationMs?: number) {
    emit("info", message, durationMs);
  },
};

export function subscribeToasts(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
