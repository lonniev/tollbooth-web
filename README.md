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
  `WalletPage`, `CouponsPanel`, `TableFilter`, `SortHeader` / `PageControls` /
  `TableShell`, `ThemeToggle`, `ErrorBoundary`, `AvatarPicker`, `DebugPanel`,
  `QuoteScroller`, `useSession`, `useTopUp`, `useTheme`, `useDebugLog`
- **Mechanics, not looks** — the newer components take `classNames` per part
  and add no typography or colour of their own; actions are chips
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

### Network failures

`callTool` throws a `NetworkError` when the call never reached the service
(offline, fetch failed, timed out before an answer, the proxy could not reach
the operator) and a plain `Error` for anything the service said. Only the
first is safe to queue and send again:

```ts
import { callTool, isNetworkError } from "@tollbooth-dpyc/web";

try {
  await callTool("task_save", task);
} catch (e) {
  if (isNetworkError(e)) outbox.push({ tool: "task_save", args: task }); // e.tool is the runtime name
  else throw e;
}
```

### Wallet, coupons, tables, theme, error boundary

Mechanics only: the calls, states, paging and persistence are the package's;
every class is yours. Pass `classNames` (each component's type lists its
parts); without them the markup is plain and inherits from the page.

```tsx
import { bootstrapTheme, filterRows, pageRows } from "@tollbooth-dpyc/web";
import {
  CouponsPanel, ErrorBoundary, PageControls, SortHeader, TableFilter, TableShell,
  ThemeToggle, WalletPage,
} from "@tollbooth-dpyc/web/react";

bootstrapTheme();            // main.tsx, after configureTollbooth: <prefix>:theme → <html>

<ErrorBoundary classNames={{ root: "p-6", chip: "chip" }}>
  <App />
</ErrorBoundary>

<WalletPage
  topUps={[1_000, 5_000, 25_000]}
  formatDateTime={(iso) => formatInZone(iso, zone)}
  before={<FundingStatus />}
  coupons={{ classNames: { root: "card", chip: "chip" } }}
  classNames={{ section: "card p-5", figure: "text-3xl", chip: "chip", chipActive: "chip-on" }}
/>

<ThemeToggle themes={["dark", "light", "system"]} classNames={{ chip: "chip", active: "chip-on" }} />

<TableFilter
  search={{ value: search, onSearch: setSearch, title: "Case-insensitive regular expression" }}
  dates={{ from, to, onFrom: setFrom, onTo: setTo, field, fields, onField: setField }}
  onClear={clearAll}
  classNames={{ root: "flex gap-2", input: "field", chip: "chip" }}
/>
```

`useTopUp` is the wallet's top-up on its own (purchase_credits → invoice →
check_payment, polled while the tab is visible) for a site drawing its own.

### Debug panel

`callTool` logs to a shared, scrubbed ring buffer; `DebugPanel` shows it as a
bar along the bottom of the page with Copy and Clear. Put it once, **last** in
the app shell. The bar is fixed to the viewport, but it also keeps its own
room in the page: an in-flow spacer as tall as the bar is right now (collapsed
or open) plus the iOS safe-area inset, so the page's last line always scrolls
clear of it. Mounted last, that spacer is the page's last thing; mounted
earlier, the room opens up there instead. Anything the site alone needs goes
in as children, drawn above the log:

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

### Quote scroller

Something to read while a page loads. The quotes are the site's own; the
package only scrolls them. Name a remote corpus to edit the set without a
redeploy — it is fetched once per page and replaces the inline set when it
arrives, or never, if it cannot be had.

The package owns the mechanics (timing, cross-fade, reduced motion, pausing
while the tab is hidden, `aria-live`, and a reserved height taken from the
tallest quote as *your* styles lay it out). How the quotes look is yours:
without `classNames` they are plain text inheriting from the page.

```tsx
import { QuoteScroller } from "@tollbooth-dpyc/web/react";
import type { Quote } from "@tollbooth-dpyc/web";

const QUOTES: Quote[] = [{ text: "Observe the seasons.", author: "Hesiod" }];

<QuoteScroller
  quotes={QUOTES}
  source="https://raw.githubusercontent.com/lonniev/dpyc-community/main/quotes-agrarian.json"
  heading="Reading the ledger…"
  spinner
  classNames={{
    root: "px-4 py-6 text-center",
    heading: "mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--tb-accent)]",
    figure: "mx-auto flex max-w-xl flex-col gap-3",
    text: "font-serif text-[17px] italic leading-relaxed",
    mark: "not-italic text-[var(--tb-accent)]",
    author: "font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--tb-muted)]",
  }}
/>
```

Props: `quotes`, `source`, `heading`, `spinner`, `intervalMs` (default 3500),
`classNames` (`root`, `heading`, `spinner`, `figure`, `text`, `mark`,
`author`), `marks` (curly quotes by default; `false` for none, or
`[open, close]`), and `renderQuote(quote)` to draw a quote's markup yourself
(then `text`, `mark` and `author` are unused).

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

## Stability

From 1.0.0 the public API — everything exported from `@tollbooth-dpyc/web`,
`/react`, `/pages-proxy` and the `theme.css` tokens — follows semver. Patch and
minor releases are safe to take unattended (the fleet's Renovate preset
auto-merges them); a breaking change ships only as a new major, which Renovate
holds for review.

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
