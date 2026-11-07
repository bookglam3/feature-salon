/**
 * Who may send a broadcast, and how much (POST /api/broadcast/send).
 *
 *   • lifetime access, an active Pro / Business (or Enterprise) plan, or a
 *     trial that hasn't ended yet;
 *   • at most MAX_BROADCASTS_PER_DAY sends and MAX_BROADCAST_EMAILS_PER_DAY
 *     emails per salon in any 24 hours.
 *
 * No imports, so node runs it directly in scripts/test-broadcast-access.mjs.
 */

export const BROADCAST_PLANS = ["pro", "business", "enterprise"];
export const MAX_BROADCASTS_PER_DAY = 2;
export const MAX_BROADCAST_EMAILS_PER_DAY = 1000;

export interface BroadcastSalon {
  subscription_status?: string | null;
  subscription_plan?: string | null;
  trial_ends_at?: string | null;
  /** Free access to everything, for good (sql/…-lifetime-access.sql). Absent until that column exists. */
  lifetime_access?: boolean | null;
}

export function canBroadcast(s: BroadcastSalon, now: Date): boolean {
  if (s.lifetime_access === true) return true;
  const status = s.subscription_status;
  if (status === "active") return BROADCAST_PLANS.includes((s.subscription_plan || "starter").toLowerCase());
  if (status === "trial" || status === "trialing") {
    const ends = s.trial_ends_at ? Date.parse(s.trial_ends_at) : NaN;
    return Number.isFinite(ends) && ends > now.getTime();
  }
  return false;
}

/**
 * The reason this send would go over the daily limit, or null if it's fine.
 * `recent`: the salon's broadcasts sent in the last 24 hours (not this one).
 */
export function broadcastLimitError(recent: { recipient_count: number | null }[], recipientsNow: number): string | null {
  if (recent.length >= MAX_BROADCASTS_PER_DAY) {
    return `You can send up to ${MAX_BROADCASTS_PER_DAY} broadcasts in 24 hours. Please try again later.`;
  }
  const emailsSent = recent.reduce((sum, r) => sum + (r.recipient_count ?? 0), 0);
  if (emailsSent + recipientsNow > MAX_BROADCAST_EMAILS_PER_DAY) {
    return `This would go over the limit of ${MAX_BROADCAST_EMAILS_PER_DAY.toLocaleString("en-GB")} broadcast emails in 24 hours. Please try again later.`;
  }
  return null;
}
