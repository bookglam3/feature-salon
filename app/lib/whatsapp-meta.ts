// ─────────────────────────────────────────────────────────────────────────────
// app/lib/whatsapp-meta.ts
// Meta WhatsApp Business Cloud API — sending module (Graph API v23.0+)
//
// Env vars required:
//   WHATSAPP_PHONE_NUMBER_ID      — numeric ID from Meta Developer Dashboard
//   WHATSAPP_ACCESS_TOKEN         — permanent system-user token
//   WHATSAPP_APP_SECRET           — used by the webhook to verify HMAC signatures
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN — arbitrary string set in Meta webhook config
//   WHATSAPP_API_VERSION          — optional, defaults to "v23.0"
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

import { formatTimeDisplay } from "./formatTime";

/** A single parameter inside a template component */
export type TemplateParameter =
  | { type: "text"; text: string }
  | { type: "image"; image: { link: string } };

/** One component (header / body / button) of a template message */
export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters: TemplateParameter[];
  sub_type?: "quick_reply" | "url";
  index?: number;
}

interface MetaTemplatePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

interface MetaTextPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: { body: string };
}

interface MetaApiResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

/** Typed error for Meta API failures — inspect `.code` for programmatic handling */
export class WhatsAppMetaError extends Error {
  constructor(
    public readonly code: number,
    public readonly metaMessage: string,
    public readonly type?: string,
  ) {
    super(`WhatsApp Meta API error ${code}: ${metaMessage}`);
    this.name = "WhatsAppMetaError";
  }
}

// ── Env accessor ──────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[WhatsApp Meta] Missing required env var: ${key}`);
  return val;
}

function getConfig() {
  return {
    phoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),
    accessToken:   requireEnv("WHATSAPP_ACCESS_TOKEN"),
    apiVersion:    process.env.WHATSAPP_API_VERSION ?? "v23.0",
  } as const;
}

/**
 * Returns true when all required Meta env vars are present.
 * Use as a runtime guard before calling any send function:
 *   if (isMetaConfigured()) { await sendTemplateMessage(…) }
 */
export function isMetaConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_ACCESS_TOKEN
  );
}

// ── Phone normalisation ───────────────────────────────────────────────────────

/**
 * Normalises a raw phone string to E.164 digits WITHOUT a leading '+'.
 * Meta's Graph API expects the plain numeric form: 447911123456, not +447911123456.
 *
 * Supports UK, Pakistan, UAE, Saudi Arabia, and any pre-formatted E.164.
 * Returns null when the input is unrecognisable — callers should skip the send.
 */
export function formatPhoneE164(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  // Already formatted as E.164 (e.g. "+447911123456" → "447911123456")
  if (raw.trimStart().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  // ── UK ──────────────────────────────────────────────────────────────────────
  if (digits.startsWith("44") && digits.length === 12)    return digits;
  if (digits.startsWith("0")  && digits.length === 11)    return `44${digits.slice(1)}`;
  if (digits.startsWith("7")  && digits.length === 10)    return `44${digits}`;

  // ── Pakistan ─────────────────────────────────────────────────────────────────
  if (digits.startsWith("92") && digits.length === 12)    return digits;
  if (digits.startsWith("03") && digits.length === 11)    return `92${digits.slice(1)}`;
  if (digits.startsWith("3")  && digits.length === 10)    return `92${digits}`;

  // ── UAE ──────────────────────────────────────────────────────────────────────
  if (digits.startsWith("971") && (digits.length === 12 || digits.length === 11)) return digits;
  if (digits.startsWith("05") && digits.length === 10)    return `971${digits.slice(1)}`;

  // ── Saudi Arabia ──────────────────────────────────────────────────────────────
  if (digits.startsWith("966") && (digits.length === 12 || digits.length === 11)) return digits;
  if (digits.startsWith("05") && digits.length === 9)     return `966${digits.slice(1)}`;

  // Generic fallback for any 10-15 digit number without a matched country prefix
  if (digits.length >= 10 && digits.length <= 15)         return digits;

  return null;
}

// ── Core API caller ───────────────────────────────────────────────────────────

async function postToMeta(payload: MetaTemplatePayload | MetaTextPayload): Promise<string> {
  const { phoneNumberId, accessToken, apiVersion } = getConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: { code?: number; message?: string; type?: string } };
    const err = errBody?.error ?? {};
    throw new WhatsAppMetaError(
      err.code    ?? res.status,
      err.message ?? `HTTP ${res.status}`,
      err.type,
    );
  }

  const data: MetaApiResponse = await res.json();
  return data.messages?.[0]?.id ?? "";
}

// ── Public send functions ─────────────────────────────────────────────────────

/**
 * Sends a Meta-approved template message.
 * Required when the customer has NOT messaged in the last 24 hours (no open
 * service window). Template must be pre-approved in Meta Business Manager.
 *
 * Returns the wamid (Meta's unique message ID).
 */
export async function sendTemplateMessage({
  to,
  templateName,
  languageCode = "en_GB",
  components,
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: TemplateComponent[];
}): Promise<string> {
  const phone = formatPhoneE164(to);
  if (!phone) throw new WhatsAppMetaError(0, `Cannot normalise phone number: ${to}`);

  return postToMeta({
    messaging_product: "whatsapp",
    to:   phone,
    type: "template",
    template: {
      name:       templateName,
      language:   { code: languageCode },
      components: components ?? [],
    },
  });
}

/**
 * Sends a free-form text message.
 * Only legal within the 24-hour customer service window (the customer sent
 * us a message first within the past 24 hours). Free-form messages outside
 * that window are rejected by Meta with error code 131047.
 *
 * Returns the wamid.
 */
export async function sendTextMessage({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<string> {
  const phone = formatPhoneE164(to);
  if (!phone) throw new WhatsAppMetaError(0, `Cannot normalise phone number: ${to}`);

  return postToMeta({
    messaging_product: "whatsapp",
    to:   phone,
    type: "text",
    text: { body },
  });
}

// ── Time/date formatters ──────────────────────────────────────────────────────
// Re-exported so the reminder cron can format template parameters
// without importing from the Twilio module.

export function formatWADate(dateTime: string, timezone = "Europe/London"): string {
  return new Date(dateTime).toLocaleDateString("en-GB", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    timeZone: timezone,
  });
}

export function formatWATime(dateTime: string, timezone = "Europe/London"): string {
  return formatTimeDisplay(dateTime, { timeZone: timezone });
}
