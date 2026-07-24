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

export interface PushSubscriptionResult {
  endpointHost: string;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface PushResult {
  envVarsPresent: {
    VAPID_EMAIL: boolean;
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: boolean;
    VAPID_PRIVATE_KEY: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
  };
  subscriptionsFound: number;
  results: PushSubscriptionResult[];
  summary: { sent: number; failed: number; pruned: number };
}

function endpointHostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "invalid-endpoint";
  }
}

function emptyResult(subscriptionsFound = 0): PushResult {
  return {
    envVarsPresent: {
      VAPID_EMAIL: !!VAPID_EMAIL,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!VAPID_PRIVATE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    subscriptionsFound,
    results: [],
    summary: { sent: 0, failed: 0, pruned: 0 },
  };
}

/**
 * Fans a push notification out to every device the salon's owner has
 * subscribed (a salon may have several). Matches the { title, body, url }
 * shape public/sw.js expects.
 *
 * Never throws — a push failure must never break a booking flow. Dead
 * subscriptions (410/404) are pruned so every send doesn't slow down forever.
 * Returns a structured, JSON-safe result (never leaks keys or full endpoint
 * URLs — host only) so callers like the debug endpoint can inspect exactly
 * what happened instead of relying on console logs.
 */
export async function sendPushToSalonDetailed(salonId: string | undefined | null, payload: PushPayload): Promise<PushResult> {
  console.log(`[push] entry salonId=${salonId ?? "null"} title="${payload.title}"`);

  const result = emptyResult();

  if (!salonId) {
    console.error("[push] aborting — salonId is null/undefined");
    return result;
  }

  if (!vapidConfigured) {
    const missing = [
      !VAPID_EMAIL && "VAPID_EMAIL",
      !VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      !VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    ].filter(Boolean).join(", ");
    console.error(`[push] NOT CONFIGURED — missing env var(s): ${missing}. Push silently skipped for salon ${salonId}.`);
    return result;
  }

  try {
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("salon_id", salonId);

    if (error) {
      console.error(`[push] Failed to fetch subscriptions for salon ${salonId}:`, error.message);
      return result;
    }
    if (!subs || subs.length === 0) {
      console.error(`[push] zero subscriptions found for salonId=${salonId}`);
      return result;
    }
    result.subscriptionsFound = subs.length;

    // Keep well under the 4KB push payload limit
    const body = JSON.stringify({
      title: payload.title.slice(0, 100),
      body: payload.body.slice(0, 300),
      url: payload.url,
    });

    const settled = await Promise.allSettled(
      subs.map((sub) => {
        const host = endpointHostOf(sub.endpoint);
        console.log(`[push] attempting subscription ${sub.id} endpoint=${host}`);
        return webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        ).then(() => {
          console.log(`[push] success subscription ${sub.id} endpoint=${host}`);
        });
      })
    );

    const deadIds: string[] = [];
    let sent = 0;
    let failed = 0;
    settled.forEach((outcome, i) => {
      const host = endpointHostOf(subs[i].endpoint);
      if (outcome.status === "fulfilled") {
        sent++;
        result.results.push({ endpointHost: host, ok: true, statusCode: null, error: null });
        return;
      }
      failed++;
      const statusCode = (outcome.reason as { statusCode?: number })?.statusCode ?? null;
      const errorMessage = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      result.results.push({ endpointHost: host, ok: false, statusCode, error: errorMessage });
      if (statusCode === 404 || statusCode === 410) {
        deadIds.push(subs[i].id);
        console.error(`[push] subscription ${subs[i].id} dead — status ${statusCode}, pruning`);
      } else {
        console.error(`[push] send failed for subscription ${subs[i].id} — status ${statusCode ?? "unknown"}:`, outcome.reason);
      }
    });

    if (deadIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", deadIds);
    }

    result.summary = { sent, failed, pruned: deadIds.length };
    console.log(`[push] summary salonId=${salonId} sent=${sent} failed=${failed} pruned=${deadIds.length}`);
    return result;
  } catch (err) {
    console.error(`[push] sendPushToSalonDetailed error (non-fatal) for salon ${salonId}:`, err);
    return result;
  }
}

/** Fire-and-forget wrapper around {@link sendPushToSalonDetailed} for call sites that don't need the result. */
export async function sendPushToSalon(salonId: string | undefined | null, payload: PushPayload): Promise<void> {
  await sendPushToSalonDetailed(salonId, payload);
}
