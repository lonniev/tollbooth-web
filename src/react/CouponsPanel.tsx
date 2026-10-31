/**
 * The patron's coupons: redeem an operator's code once, see what is held, and
 * take one off the list. Part of `Wallet`, and laid out by `wallet.css`.
 */

import { useCallback, useEffect, useState } from "react";
import { forgetCoupon, listMyCoupons, redeemCoupon, type PatronCoupon } from "../standardTools.ts";
import { couponExpiryText, couponStatusLabel, couponUsesText, redeemedText } from "../wallet.ts";

const DEFAULT_INTRO =
  "Redeem an operator's code once. The discount applies on its own to later paid calls until its uses or its window run out.";
const DEFAULT_EMPTY = "No coupons yet. Paste a code above to claim its discount.";

function confirmForget(): boolean {
  return (
    typeof window === "undefined" ||
    window.confirm("Remove this coupon from your list? You can redeem the code again while its window allows.")
  );
}

export default function CouponsPanel() {
  const [coupons, setCoupons] = useState<PatronCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await listMyCoupons();
      if (r.error) setLoadError(r.error);
      else setCoupons(r.coupons ?? []);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function redeem() {
    const trimmed = code.trim();
    if (!trimmed || redeeming) return;
    setRedeeming(true);
    setMsg(null);
    try {
      const r = await redeemCoupon(trimmed);
      if (r.success) {
        setMsg({ ok: true, text: redeemedText(r) });
        setCode("");
        void refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "That code could not be redeemed." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setRedeeming(false);
    }
  }

  async function forget(coupon: PatronCoupon) {
    if (!confirmForget()) return;
    try {
      const r = await forgetCoupon(coupon.coupon_id);
      if (r.error) setMsg({ ok: false, text: r.error });
      else setCoupons((cs) => cs.filter((x) => x.coupon_id !== coupon.coupon_id));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <section className="tb-wallet-section tb-wallet-coupons" data-tour="tb.account.coupons">
      <h2 className="tb-wallet-title">My coupons</h2>
      <p className="tb-wallet-note">{DEFAULT_INTRO}</p>

      <div className="tb-wallet-row">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") void redeem();
          }}
          placeholder="Coupon code"
          aria-label="Coupon code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={redeeming}
          className="tb-wallet-input"
        />
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={redeeming || !code.trim()}
          className="tb-wallet-action tb-wallet-primary"
        >
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
      </div>

      {msg && (
        <p role="status" className={msg.ok ? "tb-wallet-note tb-wallet-ok" : "tb-wallet-error"}>
          {msg.text}
        </p>
      )}

      {loading ? (
        <p className="tb-wallet-note">Loading…</p>
      ) : loadError ? (
        <p className="tb-wallet-error">{loadError}</p>
      ) : coupons.length === 0 ? (
        <p className="tb-wallet-note">{DEFAULT_EMPTY}</p>
      ) : (
        <ul className="tb-wallet-list">
          {coupons.map((coupon) => (
            <CouponRow key={coupon.coupon_id} coupon={coupon} onForget={() => void forget(coupon)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CouponRow({ coupon, onForget }: { coupon: PatronCoupon; onForget: () => void }) {
  const active = coupon.status === "active";
  const expiry = active ? couponExpiryText(coupon.valid_until) : null;
  return (
    <li className="tb-wallet-coupon">
      <div>
        <b>{coupon.name}</b> {coupon.discount_percent}% off
        <div className="tb-wallet-note">
          <span className={active ? "tb-wallet-ok" : undefined}>{couponStatusLabel(coupon.status)}</span>
          {" · "}
          {couponUsesText(coupon)}
          {expiry && ` · ${expiry}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onForget}
        title="Remove from your list (the code can be redeemed again while its window allows)"
        className="tb-wallet-action"
      >
        Remove
      </button>
    </li>
  );
}
