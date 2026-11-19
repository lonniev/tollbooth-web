import assert from "node:assert/strict";
import { test } from "node:test";

import { makeMcpProxy } from "./pagesProxy.ts";

const UPSTREAM = "https://example-mcp.fastmcp.app/mcp";

test("a preflight is answered here and never reaches the operator", async () => {
  let called = false;
  const proxy = makeMcpProxy(UPSTREAM, async () => {
    called = true;
    return new Response("");
  });
  const r = await proxy({ request: new Request("https://site.test/mcp", { method: "OPTIONS" }) });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Expose-Headers"), "mcp-session-id, www-authenticate");
  assert.match(r.headers.get("Access-Control-Allow-Headers") ?? "", /authorization/);
  assert.equal(called, false);
});

test("only the MCP headers are forwarded — cookies stay behind", async () => {
  let seen: Headers | undefined;
  const proxy = makeMcpProxy(UPSTREAM, async (_url, init) => {
    seen = init.headers as Headers;
    return new Response("{}", { status: 200, headers: { "mcp-session-id": "s1" } });
  });
  const r = await proxy({
    request: new Request("https://site.test/mcp", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", cookie: "secret=1", "mcp-session-id": "s1" },
    }),
  });
  assert.equal(seen?.get("cookie"), null);
  assert.equal(seen?.get("mcp-session-id"), "s1");
  assert.equal(seen?.get("host"), "example-mcp.fastmcp.app");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(r.headers.get("mcp-session-id"), "s1");
});

test("an unreachable operator is a 502 the page can read", async () => {
  const proxy = makeMcpProxy(UPSTREAM, async () => {
    throw new Error("down");
  });
  const r = await proxy({ request: new Request("https://site.test/mcp", { method: "GET" }) });
  assert.equal(r.status, 502);
  assert.match(await r.text(), /Proxy error/);
});

test("a page with no token reaches the operator as an anonymous caller", async () => {
  let seen: Headers | undefined;
  const proxy = makeMcpProxy(UPSTREAM, async (_url, init) => {
    seen = init.headers as Headers;
    return new Response("{}");
  });
  await proxy({ request: new Request("https://site.test/mcp", { method: "POST", body: "{}" }) });
  assert.equal(seen?.get("authorization"), "Bearer anonymous");
});

test("a page that holds a token has it forwarded untouched", async () => {
  let seen: Headers | undefined;
  const proxy = makeMcpProxy(UPSTREAM, async (_url, init) => {
    seen = init.headers as Headers;
    return new Response("{}");
  });
  await proxy({
    request: new Request("https://site.test/mcp", {
      method: "POST",
      body: "{}",
      headers: { authorization: "Bearer dpyc_ha_abc" },
    }),
  });
  assert.equal(seen?.get("authorization"), "Bearer dpyc_ha_abc");
});

import { cafeUpstreamFor, makeCafeProxy } from "./pagesProxy.ts";

test("the café proxy passes the two catalog reads and nothing else", () => {
  assert.equal(cafeUpstreamFor("/cafe/collections.json"), "https://cafe.tollbooth-dpyc.com/collections.json");
  assert.equal(
    cafeUpstreamFor("/cafe/collections/books/products.json", "?page=2"),
    "https://cafe.tollbooth-dpyc.com/collections/books/products.json?limit=24&page=2",
  );
  for (const path of ["/cafe/cart.json", "/cafe/admin/api/orders.json", "/cafe/collections/../admin/products.json", "/cafe/collections/a%2Fb/products.json", "/cafe/collections/books/products.json/x"]) {
    assert.equal(cafeUpstreamFor(path), null, path);
  }
  for (const search of ["?page=0", "?page=-1", "?page=x", "?page=1.5", "?page=1001"]) {
    assert.equal(cafeUpstreamFor("/cafe/collections/books/products.json", search), null, search);
  }
});

test("the café proxy names the site, carries no browser header, and turns a store failure into a 502", async () => {
  let seen: Headers | undefined;
  const ok = makeCafeProxy("Site/1.0", (async (_u: string, init?: RequestInit) => {
    seen = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  const r = await ok({ request: new Request("https://site.test/cafe/collections.json", { headers: { cookie: "s=1" } }) });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(seen?.get("user-agent"), "Site/1.0");
  assert.equal(seen?.get("cookie"), null);
  const lost = makeCafeProxy("Site/1.0", (async () => new Response("", { status: 503 })) as typeof fetch);
  assert.equal((await lost({ request: new Request("https://site.test/cafe/collections.json") })).status, 502);
  assert.equal((await ok({ request: new Request("https://site.test/cafe/cart.json") })).status, 404);
});
