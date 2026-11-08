import { NextRequest, NextResponse } from "next/server";
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
  isMetaConfigured,
  formatPhoneE164,
  sendTemplateMessage,
  sendTextMessage,
  formatWADate as metaDate,
  formatWATime as metaTime,
} from "@/app/lib/whatsapp-meta";
import {
  REMINDER_KINDS,
  REQUIRED_STATUS,
  SENT_FLAG,
  dueWindow,
  isDue,
  sameClient,
  type ReminderKind,
} from "@/app/lib/reminders/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Automatic messages: 24h and 2h reminders, thank-you, no-show alert to the
// owner, win-back email. When each is due: app/lib/reminders/schedule.ts.
//
//   POST — Supabase pg_cron every 15 minutes (sql/2026-11-09-reminders-every-15-min.sql).
//          Authorization: Bearer <REMINDERS_CRON_SECRET>. Body {"dry_run": true}:
//          count what is due, send and change nothing.
//   GET  — Vercel cron once a day (vercel.json), a backup. Authorization:
//          Bearer <CRON_SECRET>, added by Vercel.
//
// Every message is claimed on the booking (its sent flag, false → true)
// BEFORE it is sent, so two runs at the same time can't both send it, and a
// booking never gets the same message twice. Email and WhatsApp are separate:
// a WhatsApp problem never stops the email.
//
// WhatsApp goes ONLY through Meta, and only when WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN are both set; otherwise it is off (no Twilio fallback)
// and the run says "whatsapp":"off". Only the 24h / 2h reminders use it (Meta
// template appointment_reminder); thank-you is email only until it has a
// template of its own.

const MAX_PER_KIND = 25;          // per message type per run; the rest go on the next run
const TIME_BUDGET_MS = 45_000;    // stop starting new bookings after this (function limit 60 s)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — the cron reads every salon's bookings
);

interface SalonInfo {
  id: string;
  name: string | null;
  slug: string | null;
  owner_id: string | null;
  owner_email: string | null;
  reminders_enabled: boolean | null;
  whatsapp_enabled: boolean | null;
  review_link: string | null;
  business_type: string | null;
}
interface Booking {
  id: string;
  salon_id: string;
  status: string | null;
  date_time: string;
  created_at: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  reminder_24h_sent: boolean | null;
  reminder_2h_sent: boolean | null;
  thankyou_1h_sent: boolean | null;
  no_show_alert_sent: boolean | null;
  winback_sent: boolean | null;
  services: { name: string | null; price: number | null } | null;
  staff: { name: string | null } | null;
  salons: SalonInfo | null;
}
const SELECT =
  "id, salon_id, status, date_time, created_at, client_name, client_email, client_phone, " +
  "reminder_24h_sent, reminder_2h_sent, thankyou_1h_sent, no_show_alert_sent, winback_sent, " +
  "services(name,price), staff(name), " +
  "salons(id,name,slug,owner_id,owner_email,reminders_enabled,whatsapp_enabled,review_link,business_type)";

/** "meta" when both Meta env vars are set, else "off". Only yes/no on env vars — never their values. */
const whatsappMode = (): "meta" | "off" => (isMetaConfigured() ? "meta" : "off");

function emptyCounts(): Record<ReminderKind, number> {
  return { "24h": 0, "2h": 0, thankyou: 0, noshow: 0, winback: 0 };
}

function newSummary(dryRun: boolean, now: Date) {
  return {
    dryRun,
    checkedAt: now.toISOString(),
    timezone: "Europe/London",
    whatsapp: whatsappMode(),
    due: emptyCounts(),
    sent: emptyCounts(),
    skipped: { remindersOff: 0, rebooked: 0, noEmailOrUnsubscribed: 0, alreadyTaken: 0, timeBudget: 0 },
    email: { sent: 0, failed: 0 },
    whatsappSent: 0,
    whatsappFailed: 0,
    whatsappErrors: {} as Record<string, number>, // error code → count (e.g. Meta 132001 = template missing)
    errors: 0,
  };
}
type Summary = ReturnType<typeof newSummary>;

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.REMINDERS_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "REMINDERS_CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await runReminders(body?.dry_run === true));
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runReminders(false));
}

// ── The run ──────────────────────────────────────────────────────────────────

