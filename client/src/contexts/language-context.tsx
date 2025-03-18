import * as React from 'react';
import { translations } from '@/lib/translations';

type Language = 'en' | 'hi' | 'ta';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const defaultLanguage: Language = 'en';

export const LanguageContext = React.createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(defaultLanguage);

  React.useEffect(() => {
    try {
      const savedLang = localStorage.getItem('language') as Language;
      if (savedLang && ['en', 'hi', 'ta'].includes(savedLang)) {
        setLanguageState(savedLang);
      }
    } catch (error) {
      console.error('Error loading language from localStorage:', error);
    }
  }, []);

  const handleSetLanguage = React.useCallback((lang: Language) => {
    try {
      setLanguageState(lang);
      localStorage.setItem('language', lang);
    } catch (error) {
      console.error('Error saving language to localStorage:', error);
    }
  }, []);

  const t = React.useCallback((key: string): string => {
    try {
      return translations[language]?.[key] || translations['en'][key] || key;
    } catch (error) {
      console.error('Error in translation lookup:', error);
      return key;
    }
  }, [language]);

  const value = React.useMemo(() => ({
    language,
    setLanguage: handleSetLanguage,
    t,
  }), [language, handleSetLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    console.error('useLanguage must be used within a LanguageProvider');
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}