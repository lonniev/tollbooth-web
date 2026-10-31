import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintStep, lintTour, lintTours } from "./lint.ts";
import { accountTour, signInTour, walletTour } from "./tours.ts";

describe("the voice a tour speaks in", () => {
  it("passes a step that says what a thing is", () => {
    assert.deepEqual(lintStep({ target: "x", title: "Your npub", says: "Paste your npub here. An nsec works too." }), []);
  });
  it("fails a contrast", () => {
    const out = lintStep({ target: "x", title: "Your key", says: "Your npub is your key, not a password." });
    assert.equal(out.length, 1);
    assert.match(out[0], /says what something is not/);
    assert.match(lintStep({ target: "x", title: "No email", says: "Just a key." })[0], /"No"/);
  });
  it("fails a long step, and a third sentence", () => {
    assert.match(lintStep({ target: "x", title: "Long", says: "a".repeat(181) })[0], /runs 181 characters/);
    assert.match(lintStep({ target: "x", title: "Three", says: "One. Two. Three." })[0], /more than 2 sentences/);
    assert.match(lintStep({ target: "x", title: "A title that is far too long for a popover", says: "Fine." })[0], /title runs/);
  });
  it("fails an empty tour", () => {
    assert.match(lintTour({ page: "p", steps: [] })[0], /has no steps/);
  });
  it("holds the package's own tours to it", () => {
    assert.deepEqual(lintTours({ signin: signInTour(), account: accountTour(), wallet: walletTour() }), []);
  });
});
