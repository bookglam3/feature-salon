import { NextRequest, NextResponse } from "next/server";
import { loadVoucherAccess } from "@/app/lib/vouchers/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public/vouchers/config?slug=<booking-link slug>
// What the booking page may SHOW for gift vouchers. Display only: the purchase
// and apply-code routes re-check the same rules themselves. Any doubt (bad
// slug, database error) answers "nothing".
const NOTHING = { applyAtBooking: false, buyOnline: false };
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!slug || slug.length > 100) {
    return NextResponse.json({ ...NOTHING, error: "Missing salon." }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await loadVoucherAccess({ slug });
    if (!result.found) {
      return NextResponse.json({ ...NOTHING, error: "Salon not found." }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(
      { applyAtBooking: result.access.canApplyAtBooking, buyOnline: result.access.canBuyOnline },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("[vouchers] config:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ...NOTHING, error: "Unavailable." }, { status: 503, headers: NO_STORE });
  }
}
