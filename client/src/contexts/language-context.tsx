import React from "react";
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  loadTranslations,
  getLoadedTranslations,
  preloadEnglish,
  type Language,
  type TranslationDict,
} from "@/lib/translations/index";

export { type Language } from "@/lib/translations/index";
export const supportedLanguages: readonly Language[] = ["en", "hi", "ta"];

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
  } catch {
    return fallback;
  }
}

export function persistLanguageToStorage(storage: StorageWriter, language: Language): void {
  if (!storage) return;
  try {
    storage.setItem("language", language);
  } catch {
    // Ignore quota errors
  }
}

// Helper to get a nested key from translation dict
function getNestedValue(obj: TranslationDict, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

export function translateKey(
  language: Language,
  key: string,
  currentTranslations: TranslationDict | undefined,
  fallbackTranslations: TranslationDict | undefined
): string {
  // Try current language first
  if (currentTranslations) {
    const value = currentTranslations[key];
    if (typeof value === "string") return value;

    // Try nested key
    const nested = getNestedValue(currentTranslations, key);
    if (nested) return nested;
  }

  // Fall back to English
  if (fallbackTranslations && language !== "en") {
    const value = fallbackTranslations[key];
    if (typeof value === "string") return value;

    const nested = getNestedValue(fallbackTranslations, key);
    if (nested) return nested;
  }

  // Return key if not found
  return key;
}

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isLoading: boolean;
};

const defaultLanguage: Language = "en";

export const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => { },
  t: (key) => key,
  isLoading: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [translations, setTranslations] = useState<TranslationDict | undefined>(undefined);
  const [englishTranslations, setEnglishTranslations] = useState<TranslationDict | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Load English as fallback on mount
  useEffect(() => {
    preloadEnglish().then(() => {
      setEnglishTranslations(getLoadedTranslations("en"));
    });
  }, []);

  // Load initial language from storage
  useEffect(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    const storedLang = readLanguageFromStorage(storage, defaultLanguage);

    setIsLoading(true);
    loadTranslations(storedLang).then((loaded) => {
      setLanguageState(storedLang);
      setTranslations(loaded);
      setIsLoading(false);
    });
  }, []);

  // Handle language change
  const handleSetLanguage = useCallback(async (lang: Language) => {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    persistLanguageToStorage(storage, lang);

    // Check if already loaded
    const cached = getLoadedTranslations(lang);
    if (cached) {
      setLanguageState(lang);
      setTranslations(cached);
      return;
    }

    // Load new language
    setIsLoading(true);
    const loaded = await loadTranslations(lang);
    setLanguageState(lang);
    setTranslations(loaded);
    setIsLoading(false);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translateKey(language, key, translations, englishTranslations);
    },
    [language, translations, englishTranslations],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage: handleSetLanguage,
      t,
      isLoading,
    }),
    [language, handleSetLanguage, t, isLoading],
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