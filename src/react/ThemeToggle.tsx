/**
 * Light / dark / system as a row of chips, the current one marked. Mechanics
 * only: `classNames` styles it, `labels` names the choices (text or icons),
 * and `themes` picks which are offered — ["dark", "light"] for a site with no
 * "system" option.
 */

import type { ReactNode } from "react";
import type { TranslationKey } from "../i18n/index.ts";
import { THEMES, type Theme } from "../theme.ts";
import { useT } from "./useT.ts";
import { useTheme } from "./useTheme.ts";

export interface ThemeToggleClassNames {
  root?: string;
  chip?: string;
  /** Added to the chip of the current pick. */
  active?: string;
}

export interface ThemeToggleProps {
  themes?: readonly Theme[];
  labels?: Partial<Record<Theme, ReactNode>>;
  /** The pick when nothing is stored. Default "dark". */
  fallback?: Theme;
  classNames?: ThemeToggleClassNames;
}

const LABELS: Record<Theme, TranslationKey> = { dark: "theme.dark", light: "theme.light", system: "theme.system" };

export default function ThemeToggle({ themes = THEMES, labels = {}, fallback = "dark", classNames: c = {} }: ThemeToggleProps) {
  const tr = useT();
  const [theme, setTheme] = useTheme(fallback);
  return (
    <div role="radiogroup" aria-label={tr("theme.label")} className={c.root}>
      {themes.map((t) => {
        const on = t === theme;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={tr(LABELS[t])}
            onClick={() => setTheme(t)}
            className={[c.chip, on && c.active].filter(Boolean).join(" ") || undefined}
          >
            {labels[t] ?? tr(LABELS[t])}
          </button>
        );
      })}
    </div>
  );
}
