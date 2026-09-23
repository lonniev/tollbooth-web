/**
 * The patron's avatar, cached per npub.
 *
 * kind-0 `picture` is the source of truth, but it is a URL and an emoji glyph
 * is not, so a glyph pick stays local. A change dispatches a window event so
 * every avatar on the page updates without a reload.
 */

import { fetchProfile } from "./nostrProfile.ts";
import { readStored, writeStored } from "./storage.ts";

export const AVATAR_CHOICES: string[] = [
  "🐂", "🐻", "🦂", "🦅", "🐺", "🦉",
  "🦊", "🐉", "🦄", "🐢", "🦈", "🦀",
  "🎩", "🎭", "🃏", "🎯", "🪙", "💎",
  "⚡", "🔥", "🌪️", "🌊", "🏔️", "🌋",
  "♟️", "♛", "🛡️", "⚔️", "🗝️", "📜",
];

export const AVATAR_EVENT = "tollbooth:avatar-changed";

/** http(s) or data:image renders as an image; anything else as a glyph. */
export function isAvatarUrl(value: string): boolean {
  return /^(https?:\/\/|data:image\/)/i.test(value);
}

/** First 8 and last 4 characters. */
export function shortNpub(npub?: string | null): string {
  if (!npub) return "";
  return npub.length <= 16 ? npub : `${npub.slice(0, 8)}…${npub.slice(-4)}`;
}

export function getStoredAvatar(npub: string): string {
  return npub ? readStored(`avatar:${npub}`) : "";
}

export function setStoredAvatar(npub: string, value: string): void {
  if (!npub) return;
  writeStored(`avatar:${npub}`, value);
  globalThis.dispatchEvent?.(new CustomEvent(AVATAR_EVENT, { detail: { npub, value } }));
}

/** A stable glyph from the npub, so a new patron still has a distinct avatar. */
export function defaultAvatar(npub: string): string {
  let h = 0;
  for (const c of npub) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_CHOICES[h % AVATAR_CHOICES.length];
}

export function avatarFor(npub: string): string {
  return getStoredAvatar(npub) || defaultAvatar(npub);
}

/** Seed the cache from kind-0, unless the patron already picked one here. */
export async function hydrateAvatarFromNostr(npub: string): Promise<void> {
  if (!npub || getStoredAvatar(npub)) return;
  const p = await fetchProfile(npub);
  if (p?.picture) setStoredAvatar(npub, p.picture);
}
