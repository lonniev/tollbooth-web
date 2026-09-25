/**
 * Funding and credential health, as a list of rows that are read fresh and
 * stamped with when: `PatronFundingStatus` (sign-in proof, credit balance and
 * tranche expiry) and `OperatorFundingStatus` (credentials, Authority balance,
 * database, background jobs).
 *
 * `OperatorFundingStatus` renders nothing — and asks nothing operator-only —
 * unless the signed-in npub is the operator npub `session_status` reports, the
 * rule the fleet's copies used. That decides only what the page shows; the
 * server enforces its own ACL.
 *
 * Mechanics only: the calls, the rules (`funding.ts`) and the states. Every
 * visual choice is the site's, through `classNames`, with `ok` / `warning` /
 * `blocked` added to a row, its state word and the heading's summary mark.
 * `siteRows` adds the site's own checks (an upstream OAuth connection, say);
 * `renderRow` draws a row yourself. Refresh is a chip.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  composeAuthorityRow,
  composeCreditsRow,
  composeDurableJobsRow,
  composeOnboardingRow,
  composePersistenceRow,
  composeProofRow,
  isOperator,
  worstState,
  type BalanceThresholds,
  type ProofKind,
  type StatusLevel,
  type StatusRow,
} from "../funding.ts";
import { currentClaim } from "../identity.ts";
import { canSignFor } from "../signedIn.ts";
import {
  checkAuthorityBalance,
  checkBalance,
  checkProofStatus,
  getOperatorOnboardingStatus,
  serviceStatus,
  sessionStatus,
  type CheckBalanceResult,
} from "../standardTools.ts";
import { formatDateTime } from "../timezone.ts";
import { cx } from "./cx.ts";
import { useTimezone } from "./useTimezone.ts";

export interface FundingStatusClassNames {
  root?: string;
  /** The heading row: title, summary mark and the Refresh chip. */
  header?: string;
  heading?: string;
  /** The summary mark: the worst state across rows. */
  overall?: string;
  chip?: string;
  intro?: string;
  list?: string;
  row?: string;
  dependency?: string;
  state?: string;
  detail?: string;
  /** The "checked …" stamp. */
  checked?: string;
  loading?: string;
  error?: string;
  /** Added to a row, its state word and the summary mark, by state. */
  ok?: string;
  warning?: string;
  blocked?: string;
}

export interface FundingStatusProps {
  heading?: ReactNode;
  intro?: ReactNode;
  /** The site's own checks, given the read time; drawn before the package's rows. */
  siteRows?: (checkedAt: string) => Promise<StatusRow[]>;
  /** The words for each state. Default "ok", "warning", "blocked". */
  stateLabels?: Partial<Record<StatusLevel, ReactNode>>;
  /** Draw a row yourself; `checked` is its read time in the patron's zone. */
  renderRow?: (row: StatusRow, checked: string) => ReactNode;
  /** Content of the Refresh chip; null for none. Default "Refresh". */
  refreshLabel?: ReactNode;
  classNames?: FundingStatusClassNames;
}

export interface PatronFundingStatusProps extends FundingStatusProps {
  /** When the patron's balance reads as low or empty. */
  thresholds?: BalanceThresholds;
}

export interface OperatorFundingStatusProps extends FundingStatusProps {
  /** When the operator's Authority balance reads as low or empty. */
  authorityThresholds?: BalanceThresholds;
}

const STATE_LABELS: Record<StatusLevel, string> = { ok: "ok", warning: "warning", blocked: "blocked" };

type Read = () => Promise<StatusRow[] | null>;

/**
 * Rows from `read`, read on mount and on Refresh; null rows means "show
 * nothing". The latest `read` is used, but a new one (a site passing
 * `thresholds` or `siteRows` inline) does not trigger a re-read.
 */
function useRows(read: Read) {
  const latest = useRef(read);
  latest.current = read;
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await latest.current());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

