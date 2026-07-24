import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingEmails } from "@/app/lib/email";
import { sendWhatsAppConfirmation } from "@/app/lib/whatsapp";
import { sendSMS, formatUKDate, formatUKTime } from "@/app/lib/sms";
import { sendPushToSalon } from "@/app/lib/push";

export const dynamic = "force-dynamic";

/**
 * POST /api/send-confirmation
 * Called immediately after appointment is confirmed (both Stripe and pay-at-salon paths).
 * Body: { appointmentId: string }
 *
 * Fetches full appointment data from Supabase, resolves owner email from
 * salon.owner_email or the salon owner's auth account, then fires both emails.
 */
export async function POST(req: NextRequest) {
  try {
    const { appointmentId, token, skipOwnerPush } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "Missing appointmentId" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // MUST use service role key — anon key is blocked by RLS for admin lookups
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch appointment with all related data
    // token must match review_token — prevents arbitrary appointmentIds triggering emails
    // Also check created_at — only allow within 15 minutes of booking
    const { data: appt, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services(name, price, price_is_from),
        staff(name),
        salons(id, name, slug, address, owner_email, owner_id, reminders_enabled, whatsapp_enabled, business_type)
      `)
      .eq("id", appointmentId)
      .eq("review_token", token)
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .single();

    if (error || !appt) {
      console.error("[send-confirmation] Appointment fetch error:", error);
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const salon = appt.salons;

    // Resolve owner email: salon.owner_email first, then look up auth user
    let ownerEmail = salon?.owner_email || "";
    if (!ownerEmail && salon?.owner_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(salon.owner_id);
      ownerEmail = authUser?.user?.email || "";
    }

    const clientEmail = appt.client_email;
    if (!clientEmail) {
      return NextResponse.json({ error: "No client email on appointment" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";

    console.log(`[send-confirmation] Sending to client=${clientEmail}, owner=${ownerEmail || "NONE"}`);

    await sendBookingEmails({
      clientEmail,
      clientName:      appt.client_name,
      clientPhone:     appt.client_phone || "",
      serviceName:     appt.services?.name || "Appointment",
      dateTime:        appt.date_time,
      staffName:       appt.staff?.name,
      salonName:       salon?.name || "The Salon",
      salonOwnerEmail: ownerEmail,
      price:           appt.services?.price,
      salonAddress:    salon?.address,
      cancelLink:      `${appUrl}/reschedule/${appointmentId}?token=${appt.review_token}`,
      dashboardUrl:    `${appUrl}/dashboard/bookings`,
      paymentStatus:   appt.payment_status,
      depositOnly:     appt.payment_status === "deposit_paid",
      businessType:    salon?.business_type,
      salonId:         salon?.id,
      appointmentId,
      priceIsFrom:     !!appt.services?.price_is_from,
    });

    // ── WhatsApp Confirmation ────────────────────────────────
    let whatsappSent = false;
    if (appt.client_phone && salon?.whatsapp_enabled) {
      try {
        await sendWhatsAppConfirmation({
          to:           appt.client_phone,
          clientName:   appt.client_name,
          serviceName:  appt.services?.name || "Appointment",
          staffName:    appt.staff?.name,
          salonName:    salon?.name || "The Salon",
          salonAddress: salon?.address,
          dateTime:     appt.date_time,
          price:        appt.services?.price,
          cancelLink:   `${appUrl}/reschedule/${appointmentId}?token=${appt.review_token}`,
        });
        await supabase
          .from("appointments")
          .update({ whatsapp_confirmation_sent: true })
          .eq("id", appointmentId);
        whatsappSent = true;
        console.log(`[send-confirmation] ✅ WhatsApp sent for appointment ${appointmentId}`);
      } catch (waErr) {
        console.error("[send-confirmation] WhatsApp error (non-fatal):", waErr);
      }
    }

    // ── Push Notification to Owner — scheduled via after() so it never
    // delays the response to the booking client, but Vercel keeps the
    // invocation alive (via waitUntil) until it actually completes instead
    // of freezing mid-flight the way a bare un-awaited promise would.
    // Skipped only when the caller explicitly asks (owner creating her own
    // booking manually) — default is to send, since a missing notification
    // is worse than a duplicate one ──────────────────────────────────────
    if (!skipOwnerPush) {
      const firstName = (appt.client_name || "").split(" ")[0] || appt.client_name;
      console.log(`[send-confirmation] calling sendPushToSalon with salonId=${salon?.id ?? "null"}`);
      after(() =>
        sendPushToSalon(salon?.id, {
          title: "New booking",
          body: `${firstName} — ${appt.services?.name || "Appointment"}, ${formatUKDate(appt.date_time)} ${formatUKTime(appt.date_time)}`,
          url: `${appUrl}/dashboard/bookings`,
        }).catch(pushErr => {
          console.error(`[send-confirmation] Push error (non-fatal) for appointment ${appointmentId}:`, pushErr);
        })
      );
    }

    // ── SMS Confirmation ─────────────────────────────────────
    let smsSent = false;
    if (appt.client_phone) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://featuresalon.co.uk";
        const dateLabel = formatUKDate(appt.date_time);
        const timeLabel = formatUKTime(appt.date_time);
        const body = `Hi ${appt.client_name}, your booking at ${salon?.name || "the salon"} is confirmed!\n${appt.services?.name} on ${dateLabel} at ${timeLabel}.\nManage: ${appUrl}/reschedule/${appointmentId}?token=${appt.review_token}`;
        await sendSMS(appt.client_phone, body, salon?.name);
        smsSent = true;
        console.log(`[send-confirmation] ✅ SMS sent for appointment ${appointmentId}`);
      } catch (smsErr) {
        console.error("[send-confirmation] SMS error (non-fatal):", smsErr);
      }
    }

    console.log(`[send-confirmation] ✅ Emails sent for appointment ${appointmentId}`);
    return NextResponse.json({ success: true, whatsappSent, smsSent });

  } catch (err) {
    console.error("[send-confirmation] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
