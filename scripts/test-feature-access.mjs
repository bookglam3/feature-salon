/**
 * Unit tests for plan-based feature access (app/lib/featureAccess.ts).
 * Imports the real module (it has no imports, so node runs it directly).
 * The expired-trial / cancelled dashboard lock lives in app/dashboard/layout.tsx
 * and is not changed by plan rules; these tests cover the per-feature gate.
 * Run: npm test   (or: node scripts/test-feature-access.mjs)
 */

import { hasFeatureAccess, getRequiredPlan } from "../app/lib/featureAccess.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  if (actual === expected) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${expected}, got ${actual}`); }
}

console.log("\nCalendar — open on every plan");
check("Starter (active) → calendar", hasFeatureAccess("calendar", "starter", "active"), true);
check("Pro (active) → calendar", hasFeatureAccess("calendar", "pro", "active"), true);
check("Business (active) → calendar", hasFeatureAccess("calendar", "business", "active"), true);
check("Enterprise (active) → calendar", hasFeatureAccess("calendar", "enterprise", "active"), true);
check("Comped (active, no plan) → calendar", hasFeatureAccess("calendar", null, "active"), true);
check("Plan name in capitals (active) → calendar", hasFeatureAccess("calendar", "Starter", "active"), true);
check("Free trial → calendar", hasFeatureAccess("calendar", "starter", "trial"), true);
check("Stripe trial (trialing) → calendar", hasFeatureAccess("calendar", "starter", "trialing"), true);

console.log("\nCalendar — still locked without an active plan (as before)");
check("Past due → locked", hasFeatureAccess("calendar", "pro", "past_due"), false);
check("Unpaid → locked", hasFeatureAccess("calendar", "pro", "unpaid"), false);
check("Cancelled → locked", hasFeatureAccess("calendar", "pro", "cancelled"), false);
check("Canceled (Stripe spelling) → locked", hasFeatureAccess("calendar", "pro", "canceled"), false);
check("No status → locked", hasFeatureAccess("calendar", "starter", null), false);

console.log("\nOther features — unchanged");
check("Starter → no analytics", hasFeatureAccess("analytics_basic", "starter", "active"), false);
check("Pro → analytics", hasFeatureAccess("analytics_basic", "pro", "active"), true);
check("Pro → no full analytics", hasFeatureAccess("analytics_full", "pro", "active"), false);
check("Starter → no reviews", hasFeatureAccess("reviews", "starter", "active"), false);
check("Pro → reviews", hasFeatureAccess("reviews", "pro", "active"), true);
check("Pro → no gift cards", hasFeatureAccess("gift_cards", "pro", "active"), false);
check("Business → gift cards", hasFeatureAccess("gift_cards", "business", "active"), true);
check("Pro → no client portal", hasFeatureAccess("client_portal", "pro", "active"), false);
check("Trial → everything (e.g. client portal)", hasFeatureAccess("client_portal", "starter", "trial"), true);

console.log("\nRequired plan shown on upgrade screens");
check("calendar needs Starter", getRequiredPlan("calendar"), "starter");
check("analytics still needs Pro", getRequiredPlan("analytics_basic"), "pro");
check("gift cards still need Business", getRequiredPlan("gift_cards"), "business");

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
