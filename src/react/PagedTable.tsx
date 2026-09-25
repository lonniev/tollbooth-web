/**
 * The parts of a sortable, paged table: a header cell that sorts, the
 * First / Prev / Page N of M / Next / Last controls, and the frame.
 *
 * Mechanics only — the sort toggling and the paging arithmetic (`nextSort`,
 * `lastPage`, `clampPage` in the framework-free half). How it looks is the
 * site's, through `classNames`; the controls are chips. Paging can be the
 * server's (pass its total) or the browser's (`pageRows`).
 */

import type { ReactNode } from "react";
import { ariaSort, clampPage, lastPage, nextSort, type SortDir } from "../table.ts";

function cx(...parts: (string | false | undefined)[]): string | undefined {
  const s = parts.filter(Boolean).join(" ");
  return s || undefined;
}

export interface SortHeaderClassNames {
  /** The header cell: the <th>, or the <div> when `as="div"`. */
  cell?: string;
  /** The button inside a sortable header. */
  button?: string;
  /** Added to the button of the column being sorted. */
  active?: string;
  /** The ▾ / ▴ mark. */
  arrow?: string;
}

export interface SortHeaderProps {
  label: ReactNode;
  /** The column's sort key. Omit for a header that does not sort. */
  col?: string;
  activeCol: string;
  dir: SortDir;
  onSort: (col: string, dir: SortDir) => void;
  /** The direction a newly chosen column starts in. Default "desc". */
  initialDir?: SortDir;
  /**
   * The element: a <th> in a table (default), or a <div role="columnheader">
   * for a grid of divs — the sort, the button and aria-sort are the same.
   */
  as?: "th" | "div";
  classNames?: SortHeaderClassNames;
}

/** A header cell. Tapping the sorted column flips it; another column starts at `initialDir`. */
export function SortHeader({
  label,
  col,
  activeCol,
  dir,
  onSort,
  initialDir = "desc",
  as = "th",
  classNames: c = {},
}: SortHeaderProps) {
  const Cell = as;
  const role = as === "div" ? "columnheader" : undefined;
  if (!col) {
    return (
      <Cell role={role} className={c.cell}>
        {label}
      </Cell>
    );
  }
  const active = col === activeCol;
  return (
    <Cell role={role} className={c.cell} aria-sort={ariaSort(col, activeCol, dir)}>
      <button
        type="button"
        onClick={() => {
          const next = nextSort(col, activeCol, dir, initialDir);
          onSort(next.col, next.dir);
        }}
        className={cx(c.button, active && c.active)}
      >
        {label}
        {active && (
          <span aria-hidden className={c.arrow}>
            {dir === "desc" ? " ▾" : " ▴"}
          </span>
        )}
      </button>
    </Cell>
  );
}

export interface PageControlsClassNames {
  root?: string;
  /** Every control. */
  chip?: string;
  /** "Page N of M · K total". */
  label?: string;
}

export interface PageControlsProps {
  /** Zero-based. */
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Render nothing when everything fits on one page. Default false. */
  hideSinglePage?: boolean;
  classNames?: PageControlsClassNames;
}

/** First / ← Prev / Page N of M · K total / Next → / Last. */
export function PageControls({ page, pageSize, total, onPage, hideSinglePage = false, classNames: c = {} }: PageControlsProps) {
  const last = lastPage(total, pageSize);
  if (hideSinglePage && last === 0) return null;
  const p = clampPage(page, total, pageSize);
  return (
    <nav aria-label="Pages" className={c.root}>
      <button type="button" className={c.chip} disabled={p === 0} onClick={() => onPage(0)} title="First page" aria-label="First page">
        ⏮
      </button>
      <button type="button" className={c.chip} disabled={p === 0} onClick={() => onPage(p - 1)}>
        ← Prev
      </button>
      <span className={c.label}>
        Page {p + 1} of {last + 1} · {total.toLocaleString("en-US")} total
      </span>
      <button type="button" className={c.chip} disabled={p >= last} onClick={() => onPage(p + 1)}>
        Next →
      </button>
      <button type="button" className={c.chip} disabled={p >= last} onClick={() => onPage(last)} title="Last page" aria-label="Last page">
        ⏭
      </button>
    </nav>
  );
}

export interface TableShellClassNames {
  /** The frame. Give it `overflow-x: auto` to scroll a wide table — the
   *  package does not, since a scrolling box clips popovers inside it. */
  root?: string;
  table?: string;
}

/** The frame every paged table sits in: a box and the <table>. */
export function TableShell({ children, classNames: c = {} }: { children: ReactNode; classNames?: TableShellClassNames }) {
  return (
    <div className={c.root}>
      <table className={c.table}>{children}</table>
    </div>
  );
}
