import assert from "node:assert/strict";
import { test } from "node:test";
import { prefixFromTools, remoteFetch, takesNoNpub } from "./client.ts";

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

test("an operator's prefix is what its service_status tool names", () => {
  assert.equal(prefixFromTools(["goodearth_check_balance", "goodearth_service_status"]), "goodearth");
  assert.equal(prefixFromTools(["oracle_about"]), null);
});

test("a call to another operator without this tab's key goes anonymous, never with a holder bearer", async () => {
  const seen: Headers[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return new Response("{}");
  }) as typeof fetch;
  try {
    await remoteFetch("https://other.example/mcp", { method: "POST", body: "{}" });
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(seen[0].get("Authorization"), "Bearer anonymous");
});