function StatusList({
  heading,
  intro,
  stateLabels = {},
  renderRow,
  refreshLabel = "Refresh",
  classNames: c = {},
  rows,
  loading,
  error,
  refresh,
}: FundingStatusProps & { rows: StatusRow[]; loading: boolean; error: string | null; refresh: () => void }) {
  const [, zone] = useTimezone();
  const overall = worstState(rows);
  return (
    <section className={c.root}>
      <div className={c.header}>
        {heading && <div className={c.heading}>{heading}</div>}
        {rows.length > 0 && !loading && (
          <span className={cx(c.overall, c[overall])}>{stateLabels[overall] ?? STATE_LABELS[overall]}</span>
        )}
        {refreshLabel !== null && (
          <button type="button" onClick={refresh} disabled={loading} className={c.chip}>
            {loading ? "Checking…" : refreshLabel}
          </button>
        )}
      </div>
      {intro && <p className={c.intro}>{intro}</p>}
      {error && <p className={c.error}>{error}</p>}
      {loading && rows.length === 0 && <p className={c.loading}>Checking…</p>}
      {rows.length > 0 && (
        <ul className={c.list}>
          {rows.map((r) => {
            const checked = formatDateTime(r.checked_at, zone);
            return (
              <li key={r.id} className={cx(c.row, c[r.state])}>
                {renderRow ? (
                  renderRow(r, checked)
                ) : (
                  <>
                    <span className={c.dependency}>{r.dependency}</span>{" "}
                    <span className={cx(c.state, c[r.state])}>{stateLabels[r.state] ?? STATE_LABELS[r.state]}</span>
                    <p className={c.detail}>{r.detail}</p>
                    <p className={c.checked}>checked {checked}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function failedBalance(e: unknown): CheckBalanceResult {
  return { success: false, error: (e as Error).message };
}

async function proofKind(): Promise<ProofKind> {
  const claim = currentClaim();
  if (canSignFor(claim)) return { kind: "session_nsec" };
  if (!claim.proof) return { kind: "none" };
  const s = await checkProofStatus(claim.npub, claim.proof).catch(() => null);
  const status = s?.status === "valid" || s?.status === "expired" ? s.status : "unknown";
  return { kind: "dm_proof", status, expiresInSec: s?.expires_in_seconds ?? null };
}

/** The patron's own health: sign-in proof and credit balance. */
export function PatronFundingStatus({
  thresholds,
  siteRows,
  heading = "Account health",
  ...rest
}: PatronFundingStatusProps) {
  const read: Read = async () => {
    const checkedAt = new Date().toISOString();
    const [site, proof, bal] = await Promise.all([
      siteRows ? siteRows(checkedAt) : Promise.resolve([]),
      proofKind(),
      checkBalance().catch(failedBalance),
    ]);
    return [...site, composeProofRow(proof, checkedAt), composeCreditsRow(bal, checkedAt, thresholds)];
  };
  const state = useRows(read);
  return <StatusList heading={heading} {...rest} {...state} rows={state.rows ?? []} refresh={() => void state.refresh()} />;
}

/** What only the operator can fix. Renders nothing for anyone else. */
export function OperatorFundingStatus({
  authorityThresholds,
  siteRows,
  heading = "Operator dependencies",
  ...rest
}: OperatorFundingStatusProps) {
  const read: Read = async () => {
    const checkedAt = new Date().toISOString();
    // Gate first: a patron fires none of the operator's probes.
    const life = await sessionStatus();
    if (!isOperator(currentClaim().npub, life)) return null;
    const [site, svc, onb, auth] = await Promise.all([
      siteRows ? siteRows(checkedAt) : Promise.resolve([]),
      serviceStatus().catch(() => ({})),
      getOperatorOnboardingStatus().catch((e: Error) => ({ error: e.message })),
      checkAuthorityBalance().catch(failedBalance),
    ]);
    const jobs = composeDurableJobsRow(svc, checkedAt);
    return [
      ...site,
      composeOnboardingRow(onb, checkedAt),
      composeAuthorityRow(auth, checkedAt, authorityThresholds),
      composePersistenceRow(life, svc, onb, checkedAt),
      ...(jobs ? [jobs] : []),
    ];
  };
  const state = useRows(read);
  // Nothing until the viewer is known to be the operator — no flash for patrons.
  if (state.rows === null) return null;
  return <StatusList heading={heading} {...rest} {...state} rows={state.rows} refresh={() => void state.refresh()} />;
}
