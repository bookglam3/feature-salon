import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  send24hReminder,
  send2hReminder,
  sendThankyouEmail,
  sendWinbackEmail,
  sendNoShowAlertEmail,
} from "@/app/lib/email";
import { getLoyaltySnapshot } from "@/app/lib/loyalty";
import {
  send24hWhatsApp,
  send2hWhatsApp,
  sendWinbackWhatsApp,
  sendThankyouWhatsApp,
  formatWATime,
} from "@/app/lib/whatsapp";
import {
  isMetaConfigured,
  formatPhoneE164,
  sendTemplateMessage,
  sendTextMessage,
  formatWADate as metaDate,
  formatWATime as metaTime,
} from "@/app/lib/whatsapp-meta";

// ─────────────────────────────────────────────────────────
// MUST use service-role key — anon key is blocked by RLS
// ─────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // ← service role, not anon
);

// ─────────────────────────────────────────────────────────
// Helper: ±15-min window around a target UTC timestamp
// ─────────────────────────────────────────────────────────
function window15(targetMs: number) {
  return {
    start: new Date(targetMs - 15 * 60 * 1000).toISOString(),
    end:   new Date(targetMs + 15 * 60 * 1000).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// Check Twilio opt-out table
// ─────────────────────────────────────────────────────────
async function isOptedOut(phone: string | null): Promise<boolean> {
  if (!phone) return false;
  const { data } = await supabase
    .from("sms_opt_outs")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  return !!data;
}

// Marketing-email opt-out — checked against the persisted clients table
// (populated via CSV import or the /unsubscribe page). Appointments with
// no matching clients row (never imported, never unsubscribed) are not
// opted out by default.
async function isEmailOptedOut(salonId: string, email: string | null): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("salon_id", salonId)
    .eq("email", email.toLowerCase().trim())
    .eq("marketing_opt_out", true)
    .maybeSingle();
  return !!data;
}

export async function GET(req: Request) {
  // ── Security ──────────────────────────────────────
  // Accept:
  //  1. Vercel cron (Authorization: Bearer <CRON_SECRET> header) — auto-added by Vercel
  //  2. Manual test via ?secret=YOUR_CRON_SECRET query param
  const authHeader   = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Reminder] ❌ CRON_SECRET env var is not set!");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (bearerSecret !== cronSecret) {
    console.warn("[Reminder] ❌ Unauthorised request");
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Env check ─────────────────────────────────────
  const envCheck = {
    supabaseUrl:      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    resendKey:        !!process.env.RESEND_API_KEY,
    twilioSid:        !!process.env.TWILIO_ACCOUNT_SID,
    twilioToken:      !!process.env.TWILIO_AUTH_TOKEN,
    twilioWhatsApp:   !!process.env.TWILIO_WHATSAPP_FROM,
    appUrl:           !!process.env.NEXT_PUBLIC_APP_URL,
  };
  console.log("[Reminder] Env check:", JSON.stringify(envCheck));

  const now = new Date();
  let sent = 0;
  const errors: string[] = [];

  // ── Time windows ──────────────────────────────────
  const w24h    = window15(now.getTime() + 24 * 60 * 60 * 1000);
  const w2h     = window15(now.getTime() +  2 * 60 * 60 * 1000);
  // Thank-you window: look back up to 24h for completed appointments
  // (owners may mark "Completed" immediately or hours later)
  const w1hAgo  = {
    start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // up to 24h ago
    end:   new Date(now.getTime() -  1 * 60 * 60 * 1000).toISOString(), // at least 1h ago
  };
  // No-show window: 30-60 min after appointment (still confirmed = likely no-show)
  const wNoShow = {
    start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    end:   new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
  };
  const w6wkAgo = window15(now.getTime() - 42 * 24 * 60 * 60 * 1000);

  console.log(`[Reminder] ⏰ Running at ${now.toISOString()}`);
  console.log(`[Reminder] 24h window: ${w24h.start} → ${w24h.end}`);

  // ════════════════════════════════════════════════════════
  // 1. 24h BEFORE — Appointment Reminder
  // ════════════════════════════════════════════════════════
  const { data: appts24, error: err24 } = await supabase
    .from("appointments")
    .select("*, services(name,price), staff(name), salons(name,slug,reminders_enabled,whatsapp_enabled,review_link,business_type)")
    .eq("status", "confirmed")
    .eq("reminder_24h_sent", false)
    .gte("date_time", w24h.start)
    .lte("date_time", w24h.end);

  if (err24) console.error("[Reminder] 24h query error:", err24);
  console.log(`[Reminder] 24h appointments found: ${appts24?.length ?? 0}`);

  for (const a of appts24 || []) {
    // reminders_enabled defaults TRUE — only skip if explicitly false
    if (a.salons?.reminders_enabled === false) {
      console.log(`[Reminder] Skipping ${a.id} — reminders disabled`);
      continue;
    }
    console.log(`[Reminder] Processing 24h for appointment ${a.id} (${a.client_name})`);

    // Email
    if (a.client_email) {
      try {
        await send24hReminder({
          to: a.client_email,
          clientName: a.client_name,
          serviceName: a.services?.name || "Appointment",
          staffName: a.staff?.name,
          salonName: a.salons?.name || "Your Salon",
          dateTime: a.date_time,
          price: a.services?.price,
          businessType: a.salons?.business_type,
        });
      } catch (e) { errors.push(`24h email ${a.id}: ${e}`); }
    }

    // WhatsApp
    if (a.client_phone && a.salons?.whatsapp_enabled !== false && !(await isOptedOut(a.client_phone))) {
      if (isMetaConfigured()) {
        // ── Meta WhatsApp Cloud API ────────────────────────────────────────
        try {
          const phone = formatPhoneE164(a.client_phone);
          if (phone) {
            const salonName  = a.salons?.name || "Your Salon";
            const [firstName] = (a.client_name || "Client").split(" ");
            const date = metaDate(a.date_time);
            const time = metaTime(a.date_time);

            // Free-form is only legal within the 24h customer service window
            const { data: sw } = await supabase
              .from("whatsapp_service_windows")
              .select("last_inbound_at")
              .eq("recipient_e164", phone)
              .maybeSingle();
            const inWindow =
              !!sw?.last_inbound_at &&
              Date.now() - new Date(sw.last_inbound_at).getTime() < 24 * 60 * 60 * 1000;

            let wamid: string;
            let templateName: string | null = null;

            if (inWindow) {
              wamid = await sendTextMessage({
                to:   phone,
                body: `Hi ${firstName}! Just a reminder that your appointment at ${salonName} is on ${date} at ${time}. See you then!\n\nReply STOP to opt out of reminders.`,
              });
            } else {
              // Template must be pre-approved in Meta Business Manager.
              // Expected params: {{1}} firstName, {{2}} salonName, {{3}} date, {{4}} time
              // Template must include an opt-out line to comply with PECR.
              templateName = "appointment_reminder";
              wamid = await sendTemplateMessage({
                to: phone,
                templateName,
                languageCode: "en_GB",
                components: [{
                  type:       "body",
                  parameters: [
                    { type: "text", text: firstName },
                    { type: "text", text: salonName },
                    { type: "text", text: date },
                    { type: "text", text: time },
                  ],
                }],
              });
            }

            // Log the send for delivery tracking and auditability
            await supabase.from("whatsapp_messages").insert({
              appointment_id: a.id,
              salon_id:       a.salon_id,
              recipient_e164: phone,
              direction:      "outbound",
              template_name:  templateName,
              wamid,
              status:         "sent",
            }).then(({ error: logErr }) => {
              if (logErr) console.error(`[Reminder] whatsapp_messages log error ${a.id}:`, logErr.message);
            });

            await supabase.from("appointments").update({ whatsapp_24h_sent: true }).eq("id", a.id);
          }
        } catch (e) { errors.push(`24h Meta WhatsApp ${a.id}: ${e}`); }
      } else {
        // ── Twilio fallback (used when Meta env vars are absent) ───────────
        try {
          await send24hWhatsApp({
            to:          a.client_phone,
            clientName:  a.client_name,
            time:        formatWATime(a.date_time),
            salonName:   a.salons?.name || "Your Salon",
            serviceName: a.services?.name,
          });
          await supabase.from("appointments").update({ whatsapp_24h_sent: true }).eq("id", a.id);
        } catch (e) { errors.push(`24h WhatsApp ${a.id}: ${e}`); }
      }
    }

    await supabase
      .from("appointments")
      .update({ reminder_24h_sent: true })
      .eq("id", a.id);
    sent++;
  }

  // ════════════════════════════════════════════════════════
  // 2. 2h BEFORE — Appointment Reminder
  // ════════════════════════════════════════════════════════
  const { data: appts2h, error: err2h } = await supabase
    .from("appointments")
    .select("*, services(name,price), staff(name), salons(name,slug,reminders_enabled,whatsapp_enabled,business_type)")
    .eq("status", "confirmed")
    .eq("reminder_2h_sent", false)
    .gte("date_time", w2h.start)
    .lte("date_time", w2h.end);

  if (err2h) console.error("[Reminder] 2h query error:", err2h);
  console.log(`[Reminder] 2h appointments found: ${appts2h?.length ?? 0}`);

  for (const a of appts2h || []) {
    if (a.salons?.reminders_enabled === false) continue;
    console.log(`[Reminder] Processing 2h for appointment ${a.id} (${a.client_name})`);

    // Email
    if (a.client_email) {
      try {
        await send2hReminder({
          to: a.client_email,
          clientName: a.client_name,
          serviceName: a.services?.name || "Appointment",
          staffName: a.staff?.name,
          salonName: a.salons?.name || "Your Salon",
          dateTime: a.date_time,
          price: a.services?.price,
          businessType: a.salons?.business_type,
        });
      } catch (e) { errors.push(`2h email ${a.id}: ${e}`); }
    }

    // WhatsApp
    if (a.client_phone && a.salons?.whatsapp_enabled !== false && !(await isOptedOut(a.client_phone))) {
      if (isMetaConfigured()) {
        // ── Meta WhatsApp Cloud API ────────────────────────────────────────
        try {
          const phone = formatPhoneE164(a.client_phone);
          if (phone) {
            const salonName   = a.salons?.name || "Your Salon";
            const [firstName] = (a.client_name || "Client").split(" ");
            const date = metaDate(a.date_time);
            const time = metaTime(a.date_time);

            const { data: sw } = await supabase
              .from("whatsapp_service_windows")
              .select("last_inbound_at")
              .eq("recipient_e164", phone)
              .maybeSingle();
            const inWindow =
              !!sw?.last_inbound_at &&
              Date.now() - new Date(sw.last_inbound_at).getTime() < 24 * 60 * 60 * 1000;

            let wamid: string;
            let templateName: string | null = null;

            if (inWindow) {
              wamid = await sendTextMessage({
                to:   phone,
                body: `Hi ${firstName}! Your appointment at ${salonName} is today at ${time}. See you soon!\n\nReply STOP to opt out of reminders.`,
              });
            } else {
              // Reuses appointment_reminder template; the time param makes it read as "2 hours away"
              templateName = "appointment_reminder";
              wamid = await sendTemplateMessage({
                to: phone,
                templateName,
                languageCode: "en_GB",
                components: [{
                  type:       "body",
                  parameters: [
                    { type: "text", text: firstName },
                    { type: "text", text: salonName },
                    { type: "text", text: date },
                    { type: "text", text: time },
                  ],
                }],
              });
            }

            await supabase.from("whatsapp_messages").insert({
              appointment_id: a.id,
              salon_id:       a.salon_id,
              recipient_e164: phone,
              direction:      "outbound",
              template_name:  templateName,
              wamid,
              status:         "sent",
            }).then(({ error: logErr }) => {
              if (logErr) console.error(`[Reminder] whatsapp_messages log error ${a.id}:`, logErr.message);
            });

            await supabase.from("appointments").update({ whatsapp_2h_sent: true }).eq("id", a.id);
          }
        } catch (e) { errors.push(`2h Meta WhatsApp ${a.id}: ${e}`); }
      } else {
        // ── Twilio fallback ────────────────────────────────────────────────
        try {
          await send2hWhatsApp({
            to:         a.client_phone,
            clientName: a.client_name,
            time:       formatWATime(a.date_time),
            salonName:  a.salons?.name || "Your Salon",
          });
          await supabase.from("appointments").update({ whatsapp_2h_sent: true }).eq("id", a.id);
        } catch (e) { errors.push(`2h WhatsApp ${a.id}: ${e}`); }
      }
    }

    await supabase
      .from("appointments")
      .update({ reminder_2h_sent: true })
      .eq("id", a.id);
    sent++;
  }

  // ════════════════════════════════════════════════════════
  // 3. AFTER VISIT — Thank You + Review Request
  //    ONLY sent when owner marks appointment as "completed"
  //    NO-SHOW appointments are automatically excluded
  // ════════════════════════════════════════════════════════
  const { data: appts1hAgo, error: err1h } = await supabase
    .from("appointments")
    .select("*, services(name), salons(name,slug,reminders_enabled,whatsapp_enabled,review_link)")
    .eq("status", "completed")        // ← Only COMPLETED visits get thank you
    .eq("thankyou_1h_sent", false)
    .gte("date_time", w1hAgo.start)
    .lte("date_time", w1hAgo.end);

  if (err1h) console.error("[Reminder] thankyou query error:", err1h);
  console.log(`[Reminder] Completed appointments (thankyou pending): ${appts1hAgo?.length ?? 0}`);

  for (const a of appts1hAgo || []) {
    if (a.salons?.reminders_enabled === false) continue;
    // Extra guard — never send to no-shows (should not appear due to query but safety net)
    if (a.status === "no-show" || a.status === "no_show" || a.status === "noshow") {
      console.log(`[Reminder] Skipping thankyou for no-show ${a.id}`);
      await supabase.from("appointments").update({ thankyou_1h_sent: true }).eq("id", a.id);
      continue;
    }
    console.log(`[Reminder] Processing thankyou for appointment ${a.id} (${a.client_name})`);

    const reviewLink = a.salons?.review_link || undefined;

    // Email
    if (a.client_email) {
      try {
        // This email only fires for appointments already marked completed, so
        // the stamp for this visit is already counted — "that was visit N" is
        // a fact here, not a prediction. null = programme off or lookup failed,
        // in which case no loyalty block renders.
        let loyalty = null;
        try {
          loyalty = await getLoyaltySnapshot(supabase, a.salon_id, a.client_email);
        } catch (loyaltyErr) {
          console.error(`[Reminder] Loyalty lookup failed for ${a.id} (non-fatal):`, loyaltyErr);
        }
        await sendThankyouEmail({
          to: a.client_email,
          clientName: a.client_name,
          salonName: a.salons?.name || "Your Salon",
          serviceName: a.services?.name,
          reviewLink,
          loyalty,
        });
      } catch (e) { errors.push(`thankyou email ${a.id}: ${e}`); }
    }

    // WhatsApp
    if (a.client_phone && !(await isOptedOut(a.client_phone))) {
      try {
        await sendThankyouWhatsApp({
          to:         a.client_phone,
          clientName: a.client_name,
          salonName:  a.salons?.name || "Your Salon",
          reviewLink,
        });
      } catch (e) { errors.push(`thankyou WhatsApp ${a.id}: ${e}`); }
    }

    await supabase
      .from("appointments")
      .update({ thankyou_1h_sent: true })
      .eq("id", a.id);
    sent++;
  }

  // ════════════════════════════════════════════════════════
  // 4. NO-SHOW DETECTION — 30-60 min after appointment
  // ════════════════════════════════════════════════════════
  const { data: apptsNoShow, error: errNoShow } = await supabase
    .from("appointments")
    .select("*, services(name), salons(id,name,slug,owner_email,owner_id,reminders_enabled,business_type)")
    .eq("status", "confirmed")           // still confirmed = never marked completed
    .eq("no_show_alert_sent", false)
    .gte("date_time", wNoShow.start)
    .lte("date_time", wNoShow.end);

  if (errNoShow) console.error("[Reminder] no-show query error:", errNoShow);
  console.log(`[Reminder] No-show candidates: ${apptsNoShow?.length ?? 0}`);

  for (const a of apptsNoShow || []) {
    if (a.salons?.reminders_enabled === false) continue;
    console.log(`[Reminder] Processing no-show for appointment ${a.id} (${a.client_name})`);

    const salon = a.salons;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

    // Resolve owner email
    let ownerEmail = salon?.owner_email || "";
    if (!ownerEmail && salon?.owner_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(salon.owner_id);
      ownerEmail = authUser?.user?.email || "";
    }

    if (ownerEmail) {
      try {
        await sendNoShowAlertEmail({
          to:           ownerEmail,
          clientName:   a.client_name,
          serviceName:  a.services?.name,
          dateTime:     a.date_time,
          salonName:    salon?.name || "Your Salon",
          dashboardUrl: `${appUrl}/dashboard/bookings`,
          businessType: salon?.business_type,
        });
      } catch (e) { errors.push(`no-show alert ${a.id}: ${e}`); }
    }

    await supabase
      .from("appointments")
      .update({ no_show_alert_sent: true })
      .eq("id", a.id);
    sent++;
  }

  // ════════════════════════════════════════════════════════
  // 5. 6 WEEKS AFTER — Win-back
  // ════════════════════════════════════════════════════════
  const { data: appts6wk, error: err6wk } = await supabase
    .from("appointments")
    .select("*, services(name), salons(id,name,slug,reminders_enabled,whatsapp_enabled)")
    .eq("status", "confirmed")
    .eq("winback_sent", false)
    .gte("date_time", w6wkAgo.start)
    .lte("date_time", w6wkAgo.end);

  if (err6wk) console.error("[Reminder] winback query error:", err6wk);
  console.log(`[Reminder] Winback appointments found: ${appts6wk?.length ?? 0}`);

  for (const a of appts6wk || []) {
    if (a.salons?.reminders_enabled === false) continue;
    console.log(`[Reminder] Processing winback for appointment ${a.id} (${a.client_name})`);

    const bookingLink = `${process.env.NEXT_PUBLIC_APP_URL}/book/${a.salons?.slug}`;

    // Email — skipped if the client has unsubscribed from marketing emails
    if (a.client_email && a.salons?.id && !(await isEmailOptedOut(a.salons.id, a.client_email))) {
      try {
        const unsubLink = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?email=${encodeURIComponent(a.client_email)}&salon=${encodeURIComponent(a.salons?.slug || "")}`;
        await sendWinbackEmail({
          to: a.client_email,
          clientName: a.client_name,
          salonName: a.salons?.name || "Your Salon",
          lastServiceName: a.services?.name,
          bookingLink,
          unsubLink,
        });
      } catch (e) { errors.push(`winback email ${a.id}: ${e}`); }
    }

    // WhatsApp
    if (a.client_phone && !(await isOptedOut(a.client_phone))) {
      try {
        await sendWinbackWhatsApp({
          to:              a.client_phone,
          clientName:      a.client_name,
          salonName:       a.salons?.name || "Your Salon",
          bookingLink,
          lastServiceName: a.services?.name,
        });
        await supabase
          .from("appointments")
          .update({ whatsapp_winback_sent: true })
          .eq("id", a.id);
      } catch (e) { errors.push(`winback WhatsApp ${a.id}: ${e}`); }
    }

    await supabase
      .from("appointments")
      .update({ winback_sent: true })
      .eq("id", a.id);
    sent++;
  }

  console.log(`[Reminder] ✅ Done. sent=${sent} errors=${errors.length}`);
  return NextResponse.json({
    success: true,
    sent,
    errorCount: errors.length > 0 ? errors.length : undefined,
    checkedAt: now.toISOString(),
    timezone: "Europe/London",
  });
}