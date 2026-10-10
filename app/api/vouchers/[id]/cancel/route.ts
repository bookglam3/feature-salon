import { NextRequest, NextResponse } from "next/server";
import { isUuid, validateCancelReason } from "@/app/lib/vouchers/input";
import { NO_STORE, readJson, requireOwner, rpcFailure } from "@/app/lib/vouchers/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/vouchers/:id/cancel  { salon_id, reason }  — reason is required.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Voucher not found." }, { status: 404, headers: NO_STORE });

  const body = await readJson(req);
  const ctx = await requireOwner(req, body?.salon_id);
  if (ctx instanceof NextResponse) return ctx;

  const reason = validateCancelReason(body);
  if (!reason.ok) return NextResponse.json({ error: reason.error }, { status: 400, headers: NO_STORE });

  const { error } = await ctx.db.rpc("cancel_voucher", {
    p_salon_id: ctx.salonId, p_voucher_id: id, p_reason: reason.value, p_cancelled_by: ctx.userId,
  });
  if (error) return rpcFailure("cancel_voucher", error);

  const detail = await ctx.db.rpc("get_voucher", { p_salon_id: ctx.salonId, p_voucher_id: id });
  return NextResponse.json({ voucher: detail.error ? null : detail.data }, { headers: NO_STORE });
}
