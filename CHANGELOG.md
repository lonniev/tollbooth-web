# Changelog

## [0.2.0] - 2026-09-24

### Added
- `SessionKeyClaim` (React): lets a patron whose browser holds their session
  nsec take a copy — clipboard, a `<SLUG>_NSEC` `.env` file, the browser's
  password manager, or a NIP-17 DM to an npub they own. Renders nothing when
  the browser holds no key for the signed-in npub (NIP-07 or courier proof).
  Lifted from goodearth-mcp so every operator site gets it.
- `shareOrDownload` / `handOffMode`: hand a file to the share sheet on a
  touch-first device, a download everywhere else.
- `getSessionNsecBytes` and `sessionKeyClaimVisible` are exported.

### Changed
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
