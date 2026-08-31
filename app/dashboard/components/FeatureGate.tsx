"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  hasFeatureAccess,
  PLAN_LABELS,
  PLAN_RANK,
  FEATURE_META,
  type Feature,
  type Plan,
} from "../../lib/featureAccess";

interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
}

export default function FeatureGate({ feature, children }: FeatureGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "allowed" | "locked" | "error">("loading");
  const [plan, setPlan] = useState<string | null>(null);
  const [hasCustId, setHasCustId] = useState(false);
  const [salonId, setSalonId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }

        // .order + .limit(1) before .single(): an owner can legitimately have
        // more than one salon row (multi-branch — see SalonContext/switchSalon).
        // Bare .single() errors on multiple rows, which used to null out `salon`
        // and bounce to /login without ever leaving "loading" — an endless
        // "Checking access…" spinner. Mirrors getCurrentUserProfile in lib/auth.
        const { data: salon, error } = await supabase
          .from("salons")
          .select("id, subscription_status, subscription_plan, stripe_customer_id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        // PGRST116 = "no rows returned". That's the genuine no-salon case and
        // keeps its original behaviour (bounce to /login); any other error is a
        // real failure and must surface rather than masquerade as "logged out".
        if (error && error.code !== "PGRST116") {
          // Never fail silently again: a query error is surfaced, not swallowed.
          console.error("[FeatureGate] salon lookup failed:", error.message);
          setStatus("error");
          return;
        }

        if (!salon) { router.push("/login"); return; }

        setSalonId(salon.id);
        setPlan(salon.subscription_plan);
        setHasCustId(!!salon.stripe_customer_id);

        const allowed = hasFeatureAccess(feature, salon.subscription_plan, salon.subscription_status);
        setStatus(allowed ? "allowed" : "locked");
      } catch (e) {
        // Safety net: any rejection (network, auth, lock contention) lands on a
        // real state instead of leaving the spinner up forever.
        console.error("[FeatureGate] access check failed:", e);
        setStatus("error");
      }
    };
    check();
  }, [feature, router]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center", color: "#6B6577" }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Checking access…</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "40px 24px" }}>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 16, padding: "32px 28px", boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#12101A", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
            Couldn&apos;t verify access
          </h2>
          <p style={{ fontSize: 13.5, color: "#6B6577", lineHeight: 1.6, margin: "0 0 20px" }}>
            We couldn&apos;t check your plan just now. This is usually temporary — please try again.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
            >Try again</button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ padding: "10px 20px", background: "#FFFFFF", color: "#6B6577", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
            >Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "allowed") return <>{children}</>;

  // ── LOCKED SCREEN ──────────────────────────────────────────────
  const meta = FEATURE_META[feature];
  const requiredPlan = meta.requiredPlan;
  const requiredInfo = PLAN_LABELS[requiredPlan];
  const currentPlan = (plan || "starter").toLowerCase() as Plan;
  const currentInfo = PLAN_LABELS[currentPlan] || PLAN_LABELS.starter;

  const openPortal = async () => {
    if (!hasCustId) { router.push("/subscribe"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/subscription/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  // Plans in upgrade order above current
  const allPlans: Plan[] = ["pro", "business", "enterprise"];
  const upgradePlans = allPlans.filter(p => PLAN_RANK[p] >= PLAN_RANK[requiredPlan]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "40px 24px" }}>
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>

        {/* Lock icon with glow */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 28 }}>
          <div style={{ width: 90, height: 90, borderRadius: 26, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto", boxShadow: "0 16px 48px rgba(124,58,237,0.35)" }}>
            🔒
          </div>
          <div style={{ position: "absolute", bottom: -4, right: -4, background: "#F59E0B", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: "2px solid #fff" }}>
            {meta.icon}
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#12101A", letterSpacing: "-0.8px", margin: "0 0 10px" }}>
          {meta.label} is Locked
        </h1>
        <p style={{ fontSize: 14.5, color: "#6B6577", lineHeight: 1.7, margin: "0 0 28px" }}>
          You&apos;re currently on the{" "}
          <span style={{ fontWeight: 800, color: currentInfo.color }}>{currentInfo.name}</span> plan.
          Upgrade to <span style={{ fontWeight: 800, color: requiredInfo.color }}>{requiredInfo.name}</span> or higher to unlock {meta.icon} {meta.label}.
        </p>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${upgradePlans.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
          {upgradePlans.map(p => {
            const info = PLAN_LABELS[p];
            const isRecommended = p === requiredPlan;
            return (
              <div key={p}
                style={{ border: `2px solid ${isRecommended ? info.color : "#ECE9F1"}`, borderRadius: 16, padding: "16px 14px", background: isRecommended ? `${info.color}08` : "#FFFFFF", position: "relative", transition: "all 0.15s" }}>
                {isRecommended && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: info.color, color: "#fff", fontSize: 9.5, fontWeight: 900, padding: "2px 10px", borderRadius: 99, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                    RECOMMENDED
                  </div>
                )}
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#12101A", marginBottom: 2, textTransform: "capitalize" }}>{info.name}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: info.color, letterSpacing: "-0.5px" }}>{info.price}</div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={openPortal}
          style={{ width: "100%", padding: "15px", background: `linear-gradient(135deg,${requiredInfo.color},${requiredInfo.color}cc)`, color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: `0 8px 24px ${requiredInfo.color}40`, letterSpacing: "-0.3px", transition: "all 0.18s", marginBottom: 10 }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 16px 40px ${requiredInfo.color}50`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 8px 24px ${requiredInfo.color}40`; }}
        >
          {hasCustId ? "Upgrade Plan →" : "Choose a Plan →"}
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6B6577", fontWeight: 600, padding: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#12101A"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#6B6577"; }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
