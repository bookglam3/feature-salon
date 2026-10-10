/**
 * Server-side voucher access: reads the salon from the database with the
 * service role and applies the rules in ./access. Every public voucher route
 * (config now; purchase and apply-code later) goes through here, so the
 * browser never decides what is allowed.
 *
 * charges_enabled comes from the database (kept in sync by Stripe's
 * account.updated webhook and /api/stripe-connect/status). The purchase route
 * (step 4) will also re-check the account live with Stripe before charging.
 */
import { createClient } from "@supabase/supabase-js";
import { hasFeatureAccess } from "@/app/lib/featureAccess";
import { getVoucherAccess, type VoucherAccess } from "./access";

const SALON_COLUMNS =
  "id, subscription_plan, subscription_status, gift_vouchers_enabled, stripe_account_id, charges_enabled, payment_methods";

export type VoucherAccessLookup =
  | { found: true; salonId: string; access: VoucherAccess }
  | { found: false };

/**
 * Throws if the database can't be read (including before the step 1 SQL has
 * been run, when gift_vouchers_enabled doesn't exist yet) — callers must treat
 * that as "not allowed".
 */
export async function loadVoucherAccess(where: { salonId: string } | { slug: string }): Promise<VoucherAccessLookup> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const query = db.from("salons").select(SALON_COLUMNS);
  const { data: salon, error } = "salonId" in where
    ? await query.eq("id", where.salonId).maybeSingle()
    : await query.eq("slug", where.slug).maybeSingle();
  if (error) throw new Error(`voucher access lookup failed: ${error.message}`);
  if (!salon) return { found: false };

  return {
    found: true,
    salonId: salon.id,
    access: getVoucherAccess({
      planAllowsVouchers: hasFeatureAccess("gift_vouchers", salon.subscription_plan, salon.subscription_status),
      vouchersEnabled: salon.gift_vouchers_enabled,
      stripeAccountId: salon.stripe_account_id,
      chargesEnabled: salon.charges_enabled,
      paymentMethods: salon.payment_methods,
    }),
  };
}
