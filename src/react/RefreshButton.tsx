/**
 * The one refresh control: an icon button that spins while the re-read runs.
 *
 * Give it `onRefresh`; if that returns a promise the button is busy — spinning,
 * disabled, `aria-busy` — until it settles, so a second press cannot start a
 * second read. `busy` adds a busy state the site already holds (a page's
 * first load). A rejected refresh is not swallowed: it still rejects, and the
 * debug log's unhandled-rejection capture records it.
 *
 * Mechanics only: the size, colour and shape are the site's (`classNames`);
 * the spin is `motion-safe:animate-spin` unless `classNames.spinning` names
 * another. The label is both the tooltip and the accessible name — override it
 * only to say WHAT refreshes.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cx } from "./cx.ts";

export interface RefreshButtonClassNames {
  root?: string;
  /** Around the glyph. */
  icon?: string;
  /** Added around the glyph while busy. Default "motion-safe:animate-spin". */
  spinning?: string;
}

export interface RefreshButtonProps {
  onRefresh: () => unknown;
  /** Busy for a reason the button did not start. */
  busy?: boolean;
  /** Tooltip and accessible name. Default "Refresh". */
  label?: string;
  /** Replaces the refresh glyph. */
  icon?: ReactNode;
  /** The default glyph's size in px. Default 20. */
  iconSize?: number;
  classNames?: RefreshButtonClassNames;
}

const TAP: CSSProperties = { minWidth: 40, minHeight: 40 };
const GLYPH: CSSProperties = { display: "inline-flex" };

export default function RefreshButton({
  onRefresh,
  busy = false,
  label = "Refresh",
  icon,
  iconSize = 20,
  classNames: c = {},
}: RefreshButtonProps) {
  const [running, setRunning] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const spinning = busy || running;

  function press() {
    if (spinning) return;
    const result = onRefresh();
    if (!(result instanceof Promise)) return;
    setRunning(true);
    void result.finally(() => {
      if (live.current) setRunning(false);
    });
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={spinning}
      aria-busy={spinning}
      aria-label={label}
      title={label}
      className={c.root}
      style={TAP}
    >
      <span aria-hidden className={cx(c.icon, spinning && (c.spinning ?? "motion-safe:animate-spin"))} style={GLYPH}>
        {icon ?? <RefreshCw size={iconSize} />}
      </span>
    </button>
  );
}
