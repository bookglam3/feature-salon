import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

// Service-role client — bypasses RLS, trusted server-side only
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: verify the request comes from a logged-in salon owner.
// Mirrors the identical helper in /api/services — kept as its own copy
// rather than shared, matching this codebase's existing convention
// (upload-logo, services, staff routes each inline their own).
async function getOwnerSalon(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: salon, error: salonErr } = await adminSupabase
    .from("salons")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (salonErr || !salon) return null;

  return salon;
}

// ── GET /api/service-categories — list categories for authenticated owner
export async function GET(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await adminSupabase
    .from("service_categories")
    .select("*")
    .eq("salon_id", salon.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data });
}

// ── POST /api/service-categories — create a new category
export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

  const { data: dup } = await adminSupabase
    .from("service_categories")
    .select("id")
    .eq("salon_id", salon.id)
    .ilike("name", name)
    .maybeSingle();
  if (dup) return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });

  // New categories go to the end of the order, not sort_order 0.
  const { data: maxRow } = await adminSupabase
    .from("service_categories")
    .select("sort_order")
    .eq("salon_id", salon.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await adminSupabase
    .from("service_categories")
    .insert({ salon_id: salon.id, name, sort_order: nextSortOrder })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// ── PATCH /api/service-categories — rename, or reorder via move up/down
export async function PATCH(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, name, move } = body as { id?: string; name?: string; move?: "up" | "down" };
  if (!id) return NextResponse.json({ error: "Category ID required" }, { status: 400 });

  if (move === "up" || move === "down") {
    const { data: cats, error: listErr } = await adminSupabase
      .from("service_categories")
      .select("id,sort_order")
      .eq("salon_id", salon.id)
      .order("sort_order", { ascending: true });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const idx = (cats || []).findIndex(c => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const swapIdx = move === "up" ? idx - 1 : idx + 1;
    if (!cats || swapIdx < 0 || swapIdx >= cats.length) {
      return NextResponse.json({ success: true }); // already at the boundary — no-op
    }

    const current = cats[idx];
    const swapWith = cats[swapIdx];

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      adminSupabase.from("service_categories").update({ sort_order: swapWith.sort_order }).eq("id", current.id).eq("salon_id", salon.id),
      adminSupabase.from("service_categories").update({ sort_order: current.sort_order }).eq("id", swapWith.id).eq("salon_id", salon.id),
    ]);
    if (e1 || e2) return NextResponse.json({ error: (e1 || e2)?.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

    const { data: dup } = await adminSupabase
      .from("service_categories")
      .select("id")
      .eq("salon_id", salon.id)
      .ilike("name", trimmed)
      .neq("id", id)
      .maybeSingle();
    if (dup) return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });

    const { error } = await adminSupabase
      .from("service_categories")
      .update({ name: trimmed })
      .eq("id", id)
      .eq("salon_id", salon.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

// ── DELETE /api/service-categories — delete a category.
// services.category_id is ON DELETE SET NULL, so affected services
// become uncategorised automatically; they are never deleted here.
export async function DELETE(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Category ID required" }, { status: 400 });

  const { error } = await adminSupabase
    .from("service_categories")
    .delete()
    .eq("id", id)
    .eq("salon_id", salon.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
