/**
 * The operator MCP, as a page calls it.
 *
 * 1. One @modelcontextprotocol/sdk Client over StreamableHTTP, shared by the
 *    whole page. The SDK handles the initialize handshake and the session.
 * 2. Identity rides on the connection, invisible to callers: while this tab
 *    holds the signed-in npub's key, every request is signed with it (NIP-98);
 *    otherwise the request carries this tab's holder bearer, and the operator
 *    holds the DM proof. A call names only the npub.
 * 3. Bootstrap tools take no npub and are safe before sign-in.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { tollboothConfig, toolName } from "./config.ts";
import { debugPush, redact } from "./debugLog.ts";
import { isHolder } from "./holder.ts";
import { forgetRecentLogin, getStoredNpub } from "./identity.ts";
import { isTransportFailure, NetworkError } from "./networkError.ts";
import { signingFetch, signRequest, signsForSignedInNpub } from "./requestSigning.ts";
import { getSessionNsecBytes } from "./sessionNsec.ts";
import {
  errorText,
  deadGrantMessage,
  looksFailed,
  proofBounceMessage,
  readToolResult,
  type ImageBlock,
  type RawToolResult,
} from "./toolResult.ts";
import type { ToolSchema } from "./toolSignature.ts";

/**
 * Standard tools whose wheel signature takes no `npub`. Pydantic strict mode
 * rejects unexpected kwargs, so they must not get one.
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
  "request_peer_grant",
  "receive_peer_grant",
];

const STANDARD_QUIET = ["service_status", "get_nostr_profile"];

/**
 * Whether a call goes without the signed-in npub. The `oracle_*` tools are
 * the Oracle's own, passed through by every operator, and none of them acts
 * as the caller; an npub one does take (`oracle_lookup_member`) is the
 * caller's own argument.
 */
export function takesNoNpub(tool: string, extra: readonly string[] = []): boolean {
  return STANDARD_BOOTSTRAP.includes(tool) || tool.startsWith("oracle_") || extra.includes(tool);
}

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
 * never learns the sign-in was dropped, and the patron is stranded on a page
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
  return invoke<T>(
    {
      client: getClient,
      name: toolName(tool),
      quiet: STANDARD_QUIET.includes(tool) || cfg.quietTools.includes(tool),
      bootstrap: takesNoNpub(tool, cfg.extraBootstrapTools),
      home: true,
    },
    args,
    opts,
  );
}

/** Where one call goes, and how its refusals are taken. */
interface Target {
  client: () => Promise<Client>;
  /** The runtime tool name, prefix included. */
  name: string;
  quiet: boolean;
  bootstrap: boolean;
  /**
   * The site's own operator. Only its refusals touch the sign-in: another
   * operator refusing a call says nothing about this page's session.
   */
  home: boolean;
}

async function invoke<T>(target: Target, args: Record<string, unknown>, opts: CallOptions): Promise<ToolAnswer<T>> {
  const { name, quiet, bootstrap, home } = target;
  // `args` holds only the caller's own parameters — the npub is added below —
  // so it is safe to log.
  if (!quiet) debugPush("call", `${name}(${redact(JSON.stringify(args)).slice(0, 140)})`);

  const merged = bootstrap ? { ...args } : { npub: getStoredNpub(), ...args };
  // A call this tab's holder proves rides a grant the operator keeps; a signed
  // call proves itself afresh and has none to lose.
  const rodeHolder = home && !bootstrap && isHolder() && !signsForSignedInNpub();

  let result: RawToolResult;
  try {
    const c = await target.client();
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

  // A held grant the service refused for good signs the patron out even from
  // a best-effort call: that is not a blip, and staying "signed in" on a dead
  // grant leaves every page failing with nothing to tell them why.
  const bounced =
    (opts.bestEffort ? null : proofBounceMessage(payload)) ??
    (rodeHolder ? deadGrantMessage(payload) : null);
  if (bounced !== null) {
    if (home) {
      // The recent-login shortcut would re-enter on the same refused hold, so
      // it goes too, or a returning patron re-bounces.
      const npub = getStoredNpub();
      if (npub) forgetRecentLogin(npub);
      emitProofExpired(bounced);
    }
    throw new ProofRequiredError(bounced);
  }
  return { data: payload as T, images };
}

// ─── Other operators ─────────────────────────────────────────────────────

/**
 * Another operator's MCP, called from this page as the signed-in npub. A page
 * that works across operators (a sponsor's console, say) reads and pays at each
 * one directly: their endpoints answer any origin.
 *
 * Every request is signed with this tab's key (NIP-98) while it holds one, and
 * is otherwise anonymous: this site's holder bearer was issued by its own
 * operator and is never sent elsewhere. A refusal from another operator throws
 * `ProofRequiredError` and leaves this page's sign-in alone.
 */
export interface OperatorClient {
  /** The MCP endpoint, e.g. "https://goodearth-mcp.fastmcp.app/mcp". */
  readonly url: string;
  /** Its tool prefix ("goodearth"), read from its own tool list. */
  prefix(): Promise<string>;
  callTool<T = unknown>(tool: string, args?: Record<string, unknown>, opts?: CallOptions): Promise<T>;
  callToolWithContent<T = unknown>(
    tool: string,
    args?: Record<string, unknown>,
    opts?: CallOptions,
  ): Promise<ToolAnswer<T>>;
}

const operators = new Map<string, OperatorClient>();

/**
 * The tool prefix an operator's tool list implies: every operator registers
 * `<prefix>_service_status`. Null when the list has none.
 */
export function prefixFromTools(names: readonly string[]): string | null {
  const status = names.find((n) => n.endsWith("_service_status"));
  return status ? status.slice(0, -"_service_status".length) : null;
}

/** A tool's runtime name under `prefix`; an empty prefix names it bare. */
export function toolNameUnder(prefix: string, tool: string): string {
  return prefix ? `${prefix}_${tool}` : tool;
}

/** `fetch` for another operator: this tab's key, or nobody. */
export const remoteFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (signsForSignedInNpub()) {
    const request = new Request(input, init);
    const body = typeof init?.body === "string" ? init.body : "";
    headers.set("Authorization", await signRequest(request.method, request.url, body, getSessionNsecBytes()));
  } else {
    headers.set("Authorization", "Bearer anonymous");
  }
  return fetch(input, { ...init, headers });
};

