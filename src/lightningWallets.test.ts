import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cashWalletDoors, custodyWords, shapeWallets, storeFor } from "./lightningWallets.ts";

const good = {
  id: "wos", name: "Wallet of Satoshi", line: "Easy.", custody: "self-custodial", buys_in_app: false,
  homepage: "https://www.walletofsatoshi.com", app_store: "https://apps.apple.com/x", google_play: "https://play.google.com/y",
  logo: "data:image/png;base64,AAAA", pinned: true,
};

describe("shapeWallets", () => {
  it("shapes the Oracle's answer", () => {
    const out = shapeWallets({ wallets: [good], ranked_by: "brave", as_of: "2026-10-25T12:00:00+00:00", credit: "c" });
    assert.equal(out?.rankedBy, "brave");
    assert.equal(out?.wallets[0].appStore, "https://apps.apple.com/x");
    assert.equal(out?.wallets[0].pinned, true);
    assert.equal(out?.asOf?.toISOString(), "2026-10-25T12:00:00.000Z");
  });
  it("drops a link that is not https, and a wallet with no https homepage", () => {
    const out = shapeWallets({ wallets: [
      { ...good, app_store: "javascript:alert(1)", logo: "https://tracker.example/x.png" },
      { ...good, id: "bad", homepage: "http://insecure.example" },
    ] });
    assert.equal(out?.wallets.length, 1);
    assert.equal(out?.wallets[0].appStore, undefined);
    assert.equal(out?.wallets[0].logo, undefined);
  });
  it("is null when there is nothing to show", () => {
    assert.equal(shapeWallets({ success: false, error: "x" }), null);
    assert.equal(shapeWallets({ wallets: [] }), null);
    assert.equal(shapeWallets(null), null);
  });
  it("reads an unknown ranking or custody as the safe default", () => {
    const out = shapeWallets({ wallets: [{ ...good, custody: "?" }], ranked_by: "other" });
    assert.equal(out?.rankedBy, "catalog");
    assert.equal(out?.wallets[0].custody, "either");
    assert.equal(custodyWords("custodial"), "Holds your sats for you");
  });

  it("offers only the store the device installs from", () => {
    assert.equal(storeFor("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "apple");
    assert.equal(storeFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605"), "apple");
    assert.equal(storeFor("Mozilla/5.0 (Linux; Android 15; Pixel 9)"), "google");
    assert.equal(storeFor("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), null);
  });
});

it("the cash wallets always have a name and a link, and a logo and installer once the Oracle answers", () => {
  assert.deepEqual(cashWalletDoors(null, "apple"), [
    { id: "strike", name: "Strike", href: "https://strike.me", logo: undefined },
    { id: "cash-app", name: "Cash App", href: "https://cash.app", logo: undefined },
  ]);
  const list = { rankedBy: "catalog" as const, asOf: null, credit: "", wallets: [{
    id: "strike", name: "Strike", line: "", custody: "custodial" as const, buysInApp: true, pinned: false,
    homepage: "https://strike.me", appStore: "https://apple.example/strike", googlePlay: "https://google.example/strike", logo: "data:image/png;base64,AA",
  }] };
  const [strike, cash] = cashWalletDoors(list, "google");
  assert.equal(strike.href, "https://google.example/strike");
  assert.equal(strike.logo, "data:image/png;base64,AA");
  assert.equal(cash.href, "https://cash.app");
  assert.equal(cashWalletDoors(list, null)[0].href, "https://strike.me");
});
