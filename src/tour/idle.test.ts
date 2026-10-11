import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_IDLE_MS, idleThreshold, offerDue } from "./idle.ts";

describe("when a tour is offered", () => {
  it("after the quiet stretch, with the tab in view", () => {
    assert.equal(offerDue(0, 9_999, true, 10_000), false);
    assert.equal(offerDue(0, 10_000, true, 10_000), true);
    assert.equal(offerDue(5_000, 20_000, true, 10_000), true);
  });
  it("never while the tab is hidden", () => {
    assert.equal(offerDue(0, 60_000, false, 10_000), false);
  });
  it("the stretch is the site's, the mount's, or ten seconds", () => {
    assert.equal(idleThreshold(undefined), DEFAULT_IDLE_MS);
    assert.equal(idleThreshold(30_000), 30_000);
    assert.equal(idleThreshold(30_000, 5_000), 5_000);
    assert.equal(idleThreshold(200), DEFAULT_IDLE_MS);
    assert.equal(idleThreshold(Number.NaN), DEFAULT_IDLE_MS);
  });
});
