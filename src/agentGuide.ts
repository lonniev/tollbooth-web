/// <reference types="node" />
/**
 * The agent guide: `/llms.txt` and a front door a fetcher without JavaScript can read.
 *
 * A fetcher — a crawler, a link preview, an AI assistant — makes one GET and
 * runs no script. From a single-page app it gets `<div id="root"></div>` and
 * learns nothing. This Vite plugin gives every operator front end the same
 * answer:
 *
 *   - `dist/llms.txt`: the service's own sections, followed by the sections
 *     every Tollbooth DPYC operator shares (connecting an agent, payments and
 *     identity, licence and marks, links). It is served at `/llms.txt` in
 *     `vite dev` too.
 *   - `index.html` gets `<link rel="alternate" href="/llms.txt">`, and an
 *     empty `#root` gets a short intro. `createRoot` replaces it when the app
 *     loads. A `#root` that already holds markup is left alone.
 *
 *   // vite.config.ts
 *   import { agentGuide } from "@tollbooth-dpyc/web/agent-guide";
 *   plugins: [react(), agentGuide({ name, summary, site, mcpUrl, toolPrefix, source, body: "agent-guide.md" })]
 *
 * The service writes only what is its own. The shared sections live here.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AgentGuideLink {
  label: string;
  url: string;
}

export interface AgentGuideOptions {
  /** The service's name, the guide's title. */
  name: string;
  /** One or two sentences: what the service is. */
  summary: string;
  /** The web app's own origin, https. */
  site: string;
  /** The MCP endpoint an agent connects to, https. */
  mcpUrl: string;
  /** The tool name prefix, e.g. "goodearth" for `goodearth_check_balance`. */
  toolPrefix: string;
  /** The source repository. */
  source: string;
  /** The MCP Registry name, e.g. "io.github.lonniev/goodearth-mcp". */
  registryName?: string;
  /** Path to the service's own markdown sections, relative to the Vite root. */
  body: string;
  /** Further links, listed after the web app and endpoint. */
  links?: AgentGuideLink[];
}

/** Headings this module writes. A body that carries one has a leftover copy. */
export const SHARED_HEADINGS = [
  "## Connecting an agent",
  "## Payments and identity",
  "## License, patent, and trademarks",
  "## Links",
];

const PREFIX = /^[a-z][a-z0-9_]*$/;

function httpsUrl(field: string, value: string | undefined): string {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(`agentGuide: ${field} is not a URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "https:") throw new Error(`agentGuide: ${field} must be https: ${value}`);
  return url.toString().replace(/\/$/, "");
}

/** Validate the options, and return them with URLs normalised. */
export function checkOptions(opts: AgentGuideOptions): AgentGuideOptions {
  for (const field of ["name", "summary", "body"] as const) {
    if (!opts[field]?.trim()) throw new Error(`agentGuide: ${field} is required`);
  }
  if (!PREFIX.test(opts.toolPrefix ?? "")) {
    throw new Error(`agentGuide: toolPrefix must be a lowercase identifier: ${JSON.stringify(opts.toolPrefix)}`);
  }
  return {
    ...opts,
    site: httpsUrl("site", opts.site),
    mcpUrl: httpsUrl("mcpUrl", opts.mcpUrl),
    source: httpsUrl("source", opts.source),
    links: (opts.links ?? []).map((l) => ({ label: l.label, url: httpsUrl(`link "${l.label}"`, l.url) })),
  };
}

function connecting(o: AgentGuideOptions): string {
  const p = o.toolPrefix;
  const key = p.replace(/_/g, "-");
  const lines = [
    "## Connecting an agent",
    "",
    "The web app is one client of an MCP server, and an agent can call the same tools directly.",
    "",
    `- MCP endpoint (streamable HTTP, no account, no API key): ${o.mcpUrl}`,
    "- Claude.ai or Claude Desktop: Customize → Connectors → Add custom connector → paste the endpoint; leave the OAuth fields blank",
    `- Claude Code: \`claude mcp add --transport http ${key} ${o.mcpUrl}\``,
    `- Cursor (\`.cursor/mcp.json\`): \`{"mcpServers": {"${key}": {"url": "${o.mcpUrl}"}}}\``,
    `- VS Code (\`.vscode/mcp.json\`): \`{"servers": {"${key}": {"type": "http", "url": "${o.mcpUrl}"}}}\``,
  ];
  if (o.registryName) lines.push(`- MCP Registry: \`${o.registryName}\``);
  lines.push(
    "",
    "First connection:",
    "",
    "1. Ask the person for their Nostr npub (npub1…). Never ask for an nsec.",
    `2. \`${p}_request_npub_proof(patron_npub=…)\` sends them a Nostr direct message. They reply from their Nostr client; then call \`${p}_receive_npub_proof(patron_npub=…, nonce=…)\` once with the nonce the request returned. Your connection then holds the npub: pass only \`npub\` on every paid call.`,
    `3. \`${p}_check_balance\`. If it is empty, \`${p}_purchase_credits\` returns a Lightning invoice for the person to pay, and \`${p}_check_payment\` confirms it.`,
    "",
    `\`${p}_service_status\` and the \`${p}_oracle_*\` tools need no proof. \`${p}_check_price\` previews a fare. The server's own MCP \`instructions\` repeat these steps.`,
  );
  return lines.join("\n");
}

