import React from 'react';
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { translations } from "@/lib/translations";

export const supportedLanguages = ["en", "hi", "ta"] as const;
export type Language = (typeof supportedLanguages)[number];

type StorageReader = { getItem(key: string): string | null } | null | undefined;
type StorageWriter = { setItem(key: string, value: string): void } | null | undefined;

export function coerceLanguage(value: unknown, fallback: Language = "en"): Language {
  if (typeof value === "string" && supportedLanguages.includes(value as Language)) {
    return value as Language;
  }
  return fallback;
}

export function readLanguageFromStorage(storage: StorageReader, fallback: Language = "en"): Language {
  if (!storage) return fallback;
  try {
    const stored = storage.getItem("language");
    return coerceLanguage(stored, fallback);
  } catch (error) {
    console.error("Error loading language from storage:", error);
    return fallback;
  }
}

export function persistLanguageToStorage(storage: StorageWriter, language: Language): void {
  if (!storage) return;
  try {
    storage.setItem("language", language);
  } catch (error) {
    console.error("Error saving language to storage:", error);
  }
}

export function translateKey(language: Language, key: string): string {
  try {
    const current = translations[language] as Record<string, unknown> | undefined;
    const english = translations["en"] as Record<string, unknown>;

    const candidate = current?.[key];
    if (typeof candidate === "string") {
      return candidate;
    }

    const fallback = english?.[key];
    if (typeof fallback === "string") {
      return fallback;
    }
  } catch (error) {
    console.error("Error in translation lookup:", error);
  }

  return key;
}

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const defaultLanguage: Language = "en";

export const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    setLanguageState(readLanguageFromStorage(storage, defaultLanguage));
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    persistLanguageToStorage(storage, lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translateKey(language, key);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage: handleSetLanguage,
      t,
    }),
    [language, handleSetLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    console.error("useLanguage must be used within a LanguageProvider");
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
