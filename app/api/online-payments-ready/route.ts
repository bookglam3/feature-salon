import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/online-payments-ready?salon_id=<uuid> — public.
// Tells the booking page whether this business can take online payments:
// a connected Stripe account with charges enabled. Returns only { ready } —
// never the account id or any other field. Display only: create-payment-intent
// refuses on its own when the salon isn't ready.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const salonId = req.nextUrl.searchParams.get("salon_id") ?? "";
  if (!UUID.test(salonId)) {
    return NextResponse.json({ error: "Invalid salon_id" }, { status: 400, headers: NO_STORE });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: salon, error } = await supabaseAdmin
    .from("salons")
    .select("stripe_account_id, charges_enabled")
    .eq("id", salonId)
    .maybeSingle();
  if (error) {
    console.error("[online-payments-ready] salon lookup failed:", error.message);
    return NextResponse.json({ error: "Could not check payment setup" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { ready: !!salon?.stripe_account_id && salon?.charges_enabled === true },
    { headers: NO_STORE },
  );
}
