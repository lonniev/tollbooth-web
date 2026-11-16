/**
 * Funding and credential health as uniform rows, for a patron and for the
 * operator. Framework-free, so every rule is tested without React or a server.
 *
 * Lifted from eXcalibur's `lib/fundingStatus.ts`, keeping its three rules:
 *   1. No prices — balances and expiries only.
 *   2. No warning outlives its cause — every row is derived fresh from the
 *      latest tool answers, and carries the time it was checked.
 *   3. Compose, don't invent — every input is a field a standard tool already
 *      returns (check_balance, check_proof_status, session_status,
 *      service_status, get_operator_onboarding_status, check_authority_balance).
 *
 * Three states: ok (working now), warning (will stop on a known date, or
 * incomplete but not fatal), blocked (stopping work now).
 */

import { languageLocale, translate } from "./i18n/index.ts";
import type {
  CheckBalanceResult,
  OperatorOnboardingStatus,
  ServiceStatus,
  SessionStatusResult,
} from "./standardTools.ts";

export type StatusLevel = "ok" | "warning" | "blocked";

export interface StatusRow {
  /** Stable key for lists and tests. */
  id: string;
  /** What the row is about: "Sign-in proof", "Authority balance", … */
  dependency: string;
  state: StatusLevel;
  /** One line; never a price. */
  detail: string;
  /** ISO time of the read that produced the row. */
  checked_at: string;
}

/**
 * When a balance reads as trouble: at or below `empty` it is blocked, at or
 * below `low` a warning. Default both 0 — only an empty balance is flagged.
 */
export interface BalanceThresholds {
  low?: number;
  empty?: number;
}

/** How this tab proves who it is. */
export type ProofKind =
  | { kind: "session_nsec" }
  /** The operator holds a DM proof for this tab's holder connection. */
  | { kind: "held"; status: "valid" | "lapsed" | "not_held" | "unknown"; expiresInSec?: number | null }
  | { kind: "none" };

/** A tranche or proof ending within this window is a warning. */
export const WARNING_WITHIN_MS = 48 * 60 * 60 * 1000;

const RANK: Record<StatusLevel, number> = { ok: 0, warning: 1, blocked: 2 };

/** The worst state across rows — for a heading's summary mark. */
export function worstState(rows: readonly StatusRow[]): StatusLevel {
  return rows.reduce<StatusLevel>((w, r) => (RANK[r.state] > RANK[w] ? r.state : w), "ok");
}

/** "3d", "5h", "12m", "now". */
export function durationText(sec: number): string {
  if (sec <= 0) return translate("funding.duration.now");
  const h = Math.floor(sec / 3600);
  if (h >= 48) return translate("funding.duration.days", { n: Math.floor(h / 24) });
  if (h >= 1) return translate("funding.duration.hours", { n: h });
  return translate("funding.duration.minutes", { n: Math.max(1, Math.floor(sec / 60)) });
}

function row(id: string, dependency: string, state: StatusLevel, detail: string, checked_at: string): StatusRow {
  return { id, dependency, state, detail, checked_at };
}

function num(n: number): string {
  return n.toLocaleString(languageLocale());
}

// ── Patron ──────────────────────────────────────────────────────────────────

/** The sign-in proof: a lapsed one drops the patron mid-session. */
export function composeProofRow(proof: ProofKind, checkedAt: string): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("npub-proof", translate("funding.proof.name"), state, detail, checkedAt);
  if (proof.kind === "session_nsec") return r("ok", translate("funding.proof.sessionKey"));
  if (proof.kind === "none") return r("blocked", translate("funding.proof.none"));
  if (proof.status === "lapsed") return r("blocked", translate("funding.proof.lapsed"));
  if (proof.status === "not_held") return r("blocked", translate("funding.proof.notHeld"));
  if (proof.status === "unknown") return r("warning", translate("funding.proof.unknown"));
  const sec = proof.expiresInSec;
  if (sec != null && sec * 1000 < WARNING_WITHIN_MS) return r("warning", translate("funding.proof.expiresIn", { when: durationText(sec) }));
  return r("ok", sec != null && sec > 0 ? translate("funding.proof.expiresIn", { when: durationText(sec) }) : translate("funding.proof.valid"));
}

/** The patron's balance and the expiry of its tranches — unused credits evaporate. */
export function composeCreditsRow(
  bal: CheckBalanceResult,
  checkedAt: string,
  thresholds: BalanceThresholds = {},
  nowMs: number = Date.now(),
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("credits", translate("funding.credits.name"), state, detail, checkedAt);
  if (bal.vault_unavailable) return r("warning", bal.warning || translate("funding.credits.ledgerUnavailable"));
  if (bal.error) return r("warning", bal.error);

  const { low = 0, empty = 0 } = thresholds;
  const balance = bal.balance_api_sats ?? 0;
  if (balance <= empty) return r("blocked", balance > 0 ? translate("funding.credits.onlyLeft", { n: num(balance) }) : translate("funding.credits.empty"));

  const next = Date.parse(bal.next_expiration_iso ?? "");
  const expiresInMs = Number.isNaN(next) ? null : next - nowMs;
  if (expiresInMs != null && expiresInMs <= 0) return r("warning", translate("funding.credits.pastExpiry", { n: num(balance) }));

  const expiring = bal.expiring_within_24h_sats ?? 0;
  if ((expiresInMs != null && expiresInMs < WARNING_WITHIN_MS) || expiring > 0) {
    const n = num(balance);
    if (expiresInMs == null) return r("warning", translate("funding.credits.expiringWithin24h", { n, expiring: num(expiring) }));
    const when = durationText(Math.floor(expiresInMs / 1000));
    return r(
      "warning",
      expiring > 0
        ? translate("funding.credits.expiringNextExpiry", { n, expiring: num(expiring), when })
        : translate("funding.credits.nextExpiry", { n, when }),
    );
  }
  if (balance <= low) return r("warning", translate("funding.credits.low", { n: num(balance) }));
  const tranches = bal.active_tranches ?? 0;
  return r("ok", translate("funding.credits.ok", { n: num(balance), count: tranches }));
}

