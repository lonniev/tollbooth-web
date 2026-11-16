/**
 * The Lightning top-up: amount tiles, the invoice and its QR, then the wait.
 * Part of the wallet, and of `PeersPanel` for an account a peer funds. Not
 * exported to sites: the wallet is the brand, and its scope is the signed-in
 * npub's own account.
 */

import { useReducer, useState } from "react";
import { TB_TARGETS } from "../tour/tours.ts";
import { TOP_UP_AMOUNTS, amountReducer, awaitingWords, formatSats, parseSats, payLink, presetChosen } from "../wallet.ts";
import CashWallets from "./CashWallets.tsx";
import InvoiceQr from "./InvoiceQr.tsx";
import { useT } from "./useT.ts";
import { useTopUp } from "./useTopUp.ts";
import type { DecorateTile } from "./Wallet.tsx";
import WalletChooser from "./WalletChooser.tsx";

export interface TopUpProps {
  onSettled: () => void;
  decorateTile?: DecorateTile;
  /** Top up another patron's account, as a peer they approved. */
  forNpub?: string;
}

export default function TopUp({ onSettled, decorateTile, forNpub }: TopUpProps) {
  const { state, watching, create, check, cancel, reset } = useTopUp({ onSettled, forNpub });
  const [amount, pick] = useReducer(amountReducer, "");
  const [custom, setCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();
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
      <h2 className="tb-wallet-title">{t("topUp.heading")}</h2>

      {(state.phase === "idle" || creating) && (
        <>
          <div className="tb-wallet-tiles-span">
            <div className="tb-wallet-tiles" data-tour={TB_TARGETS.walletAmounts}>
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
                      <span className="tb-wallet-tile-sats">{formatSats(n)}</span>
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
                  <span className="tb-wallet-tile-sats">{t("topUp.custom")}</span>
                  <span className="tb-wallet-tile-unit">{t("topUp.customUnit")}</span>
                </span>
              </button>
            </div>
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
              placeholder={t("topUp.amountLabel")}
              aria-label={t("topUp.amountLabel")}
              className="tb-wallet-input tb-wallet-custom"
            />
          )}
          <button
            type="button"
            disabled={creating || !sats}
            onClick={() => sats && create(sats)}
            className="tb-wallet-action tb-wallet-primary tb-wallet-create"
          >
            {t("topUp.createInvoice")}
          </button>
          {creating && <p className="tb-wallet-note">{t("topUp.creating")}</p>}
          {state.phase === "idle" && state.message && <p className="tb-wallet-error">{state.message}</p>}
          <div data-tour={TB_TARGETS.walletDoor}><WalletChooser /></div>
          <CashWallets />
        </>
      )}

      {state.phase === "awaiting" && (
        <div className="tb-wallet-invoice">
          <p className="tb-wallet-note">{t("topUp.invoiceFor", { n: formatSats(state.invoice.sats) })}</p>
          <InvoiceQr bolt11={state.invoice.bolt11} className="tb-wallet-qr" />
          <div className="tb-wallet-row">
            {state.invoice.bolt11 && (
              <a href={payLink(state.invoice) ?? "#"} className="tb-wallet-action tb-wallet-primary">{t("topUp.openInWallet")}</a>
            )}
            {state.invoice.bolt11 && (
              <button type="button" onClick={() => void copy(state.invoice.bolt11!)} className="tb-wallet-action">
                {copied ? t("topUp.copied") : t("topUp.copyInvoice")}
              </button>
            )}
            {state.invoice.checkoutLink && (
              <a
                href={state.invoice.checkoutLink}
                target="_blank"
                rel="noreferrer"
                className={state.invoice.bolt11 ? "tb-wallet-action" : "tb-wallet-action tb-wallet-primary"}
              >
                {t("topUp.openCheckout")}
              </a>
            )}
          </div>
          <CashWallets />
          <p className="tb-wallet-note" aria-live="polite">{awaitingWords(state.status, watching)}</p>
          <div className="tb-wallet-row">
            <button type="button" disabled={state.checking} onClick={check} className="tb-wallet-action">
              {state.checking ? t("topUp.checking") : t("topUp.checkNow")}
            </button>
            <button type="button" onClick={cancel} className="tb-wallet-action">{t("topUp.cancel")}</button>
          </div>
        </div>
      )}

      {state.phase === "settled" && (
        <>
          <p className="tb-wallet-note tb-wallet-ok" aria-live="polite">{t("topUp.paid", { n: formatSats(state.credited) })}</p>
          <div className="tb-wallet-row">
            <button type="button" onClick={again} className="tb-wallet-action">{t("topUp.done")}</button>
          </div>
        </>
      )}

      {state.phase === "failed" && (
        <>
          <p className="tb-wallet-error">{state.message}</p>
          <div className="tb-wallet-row">
            <button type="button" onClick={reset} className="tb-wallet-action">{t("topUp.tryAgain")}</button>
          </div>
        </>
      )}
    </section>
  );
}
