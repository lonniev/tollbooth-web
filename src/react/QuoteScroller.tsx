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
 * does not jump as quotes change.
 *
 * Mechanics only. The package owns the timing, the fade, the cache and the
 * reserved height; every visual choice — type, size, colour, spacing,
 * alignment — belongs to the site, through `classNames` or `renderQuote`.
 * With neither, the quotes are plain text that inherits from the page. The
 * reserved height is the tallest quote as the SITE styles it: every quote is
 * laid out, invisibly, in the same grid cell as the one on show.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  /** Classes for each part. The package adds no typography or colour of its
   *  own to any of them. `text`, `mark` and `author` are unused when
   *  `renderQuote` is given. */
  classNames?: QuoteScrollerClassNames;
  /** Full control of one quote's markup. The package still wraps it for the
   *  fade and the reserved height. */
  renderQuote?: (quote: Quote) => ReactNode;
  /** Quotation marks around the text: the curly pair by default, `false` for
   *  none, or your own `[open, close]`. */
  marks?: boolean | readonly [open: string, close: string];
}

export interface QuoteScrollerClassNames {
  /** The outer box. */
  root?: string;
  /** The status line. */
  heading?: string;
  /** The spinner icon. Given, it replaces the default 1em size. */
  spinner?: string;
  /** Each quote's `<figure>`. */
  figure?: string;
  /** The `<blockquote>` holding the text and its marks. */
  text?: string;
  /** Each quotation mark. */
  mark?: string;
  /** The `<figcaption>` naming the author. */
  author?: string;
}

const CURLY = ["\u201c", "\u201d"] as const;

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
  classNames = {},
  renderQuote,
  marks = true,
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

  const q = list[index % Math.max(list.length, 1)];
  const pair = marks === true ? CURLY : marks === false ? null : marks;
  const draw =
    renderQuote ??
    ((quote: Quote) => (
      <figure className={classNames.figure}>
        <blockquote className={classNames.text}>
          {pair && <span className={classNames.mark}>{pair[0]}</span>}
          {quote.text}
          {pair && <span className={classNames.mark}>{pair[1]}</span>}
        </blockquote>
        <figcaption className={classNames.author}>{quote.author}</figcaption>
      </figure>
    ));

  return (
    <div className={classNames.root}>
      {heading && (
        <div className={classNames.heading}>
          {spinner && (
            <Loader2
              aria-hidden
              className={`${classNames.spinner ?? "inline-block h-[1em] w-[1em]"} motion-safe:animate-spin`}
            />
          )}
          {spinner && " "}
          {heading}
        </div>
      )}
      {q && (
        <div style={STAGE}>
          {/* Every quote, invisible, in the one cell: the tallest holds the height. */}
          {list.map((each, i) => (
            <div key={i} style={HOLDER} aria-hidden>
              {draw(each)}
            </div>
          ))}
          <div
            style={{
              ...CELL,
              opacity: shown ? 1 : 0,
              transition: reduced ? "none" : `opacity ${FADE_MS}ms ease`,
            }}
            aria-live="polite"
            aria-atomic
          >
            {draw(q)}
          </div>
        </div>
      )}
    </div>
  );
}

// Structure for the mechanism only, inline so it needs no stylesheet.
const STAGE: CSSProperties = { display: "grid" };
const CELL: CSSProperties = { gridArea: "1 / 1", minWidth: 0 };
const HOLDER: CSSProperties = { ...CELL, visibility: "hidden" };
