import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { verifyAdminRequest } from "@/app/lib/adminAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.FROM_EMAIL    || "noreply@featuresalon.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

// ── GET — list salons (demo guests see only is_demo_data rows) ─
export async function GET(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isGuest = admin.role === "guest";

  let query = supabaseAdmin
    .from("salons")
    .select("id,name,slug,owner_id,owner_email,plan,subscription_status,subscription_plan,trial_ends_at,created_at")
    .order("created_at", { ascending: false });

  if (isGuest) {
    query = query.eq("is_demo_data", true);
  } else {
    query = query.eq("is_demo_data", false);
  }

  const { data: salons, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Latest login per salon
  let logsQuery = supabaseAdmin
    .from("login_logs")
    .select("salon_id,ip_address,city,country,country_code,device,logged_at")
    .order("logged_at", { ascending: false });

  if (isGuest) logsQuery = logsQuery.eq("is_demo_data", true);
  else         logsQuery = logsQuery.eq("is_demo_data", false);

  const { data: logs } = await logsQuery;

  type LogRow = NonNullable<typeof logs>[number];
  const logMap: Record<string, LogRow> = {};
  (logs ?? []).forEach(l => { if (l.salon_id && !logMap[l.salon_id]) logMap[l.salon_id] = l; });

  const enriched = (salons ?? []).map(s => ({
    ...s,
    last_ip:       logMap[s.id]?.ip_address  ?? null,
    last_city:     logMap[s.id]?.city         ?? null,
    last_country:  logMap[s.id]?.country      ?? null,
    country_code:  logMap[s.id]?.country_code ?? null,
    last_device:   logMap[s.id]?.device       ?? null,
    last_login_at: logMap[s.id]?.logged_at    ?? null,
  }));

  return NextResponse.json({ salons: enriched });
}

// ── PATCH — edit salon (guests cannot patch) ───────────────────
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin)                  return NextResponse.json({ error: "Forbidden" },    { status: 403 });
  if (admin.role === "guest")  return NextResponse.json({ error: "Read-only" },    { status: 403 });

  const body = await req.json();
  const { id, subscription_status, subscription_plan, name, timezone } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, string> = {};
  if (subscription_status) updates.subscription_status = subscription_status;
  if (subscription_plan)   updates.subscription_plan   = subscription_plan;
  if (name)                updates.name                = name;
  if (timezone)            updates.timezone            = timezone;

  const { error } = await supabaseAdmin
    .from("salons")
    .update(updates)
    .eq("id", id)
    .eq("is_demo_data", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── POST — create salon + auth user + send onboarding email ───
export async function POST(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin)                 return NextResponse.json({ error: "Forbidden" },   { status: 403 });
  if (admin.role === "guest") return NextResponse.json({ error: "Read-only" },   { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, owner_email, business_type, plan } = body;

  if (!String(name || "").trim() || !String(owner_email || "").trim()) {
    return NextResponse.json({ error: "name and owner_email are required" }, { status: 400 });
  }

  const emailLower = String(owner_email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Generate URL-safe slug; append random suffix if taken
  let slug = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: existingSlug } = await supabaseAdmin.from("salons").select("id").eq("slug", slug).maybeSingle();
  if (existingSlug) slug = `${slug}-${randomBytes(2).toString("hex")}`;

  // Create Supabase auth user (email already confirmed; random password they will reset)
  const randomPassword = randomBytes(16).toString("hex");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email: emailLower,
    email_confirm: true,
    password: randomPassword,
  });

  if (userErr || !userData?.user) {
    return NextResponse.json({ error: userErr?.message || "Failed to create user" }, { status: 500 });
  }

  const userId = userData.user.id;

  // Create salon record
  const { data: salon, error: salonErr } = await supabaseAdmin
    .from("salons")
    .insert({
      name:                String(name).trim(),
      slug,
      owner_id:            userId,
      owner_email:         emailLower,
      plan:                plan || "starter",
      business_type:       business_type || "salon",
      subscription_status: "trial",
      is_demo_data:        false,
    })
    .select("id, name, slug, owner_id, owner_email, plan, business_type, subscription_status, created_at")
    .single();

  if (salonErr || !salon) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: salonErr?.message || "Failed to create salon" }, { status: 500 });
  }

  // Generate a recovery link so the owner can set their password
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type:    "recovery",
    email:   emailLower,
    options: { redirectTo: `${APP_URL}/reset-password` },
  });

  if (linkData?.properties?.hashed_token) {
    const resetLink = `${APP_URL}/reset-password?token_hash=${linkData.properties.hashed_token}&type=recovery`;
    await resend.emails.send({
      from:    FROM,
      to:      emailLower,
      subject: `Welcome to Feature Salon — set up your account`,
      html:    buildOnboardingEmail({ salonName: salon.name, ownerEmail: emailLower, resetLink }),
    });
  }

  return NextResponse.json({ salon: { ...salon, appointmentCount: 0 } });
}

function buildOnboardingEmail({ salonName, ownerEmail, resetLink }: {
  salonName: string; ownerEmail: string; resetLink: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F6F8FC;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <div style="background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%);padding:36px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">✂</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;">Welcome to Feature Salon</h1>
    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Your salon account is ready</p>
  </div>
  <div style="padding:32px;">
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">
      Hi there! Your salon <strong style="color:#111827;">${salonName}</strong> has been set up on Feature Salon.
      Click below to set your password and activate your account.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border-radius:12px;text-decoration:none;font-size:15px;font-weight:700;box-shadow:0 4px 16px rgba(99,102,241,0.4);">
        Set Your Password →
      </a>
    </div>
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#B45309;margin-bottom:2px;">⏳ This link expires in 24 hours</div>
      <div style="font-size:12px;color:#92400E;">Contact your Feature Salon administrator if it expires.</div>
    </div>
    <p style="font-size:12px;color:#6B7280;margin:0;">
      Can&apos;t click the button? Copy this link into your browser:<br/>
      <a href="${resetLink}" style="color:#6366F1;word-break:break-all;font-size:11px;">${resetLink}</a>
    </p>
    <p style="font-size:12px;color:#D1D5DB;margin:20px 0 0;">Account email: ${ownerEmail}</p>
  </div>
  <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px;text-align:center;">
    <p style="font-size:11px;color:#6B7280;margin:0;">Feature Salon · featuresalon.co.uk<br/>If you didn&apos;t expect this, you can safely ignore it.</p>
  </div>
</div>
</body></html>`;
}
