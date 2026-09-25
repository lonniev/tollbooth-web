/**
 * Light, dark or the system's choice — kept under `<prefix>:theme` so a
 * returning patron keeps their pick, and applied to <html> before first paint.
 *
 * Mechanics only; the colours are the site's. Applying a theme sets all three
 * hooks a stylesheet might key on, so every fleet site's CSS keeps working:
 *   - the `dark` class (Tailwind `darkMode: "class"`, `@custom-variant dark`),
 *   - `data-theme="light" | "dark"` (the package's theme.css and token sheets),
 *   - `color-scheme` (native form controls and scrollbars).
 * "system" resolves to the OS preference and follows it live.
 */

import { tollboothConfig } from "./config.ts";

export type Theme = "dark" | "light" | "system";
export type EffectiveTheme = "dark" | "light";

export const THEMES: readonly Theme[] = ["dark", "light", "system"];

export function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "system";
}

/** The stored pick, or `fallback` when nothing (or nonsense) is stored. */
export function parseTheme(raw: string | null | undefined, fallback: Theme = "dark"): Theme {
  return isTheme(raw) ? raw : fallback;
}

export function themeStorageKey(): string {
  return `${tollboothConfig().storagePrefix}:theme`;
}

export function readTheme(fallback: Theme = "dark"): Theme {
  try {
    return parseTheme(globalThis.localStorage?.getItem(themeStorageKey()), fallback);
  } catch {
    return fallback; // blocked site data, or not configured yet
  }
}

export function writeTheme(theme: Theme): void {
  try {
    globalThis.localStorage?.setItem(themeStorageKey(), theme);
  } catch {
    /* the choice still applies for this page */
  }
}

export function systemPrefersDark(): boolean {
  try {
    return !!globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: Theme, prefersDark: boolean = systemPrefersDark()): EffectiveTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/** The part of <html> a theme touches — narrow, so it is testable without a DOM. */
export interface ThemeTarget {
  classList: { toggle(token: string, force?: boolean): unknown };
  setAttribute(name: string, value: string): void;
  style: { colorScheme: string };
}

export function applyTheme(theme: Theme, target?: ThemeTarget, prefersDark?: boolean): EffectiveTheme {
  const effective = resolveTheme(theme, prefersDark);
  const el = target ?? (globalThis.document?.documentElement as ThemeTarget | undefined);
  if (el) {
    el.classList.toggle("dark", effective === "dark");
    el.setAttribute("data-theme", effective);
    el.style.colorScheme = effective;
  }
  return effective;
}

/**
 * Apply the stored theme. Call once in main.tsx, after `configureTollbooth`
 * and before rendering, so the first frame has the right palette.
 */
export function bootstrapTheme(fallback: Theme = "dark"): Theme {
  const theme = readTheme(fallback);
  applyTheme(theme);
  return theme;
}

/** The pick after `current`, for a single chip that cycles. */
export function nextTheme(current: Theme, order: readonly Theme[] = THEMES): Theme {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length] ?? order[0];
}
