/**
 * The patron's display time zone, and the conversions every clock on a page
 * needs. Storage stays UTC; this converts at the edges — rendering an instant,
 * reading an <input type="datetime-local">, turning a day filter into bounds.
 *
 * The preference is "auto" (the browser's own zone) or an IANA name, kept under
 * `<prefix>:timezone`. Never a fixed offset: an offset is right for half the
 * year. A stored name the browser does not know reads as "auto".
 *
 * Pure apart from the preference's storage, so it is tested without a browser.
 * Lifted from eXcalibur's `lib/timezone.ts` (roastify held a copy).
 */

import { readStored, writeStored, key } from "./storage.ts";

export type TimezonePref = "auto" | (string & {});

const PREF = "timezone";

/** A starter set of major cities, west to east, plus UTC. Values are IANA names. */
export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Pacific/Honolulu", label: "Honolulu" },
  { value: "America/Anchorage", label: "Anchorage" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "America/Denver", label: "Denver" },
  { value: "America/Chicago", label: "Chicago" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Athens", label: "Athens" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "Mumbai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
  { value: "UTC", label: "UTC" },
];

// ── The zone itself ─────────────────────────────────────────────────────────

/** The browser's own zone, or UTC when it will not say. */
export function detectBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    /* an engine without time-zone data */
  }
  return "UTC";
}

/** True when `tz` is a zone name this browser knows. An offset ("+05:00") is not. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || /^[+-]/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "auto", or the name when the browser knows it; anything else is "auto". */
export function normalizeTimezonePref(pref: string | null | undefined): TimezonePref {
  return pref && pref !== "auto" && isValidTimeZone(pref) ? pref : "auto";
}

/** The IANA zone a preference means right now. */
export function resolveTimeZone(pref: TimezonePref): string {
  const p = normalizeTimezonePref(pref);
  return p === "auto" ? detectBrowserTimeZone() : p;
}

// ── The preference, stored ─────────────────────────────────────────────────

/** `<prefix>:timezone` — for a `storage` event listener. */
export function timezoneStorageKey(): string {
  return key(PREF);
}

export function readTimezonePref(): TimezonePref {
  return normalizeTimezonePref(readStored(PREF));
}

const listeners = new Set<(pref: TimezonePref) => void>();

/** Store the preference (normalized) and tell every listener on the page. */
export function writeTimezonePref(next: string): TimezonePref {
  const value = normalizeTimezonePref(next);
  writeStored(PREF, value);
  listeners.forEach((fn) => fn(value));
  return value;
}

/** Hear every `writeTimezonePref` on this page. Returns an unsubscribe. */
export function onTimezoneChange(fn: (pref: TimezonePref) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The zone every clock should use: the stored preference, resolved. */
export function displayTimeZone(): string {
  return resolveTimeZone(readTimezonePref());
}

// ── Wall-clock parts in a zone ──────────────────────────────────────────────

export interface ZonedParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  second: number;
}

const partsFormats = new Map<string, Intl.DateTimeFormat>();

function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormats.set(timeZone, f);
  }
  return f;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** The calendar and clock of an instant as seen in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFormat(timeZone).formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = Number(map.hour ?? "0");
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hour === 24 ? 0 : hour, // some engines still say 24 at midnight
    minute: Number(map.minute ?? "0"),
    second: Number(map.second ?? "0"),
  };
}

/** The zone's offset from UTC at an instant, in ms (New York in winter: −5 h). */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const t = date.getTime();
  const whole = t - (((t % 1000) + 1000) % 1000); // the parts carry no milliseconds
  const p = getZonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A wall time in `timeZone` as a UTC instant (epoch ms).
 *
 * Around a DST change a wall time can be missing or doubled. A missing one
 * (02:30 on New York's spring-forward day) is read with the offset from before
 * the change, so it lands an hour later (03:30); a doubled one (01:30 on the
 * fall-back day) is the earlier of the two. Temporal calls this "compatible".
 */
export function zonedWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const before = getTimeZoneOffsetMs(new Date(wall - DAY_MS), timeZone);
  const after = getTimeZoneOffsetMs(new Date(wall + DAY_MS), timeZone);
  const fits = [wall - before, wall - after].filter(
    (t) => getTimeZoneOffsetMs(new Date(t), timeZone) === wall - t,
  );
  return fits.length ? Math.min(...fits) : wall - before;
}

