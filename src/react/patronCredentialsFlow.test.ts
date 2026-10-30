/** A reply that stored nothing must never read as connected, and must keep the phrase on screen. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterReceive, afterRequest, type CredentialPhase } from "./patronCredentialsFlow.ts";

const sent: CredentialPhase = { kind: "sent", phrase: "amber-otter", relay: "wss://relay.example" };

describe("afterRequest", () => {
  it("moves to the phrase and its relay", () => {
    assert.deepEqual(afterRequest({ success: true, nonce: "amber-otter", rendezvous_relay: "wss://relay.example" }), {
      phase: sent,
      problem: "",
    });
  });

  it("stays idle on a refusal, in the operator's words", () => {
    assert.deepEqual(afterRequest({ success: false, message: "Not now" }), {
      phase: { kind: "idle" },
      problem: "Not now",
    });
  });

  it("stays idle when success carries no phrase to show", () => {
    const step = afterRequest({ success: true });
    assert.equal(step.phase.kind, "idle");
    assert.ok(step.problem);
  });
});

describe("afterReceive", () => {
  it("is done only when a field was stored", () => {
    assert.equal(afterReceive(sent, { success: true, stored_fields: ["api_key"] }).phase.kind, "done");
  });

  it("keeps the phrase when the reply stored nothing", () => {
    const step = afterReceive(sent, { success: true, stored_fields: [] });
    assert.deepEqual(step.phase, sent);
    assert.ok(step.problem);
  });

  it("prefers the operator's error to its message", () => {
    assert.equal(afterReceive(sent, { success: false, error: "e", message: "m" }).problem, "e");
  });
});
