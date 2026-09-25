# Changelog

## [1.2.0] - 2026-09-25

### Fixed
- Inline proofs carry a nonce: `signInlineProof` now signs
  `tags: [["u", tool], ["nonce", <32 hex>]]`, the same shape as the Python
  SDK's `create_proof`. Two calls to the same tool in the same wall-clock
  second no longer sign byte-identical events that the server's replay guard
  refuses (seen live: nav and wallet both calling check_balance at once). The
  wheel's `verify_proof` reads only the `u` tag, so the nonce is inert to it.
- `get_pricing_model` is sent without the npub/proof envelope — its wheel
  signature takes none, and the strict schema refused one.
- The call log's scrubber takes a quoted secret whole up to its own closing
  quote, so a credential value holding `'` or `\"` (or cut off by the log's
  truncation) no longer lets its tail through.

### Added
- Standard-tool wrappers: `sessionStatus(patronNpub?)` with a typed
  `SessionLifecycle`; `getOperatorOnboardingStatus()`,
  `checkAuthorityBalance()`; `getPricingModel()`,
  `listCanonicalIdentities()`; `getPatronCredentialFields()`,
  `updatePatronCredential(field, value)`, `deletePatronCredential(field)` —
  values go in, only field names come back, and the log scrubs the value.
- `checkPrice(toolId, toolKwargs?)` passes `tool_kwargs` for tools priced by
  their arguments.
- `CallOptions.quietProof`: a background read whose proof bounced throws
  `ProofRequiredError` but leaves the session alone and does not emit
  `onProofExpired`, so a badge or poll never sends the patron to sign-in.
  Opt-in; the default is unchanged.
- `useSession().dismissNotice()` clears the lapsed-session notice.
- `ServiceStatus`, `CheckBalanceResult`, `CheckPriceResult` and
  `CheckPaymentResult` carry the fields the wheel actually returns
  (`patron_auth`, `build_info`, `invoice_summary`, `constraint_effects`,
  `persisted`, …).

## [1.1.0] - 2026-09-24

Five more widgets every fleet front end carried its own copy of, as mechanics
only: each takes `classNames` per part (and a render prop where one helps),
adds no typography or colour of its own, and draws its actions as chips.

### Added
- `NetworkError` and `isNetworkError(e)`: `callTool` / `callToolWithContent`
  now throw a `NetworkError` (carrying the runtime `tool` name and the
  original `cause`) when the call never reached the service — offline, a
  fetch failure, an abort, a timeout before an answer, or the Pages proxy's
  own 502 — and a plain `Error` for anything the service answered. An
  offline outbox can now test `isNetworkError(e)` instead of matching the
  `<slug>_<tool>: ` message prefix (which is kept). `isTransportFailure(e)`
  is the classifier behind it.
- `WalletPage` (React): balance with deposited / consumed / expired /
  tranches, a stale-ledger notice, pending invoices and credit about to
  expire; a Lightning top-up from preset chips or any amount; credit
  tranches; the account statement on request; and coupons. `before` and
  `children` take a site's own panels; `formatDate` / `formatDateTime` take
  its time-zone formatter.
- `useTopUp` (React) and `topUpReducer`: purchase_credits → invoice →
  check_payment, polled every `pollMs` (default 5 s) while the tab is
  visible, up to `maxChecks` (default 60), with a manual check and cancel.
  `WalletCard` now runs on it too, so an open invoice settles on its own.
- `CouponsPanel` (React): redeem a code, list what is held, remove one.
  `listMyCoupons`, `redeemCoupon`, `forgetCoupon` and the coupon types join
  the standard-tool wrappers.
- `TableFilter` (React): any of a search box (regex, applied on Enter or its
  chip), a date range with an optional date-field select, and a panel of
  toggle / number questions behind a mark; one Clear chip while anything is
  on. `filterRows`, `searchMatcher`, `inDateRange`, `filterActive` for
  filtering in the browser.
