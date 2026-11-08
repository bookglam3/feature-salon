/**
 * Unit tests for the shared access rule (app/lib/featureAccess.ts): who can
 * use the dashboard (salonAccess) and which plan features (hasFeatureAccess).
 * The same rule runs in the browser (dashboard layout, FeatureGate, Settings)
 * and on the server (owner API routes via app/lib/dashboardLock.ts, the gift
 * voucher checks). Imports the real module (no imports, node runs it directly).
 * Run: npm test   (or: node scripts/test-feature-access.mjs)
 */

import { hasFeatureAccess, getRequiredPlan, salonAccess } from "../app/lib/featureAccess.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const NOW = new Date("2026-11-08T12:00:00Z");
const FUTURE = "2026-11-20T00:00:00Z", PAST = "2026-11-01T00:00:00Z";
const s = (subscription_status, subscription_plan = null, extra = {}) => ({ subscription_status, subscription_plan, ...extra });
const can = (feature, salon) => hasFeatureAccess(feature, salon, NOW);
const lock = (salon) => { const a = salonAccess(salon, NOW); return a.locked ? `locked:${a.lockReason}` : `open:${a.state}`; };

console.log("\nDashboard lock");
check("active → open", lock(s("active", "starter")), "open:active");
check("past_due → open (a payment problem shows a banner, it doesn't lock)", lock(s("past_due", "pro")), "open:past_due");
check("trial with time left → open", lock(s("trial", "starter", { trial_ends_at: FUTURE })), "open:trial");
check("Stripe trial (trialing) with time left → open", lock(s("trialing", "starter", { trial_ends_at: FUTURE })), "open:trial");
check("trial ended → locked", lock(s("trial", "starter", { trial_ends_at: PAST })), "locked:trial_ended");
check("Stripe trial ended (status not updated yet) → locked", lock(s("trialing", "starter", { trial_ends_at: PAST })), "locked:trial_ended");
check("trial with no end date → locked", lock(s("trial", "starter")), "locked:trial_ended");
check("no status counts as a trial: with time left → open, without → locked", [lock({ trial_ends_at: FUTURE }), lock({})], ["open:trial", "locked:trial_ended"]);
check("cancelled / canceled → locked", [lock(s("cancelled", "pro")), lock(s("canceled", "pro"))], ["locked:cancelled", "locked:cancelled"]);
check("unpaid → locked", lock(s("unpaid", "business")), "locked:unpaid");
check("incomplete / incomplete_expired → locked", [lock(s("incomplete")), lock(s("incomplete_expired"))], ["locked:incomplete", "locked:incomplete"]);
check("a status we don't know (e.g. paused) → locked", lock(s("paused", "pro")), "locked:inactive");
check("lifetime → open, whatever the status says", [
  lock(s("active", "starter", { lifetime_access: true })),
  lock(s("cancelled", "starter", { lifetime_access: true })),
  lock(s("trial", null, { lifetime_access: true, trial_ends_at: PAST })),
  lock({ lifetime_access: true }),
], ["open:lifetime", "open:lifetime", "open:lifetime", "open:lifetime"]);
check("lifetime_access false / null changes nothing", [lock(s("cancelled", "pro", { lifetime_access: false })), lock(s("active", "pro", { lifetime_access: null }))], ["locked:cancelled", "open:active"]);
check("status in capitals / with spaces counts the same (hand-edited rows)", [lock(s("Active", "pro")), lock(s(" past_due ", "pro")), lock(s("CANCELLED", "pro")), lock(s("", "pro", { trial_ends_at: FUTURE }))], ["open:active", "open:past_due", "locked:cancelled", "open:trial"]);
check("exactly when the trial ends it is over", lock(s("trial", "starter", { trial_ends_at: NOW.toISOString() })), "locked:trial_ended");

console.log("\nCalendar — every open salon, every plan");
for (const plan of ["starter", "pro", "business", "enterprise", null, "Starter", "premium"]) {
  check(`active, plan ${JSON.stringify(plan)} → calendar`, can("calendar", s("active", plan)), true);
}
check("past_due → calendar", can("calendar", s("past_due", "starter")), true);
check("running trial → calendar", can("calendar", s("trial", "starter", { trial_ends_at: FUTURE })), true);
check("lifetime → calendar", can("calendar", s("cancelled", null, { lifetime_access: true })), true);
check("locked (trial ended / cancelled / unpaid) → no calendar", [
  can("calendar", s("trial", "starter", { trial_ends_at: PAST })), can("calendar", s("cancelled", "pro")), can("calendar", s("unpaid", "pro")),
], [false, false, false]);

console.log("\nPlan features");
check("Starter → no analytics / reviews / gift vouchers", [can("analytics_basic", s("active", "starter")), can("reviews", s("active", "starter")), can("gift_vouchers", s("active", "starter"))], [false, false, false]);
check("Pro → analytics, reviews, gift vouchers", [can("analytics_basic", s("active", "pro")), can("reviews", s("active", "pro")), can("gift_vouchers", s("active", "pro"))], [true, true, true]);
check("Pro → no Business features (full analytics, discount codes, client portal)", [can("analytics_full", s("active", "pro")), can("gift_cards", s("active", "pro")), can("client_portal", s("active", "pro"))], [false, false, false]);
check("Business → Business features", [can("analytics_full", s("active", "business")), can("gift_cards", s("active", "business")), can("client_portal", s("active", "business"))], [true, true, true]);
check("Enterprise → Business features", can("client_portal", s("active", "enterprise")), true);
check("plan name in capitals", can("reviews", s("active", "PRO")), true);
check("a plan we don't know ('premium') counts as Starter", [can("reviews", s("active", "premium")), can("calendar", s("active", "premium"))], [false, true]);
check("past_due keeps its plan's features", [can("reviews", s("past_due", "pro")), can("client_portal", s("past_due", "pro"))], [true, false]);
check("running trial → every feature", can("client_portal", s("trial", "starter", { trial_ends_at: FUTURE })), true);
check("trial ended → no features", can("reviews", s("trial", "business", { trial_ends_at: PAST })), false);
check("lifetime → every Business feature, even on a Starter subscription", [
  can("analytics_full", s("active", "starter", { lifetime_access: true })), can("gift_cards", s("active", "starter", { lifetime_access: true })),
  can("client_portal", s("active", "starter", { lifetime_access: true })), can("gift_vouchers", s("active", "starter", { lifetime_access: true })),
], [true, true, true, true]);
check("lifetime's plan is Business", salonAccess(s("active", "starter", { lifetime_access: true }), NOW).plan, "business");

console.log("\nRequired plan shown on upgrade screens");
check("calendar needs Starter", getRequiredPlan("calendar"), "starter");
check("analytics still needs Pro", getRequiredPlan("analytics_basic"), "pro");
check("gift cards still need Business", getRequiredPlan("gift_cards"), "business");

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
