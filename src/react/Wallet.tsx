/**
 * The patron's wallet at this operator: one layout, one scope and one behavior on
 * every Tollbooth DPYC™ site. It is the brand, so it has no layout props. A site
 * says where it goes, restyles it through the variables in `wallet.css`, and may
 * name and mark the amount tiles (`decorateTile`).
 *
 * A balance nobody has read is a dash, never 0: showing 0 to someone with funds
 * sends them to buy credits they already own.
 */

import { useCallback, useEffect, useReducer, useState, type ReactNode } from "react";
import { formatDate, formatDateTime } from "../timezone.ts";
import {
  checkBalance,
  getAccountStatement,
  type AccountStatementResult,
  type CheckBalanceResult,
  type CreditTranche,
} from "../standardTools.ts";
import { TOP_UP_AMOUNTS, amountReducer, awaitingWords, formatSats, parseSats, payLink, presetChosen } from "../wallet.ts";
import CouponsPanel from "./CouponsPanel.tsx";
import InvoiceQr, { PAY_FROM_CASH_LINE } from "./InvoiceQr.tsx";
import { useTimezone } from "./useTimezone.ts";
import { useTopUp } from "./useTopUp.ts";
import WalletChooser from "./WalletChooser.tsx";

export interface TileDecoration {
  /** A name above the amount, e.g. "Seed Packet". */
  name?: string;
  /** A small glyph on the tile. */
  mark?: ReactNode;
}

export type DecorateTile = (sats: number) => TileDecoration | undefined;

function Balance({ bal, error, refresh }: { bal: CheckBalanceResult | null; error: string | null; refresh: () => Promise<void> }) {
  const [, zone] = useTimezone();
  const pending = bal?.pending_invoices ?? 0;
  const expiring = bal?.expiring_within_24h_sats ?? 0;
  return (
    <section className="tb-wallet-section tb-wallet-balance">
      <h2 className="tb-wallet-title">Balance</h2>
      <div>
        <span className="tb-wallet-figure">{formatSats(error ? null : bal?.balance_api_sats)}</span>{" "}
        <span className="tb-wallet-note">sats</span>
      </div>
      {bal && !error && (
        <div className="tb-wallet-stats">
          <span>deposited {formatSats(bal.total_deposited_api_sats)}</span>
          <span>consumed {formatSats(bal.total_consumed_api_sats)}</span>
          {!!bal.total_expired_api_sats && <span>expired {formatSats(bal.total_expired_api_sats)}</span>}
          <span>
            {bal.active_tranches ?? 0} active tranche{bal.active_tranches === 1 ? "" : "s"}
          </span>
        </div>
      )}
      {error && <p className="tb-wallet-error">The balance could not be read: {error}</p>}
      {bal?.vault_unavailable && (
        <p className="tb-wallet-note">{bal.warning ?? "The ledger is not available yet — the balance may be stale."}</p>
      )}
      {pending > 0 && <p className="tb-wallet-note">{pending} invoice{pending === 1 ? "" : "s"} awaiting payment</p>}
      {expiring > 0 && <p className="tb-wallet-note">{formatSats(expiring)} sats expire within 24 hours</p>}
      {bal?.next_expiration_iso && <p className="tb-wallet-note">next expiry {formatDateTime(bal.next_expiration_iso, zone)}</p>}
      <div className="tb-wallet-row">
        <button type="button" onClick={() => void refresh()} className="tb-wallet-action">Refresh</button>
      </div>
    </section>
  );
}

