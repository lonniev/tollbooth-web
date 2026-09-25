/**
 * Inline kind-27235 identity proof — Tactic 2 in the wheel's
 * `identity_proof.verify_proof`. A fresh signed event per paid call, bound to:
 * the sender pubkey (must match the claimed npub), the `u` tag (must match the
 * runtime tool name, e.g. "chart_snapshot_display"), and `created_at` (within
 * about 60 seconds of server time). The wheel verifies the Schnorr signature
 * inline — no relay round trip, no cached phrase.
 *
 * Every proof also carries a random `nonce` tag, exactly as the wheel's own
 * `create_proof` does. Without it, two calls to the same tool in the same
 * wall-clock second sign byte-identical events, their ids collide, and the
 * verifier's replay guard refuses the second. The nonce is signed but inert:
 * `verify_proof` reads only the `u` tag.
 */

import { finalizeEvent } from "nostr-tools";
import { getSessionNsecBytes } from "./sessionNsec.ts";

const PROOF_KIND = 27235;

/** 16 random bytes as 32 lowercase hex chars — Python's `secrets.token_hex(16)`. */
export function proofNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The JSON-stringified signed event, exactly what `verify_proof` expects. */
export function signInlineProof(runtimeToolName: string, secretKey?: Uint8Array): string {
  const signed = finalizeEvent(
    {
      kind: PROOF_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["u", runtimeToolName],
        ["nonce", proofNonce()],
      ],
      content: "",
    },
    secretKey ?? getSessionNsecBytes(),
  );
  return JSON.stringify(signed);
}
