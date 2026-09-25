/**
 * Typed wrappers for the tools every operator gets from
 * `register_standard_tools` in the tollbooth-dpyc wheel.
 *
 * Every wrapper takes the same optional `CallOptions` as `callTool`, last.
 * A wrapper that is best-effort by default stays so unless the caller says
 * otherwise; what the caller passes wins.
 */

import { callTool, type CallOptions } from "./client.ts";

/** What a patron must supply beyond the npub proof, per the wheel's `patron_auth_block`. */
export interface PatronAuth {
  mode: "oauth" | "secure_courier" | "none";
  patron_credentials_required: boolean;
  /** mode "oauth": the provider's credential service. */
  oauth_service?: string;
  /** mode "secure_courier": the service a patron delivers secrets to. */
  credential_service?: string;
}

/** The wheel's `service_status`: health and build facts, free and unauthenticated. */
export interface ServiceStatus {
  success?: boolean;
  service?: string;
  slug?: string;
  version?: string;
  tollbooth_dpyc_version?: string;
  vault_configured?: boolean;
  courier_has_vault?: boolean;
  operator_npub_hash?: string;
  process_id?: number;
  /** Deploy metadata from the environment (commit, build time, …), lower-cased keys. */
  build_info?: Record<string, string> | null;
  patron_auth?: PatronAuth;
  /** Only on a server that runs background jobs. */
  async_jobs?: { docket_url_set: boolean; backend: string; durable_across_recycles: boolean };
  durable_jobs?: {
    modal_app: string | null;
    detached_executor_active: boolean;
    detached_executor_resolved: boolean;
    detached_executor_error: string | null;
    last_dispatch_error: string | null;
    dispatching: boolean;
  };
  lifecycle?: string;
  message?: string;
}

export function serviceStatus(opts?: CallOptions): Promise<ServiceStatus> {
  return callTool<ServiceStatus>("service_status", {}, { bestEffort: true, ...opts });
}

export interface NpubProofResult {
  success?: boolean;
  proven_npub?: string;
  status?: string;
  message?: string;
  dpop_token?: string;
  expires_in_seconds?: number;
  expires_at?: string;
  error?: string;
  error_code?: string;
}

/**
 * Step 1 of DM sign-in: a Secure Courier challenge DM to the npub. Free.
 *
 * `verifyAt` is the RFC 8628 verification venue — the place THIS app shows the
 * session phrase. The DM names it so the human can cross-check that the code
 * in the DM is the one on their own screen; an impostor firing the same tool
 * from elsewhere cannot make the patron's open tab show the attacker's code.
 */
export function requestNpubProof(
  patronNpub: string,
  verifyAt?: string,
  reason?: string,
  opts?: CallOptions,
): Promise<NpubProofResult> {
  return callTool<NpubProofResult>(
    "request_npub_proof",
    {
      patron_npub: patronNpub,
      ...(verifyAt ? { verify_at: verifyAt } : {}),
      ...(reason ? { reason } : {}),
    },
    opts,
  );
}

/**
 * Step 2: drain DMs for the signed reply to step 1. Call only after the human
 * says they replied — it is destructive, so never poll it.
 */
export function receiveNpubProof(patronNpub: string, dpopToken: string, opts?: CallOptions): Promise<NpubProofResult> {
  return callTool<NpubProofResult>(
    "receive_npub_proof",
    { patron_npub: patronNpub, dpop_token: dpopToken },
    opts,
  );
}

export interface ProofStatusResult {
  success?: boolean;
  status?: "valid" | "expired" | "unknown" | string;
  expires_in_seconds?: number | null;
  error?: string;
  error_code?: string;
}

export function checkProofStatus(patronNpub: string, dpopToken: string, opts?: CallOptions): Promise<ProofStatusResult> {
  return callTool<ProofStatusResult>(
    "check_proof_status",
    { patron_npub: patronNpub, dpop_token: dpopToken },
    { bestEffort: true, ...opts },
  );
}

/** One credit tranche: a purchase (or grant) and what is left of it. */
export interface CreditTranche {
  id: string;
  amount_sats: number;
  remaining_sats: number;
  expires_at: string | null;
  created_at: string | null;
}

