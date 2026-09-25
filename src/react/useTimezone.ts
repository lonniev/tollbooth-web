/**
 * The display time zone as React state: `[pref, zone, setPref]` — the stored
 * preference ("auto" or an IANA name), the zone it resolves to now, and a
 * setter. Every component using it re-renders when any of them sets it, and
 * when another tab does.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  onTimezoneChange,
  readTimezonePref,
  resolveTimeZone,
  timezoneStorageKey,
  writeTimezonePref,
  type TimezonePref,
} from "../timezone.ts";

function subscribe(changed: () => void): () => void {
  const stopPage = onTimezoneChange(changed);
  const onStorage = (e: StorageEvent) => {
    try {
      if (e.key === timezoneStorageKey()) changed();
    } catch {
      /* not configured yet: nothing of ours changed */
    }
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    stopPage();
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

const onServer = (): TimezonePref => "auto";

export function useTimezone(): [TimezonePref, string, (next: TimezonePref) => void] {
  const pref = useSyncExternalStore(subscribe, readTimezonePref, onServer);
  const zone = useMemo(() => resolveTimeZone(pref), [pref]);
  const setPref = useCallback((next: TimezonePref) => {
    writeTimezonePref(next);
  }, []);
  return [pref, zone, setPref];
}
