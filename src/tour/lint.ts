/**
 * The voice a tour speaks in, checked.
 *
 * A step says what a control is and what to do with it, in one or two short
 * sentences. It never says what something is not, and never contrasts: "your
 * npub is your key" and never "your key, not a password". A site's test runs
 * its tours through this so every site holds the same voice.
 */

import type { Tour, TourStep } from "./types.ts";

const CONTRAST = /\b(not|no|never|nothing|instead of|rather than)\b/i;
export const MAX_SAYS = 180;
export const MAX_TITLE = 28;
export const MAX_SENTENCES = 2;

function sentences(text: string): number {
  return text.split(/[.!?](\s|$)/).filter((x) => x.trim()).length;
}

/** The problems with one step's words, each a sentence; none when it is well said. */
export function lintStep(s: TourStep, page = ""): string[] {
  const where = page ? `${page} "${s.title}"` : `"${s.title}"`;
  const out: string[] = [];
  if (!s.title.trim()) out.push(`${where}: has no title`);
  if (s.title.length > MAX_TITLE) out.push(`${where}: the title runs ${s.title.length} characters`);
  if (!s.says.trim()) out.push(`${where}: says nothing`);
  if (s.says.length > MAX_SAYS) out.push(`${where}: runs ${s.says.length} characters`);
  if (sentences(s.says) > MAX_SENTENCES) out.push(`${where}: is more than ${MAX_SENTENCES} sentences`);
  const m = CONTRAST.exec(s.says) ?? CONTRAST.exec(s.title);
  if (m) out.push(`${where}: says what something is not ("${m[0]}"): ${s.says}`);
  return out;
}

/** Every problem in a tour's words. */
export function lintTour(t: Tour): string[] {
  const out: string[] = [];
  if (!t.steps.length) out.push(`${t.page}: has no steps`);
  for (const s of t.steps) out.push(...lintStep(s, t.page));
  return out;
}

/** Every problem across a site's tours. */
export function lintTours(tours: Record<string, Tour>): string[] {
  return Object.values(tours).flatMap(lintTour);
}
