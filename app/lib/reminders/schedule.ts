/**
 * When each automatic message is due — /api/send-reminder runs every 15
 * minutes (Supabase pg_cron) and once a day (Vercel cron, backup).
 *
 * Catch-up safe: each message has a WINDOW, not an exact minute, so a run
 * that was missed or late still sends it on the next run. Each message has a
 * sent flag on the booking, claimed BEFORE sending, so it goes at most once.
 * The windows are bounded, so old bookings never get a burst of messages.
 *
 *   24h reminder   confirmed, starts in 2h–24h,   booked 24h+ ahead
 *   2h reminder    confirmed, starts in 30m–2h,   booked 2h+ ahead
 *   thank-you      completed, started 1h–24h ago
 *   no-show alert  still confirmed, started 30m–12h ago (email to the owner)
 *   win-back       still confirmed, 42–43 days ago, email only, skipped when
 *                  the client already has a later booking at the salon
 *
 * Times are absolute (UTC instants); messages show them in Europe/London.
 * No imports, so the unit tests run it directly.
 */

export type ReminderKind = "24h" | "2h" | "thankyou" | "noshow" | "winback";

/** Order of a run: the most time-sensitive first. */
export const REMINDER_KINDS: ReminderKind[] = ["2h", "24h", "noshow", "thankyou", "winback"];

/** The booking column that records the message went (claimed before sending). */
export const SENT_FLAG: Record<ReminderKind, string> = {
  "24h": "reminder_24h_sent",
  "2h": "reminder_2h_sent",
  thankyou: "thankyou_1h_sent",
  noshow: "no_show_alert_sent",
  winback: "winback_sent",
};

/** The status a booking must have for the message. */
export const REQUIRED_STATUS: Record<ReminderKind, "confirmed" | "completed"> = {
  "24h": "confirmed",
  "2h": "confirmed",
  thankyou: "completed",
  noshow: "confirmed",
  winback: "confirmed",
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Booking start (date_time) must be AFTER `after` and AT OR BEFORE `upTo`. */
export interface DueWindow { after: Date; upTo: Date }

export function dueWindow(kind: ReminderKind, now: Date): DueWindow {
  const t = now.getTime();
  const w = (afterMs: number, upToMs: number) => ({ after: new Date(t + afterMs), upTo: new Date(t + upToMs) });
  switch (kind) {
    case "24h":      return w(2 * HOUR, 24 * HOUR);
    case "2h":       return w(30 * MIN, 2 * HOUR);
    case "thankyou": return w(-24 * HOUR, -1 * HOUR);
    case "noshow":   return w(-12 * HOUR, -30 * MIN);
    case "winback":  return w(-43 * DAY, -42 * DAY);
  }
}

/**
 * The booking already existed when the reminder's normal time came: a client
 * who books 5 hours ahead has just had the confirmation, so no "24h" reminder
 * minutes later (the 2h one still comes). Unknown created_at = old row = yes.
 */
export function bookedInTime(kind: ReminderKind, dateTime: string, createdAt: string | null | undefined): boolean {
  const lead = kind === "24h" ? 24 * HOUR : kind === "2h" ? 2 * HOUR : 0;
  if (!lead || !createdAt) return true;
  const start = Date.parse(dateTime), created = Date.parse(createdAt);
  if (Number.isNaN(start) || Number.isNaN(created)) return true;
  return created <= start - lead;
}

export interface BookingTiming {
  status: string | null;
  date_time: string;
  created_at?: string | null;
  sent?: boolean | null;         // the message's SENT_FLAG value
}

/** Is this message due for this booking right now? (status, flag, window, booked in time) */
export function isDue(kind: ReminderKind, b: BookingTiming, now: Date): boolean {
  if (b.status !== REQUIRED_STATUS[kind] || b.sent !== false) return false;
  const start = Date.parse(b.date_time);
  if (Number.isNaN(start)) return false;
  const { after, upTo } = dueWindow(kind, now);
  return start > after.getTime() && start <= upTo.getTime() && bookedInTime(kind, b.date_time, b.created_at);
}

/** Phone number as comparable digits (UK 07… and +44 7… match). */
export function phoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = "44" + d.slice(1);
  return d.length >= 7 ? d : null;
}

export interface ClientContact { client_email?: string | null; client_phone?: string | null }

/** Same client: same email (any case) or same phone number. */
export function sameClient(a: ClientContact, b: ClientContact): boolean {
  const ea = (a.client_email ?? "").trim().toLowerCase(), eb = (b.client_email ?? "").trim().toLowerCase();
  if (ea && ea === eb) return true;
  const pa = phoneDigits(a.client_phone), pb = phoneDigits(b.client_phone);
  return !!pa && pa === pb;
}

/** A WhatsApp "STOP": the whole reply is an opt-out word (not "cancel" — that may mean the appointment). */
export function isOptOutReply(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toUpperCase().replace(/[.!\s]+$/g, "").replace(/\s+/g, " ");
  return ["STOP", "STOP ALL", "STOPALL", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "END", "QUIT"].includes(t);
}
