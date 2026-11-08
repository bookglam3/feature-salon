/**
 * Who can use the dashboard, and which plan features — ONE rule for the
 * browser (dashboard layout, FeatureGate, Settings) and the server (owner API
 * routes, the gift voucher checks).
 *
 *   lifetime_access  → never locked, every feature (Business).
 *   active, past_due → open; features by plan (calendar on every plan). A
 *                      payment problem shows a banner, it doesn't lock.
 *   trial / trialing → open with every feature while trial_ends_at is ahead;
 *                      locked once it has passed (no status = a trial).
 *   cancelled, unpaid, incomplete, anything else → locked.
 * Public booking, online payments and reminders are never decided here — they
 * keep working for every salon.
 *
 * Plans: starter | pro | business | enterprise (a name we don't know counts as starter).
 */

export type Plan = "starter" | "pro" | "business" | "enterprise";

export type Feature =
  | "calendar"
  | "analytics_basic"
  | "analytics_full"
  | "reviews"
  | "gift_cards"
  | "gift_vouchers"
  | "client_portal";

/** Which plans unlock which features */
const FEATURE_PLANS: Record<Feature, Plan[]> = {
  calendar:        ["starter", "pro", "business", "enterprise"], // every plan; status rules below still apply
  analytics_basic: ["pro", "business", "enterprise"],
  analytics_full:  ["business", "enterprise"],
  reviews:         ["pro", "business", "enterprise"],
  gift_cards:      ["business", "enterprise"],
  gift_vouchers:   ["pro", "business", "enterprise"], // create + sell; viewing/redeeming sold vouchers is never plan-locked
  client_portal:   ["business", "enterprise"],
};

export const PLAN_RANK: Record<Plan, number> = {
  starter:    1,
  pro:        2,
  business:   3,
  enterprise: 4,
};

export const PLAN_LABELS: Record<Plan, { name: string; price: string; color: string }> = {
  starter:   { name: "Starter",    price: "£29/mo",  color: "#64748B" },
  pro:       { name: "Pro",        price: "£59/mo",  color: "#6366F1" },
  business:  { name: "Business",   price: "£99/mo",  color: "#047857" },
  enterprise:{ name: "Enterprise", price: "Custom",  color: "#F59E0B" },
};

export const FEATURE_META: Record<Feature, { label: string; icon: string; requiredPlan: Plan }> = {
  calendar:        { label: "Calendar View",    icon: "🗓️", requiredPlan: "starter"  },
  analytics_basic: { label: "Analytics",        icon: "📊", requiredPlan: "pro"      },
  analytics_full:  { label: "Full Analytics",   icon: "📊", requiredPlan: "business" },
  reviews:         { label: "Reviews",          icon: "⭐", requiredPlan: "pro"      },
  gift_cards:      { label: "Discount Codes",   icon: "🏷️", requiredPlan: "business" }, // the old Gift Cards page now holds discount codes
  gift_vouchers:   { label: "Gift Vouchers",    icon: "🎁", requiredPlan: "pro"      },
  client_portal:   { label: "Client Portal",    icon: "🔐", requiredPlan: "business" },
};

/** The salon fields the rule reads. */
export interface SalonAccessFields {
  subscription_status?: string | null;
  subscription_plan?: string | null;
  trial_ends_at?: string | null;
  lifetime_access?: boolean | null;
}

export type AccessState = "lifetime" | "active" | "past_due" | "trial" | "locked";
export type LockReason = "trial_ended" | "cancelled" | "unpaid" | "incomplete" | "inactive";

export interface SalonAccess {
  state: AccessState;
  locked: boolean;
  lockReason: LockReason | null;
  /** The plan whose features apply (lifetime = business; unknown names = starter). */
  plan: Plan;
}

function knownPlan(plan: string | null | undefined): Plan {
  const p = (plan || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLAN_RANK, p) ? (p as Plan) : "starter";
}

export function salonAccess(s: SalonAccessFields, now: Date = new Date()): SalonAccess {
  const open = (state: AccessState, plan: Plan): SalonAccess => ({ state, locked: false, lockReason: null, plan });
  const locked = (lockReason: LockReason): SalonAccess => ({ state: "locked", locked: true, lockReason, plan: knownPlan(s.subscription_plan) });

  if (s.lifetime_access === true) return open("lifetime", "business");
  const status = (s.subscription_status ?? "").trim().toLowerCase() || "trial"; // "Active " (hand-edited) = active
  if (status === "active" || status === "past_due") return open(status, knownPlan(s.subscription_plan));
  if (status === "trial" || status === "trialing") {
    const ends = s.trial_ends_at ? Date.parse(s.trial_ends_at) : NaN;
    return ends > now.getTime() ? open("trial", knownPlan(s.subscription_plan)) : locked("trial_ended");
  }
  if (status === "cancelled" || status === "canceled") return locked("cancelled");
  if (status === "unpaid") return locked("unpaid");
  if (status === "incomplete" || status === "incomplete_expired") return locked("incomplete");
  return locked("inactive");
}

export function hasFeatureAccess(feature: Feature, salon: SalonAccessFields, now: Date = new Date()): boolean {
  const access = salonAccess(salon, now);
  if (access.locked) return false;
  // Lifetime and a running trial: everything. The calendar: every open salon.
  if (access.state === "lifetime" || access.state === "trial" || feature === "calendar") return true;
  return FEATURE_PLANS[feature].includes(access.plan);
}

export function getRequiredPlan(feature: Feature): Plan {
  return FEATURE_META[feature].requiredPlan;
}
