/**
 * The reader's text size, kept under `<prefix>:text-size` and applied to
 * <html> as a root font size, so every rem-sized word on the page grows with
 * it. `configureTollbooth` applies the stored pick, so the first frame is
 * already the reader's size; the Appearance section on the Profile changes it.
 */

export type TextSize = "standard" | "large" | "larger" | "largest";

export const TEXT_SIZES: readonly TextSize[] = ["standard", "large", "larger", "largest"];

/** Each size as a share of the browser's own root size. */
export const TEXT_SCALE: Record<TextSize, number> = { standard: 1, large: 1.125, larger: 1.25, largest: 1.5 };

export const TEXT_SIZE_NAMES: Record<TextSize, string> = {
  standard: "Standard text",
  large: "Large text",
  larger: "Larger text",
  largest: "Largest text",
};

export function isTextSize(v: unknown): v is TextSize {
  return typeof v === "string" && (TEXT_SIZES as readonly string[]).includes(v);
}

export function textSizeStorageKey(prefix: string): string {
  return `${prefix}:text-size`;
}

export function readTextSize(prefix: string): TextSize {
  try {
    const raw = globalThis.localStorage?.getItem(textSizeStorageKey(prefix));
    return isTextSize(raw) ? raw : "standard";
  } catch {
    return "standard";
  }
}

export function writeTextSize(prefix: string, size: TextSize): void {
  try {
    globalThis.localStorage?.setItem(textSizeStorageKey(prefix), size);
  } catch {
    /* the choice still applies for this page */
  }
}

/** The part of <html> a text size touches — narrow, so it is testable without a DOM. */
export interface TextSizeTarget {
  style: { fontSize: string };
  setAttribute(name: string, value: string): void;
}

export function applyTextSize(size: TextSize, target?: TextSizeTarget): void {
  const el = target ?? (globalThis.document?.documentElement as TextSizeTarget | undefined);
  if (!el) return;
  // Standard leaves the site's own root size alone.
  el.style.fontSize = size === "standard" ? "" : `${TEXT_SCALE[size] * 100}%`;
  el.setAttribute("data-text-size", size);
}
