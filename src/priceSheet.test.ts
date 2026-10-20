import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expiryPolicy, filterSheet, priceSheet, sheetPrice, toolTitle } from "./priceSheet.ts";
import type { PricingModelResult, ToolPrice } from "./standardTools.ts";

const tool = (over: Partial<ToolPrice> & { tool_name: string }): ToolPrice => ({
  tool_id: over.tool_name,
  price_sats: 0,
  category: "read",
  intent: "",
  priced: true,
  ...over,
});

const model: PricingModelResult = {
  status: "ok",
  name: "Good Earth — category pricing",
  tools: [
    tool({ tool_name: "goodearth_check_balance", category: "free", intent: "Check a patron's credit balance." }),
    tool({ tool_name: "goodearth_set_pricing_model", category: "restricted", intent: "Operator only." }),
    tool({ tool_name: "goodearth_frost_window", price_sats: 20, intent: "First-frost dates" }),
    tool({ tool_name: "goodearth_almanac", price_sats: 125, category: "heavy", intent: "Temperature and rain" }),
    tool({ tool_name: "goodearth_planting_window", price_sats: 20, intent: "When to start seed" }),
    tool({ tool_name: "goodearth_companions", price_sats: 5, intent: "Companions" }),
    tool({ tool_name: "goodearth_draft", price_sats: 9, priced: false }),
  ],
  tranche_lifetime: { target_usage_pct: 0.75, ttl_days: 30 },
  expiration: { state: "days", days: 30 },
};

describe("priceSheet", () => {
  const sheet = priceSheet(model, { slug: "goodearth" });

  it("bands paid tools cheapest first, each band by title", () => {
    assert.deepEqual(
      sheet.bands.map((b) => [b.price, b.tools.map((t) => t.name)]),
      [
        [{ kind: "flat", sats: 5 }, ["companions"]],
        [{ kind: "flat", sats: 20 }, ["frost_window", "planting_window"]],
        [{ kind: "flat", sats: 125 }, ["almanac"]],
      ],
    );
    assert.equal(sheet.paidCount, 4);
    assert.deepEqual(sheet.span, { low: 5, high: 125 });
  });

  it("puts zero-fare tools on the free list and leaves out operator-only and unpriced ones", () => {
    assert.deepEqual(sheet.free.map((t) => t.name), ["check_balance"]);
    const all = [...sheet.free, ...sheet.bands.flatMap((b) => b.tools)].map((t) => t.name);
    assert.ok(!all.includes("set_pricing_model"));
    assert.ok(!all.includes("draft"));
  });

  it("shows operator-only and unpriced tools when asked", () => {
    const s = priceSheet(model, { slug: "goodearth", restricted: true, unpriced: true });
    assert.ok(s.free.some((t) => t.name === "set_pricing_model"));
    assert.ok(s.bands.some((b) => b.tools.some((t) => t.name === "draft")));
  });

  it("names each tool without the slug, in words, and keeps the wire name", () => {
    const t = sheet.bands[1].tools[0];
    assert.equal(t.title, "Frost window");
    assert.equal(t.fullName, "goodearth_frost_window");
    assert.equal(t.intent, "First-frost dates");
  });

  it("keeps a tool name whole when it lacks the slug", () => {
    const s = priceSheet({ tools: [tool({ tool_name: "post_tweet", price_sats: 3 })] }, { slug: "excalibur" });
    assert.equal(s.bands[0].tools[0].name, "post_tweet");
  });

  it("is empty, not broken, for a model with no tools", () => {
    const s = priceSheet({ status: "ok", tools: null });
    assert.deepEqual(s.bands, []);
    assert.deepEqual(s.free, []);
    assert.equal(s.span, null);
    assert.deepEqual(s.expiry, { state: "unchosen" });
  });

  it("lists standing offers once each, and none aimed at named patrons", () => {
    const s = priceSheet({
      tools: [
        tool({
          tool_name: "x_post",
          price_sats: 4,
          chain: [
            { id: "1", type: "happy_hour" },
            { id: "2", type: "happy_hour" },
            { id: "3", type: "loyalty_discount", patron_npubs: ["npub1someone"] },
            { id: "4", type: "json_expression" },
            { id: "5", type: "free_trial" },
          ],
        }),
      ],
    });
    assert.deepEqual(s.bands[0].tools[0].offers.map((o) => o.label), ["Happy hour", "Free trial"]);
  });
});

