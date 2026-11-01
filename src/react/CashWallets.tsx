/**
 * The two wallets that pay an invoice from cash, each with its logo and its link.
 * The names and websites are the package's, so they show even if the Oracle is slow;
 * the logos and the device's installer come from its list once it answers.
 */

import { useEffect, useState } from "react";
import { cashWalletDoors, lightningWallets, storeFor, type LightningWallets } from "../lightningWallets.ts";
import { TB_TARGETS } from "../tour/tours.ts";

let asked: Promise<LightningWallets | null> | null = null;

function theList(): Promise<LightningWallets | null> {
  asked ??= lightningWallets().catch(() => {
    asked = null;
    return null;
  });
  return asked;
}

export default function CashWallets() {
  const [list, setList] = useState<LightningWallets | null>(null);
  const store = typeof navigator === "undefined" ? null : storeFor(navigator.userAgent);

  useEffect(() => {
    let live = true;
    void theList().then((l) => { if (live) setList(l); });
    return () => { live = false; };
  }, []);

  return (
    <div className="tb-cash" data-tour={TB_TARGETS.walletCash}>
      <p className="tb-cash-says">No Wallet yet? Use cash with these.</p>
      <div className="tb-cash-doors">
        {cashWalletDoors(list, store).map((w) => (
          <a key={w.id} href={w.href} target="_blank" rel="noopener noreferrer" className="tb-cash-door">
            {w.logo && <img src={w.logo} alt="" width={36} height={36} className="tb-cash-logo" />}
            <span>{w.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