function TopUp({ onSettled, decorateTile }: { onSettled: () => void; decorateTile?: DecorateTile }) {
  const { state, watching, create, check, cancel, reset } = useTopUp({ onSettled });
  const [amount, pick] = useReducer(amountReducer, "");
  const [custom, setCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const sats = parseSats(amount);
  const creating = state.phase === "creating";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the string is on screen and selectable */
    }
  }

  function again() {
    pick({ type: "clear" });
    setCustom(false);
    reset();
  }

  return (
    <section className="tb-wallet-section tb-wallet-topup">
      <h2 className="tb-wallet-title">Top up with Lightning</h2>

      {(state.phase === "idle" || creating) && (
        <>
          <div className="tb-wallet-tiles">
            {TOP_UP_AMOUNTS.map((n) => {
              const look = decorateTile?.(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={creating}
                  aria-pressed={!custom && presetChosen(amount, n)}
                  onClick={() => {
                    setCustom(false);
                    pick({ type: "preset", sats: n });
                  }}
                  className="tb-wallet-tile"
                >
                  {look?.mark && <span className="tb-wallet-tile-mark">{look.mark}</span>}
                  <span className="tb-wallet-tile-body">
                    {look?.name && <span className="tb-wallet-tile-name">{look.name}</span>}
                    <span className="tb-wallet-tile-sats">{n.toLocaleString("en-US")}</span>
                    <span className="tb-wallet-tile-unit">sats</span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={creating}
              aria-pressed={custom}
              onClick={() => {
                setCustom(true);
                pick({ type: "clear" });
              }}
              className="tb-wallet-tile"
            >
              <span className="tb-wallet-tile-body">
                <span className="tb-wallet-tile-sats">Custom</span>
                <span className="tb-wallet-tile-unit">amount</span>
              </span>
            </button>
          </div>
          {custom && (
            <input
              inputMode="numeric"
              value={amount}
              disabled={creating}
              autoFocus
              onChange={(e) => pick({ type: "typed", text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sats && !creating) create(sats);
              }}
              placeholder="Amount in sats"
              aria-label="Amount in sats"
              className="tb-wallet-input tb-wallet-custom"
            />
          )}
          <button
            type="button"
            disabled={creating || !sats}
            onClick={() => sats && create(sats)}
            className="tb-wallet-action tb-wallet-primary tb-wallet-create"
          >
            Create invoice
          </button>
          {creating && <p className="tb-wallet-note">Making a Lightning invoice…</p>}
          {state.phase === "idle" && state.message && <p className="tb-wallet-error">{state.message}</p>}
          <WalletChooser />
        </>
      )}

      {state.phase === "awaiting" && (
        <div className="tb-wallet-invoice">
          <p className="tb-wallet-note">Invoice for {formatSats(state.invoice.sats)} sats</p>
          <InvoiceQr bolt11={state.invoice.bolt11} className="tb-wallet-qr" />
          <div className="tb-wallet-row">
            {state.invoice.bolt11 && (
              <a href={payLink(state.invoice) ?? "#"} className="tb-wallet-action tb-wallet-primary">Open in wallet</a>
            )}
            {state.invoice.bolt11 && (
              <button type="button" onClick={() => void copy(state.invoice.bolt11!)} className="tb-wallet-action">
                {copied ? "Copied" : "Copy invoice"}
              </button>
            )}
            {state.invoice.checkoutLink && (
              <a
                href={state.invoice.checkoutLink}
                target="_blank"
                rel="noreferrer"
                className={state.invoice.bolt11 ? "tb-wallet-action" : "tb-wallet-action tb-wallet-primary"}
              >
                Open checkout
              </a>
            )}
          </div>
          <p className="tb-wallet-note">{PAY_FROM_CASH_LINE}</p>
          <p className="tb-wallet-note" aria-live="polite">{awaitingWords(state.status, watching)}</p>
          <div className="tb-wallet-row">
            <button type="button" disabled={state.checking} onClick={check} className="tb-wallet-action">
              {state.checking ? "Checking…" : "Check now"}
            </button>
            <button type="button" onClick={cancel} className="tb-wallet-action">Cancel</button>
          </div>
        </div>
      )}

      {state.phase === "settled" && (
        <>
          <p className="tb-wallet-note tb-wallet-ok" aria-live="polite">Paid. {formatSats(state.credited)} sats added.</p>
          <div className="tb-wallet-row">
            <button type="button" onClick={again} className="tb-wallet-action">Done</button>
          </div>
        </>
      )}

      {state.phase === "failed" && (
        <>
          <p className="tb-wallet-error">{state.message}</p>
          <div className="tb-wallet-row">
            <button type="button" onClick={reset} className="tb-wallet-action">Try again</button>
          </div>
        </>
      )}
    </section>
  );
}

function Tranches({ tranches }: { tranches: CreditTranche[] }) {
  const [, zone] = useTimezone();
  return (
    <section className="tb-wallet-section tb-wallet-tranches">
      <h2 className="tb-wallet-title">Credit tranches</h2>
      <ul className="tb-wallet-list">
        {tranches.map((t) => (
          <li key={t.id} className="tb-wallet-line">
            <span>{formatSats(t.remaining_sats)} / {formatSats(t.amount_sats)} sats</span>
            <span>{t.expires_at ? `expires ${formatDate(t.expires_at, zone)}` : "no expiry"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Statement() {
  const [, zone] = useTimezone();
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
    <section className="tb-wallet-section tb-wallet-statement">
      <h2 className="tb-wallet-title">Statement</h2>
      <div className="tb-wallet-row">
        <button type="button" disabled={loading} onClick={() => void load()} className="tb-wallet-action">
          {loading ? "Loading…" : stmt ? "Refresh statement" : "Load statement"}
        </button>
      </div>
      {error && <p className="tb-wallet-error">{error}</p>}
      {stmt && (
        <>
          <h3 className="tb-wallet-subtitle">Purchases</h3>
          {purchases.length === 0 ? (
            <p className="tb-wallet-note">No purchases yet.</p>
          ) : (
            <ul className="tb-wallet-list">
              {purchases.map((p) => (
                <li key={p.invoice_id} className="tb-wallet-line">
                  <span>{p.created_at ? formatDate(p.created_at, zone) : "—"}</span>
                  <span>{formatSats(p.amount_sats)} sats</span>
                  <span>
                    {p.status}
                    {p.api_sats_credited ? ` · ${formatSats(p.api_sats_credited)} credited` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="tb-wallet-subtitle">Usage</h3>
          {usage.length === 0 ? (
            <p className="tb-wallet-note">No paid calls yet.</p>
          ) : (
            <ul className="tb-wallet-list">
              {usage.map((u) => (
                <li key={u.tool} className="tb-wallet-line">
                  <span>{u.tool}</span>
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

function useBalance() {
  const [bal, setBal] = useState<CheckBalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await checkBalance();
      if (r.error) setError(r.error);
      else {
        setBal(r);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { bal, error, refresh };
}

/** Balance and top-up: the one short form, for a Profile or a modal. */
export function BalanceAndTopUp({ decorateTile }: { decorateTile?: DecorateTile }) {
  const { bal, error, refresh } = useBalance();
  return (
    <div className="tb-wallet">
      <Balance bal={bal} error={error} refresh={refresh} />
      <TopUp onSettled={refresh} decorateTile={decorateTile} />
    </div>
  );
}

/** The whole wallet, always in this order. */
export default function Wallet({ decorateTile }: { decorateTile?: DecorateTile }) {
  const { bal, error, refresh } = useBalance();
  return (
    <div className="tb-wallet">
      <h1 className="tb-wallet-heading">Wallet</h1>
      <Balance bal={bal} error={error} refresh={refresh} />
      <TopUp onSettled={refresh} decorateTile={decorateTile} />
      {bal?.tranches && bal.tranches.length > 0 && <Tranches tranches={bal.tranches} />}
      <Statement />
      <CouponsPanel />
    </div>
  );
}
