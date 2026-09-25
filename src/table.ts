/**
 * Paging, sorting and filtering arithmetic for a table, without a framework.
 *
 * Pages are zero-based. A table may be paged by the server (it sends one page
 * and a total) or in the browser (`pageRows` over the whole list); the
 * arithmetic is the same either way.
 */

export type SortDir = "asc" | "desc";

/** The last page's index for `total` rows. Zero when there are none. */
export function lastPage(total: number, pageSize: number): number {
  if (!(pageSize > 0) || !(total > 0)) return 0;
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}

/** A page index that exists: whole, and between 0 and the last page. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const p = Number.isFinite(page) ? Math.trunc(page) : 0;
  return Math.min(Math.max(0, p), lastPage(total, pageSize));
}

export function pageCount(total: number, pageSize: number): number {
  return lastPage(total, pageSize) + 1;
}

/** One page of an in-memory list. */
export function pageRows<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  if (!(pageSize > 0)) return [...rows];
  const p = clampPage(page, rows.length, pageSize);
  return rows.slice(p * pageSize, (p + 1) * pageSize);
}

/**
 * The sort after a header is tapped: the active column flips direction; a new
 * column starts at `initial` (descending by default — newest, largest first).
 */
export function nextSort(
  col: string,
  activeCol: string,
  dir: SortDir,
  initial: SortDir = "desc",
): { col: string; dir: SortDir } {
  if (col === activeCol) return { col, dir: dir === "desc" ? "asc" : "desc" };
  return { col, dir: initial };
}

/** The `aria-sort` of a column header: set on the sorted column only. */
export function ariaSort(col: string, activeCol: string, dir: SortDir): "ascending" | "descending" | undefined {
  if (col !== activeCol) return undefined;
  return dir === "desc" ? "descending" : "ascending";
}

// ── A popover kept on screen ───────────────────────────────────────────────

/**
 * How far to slide a popover sideways so it stays inside the viewport: the
 * horizontal offset (px, negative is left) to add to where it would sit.
 * `left` and `width` are its box as laid out before any slide. It keeps
 * `margin` px from each edge; one wider than the room left is pinned to the
 * left margin (give it a max-width to fit). Zero when it already fits.
 */
export function nudgeIntoView(left: number, width: number, viewportWidth: number, margin = 8): number {
  const minLeft = margin;
  const maxLeft = viewportWidth - margin - width;
  if (maxLeft < minLeft || left < minLeft) return minLeft - left;
  if (left > maxLeft) return maxLeft - left;
  return 0;
}

// ── Filtering ──────────────────────────────────────────────────────────────

/**
 * A case-insensitive test for `pattern`. It is read as a regular expression
 * when it is one, and as plain text when it is not, so a stray "(" in a search
 * box finds the bracket rather than throwing. An empty pattern matches all.
 */
export function searchMatcher(pattern: string): (text: string) => boolean {
  const p = pattern.trim();
  if (!p) return () => true;
  try {
    const re = new RegExp(p, "i");
    return (text) => re.test(text);
  } catch {
    const needle = p.toLowerCase();
    return (text) => text.toLowerCase().includes(needle);
  }
}

/** The calendar day ("YYYY-MM-DD") of an ISO stamp or date, or null. */
export function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

/**
 * Whether `value` falls in the inclusive range [from, to], compared by day.
 * An empty bound is open. A row with no date is outside any range that has
 * a bound, and inside one that has none.
 */
export function inDateRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  const day = dayOf(value);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export interface RowFilter {
  search: string;
  dateFrom: string;
  dateTo: string;
}

export const NO_FILTER: RowFilter = { search: "", dateFrom: "", dateTo: "" };

export function filterActive(f: Partial<RowFilter>, summary = ""): boolean {
  return !!(f.search?.trim() || f.dateFrom || f.dateTo || summary);
}

/**
 * Filter rows in the browser, for a table the server does not filter.
 * `text` gives what the search reads; `date` the stamp the range reads.
 */
export function filterRows<T>(
  rows: readonly T[],
  f: Partial<RowFilter>,
  by: { text: (row: T) => string; date?: (row: T) => string | null | undefined },
): T[] {
  const match = searchMatcher(f.search ?? "");
  const from = f.dateFrom ?? "";
  const to = f.dateTo ?? "";
  const ranged = !!(from || to) && !!by.date;
  return rows.filter((r) => match(by.text(r)) && (!ranged || inDateRange(by.date!(r), from, to)));
}
