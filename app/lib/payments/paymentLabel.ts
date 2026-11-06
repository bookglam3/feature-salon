/**
 * The payment label shown on a booking in the owner dashboard (Bookings,
 * Calendar, Home). Amounts paid come from the succeeded rows of the payments
 * table — never worked out from the price — and the amount due at the salon is
 * the booking total minus that.
 *
 * No imports, so node runs it directly in scripts/test-payment-label.mjs.
 */

export type PaymentLabelTone = "paid" | "deposit" | "salon" | "free" | "failed" | "awaiting";

export interface PaymentLabel {
  tone: PaymentLabelTone;
  text: string;
}

export interface PaymentLabelInput {
  /** Booking status: pending / confirmed / completed / no_show / cancelled. */
  status?: string | null;
  /** appointments.payment_status. */
  paymentStatus?: string | null;
  /** appointments.payment_intent_id — set once an online payment was started. */
  paymentIntentId?: string | null;
  /** Booking total in £ (the services' combined price). */
  total?: number | null;
  /** Any of the booking's services has a "from £X" price. */
  anyPriceIsFrom?: boolean;
  /** Pence paid online for this booking (succeeded payments); undefined = none recorded. */
  paidPence?: number;
}

/** £30, £24.50 */
export function formatPounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** Pence paid per booking, from the succeeded payments rows ({ appointment_id, amount in £ }). */
export function paidPenceByBooking(rows: { appointment_id: string | null; amount: number | string | null }[]): Map<string, number> {
  const paid = new Map<string, number>();
  for (const r of rows) {
    if (!r.appointment_id) continue;
    paid.set(r.appointment_id, (paid.get(r.appointment_id) ?? 0) + Math.round(Number(r.amount ?? 0) * 100));
  }
  return paid;
}

/** The label for one booking, or null when there is nothing to say about payment. */
export function bookingPaymentLabel(i: PaymentLabelInput): PaymentLabel | null {
  const totalPence = Math.round(Number(i.total ?? 0) * 100);
  const from = i.anyPriceIsFrom ? "from " : "";
  const cancelled = i.status === "cancelled";
  // Money was taken for a booking that is now cancelled: the owner may owe a refund.
  const refund = cancelled ? " · refund?" : "";
  const paid = typeof i.paidPence === "number" && i.paidPence > 0 ? i.paidPence : null;

  switch (i.paymentStatus) {
    case "paid":
      return { tone: "paid", text: `${paid !== null ? `Paid in full ${formatPounds(paid)}` : "Paid in full"}${refund}` };
    case "deposit_paid": {
      if (paid === null) return { tone: "deposit", text: `Deposit paid${refund}` };
      const due = totalPence - paid;
      const dueText = !cancelled && due > 0 ? ` · ${from}${formatPounds(due)} due at salon` : "";
      return { tone: "deposit", text: `Deposit paid ${formatPounds(paid)}${dueText}${refund}` };
    }
    case "pay_at_salon":
      if (cancelled) return null; // nothing is due on a cancelled booking
      if (totalPence <= 0) return { tone: "free", text: "Free" };
      return { tone: "salon", text: `Pay at salon ${from}${formatPounds(totalPence)}` };
    case "failed":
      if (cancelled) return null;
      return { tone: "failed", text: "Payment failed" };
    case "pending":
      // Only when an online payment was actually started. Owner-made bookings
      // also get payment_status "pending" (the column's default) but never a
      // PaymentIntent — they are not waiting for anything.
      if (i.status === "pending" && i.paymentIntentId) return { tone: "awaiting", text: "Awaiting payment" };
      return null;
    default:
      return null;
  }
}
