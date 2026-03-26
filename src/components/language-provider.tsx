"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultLanguage, supportedLanguages, translate, type Language } from "@/lib/i18n";

const LANGUAGE_STORAGE_KEY = "st_austin_language";
const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, vars?: Record<string, string | number>, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function persistLanguage(language: Language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  document.cookie = `${LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}`;
  if (document?.documentElement) {
    document.documentElement.lang = language;
  }
}

function resolveBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return defaultLanguage;
  const candidate = navigator.language?.toLowerCase() ?? "";
  if (candidate.startsWith("fr")) return "fr";
  return defaultLanguage;
}

export function LanguageProvider({
  children,
  initialLanguage = defaultLanguage,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const applyLanguage = useCallback(
    (nextLanguage: Language, refreshServer = false) => {
      setLanguageState(nextLanguage);
      persistLanguage(nextLanguage);
      if (refreshServer) {
        router.refresh();
      }
    },
    [router]
  );

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    let resolvedLanguage = initialLanguage;

    if (stored && supportedLanguages.includes(stored as Language)) {
      resolvedLanguage = stored as Language;
    } else if (initialLanguage === defaultLanguage) {
      resolvedLanguage = resolveBrowserLanguage();
    }

    if (resolvedLanguage !== initialLanguage) {
      const timeoutId = window.setTimeout(() => {
        applyLanguage(resolvedLanguage, true);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    persistLanguage(resolvedLanguage);
  }, [applyLanguage, initialLanguage]);

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      setLanguage: (nextLanguage) => {
        if (nextLanguage === language) {
          persistLanguage(nextLanguage);
          return;
        }
        applyLanguage(nextLanguage, true);
      },
      t: (key, vars, fallback) => translate(language, key, vars, fallback),
    };
  }, [applyLanguage, language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
