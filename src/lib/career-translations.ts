import { defaultLanguage, supportedLanguages, translateContent, type Language } from "@/lib/i18n";

export type CareerLocalization = {
  title: string;
  description: string;
};

export type CareerLocalizationMap = Partial<Record<Language, Partial<CareerLocalization>>>;

export type CareerLocalizedRecord = {
  title?: string | null;
  description?: string | null;
  sourceLanguage?: string | null;
  translations?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCareerLanguage(value: unknown): Language {
  return typeof value === "string" && supportedLanguages.includes(value as Language)
    ? (value as Language)
    : defaultLanguage;
}

export function parseCareerTranslations(value: unknown): CareerLocalizationMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const localized: CareerLocalizationMap = {};
  for (const language of supportedLanguages) {
    const entry = (value as Record<string, unknown>)[language];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;

    const title = normalizeText((entry as Record<string, unknown>).title);
    const description = normalizeText((entry as Record<string, unknown>).description);

    if (title || description) {
      localized[language] = {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      };
    }
  }

  return localized;
}

function getStoredCareerValue(
  translations: CareerLocalizationMap,
  language: Language,
  field: keyof CareerLocalization
) {
  const entry = translations[language];
  if (!entry) return "";
  return normalizeText(entry[field]);
}

function getBaseCareerValue(
  record: CareerLocalizedRecord,
  sourceLanguage: Language,
  translations: CareerLocalizationMap,
  field: keyof CareerLocalization
) {
  const storedSourceValue = getStoredCareerValue(translations, sourceLanguage, field);
  if (storedSourceValue) return storedSourceValue;
  return normalizeText(record[field]);
}

export function getCareerLocalizedValue(
  record: CareerLocalizedRecord,
  language: Language,
  field: keyof CareerLocalization
) {
  const sourceLanguage = parseCareerLanguage(record.sourceLanguage);
  const translations = parseCareerTranslations(record.translations);
  const baseValue = getBaseCareerValue(record, sourceLanguage, translations, field);
  if (!baseValue) return "";

  const storedValue = getStoredCareerValue(translations, language, field);
  if (storedValue) return storedValue;

  if (language === sourceLanguage) {
    return baseValue;
  }

  return translateContent(language, baseValue);
}

export function getCareerLocalization(
  record: CareerLocalizedRecord,
  language: Language
): CareerLocalization {
  return {
    title: getCareerLocalizedValue(record, language, "title"),
    description: getCareerLocalizedValue(record, language, "description"),
  };
}

