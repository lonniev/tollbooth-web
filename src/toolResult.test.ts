import assert from "node:assert/strict";
import { test } from "node:test";

import { deadGrantMessage, errorText, looksFailed, proofBounceMessage, readToolResult } from "./toolResult.ts";

test("structured content wins, and images ride alongside it", () => {
  const r = readToolResult({
    content: [{ type: "image", data: "/9j/4AAQ", mimeType: "image/jpeg" }],
    structuredContent: { ok: true, display: "Desk" },
  });
  assert.deepEqual(r.payload, { ok: true, display: "Desk" });
  assert.deepEqual(r.images, [{ mimeType: "image/jpeg", data: "/9j/4AAQ" }]);
});

test("a text block is parsed as JSON when it is JSON, and kept as text when not", () => {
  assert.deepEqual(readToolResult({ content: [{ type: "text", text: '{"a":1}' }] }).payload, { a: 1 });
  assert.equal(readToolResult({ content: [{ type: "text", text: "plain" }] }).payload, "plain");
});

test("an image-only answer is an empty object, not the raw envelope", () => {
  const r = readToolResult({ content: [{ type: "image", data: "x", mimeType: "image/png" }] });
  assert.deepEqual(r.payload, {});
  assert.equal(r.images.length, 1);
});

test("a proof bounce is recognised whatever case the code arrives in", () => {
  // An uppercase comparison once meant the bounce never fired at all.
  assert.equal(proofBounceMessage({ success: false, error_code: "PROOF_REQUIRED", error: "Sign in" }), "Sign in");
  assert.equal(proofBounceMessage({ success: false, error_code: "proof_refresh_needed" }), "Sign-in required.");
});

test("other failures are not bounces", () => {
  assert.equal(proofBounceMessage({ success: false, error_code: "tool_input_invalid" }), null);
  assert.equal(proofBounceMessage({ success: true, error_code: "proof_required" }), null);
  assert.equal(proofBounceMessage("text"), null);
});

// What a Bee's Knees profile got on 2026-10-16, on every call, while the page
// still said the patron was signed in.
const EXPIRED = {
  success: false, error_code: "proof_invalid", reason: "expired",
  error: "Invalid proof grant: the grant has expired. Call request_npub_proof and receive_npub_proof for a fresh grant.",
};

test("an expired or revoked grant is dead", () => {
  assert.equal(deadGrantMessage(EXPIRED), EXPIRED.error);
  assert.ok(deadGrantMessage({ ...EXPIRED, reason: "revoked" }));
  assert.ok(deadGrantMessage({ ...EXPIRED, reason: "operator_mismatch" }));
  assert.ok(deadGrantMessage({ ...EXPIRED, error_code: "PROOF_INVALID" }));
});

test("a service that cannot check the grant has not refused it", () => {
  assert.equal(deadGrantMessage({ ...EXPIRED, reason: "revocations_unavailable" }), null);
  assert.equal(deadGrantMessage({ ...EXPIRED, reason: "operator_unknown" }), null);
});

test("only a refused proof is a dead grant", () => {
  assert.equal(deadGrantMessage({ ...EXPIRED, success: true }), null);
  assert.equal(deadGrantMessage({ success: false, error_code: "proof_required" }), null);
  assert.equal(deadGrantMessage("text"), null);
});

test("error text joins text blocks and never comes back empty", () => {
  assert.equal(errorText({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }), "a\nb");
  assert.equal(errorText({}), "Tool call failed");
});

test("ok:false reads as failed for the debug log", () => {
  assert.equal(looksFailed({ ok: false }), true);
  assert.equal(looksFailed({ ok: true }), false);
});
