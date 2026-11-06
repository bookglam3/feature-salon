import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { expiryAction, expiryCutoff, type ExpiryAction } from "@/app/lib/payments/expirePending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 50;

// POST /api/cron/expire-pending-bookings — called every 5 minutes by Supabase
// pg_cron (sql/2026-11-06-expire-pending-bookings.sql). Cancels online bookings
// whose card payment wasn't made within 30 minutes, so their slot is free again.
//
// Only bookings that started an online payment (a saved payment_intent_id) and
// are still waiting for it (status pending, payment pending/failed) — never a
// pay-at-salon, paid, confirmed or owner-made booking. The Stripe payment is
// closed FIRST; the booking is cancelled only once Stripe confirms the payment
// is closed, so a cancelled booking can't be paid.
//
// Auth: "Authorization: Bearer <PENDING_BOOKINGS_CRON_SECRET>" only.
// Body {"dry_run": true}: report what would happen, change nothing.
export async function POST(req: NextRequest) {
  const secret = process.env.PENDING_BOOKINGS_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "PENDING_BOOKINGS_CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { data: due, error } = await db
    .from("appointments")
    .select("id, payment_intent_id")
    .eq("status", "pending")
    .in("payment_status", ["pending", "failed"])
    .not("payment_intent_id", "is", null)
    .lt("created_at", expiryCutoff(new Date()).toISOString())
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("[expire-pending] couldn't load bookings:", error.message);
    return NextResponse.json({ error: "Failed to load bookings" }, { status: 500 });
  }

  const summary = { dryRun, due: due.length, bookingsCancelled: 0, paymentsCancelled: 0, skippedPaid: 0, skippedInProgress: 0, skippedMismatch: 0, failed: 0 };
  const skip = (a: ExpiryAction) => {
    if (a === "skip_paid") summary.skippedPaid++;
    else if (a === "skip_mismatch") summary.skippedMismatch++;
    else summary.skippedInProgress++;
  };
  const actions: { id: string; action: ExpiryAction }[] = [];

  for (const b of due as { id: string; payment_intent_id: string }[]) {
    try {
      let pi = await stripe.paymentIntents.retrieve(b.payment_intent_id);
      let action = expiryAction(pi, b.id);
      actions.push({ id: b.id, action });
      if (dryRun) continue;

      if (action === "cancel_payment_then_booking") {
        try {
          pi = await stripe.paymentIntents.cancel(pi.id, { cancellation_reason: "abandoned" });
          summary.paymentsCancelled++;
        } catch (cancelErr) {
          // The client may have paid a moment ago, or another run closed it —
          // look again and decide again. Never cancel the booking on a guess.
          console.warn(`[expire-pending] couldn't close ${pi.id} for booking ${b.id}:`, cancelErr instanceof Error ? cancelErr.message : cancelErr);
          pi = await stripe.paymentIntents.retrieve(pi.id);
        }
        action = expiryAction(pi, b.id);
      }
      if (action !== "cancel_booking") { skip(action); continue; }

      const { data: cancelled, error: updateErr } = await db
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", b.id)
        .eq("status", "pending")
        .in("payment_status", ["pending", "failed"])
        .eq("payment_intent_id", pi.id)
        .select("id");
      if (updateErr) {
        summary.failed++;
        console.error(`[expire-pending] booking ${b.id}: payment closed but booking not cancelled (next run retries):`, updateErr.message);
        continue;
      }
      if (cancelled?.length) summary.bookingsCancelled++;
    } catch (err) {
      summary.failed++;
      console.error(`[expire-pending] booking ${b.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("[expire-pending]", JSON.stringify(summary));
  return NextResponse.json(dryRun ? { ...summary, actions } : summary);
}
