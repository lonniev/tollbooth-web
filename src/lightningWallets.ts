/**
 * The Lightning wallets a newcomer can install, as the Oracle ranks them.
 *
 * Every operator passes the Oracle's list on as `oracle_lightning_wallets`, so a
 * site reads it through its own connection. The list is shaped here before a
 * page sees it: a link that is not https and a logo that is not an inline PNG
 * are dropped, because a wallet card is a set of doors a stranger will walk
 * through.
 */

import { callTool } from "./client.ts";

export const LIGHTNING_WALLETS_TOOL = "oracle_lightning_wallets";

export type Custody = "custodial" | "self-custodial" | "either";

export interface LightningWallet {
  id: string;
  name: string;
  line: string;
  custody: Custody;
  buysInApp: boolean;
  homepage: string;
  appStore?: string;
  googlePlay?: string;
  logo?: string;
  pinned: boolean;
}

export interface LightningWallets {
  wallets: LightningWallet[];
  /** "brave" when a live search ranked them; "catalog" for the curated order. */
  rankedBy: "brave" | "catalog";
  asOf: Date | null;
  credit: string;
}

const https = (v: unknown): string | undefined =>
  typeof v === "string" && v.startsWith("https://") ? v : undefined;

const CUSTODY: readonly Custody[] = ["custodial", "self-custodial", "either"];

/** The Oracle's answer, shaped and checked; null when it has no wallets. */
export function shapeWallets(raw: unknown): LightningWallets | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || !Array.isArray(r.wallets)) return null;
  const wallets: LightningWallet[] = [];
  for (const w of r.wallets as Record<string, unknown>[]) {
    const homepage = https(w?.homepage);
    if (!homepage || typeof w.id !== "string" || typeof w.name !== "string") continue;
    const logo = typeof w.logo === "string" && w.logo.startsWith("data:image/png;base64,") ? w.logo : undefined;
    wallets.push({
      id: w.id,
      name: w.name,
      line: typeof w.line === "string" ? w.line : "",
      custody: CUSTODY.includes(w.custody as Custody) ? (w.custody as Custody) : "either",
      buysInApp: w.buys_in_app === true,
      homepage,
      appStore: https(w.app_store),
      googlePlay: https(w.google_play),
      logo,
      pinned: w.pinned === true,
    });
  }
  if (!wallets.length) return null;
  const at = typeof r.as_of === "string" ? new Date(r.as_of) : null;
  return {
    wallets,
    rankedBy: r.ranked_by === "brave" ? "brave" : "catalog",
    asOf: at && !Number.isNaN(at.getTime()) ? at : null,
    credit: typeof r.credit === "string" ? r.credit : "",
  };
}

export async function lightningWallets(): Promise<LightningWallets | null> {
  return shapeWallets(await callTool(LIGHTNING_WALLETS_TOOL, {}));
}

/** Which app store this device installs from: Apple's, Google's, or neither. */
export type Store = "apple" | "google" | null;

/**
 * The store for the device the page is on. iPhone, iPad and Mac take the App
 * Store (an iPad may name itself a Mac); Android takes Google Play. Anything
 * else gets neither, and the wallet's website says where to find it.
 */
export function storeFor(userAgent: string): Store {
  if (/Android/i.test(userAgent)) return "google";
  if (/iPhone|iPad|iPod|Macintosh/i.test(userAgent)) return "apple";
  return null;
}

/** The custody label's words. */
export function custodyWords(c: Custody): string {
  return c === "custodial" ? "Holds your sats for you" : c === "self-custodial" ? "Your keys, on your phone" : "Either way";
}
