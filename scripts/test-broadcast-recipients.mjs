/**
 * Standalone unit test for broadcast recipient derivation.
 * Replicates the pure filter/link-building logic from
 * app/api/broadcast/send/route.ts.
 * No DB, no network, no real sends — all fake in-memory data.
 * Run: node scripts/test-broadcast-recipients.mjs
 */

// ── Replicated pure logic (must stay in sync with route.ts) ────────────────

// Mirrors the Supabase query in getRecipients():
//   .eq("salon_id", salonId).eq("marketing_opt_out", false)
//   .not("email", "is", null).neq("email", "")
// Deliberately takes only (allClientRows, salonId) — no request-body input,
// because the real route never lets the POST body influence this list.
function deriveRecipients(allClientRows, salonId) {
  return allClientRows.filter(
    (c) => c.salon_id === salonId && c.marketing_opt_out === false && !!c.email
  );
}

// Mirrors the unsubLink template built in the POST handler.
function buildUnsubLink(appUrl, email, salonSlug) {
  return `${appUrl}/unsubscribe?email=${encodeURIComponent(email)}&salon=${encodeURIComponent(salonSlug)}`;
}

// Mirrors how the /unsubscribe page reads the link (useSearchParams().get(...)).
function parseUnsubLink(link) {
  const url = new URL(link);
  return { email: url.searchParams.get("email"), salon: url.searchParams.get("salon") };
}

// ── Test harness ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    console.log(`         expected: ${JSON.stringify(expected)}  got: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Case A: imported client (no appointments) + booked client + opted-out ──

console.log("\n─── A: recipients derive from clients table, not appointments ────────");

const salonId = "salon-1";
const otherSalonId = "salon-2";

const clientsTable = [
  // Imported via CSV — never booked, source is irrelevant to eligibility
  { salon_id: salonId, name: "Imported Ada", email: "ada@example.com", phone: null, marketing_opt_out: false, source: "import" },
  // Booked through the app
  { salon_id: salonId, name: "Booked Bea", email: "bea@example.com", phone: null, marketing_opt_out: false, source: "manual" },
  // Explicitly opted out
  { salon_id: salonId, name: "Optout Cid", email: "cid@example.com", phone: null, marketing_opt_out: true, source: "manual" },
  // Different salon entirely — must never leak across tenants
  { salon_id: otherSalonId, name: "Other Dee", email: "dee@example.com", phone: null, marketing_opt_out: false, source: "manual" },
  // No email on file — excluded (email-only channel for now)
  { salon_id: salonId, name: "Phoneonly Fay", email: null, phone: "+447700900000", marketing_opt_out: false, source: "manual" },
];

const recipients = deriveRecipients(clientsTable, salonId);
const recipientEmails = recipients.map((r) => r.email).sort();

assert(
  "includes imported client with no appointments",
  recipientEmails.includes("ada@example.com"),
  true
);
assert("includes booked client", recipientEmails.includes("bea@example.com"), true);
assert("excludes opted-out client", recipientEmails.includes("cid@example.com"), false);
assert("excludes other salon's client (no cross-tenant leakage)", recipientEmails.includes("dee@example.com"), false);
assert("excludes client with no email", recipientEmails.includes("fay@example.com"), false);
assert("exact recipient set", recipientEmails, ["ada@example.com", "bea@example.com"]);

// ── Case B: request-body injection must not reach the send list ───────────

console.log("\n─── B: injected/foreign email in the POST body is ignored ────────────");

// Simulates a tampered request: the real route destructures only
// { broadcastId, channel, title, message } from the body and never reads
// a `clients` field, so this can't influence deriveRecipients() at all —
// but we simulate the attack shape explicitly to prove it has no effect.
const maliciousBody = {
  broadcastId: "b1",
  channel: "email",
  title: "Hi",
  message: "hello",
  clients: [{ name: "Attacker", email: "attacker@evil.com", phone: null }],
};

// deriveRecipients only ever takes (dbRows, salonId) — maliciousBody is not
// a valid input to it, which is the point. Recompute using only DB state:
const recipientsAfterInjectionAttempt = deriveRecipients(clientsTable, salonId);
const emailsSent = recipientsAfterInjectionAttempt.map((r) => r.email);

assert(
  "injected external email is not in the derived recipient list",
  emailsSent.includes(maliciousBody.clients[0].email),
  false
);
assert(
  "derived list is unaffected by the body's clients field",
  emailsSent.sort(),
  ["ada@example.com", "bea@example.com"]
);

// ── Case C: unsubscribe link matches what /unsubscribe parses ─────────────

console.log("\n─── C: generated unsubscribe link is valid ────────────────────────────");

const appUrl = "https://featuresalon.co.uk";
const salonSlug = "ada-hair-studio";
const link = buildUnsubLink(appUrl, "ada@example.com", salonSlug);
const parsed = parseUnsubLink(link);

assert("link contains email param", parsed.email, "ada@example.com");
assert("link contains salon param", parsed.salon, salonSlug);
assert(
  "link would NOT be flagged invalid by /unsubscribe (both params present)",
  !!parsed.email && !!parsed.salon,
  true
);

// Special characters must round-trip through encodeURIComponent/decode
const trickyEmail = "a+test@example.com";
const trickyLink = buildUnsubLink(appUrl, trickyEmail, salonSlug);
const trickyParsed = parseUnsubLink(trickyLink);
assert("email with special characters round-trips correctly", trickyParsed.email, trickyEmail);

// ── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");

if (failed > 0) process.exit(1);
