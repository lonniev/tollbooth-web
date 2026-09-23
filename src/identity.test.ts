import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19, verifyEvent } from "nostr-tools";

import { configureTollbooth, toolName } from "./config.ts";
import {
  canSign,
  getLastTypedNpub,
  getStoredNpub,
  getValidRecentLogins,
  isLoggedIn,
  logOut,
  recordRecentLogin,
  setLastTypedNpub,
  setStoredNpub,
  setStoredProof,
} from "./identity.ts";
import { signInlineProof } from "./inlineProof.ts";
import { sessionNsecNpub, setSessionNsec } from "./sessionNsec.ts";

class MemoryStorage {
  #m = new Map<string, string>();
  getItem(k: string) { return this.#m.get(k) ?? null; }
  setItem(k: string, v: string) { this.#m.set(k, String(v)); }
  removeItem(k: string) { this.#m.delete(k); }
  keys() { return [...this.#m.keys()]; }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp" });
});

const NPUB = nip19.npubEncode(getPublicKey(generateSecretKey()));

test("keys live under the site's prefix", () => {
  setStoredNpub(NPUB);
  assert.deepEqual(storage.keys(), ["chart:patron_npub:v1"]);
});

test("typing an npub is not signing in", () => {
  setLastTypedNpub(NPUB);
  assert.equal(getLastTypedNpub(), NPUB);
  assert.equal(getStoredNpub(), "");
  assert.equal(isLoggedIn(), false);
});

test("an npub with a cached proof is signed in, but cannot sign", () => {
  setStoredNpub(NPUB);
  setStoredProof("seven-amber-doorway");
  assert.equal(isLoggedIn(), true);
  assert.equal(canSign(), false);
});

test("a session key signs in as the npub it derives to", () => {
  const sk = generateSecretKey();
  setSessionNsec(nip19.nsecEncode(sk));
  setStoredNpub(nip19.npubEncode(getPublicKey(sk)));
  assert.equal(isLoggedIn(), true);
  assert.equal(canSign(), true);
});

test("sign-out takes the session key too", () => {
  const sk = generateSecretKey();
  setSessionNsec(nip19.nsecEncode(sk));
  setStoredNpub(nip19.npubEncode(getPublicKey(sk)));
  logOut();
  assert.equal(isLoggedIn(), false);
  assert.equal(sessionNsecNpub(), null);
});

test("a recent login is derated 30s and an expired one is pruned", () => {
  recordRecentLogin(NPUB, "p", 3600);
  const [entry] = getValidRecentLogins();
  assert.ok(entry.expiresAt <= Date.now() + 3570_000);
  recordRecentLogin(NPUB, "p", 10); // under the derate: already expired
  assert.equal(getValidRecentLogins().length, 0);
});

test("blocked storage reads as nothing stored instead of throwing", () => {
  Object.defineProperty(globalThis, "localStorage", {
    get() { throw new Error("SecurityError"); },
    configurable: true,
  });
  assert.equal(getStoredNpub(), "");
  assert.equal(isLoggedIn(), false);
  setStoredNpub(NPUB); // must not throw
});

test("an inline proof is a valid kind-27235 bound to the runtime tool name", () => {
  const sk = generateSecretKey();
  const ev = JSON.parse(signInlineProof(toolName("snapshot_display"), sk));
  assert.equal(ev.kind, 27235);
  assert.deepEqual(ev.tags, [["u", "chart_snapshot_display"]]);
  assert.equal(ev.pubkey, getPublicKey(sk));
  assert.equal(verifyEvent(ev), true);
  // Sanity: the same helper nostr-tools uses to sign produces what we verify.
  assert.equal(verifyEvent(finalizeEvent({ kind: 1, created_at: 0, tags: [], content: "" }, sk)), true);
});

test("a slug that could smuggle a separator is refused", () => {
  assert.throws(() => configureTollbooth({ slug: "Chart-Remote", appName: "x", mcpUrl: "/mcp" }));
});
