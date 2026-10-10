/**
 * Server-only helpers for the owner's Gift Vouchers routes.
 *
 * requireOwner: checks the Supabase session token, then loads the salon the
 * owner is working in (the active branch they picked, or their first salon).
 * Every voucher function is then called with that salon's id, so an owner can
 * only ever see or change their own salon's vouchers.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasFeatureAccess } from "@/app/lib/featureAccess";
import { getVoucherAccess, type VoucherAccess } from "./access";
import { isUuid, voucherErrorMessage } from "./input";

export const NO_STORE = { "Cache-Control": "no-store" };

export interface OwnerContext {
  db: SupabaseClient;
  userId: string;
  salonId: string;
  access: VoucherAccess;
}

const SALON_COLUMNS =
  "id, subscription_plan, subscription_status, gift_vouchers_enabled, stripe_account_id, charges_enabled, payment_methods";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function requireOwner(req: NextRequest, salonIdHint: unknown): Promise<OwnerContext | NextResponse> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail(401, "Please sign in again.");

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return fail(401, "Please sign in again.");

  const hint = salonIdHint === null || salonIdHint === undefined || salonIdHint === "" ? null : salonIdHint;
  if (hint !== null && !isUuid(hint)) return fail(400, "Unknown salon.");

  let query = db.from("salons").select(SALON_COLUMNS).eq("owner_id", user.id);
  if (hint) query = query.eq("id", hint);
  const { data: salons, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error) {
    console.error("[vouchers] salon lookup failed:", error.message);
    return fail(500, "Something went wrong. Please try again.");
  }
  const salon = salons?.[0];
  if (!salon) return fail(403, "You don't have access to this salon.");

  return {
    db,
    userId: user.id,
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

/** Turns a database function error into a clear message (and logs anything unexpected). */
export function rpcFailure(fn: string, error: { message?: string; details?: string | null; code?: string }) {
  const mapped = voucherErrorMessage(error.message, error.details);
  if (mapped.status === 500) console.error(`[vouchers] ${fn} failed:`, error.code, error.message);
  return NextResponse.json(
    { error: mapped.message, code: mapped.status === 500 ? undefined : error.message },
    { status: mapped.status, headers: NO_STORE },
  );
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
