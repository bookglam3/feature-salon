import { NextRequest, NextResponse } from "next/server";
import { businessDetailsSchema, lookupPostcode, validateBusinessDetails } from "@/app/lib/business-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory rate limiter (per server instance): this route is unauthenticated
// and calls postcodes.io, so cap it per IP. Generous enough for postcode
// on-blur checks plus a few submit attempts.
const ipRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (ipRateMap.size > 5000) {
    for (const [key, entry] of ipRateMap) if (now > entry.resetAt) ipRateMap.delete(key);
  }
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// POST /api/signup/validate-business
// Called from signup step 1 BEFORE the email OTP is sent, so no auth user is
// created for invalid business details. /api/signup/complete re-runs the same
// checks — this route is a convenience, not the gate.
//
// Body: { businessName, addressLine1, postcode, phone, company? }
//   → 200 { ok: true, values: { businessName, addressLine1, postcode, phone, town } }
//   → 400 { error, errors: { [field]: message } }
// Body: { postcodeOnly: true, postcode } — the lighter on-blur check
//   → 200 { ok: true, postcode, town }  |  400 { error, errors: { postcode } }
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body?.postcodeOnly === true) {
    const shape = businessDetailsSchema.shape.postcode.safeParse(body.postcode);
    const result = shape.success ? await lookupPostcode(shape.data) : { ok: false as const, error: shape.error.issues[0].message };
    if (!result.ok) {
      return NextResponse.json({ error: result.error, errors: { postcode: result.error } }, { status: 400 });
    }
    return NextResponse.json({ ok: true, postcode: result.postcode, town: result.town });
  }

  const result = await validateBusinessDetails(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, errors: result.errors }, { status: 400 });
  }

  const { businessName, addressLine1, postcode, phone, town } = result.value;
  return NextResponse.json({ ok: true, values: { businessName, addressLine1, postcode, phone, town } });
}
