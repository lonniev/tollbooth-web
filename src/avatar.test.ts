import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avatarChoices, DEFAULT_AVATAR_CHOICES, defaultAvatar } from "./avatar.ts";
import { configureTollbooth } from "./config.ts";

const NPUB = "npub16qarmz80zwag03nhvgz67903glq9qams632834zy4h3ha3klfycqyn35wf";

describe("avatar glyphs", () => {
  it("fall back to the general set when a site names none", () => {
    configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp" });
    assert.deepEqual(avatarChoices(), DEFAULT_AVATAR_CHOICES);
  });

  it("come from the site when it names its own, default included", () => {
    const farm = ["🐝", "🌻", "🥕"];
    configureTollbooth({ slug: "goodearth", appName: "Good Earth", mcpUrl: "/mcp", avatarChoices: farm });
    assert.deepEqual(avatarChoices(), farm);
    assert.ok(farm.includes(defaultAvatar(NPUB)));
  });
});
