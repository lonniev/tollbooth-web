/**
 * The wallet's logic without a framework: the top-up state machine, the reading
 * of a check_payment answer, and the words a coupon row needs. Pure, so it is
 * tested without React or a server.
 *
 * A top-up goes idle → creating → awaiting (an invoice is out) → settled, or
 * back to idle on cancel, or to failed when the invoice expires, is invalid or
 * the service refuses. While awaiting, check_payment may be polled: it is free,
 * idempotent and safe to repeat, unlike receive_npub_proof.
 */

import type { CheckPaymentResult, PatronCoupon, PurchaseCreditsResult } from "./standardTools.ts";

/** One invoice the patron has been handed. */
export interface Invoice {
  id: string;
  /** BTCPay's checkout page, when the service gave one. */
  checkoutLink: string | null;
  /** The BOLT11 string, for a wallet that takes a paste. */
  bolt11: string | null;
  sats: number;
}

export type TopUpState =
  | { phase: "idle"; message: string | null }
  | { phase: "creating"; sats: number }
  | { phase: "awaiting"; invoice: Invoice; checking: boolean; status: string | null; checks: number }
  | { phase: "settled"; invoice: Invoice; credited: number }
  | { phase: "failed"; invoice: Invoice | null; message: string };

export type TopUpEvent =
  | { type: "create"; sats: number }
  | { type: "created"; result: PurchaseCreditsResult }
  | { type: "check" }
  | { type: "checked"; result: CheckPaymentResult }
  | { type: "error"; message: string }
  | { type: "cancel" }
  | { type: "reset" };

export const TOP_UP_IDLE: TopUpState = { phase: "idle", message: null };

/** Where an invoice stands, from BTCPay's status word. */
export type PaymentPhase = "waiting" | "settled" | "expired" | "invalid";

export function paymentPhase(status: string | undefined | null): PaymentPhase {
  switch (status) {
    case "Settled":
      return "settled";
    case "Expired":
      return "expired";
    case "Invalid":
      return "invalid";
    default:
      return "waiting"; // New, Processing, Pending, or a word we do not know yet
  }
}

/** The invoice in a purchase_credits answer, or null when there is none to pay. */
export function invoiceFrom(result: PurchaseCreditsResult, asked: number): Invoice | null {
  if (result.error || result.success === false || !result.invoice_id) return null;
  const bolt11 = result.lightning_invoice || result.payment_request || null;
  return {
    id: result.invoice_id,
    checkoutLink: result.checkout_link || null,
    bolt11,
    sats: typeof result.amount_sats === "number" ? result.amount_sats : asked,
  };
}

/** A whole number of sats worth invoicing, from what the patron typed; else null. */
export function parseSats(input: string | number): number | null {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[\s,_]/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ── The amount to invoice ─────────────────────────────────────────────────

/**
 * The amount box. Tapping a preset only fills it; an invoice is made only by
 * the explicit "Create invoice" action, which reads `parseSats(text)`. A tap is
 * a choice, not a purchase — a patron who taps the wrong chip changes it
 * before anything is asked of the service.
 */
export type AmountEvent = { type: "preset"; sats: number } | { type: "typed"; text: string } | { type: "clear" };

export function amountReducer(text: string, event: AmountEvent): string {
  switch (event.type) {
    case "preset":
      return parseSats(event.sats) === null ? text : String(event.sats);
    case "typed":
      return event.text.replace(/[^\d]/g, "");
    case "clear":
      return "";
  }
}

/** Whether preset `sats` is what the amount box holds — the chip to mark as chosen. */
export function presetChosen(text: string, sats: number): boolean {
  return parseSats(text) === sats;
}

export function topUpReducer(state: TopUpState, event: TopUpEvent): TopUpState {
  switch (event.type) {
    case "create":
      if (state.phase === "creating" || state.phase === "awaiting") return state;
      return parseSats(event.sats) === null
        ? { phase: "idle", message: "Choose a whole number of sats above zero." }
        : { phase: "creating", sats: event.sats };

    case "created": {
      if (state.phase !== "creating") return state;
      const invoice = invoiceFrom(event.result, state.sats);
      if (!invoice) {
        return {
          phase: "failed",
          invoice: null,
          message: event.result.error ?? "The service did not return an invoice. Try again.",
        };
      }
      return { phase: "awaiting", invoice, checking: false, status: null, checks: 0 };
    }

    case "check":
      if (state.phase !== "awaiting" || state.checking) return state;
      return { ...state, checking: true };

    case "checked": {
      if (state.phase !== "awaiting") return state;
      const r = event.result;
      if (r.error) return { ...state, checking: false, status: r.error, checks: state.checks + 1 };
      switch (paymentPhase(r.status)) {
        case "settled":
          return {
            phase: "settled",
            invoice: state.invoice,
            credited: typeof r.credits_granted === "number" ? r.credits_granted : state.invoice.sats,
          };
        case "expired":
          return { phase: "failed", invoice: state.invoice, message: "The invoice expired. Make a new one." };
        case "invalid":
          return { phase: "failed", invoice: state.invoice, message: "The payment was invalid." };
        default:
          return {
            ...state,
            checking: false,
            status: r.message ?? r.status ?? null,
            checks: state.checks + 1,
          };
      }
    }

    case "error":
      if (state.phase === "creating") return { phase: "failed", invoice: null, message: event.message };
      if (state.phase === "awaiting") {
        return { ...state, checking: false, status: event.message, checks: state.checks + 1 };
      }
      return state;

    case "cancel":
    case "reset":
      return TOP_UP_IDLE;
  }
}

/** Whether a poll should run now: an invoice is out, nothing is in flight, and the budget is not spent. */
export function shouldPoll(state: TopUpState, maxChecks: number): boolean {
  return state.phase === "awaiting" && !state.checking && state.checks < maxChecks;
}

/** Sats as the fleet writes them. Null is unknown, and unknown is a dash, never 0. */
export function formatSats(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

// ── Coupons ────────────────────────────────────────────────────────────────

/** The wheel's coupon status, in words a patron reads. */
export function couponStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "window_closed":
      return "Expired";
    case "window_not_started":
      return "Not yet active";
    case "patron_limit":
      return "All uses claimed";
    case "total_limit":
      return "Fully claimed";
    default:
      return status;
  }
}

export function couponUsesText(c: Pick<PatronCoupon, "uses_per_patron" | "uses_remaining">): string {
  if (c.uses_per_patron == null) return "∞ uses";
  const n = c.uses_per_patron;
  return `${c.uses_remaining ?? 0} of ${n} use${n === 1 ? "" : "s"} left`;
}

/** Whole days until the window closes, never below zero; null when the date is unreadable. */
export function couponDaysLeft(validUntil: string, now: number = Date.now()): number | null {
  const end = new Date(validUntil).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

export function couponExpiryText(validUntil: string, now: number = Date.now()): string | null {
  const days = couponDaysLeft(validUntil, now);
  if (days === null) return null;
  return days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** What a successful redeem_coupon says back. */
export function redeemedText(r: { name?: string; discount_percent?: number; uses_remaining?: number | null }): string {
  const left =
    r.uses_remaining != null ? ` — ${r.uses_remaining} use${r.uses_remaining === 1 ? "" : "s"} left` : "";
  return `${r.name ?? "Coupon"}: ${r.discount_percent ?? 0}% off${left}.`;
}
