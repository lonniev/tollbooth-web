/**
 * The pure half of `PeersPanel`: a patron lets a peer npub see their account
 * here and pay for it, and the peer asks for that by a Nostr DM the patron
 * approves. Framework-free and tested.
 */

import { nip19 } from "nostr-tools";
import type { PeerGrantResult } from "./standardTools.ts";

/** The npub typed into "Fund another account", or why it will not do. */
export function peerTarget(typed: string, self: string): { npub: string } | { problem: string } {
  const npub = typed.trim();
  if (!npub) return { problem: "" };
  try {
    if (nip19.decode(npub).type !== "npub") return { problem: "That is not an npub." };
  } catch {
    return { problem: "That is not an npub." };
  }
  if (npub === self) return { problem: "That is your own account." };
  return { npub };
}

/** When a grant ends, in words: "ends today", "ends in 6 days". */
export function grantEndsText(expiresAt: number, nowMs: number = Date.now()): string {
  const days = Math.floor((expiresAt * 1000 - nowMs) / 86_400_000);
  if (days < 1) return "ends today";
  if (days === 1) return "ends tomorrow";
  return `ends in ${days} days`;
}

/** Where a peer's ask stands: nothing sent, or a DM out to `patron` named by `nonce`. */
export type AskPhase = { kind: "idle" } | { kind: "sent"; patron: string; nonce: string };

export interface AskStep {
  phase: AskPhase;
  problem: string;
}

/** After `request_peer_grant`: the DM went out, or say why not. */
export function afterAsk(patron: string, r: PeerGrantResult): AskStep {
  if (r.success && r.nonce) return { phase: { kind: "sent", patron, nonce: r.nonce }, problem: "" };
  return { phase: { kind: "idle" }, problem: r.error ?? r.message ?? "The request could not be sent." };
}

/** After `receive_peer_grant`: done, or stay waiting on the same DM. */
export function afterApproval(sent: AskPhase, r: PeerGrantResult): AskStep & { granted: boolean } {
  if (r.success) return { phase: { kind: "idle" }, problem: "", granted: true };
  return {
    phase: sent,
    problem: r.error ?? r.message ?? "No approval found yet: once they approve, try again.",
    granted: false,
  };
}
