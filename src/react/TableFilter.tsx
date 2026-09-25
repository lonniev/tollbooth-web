/**
 * A filter bar for a table: any of a search box, a date range and a panel of
 * questions, with one Clear chip shown only while something is on.
 *
 * Merged from the fleet's two shapes — the search + date range (cypher,
 * excalibur, roastify, after TaxSort) and the mark that opens a panel of
 * toggles and numbers (goodearth). A site passes the groups it wants.
 *
 * Controlled and presentational: the parent owns the applied values and runs
 * the query (server-side, or `filterRows` in the browser), so paging reflects
 * the filtered set. The search is applied on Enter or its chip, never on each
 * keystroke. Mechanics only: every visual choice is the site's, through
 * `classNames`; the actions are chips.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { filterActive } from "../table.ts";

export interface DateFieldOption {
  value: string;
  label: string;
}

/** One question the panel asks: a toggle, or a number with a unit beside it. */
export type FilterQuestion<F> =
  | { kind: "toggle"; key: keyof F; label: string }
  | { kind: "number"; key: keyof F; label: string; unit: string };

export interface TableFilterClassNames {
  root?: string;
  /** The search box and its chip. */
  search?: string;
  input?: string;
  /** Every action: search, the panel's mark, Clear. */
  chip?: string;
  /** Added to the panel's mark while a question is answered. */
  chipActive?: string;
  /** The date-field select, the two dates and the dash between. */
  dates?: string;
  select?: string;
  date?: string;
  separator?: string;
  /** The box holding the mark and its panel (positioned: the panel hangs from it). */
  questions?: string;
  /** What is on, beside the mark. */
  summary?: string;
  panel?: string;
  /** One question's row. */
  question?: string;
  checkbox?: string;
  number?: string;
  unit?: string;
}

export interface TableFilterSearch {
  /** The applied text. */
  value: string;
  onSearch: (text: string) => void;
  placeholder?: string;
  /** Tooltip on the box, e.g. that it takes a regular expression. */
  title?: string;
}

export interface TableFilterDates {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  /** Which date the range reads, when a row has more than one. */
  field?: string;
  fields?: DateFieldOption[];
  onField?: (v: string) => void;
}

export interface TableFilterQuestions<F> {
  value: F;
  onChange: (f: F) => void;
  questions: readonly FilterQuestion<F>[];
  /** What is on, in as few words as fit beside the mark; "" when nothing is. */
  summary: string;
  /** The mark's icon. Default a sliders glyph. */
  icon?: ReactNode;
}

export interface TableFilterProps<F extends object> {
  search?: TableFilterSearch;
  dates?: TableFilterDates;
  questions?: TableFilterQuestions<F>;
  /** Turn everything off. */
  onClear: () => void;
  searchIcon?: ReactNode;
  clearLabel?: ReactNode;
  classNames?: TableFilterClassNames;
}

function cx(...parts: (string | false | undefined)[]): string | undefined {
  const s = parts.filter(Boolean).join(" ");
  return s || undefined;
}

export default function TableFilter<F extends object>({
  search,
  dates,
  questions,
  onClear,
  searchIcon = <Search size="1em" aria-hidden />,
  clearLabel = (
    <>
      <X size="1em" aria-hidden /> Clear
    </>
  ),
  classNames: c = {},
}: TableFilterProps<F>) {
  const active = filterActive(
    { search: search?.value, dateFrom: dates?.from, dateTo: dates?.to },
    questions?.summary ?? "",
  );

  return (
    <div className={c.root}>
      {search && <SearchBox search={search} icon={searchIcon} c={c} />}
      {dates && <DateRange dates={dates} c={c} />}
      {questions && <QuestionPanel q={questions} c={c} />}
      {active && (
        <button type="button" onClick={onClear} className={c.chip}>
          {clearLabel}
        </button>
      )}
    </div>
  );
}

function SearchBox({ search, icon, c }: { search: TableFilterSearch; icon: ReactNode; c: TableFilterClassNames }) {
  // Edited freely, applied on Enter or the chip; follows the applied value
  // when it changes elsewhere (Clear).
  const [input, setInput] = useState(search.value);
  useEffect(() => setInput(search.value), [search.value]);
  return (
    <div className={c.search}>
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") search.onSearch(input);
        }}
        placeholder={search.placeholder ?? "Search…"}
        title={search.title}
        aria-label="Search"
        className={c.input}
      />
      <button type="button" onClick={() => search.onSearch(input)} title="Search" aria-label="Search" className={c.chip}>
        {icon}
      </button>
    </div>
  );
}

function DateRange({ dates, c }: { dates: TableFilterDates; c: TableFilterClassNames }) {
  return (
    <div className={c.dates}>
      {dates.fields && dates.fields.length > 0 && dates.onField && (
        <select
          value={dates.field}
          onChange={(e) => dates.onField!(e.target.value)}
          title="Which date the range filters"
          aria-label="Date to filter"
          className={c.select}
        >
          {dates.fields.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <input
        type="date"
        value={dates.from}
        max={dates.to || undefined}
        onChange={(e) => dates.onFrom(e.target.value)}
        title="From (inclusive)"
        aria-label="From date"
        className={c.date}
      />
      <span className={c.separator} aria-hidden>
        –
      </span>
      <input
        type="date"
        value={dates.to}
        min={dates.from || undefined}
        onChange={(e) => dates.onTo(e.target.value)}
        title="To (inclusive)"
        aria-label="To date"
        className={c.date}
      />
    </div>
  );
}

function QuestionPanel<F extends object>({ q, c }: { q: TableFilterQuestions<F>; c: TableFilterClassNames }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Dismissed by a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const on = q.summary !== "";
  const set = (key: keyof F, v: unknown) => q.onChange({ ...q.value, [key]: v } as F);

  return (
    <div className={c.questions} ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={on ? `Filtered: ${q.summary}` : "Filter"}
        aria-label={on ? `Filtered: ${q.summary}` : "Filter"}
        className={cx(c.chip, on && c.chipActive)}
      >
        {q.icon ?? <SlidersHorizontal size="1em" aria-hidden />}
        {on && <span className={c.summary}>{q.summary}</span>}
      </button>
      {open && (
        <div className={c.panel} role="group" aria-label="Filter">
          {q.questions.map((question) => {
            const id = `tf-${String(question.key)}`;
            return question.kind === "toggle" ? (
              <label key={id} className={c.question}>
                <input
                  type="checkbox"
                  checked={!!q.value[question.key]}
                  onChange={(e) => set(question.key, e.target.checked)}
                  className={c.checkbox}
                />{" "}
                {question.label}
              </label>
            ) : (
              <div key={id} className={c.question}>
                <label htmlFor={id}>{question.label}</label>{" "}
                <input
                  id={id}
                  inputMode="numeric"
                  value={String(q.value[question.key] ?? "")}
                  onChange={(e) => set(question.key, e.target.value)}
                  className={c.number}
                />{" "}
                <span className={c.unit}>{question.unit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
