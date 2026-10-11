/**
 * The shape of a page's guided tour: a handful of steps, each pointing at one
 * control and saying what it is for.
 *
 * Data with no DOM in it, so a site's copy can be tested: every target drawn,
 * every sentence saying what a thing IS. The mechanics that run it are in
 * `./run.ts` and `react/useTour.ts`; the words are each site's own, except
 * for the two pages every site shares (`./tours.ts`).
 */

export interface TourStep {
  /**
   * A `data-tour` name on the element, or — for markup a site does not own —
   * a function that finds it. A function that finds nothing skips the step.
   */
  target: string | (() => Element | null);
  title: string;
  /** One or two short sentences: what the control is, what to do with it. */
  says: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /**
   * Something the page must do before this step can be pointed at — open the
   * add form, pick a tag. The page registers the action by this name.
   */
  before?: string;
  /** The guide step this abbreviates, for a site's own test: [group, control]. */
  guide?: [group: string, control: string];
}

export interface Tour {
  /** The page's key, as the site names its views. */
  page: string;
  steps: TourStep[];
}

/** What a step may ask the page to do first, by name. */
export type TourActions = Record<string, () => void | Promise<void>>;
