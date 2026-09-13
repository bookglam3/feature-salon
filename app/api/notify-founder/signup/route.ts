import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { withMeridiem } from "@/app/lib/formatTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend     = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";

// Founder notification address — override via FOUNDER_NOTIFY_EMAIL env var
const FOUNDER_EMAIL = process.env.FOUNDER_NOTIFY_EMAIL || "adilgill2008@gmail.com";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  hair:    "💇 Hair Salon",
  barber:  "✂️ Barbershop",
  beauty:  "💅 Beauty Salon",
  spa:     "🌿 Spa / Wellness",
  nail:    "💎 Nail Studio",
  gym:     "🏋️ Gym & Fitness Studio",
  yoga:    "🧘 Yoga & Pilates",
  physio:  "🤸 Physiotherapy",
  massage: "💆 Massage Therapy",
  dental:  "🦷 Dental & Aesthetic",
  pt:      "🏃 Personal Trainer",
  other:   "🏠 Other",
};

export async function POST(req: NextRequest) {
  // Always return 200 — a failed notification must never break signup
  try {
    if (!resend) {
      console.warn("[notify-founder/signup] Resend not configured — skipping notification");
      return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const salonName:    string = body.salonName    || "(unknown)";
    const email:        string = body.email        || "(unknown)";
    const businessType: string = body.businessType || "other";
    const signedUpAt:   string = body.signedUpAt   || new Date().toISOString();

    const typeLabel = BUSINESS_TYPE_LABELS[businessType] || businessType;

    const signupDate = withMeridiem(new Date(signedUpAt).toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "numeric", minute: "2-digit",
      timeZone: "Europe/London", hour12: true,
    }));

    const html = `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E5E7EB;">

    <div style="background:linear-gradient(135deg,#5B21B6 0%,#7C3AED 100%);padding:32px 28px;text-align:center;border-bottom:3px solid #4C1D95;">
      <p style="color:#EDE9FE;margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Feature</p>
      <h1 style="color:#FFFFFF;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">🎉 New signup!</h1>
      <p style="color:#F5F3FF;margin:8px 0 0;font-size:14px;">${salonName} just joined Feature</p>
    </div>

    <div style="padding:28px 28px 8px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;width:38%;">Business name</td>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:14px;font-weight:700;color:#0F172A;">${salonName}</td>
        </tr>
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Type</td>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:14px;color:#0F172A;">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Email</td>
          <td style="padding:11px 0;border-bottom:1px solid #F1F5F9;font-size:14px;color:#0F172A;"><a href="mailto:${email}" style="color:#6366F1;text-decoration:none;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding:11px 0;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;">Signed up</td>
          <td style="padding:11px 0;font-size:14px;color:#0F172A;">${signupDate}</td>
        </tr>
      </table>
    </div>

    <div style="padding:20px 28px 28px;">
      <a href="https://featuresalon.co.uk/admin" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View in Admin →
      </a>
    </div>

    <div style="padding:14px 28px;background:#F9FAFB;text-align:center;border-top:1px solid #E5E7EB;font-size:11px;color:#6B7280;">
      Feature · noreply@featuresalon.co.uk
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      FOUNDER_EMAIL,
      subject: `🎉 New Feature signup: ${salonName}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log but never surface the error — signup must not be affected
    console.error("[notify-founder/signup] Failed to send notification:", err);
    return NextResponse.json({ ok: true });
  }
}
