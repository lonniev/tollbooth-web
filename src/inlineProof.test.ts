import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSecretKey, verifyEvent } from "nostr-tools";
import { proofNonce, signInlineProof } from "./inlineProof.ts";

describe("signInlineProof", () => {
  it("signs two different events for the same tool in the same second", () => {
    const sk = generateSecretKey();
    const realNow = Date.now;
    Date.now = () => 1_790_000_000_000; // one frozen wall-clock second
    try {
      const a = JSON.parse(signInlineProof("excalibur_check_balance", sk));
      const b = JSON.parse(signInlineProof("excalibur_check_balance", sk));
      assert.equal(a.created_at, b.created_at);
      assert.notEqual(a.id, b.id);
      assert.ok(verifyEvent(a) && verifyEvent(b));
    } finally {
      Date.now = realNow;
    }
  });

  it("carries the Python SDK's tag shape: [u, tool] then [nonce, 32 hex]", () => {
    const ev = JSON.parse(signInlineProof("excalibur_check_balance", generateSecretKey()));
    assert.equal(ev.kind, 27235);
    assert.equal(ev.content, "");
    assert.equal(ev.tags.length, 2);
    assert.deepEqual(ev.tags[0], ["u", "excalibur_check_balance"]);
    assert.equal(ev.tags[1][0], "nonce");
    assert.match(ev.tags[1][1], /^[0-9a-f]{32}$/);
  });
});

describe("proofNonce", () => {
  it("is 32 lowercase hex chars and fresh each time", () => {
    const seen = new Set(Array.from({ length: 50 }, proofNonce));
    assert.equal(seen.size, 50);
    for (const n of seen) assert.match(n, /^[0-9a-f]{32}$/);
  });
});
