import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { withMeridiem } from "@/app/lib/formatTime";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/notify-owner
 * Called by the reschedule page when a client reschedules or cancels.
 * Secured: only accepts requests from same origin or with X-Internal-Secret.
 */
export async function POST(req: NextRequest) {
  // Basic origin guard — only allow same-origin or internal calls
  const origin  = req.headers.get("origin")  || "";
  const referer = req.headers.get("referer") || "";
  const secret  = req.headers.get("x-internal-secret");

  const appHostname = (() => { try { return new URL(APP_URL).hostname; } catch { return ""; } })();
  const originOk  = !!origin  && (() => { try { return new URL(origin).hostname  === appHostname; } catch { return false; } })();
  const refererOk = !!referer && (() => { try { return new URL(referer).hostname === appHostname; } catch { return false; } })();
  const secretOk  = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;

  if (!originOk && !refererOk && !secretOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const {
      ownerEmail, clientName, serviceName,
      action, newDateTime, oldDateTime, salonName, note,
    } = await req.json();

    if (!ownerEmail) return NextResponse.json({ error: "Missing ownerEmail" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
    const isCancel = action === "cancelled";

    const fmt = (dt: string) => withMeridiem(new Date(dt).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "long",
      hour: "numeric", minute: "2-digit", timeZone: "Europe/London", hour12: true,
    }));

    const oldFmt = oldDateTime ? fmt(oldDateTime) : "—";
    const newFmt = newDateTime ? fmt(newDateTime) : null;

    const subject = isCancel
      ? `❌ Appointment Cancelled — ${clientName} (${serviceName || ""})`
      : `🔄 Appointment Rescheduled — ${clientName} (${serviceName || ""})`;

    const html = `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:500px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="background:${isCancel ? "linear-gradient(135deg,#DC2626,#B91C1C)" : "linear-gradient(135deg,#4F46E5,#6366F1)"};padding:32px 28px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">${isCancel ? "❌" : "🔄"}</div>
    <p style="color:rgba(255,255,255,0.7);margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salonName}</p>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${isCancel ? "Appointment Cancelled" : "Appointment Rescheduled"}</h1>
  </div>
  <div style="padding:28px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">A client has ${isCancel ? "cancelled" : "rescheduled"} their appointment.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;background:#F8FAFC;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Client</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${clientName}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Service</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${serviceName || "—"}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;${newFmt ? "border-bottom:1px solid #E2E8F0;" : ""}">Original Date</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;${newFmt ? "border-bottom:1px solid #E2E8F0;" : ""}">${oldFmt}</td></tr>
      ${newFmt ? `<tr><td style="padding:12px 16px;color:#64748B;">New Date</td><td style="padding:12px 16px;font-weight:700;color:#059669;">${newFmt}</td></tr>` : ""}
      ${note ? `<tr><td style="padding:12px 16px;color:#64748B;border-top:1px solid #E2E8F0;" colspan="2"><em style="color:#64748B;">"${escapeHtml(String(note))}"</em></td></tr>` : ""}
    </table>
    <div style="margin-top:20px;padding:14px 16px;background:${isCancel ? "#FEF2F2" : "#EEF2FF"};border-radius:10px;font-size:13px;color:${isCancel ? "#DC2626" : "#4338CA"};font-weight:600;">
      ${isCancel ? "⚠️ This slot is now free — you may want to offer it to another client." : "✅ Appointment is now pending your confirmation for the new time."}
    </div>
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}/dashboard/bookings" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">View in Dashboard →</a>
    </div>
  </div>
  <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:14px 28px;text-align:center;">
    <p style="font-size:11px;color:#64748B;margin:0;">${salonName} · Powered by Feature Salon</p>
  </div>
</div>
</body></html>`;

    await resend.emails.send({ from: FROM, to: ownerEmail, subject, html });

    console.log(`[notify-owner] ${action} — sent to ${ownerEmail}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-owner] Error:", err);
    return NextResponse.json({ error: "Failed to notify owner" }, { status: 500 });
  }
}
