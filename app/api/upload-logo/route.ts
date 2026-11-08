import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Service-role client bypasses RLS on storage
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get salon for this user
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

    // Parse the uploaded file
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be less than 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `salon-logos/${salon.id}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload using service role key (no RLS restriction)
    const { error: upErr } = await supabaseAdmin.storage
      .from("salon-assets")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (upErr) {
      console.error("[upload-logo] Storage error:", upErr);

      // If bucket doesn't exist, give a helpful error
      if (upErr.message?.includes("Bucket not found") || upErr.message?.includes("not found")) {
        return NextResponse.json(
          { error: "Storage bucket not set up. Please run the supabase-storage-bucket.sql script in your Supabase dashboard." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Upload failed: " + upErr.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("salon-assets")
      .getPublicUrl(path);

    // Append cache-busting param so browser refreshes immediately
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();

    // ── AUTO-SAVE: update logo_url in salons table immediately ──
    const { error: updateErr } = await supabaseAdmin
      .from("salons")
      .update({ logo_url: publicUrl })
      .eq("id", salon.id);

    if (updateErr) {
      console.error("[upload-logo] DB update error:", updateErr);
      // Still return the URL even if DB update fails — user can save manually
    }

    return NextResponse.json({ url: publicUrl, saved: !updateErr });

  } catch (err) {
    console.error("[upload-logo] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
