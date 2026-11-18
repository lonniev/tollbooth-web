import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";

import { nip05Names, npubFromInput, npubHue, npubsFromText, resolveNip05, withNpubs } from "./npubInput.ts";

const hex = getPublicKey(generateSecretKey());
const npub = nip19.npubEncode(hex);

/** A fetch that answers one nostr.json, and records what was asked. */
function nostrJson(names: Record<string, string>, asked: string[] = []) {
  return async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify({ names }), { status: 200 });
  };
}

describe("npubFromInput", () => {
  it("reads an npub in every form people copy one", () => {
    assert.deepEqual(npubFromInput(`  ${npub} `), { npub });
    assert.deepEqual(npubFromInput(`nostr:${npub}`), { npub });
    assert.deepEqual(npubFromInput(npub.toUpperCase()), { npub });
    assert.deepEqual(npubFromInput(hex), { npub });
    assert.deepEqual(npubFromInput(nip19.nprofileEncode({ pubkey: hex, relays: [] })), { npub });
  });

  it("takes a NIP-05 address to resolve", () => {
    assert.deepEqual(npubFromInput("Ada@Example.org"), { address: "ada@example.org" });
  });

  it("refuses a secret key, and anything else that is not an npub", () => {
    assert.deepEqual(npubFromInput(nip19.nsecEncode(generateSecretKey())), { problem: "secret" });
    assert.deepEqual(npubFromInput("npub1nope"), { problem: "notNpub" });
    assert.deepEqual(npubFromInput("   "), { problem: "empty" });
  });
});

describe("a pasted list", () => {
  it("splits on spaces, commas, semicolons and lines, and keeps each npub once in order", () => {
    const other = nip19.npubEncode(getPublicKey(generateSecretKey()));
    const read = npubsFromText(`${npub},\n${other}; ${npub}`).map((r) => ("npub" in r ? r.npub : ""));
    assert.deepEqual(withNpubs([], read), [npub, other]);
    assert.deepEqual(withNpubs([other], [npub, other]), [other, npub]);
  });
});

describe("NIP-05", () => {
  it("resolves an address from the domain's own nostr.json, and only there", async () => {
    const asked: string[] = [];
    assert.equal(await resolveNip05("ada@example.org", nostrJson({ ada: hex }, asked)), hex);
    assert.deepEqual(asked, ["https://example.org/.well-known/nostr.json?name=ada"]);
  });

  it("checks that an address names this very key", async () => {
    assert.equal(await nip05Names("ada@example.org", npub, nostrJson({ ada: hex })), true);
    const someoneElse = getPublicKey(generateSecretKey());
    assert.equal(await nip05Names("ada@example.org", npub, nostrJson({ ada: someoneElse })), false);
    assert.equal(await nip05Names("ada@example.org", npub, nostrJson({})), false);
  });

  it("asks nothing for an address that is not one", async () => {
    const asked: string[] = [];
    assert.equal(await resolveNip05("ada@evil/../x", nostrJson({ ada: hex }, asked)), null);
    assert.deepEqual(asked, []);
  });
});

describe("npubHue", () => {
  it("is stable for an npub", () => {
    assert.equal(npubHue(npub), npubHue(npub));
    assert.ok(npubHue(npub) >= 0 && npubHue(npub) < 360);
  });
});
