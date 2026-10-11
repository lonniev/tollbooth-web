/**
 * Who sees a tour, and when it stops.
 *
 * Three facts, kept per site and per device: whether the live tutorial is on,
 * which pages have had their tour, and a page asked to replay once from its
 * guide. A new device starts with the tutorial on. A device that already
 * holds a patron npub but no tour preference has been here since before the
 * tour existed, and starts with it off — a patron who has used the site for a
 * season is shown nothing until they ask.
 */

export interface TourPrefs {
  on: boolean;
  toured: Record<string, true>;
  /** A page asked to show its tour once more, whatever the switch says. */
  replay: string | null;
}

export const TOUR_DEFAULTS: TourPrefs = { on: true, toured: {}, replay: null };

/** Should this page's tour be offered now? */
export function shouldRun(p: TourPrefs, page: string): boolean {
  if (p.replay === page) return true;
  return p.on && !p.toured[page];
}

/** The page's tour ended — by its last step, its ✕, or a "No". Done for this device. */
export function markToured<P extends TourPrefs>(p: P, page: string): P {
  return { ...p, toured: { ...p.toured, [page]: true }, replay: p.replay === page ? null : p.replay };
}

/** "Stop the tutorial", from any popover: off on every page. */
export function stopAll<P extends TourPrefs>(p: P): P {
  return { ...p, on: false, replay: null };
}

/** The switch turned on in the profile: every page offers its tour again. */
export function replayAll<P extends TourPrefs>(p: P): P {
  return { ...p, on: true, toured: {}, replay: null };
}

/** "Show me on the page", from a guide: that page once more, and only it. */
export function replayPage<P extends TourPrefs>(p: P, page: string): P {
  const toured = { ...p.toured };
  delete toured[page];
  return { ...p, toured, replay: page };
}

/**
 * The preference as stored, read back. `raw` is the parsed JSON or null when
 * nothing is stored; `oldHand` says whether this device already held a patron
 * npub, which is what makes a device with no preference an old hand rather
 * than a newcomer.
 */
export function fromStored(raw: unknown, oldHand: boolean): TourPrefs {
  if (raw == null || typeof raw !== "object") return { ...TOUR_DEFAULTS, on: !oldHand };
  const r = raw as Partial<TourPrefs>;
  const toured = r.toured && typeof r.toured === "object"
    ? (Object.fromEntries(Object.entries(r.toured).filter(([, v]) => v === true)) as Record<string, true>)
    : {};
  return {
    on: typeof r.on === "boolean" ? r.on : !oldHand,
    toured,
    replay: typeof r.replay === "string" ? r.replay : null,
  };
}
