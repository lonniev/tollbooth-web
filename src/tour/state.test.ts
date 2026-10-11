import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromStored, markToured, replayAll, replayPage, shouldRun, stopAll, TOUR_DEFAULTS } from "./state.ts";

describe("who sees a tour", () => {
  it("a new device is offered every page once", () => {
    const p = fromStored(null, false);
    assert.equal(p.on, true);
    assert.equal(shouldRun(p, "plots"), true);
    const after = markToured(p, "plots");
    assert.equal(shouldRun(after, "plots"), false);
    assert.equal(shouldRun(after, "crops"), true);
  });
  it("a device that already held a patron npub starts with the tutorial off", () => {
    const p = fromStored(null, true);
    assert.equal(p.on, false);
    assert.equal(shouldRun(p, "plots"), false);
  });
  it("a stored preference is kept, and odd fields dropped", () => {
    const p = fromStored({ on: true, toured: { plots: true, crops: "yes" }, replay: 7 }, true);
    assert.equal(p.on, true);
    assert.deepEqual(p.toured, { plots: true });
    assert.equal(p.replay, null);
    assert.deepEqual(fromStored("junk", false), TOUR_DEFAULTS);
  });
  it("keeps whatever else the preferences hold", () => {
    const p = { ...TOUR_DEFAULTS, bees: true };
    assert.equal(markToured(p, "x").bees, true);
    assert.equal(stopAll(p).bees, true);
  });
});

describe("stopping and starting again", () => {
  it("stop ends it on every page", () => {
    const p = stopAll(fromStored(null, false));
    for (const page of ["plots", "crops", "account"]) assert.equal(shouldRun(p, page), false);
  });
  it("the switch on replays everything", () => {
    const p = replayAll(markToured(markToured(stopAll(fromStored(null, false)), "plots"), "crops"));
    assert.equal(p.on, true);
    assert.deepEqual(p.toured, {});
    assert.equal(shouldRun(p, "plots"), true);
  });
  it("a guide replays its own page once, whatever the switch says", () => {
    const off = markToured(stopAll(fromStored(null, false)), "plots");
    const p = replayPage(off, "plots");
    assert.equal(p.on, false);
    assert.equal(shouldRun(p, "plots"), true);
    assert.equal(shouldRun(p, "crops"), false);
    const done = markToured(p, "plots");
    assert.equal(done.replay, null);
    assert.equal(shouldRun(done, "plots"), false);
  });
  it("a replay asked for one page leaves another's mark alone", () => {
    const p = replayPage(markToured(markToured(fromStored(null, false), "plots"), "crops"), "plots");
    assert.deepEqual(p.toured, { crops: true });
  });
});
