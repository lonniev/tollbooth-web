import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACCOUNT_GROUPS, accountGroups } from "./accountSections.ts";

const shape = (plan: ReturnType<typeof accountGroups>) =>
  plan.map((g) => `${g.group}:${g.sections.join(",")}${g.panels ? "+" : ""}`);

describe("the account page's groups", () => {
  it("puts every built-in section in exactly one group, in the one order", () => {
    const all = ACCOUNT_GROUPS.flatMap((g) => g.sections);
    assert.deepEqual(all, ["profile", "theme", "timezone", "sessionKey", "usage", "peers", "operator", "build"]);
    assert.equal(new Set(all).size, all.length);
  });

  it("draws you, money and about for a patron, and operator only for the operator", () => {
    assert.deepEqual(shape(accountGroups({}, {}, { operator: false })),
      ["you:profile,theme,timezone,sessionKey", "money:usage,peers", "about:build"]);
    assert.deepEqual(shape(accountGroups({}, {}, { operator: true })).map((s) => s.split(":")[0]),
      ["you", "money", "operator", "about"]);
  });

  it("draws the site group only when the site gives it panels", () => {
    assert.ok(shape(accountGroups({}, { site: "calendar" }, { operator: false })).includes("site:+"));
    assert.ok(!shape(accountGroups({}, { site: false }, { operator: false })).some((s) => s.startsWith("site")));
  });

  it("marks a group the site adds to, and drops a group left empty", () => {
    const plan = shape(accountGroups({ usage: false, peers: false, build: false }, { money: "wallet" }, { operator: false }));
    assert.deepEqual(plan, ["you:profile,theme,timezone,sessionKey", "money:+"]);
  });

  it("keeps the you group for Log out even with every section of it hidden", () => {
    const hidden = { profile: false, theme: false, timezone: false, sessionKey: false };
    assert.equal(shape(accountGroups(hidden, {}, { operator: false, signOut: true }))[0], "you:");
    assert.ok(!shape(accountGroups(hidden, {}, { operator: false })).some((s) => s.startsWith("you")));
  });
});
