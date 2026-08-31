"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { SalonProvider } from "./context/SalonContext";

type SubStatus = "trial" | "trialing" | "active" | "past_due" | "cancelled" | "canceled" | "unpaid" | null;

interface SalonSub {
  id:                  string;
  subscription_status: SubStatus;
  subscription_plan:   string | null;
  plan:                string | null;
  trial_ends_at:       string | null;
  current_period_end:  string | null;
  stripe_customer_id:  string | null;
}

function daysLeft(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function TrialBanner({ salon }: { salon: SalonSub }) {
  const days = daysLeft(salon.trial_ends_at);
  const urgent = days <= 3;
  const openPortal = async () => {
    if (!salon.stripe_customer_id) { window.location.href = "/subscribe"; return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/subscription/portal", { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token}`}, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Couldn't open the billing portal. Please try again or email support@featuresalon.co.uk.");
    } catch {
      alert("Network error. Please try again or email support@featuresalon.co.uk.");
    }
  };
  return (
    <div style={{
      background: urgent
        ? "linear-gradient(90deg,rgba(127,29,29,0.95),rgba(185,28,28,0.95))"
        : "linear-gradient(90deg,rgba(14,19,32,0.98),rgba(28,36,56,0.98))",
      backdropFilter: "blur(8px)",
      color:"#fff", padding:"10px 20px", fontSize:13, fontWeight:600,
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap",
      borderBottom: `1px solid ${urgent ? "rgba(239,68,68,0.3)" : "rgba(201,162,75,0.3)"}`,
    }}>
      <span style={{ color: urgent ? "#FCA5A5" : "#C9A24B" }}>
        {urgent ? "⚠️" : "🎁"}{" "}
        {days === 0
          ? "Your free trial has ended — subscribe to keep access"
          : `Free trial: ${days} day${days === 1 ? "" : "s"} remaining`}
        {salon.subscription_plan && ` · ${salon.subscription_plan.charAt(0).toUpperCase() + salon.subscription_plan.slice(1)} plan`}
      </span>
      <button onClick={openPortal} style={{ background: urgent ? "rgba(239,68,68,0.25)" : "rgba(201,162,75,0.25)", border: `1px solid ${urgent ? "rgba(239,68,68,0.4)" : "rgba(201,162,75,0.4)"}`, color:"#fff", borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
        {salon.stripe_customer_id ? "Manage Subscription →" : "Upgrade Now →"}
      </button>
    </div>
  );
}

function PastDueBanner(_: { salon: SalonSub }) {
  const openPortal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/subscription/portal", { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.access_token}`}, body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.href = data.url; return; }
      alert(data.error || "Couldn't open the billing portal. Please try again or email support@featuresalon.co.uk.");
    } catch {
      alert("Network error. Please try again or email support@featuresalon.co.uk.");
    }
  };
  return (
    <div style={{ background:"linear-gradient(90deg,rgba(120,53,15,0.95),rgba(161,98,7,0.95))", backdropFilter:"blur(8px)", color:"#fff", padding:"10px 20px", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", borderBottom:"1px solid rgba(245,158,11,0.3)" }}>
      <span style={{ color:"#FCD34D" }}>⚠️ Payment failed — please update your payment method to avoid losing access</span>
      <button onClick={openPortal} style={{ background:"rgba(245,158,11,0.25)", border:"1px solid rgba(245,158,11,0.4)", color:"#fff", borderRadius:99, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
        Fix Payment →
      </button>
    </div>
  );
}

function LockedOverlay({ salon }: { salon: SalonSub }) {
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState("");
  const knownPlan = salon.subscription_plan || salon.plan || null;

  // Starts a fresh Stripe Checkout session and redirects to pay — this is
  // the correct flow for reactivation. (Previously this called the Stripe
  // Billing Portal, which is for managing an EXISTING subscription and
  // fails/no-ops for a customer with no billable subscription history.)
  const reactivate = async () => {
    if (reactivating) return;
    setError("");

    if (!knownPlan) {
      // No plan on record at all — let them pick one.
      window.location.href = "/subscribe";
      return;
    }

    setReactivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ plan: knownPlan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't start checkout. Please try again, or email support@featuresalon.co.uk for help.");
        setReactivating(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again, or email support@featuresalon.co.uk for help.");
      setReactivating(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, backdropFilter:"blur(16px)" }}>
      <div style={{ maxWidth:480, width:"100%", textAlign:"center", background:"rgba(20,18,42,0.95)", border:"1px solid rgba(201,162,75,0.2)", borderRadius:24, padding:"48px 36px", boxShadow:"0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,75,0.1)" }}>
        <div style={{ fontSize:56, marginBottom:20 }}>🔒</div>
        <h1 style={{ fontSize:28, fontWeight:900, color:"#2a3350", letterSpacing:"-1px", marginBottom:12 }}>
          Dashboard Locked
        </h1>
        <p style={{ color:"rgba(255,255,255,0.5)", fontSize:15, lineHeight:1.7, marginBottom:32 }}>
          {salon.subscription_status === "cancelled" || salon.subscription_status === "canceled"
            ? "Your subscription has been cancelled. Reactivate to access your dashboard."
            : "Your subscription has expired. Please renew to continue managing your salon."}
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button
            onClick={reactivate}
            disabled={reactivating}
            style={{ background:"linear-gradient(135deg,#C9A24B 0%,#0E1320 100%)", color:"#fff", border:"none", borderRadius:12, padding:"16px 32px", fontSize:16, fontWeight:800, cursor: reactivating ? "default" : "pointer", boxShadow:"0 8px 32px rgba(201,162,75,0.5)", transition:"all 0.18s", opacity: reactivating ? 0.75 : 1 }}
            onMouseEnter={e => { if (!reactivating) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(201,162,75,0.65)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(201,162,75,0.5)"; }}
          >
            {reactivating ? "Redirecting to checkout…" : knownPlan ? "Reactivate Subscription →" : "Choose a Plan →"}
          </button>
          {error && (
            <div style={{ fontSize:12.5, color:"#FCA5A5", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 14px", textAlign:"left", lineHeight:1.6 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)" }}>
            Plans from £29/month · Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [salon,  setSalon]  = useState<SalonSub | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchSalon = async (userId: string) => {
      const { data } = await supabase
        .from("salons")
        .select("id,subscription_status,subscription_plan,plan,trial_ends_at,current_period_end,stripe_customer_id")
        .eq("owner_id", userId)
        .single();
      setSalon(data as SalonSub | null);
      setLoaded(true);
    };

    // Run once on mount: verify session and load subscription status.
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await fetchSalon(user.id);
    };
    init();

    // React to auth state changes (logout, token expiry, login in another tab).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setSalon(null);
        setLoaded(false);
        router.push("/login");
      } else if (event === "SIGNED_IN" && session.user) {
        fetchSalon(session.user.id);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        fetchSalon(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Always render inside SalonProvider from the very first paint so children
  // never fall back to the bare context default (which uses "hair" / salon terms).
  // Show a neutral dark loading screen while the subscription check is in-flight.
  if (!loaded) {
    return (
      <SalonProvider>
        <div style={{
          minHeight: "100vh",
          background: "#F5F3FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "3px solid rgba(124,58,237,0.2)",
            borderTopColor: "#7C3AED",
            animation: "spin 0.7s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </SalonProvider>
    );
  }

  const status       = salon?.subscription_status ?? "trial";
  const trialDays    = daysLeft(salon?.trial_ends_at ?? null);
  const isLocked     = status === "cancelled" || status === "canceled" || (status === "trial" && trialDays === 0);
  const showTrial    = status === "trial" || status === "trialing";
  const showPastDue  = status === "past_due";

  return (
    <SalonProvider>
      {isLocked && salon  && <LockedOverlay salon={salon} />}
      {showTrial && salon  && <TrialBanner   salon={salon} />}
      {showPastDue && salon && <PastDueBanner salon={salon} />}
      {children}
    </SalonProvider>
  );
}