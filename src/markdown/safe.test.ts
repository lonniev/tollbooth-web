import { test } from "node:test";
import assert from "node:assert/strict";
import { safePicture, safeUrl } from "./safe.ts";

test("links go only to web pages and email", () => {
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(safeUrl("mailto:someone@example.com"), "mailto:someone@example.com");
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "file:///etc/passwd", "/relative", "#top"]) {
    assert.equal(safeUrl(bad), "", bad);
  }
});

test("pictures come only from https", () => {
  assert.ok(safePicture("https://example.com/p.png"));
  for (const bad of ["http://example.com/p.png", "data:image/png;base64,AAAA", "javascript:x", undefined, 3]) assert.ok(!safePicture(bad), String(bad));
});
