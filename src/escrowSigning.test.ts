import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { finalizeEvent, getEventHash } from "nostr-tools";

import {
  checkedEscrowMessage,
  escrowMessage,
  isSignatureHex,
  pricingStudioEscrowLink,
  signEscrow,
  type EscrowSignable,
} from "./escrowSigning.ts";

/** Made by tollbooth-dpyc's cashu.py, so these rebuild what the mint checks. */
const V = JSON.parse(readFileSync(new URL("./escrowSigning.vectors.json", import.meta.url), "utf8")) as {
  npubs: Record<string, string>;
  items: (EscrowSignable & { signer: string; message_hex: string })[];
};
const keyOf = (n: number) => new Uint8Array(createHash("sha256").update(`escrow-vector-${n}`).digest());
const WORKER = keyOf(1);
const [fund, proposal, collect] = V.items;
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const why = (r: unknown) => (r as { why?: string }).why ?? "";

describe("escrowMessage", () => {
  it("rebuilds every kind byte for byte as the SDK builds it", () => {
    for (const item of V.items) assert.equal(bytesToHex(escrowMessage(item.parts)), item.message_hex, item.what);
  });
});

describe("checkedEscrowMessage", () => {
  it("passes each vector for its signer, with the digest rebuilt here", () => {
    for (const item of V.items) {
      const r = checkedEscrowMessage(item, V.npubs[item.signer], 1_000);
      assert.ok("digest" in r, `${item.what}: ${why(r)}`);
      assert.equal(bytesToHex(r.digest), item.sign_digest);
    }
  });

  it("refuses sats that are not locked to the signer", () => {
    assert.match(why(checkedEscrowMessage(proposal, V.npubs.stranger, 1_000)), /not locked to your key/);
    assert.match(why(checkedEscrowMessage(collect, V.npubs.client, 1_000)), /not locked to your key/);
  });

  it("takes a payout's NUT-08 blank outputs, or none, and refuses a payout output with sats", () => {
    const none = copy(collect);
    none.parts.outputs = [];
    none.sign_digest = bytesToHex(sha256(escrowMessage(none.parts)));
    assert.ok("digest" in checkedEscrowMessage(none, V.npubs[collect.signer], 1_000), why(checkedEscrowMessage(none, V.npubs[collect.signer], 1_000)));
    const paid = copy(collect);
    paid.parts.outputs[0].amount = 1;
    paid.sign_digest = bytesToHex(sha256(escrowMessage(paid.parts)));
    assert.match(why(checkedEscrowMessage(paid, V.npubs[collect.signer], 1_000)), /not a Cashu output/);
  });

  it("refuses a digest that is not the message's, so a foreign digest is never signed", () => {
    const event = finalizeEvent({ kind: 0, created_at: 1, tags: [], content: '{"name":"mallory"}' }, WORKER);
    const sneaky = { ...copy(proposal), sign_digest: getEventHash(event) };
    assert.match(why(checkedEscrowMessage(sneaky, V.npubs.worker, 1_000)), /does not match/);
    assert.ok("why" in signEscrow(sneaky, V.npubs.worker, 1_000, WORKER));
  });

  it("refuses a Nostr event dressed as parts", () => {
    const item = copy(proposal);
    item.parts.inputs[0].secret = `[0,"${"ab".repeat(32)}",1,0,[],""]`;
    assert.ok("why" in checkedEscrowMessage(item, V.npubs.worker, 1_000));
  });

  it("refuses more than the escrow holds, or more out than in", () => {
    assert.match(why(checkedEscrowMessage(fund, V.npubs.client, 26)), /more sats than this escrow holds/);
    const greedy = copy(proposal);
    greedy.parts.outputs[0].amount = 64;
    assert.match(why(checkedEscrowMessage(greedy, V.npubs.worker, 1_000)), /more than it spends/);
  });

  it("refuses a message of the wrong kind for the move, or a malformed one", () => {
    assert.match(why(checkedEscrowMessage({ ...proposal, what: "collect" }, V.npubs.worker, 1_000)), /kind of message/);
    const swapWithQuote = copy(proposal);
    swapWithQuote.parts.quote = "q";
    assert.match(why(checkedEscrowMessage(swapWithQuote, V.npubs.worker, 1_000)), /Lightning quote/);
    const badPoint = copy(fund);
    badPoint.parts.outputs[0].B_ = "04" + "00".repeat(32);
    assert.match(why(checkedEscrowMessage(badPoint, V.npubs.client, 1_000)), /not a Cashu output/);
  });
});

describe("signEscrow", () => {
  it("signs the rebuilt digest with the npub's own key, and the signature verifies", () => {
    const r = signEscrow(proposal, V.npubs.worker, 1_000, WORKER);
    assert.ok("signature" in r, why(r));
    assert.ok(isSignatureHex(r.signature));
    assert.ok(schnorr.verify(hexToBytes(r.signature), hexToBytes(proposal.sign_digest), schnorr.getPublicKey(WORKER)));
  });

  it("refuses a key that is not the npub's", () => {
    assert.match(why(signEscrow(proposal, V.npubs.arbiter, 1_000, WORKER)), /not that npub/);
  });
});

describe("pricingStudioEscrowLink", () => {
  it("names where to ask and nothing to sign", () => {
    const link = new URL(pricingStudioEscrowLink({ mcp: "https://tb.example/mcp", taskId: "t1", npub: V.npubs.worker, tool: "taskbooth" }));
    assert.equal(link.protocol, "com.tollbooth.dpyc.pricingstudio:");
    assert.deepEqual(Object.fromEntries(link.searchParams), { mcp: "https://tb.example/mcp", task: "t1", npub: V.npubs.worker, tool: "taskbooth" });
  });
});
