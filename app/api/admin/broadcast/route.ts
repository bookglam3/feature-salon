import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";
import { normalisePhone } from "@/app/lib/sms"; // reuse existing normaliser — no duplication

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_EMAIL = "adilgill2008@gmail.com";

// ── Same DB connection as the rest of the project ─────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Same email service (Resend) already used project-wide ─────────
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";

// ── Same Twilio client already used project-wide ──────────────────
// We call Twilio directly here so we can detect per-send failures.
// (The lib/sms and lib/whatsapp helpers swallow errors internally,
// which would cause failed sends to be counted as successes.)
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
const TWILIO_SMS_FROM      = process.env.TWILIO_PHONE_NUMBER || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";

// ── Channel availability — derived from existing env keys only ─────
const HAS_EMAIL    = !!process.env.RESEND_API_KEY;
const HAS_SMS      = !!twilioClient; // SMS works as long as Twilio is configured
const HAS_WHATSAPP = !!(twilioClient && TWILIO_WHATSAPP_FROM);

type Channel      = "email" | "whatsapp" | "sms";
type RecipientType = "registered" | "all";

interface SalonRow {
  owner_email:        string | null;
  phone:              string | null;
  name:               string | null;
  country:            string | null;
  marketing_consent:  boolean | null;
}

// ── Country-code dial prefix map ───────────────────────────────────
const COUNTRY_DIAL: Record<string, string> = {
  GB: "44", PK: "92", AE: "971", SA: "966",
};

function normaliseForBroadcast(raw: string, country: string | null | undefined): string | null {
  // First try the existing lib normaliser (handles most common formats)
  const fromLib = normalisePhone(raw);
  if (fromLib) return fromLib;

  // Fallback: prefix with country dial code if we know the country
  const dialCode = COUNTRY_DIAL[(country || "GB").toUpperCase()];
  if (!dialCode) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const stripped = digits.startsWith("0") ? digits.slice(1) : digits;
  return `+${dialCode}${stripped}`;
}

// ── Admin auth (same pattern as /api/partners) ─────────────────────
async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (user.email !== ADMIN_EMAIL) return null;
  return user;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!
  ));
}

function isRTL(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}

