/**
 * Who this browser says it is, and what backs the claim.
 *
 * Three stored things, kept apart on purpose:
 *   - the **npub** the app acts as — written only once it is proven;
 *   - the cached **DM proof** that backs it, when the patron signed in by DM;
 *   - the **last typed** npub, remembered only to prefill the field. Writing a
 *     name into the identity slot before it was proven is what once let an
 *     unanswered challenge become a session.
 */

import { clearSessionNsec, hasSessionNsec, sessionNsecNpub } from "./sessionNsec.ts";
import { canSignFor, isProven, type Claim } from "./signedIn.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";

const NPUB = "patron_npub:v1";
const PROOF = "proof_token:v1";
const LAST_TYPED = "last_typed_npub:v1";
const RECENT = "recent-logins:v1";
const MAX_RECENT = 5;

export function getStoredNpub(): string {
  return readStored(NPUB);
}

export function setStoredNpub(npub: string): void {
  writeStored(NPUB, npub);
}

export function getStoredProof(): string {
  return readStored(PROOF);
}

export function setStoredProof(proof: string): void {
  writeStored(PROOF, proof);
}

export function clearStoredProof(): void {
  removeStored(PROOF);
}

export function getLastTypedNpub(): string {
  return readStored(LAST_TYPED);
}

export function setLastTypedNpub(npub: string): void {
  writeStored(LAST_TYPED, npub);
}

// ─── Recent logins (skip the DM on return) ───────────────────────────────

export interface RecentLogin {
  npub: string;
  proof: string;
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
        typeof e.npub === "string" && typeof e.proof === "string" &&
        typeof e.expiresAt === "number" && typeof e.lastUsed === "number",
    );
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentLogin[]): void {
  writeStored(RECENT, JSON.stringify(entries));
}

/** Unexpired recent logins, most recent first. Prunes the expired ones. */
export function getValidRecentLogins(): RecentLogin[] {
  const now = Date.now();
  const entries = readRecent();
  const valid = entries.filter((e) => e.expiresAt > now);
  if (valid.length !== entries.length) writeRecent(valid);
  return valid.sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Record or refresh a successful login. The TTL is derated by 30 seconds so a
 * straggler never serves an already-expired token to the next paid call.
 */
export function recordRecentLogin(npub: string, proof: string, expiresInSec: number): void {
  const now = Date.now();
  const next: RecentLogin = {
    npub,
    proof,
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
  return {
    npub: getStoredNpub(),
    proof: getStoredProof(),
    sessionNpub: hasSessionNsec() ? sessionNsecNpub() : null,
  };
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
  removeStored(PROOF);
  clearSessionNsec();
}
