/**
 * A month of events: each day shows its marks, a tap picks the day, and the
 * picked day's events are listed under the month by the site's `renderDay`.
 *
 * Mechanics only. What an event is, which marks a day shows, and how a day's
 * events read are the site's: it passes `marks`, `dayLabel` and `renderDay`.
 * The look is the site's too, through the `month-*` classes it styles. The DOM
 * and class names are the ones ChipIn and CommissionMarket drew before this
 * moved here, so their stylesheets apply unchanged.
 */

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, eventsByDay, monthOf, monthWeeks, shiftMonth } from "../month.ts";
import { cx } from "./cx.ts";
import { useLanguageLocale } from "./useLanguage.ts";
import { useT } from "./useT.ts";

/** A week of days starting on a Sunday, for the letters over the month's columns. */
const A_SUNDAY = new Date(2023, 0, 1);
const SHOWN_PER_DAY = 3;

export interface MonthCalendarWords {
  /** The button to the month before: its label and tooltip. */
  before?: string;
  after?: string;
  /** The summary of the key to the marks. */
  key?: string;
  /** Shown when the picked day has no events. */
  nothing?: string;
}

export interface MonthCalendarClassNames {
  /** The month's title and the picked day's title. */
  title?: string;
  /** The span holding a day's marks. Default `month-marks`. */
  marks?: string;
  /** Wraps the picked day's count; without it the count follows the title as plain text. */
  count?: string;
}

export interface MonthCalendarProps<E> {
  events: readonly E[];
  /** When an event happens, in seconds. */
  at: (event: E) => number;
  /** Now, in seconds: the month first shown and the day first picked. */
  now: number;
  /** The zone whose days the month shows. Omit for the browser's own. */
  timeZone?: string;
  /** The marks a day shows, in order, each once. The first three show, then "+n". */
  marks: (events: E[]) => string[];
  /** What a day holds, for a screen reader, after its date. */
  dayLabel: (events: E[]) => string[];
  /** An extra class on a day, e.g. one with something late. */
  dayClass?: (events: E[]) => string | false | undefined;
  /** The key to the marks. Omit for none. */
  legend?: { mark: string; label: string }[];
  /** Under the key: e.g. a link to subscribe to the calendar. */
  footer?: ReactNode;
  /** The picked day's events, drawn by the site. */
  renderDay: (events: E[]) => ReactNode;
  words?: MonthCalendarWords;
  classNames?: MonthCalendarClassNames;
  /** The size of the month arrows. Default 20. */
  iconSize?: number;
}

export default function MonthCalendar<E>({
  events, at, now, timeZone, marks, dayLabel, dayClass, legend, footer, renderDay, words = {}, classNames = {}, iconSize = 20,
}: MonthCalendarProps<E>) {
  const t = useT();
  const locale = useLanguageLocale();
  const before = words.before ?? t("month.before");
  const after = words.after ?? t("month.after");
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(A_SUNDAY.getFullYear(), A_SUNDAY.getMonth(), A_SUNDAY.getDate() + i).toLocaleDateString(locale, { weekday: "narrow" }));
  const today = dayKey(now, timeZone);
  const [shown, setShown] = useState(() => monthOf(now, timeZone));
  const [picked, setPicked] = useState(today);
  const days = eventsByDay(events, at, timeZone);
  const title = new Date(shown.year, shown.month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const pickedEvents = days.get(picked) ?? [];
  const pickedTitle = new Date(`${picked}T12:00:00`).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });

  return (
    <section className="grid gap-3">
      <div className="card panel grid gap-2">
        <div className="month-head">
          <button type="button" className="icon-btn" onClick={() => setShown((s) => shiftMonth(s.year, s.month, -1))} aria-label={before} title={before}>
            <ChevronLeft size={iconSize} aria-hidden />
          </button>
          <h2 className={classNames.title}>{title}</h2>
          <button type="button" className="icon-btn" onClick={() => setShown((s) => shiftMonth(s.year, s.month, 1))} aria-label={after} title={after}>
            <ChevronRight size={iconSize} aria-hidden />
          </button>
        </div>
        <div className="month" role="grid" aria-label={title}>
          {weekdays.map((d, i) => <span key={i} className="month-weekday" aria-hidden>{d}</span>)}
          {monthWeeks(shown.year, shown.month).flat().map((d) => {
            const here = days.get(d.key) ?? [];
            const shownMarks = here.length ? marks(here) : [];
            const classes = cx("month-day", !d.inMonth && "month-day-out", d.key === today && "month-day-today", d.key === picked && "month-day-on",
              here.length > 0 && dayClass?.(here));
            return (
              <button key={d.key} type="button" className={classes} aria-pressed={d.key === picked} onClick={() => setPicked(d.key)}
                aria-label={[d.key, ...(here.length ? dayLabel(here) : [])].join(", ")}>
                <span className="month-num num">{d.day}</span>
                <span className={classNames.marks ?? "month-marks"} aria-hidden>
                  {shownMarks.slice(0, SHOWN_PER_DAY).map((m) => <span key={m}>{m}</span>)}
                  {shownMarks.length > SHOWN_PER_DAY && <span className="month-more num">+{shownMarks.length - SHOWN_PER_DAY}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {legend && legend.length > 0 && (
          <details className="month-key">
            <summary className="muted">{words.key ?? t("month.key")}</summary>
            <ul className="month-key-list">
              {legend.map((l) => <li key={l.mark}><span aria-hidden>{l.mark}</span> {l.label}</li>)}
            </ul>
          </details>
        )}
        {footer}
      </div>
      <h2 className={classNames.title}>
        {pickedTitle}{" "}
        {classNames.count ? <span className={classNames.count}>({pickedEvents.length})</span> : `(${pickedEvents.length})`}
      </h2>
      {pickedEvents.length > 0 ? renderDay(pickedEvents) : <p className="card panel muted">{words.nothing ?? t("month.nothing")}</p>}
    </section>
  );
}
