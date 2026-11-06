import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { chargePence, onlineChargeOption } from "@/app/lib/payments/bookingPayment";

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
      charge_amount, // £ the booking page showed — only compared, never charged
    } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    if (!booking_id) {
      return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
    }

    // Server-side price + salon lookup — never trust client-supplied amounts or routing.
    // salon_id and the single-service join are fetched unconditionally — salon_id is
    // needed regardless of pricing path, and the single-service join is the
    // backward-compat fallback source of truth when no line items exist.
    const { data: apptData, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("salon_id, status, payment_status, payment_method, services(price, price_is_from)")
      .eq("id", booking_id)
      .maybeSingle();
    if (apptError) {
      return NextResponse.json({ error: "Could not verify payment setup" }, { status: 500 });
    }

    // Resolve salon from DB (not client body) to prevent Connect routing injection
    const appt = apptData as { salon_id?: string; status?: string; payment_status?: string; payment_method?: string | null } | null;
    const resolvedSalonId = appt?.salon_id ?? null;
    if (!resolvedSalonId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only a booking that is waiting for its online payment can be charged —
    // never a pay-at-salon, already paid or cancelled one.
    if (appt?.status !== "pending" || appt?.payment_status !== "pending") {
      return NextResponse.json(
        { error: "This booking doesn't need an online payment.", code: "not_awaiting_payment" },
        { status: 409 },
      );
    }

    // Multi-service line items, if any exist for this appointment. Empty for
    // every appointment made before multi-service shipped, and for every
    // single-service booking made before a client ever selects 2+ services —
    // the branch below is byte-identical to the old single-service logic in
    // that case, not just similar to it.
    const { data: lineItems, error: lineItemsError } = await supabaseAdmin
      .from("appointment_services")
      .select("price, price_is_from")
      .eq("appointment_id", booking_id);

    if (lineItemsError) {
      // A real query failure is NOT the same as "no line items" — never
      // silently fall back to single-service pricing on an actual DB error,
      // that risks under-charging a genuine multi-service booking.
      return NextResponse.json({ error: "Could not determine service price" }, { status: 500 });
    }

    let totalPrice: number;
    let anyPriceIsFrom: boolean;

    if (lineItems && lineItems.length > 0) {
      // Multi-service path. price is numeric(10,2) in Postgres, which
      // PostgREST returns as a STRING (e.g. "40.00"), not a number — bare
      // `sum + li.price` would silently string-concatenate from the second
      // item onward instead of adding. Number(...) is deliberate, not decorative.
      totalPrice = lineItems.reduce((sum, li) => sum + Number(li.price), 0);
      anyPriceIsFrom = lineItems.some(li => li.price_is_from === true);
    } else {
      // Backward-compat path — identical to the pre-multi-service logic.
      const services = apptData?.services as { price?: number; price_is_from?: boolean } | null;
      totalPrice = services?.price ?? 0;
      anyPriceIsFrom = !!services?.price_is_from;
    }

    if (!totalPrice || totalPrice <= 0) {
      return NextResponse.json({ error: "Could not determine service price" }, { status: 400 });
    }

    const { data: salon, error: salonError } = await supabaseAdmin
      .from("salons")
      .select("stripe_account_id, charges_enabled, payment_methods")
      .eq("id", resolvedSalonId)
      .maybeSingle();
    if (salonError) {
      return NextResponse.json({ error: "Could not verify payment setup" }, { status: 500 });
    }
    if (!salon) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Online payments only ever go to the salon's own connected Stripe account.
    // Without one (or before Stripe enables charges) refuse — never fall back to
    // charging on the platform account, where the salon would never get the money.
    if (!salon.stripe_account_id || salon.charges_enabled !== true) {
      return NextResponse.json(
        {
          error: "This business can't take online payments yet. Please choose Pay at Salon, or contact them directly.",
          code: "online_payments_unavailable",
        },
        { status: 409 },
      );
    }
    const stripeAccountId: string = salon.stripe_account_id;

    // What to charge: the option saved on the booking (the one the client
    // picked — full, 50% deposit or the salon's custom %), still on offer under
    // the salon's settings now, at the same % the booking page used. The rules
    // are shared with the page (app/lib/payments/bookingPayment.ts).
    const option = onlineChargeOption({
      savedOption: appt?.payment_method ?? null,
      savedSettings: salon.payment_methods,
      depositOnlyFlag: deposit_only === true,
      anyPriceIsFrom,
    });
    if (!option) {
      // A variable-priced ("from £X") service can't be charged in full online —
      // the final amount is unknown and there's no balance-due flow. Applies if
      // ANY selected service is variable-priced, not just a single one.
      const wantedFull = (appt?.payment_method ?? (deposit_only === true ? "deposit_online" : "full_online")) === "full_online";
      if (wantedFull && anyPriceIsFrom) {
        return NextResponse.json(
          { error: "This service has a variable price and can't be paid in full online. Please choose a deposit or pay at the salon." },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "That payment option isn't available any more. Please refresh the page and book again.", code: "payment_option_unavailable" },
        { status: 409 },
      );
    }
    const isDeposit = option.id !== "full_online";
    const chargeAmount = chargePence(totalPrice, option.pct);

    // Charge exactly what the client was shown. If the price or the deposit %
    // changed after the booking page loaded, stop rather than charge a
    // different amount behind the "Pay £X" button.
    const shownPence = typeof charge_amount === "number" ? Math.round(charge_amount * 100) : NaN;
    if (shownPence !== chargeAmount) {
      return NextResponse.json(
        { error: "The price for this booking changed while you were booking. Please refresh the page and book again.", code: "amount_changed" },
        { status: 409 },
      );
    }
    if (chargeAmount <= 0) {
      return NextResponse.json({ error: "Could not determine service price" }, { status: 400 });
    }

    const platformFee = Math.round(chargeAmount * PLATFORM_FEE_PERCENT);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency: "gbp",
      receipt_email: email,
      description: `${salon_name || "Salon"} – ${service_name || "Appointment"}${isDeposit ? ` (${option.pct}% Deposit)` : ""}`,
      metadata: {
        booking_id:    booking_id || "",
        salon_name:    salon_name || "",
        service_name:  service_name || "",
        deposit_only:  isDeposit ? "true" : "false",
        payment_option: option.id,
        full_amount:   String(Math.round(totalPrice * 100)),
        salon_id:      resolvedSalonId || "",
      },
      // Destination charge — always routed to the salon's own Stripe account
      transfer_data:          { destination: stripeAccountId },
      application_fee_amount: platformFee,
    });

    // Save the PaymentIntent on the booking. The 30-minute cleanup
    // (/api/cron/expire-pending-bookings) only ever touches bookings that have
    // one — that is how it tells an online booking from an owner-made one.
    // If saving fails the client can still pay; the booking just isn't
    // auto-expired.
    const { error: savePiErr } = await supabaseAdmin
      .from("appointments")
      .update({ payment_intent_id: paymentIntent.id })
      .eq("id", booking_id)
      .eq("status", "pending")
      .eq("payment_status", "pending");
    if (savePiErr) {
      console.error(`[create-payment-intent] couldn't save ${paymentIntent.id} on booking ${booking_id}:`, savePiErr.message);
    }

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