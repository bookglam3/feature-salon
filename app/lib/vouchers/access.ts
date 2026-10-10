/**
 * Gift vouchers — who may do what. One pure function, used by the server
 * (public endpoints, later the purchase and apply-code routes) and by the
 * Settings page for display only. The server is the only place it is enforced.
 *
 * The three states:
 *   switch off                   → nothing public; owner still views/redeems
 *   switch on, no online payments → code entry at booking only, no online sales
 *   switch on, Stripe ready      → code entry and online sales
 *
 * Owners can ALWAYS view and redeem vouchers already sold — no switch, plan or
 * Stripe change can block that (canViewAndRedeem is always true; the route
 * checks the user owns the salon).
 *
 * No imports, so node runs it directly in scripts/test-vouchers.mjs.
 */

export type VoucherBlockReason =
  | "switch_off"           // salons.gift_vouchers_enabled is false
  | "plan"                 // plan doesn't include gift vouchers (Pro and above, or trial)
  | "stripe_not_connected" // no connected Stripe account
  | "stripe_not_ready"     // connected, but Stripe hasn't enabled charges yet
  | "online_payments_off"; // salon turned off every online payment method

export interface VoucherSalonState {
  /** hasFeatureAccess("gift_vouchers", subscription_plan, subscription_status) */
  planAllowsVouchers: boolean;
  /** salons.gift_vouchers_enabled (missing column = off) */
  vouchersEnabled: boolean | null | undefined;
  /** salons.stripe_account_id */
  stripeAccountId: string | null | undefined;
  /** salons.charges_enabled — kept in sync by Stripe's account.updated webhook */
  chargesEnabled: boolean | null | undefined;
  /** salons.payment_methods (JSON) */
  paymentMethods: unknown;
}

export interface VoucherAccess {
  canViewAndRedeem: true;
  canCreateInDashboard: boolean;
  canApplyAtBooking: boolean;
  canBuyOnline: boolean;
  applyBlockedBy: VoucherBlockReason | null;
  buyBlockedBy: VoucherBlockReason | null;
}

/** Same defaults as the booking page: a salon that never saved payment settings takes online payments. */
const PAYMENT_DEFAULTS = { full_online: true, deposit_online: true, custom_deposit: false };

/** True when at least one online payment method is on in salons.payment_methods. */
export function onlinePaymentsOn(paymentMethods: unknown): boolean {
  const saved = paymentMethods && typeof paymentMethods === "object" && !Array.isArray(paymentMethods)
    ? (paymentMethods as Record<string, unknown>)
    : {};
  const pm = { ...PAYMENT_DEFAULTS, ...saved };
  return pm.full_online === true || pm.deposit_online === true || pm.custom_deposit === true;
}

/** Same rule as create-payment-intent: a connected account with charges enabled. */
export function stripeReady(stripeAccountId: string | null | undefined, chargesEnabled: boolean | null | undefined): boolean {
  return !!stripeAccountId && chargesEnabled === true;
}

export function getVoucherAccess(s: VoucherSalonState): VoucherAccess {
  const switchOn = s.vouchersEnabled === true;

  const applyBlockedBy: VoucherBlockReason | null =
    !switchOn               ? "switch_off" :
    !s.planAllowsVouchers   ? "plan" :
    null;

  const buyBlockedBy: VoucherBlockReason | null =
    applyBlockedBy ??
    (!s.stripeAccountId                                 ? "stripe_not_connected" :
     !stripeReady(s.stripeAccountId, s.chargesEnabled) ? "stripe_not_ready" :
     !onlinePaymentsOn(s.paymentMethods)                ? "online_payments_off" :
     null);

  return {
    canViewAndRedeem: true,
    canCreateInDashboard: s.planAllowsVouchers,   // physical vouchers may be added while the switch is off
    canApplyAtBooking: applyBlockedBy === null,
    canBuyOnline: buyBlockedBy === null,
    applyBlockedBy,
    buyBlockedBy,
  };
}
