"use client";

type LoadingIndicatorProps = {
  label?: string;
  lines?: number;
  className?: string;
};

export function LoadingIndicator({ label = "Loading...", lines = 2, className }: LoadingIndicatorProps) {
  const safeLines = Math.max(1, Math.min(lines, 5));
  const widths = ["w-40", "w-28", "w-36", "w-24", "w-32"];
  const rootClassName = ["space-y-2 animate-pulse", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: safeLines }).map((_, index) => (
        <div
          key={index}
          className={`h-3.5 ${widths[index % widths.length]} rounded bg-slate-200`}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