function buildEmailHtml(subject: string, message: string): string {
  const rtl = isRTL(message) || isRTL(subject);
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html lang="en-GB" dir="${rtl ? "rtl" : "ltr"}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E5E7EB;">
    <div style="background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%);padding:32px 28px;text-align:center;">
      <p style="color:rgba(255,255,255,0.7);margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Feature Salon</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;" dir="${rtl ? "rtl" : "ltr"}">${escapeHtml(subject)}</h1>
    </div>
    <div style="padding:28px;font-size:14px;color:#374151;line-height:1.7;" dir="${rtl ? "rtl" : "ltr"}">${bodyHtml}</div>
    <div style="padding:14px 28px;background:#F9FAFB;text-align:center;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">
      Sent by Feature Salon · noreply@featuresalon.co.uk
    </div>
  </div>
</body>
</html>`;
}

// ── GET — capabilities, per-country counts, recent logs ─────────────
export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: countRows, error: countErr } = await adminSupabase
    .from("salons")
    .select("country, marketing_consent");

  if (countErr) {
    console.error("[/api/admin/broadcast] count load failed:", countErr.message);
  }

  const countsByCountry: Record<string, number> = { GB: 0, PK: 0, AE: 0, SA: 0, OTHER: 0 };
  let consentedTotal = 0;
  let totalUsers = 0;

  for (const row of ((countRows || []) as { country: string | null; marketing_consent: boolean | null }[])) {
    totalUsers++;
    if (row.marketing_consent === false) continue; // null → opted-in by default
    consentedTotal++;
    const c = (row.country || "GB").toUpperCase();
    if (c in countsByCountry) countsByCountry[c]++;
    else countsByCountry.OTHER++;
  }

  const { data: logs, error: logErr } = await adminSupabase
    .from("broadcast_logs")
    .select("id, subject, channels, countries, recipient_type, total_sent, total_failed, sent_at, status")
    .order("sent_at", { ascending: false })
    .limit(200);

  if (logErr) {
    console.error("[/api/admin/broadcast] logs load failed:", logErr.message);
  }

  return NextResponse.json({
    capabilities: { email: HAS_EMAIL, sms: HAS_SMS, whatsapp: HAS_WHATSAPP },
    countsByCountry,
    consentedTotal,
    totalUsers,
    logs: logs || [],
  });
}

// ── POST — dispatch broadcast ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const subject: string          = (body.subject || "").trim();
  const message: string          = (body.message || "").trim();
  const requestedChannels: string[] = Array.isArray(body.channels) ? body.channels : [];
  const recipientType: string    = body.recipientType;
  const countriesRaw: string[]   = Array.isArray(body.countries) ? body.countries : ["ALL"];

  if (!subject)                                              return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  if (!message)                                              return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  if (requestedChannels.length === 0)                        return NextResponse.json({ error: "Select at least one channel" }, { status: 400 });
  if (!["registered", "all", "custom"].includes(recipientType)) return NextResponse.json({ error: "Invalid recipient type" }, { status: 400 });

  // Strip channels whose env keys aren't present
  const channels = requestedChannels.filter((c): c is Channel => {
    if (c === "email")    return HAS_EMAIL;
    if (c === "sms")      return HAS_SMS;
    if (c === "whatsapp") return HAS_WHATSAPP;
    return false;
  });
  if (channels.length === 0) {
    return NextResponse.json({ error: "None of the selected channels are configured in this environment" }, { status: 400 });
  }

  function splitPasted(raw: string): string[] {
    return (raw || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  }

  // ── Build recipient list ──────────────────────────────────────────
  let recipients: SalonRow[] = [];
  let wantsAll = false;

  if (recipientType === "custom") {
    // Build from pasted emails + phones — no DB query needed
    const emailList = splitPasted(body.customEmails || "");
    const phoneList = splitPasted(body.customPhones || "");
    if (emailList.length === 0 && phoneList.length === 0) {
      return NextResponse.json({ error: "No emails or phone numbers provided" }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const e of emailList) {
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ owner_email: e, phone: null, name: null, country: null, marketing_consent: null });
    }
    for (const p of phoneList) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ owner_email: null, phone: p, name: null, country: null, marketing_consent: null });
    }
    wantsAll = true; // logged as countries=["ALL"] since custom list is not country-filtered
  } else {
    let query = adminSupabase
      .from("salons")
      .select("owner_email, phone, name, country, marketing_consent");

    if (recipientType === "registered") {
      // honour marketing_consent — null treated as opted-in
      query = query.neq("marketing_consent", false);
    }
    // "all": no consent filter — admin override

    wantsAll = countriesRaw.includes("ALL") || countriesRaw.length === 0;
    if (!wantsAll) {
      query = query.in("country", countriesRaw);
    }

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) {
      console.error("[/api/admin/broadcast] recipient load failed:", rowsErr.message);
      return NextResponse.json({ error: rowsErr.message }, { status: 500 });
    }

    // Deduplicate by email or phone
    const seen = new Set<string>();
    for (const r of ((rows || []) as SalonRow[])) {
      const key = (r.owner_email || r.phone || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recipients.push(r);
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients matched the filters" }, { status: 400 });
  }

  // ── Dispatch per channel ──────────────────────────────────────────
  let totalSent   = 0;
  let totalFailed = 0;
  const perChannel: { channel: Channel; sent: number; failed: number }[] = [];

  for (const channel of channels) {
    let sent = 0, failed = 0;

    for (const r of recipients) {
      try {
        if (channel === "email") {
          if (!r.owner_email || !resend) continue;
          const { error: mailErr } = await resend.emails.send({
            from: FROM_EMAIL,
            to: r.owner_email,
            subject,
            html: buildEmailHtml(subject, message),
          });
          if (mailErr) {
            failed++;
            console.error("[broadcast email] failed:", r.owner_email, mailErr);
          } else {
            sent++;
          }

        } else if (channel === "sms") {
          // SMS_ENABLED = false — plain SMS is temporarily disabled to avoid Twilio SMS charges.
          // Flip SMS_ENABLED to true in app/lib/sms.ts to re-enable.
          console.log(`[broadcast] SMS disabled — skipping SMS to ${r.owner_email}`);
          failed++;
          continue;

        } else if (channel === "whatsapp") {
          if (!r.phone || !twilioClient) continue;
          const to = normaliseForBroadcast(r.phone, r.country);
          if (!to) { failed++; continue; }
          const waTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
          // Direct Twilio call — errors are not swallowed
          await twilioClient.messages.create({
            from: TWILIO_WHATSAPP_FROM,
            to: waTo,
            body: `*${subject}*\n\n${message}`,
          });
          sent++;
        }
      } catch (e) {
        failed++;
        console.error(`[broadcast ${channel}] failed for`, r.owner_email || r.phone, e);
      }
    }

    perChannel.push({ channel, sent, failed });
    totalSent   += sent;
    totalFailed += failed;
  }

  const status =
    totalFailed === 0 && totalSent > 0  ? "success"
    : totalSent === 0                   ? "failed"
    :                                     "partial";

  const { data: log, error: logErr } = await adminSupabase
    .from("broadcast_logs")
    .insert({
      subject,
      message,
      channels,
      countries:        wantsAll ? ["ALL"] : countriesRaw,
      // DB CHECK allows only 'registered'|'all' — map 'custom' to 'all'
      recipient_type:   recipientType === "custom" ? "all" : recipientType,
      total_sent:       totalSent,
      total_failed:     totalFailed,
      sent_by_admin_id: user.id,
      status,
    })
    .select()
    .single();

  if (logErr) {
    console.error("[/api/admin/broadcast] log insert failed:", logErr.message);
  }

  return NextResponse.json({
    success: true,
    log,
    perChannel,
    totalSent,
    totalFailed,
    totalRecipients: recipients.length,
  });
}
