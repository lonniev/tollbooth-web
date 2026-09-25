import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  amountReducer,
  couponDaysLeft,
  couponExpiryText,
  couponStatusLabel,
  couponUsesText,
  formatSats,
  invoiceFrom,
  parseSats,
  paymentPhase,
  presetChosen,
  redeemedText,
  shouldPoll,
  TOP_UP_IDLE,
  topUpReducer,
  type AmountEvent,
  type TopUpEvent,
  type TopUpState,
} from "./wallet.ts";

const run = (events: TopUpEvent[], from: TopUpState = TOP_UP_IDLE) => events.reduce(topUpReducer, from);

const INVOICE = { invoice_id: "inv1", checkout_link: "https://pay.test/i/inv1", lightning_invoice: "lnbc1…", amount_sats: 1000 };

describe("the top-up state machine", () => {
  it("goes idle → creating → awaiting with the invoice the service made", () => {
    const s = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }]);
    assert.equal(s.phase, "awaiting");
    if (s.phase !== "awaiting") return;
    assert.deepEqual(s.invoice, { id: "inv1", checkoutLink: "https://pay.test/i/inv1", bolt11: "lnbc1…", sats: 1000 });
    assert.equal(s.checks, 0);
  });

  it("fails when the service returns no invoice, with its reason", () => {
    const s = run([{ type: "create", sats: 1000 }, { type: "created", result: { success: false, error: "authority short" } }]);
    assert.deepEqual(s, { phase: "failed", invoice: null, message: "authority short" });
    const bare = run([{ type: "create", sats: 1000 }, { type: "created", result: {} }]);
    assert.equal(bare.phase, "failed");
  });

  it("refuses a nonsense amount without calling anything", () => {
    for (const sats of [0, -5, 1.5, Number.NaN]) {
      const s = run([{ type: "create", sats }]);
      assert.equal(s.phase, "idle");
      assert.ok(s.phase === "idle" && s.message);
    }
  });

  it("ignores a second create while one is being made or is out", () => {
    const creating = run([{ type: "create", sats: 1000 }]);
    assert.equal(run([{ type: "create", sats: 5000 }], creating), creating);
    const awaiting = run([{ type: "created", result: INVOICE }], creating);
    assert.equal(run([{ type: "create", sats: 5000 }], awaiting), awaiting);
  });

  it("keeps waiting on New / Processing, counting checks and showing the service's words", () => {
    let s = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }]);
    s = run([{ type: "check" }], s);
    assert.ok(s.phase === "awaiting" && s.checking);
    assert.equal(run([{ type: "check" }], s), s, "no second check while one is in flight");
    s = run([{ type: "checked", result: { status: "Processing", message: "Payment seen, waiting for confirmation." } }], s);
    assert.ok(s.phase === "awaiting");
    if (s.phase !== "awaiting") return;
    assert.equal(s.checking, false);
    assert.equal(s.checks, 1);
    assert.equal(s.status, "Payment seen, waiting for confirmation.");
  });

  it("settles with the credits granted, or the invoice's sats when the answer omits them", () => {
    const out = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }, { type: "check" }]);
    assert.deepEqual(run([{ type: "checked", result: { status: "Settled", credits_granted: 1100 } }], out), {
      phase: "settled",
      invoice: { id: "inv1", checkoutLink: "https://pay.test/i/inv1", bolt11: "lnbc1…", sats: 1000 },
      credited: 1100,
    });
    const s = run([{ type: "checked", result: { status: "Settled" } }], out);
    assert.ok(s.phase === "settled" && s.credited === 1000);
  });

  it("fails on Expired and Invalid", () => {
    const out = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }]);
    assert.equal(run([{ type: "checked", result: { status: "Expired" } }], out).phase, "failed");
    assert.equal(run([{ type: "checked", result: { status: "Invalid" } }], out).phase, "failed");
  });

  it("a failed check keeps the invoice and counts toward the poll budget", () => {
    let s = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }, { type: "check" }]);
    s = run([{ type: "error", message: "offline" }], s);
    assert.ok(s.phase === "awaiting" && s.status === "offline" && s.checks === 1 && !s.checking);
  });

  it("a thrown purchase fails the top-up", () => {
    const s = run([{ type: "create", sats: 1000 }, { type: "error", message: "unreachable" }]);
    assert.deepEqual(s, { phase: "failed", invoice: null, message: "unreachable" });
  });

  it("drops a late answer once the invoice is cancelled", () => {
    const s = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }, { type: "cancel" }]);
    assert.equal(s, TOP_UP_IDLE);
    assert.equal(run([{ type: "checked", result: { status: "Settled" } }], s), s);
    assert.equal(run([{ type: "created", result: INVOICE }], s), s);
  });

  it("polls only while an invoice is out, idle and within budget", () => {
    const out = run([{ type: "create", sats: 1000 }, { type: "created", result: INVOICE }]);
    assert.equal(shouldPoll(out, 3), true);
    assert.equal(shouldPoll(run([{ type: "check" }], out), 3), false);
    assert.equal(shouldPoll({ ...(out as Extract<TopUpState, { phase: "awaiting" }>), checks: 3 }, 3), false);
    assert.equal(shouldPoll(TOP_UP_IDLE, 3), false);
  });
});

