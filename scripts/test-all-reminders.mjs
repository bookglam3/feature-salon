/**
 * Feature Salon — Full Reminder Diagnostics
 * 
 * Tests:
 *  1. Booking Confirmation Email  (POST /api/send-confirmation with a real appointmentId)
 *  2. Direct Email via Resend     (raw API call — bypasses appointment lookup)
 *  3. Reminder Cron               (GET /api/send-reminder?secret=...)
 *  4. WhatsApp Direct             (raw Twilio call to +923464503668)
 * 
 * Usage:
 *   node scripts/test-all-reminders.mjs [BASE_URL]
 *   e.g. node scripts/test-all-reminders.mjs http://localhost:3000
 *        node scripts/test-all-reminders.mjs https://featuresalon.co.uk
 */

// Load .env.local manually (no dotenv dep needed)
import { readFileSync } from "fs";
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found — rely on real env */ }

const BASE_URL   = process.argv[2] || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = process.env.FROM_EMAIL || "onboarding@resend.dev";
const TEST_EMAIL  = "bookglam3@gmail.com";
const TEST_PHONE  = "+923464503668";

// ── colours ──────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[34m${s}\x1b[0m`;
const W = (s) => `\x1b[1m${s}\x1b[0m`;

function ok(label, detail = "") { console.log(G(`  ✅ ${label}`) + (detail ? ` — ${detail}` : "")); }
function fail(label, detail = "") { console.log(R(`  ❌ ${label}`) + (detail ? ` — ${detail}` : "")); }
function info(label) { console.log(Y(`  ℹ  ${label}`)); }
function section(title) { console.log("\n" + B("═".repeat(60))); console.log(W(`  ${title}`)); console.log(B("═".repeat(60))); }

// ──────────────────────────────────────────────────────────────
// STEP 0 — Env var preflight
// ──────────────────────────────────────────────────────────────
section("STEP 0 — Environment Variable Check");
const vars = {
  RESEND_API_KEY:             process.env.RESEND_API_KEY,
  FROM_EMAIL:                 process.env.FROM_EMAIL,
  TWILIO_ACCOUNT_SID:         process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN:          process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER:        process.env.TWILIO_PHONE_NUMBER,
  TWILIO_WHATSAPP_FROM:       process.env.TWILIO_WHATSAPP_FROM,
  NEXT_PUBLIC_SUPABASE_URL:   process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY:  process.env.SUPABASE_SERVICE_ROLE_KEY,
  CRON_SECRET:                process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL:        process.env.NEXT_PUBLIC_APP_URL,
};

let envOk = true;
for (const [k, v] of Object.entries(vars)) {
  if (v) ok(k, v.slice(0, 8) + "...");
  else { fail(k, "NOT SET"); envOk = false; }
}
if (!envOk) {
  console.log(R("\n  Some env vars are missing! Add them to .env.local"));
}

// ──────────────────────────────────────────────────────────────
// STEP 1 — Direct Resend email (bypasses all app logic)
// ──────────────────────────────────────────────────────────────
section("STEP 1 — Direct Resend Email (raw API call)");
if (!RESEND_KEY) {
  fail("Skipped — RESEND_API_KEY not set");
} else {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [TEST_EMAIL],
        subject: "✅ Feature Salon — Test Email (Step 1)",
        html:    `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#4F6EF7;">Feature Salon Diagnostic</h2>
            <p>This is a <strong>direct Resend API test</strong> email.</p>
            <p>If you received this, Resend is configured correctly ✅</p>
            <p style="color:#888;font-size:12px;">Sent at ${new Date().toISOString()}</p>
          </div>
        `,
      }),
    });
    const data = await res.json();
    if (res.ok) ok("Email sent via Resend", `id=${data.id}`);
    else fail("Resend API error", JSON.stringify(data));
  } catch (e) {
    fail("Network/fetch error", e.message);
  }
}

