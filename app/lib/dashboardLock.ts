import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { salonAccess } from "./featureAccess";

/**
 * The dashboard lock, on the server: owner API routes call this first. When
 * the signed-in owner's salon is locked (trial ended, cancelled, unpaid,
 * incomplete — app/lib/featureAccess.ts) it returns a 403 to send back;
 * otherwise null and the route carries on as before.
 *
 * Only for routes the dashboard uses. Public booking, online payments,
 * reminders and reactivating a subscription are never locked.
 * No token / no salon / a lookup error → null: the route's own checks decide,
 * and a database hiccup never locks out a paying customer.
 */
export async function dashboardLockedResponse(req: NextRequest): Promise<NextResponse | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: salon, error } = await db.from("salons")
    .select("subscription_status, subscription_plan, trial_ends_at, lifetime_access")
    .eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) {
    console.error("[dashboard lock] salon lookup failed:", error.message);
    return null;
  }
  if (!salon || !salonAccess(salon).locked) return null;
  return NextResponse.json(
    { error: "Your subscription has ended. Reactivate it to keep using the dashboard.", code: "dashboard_locked" },
    { status: 403 },
  );
}
