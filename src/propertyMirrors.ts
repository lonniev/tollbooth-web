/**
 * Where each property's local copy lives, and who hears it change. No imports,
 * on purpose: `timezone.ts` and `tourPrefs.ts` register here as they load,
 * and the client they sit under imports them in turn, so a registry that
 * imported anything could still be uninitialized when they call it.
 */

/** A property's local copy. `read` is undefined when nothing is stored. */
export interface PropertyMirror {
  read(): unknown;
  /** Store and tell the page — never the server. */
  write(value: unknown): void;
}

export const mirrors = new Map<string, PropertyMirror>();
const listeners = new Map<string, Set<() => void>>();

/** Keep `name`'s local copy in a module's own storage (timezone, tour). */
export function mirrorProperty(name: string, mirror: PropertyMirror): void {
  mirrors.set(name, mirror);
}

export function notifyProperty(name: string): void {
  listeners.get(name)?.forEach((fn) => fn());
}

/** Hear every change to `name` on this page. Returns an unsubscribe. */
export function onPropertyChange(name: string, fn: () => void): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(fn);
  return () => {
    listeners.get(name)?.delete(fn);
  };
}
