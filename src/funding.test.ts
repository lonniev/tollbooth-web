import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeAuthorityRow,
  composeCreditsRow,
  composeDurableJobsRow,
  composeOnboardingRow,
  composePersistenceRow,
  composeProofRow,
  durationText,
  isOperator,
  worstState,
  type StatusRow,
} from "./funding.ts";

const AT = "2026-09-25T12:00:00.000Z";
const NOW = Date.parse(AT);
const HOUR = 3600;

describe("patron rows", () => {
  it("never lapses a session key; blocks a missing or expired proof", () => {
    assert.equal(composeProofRow({ kind: "session_nsec" }, AT).state, "ok");
    assert.equal(composeProofRow({ kind: "none" }, AT).state, "blocked");
    assert.equal(composeProofRow({ kind: "dm_proof", status: "expired" }, AT).state, "blocked");
    assert.equal(composeProofRow({ kind: "dm_proof", status: "unknown" }, AT).state, "warning");
  });

  it("warns on a proof ending within 48 hours", () => {
    const soon = composeProofRow({ kind: "dm_proof", status: "valid", expiresInSec: 5 * HOUR }, AT);
    assert.equal(soon.state, "warning");
    assert.match(soon.detail, /5h/);
    assert.equal(composeProofRow({ kind: "dm_proof", status: "valid", expiresInSec: 72 * HOUR }, AT).state, "ok");
  });

  it("blocks an empty balance and honours the thresholds", () => {
    assert.equal(composeCreditsRow({ balance_api_sats: 0 }, AT, {}, NOW).state, "blocked");
    assert.equal(composeCreditsRow({ balance_api_sats: 40 }, AT, {}, NOW).state, "ok");
    assert.equal(composeCreditsRow({ balance_api_sats: 40 }, AT, { low: 100 }, NOW).state, "warning");
    const nearlyEmpty = composeCreditsRow({ balance_api_sats: 5 }, AT, { low: 100, empty: 10 }, NOW);
    assert.equal(nearlyEmpty.state, "blocked");
    assert.match(nearlyEmpty.detail, /Only 5 sats left/);
  });

  it("warns on tranches about to evaporate", () => {
    const row = composeCreditsRow(
      { balance_api_sats: 900, next_expiration_iso: "2026-09-26T00:00:00Z", expiring_within_24h_sats: 300 },
      AT,
      {},
      NOW,
    );
    assert.equal(row.state, "warning");
    assert.match(row.detail, /300 sats expiring; next expiry in about 12h/);
  });

  it("reads an unreachable ledger as a warning, not an empty balance", () => {
    assert.equal(composeCreditsRow({ vault_unavailable: true, balance_api_sats: 0 }, AT, {}, NOW).state, "warning");
  });

  it("stamps every row with the read time", () => {
    assert.equal(composeCreditsRow({ balance_api_sats: 10 }, AT, {}, NOW).checked_at, AT);
  });
});

describe("operator rows", () => {
  it("shows the operator panel only to the operator", () => {
    assert.equal(isOperator("npub1op", { operator_npub: "npub1op" }), true);
    assert.equal(isOperator("npub1patron", { operator_npub: "npub1op" }), false);
    assert.equal(isOperator("", { operator_npub: "" }), false);
    assert.equal(isOperator("npub1op", null), false);
  });

  it("names the credentials still to deliver", () => {
    const row = composeOnboardingRow({ missing: [{ field: "btcpay_host", category: "secret", status: "missing" }] }, AT);
    assert.equal(row.state, "blocked");
    assert.match(row.detail, /btcpay_host/);
    assert.equal(composeOnboardingRow({ ready: true, optional_missing: [{ field: "llm_api_key", category: "secret", status: "missing" }] }, AT).state, "warning");
    assert.equal(composeOnboardingRow({ ready: true }, AT).state, "ok");
  });

  it("blocks an empty Authority balance and warns when low", () => {
    assert.equal(composeAuthorityRow({ balance_api_sats: 0 }, AT).state, "blocked");
    assert.equal(composeAuthorityRow({ balance_api_sats: 50 }, AT, { low: 100 }).state, "warning");
    assert.equal(composeAuthorityRow({ balance_api_sats: 5000 }, AT, { low: 100 }).state, "ok");
    assert.equal(composeAuthorityRow({ success: false, error: "Authority balance check failed: timeout" }, AT).state, "warning");
  });

  it("reads the lifecycle before the vault", () => {
    assert.equal(composePersistenceRow({ lifecycle: "quota_exceeded" }, {}, {}, AT).state, "blocked");
    assert.equal(composePersistenceRow({ lifecycle: "warming_up" }, {}, {}, AT).state, "warning");
    assert.equal(composePersistenceRow({ lifecycle: "ready" }, { vault_configured: false }, {}, AT).state, "blocked");
    assert.equal(composePersistenceRow({ lifecycle: "ready" }, { vault_configured: true }, { vault_ok: true }, AT).state, "ok");
  });

  it("has no job row for a server that runs no jobs", () => {
    assert.equal(composeDurableJobsRow({}, AT), null);
    const memory = composeDurableJobsRow(
      { async_jobs: { docket_url_set: false, backend: "memory (default)", durable_across_recycles: false } },
      AT,
    );
    assert.equal(memory?.state, "warning");
  });
});

describe("summaries", () => {
  it("takes the worst state", () => {
    const r = (state: StatusRow["state"]): StatusRow => ({ id: state, dependency: "", state, detail: "", checked_at: AT });
    assert.equal(worstState([]), "ok");
    assert.equal(worstState([r("ok"), r("warning")]), "warning");
    assert.equal(worstState([r("blocked"), r("warning")]), "blocked");
  });

  it("writes durations briefly", () => {
    assert.deepEqual([durationText(0), durationText(90), durationText(5 * HOUR), durationText(72 * HOUR)], ["now", "1m", "5h", "3d"]);
  });
});
