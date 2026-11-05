/**
 * Booking payment rules — ONE source of truth for:
 *   • the public booking page (which options to show, what a booking sends),
 *   • create-payment-intent (which option to charge, and exactly how much),
 *   • create_booking_with_services (guard 10 in SQL mirrors bookingPaymentAllowed
 *     below; scripts/db-tests checks the two agree on every combination).
 *
 * No imports, so node runs it directly in scripts/test-booking-payment.mjs.
 */

export type PaymentOptionId = "full_online" | "deposit_online" | "custom_deposit" | "pay_at_salon";

export interface SalonPaymentMethods {
  full_online: boolean;
  deposit_online: boolean;
  pay_at_salon: boolean;
  custom_deposit: boolean;
  /** The custom deposit %; null when the saved value isn't a number above 0 and up to 100. */
  deposit_percent: number | null;
}

export interface PaymentOption {
  id: PaymentOptionId;
  /** % of the total charged online now (pay at salon = 0). */
  pct: number;
}

const DEFAULTS = { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: false, deposit_percent: 50 };

/** JavaScript truthiness — the booking page has always read these flags with `&&`. */
function truthy(v: unknown): boolean {
  return Boolean(v);
}

/** The custom deposit %: a number above 0 and up to 100 (settings saves a whole 1–100), else null. */
function percent(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
}

/**
 * salons.payment_methods as the booking page reads it: `{ ...defaults, ...saved }`,
 * or the defaults when nothing was ever saved.
 */
export function mergePaymentMethods(saved: unknown): SalonPaymentMethods {
  const s = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
  const m: Record<string, unknown> = { ...DEFAULTS, ...s };
  return {
    full_online: truthy(m.full_online),
    deposit_online: truthy(m.deposit_online),
    pay_at_salon: truthy(m.pay_at_salon),
    custom_deposit: truthy(m.custom_deposit),
    deposit_percent: percent(m.deposit_percent),
  };
}

/**
 * The options the booking page offers, in its display order.
 * onlineReady: true / false from /api/online-payments-ready, null while unknown.
 */
export function paymentOptions(methods: SalonPaymentMethods, onlineReady: boolean | null, anyPriceIsFrom: boolean): PaymentOption[] {
  const online = onlineReady !== false;
  const options: PaymentOption[] = [];
  // A "from £X" price can't be paid in full online (the final amount is unknown).
  if (online && methods.full_online && !anyPriceIsFrom) options.push({ id: "full_online", pct: 100 });
  if (online && methods.deposit_online) options.push({ id: "deposit_online", pct: 50 });
  if (online && methods.custom_deposit && methods.deposit_percent !== null) options.push({ id: "custom_deposit", pct: methods.deposit_percent });
  if (methods.pay_at_salon || onlineReady === false) options.push({ id: "pay_at_salon", pct: 0 });
  // If hiding full payment for a "from" price left nothing, pay at the salon.
  if (anyPriceIsFrom && options.length === 0) return [{ id: "pay_at_salon", pct: 0 }];
  return options;
}

/**
 * Pence charged online now for `pct`% of a £ total — the page shows this and
 * create-payment-intent charges this, so the two can never differ. Prices
 * have 2 decimal places, so the total is whole pence first; a half penny
 * rounds up (Math.round — guard 10 in SQL rounds the same way, floor(x + 0.5)).
 */
export function chargePence(totalPrice: number, pct: number): number {
  return Math.round(Math.round(totalPrice * 100) * pct / 100);
}

export interface BookingPaymentFields<T extends PaymentOption = PaymentOption> {
  selected: T | undefined;
  /** £ charged online now (whole pence: chargePence / 100). */
  chargeAmount: number;
  /** Pay at salon, or nothing to charge (0p): confirmed straight away, no Stripe. */
  immediatelyConfirmed: boolean;
  status: "confirmed" | "pending";
  paymentStatus: "pay_at_salon" | "pending";
  /** p_payment_method — null when the salon has never saved payment settings. */
  paymentMethod: PaymentOptionId | null;
}

/** What the booking page sends to create_booking_with_services for a chosen option. */
export function bookingPaymentFields<T extends PaymentOption>(options: T[], chosenId: string, totalPrice: number, hasSavedSettings: boolean): BookingPaymentFields<T> {
  const selected = options.find(o => o.id === chosenId) || options[0];
  const pence = selected ? chargePence(totalPrice, selected.pct) : 0;
  const chargeAmount = pence / 100;
  const immediatelyConfirmed = selected?.id === "pay_at_salon" || pence === 0;
  return {
    selected,
    chargeAmount,
    immediatelyConfirmed,
    status: immediatelyConfirmed ? "confirmed" : "pending",
    paymentStatus: immediatelyConfirmed ? "pay_at_salon" : "pending",
    paymentMethod: hasSavedSettings ? (selected?.id || "full_online") : null,
  };
}

/**
 * Would an up-to-date booking page have sent exactly this? The server's rule
 * (mirrored in create_booking_with_services, guard 10).
 *   • "pay_at_salon" bookings: allowed if the page could have sent it with the
 *     salon's real Stripe state OR with that state still unknown (page loaded,
 *     readiness check not answered or failed).
 *   • online ("pending") bookings: only when the salon really can take online
 *     payments — so no booking is created that can never be paid.
 */
export function bookingPaymentAllowed(args: {
  savedSettings: unknown;
  onlineReady: boolean;
  anyPriceIsFrom: boolean;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
}): boolean {
  const methods = mergePaymentMethods(args.savedSettings);
  const hasSaved = Boolean(args.savedSettings); // the page's `!!salon.payment_methods`
  const pageStates: (boolean | null)[] = args.paymentStatus === "pending"
    ? (args.onlineReady ? [true] : [])
    : [args.onlineReady, null];
  for (const pageReady of pageStates) {
    const options = paymentOptions(methods, pageReady, args.anyPriceIsFrom);
    const choices = options.length ? options.map(o => o.id) : [""];
    for (const choice of choices) {
      const f = bookingPaymentFields(options, choice, args.totalPrice, hasSaved);
      if (f.status === args.status && f.paymentStatus === args.paymentStatus && f.paymentMethod === args.paymentMethod) return true;
    }
  }
  return false;
}

/**
 * The option to charge in create-payment-intent: the one saved on the booking
 * (what the client chose), still on offer under the salon's settings now.
 * A booking only has no saved option when the salon had never saved payment
 * settings (guard 10), so the page offered just the defaults — full (100%) or
 * the 50% deposit; the page's deposit_only flag says which, and both of those
 * have a fixed %. The custom % always comes from a saved option + settings.
 * null = not chargeable online.
 */
export function onlineChargeOption(args: {
  savedOption: string | null;
  savedSettings: unknown;
  depositOnlyFlag: boolean;
  anyPriceIsFrom: boolean;
}): PaymentOption | null {
  const id = args.savedOption ?? (args.depositOnlyFlag ? "deposit_online" : "full_online");
  if (id === "pay_at_salon") return null;
  return paymentOptions(mergePaymentMethods(args.savedSettings), true, args.anyPriceIsFrom)
    .find(o => o.id === id) ?? null;
}
