import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { configureTollbooth } from "./config.ts";
import { connectAsHolder, holderBearer, isHolder } from "./holder.ts";
import { signingFetch } from "./requestSigning.ts";

class MemoryStorage {
  #m = new Map<string, string>();
  getItem(k: string) { return this.#m.get(k) ?? null; }
  setItem(k: string, v: string) { this.#m.set(k, v); }
  removeItem(k: string) { this.#m.delete(k); }
}

const OPERATOR = "https://op.example";
let calls: { url: string; body: string; headers: Headers }[] = [];
let tokenReplies: unknown[] = [];
/** What /authorize answers: the issued redirect for the state it was asked with, by default. */
let authorizeReply: (url: URL) => Response;

function define(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

beforeEach(() => {
  calls = [];
  tokenReplies = [];
  authorizeReply = (url) =>
    Response.json({ redirect_uri: `https://site.example/?code=abc&state=${url.searchParams.get("state")}` });
  define("localStorage", new MemoryStorage());
  define("sessionStorage", new MemoryStorage());
  define("location", {
    origin: "https://site.example", pathname: "/signin", search: "",
    assign: () => { throw new Error("the page must not leave itself"); },
  });
  define("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body ?? ""), headers: new Headers(init?.headers) });
    if (url.endsWith("/register")) return Response.json({ client_id: "c1" }, { status: 201 });
    if (url.startsWith(`${OPERATOR}/authorize`)) return authorizeReply(new URL(url));
    if (url.endsWith("/token")) return Response.json(tokenReplies.shift());
    return new Response("{}");
  });
  configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp", operatorUrl: OPERATOR });
});

test("connecting registers, takes a code from authorize by fetch with PKCE, and exchanges it in place", async () => {
  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 3600 });
  await connectAsHolder();
  const authorize = calls.find((c) => c.url.startsWith(`${OPERATOR}/authorize`))!;
  const asked = new URL(authorize.url);
  assert.equal(authorize.headers.get("accept"), "application/json");
  assert.equal(asked.searchParams.get("code_challenge_method"), "S256");
  assert.equal(asked.searchParams.get("redirect_uri"), "https://site.example/");
  assert.equal(asked.searchParams.get("resource"), `${OPERATOR}/mcp`);
  assert.ok(isHolder());
  const exchange = new URLSearchParams(calls.at(-1)!.body);
  assert.equal(exchange.get("grant_type"), "authorization_code");
  assert.equal(exchange.get("code"), "abc");
  assert.ok(exchange.get("code_verifier"));
  assert.equal(await holderBearer(), "dpyc_ha_1");
});

test("a reply for another sign-in is refused, and nothing is kept", async () => {
  authorizeReply = () => Response.json({ redirect_uri: "https://site.example/?code=abc&state=other" });
  await assert.rejects(connectAsHolder(), /did not match/);
  assert.equal(isHolder(), false);
});

test("a refusal from authorize is said in the service's words", async () => {
  authorizeReply = () =>
    Response.json({ error: "invalid_request", error_description: "Unknown client." }, { status: 400 });
  await assert.rejects(connectAsHolder(), /Unknown client/);
  assert.equal(isHolder(), false);
});

test("a lapsing access token is refreshed, and the new pair is kept", async () => {
  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 30 });
  await connectAsHolder();
  tokenReplies.push({ access_token: "dpyc_ha_2", refresh_token: "dpyc_hr_2", expires_in: 3600 });
  assert.equal(await holderBearer(), "dpyc_ha_2");
  assert.equal(new URLSearchParams(calls.at(-1)!.body).get("refresh_token"), "dpyc_hr_1");
  assert.equal(await holderBearer(), "dpyc_ha_2");
});

test("a holder tab's requests carry its bearer", async () => {
  tokenReplies.push({ access_token: "dpyc_ha_1", refresh_token: "dpyc_hr_1", expires_in: 3600 });
  await connectAsHolder();
  await signingFetch("https://site.example/mcp", { method: "POST", body: "{}" });
  assert.equal(calls.at(-1)!.headers.get("authorization"), "Bearer dpyc_ha_1");
});
