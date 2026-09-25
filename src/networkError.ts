/**
 * "The call never reached the service" as its own kind of failure.
 *
 * A page that queues writes while offline (an outbox) must tell a call that
 * never arrived — safe to send again later — from one the service answered
 * with a refusal, which must not be replayed. `callTool` throws a
 * `NetworkError` for the first kind only; everything the service said,
 * including a tool's `isError` answer and an HTTP status it returned, stays a
 * plain `Error`.
 *
 * Pure: it inspects the thrown value and imports nothing from the MCP SDK, so
 * it is tested without a network.
 */

export class NetworkError extends Error {
  /** The runtime tool name the call was for, e.g. "goodearth_task_save". */
  readonly tool: string;

  constructor(tool: string, cause: unknown) {
    const why = cause instanceof Error ? cause.message : String(cause);
    super(`${tool}: ${why}`, { cause });
    this.name = "NetworkError";
    this.tool = tool;
  }
}

export function isNetworkError(e: unknown): e is NetworkError {
  return e instanceof NetworkError;
}

// What each browser's fetch says when the request never left, or never came
// back: Chrome "Failed to fetch", Safari "Load failed", Firefox "NetworkError
// when attempting to fetch resource.", Node/undici "fetch failed".
const FETCH_FAILED = /failed to fetch|load failed|networkerror|fetch failed|network request failed|network connection was lost/i;

// The SDK's own codes for "no answer came": the connection closed, or the
// request timed out waiting.
const MCP_CONNECTION_CLOSED = -32000;
const MCP_REQUEST_TIMEOUT = -32001;

/**
 * Whether a thrown value means the call did not reach the service (or no
 * answer came back): the browser is offline, fetch itself failed, the request
 * was aborted or timed out before a response, or the site's Pages proxy could
 * not reach the operator (its 502 "Proxy error").
 *
 * `online` is `navigator.onLine`; when the browser knows it is offline, any
 * failure is a network one.
 */
export function isTransportFailure(e: unknown, online: boolean = globalThis.navigator?.onLine ?? true): boolean {
  if (!online) return true;
  if (!(e instanceof Error)) return false;
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  if (e instanceof TypeError) return FETCH_FAILED.test(e.message);
  const code = (e as { code?: unknown }).code;
  if (e.name === "McpError") return code === MCP_REQUEST_TIMEOUT || code === MCP_CONNECTION_CLOSED;
  // StreamableHTTPError: the HTTP status the page got back. Only the proxy's
  // own 502 — its fetch to the operator threw — means the operator never saw it.
  if (e.message.startsWith("Streamable HTTP error:")) return code === 502 && /Proxy error/.test(e.message);
  return false;
}
