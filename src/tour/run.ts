/**
 * A tour as driver.js runs it, and the offer that precedes it.
 *
 * driver.js draws the popover and the cutout. This adds what it has no idea
 * of: a page action before a step whose control must be opened first, a tour
 * that ends when nothing later can be shown, a "Stop the tutorial" link in
 * every popover, and the centred question a page asks after a quiet while.
 *
 * DOM code, so it is untested here as its peers are; the rules it applies
 * live in `./state.ts` and `./idle.ts`, which are.
 */

import { driver, type DriveStep } from "driver.js";
import type { Tour, TourStep } from "./types.ts";

export interface TourRun {
  start(): void;
  /** Take the tour down. `silent` is for the page leaving under it. */
  stop(silent?: boolean): void;
}

export interface TourHooks {
  /** Do what a step asks for before it is pointed at. */
  run(action: string): void | Promise<void>;
  /** The tour ended by its last step or its ✕: this page is done. */
  onEnd(): void;
  /** "Stop the tutorial": off on every page. */
  onStop(): void;
}

/** How long to wait for a control that a page action is still opening. */
const WAIT_MS = 1500;

export const POPOVER_CLASS = "tb-tour";

export function selector(name: string): string {
  return `[data-tour="${name}"]`;
}

/** Whether a step's control is on the page right now. */
function present(s: TourStep): boolean {
  return typeof s.target === "string" ? !!document.querySelector(selector(s.target)) : !!s.target();
}

export function buildTour(tour: Tour, hooks: TourHooks): TourRun {
  let silent = false;
  // The step at or after `from` that can be shown: its control is on the
  // page, or its page action will put it there. driver.js's own skipping of
  // a missing element loses its place when the FIRST steps are missing, so
  // the tour moves by index and decides for itself.
  const showable = (from: number): number =>
    tour.steps.findIndex((s, j) => j >= from && (Boolean(s.before) || present(s)));
  const showableBack = (from: number): number => {
    for (let j = from; j >= 0; j--) if (present(tour.steps[j])) return j;
    return -1;
  };
  const steps: DriveStep[] = tour.steps.map((s) => ({
    // driver.js types a finder as returning an Element; one that finds
    // nothing returns null, which it treats as a missing element and skips.
    element: typeof s.target === "string" ? selector(s.target) : (s.target as () => Element),
    popover: {
      title: s.title,
      description: s.says,
      side: s.side ?? "bottom",
      align: s.align ?? "start",
    },
  }));

  const d = driver({
    steps,
    popoverClass: POPOVER_CLASS,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    allowClose: true,
    overlayOpacity: 0.45,
    stagePadding: 6,
    stageRadius: 8,
    smoothScroll: true,
    skipMissingElement: true,
    waitForElement: WAIT_MS,
    onPopoverRender(popover) {
      const stop = document.createElement("button");
      stop.type = "button";
      stop.className = "tb-tour-stop";
      stop.textContent = "Stop the tutorial";
      stop.addEventListener("click", () => { silent = true; hooks.onStop(); d.destroy(); });
      popover.wrapper.appendChild(stop);
    },
    async onNextClick() {
      // With no showable step left the tour is over.
      const i = d.getActiveIndex() ?? 0;
      const n = showable(i + 1);
      if (n < 0) { d.destroy(); return; }
      const next = tour.steps[n];
      if (next.before) await hooks.run(next.before);
      d.moveTo(n);
    },
    onPrevClick() {
      const i = d.getActiveIndex() ?? 0;
      const b = showableBack(i - 1);
      if (b >= 0) d.moveTo(b);
    },
    onDestroyed() {
      if (!silent) hooks.onEnd();
    },
  });

  return {
    start() {
      const i = showable(0);
      if (i < 0) { hooks.onEnd(); return; }
      const first = tour.steps[i];
      if (first.before) void Promise.resolve(hooks.run(first.before)).then(() => d.drive(i));
      else d.drive(i);
    },
    stop(quiet = true) {
      silent = quiet;
      if (d.isActive()) d.destroy();
    },
  };
}

export interface OfferHooks {
  onYes(): void;
  /** "No", the ✕, or a tap outside: this page is done being asked. */
  onNo(): void;
}

export interface Offer {
  show(): void;
  /** Take the question down without answering it. */
  dismiss(): void;
}

/** The question a page asks after a quiet while, centred, with Yes and No. */
export function offerTour(hooks: OfferHooks, words = OFFER_WORDS): Offer {
  let answered = false;
  let quiet = false;
  const d = driver({
    popoverClass: `${POPOVER_CLASS} tb-tour-offer`,
    showButtons: [],
    allowClose: true,
    overlayOpacity: 0.3,
    onPopoverRender(popover) {
      const row = document.createElement("div");
      row.className = "tb-tour-answer";
      const no = document.createElement("button");
      no.type = "button";
      no.className = "tb-tour-no";
      no.textContent = words.no;
      no.addEventListener("click", () => { answered = true; d.destroy(); hooks.onNo(); });
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "tb-tour-yes";
      yes.textContent = words.yes;
      // The tour starts on the next tick. Started inside this click, the
      // click would go on to the new tour's outside-click listener and close
      // it before it was seen.
      yes.addEventListener("click", () => { answered = true; d.destroy(); window.setTimeout(hooks.onYes, 0); });
      row.append(no, yes);
      popover.wrapper.appendChild(row);
    },
    onDestroyed() {
      if (!answered && !quiet) hooks.onNo();
    },
  });
  return {
    show() {
      d.highlight({ popover: { title: words.title, description: words.says } });
    },
    dismiss() {
      quiet = true;
      if (d.isActive()) d.destroy();
    },
  };
}

export interface OfferWords {
  title: string;
  says: string;
  yes: string;
  no: string;
}

export const OFFER_WORDS: OfferWords = {
  title: "A tour?",
  says: "Would you like a tour of this page? It points at each control and says what it is for.",
  yes: "Yes",
  no: "No",
};
