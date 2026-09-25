/**
 * The room the DebugPanel keeps for itself.
 *
 * The panel is fixed to the bottom of the viewport, so on its own it would sit
 * over whatever the page puts last — on a phone, a loading quote or a Save
 * button. Beside it the panel renders an in-flow spacer as tall as the panel is
 * right now (the collapsed tab, or the open log), plus the iOS home-indicator
 * inset, so the page can always scroll its last line clear of the bar.
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
