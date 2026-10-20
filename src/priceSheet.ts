/**
 * The operator's price sheet, read from its live pricing model.
 *
 * Pure: `priceSheet` turns a `get_pricing_model` answer into what a patron
 * asks for — each tool with what it does and what it costs, grouped into
 * price bands, and how long a tranche of credit lasts. The arithmetic is the
 * wheel's own (`ToolPricing.compute`): a multiplier table makes a range, a
 * percent fare names what it is a percent of, and min/max cost clamp both.
 */

import type { PricingModelResult, ToolPrice } from "./standardTools.ts";

/** How long a tranche of api_sats lasts — or that the operator has not said. */
export type ExpiryPolicy = { state: "days"; days: number } | { state: "never" } | { state: "unchosen" };

export type SheetPrice =
  | { kind: "flat"; sats: number }
  /** A multiplier table on the call's own arguments: `from`–`to` sats, varying by `by`. */
  | { kind: "range"; from: number; to: number; by: string[] }
  /** Ad valorem: `percent` of the call's `of` argument, clamped to `min`/`max`. */
  | { kind: "percent"; percent: number; of: string; min?: number; max?: number };

/** A standing offer in a tool's constraint chain that any patron can meet. */
export interface SheetOffer {
  type: string;
  label: string;
}

export interface SheetTool {
  id: string;
  /** The tool's name without the operator's slug, e.g. "frost_window". */
  name: string;
  /** The name an MCP client shows, e.g. "goodearth_frost_window". */
  fullName: string;
  /** `name` in words: "Frost window". */
  title: string;
  /** What the tool is for, in the operator's words. */
  intent: string;
  price: SheetPrice;
  offers: SheetOffer[];
}

/** Tools that cost the same, cheapest band first. */
export interface PriceBand {
  key: string;
  price: SheetPrice;
  tools: SheetTool[];
}

export interface PriceSheet {
  /** The pricing model's name. */
  name: string | null;
  bands: PriceBand[];
  free: SheetTool[];
  expiry: ExpiryPolicy;
  paidCount: number;
  /** The cheapest and dearest fixed fare in sats, for a "1–125 sats" line; null with no paid tool. */
  span: { low: number; high: number } | null;
}

export interface PriceSheetOptions {
  /** The operator's tool-name prefix, stripped from each name. */
  slug?: string;
  /** Include operator-only tools, which a patron cannot call. Default false. */
  restricted?: boolean;
  /** Include tools the operator has not priced yet. Default false. */
  unpriced?: boolean;
}

/** The patron-facing name of each constraint a patron can meet, per Pricing Studio. */
export const OFFER_LABELS: Readonly<Record<string, string>> = {
  free_trial: "Free trial",
  loyalty_discount: "Loyalty discount",
  bulk_bonus: "Bulk bonus",
  happy_hour: "Happy hour",
  surge_pricing: "Surge pricing",
  temporal_window: "Limited time",
  finite_supply: "Limited supply",
  periodic_refresh: "Periodic allowance",
  coupon: "Coupon",
};

export function expiryPolicy(model: PricingModelResult): ExpiryPolicy {
  const e = model.expiration;
  if (e?.state === "days" && typeof e.days === "number") return { state: "days", days: e.days };
  if (e?.state === "never") return { state: "never" };
  if (e?.state === "unchosen") return { state: "unchosen" };
  // A wheel older than `expiration`: the same three cases, from tranche_lifetime.
  const t = model.tranche_lifetime;
  if (!t) return { state: "unchosen" };
  return typeof t.ttl_days === "number" ? { state: "days", days: t.ttl_days } : { state: "never" };
}

export function toolTitle(name: string): string {
  const words = name.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shortName(toolName: string, slug?: string): string {
  return slug && toolName.startsWith(`${slug}_`) ? toolName.slice(slug.length + 1) : toolName;
}

function multiplierSpan(multipliers: ToolPrice["multipliers"]): { low: number; high: number; by: string[] } | null {
  if (!multipliers || typeof multipliers !== "object") return null;
  let low = 1;
  let high = 1;
  const by: string[] = [];
  for (const [param, lookup] of Object.entries(multipliers)) {
    if (!lookup || typeof lookup !== "object") continue;
    const values = Object.values(lookup as Record<string, unknown>).filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v),
    );
    if (values.length === 0) continue;
    // A value the table does not name costs 1×, so 1 is always in reach.
    low *= Math.min(1, ...values);
    high *= Math.max(1, ...values);
    by.push(param);
  }
  return by.length ? { low, high, by } : null;
}

