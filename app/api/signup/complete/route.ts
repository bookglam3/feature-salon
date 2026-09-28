import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDefaultServices } from "@/app/lib/defaultServices";
import { validateBusinessDetails } from "@/app/lib/business-location";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Optional string field: absent is fine, anything else must be a string within the limit.
const tooLong = (v: unknown, max: number) => v != null && (typeof v !== "string" || v.length > max);

// POST /api/signup/complete
// Called after the client successfully verifies the email OTP (or from the
// /signup?finish=1 screen for a verified user who has no salon yet).
// The access token proves email ownership — we trust it via supabaseAdmin.auth.getUser.
// This route re-validates the business details (never trust the browser), then
// sets the user's password, creates their salon, and seeds default services.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { accessToken, fullName, password, salonName, addressLine1, postcode, phone, company, category } = body;

  if (typeof accessToken !== "string" || !accessToken || typeof password !== "string" || !password
      || typeof salonName !== "string" || !salonName.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (accessToken.length > 8192) {
    return NextResponse.json({ error: "Session is invalid or expired. Please restart the verification." }, { status: 401 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password.length > 72) {
    return NextResponse.json({ error: "Password must be 72 characters or fewer." }, { status: 400 });
  }
  if (tooLong(fullName, 100)) {
    return NextResponse.json({ error: "Full name must be 100 characters or fewer." }, { status: 400 });
  }
  if (tooLong(category, 30)) {
    return NextResponse.json({ error: "Invalid business type." }, { status: 400 });
  }

  // Verify the access token — supabaseAdmin.auth.getUser validates the JWT cryptographically.
  // This is the server-side proof that the client successfully verified their email OTP.
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !user) {
    return NextResponse.json(
      { error: "Session is invalid or expired. Please restart the verification." },
      { status: 401 },
    );
  }

  // Idempotent: if a salon already exists for this user, signup completed successfully
  // on a prior attempt (or this is an existing account). Return success either way.
  const { data: existingSalon } = await supabaseAdmin
    .from("salons")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingSalon) {
    return NextResponse.json({ ok: true });
  }

  // Full business validation, including a fresh postcodes.io lookup — BEFORE
  // anything is written. A postcodes.io outage fails the signup too.
  const business = await validateBusinessDetails({ businessName: salonName, addressLine1, postcode, phone, company });
  if (!business.ok) {
    return NextResponse.json({ error: business.error, errors: business.errors }, { status: 400 });
  }
  const biz = business.value;

  // Set password + display name. OTP signup creates a passwordless user; we add
  // the password here so they can sign in normally from the login page.
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: {
      full_name:     String(fullName || "").trim(),
      salon_name:    biz.businessName,
      business_type: category || "hair",
    },
  });
  if (updateErr) {
    return NextResponse.json({ error: "Failed to set account password. Please try again." }, { status: 500 });
  }

  // Generate a unique slug
  const baseSlug = biz.businessName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: ex } = await supabaseAdmin.from("salons").select("id").eq("slug", slug).maybeSingle();
    if (!ex) break;
    slug = `${baseSlug}-${++attempt}`;
  }

  // Create the salon record
  const { data: newSalon, error: salonErr } = await supabaseAdmin
    .from("salons")
    .insert({
      name:          biz.businessName,
      slug,
      owner_id:      user.id,
      owner_email:   user.email,
      plan:          "starter",
      business_type: category || "hair",
      address:       `${biz.addressLine1}, ${biz.town} ${biz.postcode}`,
      city:          biz.town,
      postcode:      biz.postcode,
      latitude:      biz.latitude,
      longitude:     biz.longitude,
      phone:         biz.phone,
      country:       "GB",
    })
    .select("id")
    .single();

  if (salonErr || !newSalon) {
    return NextResponse.json(
      { error: "Failed to create salon. Please try again." },
      { status: 500 },
    );
  }

  // Seed vertical-appropriate default services (non-fatal)
  try {
    const defaults = getDefaultServices(category || "hair");
    if (defaults.length > 0) {
      // category (legacy free-text) is deprecated in favour of category_id —
      // stop writing it for new salons; category_id assignment is a dashboard
      // action, not something the seed data should presume.
      await supabaseAdmin.from("services").insert(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        defaults.map(({ category, ...svc }) => ({ salon_id: newSalon.id, ...svc })),
      );
    }
  } catch { /* non-fatal — salon is still created */ }

  return NextResponse.json({ ok: true });
}
