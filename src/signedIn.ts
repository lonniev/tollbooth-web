/**
 * What "signed in" means. One definition, because there were two.
 *
 * An npub is public — it is on every note its owner ever wrote — so the npub
 * alone is a claim, never a credential. A shell that read "we know an npub" as
 * "signed in" let anyone who asked for a DM and never answered it in, as
 * themselves, unproven. Two things can back the claim:
 *
 *   - a **cached DM proof**, won by answering a Nostr challenge, or
 *   - a **session nsec** in this tab, which signs a fresh proof per call — and
 *     only counts for the npub it actually derives to.
 *
 * Pure, so it is testable without a browser.
 */

export interface Claim {
  /** The npub the interface is showing, proven or not. */
  npub: string;
  /** A cached DM proof token, if one was won and has not lapsed. */
  proof: string;
  /** The npub this tab's session key derives to, if it holds one. */
  sessionNpub: string | null;
}

/** True only when the claimed npub is backed by something. */
export function isProven({ npub, proof, sessionNpub }: Claim): boolean {
  if (!npub) return false;
  if (proof) return true;
  return sessionNpub === npub;
}

/** True when this tab can sign a fresh proof for the npub it is claiming. */
export function canSignFor({ npub, sessionNpub }: Claim): boolean {
  return Boolean(npub) && sessionNpub === npub;
}
