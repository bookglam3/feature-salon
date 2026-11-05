/**
 * Unit tests for the booking payment rules (app/lib/payments/bookingPayment.ts)
 * shared by the public booking page, create-payment-intent and (mirrored in SQL)
 * create_booking_with_services. Pure — no DB, no network.
 *
 *   1. chargePence: whole pence, half a penny rounds up.
 *   2. The page shows the same options and sends the same booking fields as
 *      before (old page code copied below), for every setting the dashboard can save.
 *   3. create-payment-intent charges exactly what the page showed — for every
 *      option the page can offer. The old server code (copied below) did not.
 *   4. onlineChargeOption: which option gets charged, and when nothing is.
 *   5. bookingPaymentAllowed: accepts everything the page sends, refuses the
 *      hand-made "confirmed, pay at salon" booking at an online-only salon.
 * The SQL copy of rule 5 is checked against this one in
 * scripts/db-tests/booking-payment-db-test.mjs.
 * Run: npm test   (or: node scripts/test-booking-payment.mjs)
 */

import {
  bookingPaymentAllowed, bookingPaymentFields, chargePence, mergePaymentMethods, onlineChargeOption, paymentOptions,
} from "../app/lib/payments/bookingPayment.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

// ── The code before this change, copied unchanged in behaviour ───────────────
// app/book/[slug]/page.tsx (main): options, chosen option, what it sent.
const OLD_DEFAULT_PM = { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: false, deposit_percent: 50 };
function oldPage(saved, onlinePaymentsReady, anyFromService, paymentMethod, totalPrice) {
  const salonPm = saved ? { ...OLD_DEFAULT_PM, ...saved } : OLD_DEFAULT_PM;
  const raw = [
    (onlinePaymentsReady !== false && salonPm.full_online && !anyFromService) && { id: "full_online", pct: 100 },
    (onlinePaymentsReady !== false && salonPm.deposit_online) && { id: "deposit_online", pct: 50 },
    (onlinePaymentsReady !== false && salonPm.custom_deposit) && { id: "custom_deposit", pct: salonPm.deposit_percent },
    (salonPm.pay_at_salon || onlinePaymentsReady === false) && { id: "pay_at_salon", pct: 0 },
  ].filter(Boolean);
  const options = (anyFromService && raw.length === 0) ? [{ id: "pay_at_salon", pct: 0 }] : raw;
  const selectedOption = options.find(o => o.id === paymentMethod) || options[0];
  const chargeAmount = selectedOption ? totalPrice * selectedOption.pct / 100 : 0;
  const isImmediatelyConfirmed = selectedOption?.id === "pay_at_salon" || chargeAmount === 0;
  const pm = selectedOption?.id || "full_online";
  return {
    options, chargeAmount,
    status: isImmediatelyConfirmed ? "confirmed" : "pending",
    paymentStatus: isImmediatelyConfirmed ? "pay_at_salon" : "pending",
    paymentMethod: saved ? pm : null,
    depositOnly: pm !== "full_online",
  };
}
// app/api/create-payment-intent/route.ts (main): pence charged.
function oldServerCharge(totalPrice, deposit_only, savedSettings) {
  let depositPercent = 50;
  const pm = savedSettings;
  if (pm?.custom_deposit && typeof pm.deposit_percent === "number" && pm.deposit_percent > 0 && pm.deposit_percent < 100) depositPercent = pm.deposit_percent;
  return deposit_only ? Math.round(totalPrice * (depositPercent / 100) * 100) : Math.round(totalPrice * 100);
}

// ── The new page, as app/book/[slug]/page.tsx now computes it ────────────────
function newPage(saved, onlinePaymentsReady, anyFromService, paymentMethod, totalPrice) {
  const options = paymentOptions(mergePaymentMethods(saved), onlinePaymentsReady, anyFromService);
  const f = bookingPaymentFields(options, paymentMethod, totalPrice, !!saved);
  const pm = f.selected?.id || "full_online";
  return { options, f, depositOnly: pm !== "full_online" };
}
// create-payment-intent now: the option saved on the booking, its pence.
function newServerCharge(booking, savedSettings, anyFromService, deposit_only, totalPrice) {
  const option = onlineChargeOption({ savedOption: booking.paymentMethod, savedSettings, depositOnlyFlag: deposit_only, anyPriceIsFrom: anyFromService });
  return option ? chargePence(totalPrice, option.pct) : null;
}

// Every setting the dashboard can save (switches true/false, deposit % a whole 1–100), plus never saved.
const SETTINGS = [null];
for (let f = 0; f < 16; f++) for (const deposit_percent of [1, 30, 50, 99, 100]) {
  SETTINGS.push({ full_online: !!(f & 1), deposit_online: !!(f & 2), pay_at_salon: !!(f & 4), custom_deposit: !!(f & 8), deposit_percent });
}
const TOTALS = [40, 0, 33.33, 65.5, 0.01, 19.99];
const CHOICES = ["", "full_online", "deposit_online", "custom_deposit", "pay_at_salon"];

