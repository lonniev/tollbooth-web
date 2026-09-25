/**
 * The account-statement card: balance and lifetime totals, what the last N
 * days spent and bought, and the tools the sats went to.
 *
 * Mechanics only — the `account_statement` call, loading and error states and
 * the arithmetic (`usageFacts`). Every visual choice is the site's, through
 * `classNames`; `figures` picks which numbers show and in what order, `labels`
 * words them, and `renderRow` draws a tool row yourself (a display name for a
 * raw tool name, say). Refresh is a chip.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getAccountStatement } from "../standardTools.ts";
import { usageFacts, type ToolSpend, type UsageFacts } from "../usage.ts";

export type UsageFigure = "balance" | "deposited" | "consumed" | "expired" | "spent" | "calls" | "credited";

export interface UsageSummaryClassNames {
  root?: string;
  /** The heading row: title and the Refresh chip. */
  header?: string;
  heading?: string;
  chip?: string;
  figures?: string;
  figure?: string;
  value?: string;
  label?: string;
  /** The heading over the tools. */
  subheading?: string;
  list?: string;
  row?: string;
  tool?: string;
  calls?: string;
  sats?: string;
  loading?: string;
  error?: string;
  empty?: string;
}

export interface UsageSummaryProps {
  /** The period asked of the server. Default 30. */
  days?: number;
  /** Default "Last <days> days". */
  heading?: ReactNode;
  /** The numbers shown, in order. Default all; "expired" only when above zero. */
  figures?: readonly UsageFigure[];
  labels?: Partial<Record<UsageFigure, ReactNode>>;
  /** How many tools to list. 0 hides the list. Default 5. */
  topTools?: number;
  /** Default "Top tools". */
  toolsHeading?: ReactNode;
  /** Draw a tool row yourself. */
  renderRow?: (tool: ToolSpend) => ReactNode;
  /** Shown when the period has no paid calls. Default "No paid calls in this period." */
  empty?: ReactNode;
  /** Content of the Refresh chip; null for none. Default "Refresh". */
  refreshLabel?: ReactNode;
  classNames?: UsageSummaryClassNames;
}

const ALL: readonly UsageFigure[] = ["balance", "deposited", "consumed", "expired", "spent", "calls", "credited"];

const LABELS: Record<UsageFigure, string> = {
  balance: "Balance",
  deposited: "Deposited",
  consumed: "Consumed",
  expired: "Expired",
  spent: "Spent",
  calls: "Calls",
  credited: "Bought",
};

export default function UsageSummary({
  days = 30,
  heading,
  figures = ALL,
  labels = {},
  topTools = 5,
  toolsHeading = "Top tools",
  renderRow,
  empty = "No paid calls in this period.",
  refreshLabel = "Refresh",
  classNames: c = {},
}: UsageSummaryProps) {
  const [facts, setFacts] = useState<UsageFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stmt = await getAccountStatement(days);
      const f = usageFacts(stmt, days, topTools);
      if (f) setFacts(f);
      else setError(stmt.error ?? "No statement available.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days, topTools]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = facts ? figures.filter((f) => f !== "expired" || facts.expired > 0) : [];

  return (
    <section className={c.root}>
      <div className={c.header}>
        <div className={c.heading}>{heading ?? `Last ${days} days`}</div>
        {refreshLabel !== null && (
          <button type="button" onClick={() => void load()} disabled={loading} className={c.chip}>
            {loading ? "Loading…" : refreshLabel}
          </button>
        )}
      </div>

      {error ? (
        <p className={c.error}>{error}</p>
      ) : !facts ? (
        loading && <p className={c.loading}>Loading…</p>
      ) : (
        <>
          <div className={c.figures}>
            {shown.map((f) => (
              <div key={f} className={c.figure}>
                <div className={c.value}>{facts[f].toLocaleString()}</div>
                <div className={c.label}>{labels[f] ?? LABELS[f]}</div>
              </div>
            ))}
          </div>
          {topTools > 0 &&
            (facts.tools.length === 0 ? (
              empty && <p className={c.empty}>{empty}</p>
            ) : (
              <>
                {toolsHeading && <div className={c.subheading}>{toolsHeading}</div>}
                <ul className={c.list}>
                  {facts.tools.map((t) => (
                    <li key={t.tool} className={c.row}>
                      {renderRow ? (
                        renderRow(t)
                      ) : (
                        <>
                          <span className={c.tool}>{t.tool}</span>{" "}
                          <span className={c.calls}>
                            {t.calls.toLocaleString()} call{t.calls === 1 ? "" : "s"}
                          </span>{" "}
                          <span className={c.sats}>{t.sats.toLocaleString()} sats</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ))}
        </>
      )}
    </section>
  );
}
