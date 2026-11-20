/**
 * Signing for a Cashu escrow, with a person's own Nostr key, without signing
 * blind.
 *
 * An escrow move (fund it, agree a split, collect a share) needs a BIP-340
 * signature by the person's key over the sha256 of a Cashu message. Signing a
 * 32-byte digest a server hands over would let a bad server, or a bad script on
 * the page, slip in the id of a Nostr event (a profile change, a login
 * elsewhere) and get it signed. So the message is rebuilt here from its parts
 * and checked, and only the sha256 of the rebuild is signed:
 *
 *   - `mint_quote` (NUT-20): the quote id and the blinded outputs, all new sats
 *     going into the escrow;
 *   - `swap` / `melt` (NUT-11 SIG_ALL): inputs locked to the signer's own key,
 *     paying out no more than they hold.
 *
 * A Cashu message can never read as a Nostr event, whose serialization starts
 * `[0,"`. What this cannot prove: the outputs are blinded, so who receives
 * each share rests on the operator's word, which a page shows beside its
 * button.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";

import { getSessionNsecBytes, sessionNsecNpub } from "./sessionNsec.ts";

export type EscrowMessageKind = "mint_quote" | "swap" | "melt";

/** What an escrow message is built from, as the operator hands it out. */
export interface EscrowParts {
  kind: EscrowMessageKind;
  inputs: { amount: number; secret: string; C: string }[];
  outputs: { amount: number; B_: string }[];
  quote: string;
}

/** One thing waiting on the signer: funding, a proposed split, or collecting a share. */
export interface EscrowSignable {
  what: "fund" | "proposal" | "collect";
  sign_digest: string;
  parts: EscrowParts;
}

/** The digest to sign, or why not; `why` is a plain sentence. */
export type CheckedEscrow = { digest: Uint8Array } | { why: string };

const KIND_OF: Record<EscrowSignable["what"], EscrowMessageKind> = {
  fund: "mint_quote",
  proposal: "swap",
  collect: "melt",
};

const NUT20_TAG = new TextEncoder().encode("Cashu_MintQuoteSig_v1");
const POINT = /^0[23][0-9a-f]{64}$/;

const isAmount = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;

function len32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

/** An amount as NUT-20 writes it: big-endian, as few bytes as it needs. */
function amountBytes(amount: number): Uint8Array {
  const out: number[] = [];
  for (let v = BigInt(amount); v > 0n; v >>= 8n) out.unshift(Number(v & 255n));
  return new Uint8Array(out);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The message the parts make, byte for byte as the mint checks it. */
export function escrowMessage(parts: EscrowParts): Uint8Array {
  if (parts.kind === "mint_quote") {
    const quote = new TextEncoder().encode(parts.quote);
    const pieces: Uint8Array[] = [NUT20_TAG, len32(quote.length), quote];
    for (const o of parts.outputs) {
      const amt = amountBytes(o.amount);
      const b = hexToBytes(o.B_);
      pieces.push(len32(amt.length), amt, len32(b.length), b);
    }
    return concat(pieces);
  }
  const text =
    parts.inputs.map((p) => p.secret + p.C).join("") +
    parts.outputs.map((o) => `${o.amount}${o.B_}`).join("") +
    (parts.kind === "melt" ? parts.quote : "");
  return new TextEncoder().encode(text);
}

/** The x-only key (64 hex) an npub signs with. */
function xonlyOf(npub: string): string | null {
  try {
    const d = nip19.decode(npub);
    return d.type === "npub" ? (d.data as string).toLowerCase() : null;
  } catch {
    return null;
  }
}

/** True when a NUT-10 secret is a P2PK lock that names `xonly` as data, a signer or a refund key. */
function locksTo(secret: string, xonly: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secret);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed[0] !== "P2PK" || typeof parsed[1] !== "object" || parsed[1] === null) return false;
  const body = parsed[1] as { data?: unknown; tags?: unknown };
  const keys: unknown[] = [body.data];
  if (Array.isArray(body.tags)) {
    for (const tag of body.tags) {
      if (Array.isArray(tag) && (tag[0] === "pubkeys" || tag[0] === "refund")) keys.push(...tag.slice(1));
    }
  }
  return keys.some((k) => typeof k === "string" && k.toLowerCase().slice(-64) === xonly && POINT.test(k.toLowerCase()));
}