// ── Operator ────────────────────────────────────────────────────────────────

/**
 * Is the signed-in npub this operator? The rule every copy used: the patron's
 * npub must equal the operator npub the server reports (`session_status`).
 * It only decides what a page shows — the server still enforces its own ACL.
 */
export function isOperator(npub: string, status: Pick<SessionStatusResult, "operator_npub"> | null | undefined): boolean {
  return !!npub && npub === status?.operator_npub;
}

/** The credentials the operator still has to deliver by Secure Courier. */
export function composeOnboardingRow(onb: OperatorOnboardingStatus, checkedAt: string): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("credentials", translate("funding.credentials.name"), state, detail, checkedAt);
  if (onb.vault_situation) return r("warning", onb.vault_situation);
  if (onb.error) return r("warning", onb.error);
  const missing = (onb.missing ?? []).map((m) => m.field);
  if (missing.length) return r("blocked", translate("funding.credentials.missing", { fields: missing.join(", ") }));
  const optional = (onb.optional_missing ?? []).map((m) => m.field);
  if (optional.length) return r("warning", translate("funding.credentials.optional", { fields: optional.join(", ") }));
  if (onb.ready) return r("ok", translate("funding.credentials.ready"));
  return r("warning", onb.summary || translate("funding.credentials.unknown"));
}

/** The operator's balance at its Authority — what certifies patron top-ups. */
export function composeAuthorityRow(
  bal: CheckBalanceResult,
  checkedAt: string,
  thresholds: BalanceThresholds = {},
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("authority-balance", translate("funding.authority.name"), state, detail, checkedAt);
  if (bal.success === false || bal.error) return r("warning", bal.error || translate("funding.authority.failed"));
  const balance = bal.balance_api_sats;
  if (balance == null) return r("warning", translate("funding.authority.noBalance"));
  const { low = 0, empty = 0 } = thresholds;
  if (balance <= empty) return r("blocked", translate("funding.authority.empty"));
  if (balance <= low) return r("warning", translate("funding.authority.low", { n: num(balance) }));
  return r("ok", translate("funding.authority.ok", { n: num(balance) }));
}

/** The operator's database, from `session_status`'s lifecycle and the vault. */
export function composePersistenceRow(
  life: SessionStatusResult,
  svc: ServiceStatus,
  onb: OperatorOnboardingStatus,
  checkedAt: string,
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("persistence", translate("funding.persistence.name"), state, detail, checkedAt);
  const lc = life.lifecycle;
  if (lc === "quota_exceeded") return r("blocked", life.message || translate("funding.persistence.quota"));
  if (lc === "misconfigured") return r("blocked", life.message || translate("funding.persistence.misconfigured"));
  if (lc === "warming_up" || lc === "not_registered" || lc === "no_identity") return r("warning", life.message || translate("funding.persistence.lifecycle", { lifecycle: lc }));
  if (svc.vault_configured === false || onb.vault_ok === false) return r("blocked", translate("funding.persistence.noVault"));
  return r("ok", lc ? translate("funding.persistence.lifecycleOk", { lifecycle: lc }) : translate("funding.persistence.ok"));
}

/**
 * Background-job dispatch, for an operator that runs any: null when
 * `service_status` carries no job diagnostics (the server runs none).
 */
export function composeDurableJobsRow(svc: ServiceStatus, checkedAt: string): StatusRow | null {
  const dj = svc.durable_jobs;
  const aj = svc.async_jobs;
  if (!dj && !aj) return null;
  const r = (state: StatusLevel, detail: string) => row("durable-jobs", translate("funding.jobs.name"), state, detail, checkedAt);
  if (dj?.detached_executor_error) return r("blocked", translate("funding.jobs.executorError", { error: dj.detached_executor_error }));
  const active = !!dj?.detached_executor_active;
  const resolved = dj?.detached_executor_resolved !== false;
  const durable = aj?.durable_across_recycles;
  if (active && resolved && durable !== false) return r("ok", aj?.backend ? translate("funding.jobs.activeBackend", { backend: aj.backend }) : translate("funding.jobs.active"));
  if (active && durable === false) return r("warning", translate("funding.jobs.notDurable"));
  if (!active) return r("warning", translate("funding.jobs.inProcess"));
  return r("warning", translate("funding.jobs.unresolved"));
}
