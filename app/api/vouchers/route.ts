import { NextRequest, NextResponse } from "next/server";
import { generateVoucherCode, validateCreateInput } from "@/app/lib/vouchers/input";
import { NO_STORE, readJson, requireOwner, rpcFailure } from "@/app/lib/vouchers/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/vouchers?salon_id=&q=&include=services
// Search (reference or buyer/recipient name) + stats. Any plan, switch or Stripe
// state: owners can always find and redeem vouchers already sold.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ctx = await requireOwner(req, params.get("salon_id"));
  if (ctx instanceof NextResponse) return ctx;

  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const [search, stats, services] = await Promise.all([
    ctx.db.rpc("search_vouchers", { p_salon_id: ctx.salonId, p_query: q || null, p_limit: 50 }),
    ctx.db.rpc("voucher_stats", { p_salon_id: ctx.salonId }),
    params.get("include") === "services"
      ? ctx.db.from("services").select("id, name, price").eq("salon_id", ctx.salonId).is("archived_at", null).order("name")
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (search.error) return rpcFailure("search_vouchers", search.error);
  if (stats.error) return rpcFailure("voucher_stats", stats.error);
  if (services.error) return rpcFailure("services", services.error);

  return NextResponse.json({
    salonId: ctx.salonId,
    vouchers: search.data ?? [],
    stats: stats.data,
    canCreate: ctx.access.canCreateInDashboard,
    ...(services.data ? { services: services.data } : {}),
  }, { headers: NO_STORE });
}

// POST /api/vouchers — add a voucher (Pro, Business or trial). Works whether
// or not gift vouchers are switched on for the booking page.
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const ctx = await requireOwner(req, body?.salon_id);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.access.canCreateInDashboard) {
    return NextResponse.json(
      { error: "Adding vouchers is part of the Pro and Business plans. You can still find and redeem existing vouchers." },
      { status: 403, headers: NO_STORE },
    );
  }

  const parsed = validateCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const v = parsed.value;

  // A generated code colliding with an existing reference is astronomically
  // unlikely; if it ever happens, try a fresh one rather than failing.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.db.rpc("create_voucher", {
      p_salon_id: ctx.salonId,
      p_kind: v.kind,
      p_reference: v.paperReference ?? generateVoucherCode(),
      p_source: v.paperReference ? "physical" : "dashboard",
      p_amount_pence: v.kind === "money" ? v.amountPence : null,
      p_services: v.kind === "service" ? v.services : null,
      p_buyer_name: v.buyerName,
      p_buyer_email: v.buyerEmail,
      p_buyer_phone: v.buyerPhone,
      p_recipient_name: v.recipientName,
      p_recipient_email: v.recipientEmail,
      p_recipient_phone: v.recipientPhone,
      p_notes: v.notes,
      p_expires_on: v.expiresOn,
      p_created_by: ctx.userId,
    });
    if (!error) return NextResponse.json(data, { status: 201, headers: NO_STORE });
    if (error.message === "reference_taken" && !v.paperReference) continue;
    return rpcFailure("create_voucher", error);
  }
  return NextResponse.json({ error: "Couldn't create a unique code. Please try again." }, { status: 500, headers: NO_STORE });
}
