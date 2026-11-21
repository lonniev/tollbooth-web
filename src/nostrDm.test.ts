// A DM from the signed-in npub: NIP-17, opened by the recipient and by the sender alone.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { finalizeEvent, generateSecretKey, getPublicKey, nip19, nip44, type Event as NostrEvent } from "nostr-tools";
import { unwrapEvent } from "nostr-tools/nip59";
import { configureTollbooth } from "./config.ts";
import { canSendDm, sendDm } from "./nostrDm.ts";
import { clearSessionNsec, setSessionNsec } from "./sessionNsec.ts";

const kept = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, String(v)),
    removeItem: (k: string) => void kept.delete(k),
  },
});

const g = globalThis as { nostr?: unknown };

/** Sends, keeping every wrap the relays would have seen. */
async function send(to: string, body: string) {
  const seen: NostrEvent[] = [];
  const result = await sendDm({
    to, body, lookup: async () => [],
    publish: async (wrap, relays) => {
      seen.push(wrap);
      return { ok: relays.length, total: relays.length, accepted: [...relays], errors: [] };
    },
  });
  return { result, seen };
}

/** A NIP-07 extension holding `sk`. */
function extension(sk: Uint8Array) {
  return {
    getPublicKey: async () => getPublicKey(sk),
    signEvent: async (e: { kind: number; created_at: number; tags: string[][]; content: string }) => finalizeEvent(e, sk),
    nip44: { encrypt: async (pub: string, text: string) => nip44.encrypt(text, nip44.getConversationKey(sk, pub)) },
  };
}

describe("sendDm", () => {
  beforeEach(() => {
    kept.clear();
    delete g.nostr;
    configureTollbooth({ slug: "cm", appName: "CommissionMarket", mcpUrl: "/mcp" });
  });

  it("with a session key, the recipient opens it from the sender, and the sender keeps a copy", async () => {
    const me = generateSecretKey();
    const them = generateSecretKey();
    setSessionNsec(nip19.nsecEncode(me));
    assert.ok(canSendDm());
    const { result, seen } = await send(nip19.npubEncode(getPublicKey(them)), "Please review this commission");
    assert.ok(result.ok > 0);
    assert.equal(seen.length, 2);
    assert.ok(seen.every((w) => w.kind === 1059));
    assert.ok(!JSON.stringify(seen).includes("Please review"), "only ciphertext reaches the relays");

    const opened = unwrapEvent(seen[0], them);
    assert.equal(opened.kind, 14);
    assert.equal(opened.content, "Please review this commission");
    assert.equal(opened.pubkey, getPublicKey(me));
    assert.deepEqual(opened.tags, [["p", getPublicKey(them)]]);
    assert.equal(unwrapEvent(seen[1], me).content, "Please review this commission");
    assert.throws(() => unwrapEvent(seen[0], me), "the sender's key cannot open the recipient's wrap");
  });

  it("with a NIP-07 extension, the same", async () => {
    const me = generateSecretKey();
    const them = generateSecretKey();
    clearSessionNsec();
    g.nostr = extension(me);
    assert.ok(canSendDm());
    const { seen } = await send(nip19.npubEncode(getPublicKey(them)), "hello");
    const opened = unwrapEvent(seen[0], them);
    assert.equal(opened.content, "hello");
    assert.equal(opened.pubkey, getPublicKey(me));
    assert.equal(unwrapEvent(seen[1], me).content, "hello");
  });

  it("with no signer, it says how to get one", async () => {
    assert.equal(canSendDm(), false);
    g.nostr = { getPublicKey: async () => "", signEvent: async () => ({}) };  // an extension that cannot encrypt
    assert.equal(canSendDm(), false);
    await assert.rejects(send(nip19.npubEncode(getPublicKey(generateSecretKey())), "hi"), /session key or a NIP-07/);
  });

  it("refuses what is not an npub", async () => {
    setSessionNsec(nip19.nsecEncode(generateSecretKey()));
    await assert.rejects(send("nsec1nope", "hi"));
    await assert.rejects(send("npub1short", "hi"));
  });
});
