import { NextRequest, NextResponse } from "next/server";
import { isUuid, validateRedeemInput } from "@/app/lib/vouchers/input";
import { NO_STORE, readJson, requireOwner, rpcFailure } from "@/app/lib/vouchers/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/vouchers/:id/redeem
//   { salon_id, type: "amount", amount: "12.50", note?, expired_override? }
//   { salon_id, type: "service", voucher_service_id, quantity, note?, expired_override? }
// Any plan, switch or Stripe state: sold vouchers can always be redeemed.
// The database locks the voucher, so two redemptions at once can't overspend it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Voucher not found." }, { status: 404, headers: NO_STORE });

  const body = await readJson(req);
  const ctx = await requireOwner(req, body?.salon_id);
  if (ctx instanceof NextResponse) return ctx;

  const parsed = validateRedeemInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const r = parsed.value;

  const { data, error } = r.type === "amount"
    ? await ctx.db.rpc("redeem_voucher_amount", {
        p_salon_id: ctx.salonId, p_voucher_id: id, p_amount_pence: r.amountPence,
        p_redeemed_by: ctx.userId, p_note: r.note, p_expired_override: r.expiredOverride,
      })
    : await ctx.db.rpc("redeem_voucher_service", {
        p_salon_id: ctx.salonId, p_voucher_id: id, p_voucher_service_id: r.voucherServiceId, p_quantity: r.quantity,
        p_redeemed_by: ctx.userId, p_note: r.note, p_expired_override: r.expiredOverride,
      });
  if (error) return rpcFailure(r.type === "amount" ? "redeem_voucher_amount" : "redeem_voucher_service", error);

  const detail = await ctx.db.rpc("get_voucher", { p_salon_id: ctx.salonId, p_voucher_id: id });
  return NextResponse.json({ result: data, voucher: detail.error ? null : detail.data }, { headers: NO_STORE });
}
