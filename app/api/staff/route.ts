import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

// Service-role client — bypasses RLS, trusted server-side only
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: verify the request comes from a logged-in salon owner
// Returns the salon row if valid, null otherwise
async function getOwnerSalon(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    console.error("[/api/staff] No authorization token provided");
    return null;
  }

  // Verify JWT with Supabase auth
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) {
    console.error("[/api/staff] Token verification failed:", error?.message);
    return null;
  }

  const { data: salon, error: salonErr } = await adminSupabase
    .from("salons")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (salonErr || !salon) {
    console.error("[/api/staff] Salon lookup failed for user:", user.id, salonErr?.message);
    return null;
  }

  return salon;
}

// ── GET /api/staff — list staff for authenticated owner
export async function GET(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await adminSupabase
    .from("staff")
    .select("*")
    .eq("salon_id", salon.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("[/api/staff] GET failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ staff: data });
}

// ── POST /api/staff — create a new staff member
export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { name, email, role, active, services, working_hours } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Staff name is required" }, { status: 400 });
  }

  const payload = {
    salon_id: salon.id,
    name: name.trim(),
    email: email?.trim() || null,
    role: role || "stylist",
    active: active ?? true,
    services: services || [],
    working_hours: working_hours || {},
  };

  const { data, error } = await adminSupabase
    .from("staff")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[/api/staff] POST insert failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ staff: data });
}

// ── PATCH /api/staff — update an existing staff member
export async function PATCH(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id, name, email, role, active, services, working_hours } = body;

  if (!id) return NextResponse.json({ error: "Staff ID required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "Staff name is required" }, { status: 400 });

  const payload = {
    name: name.trim(),
    email: email?.trim() || null,
    role: role || "stylist",
    active: active ?? true,
    services: services || [],
    working_hours: working_hours || {},
  };

  const { error } = await adminSupabase
    .from("staff")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", salon.id); // safety: can only update own salon's staff

  if (error) {
    console.error("[/api/staff] PATCH update failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ── DELETE /api/staff — delete a staff member
export async function DELETE(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Staff ID required" }, { status: 400 });

  const { error } = await adminSupabase
    .from("staff")
    .delete()
    .eq("id", id)
    .eq("salon_id", salon.id); // safety: can only delete own salon's staff

  if (error) {
    console.error("[/api/staff] DELETE failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ── PUT /api/staff — toggle active status
export async function PUT(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id, active } = body;
  if (!id) return NextResponse.json({ error: "Staff ID required" }, { status: 400 });

  const { error } = await adminSupabase
    .from("staff")
    .update({ active })
    .eq("id", id)
    .eq("salon_id", salon.id);

  if (error) {
    console.error("[/api/staff] PUT toggle failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
