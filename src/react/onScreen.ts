/** Keeping a panel that opens beside something inside the screen. */

/** How close to the screen's edge an open panel may come, in px. */
const EDGE = 8;

/**
 * How far to slide a panel spanning `left`..`right` so it sits inside a screen
 * `width` wide. Wider than the screen, its left edge wins: the start of the
 * text stays readable.
 */
export function inside(left: number, right: number, width: number): number {
  if (left < EDGE) return EDGE - left;
  if (right > width - EDGE) return Math.max(EDGE - left, width - EDGE - right);
  return 0;
}
