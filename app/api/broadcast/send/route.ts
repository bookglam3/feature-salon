import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOfferEmail } from "@/app/lib/email";
import { broadcastLimitError, canBroadcast, type BroadcastSalon } from "@/app/lib/broadcastAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes for large client lists
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SalonRow extends BroadcastSalon { id: string; name: string; slug: string; }

// Resolves the caller's salon from their session token — salon identity is
// NEVER trusted from the request body, so a tampered payload can't target
// (or read) another salon's clients.
async function getOwnerSalon(req: NextRequest): Promise<SalonRow | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  // "*" so lifetime_access is included once that column exists
  const { data: salon, error: salonErr } = await supabase
    .from("salons")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  if (salonErr || !salon) return null;
  return salon as SalonRow;
}

// Recipients are derived here, server-side, on every send — never accepted
// from the client. Email only for now: SMS / WhatsApp need opt-out handling
// first, so the API refuses any other channel.
async function getRecipients(salonId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("name, email, phone")
    .eq("salon_id", salonId)
    .eq("marketing_opt_out", false)
    .not("email", "is", null)
    .neq("email", "");
  if (error) throw error;
  return data || [];
}

// GET — read-only recipient count for the compose screen. Does not send anything.
export async function GET(req: NextRequest) {
  const salon = await getOwnerSalon(req);
  if (!salon) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const recipients = await getRecipients(salon.id);
    return NextResponse.json({ recipientCount: recipients.length });
  } catch (e) {
    console.error("[broadcast/send GET] Error:", e);
    return NextResponse.json({ error: "Failed to load recipient count" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const salon = await getOwnerSalon(req);
    if (!salon) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { broadcastId, channel, title, message } = await req.json();

    // Refusing a send also marks the page's "sending" log row as failed.
    const refuse = async (status: number, error: string, code: string) => {
      if (broadcastId) {
        await supabase.from("broadcast_messages").update({ status: "failed" })
          .eq("id", broadcastId).eq("salon_id", salon.id).eq("status", "sending");
      }
      return NextResponse.json({ error, code }, { status });
    };

    // Plan: checked here, not only in the browser.
    if (!canBroadcast(salon, new Date())) {
      return refuse(403, "Broadcasts are included in the Pro and Business plans.", "plan_required");
    }
    if (channel !== "email") {
      return refuse(400, "Only email broadcasts are available right now.", "email_only");
    }
    if (!message || !broadcastId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // The page logs every send first (status "sending"). Only a fresh log row
    // of this salon's can be sent — so every send is on record for the daily limit.
    const since10min = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: logRow, error: logErr } = await supabase.from("broadcast_messages").select("id")
      .eq("id", broadcastId).eq("salon_id", salon.id).eq("status", "sending").gt("created_at", since10min)
      .maybeSingle();
    if (logErr) throw logErr;
    if (!logRow) {
      return NextResponse.json({ error: "Please refresh the page and try again.", code: "stale_broadcast" }, { status: 400 });
    }

    const recipients = await getRecipients(salon.id);
    if (recipients.length === 0) {
      return refuse(400, "No recipients matched", "no_recipients");
    }

    // Daily limit: this salon's broadcasts sent in the last 24 hours.
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: recent, error: recentErr } = await supabase.from("broadcast_messages").select("recipient_count")
      .eq("salon_id", salon.id).in("status", ["sent", "partial"]).gt("created_at", since24h).neq("id", broadcastId);
    if (recentErr) throw recentErr;
    const limitError = broadcastLimitError(recent || [], recipients.length);
    if (limitError) return refuse(429, limitError, "daily_limit");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
    const bookingLink = `${appUrl}/book/${salon.slug}`;

    let sent = 0;
    const errors: string[] = [];

    for (const client of recipients) {
      // Personalise the message
      const personalised = message
        .replace(/{name}/g, client.name || "there")
        .replace(/{salon}/g, salon.name || "us")
        .replace(/{link}/g, bookingLink);

      try {
        if (client.email) {
          const unsubLink = `${appUrl}/unsubscribe?email=${encodeURIComponent(client.email)}&salon=${encodeURIComponent(salon.slug)}`;
          await sendOfferEmail({
            to:           client.email,
            clientName:   client.name || "Valued Client",
            salonName:    salon.name || "Your Salon",
            offerTitle:   title,
            offerDescription: personalised,
            bookingLink,
            unsubLink,
          });
          sent++;
        }
      } catch (e) {
        errors.push(`${client.name} (${client.email || client.phone}): ${e}`);
      }
    }

    // Update broadcast record with actual sent count — scoped to this salon
    // so a stale/foreign broadcastId can't touch another salon's log row.
    await supabase
      .from("broadcast_messages")
      .update({ status: errors.length === 0 ? "sent" : "partial", recipient_count: sent })
      .eq("id", broadcastId)
      .eq("salon_id", salon.id);

    return NextResponse.json({ success: true, sent, errors: errors.length > 0 ? errors : undefined });

  } catch (err) {
    console.error("[broadcast/send] Error:", err);
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
  }
}
