import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, eventsByDay, monthOf, monthWeeks, shiftMonth } from "./month.ts";

test("a month is whole weeks from Sunday, and months step across years", () => {
  const weeks = monthWeeks(2026, 10); // November 2026 starts on a Sunday
  assert.equal(weeks[0]![0]!.key, "2026-11-01");
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.flat().filter((d) => d.inMonth).length, 30);
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});

test("a month that starts late in the week pads back to its Sunday", () => {
  const weeks = monthWeeks(2026, 7); // August 2026 starts on a Saturday
  assert.equal(weeks[0]![0]!.key, "2026-07-26");
  assert.equal(weeks[0]![0]!.inMonth, false);
  assert.equal(weeks.flat().filter((d) => d.inMonth).length, 31);
  assert.equal(weeks.length, 6);
});

test("a February that starts on a Sunday fills exactly four weeks", () => {
  const feb = monthWeeks(2026, 1);
  assert.equal(feb.length, 4);
  assert.equal(feb.flat().filter((d) => d.inMonth).length, 28);
});

test("without a zone a day is the browser's own", () => {
  assert.equal(dayKey(new Date(2026, 10, 17, 12).getTime() / 1000), "2026-11-17");
});

test("with a zone an instant lands on the day that zone sees", () => {
  // 2026-11-23 03:30 UTC is still Sunday evening in New York.
  const late = Date.UTC(2026, 10, 23, 3, 30) / 1000;
  assert.equal(dayKey(late, "UTC"), "2026-11-23");
  assert.equal(dayKey(late, "America/New_York"), "2026-11-22");
  assert.equal(dayKey(late, "Asia/Tokyo"), "2026-11-23");
  assert.deepEqual(monthOf(Date.UTC(2026, 11, 1, 2) / 1000, "America/New_York"), { year: 2026, month: 10 });
});

test("events are grouped by their day, in the order given", () => {
  const ev = [
    { id: "a", at: Date.UTC(2026, 10, 22, 12) / 1000 },
    { id: "b", at: Date.UTC(2026, 10, 23, 3, 30) / 1000 },
    { id: "c", at: Date.UTC(2026, 10, 23, 15) / 1000 },
  ];
  const days = eventsByDay(ev, (e) => e.at, "America/New_York");
  assert.deepEqual([...days.keys()], ["2026-11-22", "2026-11-23"]);
  assert.deepEqual(days.get("2026-11-22")!.map((e) => e.id), ["a", "b"]);
});
