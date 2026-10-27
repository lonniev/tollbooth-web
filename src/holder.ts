/**
 * This tab as a *holder*: a connection the operator knows, into whose wallet
 * npubs are proven by DM. A patron who signs in by DM — holding no key — is
 * proven this way, and the grant stays with the operator; the page holds only
 * the connection's OAuth tokens and names the npub on each call.
 *
 * Becoming a holder is the OAuth Authorization Code flow every MCP client
 * runs, done by fetch: register, ask the operator's `/authorize` for a code
 * (it approves at once, since a holder holds nothing until a DM proves an npub
 * into it, and answers a page in JSON), and exchange the code. The page never
 * leaves itself. Tokens refresh on their own; a refresh token is single-use,
 * so each refresh stores the pair it returns.
 *
 * Only one refresh may be in flight, across every tab on the site. The
 * operator reads a spent refresh token coming back as theft and disconnects
 * the holder, so two calls racing to refresh the same pair — a page waking
 * after an hour and loading its panels at once — cost the patron the whole
 * connection. Concurrent callers here share one refresh, and a Web Lock
 * serialises tabs, each re-reading the store once it holds the lock.
 */

import { tollboothConfig } from "./config.ts";
import { key, readStored, removeStored, writeStored } from "./storage.ts";

const TOKENS = "holder:v1";
/** The DM sign-ins this holder holds; they go with it. See identity.ts. */
export const RECENT_LOGINS = "recent-logins:v1";
/** Refresh this long before the access token lapses. */
const REFRESH_EARLY_MS = 60_000;

interface Tokens {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** Unix ms. */
  expiresAt: number;
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

/** The address the code is issued to. Registered and named, never visited. */
function redirectUri(): string {
  return `${globalThis.location.origin}/`;
}

/** The operator answered the token endpoint with a refusal, not a network fault. */
class TokenRefused extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`The service refused the connection (${status}).`);
    this.status = status;
  }
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
  if (!r.ok) throw new TokenRefused(r.status);
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

/** Become a holder: register, take a code from the operator by fetch, and exchange it. */
export async function connectAsHolder(): Promise<void> {
  const clientId = readTokens()?.clientId || (await register());
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(16);
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
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const answer = await r.json().catch(() => ({}));
  if (!r.ok || typeof answer.redirect_uri !== "string") {
    throw new Error(answer.error_description || `The service would not connect this page (${r.status}).`);
  }
  const issued = new URL(answer.redirect_uri).searchParams;
  if (issued.get("state") !== state) throw new Error("The service's reply did not match this sign-in.");
  const code = issued.get("code");
  if (!code) throw new Error(issued.get("error_description") || "The service did not connect this page.");
  writeTokens(await token(
    { grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier },
    clientId,
  ));
}

/** The bearer for the next request, refreshed when it is about to lapse; null when not a holder. */
export async function holderBearer(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (fresh(t)) return t.accessToken;
  refreshing ??= withTokenLock(refresh).finally(() => { refreshing = null; });
  return refreshing;
}

let refreshing: Promise<string | null> | null = null;

function fresh(t: Tokens): boolean {
  return t.expiresAt - REFRESH_EARLY_MS > Date.now();
}

/** Run `fn` holding this site's token lock, so no two tabs refresh one pair. */
function withTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request(key(TOKENS), fn) : fn();
}

async function refresh(): Promise<string | null> {
  // Another tab may have refreshed while this one waited for the lock.
  const t = readTokens();
  if (!t) return null;
  if (fresh(t)) return t.accessToken;
  try {
    const next = await token({ grant_type: "refresh_token", refresh_token: t.refreshToken }, t.clientId);
    writeTokens(next);
    return next.accessToken;
  } catch (e) {
    // A refusal ends this holder; a network fault leaves it for the next try.
    if (e instanceof TokenRefused) dropHolder();
    return null;
  }
}

/** Forget this tab's holder and the sign-ins it held, without telling the operator. */
function dropHolder(): void {
  removeStored(TOKENS);
  removeStored(RECENT_LOGINS);
}

/**
 * The operator answered `bearer` with 401: it no longer knows this holder.
 * Connect afresh and return the new bearer, or null when this tab was not
 * riding that bearer or cannot reconnect. The sign-ins the old holder held
 * are gone with it; the patron proves them again.
 */
export async function reconnectAfterRefusal(bearer: string): Promise<string | null> {
  return withTokenLock(async () => {
    const t = readTokens();
    // Another call already replaced it: use the new one.
    if (t && t.accessToken !== bearer) return fresh(t) ? t.accessToken : null;
    dropHolder();
    try {
      await connectAsHolder();
    } catch {
      return null;
    }
    return readTokens()?.accessToken ?? null;
  });
}

/** Disconnect: the operator forgets this holder and every npub it held. */
export async function forgetHolder(): Promise<void> {
  const t = readTokens();
  dropHolder();
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
