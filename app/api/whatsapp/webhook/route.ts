// ─────────────────────────────────────────────────────────────────────────────
// app/api/whatsapp/webhook/route.ts
// Meta WhatsApp Cloud API webhook handler
//
// GET  — Meta subscription verification (hub.challenge handshake)
// POST — Incoming events: delivery status updates + inbound messages
//
// Security: every POST is HMAC-verified against WHATSAPP_APP_SECRET before
// any database writes are performed (constant-time comparison via
// crypto.timingSafeEqual to prevent timing attacks).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isOptOutReply } from "@/app/lib/reminders/schedule";

export const runtime = "nodejs";

// Service role: webhook events are platform-level, not user-scoped.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[WA Webhook] Missing required env var: ${key}`);
  return val;
}

/**
 * Verifies the X-Hub-Signature-256 header Meta attaches to every POST.
 * Uses constant-time comparison — safe against timing side-channels.
 */
function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
  try {
    // Buffers must be the same byte-length for timingSafeEqual
    const a = Buffer.from(expected, "ascii");
    const b = Buffer.from(header,   "ascii");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Meta event types (subset we care about) ───────────────────────────────────

interface MetaStatus {
  id:           string;                                      // wamid
  status:       "sent" | "delivered" | "read" | "failed";
  timestamp:    string;                                      // Unix epoch seconds
  recipient_id: string;
  errors?:      Array<{ code: number; title: string }>;
}

interface MetaInboundMessage {
  from:      string;                                         // sender's E.164 digits (no '+')
  id:        string;                                         // wamid
  timestamp: string;                                         // Unix epoch seconds
  type:      string;                                         // "text" | "image" | …
  text?:     { body?: string };                              // type "text"
  button?:   { text?: string };                              // type "button" (template quick reply)
}

interface WebhookChange {
  field: string;
  value: {
    messaging_product: "whatsapp";
    statuses?: MetaStatus[];
    messages?: MetaInboundMessage[];
  };
}

interface WebhookBody {
  object?: string;
  entry?: Array<{ id: string; changes?: WebhookChange[] }>;
}

// ── GET — subscription verification ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams;
  const mode      = p.get("hub.mode");
  const token     = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");

  try {
    const verifyToken = requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    if (mode === "subscribe" && token === verifyToken && challenge) {
      console.log("[WA Webhook] ✅ Subscription verified");
      // Meta expects the challenge echoed back as plain text
      return new NextResponse(challenge, {
        status:  200,
        headers: { "Content-Type": "text/plain" },
      });
    }
  } catch (err) {
    console.error("[WA Webhook] Config error during verification:", err);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  console.warn("[WA Webhook] ❌ Verification failed — bad mode/token");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST — incoming events from Meta ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw body BEFORE parsing — needed for HMAC computation
  const rawBody = await req.text();

  // ── 1. Verify signature ──────────────────────────────────────────────────
  let appSecret: string;
  try {
    appSecret = requireEnv("WHATSAPP_APP_SECRET");
  } catch {
    console.error("[WA Webhook] WHATSAPP_APP_SECRET not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
    console.warn("[WA Webhook] ❌ Invalid HMAC signature — rejecting request");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    // Not a WhatsApp event — acknowledge and ignore
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── 3. Process entries ───────────────────────────────────────────────────
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const { statuses = [], messages = [] } = change.value;

      // ── Status updates: sent → delivered → read, or failed ────────────
      for (const status of statuses) {
        const update: Record<string, unknown> = {
          status:     status.status,
          updated_at: new Date().toISOString(),
        };
        if (status.status === "failed" && status.errors?.[0]) {
          update.error_code = status.errors[0].code;
        }

        const { error } = await supabaseAdmin
          .from("whatsapp_messages")
          .update(update)
          .eq("wamid", status.id);

        if (error) {
          console.error(`[WA Webhook] Status update failed for ${status.id}:`, error.message);
        }
      }

      // ── Inbound messages: open / refresh the 24h service window ───────
      for (const msg of messages) {
        const receivedAt = new Date(parseInt(msg.timestamp, 10) * 1000).toISOString();

        // Upsert so repeated messages keep last_inbound_at current
        const { error: swErr } = await supabaseAdmin
          .from("whatsapp_service_windows")
          .upsert(
            { recipient_e164: msg.from, last_inbound_at: receivedAt },
            { onConflict: "recipient_e164" },
          );
        if (swErr) {
          console.error(`[WA Webhook] Service-window upsert failed for ${msg.from}:`, swErr.message);
        }

        // Log inbound message — skip duplicate wamids (idempotent retry safety)
        const { error: logErr } = await supabaseAdmin
          .from("whatsapp_messages")
          .insert({
            recipient_e164: msg.from,
            direction:      "inbound",
            wamid:          msg.id,
            status:         "received",
          });
        if (logErr && logErr.code !== "23505") {          // 23505 = unique_violation (already logged)
          console.error(`[WA Webhook] Inbound log failed for ${msg.id}:`, logErr.message);
        }

        // "STOP": add the number to the shared opt-out list the reminders
        // check (same +44… form the Twilio opt-out saves).
        if (isOptOutReply(msg.text?.body ?? msg.button?.text)) {
          const { error: optErr } = await supabaseAdmin
            .from("sms_opt_outs")
            .upsert({ phone: `+${msg.from.replace(/\D/g, "")}` }, { onConflict: "phone" });
          if (optErr) console.error(`[WA Webhook] Opt-out save failed for ${msg.id}:`, optErr.message);
          else console.log(`[WA Webhook] Opt-out recorded (${msg.id})`);
        }
      }
    }
  }

  // Always return 200 quickly — Meta retries on anything else
  return NextResponse.json({ received: true }, { status: 200 });
}
