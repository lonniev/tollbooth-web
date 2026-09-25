/**
 * The patron's coupons: redeem an operator's code once, see what is held, and
 * take one off the list.
 *
 * Mechanics only — the calls (list_my_coupons, redeem_coupon, forget_coupon),
 * the states and the words. Every visual choice is the site's, through
 * `classNames`; with none, the panel is plain markup inheriting from the page.
 * Actions (Redeem, Remove) are chips: `classNames.chip`; Redeem, the primary
 * action, takes `classNames.primary` instead when a site gives it its accent.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { forgetCoupon, listMyCoupons, redeemCoupon, type PatronCoupon } from "../standardTools.ts";
import { couponExpiryText, couponStatusLabel, couponUsesText, redeemedText } from "../wallet.ts";
import { cx } from "./cx.ts";

export interface CouponsPanelClassNames {
  root?: string;
  heading?: string;
  intro?: string;
  /** The code box and the Redeem chip. */
  form?: string;
  input?: string;
  /** Every action: Redeem, Remove. */
  chip?: string;
  /** Redeem, in place of `chip`, for a site that gives it its accent. Default: `chip`. */
  primary?: string;
  /** The sub-labels `formHeading` and `listHeading`. */
  subheading?: string;
  /** Added to the message after a redeem, with `ok` or `error`. */
  message?: string;
  ok?: string;
  error?: string;
  loading?: string;
  empty?: string;
  list?: string;
  row?: string;
  name?: string;
  discount?: string;
  /** The status · uses · expiry line. */
  meta?: string;
  /** Added to the status word when the coupon is active. */
  active?: string;
}

export interface CouponsPanelProps {
  heading?: ReactNode;
  intro?: ReactNode;
  /** Shown when the patron holds no coupons. */
  empty?: ReactNode;
  /** A sub-label above the code box, e.g. "Redeem a code". Default none. */
  formHeading?: ReactNode;
  /** A sub-label above the held coupons, e.g. "Active". Shown only when there are some. Default none. */
  listHeading?: ReactNode;
  placeholder?: string;
  /** Content of the Redeem chip. */
  redeemLabel?: ReactNode;
  /** Content of each row's Remove chip. */
  forgetLabel?: ReactNode;
  /** Asked before a coupon is removed. Default: the browser's confirm(). */
  confirmForget?: (coupon: PatronCoupon) => boolean | Promise<boolean>;
  classNames?: CouponsPanelClassNames;
  /** Draw a coupon's row yourself; `forget` removes it (after confirmForget). */
  renderCoupon?: (coupon: PatronCoupon, forget: () => void) => ReactNode;
}

const DEFAULT_INTRO =
  "Redeem an operator's code once. The discount applies on its own to later paid calls until its uses or its window run out.";
const DEFAULT_EMPTY = "No coupons yet. Paste a code above to claim its discount.";

function defaultConfirm(): boolean {
  return (
    typeof window === "undefined" ||
    window.confirm("Remove this coupon from your list? You can redeem the code again while its window allows.")
  );
}

export default function CouponsPanel({
  heading = "My coupons",
  intro = DEFAULT_INTRO,
  empty = DEFAULT_EMPTY,
  formHeading,
  listHeading,
  placeholder = "Coupon code",
  redeemLabel = "Redeem",
  forgetLabel = "Remove",
  confirmForget = defaultConfirm,
  classNames: c = {},
  renderCoupon,
}: CouponsPanelProps) {
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
    if (!(await confirmForget(coupon))) return;
    try {
      const r = await forgetCoupon(coupon.coupon_id);
      if (r.error) setMsg({ ok: false, text: r.error });
      else setCoupons((cs) => cs.filter((x) => x.coupon_id !== coupon.coupon_id));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <section className={c.root}>
      {heading && <div className={c.heading}>{heading}</div>}
      {intro && <p className={c.intro}>{intro}</p>}

      {formHeading && <div className={c.subheading}>{formHeading}</div>}
      <div className={c.form}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") void redeem();
          }}
          placeholder={placeholder}
          aria-label="Coupon code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={redeeming}
          className={c.input}
        />
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={redeeming || !code.trim()}
          className={c.primary ?? c.chip}
        >
          {redeeming ? "Redeeming…" : redeemLabel}
        </button>
      </div>

      {msg && (
        <p role="status" className={cx(c.message, msg.ok ? c.ok : c.error)}>
          {msg.text}
        </p>
      )}

      {loading ? (
        <p className={c.loading}>Loading…</p>
      ) : loadError ? (
        <p className={cx(c.message, c.error)}>{loadError}</p>
      ) : coupons.length === 0 ? (
        empty && <p className={c.empty}>{empty}</p>
      ) : (
        <>
          {listHeading && <div className={c.subheading}>{listHeading}</div>}
          <ul className={c.list}>
            {coupons.map((coupon) =>
              renderCoupon ? (
                <li key={coupon.coupon_id} className={c.row}>
                  {renderCoupon(coupon, () => void forget(coupon))}
                </li>
              ) : (
                <CouponRow
                  key={coupon.coupon_id}
                  coupon={coupon}
                  c={c}
                  forgetLabel={forgetLabel}
                  onForget={() => void forget(coupon)}
                />
              ),
            )}
          </ul>
        </>
      )}
    </section>
  );
}

function CouponRow({
  coupon,
  c,
  forgetLabel,
  onForget,
}: {
  coupon: PatronCoupon;
  c: CouponsPanelClassNames;
  forgetLabel: ReactNode;
  onForget: () => void;
}) {
  const active = coupon.status === "active";
  const expiry = active ? couponExpiryText(coupon.valid_until) : null;
  return (
    <li className={c.row}>
      <div>
        <span className={c.name}>{coupon.name}</span> <span className={c.discount}>{coupon.discount_percent}% off</span>
        <div className={c.meta}>
          <span className={active ? c.active : undefined}>{couponStatusLabel(coupon.status)}</span>
          {" · "}
          {couponUsesText(coupon)}
          {expiry && ` · ${expiry}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onForget}
        title="Remove from your list (the code can be redeemed again while its window allows)"
        className={c.chip}
      >
        {forgetLabel}
      </button>
    </li>
  );
}
