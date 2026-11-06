/**
 * Unit tests for the booking payment label (app/lib/payments/paymentLabel.ts)
 * shown on Bookings, Calendar and Home. Pure — no DB, no network.
 * Run: npm test   (or: node scripts/test-payment-label.mjs)
 */

import { bookingPaymentLabel, formatPounds, paidPenceByBooking } from "../app/lib/payments/paymentLabel.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}
const L = (input) => bookingPaymentLabel(input);
const text = (input) => L(input)?.text ?? null;

console.log("\nThe example: £60 booking, £30 deposit paid");
check("Deposit paid £30 · £30 due at salon (blue)", L({ status: "confirmed", paymentStatus: "deposit_paid", paymentIntentId: "pi_1", total: 60, paidPence: 3000 }),
  { tone: "deposit", text: "Deposit paid £30 · £30 due at salon" });

console.log("\nPaid in full");
check("amount from the payments row", L({ status: "confirmed", paymentStatus: "paid", total: 45.5, paidPence: 4550 }), { tone: "paid", text: "Paid in full £45.50" });
check("no payments row recorded → no amount, never a guess", text({ status: "confirmed", paymentStatus: "paid", total: 45 }), "Paid in full");
check("the paid amount is what was paid, not the price", text({ status: "confirmed", paymentStatus: "paid", total: 50, paidPence: 4500 }), "Paid in full £45");

console.log("\nDeposit");
check("'from' price → from £Y due", text({ status: "confirmed", paymentStatus: "deposit_paid", total: 40, anyPriceIsFrom: true, paidPence: 2000 }), "Deposit paid £20 · from £20 due at salon");
check("pence: £33.33 with £16.67 paid → £16.66 due", text({ status: "confirmed", paymentStatus: "deposit_paid", total: 33.33, paidPence: 1667 }), "Deposit paid £16.67 · £16.66 due at salon");
check("nothing left to pay → no 'due' part", text({ status: "confirmed", paymentStatus: "deposit_paid", total: 40, paidPence: 4000 }), "Deposit paid £40");
check("no payments row → 'Deposit paid' only", text({ status: "confirmed", paymentStatus: "deposit_paid", total: 60 }), "Deposit paid");
check("a 0p amount counts as no amount", text({ status: "confirmed", paymentStatus: "deposit_paid", total: 60, paidPence: 0 }), "Deposit paid");

console.log("\nPay at salon");
check("Pay at salon £60 (grey)", L({ status: "confirmed", paymentStatus: "pay_at_salon", total: 60 }), { tone: "salon", text: "Pay at salon £60" });
check("pence shown with 2 decimals", text({ status: "confirmed", paymentStatus: "pay_at_salon", total: 24.5 }), "Pay at salon £24.50");
check("'from' price → Pay at salon from £60", text({ status: "confirmed", paymentStatus: "pay_at_salon", total: 60, anyPriceIsFrom: true }), "Pay at salon from £60");
check("£0 booking → Free", L({ status: "confirmed", paymentStatus: "pay_at_salon", total: 0 }), { tone: "free", text: "Free" });
check("completed / no-show keep the label", [text({ status: "completed", paymentStatus: "pay_at_salon", total: 30 }), text({ status: "no_show", paymentStatus: "pay_at_salon", total: 30 })], ["Pay at salon £30", "Pay at salon £30"]);
check("cancelled → nothing due, no label", L({ status: "cancelled", paymentStatus: "pay_at_salon", total: 60 }), null);

console.log("\nFailed / awaiting");
check("Payment failed (red)", L({ status: "pending", paymentStatus: "failed", paymentIntentId: "pi_2", total: 40 }), { tone: "failed", text: "Payment failed" });
check("failed on a cancelled booking → no label", L({ status: "cancelled", paymentStatus: "failed", paymentIntentId: "pi_2", total: 40 }), null);
check("online payment started, not paid yet → Awaiting payment (amber)", L({ status: "pending", paymentStatus: "pending", paymentIntentId: "pi_3", total: 40 }), { tone: "awaiting", text: "Awaiting payment" });
check("owner-made booking (pending by default, no PaymentIntent) → no label", L({ status: "confirmed", paymentStatus: "pending", total: 40 }), null);
check("owner-made pending booking → no label", L({ status: "pending", paymentStatus: "pending", total: 40 }), null);
check("released by the 30-minute cleanup (cancelled, pending) → no label", L({ status: "cancelled", paymentStatus: "pending", paymentIntentId: "pi_4", total: 40 }), null);
check("owner confirmed it before the payment came → no 'awaiting'", L({ status: "confirmed", paymentStatus: "pending", paymentIntentId: "pi_5", total: 40 }), null);

console.log("\nCancelled with money taken → paid label + refund?");
check("Paid in full £45 · refund?", text({ status: "cancelled", paymentStatus: "paid", total: 45, paidPence: 4500 }), "Paid in full £45 · refund?");
check("Deposit paid £30 · refund? (nothing 'due at salon' on a cancelled booking)", text({ status: "cancelled", paymentStatus: "deposit_paid", total: 60, paidPence: 3000 }), "Deposit paid £30 · refund?");
check("no payments row → Deposit paid · refund?", text({ status: "cancelled", paymentStatus: "deposit_paid", total: 60 }), "Deposit paid · refund?");

console.log("\nNothing to say");
check("no payment status", L({ status: "confirmed", paymentStatus: null, total: 40 }), null);
check("unknown payment status", L({ status: "confirmed", paymentStatus: "something_new", total: 40 }), null);

console.log("\nEvery combination in the live data (pre-check P3, 7 Nov)");
const P3 = [
  ["confirmed", "pending", false, 0, null],
  ["completed", "pay_at_salon", false, 0, "Pay at salon £40"],
  ["confirmed", "pay_at_salon", false, 0, "Pay at salon £40"],
  ["completed", "pending", false, 0, null],
  ["pending", "pending", false, 0, null],
  ["confirmed", "paid", false, 0, "Paid in full"],
  ["cancelled", "pay_at_salon", false, 0, null],
  ["completed", "paid", false, 0, "Paid in full"],
  ["pending", "pay_at_salon", false, 0, "Pay at salon £40"],
  ["no_show", "pay_at_salon", false, 0, "Pay at salon £40"],
  ["cancelled", "pending", false, 0, null],
  ["no_show", "paid", false, 0, "Paid in full"],
  ["confirmed", "deposit_paid", true, 2000, "Deposit paid £20 · £20 due at salon"],
  ["confirmed", "paid", true, 4000, "Paid in full £40"],
];
for (const [status, paymentStatus, online, pence, want] of P3) {
  check(`${status} / ${paymentStatus} / online ${online}`, text({ status, paymentStatus, paymentIntentId: online ? "pi_x" : null, total: 40, paidPence: pence || undefined }), want);
}

console.log("\nAmounts");
check("formatPounds", [formatPounds(3000), formatPounds(2450), formatPounds(5), formatPounds(123456)], ["£30", "£24.50", "£0.05", "£1234.56"]);
const m = paidPenceByBooking([
  { appointment_id: "a", amount: "30.00" },        // numeric comes back as a string
  { appointment_id: "b", amount: 45.5 },
  { appointment_id: "b", amount: "4.50" },          // two payments on one booking add up
  { appointment_id: null, amount: "18.00" },        // linked to no booking — ignored
]);
check("paid per booking, in pence", [...m.entries()], [["a", 3000], ["b", 5000]]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
