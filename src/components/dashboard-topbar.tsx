import { LogoutButton } from "@/components/logout-button";

type DashboardTopbarProps = {
  name?: string | null;
  email?: string | null;
  role: string;
};

export function DashboardTopbar({ name, email, role }: DashboardTopbarProps) {
  const displayName = name?.trim() || email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const roleKey = String(role);
  const roleLabel =
    roleKey === "SUPER_ADMIN"
      ? "SUPER ADMIN"
      : roleKey === "DEPARTMENT_HEAD"
        ? "DEPARTMENT HEAD"
        : roleKey;

  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <div className="hidden min-w-0 md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3f70ae]">Workspace</p>
        <p className="truncate text-lg font-semibold text-[#083672]">Welcome back, {displayName}</p>
      </div>
      <section className="brand-glass w-full max-w-md p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#0f62c2] to-[#003b8f] text-sm font-bold text-white shadow-[0_8px_20px_rgba(0,59,143,0.35)]">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#fff7dc] p-1">
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-[#845d00]" fill="currentColor" aria-hidden="true">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4Z" />
                </svg>
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#083672]">{displayName}</p>
              <p className="truncate text-xs text-[#2e5f9e]">{email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="brand-chip brand-chip-accent">{roleLabel}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2d66a6]">
                  <span className="h-2 w-2 rounded-full bg-[#2db36b]" />
                  Online
                </span>
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </section>
    </header>
  );
}
