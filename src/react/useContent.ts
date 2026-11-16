/**
 * A site's structured content (registered with `registerNamespace`) in the
 * reader's language, as React state: English until the language's file has
 * arrived, and English for any piece a language lacks.
 *
 *     const lessons = useContent<Lesson[]>("mysite-content", "lessons") ?? [];
 */

import { useCallback, useSyncExternalStore } from "react";
import { content, onLanguageChange } from "../i18n/index.ts";

export function useContent<T>(namespace: string, key: string): T | undefined {
  const read = useCallback(() => content<T>(namespace, key), [namespace, key]);
  return useSyncExternalStore(onLanguageChange, read, read);
}
