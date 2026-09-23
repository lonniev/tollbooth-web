/**
 * localStorage, read as the uncertainty it is.
 *
 * It is absent when a page is rendered off a browser, and merely touching it
 * raises in a browser with site data blocked or in some privacy modes. An
 * identity helper that takes the page down over a setting the visitor chose is
 * not worth having, so a failure reads as "nothing stored" and the app carries
 * on asking them to sign in.
 */

import { tollboothConfig } from "./config.ts";

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A key under this site's prefix, e.g. "chart:patron_npub:v1". */
export function key(name: string): string {
  return `${tollboothConfig().storagePrefix}:${name}`;
}

export function readStored(name: string): string {
  try {
    return store()?.getItem(key(name)) ?? "";
  } catch {
    return "";
  }
}

export function writeStored(name: string, value: string): void {
  try {
    store()?.setItem(key(name), value);
  } catch {
    /* a visitor who blocks site data simply signs in again next time */
  }
}

export function removeStored(name: string): void {
  try {
    store()?.removeItem(key(name));
  } catch {
    /* nothing to remove from a store we cannot reach */
  }
}
