"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { ToastMessage } from "@/components/toast-message";

type UserStatus = "ACTIVE" | "DISABLED";

const USER_STATUS = {
  ACTIVE: "ACTIVE" as UserStatus,
  DISABLED: "DISABLED" as UserStatus,
};

type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  studentId?: string | null;
  status: UserStatus;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  country: string | null;
  state: string | null;
  role: string;
  createdAt: string;
};

type Props = {
  title: string;
  emptyText: string;
  users: ManagedUser[];
};

type Draft = {
  name: string;
  email: string;
  studentId: string;
  status: UserStatus;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  country: string;
  state: string;
};

type LocationOption = {
  name: string;
  code: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRoleLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function AdminUserManagementTable({ title, emptyText, users }: Props) {
  const [rows, setRows] = useState(users);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickDraft, setQuickDraft] = useState<Draft>({
    name: "",
    email: "",
    studentId: "",
    status: USER_STATUS.ACTIVE,
    phone: "",
    guardianName: "",
    guardianPhone: "",
    country: "",
    state: "",
  });
  const [fullEditUserId, setFullEditUserId] = useState<string | null>(null);
  const [fullDraft, setFullDraft] = useState<Draft>({
    name: "",
    email: "",
    studentId: "",
    status: USER_STATUS.ACTIVE,
    phone: "",
    guardianName: "",
    guardianPhone: "",
    country: "",
    state: "",
  });
  const [countries, setCountries] = useState<LocationOption[]>([]);
  const [fullStates, setFullStates] = useState<LocationOption[]>([]);
  const [isCountriesLoading, setIsCountriesLoading] = useState(false);
  const [isStatesLoading, setIsStatesLoading] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const [isFullSaving, setIsFullSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const activeCount = useMemo(() => rows.filter((item) => item.status === USER_STATUS.ACTIVE).length, [rows]);
  const fullEditUser = useMemo(() => rows.find((item) => item.id === fullEditUserId) ?? null, [rows, fullEditUserId]);
  const visibleCountries = useMemo(() => {
    if (!fullDraft.country || countries.some((item) => item.name === fullDraft.country)) {
      return countries;
    }
    return [{ name: fullDraft.country, code: fullDraft.country }, ...countries];
  }, [countries, fullDraft.country]);

  const visibleStates = useMemo(() => {
    if (!fullDraft.state || fullStates.some((item) => item.name === fullDraft.state)) {
      return fullStates;
    }
    return [{ name: fullDraft.state, code: fullDraft.state }, ...fullStates];
  }, [fullDraft.state, fullStates]);
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) => {
      const name = (item.name ?? "").toLowerCase();
      const email = item.email.toLowerCase();
      const phone = (item.phone ?? "").toLowerCase();
      const studentId = (item.studentId ?? "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query) || studentId.includes(query);
    });
  }, [rows, searchTerm]);
  const totalFiltered = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalFiltered);
  const pagedRows = useMemo(() => filteredRows.slice(pageStart, pageEnd), [filteredRows, pageStart, pageEnd]);

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      if (active) setIsCountriesLoading(true);
      try {
        const response = await fetch("/api/locations");
        const raw = await response.text();
        const result = raw ? (JSON.parse(raw) as { countries?: LocationOption[] }) : {};
        if (active) {
          setCountries(result.countries ?? []);
        }
      } catch {
        if (active) setCountries([]);
      } finally {
        if (active) setIsCountriesLoading(false);
      }
    };
    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const onQuickEdit = (user: ManagedUser) => {
    setError("");
    setQuickEditId(user.id);
    setQuickDraft({
      name: user.name ?? "",
      email: user.email,
      studentId: user.studentId ?? "",
      status: user.status,
      phone: user.phone ?? "",
      guardianName: user.guardianName ?? "",
      guardianPhone: user.guardianPhone ?? "",
      country: user.country ?? "",
      state: user.state ?? "",
    });
  };

  const onQuickCancel = () => {
    setQuickEditId(null);
    setError("");
    setQuickDraft({
      name: "",
      email: "",
      studentId: "",
      status: USER_STATUS.ACTIVE,
      phone: "",
      guardianName: "",
      guardianPhone: "",
      country: "",
      state: "",
    });
  };

  const loadStatesForCountry = async (country: string) => {
    setIsStatesLoading(true);
    let countryPool = countries;
    let selectedCountry = countryPool.find((item) => item.name === country);

    if (!selectedCountry) {
      try {
        const countriesResponse = await fetch("/api/locations");
        const countriesRaw = await countriesResponse.text();
        const countriesResult = countriesRaw ? (JSON.parse(countriesRaw) as { countries?: LocationOption[] }) : {};
        countryPool = countriesResult.countries ?? [];
        setCountries(countryPool);
        selectedCountry = countryPool.find((item) => item.name === country);
      } catch {
        setFullStates([]);
        setIsStatesLoading(false);
        return;
      }
    }

    if (!selectedCountry) {
      setFullStates([]);
      setIsStatesLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/locations?countryCode=${encodeURIComponent(selectedCountry.code)}`);
      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { states?: LocationOption[] }) : {};
      setFullStates(result.states ?? []);
    } catch {
      setFullStates([]);
    } finally {
      setIsStatesLoading(false);
    }
  };

  const onFullEdit = async (user: ManagedUser) => {
    setError("");
    setFullEditUserId(user.id);
    setFullDraft({
      name: user.name ?? "",
      email: user.email,
      studentId: user.studentId ?? "",
      status: user.status,
      phone: user.phone ?? "",
      guardianName: user.guardianName ?? "",
      guardianPhone: user.guardianPhone ?? "",
      country: user.country ?? "",
      state: user.state ?? "",
    });
    if (user.country) {
      await loadStatesForCountry(user.country);
    } else {
      setFullStates([]);
    }
  };

  const onFullCancel = () => {
    setFullEditUserId(null);
    setError("");
    setFullDraft({
      name: "",
      email: "",
      studentId: "",
      status: USER_STATUS.ACTIVE,
      phone: "",
      guardianName: "",
      guardianPhone: "",
      country: "",
      state: "",
    });
    setFullStates([]);
  };

  const saveUser = async (userId: string, draft: Draft, includeStudentId: boolean) => {
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name: draft.name,
        email: draft.email,
        status: draft.status,
        phone: draft.phone,
        guardianName: draft.guardianName,
        guardianPhone: draft.guardianPhone,
        country: draft.country,
        state: draft.state,
      };
      if (includeStudentId) {
        payload.studentId = draft.studentId;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      const result = raw ? (JSON.parse(raw) as { error?: string; user?: ManagedUser }) : {};

      if (!response.ok || !result.user) {
        setError(result.error ?? "Unable to update user.");
        return false;
      }

      setRows((prev) => prev.map((item) => (item.id === result.user!.id ? result.user! : item)));
      return true;
    } catch {
      setError("Unable to update user.");
      return false;
    }
  };

  const onQuickSave = async (userId: string) => {
    setIsQuickSaving(true);
    const ok = await saveUser(userId, quickDraft, false);
    if (ok) {
      onQuickCancel();
    }
    setIsQuickSaving(false);
  };

  const onFullSave = async () => {
    if (!fullEditUserId) return;
    setIsFullSaving(true);
    const ok = await saveUser(fullEditUserId, fullDraft, fullEditUser?.role === "STUDENT");
    if (ok) {
      onFullCancel();
    }
    setIsFullSaving(false);
  };

  const isStudentFullEdit = fullEditUser?.role === "STUDENT";
  const isTeacherFullEdit = fullEditUser?.role === "TEACHER" || fullEditUser?.role === "DEPARTMENT_HEAD";
  const viewTitle = title.toLowerCase();
  const isStudentView = viewTitle.includes("student");
  const isDepartmentHeadView = viewTitle.includes("department");
  const isTeacherView = viewTitle.includes("teacher");
  const isAdminView = viewTitle.includes("admin");
  const entityLabel = isDepartmentHeadView ? "Department Heads" : isTeacherView ? "Teachers" : isAdminView ? "Admins" : "Students";
  const totalLabel = `Total ${entityLabel}`;
  const activeLabel = `Active ${entityLabel}`;
  const searchPlaceholder = isStudentView
    ? "Search by name, email, phone, or student ID"
    : "Search by name, email, or phone";

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="brand-card p-5">
          <p className="brand-section-title">{totalLabel}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{rows.length}</p>
        </article>
        <article className="brand-card p-5">
          <p className="brand-section-title">{activeLabel}</p>
          <p className="mt-2 text-3xl font-black text-[#0b3e81]">{activeCount}</p>
        </article>
      </div>

      {!fullEditUser ? (
        <section className="brand-card overflow-x-auto p-5">
          <p className="brand-section-title">{title}</p>
          <div className="mt-3 flex justify-end">
            <label className="grid gap-1.5">
              <span className="brand-label">Search Users</span>
              <input
                className="brand-input w-[220px] max-w-full"
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
              />
            </label>
          </div>
          <ToastMessage type="error" message={error} />

          {totalFiltered ? (
            <table className="mt-3 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#d2e4fb] text-[#285f9f]">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  {isStudentView ? <th className="px-3 py-2 font-semibold">Student ID</th> : null}
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((user) => {
                  const quickEditing = quickEditId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-[#e7f0fc] text-[#0d3f80]">
                      <td className="px-3 py-2">
                        {quickEditing ? (
                          <input
                            className="brand-input min-w-[180px]"
                            aria-label={`Name for ${user.email}`}
                            value={quickDraft.name}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setQuickDraft((prev) => ({ ...prev, name: value }));
                            }}
                          />
                        ) : (
                          user.name?.trim() || "No name"
                        )}
                      </td>
                      {isStudentView ? (
                        <td className="px-3 py-2">{user.studentId || "-"}</td>
                      ) : null}
                      <td className="px-3 py-2">
                        {quickEditing ? (
                          <input
                            className="brand-input min-w-[220px]"
                            type="email"
                            aria-label={`Email for ${user.name || user.email}`}
                            value={quickDraft.email}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setQuickDraft((prev) => ({ ...prev, email: value }));
                            }}
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {quickEditing ? (
                          <select
                            className="brand-input min-w-[140px]"
                            aria-label={`Status for ${user.name || user.email}`}
                            value={quickDraft.status}
                            onChange={(event) => {
                              const value = event.currentTarget.value as UserStatus;
                              setQuickDraft((prev) => ({ ...prev, status: value }));
                            }}
                          >
                            <option value={USER_STATUS.ACTIVE}>ACTIVE</option>
                            <option value={USER_STATUS.DISABLED}>DISABLED</option>
                          </select>
                        ) : (
                          user.status
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-2">
                        {quickEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-md bg-[#0b3e81] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              onClick={() => onQuickSave(user.id)}
                              disabled={isQuickSaving}
                            >
                              {isQuickSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                              onClick={onQuickCancel}
                              disabled={isQuickSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isStudentView ? (
                              <Link
                                href={`/dashboard/progress?studentId=${encodeURIComponent(user.id)}`}
                                className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                              >
                                Progress
                              </Link>
                            ) : null}
                            <button
                              className="rounded-md border border-[#9bbfed] px-3 py-1.5 text-xs font-semibold text-[#1f518f]"
                              onClick={() => onQuickEdit(user)}
                            >
                              Quick Edit
                            </button>
                            <button
                              className="rounded-md bg-[#0b3e81] px-3 py-1.5 text-xs font-semibold text-white"
                              onClick={() => onFullEdit(user)}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="brand-muted mt-3 text-sm">{emptyText}</p>
          )}

          {totalFiltered ? (
            <div className="mt-4 flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
              <p className="text-[#1f518f]">
                Total: <span className="font-semibold">{rows.length}</span> | Showing:{" "}
                <span className="font-semibold">{totalFiltered ? `${pageStart + 1}-${pageEnd}` : "0"}</span> of{" "}
                <span className="font-semibold">{totalFiltered}</span>
              </p>
              <div className="flex items-center gap-2 text-[#1f518f]">
                <label className="inline-flex items-center gap-2">
                  <span>Show</span>
                  <select
                    className="brand-input min-w-[92px]"
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.currentTarget.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[#1f518f]">
                  Page <span className="font-semibold">{safePage}</span> of <span className="font-semibold">{pageCount}</span>
                </p>
                <button
                  className="rounded-md border border-[#9bbfed] px-3 py-1.5 font-semibold text-[#1f518f] disabled:opacity-50"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button
                  className="rounded-md border border-[#9bbfed] px-3 py-1.5 font-semibold text-[#1f518f] disabled:opacity-50"
                  disabled={safePage >= pageCount}
                  onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {fullEditUser ? (
        <section className="brand-card p-5">
          <p className="brand-section-title">Edit User</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="brand-label">Name</span>
              <input
                className="brand-input"
                value={fullDraft.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setFullDraft((prev) => ({ ...prev, name: value }));
                }}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Email</span>
              <input
                className="brand-input"
                type="email"
                value={fullDraft.email}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setFullDraft((prev) => ({ ...prev, email: value }));
                }}
              />
            </label>
            {isStudentFullEdit ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Student ID</span>
                <input
                  className="brand-input"
                  value={fullDraft.studentId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFullDraft((prev) => ({ ...prev, studentId: value }));
                  }}
                  placeholder="STU-0001"
                />
                <span className="text-xs text-[#3a689f]">Assigned by admin during registration.</span>
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="brand-label">Status</span>
              <select
                className="brand-input"
                value={fullDraft.status}
                onChange={(event) => {
                  const value = event.currentTarget.value as UserStatus;
                  setFullDraft((prev) => ({ ...prev, status: value }));
                }}
              >
                <option value={USER_STATUS.ACTIVE}>ACTIVE</option>
                <option value={USER_STATUS.DISABLED}>DISABLED</option>
              </select>
            </label>
            {isStudentFullEdit || isTeacherFullEdit ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Phone</span>
                <input
                  className="brand-input"
                  value={fullDraft.phone}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFullDraft((prev) => ({ ...prev, phone: value }));
                  }}
                />
              </label>
            ) : null}
            {isStudentFullEdit ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Guardian Name</span>
                <input
                  className="brand-input"
                  value={fullDraft.guardianName}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFullDraft((prev) => ({ ...prev, guardianName: value }));
                  }}
                />
              </label>
            ) : null}
            {isStudentFullEdit ? (
              <label className="grid gap-1.5">
                <span className="brand-label">Guardian Phone</span>
                <input
                  className="brand-input"
                  value={fullDraft.guardianPhone}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFullDraft((prev) => ({ ...prev, guardianPhone: value }));
                  }}
                />
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="brand-label">Country</span>
              <select
                className="brand-input"
                value={fullDraft.country}
                disabled={isCountriesLoading}
                onChange={async (event) => {
                  const value = event.currentTarget.value;
                  setFullDraft((prev) => ({ ...prev, country: value, state: "" }));
                  if (value) {
                    await loadStatesForCountry(value);
                  } else {
                    setFullStates([]);
                  }
                }}
              >
                <option value="">Select country</option>
                {visibleCountries.map((country) => (
                  <option key={country.code} value={country.name}>
                    {country.name}
                  </option>
                ))}
              </select>
              {isCountriesLoading ? (
                <div className="mt-2">
                  <LoadingIndicator label="Loading countries..." lines={1} />
                </div>
              ) : null}
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">State</span>
              <select
                className="brand-input"
                value={fullDraft.state}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setFullDraft((prev) => ({ ...prev, state: value }));
                }}
                disabled={!fullDraft.country || isStatesLoading}
              >
                <option value="">Select state</option>
                {visibleStates.map((state) => (
                  <option key={state.code} value={state.name}>
                    {state.name}
                  </option>
                ))}
              </select>
              {isStatesLoading ? (
                <div className="mt-2">
                  <LoadingIndicator label="Loading states..." lines={1} />
                </div>
              ) : null}
            </label>
            <label className="grid gap-1.5">
              <span className="brand-label">Role</span>
              <input className="brand-input" value={formatRoleLabel(fullEditUser.role)} disabled />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="brand-label">User ID</span>
              <input className="brand-input" value={fullEditUser.id} disabled />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="brand-label">Created</span>
              <input className="brand-input" value={formatDate(fullEditUser.createdAt)} disabled />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn-brand-primary px-4 py-2 text-sm font-semibold" onClick={onFullSave} disabled={isFullSaving}>
              {isFullSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="rounded-md border border-[#9bbfed] px-4 py-2 text-sm font-semibold text-[#1f518f]"
              onClick={onFullCancel}
              disabled={isFullSaving}
            >
              Close
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
