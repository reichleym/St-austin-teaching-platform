import { EnrollmentStatus, Role } from "@prisma/client";

export const COURSE_CODE_MIN_LENGTH = 2;
export const COURSE_CODE_MAX_LENGTH = 24;
export const COURSE_TITLE_MAX_LENGTH = 120;
export const COURSE_DESCRIPTION_MAX_LENGTH = 2000;
export const COURSE_VISIBILITY_DRAFT = "DRAFT" as const;
export const COURSE_VISIBILITY_PUBLISHED = "PUBLISHED" as const;
export type CourseVisibilityValue = typeof COURSE_VISIBILITY_DRAFT | typeof COURSE_VISIBILITY_PUBLISHED;
export const MODULE_VISIBILITY_ALL = "ALL_VISIBLE" as const;
export const MODULE_VISIBILITY_LIMITED = "LIMITED_ACCESS" as const;
export type ModuleVisibilityValue = typeof MODULE_VISIBILITY_ALL | typeof MODULE_VISIBILITY_LIMITED;
export const LESSON_VISIBILITY_VISIBLE = "VISIBLE" as const;
export const LESSON_VISIBILITY_HIDDEN = "HIDDEN" as const;
export type LessonVisibilityValue = typeof LESSON_VISIBILITY_VISIBLE | typeof LESSON_VISIBILITY_HIDDEN;

export function isTeacherRole(role: Role | string | undefined | null) {
  return role === Role.TEACHER || role === "TEACHER";
}

export function normalizeCourseCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

export function generateCourseCodeCandidate(title: string, nonce: number) {
  const normalizedTitle = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = (normalizedTitle || "COURSE").slice(0, 14);
  const suffix = nonce.toString().padStart(4, "0");
  return `${prefix}-${suffix}`.slice(0, COURSE_CODE_MAX_LENGTH);
}

export function validateCourseCode(code: string) {
  if (!code) return "Course code is required.";
  if (code.length < COURSE_CODE_MIN_LENGTH || code.length > COURSE_CODE_MAX_LENGTH) {
    return `Course code must be between ${COURSE_CODE_MIN_LENGTH} and ${COURSE_CODE_MAX_LENGTH} characters.`;
  }
  if (!/^[A-Z0-9-]+$/.test(code)) {
    return "Course code may only contain letters, numbers, and hyphens.";
  }
  return null;
}

export function validateCourseTitle(title: string) {
  if (!title) return "Course title is required.";
  if (title.length > COURSE_TITLE_MAX_LENGTH) {
    return `Course title must not exceed ${COURSE_TITLE_MAX_LENGTH} characters.`;
  }
  return null;
}

export function normalizeDescription(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, COURSE_DESCRIPTION_MAX_LENGTH);
}

export function parseEnrollmentStatus(input: unknown): EnrollmentStatus | null {
  if (input === EnrollmentStatus.ACTIVE) return EnrollmentStatus.ACTIVE;
  if (input === EnrollmentStatus.DROPPED) return EnrollmentStatus.DROPPED;
  if (input === EnrollmentStatus.COMPLETED) return EnrollmentStatus.COMPLETED;
  return null;
}

export function parseCourseVisibility(input: unknown): CourseVisibilityValue | null {
  if (input === COURSE_VISIBILITY_DRAFT) return COURSE_VISIBILITY_DRAFT;
  if (input === COURSE_VISIBILITY_PUBLISHED) return COURSE_VISIBILITY_PUBLISHED;
  return null;
}

export function parseModuleVisibility(input: unknown): ModuleVisibilityValue | null {
  if (input === MODULE_VISIBILITY_ALL) return MODULE_VISIBILITY_ALL;
  if (input === MODULE_VISIBILITY_LIMITED) return MODULE_VISIBILITY_LIMITED;
  return null;
}

export function parseLessonVisibility(input: unknown): LessonVisibilityValue | null {
  if (input === LESSON_VISIBILITY_VISIBLE) return LESSON_VISIBILITY_VISIBLE;
  if (input === LESSON_VISIBILITY_HIDDEN) return LESSON_VISIBILITY_HIDDEN;
  return null;
}

export function parseCourseDateInput(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function validateCourseDuration(startDate: Date, endDate: Date) {
  if (startDate > endDate) {
    return "Course start date cannot be after end date.";
  }
  return null;
}
