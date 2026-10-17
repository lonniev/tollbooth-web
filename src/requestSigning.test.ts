import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools";

import { signRequest } from "./requestSigning.ts";

const URL = "https://site.example/mcp";
const BODY = '{"jsonrpc":"2.0","id":1,"method":"tools/call"}';

function decode(header: string) {
  assert.ok(header.startsWith("Nostr "));
  return JSON.parse(atob(header.slice(6)));
}

describe("signRequest", () => {
  it("binds the method, the URL and the body hash, signed by the key", async () => {
    const sk = generateSecretKey();
    const ev = decode(await signRequest("post", URL, BODY, sk));
    assert.equal(ev.kind, 27235);
    assert.equal(ev.pubkey, getPublicKey(sk));
    assert.ok(verifyEvent(ev));
    const tags = Object.fromEntries(ev.tags.map((t: string[]) => [t[0], t[1]]));
    assert.equal(tags.u, URL);
    assert.equal(tags.method, "POST");
    assert.equal(tags.payload, createHash("sha256").update(BODY).digest("hex"));
    assert.match(tags.nonce, /^[0-9a-f]{32}$/);
  });

  it("signs two different events for the same request in the same second", async () => {
    const sk = generateSecretKey();
    const realNow = Date.now;
    Date.now = () => 1_790_000_000_000;
    try {
      const a = decode(await signRequest("POST", URL, BODY, sk));
      const b = decode(await signRequest("POST", URL, BODY, sk));
      assert.equal(a.created_at, b.created_at);
      assert.notEqual(a.id, b.id);
    } finally {
      Date.now = realNow;
    }
  });
});
