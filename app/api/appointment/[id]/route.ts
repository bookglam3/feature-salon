import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { Resend } from "resend";

// Service-role client to bypass RLS (public reschedule page)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Only return fields needed by the reschedule page — no PII (email/phone/payment)
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id,salon_id,staff_id,date_time,status,client_name,notes,services(name,price,duration_minutes),salon:salons(name,slug,timezone,country)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { action, date_time, notes, note, token } = body;

  // Fetch appointment + salon for owner email
  const { data: rawAppt } = await supabaseAdmin
    .from("appointments")
    .select("salon_id, staff_id, client_name, date_time, review_token, payment_status, services(name,duration_minutes), salon:salons(name,owner_email)")
    .eq("id", id)
    .single();

  const appt = rawAppt as null | {
    salon_id: string;
    staff_id: string | null;
    client_name: string;
    date_time: string;
    review_token: string | null;
    payment_status: string | null;
    services: { name: string; duration_minutes?: number } | { name: string; duration_minutes?: number }[] | null;
    salon: { name: string; owner_email: string } | { name: string; owner_email: string }[] | null;
  };

  // Verify the reschedule token using constant-time comparison to prevent timing attacks
  const storedToken = appt?.review_token;
  const tokenValid =
    typeof token === "string" &&
    token.length > 0 &&
    typeof storedToken === "string" &&
    storedToken.length > 0 &&
    token.length === storedToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));

  if (!appt || !tokenValid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Helper to unwrap single-or-array join results
  const getSalon = () => {
    if (!appt.salon) return null;
    return Array.isArray(appt.salon) ? appt.salon[0] : appt.salon;
  };
  const getService = () => {
    if (!appt.services) return null;
    return Array.isArray(appt.services) ? appt.services[0] : appt.services;
  };

  if (action === "reschedule") {
    // Server-side double-booking guard (mirrors client capacity logic, works in UTC)
    const svc = getService();
    const duration = svc?.duration_minutes || 30;
    const newStart = new Date(date_time);
    const newEnd   = new Date(newStart.getTime() + duration * 60_000);
    const dateStr  = (date_time as string).slice(0, 10);

    const { data: existing } = await supabaseAdmin
      .from("appointments")
      .select("id, staff_id, date_time, services(duration_minutes)")
      .eq("salon_id", appt.salon_id)
      .gte("date_time", `${dateStr}T00:00:00Z`)
      .lte("date_time", `${dateStr}T23:59:59Z`)
      .not("status", "eq", "cancelled")
      .neq("id", id);

    if (existing && existing.length > 0) {
      if (appt.staff_id) {
        // Specific staff: reject if that staff has any overlapping booking
        const conflict = existing.some(e => {
          if (e.staff_id !== appt.staff_id) return false;
          const eSvc = Array.isArray(e.services) ? e.services[0] : e.services;
          const eDur = (eSvc as { duration_minutes?: number } | null)?.duration_minutes || 30;
          const eStart = new Date(e.date_time);
          const eEnd   = new Date(eStart.getTime() + eDur * 60_000);
          return newStart < eEnd && eStart < newEnd;
        });
        if (conflict) {
          return NextResponse.json({ error: "Time slot unavailable" }, { status: 409 });
        }
      } else {
        // Any Available: reject only if ALL active staff are busy during the window
        const { data: allStaff } = await supabaseAdmin
          .from("staff")
          .select("id")
          .eq("salon_id", appt.salon_id)
          .eq("active", true);

        if (allStaff && allStaff.length > 0) {
          const allBusy = allStaff.every(staff =>
            existing.some(e => {
              if (e.staff_id !== staff.id) return false;
              const eSvc = Array.isArray(e.services) ? e.services[0] : e.services;
              const eDur = (eSvc as { duration_minutes?: number } | null)?.duration_minutes || 30;
              const eStart = new Date(e.date_time);
              const eEnd   = new Date(eStart.getTime() + eDur * 60_000);
              return newStart < eEnd && eStart < newEnd;
            })
          );
          if (allBusy) {
            return NextResponse.json({ error: "Time slot unavailable" }, { status: 409 });
          }
        }
      }
    }

    // A paid or deposit-paid appointment stays confirmed on reschedule — only
    // an unpaid one goes back to "pending", otherwise a client rescheduling
    // an already-paid booking would silently fall out of every automated
    // reminder/thank-you flow, which all filter on status:"confirmed"
    const alreadyPaid = appt.payment_status === "paid" || appt.payment_status === "deposit_paid";

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ date_time, notes, ...(alreadyPaid ? {} : { status: "pending" }) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

    if (getSalon()?.owner_email) {
      const salon = getSalon()!;
      const fmt = (dt: string) => new Date(dt).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
      });
      const serviceName = getService()?.name || "";
      try {
        await resend.emails.send({
          from: FROM,
          to: salon.owner_email,
          subject: `🔄 Appointment Rescheduled — ${appt.client_name} (${serviceName})`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,sans-serif;">
<div style="max-width:500px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="background:linear-gradient(135deg,#4F46E5,#6366F1);padding:32px 28px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">🔄</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Appointment Rescheduled</h1>
  </div>
  <div style="padding:28px;">
    <p style="font-size:14px;color:#475569;margin:0 0 16px;">A client has rescheduled their appointment.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;background:#F8FAFC;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Client</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${appt.client_name}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Service</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${serviceName || "—"}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Original</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${fmt(appt.date_time)}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;">New Time</td><td style="padding:12px 16px;font-weight:700;color:#059669;">${fmt(date_time)}</td></tr>
      ${note ? `<tr><td colspan="2" style="padding:12px 16px;color:#64748B;border-top:1px solid #E2E8F0;"><em>"${note}"</em></td></tr>` : ""}
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${APP_URL}/dashboard/bookings" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#4F46E5,#6366F1);color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">View in Dashboard →</a>
    </div>
  </div>
</div></body></html>`,
        });
      } catch (e) { console.error("[appointment] Email error:", e); }
    }

    return NextResponse.json({ success: true });
  }

  if (action === "cancel") {
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", notes })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });

    if (getSalon()?.owner_email) {
      const salon = getSalon()!;
      const fmt = (dt: string) => new Date(dt).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
      });
      const serviceName = getService()?.name || "";
      try {
        await resend.emails.send({
          from: FROM,
          to: salon.owner_email,
          subject: `❌ Appointment Cancelled — ${appt.client_name} (${serviceName})`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,sans-serif;">
<div style="max-width:500px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="background:linear-gradient(135deg,#DC2626,#B91C1C);padding:32px 28px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">❌</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Appointment Cancelled</h1>
  </div>
  <div style="padding:28px;">
    <p style="font-size:14px;color:#475569;margin:0 0 16px;">A client has cancelled their appointment.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;background:#F8FAFC;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Client</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${appt.client_name}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Service</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;">${serviceName || "—"}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748B;">Date</td><td style="padding:12px 16px;font-weight:700;color:#0F172A;">${fmt(appt.date_time)}</td></tr>
      ${note ? `<tr><td colspan="2" style="padding:12px 16px;color:#64748B;border-top:1px solid #E2E8F0;"><em>"${note}"</em></td></tr>` : ""}
    </table>
    <div style="margin-top:16px;padding:14px 16px;background:#FEF2F2;border-radius:10px;font-size:13px;color:#DC2626;font-weight:600;">
      ⚠️ This slot is now free — you may want to offer it to another client.
    </div>
    <div style="margin-top:20px;text-align:center;">
      <a href="${APP_URL}/dashboard/bookings" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#DC2626,#B91C1C);color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;">View in Dashboard →</a>
    </div>
  </div>
</div></body></html>`,
        });
      } catch (e) { console.error("[appointment] Cancel email error:", e); }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
