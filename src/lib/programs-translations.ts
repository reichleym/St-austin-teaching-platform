import { defaultLanguage, supportedLanguages, translateContent, type Language } from "@/lib/i18n";

export type ProgramLocalization = {
  title: string;
  description?: string | null;
  overview?: string | null;
  curriculum?: string | null;
  admissionRequirements?: string | null;
  careerOpportunities?: string | null;
  programContent?: string | null;
};

export type ProgramLocalizationMap = Partial<Record<Language, Partial<ProgramLocalization>>>;

export type ProgramDetails = {
  overview?: string | null;
  curriculum?: string[];
  admissionRequirements?: string[];
  careerOpportunities?: string[];
};

export type ProgramLocalizedRecord = {
  title?: string | null;
  description?: string | null;
  programContent?: string | null;
  overview?: string | null;
  curriculum?: string | null;
  admissionRequirements?: string | null;
  careerOpportunities?: string | null;
  programDetails?: ProgramDetails | null;
  sourceLanguage?: string | null;
  translations?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseProgramLanguage(value: unknown): Language {
  return typeof value === "string" && supportedLanguages.includes(value as Language)
    ? (value as Language)
    : defaultLanguage;
}

function normalizeMultilineText(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return normalizeText(value);
}

export function parseProgramTranslations(value: unknown): ProgramLocalizationMap {
  if (!isObject(value)) return {};

  const localized: ProgramLocalizationMap = {};
  for (const language of supportedLanguages) {
    const entry = value[language];
    if (!isObject(entry)) continue;

    const title = normalizeText(entry.title);
    const description = normalizeText(entry.description);
    const overview = normalizeText(entry.overview);
    const curriculum = normalizeText(entry.curriculum);
    const admissionRequirements = normalizeText(entry.admissionRequirements);
    const careerOpportunities = normalizeText(entry.careerOpportunities);

    if (!title && !description && !overview && !curriculum && !admissionRequirements && !careerOpportunities) continue;
    localized[language] = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(overview ? { overview } : {}),
      ...(curriculum ? { curriculum } : {}),
      ...(admissionRequirements ? { admissionRequirements } : {}),
      ...(careerOpportunities ? { careerOpportunities } : {}),
    };
  }

  return localized;
}

function getStoredProgramValue(
  translations: ProgramLocalizationMap,
  language: Language,
  field: keyof ProgramLocalization
) {
  const entry = translations[language];
  if (!entry) return "";
  return normalizeText(entry[field]);
}

function toMultilineValue(value: string[] | undefined | null) {
  return value && value.length ? value.map((item) => item.trim()).filter(Boolean).join("\n") : "";
}

function parseProgramContentValue(raw: unknown, field: keyof ProgramLocalization) {
  if (typeof raw !== "string") return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (field === "overview") return normalizeText(parsed.overview);
    if (field === "curriculum") return toMultilineValue(Array.isArray(parsed.curriculum) ? parsed.curriculum.map((item) => (typeof item === "string" ? item : "")) : []);
    if (field === "admissionRequirements")
      return toMultilineValue(Array.isArray(parsed.admissionRequirements) ? parsed.admissionRequirements.map((item) => (typeof item === "string" ? item : "")) : []);
    if (field === "careerOpportunities")
      return toMultilineValue(Array.isArray(parsed.careerOpportunities) ? parsed.careerOpportunities.map((item) => (typeof item === "string" ? item : "")) : []);
    return normalizeText(parsed[field]);
  } catch {
    return "";
  }
}

function getBaseProgramValue(
  record: ProgramLocalizedRecord,
  sourceLanguage: Language,
  translations: ProgramLocalizationMap,
  field: keyof ProgramLocalization
) {
  const storedSourceValue = getStoredProgramValue(translations, sourceLanguage, field);
  if (storedSourceValue) return storedSourceValue;

  if (field === "overview") {
    if (record.programDetails) return normalizeText(record.programDetails.overview);
    return parseProgramContentValue(record.programContent, field);
  }

  if (field === "curriculum") {
    if (record.programDetails) return toMultilineValue(record.programDetails.curriculum);
    return parseProgramContentValue(record.programContent, field);
  }

  if (field === "admissionRequirements") {
    if (record.programDetails) return toMultilineValue(record.programDetails.admissionRequirements);
    return parseProgramContentValue(record.programContent, field);
  }

  if (field === "careerOpportunities") {
    if (record.programDetails) return toMultilineValue(record.programDetails.careerOpportunities);
    return parseProgramContentValue(record.programContent, field);
  }

  return normalizeText(record[field]);
}

