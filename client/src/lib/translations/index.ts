// Lazy-loaded translation loader
// Each language is loaded on demand when selected

export type TranslationDict = Record<string, string | Record<string, string>>;
export type Language = "en" | "hi" | "ta";

const translationLoaders: Record<Language, () => Promise<{ default: TranslationDict }>> = {
    en: () => import("./en"),
    hi: () => import("./hi"),
    ta: () => import("./ta"),
};

// Cache for loaded translations
const loadedTranslations: Partial<Record<Language, TranslationDict>> = {};

/**
 * Load translations for the specified language.
 * Returns cached version if already loaded.
 */
export async function loadTranslations(lang: Language): Promise<TranslationDict> {
    // Return cached version if available
    if (loadedTranslations[lang]) {
        return loadedTranslations[lang]!;
    }

    // Load and cache
    const module = await translationLoaders[lang]();
    loadedTranslations[lang] = module.default;
    return module.default;
}

/**
 * Get translations synchronously (returns empty object if not yet loaded).
 * Use loadTranslations() to ensure translations are loaded first.
 */
export function getLoadedTranslations(lang: Language): TranslationDict | undefined {
    return loadedTranslations[lang];
}

/**
 * Preload English as a fallback (typically called on app init).
 */
export async function preloadEnglish(): Promise<void> {
    await loadTranslations("en");
}

export const supportedLanguages: Language[] = ["en", "hi", "ta"];
