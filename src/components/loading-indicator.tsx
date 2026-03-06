"use client";

export function LoadingIndicator({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#3f70ae]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9bbfed] border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
