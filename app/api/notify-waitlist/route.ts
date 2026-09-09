import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/app/lib/whatsapp";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROM = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { waitlist_id } = body;
    if (!waitlist_id) return NextResponse.json({ error: "waitlist_id required" }, { status: 400 });

    // Get salon + waitlist entry
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id, name, slug")
      .eq("owner_id", user.id)
      .single();

    if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

    const { data: entry } = await supabaseAdmin
      .from("waitlist")
      .select("*")
      .eq("id", waitlist_id)
      .eq("salon_id", salon.id)
      .single();

    if (!entry) return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });

    const bookingLink = `${APP_URL}/book/${salon.slug}`;
    const errors: string[] = [];
    let whatsappSent = false;
    let emailSent = false;

    // ── WhatsApp Notification ─────────────────────────────────
    if (entry.client_phone) {
      try {
        const preferredDate = entry.preferred_date
          ? new Date(entry.preferred_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
          : null;
        const preferredTime = entry.preferred_time || null;

        const slotLine = preferredDate
          ? `\n📅 Your preferred slot: ${preferredDate}${preferredTime ? ` at ${preferredTime}` : ""}`
          : "";

        const message =
          `🎉 *Good news, ${entry.client_name}!*\n\n` +
          `A slot has just opened up at *${salon.name}*!${slotLine}\n\n` +
          `Book now before it's gone:\n${bookingLink}\n\n` +
          `Hurry — slots fill up fast! ⚡`;

        await sendWhatsApp(entry.client_phone, message);
        whatsappSent = true;
      } catch (e) {
        errors.push(`WhatsApp: ${e}`);
      }
    }

    // ── Email Notification ────────────────────────────────────
    if (entry.client_email) {
      try {
        const preferredDate = entry.preferred_date
          ? new Date(entry.preferred_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : null;

        const html = `
<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;">
  <div style="max-width:520px;margin:32px auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7C3AED 0%,#C2185B 100%);padding:36px 28px;text-align:center;">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:14px;">🎉</div>
      <p style="color:rgba(255,255,255,0.8);margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salon.name}</p>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">A Slot Just Opened Up!</h1>
    </div>

    <div style="background:#fff;padding:28px;">
      <p style="font-size:16px;margin:0 0 8px;">Hi <strong>${entry.client_name}</strong> 👋</p>
      <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
        Great news! A booking slot has just become available at <strong>${salon.name}</strong>.
        You're on our waitlist, so we're letting you know first!
      </p>

      ${preferredDate ? `
      <div style="background:#F5F3FF;border:1.5px solid #DDD6FE;border-radius:12px;padding:18px 20px;margin-bottom:22px;">
        <div style="font-size:11px;font-weight:700;color:#7C3AED;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Your Preferred Slot</div>
        <div style="font-size:15px;font-weight:700;color:#1a1a1a;">📅 ${preferredDate}${entry.preferred_time ? ` at ${entry.preferred_time}` : ""}</div>
      </div>` : ""}

      <div style="text-align:center;margin:24px 0;">
        <a href="${bookingLink}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED 0%,#C2185B 100%);color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 8px 20px rgba(124,58,237,0.35);">
          Book My Appointment →
        </a>
      </div>

      <p style="font-size:13px;color:#F59E0B;font-weight:600;text-align:center;margin:0 0 8px;">⚡ Act fast — slots fill up quickly!</p>
      <p style="font-size:13px;color:#64748B;text-align:center;margin:0;">If this slot no longer works for you, feel free to ignore this email.</p>
    </div>

    <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:16px 28px;text-align:center;">
      <p style="font-size:12px;color:#bbb;margin:0;line-height:1.8;">
        ${salon.name} • Powered by feature • United Kingdom<br/>
        <a href="${APP_URL}/unsubscribe" style="color:#bbb;text-decoration:underline;font-size:11px;">Unsubscribe from notifications</a>
      </p>
    </div>
  </div>
</body>
</html>`;

        await resend.emails.send({
          from: FROM,
          to: entry.client_email,
          subject: `🎉 A slot just opened at ${salon.name} — Book now!`,
          html,
        });
        emailSent = true;
      } catch (e) {
        errors.push(`Email: ${e}`);
      }
    }

    // Update waitlist status to "contacted"
    await supabaseAdmin.from("waitlist").update({ status: "contacted" }).eq("id", waitlist_id);

    return NextResponse.json({
      success: true,
      whatsappSent,
      emailSent,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error("[notify-waitlist] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
