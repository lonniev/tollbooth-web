/**
 * What the patron has to spend, and a way to add to it.
 *
 * Every figure is the service's answer or a dash. A balance nobody has read is
 * unknown, and unknown is not zero: showing 0 to someone with funds would send
 * them to buy credits they already own. The card offers round numbers to pay
 * in and never guesses what anything costs.
 *
 * The compact card. `WalletPage` is the full account view; both run the same
 * top-up (`useTopUp`), which checks an open invoice on its own until it settles.
 */

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Zap } from "lucide-react";
import { tollboothConfig } from "../config.ts";
import { checkBalance } from "../standardTools.ts";
import { formatSats } from "../wallet.ts";
import { card, ghost, iconButton, muted, primary } from "./ui.ts";
import { useTopUp } from "./useTopUp.ts";

const DEFAULT_TOP_UPS = [1_000, 5_000, 20_000];

export default function WalletCard({ topUps = DEFAULT_TOP_UPS }: { topUps?: number[] }) {
  const { appName } = tollboothConfig();
  const [balance, setBalance] = useState<number | null>(null);
  const [reachable, setReachable] = useState(true);

  const load = useCallback(() => {
    checkBalance()
      .then((r) => {
        setReachable(!r.error);
        if (!r.error) setBalance(r.balance_api_sats ?? 0);
      })
      .catch(() => setReachable(false));
  }, []);

  useEffect(load, [load]);

  const { state, create, check, cancel } = useTopUp({ onSettled: load });
  const busy = state.phase === "creating" || (state.phase === "awaiting" && state.checking);
  const invoice = state.phase === "awaiting" ? state.invoice : null;
  const msg =
    state.phase === "settled"
      ? `Paid. ${formatSats(state.credited)} sats added.`
      : state.phase === "failed"
        ? state.message
        : state.phase === "awaiting" && state.status
          ? `Not paid yet — ${state.status}`
          : state.phase === "idle"
            ? (state.message ?? "")
            : "";

  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm ${muted}`}>Balance</span>
        <button type="button" onClick={load} title="Refresh" aria-label="Refresh balance" className={iconButton}>
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{formatSats(reachable ? balance : null)}</span>
        <span className={`text-sm ${muted}`}>sats</span>
      </div>
      {!reachable && <p className={`mt-2 text-xs ${muted}`}>{appName} did not answer, so no balance is shown.</p>}

      {!invoice ? (
        <div className="mt-4 flex gap-2">
          {topUps.map((n) => (
            <button key={n} type="button" disabled={busy} onClick={() => create(n)} className={ghost}>
              +{n.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <a
            href={invoice.checkoutLink ?? (invoice.bolt11 ? `lightning:${invoice.bolt11}` : "#")}
            target="_blank"
            rel="noreferrer"
            className={`${primary} flex items-center justify-center gap-2`}
          >
            <Zap size={16} /> Pay {invoice.sats.toLocaleString("en-US")} sats
          </a>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={check} className={ghost}>
              I've paid — check
            </button>
            <button type="button" onClick={cancel} className={`${ghost} w-auto px-4`}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && <p className={`mt-3 text-xs ${muted}`}>{msg}</p>}
    </section>
  );
}
