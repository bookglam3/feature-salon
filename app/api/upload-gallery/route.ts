import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  try {
    // Auth check
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get salon
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic"];

    const uploaded: { url: string; name: string }[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!ALLOWED.includes(file.type) && !file.name.match(/\.(heic|heif)$/i)) {
        errors.push(`${file.name}: only images allowed`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        errors.push(`${file.name}: max 10MB`);
        continue;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `salon-gallery/${salon.id}/${uniqueName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: upErr } = await supabaseAdmin.storage
        .from("salon-assets")
        .upload(path, buffer, { upsert: false, contentType: file.type });

      if (upErr) {
        errors.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      const { data: urlData } = supabaseAdmin.storage
        .from("salon-assets")
        .getPublicUrl(path);

      uploaded.push({ url: urlData.publicUrl, name: file.name });
    }

    return NextResponse.json({ uploaded, errors: errors.length ? errors : undefined });

  } catch (err) {
    console.error("[upload-gallery]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
