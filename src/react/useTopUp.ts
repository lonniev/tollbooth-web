/**
 * A Lightning top-up as a hook: purchase_credits → an invoice → check_payment
 * until it settles, expires or the patron gives up.
 *
 * The state machine is `topUpReducer` (framework-free, tested). This adds the
 * calls and the polling: while an invoice is out and the tab is visible,
 * check_payment runs every `pollMs` — it is free and safe to repeat — up to
 * `maxChecks` times, after which the patron's own "check" still works.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { checkPayment, purchaseCredits } from "../standardTools.ts";
import { shouldPoll, TOP_UP_IDLE, topUpReducer, type TopUpState } from "../wallet.ts";

export interface UseTopUpOptions {
  /** How often to check an open invoice, in ms. 0 turns polling off. Default 5000. */
  pollMs?: number;
  /** Stop polling after this many checks. Default 60 (five minutes at the default rate). */
  maxChecks?: number;
  /** Called once when an invoice settles, with the sats credited — refresh a balance here. */
  onSettled?: (credited: number) => void;
}

export interface TopUp {
  state: TopUpState;
  /** Ask the service for an invoice of `sats`. Ignored while one is being made or is out. */
  create: (sats: number) => void;
  /** Check the open invoice now. */
  check: () => void;
  /** Drop the open invoice (it simply expires at BTCPay). */
  cancel: () => void;
  /** Back to idle after a settlement or failure. */
  reset: () => void;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function tabHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

export function useTopUp({ pollMs = 5000, maxChecks = 60, onSettled }: UseTopUpOptions = {}): TopUp {
  const [state, dispatch] = useReducer(topUpReducer, TOP_UP_IDLE);
  const latest = useRef(state);
  latest.current = state;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  // Bumped when the tab comes back, so a poll skipped while hidden is re-armed.
  const [wake, setWake] = useState(0);

  const create = useCallback((sats: number) => {
    const s = latest.current;
    if (s.phase === "creating" || s.phase === "awaiting") return;
    dispatch({ type: "create", sats });
    purchaseCredits(sats).then(
      (result) => dispatch({ type: "created", result }),
      (e) => dispatch({ type: "error", message: messageOf(e) }),
    );
  }, []);

  const check = useCallback(() => {
    const s = latest.current;
    if (s.phase !== "awaiting" || s.checking) return;
    const id = s.invoice.id;
    dispatch({ type: "check" });
    checkPayment(id).then(
      (result) => {
        // A late answer for an invoice the patron has since cancelled is dropped.
        const now = latest.current;
        if (now.phase === "awaiting" && now.invoice.id === id) dispatch({ type: "checked", result });
      },
      (e) => dispatch({ type: "error", message: messageOf(e) }),
    );
  }, []);

  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  useEffect(() => {
    if (!(pollMs > 0) || !shouldPoll(state, maxChecks)) return;
    const t = setTimeout(() => {
      if (tabHidden()) return; // re-armed by the visibility listener below
      check();
    }, pollMs);
    return () => clearTimeout(t);
  }, [state, pollMs, maxChecks, check, wake]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (!tabHidden()) setWake((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (state.phase === "settled") settledRef.current?.(state.credited);
  }, [state]);

  return { state, create, check, cancel, reset };
}
