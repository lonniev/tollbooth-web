import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { configureTollbooth } from "./config.ts";
import { completeHolderConnect, connectAsHolder, holderBearer, isHolder } from "./holder.ts";
import { signingFetch } from "./requestSigning.ts";

class MemoryStorage {
  #m = new Map<string, string>();
  getItem(k: string) { return this.#m.get(k) ?? null; }
  setItem(k: string, v: string) { this.#m.set(k, v); }
  removeItem(k: string) { this.#m.delete(k); }
}

const OPERATOR = "https://op.example";
let calls: { url: string; body: string; headers: Headers }[] = [];
let assigned = "";
let tokenReplies: unknown[] = [];

function define(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

beforeEach(() => {
  calls = [];
  assigned = "";
  tokenReplies = [];
  define("localStorage", new MemoryStorage());
  define("sessionStorage", new MemoryStorage());
  define("location", {
    origin: "https://site.example", pathname: "/", search: "",
    assign: (u: string) => { assigned = u; },
  });
  define("history", { replaceState: () => {} });
  define("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? ""), headers: new Headers(init?.headers) });
    if (url.endsWith("/register")) return Response.json({ client_id: "c1" }, { status: 201 });
    if (url.endsWith("/token")) return Response.json(tokenReplies.shift());
    return new Response("{}");
  });
  configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp", operatorUrl: OPERATOR });
});

async function connect() {
  await connectAsHolder("npub1alice");
  const authorize = new URL(assigned);
  (globalThis.location as { search: string }).search = `?code=abc&state=${authorize.searchParams.get("state")}`;
  return authorize;
}

test("connecting registers, sends the browser to authorize with PKCE, and keeps the code exchange for the return", async () => {
  const authorize = await connect();
  assert.equal(authorize.origin + authorize.pathname, `${OPERATOR}/authorize`);
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://site.example/");
  assert.equal(authorize.searchParams.get("resource"), `${OPERATOR}/mcp`);

  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 3600 });
  assert.equal(await completeHolderConnect(), "npub1alice");
  assert.ok(isHolder());
  const exchange = new URLSearchParams(calls.at(-1)!.body);
  assert.equal(exchange.get("grant_type"), "authorization_code");
  assert.ok(exchange.get("code_verifier"));
  assert.equal(await holderBearer(), "dpyc_ha_1");
});

test("a lapsing access token is refreshed, and the new pair is kept", async () => {
  await connect();
  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 30 });
  await completeHolderConnect();
  tokenReplies.push({ access_token: "dpyc_ha_2", refresh_token: "dpyc_hr_2", expires_in: 3600 });
  assert.equal(await holderBearer(), "dpyc_ha_2");
  assert.equal(new URLSearchParams(calls.at(-1)!.body).get("refresh_token"), "dpyc_hr_1");
  assert.equal(await holderBearer(), "dpyc_ha_2");
});

test("a page load that is not a return does nothing", async () => {
  assert.equal(await completeHolderConnect(), null);
  assert.equal(isHolder(), false);
});

test("a holder tab's requests carry its bearer", async () => {
  await connect();
  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 3600 });
  await completeHolderConnect();
  await signingFetch("https://site.example/mcp", { method: "POST", body: "{}" });
  assert.equal(calls.at(-1)!.headers.get("authorization"), "Bearer dpyc_ha_1");
});