describe("reading the service's answers", () => {
  it("maps BTCPay's status word to a phase", () => {
    assert.equal(paymentPhase("Settled"), "settled");
    assert.equal(paymentPhase("Expired"), "expired");
    assert.equal(paymentPhase("Invalid"), "invalid");
    for (const w of ["New", "Processing", "Pending", undefined, null, "Mystery"]) assert.equal(paymentPhase(w), "waiting");
  });

  it("takes the BOLT11 from either field and keeps the asked amount when none is echoed", () => {
    assert.deepEqual(invoiceFrom({ invoice_id: "a", payment_request: "lnbc2" }, 500), {
      id: "a",
      checkoutLink: null,
      bolt11: "lnbc2",
      sats: 500,
    });
    assert.equal(invoiceFrom({ invoice_id: "a", error: "no" }, 1), null);
  });

  it("parses typed amounts", () => {
    assert.equal(parseSats("5,000"), 5000);
    assert.equal(parseSats(" 21 000 "), 21000);
    assert.equal(parseSats("0"), null);
    assert.equal(parseSats("abc"), null);
    assert.equal(parseSats(""), null);
  });

  it("writes an unknown balance as a dash, never 0", () => {
    assert.equal(formatSats(null), "—");
    assert.equal(formatSats(undefined), "—");
    assert.equal(formatSats(0), "0");
    assert.equal(formatSats(12345), "12,345");
  });
});

describe("coupon words", () => {
  it("names each status", () => {
    assert.equal(couponStatusLabel("active"), "Active");
    assert.equal(couponStatusLabel("window_closed"), "Expired");
    assert.equal(couponStatusLabel("patron_limit"), "All uses claimed");
    assert.equal(couponStatusLabel("new_thing"), "new_thing");
  });

  it("counts uses", () => {
    assert.equal(couponUsesText({ uses_per_patron: null, uses_remaining: null }), "∞ uses");
    assert.equal(couponUsesText({ uses_per_patron: 1, uses_remaining: 1 }), "1 of 1 use left");
    assert.equal(couponUsesText({ uses_per_patron: 5, uses_remaining: null }), "0 of 5 uses left");
  });

  it("counts days to expiry, never below zero", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    assert.equal(couponDaysLeft("2026-09-24T18:00:00Z", now), 1);
    assert.equal(couponDaysLeft("2026-09-20T00:00:00Z", now), 0);
    assert.equal(couponDaysLeft("not a date", now), null);
    assert.equal(couponExpiryText("2026-09-24T12:00:00Z", now), "expires today");
    assert.equal(couponExpiryText("2026-09-27T12:00:00Z", now), "expires in 3 days");
  });

  it("says what a redeem bought", () => {
    assert.equal(redeemedText({ name: "EARLYBIRD", discount_percent: 20, uses_remaining: 1 }), "EARLYBIRD: 20% off — 1 use left.");
    assert.equal(redeemedText({ name: "X", discount_percent: 5, uses_remaining: null }), "X: 5% off.");
  });
});

describe("the amount box: presets fill, then the patron confirms", () => {
  const pick = (events: AmountEvent[], from = "") => events.reduce(amountReducer, from);

  it("fills the box from a preset and marks that chip, asking nothing of the service", () => {
    const text = pick([{ type: "preset", sats: 5000 }]);
    assert.equal(text, "5000");
    assert.ok(presetChosen(text, 5000));
    assert.ok(!presetChosen(text, 1000));
    // The only way to an invoice is the confirm step, which reads the box.
    assert.equal(parseSats(text), 5000);
  });

  it("lets a second tap change the choice before anything is created", () => {
    const text = pick([{ type: "preset", sats: 5000 }, { type: "preset", sats: 1000 }]);
    assert.equal(text, "1000");
    assert.ok(presetChosen(text, 1000) && !presetChosen(text, 5000));
  });

  it("keeps digits only when typed, and a typed amount matching a preset marks it", () => {
    assert.equal(pick([{ type: "typed", text: "2,5k00" }]), "2500");
    assert.ok(presetChosen(pick([{ type: "typed", text: "25000" }]), 25_000));
  });

  it("ignores a nonsense preset and clears on request", () => {
    assert.equal(pick([{ type: "preset", sats: 0 }], "42"), "42");
    assert.equal(pick([{ type: "preset", sats: 1.5 }], "42"), "42");
    assert.equal(pick([{ type: "preset", sats: 5000 }, { type: "clear" }]), "");
    assert.equal(parseSats(""), null, "an empty box cannot be confirmed");
  });
});
