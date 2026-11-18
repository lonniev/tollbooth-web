/**
 * Reading an npub someone typed or pasted, and what Nostr says about it.
 *
 * Pure parsing first (`npubFromInput`, `npubsFromText`), then the two lookups a
 * field makes for each npub it holds: the public kind-0 profile, read by the
 * operator (`get_nostr_profile`, free and unproven), and the NIP-05 check, made
 * from the browser to the domain the address names.
 */

import { nip19 } from "nostr-tools";

import { getNostrProfile, type Kind0 } from "./standardTools.ts";

/** What a typed text is: an npub, a NIP-05 address to resolve, or why it is neither. */
export type NpubReading =
  | { npub: string }
  | { address: string }
  | { problem: "empty" | "secret" | "notNpub" };

const HEX_KEY = /^[0-9a-f]{64}$/i;
/** name@domain, as NIP-05 allows: a local part of a-z0-9-_. and a dotted domain. */
const ADDRESS = /^([a-z0-9._-]+)@((?:[a-z0-9-]+\.)+[a-z]{2,})$/i;

/** One typed or pasted npub, in any of the forms people copy one in. */
export function npubFromInput(text: string): NpubReading {
  let word = text.trim().replace(/^nostr:/i, "");
  if (!word) return { problem: "empty" };
  if (/^nsec1/i.test(word)) return { problem: "secret" };
  if (HEX_KEY.test(word)) return { npub: nip19.npubEncode(word.toLowerCase()) };
  if (ADDRESS.test(word)) return { address: word.toLowerCase() };
  word = word.toLowerCase();
  try {
    const decoded = nip19.decode(word);
    if (decoded.type === "npub") return { npub: word };
    if (decoded.type === "nprofile") return { npub: nip19.npubEncode(decoded.data.pubkey) };
  } catch {
    // Not bech32: said below.
  }
  return { problem: "notNpub" };
}

/** Each word of a pasted list, read on its own: spaces, commas, semicolons and lines all separate. */
export function npubsFromText(text: string): NpubReading[] {
  return text.split(/[\s,;]+/).filter(Boolean).map(npubFromInput);
}

/** `list` with `more` added after it, each npub once, keeping the first order. */
export function withNpubs(list: readonly string[], more: readonly string[]): string[] {
  return [...new Set([...list, ...more])];
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** The hex key a NIP-05 address names, or null. Only `https://<domain>/.well-known/nostr.json` is asked. */
export async function resolveNip05(address: string, fetcher: Fetch = fetch): Promise<string | null> {
  const m = ADDRESS.exec(address.trim());
  if (!m) return null;
  const [, name, domain] = m;
  try {
    const r = await fetcher(`https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`, {
      redirect: "error",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!r.ok) return null;
    const body = (await r.json()) as { names?: Record<string, unknown> };
    const key = body?.names?.[name] ?? body?.names?.[name.toLowerCase()];
    return typeof key === "string" && HEX_KEY.test(key) ? key.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** True when the address names exactly this npub's key. */
export async function nip05Names(address: string, npub: string, fetcher: Fetch = fetch): Promise<boolean> {
  const key = await resolveNip05(address, fetcher);
  if (!key) return false;
  try {
    const d = nip19.decode(npub);
    return d.type === "npub" && d.data === key;
  } catch {
    return false;
  }
}

/** What a chiclet shows for one npub. */
export interface NpubCard {
  name: string;
  picture: string;
  /** The profile's NIP-05 address, when it has one. */
  nip05: string;
  /** The address was checked and names this key. */
  verified: boolean;
}

const cards = new Map<string, Promise<NpubCard>>();

/** The card for an npub, looked up once per page load. A lookup that fails yields a bare card. */
export function npubCard(npub: string): Promise<NpubCard> {
  let card = cards.get(npub);
  if (!card) {
    card = (async () => {
      let profile: Kind0 = {};
      try {
        profile = (await getNostrProfile(npub, { bestEffort: true })).profile ?? {};
      } catch {
        profile = {};
      }
      const nip05 = typeof profile.nip05 === "string" ? profile.nip05.trim().replace(/^_@/, "") : "";
      const address = nip05.includes("@") ? nip05 : nip05 ? `_@${nip05}` : "";
      return {
        name: (profile.display_name || profile.name || "").trim().slice(0, 80),
        picture: typeof profile.picture === "string" && /^https:\/\//.test(profile.picture) ? profile.picture : "",
        nip05,
        verified: address ? await nip05Names(address, npub) : false,
      };
    })();
    cards.set(npub, card);
  }
  return card;
}

/** A stable hue from an npub, so the same person wears the same colour everywhere. */
export function npubHue(npub: string): number {
  let h = 0;
  for (const c of npub) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}
