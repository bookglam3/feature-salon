import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOfferEmail } from "@/app/lib/email";
import { sendSMS } from "@/app/lib/sms";
import { sendWhatsApp } from "@/app/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 5 minutes for large client lists
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SalonRow { id: string; name: string; slug: string; }

// Resolves the caller's salon from their session token — salon identity is
// NEVER trusted from the request body, so a tampered payload can't target
// (or read) another salon's clients.
async function getOwnerSalon(req: NextRequest): Promise<SalonRow | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: salon, error: salonErr } = await supabase
    .from("salons")
    .select("id, name, slug")
    .eq("owner_id", user.id)
    .single();
  if (salonErr || !salon) return null;
  return salon as SalonRow;
}

// Recipients are derived here, server-side, on every send — never accepted
// from the client. Email-only for now (SMS/WhatsApp opt-out plumbing is a
// separate piece of work).
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

    if (!channel || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const recipients = await getRecipients(salon.id);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients matched" }, { status: 400 });
    }

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
        if (channel === "email" && client.email) {
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
        } else if (channel === "sms" && client.phone) {
          await sendSMS(client.phone, personalised, salon.name);
          sent++;
        } else if (channel === "whatsapp" && client.phone) {
          await sendWhatsApp(client.phone, personalised);
          sent++;
        }
      } catch (e) {
        errors.push(`${client.name} (${client.email || client.phone}): ${e}`);
      }
    }

    // Update broadcast record with actual sent count — scoped to this salon
    // so a stale/foreign broadcastId can't touch another salon's log row.
    if (broadcastId) {
      await supabase
        .from("broadcast_messages")
        .update({ status: errors.length === 0 ? "sent" : "partial", recipient_count: sent })
        .eq("id", broadcastId)
        .eq("salon_id", salon.id);
    }

    return NextResponse.json({ success: true, sent, errors: errors.length > 0 ? errors : undefined });

  } catch (err) {
    console.error("[broadcast/send] Error:", err);
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
  }
}
