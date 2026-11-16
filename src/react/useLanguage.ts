/** The reader's language as React state, with the way to change it and the list to choose from. */

import { useSyncExternalStore } from "react";
import { getLanguage, languageLocale, LANGUAGES, onLanguageChange, setLanguage, type Language, type LanguageCode } from "../i18n/index.ts";

export interface LanguageState {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  languages: readonly Language[];
}

export function useLanguage(): LanguageState {
  const language = useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);
  return { language, setLanguage, languages: LANGUAGES };
}

/** The locale to write dates and numbers in, as React state: `languageLocale()` that re-renders. */
export function useLanguageLocale(): string {
  useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);
  return languageLocale();
}