console.log("\n1. chargePence");
check("£40 at 50% → 2000p", chargePence(40, 50), 2000);
check("£40 at 30% → 1200p", chargePence(40, 30), 1200);
check("£33.33 at 50% → 1667p (half a penny rounds up)", chargePence(33.33, 50), 1667);
check("£19.99 + £5.01 at 100% → 2500p", chargePence(19.99 + 5.01, 100), 2500);
check("£65.50 at 30% → 1965p", chargePence(65.5, 30), 1965);
check("1p at 30% → 0p", chargePence(0.01, 30), 0);
check("1p at 50% → 1p", chargePence(0.01, 50), 1);
check("£0 → 0p", chargePence(0, 50), 0);

console.log("\n2. The page offers the same options and sends the same booking fields as before");
let combos = 0, optionDiffs = [], fieldDiffs = [], amountDiffs = [];
for (const saved of SETTINGS) for (const ready of [true, false, null]) for (const from of [false, true]) for (const total of TOTALS) for (const choice of CHOICES) {
  combos++;
  const o = oldPage(saved, ready, from, choice, total), n = newPage(saved, ready, from, choice, total);
  if (JSON.stringify(o.options) !== JSON.stringify(n.options)) optionDiffs.push({ saved, ready, from, old: o.options, now: n.options });
  const oldFields = [o.status, o.paymentStatus, o.paymentMethod, o.depositOnly], newFields = [n.f.status, n.f.paymentStatus, n.f.paymentMethod, n.depositOnly];
  if (JSON.stringify(oldFields) !== JSON.stringify(newFields)) fieldDiffs.push({ saved, ready, from, total, choice, oldFields, newFields, oldAmount: o.chargeAmount });
  const pence = Math.round(n.f.chargeAmount * 100);
  if (Math.abs(n.f.chargeAmount * 100 - pence) > 1e-6 || Math.abs(o.chargeAmount * 100 - pence) > 0.5 + 1e-6) amountDiffs.push({ saved, total, choice, old: o.chargeAmount, now: n.f.chargeAmount });
}
check(`same options, same order, same % (${combos} combinations)`, optionDiffs.slice(0, 3), []);
check("amount shown: whole pence now, never more than half a penny from before", amountDiffs.slice(0, 3), []);
// The only intended change: a charge below half a penny (1p service, small
// deposit) used to go to Stripe as a 0p payment, which Stripe refuses, leaving
// the booking stuck. Now it is confirmed straight away, like any £0 charge.
check("booking fields identical, except a charge that rounds to 0p is now confirmed straight away",
  fieldDiffs.filter(d => !(d.total === 0.01 && d.oldAmount > 0 && d.oldAmount < 0.005 && d.newFields[0] === "confirmed")).slice(0, 3), []);
check("…and that case does happen in the matrix (the test can see it)", fieldDiffs.length > 0, true);

console.log("\n3. create-payment-intent charges exactly what the page showed");
const DEP = { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: true, deposit_percent: 30 };
const pageDep = newPage(DEP, true, false, "deposit_online", 40);
check("salon offers 50% AND its own 30%: client picks '50% Deposit' → page shows £20.00", pageDep.f.chargeAmount, 20);
check("   OLD server charged £12.00 (the 30%) — the bug", oldServerCharge(40, pageDep.depositOnly, DEP), 1200);
check("   new server charges £20.00", newServerCharge(pageDep.f, DEP, false, pageDep.depositOnly, 40), 2000);
const pageCustom = newPage(DEP, true, false, "custom_deposit", 40);
check("client picks '30% Deposit' → shown £12.00, charged 1200p", [pageCustom.f.chargeAmount, newServerCharge(pageCustom.f, DEP, false, pageCustom.depositOnly, 40)], [12, 1200]);
const FULLDEP = { ...DEP, deposit_percent: 100 };
const page100 = newPage(FULLDEP, true, false, "custom_deposit", 40);
check("salon's own deposit is 100%: shown £40.00; OLD server charged £20.00; new 4000p",
  [page100.f.chargeAmount, oldServerCharge(40, page100.depositOnly, FULLDEP), newServerCharge(page100.f, FULLDEP, false, page100.depositOnly, 40)], [40, 2000, 4000]);
const pageFull = newPage(DEP, true, false, "full_online", 40);
check("full payment booked, request says deposit_only=true: OLD server charged £12.00; new 4000p (the flag is ignored)",
  [oldServerCharge(40, true, DEP), newServerCharge(pageFull.f, DEP, false, true, 40)], [1200, 4000]);
check("50% deposit booked, request says deposit_only=false: OLD server charged £40.00; new 2000p",
  [oldServerCharge(40, false, DEP), newServerCharge(pageDep.f, DEP, false, false, 40)], [4000, 2000]);

let pendingCount = 0, chargeMismatches = [], oldMismatches = 0;
for (const saved of SETTINGS) for (const from of [false, true]) for (const total of TOTALS) for (const choice of CHOICES) {
  const p = newPage(saved, true, from, choice, total);
  if (p.f.status !== "pending") continue; // nothing charged online
  pendingCount++;
  const shown = Math.round(p.f.chargeAmount * 100);
  const charged = newServerCharge(p.f, saved, from, p.depositOnly, total);
  if (charged !== shown) chargeMismatches.push({ saved, from, total, choice, shown, charged });
  if (oldServerCharge(total, p.depositOnly, saved) !== shown) oldMismatches++;
}
check(`charged == shown for every one of the ${pendingCount} online payments the page can start`, chargeMismatches.slice(0, 3), []);
check(`(the old server code got ${oldMismatches} of them wrong)`, oldMismatches > 0, true);

