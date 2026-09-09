import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "adilgill2008@gmail.com";

// Helper: verify admin JWT + enforce admin-only email
async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (user.email !== ADMIN_EMAIL) return null;
  return user;
}

// Generate a unique referral code  e.g. AGT-X7K2M9
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AGT-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── GET — list all agents (admin only)
export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = adminSupabase
    .from("sales_agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[/api/partners] GET failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ agents: data });
}

// ── POST — submit a new application (public)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    full_name, phone, whatsapp, email, city, experience, own_vehicle,
    daily_availability, why_hire,
    // Identity verification fields
    id_card_number, id_issue_date, id_expiry_date,
    id_card_photo_url, selfie_photo_url,
    street_address, postcode, country,
  } = body;

  if (!full_name?.trim())          return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  if (!phone?.trim())              return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  if (!email?.trim())              return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!city?.trim())               return NextResponse.json({ error: "City is required" }, { status: 400 });
  if (!street_address?.trim())     return NextResponse.json({ error: "Street address is required" }, { status: 400 });
  if (!postcode?.trim())           return NextResponse.json({ error: "Postcode is required" }, { status: 400 });
  if (!experience?.trim())         return NextResponse.json({ error: "Experience is required" }, { status: 400 });
  if (!daily_availability?.trim()) return NextResponse.json({ error: "Availability is required" }, { status: 400 });
  if (!why_hire?.trim())           return NextResponse.json({ error: "Please tell us why you want to join" }, { status: 400 });
  if (!id_card_number?.trim())     return NextResponse.json({ error: "ID card number is required" }, { status: 400 });
  if (!id_issue_date)              return NextResponse.json({ error: "ID issue date is required" }, { status: 400 });
  if (!id_expiry_date)             return NextResponse.json({ error: "ID expiry date is required" }, { status: 400 });
  if (!id_card_photo_url)          return NextResponse.json({ error: "ID card photo is required" }, { status: 400 });
  if (!selfie_photo_url)           return NextResponse.json({ error: "Your photo is required" }, { status: 400 });

  const { data, error } = await adminSupabase
    .from("sales_agents")
    .insert({
      full_name: full_name.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp?.trim() || null,
      email: email.trim().toLowerCase(),
      city: city.trim(),
      experience: experience.trim(),
      own_vehicle: !!own_vehicle,
      daily_availability: daily_availability.trim(),
      why_hire: why_hire.trim(),
      // Address
      street_address: street_address.trim(),
      postcode: postcode.trim().toUpperCase(),
      country: country || "GB",
      // Identity
      id_card_number: id_card_number.trim(),
      id_issue_date: id_issue_date,
      id_expiry_date: id_expiry_date,
      id_card_photo_url: id_card_photo_url,
      selfie_photo_url: selfie_photo_url,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[/api/partners] POST insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ agent: data });
}

