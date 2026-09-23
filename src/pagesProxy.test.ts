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
  assert.equal(r.headers.get("Access-Control-Expose-Headers"), "mcp-session-id");
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
