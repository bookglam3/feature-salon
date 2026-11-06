/**
 * Abandoned online bookings: a booking waiting for its card payment holds its
 * slot. If the payment isn't made within PENDING_PAYMENT_MINUTES, the cleanup
 * (/api/cron/expire-pending-bookings, called by Supabase pg_cron) closes the
 * Stripe payment first and only then cancels the booking, so a cancelled
 * booking can never be paid.
 *
 * No imports, so node runs it directly in scripts/test-expire-pending.mjs.
 */

export const PENDING_PAYMENT_MINUTES = 30;

/** Bookings created before this moment are past the time limit. */
export function expiryCutoff(now: Date): Date {
  return new Date(now.getTime() - PENDING_PAYMENT_MINUTES * 60_000);
}

export type ExpiryAction =
  | "cancel_payment_then_booking" // still waiting for the client: close the payment, then the booking
  | "cancel_booking"              // payment already closed: just cancel the booking
  | "skip_paid"                   // paid — the webhook confirms it; never cancel
  | "skip_in_progress"            // money may be moving (processing / on hold) — leave it
  | "skip_mismatch";              // the payment isn't this booking's — leave it

/** Stripe statuses where the client hasn't paid yet and the payment can be cancelled. */
const WAITING_FOR_CLIENT = new Set(["requires_payment_method", "requires_confirmation", "requires_action"]);

/** What to do with an expired booking, given its Stripe PaymentIntent as it is now. */
export function expiryAction(pi: { status: string; metadata?: Record<string, string> | null }, bookingId: string): ExpiryAction {
  if (pi.metadata?.booking_id !== bookingId) return "skip_mismatch";
  if (pi.status === "succeeded") return "skip_paid";
  if (pi.status === "canceled") return "cancel_booking";
  if (WAITING_FOR_CLIENT.has(pi.status)) return "cancel_payment_then_booking";
  return "skip_in_progress"; // processing, requires_capture, or anything new
}