async function runReminders(dryRun: boolean): Promise<Summary> {
  const started = Date.now();
  const now = new Date(started);
  const summary = newSummary(dryRun, now);

  for (const kind of REMINDER_KINDS) {
    const flag = SENT_FLAG[kind];
    const { after, upTo } = dueWindow(kind, now);
    const { data, error } = await supabase
      .from("appointments")
      .select(SELECT)
      .eq("status", REQUIRED_STATUS[kind])
      .eq(flag, false)
      .gt("date_time", after.toISOString())
      .lte("date_time", upTo.toISOString())
      .order("date_time", { ascending: true })
      .limit(MAX_PER_KIND * 4);
    if (error) {
      console.error(`[Reminder] ${kind} query failed:`, error.message);
      summary.errors++;
      continue;
    }

    let handled = 0;
    for (const a of (data ?? []) as unknown as Booking[]) {
      const flagValue = (a as unknown as Record<string, boolean | null>)[flag];
      if (!isDue(kind, { status: a.status, date_time: a.date_time, created_at: a.created_at, sent: flagValue }, now)) continue;
      if (a.salons?.reminders_enabled === false) { summary.skipped.remindersOff++; continue; }
      if (handled >= MAX_PER_KIND || Date.now() - started > TIME_BUDGET_MS) { summary.skipped.timeBudget++; continue; }
      if (kind === "winback") {
        // email only: no address or unsubscribed from marketing → nothing to send
        if (!a.client_email || (await isEmailOptedOut(a.salon_id, a.client_email))) { summary.skipped.noEmailOrUnsubscribed++; continue; }
        if (await hasLaterBooking(a)) { summary.skipped.rebooked++; continue; }
      }

      summary.due[kind]++;
      handled++;
      if (dryRun) continue;

      if (!(await claim(a.id, flag, REQUIRED_STATUS[kind]))) { summary.skipped.alreadyTaken++; continue; }
      await deliver(kind, a, summary);
      summary.sent[kind]++;
    }
  }

  console.log("[Reminder] run summary", JSON.stringify(summary));
  return summary;
}

/** Sets the message's flag false → true. Only the run that does it sends. */
async function claim(id: string, flag: string, status: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointments")
    .update({ [flag]: true })
    .eq("id", id)
    .eq(flag, false)
    .eq("status", status)
    .select("id");
  if (error) {
    console.error(`[Reminder] couldn't claim ${flag} for ${id}:`, error.message);
    return false;
  }
  return (data?.length ?? 0) === 1;
}

