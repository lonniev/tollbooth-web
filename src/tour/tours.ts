/**
 * The two tours every site shares, because the pages are the package's: the
 * sign-in gate, and the account page's panels. A site puts them in its tour
 * map beside its own, and adds its own steps after the panels' for whatever
 * else its account page holds.
 *
 * The copy says what each thing is, in the words the network uses — Patron,
 * npub, MCP tool, api_sats — in a sentence or two.
 */

import type { Tour, TourStep } from "./types.ts";

/** The `data-tour` names the package's own markup carries. */
export const TB_TARGETS = {
  gateNpub: "tb.gate.npub",
  gateLinks: "tb.gate.links",
  gateSend: "tb.gate.send",
  gateSteps: "tb.gate.steps",
  gateVerify: "tb.gate.verify",
  accountProfile: "tb.account.profile",
  accountUsage: "tb.account.usage",
  accountCoupons: "tb.account.coupons",
  accountSessionKey: "tb.account.sessionKey",
} as const;

/** The sign-in gate, from the field to the moment of being in. */
export function signInTour(page = "signin"): Tour {
  const steps: TourStep[] = [
    { target: TB_TARGETS.gateNpub, title: "Your npub",
      says: "Paste your npub here. An nsec works too and stays in this browser." },
    { target: TB_TARGETS.gateLinks, title: "Get a key",
      says: "Get a free key in 0xchat or Pricing Studio. Either makes one in a minute.", side: "top" },
    { target: TB_TARGETS.gateSend, title: "Send",
      says: "We send a message to your Nostr client. Reply to it with any words." },
    { target: TB_TARGETS.gateSteps, title: "The proof",
      says: "Your signed reply is the proof. The tiles show where you are.", side: "top" },
    { target: TB_TARGETS.gateVerify, title: "Verify",
      says: "Replied? Tap here and you are in." },
  ];
  return { page, steps };
}

/** The account page's package panels: the usage table, the persona, coupons, the session key. */
export function accountPanelsSteps(): TourStep[] {
  return [
    { target: TB_TARGETS.accountUsage, title: "What each tool drew",
      says: "Every MCP tool you have called, how many times, and the api_sats each cost. The operator sets the prices; this is what was paid.", side: "top" },
    { target: TB_TARGETS.accountProfile, title: "Your Nostr persona",
      says: "The name, picture, bio and addresses Nostr shows for your npub. Tap Edit to change them; they publish to your Nostr profile.", side: "top" },
    { target: TB_TARGETS.accountCoupons, title: "Coupons",
      says: "A code an operator hands out. Redeem it once here and it discounts your MCP tool fees on its own after that.", side: "top" },
    { target: TB_TARGETS.accountSessionKey, title: "Your session key",
      says: "This browser holds a key that signs each call for you. Claim it here to carry it to another device.", side: "top" },
  ];
}

/** The account page as the package knows it; a site appends its own steps. */
export function accountTour(page = "account", own: TourStep[] = []): Tour {
  return { page, steps: [...accountPanelsSteps(), ...own] };
}
