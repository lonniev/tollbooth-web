/**
 * Light / dark / system as a row of chips, the current one marked. Mechanics
 * only: `classNames` styles it, `labels` names the choices (text or icons),
 * and `themes` picks which are offered — ["dark", "light"] for a site with no
 * "system" option.
 */

import type { ReactNode } from "react";
import { THEMES, type Theme } from "../theme.ts";
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

const LABELS: Record<Theme, string> = { dark: "Dark", light: "Light", system: "System" };

export default function ThemeToggle({ themes = THEMES, labels = {}, fallback = "dark", classNames: c = {} }: ThemeToggleProps) {
  const [theme, setTheme] = useTheme(fallback);
  return (
    <div role="radiogroup" aria-label="Theme" className={c.root}>
      {themes.map((t) => {
        const on = t === theme;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={LABELS[t]}
            onClick={() => setTheme(t)}
            className={[c.chip, on && c.active].filter(Boolean).join(" ") || undefined}
          >
            {labels[t] ?? LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}
