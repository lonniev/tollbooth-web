import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountStatementResult } from "./standardTools.ts";
import { usageFacts } from "./usage.ts";

const stmt: AccountStatementResult = {
  success: true,
  generated_at: "2026-09-25T12:00:00+00:00",
  statement_period_days: 30,
  account_summary: {
    balance_api_sats: 740,
    total_deposited_api_sats: 2000,
    total_consumed_api_sats: 1200,
    total_expired_api_sats: 60,
  },
  purchase_history: [
    { invoice_id: "a", status: "Settled", amount_sats: 1000, api_sats_credited: 1000, created_at: "2026-09-20T10:00:00Z", settled_at: "2026-09-20T10:01:00Z" },
    { invoice_id: "b", status: "New", amount_sats: 500, api_sats_credited: 0, created_at: "2026-09-24T10:00:00Z" },
    { invoice_id: "c", status: "Settled", amount_sats: 1000, api_sats_credited: 1000, created_at: "2026-07-01T10:00:00Z", settled_at: "2026-07-01T10:01:00Z" },
  ],
  tool_usage_all_time: [{ tool: "post_tweet", calls: 90, api_sats: 900 }],
  daily_usage: [
    { date: "2026-09-25", total_calls: 3, total_api_sats: 30, tools: { post_tweet: { calls: 2, api_sats: 20 }, get_post: { calls: 1, api_sats: 10 } } },
    { date: "2026-09-10", total_calls: 5, total_api_sats: 25, tools: { get_post: { calls: 4, api_sats: 20 }, list_posts: { calls: 1, api_sats: 5 } } },
  ],
};

describe("usageFacts", () => {
  it("carries the account's totals", () => {
    const f = usageFacts(stmt, 30)!;
    assert.deepEqual([f.balance, f.deposited, f.consumed, f.expired, f.days], [740, 2000, 1200, 60, 30]);
  });

  it("sums the period from the daily log, not the all-time summary", () => {
    const f = usageFacts(stmt, 30)!;
    assert.equal(f.calls, 8);
    assert.equal(f.spent, 55);
  });

  it("counts only top-ups settled inside the period", () => {
    assert.equal(usageFacts(stmt, 30)!.credited, 1000);
  });

  it("ranks the period's tools by sats, capped", () => {
    const f = usageFacts(stmt, 30, 2)!;
    assert.deepEqual(f.tools, [
      { tool: "get_post", calls: 5, sats: 30 },
      { tool: "post_tweet", calls: 2, sats: 20 },
    ]);
    assert.equal(usageFacts(stmt, 30, 0)!.tools.length, 0);
  });

  it("is null for a statement with no summary (an error answer)", () => {
    assert.equal(usageFacts({ success: false, error: "proof is required" }, 30), null);
  });

  it("falls back to the asked-for period and an empty log", () => {
    const f = usageFacts({ account_summary: stmt.account_summary }, 7)!;
    assert.deepEqual([f.days, f.calls, f.spent, f.credited, f.tools.length], [7, 0, 0, 0, 0]);
  });
});
