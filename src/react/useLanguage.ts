/** The reader's language as React state, with the way to change it and the list to choose from. */

import { useSyncExternalStore } from "react";
import { getLanguage, LANGUAGES, onLanguageChange, setLanguage, type Language, type LanguageCode } from "../i18n/index.ts";

export interface LanguageState {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  languages: readonly Language[];
}

export function useLanguage(): LanguageState {
  const language = useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);
  return { language, setLanguage, languages: LANGUAGES };
}
