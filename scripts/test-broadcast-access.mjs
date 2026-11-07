/**
 * Unit tests for who may send a broadcast and the daily limit (app/lib/broadcastAccess.ts).
 * Pure — no DB, no network.
 * Run: npm test   (or: node scripts/test-broadcast-access.mjs)
 */

import { MAX_BROADCASTS_PER_DAY, MAX_BROADCAST_EMAILS_PER_DAY, broadcastLimitError, canBroadcast } from "../app/lib/broadcastAccess.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

const NOW = new Date("2026-11-08T12:00:00Z");
const can = (s) => canBroadcast(s, NOW);

console.log("\nWho may send");
check("active Pro → yes", can({ subscription_status: "active", subscription_plan: "pro" }), true);
check("active Business → yes", can({ subscription_status: "active", subscription_plan: "business" }), true);
check("active Enterprise → yes", can({ subscription_status: "active", subscription_plan: "enterprise" }), true);
check("plan name in capitals still counts", can({ subscription_status: "active", subscription_plan: "Pro" }), true);
check("active Starter → no", can({ subscription_status: "active", subscription_plan: "starter" }), false);
check("active with no plan (counts as Starter) → no", can({ subscription_status: "active", subscription_plan: null }), false);
check("active with an unknown plan ('premium') → no", can({ subscription_status: "active", subscription_plan: "premium" }), false);
check("trial still running → yes", can({ subscription_status: "trial", trial_ends_at: "2026-11-20T00:00:00Z" }), true);
check("Stripe trial still running → yes", can({ subscription_status: "trialing", subscription_plan: "starter", trial_ends_at: "2026-11-09T00:00:00Z" }), true);
check("trial ended → no", can({ subscription_status: "trial", trial_ends_at: "2026-11-01T00:00:00Z" }), false);
check("trial with no end date → no", can({ subscription_status: "trial", trial_ends_at: null }), false);
check("past_due Pro → no", can({ subscription_status: "past_due", subscription_plan: "pro" }), false);
check("cancelled / unpaid / incomplete → no", ["cancelled", "canceled", "unpaid", "incomplete"].map(st => can({ subscription_status: st, subscription_plan: "business" })), [false, false, false, false]);
check("no status at all → no", can({}), false);
check("lifetime access → yes, whatever the plan or status", [
  can({ lifetime_access: true, subscription_status: "active", subscription_plan: "starter" }),
  can({ lifetime_access: true, subscription_status: "cancelled" }),
  can({ lifetime_access: true }),
], [true, true, true]);
check("lifetime_access false / missing changes nothing", [can({ lifetime_access: false, subscription_status: "active", subscription_plan: "starter" }), can({ lifetime_access: null, subscription_status: "active", subscription_plan: "pro" })], [false, true]);

console.log("\nDaily limit");
check(`limits: ${MAX_BROADCASTS_PER_DAY} broadcasts, ${MAX_BROADCAST_EMAILS_PER_DAY} emails per 24 hours`, [MAX_BROADCASTS_PER_DAY, MAX_BROADCAST_EMAILS_PER_DAY], [2, 1000]);
check("nothing sent yet, 300 clients → ok", broadcastLimitError([], 300), null);
check("one sent (300) + 300 now → ok", broadcastLimitError([{ recipient_count: 300 }], 300), null);
check("two already sent → refused", broadcastLimitError([{ recipient_count: 10 }, { recipient_count: 10 }], 5), "You can send up to 2 broadcasts in 24 hours. Please try again later.");
check("800 sent + 300 now → over 1,000 emails, refused", broadcastLimitError([{ recipient_count: 800 }], 300), "This would go over the limit of 1,000 broadcast emails in 24 hours. Please try again later.");
check("exactly 1,000 → ok", broadcastLimitError([{ recipient_count: 700 }], 300), null);
check("a single list of 1,001 → refused", broadcastLimitError([], 1001) !== null, true);
check("a missing count counts as 0", broadcastLimitError([{ recipient_count: null }], 1000), null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
