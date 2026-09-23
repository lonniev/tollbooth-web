import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collapsedDisplayName,
  howToSetExplainer,
  publishControlDisabled,
  publishControlLabel,
  publishControlMode,
} from "./profilePresentation.ts";

test("without a signer the action explains instead of publishing", () => {
  assert.equal(publishControlMode(false), "how-to-set");
  assert.equal(publishControlLabel("how-to-set", false), "How to set…");
});

test("'How to set…' is never disabled — a disabled button runs no handler", () => {
  assert.equal(publishControlDisabled("how-to-set", true), false);
  assert.equal(publishControlDisabled("publish", true), true);
  assert.equal(publishControlDisabled("publish", false), false);
});

test("an empty name falls back to a title", () => {
  assert.equal(collapsedDisplayName("  "), "Nostr profile");
  assert.equal(collapsedDisplayName("Lonnie"), "Lonnie");
});

test("the explainer names the site that is showing it", () => {
  const e = howToSetExplainer("ChartRemotely");
  assert.ok(e.paragraphs.every((p) => !p.includes("Bee")));
  assert.ok(e.paragraphs.some((p) => p.includes("ChartRemotely")));
});
