"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCIES, PLAN_PRICES, detectCurrency,
  type CurrencyCode,
} from "../lib/currency";

const PLANS = [
  {
    id:        "starter",
    name:      "Starter",
    color:     "#A78BFA",
    gradient:  "linear-gradient(135deg,#8B5CF6 0%,#4F46E5 100%)",
    showBadge: false,
    icon:      "✂️",
    tagline:   "Perfect for solo stylists",
    features:  [
      { text: "Up to 50 bookings/month",     included: true  },
      { text: "1 staff member",               included: true  },
      { text: "Basic analytics",              included: true  },
      { text: "Email notifications",          included: true  },
      { text: "Public booking page",          included: true  },
      { text: "Online Stripe payments",       included: true  },
      { text: "SMS reminders",                included: false },
      { text: "WhatsApp reminders",           included: false },
      { text: "Multi-staff management",       included: false },
      { text: "Revenue reports & exports",    included: false },
    ],
  },
  {
    id:        "pro",
    name:      "Pro",
    color:     "#8B5CF6",
    gradient:  "linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%)",
    showBadge: true,
    icon:      "💎",
    tagline:   "For growing salons",
    features:  [
      { text: "Unlimited bookings",           included: true  },
      { text: "Up to 5 staff members",        included: true  },
      { text: "Advanced analytics",           included: true  },
      { text: "Email notifications",          included: true  },
      { text: "Public booking page",          included: true  },
      { text: "Online Stripe payments",       included: true  },
      { text: "SMS reminders",                included: true  },
      { text: "WhatsApp reminders",           included: true  },
      { text: "Multi-staff management",       included: true  },
      { text: "Revenue reports & exports",    included: false },
    ],
  },
  {
    id:        "business",
    name:      "Business",
    color:     "#EC4899",
    gradient:  "linear-gradient(135deg,#EC4899 0%,#BE185D 100%)",
    showBadge: false,
    icon:      "🚀",
    tagline:   "Enterprise-ready, salon-sized",
    features:  [
      { text: "Unlimited bookings",           included: true  },
      { text: "Up to 15 staff members",       included: true  },
      { text: "Advanced analytics",           included: true  },
      { text: "Email notifications",          included: true  },
      { text: "Public booking page",          included: true  },
      { text: "Online Stripe payments",       included: true  },
      { text: "SMS reminders",                included: true  },
      { text: "WhatsApp reminders",           included: true  },
      { text: "Multi-staff management",       included: true  },
      { text: "Revenue reports & exports",    included: true  },
    ],
  },
];

const FAQ = [
  { q: "Is there a free trial?", a: "Yes — every plan starts with a 14-day free trial. No credit card required to begin." },
  { q: "Can I change plans later?", a: "Absolutely. You can upgrade or downgrade at any time from your dashboard. Prorated billing applies." },
  { q: "What currency do you charge in?", a: "All subscriptions are billed in GBP via Stripe. Prices shown in local currencies are approximate and for reference only." },
  { q: "Is there a contract?", a: "No contracts. Cancel anytime from your dashboard — effective end of the billing period." },
  { q: "Do you offer refunds?", a: "We offer a 30-day money-back guarantee if you're not satisfied after the trial ends." },
];

// ── Currency switcher dropdown — grouped by region ──────
const CURRENCY_GROUPS: { label: string; codes: CurrencyCode[] }[] = [
  { label: "🇬🇧 British Isles",  codes: ["GBP"] },
  { label: "🇪🇺 Europe",          codes: ["EUR","SEK","NOK","DKK","CHF","PLN","CZK","HUF","RON","BGN","TRY"] },
  { label: "🌎 Americas",         codes: ["USD","CAD","AUD","NZD"] },
  { label: "🌏 Middle East",      codes: ["AED","SAR","QAR","KWD","BHD","OMR","JOD","EGP"] },
  { label: "🌏 South Asia",       codes: ["PKR","INR","BDT","LKR"] },
  { label: "🌍 Africa",           codes: ["ZAR","NGN","KES"] },
  { label: "🌏 Asia-Pacific",     codes: ["SGD","MYR","THB","IDR","PHP","VND","JPY","KRW"] },
];