export interface OperatorClientOptions {
  /**
   * The operator's tool prefix, when it is known or has none: "" for a
   * service whose tools are unprefixed (the Oracle's `list_services`).
   * Omitted, it is read from the operator's own tool list.
   */
  prefix?: string;
}

/** The client for the operator at `url`, one per URL for the page's life. */
export function operatorClient(url: string, options: OperatorClientOptions = {}): OperatorClient {
  const known = operators.get(url);
  if (known) return known;

  let client: Client | null = null;
  let connecting: Promise<Client> | null = null;
  const connect = (): Promise<Client> => {
    if (client) return Promise.resolve(client);
    connecting ??= (async () => {
      const c = new Client({ name: `${tollboothConfig().slug}-frontend`, version: "1" });
      await c.connect(new StreamableHTTPClientTransport(new URL(url), { fetch: remoteFetch }));
      client = c;
      return c;
    })().finally(() => {
      connecting = null;
    });
    return connecting;
  };

  let prefixed: Promise<string> | null = options.prefix === undefined ? null : Promise.resolve(options.prefix);
  const prefix = (): Promise<string> => {
    prefixed ??= (async () => {
      const names: string[] = [];
      let cursor: string | undefined;
      const c = await connect();
      do {
        const page = await c.listTools(cursor ? { cursor } : undefined);
        names.push(...page.tools.map((t) => t.name));
        cursor = page.nextCursor;
      } while (cursor);
      const p = prefixFromTools(names);
      if (p === null) throw new Error(`${url} lists no service_status tool: not a Tollbooth operator.`);
      return p;
    })().catch((e) => {
      prefixed = null; // a cold or unreachable operator may answer next time
      throw e;
    });
    return prefixed;
  };

  const callWith = async <T>(tool: string, args: Record<string, unknown> = {}, opts: CallOptions = {}) =>
    invoke<T>(
      { client: connect, name: toolNameUnder(await prefix(), tool), quiet: false, bootstrap: takesNoNpub(tool), home: false },
      args,
      opts,
    );

  const op: OperatorClient = {
    url,
    prefix,
    callToolWithContent: callWith,
    callTool: async <T,>(tool: string, args?: Record<string, unknown>, opts?: CallOptions) =>
      (await callWith<T>(tool, args, opts)).data,
  };
  operators.set(url, op);
  return op;
}

/**
 * Every tool the operator lists, with its input schema — the call syntax a
 * price sheet or a help page shows. Free, and needs no sign-in: it is the MCP
 * `tools/list`, not a tool call. Pages through the whole list.
 */
export async function listTools(): Promise<ToolSchema[]> {
  const out: ToolSchema[] = [];
  let cursor: string | undefined;
  try {
    const c = await getClient();
    do {
      const page = await c.listTools(cursor ? { cursor } : undefined);
      out.push(...(page.tools as ToolSchema[]));
      cursor = page.nextCursor;
    } while (cursor);
  } catch (e) {
    if (isTransportFailure(e)) throw new NetworkError("tools/list", e);
    throw e;
  }
  return out;
}

export async function callTool<T = unknown>(
  tool: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<T> {
  return (await callToolWithContent<T>(tool, args, opts)).data;
}
