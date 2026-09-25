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
  | { kind: "dm_proof"; status: "valid" | "expired" | "unknown"; expiresInSec?: number | null }
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
  if (sec <= 0) return "now";
  const h = Math.floor(sec / 3600);
  if (h >= 48) return `${Math.floor(h / 24)}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(sec / 60))}m`;
}

function row(id: string, dependency: string, state: StatusLevel, detail: string, checked_at: string): StatusRow {
  return { id, dependency, state, detail, checked_at };
}

function sats(n: number): string {
  return `${n.toLocaleString()} sats`;
}

// ── Patron ──────────────────────────────────────────────────────────────────

/** The sign-in proof: a lapsed one drops the patron mid-session. */
export function composeProofRow(proof: ProofKind, checkedAt: string): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("npub-proof", "Sign-in proof", state, detail, checkedAt);
  if (proof.kind === "session_nsec") return r("ok", "This tab's session key signs a fresh proof on every call — no expiry.");
  if (proof.kind === "none") return r("blocked", "No proof on hand — sign in again.");
  if (proof.status === "expired") return r("blocked", "Proof has expired — sign in again to resume paid calls.");
  if (proof.status === "unknown") return r("warning", "No server-side proof record — the next paid call may ask you to sign in again.");
  const sec = proof.expiresInSec;
  if (sec != null && sec * 1000 < WARNING_WITHIN_MS) return r("warning", `Proof valid — expires in about ${durationText(sec)}.`);
  return r("ok", sec != null && sec > 0 ? `Proof valid — expires in about ${durationText(sec)}.` : "Proof valid.");
}

/** The patron's balance and the expiry of its tranches — unused credits evaporate. */
export function composeCreditsRow(
  bal: CheckBalanceResult,
  checkedAt: string,
  thresholds: BalanceThresholds = {},
  nowMs: number = Date.now(),
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("credits", "Credit balance", state, detail, checkedAt);
  if (bal.vault_unavailable) return r("warning", bal.warning || "The ledger is unavailable — the balance may be stale. Retry shortly.");
  if (bal.error) return r("warning", bal.error);

  const { low = 0, empty = 0 } = thresholds;
  const balance = bal.balance_api_sats ?? 0;
  if (balance <= empty) return r("blocked", `${balance > 0 ? `Only ${sats(balance)} left` : "Balance is empty"} — top up before paid calls will succeed.`);

  const next = Date.parse(bal.next_expiration_iso ?? "");
  const expiresInMs = Number.isNaN(next) ? null : next - nowMs;
  if (expiresInMs != null && expiresInMs <= 0) return r("warning", `${sats(balance)} on hand — a tranche is at or past expiry.`);

  const expiring = bal.expiring_within_24h_sats ?? 0;
  if ((expiresInMs != null && expiresInMs < WARNING_WITHIN_MS) || expiring > 0) {
    const when =
      expiresInMs != null ? `next expiry in about ${durationText(Math.floor(expiresInMs / 1000))}` : "tranches expire within 24h";
    const howMuch = expiring > 0 ? `${sats(expiring)} expiring; ` : "";
    return r("warning", `${sats(balance)} on hand — ${howMuch}${when}. Unused credits evaporate.`);
  }
  if (balance <= low) return r("warning", `${sats(balance)} on hand — running low.`);
  const tranches = bal.active_tranches ?? 0;
  return r("ok", `${sats(balance)} · ${tranches} active tranche${tranches === 1 ? "" : "s"}.`);
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
  const r = (state: StatusLevel, detail: string) => row("credentials", "Operator credentials", state, detail, checkedAt);
  if (onb.vault_situation) return r("warning", onb.vault_situation);
  if (onb.error) return r("warning", onb.error);
  const missing = (onb.missing ?? []).map((m) => m.field);
  if (missing.length) return r("blocked", `Missing via Secure Courier: ${missing.join(", ")}.`);
  const optional = (onb.optional_missing ?? []).map((m) => m.field);
  if (optional.length) return r("warning", `Optional, not delivered: ${optional.join(", ")}.`);
  if (onb.ready) return r("ok", "Every required credential is delivered.");
  return r("warning", onb.summary || "Couldn't tell which credentials are delivered.");
}

/** The operator's balance at its Authority — what certifies patron top-ups. */
export function composeAuthorityRow(
  bal: CheckBalanceResult,
  checkedAt: string,
  thresholds: BalanceThresholds = {},
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("authority-balance", "Authority balance", state, detail, checkedAt);
  if (bal.success === false || bal.error) return r("warning", bal.error || "Authority balance check failed.");
  const balance = bal.balance_api_sats;
  if (balance == null) return r("warning", "The Authority did not return a balance.");
  const { low = 0, empty = 0 } = thresholds;
  if (balance <= empty) return r("blocked", "Tax balance is empty — patron top-ups cannot be certified until you fund the Authority.");
  if (balance <= low) return r("warning", `${sats(balance)} left to certify patron purchases — running low.`);
  return r("ok", `${sats(balance)} available to certify patron purchases.`);
}

/** The operator's database, from `session_status`'s lifecycle and the vault. */
export function composePersistenceRow(
  life: SessionStatusResult,
  svc: ServiceStatus,
  onb: OperatorOnboardingStatus,
  checkedAt: string,
): StatusRow {
  const r = (state: StatusLevel, detail: string) => row("persistence", "Neon persistence", state, detail, checkedAt);
  const lc = life.lifecycle;
  if (lc === "quota_exceeded") return r("blocked", life.message || "Database quota exceeded — paid tools are locked until capacity is restored.");
  if (lc === "misconfigured") return r("blocked", life.message || "Persistence misconfigured — repair the database before paid tools will work.");
  if (lc === "warming_up" || lc === "not_registered" || lc === "no_identity") return r("warning", life.message || `Operator lifecycle: ${lc}.`);
  if (svc.vault_configured === false || onb.vault_ok === false) return r("blocked", "The vault is not configured — the operator cannot serve paid calls.");
  return r("ok", lc ? `Lifecycle ${lc} — vault reachable.` : "Vault reachable.");
}

/**
 * Background-job dispatch, for an operator that runs any: null when
 * `service_status` carries no job diagnostics (the server runs none).
 */
export function composeDurableJobsRow(svc: ServiceStatus, checkedAt: string): StatusRow | null {
  const dj = svc.durable_jobs;
  const aj = svc.async_jobs;
  if (!dj && !aj) return null;
  const r = (state: StatusLevel, detail: string) => row("durable-jobs", "Durable job dispatch", state, detail, checkedAt);
  if (dj?.detached_executor_error) return r("blocked", `Detached executor error: ${dj.detached_executor_error}`);
  const active = !!dj?.detached_executor_active;
  const resolved = dj?.detached_executor_resolved !== false;
  const durable = aj?.durable_across_recycles;
  if (active && resolved && durable !== false) return r("ok", `Detached executor active${aj?.backend ? ` · docket ${aj.backend}` : ""}.`);
  if (active && durable === false) return r("warning", "The executor is up, but the job backend does not survive a recycle — long jobs may be lost.");
  if (!active) return r("warning", "In-process jobs only — a long job may be cut off by a recycle.");
  return r("warning", "Detached executor present but not fully resolved.");
}
