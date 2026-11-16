/**
 * The pure half of `PeersPanel`: a sponsor sees a patron's account here and
 * pays for it. Either one asks, by a Nostr DM the other approves. Framework-free
 * and tested.
 */

import { nip19 } from "nostr-tools";
import { translate } from "./i18n/index.ts";
import type { PeerGrantResult } from "./standardTools.ts";

/** The npub typed into the ask box, or why it will not do. */
export function peerTarget(typed: string, self: string): { npub: string } | { problem: string } {
  const npub = typed.trim();
  if (!npub) return { problem: "" };
  try {
    if (nip19.decode(npub).type !== "npub") return { problem: translate("peers.notAnNpub") };
  } catch {
    return { problem: translate("peers.notAnNpub") };
  }
  if (npub === self) return { problem: translate("peers.ownAccount") };
  return { npub };
}

/** When a grant ends, in words: "ends today", "ends in 6 days". */
export function grantEndsText(expiresAt: number, nowMs: number = Date.now()): string {
  const days = Math.floor((expiresAt * 1000 - nowMs) / 86_400_000);
  if (days < 1) return translate("peers.endsToday");
  if (days === 1) return translate("peers.endsTomorrow");
  return translate("peers.endsIn", { count: days });
}

/**
 * Where an ask stands: nothing sent, or a DM out to `other` named by `nonce`.
 * `patron` and `peer` are the grant's two sides; the signed-in npub is one.
 */
export type AskPhase =
  | { kind: "idle" }
  | { kind: "sent"; patron: string; peer: string; other: string; nonce: string };

/** The grant's two sides when `self` asks `other`: to sponsor them, or to be sponsored by them. */
export function askSides(self: string, other: string, offer: boolean): { patron: string; peer: string } {
  return offer ? { patron: other, peer: self } : { patron: self, peer: other };
}

export interface AskStep {
  phase: AskPhase;
  problem: string;
}

/** After `request_peer_grant`: the DM went out to `other`, or say why not. */
export function afterAsk(sides: { patron: string; peer: string }, other: string, r: PeerGrantResult): AskStep {
  if (r.success && r.nonce) return { phase: { kind: "sent", ...sides, other, nonce: r.nonce }, problem: "" };
  return { phase: { kind: "idle" }, problem: r.error ?? r.message ?? translate("peers.requestNotSent") };
}

/** After `receive_peer_grant`: done, or stay waiting on the same DM. */
export function afterApproval(sent: AskPhase, r: PeerGrantResult): AskStep & { granted: boolean } {
  if (r.success) return { phase: { kind: "idle" }, problem: "", granted: true };
  return {
    phase: sent,
    problem: r.error ?? r.message ?? translate("peers.noApprovalYet"),
    granted: false,
  };
}