async function deliver(kind: ReminderKind, a: Booking, s: Summary) {
  const salonName = a.salons?.name || "Your Salon";
  const email = async (label: string, send: () => Promise<unknown>) => {
    try { await send(); s.email.sent++; }
    catch (e) { s.email.failed++; console.error(`[Reminder] ${label} email failed for ${a.id}:`, e instanceof Error ? e.message : e); }
  };

  if (kind === "24h" || kind === "2h") {
    if (a.client_email) {
      const sendEmail = kind === "24h" ? send24hReminder : send2hReminder;
      await email(kind, () => sendEmail({
        to: a.client_email!,
        clientName: a.client_name ?? "",
        serviceName: a.services?.name || "Appointment",
        staffName: a.staff?.name ?? undefined,
        salonName,
        dateTime: a.date_time,
        price: a.services?.price ?? undefined,
        businessType: a.salons?.business_type ?? undefined,
      }));
    }
    if (whatsappMode() === "meta" && (await whatsappAllowed(a))) await reminderWhatsApp(kind, a, s);
    return;
  }

  if (kind === "thankyou") {
    // email only (no Meta template for it yet)
    const reviewLink = a.salons?.review_link || undefined;
    if (a.client_email) {
      await email("thank-you", async () => {
        // Only completed visits get here, so "that was visit N" is a fact.
        let loyalty = null;
        try { loyalty = await getLoyaltySnapshot(supabase, a.salon_id, a.client_email!); }
        catch (e) { console.error(`[Reminder] loyalty lookup failed for ${a.id} (non-fatal):`, e instanceof Error ? e.message : e); }
        await sendThankyouEmail({
          to: a.client_email!, clientName: a.client_name ?? "", salonName,
          serviceName: a.services?.name ?? undefined, reviewLink, loyalty,
        });
      });
    }
    return;
  }

  if (kind === "noshow") {
    let ownerEmail = a.salons?.owner_email || "";
    if (!ownerEmail && a.salons?.owner_id) {
      const { data: owner } = await supabase.auth.admin.getUserById(a.salons.owner_id);
      ownerEmail = owner?.user?.email || "";
    }
    if (ownerEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
      await email("no-show", () => sendNoShowAlertEmail({
        to: ownerEmail, clientName: a.client_name ?? "", serviceName: a.services?.name ?? undefined,
        dateTime: a.date_time, salonName, dashboardUrl: `${appUrl}/dashboard/bookings`,
        businessType: a.salons?.business_type ?? undefined,
      }));
    }
    return;
  }

  // win-back: email only (a marketing message). The run already checked the
  // address, the marketing opt-out and that the client hasn't booked again.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
  const slug = a.salons?.slug || "";
  await email("win-back", () => sendWinbackEmail({
    to: a.client_email!, clientName: a.client_name ?? "", salonName,
    lastServiceName: a.services?.name ?? undefined,
    bookingLink: `${appUrl}/book/${slug}`,
    unsubLink: `${appUrl}/unsubscribe?email=${encodeURIComponent(a.client_email!)}&salon=${encodeURIComponent(slug)}`,
  }));
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

/** A phone, the salon's WhatsApp switch on, and the number hasn't replied STOP. */
async function whatsappAllowed(a: Booking): Promise<boolean> {
  return !!a.client_phone && a.salons?.whatsapp_enabled !== false && !(await isOptedOut(a.client_phone));
}

async function whatsappAttempt(s: Summary, id: string, send: () => Promise<unknown>): Promise<boolean> {
  try { await send(); s.whatsappSent++; return true; }
  catch (e) {
    s.whatsappFailed++;
    const code = String((e as { code?: unknown })?.code ?? "error");
    s.whatsappErrors[code] = (s.whatsappErrors[code] ?? 0) + 1;
    console.error(`[Reminder] WhatsApp failed for ${id} (code ${code}):`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** 24h / 2h reminder over Meta WhatsApp (only called when whatsappMode() is "meta"). */
async function reminderWhatsApp(kind: "24h" | "2h", a: Booking, s: Summary) {
  const sentFlag = kind === "24h" ? "whatsapp_24h_sent" : "whatsapp_2h_sent";
  const salonName = a.salons?.name || "Your Salon";
  const phone = formatPhoneE164(a.client_phone!);
  if (!phone) { s.whatsappFailed++; s.whatsappErrors.bad_phone = (s.whatsappErrors.bad_phone ?? 0) + 1; return; }
  const [firstName] = (a.client_name || "Client").split(" ");
  const date = metaDate(a.date_time);
  const time = metaTime(a.date_time);

  // Free text only inside the 24h customer service window; otherwise the
  // approved template appointment_reminder ({{1}} name, {{2}} salon, {{3}} date, {{4}} time).
  const { data: sw } = await supabase
    .from("whatsapp_service_windows").select("last_inbound_at").eq("recipient_e164", phone).maybeSingle();
  const inWindow = !!sw?.last_inbound_at && Date.now() - new Date(sw.last_inbound_at).getTime() < 24 * 60 * 60 * 1000;
  const templateName = inWindow ? null : "appointment_reminder";

  let wamid = "";
  const ok = await whatsappAttempt(s, a.id, async () => {
    wamid = inWindow
      ? await sendTextMessage({
          to: phone,
          body: kind === "24h"
            ? `Hi ${firstName}! Just a reminder that your appointment at ${salonName} is on ${date} at ${time}. See you then!\n\nReply STOP to opt out of reminders.`
            : `Hi ${firstName}! Your appointment at ${salonName} is today at ${time}. See you soon!\n\nReply STOP to opt out of reminders.`,
        })
      : await sendTemplateMessage({
          to: phone,
          templateName: "appointment_reminder",
          languageCode: "en_GB",
          components: [{ type: "body", parameters: [
            { type: "text", text: firstName },
            { type: "text", text: salonName },
            { type: "text", text: date },
            { type: "text", text: time },
          ] }],
        });
  });
  if (!ok) return;

  const { error: logErr } = await supabase.from("whatsapp_messages").insert({
    appointment_id: a.id, salon_id: a.salon_id, recipient_e164: phone,
    direction: "outbound", template_name: templateName, wamid, status: "sent",
  });
  if (logErr) console.error(`[Reminder] whatsapp_messages log failed for ${a.id}:`, logErr.message);
  await supabase.from("appointments").update({ [sentFlag]: true }).eq("id", a.id);
}

// ── Opt-outs and repeat clients ──────────────────────────────────────────────

/** STOP list (SMS + WhatsApp). Saved as +44…; bookings may say 07… — both are checked. */
async function isOptedOut(raw: string): Promise<boolean> {
  const digits = formatPhoneE164(raw);            // 447…
  const keys = [...new Set([raw.trim(), digits ? `+${digits}` : null, digits].filter((k): k is string => !!k))];
  const { data, error } = await supabase.from("sms_opt_outs").select("id").in("phone", keys).limit(1);
  if (error) {
    console.error("[Reminder] opt-out lookup failed — not sending WhatsApp:", error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/** Marketing-email opt-out (clients table, set by import or /unsubscribe). */
async function isEmailOptedOut(salonId: string, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("clients").select("id")
    .eq("salon_id", salonId).eq("email", email.toLowerCase().trim()).eq("marketing_opt_out", true)
    .limit(1);
  if (error) {
    console.error("[Reminder] email opt-out lookup failed — not sending win-back:", error.message);
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/** Win-back only when the client hasn't booked again at this salon (any later, not-cancelled booking). */
async function hasLaterBooking(a: Booking): Promise<boolean> {
  const { data, error } = await supabase
    .from("appointments").select("client_email, client_phone")
    .eq("salon_id", a.salon_id).neq("id", a.id)
    .gt("date_time", a.date_time)
    .not("status", "in", "(cancelled,canceled)")
    .limit(1000);
  if (error) {
    console.error(`[Reminder] later-booking check failed for ${a.id} — skipping win-back:`, error.message);
    return true;
  }
  return (data ?? []).some(b => sameClient(a, b));
}
