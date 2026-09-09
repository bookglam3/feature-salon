/**
 * Feature Access Control
 * Plans: starter | pro | business | enterprise
 * During trial: ALL features unlocked
 * After trial: locked by plan
 */

export type Plan = "starter" | "pro" | "business" | "enterprise";

export type Feature =
  | "calendar"
  | "analytics_basic"
  | "analytics_full"
  | "reviews"
  | "gift_cards"
  | "client_portal";

/** Which plans unlock which features */
const FEATURE_PLANS: Record<Feature, Plan[]> = {
  calendar:        ["pro", "business", "enterprise"],
  analytics_basic: ["pro", "business", "enterprise"],
  analytics_full:  ["business", "enterprise"],
  reviews:         ["pro", "business", "enterprise"],
  gift_cards:      ["business", "enterprise"],
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
  calendar:        { label: "Calendar View",    icon: "🗓️", requiredPlan: "pro"      },
  analytics_basic: { label: "Analytics",        icon: "📊", requiredPlan: "pro"      },
  analytics_full:  { label: "Full Analytics",   icon: "📊", requiredPlan: "business" },
  reviews:         { label: "Reviews",          icon: "⭐", requiredPlan: "pro"      },
  gift_cards:      { label: "Gift Cards",       icon: "🎁", requiredPlan: "business" },
  client_portal:   { label: "Client Portal",    icon: "🔐", requiredPlan: "business" },
};

export function hasFeatureAccess(
  feature: Feature,
  plan: string | null,
  status: string | null
): boolean {
  // Trial or trialing — all features unlocked
  if (status === "trial" || status === "trialing") return true;
  // Not active — no extra features
  if (status !== "active") return false;

  const normalizedPlan = (plan || "starter").toLowerCase() as Plan;
  const allowedPlans = FEATURE_PLANS[feature];
  return allowedPlans.includes(normalizedPlan);
}

export function getRequiredPlan(feature: Feature): Plan {
  return FEATURE_META[feature].requiredPlan;
}
