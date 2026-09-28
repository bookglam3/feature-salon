// Server-side only: business-details validation for self-serve signup.
// Used by /api/signup/validate-business (pre-check before the email OTP) and
// /api/signup/complete (the authoritative check before a salon is created).
// Never import this into a client component — it pulls in the full
// libphonenumber metadata and calls postcodes.io.

import { z } from "zod";
import { parsePhoneNumberFromString, type PhoneNumberType } from "libphonenumber-js/max";

const UK_COUNTRIES = ["England", "Scotland", "Wales", "Northern Ireland"] as const;
type UkCountry = (typeof UK_COUNTRIES)[number];

// Mobile, landline and 03 (UK-wide, charged as a landline). Everything else —
// 08 premium/freephone, 056 VoIP, pagers — is rejected.
const ALLOWED_PHONE_TYPES = new Set<PhoneNumberType>(["MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE", "UAN"]);

const POSTCODE_FORMAT = /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$/;
const POSTCODE_NOT_FOUND = "We couldn't find that postcode. Please check it.";
const POSTCODE_UNAVAILABLE = "We couldn't check your postcode right now. Please try again in a minute.";

// ── Postcode ────────────────────────────────────────────────────────

/** "sw1a1aa " → "SW1A 1AA": uppercase, no stray spaces, one space before the last 3 chars. */
export function normalisePostcode(input: string): string {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

export type PostcodeLookup =
  | { ok: true; postcode: string; town: string; country: UkCountry; latitude: number | null; longitude: number | null }
  | { ok: false; error: string };

export async function lookupPostcode(input: string): Promise<PostcodeLookup> {
  const postcode = normalisePostcode(input);
  if (!POSTCODE_FORMAT.test(postcode)) return { ok: false, error: POSTCODE_NOT_FOUND };

  let res: Response;
  try {
    res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[postcodes.io] request failed:", err);
    return { ok: false, error: POSTCODE_UNAVAILABLE };
  }

  if (res.status === 404) return { ok: false, error: POSTCODE_NOT_FOUND };
  if (!res.ok) {
    console.error("[postcodes.io] unexpected status:", res.status);
    return { ok: false, error: POSTCODE_UNAVAILABLE };
  }

  const json = await res.json().catch(() => null);
  const r = json?.result;
  if (!r) {
    console.error("[postcodes.io] response had no result");
    return { ok: false, error: POSTCODE_UNAVAILABLE };
  }

  // postcodes.io also covers the Channel Islands and Isle of Man — not UK.
  if (!UK_COUNTRIES.includes(r.country)) {
    return { ok: false, error: "Feature is only available for businesses in England, Scotland, Wales and Northern Ireland." };
  }

  // Unparished areas come back as e.g. "Westminster, unparished area".
  const parish = typeof r.parish === "string" ? r.parish.replace(/, unparished area$/i, "") : null;
  const town: string = r.admin_district || parish || r.region || r.country;

  return {
    ok: true,
    postcode: r.postcode ?? postcode,
    town,
    country: r.country,
    latitude:  typeof r.latitude  === "number" ? r.latitude  : null,
    longitude: typeof r.longitude === "number" ? r.longitude : null,
  };
}

// ── Phone ───────────────────────────────────────────────────────────

/** Accepts UK mobile, landline and 03 numbers in any common format; returns E.164 (+447…). */
export function validateUkPhone(input: string): { ok: true; phone: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Business phone is required." };

  const parsed = parsePhoneNumberFromString(trimmed, "GB");
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: "Please enter a valid UK phone number, e.g. 07… or 020…" };
  }
  // +44 is shared with Jersey, Guernsey and the Isle of Man — those parse as JE/GG/IM.
  if (parsed.country !== "GB") {
    return { ok: false, error: "Please enter a UK phone number, e.g. 07… or 020…" };
  }
  const type = parsed.getType();
  if (!type || !ALLOWED_PHONE_TYPES.has(type)) {
    return { ok: false, error: "Please use a UK mobile, landline or 03 number. 08 and 056 numbers aren't accepted." };
  }
  return { ok: true, phone: parsed.number };
}

// ── Business details ────────────────────────────────────────────────

export const businessDetailsSchema = z.object({
  businessName: z.string({ error: "Business name is required." }).trim()
    .min(2, "Business name must be at least 2 characters.")
    .max(100, "Business name must be 100 characters or fewer."),
  addressLine1: z.string({ error: "Business address is required." }).trim()
    .min(3, "Please enter your street and number, e.g. 12 High Street.")
    .max(150, "Address must be 150 characters or fewer."),
  postcode: z.string({ error: "Postcode is required." }).trim()
    .min(1, "Postcode is required.")
    .max(10, POSTCODE_NOT_FOUND),
  phone: z.string({ error: "Business phone is required." }).trim()
    .min(1, "Business phone is required.")
    .max(20, "That phone number is too long."),
  company: z.string({ error: "Company name must be text." }).trim()
    .max(100, "Company name must be 100 characters or fewer.")
    .nullish(),
});

export type BusinessField = keyof z.input<typeof businessDetailsSchema>;
const FIELD_ORDER: BusinessField[] = ["businessName", "addressLine1", "postcode", "phone", "company"];

export type ValidBusinessDetails = {
  businessName: string;
  addressLine1: string;
  company: string;
  phone: string;        // E.164
  postcode: string;     // canonical, e.g. "SW1A 1AA"
  town: string;
  country: UkCountry;
  latitude: number | null;
  longitude: number | null;
};

export type BusinessValidation =
  | { ok: true; value: ValidBusinessDetails }
  | { ok: false; error: string; errors: Partial<Record<BusinessField, string>> };

/**
 * Full check: lengths, UK phone, and a live postcode lookup. Collects one
 * message per field so the form can show them all at once; `error` is the
 * first of them, for callers that show a single message.
 */
export async function validateBusinessDetails(input: unknown): Promise<BusinessValidation> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: Partial<Record<BusinessField, string>> = {};

  const parsed = businessDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as BusinessField;
      errors[field] ??= issue.message;
    }
  }

  const phone = errors.phone ? null : validateUkPhone(String(raw.phone));
  if (phone && !phone.ok) errors.phone = phone.error;

  const postcode = errors.postcode ? null : await lookupPostcode(String(raw.postcode));
  if (postcode && !postcode.ok) errors.postcode = postcode.error;

  const firstField = FIELD_ORDER.find(f => errors[f]);
  if (firstField || !parsed.success || !phone?.ok || !postcode?.ok) {
    return { ok: false, error: firstField ? errors[firstField]! : "Please check your business details.", errors };
  }

  return {
    ok: true,
    value: {
      businessName: parsed.data.businessName,
      addressLine1: parsed.data.addressLine1,
      company:      parsed.data.company ?? "",
      phone:        phone.phone,
      postcode:     postcode.postcode,
      town:         postcode.town,
      country:      postcode.country,
      latitude:     postcode.latitude,
      longitude:    postcode.longitude,
    },
  };
}