// ── PATCH — approve/reject + add notes (admin only)
export async function PATCH(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id, status, admin_notes } = body;

  if (!id) return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    status,
    admin_notes: admin_notes || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.email || user.id,
  };

  // Generate referral code on approval (only if not already set)
  let referralCode: string | null = null;
  if (status === "approved") {
    const { data: existing } = await adminSupabase
      .from("sales_agents")
      .select("referral_code")
      .eq("id", id)
      .single();

    if (!existing?.referral_code) {
      let code = generateCode();
      let attempts = 0;
      while (attempts < 5) {
        const { data: clash } = await adminSupabase
          .from("sales_agents")
          .select("id")
          .eq("referral_code", code)
          .maybeSingle();
        if (!clash) break;
        code = generateCode();
        attempts++;
      }
      updatePayload.referral_code = code;
      referralCode = code;
    } else {
      referralCode = existing.referral_code;
    }
  }

  const { data, error } = await adminSupabase
    .from("sales_agents")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[/api/partners] PATCH failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Send WhatsApp + Email notifications to applicant ────────
  try {
    const agentPhone = data.whatsapp || data.phone;
    const agentEmail = data.email || null;
    const agentName  = data.full_name?.split(" ")[0] || "there";
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

    let waBody = "";
    let emailSubject = "";
    let emailHtml = "";

    if (status === "approved") {
      const refLink = `${appUrl}/signup?ref=${referralCode}`;
      waBody =
        `🎉 Congratulations ${agentName}!\n\n` +
        `Your Feature Salon Partner application has been *APPROVED*! ✅\n\n` +
        `Your unique referral code is:\n*${referralCode}*\n\n` +
        `Share this signup link with salons:\n${refLink}\n\n` +
        `Every salon that signs up via your link earns you commission. 💰\n\n` +
        `Our team will be in touch shortly with next steps.\n\n— Feature Salon Team 🌟`;

      emailSubject = `🎉 You're approved as a Feature Partner!`;
      emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E8EDFF">
          <div style="background:linear-gradient(135deg,#1E3A8A,#4F6EF7);padding:36px 32px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">🎉</div>
            <h1 style="color:#fff;font-size:24px;margin:0;font-weight:800">You're Approved!</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Welcome to the Feature Salon Partner Program</p>
          </div>
          <div style="padding:32px">
            <p style="font-size:15px;color:#374151">Hi <strong>${agentName}</strong>,</p>
            <p style="font-size:14px;color:#6B7280;line-height:1.7">Congratulations! Your application to become a Feature Salon Partner has been <strong style="color:#059669">approved</strong>. We're excited to have you on board!</p>

            <div style="background:#F0F4FF;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
              <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Referral Code</div>
              <div style="font-size:28px;font-weight:900;color:#4F6EF7;letter-spacing:2px">${referralCode}</div>
            </div>

            <p style="font-size:14px;color:#374151">Share your unique signup link with salon owners:</p>
            <div style="background:#F8FAFF;border:1px solid #C7D2FE;border-radius:10px;padding:14px;word-break:break-all;font-size:13px;color:#4F6EF7;font-family:monospace">${refLink}</div>

            <a href="${refLink}" style="display:block;margin:20px 0;padding:14px;background:linear-gradient(135deg,#4F6EF7,#3B55E0);color:#fff;text-align:center;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">Copy My Referral Link →</a>

            <div style="background:#ECFDF5;border-radius:10px;padding:16px;margin-top:8px">
              <p style="font-size:13px;color:#065F46;margin:0;font-weight:600">💰 How you earn:</p>
              <ul style="font-size:13px;color:#374151;margin:8px 0 0;padding-left:18px;line-height:1.8">
                <li>Share your link with salon owners</li>
                <li>They sign up via your referral link</li>
                <li>You earn commission on every signup</li>
              </ul>
            </div>
          </div>
          <div style="padding:16px 32px;background:#F8FAFF;text-align:center;border-top:1px solid #E8EDFF">
            <p style="font-size:12px;color:#6B7280;margin:0">Feature Salon · noreply@featuresalon.co.uk</p>
          </div>
        </div>`;
    } else if (status === "rejected") {
      waBody =
        `Hi ${agentName},\n\n` +
        `Thank you for applying to become a Feature Salon Partner.\n\n` +
        `After careful review, we are unable to proceed at this time.` +
        (admin_notes ? `\n\nFeedback: ${admin_notes}` : "") +
        `\n\nYou're welcome to reapply in the future.\n\n— Feature Salon Team`;

      emailSubject = `Feature Salon Partner Application Update`;
      emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB">
          <div style="background:#F9FAFB;padding:32px;text-align:center;border-bottom:1px solid #E5E7EB">
            <h1 style="font-size:20px;color:#111827;margin:0;font-weight:800">Application Update</h1>
          </div>
          <div style="padding:32px">
            <p style="font-size:15px;color:#374151">Hi <strong>${agentName}</strong>,</p>
            <p style="font-size:14px;color:#6B7280;line-height:1.7">Thank you for your interest in becoming a Feature Salon Partner. After careful review, we are unable to proceed with your application at this time.</p>
            ${admin_notes ? `<div style="background:#FFFBEB;border-left:4px solid #F59E0B;padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0"><p style="font-size:13.5px;color:#92400E;margin:0"><strong>Feedback:</strong> ${admin_notes}</p></div>` : ""}
            <p style="font-size:14px;color:#6B7280;line-height:1.7">You're welcome to reapply in the future as our requirements evolve. We appreciate your interest in Feature Salon.</p>
          </div>
          <div style="padding:16px 32px;background:#F9FAFB;text-align:center;border-top:1px solid #E5E7EB">
            <p style="font-size:12px;color:#6B7280;margin:0">Feature Salon · noreply@featuresalon.co.uk</p>
          </div>
        </div>`;
    }

    // Send WhatsApp
    if (agentPhone && waBody) {
      try {
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
        let to = agentPhone.trim().replace(/\s+/g, "");
        if (!to.startsWith("+")) to = "+" + to;
        await twilioClient.messages.create({ from, to: `whatsapp:${to}`, body: waBody });
        console.log(`[/api/partners] WhatsApp sent to ${to}`);
      } catch (e) { console.error("[/api/partners] WhatsApp failed:", e); }
    }

    // Send Email
    if (agentEmail && emailSubject && emailHtml) {
      try {
        await resend.emails.send({
          from: "Feature Salon <noreply@featuresalon.co.uk>",
          to: agentEmail,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log(`[/api/partners] Email sent to ${agentEmail}`);
      } catch (e) { console.error("[/api/partners] Email failed:", e); }
    }

  } catch (notifErr) {
    console.error("[/api/partners] Notification error:", notifErr);
  }

  return NextResponse.json({ agent: data });
}
