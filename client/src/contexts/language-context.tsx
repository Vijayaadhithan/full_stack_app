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

type Language = "en" | "hi" | "ta";

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
    try {
      const savedLang = localStorage.getItem("language") as Language;
      if (savedLang && ["en", "hi", "ta"].includes(savedLang)) {
        setLanguageState(savedLang);
      }
    } catch (error) {
      console.error("Error loading language from localStorage:", error);
    }
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    try {
      setLanguageState(lang);
      localStorage.setItem("language", lang);
    } catch (error) {
      console.error("Error saving language to localStorage:", error);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      try {
        // Cast the specific language object to allow string indexing
        const currentLangTranslations = translations[language] as unknown as
          | Record<string, string>
          | undefined;
        const englishTranslations = translations["en"] as unknown as Record<
          string,
          string
        >;
        return (
          currentLangTranslations?.[key] || englishTranslations[key] || key
        );
      } catch (error) {
        console.error("Error in translation lookup:", error);
        return key;
      }
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
