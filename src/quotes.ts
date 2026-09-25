/**
 * Quotations for a wait: something to read while a page loads, instead of a
 * frozen "Loading…".
 *
 * Each site keeps its own set — agrarian for a farm, copywriters for a posting
 * tool — and may name a remote corpus (a `{ quotes: [{ text, author }] }` JSON
 * file) that supersedes it once it loads, so the set can be edited without a
 * redeploy. The remote file is fetched at most once per page per URL; two
 * sites or two corpora never share a cache entry. Anything that goes wrong —
 * offline, a 404, a malformed file, an empty list — leaves the site's own set
 * on screen.
 */

export interface Quote {
  text: string;
  author: string;
}

/** Keep only well-formed rows: both fields present as non-blank strings. */
export function validQuotes(rows: unknown): Quote[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const { text, author } = row as Record<string, unknown>;
    if (typeof text !== "string" || typeof author !== "string") return [];
    if (!text.trim() || !author.trim()) return [];
    return [{ text, author }];
  });
}

/** A shuffled copy (Fisher–Yates); the input is left alone. */
export function shuffle<T>(items: ReadonlyArray<T>, random: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Per source URL: the validated remote list ([] when the fetch failed), and
// the one request in flight so concurrent callers share it.
const loaded = new Map<string, Quote[]>();
const inflight = new Map<string, Promise<Quote[]>>();

/** The remote list already loaded for `source` this page, if there is one. */
export function peekQuotes(source: string): Quote[] | undefined {
  const list = loaded.get(source);
  return list && list.length ? list : undefined;
}

/**
 * The quotes at `source`, or `fallback` when they cannot be had. Fetched once
 * per page per URL; a failure is remembered too, so a broken corpus costs one
 * request, not one per spinner.
 */
export async function loadQuotes(
  source: string,
  fallback: ReadonlyArray<Quote>,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Quote[]> {
  const pick = (list: Quote[]) => (list.length ? list : fallback.slice());
  const done = loaded.get(source);
  if (done) return pick(done);
  let pending = inflight.get(source);
  if (!pending) {
    pending = (async () => {
      let list: Quote[] = [];
      try {
        const res = await fetchImpl(source, { cache: "no-cache" });
        if (res.ok) {
          const body = (await res.json()) as { quotes?: unknown } | null;
          list = validQuotes(body?.quotes);
        }
      } catch {
        list = [];
      }
      loaded.set(source, list);
      inflight.delete(source);
      return list;
    })();
    inflight.set(source, pending);
  }
  return pick(await pending);
}
