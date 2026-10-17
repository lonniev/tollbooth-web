/**
 * The operator MCP, as a page calls it.
 *
 * 1. One @modelcontextprotocol/sdk Client over StreamableHTTP, shared by the
 *    whole page. The SDK handles the initialize handshake and the session.
 * 2. Identity rides on the connection, invisible to callers: while this tab
 *    holds the signed-in npub's key, every request is signed with it (NIP-98)
 *    and a call names only the npub. Otherwise the DM proof token cached at
 *    `receive_npub_proof` is sent as is.
 * 3. Bootstrap tools take no envelope and are safe before sign-in.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { tollboothConfig, toolName } from "./config.ts";
import { debugPush, redact } from "./debugLog.ts";
import {
  clearStoredProof,
  forgetRecentLogin,
  getStoredNpub,
  getStoredProof,
} from "./identity.ts";
import { isTransportFailure, NetworkError } from "./networkError.ts";
import { signingFetch, signsForSignedInNpub } from "./requestSigning.ts";
import {
  errorText,
  deadGrantMessage,
  looksFailed,
  proofBounceMessage,
  readToolResult,
  type ImageBlock,
  type RawToolResult,
} from "./toolResult.ts";

/**
 * Standard tools whose wheel signature takes no npub/proof envelope. Pydantic
 * strict mode rejects unexpected kwargs, so they must not get one.
 */
const STANDARD_BOOTSTRAP = [
  "request_npub_proof",
  "receive_npub_proof",
  "service_status",
  "session_status",
  "get_nostr_profile",
  "publish_nostr_profile",
  "get_operator_onboarding_status",
  "check_authority_balance",
  "get_pricing_model",
  "list_canonical_identities",
  "check_proof_status",
  "get_patron_onboarding_status",
  "request_patron_credentials",
  "receive_patron_credentials",
];

const STANDARD_QUIET = ["service_status", "get_nostr_profile"];

let client: Client | null = null;
let connecting: Promise<void> | null = null;

function mcpUrl(): string {
  const url = tollboothConfig().mcpUrl;
  if (!url) throw new Error("mcpUrl is not configured (e.g. \"/mcp\").");
  return url.startsWith("/") ? `${globalThis.location.origin}${url}` : url;
}

async function getClient(): Promise<Client> {
  if (client) return client;
  if (!connecting) {
    // Cleared whether it worked or not. Cleared only on success, one failed
    // connect — no signal, a cold server — was awaited again by every later
    // call, and nothing reached the server until the page was reloaded.
    connecting = (async () => {
      const c = new Client({ name: `${tollboothConfig().slug}-frontend`, version: "1" });
      await c.connect(new StreamableHTTPClientTransport(new URL(mcpUrl()), { fetch: signingFetch }));
      client = c;
    })().finally(() => {
      connecting = null;
    });
  }
  await connecting;
  if (!client) throw new Error("Could not connect to the service.");
  return client;
}

/**
 * What a call adds to prove the npub: nothing when the request itself is
 * signed with the signed-in npub's key, else the cached DM token.
 */
function proofFor(): { dpop_token?: string } {
  try {
    if (signsForSignedInNpub()) return {};
  } catch {
    /* fall through to the cached token */
  }
  return { dpop_token: getStoredProof() };
}

export { isNetworkError, NetworkError } from "./networkError.ts";

/** A paid call bounced for a lapsed or missing proof. The gate re-arms sign-in. */
export class ProofRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofRequiredError";
  }
}

type ProofExpiredListener = (message: string) => void;
const proofExpiredListeners = new Set<ProofExpiredListener>();

/**
 * Subscribe to proof bounces from anywhere in the app. Without this the tree
 * never learns the token was cleared, and the patron is stranded on a page
 * whose data will not load. Returns an unsubscribe function.
 */
export function onProofExpired(cb: ProofExpiredListener): () => void {
  proofExpiredListeners.add(cb);
  return () => proofExpiredListeners.delete(cb);
}

function emitProofExpired(message: string): void {
  for (const cb of proofExpiredListeners) {
    try {
      cb(message);
    } catch {
      /* a listener error must not swallow the throw that follows */
    }
  }
}

export interface CallOptions {
  /**
   * A non-essential call — diagnostics, personalization, a board polled all
   * match. A soft proof miss here never logs the patron out; a stored grant
   * the service refused for good (expired, revoked) still does.
   */
  bestEffort?: boolean;
  timeoutMs?: number;
}

export interface ToolAnswer<T> {
  data: T;
  images: ImageBlock[];
}

/**
 * Call a tool by its short name ("snapshot_display", not
 * "chart_snapshot_display") and get both its answer and any images it sent.
 *
 * Throws a `NetworkError` when the call never reached the service (offline,
 * fetch failed, timed out before an answer) — safe to queue and send again —
 * and a plain `Error` for anything the service answered, which is not.
 */
export async function callToolWithContent<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<ToolAnswer<T>> {
  const cfg = tollboothConfig();
  const name = toolName(tool);
  const quiet = STANDARD_QUIET.includes(tool) || cfg.quietTools.includes(tool);
  // `args` holds only the caller's own parameters — the envelope is added
  // below — so it is safe to log.
  if (!quiet) debugPush("call", `${name}(${redact(JSON.stringify(args)).slice(0, 140)})`);

  const bootstrap = STANDARD_BOOTSTRAP.includes(tool) || cfg.extraBootstrapTools.includes(tool);
  const proof = bootstrap ? null : proofFor();
  const merged = proof ? { npub: getStoredNpub(), ...proof, ...args } : { ...args };

  let result: RawToolResult;
  try {
    const c = await getClient();
    result = (await c.callTool(
      { name, arguments: merged },
      undefined,
      { timeout: opts.timeoutMs ?? 120_000 },
    )) as RawToolResult;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    if (isTransportFailure(e)) {
      // Never reached the service, or no answer came back: safe to retry.
      if (!quiet) debugPush("error", `${name}: unreachable — ${why}`);
      throw new NetworkError(name, e);
    }
    if (!quiet) debugPush("error", `${name}: ${why}`);
    throw new Error(`${name}: ${why}`, { cause: e });
  }

  if (result.isError) {
    const text = errorText(result);
    if (!quiet) debugPush("error", `${name}: ${redact(text).slice(0, 200)}`);
    throw new Error(text);
  }

  const { payload, images } = readToolResult(result);
  if (!quiet) {
    const preview = typeof payload === "string" ? payload : JSON.stringify(payload);
    const tail = images.length ? ` +${images.length} image` : "";
    debugPush(looksFailed(payload) ? "error" : "result", `${name} → ${redact(String(preview)).slice(0, 220)}${tail}`);
  }

  // A stored grant the service refused for good signs the patron out even
  // from a best-effort call: that is not a blip, and staying "signed in" on a
  // dead grant leaves every page failing with nothing to tell them why.
  const bounced =
    (opts.bestEffort ? null : proofBounceMessage(payload)) ??
    (proof?.dpop_token ? deadGrantMessage(payload) : null);
  if (bounced !== null) {
    // The token just refused is the same one the recent-login shortcut
    // would replay, so it goes too, or a returning patron re-bounces.
    const npub = getStoredNpub();
    clearStoredProof();
    if (npub) forgetRecentLogin(npub);
    emitProofExpired(bounced);
    throw new ProofRequiredError(bounced);
  }
  return { data: payload as T, images };
}

export async function callTool<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<T> {
  return (await callToolWithContent<T>(tool, args, opts)).data;
}
