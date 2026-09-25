import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DEBUG_BAR_PX, debugSpacerHeight, debugSpacerPx } from "./debugSpacer.ts";

describe("the room the DebugPanel keeps", () => {
  it("reserves the collapsed bar until the panel is measured", () => {
    assert.equal(DEBUG_BAR_PX, 40);
    for (const unmeasured of [null, undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(debugSpacerPx(unmeasured), DEBUG_BAR_PX, String(unmeasured));
    }
  });

  it("follows the panel's measured height, rounded up to a whole pixel", () => {
    assert.equal(debugSpacerPx(40), 40);
    assert.equal(debugSpacerPx(312.2), 313);
  });

  it("adds the iOS home-indicator inset", () => {
    assert.equal(debugSpacerHeight(null), "calc(40px + env(safe-area-inset-bottom, 0px))");
    assert.equal(debugSpacerHeight(300), "calc(300px + env(safe-area-inset-bottom, 0px))");
  });
});

describe("the DebugPanel's spacer", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "DebugPanel.tsx"), "utf8");

  it("renders an in-flow spacer beside the fixed bar, sized from the measured height", () => {
    assert.match(src, /<div aria-hidden="true" data-tb-debug-spacer=""[^>]*height: debugSpacerHeight\(barHeight\)/);
    assert.match(src, /<div ref=\{barRef\} className="pointer-events-none fixed inset-x-0 bottom-0/);
    // The spacer is a sibling of the fixed bar, not inside it.
    assert.ok(src.indexOf("data-tb-debug-spacer") < src.indexOf("ref={barRef}"));
  });

  it("measures the bar with a ResizeObserver, so open, close and resize all move the spacer", () => {
    assert.match(src, /globalThis\.ResizeObserver/);
    assert.match(src, /ro\.observe\(bar\)/);
    assert.match(src, /ro\.disconnect\(\)/);
    assert.match(src, /setBarHeight\(\(prev\) => \(prev === next \? prev : next\)\)/);
  });

  it("falls back to the collapsed bar with no ResizeObserver (SSR, old browsers)", () => {
    assert.match(src, /useState<number \| null>\(null\)/);
    assert.match(src, /if \(!bar \|\| !RO\) return;/);
  });

  it("never lays an invisible full-width layer over the page", () => {
    assert.match(src, /pointer-events-none fixed inset-x-0/);
    assert.doesNotMatch(src, /data-tb-debug-spacer=""[^>]*(?:fixed|absolute)/);
  });
});
