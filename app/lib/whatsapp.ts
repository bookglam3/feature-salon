import twilio from "twilio";
import { formatTimeDisplay } from "./formatTime";

// ─────────────────────────────────────────────────────────
// Twilio client — reuses same SID/token as SMS
// ─────────────────────────────────────────────────────────
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// WhatsApp sandbox: whatsapp:+14155238886
// Production: swap to your approved WhatsApp Business number
const FROM_WHATSAPP = process.env.TWILIO_WHATSAPP_FROM!; // e.g. whatsapp:+14155238886

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

// GDPR opt-out footer — required for ICO / GDPR compliance
const GDPR_FOOTER = `\n\nReply STOP to opt out. Unsubscribe: ${APP_URL}/api/whatsapp-optout`;

// ─────────────────────────────────────────────────────────
// normalisePhone — multi-country E.164 conversion
//
// Supports:
//   🇬🇧  UK:     07xxx / 447xxx / +447xxx
//   🇵🇰  PAK:    03xxxxxxxxx / 923xxxxxxxxx / +92xxx
//   🇦🇪  UAE:    971xxxxxxxxx / +971xxx
//   🇸🇦  KSA:    966xxxxxxxxx / +966xxx
//   Any raw E.164 (starts with +)
// ─────────────────────────────────────────────────────────
export function normalisePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  // Already a valid E.164 (has leading +)
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  // ── UK ──────────────────────────────
  if (digits.startsWith("44") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11)  return `+44${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 10)  return `+44${digits}`;

  // ── Pakistan ─────────────────────────
  if (digits.startsWith("92") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("03") && digits.length === 11) return `+92${digits.slice(1)}`;

  // ── UAE ──────────────────────────────
  if (digits.startsWith("971") && (digits.length === 12 || digits.length === 11)) {
    return `+${digits}`;
  }
  if (digits.startsWith("05") && digits.length === 10) return `+971${digits.slice(1)}`;

  // ── Saudi Arabia ─────────────────────
  if (digits.startsWith("966") && (digits.length === 12 || digits.length === 11)) {
    return `+${digits}`;
  }
  if (digits.startsWith("05") && digits.length === 9) return `+966${digits.slice(1)}`;

  // Fallback — any 10-15 digit string (best effort)
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;

  return null; // unrecognised — skip WhatsApp
}

// ─────────────────────────────────────────────────────────
// UK time formatter (Europe/London — handles GMT/BST auto)
// ─────────────────────────────────────────────────────────
export function formatWATime(dateTime: string): string {
  return formatTimeDisplay(dateTime, { timeZone: "Europe/London" });
}

export function formatWADate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

// ─────────────────────────────────────────────────────────
// Core WhatsApp sender
// ─────────────────────────────────────────────────────────
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const normalisedTo = normalisePhone(to);
  if (!normalisedTo) {
    console.warn(`[WhatsApp] Skipping — could not normalise phone: ${to}`);
    return;
  }

  const waTo = normalisedTo.startsWith("whatsapp:") ? normalisedTo : `whatsapp:${normalisedTo}`;

  try {
    await client.messages.create({
      from: FROM_WHATSAPP,
      to:   waTo,
      body: body + GDPR_FOOTER,
    });
    console.log(`[WhatsApp] ✅ Sent to ${normalisedTo}`);
  } catch (err) {
    console.error(`[WhatsApp] ❌ Failed to send to ${normalisedTo}:`, err);
    throw err; // re-throw so caller can log in errors[]
  }
}

// ═══════════════════════════════════════════════════════════
// 1. Booking Confirmation — sent immediately after booking
// ═══════════════════════════════════════════════════════════
export async function sendWhatsAppConfirmation({
  to,
  clientName,
  serviceName,
  staffName,
  salonName,
  salonAddress,
  dateTime,
  price,
  cancelLink,
}: {
  to: string;
  clientName: string;
  serviceName: string;
  staffName?: string;
  salonName: string;
  salonAddress?: string;
  dateTime: string;
  price?: number;
  cancelLink?: string;
}) {
  const date = formatWADate(dateTime);
  const time = formatWATime(dateTime);
  const staffLine = staffName ? ` with ${staffName}` : "";
  const addressLine = salonAddress ? `\n📍 ${salonAddress}` : "";
  const priceLine = price ? `\n💷 £${price}` : "";
  const cancelLine = cancelLink ? `\n\nTo cancel or reschedule: ${cancelLink}` : "";

  const body =
    `✅ *Booking Confirmed!*\n\n` +
    `Hi ${clientName}, your appointment is booked!\n\n` +
    `💇 ${serviceName}${staffLine}\n` +
    `📅 ${date} at ${time}\n` +
    `🏪 ${salonName}` +
    addressLine +
    priceLine +
    cancelLine;

  await sendWhatsApp(to, body);
}

// ═══════════════════════════════════════════════════════════
// 2. 24h Before — Appointment Reminder
// ═══════════════════════════════════════════════════════════
export async function send24hWhatsApp({
  to,
  clientName,
  time,
  salonName,
  serviceName,
}: {
  to: string;
  clientName: string;
  time: string;
  salonName: string;
  serviceName?: string;
}) {
  const serviceNote = serviceName ? ` for your ${serviceName}` : "";
  const body =
    `⏰ *Appointment Reminder*\n\n` +
    `Hi ${clientName}! Your appointment is *tomorrow at ${time}*${serviceNote} at ${salonName}.\n\n` +
    `See you then! 💅`;

  await sendWhatsApp(to, body);
}

// ═══════════════════════════════════════════════════════════
// 3. 2h Before — Appointment Reminder
// ═══════════════════════════════════════════════════════════
export async function send2hWhatsApp({
  to,
  clientName,
  time,
  salonName,
}: {
  to: string;
  clientName: string;
  time: string;
  salonName: string;
}) {
  const body =
    `⏳ *Just a heads up!*\n\n` +
    `Hi ${clientName}, your appointment at ${salonName} is in *2 hours at ${time}*.\n\n` +
    `We look forward to seeing you! ✨`;

  await sendWhatsApp(to, body);
}

// ═══════════════════════════════════════════════════════════
// 4. 6 Weeks After — Win-back / Rebooking
// ═══════════════════════════════════════════════════════════
export async function sendWinbackWhatsApp({
  to,
  clientName,
  salonName,
  bookingLink,
  lastServiceName,
}: {
  to: string;
  clientName: string;
  salonName: string;
  bookingLink: string;
  lastServiceName?: string;
}) {
  const serviceNote = lastServiceName ? ` for your ${lastServiceName}` : "";
  const body =
    `💇 *Time for your next appointment!*\n\n` +
    `Hi ${clientName}, it's been 6 weeks since your last visit${serviceNote} at ${salonName}.\n\n` +
    `Ready to book? 👇\n${bookingLink}`;

  await sendWhatsApp(to, body);
}

// ═══════════════════════════════════════════════════════════
// 5. 1h After — Thank You + Review Request (WhatsApp)
// ═══════════════════════════════════════════════════════════
export async function sendThankyouWhatsApp({
  to,
  clientName,
  salonName,
  reviewLink,
}: {
  to: string;
  clientName: string;
  salonName: string;
  reviewLink?: string;
}) {
  const reviewPart = reviewLink
    ? `\n\n⭐ We'd love your feedback:\n${reviewLink}`
    : "";

  const body =
    `🙏 *Thank you for visiting ${salonName}!*\n\n` +
    `Hi ${clientName}, it was great having you with us today.` +
    reviewPart +
    `\n\nSee you next time! 💅`;

  await sendWhatsApp(to, body);
}
