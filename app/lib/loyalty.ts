import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Visit-based loyalty (stamp card).
 *
 * Visits are never stored as a counter — they are counted from completed
 * appointments in the `loyalty_progress` view, measured from the client's
 * last redemption watermark. That means a status corrected away from
 * "completed" removes the stamp automatically, and nothing can drift.
 *
 * Everything here is written to be non-fatal. The booking confirmation
 * path calls into this module, and a loyalty problem must never cost a
 * client their confirmation email — so every function returns null rather
 * than throwing.
 */

export type RewardType = "free_service" | "amount_off" | "percent_off" | "custom";

export interface LoyaltySettings {
  salon_id: string;
  enabled: boolean;
  visits_required: number;
  reward_type: RewardType;
  reward_service_id: string | null;
  reward_value: number | null;
  reward_description: string | null;
}

export interface LoyaltyProgressRow {
  salon_id: string;
  client_email: string;
  client_name: string | null;
  visits: number;
  lifetime_visits: number;
  last_visit_at: string | null;
  rewards_redeemed: number;
  last_redeemed_at: string | null;
}

/** The card's natural key is (salon_id, lower(btrim(email))). */
export function normaliseEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Human wording for the reward, e.g. "a free Cut & Blow Dry", "£10 off".
 * serviceName is only needed for the free_service type.
 */
export function describeReward(
  settings: Pick<LoyaltySettings, "reward_type" | "reward_value" | "reward_description">,
  serviceName?: string | null,
): string {
  switch (settings.reward_type) {
    case "free_service":
      return serviceName ? `a free ${serviceName}` : "a free service";
    case "amount_off": {
      const v = settings.reward_value ?? 0;
      // Whole pounds read better than "£10.00 off" in an email subject line.
      const amount = Number.isInteger(v) ? `${v}` : v.toFixed(2);
      return `£${amount} off`;
    }
    case "percent_off":
      return `${settings.reward_value ?? 0}% off`;
    case "custom":
    default:
      return settings.reward_description?.trim() || "a reward";
  }
}

export interface LoyaltySnapshot {
  visits: number;
  required: number;
  /** 0 once the threshold is met. */
  remaining: number;
  rewardReady: boolean;
  rewardText: string;
}

/**
 * Everything an email needs to describe one client's stamp progress, or
 * null when the programme is off, unconfigured, the client has no email,
 * or anything at all goes wrong.
 *
 * Callers MUST treat null as "render no loyalty block" rather than as an
 * error worth surfacing.
 */
export async function getLoyaltySnapshot(
  supabase: SupabaseClient,
  salonId: string | null | undefined,
  clientEmail: string | null | undefined,
): Promise<LoyaltySnapshot | null> {
  try {
    const email = normaliseEmail(clientEmail);
    if (!salonId || !email) return null;

    const { data: settings, error: sErr } = await supabase
      .from("loyalty_settings")
      .select("salon_id, enabled, visits_required, reward_type, reward_service_id, reward_value, reward_description")
      .eq("salon_id", salonId)
      .maybeSingle();

    // No row at all = never configured = off. Not an error.
    if (sErr || !settings || !settings.enabled) return null;

    const required = settings.visits_required;
    if (!required || required < 1) return null;

    // Reward wording needs the service name for the free_service type.
    let serviceName: string | null = null;
    if (settings.reward_type === "free_service" && settings.reward_service_id) {
      const { data: svc } = await supabase
        .from("services")
        .select("name")
        .eq("id", settings.reward_service_id)
        .maybeSingle();
      serviceName = svc?.name ?? null;
    }

    const { data: row, error: pErr } = await supabase
      .from("loyalty_progress")
      .select("visits")
      .eq("salon_id", salonId)
      .eq("client_email", email)
      .maybeSingle();

    if (pErr) return null;

    // A client with no completed visits has no row in the view. That is a
    // real state (0 of 5), not a failure.
    const visits = row?.visits ?? 0;

    return {
      visits,
      required,
      remaining: Math.max(0, required - visits),
      rewardReady: visits >= required,
      rewardText: describeReward(settings, serviceName),
    };
  } catch {
    return null;
  }
}
