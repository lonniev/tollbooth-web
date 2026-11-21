import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inside } from "./onScreen.ts";

describe("a panel stays on screen", () => {
  it("is left where it opens when it fits", () => {
    assert.equal(inside(100, 420, 1024), 0);
  });
  it("slides right when it would run off the left", () => {
    assert.equal(inside(-150, 170, 1024), 158);
  });
  it("slides left when it would run off the right", () => {
    assert.equal(inside(900, 1220, 1024), -204);
  });
  it("wider than the screen, its left edge stays on screen", () => {
    assert.equal(inside(10, 1100, 1024), -2);
    assert.equal(inside(-10, 1100, 1024), 18);
  });
});