export function sheetPrice(t: ToolPrice): SheetPrice {
  const min = t.min_cost && t.min_cost > 0 ? t.min_cost : undefined;
  const max = typeof t.max_cost === "number" ? t.max_cost : undefined;
  if (t.price_type === "percent") {
    return { kind: "percent", percent: t.price_sats, of: typeof t.price_formula === "string" ? t.price_formula : "", min, max };
  }
  const base = Math.max(t.price_sats, min ?? 0);
  const clamp = (n: number) => (max === undefined ? n : Math.min(n, max));
  const span = multiplierSpan(t.multipliers);
  if (span) {
    const from = clamp(Math.ceil(base * span.low));
    const to = clamp(Math.ceil(base * span.high));
    if (from !== to) return { kind: "range", from, to, by: span.by };
    return { kind: "flat", sats: from };
  }
  return { kind: "flat", sats: clamp(base) };
}

function offers(t: ToolPrice): SheetOffer[] {
  const seen = new Set<string>();
  const out: SheetOffer[] = [];
  for (const step of t.chain ?? []) {
    // A step aimed at named patrons is theirs, not a standing offer.
    if (step.patron_npubs && step.patron_npubs.length > 0) continue;
    const label = OFFER_LABELS[step.type];
    if (!label || seen.has(step.type)) continue;
    seen.add(step.type);
    out.push({ type: step.type, label });
  }
  return out;
}

function bandKey(p: SheetPrice): string {
  switch (p.kind) {
    case "flat":
      return `flat:${p.sats}`;
    case "range":
      return `range:${p.from}-${p.to}`;
    case "percent":
      return `percent:${p.percent}:${p.of}:${p.min ?? ""}:${p.max ?? ""}`;
  }
}

/** Where a band sorts: fixed fares by their lowest sats, percent fares last. */
function bandOrder(p: SheetPrice): [number, number] {
  switch (p.kind) {
    case "flat":
      return [0, p.sats];
    case "range":
      return [0, p.from];
    case "percent":
      return [1, p.percent];
  }
}

export function priceSheet(model: PricingModelResult, opts: PriceSheetOptions = {}): PriceSheet {
  const bands = new Map<string, PriceBand>();
  const free: SheetTool[] = [];
  for (const t of model.tools ?? []) {
    if (!t || typeof t.tool_name !== "string") continue;
    if (t.category === "restricted" && !opts.restricted) continue;
    if (!t.priced && !opts.unpriced) continue;
    const name = shortName(t.tool_name, opts.slug);
    const tool: SheetTool = {
      id: t.tool_id,
      name,
      fullName: t.tool_name,
      title: toolTitle(name),
      intent: typeof t.intent === "string" ? t.intent.trim() : "",
      price: sheetPrice(t),
      offers: offers(t),
    };
    if (tool.price.kind === "flat" && tool.price.sats <= 0) {
      free.push(tool);
      continue;
    }
    const key = bandKey(tool.price);
    const band = bands.get(key) ?? { key, price: tool.price, tools: [] };
    band.tools.push(tool);
    bands.set(key, band);
  }

  const byTitle = (a: SheetTool, b: SheetTool) => a.title.localeCompare(b.title);
  const sorted = [...bands.values()].sort((a, b) => {
    const [ka, va] = bandOrder(a.price);
    const [kb, vb] = bandOrder(b.price);
    return ka - kb || va - vb || a.key.localeCompare(b.key);
  });
  for (const b of sorted) b.tools.sort(byTitle);
  free.sort(byTitle);

  const fixed = sorted.flatMap((b) =>
    b.price.kind === "flat" ? [b.price.sats] : b.price.kind === "range" ? [b.price.from, b.price.to] : [],
  );
  return {
    name: model.name ?? null,
    bands: sorted,
    free,
    expiry: expiryPolicy(model),
    paidCount: sorted.reduce((n, b) => n + b.tools.length, 0),
    span: fixed.length ? { low: Math.min(...fixed), high: Math.max(...fixed) } : null,
  };
}

/** Whether a tool answers a search: its title, name or intent, case-insensitive. */
export function toolMatches(tool: SheetTool, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [tool.title, tool.fullName, tool.intent].some((s) => s.toLowerCase().includes(q));
}

/** Narrow a sheet to the tools a search finds; a band with none left drops out. */
export function filterSheet(sheet: PriceSheet, query: string): Pick<PriceSheet, "bands" | "free"> {
  if (!query.trim()) return sheet;
  return {
    bands: sheet.bands
      .map((b) => ({ ...b, tools: b.tools.filter((t) => toolMatches(t, query)) }))
      .filter((b) => b.tools.length > 0),
    free: sheet.free.filter((t) => toolMatches(t, query)),
  };
}