- `SortHeader`, `PageControls`, `TableShell` (React), with `lastPage`,
  `clampPage`, `pageCount`, `pageRows` and `nextSort`.
- `useTheme` and `ThemeToggle` (React), `bootstrapTheme`, `readTheme`,
  `writeTheme`, `applyTheme`, `resolveTheme`: dark / light / system,
  persisted under `<prefix>:theme`, followed across tabs and, in system,
  live with the OS. Applying sets the `dark` class, `data-theme` and
  `color-scheme` together, so class-based and attribute-based sheets both
  work.
- `ErrorBoundary` (React): a render crash is pushed to the debug log and
  shown with Copy error + log / Try again / Reload chips, or your
  `fallback`. `errorReport` builds the copied text.
- `theme.css`: `:root[data-theme="dark"]` so an explicit dark pick wins over
  a light OS.

### Fixed
- `AccountStatementResult` now describes what the wheel's
  `account_statement` returns (`account_summary`, `purchase_history`,
  `active_tranches`, `tool_usage_all_time`, `daily_usage`); the fields it
  listed before were never sent. `CheckBalanceResult` gains the tranche,
  pending-invoice and stale-ledger fields the wheel does send.

## [1.0.0] - 2026-09-24

First stable release — the API is now semver-stable. Patch and minor releases
stay compatible; breaking changes come only as a new major.

### Fixed
- `DebugPanel` keeps its own space. The bar is still fixed to the bottom of
  the viewport, but beside it the panel now renders an in-flow spacer as tall
  as the bar is right now — the collapsed tab or the open log, measured with a
  `ResizeObserver` — plus `env(safe-area-inset-bottom)`, so page content (a
  loading quote on a phone) always scrolls clear of it. With no
  `ResizeObserver` (or before the first measure) the spacer reserves the
  collapsed bar. No props change and nothing covers the page. Mount the panel
  last in the app shell so the spacer is the last thing in the page's flow.

## [0.5.0] - 2026-09-24

### Changed (breaking)
- `QuoteScroller` no longer styles its content. The package keeps the
  mechanics — loading and caching, shuffle-then-step, the interval, the
  cross-fade, reduced motion, pausing while hidden, `aria-live`, the reserved
  height and the spinner — and the site brings every visual choice. Migrate by
  passing `classNames={{ root, heading, spinner, figure, text, mark, author }}`
  (or `renderQuote` for full markup). With neither, quotes render as plain
  text that inherits from the page. `className` is gone: use
  `classNames.root`. New `marks` prop: curly quotes by default, `false` for
  none, or `[open, close]`. The reserved height is now the tallest quote as
  the site styles it, not the longest by character count.

### Changed
- `SessionKeyClaim`: showing the key on screen is now a **Reveal** chip,
  first in the row beside Copy / Download .env / Password manager / Send by
  DM; it reads **Conceal** while the key is shown. The key box sits below the
  row. Still two deliberate taps before the key is painted.

## [0.4.0] - 2026-09-24

### Added
- `QuoteScroller` (React): rotating quotations for a wait, the loading screen
  six fleet front ends each carried a copy of. The site passes its own
  `quotes`; an optional `source` URL names a remote corpus that supersedes
  them once it loads. Shuffled, then walked, so nothing repeats until every
  quote has shown. Cross-fades (instantly under reduced motion), stops while
  the tab is hidden, announces politely, and reserves its longest quote's
  height so the page does not jump. `heading`, `spinner`, `intervalMs`
  (default 3500) and `className`. Themed only through `--tb-*` tokens.
- `loadQuotes(source, fallback)`, `peekQuotes`, `validQuotes`, `shuffle` and
  the `Quote` type: the framework-free half. A corpus is fetched once per page
  per URL, concurrent callers share the request, a failure is remembered, and
  malformed rows are dropped.

## [0.3.0] - 2026-09-24

