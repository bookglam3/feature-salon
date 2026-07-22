import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VAPID_EMAIL = process.env.VAPID_EMAIL;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const vapidConfigured = !!(VAPID_EMAIL && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Fans a push notification out to every device the salon's owner has
 * subscribed (a salon may have several). Matches the { title, body, url }
 * shape public/sw.js expects.
 *
 * Never throws — a push failure must never break a booking flow. Dead
 * subscriptions (410/404) are pruned so every send doesn't slow down forever.
 */
export async function sendPushToSalon(salonId: string | undefined | null, payload: PushPayload): Promise<void> {
  if (!salonId) return;

  if (!vapidConfigured) {
    const missing = [
      !VAPID_EMAIL && "VAPID_EMAIL",
      !VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      !VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    console.error(`[push] NOT CONFIGURED — missing env var(s): ${missing}. Push silently skipped for salon ${salonId}.`);
    return;
  }

  try {
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("salon_id", salonId);

    if (error) {
      console.error("[push] Failed to fetch subscriptions:", error.message);
      return;
    }
    if (!subs || subs.length === 0) return;

    // Keep well under the 4KB push payload limit
    const body = JSON.stringify({
      title: payload.title.slice(0, 100),
      body: payload.body.slice(0, 300),
      url: payload.url,
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
      )
    );

    const deadIds: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const statusCode = (result.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(subs[i].id);
        } else {
          console.error(`[push] Send failed for subscription ${subs[i].id}:`, result.reason);
        }
      }
    });

    if (deadIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadIds);
      console.log(`[push] Removed ${deadIds.length} dead subscription(s) for salon ${salonId}`);
    }
  } catch (err) {
    console.error("[push] sendPushToSalon error (non-fatal):", err);
  }
}