const PAYMENTS = `## Payments and identity

- Identity is a Nostr keypair (npub). There is no account, no email, no subscription and no KYC.
- A connection proves its npub with a Nostr DM challenge, or by signing each request with the npub's key (NIP-98).
- Tool calls debit a balance of sats, pre-funded with a Bitcoin Lightning invoice.
- Each operator sets its own per-tool prices. Monetization is the Tollbooth DPYC™ protocol: https://tollbooth-dpyc.com`;

const LICENSE = `## License, patent, and trademarks

- Source is open under the Apache License 2.0. The services built on it are private commerce: each operator sets its own tolls.
- Patent Pending — US Provisional Application 64/045,999 (Tollbooth DPYC Economic Architecture).
- DPYC™, Tollbooth DPYC™ and Don't Pester Your Customer™ are trademarks of Lonnie VanZandt.`;

function links(o: AgentGuideOptions): string {
  const rows: AgentGuideLink[] = [
    { label: "Web app", url: o.site },
    { label: "MCP endpoint", url: o.mcpUrl },
    { label: "Source", url: o.source },
    ...(o.links ?? []),
    { label: "Every service on the network", url: "https://mcps.tollbooth-dpyc.com" },
    { label: "Tollbooth DPYC™ (monetization SDK and network)", url: "https://tollbooth-dpyc.com" },
    { label: "DPYC community and patent filings", url: "https://github.com/lonniev/dpyc-community" },
    { label: "DPYC Oracle (free community concierge)", url: "https://dpyc-oracle.fastmcp.app/mcp" },
  ];
  return ["## Links", "", ...rows.map((r) => `- ${r.label}: ${r.url}`)].join("\n");
}

/** The whole `llms.txt`: title, summary, the service's sections, the shared sections. */
export function renderAgentGuide(options: AgentGuideOptions, body: string): string {
  const o = checkOptions(options);
  const own = body.trim();
  if (!own) throw new Error(`agentGuide: ${o.body} is empty`);
  if (/^# /m.test(own)) throw new Error(`agentGuide: ${o.body} carries its own "# " title; the guide writes it from name`);
  for (const h of SHARED_HEADINGS) {
    if (own.split("\n").some((l) => l.trim() === h)) {
      throw new Error(`agentGuide: ${o.body} still carries "${h}", which the shared guide writes`);
    }
  }
  return [`# ${o.name}`, `> ${o.summary.trim()}`, own, connecting(o), PAYMENTS, LICENSE, links(o)].join("\n\n") + "\n";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const EMPTY_ROOT = /<div id="root">\s*<\/div>/;
const ALTERNATE = '<link rel="alternate" type="text/markdown" href="/llms.txt" title="Guide for AI agents" />';

/**
 * Link the guide from `<head>`, and give an empty `#root` words a fetcher can
 * read. A page that already links `/llms.txt`, or whose `#root` holds markup,
 * keeps what it has.
 */
export function injectFrontDoor(html: string, options: AgentGuideOptions): string {
  const o = checkOptions(options);
  let out = html;
  if (!/href="\/llms\.txt"/.test(out.split("</head>")[0] ?? "")) {
    out = out.replace("</head>", `    ${ALTERNATE}\n  </head>`);
  }
  if (EMPTY_ROOT.test(out)) {
    const intro = [
      '<div id="root">',
      '      <main id="agent-intro" style="max-width:40rem;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;line-height:1.5">',
      `        <h1>${escapeHtml(o.name)}</h1>`,
      `        <p>${escapeHtml(o.summary.trim())}</p>`,
      "        <p>This web app needs JavaScript.</p>",
      `        <p>AI assistants can read <a href="/llms.txt">/llms.txt</a>, or connect to the MCP server at <a href="${escapeHtml(o.mcpUrl)}">${escapeHtml(o.mcpUrl)}</a>.</p>`,
      "      </main>",
      "    </div>",
    ].join("\n");
    out = out.replace(EMPTY_ROOT, intro);
  }
  return out;
}

/** The slice of Vite's plugin interface this uses, so `vite` stays out of the dependencies. */
interface Middleware {
  (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(s: string): void }, next: () => void): void;
}
export interface AgentGuidePlugin {
  name: string;
  configResolved(config: { root: string }): void;
  buildStart(): void;
  generateBundle(this: { emitFile(f: { type: "asset"; fileName: string; source: string }): void }): void;
  transformIndexHtml(html: string): string;
  configureServer(server: { middlewares: { use(fn: Middleware): void } }): void;
}

/** The Vite plugin. */
export function agentGuide(options: AgentGuideOptions): AgentGuidePlugin {
  const opts = checkOptions(options);
  let root = process.cwd();
  const render = () => renderAgentGuide(opts, readFileSync(resolve(root, opts.body), "utf8"));
  return {
    name: "tollbooth-agent-guide",
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      render();
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "llms.txt", source: render() });
    },
    transformIndexHtml(html) {
      return injectFrontDoor(html, opts);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/llms.txt") return next();
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.end(render());
      });
    },
  };
}