export function getProgramLocalizedValue(
  record: ProgramLocalizedRecord,
  language: Language,
  field: keyof ProgramLocalization
) {
  const sourceLanguage = parseProgramLanguage(record.sourceLanguage);
  const translations = parseProgramTranslations(record.translations);
  const baseValue = getBaseProgramValue(record, sourceLanguage, translations, field);
  if (!baseValue) return "";

  const storedValue = getStoredProgramValue(translations, language, field);
  if (storedValue) return storedValue;

  if (language === sourceLanguage) {
    return baseValue;
  }

  return translateContent(language, baseValue);
}

export function getProgramLocalization(
  record: ProgramLocalizedRecord,
  language: Language
): ProgramLocalization {
  return {
    title: getProgramLocalizedValue(record, language, "title"),
    description: getProgramLocalizedValue(record, language, "description"),
    overview: getProgramLocalizedValue(record, language, "overview"),
    curriculum: getProgramLocalizedValue(record, language, "curriculum"),
    admissionRequirements: getProgramLocalizedValue(record, language, "admissionRequirements"),
    careerOpportunities: getProgramLocalizedValue(record, language, "careerOpportunities"),
  };
}

export function createEmptyProgramLocalizationDrafts(): Record<Language, ProgramLocalization> {
  return {
    en: {
      title: "",
      description: "",
      overview: "",
      curriculum: "",
      admissionRequirements: "",
      careerOpportunities: "",
      programContent: "",
    },
    fr: {
      title: "",
      description: "",
      overview: "",
      curriculum: "",
      admissionRequirements: "",
      careerOpportunities: "",
      programContent: "",
    },
  };
}

export function getProgramLocalizationDrafts(
  record?: ProgramLocalizedRecord | null
): Record<Language, ProgramLocalization> {
  const drafts = createEmptyProgramLocalizationDrafts();
  if (!record) return drafts;

  const sourceLanguage = parseProgramLanguage(record.sourceLanguage);
  const translations = parseProgramTranslations(record.translations);

  for (const language of supportedLanguages) {
    const storedTitle = getStoredProgramValue(translations, language, "title");
    const storedDesc = getStoredProgramValue(translations, language, "description");
    const storedOverview = getStoredProgramValue(translations, language, "overview");
    const storedCurriculum = getStoredProgramValue(translations, language, "curriculum");
    const storedAdmissionRequirements = getStoredProgramValue(translations, language, "admissionRequirements");
    const storedCareerOpportunities = getStoredProgramValue(translations, language, "careerOpportunities");

    if (
      storedTitle ||
      storedDesc ||
      storedOverview ||
      storedCurriculum ||
      storedAdmissionRequirements ||
      storedCareerOpportunities
    ) {
      drafts[language] = {
        title: storedTitle,
        description: storedDesc,
        overview: storedOverview,
        curriculum: storedCurriculum,
        admissionRequirements: storedAdmissionRequirements,
        careerOpportunities: storedCareerOpportunities,
      };
      continue;
    }

    if (language === sourceLanguage) {
      drafts[language] = getProgramLocalization(record, language);
      continue;
    }

    const baseTitle = getProgramLocalizedValue(record, sourceLanguage, "title");
    const baseDesc = getProgramLocalizedValue(record, sourceLanguage, "description");
    const baseOverview = getProgramLocalizedValue(record, sourceLanguage, "overview");
    const baseCurriculum = getProgramLocalizedValue(record, sourceLanguage, "curriculum");
    const baseAdmissionRequirements = getProgramLocalizedValue(record, sourceLanguage, "admissionRequirements");
    const baseCareerOpportunities = getProgramLocalizedValue(record, sourceLanguage, "careerOpportunities");
    const translatedTitle = translateContent(language, baseTitle);
    const translatedDesc = translateContent(language, baseDesc);
    const translatedOverview = translateContent(language, baseOverview);
    const translatedCurriculum = translateContent(language, baseCurriculum);
    const translatedAdmissionRequirements = translateContent(language, baseAdmissionRequirements);
    const translatedCareerOpportunities = translateContent(language, baseCareerOpportunities);

    drafts[language] = {
      title: translatedTitle !== baseTitle ? translatedTitle : "",
      description: translatedDesc !== baseDesc ? translatedDesc : "",
      overview: translatedOverview !== baseOverview ? translatedOverview : "",
      curriculum: translatedCurriculum !== baseCurriculum ? translatedCurriculum : "",
      admissionRequirements:
        translatedAdmissionRequirements !== baseAdmissionRequirements ? translatedAdmissionRequirements : "",
      careerOpportunities:
        translatedCareerOpportunities !== baseCareerOpportunities ? translatedCareerOpportunities : "",
    };
  }

  return drafts;
}

