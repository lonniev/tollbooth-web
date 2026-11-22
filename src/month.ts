/**
 * A month as days: the day an instant falls on, the weeks of a month padded to
 * whole weeks, and the month before or after. Framework-free; the React month
 * calendar (`MonthCalendar`) draws from these.
 *
 * Days are keyed `YYYY-MM-DD`. Without a time zone a day is the browser's own;
 * with one it is that zone's, so a site that shows times in the patron's chosen
 * zone puts each event on the day that zone sees.
 */

import { getZonedParts } from "./timezone.ts";

const two = (n: number) => String(n).padStart(2, "0");

/** The `YYYY-MM-DD` an instant (in seconds) falls on, locally or in `timeZone`. */
export function dayKey(seconds: number, timeZone?: string): string {
  const d = new Date(seconds * 1000);
  if (timeZone) {
    const p = getZonedParts(d, timeZone);
    return `${p.year}-${two(p.month)}-${two(p.day)}`;
  }
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export interface MonthDay {
  /** `YYYY-MM-DD`. */
  key: string;
  day: number;
  /** Belongs to the month shown, as against the days that pad its first and last weeks. */
  inMonth: boolean;
}

/** The weeks of a month, Sunday first, padded to whole weeks. `month` is 0 to 11. */
export function monthWeeks(year: number, month: number): MonthDay[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: MonthDay[][] = [];
  for (let d = new Date(start); weeks.length < 6; ) {
    const week: MonthDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ key: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, day: d.getDate(), inMonth: d.getMonth() === month });
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    if (weeks.length >= 4 && !week.some((x) => x.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

/** The month before or after: `{ year, month }` with month 0 to 11. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** The month (`{ year, month }`, month 0 to 11) an instant falls in, locally or in `timeZone`. */
export function monthOf(seconds: number, timeZone?: string): { year: number; month: number } {
  const [year, month] = dayKey(seconds, timeZone).split("-").map(Number);
  return { year: year!, month: month! - 1 };
}

/** Events grouped by the day they fall on, in the order given. */
export function eventsByDay<E>(events: readonly E[], at: (e: E) => number, timeZone?: string): Map<string, E[]> {
  const days = new Map<string, E[]>();
  for (const e of events) {
    const key = dayKey(at(e), timeZone);
    const list = days.get(key);
    if (list) list.push(e);
    else days.set(key, [e]);
  }
  return days;
}
