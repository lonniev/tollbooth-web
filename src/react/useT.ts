/**
 * The package's words as React state. `useT()` gives `t(key, vars?)` for the
 * package's own keys; `useT("mysite")` gives it for a namespace a site added
 * with `registerNamespace`. Either re-renders when the language changes or a
 * translation arrives. Works with or without `AppShell` above it.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { i18n, TOLLBOOTH_NAMESPACE, type TranslationKey, type Vars } from "../i18n/index.ts";

/** `t` for the package's own words: the key is checked against English. */
export type Translate = (key: TranslationKey, vars?: Vars) => string;

// One object for every call: react-i18next memoises on its identity.
const WITH_INSTANCE = { i18n };

export function useT(): Translate;
export function useT<K extends string = string>(namespace: string): (key: K, vars?: Vars) => string;
export function useT(namespace: string = TOLLBOOTH_NAMESPACE): (key: string, vars?: Vars) => string {
  const { t } = useTranslation(namespace, WITH_INSTANCE);
  return useCallback((key: string, vars?: Vars) => t(key, vars as never) as unknown as string, [t]);
}