// ──────────────────────────────────────────────────────────────
// STEP 2 — POST /api/send-booking-emails (tests app email route)
// ──────────────────────────────────────────────────────────────
section("STEP 2 — POST /api/send-booking-emails");
try {
  const res = await fetch(`${BASE_URL}/api/send-booking-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientEmail:     TEST_EMAIL,
      clientName:      "Test Client",
      clientPhone:     TEST_PHONE,
      serviceName:     "Diagnostic Test Cut",
      dateTime:        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      staffName:       "Test Stylist",
      salonName:       "Feature Salon (Test)",
      salonOwnerEmail: TEST_EMAIL,
      price:           45,
      salonAddress:    "123 Test Street, London, UK",
      cancelLink:      "https://featuresalon.co.uk",
      dashboardUrl:    "https://featuresalon.co.uk/dashboard",
      paymentStatus:   "paid",
      depositOnly:     false,
    }),
  });
  const data = await res.json();
  if (res.ok && data.success) ok(`/api/send-booking-emails returned 200`, JSON.stringify(data));
  else fail(`/api/send-booking-emails returned ${res.status}`, JSON.stringify(data));
} catch (e) {
  fail("Could not reach /api/send-booking-emails", e.message);
  info(`Is the dev server running at ${BASE_URL}?`);
}

// ──────────────────────────────────────────────────────────────
// STEP 3 — GET /api/send-reminder?secret=... (cron endpoint)
// ──────────────────────────────────────────────────────────────
section("STEP 3 — GET /api/send-reminder (Cron)");
try {
  const url = `${BASE_URL}/api/send-reminder?secret=${CRON_SECRET}`;
  info(`Calling: ${url.replace(CRON_SECRET, CRON_SECRET.slice(0, 8) + "...")}`);
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  if (res.ok) {
    ok(`Cron returned ${res.status}`, `sent=${data.sent} errors=${data.errors?.length ?? 0}`);
    if (data.errors?.length) {
      for (const e of data.errors) fail("Cron error entry", e);
    }
    if (data.sent === 0) info("No appointments in reminder window right now (this is normal)");
    console.log("  Full response:", JSON.stringify(data, null, 2));
  } else {
    fail(`Cron returned ${res.status}`, JSON.stringify(data));
    if (res.status === 401) info("CRON_SECRET mismatch — check Vercel env var");
    if (res.status === 500) info("Check SUPABASE_SERVICE_ROLE_KEY on Vercel");
  }
} catch (e) {
  fail("Could not reach /api/send-reminder", e.message);
}

// ──────────────────────────────────────────────────────────────
// STEP 4 — Direct WhatsApp via Twilio
// ──────────────────────────────────────────────────────────────
section("STEP 4 — Direct WhatsApp (Twilio raw call)");
const twilioSid    = process.env.TWILIO_ACCOUNT_SID;
const twilioToken  = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom   = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

if (!twilioSid || !twilioToken || !twilioFrom) {
  fail("Skipped — Twilio env vars not set");
  info("Need: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM");
} else {
  try {
    // Normalise FROM — must start with "whatsapp:"
    const from = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;
    const to   = `whatsapp:${TEST_PHONE}`;
    const body = `✅ *Feature Salon Diagnostic*\n\nHi! This is a test WhatsApp from Feature Salon.\n\nIf you received this, WhatsApp is working correctly.\n\nSent at ${new Date().toISOString()}`;

    info(`Sending from ${from} → ${to}`);

    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
    const formData = new URLSearchParams({
      From: from,
      To:   to,
      Body: body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type":  "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );
    const data = await res.json();
    if (res.ok && (data.status === "queued" || data.status === "sent")) {
      ok(`WhatsApp queued`, `sid=${data.sid} status=${data.status}`);
    } else {
      fail(`Twilio error`, `${data.code}: ${data.message}`);
      if (data.code === 63007) info("Sandbox: the recipient must first join — send 'join <sandbox-word>' to +14155238886");
      if (data.code === 21608) info("Number not opted in to sandbox. Visit twilio.com/console/sms/whatsapp/sandbox");
      if (data.code === 21606) info("TWILIO_WHATSAPP_FROM is not a valid WhatsApp sender on this account");
    }
  } catch (e) {
    fail("Twilio fetch failed", e.message);
  }
}

// ──────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────
section("DONE");
console.log(`  BASE_URL tested: ${BASE_URL}`);
console.log(`  Test email sent to: ${TEST_EMAIL}`);
console.log(`  Test WhatsApp sent to: ${TEST_PHONE}`);
console.log(`  Check your inbox and WhatsApp now.\n`);
