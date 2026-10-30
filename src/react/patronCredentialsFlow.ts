/**
 * The pure half of `PatronCredentialsPanel`: where the Secure Courier exchange
 * stands after each answer from the operator. A key reaches the operator by
 * Nostr DM and never touches the browser, so all a page holds is the phrase
 * that names the reply.
 */

import type { ReceivePatronCredentialsResult, RequestPatronCredentialsResult } from "../standardTools.ts";

export type CredentialPhase = { kind: "idle" } | { kind: "sent"; phrase: string; relay: string } | { kind: "done" };

export interface CredentialStep {
  phase: CredentialPhase;
  problem: string;
}

/** After `request_patron_credentials`: the invitation went out, or say why not. */
export function afterRequest(r: RequestPatronCredentialsResult): CredentialStep {
  if (r.success && r.nonce) {
    return { phase: { kind: "sent", phrase: r.nonce, relay: r.rendezvous_relay ?? "" }, problem: "" };
  }
  return { phase: { kind: "idle" }, problem: r.message ?? "The invitation could not be sent." };
}

/** After `receive_patron_credentials`: stay on the phrase unless something was stored. */
export function afterReceive(sent: CredentialPhase, r: ReceivePatronCredentialsResult): CredentialStep {
  if (r.success && (r.stored_fields ?? []).length) return { phase: { kind: "done" }, problem: "" };
  return { phase: sent, problem: r.error ?? r.message ?? "No reply found yet: send it, then try again." };
}
