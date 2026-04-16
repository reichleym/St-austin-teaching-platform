import { defaultLanguage, supportedLanguages, translateContent, type Language } from "@/lib/i18n";

export type CalendarEventLocalization = {
  title: string;
};

export type CalendarEventLocalizationMap = Partial<Record<Language, Partial<CalendarEventLocalization>>>;

export type CalendarEventLocalizedRecord = {
  title?: string | null;
  sourceLanguage?: string | null;
  titleTranslations?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCalendarEventLanguage(value: unknown): Language {
  return typeof value === "string" && supportedLanguages.includes(value as Language)
    ? (value as Language)
    : defaultLanguage;
}

export function parseCalendarEventTranslations(value: unknown): CalendarEventLocalizationMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const localized: CalendarEventLocalizationMap = {};
  for (const language of supportedLanguages) {
    const entry = (value as Record<string, unknown>)[language];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;

    const title = normalizeText((entry as Record<string, unknown>).title);
    if (title) {
      localized[language] = { title };
    }
  }

  return localized;
}

function getStoredCalendarEventValue(
  translations: CalendarEventLocalizationMap,
  language: Language
) {
  const entry = translations[language];
  if (!entry) return "";
  return normalizeText(entry.title);
}

export function getCalendarEventLocalizedTitle(
  record: CalendarEventLocalizedRecord,
  language: Language
): string {
  const sourceLanguage = parseCalendarEventLanguage(record.sourceLanguage);
  const translations = parseCalendarEventTranslations(record.titleTranslations);
  const baseTitle = normalizeText(record.title);
  if (!baseTitle) return "";

  const storedValue = getStoredCalendarEventValue(translations, language);
  if (storedValue) return storedValue;

  if (language === sourceLanguage) {
    return baseTitle;
  }

  return translateContent(language, baseTitle);
}

