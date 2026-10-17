/**
 * Every request a page sends while it holds the signed-in npub's key is signed
 * with that key (NIP-98): an `Authorization: Nostr` event bound to the method,
 * the URL and the sha256 of the body. Whoever holds the key needs no grant, and
 * no tool call carries a proof in its arguments.
 */

import { finalizeEvent } from "nostr-tools";

import { holderBearer } from "./holder.ts";
import { getStoredNpub } from "./identity.ts";
import { clearSessionNsec, getSessionNsecBytes, hasSessionNsec, sessionNsecNpub } from "./sessionNsec.ts";

const PROOF_KIND = 27235;

/**
 * 16 random bytes as 32 lowercase hex chars. Without it two requests signed in
 * the same wall-clock second could be byte-identical, their ids would collide,
 * and the server's replay guard would refuse the second.
 */
export function proofNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The `Authorization` value for one request, signed by `secretKey`. */
export async function signRequest(
  method: string,
  url: string,
  body: string,
  secretKey: Uint8Array,
): Promise<string> {
  const event = finalizeEvent(
    {
      kind: PROOF_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["u", url],
        ["method", method.toUpperCase()],
        ["payload", await sha256Hex(body)],
        ["nonce", proofNonce()],
      ],
      content: "",
    },
    secretKey,
  );
  return `Nostr ${btoa(JSON.stringify(event))}`;
}

/**
 * True when this tab holds the key of the npub that is signed in. A key left
 * from a previous identity is evicted rather than allowed to sign.
 */
export function signsForSignedInNpub(): boolean {
  const sessionNpub = hasSessionNsec() ? sessionNsecNpub() : null;
  if (!sessionNpub) return false;
  if (sessionNpub === getStoredNpub()) return true;
  clearSessionNsec();
  return false;
}

/**
 * `fetch` for the MCP transport: the request carries who it may act as — this
 * tab's key when it holds one, else this tab's holder connection, else nobody
 * (the site's proxy then marks it anonymous).
 */
export const signingFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (signsForSignedInNpub()) {
    const request = new Request(input, init);
    const body = typeof init?.body === "string" ? init.body : "";
    headers.set("Authorization", await signRequest(request.method, request.url, body, getSessionNsecBytes()));
  } else {
    const bearer = await holderBearer();
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  }
  return fetch(input, { ...init, headers });
};