export interface CheckBalanceResult {
  success?: boolean;
  balance_api_sats?: number;
  total_deposited_api_sats?: number;
  total_consumed_api_sats?: number;
  total_expired_api_sats?: number;
  pending_invoices?: number;
  pending_invoice_ids?: string[];
  last_deposit_at?: string | null;
  next_expiration_iso?: string;
  expiring_within_24h_sats?: number;
  active_tranches?: number;
  tranches?: CreditTranche[];
  expired_tranches?: CreditTranche[];
  seed_balance_granted?: boolean;
  /** The ledger could not be read: the figures may be stale or zero. */
  vault_unavailable?: boolean;
  warning?: string;
  today_usage?: Record<string, { calls: number; api_sats: number }>;
  invoice_summary?: {
    total_invoices: number;
    settled_count: number;
    pending_count: number;
    total_real_sats: number;
    total_api_sats_credited: number;
  };
  error?: string;
  error_code?: string;
}

export function checkBalance(opts?: CallOptions): Promise<CheckBalanceResult> {
  return callTool<CheckBalanceResult>("check_balance", {}, opts);
}

export interface ConstraintEffect {
  type: string;
  message?: string;
  [key: string]: unknown;
}

/** The wheel's `check_price` preview. */
export interface CheckPriceResult {
  success: boolean;
  tool_id?: string;
  tool_name?: string;
  /** "flat" | "flat+multipliers" | "percent" */
  pricing_type?: string;
  base_cost_api_sats?: number | null;
  effective_cost_api_sats?: number | null;
  rate_percent?: number;
  rate_param?: string;
  min_cost_sats?: number;
  multipliers?: Record<string, unknown>;
  constraints_enabled?: boolean;
  constraint_effects?: ConstraintEffect[];
  hint?: string;
  error?: string;
  error_code?: string;
}

/**
 * The fare for one tool in api_sats, as the live pricing model resolves it,
 * constraints included — keyed by the tool's frozen UUID (or its capability
 * name). `toolKwargs` are the call's own parameters, for a tool priced by
 * them (ad valorem, or a multiplier on a categorical argument). Null when
 * unreadable: show the answer without a price rather than invent one.
 */
export async function checkPrice(
  toolId: string,
  toolKwargs?: Record<string, unknown>,
  opts?: CallOptions,
): Promise<number | null> {
  const r = await callTool<CheckPriceResult>(
    "check_price",
    { tool_id: toolId, ...(toolKwargs ? { tool_kwargs: JSON.stringify(toolKwargs) } : {}) },
    opts,
  );
  const v = r.effective_cost_api_sats ?? r.base_cost_api_sats;
  return typeof v === "number" ? v : null;
}

export interface PurchaseCreditsResult {
  success?: boolean;
  invoice_id?: string;
  checkout_link?: string;
  lightning_invoice?: string;
  payment_request?: string;
  expires_at?: string;
  amount_sats?: number;
  error?: string;
  error_code?: string;
}

export function purchaseCredits(sats: number, opts?: CallOptions): Promise<PurchaseCreditsResult> {
  return callTool<PurchaseCreditsResult>("purchase_credits", { amount_sats: sats }, opts);
}

export interface CheckPaymentResult {
  success?: boolean;
  status?: "New" | "Processing" | "Settled" | "Expired" | "Invalid" | string;
  message?: string;
  invoice_id?: string;
  credits_granted?: number;
  balance_api_sats?: number;
  amount_sats?: number;
  /** false: the credit could not be written; nothing was granted. */
  persisted?: boolean;
  source?: string;
  error?: string;
  error_code?: string;
}

export function checkPayment(invoiceId: string, opts?: CallOptions): Promise<CheckPaymentResult> {
  return callTool<CheckPaymentResult>("check_payment", { invoice_id: invoiceId }, opts);
}

export interface StatementInvoice {
  invoice_id: string;
  status: string;
  amount_sats: number;
  api_sats_credited: number;
  multiplier?: number;
  created_at: string | null;
  settled_at?: string;
}

export interface StatementTranche {
  granted_at: string | null;
  original_sats: number;
  remaining_sats: number;
  invoice_id: string | null;
  expires_at?: string;
}

export interface StatementToolUsage {
  tool: string;
  calls: number;
  api_sats: number;
}

export interface StatementDay {
  date: string;
  total_calls: number;
  total_api_sats: number;
  tools: Record<string, { calls: number; api_sats: number }>;
}

/** The wheel's `account_statement`: history, tranches and usage, newest first. */
export interface AccountStatementResult {
  success?: boolean;
  generated_at?: string;
  statement_period_days?: number;
  account_summary?: {
    balance_api_sats: number;
    total_deposited_api_sats: number;
    total_consumed_api_sats: number;
    total_expired_api_sats: number;
  };
  purchase_history?: StatementInvoice[];
  active_tranches?: StatementTranche[];
  tool_usage_all_time?: StatementToolUsage[];
  daily_usage?: StatementDay[];
  error?: string;
  error_code?: string;
}