// ── Rendering an instant ────────────────────────────────────────────────────

function render(
  iso: string | null | undefined,
  draw: (d: Date) => string,
): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? String(iso) : draw(new Date(t));
}

export function formatDateTime(
  iso: string | null | undefined,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return render(iso, (d) => d.toLocaleString(undefined, { timeZone, ...opts }));
}

export function formatDate(
  iso: string | null | undefined,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return render(iso, (d) => d.toLocaleDateString(undefined, { timeZone, ...opts }));
}

export function formatTime(
  iso: string | null | undefined,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return render(iso, (d) => d.toLocaleTimeString(undefined, { timeZone, ...opts }));
}

/** An hour of the day (0–23) as the patron's locale writes it: "9 AM", "21". */
export function formatHourLabel(hour: number, timeZone: string): string {
  // A fixed winter date, so only the hour matters.
  const utc = zonedWallTimeToUtcMs(2024, 1, 15, hour, 0, 0, timeZone);
  return new Date(utc).toLocaleTimeString(undefined, { timeZone, hour: "numeric" });
}

/** The hour (0–23) of an instant in `timeZone`, or null for a bad instant. */
export function hourInZone(iso: string, timeZone: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : getZonedParts(new Date(t), timeZone).hour;
}

// ── <input type="datetime-local"> ↔ ISO ─────────────────────────────────────

/** A UTC instant → the value for a datetime-local input showing `timeZone`. */
export function isoToDatetimeLocalValue(iso: string, timeZone: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const p = getZonedParts(new Date(t), timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** A datetime-local value, read as a wall time in `timeZone` → UTC ISO. */
export function datetimeLocalValueToIso(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const ms = zonedWallTimeToUtcMs(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
    timeZone,
  );
  return new Date(ms).toISOString();
}

// ── A day filter's bounds (YYYY-MM-DD in the zone → UTC ISO) ────────────────

function ymd(value: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The patron's midnight starting `day`, as UTC ISO (an inclusive lower bound). */
export function startOfLocalDayIso(day: string, timeZone: string): string | null {
  const d = ymd(day);
  return d ? new Date(zonedWallTimeToUtcMs(d[0], d[1], d[2], 0, 0, 0, timeZone)).toISOString() : null;
}

/** The patron's midnight after `day`, as UTC ISO (an exclusive upper bound). */
export function startOfNextLocalDayIso(day: string, timeZone: string): string | null {
  const d = ymd(day);
  if (!d) return null;
  // The next calendar day, counted on UTC noon so no zone can move it.
  const next = new Date(Date.UTC(d[0], d[1] - 1, d[2], 12) + DAY_MS);
  const ms = zonedWallTimeToUtcMs(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0, timeZone);
  return new Date(ms).toISOString();
}

/**
 * A from/to day filter as the instants a server can compare: from the patron's
 * midnight starting `dateFrom` up to (not including) the one after `dateTo`.
 * An empty or malformed day is left out.
 */
export function localDateFilterBounds(
  dateFrom: string,
  dateTo: string,
  timeZone: string,
): { dateFrom?: string; dateTo?: string } {
  const out: { dateFrom?: string; dateTo?: string } = {};
  const from = dateFrom ? startOfLocalDayIso(dateFrom, timeZone) : null;
  const to = dateTo ? startOfNextLocalDayIso(dateTo, timeZone) : null;
  if (from) out.dateFrom = from;
  if (to) out.dateTo = to;
  return out;
}
