import { defaultLanguage, supportedLanguages, type Language } from "@/lib/i18n";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export type LocalizedSectionContentEnvelope = {
  sourceLanguage: Language;
  translations: Record<Language, JsonObject>;
};

function parseLanguage(value: unknown, fallback: Language = defaultLanguage): Language {
  return supportedLanguages.includes(value as Language) ? (value as Language) : fallback;
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function stripEnvelopeFields(rawContent: unknown): JsonObject {
  if (!isJsonObject(rawContent)) return {};
  const rest: JsonObject = { ...rawContent };
  delete rest["sourceLanguage"];
  delete rest["translations"];
  return rest;
}

export function getLocalizedSectionEnvelopeDraft(rawContent: unknown): LocalizedSectionContentEnvelope {
  const sourceLanguage = parseLanguage(isJsonObject(rawContent) ? rawContent["sourceLanguage"] : undefined);

  const rawTranslationsCandidate = isJsonObject(rawContent) ? rawContent["translations"] : null;
  const rawTranslations = isJsonObject(rawTranslationsCandidate) ? (rawTranslationsCandidate as Record<string, unknown>) : null;

  const baseFallback = rawTranslations?.[sourceLanguage] ?? rawTranslations?.[defaultLanguage];
  const baseTranslation =
    baseFallback && typeof baseFallback === "object"
      ? (baseFallback as JsonObject)
      : stripEnvelopeFields(rawContent);

  const translations = {} as Record<Language, JsonObject>;

  for (const language of supportedLanguages) {
    const candidate = rawTranslations?.[language];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      translations[language] = deepClone(candidate as JsonObject);
      continue;
    }
    translations[language] = deepClone(baseTranslation);
  }

  return { sourceLanguage, translations };
}

export function resolveLocalizedSectionContent(rawContent: unknown, language: Language): JsonObject {
  if (!isJsonObject(rawContent)) return {};

  const rawTranslationsCandidate = rawContent["translations"];
  const rawTranslations = isJsonObject(rawTranslationsCandidate) ? (rawTranslationsCandidate as Record<string, unknown>) : null;

  if (!rawTranslations) {
    return rawContent as JsonObject;
  }

  const sourceLanguage = parseLanguage(rawContent["sourceLanguage"]);

  const candidate =
    rawTranslations[language] ??
    rawTranslations[sourceLanguage] ??
    rawTranslations[defaultLanguage] ??
    Object.values(rawTranslations)[0];

  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? (candidate as JsonObject) : {};
}
