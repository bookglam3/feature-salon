import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSalonDetailed } from "@/app/lib/push";

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Diagnostic endpoint — runs the exact sendPushToSalon code path and returns
// the outcome in the HTTP response instead of console logs that vanish into
// serverless log retention. Owner-scoped: only reports on salons the caller
// owns. Never returns endpoint URLs or keys, host only.
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const salonId = req.nextUrl.searchParams.get("salonId");
    if (!salonId) return NextResponse.json({ error: "Bad request — salonId is required" }, { status: 400 });

    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id")
      .eq("id", salonId)
      .eq("owner_id", user.id)
      .single();

    if (!salon) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await sendPushToSalonDetailed(salonId, {
      title: "Push debug test",
      body: "If you received this, push delivery works.",
      url: "/dashboard",
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
