/**
 * What the patron has to spend, and a way to add to it.
 *
 * Every figure is the service's answer or a dash. A balance nobody has read is
 * unknown, and unknown is not zero: showing 0 to someone with funds would send
 * them to buy credits they already own. The card offers round numbers to pay
 * in and never guesses what anything costs.
 */

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { tollboothConfig } from "../config.ts";
import { checkBalance, checkPayment, purchaseCredits } from "../standardTools.ts";
import { card, ghost, iconButton, muted, primary } from "./ui.ts";

const DEFAULT_TOP_UPS = [1_000, 5_000, 20_000];

function sats(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("en-US");
}

export default function WalletCard({ topUps = DEFAULT_TOP_UPS }: { topUps?: number[] }) {
  const { appName } = tollboothConfig();
  const [balance, setBalance] = useState<number | null>(null);
  const [reachable, setReachable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState<{ id: string; link: string; sats: number } | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    checkBalance()
      .then((r) => {
        setReachable(!r.error);
        if (!r.error) setBalance(r.balance_api_sats ?? 0);
      })
      .catch(() => setReachable(false));
  }, []);

  useEffect(load, [load]);

  async function topUp(amount: number) {
    setBusy(true);
    setMsg("");
    try {
      const r = await purchaseCredits(amount);
      if (r.error || !r.invoice_id) {
        setMsg(r.error ?? "The service did not return an invoice. Try again.");
        return;
      }
      setInvoice({
        id: r.invoice_id,
        link: r.checkout_link ?? r.lightning_invoice ?? r.payment_request ?? "",
        sats: r.amount_sats ?? amount,
      });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!invoice) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await checkPayment(invoice.id);
      if (r.status === "Settled") {
        setInvoice(null);
        setMsg(`Paid. ${sats(r.credits_granted ?? invoice.sats)} sats added.`);
        load();
      } else {
        setMsg(`Not paid yet — the invoice reads ${r.status ?? "unknown"}.`);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm ${muted}`}>Balance</span>
        <button type="button" onClick={load} title="Refresh" aria-label="Refresh balance" className={iconButton}>
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{sats(reachable ? balance : null)}</span>
        <span className={`text-sm ${muted}`}>sats</span>
      </div>
      {!reachable && <p className={`mt-2 text-xs ${muted}`}>{appName} did not answer, so no balance is shown.</p>}

      {!invoice ? (
        <div className="mt-4 flex gap-2">
          {topUps.map((n) => (
            <button key={n} type="button" disabled={busy} onClick={() => topUp(n)} className={ghost}>
              +{n.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <a
            href={invoice.link}
            target="_blank"
            rel="noreferrer"
            className={`${primary} flex items-center justify-center gap-2`}
          >
            <Zap size={16} /> Pay {invoice.sats.toLocaleString("en-US")} sats
          </a>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={confirm} className={ghost}>
              I've paid — check
            </button>
            <button type="button" onClick={() => setInvoice(null)} className={`${ghost} w-auto px-4`}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-3 text-xs ${muted}`}>{msg}</p>}
    </section>
  );
}
