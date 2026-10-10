/**
 * Unit tests for gift voucher access (app/lib/vouchers/access.ts) and the
 * gift_vouchers plan rule (app/lib/featureAccess.ts). Pure — no DB, no network.
 * Covers the three states (switch off / no online payments / Stripe ready),
 * plan gating, and "sold vouchers stay redeemable" whatever changes later.
 * Run: npm test   (or: node scripts/test-vouchers.mjs)
 */

import { getVoucherAccess, onlinePaymentsOn, stripeReady } from "../app/lib/vouchers/access.ts";
import { hasFeatureAccess, getRequiredPlan } from "../app/lib/featureAccess.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

// A Pro salon with Stripe fully set up and the switch on. Each test changes one thing.
const READY = {
  planAllowsVouchers: true,
  vouchersEnabled: true,
  stripeAccountId: "acct_123",
  chargesEnabled: true,
  paymentMethods: { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: false, deposit_percent: 50 },
};
const PAY_AT_SALON_ONLY = { full_online: false, deposit_online: false, pay_at_salon: true, custom_deposit: false, deposit_percent: 50 };
const summary = (a) => ({ create: a.canCreateInDashboard, apply: a.canApplyAtBooking, buy: a.canBuyOnline, applyBlockedBy: a.applyBlockedBy, buyBlockedBy: a.buyBlockedBy });
const access = (changes) => getVoucherAccess({ ...READY, ...changes });

console.log("\nPlan rule — gift_vouchers");
check("Starter (active) → no", hasFeatureAccess("gift_vouchers", "starter", "active"), false);
check("Pro (active) → yes", hasFeatureAccess("gift_vouchers", "pro", "active"), true);
check("Business (active) → yes", hasFeatureAccess("gift_vouchers", "business", "active"), true);
check("Enterprise (active) → yes", hasFeatureAccess("gift_vouchers", "enterprise", "active"), true);
check("Free trial (Starter) → yes", hasFeatureAccess("gift_vouchers", "starter", "trial"), true);
check("Stripe trial (trialing) → yes", hasFeatureAccess("gift_vouchers", "starter", "trialing"), true);
check("Pro past due → no", hasFeatureAccess("gift_vouchers", "pro", "past_due"), false);
check("Pro cancelled → no", hasFeatureAccess("gift_vouchers", "pro", "cancelled"), false);
check("Plan name in capitals (PRO) → yes", hasFeatureAccess("gift_vouchers", "PRO", "active"), true);
check("upgrade screen asks for Pro", getRequiredPlan("gift_vouchers"), "pro");
check("old Gift Cards page still Business only (unchanged)", hasFeatureAccess("gift_cards", "pro", "active"), false);

console.log("\nState 1 — switch OFF");
check("nothing public; owner can still add paper vouchers",
  summary(access({ vouchersEnabled: false })),
  { create: true, apply: false, buy: false, applyBlockedBy: "switch_off", buyBlockedBy: "switch_off" });
check("switch never saved (null) → off", access({ vouchersEnabled: null }).canApplyAtBooking, false);
check("switch column missing (undefined) → off", access({ vouchersEnabled: undefined }).canBuyOnline, false);
check("off + no Stripe → reason is still the switch", access({ vouchersEnabled: false, stripeAccountId: null }).buyBlockedBy, "switch_off");

console.log("\nState 2 — switch ON, no online payments");
check("no Stripe account → codes at booking yes, sales no",
  summary(access({ stripeAccountId: null, chargesEnabled: false })),
  { create: true, apply: true, buy: false, applyBlockedBy: null, buyBlockedBy: "stripe_not_connected" });
check("empty Stripe account id → not connected", access({ stripeAccountId: "" }).buyBlockedBy, "stripe_not_connected");
check("Stripe connected but charges not enabled → sales no",
  summary(access({ chargesEnabled: false })),
  { create: true, apply: true, buy: false, applyBlockedBy: null, buyBlockedBy: "stripe_not_ready" });
check("charges_enabled unknown (null) → sales no", access({ chargesEnabled: null }).buyBlockedBy, "stripe_not_ready");
check("Stripe ready but salon takes pay-at-salon only → sales no",
  summary(access({ paymentMethods: PAY_AT_SALON_ONLY })),
  { create: true, apply: true, buy: false, applyBlockedBy: null, buyBlockedBy: "online_payments_off" });
check("all four payment methods off → sales no",
  access({ paymentMethods: { full_online: false, deposit_online: false, pay_at_salon: false, custom_deposit: false } }).canBuyOnline, false);

console.log("\nState 3 — switch ON, Stripe ready");
check("everything on",
  summary(access({})),
  { create: true, apply: true, buy: true, applyBlockedBy: null, buyBlockedBy: null });
check("custom deposit only counts as online", access({ paymentMethods: { ...PAY_AT_SALON_ONLY, custom_deposit: true } }).canBuyOnline, true);
check("deposit only counts as online", access({ paymentMethods: { ...PAY_AT_SALON_ONLY, deposit_online: true } }).canBuyOnline, true);
check("payment settings never saved → booking-page defaults (online on)", access({ paymentMethods: null }).canBuyOnline, true);

console.log("\nPlan gating (switch on, Stripe ready)");
check("plan doesn't include vouchers → nothing public, can't create",
  summary(access({ planAllowsVouchers: false })),
  { create: false, apply: false, buy: false, applyBlockedBy: "plan", buyBlockedBy: "plan" });

console.log("\nLater changes — sold vouchers stay valid and redeemable");
for (const [label, changes] of [
  ["Stripe disconnected", { stripeAccountId: null, chargesEnabled: false }],
  ["Stripe stops charges", { chargesEnabled: false }],
  ["online payments turned off", { paymentMethods: PAY_AT_SALON_ONLY }],
  ["switch turned off", { vouchersEnabled: false }],
  ["plan downgraded", { planAllowsVouchers: false }],
]) {
  check(`${label} → owner can still view and redeem`, access(changes).canViewAndRedeem, true);
  check(`${label} → new online sales stop`, access(changes).canBuyOnline, false);
}
check("Stripe disconnected → codes at booking keep working", access({ stripeAccountId: null, chargesEnabled: false }).canApplyAtBooking, true);
check("online payments off → codes at booking keep working", access({ paymentMethods: PAY_AT_SALON_ONLY }).canApplyAtBooking, true);

console.log("\nHelpers");
check("stripeReady: account + charges", stripeReady("acct_1", true), true);
check("stripeReady: account, no charges", stripeReady("acct_1", false), false);
check("stripeReady: no account", stripeReady(null, true), false);
check("onlinePaymentsOn: junk value → defaults (on)", onlinePaymentsOn("oops"), true);
check("onlinePaymentsOn: array → defaults (on)", onlinePaymentsOn([]), true);
check("onlinePaymentsOn: 'true' as a string is not on", onlinePaymentsOn({ full_online: "true", deposit_online: false }), false);

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