/**
 * The digest `npub` may sign for this item, rebuilt here, or why it must not.
 * `most` is the most the move may pay out: the escrow's sats to fund it, what
 * it holds to split it, the share to collect it.
 */
export function checkedEscrowMessage(item: EscrowSignable, npub: string, most: number): CheckedEscrow {
  const parts = item?.parts;
  const xonly = xonlyOf(npub);
  if (!xonly) return { why: "That is not an npub." };
  if (!parts || KIND_OF[item.what] !== parts.kind) return { why: "This is not the kind of message this move signs." };
  if (!Array.isArray(parts.inputs) || !Array.isArray(parts.outputs) || typeof parts.quote !== "string") {
    return { why: "The message to sign is incomplete." };
  }
  // A payout's outputs are NUT-08 blanks, amount 0, for the fee reserve's change; there may be none.
  const blank = parts.kind === "melt";
  const outputOk = (o: { amount: number; B_: string }) =>
    (blank ? o.amount === 0 : isAmount(o.amount)) && POINT.test(o.B_);
  if ((!blank && !parts.outputs.length) || !parts.outputs.every(outputOk)) {
    return { why: "The message pays out to something that is not a Cashu output." };
  }
  const out = parts.outputs.reduce((n, o) => n + o.amount, 0);
  if (parts.kind === "mint_quote") {
    if (parts.inputs.length || !parts.quote) return { why: "Funding names a quote and spends nothing." };
  } else {
    if (!parts.inputs.length || !parts.inputs.every((p) => isAmount(p.amount) && POINT.test(p.C))) {
      return { why: "The message spends something that is not a Cashu proof." };
    }
    if (!parts.inputs.every((p) => locksTo(p.secret, xonly))) {
      return { why: "The message spends sats that are not locked to your key." };
    }
    if (out > parts.inputs.reduce((n, p) => n + p.amount, 0)) return { why: "The message pays out more than it spends." };
    if ((parts.kind === "melt") !== Boolean(parts.quote)) return { why: "Only a payout names a Lightning quote." };
  }
  if (!Number.isSafeInteger(most) || out > most) return { why: "The message moves more sats than this escrow holds for it." };

  const message = escrowMessage(parts);
  if (new TextDecoder().decode(message.slice(0, 3)) === "[0,") return { why: "That reads as a Nostr event." };
  const digest = sha256(message);
  if (bytesToHex(digest) !== String(item.sign_digest).toLowerCase()) {
    return { why: "The operator's digest does not match the message; nothing was signed." };
  }
  return { digest };
}

/** A BIP-340 signature (128 hex) by `secretKey` on the checked message, or why not. */
export function signEscrow(
  item: EscrowSignable,
  npub: string,
  most: number,
  secretKey: Uint8Array,
): { signature: string } | { why: string } {
  if (bytesToHex(schnorr.getPublicKey(secretKey)) !== xonlyOf(npub)) return { why: "This key is not that npub's." };
  const checked = checkedEscrowMessage(item, npub, most);
  if ("why" in checked) return checked;
  return { signature: bytesToHex(schnorr.sign(checked.digest, secretKey)) };
}

/** The same, with this browser's session key, which must be the signed-in npub's. */
export function signEscrowWithSessionKey(item: EscrowSignable, npub: string, most: number): { signature: string } | { why: string } {
  if (sessionNsecNpub() !== npub) return { why: "This browser holds no key for that npub." };
  return signEscrow(item, npub, most, getSessionNsecBytes());
}

/** A well-formed signature pasted from elsewhere; the operator still verifies it. */
export const isSignatureHex = (text: string): boolean => /^[0-9a-f]{128}$/.test(text.trim().toLowerCase());

/** The scheme Pricing Studio answers. */
export const PRICING_STUDIO_SCHEME = "com.tollbooth.dpyc.pricingstudio";

/**
 * A link that opens Pricing Studio on this job's escrow. It names only where to
 * ask: Studio fetches the message itself, checks it as above and signs with the
 * key it holds.
 */
export function pricingStudioEscrowLink({ mcp, taskId, npub, tool }: {
  mcp: string;
  taskId: string;
  npub: string;
  /** The operator's tool prefix, e.g. "taskbooth". */
  tool: string;
}): string {
  const q = new URLSearchParams({ mcp, task: taskId, npub, tool });
  return `${PRICING_STUDIO_SCHEME}://escrow?${q.toString()}`;
}