### Added
- `DebugPanel` (React): the on-screen MCP activity log every fleet front end
  carried its own copy of. Collapsed, one tab coloured by what the log holds
  (a failure, or a notice such as sign in / top up); open, the log newest
  first with Copy and Clear. Remembers whether it was open. Themed only through
  `--tb-*` tokens, 40px tap targets, the page beneath stays tappable.
  `children` is the site's own section (eXcalibur's scheduler controls).
- `useDebugLog()` (React), on `useSyncExternalStore`.
- `debugLogText`, `debugSeverity`, `captureGlobalErrors`, `redact`, and
  `configureDebugLog({ max, persist })` — a cap (default 200) and an opt-in
  copy in localStorage so the log survives a reload.
- `--tb-notice-bg`, `--tb-notice-line`, `--tb-notice-ink` theme tokens.

### Changed
- `debugPush` scrubs every message before storing it: nsec/ncryptsec strings,
  64+ hex runs (keys, signatures — and, over-eagerly, event ids), bearer
  tokens, the value of any secret-named field (`dpop_token`, `proof`,
  `poison`, `*_token`, `password`, `api_key`, …) and the `value` of a
  credential update. None of the fleet's copies scrubbed.
- The log keeps 200 entries (was 60) and stamps times in the site's stored
  display zone when it has one.

## [0.2.0] - 2026-09-24

### Added
- `SessionKeyClaim` (React): lets a patron whose browser holds their session
  nsec take a copy — clipboard, a `<SLUG>_NSEC` `.env` file, the browser's
  password manager, or a NIP-17 DM to an npub they own. Renders nothing when
  the browser holds no key for the signed-in npub (NIP-07 or courier proof).
  Lifted from goodearth-mcp so every operator site gets it.
- `shareOrDownload` / `handOffMode`: hand a file to the share sheet on a
  touch-first device, a download everywhere else.
- `configureTollbooth({ avatarChoices })`: a site offers glyphs in its own
  voice; the picker and the default avatar both draw from them.
- `getSessionNsecBytes` and `sessionKeyClaimVisible` are exported.

### Changed
- `publishProfile(npub, content)` takes the npub it publishes for, as the
  panel already knows it. It used to read the stored patron npub, which a
  site keeping its sign-in under other keys (taxsort) does not have.
- `AVATAR_CHOICES` is now `DEFAULT_AVATAR_CHOICES`; read the site's set with
  `avatarChoices()`.
- `NostrProfilePanel` takes `onPublished(profile)`, called once relays accept
  the kind-0, for a site that mirrors the name or avatar (a leaderboard).
- `NostrProfilePanel` lays its fields out two across on a wide screen and
  sits tighter. A new npub starts with empty fields instead of showing the
  previous patron's until the relays answer.

## [0.1.1] - 2026-09-24

### Fixed
- `publishConfig` no longer forces provenance. npm can only make a provenance
  record inside CI, so it blocked a publish from a laptop; the release workflow
  already passes `--provenance` itself.

## [0.1.0] - 2026-09-23

### Added
- First release: the browser half of Tollbooth DPYC, lifted from the copies in
  goodearth-mcp and beesknees-mcp and made configurable instead of forked.
- `configureTollbooth({ slug, appName, mcpUrl })` — the only per-site setup.
- MCP client (`callTool`, `callToolWithContent` for image results), the npub
  proof envelope, `ProofRequiredError` and `onProofExpired`.
- Identity storage that survives blocked site data, recent logins, the
  last-typed npub kept apart from the proven identity.
- Session nsec and inline kind-27235 proofs; kind-0 profile signing.
- Typed wrappers for the standard wheel tools (balance, top-up, payment,
  statement, price, proofs, profile).
- React: `NpubGate`, `NostrProfilePanel`, `AvatarPicker`, `Avatar`,
  `WalletCard`, `useSession`, themed through `theme.css` tokens.
- `@tollbooth-dpyc/web/pages-proxy`: `makeMcpProxy()` for the `/mcp` Pages Function.
