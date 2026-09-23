/**
 * A Cloudflare Pages Function that proxies `/mcp` to an operator on Horizon.
 *
 * Keeping the browser → MCP transport same-origin avoids CORS preflight
 * trouble and lets the page use a relative `mcpUrl` of "/mcp". POST (tool
 * calls), GET (SSE), DELETE (session close) and OPTIONS (preflight).
 *
 *   // functions/mcp.js
 *   import { makeMcpProxy } from "@tollbooth-dpyc/web/pages-proxy";
 *   export const onRequest = makeMcpProxy("https://chartremotely-mcp.fastmcp.app/mcp");
 *
 * Only the headers MCP needs are forwarded upstream. Cookies and anything else
 * the browser attached stay behind.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id, accept, last-event-id",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const FORWARDED = new Set(["content-type", "accept", "mcp-session-id", "last-event-id"]);

type Fetch = (input: string, init: RequestInit & { duplex?: string }) => Promise<Response>;

export function makeMcpProxy(upstream: string, fetchImpl: Fetch = fetch) {
  const host = new URL(upstream).host;

  return async function onRequest(context: { request: Request }): Promise<Response> {
    const req = context.request;
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const headers = new Headers();
    for (const [k, v] of req.headers) {
      if (FORWARDED.has(k.toLowerCase())) headers.set(k, v);
    }
    headers.set("Host", host);

    const init: RequestInit & { duplex?: string } = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE") {
      init.body = req.body;
      init.duplex = "half";
    }

    try {
      const resp = await fetchImpl(upstream, init);
      const out = new Headers(resp.headers);
      for (const [k, v] of Object.entries(CORS_HEADERS)) out.set(k, v);
      return new Response(resp.body, { status: resp.status, headers: out });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy error", detail: String(err) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  };
}