console.log("\n4. onlineChargeOption");
const opt = (savedOption, savedSettings, depositOnlyFlag = false, anyPriceIsFrom = false) => onlineChargeOption({ savedOption, savedSettings, depositOnlyFlag, anyPriceIsFrom });
check("saved option charged at the salon's % now", opt("custom_deposit", DEP), { id: "custom_deposit", pct: 30 });
check("saved deposit_online is always 50%", opt("deposit_online", DEP), { id: "deposit_online", pct: 50 });
check("option switched off since → nothing charged", opt("custom_deposit", { ...DEP, custom_deposit: false }), null);
check("custom % no longer valid → nothing charged", opt("custom_deposit", { ...DEP, deposit_percent: 0 }), null);
check("pay_at_salon → never charged online", opt("pay_at_salon", { ...DEP, pay_at_salon: true }), null);
check("unknown option → nothing charged", opt("pending", DEP), null);
check("full payment on a 'from' price → nothing charged", opt("full_online", DEP, false, true), null);
check("never saved settings, deposit flag → 50%", opt(null, null, true), { id: "deposit_online", pct: 50 });
check("never saved settings, no deposit flag → full", opt(null, null, false), { id: "full_online", pct: 100 });
check("never saved settings, 'from' price, no deposit flag → nothing charged", opt(null, null, false, true), null);
check("no saved option, settings saved since: the flag picks only full / 50%", [opt(null, DEP, true), opt(null, { ...DEP, deposit_online: false }, true)], [{ id: "deposit_online", pct: 50 }, null]);

console.log("\n5. bookingPaymentAllowed (the booking function's rule)");
const allowed = (savedSettings, onlineReady, status, paymentStatus, paymentMethod, totalPrice = 40, anyPriceIsFrom = false) =>
  bookingPaymentAllowed({ savedSettings, onlineReady, anyPriceIsFrom, totalPrice, status, paymentStatus, paymentMethod });
const ONLINE_ONLY = { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: false, deposit_percent: 50 };
check("THE HOLE: confirmed + pay at salon at an online-only salon → refused", allowed(ONLINE_ONLY, true, "confirmed", "pay_at_salon", "pay_at_salon"), false);
check("same with payment_method left empty → refused", allowed(ONLINE_ONLY, true, "confirmed", "pay_at_salon", null), false);
check("'nothing to pay' on a £40 booking → refused", allowed(ONLINE_ONLY, true, "confirmed", "pay_at_salon", "full_online"), false);
check("…but fine on a £0 service (the page does it)", allowed(ONLINE_ONLY, true, "confirmed", "pay_at_salon", "full_online", 0), true);
check("pay at salon when the salon switched it on → allowed", allowed({ ...ONLINE_ONLY, pay_at_salon: true }, true, "confirmed", "pay_at_salon", "pay_at_salon"), true);
check("pay at salon when the salon can't take online payments → allowed", allowed(ONLINE_ONLY, false, "confirmed", "pay_at_salon", "pay_at_salon"), true);
check("online deposit when the salon can't take online payments → refused", allowed(ONLINE_ONLY, false, "pending", "pending", "deposit_online"), false);
check("online deposit at a ready salon → allowed", allowed(ONLINE_ONLY, true, "pending", "pending", "deposit_online"), true);
check("custom deposit the salon doesn't offer → refused", allowed(ONLINE_ONLY, true, "pending", "pending", "custom_deposit"), false);
check("full payment on a 'from' price → refused", allowed(ONLINE_ONLY, true, "pending", "pending", "full_online", 40, true), false);
check("mixed status (confirmed + pending) → refused", allowed(ONLINE_ONLY, true, "confirmed", "pending", "full_online"), false);
check("never saved settings: online booking with no option → allowed; with an option → refused",
  [allowed(null, true, "pending", "pending", null), allowed(null, true, "pending", "pending", "full_online")], [true, false]);

let pageSends = 0, refused = [];
for (const saved of SETTINGS) for (const real of [true, false]) for (const pageReady of [real, null]) for (const from of [false, true]) for (const total of TOTALS) for (const choice of CHOICES) {
  const p = newPage(saved, pageReady, from, choice, total);
  pageSends++;
  const ok = allowed(saved, real, p.f.status, p.f.paymentStatus, p.f.paymentMethod, total, from);
  // the one thing refused on purpose: an online booking at a salon that can't
  // take online payments, sent by a page that never heard back from its Stripe check
  const want = !(p.f.paymentStatus === "pending" && !real);
  if (ok !== want) refused.push({ saved, real, pageReady, from, total, choice, f: p.f });
}
check(`every booking the page can send is accepted (${pageSends} cases)`, refused.slice(0, 3), []);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