function CurrencyDropdown({
  selected, onChange,
}: { selected: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const cur = CURRENCIES[selected] ?? CURRENCIES.GBP;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = query.toLowerCase();
  const allCodes = Object.keys(CURRENCIES) as CurrencyCode[];
  const filteredCodes = q
    ? allCodes.filter(c => CURRENCIES[c].name.toLowerCase().includes(q) || c.toLowerCase().includes(q))
    : null;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        id="pricing-currency-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          color: "#fff", fontSize: 13, fontWeight: 600,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
      >
        <span>{cur.flag}</span>
        <span>{cur.symbol} {cur.code}</span>
        <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
          background: "#1E1B4B", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12, overflow: "hidden", width: 240,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <input
              autoFocus
              placeholder="Search currency…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 7, padding: "7px 11px", color: "#fff", fontSize: 12.5,
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {filteredCodes ? (
              // Search results — flat list
              filteredCodes.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>No results</div>
              ) : filteredCodes.map(code => {
                const c = CURRENCIES[code];
                return (
                  <button key={code} id={`pricing-currency-opt-${code}`}
                    onClick={() => { onChange(code); setOpen(false); setQuery(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "10px 14px", border: "none", cursor: "pointer",
                      background: selected === code ? "rgba(167,139,250,0.25)" : "transparent",
                      color: "#fff", fontSize: 13, fontWeight: selected === code ? 700 : 400,
                      textAlign: "left", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (selected !== code) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { if (selected !== code) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 17 }}>{c.flag}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.45, fontWeight: 600 }}>{c.code}</span>
                  </button>
                );
              })
            ) : (
              // Grouped list
              CURRENCY_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", letterSpacing: "1px", textTransform: "uppercase" }}>
                    {group.label}
                  </div>
                  {group.codes.map(code => {
                    const c = CURRENCIES[code];
                    return (
                      <button key={code} id={`pricing-currency-opt-${code}`}
                        onClick={() => { onChange(code); setOpen(false); setQuery(""); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "9px 14px", border: "none", cursor: "pointer",
                          background: selected === code ? "rgba(167,139,250,0.25)" : "transparent",
                          color: "#fff", fontSize: 13, fontWeight: selected === code ? 700 : 400,
                          textAlign: "left", transition: "background 0.1s",
                        }}
                        onMouseEnter={e => { if (selected !== code) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                        onMouseLeave={e => { if (selected !== code) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 17 }}>{c.flag}</span>
                        <span style={{ flex: 1 }}>{c.name}</span>
                        <span style={{ fontSize: 11, opacity: 0.45, fontWeight: 600 }}>{c.code}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default function PricingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<CurrencyCode>("GBP");
  const [detected, setDetected] = useState(false);
  const [openFaq,  setOpenFaq]  = useState<number | null>(null);

  useEffect(() => {
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => { setCurrency(detectCurrency(d.country_code || "")); setDetected(true); })
      .catch(() => setDetected(true));
  }, []);

  const cur    = CURRENCIES[currency] ?? CURRENCIES.GBP;
  const prices = PLAN_PRICES[currency] ?? PLAN_PRICES.GBP;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { from { opacity:0.4; } to { opacity:1; } }
        .plan-card { transition: transform 0.22s, box-shadow 0.22s; }
        .plan-card:hover { transform: translateY(-8px); box-shadow: 0 24px 48px rgba(0,0,0,0.3); }
        .cta-btn { transition: all 0.18s; width:100%; padding:14px; border-radius:12px; border:none; font-size:15px; font-weight:800; color:#fff; cursor:pointer; letter-spacing:-0.3px; }
        .cta-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .price-val { animation: shimmer 0.25s ease; }
        .faq-item { border-bottom: 1px solid rgba(255,255,255,0.08); }
      `}</style>

      <main style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0F0C29 0%,#302B63 55%,#1a1a3e 100%)" }}>

        {/* Nav bar */}
        <nav style={{ maxWidth:1100, margin:"0 auto", padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.5px" }}>
            feature<span style={{ color:"#A78BFA" }}>.</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <CurrencyDropdown selected={currency} onChange={setCurrency} />
            <button
              onClick={() => router.push("/login")}
              style={{ background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:8, padding:"7px 16px", color:"#A78BFA", fontSize:13, fontWeight:700, cursor:"pointer" }}
            >
              Sign in →
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section style={{ textAlign:"center", padding:"60px 24px 80px", animation:"fadeUp 0.5s ease" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(167,139,250,0.12)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:99, padding:"6px 18px", marginBottom:20 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#A78BFA" }}>🎁 14-day free trial — no card needed</span>
          </div>
          <h1 style={{ fontSize:"clamp(32px,6vw,60px)", fontWeight:900, color:"#fff", letterSpacing:"-2px", lineHeight:1.05, marginBottom:16 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize:17, color:"rgba(255,255,255,0.6)", maxWidth:520, margin:"0 auto 24px", lineHeight:1.7 }}>
            One price per plan. No hidden fees. Cancel anytime.
          </p>

          {/* Currency detected note */}
          {detected && currency !== "GBP" && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:99, padding:"6px 16px" }}>
              <span style={{ fontSize:16 }}>{cur.flag}</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.55)", fontWeight:600 }}>
                Showing prices in {cur.name} · all plans billed in GBP
              </span>
            </div>
          )}
        </section>

        {/* Pricing cards */}
        <section style={{ maxWidth:1040, margin:"0 auto", padding:"0 24px 80px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))", gap:24, animation:"fadeUp 0.6s ease 0.1s both" }}>
            {PLANS.map((plan, idx) => {
              const displayPrice = prices[idx] ?? 0;
              const gbpPrice     = PLAN_PRICES.GBP[idx];
              const isLocal      = currency !== "GBP";
              return (
                <div
                  key={plan.id}
                  className="plan-card"
                  style={{
                    background: plan.showBadge ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
                    border: plan.showBadge ? "2px solid rgba(167,139,250,0.55)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius:22, overflow:"hidden", backdropFilter:"blur(16px)",
                  }}
                >
                  {plan.showBadge && (
                    <div style={{ background:"linear-gradient(90deg,#8B5CF6,#EC4899)", textAlign:"center", padding:"7px", fontSize:10, fontWeight:900, color:"#fff", letterSpacing:"2.5px" }}>
                      ⭐ MOST POPULAR
                    </div>
                  )}

                  <div style={{ background:plan.gradient, padding:"30px 26px" }}>
                    <div style={{ fontSize:34, marginBottom:8 }}>{plan.icon}</div>
                    <div style={{ fontSize:24, fontWeight:800, color:"#fff", marginBottom:2 }}>{plan.name}</div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", marginBottom:16, fontWeight:500 }}>{plan.tagline}</div>

                    <div className="price-val" style={{ display:"flex", alignItems:"baseline", gap:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:46, fontWeight:900, color:"#fff", letterSpacing:"-2.5px", lineHeight:1 }}>
                        {cur.format(displayPrice)}
                      </span>
                      <span style={{ fontSize:14, color:"rgba(255,255,255,0.65)", fontWeight:600 }}>/month</span>
                    </div>
                    {isLocal && (
                      <div style={{ marginTop:5, fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:500 }}>
                        Billed in GBP · approx. £{gbpPrice}/mo
                      </div>
                    )}
                    <div style={{ marginTop:10, fontSize:12, color:"rgba(255,255,255,0.7)", background:"rgba(0,0,0,0.2)", borderRadius:99, padding:"4px 14px", display:"inline-block", fontWeight:600 }}>
                      Free for 14 days
                    </div>
                  </div>

                  <div style={{ padding:"22px 26px" }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13.5, color: f.included ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)" }}>
                          <div style={{
                            width:18, height:18, borderRadius:"50%", flexShrink:0,
                            background: f.included ? plan.color : "rgba(255,255,255,0.1)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:9, fontWeight:800, color: f.included ? "#fff" : "rgba(255,255,255,0.3)",
                          }}>
                            {f.included ? "✓" : "✕"}
                          </div>
                          {f.text}
                        </div>
                      ))}
                    </div>

                    <button
                      id={`pricing-cta-${plan.id}`}
                      className="cta-btn"
                      style={{ background:plan.gradient }}
                      onClick={() => router.push("/signup")}
                    >
                      Start Free Trial →
                    </button>
                    <p style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:10 }}>
                      No charge for 14 days · Cancel anytime
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature comparison note */}
        <section style={{ maxWidth:700, margin:"0 auto", padding:"0 24px 80px", textAlign:"center", animation:"fadeUp 0.6s ease 0.2s both" }}>
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"28px 32px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#A78BFA", letterSpacing:"1px", textTransform:"uppercase", marginBottom:16 }}>All plans include</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center" }}>
              {["14-day free trial","SSL encryption","GDPR compliant","Supabase-powered DB","Auto reminders","Custom booking page","24/7 uptime monitoring"].map(f => (
                <span key={f} style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:99, padding:"5px 14px" }}>
                  ✓ {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ maxWidth:680, margin:"0 auto", padding:"0 24px 100px", animation:"fadeUp 0.6s ease 0.3s both" }}>
          <h2 style={{ fontSize:28, fontWeight:800, color:"#fff", letterSpacing:"-0.8px", textAlign:"center", marginBottom:32 }}>
            Frequently asked questions
          </h2>
          {FAQ.map((item, i) => (
            <div key={i} className="faq-item">
              <button
                id={`faq-${i}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 0", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}
              >
                <span style={{ fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>{item.q}</span>
                <span style={{ fontSize:20, color:"#A78BFA", transform: openFaq === i ? "rotate(45deg)" : "none", transition:"transform 0.2s" }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ fontSize:14, color:"rgba(255,255,255,0.55)", lineHeight:1.7, paddingBottom:16 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"32px 24px", textAlign:"center" }}>
          <div style={{ display:"flex", gap:24, justifyContent:"center", flexWrap:"wrap", marginBottom:12 }}>
            {["🔒 SSL Secured","💳 Stripe Payments","🇬🇧 UK-based","✓ Cancel anytime","📩 GDPR Compliant"].map(t => (
              <span key={t} style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.3)" }}>{t}</span>
            ))}
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} Feature Salon Management · All prices ex-VAT
          </div>
        </footer>
      </main>
    </>
  );
}
