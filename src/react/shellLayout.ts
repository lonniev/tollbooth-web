/**
 * The frame `AppShell` lays out: a column as tall as the viewport, the site's
 * content growing to fill it, then the footer, then the debug log's spacer.
 *
 * "page" (the default) lets a long page grow past the viewport and scroll the
 * window. "viewport" pins the frame to the viewport's height, for a site with
 * a bottom rail that must stay on screen: the content region may shrink
 * (min-height 0) and scrolls inside, so the debug log's spacer takes its room
 * out of the content rather than pushing the rail off the bottom.
 */

import type { CSSProperties } from "react";

export type ShellFit = "page" | "viewport";

export interface ShellLayout {
  root: CSSProperties;
  body: CSSProperties;
}

export function shellLayout(fit: ShellFit = "page"): ShellLayout {
  const column: CSSProperties = { display: "flex", flexDirection: "column" };
  if (fit === "viewport") {
    return {
      root: { ...column, height: "100dvh", overflow: "hidden" },
      body: { ...column, flex: "1 1 0%", minHeight: 0, overflow: "auto" },
    };
  }
  return {
    root: { ...column, minHeight: "100dvh" },
    body: { ...column, flex: "1 0 auto" },
  };
}
