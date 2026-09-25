/**
 * An activity log of MCP calls, for a site's debug panel.
 *
 * A ring buffer with subscribers, so the one `callTool` can push and any panel
 * can listen. Newest first. It survives route changes; with
 * `configureDebugLog({ persist: true })` it survives a reload too, so an error
 * that flips the view can still be read and copied afterward.
 *
 * Every message is scrubbed on the way in: an nsec, a 64-hex key, a bearer
 * token, and the value of any secret-named field (dpop_token, proof, poison,
 * password, api_key, …) never reach the buffer, the clipboard or storage.
 * That is the one guarantee a panel relies on — it renders what is here.
 *
 * Merged from the fleet's copies (goodearth, beesknees, cypher, excalibur,
 * optionality, roastify, taxsort). None of them scrubbed; this one does.
 */

import { tollboothConfig } from "./config.ts";

export interface DebugEntry {
  ts: string;
  type: "info" | "call" | "result" | "error";
  message: string;
}

export interface DebugLogOptions {
  /** How many entries to keep. Default 200. */
  max?: number;
  /** Keep the log in localStorage so it outlives a reload. Default false. */
  persist?: boolean;
}

const DEFAULT_MAX = 200;

let max = DEFAULT_MAX;
let persist = false;
// Replaced, never mutated, so a snapshot reader (useSyncExternalStore) sees a
// new array exactly when something changed.
let log: readonly DebugEntry[] = [];
const listeners = new Set<() => void>();

// ── Redaction ──────────────────────────────────────────────────────────────

const REDACTED = "[redacted]";

/** Field names whose value is a secret wherever it appears. */
const SECRET_FIELD =
  "(?:nsec|ncryptsec|dpop_token|proof|poison|password|passphrase|secret|token|authorization|api_?key|private_?key|client_secret|[a-z0-9_]*_(?:nsec|token|secret|password|passphrase|api_?key|private_?key))";

