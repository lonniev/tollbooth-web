/**
 * "Need a wallet?": a door for a guest who has never held a sat. It opens on
 * the three steps from nothing to paid, then the wallets people are using this
 * week, each with its installers.
 *
 * The list is the Oracle's, read only when the door is opened; nothing about
 * it is bundled here, so the choice stays current without a release. Like the
 * price sheet it carries its own look, `.tb-wc-*` in `price-sheet.css`,
 * coloured only through the theme tokens.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Wallet, X } from "lucide-react";
import { custodyWords, lightningWallets, storeFor, type LightningWallets } from "../lightningWallets.ts";
import CashWallets from "./CashWallets.tsx";
import { languageLocale, type TranslationKey } from "../i18n/index.ts";
import { cx } from "./cx.ts";
import { useT } from "./useT.ts";

export interface WalletChooserProps {
  /** Added to the opening button. Default: the price sheet's fact card. */
  className?: string;
}

const STEPS: readonly [string, TranslationKey][] = [
  ["📲", "walletChooser.stepInstall"],
  ["⚡", "walletChooser.stepAddSats"],
  ["🧾", "walletChooser.stepPay"],
];

export default function WalletChooser({ className }: WalletChooserProps) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className={cx(className ?? "tb-ps-fact tb-wc-door")}>
        <span className="tb-wc-door-mark" aria-hidden><Wallet size={24} /></span>
        <span>
          <span className="tb-ps-fact-title">{t("walletChooser.doorTitle")}</span>
          <span className="tb-ps-fact-line">{t("walletChooser.doorLine")}</span>
        </span>
      </button>
      {open && <WalletDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function WalletDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<LightningWallets | null>(null);
  const [failed, setFailed] = useState(false);
  const t = useT();
  const store = typeof navigator === "undefined" ? null : storeFor(navigator.userAgent);

  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    lightningWallets().then(
      (l) => { if (live) { setList(l); setFailed(!l); } },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, []);

  return (
    <div className="tb-wc-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={box} tabIndex={-1} className="tb-wc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tb-wc-head">
          <h2 id={titleId} className="tb-wc-title">{t("walletChooser.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("walletChooser.close")} className="tb-wc-close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <ol className="tb-wc-steps">
          {STEPS.map(([emoji, says]) => (
            <li key={emoji}><span aria-hidden>{emoji}</span> {t(says)}</li>
          ))}
        </ol>

        <CashWallets />

        {failed ? (
          <p className="tb-wc-note">{t("walletChooser.failed")}</p>
        ) : !list ? (
          <p className="tb-wc-note" aria-busy="true">{t("walletChooser.finding")}</p>
        ) : (
          <>
            <ul className="tb-wc-list">
              {list.wallets.map((w) => (
                <li key={w.id} className="tb-wc-card">
                  {w.logo && <img src={w.logo} alt="" width={44} height={44} className="tb-wc-logo" />}
                  <div className="tb-wc-body">
                    <div className="tb-wc-name">
                      {w.name}
                      {w.pinned && <span className="tb-wc-pick">{t("walletChooser.ourPick")}</span>}
                    </div>
                    <p className="tb-wc-line">{w.line}</p>
                    <p className="tb-wc-facts">
                      {custodyWords(w.custody)}
                      {w.buysInApp && ` · ${t("walletChooser.buysInApp")}`}
                    </p>
                    <div className="tb-wc-links">
                      {store === "apple" && w.appStore && <a href={w.appStore} target="_blank" rel="noopener noreferrer">App Store</a>}
                      {store === "google" && w.googlePlay && <a href={w.googlePlay} target="_blank" rel="noopener noreferrer">Google Play</a>}
                      <a href={w.homepage} target="_blank" rel="noopener noreferrer">{t("walletChooser.website")}</a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="tb-wc-note">
              {list.rankedBy === "brave"
                ? t("walletChooser.rankedBrave")
                : t("walletChooser.rankedCatalog")}
              {list.asOf && ` · ${list.asOf.toLocaleDateString(languageLocale(), { month: "short", day: "numeric" })}`}
            </p>
            {list.credit && <p className="tb-wc-credit">{list.credit}</p>}
          </>
        )}
      </div>
    </div>
  );
}
