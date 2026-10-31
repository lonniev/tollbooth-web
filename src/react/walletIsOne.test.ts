import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOP_UP_AMOUNTS } from "../wallet.ts";

const exportsOf = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const wallet = readFileSync(new URL("./Wallet.tsx", import.meta.url), "utf8");

test("a site has one wallet and cannot draw its own", () => {
  assert.match(exportsOf, /default as Wallet\b/);
  assert.match(exportsOf, /\bBalanceAndTopUp\b/);
  for (const gone of ["WalletPage", "WalletCard", "CouponsPanel", "InvoiceQr", "useTopUp", "WalletChooser", "PAY_FROM_CASH_LINE"]) {
    assert.doesNotMatch(exportsOf, new RegExp(`\\b${gone}\\b`), gone);
  }
});

test("the wallet takes decoration and nothing that changes its layout or scope", () => {
  const props = [...wallet.matchAll(/export (?:default )?function \w+\(\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.deepEqual(props, ["decorateTile", "decorateTile"]);
});

test("the amounts are the brand's", () => {
  assert.deepEqual([...TOP_UP_AMOUNTS], [100, 500, 1_000, 5_000, 25_000]);
});
