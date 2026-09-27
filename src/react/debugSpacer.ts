/**
 * The room the DebugPanel keeps for itself — only while its log is open.
 *
 * The panel is fixed to the bottom of the viewport. Collapsed, it is one small
 * tab in the corner and overlays the page: an in-flow spacer for it stole a
 * whole row from every screen (owner, 2026-09-27: "we want an overlay and not
 * a row stealer"). Open, the log is tall and would hide whatever the page puts
 * last — a Save button, a loading quote — so then, and only then, the panel
 * renders an in-flow spacer as tall as it is, plus the iOS home-indicator
 * inset, so the page can scroll its last line clear.
 */

/** The collapsed tab: one `min-h-10` (2.5rem) button. Used until measured. */
export const DEBUG_BAR_PX = 40;

/** Whole CSS pixels for a measured height; the collapsed bar when unmeasured. */
export function debugSpacerPx(measured: number | null | undefined): number {
  if (typeof measured !== "number" || !Number.isFinite(measured) || measured <= 0) return DEBUG_BAR_PX;
  return Math.ceil(measured);
}

/** The spacer's CSS height: the panel's height plus the safe-area inset. */
export function debugSpacerHeight(measured: number | null | undefined): string {
  return `calc(${debugSpacerPx(measured)}px + env(safe-area-inset-bottom, 0px))`;
}

/** What the spacer takes: nothing while the panel is collapsed, its height while open. */
export function debugSpacerRoom(open: boolean, measured: number | null | undefined): string {
  return open ? debugSpacerHeight(measured) : "0px";
}
