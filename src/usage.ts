/**
 * An `account_statement` read as a usage card: the account's totals, what the
 * last N days spent and bought, and where the sats went. Framework-free, so it
 * is tested without React or a server.
 *
 * The union of what the fleet's "Last 30 days" cards showed — balance,
 * deposited, consumed (eXcalibur, cypher, Roastify), expired and per-tool
 * calls and sats (Optionality) — with the period figures taken from the
 * statement's own daily log rather than the all-time summary.
 */

import type { AccountStatementResult } from "./standardTools.ts";

export interface ToolSpend {
  tool: string;
  calls: number;
  sats: number;
}

export interface UsageFacts {
  /** The period the server reported on, in days. */
  days: number;
  balance: number;
  deposited: number;
  consumed: number;
  expired: number;
  /** Paid calls in the period. */
  calls: number;
  /** api_sats spent in the period. */
  spent: number;
  /** api_sats credited by top-ups settled in the period. */
  credited: number;
  /** The period's tools, most sats first, at most `topTools` of them. */
  tools: ToolSpend[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The facts a usage card shows, or null when the statement carries none. */
export function usageFacts(
  stmt: AccountStatementResult,
  days: number,
  topTools = 5,
): UsageFacts | null {
  const summary = stmt.account_summary;
  if (!summary) return null;
  const period = stmt.statement_period_days ?? days;

  let calls = 0;
  let spent = 0;
  const byTool = new Map<string, ToolSpend>();
  for (const day of stmt.daily_usage ?? []) {
    calls += day.total_calls;
    spent += day.total_api_sats;
    for (const [tool, u] of Object.entries(day.tools ?? {})) {
      const row = byTool.get(tool) ?? { tool, calls: 0, sats: 0 };
      row.calls += u.calls;
      row.sats += u.api_sats;
      byTool.set(tool, row);
    }
  }

  const end = Date.parse(stmt.generated_at ?? "");
  const since = (Number.isNaN(end) ? Date.now() : end) - period * DAY_MS;
  let credited = 0;
  for (const inv of stmt.purchase_history ?? []) {
    const at = Date.parse(inv.settled_at ?? "");
    if (!Number.isNaN(at) && at >= since) credited += inv.api_sats_credited;
  }

  const tools = [...byTool.values()]
    .sort((a, b) => b.sats - a.sats || b.calls - a.calls || a.tool.localeCompare(b.tool))
    .slice(0, Math.max(0, topTools));

  return {
    days: period,
    balance: summary.balance_api_sats,
    deposited: summary.total_deposited_api_sats,
    consumed: summary.total_consumed_api_sats,
    expired: summary.total_expired_api_sats,
    calls,
    spent,
    credited,
    tools,
  };
}
