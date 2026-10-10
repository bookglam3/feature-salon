/**
 * Gift vouchers — input checks, money/date helpers and error messages shared
 * by the API routes and the Gift Vouchers page. The database functions check
 * everything again; this layer gives clear messages before a round trip.
 *
 * No imports, so node runs it directly in scripts/test-voucher-input.mjs.
 */

export const MAX_VOUCHER_PENCE = 500_000;      // £5,000
export const MAX_SERVICE_LINES = 20;
export const MAX_SERVICE_QUANTITY = 50;
export const DEFAULT_EXPIRY_MONTHS = 12;
const MAX_EXPIRY_YEARS = 10;                   // catches typos like 2206

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Tabs, newlines and other invisible control characters (allowed only in notes). */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

// ── Money ────────────────────────────────────────────────────────────────────

/** "50", "50.5", "£1,250.00" → pence. Null for anything else (no negatives, max 2 decimals). */
export function parsePoundsToPence(input: unknown): number | null {
  if (typeof input === "number") input = String(input);
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/^£\s*/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
/** 125050 → "£1,250.50" */
export function formatPence(pence: number | null | undefined): string {
  return GBP.format((pence ?? 0) / 100);
}

// ── Dates (UK) ───────────────────────────────────────────────────────────────

/** Today's date in the UK as YYYY-MM-DD (vouchers are valid to the end of their expiry date, UK time). */
export function ukToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2024-02-29" + 12 months → "2025-02-28" (clamped to the month's last day). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function defaultExpiry(now: Date = new Date()): string {
  return addMonths(ukToday(now), DEFAULT_EXPIRY_MONTHS);
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "2026-10-10" → "10 Oct 2026" */
export function formatUkDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ── References and codes ─────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L — easy to read out and type

/**
 * A secure random voucher code, e.g. "GV-7KQM-4XP2-WR9D" (31^12 ≈ 8×10^17 possibilities).
 * Uses the platform's cryptographic random source, never Math.random.
 */
export function generateVoucherCode(randomBytes: (n: number) => Uint8Array = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))): string {
  const chars: string[] = [];
  const limit = 256 - (256 % CODE_ALPHABET.length); // reject bytes that would bias the result
  while (chars.length < 12) {
    for (const b of randomBytes(16)) {
      if (b < limit && chars.length < 12) chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return `GV-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateVoucherInput {
  kind: "money" | "service";
  /** null = generate a secure code on the server */
  paperReference: string | null;
  amountPence: number | null;
  services: { service_id: string; quantity: number }[];
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  notes: string | null;
  expiresOn: string | null;
}

function optionalText(v: unknown, max: number, label: string): Result<string | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: `${label} isn't valid.` };
  const t = v.trim();
  if (!t) return { ok: true, value: null };
  if (t.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  if (label !== "Notes" && hasControlChars(t)) return { ok: false, error: `${label} isn't valid.` };
  return { ok: true, value: t };
}

function optionalEmail(v: unknown, label: string): Result<string | null> {
  const r = optionalText(v, 254, label);
  if (!r.ok || r.value === null) return r;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.value) ? r : { ok: false, error: `${label} doesn't look like an email address.` };
}

function optionalPhone(v: unknown, label: string): Result<string | null> {
  const r = optionalText(v, 30, label);
  if (!r.ok || r.value === null) return r;
  return /^\+?[\d\s\-()]{6,30}$/.test(r.value) ? r : { ok: false, error: `${label} should only contain digits, spaces, + - ( ).` };
}

export function validateCreateInput(body: unknown, now: Date = new Date()): Result<CreateVoucherInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing voucher details." };
  const b = body as Record<string, unknown>;

  const kind = b.kind;
  if (kind !== "money" && kind !== "service") return { ok: false, error: "Choose a money or a service voucher." };

  let paperReference: string | null = null;
  if (b.reference_mode === "paper") {
    const ref = typeof b.reference === "string" ? b.reference.trim() : "";
    if (ref.length < 3 || ref.length > 40) return { ok: false, error: "The voucher reference must be 3 to 40 characters." };
    if (hasControlChars(ref)) return { ok: false, error: "The voucher reference contains characters that aren't allowed." };
    paperReference = ref;
  } else if (b.reference_mode !== "generate") {
    return { ok: false, error: "Choose to generate a code or enter the paper voucher's reference." };
  }

  let amountPence: number | null = null;
  const services: CreateVoucherInput["services"] = [];
  if (kind === "money") {
    amountPence = parsePoundsToPence(b.amount);
    if (amountPence === null || amountPence < 1 || amountPence > MAX_VOUCHER_PENCE) {
      return { ok: false, error: "Enter an amount between £0.01 and £5,000, e.g. 50 or 49.99." };
    }
  } else {
    if (!Array.isArray(b.services) || b.services.length === 0) return { ok: false, error: "Choose at least one service." };
    if (b.services.length > MAX_SERVICE_LINES) return { ok: false, error: `Choose up to ${MAX_SERVICE_LINES} services.` };
    const seen = new Set<string>();
    for (const line of b.services) {
      const l = (line ?? {}) as Record<string, unknown>;
      if (!isUuid(l.service_id)) return { ok: false, error: "One of the chosen services isn't valid." };
      const q = Number(l.quantity ?? 1);
      if (!Number.isInteger(q) || q < 1 || q > MAX_SERVICE_QUANTITY) return { ok: false, error: `Each service quantity must be 1 to ${MAX_SERVICE_QUANTITY}.` };
      if (seen.has(l.service_id)) return { ok: false, error: "Each service can only be added once — change its quantity instead." };
      seen.add(l.service_id);
      services.push({ service_id: l.service_id, quantity: q });
    }
  }

  const fields = {
    buyerName: optionalText(b.buyer_name, 100, "Buyer name"),
    buyerEmail: optionalEmail(b.buyer_email, "Buyer email"),
    buyerPhone: optionalPhone(b.buyer_phone, "Buyer phone"),
    recipientName: optionalText(b.recipient_name, 100, "Recipient name"),
    recipientEmail: optionalEmail(b.recipient_email, "Recipient email"),
    recipientPhone: optionalPhone(b.recipient_phone, "Recipient phone"),
    notes: optionalText(b.notes, 1000, "Notes"),
  };
  for (const r of Object.values(fields)) if (!r.ok) return r;

  let expiresOn: string | null = null;
  if (b.expires_on !== null && b.expires_on !== undefined && b.expires_on !== "") {
    if (typeof b.expires_on !== "string" || !isIsoDate(b.expires_on)) return { ok: false, error: "The expiry date isn't valid." };
    const today = ukToday(now);
    if (b.expires_on < today) return { ok: false, error: "The expiry date can't be in the past." };
    if (b.expires_on > addMonths(today, MAX_EXPIRY_YEARS * 12)) return { ok: false, error: `The expiry date must be within ${MAX_EXPIRY_YEARS} years.` };
    expiresOn = b.expires_on;
  }

  const v = (r: Result<string | null>) => (r as { ok: true; value: string | null }).value;
  return {
    ok: true,
    value: {
      kind, paperReference, amountPence, services: kind === "service" ? services : [],
      buyerName: v(fields.buyerName), buyerEmail: v(fields.buyerEmail), buyerPhone: v(fields.buyerPhone),
      recipientName: v(fields.recipientName), recipientEmail: v(fields.recipientEmail), recipientPhone: v(fields.recipientPhone),
      notes: v(fields.notes), expiresOn,
    },
  };
}

// ── Redeem and cancel ────────────────────────────────────────────────────────

export type RedeemInput =
  | { type: "amount"; amountPence: number; note: string | null; expiredOverride: boolean }
  | { type: "service"; voucherServiceId: string; quantity: number; note: string | null; expiredOverride: boolean };

export function validateRedeemInput(body: unknown): Result<RedeemInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Missing redemption details." };
  const b = body as Record<string, unknown>;
  const note = optionalText(b.note, 500, "Note");
  if (!note.ok) return note;
  const expiredOverride = b.expired_override === true;

  if (b.type === "amount") {
    const amountPence = parsePoundsToPence(b.amount);
    if (amountPence === null || amountPence < 1 || amountPence > MAX_VOUCHER_PENCE) {
      return { ok: false, error: "Enter the amount to take off, e.g. 25 or 12.50." };
    }
    return { ok: true, value: { type: "amount", amountPence, note: note.value, expiredOverride } };
  }
  if (b.type === "service") {
    if (!isUuid(b.voucher_service_id)) return { ok: false, error: "Choose which service was used." };
    const quantity = Number(b.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SERVICE_QUANTITY) return { ok: false, error: "Enter how many were used (1 or more)." };
    return { ok: true, value: { type: "service", voucherServiceId: b.voucher_service_id, quantity, note: note.value, expiredOverride } };
  }
  return { ok: false, error: "Choose money or a service to redeem." };
}

