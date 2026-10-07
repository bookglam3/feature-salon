/**
 * Unit tests for lifecycle emails (docs/lifecycle-emails.md).
 * Imports the real modules — decide.ts, templates.ts, token.ts are pure and
 * run directly under node (type stripping). No DB, no network.
 * Run: npm test   (or: node scripts/test-lifecycle.mjs)
 */

import {
  classifyServices, decide, dedupeKeyFor, dueEmails, exclusionReason,
  isPaying, neverSubscribed, segmentLabel,
} from "../app/lib/lifecycle/decide.ts";
import { firstNameFrom, formatTrialEnd, renderEmail } from "../app/lib/lifecycle/templates.ts";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "../app/lib/lifecycle/token.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

const DAY = 86_400_000, HOUR = 3_600_000;
const NOW = new Date("2026-10-08T09:10:00Z");
const ago = ms => new Date(NOW.getTime() - ms);
const ahead = ms => new Date(NOW.getTime() + ms);
let n = 0;

/** A trial salon by default; override anything. */
function salon(over = {}) {
  n++;
  const createdAt = over.createdAt ?? ago(1 * DAY);
  return {
    salonId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    ownerId: `owner-${n}`, ownerEmail: `owner${n}@hairbyanna.co.uk`,
    name: "Anna's Hair", slug: "annas-hair",
    createdAt, trialEndsAt: new Date(createdAt.getTime() + 14 * DAY),
    subscriptionStatus: "trial", subscriptionId: null,
    isDemo: false, isStaging: false, optedOut: false,
    serviceState: "customised", paidSince: null, lastBookingAt: null, lastLoginAt: NOW,
    ...over,
  };
}
const opts = (over = {}) => ({ now: NOW, reviewLinkSet: false, ...over });
const due = (s, sent = [], o = {}) =>
  dueEmails(s, sent.filter(e => e.salonId === s.salonId), sent, opts(o));
const sentRow = (s, emailKey, when) => ({ salonId: s.salonId, emailKey, sentAt: when });
const one = (s, sent = [], o = {}) => decide([s], sent, opts(o))[0];

console.log("\nSegments");
check("comped (status active, no Stripe) counts as paying", isPaying({ subscriptionStatus: "active", subscriptionId: null }), true);
check("Stripe 'trialing' with a subscription counts as paying", isPaying({ subscriptionStatus: "trialing", subscriptionId: "sub_1" }), true);
check("'trialing' without a subscription is not paying", isPaying({ subscriptionStatus: "trialing", subscriptionId: null }), false);
check("past_due is not paying", isPaying({ subscriptionStatus: "past_due", subscriptionId: "sub_1" }), false);
check("status 'trial' + no Stripe = never subscribed", neverSubscribed({ subscriptionStatus: "trial", subscriptionId: null }), true);
check("cancelled is not 'never subscribed'", neverSubscribed({ subscriptionStatus: "canceled", subscriptionId: null }), false);
check("expired trial still saying 'trial' → segment 'trial ended'",
  segmentLabel(salon({ createdAt: ago(20 * DAY) }), NOW), "trial ended");

console.log("\nEmail 1 (first run after signup, up to 36 hours)");
check("2 hours old → welcome", due(salon({ createdAt: ago(2 * HOUR) })), ["e1_welcome"]);
check("35 hours old → welcome", due(salon({ createdAt: ago(35 * HOUR) })), ["e1_welcome"]);
check("37 hours old → no welcome", due(salon({ createdAt: ago(37 * HOUR) })), []);
check("comped salon created 1 hour ago still gets welcome (everyone)",
  due(salon({ createdAt: ago(HOUR), subscriptionStatus: "active" })), ["e1_welcome"]);
const welcomed = salon({ createdAt: ago(3 * HOUR) });
check("welcome already sent → not again", due(welcomed, [sentRow(welcomed, "e1_welcome", ago(HOUR))]), []);

console.log("\nEmail 2 (days 2–4, no services or only samples)");
check("day 2, samples only → setup help", due(salon({ createdAt: ago(2 * DAY + HOUR), serviceState: "samples_only" })), ["e2_setup_help"]);
check("day 4, no services → setup help", due(salon({ createdAt: ago(4 * DAY + HOUR), serviceState: "none" })), ["e2_setup_help"]);
check("day 3, customised services → nothing", due(salon({ createdAt: ago(3 * DAY), serviceState: "customised" })), []);
check("day 5 → too late", due(salon({ createdAt: ago(5 * DAY + HOUR), serviceState: "none" })), []);
check("paying (comped) → never gets 2", due(salon({ createdAt: ago(2 * DAY + HOUR), serviceState: "none", subscriptionStatus: "active" })), []);

