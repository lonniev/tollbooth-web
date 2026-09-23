/**
 * Session nsec — a freshly generated (or pasted) key kept in the browser to
 * sign a kind-27235 identity proof on every paid call (Tactic 2 in the wheel's
 * `identity_proof`).
 *
 * Threat model, named at the sign-in gate when the patron picks this path:
 *   - Stored unencrypted in localStorage. XSS on this origin can take it.
 *     Accepted for one-tap sign-in; a patron wanting stronger isolation signs
 *     in with an npub and answers the DM instead.
 *   - Kept only so a reload survives. Cleared on sign-out.
 */

import { getPublicKey, nip19 } from "nostr-tools";
import { readStored, removeStored, writeStored } from "./storage.ts";

const NAME = "session_nsec:v1";

export function getSessionNsec(): string | null {
  return readStored(NAME) || null;
}

export function setSessionNsec(nsecBech32: string): void {
  if (!nsecBech32 || !nsecBech32.startsWith("nsec1")) {
    throw new Error("Expected a bech32 nsec1… string");
  }
  try {
    nip19.decode(nsecBech32);
  } catch (e) {
    throw new Error(`Invalid nsec: ${(e as Error).message}`);
  }
  writeStored(NAME, nsecBech32);
}

export function clearSessionNsec(): void {
  removeStored(NAME);
}

/** The 32-byte scalar `finalizeEvent` wants. Throws if absent or malformed. */
export function getSessionNsecBytes(): Uint8Array {
  const nsec = getSessionNsec();
  if (!nsec) throw new Error("No session nsec set");
  const decoded = nip19.decode(nsec);
  if (decoded.type !== "nsec" || !(decoded.data instanceof Uint8Array)) {
    throw new Error("Stored value is not a valid nsec");
  }
  return decoded.data;
}

export function hasSessionNsec(): boolean {
  return !!getSessionNsec();
}

/**
 * The npub the stored session nsec derives to, or null. Checked against the
 * signed-in npub before signing, so a key left from a previous identity never
 * signs for this one.
 */
export function sessionNsecNpub(): string | null {
  try {
    return nip19.npubEncode(getPublicKey(getSessionNsecBytes()));
  } catch {
    return null;
  }
}