export function getAccountStatement(days = 30, opts?: CallOptions): Promise<AccountStatementResult> {
  return callTool<AccountStatementResult>("account_statement", { days }, opts);
}

// ─── Coupons (patron side) ───────────────────────────────────────────────

export interface PatronCoupon {
  coupon_id: string;
  name: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  uses_per_patron: number | null;
  use_count: number;
  uses_remaining: number | null;
  total_uses: number | null;
  total_remaining: number | null;
  /** active | window_closed | window_not_started | patron_limit | total_limit */
  status: string;
}

export interface ListMyCouponsResult {
  success?: boolean;
  count?: number;
  coupons?: PatronCoupon[];
  error?: string;
  error_code?: string;
}

export interface RedeemCouponResult {
  success?: boolean;
  coupon_id?: string;
  name?: string;
  discount_percent?: number;
  valid_until?: string;
  uses_remaining?: number | null;
  uses_per_patron?: number | null;
  error?: string;
  error_code?: string;
}

export interface ForgetCouponResult {
  success?: boolean;
  coupon_id?: string;
  error?: string;
  error_code?: string;
}

/** The coupons this patron has redeemed here. Free. */
export function listMyCoupons(opts?: CallOptions): Promise<ListMyCouponsResult> {
  return callTool<ListMyCouponsResult>("list_my_coupons", {}, opts);
}

/** Redeem an operator's code once; the discount then applies on its own. Free. */
export function redeemCoupon(code: string, opts?: CallOptions): Promise<RedeemCouponResult> {
  return callTool<RedeemCouponResult>("redeem_coupon", { code }, opts);
}

/** Take a coupon off the patron's list. The code stays re-redeemable while its window allows. */
export function forgetCoupon(couponId: string, opts?: CallOptions): Promise<ForgetCouponResult> {
  return callTool<ForgetCouponResult>("forget_coupon", { coupon_id: couponId }, opts);
}

// ─── Nostr kind-0 profile (the wheel does the relay I/O) ─────────────────

export interface Kind0 {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
}

export interface GetNostrProfileResult {
  success: boolean;
  npub?: string;
  profile?: Kind0;
  error?: string;
}

export function getNostrProfile(npub: string, opts?: CallOptions): Promise<GetNostrProfileResult> {
  return callTool<GetNostrProfileResult>("get_nostr_profile", { npub }, opts);
}

export interface PublishNostrProfileResult {
  success: boolean;
  ok?: number;
  total?: number;
  errors?: string[];
  error?: string;
}

/** Relay a kind-0 the BROWSER signed. The wheel verifies it and fans it out. */
export function publishNostrProfile(
  npub: string,
  signedEvent: string,
  opts?: CallOptions,
): Promise<PublishNostrProfileResult> {
  return callTool<PublishNostrProfileResult>("publish_nostr_profile", { npub, signed_event: signedEvent }, opts);
}

// ─── Operator readiness ──────────────────────────────────────────────────

/** Every lifecycle `session_status` reports. */
export type SessionLifecycle =
  | "ready"
  | "warming_up"
  | "misconfigured"
  | "quota_exceeded"
  | "not_registered"
  | "no_identity";

/** The patron's stored upstream OAuth token, when the operator has a provider. */
export interface UpstreamOAuth {
  service: string;
  has_access_token: boolean;
  has_refresh_token: boolean;
  refresh_enabled: boolean;
  access_token_expires_at?: number;
  access_token_expires_in_seconds?: number;
}

export interface SessionStatusResult {
  success?: boolean;
  lifecycle?: SessionLifecycle;
  message?: string;
  operator_npub?: string;
  /** Why it is not ready, from the failing layer. */
  detail?: string;
  operator_credential_service?: string;
  patron_credential_service?: string;
  upstream_oauth?: UpstreamOAuth;
  /** The vault could not answer — not the same as "never authorized". */
  upstream_oauth_unreadable?: string;
  error?: string;
  error_code?: string;
}

/**
 * Is the operator ready to serve? Free, no proof. With `patronNpub`, also the
 * patron's upstream OAuth token expiry, so a page can refresh ahead of time.
 */
export function sessionStatus(patronNpub?: string, opts?: CallOptions): Promise<SessionStatusResult> {
  return callTool<SessionStatusResult>(
    "session_status",
    patronNpub ? { patron_npub: patronNpub } : {},
    { bestEffort: true, ...opts },
  );
}

export interface OnboardingItem {
  field: string;
  /** "identity" | "authority" | "secret" */
  category: string;
  /** "configured" | "missing" | "unknown" */
  status: string;
  how?: string;
  lifecycle?: string;
  delivered_at?: string | null;
}