export function buildProgramLocalizationPayload(input: {
  sourceLanguage?: unknown;
  title?: unknown;
  description?: unknown;
  overview?: unknown;
  curriculum?: unknown;
  admissionRequirements?: unknown;
  careerOpportunities?: unknown;
  programContent?: unknown;
  translations?: unknown;
}) {
  const sourceLanguage = parseProgramLanguage(input.sourceLanguage);
  const translations = parseProgramTranslations(input.translations);

  const sourceTitle = normalizeText(input.title) || getStoredProgramValue(translations, sourceLanguage, "title");
  const sourceDesc = normalizeText(input.description) || getStoredProgramValue(translations, sourceLanguage, "description");
  const sourceOverview = normalizeText(input.overview) || getStoredProgramValue(translations, sourceLanguage, "overview");
  const sourceCurriculum = normalizeMultilineText(input.curriculum) || getStoredProgramValue(translations, sourceLanguage, "curriculum");
  const sourceAdmissionRequirements =
    normalizeMultilineText(input.admissionRequirements) || getStoredProgramValue(translations, sourceLanguage, "admissionRequirements");
  const sourceCareerOpportunities =
    normalizeMultilineText(input.careerOpportunities) || getStoredProgramValue(translations, sourceLanguage, "careerOpportunities");
  const sourceContent = normalizeText(input.programContent) || getStoredProgramValue(translations, sourceLanguage, "programContent");

  if (!sourceTitle) {
    return {
      error: "Title is required for the primary language.",
    };
  }

  const normalizedTranslations: Record<Language, ProgramLocalization> = {
    ...createEmptyProgramLocalizationDrafts(),
    [sourceLanguage]: {
      title: sourceTitle,
      description: sourceDesc,
      overview: sourceOverview,
      curriculum: sourceCurriculum,
      admissionRequirements: sourceAdmissionRequirements,
      careerOpportunities: sourceCareerOpportunities,
    },
  };

  for (const language of supportedLanguages) {
    if (language === sourceLanguage) continue;

    const title = getStoredProgramValue(translations, language, "title");
    const desc = getStoredProgramValue(translations, language, "description");
    const overview = getStoredProgramValue(translations, language, "overview");
    const curriculum = getStoredProgramValue(translations, language, "curriculum");
    const admissionRequirements = getStoredProgramValue(translations, language, "admissionRequirements");
    const careerOpportunities = getStoredProgramValue(translations, language, "careerOpportunities");

    // Optional fields OK if partial
    if (title || desc || overview || curriculum || admissionRequirements || careerOpportunities) {
      normalizedTranslations[language] = {
        title: title || "",
        description: desc || "",
        overview: overview || "",
        curriculum: curriculum || "",
        admissionRequirements: admissionRequirements || "",
        careerOpportunities: careerOpportunities || "",
      };
      continue;
    }

    const translatedTitle = translateContent(language, sourceTitle);
    const translatedDesc = sourceDesc ? translateContent(language, sourceDesc) : "";
    const translatedOverview = sourceOverview ? translateContent(language, sourceOverview) : "";
    const translatedCurriculum = sourceCurriculum ? translateContent(language, sourceCurriculum) : "";
    const translatedAdmissionRequirements = sourceAdmissionRequirements
      ? translateContent(language, sourceAdmissionRequirements)
      : "";
    const translatedCareerOpportunities = sourceCareerOpportunities
      ? translateContent(language, sourceCareerOpportunities)
      : "";
    normalizedTranslations[language] = {
      title: translatedTitle !== sourceTitle ? translatedTitle : "",
      description: translatedDesc !== sourceDesc ? translatedDesc : "",
      overview: translatedOverview !== sourceOverview ? translatedOverview : "",
      curriculum: translatedCurriculum !== sourceCurriculum ? translatedCurriculum : "",
      admissionRequirements:
        translatedAdmissionRequirements !== sourceAdmissionRequirements ? translatedAdmissionRequirements : "",
      careerOpportunities:
        translatedCareerOpportunities !== sourceCareerOpportunities ? translatedCareerOpportunities : "",
    };
  }

  return {
    data: {
      sourceLanguage,
      title: sourceTitle,
      description: sourceDesc,
      overview: sourceOverview,
      curriculum: sourceCurriculum,
      admissionRequirements: sourceAdmissionRequirements,
      careerOpportunities: sourceCareerOpportunities,
      programContent: sourceContent,
      translations: normalizedTranslations,
    },
  };
}

