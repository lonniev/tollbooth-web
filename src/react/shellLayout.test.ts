import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shellLayout } from "./shellLayout.ts";

describe("the app shell's frame", () => {
  it("is a column at least as tall as the viewport, content filling it, by default", () => {
    const { root, body } = shellLayout();
    assert.equal(root.display, "flex");
    assert.equal(root.flexDirection, "column");
    assert.equal(root.minHeight, "100dvh");
    assert.equal(root.height, undefined, "a long page still scrolls the window");
    assert.equal(body.flex, "1 0 auto");
  });

  it("pins to the viewport and lets the content shrink, so the debug spacer never pushes a bottom rail off screen", () => {
    const { root, body } = shellLayout("viewport");
    assert.equal(root.height, "100dvh");
    assert.equal(body.minHeight, 0, "without min-height 0 the content refuses to give up its room");
    assert.equal(body.flex, "1 1 0%");
  });
});
