import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || "5") / 100;

export async function POST(req: NextRequest) {
  try {
    const {
      email, booking_id,
      salon_name, service_name, deposit_only,
    } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    // Server-side price + salon lookup — never trust client-supplied amounts or routing
    const { data: apptData } = await supabaseAdmin
      .from("appointments")
      .select("salon_id, services(price, price_is_from)")
      .eq("id", booking_id)
      .single();

    const services = apptData?.services as { price?: number; price_is_from?: boolean } | null;
    const servicePrice = services?.price;
    if (!servicePrice || servicePrice <= 0) {
      return NextResponse.json({ error: "Could not determine service price" }, { status: 400 });
    }

    // A variable-priced ("from £X") service can't be charged in full online —
    // the final amount is unknown and there's no balance-due flow, so the salon
    // would be locked into charging the listed floor price. Client-side hiding
    // of the option is not security; this is the real enforcement.
    if (!deposit_only && services?.price_is_from) {
      return NextResponse.json(
        { error: "This service has a variable price and can't be paid in full online. Please choose a deposit or pay at the salon." },
        { status: 400 },
      );
    }

    // Resolve salon from DB (not client body) to prevent Connect routing injection
    const resolvedSalonId = (apptData as { salon_id?: string } | null)?.salon_id ?? null;
    let stripeAccountId: string | null = null;
    let depositPercent = 50; // deposit_online's fixed rate — the default when the salon isn't using a custom percentage
    if (resolvedSalonId) {
      const { data: salon } = await supabaseAdmin
        .from("salons")
        .select("stripe_account_id, charges_enabled, payment_methods")
        .eq("id", resolvedSalonId)
        .single();
      if (salon?.stripe_account_id && salon?.charges_enabled) {
        stripeAccountId = salon.stripe_account_id;
      }
      // Never trust the client-supplied charge amount for the deposit percentage
      // either — re-derive it from the salon's own configured rate so the
      // amount Stripe actually charges always matches what the client was shown.
      const pm = salon?.payment_methods as { custom_deposit?: boolean; deposit_percent?: number } | null;
      if (pm?.custom_deposit && typeof pm.deposit_percent === "number" && pm.deposit_percent > 0 && pm.deposit_percent < 100) {
        depositPercent = pm.deposit_percent;
      }
    }

    const chargeAmount = deposit_only
      ? Math.round(servicePrice * (depositPercent / 100) * 100)
      : Math.round(servicePrice * 100);

    const platformFee = stripeAccountId ? Math.round(chargeAmount * PLATFORM_FEE_PERCENT) : undefined;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency: "gbp",
      receipt_email: email,
      description: `${salon_name || "Salon"} – ${service_name || "Appointment"}${deposit_only ? ` (${depositPercent}% Deposit)` : ""}`,
      metadata: {
        booking_id:    booking_id || "",
        salon_name:    salon_name || "",
        service_name:  service_name || "",
        deposit_only:  deposit_only ? "true" : "false",
        full_amount:   String(Math.round(servicePrice * 100)),
        salon_id:      resolvedSalonId || "",
      },
      // Destination charge — routes payment to salon's Stripe account
      ...(stripeAccountId && {
        transfer_data:        { destination: stripeAccountId },
        application_fee_amount: platformFee,
      }),
    });

    return NextResponse.json({
      clientSecret:     paymentIntent.client_secret,
      paymentIntentId:  paymentIntent.id,
      chargeAmount,
      platformFee:      platformFee ? platformFee / 100 : 0,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}