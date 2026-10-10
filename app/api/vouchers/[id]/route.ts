import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/app/lib/vouchers/input";
import { NO_STORE, requireOwner, rpcFailure } from "@/app/lib/vouchers/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/vouchers/:id?salon_id= — one voucher with its services, full
// history and pending holds. Any plan, switch or Stripe state.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Voucher not found." }, { status: 404, headers: NO_STORE });

  const ctx = await requireOwner(req, req.nextUrl.searchParams.get("salon_id"));
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.db.rpc("get_voucher", { p_salon_id: ctx.salonId, p_voucher_id: id });
  if (error) return rpcFailure("get_voucher", error);
  if (!data) return NextResponse.json({ error: "Voucher not found." }, { status: 404, headers: NO_STORE });
  return NextResponse.json(data, { headers: NO_STORE });
}