// `"dpop_token":"…"`, `\"dpop_token\":\"…\"` (JSON inside a JSON string),
// `dpop_token=…` (a query string) and `dpop_token: '…'` (a Python repr). A
// quoted value is taken whole — spaces, escaped quotes and the other kind of
// quote included — up to its own closing quote or the end of a truncated line;
// a bare one up to a delimiter. Stopping at the first quote of either kind let
// the tail of a secret holding `'` or `\"` through.
function fieldValue(names: string): RegExp {
  return new RegExp(
    `((?:\\\\*["'])?\\b${names}(?:\\\\*["'])?\\s*[:=]\\s*)(?:(\\\\*["'])(?:\\\\.|\\\\$|(?!\\2)[^\\\\])*?(?=\\2|$)|[^"'\\\\,}\\]&\\s]+)`,
    "gi",
  );
}
const FIELD_VALUE = fieldValue(SECRET_FIELD);
// update_patron_credential / update_operator_credential carry the secret as
// `value` beside a `field` naming it, so any `value` in such a call goes too.
const CREDENTIAL_VALUE = fieldValue("value");
const HAS_FIELD = /\\*["']field\\*["']\s*:/i;
const NSEC = /\b(?:nsec|ncryptsec)1[02-9ac-hj-np-z]{20,}/gi;
const HEX_KEY = /\b[0-9a-f]{64,}\b/gi; // keys, and signatures (128)
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;

function scrubbed(_match: string, head: string, quote: string | undefined): string {
  return `${head}${quote ?? ""}${REDACTED}`;
}

/**
 * Scrub secrets from a log line. Deliberately over-eager: a 64-hex event id
 * is hidden along with a hex private key, because the two look alike.
 */
export function redact(message: string): string {
  let out = message
    .replace(NSEC, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(FIELD_VALUE, scrubbed);
  if (HAS_FIELD.test(out)) out = out.replace(CREDENTIAL_VALUE, scrubbed);
  return out.replace(HEX_KEY, REDACTED);
}

// ── Storage (best effort) ──────────────────────────────────────────────────

function storageKey(name: string): string | null {
  try {
    return `${tollboothConfig().storagePrefix}:${name}`;
  } catch {
    return null; // not configured yet: nothing to read or write
  }
}

function readLocal(name: string): string | null {
  const k = storageKey(name);
  if (!k) return null;
  try {
    return globalThis.localStorage?.getItem(k) ?? null;
  } catch {
    return null;
  }
}

function writeLocal(name: string, value: string): void {
  const k = storageKey(name);
  if (!k) return;
  try {
    globalThis.localStorage?.setItem(k, value);
  } catch {
    /* quota or blocked site data — the in-memory log still works */
  }
}

const LOG_KEY = "debug-log:v1";

function save(): void {
  if (persist) writeLocal(LOG_KEY, JSON.stringify(log));
}

function hydrate(): DebugEntry[] {
  try {
    const parsed: unknown = JSON.parse(readLocal(LOG_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is DebugEntry => !!e && typeof e.message === "string" && typeof e.ts === "string")
      .map((e) => ({ ts: e.ts, type: e.type, message: redact(e.message) }));
  } catch {
    return [];
  }
}

/**
 * The patron's display zone, if the site stores one under `<prefix>:timezone`
 * ("auto" or absent means the browser's own), so stamps match the rest of the UI.
 */
function stamp(now: Date): string {
  try {
    const pref = readLocal("timezone");
    const zone = pref && pref !== "auto" ? pref : undefined;
    return now.toLocaleTimeString(undefined, zone ? { timeZone: zone } : undefined);
  } catch {
    return now.toLocaleTimeString();
  }
}

function emit(): void {
  save();
  listeners.forEach((fn) => fn());
}

// ── API ────────────────────────────────────────────────────────────────────

/** Set the cap and persistence. Call after `configureTollbooth`. */
export function configureDebugLog(options: DebugLogOptions): void {
  if (options.max !== undefined) {
    if (!Number.isInteger(options.max) || options.max < 1) throw new Error("max must be a positive integer");
    max = options.max;
  }
  if (options.persist !== undefined) {
    persist = options.persist;
    if (persist) log = [...log, ...hydrate()];
  }
  log = log.slice(0, max);
  emit();
}

export function debugPush(type: DebugEntry["type"], message: string): void {
  log = [{ ts: stamp(new Date()), type, message: redact(String(message)) }, ...log].slice(0, max);
  emit();
}

export function clearDebug(): void {
  log = [];
  emit();
}

/** The entries, newest first. The same array until the log changes. */
export function debugEntries(): readonly DebugEntry[] {
  return log;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function onDebug(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The whole log as plain text, newest first — for Copy and bug reports. */
export function debugLogText(): string {
  return log.map((e) => `${e.ts}  ${e.type.toUpperCase()}  ${e.message}`).join("\n");
}

// ── Severity ───────────────────────────────────────────────────────────────

export type DebugSeverity = "ok" | "notice" | "failure";

// Auth and funding outcomes are situations, not faults: the service answered
// correctly and the patron has a step to take (sign in, top up). These SDK
// error codes read as a notice and stay out of the failure count.
const NOTICE_CODE =
  /error_code\\?"\s*:\s*\\?"(npub_missing|proof_missing|proof_required|proof_refresh_needed|dpop_token_missing|oauth_not_yet_authorized|oauth_token_expired|upstream_auth_refresh_needed|insufficient_balance|authority_insufficient_balance|upstream_subscription_required|operator_llm_unfunded)\\?"/i;

function isFailure(entry: DebugEntry): boolean {
  if (entry.type === "error") return true;
  if (entry.type !== "result") return false;
  const m = entry.message;
  return m.includes('"success":false') || m.includes('"ok":false') || m.includes('"error"') || m.includes("error_code");
}

/** How a panel should flag an entry: a fault, a patron's next step, or neither. */
export function debugSeverity(entry: DebugEntry): DebugSeverity {
  if (!isFailure(entry)) return "ok";
  return NOTICE_CODE.test(entry.message) ? "notice" : "failure";
}

// ── Page-wide capture ──────────────────────────────────────────────────────

let captured = false;

/**
 * Fold uncaught errors and promise rejections into the log, once per page
 * (guarded, so StrictMode and remounts do not double-register).
 */
export function captureGlobalErrors(): void {
  if (captured || typeof globalThis.addEventListener !== "function") return;
  captured = true;
  globalThis.addEventListener("error", (e) => debugPush("error", `window.error: ${(e as ErrorEvent).message}`));
  globalThis.addEventListener("unhandledrejection", (e) =>
    debugPush("error", `unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`),
  );
}
