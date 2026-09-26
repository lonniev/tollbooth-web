import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_SECTIONS, accountSteps, type AccountStep } from "./accountSections.ts";

const names = (steps: AccountStep[]) => steps.map((s) => (s.kind === "section" ? s.section : `+${s.section}`));

describe("the account page's order", () => {
  it("draws every section, in the one order, by default", () => {
    assert.deepEqual(names(accountSteps({}, {})), [...ACCOUNT_SECTIONS]);
    assert.deepEqual(
      [...ACCOUNT_SECTIONS],
      ["profile", "sessionKey", "usage", "timezone", "theme", "coupons", "build"],
    );
  });

  it("puts a site's panel right after the section it names", () => {
    assert.deepEqual(names(accountSteps({}, { sessionKey: "X connection" })).slice(0, 4), [
      "profile",
      "sessionKey",
      "+sessionKey",
      "usage",
    ]);
  });

  it("keeps a site's panel in place when the section before it is hidden", () => {
    const steps = names(accountSteps({ coupons: false }, { coupons: "own coupons" }));
    assert.deepEqual(steps.slice(-3), ["theme", "+coupons", "build"]);
  });

  it("skips hidden sections and empty slots", () => {
    const steps = names(accountSteps({ usage: false, build: false }, { theme: null, timezone: false }));
    assert.deepEqual(steps, ["profile", "sessionKey", "timezone", "theme", "coupons"]);
  });
});
