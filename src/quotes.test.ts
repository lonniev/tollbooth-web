import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadQuotes, peekQuotes, shuffle, validQuotes, type Quote } from "./quotes.ts";

const OWN: Quote[] = [{ text: "Observe the seasons.", author: "Hesiod" }];
const REMOTE: Quote[] = [
  { text: "Omit needless words.", author: "William Strunk Jr." },
  { text: "Easy reading is damn hard writing.", author: "Nathaniel Hawthorne" },
];

let n = 0;
const url = () => `https://example.test/quotes-${++n}.json`;

function serving(body: unknown, status = 200) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("which rows count as quotes", () => {
  it("drops rows missing a field, with a non-string field, or blank", () => {
    const rows = [
      REMOTE[0],
      { text: "No author" },
      { author: "No text" },
      { text: 42, author: "Number" },
      { text: "   ", author: "Blank" },
      { text: "Blank author", author: "" },
      null,
      "a string",
      REMOTE[1],
    ];
    assert.deepEqual(validQuotes(rows), REMOTE);
  });

  it("keeps only text and author", () => {
    assert.deepEqual(validQuotes([{ ...REMOTE[0], extra: "<b>x</b>" }]), [REMOTE[0]]);
  });

  it("treats anything but an array as no quotes", () => {
    assert.deepEqual(validQuotes({ text: "x", author: "y" }), []);
    assert.deepEqual(validQuotes(undefined), []);
  });
});

describe("shuffling", () => {
  it("keeps every member and leaves the input alone", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const out = shuffle(items);
    assert.deepEqual([...out].sort(), items);
    assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7]);
  });

  it("reorders when the dice say so", () => {
    assert.deepEqual(shuffle([1, 2, 3], () => 0), [2, 3, 1]);
  });
});

describe("loading a remote corpus", () => {
  it("returns the remote quotes, validated", async () => {
    const { impl } = serving({ quotes: [...REMOTE, { text: "bad" }] });
    assert.deepEqual(await loadQuotes(url(), OWN, impl), REMOTE);
  });

  it("fetches a URL once, sharing the request between concurrent callers", async () => {
    const u = url();
    const { impl, calls } = serving({ quotes: REMOTE });
    const [a, b] = await Promise.all([loadQuotes(u, OWN, impl), loadQuotes(u, OWN, impl)]);
    await loadQuotes(u, OWN, impl);
    assert.equal(calls.length, 1);
    assert.deepEqual(a, REMOTE);
    assert.deepEqual(b, REMOTE);
    assert.deepEqual(peekQuotes(u), REMOTE);
  });

  it("keeps two corpora apart", async () => {
    const [u1, u2] = [url(), url()];
    const one = serving({ quotes: [REMOTE[0]] });
    const two = serving({ quotes: [REMOTE[1]] });
    assert.deepEqual(await loadQuotes(u1, OWN, one.impl), [REMOTE[0]]);
    assert.deepEqual(await loadQuotes(u2, OWN, two.impl), [REMOTE[1]]);
    assert.deepEqual(await loadQuotes(u1, OWN, two.impl), [REMOTE[0]]);
    assert.equal(two.calls.length, 1);
  });

  it("falls back to the site's own set when the fetch throws", async () => {
    const impl = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    assert.deepEqual(await loadQuotes(url(), OWN, impl), OWN);
  });

  it("falls back on an HTTP error, and does not ask again", async () => {
    const u = url();
    const { impl, calls } = serving({ quotes: REMOTE }, 404);
    assert.deepEqual(await loadQuotes(u, OWN, impl), OWN);
    assert.deepEqual(await loadQuotes(u, OWN, impl), OWN);
    assert.equal(calls.length, 1);
    assert.equal(peekQuotes(u), undefined);
  });

  it("falls back when the file holds no usable quotes", async () => {
    assert.deepEqual(await loadQuotes(url(), OWN, serving({ quotes: [] }).impl), OWN);
    assert.deepEqual(await loadQuotes(url(), OWN, serving({ quotes: [{ text: 1 }] }).impl), OWN);
    assert.deepEqual(await loadQuotes(url(), OWN, serving(null).impl), OWN);
  });

  it("hands back a copy of the fallback, never the site's own array", async () => {
    const out = await loadQuotes(url(), OWN, serving({}).impl);
    assert.notEqual(out, OWN);
  });
});

describe("the QuoteScroller component", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "react/QuoteScroller.tsx"), "utf8");
  // Everything the component renders, comments aside.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("imposes no type, size or colour of its own — those are the site's", () => {
    for (const banned of [
      /\btext-(xs|sm|base|lg|[2-9]?xl|\[)/,
      /\bfont-(serif|mono|sans|thin|light|normal|medium|semibold|bold|black)\b/,
      /\b(italic|not-italic|uppercase|lowercase)\b/,
      /\b(tracking|leading)-/,
      /\b(bg|border|text)-\[var/,
      /var\(--tb-/,
      /\b(p|px|py|m|mx|my|mb|mt|gap|max-w)-/,
      /\btext-center\b/,
    ]) {
      assert.doesNotMatch(code, banned, `QuoteScroller applies ${banned}`);
    }
  });

  it("hands each part the site's classes", () => {
    for (const part of ["root", "heading", "figure", "text", "mark", "author"]) {
      assert.match(code, new RegExp(`className=\\{classNames\\.${part}\\}`));
    }
    assert.match(code, /classNames\.spinner/);
  });
});