export function validateCancelReason(body: unknown): Result<string> {
  const reason = body && typeof body === "object" ? (body as Record<string, unknown>).reason : undefined;
  const t = typeof reason === "string" ? reason.trim() : "";
  if (t.length < 3) return { ok: false, error: "Give a reason for cancelling (at least 3 characters)." };
  if (t.length > 500) return { ok: false, error: "The reason must be 500 characters or fewer." };
  return { ok: true, value: t };
}

// ── Database errors → clear messages ─────────────────────────────────────────

/**
 * The database functions raise a fixed name as the message and put any number
 * in DETAIL (see sql/2026-10-10-gift-vouchers-step2.sql). Unknown errors get a
 * generic message; the caller logs the original.
 */
export function voucherErrorMessage(name: string | undefined, detail?: string | null): { status: number; message: string } {
  const pence = detail && /^\d+$/.test(detail) ? Number(detail) : null;
  switch (name) {
    case "voucher_not_found":      return { status: 404, message: "Voucher not found." };
    case "voucher_cancelled":      return { status: 409, message: "This voucher was cancelled, so it can't be used." };
    case "voucher_expired":        return { status: 409, message: `This voucher expired${detail ? ` on ${formatUkDate(detail)}` : ""}. To accept it anyway, confirm a goodwill redemption.` };
    case "insufficient_balance":   return { status: 409, message: pence === 0 ? "There's nothing left to use on this voucher." : `Only ${formatPence(pence ?? 0)} is available on this voucher.` };
    case "service_used_up":        return { status: 409, message: pence === 0 ? "This service has already been used up on this voucher." : `Only ${pence ?? 0} of this service ${pence === 1 ? "is" : "are"} left on this voucher.` };
    case "service_not_on_voucher": return { status: 400, message: "That service isn't on this voucher." };
    case "wrong_voucher_kind":     return { status: 400, message: "That doesn't match this voucher's type (money or service)." };
    case "invalid_amount":         return { status: 400, message: "Enter an amount between £0.01 and £5,000." };
    case "invalid_quantity":       return { status: 400, message: `Enter a quantity between 1 and ${MAX_SERVICE_QUANTITY}.` };
    case "reference_taken":        return { status: 409, message: "You already have a voucher with this reference (capital letters don't count as different)." };
    case "invalid_reference":      return { status: 400, message: "The voucher reference must be 3 to 40 characters." };
    case "invalid_expiry":         return { status: 400, message: "The expiry date can't be in the past." };
    case "services_required":      return { status: 400, message: "Choose at least one service." };
    case "too_many_services":      return { status: 400, message: `Choose up to ${MAX_SERVICE_LINES} services.` };
    case "duplicate_service":      return { status: 400, message: "Each service can only be added once — change its quantity instead." };
    case "service_not_found":      return { status: 400, message: "One of the chosen services no longer exists. Refresh and try again." };
    case "reason_required":        return { status: 400, message: "Give a reason for cancelling (at least 3 characters)." };
    case "reason_too_long":        return { status: 400, message: "The reason must be 500 characters or fewer." };
    case "already_cancelled":      return { status: 409, message: "This voucher is already cancelled." };
    case "voucher_has_holds":      return { status: 409, message: "This voucher is applied to an upcoming booking. Remove it from the booking before cancelling." };
    case "invalid_kind":
    case "invalid_source":         return { status: 400, message: "Some voucher details aren't valid." };
    default:                       return { status: 500, message: "Something went wrong. Please try again." };
  }
}

// ── Display ──────────────────────────────────────────────────────────────────

export type VoucherDisplayState = "active" | "used" | "expired" | "cancelled";

/** One badge per voucher: cancelled beats expired beats fully used. */
export function voucherDisplayState(v: {
  status: string; kind: string; is_expired: boolean;
  remaining_pence?: number | null; services_total?: number; services_used?: number;
}): VoucherDisplayState {
  if (v.status === "cancelled") return "cancelled";
  if (v.is_expired) return "expired";
  const usedUp = v.kind === "money" ? (v.remaining_pence ?? 0) <= 0 : (v.services_total ?? 0) > 0 && (v.services_used ?? 0) >= (v.services_total ?? 0);
  return usedUp ? "used" : "active";
}
