/**
 * This tab as a *holder*: a connection the operator knows, into whose wallet
 * npubs are proven by DM. A patron who signs in by DM — holding no key — is
 * proven this way, and the grant stays with the operator; the page holds only
 * the connection's OAuth tokens and names the npub on each call.
 *
 * Becoming a holder is the OAuth Authorization Code flow every MCP client
 * runs: register, send the browser to the operator's `/authorize` (it approves
 * at once, since a holder holds nothing until a DM proves an npub into it),
 * and exchange the code it hands back. Tokens refresh on their own; a refresh
 * token is single-use, so each refresh stores the pair it returns.
 */

import { tollboothConfig } from "./config.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";

const TOKENS = "holder:v1";
const PENDING = "holder_pending:v1";
/** Refresh this long before the access token lapses. */
const REFRESH_EARLY_MS = 60_000;

interface Tokens {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Unix ms. */
  expiresAt: number;
}

interface Pending {
  clientId: string;
  verifier: string;
  state: string;
  /** What the sign-in was doing when the browser left, to resume on return. */
  resume: string;
}

function operator(): string {
  const url = tollboothConfig().operatorUrl;
  if (!url) throw new Error("operatorUrl is not configured.");
  return url.replace(/\/+$/, "");
}

/** True when this site connects as a holder (its operator supports it). */
export function holderEnabled(): boolean {
  return Boolean(tollboothConfig().operatorUrl);
}

function redirectUri(): string {
  return `${globalThis.location.origin}/`;
}

function readTokens(): Tokens | null {
  try {
    const t = JSON.parse(readStored(TOKENS) || "null");
    return t && typeof t.accessToken === "string" && typeof t.refreshToken === "string" ? t : null;
  } catch {
    return null;
  }
}

function writeTokens(t: Tokens): void {
  writeStored(TOKENS, JSON.stringify(t));
}

function randomUrlSafe(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function register(): Promise<string> {
  const r = await fetch(`${operator()}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: tollboothConfig().appName,
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!r.ok) throw new Error(`Could not register with the service (${r.status}).`);
  return (await r.json()).client_id as string;
}

async function token(form: Record<string, string>, clientId: string): Promise<Tokens> {
  const r = await fetch(`${operator()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, client_id: clientId, resource: `${operator()}/mcp` }),
  });
  if (!r.ok) throw new Error(`The service refused the connection (${r.status}).`);
  const t = await r.json();
  return {
    clientId,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + Number(t.expires_in ?? 3600) * 1000,
  };
}

/** True when this tab already is a holder. */
export function isHolder(): boolean {
  return readTokens() !== null;
}

/**
 * Become a holder: register and send the browser to the operator, which
 * sends it straight back. `resume` comes back from `completeHolderConnect`.
 */
export async function connectAsHolder(resume: string): Promise<void> {
  const clientId = readTokens()?.clientId || (await register());
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(16);
  const pending: Pending = { clientId, verifier, state, resume };
  globalThis.sessionStorage.setItem(PENDING, JSON.stringify(pending));
  const url = new URL(`${operator()}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri(),
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
    resource: `${operator()}/mcp`,
  }).toString();
  globalThis.location.assign(url.toString());
}

/**
 * On return from the operator: exchange the code, store the tokens, tidy the
 * address bar, and hand back what the sign-in was doing. Null when this page
 * load is not a return.
 */
export async function completeHolderConnect(): Promise<string | null> {
  const params = new URLSearchParams(globalThis.location.search);
  const code = params.get("code");
  const raw = globalThis.sessionStorage.getItem(PENDING);
  if (!code || !raw) return null;
  globalThis.sessionStorage.removeItem(PENDING);
  const pending = JSON.parse(raw) as Pending;
  globalThis.history.replaceState(null, "", globalThis.location.pathname);
  if (params.get("state") !== pending.state) throw new Error("The service's reply did not match this sign-in.");
  writeTokens(await token(
    { grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: pending.verifier },
    pending.clientId,
  ));
  return pending.resume;
}

/** The bearer for the next request, refreshed when it is about to lapse; null when not a holder. */
export async function holderBearer(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (t.expiresAt - REFRESH_EARLY_MS > Date.now()) return t.accessToken;
  try {
    const fresh = await token({ grant_type: "refresh_token", refresh_token: t.refreshToken }, t.clientId);
    writeTokens(fresh);
    return fresh.accessToken;
  } catch {
    removeStored(TOKENS);
    return null;
  }
}

/** Disconnect: the operator forgets this holder and every npub it held. */
export async function forgetHolder(): Promise<void> {
  const t = readTokens();
  removeStored(TOKENS);
  if (!t) return;
  try {
    await fetch(`${operator()}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: t.refreshToken, token_type_hint: "refresh_token", client_id: t.clientId }),
    });
  } catch {
    /* the tokens are gone from this tab; the operator lets them lapse */
  }
}
