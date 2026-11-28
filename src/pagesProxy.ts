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
 *
 * Every request upstream carries who it may act as. An operator refuses a
 * request with no `Authorization`, so a page that neither signs (`Nostr`)
 * nor holds a holder token is an anonymous caller, and the proxy says so with
 * `Bearer anonymous`. A request that carries either is forwarded untouched.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id, accept, last-event-id, authorization",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};

const FORWARDED = new Set(["content-type", "accept", "mcp-session-id", "last-event-id", "authorization"]);

export const ANONYMOUS_BEARER = "Bearer anonymous";

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
    if (!headers.has("authorization")) headers.set("Authorization", ANONYMOUS_BEARER);
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

/**
 * A Cloudflare Pages Function that answers 404 where Pages would serve the
 * page instead.
 *
 * Pages answers any path it has no file for with `index.html` and a 200, so a
 * client probing for an endpoint gets the page's HTML and reads it as a real
 * answer. MCP clients probe `/.well-known/oauth-protected-resource` on their
 * own, and others look for `/.well-known/mcp.json`, `/sse` and `/health`. The
 * site's `/mcp` only relays the page's own calls; agents connect to the
 * operator itself, so these paths are honestly absent here.
 *
 * A real file still wins: a site that ships `/.well-known/ai-catalog.json` or
 * `apple-app-site-association` serves it as before. Only the page standing in
 * for a missing file becomes a 404.
 *
 *   // functions/.well-known/[[path]].js, functions/sse.js, functions/health.js
 *   import { makeNotFound } from "@tollbooth-dpyc/web/pages-proxy";
 *   export const onRequest = makeNotFound();
 */
type PagesAssetsContext = {
  request: Request;
  env: { ASSETS: { fetch: (request: Request) => Promise<Response> } };
};

export function makeNotFound() {
  return async function onRequest(context: PagesAssetsContext): Promise<Response> {
    const asset = await context.env.ASSETS.fetch(context.request);
    const isPage = (asset.headers.get("Content-Type") ?? "").startsWith("text/html");
    if (asset.status === 304 || (asset.ok && !isPage)) return asset;
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  };
}

/**
 * A Cloudflare Pages Function that reads the Good Brew café's public catalog
 * for the site's shelf (see `../cafe.ts`). The store sends no CORS headers, so
 * the browser reads it through here.
 *
 *   // functions/cafe/[[path]].js
 *   import { makeCafeProxy } from "@tollbooth-dpyc/web/pages-proxy";
 *   export const onRequestGet = makeCafeProxy("CommissionMarket-Catalog/1.0 (+https://commissionmarket.tollbooth-dpyc.com)");
 *
 * Only the two catalog reads pass: this is no general proxy, and no cookie or
 * header of the browser's crosses it. The store refuses a request with no
 * User-Agent, and a Function's fetch sends none, so the site names itself.
 */

const CAFE = "https://cafe.tollbooth-dpyc.com";
const CAFE_PAGE_SIZE = 24;
const CAFE_HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** The store URL a request for `pathname` may read, or null. */
export function cafeUpstreamFor(pathname: string, search = ""): string | null {
  if (pathname === "/cafe/collections.json") return `${CAFE}/collections.json`;
  const match = pathname.match(/^\/cafe\/collections\/([^/]+)\/products\.json$/);
  if (!match || !CAFE_HANDLE.test(match[1])) return null;
  const page = Number(new URLSearchParams(search).get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return null;
  return `${CAFE}/collections/${match[1]}/products.json?limit=${CAFE_PAGE_SIZE}&page=${page}`;
}

export function makeCafeProxy(userAgent: string, fetchImpl: typeof fetch = fetch) {
  return async function onRequestGet(context: { request: Request }): Promise<Response> {
    const url = new URL(context.request.url);
    const upstream = cafeUpstreamFor(url.pathname, url.search);
    if (!upstream) return new Response("Not found", { status: 404 });
    let answer: Response;
    try {
      answer = await fetchImpl(upstream, {
        headers: { accept: "application/json", "user-agent": userAgent },
        cf: { cacheTtl: 900, cacheEverything: true },
      } as RequestInit);
    } catch {
      return new Response("The café did not answer", { status: 502 });
    }
    if (!answer.ok) return new Response("The café did not answer", { status: 502 });
    return new Response(answer.body, {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900" },
    });
  };
}
