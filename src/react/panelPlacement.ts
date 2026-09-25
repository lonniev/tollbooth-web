/**
 * Keeping TableFilter's questions panel on screen while it is open.
 *
 * The panel hangs from the filter mark, so anything that moves the mark moves
 * the panel: ticking a question widens the mark (its summary), the Clear chip
 * appears inside the panel, the window turns or scrolls. So the panel is
 * re-placed on every one of those, not only when it opens.
 *
 * It is slid by the CSS `translate` property, which `getBoundingClientRect`
 * already includes. Taking the slide in force back off gives where the site's
 * CSS alone puts the panel, and the new slide is worked out from there — no
 * need to clear the slide and force a second layout just to measure.
 */

import { nudgeIntoView } from "../table.ts";

/**
 * The slide (px) that keeps the panel `margin` px inside both edges.
 * `measuredLeft` is where it is drawn now, with `currentDx` already applied.
 */
export function reclampPanel(
  currentDx: number,
  measuredLeft: number,
  width: number,
  viewportWidth: number,
  margin = 8,
): number {
  return nudgeIntoView(measuredLeft - currentDx, width, viewportWidth, margin);
}

/**
 * `run` at most once per animation frame, however many times the returned
 * function is called before that frame. `cancel` drops a pending run.
 */
export function oncePerFrame(
  run: () => void,
  request: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
  release: (id: number) => void = (id) => cancelAnimationFrame(id),
): { schedule: () => void; cancel: () => void } {
  let pending: number | null = null;
  return {
    schedule() {
      if (pending !== null) return;
      pending = request(() => {
        pending = null;
        run();
      });
    },
    cancel() {
      if (pending === null) return;
      release(pending);
      pending = null;
    },
  };
}
