/**
 * Something worth reading while a page loads — rotating quotations instead of
 * a frozen "Loading…". First written for optionality-mcp as a port of the
 * Pricing Studio app's LoadingQuoteView, then copied across the fleet; this is
 * the one copy.
 *
 * The site brings its own quotes (`quotes`), so the scroller always has
 * something to show without the network. `source` may name a remote corpus
 * that supersedes them once it loads (see `loadQuotes`).
 *
 * The order is shuffled and then walked, so nothing repeats until every quote
 * has shown. It cross-fades (instantly under reduced motion), stops while the
 * tab is hidden, and reserves the height of its longest quote so the page
 * does not jump as quotes change. Coloured only through `--tb-*` tokens.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { loadQuotes, peekQuotes, shuffle, type Quote } from "../quotes.ts";

export interface QuoteScrollerProps {
  /** The site's own quotes: shown at once, and kept if `source` fails. Pass a
   *  module constant. */
  quotes: ReadonlyArray<Quote>;
  /** URL of a `{ quotes: [{ text, author }] }` JSON file that supersedes
   *  `quotes` once it loads. */
  source?: string;
  /** A status line above the quotes ("Reading the ledger…"). */
  heading?: string;
  /** Show a spinner beside the heading. Default false. */
  spinner?: boolean;
  /** How long each quote stays, in ms. Default 3500. */
  intervalMs?: number;
  /** Classes for the outer box (padding, placement). */
  className?: string;
}

const FADE_MS = 450;

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function usePageVisible(): boolean {
  const [shown, setShown] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  useEffect(() => {
    const on = () => setShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return shown;
}

export default function QuoteScroller({
  quotes,
  source,
  heading,
  spinner = false,
  intervalMs = 3500,
  className = "",
}: QuoteScrollerProps) {
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();

  // Content, not identity: a site that passes an inline array still gets one
  // shuffle, not one per render.
  const signature = quotes.map((q) => `${q.text}\u0000${q.author}`).join("\u0001");
  const [list, setList] = useState<Quote[]>(() =>
    shuffle((source && peekQuotes(source)) || quotes),
  );
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);

  const key = `${source ?? ""}\u0002${signature}`;
  const first = useRef(key);

  useEffect(() => {
    if (first.current !== key) {
      first.current = key;
      setList(shuffle((source && peekQuotes(source)) || quotes));
      setIndex(0);
    }
    if (!source || peekQuotes(source)) return; // nothing to fetch, or already showing it
    let alive = true;
    void loadQuotes(source, quotes).then((loaded) => {
      if (!alive || !peekQuotes(source)) return; // the site's own set is already up
      setList(shuffle(loaded));
      setIndex(0);
    });
    return () => {
      alive = false;
    };
    // `key` stands for `quotes` and `source`, by content.
  }, [key]);

  // Fade the first quote in.
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (list.length <= 1 || !pageVisible) return;
    const fade = reduced ? 0 : FADE_MS;
    let swap: number | undefined;
    const tick = window.setInterval(() => {
      setShown(false);
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setShown(true);
      }, fade);
    }, intervalMs);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(swap);
      setShown(true);
    };
  }, [list, intervalMs, reduced, pageVisible]);

  const longest = useMemo(
    () =>
      list.reduce<Quote | undefined>(
        (a, q) => (!a || q.text.length + q.author.length > a.text.length + a.author.length ? q : a),
        undefined,
      ),
    [list],
  );
  const q = list[index % Math.max(list.length, 1)];

  return (
    <div className={`px-4 py-6 text-center ${className}`}>
      {heading && (
        <div className="mb-5 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-[var(--tb-accent)]">
          {spinner && <Loader2 aria-hidden className="h-3.5 w-3.5 motion-safe:animate-spin" />}
          {heading}
        </div>
      )}
      {q && longest && (
        <div className="mx-auto grid max-w-xl">
          {/* The longest quote, invisible, holds the height. */}
          <QuoteText quote={longest} className="invisible [grid-area:1/1]" hidden />
          <QuoteText
            quote={q}
            className="[grid-area:1/1]"
            style={{
              opacity: shown ? 1 : 0,
              transition: reduced ? "none" : `opacity ${FADE_MS}ms ease`,
            }}
            live
          />
        </div>
      )}
    </div>
  );
}

function QuoteText({
  quote,
  className,
  style,
  hidden = false,
  live = false,
}: {
  quote: Quote;
  className: string;
  style?: CSSProperties;
  hidden?: boolean;
  live?: boolean;
}) {
  return (
    <figure
      className={`m-0 flex flex-col justify-center gap-3 ${className}`}
      style={style}
      aria-hidden={hidden || undefined}
      aria-live={live ? "polite" : undefined}
      aria-atomic={live || undefined}
    >
      <blockquote className="m-0 font-serif text-[17px] italic leading-relaxed text-[var(--tb-ink)]">
        <span className="not-italic text-[var(--tb-accent)]">&ldquo;</span>
        {quote.text}
        <span className="not-italic text-[var(--tb-accent)]">&rdquo;</span>
      </blockquote>
      <figcaption className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--tb-muted)]">
        {quote.author}
      </figcaption>
    </figure>
  );
}
