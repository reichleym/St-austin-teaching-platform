import { defaultLanguage, type Language } from "@/lib/i18n";
import {
  getCareerLocalization,
  parseCareerTranslations,
  type CareerLocalizationMap,
  type CareerLocalizedRecord,
} from "@/lib/career-translations";

export const universityCareerRoles = ["SUPER_ADMIN"] as const;
export type UniversityCareerRole = (typeof universityCareerRoles)[number];

export type UniversityCareer = {
  id: string;
  title: string;
  description: string;
  sourceTitle?: string;
  sourceDescription?: string;
  sourceLanguage?: Language;
  translations?: CareerLocalizationMap;
  isActive: boolean;
};

const idPattern = /^[a-zA-Z0-9_-]{4,20}$/;
const titleMaxLength = 100;
const descriptionMaxLength = 500;

function createCareerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 20);
  }
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function createNewCareer(): UniversityCareer {
  return {
    id: createCareerId(),
    title: "",
    description: "",
    sourceTitle: "",
    sourceDescription: "",
    sourceLanguage: defaultLanguage,
    translations: {},
    isActive: true,
  };
}

function normalizeCareer(input: unknown): UniversityCareer | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  
  const record = input as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const sourceTitle =
    typeof record.sourceTitle === "string" && record.sourceTitle.trim()
      ? record.sourceTitle.trim()
      : typeof record.title === "string"
        ? record.title.trim()
        : "";
  const sourceDescription =
    typeof record.sourceDescription === "string" && record.sourceDescription.trim()
      ? record.sourceDescription.trim()
      : typeof record.description === "string"
        ? record.description.trim()
        : "";
  const sourceLanguage =
    typeof record.sourceLanguage === "string" ? (record.sourceLanguage.trim() as Language) : defaultLanguage;
  const translationsInput = record.translations ?? record.titleTranslations ?? record.descriptionTranslations;
  const parsedTranslations = parseCareerTranslations(translationsInput);
  const localized = getCareerLocalization(
    {
      title: sourceTitle,
      description: sourceDescription,
      sourceLanguage,
      translations: parsedTranslations,
    } satisfies CareerLocalizedRecord,
    defaultLanguage
  );
  const isActive = record.isActive === true;

  if (
    !id ||
    !idPattern.test(id) ||
    !localized.title ||
    localized.title.length > titleMaxLength ||
    !localized.description ||
    localized.description.length > descriptionMaxLength
  ) {
    return null;
  }

  return { 
    id, 
    title: localized.title, 
    description: localized.description, 
    sourceTitle, 
    sourceDescription, 
    translations: parsedTranslations,
    sourceLanguage, 
    isActive 
  };
}

export function normalizeUniversityCareers(input: unknown): UniversityCareer[] {
  if (!Array.isArray(input)) return [];

  const validCareers: UniversityCareer[] = [];
  for (let i = 0; i < input.length; i++) {
    const career = normalizeCareer(input[i]);
    if (career) validCareers.push(career);
  }

  // Remove duplicates by ID
  const unique = new Map<string, UniversityCareer>();
  for (const career of validCareers) {
    unique.set(career.id, career);
  }

  return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export { createNewCareer };
