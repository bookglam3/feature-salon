import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  LIFECYCLE_FROM, LIFECYCLE_REPLY_TO, buildEmail, lifecycleConfig, planToday, unsubscribeHeaders,
} from "@/app/lib/lifecycle/run";
import type { Decision } from "@/app/lib/lifecycle/decide";

type SendDecision = Extract<Decision, { action: "send" }>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SENDS_PER_RUN = 50;
const SEND_GAP_MS = 600; // stay well under Resend's rate limit

// GET /api/cron/lifecycle-emails — daily (vercel.json). Decides which owner
// gets which lifecycle email (docs/lifecycle-emails.md) and logs it to
// email_log. Sends only when LIFECYCLE_EMAILS_LIVE === "true"; otherwise it
// writes 'dry_run' rows so the admin view shows what would have gone out.
// Auth: Vercel cron's "Authorization: Bearer <CRON_SECRET>" header only.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = lifecycleConfig();
  if (!cfg.unsubscribeSecret) {
    console.error("[lifecycle] LIFECYCLE_UNSUBSCRIBE_SECRET is not set — nothing logged or sent");
    return NextResponse.json({ error: "LIFECYCLE_UNSUBSCRIBE_SECRET is not set" }, { status: 500 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();

  let plan;
  try {
    plan = await planToday(db, now, cfg);
  } catch (err) {
    console.error("[lifecycle] couldn't load data:", err);
    return NextResponse.json({ error: "Failed to load lifecycle data" }, { status: 500 });
  }

  const salonsById = new Map(plan.salons.map(s => [s.salonId, s]));
  const sends = plan.decisions.filter((d): d is SendDecision => d.action === "send");
  const summary = { live: cfg.live, salons: plan.salons.length, due: sends.length, sent: 0, dryRun: 0, failed: 0, alreadyClaimed: 0, deferred: 0 };

  if (!cfg.live) {
    if (sends.length) {
      const { error } = await db.from("email_log").insert(sends.map(d => ({
        salon_id: d.salonId, email_key: d.emailKey, dedupe_key: d.dedupeKey, status: "dry_run", sent_at: now.toISOString(),
      })));
      if (error) {
        console.error("[lifecycle] couldn't write dry-run rows:", error.message);
        return NextResponse.json({ error: "Failed to write email_log" }, { status: 500 });
      }
      summary.dryRun = sends.length;
    }
    return NextResponse.json(summary);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  for (const [i, d] of sends.entries()) {
    if (i >= MAX_SENDS_PER_RUN) { summary.deferred = sends.length - MAX_SENDS_PER_RUN; break; }
    const salon = salonsById.get(d.salonId)!;

    // Claim first: the unique index on (salon_id, dedupe_key) stops a second
    // run from claiming — and sending — the same email.
    const { data: claim, error: claimErr } = await db.from("email_log").insert({
      salon_id: d.salonId, email_key: d.emailKey, dedupe_key: d.dedupeKey, status: "sending", sent_at: now.toISOString(),
    }).select("id").single();
    if (claimErr || !claim) {
      if (claimErr?.code === "23505") { summary.alreadyClaimed++; continue; }
      console.error("[lifecycle] couldn't claim", d.salonId, d.emailKey, claimErr?.message);
      summary.failed++;
      continue;
    }

    const email = buildEmail(salon, d.emailKey, cfg);
    try {
      const { data, error } = await resend.emails.send({
        from: LIFECYCLE_FROM,
        to: salon.ownerEmail!,
        replyTo: LIFECYCLE_REPLY_TO,
        subject: email.subject,
        text: email.text,
        headers: unsubscribeHeaders(email.unsubscribeUrl),
      }, { idempotencyKey: `lifecycle:${d.salonId}:${d.dedupeKey}` });
      if (error) throw new Error(error.message);
      await db.from("email_log").update({ status: "sent", resend_id: data?.id ?? null }).eq("id", claim.id);
      summary.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[lifecycle] send failed", d.salonId, d.emailKey, message);
      await db.from("email_log").update({ status: "failed", error: message.slice(0, 500) }).eq("id", claim.id);
      summary.failed++;
    }
    await new Promise(r => setTimeout(r, SEND_GAP_MS));
  }

  console.log("[lifecycle] run summary", summary);
  return NextResponse.json(summary);
}
