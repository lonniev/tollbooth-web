import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { configureTollbooth } from "./config.ts";
import {
  datetimeLocalValueToIso,
  detectBrowserTimeZone,
  displayTimeZone,
  formatDateTime,
  getTimeZoneOffsetMs,
  getZonedParts,
  hourInZone,
  isoToDatetimeLocalValue,
  isValidTimeZone,
  localDateFilterBounds,
  normalizeTimezonePref,
  onTimezoneChange,
  readTimezonePref,
  resolveTimeZone,
  startOfLocalDayIso,
  startOfNextLocalDayIso,
  timezoneStorageKey,
  writeTimezonePref,
  zonedWallTimeToUtcMs,
} from "./timezone.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const NY = "America/New_York";
const iso = (ms: number) => new Date(ms).toISOString();

describe("New York spring-forward (2026-03-08, 02:00 → 03:00)", () => {
  it("reads wall times either side with the offset in force", () => {
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 3, 8, 1, 30, 0, NY)), "2026-03-08T06:30:00.000Z"); // EST
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 3, 8, 3, 30, 0, NY)), "2026-03-08T07:30:00.000Z"); // EDT
  });

  it("moves a wall time that never happened an hour on", () => {
    // 02:30 does not exist that morning; it is read as 03:30 EDT.
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 3, 8, 2, 30, 0, NY)), "2026-03-08T07:30:00.000Z");
    assert.equal(datetimeLocalValueToIso("2026-03-08T02:30", NY), "2026-03-08T07:30:00.000Z");
  });

  it("gives the 23-hour day its true bounds", () => {
    assert.equal(startOfLocalDayIso("2026-03-08", NY), "2026-03-08T05:00:00.000Z");
    assert.equal(startOfNextLocalDayIso("2026-03-08", NY), "2026-03-09T04:00:00.000Z");
  });

  it("reports the offset change", () => {
    assert.equal(getTimeZoneOffsetMs(new Date("2026-03-08T06:59:59Z"), NY), -5 * 3600_000);
    assert.equal(getTimeZoneOffsetMs(new Date("2026-03-08T07:00:00Z"), NY), -4 * 3600_000);
  });
});

describe("New York fall-back (2026-11-01, 02:00 → 01:00)", () => {
  it("takes the earlier of a doubled wall time", () => {
    // 01:30 happens twice: 05:30Z (EDT) and 06:30Z (EST).
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 11, 1, 1, 30, 0, NY)), "2026-11-01T05:30:00.000Z");
  });

  it("reads wall times either side with the offset in force", () => {
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 11, 1, 0, 30, 0, NY)), "2026-11-01T04:30:00.000Z"); // EDT
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 11, 1, 2, 30, 0, NY)), "2026-11-01T07:30:00.000Z"); // EST
  });

  it("shows both instants of the doubled hour as 01:30", () => {
    assert.equal(isoToDatetimeLocalValue("2026-11-01T05:30:00.000Z", NY), "2026-11-01T01:30");
    assert.equal(isoToDatetimeLocalValue("2026-11-01T06:30:00.000Z", NY), "2026-11-01T01:30");
    assert.equal(hourInZone("2026-11-01T06:30:00.000Z", NY), 1);
  });

  it("gives the 25-hour day its true bounds", () => {
    assert.deepEqual(localDateFilterBounds("2026-11-01", "2026-11-01", NY), {
      dateFrom: "2026-11-01T04:00:00.000Z",
      dateTo: "2026-11-02T05:00:00.000Z",
    });
  });
});

describe("conversions away from a change", () => {
  it("round-trips a datetime-local value in winter and summer", () => {
    for (const at of ["2026-01-15T17:00:00.000Z", "2026-07-15T16:00:00.000Z"]) {
      const local = isoToDatetimeLocalValue(at, NY);
      assert.equal(local.slice(11), "12:00");
      assert.equal(datetimeLocalValueToIso(local, NY), at);
    }
  });

  it("works across the date line and in UTC", () => {
    assert.equal(iso(zonedWallTimeToUtcMs(2026, 1, 1, 0, 0, 0, "Pacific/Auckland")), "2025-12-31T11:00:00.000Z");
    assert.equal(startOfLocalDayIso("2026-08-01", "UTC"), "2026-08-01T00:00:00.000Z");
    assert.equal(startOfNextLocalDayIso("2026-12-31", "UTC"), "2027-01-01T00:00:00.000Z");
  });

  it("keeps the offset the instant had, not today's", () => {
    const p = getZonedParts(new Date("2026-01-15T17:00:00.000Z"), NY);
    assert.deepEqual([p.month, p.day, p.hour], [1, 15, 12]);
  });

  it("leaves bad input out rather than guessing", () => {
    assert.equal(datetimeLocalValueToIso("tomorrow", NY), null);
    assert.equal(isoToDatetimeLocalValue("nope", NY), "");
    assert.equal(hourInZone("nope", NY), null);
    assert.deepEqual(localDateFilterBounds("", "2026-13", NY), {});
    assert.equal(formatDateTime(null, NY), "—");
    assert.equal(formatDateTime("not a date", NY), "not a date");
  });
});

describe("the preference", () => {
  beforeEach(() => {
    store.clear();
    configureTollbooth({ slug: "excalibur", appName: "eXcalibur", mcpUrl: "/mcp" });
  });

  it("is kept under <prefix>:timezone", () => {
    assert.equal(timezoneStorageKey(), "excalibur:timezone");
    assert.equal(writeTimezonePref("Europe/Berlin"), "Europe/Berlin");
    assert.equal(store.get("excalibur:timezone"), "Europe/Berlin");
    assert.equal(readTimezonePref(), "Europe/Berlin");
    assert.equal(displayTimeZone(), "Europe/Berlin");
  });

  it("defaults to auto, which is the browser's zone", () => {
    assert.equal(readTimezonePref(), "auto");
    assert.equal(displayTimeZone(), detectBrowserTimeZone());
  });

  it("reads an invalid zone as auto, stored or asked for", () => {
    store.set("excalibur:timezone", "Mars/Olympus_Mons");
    assert.equal(readTimezonePref(), "auto");
    assert.equal(writeTimezonePref("+05:00"), "auto");
    assert.equal(store.get("excalibur:timezone"), "auto");
    assert.equal(normalizeTimezonePref(""), "auto");
    assert.equal(resolveTimeZone("Nowhere/Special"), detectBrowserTimeZone());
    assert.equal(isValidTimeZone("Asia/Tokyo"), true);
  });

  it("accepts any IANA zone, not only the listed cities", () => {
    assert.equal(writeTimezonePref("America/Boise"), "America/Boise");
  });

  it("tells every listener on the page when it changes", () => {
    const heard: string[] = [];
    const stop = onTimezoneChange((p) => heard.push(p));
    writeTimezonePref("Asia/Tokyo");
    writeTimezonePref("auto");
    stop();
    writeTimezonePref("UTC");
    assert.deepEqual(heard, ["Asia/Tokyo", "auto"]);
  });

  it("follows the site's storagePrefix", () => {
    configureTollbooth({ slug: "roastify", appName: "Roastify", mcpUrl: "/mcp", storagePrefix: "rf" });
    writeTimezonePref("UTC");
    assert.equal(store.get("rf:timezone"), "UTC");
  });
});
