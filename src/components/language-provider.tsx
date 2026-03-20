"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { defaultLanguage, supportedLanguages, translate, type Language } from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "st_austin_language";
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return defaultLanguage;
  const candidate = navigator.language?.toLowerCase() ?? "";
  if (candidate.startsWith("fr")) return "fr";
  return defaultLanguage;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    if (stored && supportedLanguages.includes(stored as Language)) {
      setLanguageState(stored as Language);
      return;
    }
    const detected = resolveBrowserLanguage();
    setLanguageState(detected);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}`;
    if (document?.documentElement) {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      setLanguage: setLanguageState,
      t: (key, vars, fallback) => translate(language, key, vars, fallback),
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
