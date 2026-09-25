/**
 * The patron's whole account at this operator: balance, a Lightning top-up,
 * credit tranches, the statement and coupons.
 *
 * Mechanics only. The package makes the calls (check_balance,
 * purchase_credits → check_payment, account_statement, the coupon tools),
 * holds the states and writes the words; every visual choice belongs to the
 * site, through `classNames` — with none it is plain markup that inherits from
 * the page. Actions are chips (`classNames.chip`); the one that moves a top-up
 * forward may keep an accent (`classNames.primary`). A preset amount only fills
 * the amount — the invoice is made by "Create invoice". Anything only one site has
 * (a funding-health panel, an operator view) goes in `before` or `children`.
 *
 * A balance nobody has read is a dash, never 0: showing 0 to someone with
 * funds sends them to buy credits they already own.
 */

import { useCallback, useEffect, useReducer, useState, type ReactNode } from "react";
import {
  checkBalance,
  getAccountStatement,
  type AccountStatementResult,
  type CheckBalanceResult,
  type CreditTranche,
} from "../standardTools.ts";
import { amountReducer, formatSats, parseSats, presetChosen } from "../wallet.ts";
import CouponsPanel, { type CouponsPanelProps } from "./CouponsPanel.tsx";
import { useTopUp, type UseTopUpOptions } from "./useTopUp.ts";

export interface WalletPageClassNames {
  root?: string;
  heading?: string;
  /** Each block: balance, top-up, tranches, statement. */
  section?: string;
  sectionTitle?: string;
  /** The balance figure and its unit. */
  figure?: string;
  unit?: string;
  /** The deposited · consumed · expired · tranches line, and each item in it. */
  stats?: string;
  stat?: string;
  /** A heads-up: a stale ledger, pending invoices, credit about to expire. */
  notice?: string;
  error?: string;
  /** Every action. */
  chip?: string;
  /**
   * The action that moves a top-up forward — "Create invoice", then "Open
   * checkout" — in place of `chip`, for a site that gives it its accent.
   * Default: `chip`.
   */
  primary?: string;
  /** Added to a chip that is the current choice (the chosen preset). */
  chipActive?: string;
  /** A row of chips. */
  chips?: string;
  input?: string;
  /** The open invoice's box, and its BOLT11 string. */
  invoice?: string;
  bolt11?: string;
  /** The line saying where a payment stands. */
  status?: string;
  list?: string;
  row?: string;
}

export interface WalletPageProps {
  /** The page heading. Default "Wallet"; null for none. */
  heading?: ReactNode;
  /** Preset amounts, in sats, offered as chips. A tap fills the amount; it does not invoice. */
  topUps?: number[];
  /** Offer a box for any amount. Default true. */
  customAmount?: boolean;
  /** Polling for an open invoice (see `useTopUp`). */
  poll?: Pick<UseTopUpOptions, "pollMs" | "maxChecks">;
  /** Show the coupons panel, optionally with its own props. Default true. */
  coupons?: boolean | CouponsPanelProps;
  /** Offer the statement (loaded on request). Default true. */
  statement?: boolean;
  /** How a date and a date-time are written — pass the site's time-zone formatter. */
  formatDate?: (iso: string) => string;
  formatDateTime?: (iso: string) => string;
  /** Site content above the balance, e.g. a funding-health panel. */
  before?: ReactNode;
  /** Site content at the end. */
  children?: ReactNode;
  classNames?: WalletPageClassNames;
}

const DEFAULT_TOP_UPS = [1_000, 5_000, 25_000];

const localDate = (iso: string) => new Date(iso).toLocaleDateString();
const localDateTime = (iso: string) => new Date(iso).toLocaleString();

function cx(...parts: (string | false | undefined)[]): string | undefined {
  const s = parts.filter(Boolean).join(" ");
  return s || undefined;
}

