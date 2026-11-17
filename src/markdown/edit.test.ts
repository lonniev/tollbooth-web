import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMarkdown as apply } from "./edit.ts";

test("bold and italic wrap the selection and keep it selected", () => {
  assert.deepEqual(apply("bold", "sweep the floor", 6, 9, "x"), { text: "sweep **the** floor", start: 8, end: 11 });
  assert.deepEqual(apply("italic", "sweep", 0, 5, "x"), { text: "_sweep_", start: 1, end: 6 });
});

test("with nothing selected, the filler word is put in, selected for typing over", () => {
  const out = apply("bold", "ab", 1, 1, "words");
  assert.equal(out.text, "a**words**b");
  assert.equal(out.text.slice(out.start, out.end), "words");
});

test("a link leaves the cursor where its address goes", () => {
  const out = apply("link", "see the list", 4, 12, "link");
  assert.equal(out.text, "see [the list](https://)");
  assert.equal(out.start, out.end);
  assert.equal(out.text.slice(0, out.start), "see [the list](https://");
});

test("list, checklist, quote and heading mark every line the selection touches", () => {
  const text = "plates\ncups\nforks";
  assert.equal(apply("bullets", text, 2, 9, "").text, "- plates\n- cups\nforks");
  assert.equal(apply("numbers", text, 0, text.length, "").text, "1. plates\n2. cups\n3. forks");
  assert.equal(apply("checklist", text, 8, 8, "").text, "plates\n- [ ] cups\nforks");
  assert.equal(apply("quote", "a", 0, 0, "").text, "> a");
  assert.equal(apply("heading", "Kitchen", 3, 3, "").text, "## Kitchen");
});

test("a code block sits on lines of its own", () => {
  assert.equal(apply("codeBlock", "run this now", 4, 8, "code").text, "run \n```\nthis\n```\n now");
  assert.equal(apply("codeBlock", "", 0, 0, "code").text, "```\ncode\n```");
});
