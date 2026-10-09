"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  CURRENCIES, PLAN_PRICES, detectCurrency,
  type CurrencyCode,
} from "../lib/currency";

const PLANS = [
  {
    id:        "starter",
    name:      "Starter",
    color:     "#6366F1",
    gradient:  "linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)",
    showBadge: false,
    icon:      "✂️",
    features:  ["Up to 50 bookings/month","1 staff member","Basic analytics","Email notifications","Public booking page","Smart calendar (day, week and month views)","Online payments"],
  },
  {
    id:        "pro",
    name:      "Pro",
    color:     "#8B5CF6",
    gradient:  "linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%)",
    showBadge: true,
    icon:      "💎",
    features:  ["Unlimited bookings","Up to 5 staff members","Smart calendar (day, week and month views)","Advanced analytics","SMS + Email reminders","Custom offers & promotions","Priority support","Stripe online payments"],
  },
  {
    id:        "business",
    name:      "Business",
    color:     "#EC4899",
    gradient:  "linear-gradient(135deg,#EC4899 0%,#BE185D 100%)",
    showBadge: false,
    icon:      "🚀",
    features:  ["Unlimited bookings","Up to 15 staff members","Smart calendar (day, week and month views)","Revenue reports & exports","SMS + Email + WhatsApp reminders","Staff performance tracking","API access","Dedicated account manager","SLA 99.9% uptime"],
  },
];

