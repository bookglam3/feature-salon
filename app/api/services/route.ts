import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

// Service-role client — bypasses RLS, trusted server-side only
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "PASTE_SERVICE_ROLE_KEY_HERE") {
  console.error(
    "[/api/services] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set or is a placeholder.\n" +
    "Services will NOT save. Set this in Vercel → Project Settings → Environment Variables."
  );
}

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE_KEY!
);

// Helper: verify the request comes from a logged-in salon owner
// Returns the salon row if valid, null otherwise
async function getOwnerSalon(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    console.error("[/api/services] No authorization token provided");
    return null;
  }

  // Verify JWT with Supabase
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) {
    console.error("[/api/services] Token verification failed:", error?.message);
    return null;
  }

  const { data: salon, error: salonErr } = await adminSupabase
    .from("salons")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (salonErr || !salon) {
    console.error("[/api/services] Salon lookup failed for user:", user.id, salonErr?.message);
    return null;
  }

  return salon;
}

// ── GET /api/services — list services for authenticated owner
export async function GET(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await adminSupabase
    .from("services")
    .select("*")
    .eq("salon_id", salon.id)
    .order("price", { ascending: true });

  if (error) {
    console.error("[/api/services] GET failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ services: data });
}

// ── POST /api/services — create a new service
export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { name, price, duration_minutes, description, category_id, gender_restriction, price_type } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
  if (!price || parseFloat(price) <= 0) return NextResponse.json({ error: "Price must be greater than 0" }, { status: 400 });
  if (gender_restriction && !["all", "female", "male"].includes(gender_restriction)) {
    return NextResponse.json({ error: "Invalid gender_restriction" }, { status: 400 });
  }
  const resolvedPriceType = price_type || "fixed";
  if (!["fixed", "from", "free"].includes(resolvedPriceType)) {
    return NextResponse.json({ error: "Invalid price_type" }, { status: 400 });
  }
  if (resolvedPriceType === "free" && parseFloat(price) !== 0) {
    return NextResponse.json({ error: "A free service must have a price of 0" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    salon_id: salon.id,
    name: name.trim(),
    price: parseFloat(price),
    duration_minutes: parseInt(duration_minutes) || null,
  };
  if (description?.trim()) payload.description = description.trim();
  payload.category_id = category_id || null;
  payload.gender_restriction = gender_restriction || "all";
  payload.price_type = resolvedPriceType;
  // BRIDGE: price_is_from is still a plain writable column until
  // supabase-service-menu-migration-B.sql converts it to a GENERATED
  // column derived from price_type. Remove this line the moment B
  // lands — a generated column rejects any explicit write.
  payload.price_is_from = resolvedPriceType === "from";

  const { data, error } = await adminSupabase.from("services").insert(payload).select().single();
  if (error) {
    console.error("[/api/services] POST insert failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ service: data });
}

// ── PATCH /api/services — update an existing service
export async function PATCH(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { id, name, price, duration_minutes, description, category_id, gender_restriction, price_type } = body;

  if (!id) return NextResponse.json({ error: "Service ID required" }, { status: 400 });
  if (gender_restriction && !["all", "female", "male"].includes(gender_restriction)) {
    return NextResponse.json({ error: "Invalid gender_restriction" }, { status: 400 });
  }
  const resolvedPriceType = price_type || "fixed";
  if (!["fixed", "from", "free"].includes(resolvedPriceType)) {
    return NextResponse.json({ error: "Invalid price_type" }, { status: 400 });
  }
  if (resolvedPriceType === "free" && parseFloat(price) !== 0) {
    return NextResponse.json({ error: "A free service must have a price of 0" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    name: name?.trim(),
    price: parseFloat(price),
    duration_minutes: parseInt(duration_minutes) || null,
  };
  if (description?.trim()) payload.description = description.trim();
  else payload.description = null;
  payload.category_id = category_id || null;
  if (gender_restriction) payload.gender_restriction = gender_restriction;
  payload.price_type = resolvedPriceType;
  // BRIDGE: see POST handler above — remove once Migration B lands.
  payload.price_is_from = resolvedPriceType === "from";

  const { error } = await adminSupabase
    .from("services")
    .update(payload)
    .eq("id", id)
    .eq("salon_id", salon.id); // extra safety: can only update own salon's services

  if (error) {
    console.error("[/api/services] PATCH update failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// ── DELETE /api/services — delete a service
export async function DELETE(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Service ID required" }, { status: 400 });

  const { error } = await adminSupabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("salon_id", salon.id); // extra safety

  if (error) {
    console.error("[/api/services] DELETE failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
