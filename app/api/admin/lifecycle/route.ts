import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { verifyAdminRequest } from "@/app/lib/adminAuth";
import { EMAIL_KEYS, segmentLabel, type EmailKey } from "@/app/lib/lifecycle/decide";
import {
  LIFECYCLE_FROM, LIFECYCLE_REPLY_TO, buildEmail, lifecycleConfig, planToday, unsubscribeHeaders,
} from "@/app/lib/lifecycle/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_INBOX = "features@featuresalon.co.uk";

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function requireAdmin(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (admin.role === "guest") return NextResponse.json({ error: "Not available in demo mode" }, { status: 403 });
  return null;
}

// GET /api/admin/lifecycle — read-only: who would get which lifecycle email
// today (and why everyone else is skipped), plus the last 50 email_log rows.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const cfg = lifecycleConfig();
  const now = new Date();
  const client = db();
  try {
    const { salons, decisions } = await planToday(client, now, cfg);
    const byId = new Map(salons.map(s => [s.salonId, s]));
    const today = decisions.map(d => {
      const s = byId.get(d.salonId)!;
      return {
        salonId: s.salonId,
        salonName: s.name,
        ownerEmail: s.ownerEmail,
        segment: segmentLabel(s, now),
        ...(d.action === "send"
          ? { action: "send" as const, emailKey: d.emailKey, subject: buildEmail(s, d.emailKey, cfg, { forTest: true }).subject }
          : { action: "skip" as const, reason: d.reason }),
      };
    });

    const { data: recent, error } = await client.from("email_log")
      .select("id,salon_id,email_key,status,sent_at,error")
      .order("sent_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      live: cfg.live,
      reviewLinkSet: !!cfg.googleReviewLink,
      unsubscribeConfigured: !!cfg.unsubscribeSecret,
      today,
      recent: (recent ?? []).map(r => ({ ...r, salonName: byId.get(r.salon_id)?.name ?? r.salon_id })),
    });
  } catch (err) {
    console.error("[lifecycle] admin view failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 });
  }
}

// POST /api/admin/lifecycle
//   { action: "preview",   salonId, emailKey } → { subject, text }
//   { action: "send_test", salonId, emailKey } → sends it to features@ only (never the owner)
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { action, salonId, emailKey } = body as { action?: string; salonId?: string; emailKey?: string };
  if ((action !== "preview" && action !== "send_test") || typeof salonId !== "string" || !EMAIL_KEYS.includes(emailKey as EmailKey)) {
    return NextResponse.json({ error: "action, salonId and a valid emailKey are required" }, { status: 400 });
  }

  const cfg = lifecycleConfig();
  try {
    const { salons } = await planToday(db(), new Date(), cfg);
    const salon = salons.find(s => s.salonId === salonId);
    if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });
    const email = buildEmail(salon, emailKey as EmailKey, cfg, { forTest: true });

    if (action === "preview") return NextResponse.json({ subject: email.subject, text: email.text });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: LIFECYCLE_FROM,
      to: TEST_INBOX,
      replyTo: LIFECYCLE_REPLY_TO,
      subject: `[TEST] ${email.subject}`,
      text: email.text,
      headers: unsubscribeHeaders(email.unsubscribeUrl),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, to: TEST_INBOX, id: data?.id ?? null });
  } catch (err) {
    console.error("[lifecycle] admin preview/test failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
