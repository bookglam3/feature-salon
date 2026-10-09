import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubscribeToken } from "@/app/lib/lifecycle/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/lifecycle/unsubscribe — opts an owner out of lifecycle emails.
//   • From /unsubscribe/emails: JSON body { token }
//   • One-click from Gmail/Outlook (RFC 8058): POST ?t=<token>,
//     body "List-Unsubscribe=One-Click"
// Opts out every salon of that owner. There is deliberately no GET handler:
// email link scanners open links, and that must not unsubscribe anyone.
export async function POST(req: NextRequest) {
  let token: string | null = req.nextUrl.searchParams.get("t");
  if (!token) {
    const body = await req.json().catch(() => null);
    token = body && typeof body.token === "string" ? body.token : null;
  }

  const salonId = verifyUnsubscribeToken(token, process.env.LIFECYCLE_UNSUBSCRIBE_SECRET ?? "");
  if (!salonId) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 400 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: salon, error } = await db.from("salons").select("owner_id").eq("id", salonId).maybeSingle();
  if (error) {
    console.error("[lifecycle] unsubscribe lookup failed:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!salon) return NextResponse.json({ ok: true }); // salon deleted: nothing will be sent anyway

  const { error: updateErr } = await db.from("salons")
    .update({ lifecycle_emails_opt_out: true })
    .eq("owner_id", salon.owner_id);
  if (updateErr) {
    console.error("[lifecycle] unsubscribe update failed:", updateErr.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
