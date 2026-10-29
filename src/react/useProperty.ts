/**
 * One property as React state: `[value, set]`. An account-following property
 * is kept with the signed-in npub as well as here; a device one stays here.
 * Every component using it re-renders when any of them sets it, when the
 * sign-in sync brings the account's value, and when another tab sets it.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { onPropertyChange, readProperty, writeProperty } from "../properties.ts";

export function useProperty<T>(name: string, fallback: T): [T, (next: T) => void] {
  const subscribe = useCallback((changed: () => void) => {
    const stop = onPropertyChange(name, changed);
    globalThis.addEventListener?.("storage", changed);
    return () => {
      stop();
      globalThis.removeEventListener?.("storage", changed);
    };
  }, [name]);
  // The snapshot is text, so a list or an object read twice is the same snapshot.
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readProperty(name, fallback)),
    () => JSON.stringify(fallback),
  );
  const value = useMemo(() => JSON.parse(raw) as T, [raw]);
  const set = useCallback((next: T) => writeProperty(name, next), [name]);
  return [value, set];
}
