/**
 * The patron's Nostr kind-0 profile.
 *
 * Relay I/O lives in the wheel. The browser keeps only the part that must stay
 * client side — SIGNING — with the session key or a NIP-07 extension, and
 * hands the signed event over. No nsec ever goes to a server.
 */

import { finalizeEvent, type Event as NostrEvent } from "nostr-tools";

import { getStoredNpub } from "./identity.ts";
import { getSessionNsecBytes, hasSessionNsec } from "./sessionNsec.ts";
import {
  getNostrProfile,
  publishNostrProfile,
  type Kind0,
  type PublishNostrProfileResult,
} from "./standardTools.ts";

interface Nip07 {
  getPublicKey(): Promise<string>;
  signEvent(event: {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey?: string;
  }): Promise<NostrEvent>;
}

function nip07(): Nip07 | undefined {
  return (globalThis as { nostr?: Nip07 }).nostr;
}

/** A session key or a NIP-07 signer is present. */
export function canSignProfile(): boolean {
  return hasSessionNsec() || !!nip07();
}

export async function fetchProfile(npub: string): Promise<Kind0 | null> {
  try {
    const r = await getNostrProfile(npub);
    return r.profile && Object.keys(r.profile).length ? r.profile : null;
  } catch {
    return null;
  }
}

/** Sign a kind-0 in the browser and have the wheel relay it. */
export async function publishProfile(content: Kind0): Promise<PublishNostrProfileResult> {
  const clean: Kind0 = {};
  for (const [k, v] of Object.entries(content)) {
    if (typeof v === "string" && v.trim()) clean[k as keyof Kind0] = v.trim();
  }
  const template = {
    kind: 0,
    created_at: Math.floor(Date.now() / 1000),
    tags: [] as string[][],
    content: JSON.stringify(clean),
  };

  let signed: NostrEvent;
  const signer = nip07();
  if (hasSessionNsec()) {
    signed = finalizeEvent(template, getSessionNsecBytes());
  } else if (signer) {
    const pubkey = await signer.getPublicKey();
    signed = await signer.signEvent({ ...template, pubkey });
  } else {
    throw new Error(
      "No signer available — sign in with a session key or a NIP-07 extension to publish your Nostr profile.",
    );
  }
  return publishNostrProfile(getStoredNpub(), JSON.stringify(signed));
}
