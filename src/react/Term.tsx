/**
 * A word a page uses, and what it means, revealed on demand: tap the word, get
 * the sentence. First written twice, for Good Earth and FieldData; this is the
 * one copy.
 *
 * A `title` attribute is no definition: it needs a hovering mouse, and these
 * sites are read on a tablet. So this is a real disclosure, and it must always
 * go away and must always open when tapped:
 * - it toggles when the finger lifts, because the iPad can drop the click;
 *   a click that follows the lift is ignored, and a keyboard's Enter or Space
 *   (a click with no lift) still toggles it;
 * - it closes on any press outside it, on Escape, and by itself once there
 *   has been time to read it (`dwellMs`);
 * - its presses stay its own, so a word in a sortable table header never
 *   sorts the column, and a word in a form label never focuses the field.
 *
 * With no `label` it is a bare ⓘ beside something already labelled, a column
 * header or a field, which cannot hold a second word.
 *
 * Mechanics only. The site brings the definition (`said`, from its own
 * glossary in the reader's language) and every visual choice through
 * `classNames`. The package sets only what the disclosure needs to work: the
 * panel sits under the word, wraps, and is never wider than the screen.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { dwellMs } from "../dwell.ts";

export interface TermClassNames {
  /** The box around the word and its panel. */
  root?: string;
  /** The word, when there is a `label`. */
  word?: string;
  /** The ⓘ badge, when there is no `label`. */
  badge?: string;
  /** The panel that holds the definition. */
  panel?: string;
  /** The page's own addition, under the definition. */
  extra?: string;
}

export interface TermProps {
  /** The word on the page. Omit for a bare ⓘ. */
  label?: ReactNode;
  /** What the word means: the site's glossary sentence. */
  said?: ReactNode;
  /** What this page adds to the shared meaning ("left blank, it takes seven days"). */
  children?: ReactNode;
  /** Which edge of the word the panel lines up with. A word near the left of the screen needs "left". */
  align?: "left" | "right";
  /** The badge's accessible name when there is no label, in the reader's language. Default "What this means". */
  badgeLabel?: string;
  classNames?: TermClassNames;
}

const ROOT: CSSProperties = { position: "relative", display: "inline-block" };
const PANEL: CSSProperties = {
  position: "absolute",
  top: "100%",
  zIndex: 30,
  maxWidth: "calc(100vw - 2rem)",
  whiteSpace: "normal",
  overflowWrap: "break-word",
  textAlign: "left",
  textTransform: "none",
  fontWeight: "normal",
  letterSpacing: "normal",
};

export default function Term({ label, said, children, align = "right", badgeLabel = "What this means", classNames = {} }: TermProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  /** A lift already toggled it, so the click that may follow must not undo it. */
  const lifted = useRef(false);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const decay = window.setTimeout(() => setOpen(false), dwellMs(panel.current?.textContent ?? ""));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      window.clearTimeout(decay);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (said == null && children == null) return <>{label}</>;
  return (
    <span ref={box} className={classNames.root} style={ROOT}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label == null ? badgeLabel : undefined}
        className={label == null ? classNames.badge : classNames.word}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          lifted.current = true;
          setOpen((v) => !v);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (lifted.current) {
            lifted.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
      >
        {label ?? "i"}
      </button>
      {open && (
        <span ref={panel} role="tooltip" className={classNames.panel} style={{ ...PANEL, [align === "left" ? "left" : "right"]: 0 }}>
          {said != null && <span style={{ display: "block" }}>{said}</span>}
          {children != null && <span className={classNames.extra} style={{ display: "block" }}>{children}</span>}
        </span>
      )}
    </span>
  );
}
