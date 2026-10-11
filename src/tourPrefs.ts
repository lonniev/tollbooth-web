/**
 * The guided tour's preference, stored per site and per device under
 * `<prefix>:tour:v1`: whether the live tutorial is on, which pages have had
 * their tour, and a page asked to replay once. The rules are in
 * `tour/state.ts`; this is their storage, in the shape `timezone.ts` set.
 */

import { getStoredNpub } from "./identity.ts";
import { key, readStored, writeStored } from "./storage.ts";
import { fromStored, type TourPrefs } from "./tour/state.ts";

const PREF = "tour:v1";

/** `<prefix>:tour:v1` — for a `storage` event listener. */
export function tourStorageKey(): string {
  return key(PREF);
}

// The last raw value read and what it parsed to. `useSyncExternalStore`
// wants the same object back while nothing changed; a fresh parse each read
// would be a new object every time and a render that never settles.
let lastRaw: string | null = null;
let lastOldHand = false;
let lastPrefs: TourPrefs | null = null;

export function readTourPrefs(): TourPrefs {
  const raw = readStored(PREF);
  // A device that already holds a patron npub but no tour preference has
  // been here since before the tour existed, and is left in peace. Read each
  // time: signing in changes it.
  const oldHand = raw === "" && !!getStoredNpub();
  if (lastPrefs && raw === lastRaw && oldHand === lastOldHand) return lastPrefs;
  let parsed: unknown = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  lastPrefs = fromStored(parsed, oldHand);
  lastRaw = raw;
  lastOldHand = oldHand;
  return lastPrefs;
}

const listeners = new Set<(p: TourPrefs) => void>();

/** Store the preference and tell every listener on the page. */
export function writeTourPrefs(next: TourPrefs): TourPrefs {
  writeStored(PREF, JSON.stringify(next));
  lastRaw = null;
  const stored = readTourPrefs();
  listeners.forEach((fn) => fn(stored));
  return stored;
}

/** Hear every `writeTourPrefs` on this page. Returns an unsubscribe. */
export function onTourChange(fn: (p: TourPrefs) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Write the preference down if nothing is stored yet. A newcomer is read as
 * "on" while they hold no npub; the moment they sign in they would read as
 * an old hand and the tutorial would go quiet mid-welcome. Settling the
 * first reading keeps a newcomer a newcomer.
 */
export function settleTourPrefs(): TourPrefs {
  const current = readTourPrefs();
  if (readStored(PREF) === "") writeTourPrefs(current);
  return current;
}
