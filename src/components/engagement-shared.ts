"use client";

export type AppRole = "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "TEACHER" | "STUDENT" | "ADMIN";

export const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const formatEngagementStatus = (value: "COMPLETED" | "PARTIAL" | "NOT_PARTICIPATED") =>
  value.replace(/_/g, " ");

export const getPostingBlockReason = (
  discussion: { openAt: string | null; closeAt: string | null; allowLate: boolean; isLocked: boolean } | null,
  canModerate: boolean
) => {
  if (!discussion) return null;
  if (canModerate) return null;
  if (discussion.isLocked) return "Discussion is locked.";
  const now = new Date();
  if (discussion.openAt) {
    const openAt = new Date(discussion.openAt);
    if (!Number.isNaN(openAt.getTime()) && now < openAt) {
      return "Discussion is not open yet.";
    }
  }
  if (discussion.closeAt && !discussion.allowLate) {
    const closeAt = new Date(discussion.closeAt);
    if (!Number.isNaN(closeAt.getTime()) && now > closeAt) {
      return "Discussion is closed.";
    }
  }
  return null;
};
