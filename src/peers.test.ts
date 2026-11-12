import assert from "node:assert/strict";
import { test } from "node:test";
import { afterApproval, afterAsk, grantEndsText, peerTarget } from "./peers.ts";

const PATRON = "npub1d999638gqpn8c594teklxtxva0uvxdng80q3ycyqvldjdl457c7qcrq64z";
const PEER = "npub1aamuuuk9myts9nw69udvsdcx6m62a3em4rkaaghcq6a2v4rerqmq72kmz8";

test("a typed npub is the target, trimmed", () => {
  assert.deepEqual(peerTarget(`  ${PATRON} `, PEER), { npub: PATRON });
});

test("a target that is no npub, or one's own, is refused", () => {
  assert.deepEqual(peerTarget("", PEER), { problem: "" });
  assert.deepEqual(peerTarget("npub1nope", PEER), { problem: "That is not an npub." });
  assert.deepEqual(peerTarget(PEER, PEER), { problem: "That is your own account." });
});

test("a grant's end reads in days", () => {
  const now = Date.UTC(2026, 10, 12);
  assert.equal(grantEndsText(now / 1000 + 3600, now), "ends today");
  assert.equal(grantEndsText(now / 1000 + 86_400 + 60, now), "ends tomorrow");
  assert.equal(grantEndsText(now / 1000 + 7 * 86_400, now), "ends in 7 days");
});

test("an ask that went out waits on its nonce", () => {
  assert.deepEqual(afterAsk(PATRON, { success: true, nonce: "bold-hawk" }), {
    phase: { kind: "sent", patron: PATRON, nonce: "bold-hawk" },
    problem: "",
  });
  assert.deepEqual(afterAsk(PATRON, { success: false, error: "Secure Courier not configured." }), {
    phase: { kind: "idle" },
    problem: "Secure Courier not configured.",
  });
});

test("no approval yet keeps waiting on the same DM", () => {
  const sent = { kind: "sent", patron: PATRON, nonce: "bold-hawk" } as const;
  assert.equal(afterApproval(sent, { success: true }).granted, true);
  const waiting = afterApproval(sent, { success: false, error: "No reply yet." });
  assert.deepEqual(waiting, { phase: sent, problem: "No reply yet.", granted: false });
});
