/**
 * The package's one i18next instance, and the small API a site uses in its
 * place. Every word the package shows comes from here: English is bundled and
 * ready before the first render; another language is fetched when chosen and
 * falls back to English key by key, so a missing file or word is never a fault.
 *
 * A site adds its own words with `registerNamespace` and reads them with
 * `translate(key, vars, namespace)` or the `useT(namespace)` hook.
 */

import i18next, { type i18n as I18n } from "i18next";
import { readShared, writeShared } from "../storage.ts";
import { en } from "./en.ts";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  languageForBrowser,
  languageFrom,
  localeFor,
  type LanguageCode,
} from "./languages.ts";
import { LOCALE_LOADERS } from "./loaders.ts";
import type { Resource, TranslationKey, Vars } from "./types.ts";

export const TOLLBOOTH_NAMESPACE = "tollbooth";

/** A language's words for one namespace, as a module or as the bare object. */
export type ResourceLoader = () => Promise<Resource | { default: Resource }>;
export type ResourceLoaders = Partial<Record<LanguageCode, ResourceLoader>>;

/** The instance. Package code only: a site uses the functions below. */
export const i18n: I18n = i18next.createInstance();

void i18n.init({
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: false,
  ns: [TOLLBOOTH_NAMESPACE],
  defaultNS: TOLLBOOTH_NAMESPACE,
  resources: { [DEFAULT_LANGUAGE]: { [TOLLBOOTH_NAMESPACE]: en } },
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  // Read by react-i18next's hook: render at once, and again when words arrive.
  react: { useSuspense: false, bindI18n: "languageChanged", bindI18nStore: "added" },
});

const namespaces = new Map<string, ResourceLoaders>([[TOLLBOOTH_NAMESPACE, LOCALE_LOADERS as ResourceLoaders]]);
const loaded = new Set<string>();
const listeners = new Set<(language: LanguageCode) => void>();
let newest = 0;

function announce(): void {
  const language = getLanguage();
  for (const listener of [...listeners]) listener(language);
}

/** Fetch one namespace's words for one language. A language with no file reads as English. */
async function load(namespace: string, language: LanguageCode): Promise<boolean> {
  const mark = `${namespace}\n${language}`;
  if (language === DEFAULT_LANGUAGE || loaded.has(mark)) return false;
  const loader = namespaces.get(namespace)?.[language];
  if (!loader) return false;
  try {
    const got = await loader();
    const inner = (got as { default?: unknown }).default;
    const words = (inner && typeof inner === "object" ? inner : got) as Resource;
    i18n.addResourceBundle(language, namespace, words, true, true);
    loaded.add(mark);
    return true;
  } catch {
    return false; // offline, or a chunk that is gone: English stands in
  }
}

async function apply(language: LanguageCode, remember: boolean): Promise<void> {
  const mine = ++newest;
  await Promise.all([...namespaces.keys()].map((ns) => load(ns, language)));
  if (mine !== newest) return; // a later choice overtook this one
  if (remember) writeShared(LANGUAGE_STORAGE_KEY, language);
  const html = globalThis.document?.documentElement;
  if (html) html.lang = language;
  if (i18n.language !== language) await i18n.changeLanguage(language);
  announce();
}

/** The language the screens are in now. */
export function getLanguage(): LanguageCode {
  return languageFrom(i18n.language) ?? DEFAULT_LANGUAGE;
}

/**
 * Switch every screen to `code` and remember the choice. Resolves once the
 * language's words are in; an unknown code is English.
 */
export function setLanguage(code: string): Promise<void> {
  return apply(languageFrom(code) ?? DEFAULT_LANGUAGE, true);
}

/**
 * Begin in the reader's language: their stored choice, else the first of the
 * browser's languages the package speaks. `AppShell` calls this once.
 */
export function startLanguage(): Promise<void> {
  const stored = languageFrom(readShared(LANGUAGE_STORAGE_KEY));
  const browser = languageForBrowser(globalThis.navigator?.languages);
  return apply(stored ?? browser, false);
}

/**
 * Add a site's own words. `english` is bundled with the site; each of
 * `loaders` fetches one translation when its language is chosen, so each stays
 * in its own chunk. Registered after a language is chosen, that language's
 * words are fetched straight away.
 */
export function registerNamespace(namespace: string, english: Resource, loaders: ResourceLoaders = {}): Promise<void> {
  if (namespace === TOLLBOOTH_NAMESPACE) throw new Error(`"${TOLLBOOTH_NAMESPACE}" is the package's own namespace.`);
  i18n.addResourceBundle(DEFAULT_LANGUAGE, namespace, english, true, true);
  namespaces.set(namespace, loaders);
  return load(namespace, getLanguage()).then((arrived) => {
    if (arrived) announce();
  });
}

/** One string in the current language, for code outside React. */
export function translate(key: TranslationKey, vars?: Vars): string;
export function translate(key: string, vars: Vars | undefined, namespace: string): string;
export function translate(key: string, vars?: Vars, namespace: string = TOLLBOOTH_NAMESPACE): string {
  return i18n.t(key, { ...vars, ns: namespace });
}

/** Hear of every change of language (and of late-arriving words). Returns the way to stop. */
export function onLanguageChange(listener: (language: LanguageCode) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The locale to write dates in: the browser's regional form of the current
 * language when it has one, so an "en-GB" reader keeps their day-first dates.
 */
export function languageLocale(): string {
  return localeFor(getLanguage(), globalThis.navigator?.languages);
}

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  isLanguage,
  languageForBrowser,
  languageFrom,
  localeFor,
  type Language,
  type LanguageCode,
} from "./languages.ts";
export type { EnglishKey, PluralForm, Resource, Translation, TranslationKey, Vars } from "./types.ts";