/** The wheel's `get_operator_onboarding_status`: what the operator still has to set up. */
export interface OperatorOnboardingStatus {
  ready?: boolean;
  configured?: OnboardingItem[];
  missing?: OnboardingItem[];
  optional_missing?: OnboardingItem[];
  summary?: string;
  bootstrap_error?: string;
  vault_ok?: boolean;
  /** Set when the credential vault could not be read: nothing is known either way. */
  vault_situation?: string;
  credential_greeting?: string | null;
  credential_service?: string | null;
  operator_name?: string;
  error?: string;
  error_code?: string;
}

export function getOperatorOnboardingStatus(opts?: CallOptions): Promise<OperatorOnboardingStatus> {
  return callTool<OperatorOnboardingStatus>("get_operator_onboarding_status", {}, { bestEffort: true, ...opts });
}

/**
 * The operator's own balance at its Authority — what certifies patron top-ups.
 * The Authority's ledger, in the same shape as a patron's `check_balance`.
 */
export function checkAuthorityBalance(opts?: CallOptions): Promise<CheckBalanceResult> {
  return callTool<CheckBalanceResult>("check_authority_balance", {}, { bestEffort: true, ...opts });
}

// ─── Pricing model and tool identities ───────────────────────────────────

export interface PricingStep {
  id: string;
  type: string;
  params?: Record<string, unknown>;
  patron_npubs?: string[];
}

export interface ToolPrice {
  tool_id: string;
  tool_name: string;
  price_sats: number;
  category: string;
  intent: string;
  priced: boolean;
  price_type?: string;
  price_formula?: unknown;
  min_cost?: number;
  max_cost?: number;
  multipliers?: Record<string, unknown>;
  chain?: PricingStep[];
}

/** The wheel's `get_pricing_model`. `status` is "ok" or "error". */
export interface PricingModelResult {
  status?: string;
  model_id?: string | null;
  name?: string | null;
  is_active?: boolean | null;
  tools?: ToolPrice[] | null;
  tranche_lifetime?: { target_usage_pct: number; ttl_days?: number; min_days?: number; max_days?: number };
  error?: string;
}

/** The operator's active pricing model. Free, no proof. */
export function getPricingModel(opts?: CallOptions): Promise<PricingModelResult> {
  return callTool<PricingModelResult>("get_pricing_model", {}, opts);
}

export interface CanonicalIdentity {
  tool_id: string;
  mcp_name: string;
  category: string;
  intent: string;
  capability: string;
  registered: boolean;
  reason?: string;
}

/** The wheel's `list_canonical_identities`: every tool's frozen UUID and wire name. */
export interface CanonicalIdentitiesResult {
  success?: boolean;
  operator_npub?: string;
  count?: number;
  unregistered_count?: number;
  tools?: CanonicalIdentity[];
  unregistered?: Array<{ mcp_name: string; reason: string; [key: string]: unknown }>;
  error?: string;
}

export function listCanonicalIdentities(opts?: CallOptions): Promise<CanonicalIdentitiesResult> {
  return callTool<CanonicalIdentitiesResult>("list_canonical_identities", {}, opts);
}

// ─── Patron credentials ──────────────────────────────────────────────────
// Values go in, never out: the wheel returns field names only, and the call
// log scrubs any `value` sent beside a `field`.

export interface PatronCredentialFieldsResult {
  success?: boolean;
  fields?: string[];
  /** Per field, when it was delivered; null for secrets vaulted before stamps. */
  delivered_at?: Record<string, string | null>;
  count?: number;
  error?: string;
  error_code?: string;
}

export interface PatronCredentialWriteResult {
  success?: boolean;
  message?: string;
  error?: string;
  error_code?: string;
}

/** The names of the patron's stored credential fields — never their values. */
export function getPatronCredentialFields(opts?: CallOptions): Promise<PatronCredentialFieldsResult> {
  return callTool<PatronCredentialFieldsResult>("get_patron_credential_fields", {}, opts);
}

/** Set one credential field, leaving the others as they are. */
export function updatePatronCredential(
  field: string,
  value: string,
  opts?: CallOptions,
): Promise<PatronCredentialWriteResult> {
  // `field` first: the log's scrubber keys on it to hide `value`.
  return callTool<PatronCredentialWriteResult>("update_patron_credential", { field, value }, opts);
}

/** Remove one credential field, leaving the others as they are. */
export function deletePatronCredential(field: string, opts?: CallOptions): Promise<PatronCredentialWriteResult> {
  return callTool<PatronCredentialWriteResult>("delete_patron_credential", { field }, opts);
}