console.log("\nEmail 3 (days 7–9, still on trial)");
check("day 7 on trial → check-in", due(salon({ createdAt: ago(7 * DAY + HOUR) })), ["e3_week_one"]);
check("day 10 → too late", due(salon({ createdAt: ago(10 * DAY + HOUR) })), []);
check("day 8 but trial already ended → nothing", due(salon({ createdAt: ago(8 * DAY), trialEndsAt: ago(HOUR) })), []);
check("comped at day 7 → no trial email", due(salon({ createdAt: ago(7 * DAY + HOUR), subscriptionStatus: "active" })), []);

console.log("\nEmail 4 (3 to 1 days before trial end)");
const trial = (endsIn) => salon({ createdAt: ago(5 * DAY), trialEndsAt: ahead(endsIn) });
check("ends in 2.5 days → trial ending", due(trial(2.5 * DAY)), ["e4_trial_ending"]);
check("ends in 3.2 days → not yet", due(trial(3.2 * DAY)), []);
check("ends in 12 hours → trial ending (last chance)", due(trial(12 * HOUR)), ["e4_trial_ending"]);
check("past_due owner in the window → nothing",
  due(salon({ createdAt: ago(5 * DAY), trialEndsAt: ahead(2 * DAY), subscriptionStatus: "past_due", subscriptionId: "sub_1" })), []);

console.log("\nEmail 5 (2 to 7 days after trial end)");
const ended = (since) => salon({ createdAt: ago(30 * DAY), trialEndsAt: ago(since), lastLoginAt: NOW });
check("ended 2.2 days ago → trial ended", due(ended(2.2 * DAY)), ["e5_trial_ended"]);
check("ended 1.5 days ago → not yet", due(ended(1.5 * DAY)), []);
check("ended 7.9 days ago → still in window", due(ended(7.9 * DAY)), ["e5_trial_ended"]);
check("ended 8.1 days ago → too late", due(ended(8.1 * DAY)), []);
check("cancelled owner → nothing", due(salon({ createdAt: ago(30 * DAY), trialEndsAt: ago(3 * DAY), subscriptionStatus: "canceled" })), []);

console.log("\nPriority and one email per owner per day");
const short = salon({ createdAt: ago(7 * DAY + 12 * HOUR), trialEndsAt: ahead(1.5 * DAY) });
check("3 and 4 both due → 4 wins", one(short).emailKey, "e4_trial_ending");
const ownerX = "owner-shared";
const a = salon({ ownerId: ownerX, createdAt: ago(2 * HOUR) });                                 // e1 due
const b = salon({ ownerId: ownerX, createdAt: ago(5 * DAY), trialEndsAt: ahead(2 * DAY) });     // e4 due
const pair = decide([a, b], [], opts());
check("two salons, one owner → only the higher-priority email goes", pair.map(d => d.action), ["skip", "send"]);
check("…and the other salon is told why", pair[0].reason, "owner gets e4_trial_ending for another salon today");
const c = salon({ createdAt: ago(2 * HOUR) });
check("owner already emailed today → skip", one(c, [sentRow(c, "e1_welcome", ago(HOUR))]).reason, "owner already emailed today");
check("nothing due → skip with reason", one(salon({ createdAt: ago(20 * DAY), subscriptionStatus: "canceled" })).reason, "nothing due today");

console.log("\nEmails 6–8 (7-day cap, cadence)");
const payer = (over = {}) => salon({ createdAt: ago(200 * DAY), subscriptionStatus: "active", subscriptionId: "sub_1",
  paidSince: ago(45 * DAY), lastBookingAt: ago(2 * DAY), lastLoginAt: ago(HOUR), ...over });
const p1 = payer();
check("paying 45 days, no check-in yet → monthly", due(p1), ["e6_monthly"]);
check("last monthly 20 days ago → not yet", due(p1, [sentRow(p1, "e6_monthly", ago(20 * DAY))]), []);
check("last monthly 31 days ago → monthly", due(p1, [sentRow(p1, "e6_monthly", ago(31 * DAY))]), ["e6_monthly"]);
check("any lifecycle email 3 days ago → 6–8 wait", due(p1, [sentRow(p1, "e1_welcome", ago(3 * DAY))]), []);
check("paying only 20 days → no monthly yet", due(payer({ paidSince: ago(20 * DAY) })), []);
check("paid-since unknown → no 6/7", due(payer({ paidSince: null })), []);