export default function WalletPage({
  heading = "Wallet",
  topUps = DEFAULT_TOP_UPS,
  customAmount = true,
  poll,
  coupons = true,
  statement = true,
  formatDate = localDate,
  formatDateTime = localDateTime,
  before,
  children,
  classNames: c = {},
}: WalletPageProps) {
  const [bal, setBal] = useState<CheckBalanceResult | null>(null);
  const [balError, setBalError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await checkBalance();
      if (r.error) setBalError(r.error);
      else {
        setBal(r);
        setBalError(null);
      }
    } catch (e) {
      setBalError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const couponProps = typeof coupons === "object" ? coupons : {};

  return (
    <div className={c.root}>
      {heading && <h1 className={c.heading}>{heading}</h1>}
      {before}

      <Balance bal={bal} error={balError} refresh={refresh} formatDateTime={formatDateTime} c={c} />
      <TopUpSection topUps={topUps} customAmount={customAmount} poll={poll} onSettled={refresh} c={c} />
      {bal?.tranches && bal.tranches.length > 0 && (
        <Tranches tranches={bal.tranches} formatDate={formatDate} c={c} />
      )}
      {statement && <Statement formatDate={formatDate} c={c} />}
      {coupons !== false && <CouponsPanel {...couponProps} />}

      {children}
    </div>
  );
}

function Balance({
  bal,
  error,
  refresh,
  formatDateTime,
  c,
}: {
  bal: CheckBalanceResult | null;
  error: string | null;
  refresh: () => Promise<void>;
  formatDateTime: (iso: string) => string;
  c: WalletPageClassNames;
}) {
  const pending = bal?.pending_invoices ?? 0;
  const expiring = bal?.expiring_within_24h_sats ?? 0;
  return (
    <section className={c.section}>
      <div className={c.sectionTitle}>Balance</div>
      <div>
        <span className={c.figure}>{formatSats(error ? null : bal?.balance_api_sats)}</span>{" "}
        <span className={c.unit}>sats</span>
      </div>
      {bal && !error && (
        <div className={c.stats}>
          <span className={c.stat}>deposited {formatSats(bal.total_deposited_api_sats)}</span>{" "}
          <span className={c.stat}>consumed {formatSats(bal.total_consumed_api_sats)}</span>{" "}
          {!!bal.total_expired_api_sats && (
            <>
              <span className={c.stat}>expired {formatSats(bal.total_expired_api_sats)}</span>{" "}
            </>
          )}
          <span className={c.stat}>
            {bal.active_tranches ?? 0} active tranche{bal.active_tranches === 1 ? "" : "s"}
          </span>
        </div>
      )}
      {error && <p className={c.error}>The balance could not be read: {error}</p>}
      {bal?.vault_unavailable && (
        <p className={c.notice}>{bal.warning ?? "The ledger is not available yet — the balance may be stale."}</p>
      )}
      {pending > 0 && (
        <p className={c.notice}>
          {pending} invoice{pending === 1 ? "" : "s"} awaiting payment
        </p>
      )}
      {expiring > 0 && <p className={c.notice}>{formatSats(expiring)} sats expire within 24 hours</p>}
      {bal?.next_expiration_iso && (
        <p className={c.notice}>next expiry {formatDateTime(bal.next_expiration_iso)}</p>
      )}
      <div className={c.chips}>
        <button type="button" onClick={() => void refresh()} className={c.chip}>
          Refresh
        </button>
      </div>
    </section>
  );
}

function TopUpSection({
  topUps,
  customAmount,
  poll,
  onSettled,
  c,
}: {
  topUps: number[];
  customAmount: boolean;
  poll?: Pick<UseTopUpOptions, "pollMs" | "maxChecks">;
  onSettled: () => void;
  c: WalletPageClassNames;
}) {
  const { state, create, check, cancel, reset } = useTopUp({ ...poll, onSettled });
  const [amount, pick] = useReducer(amountReducer, "");
  const [copied, setCopied] = useState(false);
  const sats = parseSats(amount);
  const creating = state.phase === "creating";
  const primary = c.primary ?? c.chip;

  function confirm() {
    if (sats && !creating) create(sats);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the string is on screen and selectable */
    }
  }

  return (
    <section className={c.section}>
      <div className={c.sectionTitle}>Top up with Lightning</div>

      {(state.phase === "idle" || state.phase === "creating") && (
        <>
          <div className={c.chips}>
            {topUps.map((n) => (
              <button
                key={n}
                type="button"
                disabled={creating}
                aria-pressed={presetChosen(amount, n)}
                onClick={() => pick({ type: "preset", sats: n })}
                className={cx(c.chip, presetChosen(amount, n) && c.chipActive)}
              >
                {n.toLocaleString("en-US")} sats
              </button>
            ))}
          </div>
          <div className={c.chips}>
            {customAmount && (
              <input
                inputMode="numeric"
                value={amount}
                disabled={creating}
                onChange={(e) => pick({ type: "typed", text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
                placeholder="Any amount"
                aria-label="Amount in sats"
                className={c.input}
              />
            )}
            <button type="button" disabled={creating || !sats} onClick={confirm} className={primary}>
              Create invoice
            </button>
          </div>
          {creating && <p className={c.status}>Making a Lightning invoice…</p>}
          {state.phase === "idle" && state.message && <p className={c.error}>{state.message}</p>}
        </>
      )}

      {state.phase === "awaiting" && (
        <div className={c.invoice}>
          <p className={c.status}>Invoice for {formatSats(state.invoice.sats)} sats</p>
          {state.invoice.bolt11 && <div className={c.bolt11}>{state.invoice.bolt11}</div>}
          <div className={c.chips}>
            {state.invoice.checkoutLink && (
              <a href={state.invoice.checkoutLink} target="_blank" rel="noreferrer" className={primary}>
                Open checkout
              </a>
            )}
            {state.invoice.bolt11 && (
              <button type="button" onClick={() => void copy(state.invoice.bolt11!)} className={c.chip}>
                {copied ? "Copied" : "Copy invoice"}
              </button>
            )}
            <button type="button" disabled={state.checking} onClick={check} className={c.chip}>
              {state.checking ? "Checking…" : "I've paid — check"}
            </button>
            <button type="button" onClick={cancel} className={c.chip}>
              Cancel
            </button>
          </div>
          <p className={c.status} aria-live="polite">
            {state.status ?? "Waiting for payment."}
          </p>
        </div>
      )}

      {state.phase === "settled" && (
        <>
          <p className={c.status} aria-live="polite">
            Paid. {formatSats(state.credited)} sats added.
          </p>
          <div className={c.chips}>
            <button
              type="button"
              onClick={() => {
                pick({ type: "clear" });
                reset();
              }}
              className={c.chip}
            >
              Done
            </button>
          </div>
        </>
      )}

      {state.phase === "failed" && (
        <>
          <p className={c.error}>{state.message}</p>
          <div className={c.chips}>
            <button type="button" onClick={reset} className={c.chip}>
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Tranches({
  tranches,
  formatDate,
  c,
}: {
  tranches: CreditTranche[];
  formatDate: (iso: string) => string;
  c: WalletPageClassNames;
}) {
  return (
    <section className={c.section}>
      <div className={c.sectionTitle}>Credit tranches</div>
      <ul className={c.list}>
        {tranches.map((t) => (
          <li key={t.id} className={c.row}>
            <span>
              {formatSats(t.remaining_sats)} / {formatSats(t.amount_sats)} sats
            </span>{" "}
            <span>{t.expires_at ? `expires ${formatDate(t.expires_at)}` : "no expiry"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Statement({ formatDate, c }: { formatDate: (iso: string) => string; c: WalletPageClassNames }) {
  const [stmt, setStmt] = useState<AccountStatementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getAccountStatement(30);
      if (r.error) setError(r.error);
      else setStmt(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const purchases = stmt?.purchase_history ?? [];
  const usage = stmt?.tool_usage_all_time ?? [];

  return (
    <section className={c.section}>
      <div className={c.sectionTitle}>Statement</div>
      <div className={c.chips}>
        <button type="button" disabled={loading} onClick={() => void load()} className={c.chip}>
          {loading ? "Loading…" : stmt ? "Refresh statement" : "Load statement"}
        </button>
      </div>
      {error && <p className={c.error}>{error}</p>}
      {stmt && (
        <>
          <div className={c.sectionTitle}>Purchases</div>
          {purchases.length === 0 ? (
            <p className={c.status}>No purchases yet.</p>
          ) : (
            <ul className={c.list}>
              {purchases.map((p) => (
                <li key={p.invoice_id} className={c.row}>
                  <span>{p.created_at ? formatDate(p.created_at) : "—"}</span>{" "}
                  <span>{formatSats(p.amount_sats)} sats</span>{" "}
                  <span>
                    {p.status}
                    {p.api_sats_credited ? ` · ${formatSats(p.api_sats_credited)} credited` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={c.sectionTitle}>Usage</div>
          {usage.length === 0 ? (
            <p className={c.status}>No paid calls yet.</p>
          ) : (
            <ul className={c.list}>
              {usage.map((u) => (
                <li key={u.tool} className={c.row}>
                  <span>{u.tool}</span>{" "}
                  <span>
                    {u.calls.toLocaleString("en-US")} call{u.calls === 1 ? "" : "s"} · {formatSats(u.api_sats)} sats
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
