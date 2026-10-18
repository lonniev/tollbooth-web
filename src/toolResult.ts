/**
 * Turning an MCP tool result into what a page wants. Pure, so it is tested
 * without a server.
 */

export interface ContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface RawToolResult {
  isError?: boolean;
  content?: ContentBlock[];
  structuredContent?: unknown;
}

export interface ImageBlock {
  mimeType: string;
  /** Base64, as the server sent it. */
  data: string;
}

export interface ReadResult {
  /** The structured answer, else the first text block parsed as JSON, else that text. */
  payload: unknown;
  images: ImageBlock[];
}

/** The text a failed call carries, or a plain fallback. */
export function errorText(result: RawToolResult): string {
  return (result.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => String(b.text))
    .join("\n") || "Tool call failed";
}

export function readToolResult(result: RawToolResult): ReadResult {
  const content = result.content ?? [];
  const images = content
    .filter((b) => b.type === "image" && typeof b.data === "string")
    .map((b) => ({ mimeType: b.mimeType || "image/png", data: String(b.data) }));

  let payload: unknown;
  if (result.structuredContent !== undefined) {
    payload = result.structuredContent;
  } else {
    const text = content.find((b) => b.type === "text");
    if (text) {
      const raw = String(text.text ?? "");
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    } else {
      payload = images.length ? {} : result;
    }
  }
  return { payload, images };
}

/**
 * A soft proof failure: `{success: false, error_code: proof_required}` with no
 * isError flag — the connection does not prove the npub. The wheel's codes are
 * lowercase snake_case; an earlier uppercase comparison never matched, so the
 * bounce silently never fired. Normalised here, once.
 */
export function proofBounceMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const code = String(p.error_code ?? "").toLowerCase();
  if (p.success === false && code === "proof_required") {
    return String(p.error ?? "Sign-in required.");
  }
  return null;
}

/**
 * Grant refusals that say nothing about the grant: the service could not
 * establish its own identity, or could not read its revocation list. Both are
 * the service's fault and retryable, so the patron stays signed in.
 */
const GRANT_STILL_GOOD = new Set(["operator_unknown", "revocations_unavailable"]);

/**
 * A held proof grant the service refused for good: `{success: false,
 * error_code: proof_invalid, reason}` where the reason is about the grant —
 * expired, revoked, issued for another npub or operator, malformed. Retrying
 * on it can never succeed, so the patron is signed out.
 *
 * Only meaningful when the call rode this tab's holder. A signed request
 * shares the code and even the word `expired` (outside its window), but it is
 * signed afresh for the next call and loses nothing.
 */
export function deadGrantMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const code = String(p.error_code ?? "").toLowerCase();
  if (p.success !== false || code !== "proof_invalid") return null;
  if (GRANT_STILL_GOOD.has(String(p.reason ?? "").toLowerCase())) return null;
  return String(p.error ?? "Your sign-in has expired.");
}

/** Whether a payload reports failure, for the debug log's colouring. */
export function looksFailed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.success === false || p.ok === false || Boolean(p.error);
}
