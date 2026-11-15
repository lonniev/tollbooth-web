import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOP_UP_AMOUNTS } from "../wallet.ts";

const exportsOf = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const wallet = readFileSync(new URL("./Wallet.tsx", import.meta.url), "utf8");

test("a site has one wallet and cannot draw its own", () => {
  assert.match(exportsOf, /default as Wallet\b/);
  assert.match(exportsOf, /\bBalanceAndTopUp\b/);
  assert.match(exportsOf, /\bWalletFunds\b/);
  assert.match(exportsOf, /\bWalletStatement\b/);
  for (const gone of ["WalletPage", "WalletCard", "CouponsPanel", "useTopUp", "PAY_FROM_CASH_LINE"]) {
    assert.doesNotMatch(exportsOf, new RegExp(`\\b${gone}\\b`), gone);
  }
});

test("a site may show an invoice as a code and offer the wallet chooser, neither of which is a wallet", () => {
  // InvoiceQr draws any Lightning invoice, such as one person paying another.
  // WalletChooser helps a guest get a wallet before they have signed in.
  // Neither holds a balance, tops one up, or redeems a coupon.
  assert.match(exportsOf, /default as InvoiceQr\b/);
  assert.match(exportsOf, /default as WalletChooser\b/);
});

test("the wallet takes decoration and nothing that changes its layout or scope", () => {
  const props = [...wallet.matchAll(/export (?:default )?function \w+\(\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.deepEqual(props, ["decorateTile", "decorateTile", "decorateTile"]);
});

test("the amounts are the brand's", () => {
  assert.deepEqual([...TOP_UP_AMOUNTS], [100, 500, 1_000, 5_000, 25_000]);
});
