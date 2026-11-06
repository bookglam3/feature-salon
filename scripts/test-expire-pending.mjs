/**
 * Unit tests for the abandoned-booking cleanup rules (app/lib/payments/expirePending.ts).
 * Pure — no DB, no network. The route that uses them
 * (app/api/cron/expire-pending-bookings) closes the Stripe payment first and
 * cancels the booking only when this says "cancel_booking" afterwards.
 * Run: npm test   (or: node scripts/test-expire-pending.mjs)
 */

import { PENDING_PAYMENT_MINUTES, expiryAction, expiryCutoff } from "../app/lib/payments/expirePending.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

const B = "b0000000-0000-4000-8000-000000000001";
const pi = (status, booking_id = B) => ({ status, metadata: { booking_id } });

console.log("\nTime limit");
check("30 minutes", PENDING_PAYMENT_MINUTES, 30);
check("cutoff is exactly 30 minutes before now", expiryCutoff(new Date("2026-11-06T12:00:00Z")).toISOString(), "2026-11-06T11:30:00.000Z");

console.log("\nClient hasn't paid → close the payment, then the booking");
check("requires_payment_method (card form never submitted / card failed)", expiryAction(pi("requires_payment_method"), B), "cancel_payment_then_booking");
check("requires_confirmation", expiryAction(pi("requires_confirmation"), B), "cancel_payment_then_booking");
check("requires_action (3-D Secure never finished)", expiryAction(pi("requires_action"), B), "cancel_payment_then_booking");

console.log("\nPayment already closed → cancel the booking");
check("canceled", expiryAction(pi("canceled"), B), "cancel_booking");

console.log("\nNever cancel when money may have moved");
check("succeeded → skip (the webhook confirms it)", expiryAction(pi("succeeded"), B), "skip_paid");
check("processing → skip", expiryAction(pi("processing"), B), "skip_in_progress");
check("requires_capture → skip", expiryAction(pi("requires_capture"), B), "skip_in_progress");
check("a status Stripe adds later → skip", expiryAction(pi("some_new_status"), B), "skip_in_progress");

console.log("\nThe payment must belong to the booking");
check("another booking's payment → skip", expiryAction(pi("requires_payment_method", "b0000000-0000-4000-8000-000000000999"), B), "skip_mismatch");
check("no booking_id on the payment → skip", expiryAction({ status: "requires_payment_method", metadata: {} }, B), "skip_mismatch");
check("no metadata at all → skip", expiryAction({ status: "canceled" }, B), "skip_mismatch");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
