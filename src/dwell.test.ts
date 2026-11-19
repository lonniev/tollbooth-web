import assert from "node:assert/strict";
import { test } from "node:test";
import { DWELL_MAX_MS, DWELL_MIN_MS, dwellMs } from "./dwell.ts";

test("a short definition stays long enough to find, a long one long enough to read, and none forever", () => {
  assert.equal(dwellMs(""), DWELL_MIN_MS);
  assert.equal(dwellMs("A sat."), DWELL_MIN_MS);
  const forty = Array.from({ length: 40 }, () => "word").join(" ");
  assert.equal(dwellMs(forty), 3000 + 40 * 250);
  assert.equal(dwellMs(`${forty} ${forty} ${forty}`), DWELL_MAX_MS);
});