describe("sheetPrice", () => {
  it("is the fixed fare, raised to its minimum", () => {
    assert.deepEqual(sheetPrice(tool({ tool_name: "a", price_sats: 3, min_cost: 5 })), { kind: "flat", sats: 5 });
  });

  it("spans a multiplier table, an unnamed value costing 1×", () => {
    const p = sheetPrice(
      tool({ tool_name: "a", price_sats: 10, multipliers: { difficulty: { easy: 1.5, hard: 4 }, mode: { live: 2 } } }),
    );
    assert.deepEqual(p, { kind: "range", from: 10, to: 80, by: ["difficulty", "mode"] });
  });

  it("rounds a discounting multiplier up, as the wheel does, and clamps to max_cost", () => {
    const p = sheetPrice(tool({ tool_name: "a", price_sats: 9, max_cost: 20, multipliers: { tier: { lite: 0.5, pro: 3 } } }));
    assert.deepEqual(p, { kind: "range", from: 5, to: 20, by: ["tier"] });
  });

  it("is flat when the table cannot move the fare", () => {
    assert.deepEqual(sheetPrice(tool({ tool_name: "a", price_sats: 7, multipliers: { m: { x: 1 } } })), { kind: "flat", sats: 7 });
  });

  it("names what a percent fare is a percent of", () => {
    const p = sheetPrice(tool({ tool_name: "a", price_sats: 2, price_type: "percent", price_formula: "amount_sats", min_cost: 10 }));
    assert.deepEqual(p, { kind: "percent", percent: 2, of: "amount_sats", min: 10, max: undefined });
  });

  it("bands percent fares after every fixed one", () => {
    const s = priceSheet({
      tools: [
        tool({ tool_name: "fee", price_sats: 2, price_type: "percent", price_formula: "amount_sats" }),
        tool({ tool_name: "big", price_sats: 500 }),
      ],
    });
    assert.deepEqual(s.bands.map((b) => b.price.kind), ["flat", "percent"]);
    assert.deepEqual(s.span, { low: 500, high: 500 });
  });
});

describe("expiryPolicy", () => {
  it("reads the wheel's named decision", () => {
    assert.deepEqual(expiryPolicy({ expiration: { state: "days", days: 30 } }), { state: "days", days: 30 });
    assert.deepEqual(expiryPolicy({ expiration: { state: "never" } }), { state: "never" });
    assert.deepEqual(expiryPolicy({ expiration: { state: "unchosen" } }), { state: "unchosen" });
  });

  it("falls back to tranche_lifetime on an older wheel, keeping never-decided apart from never", () => {
    assert.deepEqual(expiryPolicy({ tranche_lifetime: { target_usage_pct: 0.75, ttl_days: 7 } }), { state: "days", days: 7 });
    assert.deepEqual(expiryPolicy({ tranche_lifetime: { target_usage_pct: 0.75 } }), { state: "never" });
    assert.deepEqual(expiryPolicy({}), { state: "unchosen" });
  });
});

describe("filterSheet", () => {
  const sheet = priceSheet(model, { slug: "goodearth" });

  it("finds tools by title, wire name or intent and drops emptied bands", () => {
    const f = filterSheet(sheet, "seed");
    assert.deepEqual(f.bands.map((b) => b.tools.map((t) => t.name)), [["planting_window"]]);
    assert.deepEqual(filterSheet(sheet, "GOODEARTH_ALMANAC").bands.length, 1);
    assert.deepEqual(filterSheet(sheet, "balance").free.map((t) => t.name), ["check_balance"]);
  });

  it("returns the whole sheet for a blank search", () => {
    assert.equal(filterSheet(sheet, "  ").bands.length, sheet.bands.length);
  });
});

describe("toolTitle", () => {
  it("reads as words", () => {
    assert.equal(toolTitle("gdd_season_curve"), "Gdd season curve");
    assert.equal(toolTitle("almanac"), "Almanac");
  });
});
