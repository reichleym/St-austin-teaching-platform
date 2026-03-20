import { cookies } from "next/headers";
import { defaultLanguage, supportedLanguages, translate, type Language } from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "st_austin_language";

export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  const value = cookieStore?.get?.(LANGUAGE_STORAGE_KEY)?.value;
  if (value && supportedLanguages.includes(value as Language)) {
    return value as Language;
  }
  return defaultLanguage;
}

export async function createServerTranslator() {
  const language = await getServerLanguage();
  return (key: string, vars?: Record<string, string | number>, fallback?: string) =>
    translate(language, key, vars, fallback);
}