// ── Currency switcher dropdown ────────────────────────────
function CurrencyDropdown({
  selected, onChange,
}: { selected: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = CURRENCIES[selected];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        id="currency-switcher-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          color: "#fff", fontSize: 13, fontWeight: 600,
        }}
      >
        <span>{cur.flag}</span>
        <span>{cur.code}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
          background: "#1E1B4B", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10, overflow: "hidden", minWidth: 180,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map(code => {
            const c = CURRENCIES[code];
            return (
              <button
                key={code}
                id={`currency-opt-${code}`}
                onClick={() => { onChange(code); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 14px", border: "none", cursor: "pointer",
                  background: selected === code ? "rgba(167,139,250,0.2)" : "transparent",
                  color: "#fff", fontSize: 13, fontWeight: selected === code ? 700 : 500,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ opacity: 0.5, fontWeight: 600 }}>{c.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubscribeContent() {
  const router    = useRouter();
  const params    = useSearchParams();
  const cancelled = params.get("cancelled") === "true";

  const [salonId,   setSalonId]   = useState<string | null>(null);
  const [email,     setEmail]     = useState("");
  const [salonName, setSalonName] = useState("");
  const [loading,   setLoading]   = useState<string | null>(null);
  const [currency,  setCurrency]  = useState<CurrencyCode>("GBP");
  const [detected,  setDetected]  = useState(false);

  // Auth check
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email || "");
      const { data: salon } = await supabase
        .from("salons").select("id,name,subscription_status").eq("owner_id", user.id).single();
      if (!salon) { router.push("/login"); return; }
      if (salon.subscription_status === "active" || salon.subscription_status === "trialing") {
        router.push("/dashboard"); return;
      }
      setSalonId(salon.id);
      setSalonName(salon.name);
    };
    init();
  }, [router]);

  // IP-based currency detection
  useEffect(() => {
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => {
        setCurrency(detectCurrency(d.country_code || ""));
        setDetected(true);
      })
      .catch(() => setDetected(true));
  }, []);

  const handleSelect = async (planId: string) => {
    if (!salonId) return;
    setLoading(planId);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/subscription/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ plan: planId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.assign(data.url);
    } else {
      alert("Error: " + (data.error || "Could not start checkout"));
      setLoading(null);
    }
  };

  const cur = CURRENCIES[currency];
  const prices = PLAN_PRICES[currency];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.6; } }
        @keyframes shimmer { from { opacity:0.4; } to { opacity:1; } }
        .plan-card { transition: transform 0.22s, box-shadow 0.22s; }
        .plan-card:hover { transform: translateY(-6px); }
        .cta-btn { transition: all 0.18s; }
        .cta-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
        .cta-btn:active:not(:disabled) { transform: scale(0.98); }
        .price-shimmer { animation: shimmer 0.3s ease; }
      `}</style>

      <main style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0F0C29 0%,#302B63 50%,#24243e 100%)", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px 80px" }}>

        {/* Top bar — currency switcher */}
        <div style={{ width:"100%", maxWidth:960, display:"flex", justifyContent:"flex-end", marginBottom:24 }}>
          <CurrencyDropdown selected={currency} onChange={setCurrency} />
        </div>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:48, animation:"fadeUp 0.5s ease" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:12 }}>
            feature · salon management
          </div>
          <h1 style={{ fontSize:"clamp(28px,5vw,48px)", fontWeight:900, color:"#fff", letterSpacing:"-1.5px", lineHeight:1.1, marginBottom:16 }}>
            Choose your plan
          </h1>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.6)", maxWidth:480, margin:"0 auto", lineHeight:1.7 }}>
            Start your <strong style={{ color:"#A78BFA" }}>14-day free trial</strong> today. No credit card required upfront. Cancel anytime.
          </p>

          {/* Detected currency note */}
          {detected && currency !== "GBP" && (
            <div style={{ marginTop:14, display:"inline-flex", alignItems:"center", gap:6, background:"rgba(167,139,250,0.12)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:99, padding:"6px 16px" }}>
              <span>{cur.flag}</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:600 }}>
                Prices shown in {cur.name} · Billed in GBP via Stripe
              </span>
            </div>
          )}

          {/* Trial badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginTop:16, background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:999, padding:"8px 20px" }}>
            <span style={{ fontSize:16 }}>🎁</span>
            <span style={{ fontSize:13, fontWeight:700, color:"#A78BFA" }}>14 days free — then pay monthly. Cancel anytime.</span>
          </div>

          {cancelled && (
            <div style={{ marginTop:16, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"10px 20px", color:"#FCA5A5", fontSize:13, fontWeight:600 }}>
              ⚠️ Checkout was cancelled. Choose a plan below to continue.
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:24, width:"100%", maxWidth:960, animation:"fadeUp 0.6s ease 0.1s both" }}>
          {PLANS.map((plan, idx) => {
            const displayPrice = prices[idx];
            const gbpPrice = PLAN_PRICES.GBP[idx];
            const isLocal = currency !== "GBP";
            return (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  background: plan.showBadge ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
                  border: plan.showBadge ? "2px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius:20, overflow:"hidden", position:"relative", backdropFilter:"blur(12px)",
                }}
              >
                {plan.showBadge && (
                  <div style={{ background:"linear-gradient(90deg,#8B5CF6,#EC4899)", textAlign:"center", padding:"6px", fontSize:10, fontWeight:800, color:"#fff", letterSpacing:"2px" }}>
                    ⭐ MOST POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div style={{ background:plan.gradient, padding:"28px 24px" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{plan.icon}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:8 }}>{plan.name}</div>

                  {/* Price display */}
                  <div style={{ display:"flex", alignItems:"baseline", gap:4 }} className="price-shimmer">
                    <span style={{ fontSize:42, fontWeight:900, color:"#fff", letterSpacing:"-2px" }}>
                      {cur.format(displayPrice)}
                    </span>
                    <span style={{ fontSize:14, color:"rgba(255,255,255,0.7)", fontWeight:600 }}>/month</span>
                  </div>

                  {/* Billed in GBP note */}
                  {isLocal && (
                    <div style={{ marginTop:4, fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:500 }}>
                      Billed in GBP · approx. £{gbpPrice}/mo
                    </div>
                  )}

                  <div style={{ marginTop:8, fontSize:12, color:"rgba(255,255,255,0.7)", background:"rgba(0,0,0,0.2)", borderRadius:99, padding:"4px 12px", display:"inline-block" }}>
                    Free for 14 days
                  </div>
                </div>

                {/* Features */}
                <div style={{ padding:"20px 24px" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5, color:"rgba(255,255,255,0.8)" }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:plan.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff", flexShrink:0 }}>✓</div>
                        {f}
                      </div>
                    ))}
                  </div>

                  <button
                    id={`subscribe-${plan.id}`}
                    className="cta-btn"
                    disabled={loading !== null}
                    onClick={() => handleSelect(plan.id)}
                    style={{
                      width:"100%", padding:"14px", borderRadius:12, border:"none",
                      cursor: loading ? "not-allowed" : "pointer",
                      background: loading === plan.id ? "rgba(255,255,255,0.2)" : plan.gradient,
                      color:"#fff", fontSize:15, fontWeight:800, letterSpacing:"-0.3px",
                      animation: loading === plan.id ? "pulse 1s infinite" : "none",
                    }}
                  >
                    {loading === plan.id ? "Opening Checkout..." : "Start Free Trial →"}
                  </button>
                  <p style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:10 }}>
                    No charge for 14 days · Cancel anytime
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip link */}
        <div style={{ marginTop:36, textAlign:"center", animation:"fadeUp 0.6s ease 0.2s both" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", fontSize:13, cursor:"pointer", textDecoration:"underline" }}
          >
            Skip for now — use free trial without card
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ display:"flex", gap:24, marginTop:40, flexWrap:"wrap", justifyContent:"center", animation:"fadeUp 0.6s ease 0.3s both" }}>
          {["🔒 SSL Secured","💳 Stripe Payments","🇬🇧 UK-based","✓ Cancel anytime"].map(t => (
            <div key={t} style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.4)" }}>{t}</div>
          ))}
        </div>
      </main>
    </>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#0F0C29" }} />}>
      <SubscribeContent />
    </Suspense>
  );
}
