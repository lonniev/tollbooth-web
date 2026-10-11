/**
 * When to offer a tour: after a stretch with nothing touched.
 *
 * A tour that starts the moment a page opens gets in the way of someone who
 * knows the page. One offered after a pause finds the person who is looking
 * for where to start. The policy is data here, so it is tested; the hook
 * that listens for the events is in `react/useTour.ts`.
 */

/** How long a page may sit untouched before a tour is offered. */
export const DEFAULT_IDLE_MS = 10_000;

/** Anything a person does to a page. */
export const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

/** The idle stretch a site asked for, or the default; never under a second. */
export function idleThreshold(configured: number | undefined, override?: number): number {
  const ms = override ?? configured ?? DEFAULT_IDLE_MS;
  return Number.isFinite(ms) && ms >= 1_000 ? ms : DEFAULT_IDLE_MS;
}

/**
 * Whether a page has sat untouched long enough. A hidden tab is never idle:
 * someone reading another tab has not gone quiet on this one.
 */
export function offerDue(lastActivityAt: number, now: number, visible: boolean, idleMs: number): boolean {
  return visible && now - lastActivityAt >= idleMs;
}
