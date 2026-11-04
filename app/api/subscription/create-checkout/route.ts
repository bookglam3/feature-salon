import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
export const dynamic = "force-dynamic";

const PRICE_MAP: Record<string, string> = {
  starter:  process.env.STRIPE_STARTER_PRICE_ID  || "",
  pro:      process.env.STRIPE_PRO_PRICE_ID       || "",
  business: process.env.STRIPE_BUSINESS_PRICE_ID  || "",
};

export async function POST(req: NextRequest) {
  try {
    // Auth: verify Supabase session
    const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only plan comes from body — salonId/email/name come from DB/session
    const { plan } = await req.json();
    if (!plan) return NextResponse.json({ error: "Missing plan" }, { status: 400 });

    const priceId = PRICE_MAP[plan];
    if (!priceId) return NextResponse.json({ error: "Invalid plan: " + plan }, { status: 400 });

    // Ownership: look up salon by owner_id — never trust salonId from body
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id, name, stripe_customer_id, trial_ends_at")
      .eq("owner_id", user.id)
      .single();

    if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
    const salonId = salon.id;

    // Get or create Stripe customer
    let customerId = salon.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    user.email    || undefined,
        name:     salon.name   || undefined,
        metadata: { salon_id: salonId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("salons")
        .update({ stripe_customer_id: customerId })
        .eq("id", salonId);
    }

    // Only grant a free trial if the salon's original 14-day trial window
    // hasn't already elapsed. Without this check, a salon reactivating
    // AFTER their trial expired would get a brand-new 14-day trial instead
    // of being charged immediately — the exact "customer can't pay us" bug.
    //
    // Stripe also requires subscription_data.trial_end to be at least 48 hours
    // in the future, or Checkout Session creation fails. So the existing trial
    // end is only passed when at least 48 hours (plus 5 minutes of margin)
    // remain; with less time left the salon is charged straight away.
    const TRIAL_END_MIN_LEAD_MS = (48 * 60 + 5) * 60 * 1000;
    const trialEndsAtMs = salon.trial_ends_at ? new Date(salon.trial_ends_at).getTime() : 0;
    const keepTrialEnd = trialEndsAtMs - Date.now() >= TRIAL_END_MIN_LEAD_MS;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 "subscription",
      payment_method_types: ["card"],
      line_items:           [{ price: priceId, quantity: 1 }],
      client_reference_id:  salonId,
      subscription_data: {
        metadata: { salon_id: salonId, plan },
        // Align to their existing trial end rather than resetting to a
        // fresh 14 days; omitted entirely (charge immediately) once expired
        // or when less than 48h 5m remain (Stripe's 48-hour minimum).
        ...(keepTrialEnd ? { trial_end: Math.floor(trialEndsAtMs / 1000) } : {}),
      },
      success_url:                `${appUrl}/dashboard?subscription=success&plan=${plan}`,
      cancel_url:                 `${appUrl}/subscribe?cancelled=true`,
      metadata:                   { salon_id: salonId, plan },
      allow_promotion_codes:      true,
      billing_address_collection: "auto",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[create-checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
