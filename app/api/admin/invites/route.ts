import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { verifyAdminRequest } from "@/app/lib/adminAuth";
import { ROLE_LABELS, ROLE_COLORS } from "@/app/types/admin";
import type { AdminRole } from "@/app/types/admin";
import { withMeridiem } from "@/app/lib/formatTime";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.FROM_EMAIL    || "noreply@featuresalon.co.uk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

// ─────────────────────────────────────────────────────────────
// GET /api/admin/invites — list all invites (super_admin only)
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (admin.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Expire stale invites first
  await supabaseAdmin.rpc("expire_old_invites");

  const { data, error } = await supabaseAdmin
    .from("admin_invites")
    .select(`
      id, email, role, note, status,
      created_at, expires_at, accepted_at,
      invited_by ( full_name, email )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data });
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/invites — create invite + send email
// Body: { email, role, note? }
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (admin.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role, note } = await req.json().catch(() => ({}));

  // ── Validate input ─────────────────────────────────────────
  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }
  const validRoles: AdminRole[] = ["ops_manager","support_agent","sales_agent","developer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role. super_admin cannot be invited." }, { status: 400 });
  }
  const emailLower = String(email).toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // ── Check: is this email already an admin? ─────────────────
  const { data: existing } = await supabaseAdmin
    .from("admin_users")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "This email already has admin access" }, { status: 409 });
  }

  // ── Check: is there already a pending invite? ──────────────
  const { data: pendingInvite } = await supabaseAdmin
    .from("admin_invites")
    .select("id, expires_at")
    .eq("email", emailLower)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingInvite) {
    return NextResponse.json(
      { error: "A pending invite already exists for this email. Revoke it first." },
      { status: 409 },
    );
  }

  // ── Generate cryptographically random token ────────────────
  const token = randomBytes(32).toString("hex"); // 64-char hex string

  // ── Insert invite row ──────────────────────────────────────
  const { data: invite, error: insertErr } = await supabaseAdmin
    .from("admin_invites")
    .insert({
      email:      emailLower,
      role,
      note:       note?.trim() || null,
      token,
      invited_by: admin.id,
    })
    .select("id, email, role, expires_at")
    .single();

  if (insertErr || !invite) {
    console.error("[invites] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  // ── Send invite email ──────────────────────────────────────
  const inviteUrl  = `${APP_URL}/admin/invite/${token}`;
  const roleLabel  = ROLE_LABELS[role as AdminRole];
  const roleColor  = ROLE_COLORS[role as AdminRole];
  const expiryDate = withMeridiem(new Date(invite.expires_at).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", timeZone: "Europe/London", hour12: true,
  }));

  const html = buildInviteEmail({
    email: emailLower, roleLabel, roleColor, inviteUrl, expiryDate, note,
  });

  const { error: emailErr } = await resend.emails.send({
    from:    FROM,
    to:      emailLower,
    subject: `You've been invited to join Feature Salon as ${roleLabel}`,
    html,
  });

  if (emailErr) {
    console.error("[invites] email error:", emailErr);
    // Roll back the invite so state stays consistent
    await supabaseAdmin.from("admin_invites").delete().eq("id", invite.id);
    return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
  }

  console.log(`[invites] Invited ${emailLower} as ${role} — token ${token.slice(0, 8)}…`);
  return NextResponse.json({ success: true, invite: { id: invite.id, email: invite.email, role: invite.role } });
}

// ─────────────────────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────────────────────
function buildInviteEmail(opts: {
  email: string;
  roleLabel: string;
  roleColor: string;
  inviteUrl: string;
  expiryDate: string;
  note?: string;
}): string {
  const { roleLabel, roleColor, inviteUrl, expiryDate, note } = opts;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0D0D1A;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#13131F;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 60px rgba(0,0,0,0.6);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1E1B4B 0%,#312E81 50%,#4F46E5 100%);padding:40px 36px;text-align:center;">
    <div style="font-size:42px;margin-bottom:10px;">✉️</div>
    <p style="color:rgba(255,255,255,0.55);margin:0 0 6px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;">Feature Salon</p>
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">You're Invited!</h1>
  </div>

  <!-- Body -->
  <div style="padding:36px;">
    <p style="font-size:15px;color:rgba(255,255,255,0.75);margin:0 0 24px;line-height:1.7;">
      You have been invited to join the <strong style="color:#fff;">Feature Salon</strong> admin team.
    </p>

    <!-- Role badge -->
    <div style="display:inline-block;background:${roleColor}20;border:1.5px solid ${roleColor}50;border-radius:10px;padding:12px 20px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:${roleColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Your Role</div>
      <div style="font-size:20px;font-weight:800;color:#fff;">${roleLabel}</div>
    </div>

    ${note ? `
    <!-- Personal note -->
    <div style="background:rgba(255,255,255,0.04);border-left:3px solid ${roleColor};border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:24px;">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:10px;">Message from the team</p>
      <p style="font-size:14px;color:rgba(255,255,255,0.85);margin:0;line-height:1.6;font-style:italic;">"${note}"</p>
    </div>` : ""}

    <!-- CTA Button -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${inviteUrl}"
        style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#fff;border-radius:14px;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:-0.2px;box-shadow:0 8px 28px rgba(79,70,229,0.45);">
        Accept Invitation →
      </a>
    </div>

    <!-- Expiry notice -->
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:18px;">⏳</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#FCD34D;margin-bottom:2px;">Expires in 48 hours</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);">${expiryDate} (UK time)</div>
      </div>
    </div>

    <!-- Fallback link -->
    <p style="font-size:11.5px;color:rgba(255,255,255,0.3);margin:0;line-height:1.8;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${inviteUrl}" style="color:#6366F1;word-break:break-all;">${inviteUrl}</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.06);padding:18px 36px;text-align:center;">
    <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">
      Feature Salon Admin · featuresalon.co.uk<br/>
      If you didn't expect this email, you can safely ignore it.
    </p>
  </div>
</div>
</body></html>`;
}
