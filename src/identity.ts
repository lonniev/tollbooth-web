/**
 * Who this browser says it is, and what backs the claim.
 *
 * Two stored things, kept apart on purpose:
 *   - the **npub** the app acts as — written only once it is proven;
 *   - the **last typed** npub, remembered only to prefill the field. Writing a
 *     name into the identity slot before it was proven is what once let an
 *     unanswered challenge become a session.
 *
 * What backs the npub lives on the connection: this tab's session key signs
 * every request, or the operator holds the DM proof for this tab's holder
 * connection. The page itself keeps no proof.
 */

import { RECENT_LOGINS as RECENT, forgetHolder, isHolder } from "./holder.ts";
import { clearSessionNsec, hasSessionNsec, sessionNsecNpub } from "./sessionNsec.ts";
import { canSignFor, isProven, type Claim } from "./signedIn.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";

const NPUB = "patron_npub:v1";
const LAST_TYPED = "last_typed_npub:v1";
const MAX_RECENT = 5;

export function getStoredNpub(): string {
  return readStored(NPUB);
}

export function setStoredNpub(npub: string): void {
  writeStored(NPUB, npub);
}

export function getLastTypedNpub(): string {
  return readStored(LAST_TYPED);
}

export function setLastTypedNpub(npub: string): void {
  writeStored(LAST_TYPED, npub);
}

// ─── Recent logins (skip the DM on return) ───────────────────────────────

/** An npub this tab's holder connection holds, until its DM proof lapses. */
export interface RecentLogin {
  npub: string;
  /** Unix ms. */
  expiresAt: number;
  /** Unix ms. */
  lastUsed: number;
}

function readRecent(): RecentLogin[] {
  try {
    const parsed = JSON.parse(readStored(RECENT) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentLogin =>
        typeof e === "object" && e !== null &&
        typeof e.npub === "string" &&
        typeof e.expiresAt === "number" && typeof e.lastUsed === "number",
    );
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentLogin[]): void {
  writeStored(RECENT, JSON.stringify(entries));
}

/**
 * Unexpired recent logins, most recent first; none unless this tab is a
 * holder, since the holder is what holds them. Prunes the expired ones.
 */
export function getValidRecentLogins(): RecentLogin[] {
  if (!isHolder()) return [];
  const now = Date.now();
  const entries = readRecent();
  const valid = entries.filter((e) => e.expiresAt > now);
  if (valid.length !== entries.length) writeRecent(valid);
  return valid.sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Record or refresh a DM sign-in this tab's holder now holds. The TTL is
 * derated by 30 seconds so a straggler never re-enters on a proof that lapses
 * before the next paid call.
 */
export function recordRecentLogin(npub: string, expiresInSec: number): void {
  const now = Date.now();
  const next: RecentLogin = {
    npub,
    expiresAt: now + Math.max(0, expiresInSec - 30) * 1000,
    lastUsed: now,
  };
  const others = readRecent().filter((e) => e.npub !== npub);
  writeRecent([next, ...others].slice(0, MAX_RECENT));
}

export function forgetRecentLogin(npub: string): void {
  writeRecent(readRecent().filter((e) => e.npub !== npub));
}

// ─── The claim ───────────────────────────────────────────────────────────

/** Read once and handed to the pure predicates in `signedIn.ts`. */
export function currentClaim(): Claim {
  const npub = getStoredNpub();
  return {
    npub,
    held: heldByThisTab(npub),
    sessionNpub: hasSessionNsec() ? sessionNsecNpub() : null,
  };
}

/** True when this tab's holder connection holds `npub`: a DM sign-in recorded here. */
function heldByThisTab(npub: string): boolean {
  return Boolean(npub) && getValidRecentLogins().some((e) => e.npub === npub);
}

export function isLoggedIn(): boolean {
  return isProven(currentClaim());
}

export function canSign(): boolean {
  return canSignFor(currentClaim());
}

/**
 * Everything that says who you are goes, including the session key — a
 * sign-out that leaves a usable signing key behind is not one.
 */
export function logOut(): void {
  removeStored(NPUB);
  clearSessionNsec();
  void forgetHolder();
}
