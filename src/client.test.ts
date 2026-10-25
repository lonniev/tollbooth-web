import assert from "node:assert/strict";
import { test } from "node:test";
import { takesNoNpub } from "./client.ts";

test("the Oracle's tools never get the caller's npub", () => {
  assert.equal(takesNoNpub("oracle_lightning_wallets"), true);
  assert.equal(takesNoNpub("oracle_network_advisory"), true);
});

test("standard and site-named bootstrap tools go without it; the rest carry it", () => {
  assert.equal(takesNoNpub("get_pricing_model"), true);
  assert.equal(takesNoNpub("almanac", ["almanac"]), true);
  assert.equal(takesNoNpub("check_balance"), false);
  assert.equal(takesNoNpub("almanac"), false);
});
