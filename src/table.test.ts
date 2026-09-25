import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ariaSort,
  clampPage,
  dayOf,
  filterActive,
  filterRows,
  inDateRange,
  lastPage,
  nextSort,
  nudgeIntoView,
  pageCount,
  pageRows,
  searchMatcher,
} from "./table.ts";

describe("paging", () => {
  it("finds the last page", () => {
    assert.equal(lastPage(0, 10), 0);
    assert.equal(lastPage(10, 10), 0);
    assert.equal(lastPage(11, 10), 1);
    assert.equal(lastPage(25, 10), 2);
    assert.equal(lastPage(5, 0), 0, "a zero page size is one page, not a division by zero");
    assert.equal(pageCount(25, 10), 3);
    assert.equal(pageCount(0, 10), 1);
  });

  it("clamps a page into range", () => {
    assert.equal(clampPage(-1, 25, 10), 0);
    assert.equal(clampPage(9, 25, 10), 2);
    assert.equal(clampPage(1.7, 25, 10), 1);
    assert.equal(clampPage(Number.NaN, 25, 10), 0);
  });

  it("slices one page of a list, the last page short", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    assert.deepEqual(pageRows(rows, 0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(pageRows(rows, 2, 10), [20, 21, 22, 23, 24]);
    assert.deepEqual(pageRows(rows, 7, 10), [20, 21, 22, 23, 24], "past the end shows the last page");
    assert.deepEqual(pageRows([], 0, 10), []);
  });
});

describe("sorting", () => {
  it("flips the active column and starts a new one descending", () => {
    assert.deepEqual(nextSort("date", "date", "desc"), { col: "date", dir: "asc" });
    assert.deepEqual(nextSort("date", "date", "asc"), { col: "date", dir: "desc" });
    assert.deepEqual(nextSort("name", "date", "asc"), { col: "name", dir: "desc" });
    assert.deepEqual(nextSort("name", "date", "desc", "asc"), { col: "name", dir: "asc" });
  });
});

describe("filtering", () => {
  it("searches case-insensitively, as a regex when it is one", () => {
    assert.equal(searchMatcher("bitcoin")("Why Bitcoin?"), true);
    assert.equal(searchMatcher("^why")("Why Bitcoin?"), true);
    assert.equal(searchMatcher("coin$")("Why Bitcoin?"), false);
    assert.equal(searchMatcher("")("anything"), true);
    assert.equal(searchMatcher("  ")("anything"), true);
  });

  it("reads a broken regex as plain text instead of throwing", () => {
    const m = searchMatcher("price (");
    assert.equal(m("the price (sats)"), true);
    assert.equal(m("the price"), false);
  });

  it("compares dates by day, inclusive at both ends", () => {
    assert.equal(dayOf("2026-09-24T23:59:59Z"), "2026-09-24");
    assert.equal(dayOf(null), null);
    assert.equal(inDateRange("2026-09-24T23:00:00Z", "2026-09-24", "2026-09-24"), true);
    assert.equal(inDateRange("2026-09-23", "2026-09-24", ""), false);
    assert.equal(inDateRange("2026-09-25", "", "2026-09-24"), false);
    assert.equal(inDateRange("2026-09-25", "", ""), true);
    assert.equal(inDateRange(null, "", ""), true);
    assert.equal(inDateRange(null, "2026-01-01", ""), false, "an undated row is outside a bounded range");
  });

  it("knows when anything is on", () => {
    assert.equal(filterActive({ search: "", dateFrom: "", dateTo: "" }), false);
    assert.equal(filterActive({ search: "  " }), false);
    assert.equal(filterActive({ search: "x" }), true);
    assert.equal(filterActive({ dateTo: "2026-01-01" }), true);
    assert.equal(filterActive({}, "frost-tender"), true);
  });

  it("filters rows by text and date together", () => {
    const rows = [
      { text: "first frost", at: "2026-10-12" },
      { text: "Frost cloth", at: "2026-09-01" },
      { text: "seed order", at: "2026-10-01" },
    ];
    const by = { text: (r: (typeof rows)[number]) => r.text, date: (r: (typeof rows)[number]) => r.at };
    assert.deepEqual(filterRows(rows, { search: "frost" }, by).map((r) => r.at), ["2026-10-12", "2026-09-01"]);
    assert.deepEqual(filterRows(rows, { search: "frost", dateFrom: "2026-10-01" }, by).map((r) => r.at), ["2026-10-12"]);
    assert.equal(filterRows(rows, {}, by).length, 3);
  });
});

describe("aria-sort", () => {
  it("is set on the sorted column only, in the words assistive tech reads", () => {
    assert.equal(ariaSort("date", "date", "desc"), "descending");
    assert.equal(ariaSort("date", "date", "asc"), "ascending");
    assert.equal(ariaSort("amount", "date", "desc"), undefined);
  });
});

describe("a popover kept on screen", () => {
  it("leaves one that fits where it is", () => {
    assert.equal(nudgeIntoView(20, 300, 390), 0);
    assert.equal(nudgeIntoView(8, 374, 390), 0, "exactly the room between the margins fits");
  });

  it("slides one hanging off the left edge back in (Good Earth at 390 px)", () => {
    // A 280 px panel right-aligned under a mark near the left: it starts at -150.
    const dx = nudgeIntoView(-150, 280, 390);
    assert.equal(dx, 158);
    assert.equal(-150 + dx, 8);
  });

  it("slides one hanging off the right edge back in", () => {
    const dx = nudgeIntoView(200, 280, 390);
    assert.equal(200 + dx + 280, 390 - 8);
  });

  it("pins one wider than the viewport to the left margin", () => {
    assert.equal(-40 + nudgeIntoView(-40, 500, 390), 8);
    assert.equal(100 + nudgeIntoView(100, 500, 390), 8);
  });

  it("honours a custom margin", () => {
    assert.equal(-10 + nudgeIntoView(-10, 200, 390, 16), 16);
  });
});
