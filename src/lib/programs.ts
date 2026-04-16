import { defaultLanguage, type Language } from "@/lib/i18n";
import {
  getProgramLocalizedValue,
  type ProgramLocalizedRecord,
} from "@/lib/programs-translations";

/** ProgramVisibility constants matching Prisma enum */
export const PROGRAM_VISIBILITY_DRAFT = "DRAFT" as const;
export const PROGRAM_VISIBILITY_PUBLISHED = "PUBLISHED" as const;

export type ProgramVisibilityValue = typeof PROGRAM_VISIBILITY_DRAFT | typeof PROGRAM_VISIBILITY_PUBLISHED;

export const PROGRAM_DESCRIPTION_MAX_LENGTH = 2000;
export const PROGRAM_FIELD_MAX_LENGTH = 120; // for description etc.

export const PROGRAM_CODE_MAX_LENGTH = 10;
export const PROGRAM_CONTENT_OVERVIEW_MAX_LENGTH = 3000;
export const PROGRAM_CONTENT_TUITION_MAX_LENGTH = 160;
export const PROGRAM_CONTENT_LIST_ITEM_MAX_LENGTH = 160;
export const PROGRAM_CONTENT_LIST_MAX_ITEMS = 50;

export type ProgramDetails = {
  overview: string | null;
  tuitionAndFees: string | null;
  curriculum: string[];
  admissionRequirements: string[];
  careerOpportunities: string[];
};

export const parseProgramVisibility = (value: unknown): ProgramVisibilityValue | null => {
  if (value === PROGRAM_VISIBILITY_DRAFT) return PROGRAM_VISIBILITY_DRAFT;
  if (value === PROGRAM_VISIBILITY_PUBLISHED) return PROGRAM_VISIBILITY_PUBLISHED;
  return null;
};

export const validateProgramTitle = (title: string): string | null => {
  const trimmed = title.trim();
  if (trimmed.length < 3) return "Title must be at least 3 characters.";
  if (trimmed.length > 120) return "Title must not exceed 120 characters.";
  if (!/^[a-zA-Z0-9\s\-\.,&'()]+$/.test(trimmed)) return "Title contains invalid characters.";
  return null;
};

export const generateProgramCodeCandidate = (title: string, nonce: number): string => {
  const words = title.toUpperCase().trim().split(/\s+/);
  const initials = words
    .slice(0, 4)
    .map((word) => word.slice(0, 2))
    .join("");
  const paddedNonce = nonce.toString().padStart(3, "0");
  return `PRG${initials.slice(0, 3)}${paddedNonce}`.slice(0, PROGRAM_CODE_MAX_LENGTH);
};

export const normalizeDescription = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PROGRAM_DESCRIPTION_MAX_LENGTH);
};

const normalizeProgramText = (input: unknown, maxLength: number) => {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  return value.slice(0, maxLength);
};

const normalizeProgramList = (input: unknown) => {
  if (!Array.isArray(input)) return [] as string[];
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, PROGRAM_CONTENT_LIST_MAX_ITEMS)
    .map((item) => item.slice(0, PROGRAM_CONTENT_LIST_ITEM_MAX_LENGTH));
  return Array.from(new Set(normalized));
};

export function normalizeProgramDetailsInput(
  input: unknown
): { ok: true; value: ProgramDetails | null } | { ok: false } {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false };
  }

  const value = input as Record<string, unknown>;
  const details: ProgramDetails = {
    overview: normalizeProgramText(value.overview, PROGRAM_CONTENT_OVERVIEW_MAX_LENGTH),
    tuitionAndFees: normalizeProgramText(value.tuitionAndFees, PROGRAM_CONTENT_TUITION_MAX_LENGTH),
    curriculum: normalizeProgramList(value.curriculum),
    admissionRequirements: normalizeProgramList(value.admissionRequirements),
    careerOpportunities: normalizeProgramList(value.careerOpportunities),
  };

  if (
    !details.overview &&
    !details.tuitionAndFees &&
    !details.curriculum.length &&
    !details.admissionRequirements.length &&
    !details.careerOpportunities.length
  ) {
    return { ok: true, value: null };
  }

  return { ok: true, value: details };
}

export function parseProgramContent(raw: string | null | undefined): ProgramDetails | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeProgramDetailsInput(parsed);
    if (!normalized.ok) return null;
    return normalized.value;
  } catch {
    return null;
  }
}

export function serializeProgramContent(details: ProgramDetails | null) {
  return details ? JSON.stringify(details) : null;
}

export {
  parseProgramLanguage as parseProgramSourceLanguage,
  getProgramLocalizedValue,
  getProgramLocalization,
  getProgramLocalizationDrafts,
  buildProgramLocalizationPayload,
} from "@/lib/programs-translations";

export function getProgramLocalizedTitle(record: ProgramLocalizedRecord, language: Language = defaultLanguage): string {
  return getProgramLocalizedValue(record, language, "title");
}

export function getProgramLocalizedDescription(record: ProgramLocalizedRecord, language: Language = defaultLanguage): string {
  return getProgramLocalizedValue(record, language, "description");
}

export function getProgramLocalizedProgramContent(record: ProgramLocalizedRecord, language: Language = defaultLanguage): string {
  return getProgramLocalizedValue(record, language, "programContent");
}
