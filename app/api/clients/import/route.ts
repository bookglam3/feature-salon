import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dashboardLockedResponse } from "@/app/lib/dashboardLock";

// Service-role client — bypasses RLS, trusted server-side only
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ROWS = 5000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const BATCH_SIZE = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: verify the request comes from a logged-in salon owner.
// Returns { salon, user } — salon_id is ALWAYS derived from the session,
// never trusted from the request body.
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

  return { salon, user };
}

function normalizePhoneUK(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+44" + digits.slice(1);
  if (digits.startsWith("44")) return "+" + digits;
  return digits;
}

// Tolerant date parser — handles UK DD/MM/YYYY (most common CSV export
// format), ISO YYYY-MM-DD, and falls back to JS Date for textual dates.
// Returns null (never throws) if the value can't be confidently parsed.
function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const uk = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (uk) {
    const day = parseInt(uk[1], 10), month = parseInt(uk[2], 10), year = parseInt(uk[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (!isNaN(new Date(iso).getTime())) return iso;
    }
    return null;
  }

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && !isNaN(new Date(s).getTime())) return isoMatch[0];

  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10);

  return null;
}

interface ImportRow {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  dateOfBirth?: string;
  lastVisit?: string;
}

interface SkippedRow {
  name: string;
  email: string;
  phone: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  const locked = await dashboardLockedResponse(req); // the dashboard lock, on the server
  if (locked) return locked;
  const auth = await getOwnerSalon(req);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { salon, user } = auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { filename, rows, confirmLawfulBasis } = body as {
    filename?: string; rows?: ImportRow[]; confirmLawfulBasis?: boolean;
  };

  if (confirmLawfulBasis !== true) {
    return NextResponse.json(
      { error: "You must confirm you have a lawful basis to import these records." },
      { status: 400 },
    );
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import.` }, { status: 400 });
  }
  if (JSON.stringify(rows).length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Import payload too large (max 5MB)." }, { status: 413 });
  }

  // ── Load existing clients for this salon to dedup against ──
  const { data: existing } = await adminSupabase
    .from("clients")
    .select("email,phone")
    .eq("salon_id", salon.id);

  const existingEmails = new Set(
    (existing || []).filter(c => c.email).map(c => String(c.email).toLowerCase()),
  );
  const existingPhones = new Set(
    (existing || []).filter(c => c.phone).map(c => String(c.phone)),
  );
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  const toInsert: {
    salon_id: string; name: string; email: string | null; phone: string | null;
    notes: string | null; date_of_birth: string | null; last_visit_at: string | null;
    source: string;
  }[] = [];
  const skipped: SkippedRow[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const r of rows) {
    const name = String(r.name || "").trim();
    let email = String(r.email || "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) email = "";
    const phone = normalizePhoneUK(String(r.phone || ""));

    if (!name) {
      invalidCount++;
      skipped.push({ name, email, phone, reason: "Missing name" });
      continue;
    }
    if (!email && !phone) {
      invalidCount++;
      skipped.push({ name, email, phone, reason: "Missing email and phone" });
      continue;
    }

    const dupExisting = (!!email && existingEmails.has(email)) || (!!phone && existingPhones.has(phone));
    const dupInFile = (!!email && seenEmails.has(email)) || (!!phone && seenPhones.has(phone));
    if (dupExisting || dupInFile) {
      duplicateCount++;
      skipped.push({ name, email, phone, reason: dupExisting ? "Already exists" : "Duplicate within file" });
      continue;
    }

    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);

    const dob = parseFlexibleDate(String(r.dateOfBirth || ""));
    const lastVisitDate = parseFlexibleDate(String(r.lastVisit || ""));

    toInsert.push({
      salon_id: salon.id,
      name,
      email: email || null,
      phone: phone || null,
      notes: String(r.notes || "").trim() || null,
      date_of_birth: dob,
      last_visit_at: lastVisitDate ? `${lastVisitDate}T00:00:00Z` : null,
      source: "import",
    });
  }

  // ── Batched insert so large imports don't time out; on a batch error,
  // retry row-by-row to isolate which specific row failed ──
  let importedCount = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error, data } = await adminSupabase.from("clients").insert(batch).select("id");
    if (!error) {
      importedCount += data?.length ?? batch.length;
      continue;
    }
    for (const row of batch) {
      const { error: rowErr } = await adminSupabase.from("clients").insert(row);
      if (rowErr) {
        skipped.push({ name: row.name, email: row.email || "", phone: row.phone || "", reason: `Insert failed: ${rowErr.message}` });
      } else {
        importedCount++;
      }
    }
  }

  // ── GDPR audit trail ──
  await adminSupabase.from("client_import_logs").insert({
    salon_id: salon.id,
    user_id: user.id,
    filename: filename ? String(filename).slice(0, 255) : null,
    row_count: rows.length,
    imported_count: importedCount,
    duplicate_count: duplicateCount,
    skipped_count: invalidCount,
    lawful_basis_confirmed: true,
    confirmed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    imported: importedCount,
    duplicates: duplicateCount,
    skippedInvalid: invalidCount,
    totalRows: rows.length,
    skippedRows: skipped,
  });
}
