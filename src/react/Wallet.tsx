/**
 * The patron's wallet at this operator: one layout, one scope and one behavior on
 * every Tollbooth DPYC™ site. It is the brand, so it has no layout props. A site
 * says where it goes, restyles it through the variables in `wallet.css`, and may
 * name and mark the amount tiles (`decorateTile`).
 *
 * A balance nobody has read is a dash, never 0: showing 0 to someone with funds
 * sends them to buy credits they already own.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatDate, formatDateTime } from "../timezone.ts";
import {
  checkBalance,
  getAccountStatement,
  type AccountStatementResult,
  type CheckBalanceResult,
  type CreditTranche,
} from "../standardTools.ts";
import CouponsPanel from "./CouponsPanel.tsx";
import { TB_TARGETS } from "../tour/tours.ts";
import { formatSats } from "../wallet.ts";
import { useT } from "./useT.ts";
import { useTimezone } from "./useTimezone.ts";
import TopUp from "./TopUp.tsx";

export interface TileDecoration {
  /** A name above the amount, e.g. "Seed Packet". */
  name?: string;
  /** A small glyph on the tile. */
  mark?: ReactNode;
}

export type DecorateTile = (sats: number) => TileDecoration | undefined;

function Balance({ bal, error, refresh }: { bal: CheckBalanceResult | null; error: string | null; refresh: () => Promise<void> }) {
  const [, zone] = useTimezone();
  const t = useT();
  const pending = bal?.pending_invoices ?? 0;
  const expiring = bal?.expiring_within_24h_sats ?? 0;
  return (
    <section className="tb-wallet-section tb-wallet-balance">
      <h2 className="tb-wallet-title">{t("wallet.balance")}</h2>
      <div>
        <span className="tb-wallet-figure">{formatSats(error ? null : bal?.balance_api_sats)}</span>{" "}
        <span className="tb-wallet-note">sats</span>
      </div>
      {bal && !error && (
        <div className="tb-wallet-stats">
          <span>{t("wallet.deposited", { n: formatSats(bal.total_deposited_api_sats) })}</span>
          <span>{t("wallet.consumed", { n: formatSats(bal.total_consumed_api_sats) })}</span>
          {!!bal.total_expired_api_sats && <span>{t("wallet.expired", { n: formatSats(bal.total_expired_api_sats) })}</span>}
          <span>{t("wallet.activeTranches", { count: bal.active_tranches ?? 0 })}</span>
        </div>
      )}
      {error && <p className="tb-wallet-error">{t("wallet.balanceError", { error })}</p>}
      {bal?.vault_unavailable && (
        <p className="tb-wallet-note">{bal.warning ?? t("wallet.ledgerStale")}</p>
      )}
      {pending > 0 && <p className="tb-wallet-note">{t("wallet.pendingInvoices", { count: pending })}</p>}
      {expiring > 0 && <p className="tb-wallet-note">{t("wallet.expiringSoon", { n: formatSats(expiring) })}</p>}
      {bal?.next_expiration_iso && <p className="tb-wallet-note">{t("wallet.nextExpiry", { when: formatDateTime(bal.next_expiration_iso, zone) })}</p>}
      <div className="tb-wallet-row">
        <button type="button" onClick={() => void refresh()} className="tb-wallet-action">{t("wallet.refresh")}</button>
      </div>
    </section>
  );
}


function Tranches({ tranches }: { tranches: CreditTranche[] }) {
  const [, zone] = useTimezone();
  const t = useT();
  return (
    <section className="tb-wallet-section tb-wallet-tranches" data-tour={TB_TARGETS.walletTranches}>
      <h2 className="tb-wallet-title">{t("wallet.tranches")}</h2>
      <ul className="tb-wallet-list">
        {tranches.map((tr) => (
          <li key={tr.id} className="tb-wallet-line">
            <span>{t("wallet.trancheLine", { remaining: formatSats(tr.remaining_sats), amount: formatSats(tr.amount_sats) })}</span>
            <span>{tr.expires_at ? t("wallet.trancheExpires", { date: formatDate(tr.expires_at, zone) }) : t("wallet.trancheNoExpiry")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Statement() {
  const [, zone] = useTimezone();
  const t = useT();
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
    <section className="tb-wallet-section tb-wallet-statement" data-tour={TB_TARGETS.walletStatement}>
      <h2 className="tb-wallet-title">{t("wallet.statement")}</h2>
      <div className="tb-wallet-row">
        <button type="button" disabled={loading} onClick={() => void load()} className="tb-wallet-action">
          {loading ? t("wallet.loading") : stmt ? t("wallet.refreshStatement") : t("wallet.loadStatement")}
        </button>
      </div>
      {error && <p className="tb-wallet-error">{error}</p>}
      {stmt && (
        <>
          <h3 className="tb-wallet-subtitle">{t("wallet.purchases")}</h3>
          {purchases.length === 0 ? (
            <p className="tb-wallet-note">{t("wallet.noPurchases")}</p>
          ) : (
            <ul className="tb-wallet-list">
              {purchases.map((p) => (
                <li key={p.invoice_id} className="tb-wallet-line">
                  <span>{p.created_at ? formatDate(p.created_at, zone) : "—"}</span>
                  <span>{t("wallet.sats", { n: formatSats(p.amount_sats) })}</span>
                  <span>
                    {p.api_sats_credited
                      ? t("wallet.purchaseCredited", { status: p.status, n: formatSats(p.api_sats_credited) })
                      : p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="tb-wallet-subtitle">{t("wallet.usage")}</h3>
          {usage.length === 0 ? (
            <p className="tb-wallet-note">{t("wallet.noPaidCalls")}</p>
          ) : (
            <ul className="tb-wallet-list">
              {usage.map((u) => (
                <li key={u.tool} className="tb-wallet-line">
                  <span>{u.tool}</span>
                  <span>{t("wallet.usageLine", { count: u.calls, n: formatSats(u.calls), sats: formatSats(u.api_sats) })}</span>
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

function Funds({ decorateTile }: { decorateTile?: DecorateTile }) {
  const { bal, error, refresh } = useBalance();
  const t = useT();
  return (
    <>
      <h1 className="tb-wallet-heading">{t("wallet.heading")}</h1>
      <Balance bal={bal} error={error} refresh={refresh} />
      <TopUp onSettled={refresh} decorateTile={decorateTile} />
      {bal?.tranches && bal.tranches.length > 0 && <Tranches tranches={bal.tranches} />}
      <CouponsPanel />
    </>
  );
}

/** The wallet above its statement, for a page that puts the statement lower down. */
export function WalletFunds({ decorateTile }: { decorateTile?: DecorateTile }) {
  return <div className="tb-wallet"><Funds decorateTile={decorateTile} /></div>;
}

/** The statement, for a page showing `WalletFunds`. */
export function WalletStatement() {
  return <div className="tb-wallet"><Statement /></div>;
}

/** The whole wallet, always in this order. */
export default function Wallet({ decorateTile }: { decorateTile?: DecorateTile }) {
  return (
    <div className="tb-wallet">
      <Funds decorateTile={decorateTile} />
      <Statement />
    </div>
  );
}
