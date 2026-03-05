"use client";

import { InputHTMLAttributes, useId, useState } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  wrapperClassName?: string;
  inputClassName?: string;
};

export function PasswordField({
  label,
  wrapperClassName,
  inputClassName = "brand-input pr-11",
  id,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const resolvedId = id ?? autoId;

  return (
    <label className={wrapperClassName ?? "grid gap-1"}>
      {label ? <span className="text-sm font-medium text-[#0f3a74]">{label}</span> : null}
      <div className="relative">
        <input
          {...inputProps}
          id={resolvedId}
          type={visible ? "text" : "password"}
          className={inputClassName}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#2d5f9a]"
          onClick={() => setVisible((prev) => !prev)}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
              <path d="M9.9 5.1A10.7 10.7 0 0 1 12 4c5 0 9 4 10 8a10.8 10.8 0 0 1-4.2 5.5" />
              <path d="M6.6 6.6A11.2 11.2 0 0 0 2 12c1 4 5 8 10 8a10.6 10.6 0 0 0 4.3-.9" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

