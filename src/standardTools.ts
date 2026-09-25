/**
 * Typed wrappers for the tools every operator gets from
 * `register_standard_tools` in the tollbooth-dpyc wheel.
 */

import { callTool } from "./client.ts";

export interface ServiceStatus {
  operator_npub_hash?: string;
  lifecycle?: string;
  message?: string;
  version?: string;
  tollbooth_dpyc_version?: string;
  service?: string;
  slug?: string;
}

export function serviceStatus(): Promise<ServiceStatus> {
  return callTool<ServiceStatus>("service_status", {}, { bestEffort: true });
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
): Promise<NpubProofResult> {
  return callTool<NpubProofResult>("request_npub_proof", {
    patron_npub: patronNpub,
    ...(verifyAt ? { verify_at: verifyAt } : {}),
    ...(reason ? { reason } : {}),
  });
}

/**
 * Step 2: drain DMs for the signed reply to step 1. Call only after the human
 * says they replied — it is destructive, so never poll it.
 */
export function receiveNpubProof(patronNpub: string, dpopToken: string): Promise<NpubProofResult> {
  return callTool<NpubProofResult>("receive_npub_proof", {
    patron_npub: patronNpub,
    dpop_token: dpopToken,
  });
}

export interface ProofStatusResult {
  success?: boolean;
  status?: "valid" | "expired" | "unknown" | string;
  expires_in_seconds?: number | null;
  error?: string;
  error_code?: string;
}

export function checkProofStatus(patronNpub: string, dpopToken: string): Promise<ProofStatusResult> {
  return callTool<ProofStatusResult>(
    "check_proof_status",
    { patron_npub: patronNpub, dpop_token: dpopToken },
    { bestEffort: true },
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
  error?: string;
  error_code?: string;
}

export function checkBalance(): Promise<CheckBalanceResult> {
  return callTool<CheckBalanceResult>("check_balance", {});
}

export interface CheckPriceResult {
  success: boolean;
  tool_id?: string;
  base_cost_api_sats?: number;
  effective_cost_api_sats?: number;
  error?: string;
  error_code?: string;
}

/**
 * The fare for one tool in api_sats, as the live pricing model resolves it,
 * constraints included — keyed by the tool's frozen UUID. Null when unreadable:
 * show the answer without a price rather than invent one.
 */
export async function checkPrice(toolId: string): Promise<number | null> {
  const r = await callTool<CheckPriceResult>("check_price", { tool_id: toolId });
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

export function purchaseCredits(sats: number): Promise<PurchaseCreditsResult> {
  return callTool<PurchaseCreditsResult>("purchase_credits", { amount_sats: sats });
}

export interface CheckPaymentResult {
  success?: boolean;
  status?: "New" | "Processing" | "Settled" | "Expired" | "Invalid" | string;
  message?: string;
  invoice_id?: string;
  credits_granted?: number;
  balance_api_sats?: number;
  error?: string;
  error_code?: string;
}

export function checkPayment(invoiceId: string): Promise<CheckPaymentResult> {
  return callTool<CheckPaymentResult>("check_payment", { invoice_id: invoiceId });
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

export function getAccountStatement(days = 30): Promise<AccountStatementResult> {
  return callTool<AccountStatementResult>("account_statement", { days });
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
export function listMyCoupons(): Promise<ListMyCouponsResult> {
  return callTool<ListMyCouponsResult>("list_my_coupons", {});
}

/** Redeem an operator's code once; the discount then applies on its own. Free. */
export function redeemCoupon(code: string): Promise<RedeemCouponResult> {
  return callTool<RedeemCouponResult>("redeem_coupon", { code });
}

/** Take a coupon off the patron's list. The code stays re-redeemable while its window allows. */
export function forgetCoupon(couponId: string): Promise<ForgetCouponResult> {
  return callTool<ForgetCouponResult>("forget_coupon", { coupon_id: couponId });
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

export function getNostrProfile(npub: string): Promise<GetNostrProfileResult> {
  return callTool<GetNostrProfileResult>("get_nostr_profile", { npub });
}

export interface PublishNostrProfileResult {
  success: boolean;
  ok?: number;
  total?: number;
  errors?: string[];
  error?: string;
}

/** Relay a kind-0 the BROWSER signed. The wheel verifies it and fans it out. */
export function publishNostrProfile(npub: string, signedEvent: string): Promise<PublishNostrProfileResult> {
  return callTool<PublishNostrProfileResult>("publish_nostr_profile", {
    npub,
    signed_event: signedEvent,
  });
}
