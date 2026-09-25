# @tollbooth-dpyc/web

The browser half of [Tollbooth DPYC](https://github.com/lonniev/tollbooth-dpyc):
the shared code every operator front end needs, so a site holds only its own
features. It is the peer of the `tollbooth-dpyc` Python wheel.

- **npub sign-in** — a Nostr DM challenge, or an in-browser session key
- **proofs** — the npub/`dpop_token` envelope on every paid call, a fresh
  kind-27235 inline proof when the tab holds a session key
- **MCP client** — one shared connection to the operator, typed wrappers for
  the standard tools (balance, top-up, statement, price, profile)
- **React components** — `NpubGate`, `NostrProfilePanel`, `SessionKeyClaim`, `WalletCard`,
  `AvatarPicker`, `DebugPanel`, `useSession`, `useDebugLog`
- **Debug log** — every call, result and error from `callTool`, scrubbed of
  nsecs, hex keys, tokens and proofs before it is stored
- **Pages proxy** — the `/mcp` Cloudflare Pages Function

## Use

```ts
// main.tsx — once, before rendering
import { configureTollbooth } from "@tollbooth-dpyc/web";

configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp" });
```

```tsx
import { callTool, callToolWithContent } from "@tollbooth-dpyc/web";
import { NpubGate, WalletCard, useSession } from "@tollbooth-dpyc/web/react";

const displays = await callTool("agent_status");               // chart_agent_status
const { data, images } = await callToolWithContent("snapshot_display", { display: "Desk" });
```

Short tool names are used throughout; the slug is added for you, and the proof
is bound to the full runtime name.

```js
// functions/mcp.js
import { makeMcpProxy } from "@tollbooth-dpyc/web/pages-proxy";
export const onRequest = makeMcpProxy("https://chartremotely-mcp.fastmcp.app/mcp");
```

### Debug panel

`callTool` logs to a shared, scrubbed ring buffer; `DebugPanel` shows it as a
bar along the bottom of the page with Copy and Clear. Put it once near the root.
Anything the site alone needs goes in as children, drawn above the log:

```tsx
import { configureDebugLog, debugPush } from "@tollbooth-dpyc/web";
import { DebugPanel } from "@tollbooth-dpyc/web/react";

configureDebugLog({ persist: true });   // optional: outlive a reload; max defaults to 200

<DebugPanel>
  <button onClick={loadSchedulerRuns}>Scheduler ↻</button>
</DebugPanel>
```

A site's own `debugPush` lines are scrubbed the same way. Stamps follow the
zone the site stores under `<prefix>:timezone`, if any.

### Styling

Components use Tailwind classes coloured only through CSS variables. Tell
Tailwind to scan the package, import the default tokens, and override any of
them after:

```css
@import "tailwindcss";
@import "@tollbooth-dpyc/web/theme.css";
@source "../node_modules/@tollbooth-dpyc/web/dist";

:root { --tb-accent: #4cc38a; }
```

## Develop

```sh
npm install
npm test       # node --test, no browser needed
npm run build  # tsc → dist/
```

Releases publish from a `v*` tag through npm trusted publishing; see
`.github/workflows/release.yml`.

## Licence

Apache-2.0