const p2 = payer();
const withMonthly = [sentRow(p2, "e6_monthly", ago(8 * DAY))];
check("review link off → no email 7", due(p2, withMonthly), []);
check("review link on, paid 45 days, booking 2 days ago → review", due(p2, withMonthly, { reviewLinkSet: true }), ["e7_review"]);
check("paid 61 days → too late for review", due(payer({ paidSince: ago(61 * DAY) }), [], { reviewLinkSet: true }), ["e6_monthly"]);
const p3 = payer({ lastBookingAt: ago(40 * DAY), lastLoginAt: ago(HOUR) });
check("no booking in 30 days → no review", due(p3, [sentRow(p3, "e6_monthly", ago(8 * DAY))], { reviewLinkSet: true }), []);
check("review already sent once → never again", due(p2, [...withMonthly, sentRow(p2, "e7_review", ago(100 * DAY))], { reviewLinkSet: true }), []);

const quiet = payer({ lastBookingAt: ago(20 * DAY), lastLoginAt: ago(15 * DAY) });
const quietSent = [sentRow(quiet, "e6_monthly", ago(8 * DAY))];
check("paying, no booking 20d, no login 15d → gone quiet", due(quiet, quietSent), ["e8_gone_quiet"]);
check("gone quiet 30 days ago → not again yet", due(quiet, [...quietSent, sentRow(quiet, "e8_gone_quiet", ago(30 * DAY))]), []);
check("gone quiet 61 days ago → again", due(quiet, [sentRow(quiet, "e6_monthly", ago(8 * DAY)), sentRow(quiet, "e8_gone_quiet", ago(61 * DAY))]), ["e8_gone_quiet"]);
const active = payer({ lastBookingAt: ago(20 * DAY), lastLoginAt: ago(3 * DAY) });
check("logged in 3 days ago → not quiet", due(active, [sentRow(active, "e6_monthly", ago(8 * DAY))]), []);
check("expired trial (not paying) → no gone-quiet", due(salon({ createdAt: ago(40 * DAY), lastLoginAt: ago(30 * DAY) })), []);
check("quiet payer with 8 and 6 due → 8 wins (8 > 6)", one(payer({ lastBookingAt: null, lastLoginAt: ago(20 * DAY) })).emailKey, "e8_gone_quiet");

console.log("\nExclusions");
check("demo", exclusionReason(salon({ isDemo: true })), "demo salon");
check("staging", exclusionReason(salon({ isStaging: true })), "staging salon");
check("unsubscribed", exclusionReason(salon({ optedOut: true })), "owner unsubscribed");
check("no owner email", exclusionReason(salon({ ownerEmail: null })), "no owner email");
check("test name", exclusionReason(salon({ name: "Test Salon" })), "looks like a test salon");
check("test slug", exclusionReason(salon({ slug: "test3featurecom" })), "looks like a test salon");
check("example.com email", exclusionReason(salon({ ownerEmail: "x@example.com" })), "looks like a test salon");
check("exclude list (case-insensitive)", exclusionReason(salon({ ownerEmail: "Me@Feature.co.uk" }), ["me@feature.co.uk"]), "on the exclude list");
check("a real salon is not excluded", exclusionReason(salon({ name: "Contest Barbers", slug: "contest-barbers" })), null);

console.log("\nDedupe keys");
check("one-time email key = email key", dedupeKeyFor("e1_welcome", NOW), "e1_welcome");
check("repeatable email key includes the date", dedupeKeyFor("e6_monthly", NOW), "e6_monthly:2026-10-08");

console.log("\nService state");
const samples = [
  { name: "Haircut", price: 25, durationMinutes: 45 },
  { name: "Blow Dry", price: 20, durationMinutes: 30 },
];
check("no services → none", classifyServices([], samples), "none");
check("only samples (some deleted) → samples_only", classifyServices([{ name: "haircut ", price: 25, durationMinutes: 45 }], samples), "samples_only");
check("a sample's price changed → customised", classifyServices([{ name: "Haircut", price: 30, durationMinutes: 45 }], samples), "customised");
check("a new service added → customised", classifyServices([...samples, { name: "Balayage", price: 120, durationMinutes: 180 }], samples), "customised");
check("'Other' business (no samples) with services → customised", classifyServices(samples, []), "customised");

