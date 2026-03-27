import { defaultLanguage, supportedLanguages, translateContent, type Language } from "@/lib/i18n";

export type AnnouncementLocalization = {
  title: string;
  content: string;
};

export type AnnouncementLocalizationMap = Partial<Record<Language, Partial<AnnouncementLocalization>>>;

export type AnnouncementLocalizedRecord = {
  title?: string | null;
  content?: string | null;
  sourceLanguage?: string | null;
  translations?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseAnnouncementLanguage(value: unknown): Language {
  return typeof value === "string" && supportedLanguages.includes(value as Language)
    ? (value as Language)
    : defaultLanguage;
}

export function parseAnnouncementTranslations(value: unknown): AnnouncementLocalizationMap {
  if (!isObject(value)) return {};

  const localized: AnnouncementLocalizationMap = {};
  for (const language of supportedLanguages) {
    const entry = value[language];
    if (!isObject(entry)) continue;

    const title = normalizeText(entry.title);
    const content = normalizeText(entry.content);

    if (!title && !content) continue;
    localized[language] = {
      ...(title ? { title } : {}),
      ...(content ? { content } : {}),
    };
  }

  return localized;
}

function getStoredAnnouncementValue(
  translations: AnnouncementLocalizationMap,
  language: Language,
  field: keyof AnnouncementLocalization
) {
  const entry = translations[language];
  if (!entry) return "";
  return normalizeText(entry[field]);
}

function getBaseAnnouncementValue(
  record: AnnouncementLocalizedRecord,
  sourceLanguage: Language,
  translations: AnnouncementLocalizationMap,
  field: keyof AnnouncementLocalization
) {
  const storedSourceValue = getStoredAnnouncementValue(translations, sourceLanguage, field);
  if (storedSourceValue) return storedSourceValue;
  return normalizeText(record[field]);
}

export function getAnnouncementLocalizedValue(
  record: AnnouncementLocalizedRecord,
  language: Language,
  field: keyof AnnouncementLocalization
) {
  const sourceLanguage = parseAnnouncementLanguage(record.sourceLanguage);
  const translations = parseAnnouncementTranslations(record.translations);
  const baseValue = getBaseAnnouncementValue(record, sourceLanguage, translations, field);
  if (!baseValue) return "";

  const storedValue = getStoredAnnouncementValue(translations, language, field);
  if (storedValue) return storedValue;

  if (language === sourceLanguage) {
    return baseValue;
  }

  return translateContent(language, baseValue);
}

export function getAnnouncementLocalization(
  record: AnnouncementLocalizedRecord,
  language: Language
): AnnouncementLocalization {
  return {
    title: getAnnouncementLocalizedValue(record, language, "title"),
    content: getAnnouncementLocalizedValue(record, language, "content"),
  };
}

export function createEmptyAnnouncementLocalizationDrafts(): Record<Language, AnnouncementLocalization> {
  return {
    en: { title: "", content: "" },
    fr: { title: "", content: "" },
  };
}

export function getAnnouncementLocalizationDrafts(
  record?: AnnouncementLocalizedRecord | null
): Record<Language, AnnouncementLocalization> {
  const drafts = createEmptyAnnouncementLocalizationDrafts();
  if (!record) return drafts;

  const sourceLanguage = parseAnnouncementLanguage(record.sourceLanguage);
  const translations = parseAnnouncementTranslations(record.translations);

  for (const language of supportedLanguages) {
    const storedTitle = getStoredAnnouncementValue(translations, language, "title");
    const storedContent = getStoredAnnouncementValue(translations, language, "content");

    if (storedTitle || storedContent) {
      drafts[language] = {
        title: storedTitle,
        content: storedContent,
      };
      continue;
    }

    if (language === sourceLanguage) {
      drafts[language] = getAnnouncementLocalization(record, language);
      continue;
    }

    const baseTitle = getAnnouncementLocalizedValue(record, sourceLanguage, "title");
    const baseContent = getAnnouncementLocalizedValue(record, sourceLanguage, "content");
    const translatedTitle = translateContent(language, baseTitle);
    const translatedContent = translateContent(language, baseContent);

    drafts[language] = {
      title: translatedTitle !== baseTitle ? translatedTitle : "",
      content: translatedContent !== baseContent ? translatedContent : "",
    };
  }

  return drafts;
}

export function buildAnnouncementLocalizationPayload(input: {
  sourceLanguage?: unknown;
  title?: unknown;
  content?: unknown;
  translations?: unknown;
}) {
  const sourceLanguage = parseAnnouncementLanguage(input.sourceLanguage);
  const translations = parseAnnouncementTranslations(input.translations);

  const sourceTitle = normalizeText(input.title) || getStoredAnnouncementValue(translations, sourceLanguage, "title");
  const sourceContent = normalizeText(input.content) || getStoredAnnouncementValue(translations, sourceLanguage, "content");

  if (!sourceTitle || !sourceContent) {
    return {
      error: "Provide both title and message for the primary language.",
    };
  }

  const normalizedTranslations: Record<Language, AnnouncementLocalization> = {
    ...createEmptyAnnouncementLocalizationDrafts(),
    [sourceLanguage]: {
      title: sourceTitle,
      content: sourceContent,
    },
  };

  for (const language of supportedLanguages) {
    if (language === sourceLanguage) continue;

    const title = getStoredAnnouncementValue(translations, language, "title");
    const content = getStoredAnnouncementValue(translations, language, "content");

    if ((title && !content) || (!title && content)) {
      return {
        error: `Provide both title and message for ${language.toUpperCase()}.`,
      };
    }

    if (title && content) {
      normalizedTranslations[language] = { title, content };
      continue;
    }

    const translatedTitle = translateContent(language, sourceTitle);
    const translatedContent = translateContent(language, sourceContent);
    normalizedTranslations[language] = {
      title: translatedTitle !== sourceTitle ? translatedTitle : "",
      content: translatedContent !== sourceContent ? translatedContent : "",
    };
  }

  return {
    data: {
      sourceLanguage,
      title: sourceTitle,
      content: sourceContent,
      translations: normalizedTranslations,
    },
  };
}
