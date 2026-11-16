/**
 * The languages the package's screens can be read in. Pure: no i18next, no
 * DOM, so it is tested as it stands.
 */

export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "hi", name: "हिन्दी" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export interface Language {
  code: LanguageCode;
  /** The language's own name for itself. */
  name: string;
}

export const DEFAULT_LANGUAGE: LanguageCode = "en";

/** Where the reader's choice is kept, the same on every site. */
export const LANGUAGE_STORAGE_KEY = "tollbooth:language";

export function isLanguage(v: unknown): v is LanguageCode {
  return typeof v === "string" && LANGUAGES.some((l) => l.code === v);
}

/** The stored choice, or null when nothing (or nonsense) is stored. */
export function languageFrom(stored: string | null | undefined): LanguageCode | null {
  return isLanguage(stored) ? stored : null;
}

/** The language of a BCP 47 tag: "fr-CA" is "fr", "zh-Hant-TW" is "zh". */
function baseOf(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/, 1)[0];
}

/** The first of the browser's preferred languages the package speaks, else English. */
export function languageForBrowser(preferred: readonly string[] | null | undefined): LanguageCode {
  for (const tag of preferred ?? []) {
    if (typeof tag !== "string") continue;
    const base = baseOf(tag);
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * The locale that dates and numbers are written in: the browser's own regional
 * form of the chosen language when it has one ("en-GB" for "en"), else the
 * language itself.
 */
export function localeFor(language: LanguageCode, preferred: readonly string[] | null | undefined): string {
  for (const tag of preferred ?? []) {
    if (typeof tag === "string" && baseOf(tag) === language) return tag;
  }
  // English is also what everyone whose language is not offered reads. Their
  // dates and numbers keep their own browser's style, as they did before.
  const own = (preferred ?? []).find((tag) => typeof tag === "string" && tag.length > 0);
  if (language === DEFAULT_LANGUAGE && own) return own;
  return language;
}
