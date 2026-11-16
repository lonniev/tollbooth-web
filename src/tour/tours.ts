/**
 * The two tours every site shares, because the pages are the package's: the
 * sign-in gate, and the account page's panels. A site puts them in its tour
 * map beside its own, and adds its own steps after the panels' for whatever
 * else its account page holds.
 *
 * The copy says what each thing is, in the words the network uses — Patron,
 * npub, MCP tool, api_sats — in a sentence or two.
 */

import { translate } from "../i18n/index.ts";
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
  walletAmounts: "tb.wallet.amounts",
  walletCash: "tb.wallet.cash",
  walletDoor: "tb.wallet.door",
  walletTranches: "tb.wallet.tranches",
  walletStatement: "tb.wallet.statement",
} as const;

/** The sign-in gate, from the field to the moment of being in. */
export function signInTour(page = "signin"): Tour {
  const steps: TourStep[] = [
    { target: TB_TARGETS.gateNpub, title: translate("tour.signin.npub.title"),
      says: translate("tour.signin.npub.says") },
    { target: TB_TARGETS.gateLinks, title: translate("tour.signin.links.title"),
      says: translate("tour.signin.links.says"), side: "top" },
    { target: TB_TARGETS.gateSend, title: translate("tour.signin.send.title"),
      says: translate("tour.signin.send.says") },
    { target: TB_TARGETS.gateSteps, title: translate("tour.signin.steps.title"),
      says: translate("tour.signin.steps.says"), side: "top" },
    { target: TB_TARGETS.gateVerify, title: translate("tour.signin.verify.title"),
      says: translate("tour.signin.verify.says") },
  ];
  return { page, steps };
}

/** The wallet, wherever a site puts it. A step whose part is not on the page is skipped. */
export function walletSteps(): TourStep[] {
  return [
    { target: TB_TARGETS.walletAmounts, title: translate("tour.wallet.amounts.title"),
      says: translate("tour.wallet.amounts.says") },
    { target: TB_TARGETS.walletDoor, title: translate("tour.wallet.door.title"),
      says: translate("tour.wallet.door.says"), side: "top" },
    { target: TB_TARGETS.walletCash, title: translate("tour.wallet.cash.title"),
      says: translate("tour.wallet.cash.says"), side: "top" },
    { target: TB_TARGETS.walletTranches, title: translate("tour.wallet.tranches.title"),
      says: translate("tour.wallet.tranches.says"), side: "top" },
    { target: TB_TARGETS.walletStatement, title: translate("tour.wallet.statement.title"),
      says: translate("tour.wallet.statement.says"), side: "top" },
  ];
}

/** The wallet as a page of its own. */
export function walletTour(page = "wallet"): Tour {
  return { page, steps: walletSteps() };
}

/** The account page's package panels: the usage table, the persona, coupons, the session key. */
export function accountPanelsSteps(): TourStep[] {
  return [
    { target: TB_TARGETS.accountUsage, title: translate("tour.account.usage.title"),
      says: translate("tour.account.usage.says"), side: "top" },
    { target: TB_TARGETS.accountProfile, title: translate("tour.account.profile.title"),
      says: translate("tour.account.profile.says"), side: "top" },
    { target: TB_TARGETS.accountCoupons, title: translate("tour.account.coupons.title"),
      says: translate("tour.account.coupons.says"), side: "top" },
    { target: TB_TARGETS.accountSessionKey, title: translate("tour.account.sessionKey.title"),
      says: translate("tour.account.sessionKey.says"), side: "top" },
  ];
}

/** The account page as the package knows it; a site appends its own steps. */
export function accountTour(page = "account", own: TourStep[] = []): Tour {
  return { page, steps: [...walletSteps(), ...accountPanelsSteps(), ...own] };
}
