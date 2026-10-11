/**
 * The guided tour: who sees it, when it is offered, and how a page asks for
 * its own.
 *
 * `TourProvider` holds the site's tours and the preference. A page calls
 * `useTour(page, {actions})` once; when this device is due that page's tour,
 * the page is watched for a quiet stretch and then asked, centred, whether it
 * would like one. Yes starts the tour; No marks the page. A page asked to
 * replay from its guide starts at once. `actions` are what a step may ask
 * the page to do first — open the add form, pick a tag — by the names the
 * copy uses.
 *
 * The site keeps its own switch and its own replay button: `useTourSwitch`
 * and `useTourReplay` give them their mechanics.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { tollboothConfig } from "../config.ts";
import { ACTIVITY_EVENTS, idleThreshold, offerDue } from "../tour/idle.ts";
import { buildTour, offerTour, type OfferWords } from "../tour/run.ts";
import { markToured, replayAll, replayPage, shouldRun, stopAll, type TourPrefs } from "../tour/state.ts";
import type { Tour, TourActions } from "../tour/types.ts";
import { onTourChange, readTourPrefs, settleTourPrefs, tourStorageKey, writeTourPrefs } from "../tourPrefs.ts";

interface TourContext {
  prefs: TourPrefs;
  update(change: (p: TourPrefs) => TourPrefs): void;
  tours: Record<string, Tour>;
  idleMs: number;
  words?: OfferWords;
}

const Ctx = createContext<TourContext | null>(null);

function subscribe(changed: () => void): () => void {
  const stopPage = onTourChange(changed);
  const onStorage = (e: StorageEvent) => {
    try {
      if (e.key === tourStorageKey()) changed();
    } catch {
      /* not configured yet: nothing of ours changed */
    }
  };
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    stopPage();
    globalThis.removeEventListener?.("storage", onStorage);
  };
}

const onServer = (): TourPrefs => ({ on: false, toured: {}, replay: null });

export interface TourProviderProps {
  /** The site's tours, by page key — its own and the package's two. */
  tours: Record<string, Tour>;
  /** The quiet stretch before a page offers its tour. Defaults to the site's `tourIdleMs`, else 10 s. */
  idleMs?: number;
  /** The offer's words, when a site wants its own. */
  words?: OfferWords;
  children: ReactNode;
}

export function TourProvider({ tours, idleMs, words, children }: TourProviderProps) {
  const prefs = useSyncExternalStore(subscribe, readTourPrefs, onServer);
  const update = useCallback((change: (p: TourPrefs) => TourPrefs) => {
    writeTourPrefs(change(readTourPrefs()));
  }, []);
  const threshold = idleThreshold(tollboothConfig().tourIdleMs, idleMs);
  // A newcomer's first reading is written down, so signing in a minute later
  // does not turn them into an old hand.
  useEffect(() => { settleTourPrefs(); }, []);
  const value = useMemo<TourContext>(
    () => ({ prefs, update, tours, idleMs: threshold, words }),
    [prefs, update, tours, threshold, words],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface UseTourOptions {
  actions?: TourActions;
  /** False while the page has yet to draw what the tour points at. */
  ready?: boolean;
}

/** Ask for this page's tour, if this device is due it. */
export function useTour(page: string, { actions, ready = true }: UseTourOptions = {}): void {
  const ctx = useContext(Ctx);
  const acts = useRef(actions);
  acts.current = actions;
  const due = ctx ? shouldRun(ctx.prefs, page) : false;
  const atOnce = ctx?.prefs.replay === page;
  const update = ctx?.update;
  const tour = ctx?.tours[page];
  const idleMs = ctx?.idleMs ?? 0;
  const words = ctx?.words;

  useEffect(() => {
    if (!due || !ready || !update || !tour) return;
    let gone = false;
    let run: ReturnType<typeof buildTour> | null = null;
    let offer: ReturnType<typeof offerTour> | null = null;
    const start = () => {
      if (gone) return;
      run = buildTour(tour, {
        run: (name) => acts.current?.[name]?.(),
        onEnd: () => update((p) => markToured(p, page)),
        onStop: () => update(stopAll),
      });
      run.start();
    };

    // From a guide, at once; otherwise after a quiet while, and only asked.
    if (atOnce) {
      const timer = window.setTimeout(start, 600);
      return () => { gone = true; window.clearTimeout(timer); run?.stop(true); };
    }

    let last = Date.now();
    const touched = () => { last = Date.now(); };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, touched, { passive: true, capture: true });
    const tick = window.setInterval(() => {
      if (!offerDue(last, Date.now(), document.visibilityState === "visible", idleMs)) return;
      window.clearInterval(tick);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, touched, { capture: true });
      offer = offerTour({
        onYes: start,
        onNo: () => update((p) => markToured(p, page)),
      }, words);
      offer.show();
    }, 1000);
    return () => {
      gone = true;
      window.clearInterval(tick);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, touched, { capture: true });
      offer?.dismiss();
      run?.stop(true);
    };
  }, [page, due, atOnce, ready, update, tour, idleMs, words]);
}

/** The site's "Live tutorial" switch: on replays every page, off stops them all. */
export function useTourSwitch(): { on: boolean; setOn: (on: boolean) => void } {
  const ctx = useContext(Ctx);
  const update = ctx?.update;
  const setOn = useCallback((on: boolean) => { update?.(on ? replayAll : stopAll); }, [update]);
  return { on: ctx?.prefs.on ?? false, setOn };
}

/** The site's "Show me on the page" button: that page's tour once more, at once. */
export function useTourReplay(): (page: string) => void {
  const ctx = useContext(Ctx);
  const update = ctx?.update;
  return useCallback((page: string) => { update?.((p) => replayPage(p, page)); }, [update]);
}

/** The attribute to spread on the element a step points at. */
export function tourTarget(name: string): { "data-tour": string } {
  return { "data-tour": name };
}