console.log("\nTemplates");
const base = {
  firstName: "Sarah", salonName: "The Cut Studio", slug: "the-cut-studio", staffLabel: "Stylists",
  serviceState: "samples_only", trialEnd: new Date("2026-10-17T12:00:00Z"),
  unsubscribeUrl: "https://featuresalon.co.uk/unsubscribe/emails?t=abc", googleReviewLink: "https://g.page/r/xyz/review",
  siteUrl: "https://featuresalon.co.uk",
};
const w = renderEmail("e1_welcome", base);
check("welcome subject with name", w.subject, "Welcome to Feature, Sarah");
check("greeting uses first name", w.text.split("\n")[0], "Hi Sarah,");
check("staff label from business type", w.text.includes("2. Add your team, even if it's just you (Dashboard → Stylists)"), true);
check("samples → 'Check your services' step", w.text.includes("1. Check your services and prices (we've added a few examples to get you started)"), true);
check("no services → original 'Add your services' step",
  renderEmail("e1_welcome", { ...base, serviceState: "none" }).text.includes("1. Add your services and prices (Dashboard → Services)"), true);
check("booking link", w.text.includes("3. Share your booking link: https://featuresalon.co.uk/book/the-cut-studio"), true);
check("footer has company number and unsubscribe link",
  w.text.endsWith("Registered in England and Wales, company no. 17288184\nYou're getting this because you have a Feature account. Don't want these emails? Unsubscribe: https://featuresalon.co.uk/unsubscribe/emails?t=abc"), true);
check("signed off before the footer", w.text.includes("The Feature Team\n\n—\nFeature · FEATURES TECH LTD"), true);

const anon = { ...base, firstName: "" };
check("no name → 'Hi there,'", renderEmail("e3_week_one", anon).text.split("\n")[0], "Hi there,");
check("no name → subject 1 without ', name'", renderEmail("e1_welcome", anon).subject, "Welcome to Feature");
check("no name → subject 3 without ', name'", renderEmail("e3_week_one", anon).subject, "Quick one");
check("no name → subject 7 keeps the '?'", renderEmail("e7_review", anon).subject, "A small favour?");
check("subject 7 with name", renderEmail("e7_review", base).subject, "A small favour, Sarah?");
check("newline in salon name can't break the subject",
  renderEmail("e8_gone_quiet", { ...base, salonName: "Evil\r\nBcc: x@y.z" }).subject, "Everything OK with Evil Bcc: x@y.z?");
check("email 2, samples → sample-services line",
  renderEmail("e2_setup_help", base).text.includes("We noticed The Cut Studio is still showing our sample services, so your booking page isn't really yours yet."), true);
check("email 2, none → empty-page line",
  renderEmail("e2_setup_help", { ...base, serviceState: "none" }).text.includes("We noticed The Cut Studio doesn't have any services on it yet, so your booking page is still empty."), true);
check("trial end date in UK format", formatTrialEnd(base.trialEnd), "Saturday 17 October");
check("email 4 subject", renderEmail("e4_trial_ending", base).subject, "Your Feature trial ends on Saturday 17 October");
check("email 7 includes the review link", renderEmail("e7_review", base).text.includes("\nhttps://g.page/r/xyz/review\n"), true);
const keys = ["e1_welcome", "e2_setup_help", "e3_week_one", "e4_trial_ending", "e5_trial_ended", "e6_monthly", "e7_review", "e8_gone_quiet"];
check("no unfilled {placeholders} or 'undefined' in any email",
  keys.filter(k => { const r = renderEmail(k, base); return /[{}]|undefined/.test(r.subject + r.text); }), []);
check("first name = first word of the signup name", firstNameFrom("  Sarah  Jane Jones "), "Sarah");
check("an email address is not a first name", firstNameFrom("sarah@x.com"), "");

console.log("\nUnsubscribe tokens");
const SECRET = "test-secret-123";
const sid = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const tok = signUnsubscribeToken(sid, SECRET);
check("valid token → salon id", verifyUnsubscribeToken(tok, SECRET), sid);
check("tampered signature → rejected", verifyUnsubscribeToken(tok.slice(0, -2) + "xx", SECRET), null);
check("another salon's id with this signature → rejected",
  verifyUnsubscribeToken("00000000-0000-4000-8000-000000000000" + tok.slice(tok.indexOf(".")), SECRET), null);
check("wrong secret → rejected", verifyUnsubscribeToken(tok, "other-secret"), null);
check("missing secret → rejected (fails closed)", verifyUnsubscribeToken(tok, ""), null);
check("garbage → rejected", verifyUnsubscribeToken("not-a-token", SECRET), null);

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
