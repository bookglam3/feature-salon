"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DemoSalon {
  id: string; name: string; slug: string;
  owner_email: string; plan: string;
  subscription_status: string; subscription_plan: string;
  trial_ends_at: string | null; created_at: string;
  last_city: string | null; last_country: string | null;
  last_device: string | null; last_login_at: string | null;
}

// ── Design tokens — identical to /admin/page.tsx ──────────────────
const T = {
  bg: "#F6F8FC", surface: "#FFFFFF", nav: "#0A0F1C",
  navBorder: "rgba(255,255,255,0.07)", navText: "rgba(255,255,255,0.45)",
  navActive: "#FFFFFF", border: "#E2E8F0", text: "#0F172A",
  text2: "#64748B", text3: "#64748B", indigo: "#6366F1",
  indigoSoft: "#EEF2FF", green: "#10B981", greenSoft: "#ECFDF5",
  amber: "#F59E0B", amberSoft: "#FFFBEB", red: "#EF4444",
  redSoft: "#FEF2F2", shadow: "0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
};

const PLAN_COLOR: Record<string, string> = { starter: "#6366F1", pro: "#10B981", premium: "#F59E0B" };
const PLAN_PRICE: Record<string, number> = { starter: 29, pro: 59, premium: 99 };

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: "#ECFDF5", color: "#059669", label: "Active" },
  trial:     { bg: "#FFFBEB", color: "#D97706", label: "Trial" },
  trialing:  { bg: "#FFFBEB", color: "#D97706", label: "Trialing" },
  past_due:  { bg: "#FEF2F2", color: "#B91C1C", label: "Past Due" },
  cancelled: { bg: "#F1F5F9", color: "#64748B", label: "Cancelled" },
};

// Hardcoded impressive demo stats (real SaaS approach)
const D = {
  mrr: 4847, arr: 58164, active: 47, trial: 12,
  cancelled: 3, totalSalons: 62, totalBookings: 3847, mrrGrowth: 23,
};

const FAKE_USERS = [
  { name: "Curl Up & Dye",       email: "emily@curlupdye.co.uk",      salon: "Curl Up & Dye",       plan: "starter", created: "2026-05-03" },
  { name: "Bliss Beauty Studio", email: "amelia@blissbeauty.co.uk",   salon: "Bliss Beauty Studio",  plan: "starter", created: "2025-11-24" },
  { name: "Snip & Style",        email: "liam@snipandstyle.co.uk",    salon: "Snip & Style",         plan: "starter", created: "2025-09-24" },
  { name: "The Beauty Bar",      email: "isabella@thebeautybar.co.uk",salon: "The Beauty Bar",       plan: "pro",     created: "2025-06-24" },
  { name: "Glam & Go",           email: "sophia@glamandgo.co.uk",     salon: "Glam & Go",            plan: "pro",     created: "2025-03-24" },
  { name: "Shear Perfection",    email: "james@shearperfection.co.uk",salon: "Shear Perfection",     plan: "premium", created: "2024-11-24" },
];

const REV_MONTHS = [
  { m: "Jun", v: 2840 }, { m: "Jul", v: 3120 }, { m: "Aug", v: 3380 },
  { m: "Sep", v: 3290 }, { m: "Oct", v: 3640 }, { m: "Nov", v: 3890 },
  { m: "Dec", v: 4050 }, { m: "Jan", v: 4210 }, { m: "Feb", v: 4380 },
  { m: "Mar", v: 4520 }, { m: "Apr", v: 4690 }, { m: "May", v: 4847 },
];

const FAKE_BOOKINGS: Record<string, number> = {
  "Shear Perfection": 247, "Glam & Go": 189, "The Beauty Bar": 163,
  "Snip & Style": 142, "Curl Up & Dye": 98, "Bliss Beauty Studio": 74,
};

type Tab = "overview" | "salons" | "revenue" | "users";

const NAV: { key: Tab; icon: string; label: string }[] = [
  { key: "overview", icon: "▣", label: "Overview" },
  { key: "salons",   icon: "✂", label: "Salons" },
  { key: "revenue",  icon: "₤", label: "Revenue" },
  { key: "users",    icon: "⊙", label: "Users" },
];

const TAB_TITLE: Record<Tab, string> = {
  overview: "Platform Overview", salons: "Salons",
  revenue: "Revenue & Billing", users: "Users",
};

// ── Shared primitives (same look as /admin) ───────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: T.text3, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap", background: "#FAFBFC" }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "13px 16px", fontSize: 13, color: T.text, verticalAlign: "middle", ...style }}>
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { bg: "#F1F5F9", color: T.text3, label: status };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const c = PLAN_COLOR[plan] ?? T.indigo;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: c + "15", color: c, border: `1px solid ${c}35`, textTransform: "capitalize" }}>
      {plan}
    </span>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size / 3, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ReadOnlyTag() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.5px", marginLeft: 8 }}>
      READ-ONLY
    </span>
  );
}

export default function DemoDashboard() {
  const router = useRouter();
  const [salons, setSalons] = useState<DemoSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/salons")
      .then(r => r.json())
      .then(d => { setSalons(d.salons ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  const mrr = salons.reduce((s, salon) => s + (PLAN_PRICE[salon.subscription_plan ?? salon.plan] ?? 0), 0) || D.mrr;
  const activeCount  = salons.filter(s => s.subscription_status === "active").length || D.active;
  const trialCount   = salons.filter(s => ["trial","trialing"].includes(s.subscription_status)).length || D.trial;
  const planCounts   = { starter: 0, pro: 0, premium: 0 } as Record<string, number>;
  salons.forEach(s => { const p = s.subscription_plan ?? s.plan; if (p in planCounts) planCounts[p]++; });

  const filteredSalons = salons.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  const maxRev = Math.max(...REV_MONTHS.map(r => r.v));

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.nav, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.2)", borderTopColor: T.indigo, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>LOADING</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .nav-item:hover{background:rgba(255,255,255,0.06)!important;color:#fff!important}
        .salon-row:hover td{background:#F8FAFC!important}
        .kpi:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
      `}</style>

      {/* ── Demo banner (purple strip at very top) ── */}
      <div style={{ background: "linear-gradient(90deg,#5B21B6,#4338CA)", padding: "7px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#C4B5FD", letterSpacing: "2px", border: "1px solid rgba(196,181,253,0.4)", padding: "2px 7px", borderRadius: 4 }}>DEMO</span>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>Sample data only — no real client information is shown</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Session expires in 24 hours</span>
        </div>
      </div>

      {/* ── Body (sidebar + main) ── */}
      <div style={{ flex: 1, display: "flex", background: T.bg }}>

        {/* Sidebar — same as real admin */}
        <aside style={{ width: 232, background: T.nav, flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "calc(100vh - 33px)" }}>
          {/* Logo */}
          <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${T.navBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, background: T.indigo, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 800 }}>F</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>feature</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 1 }}>Admin Demo</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
            {NAV.map(item => (
              <div key={item.key} className="nav-item"
                onClick={() => setTab(item.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", color: tab === item.key ? T.navActive : T.navText, background: tab === item.key ? "rgba(99,102,241,0.18)" : "transparent", fontSize: 13.5, fontWeight: tab === item.key ? 600 : 500, position: "relative", transition: "all 0.15s" }}>
                {tab === item.key && (
                  <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: T.indigo, borderRadius: "0 3px 3px 0" }} />
                )}
                <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}

            {/* Disabled nav items (shown greyed out to show depth) */}
            <div style={{ margin: "16px 10px 8px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.15)", letterSpacing: "1.5px", textTransform: "uppercase" }}>RESTRICTED</div>
            {["Announcements", "Feature Flags", "Applications", "Settings"].map(label => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, color: "rgba(255,255,255,0.18)", fontSize: 13.5, fontWeight: 500, cursor: "not-allowed" }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>🔒</span>
                {label}
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div style={{ padding: "14px 10px", borderTop: `1px solid ${T.navBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#7C3AED,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>D</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Demo Guest</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Read-only access</div>
              </div>
              <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 15, padding: 4 }} title="Sign out">⏻</button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Header */}
          <header style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 0 #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: "-0.3px" }}>{TAB_TITLE[tab]}</div>
              <ReadOnlyTag />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>
                Demo Environment
              </div>
            </div>
          </header>

          {/* Tab content */}
          <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div key={tab} style={{ animation: "fadeUp 0.25s ease both" }}>

              {/* ── OVERVIEW ──────────────────────────────── */}
              {tab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* KPI cards — same grid as real admin */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
                    {([
                      { label: "Monthly Revenue",  value: `£${D.mrr.toLocaleString()}`, sub: `ARR £${D.arr.toLocaleString()}`,   accent: T.indigo,  icon: "£" },
                      { label: "Active Salons",     value: D.active,                     sub: "Currently paying",                accent: T.green,   icon: "✓" },
                      { label: "On Trial",          value: trialCount || D.trial,        sub: "Free trial period",               accent: T.amber,   icon: "⏱" },
                      { label: "Cancelled",         value: D.cancelled,                  sub: "Churned accounts",                accent: T.red,     icon: "✕" },
                      { label: "Total Salons",      value: D.totalSalons,                sub: "All time signups",                accent: "#8B5CF6", icon: "✂" },
                      { label: "Total Bookings",    value: D.totalBookings.toLocaleString(), sub: "Across all salons",            accent: "#06B6D4", icon: "✦" },
                    ] as { label: string; value: string | number; sub: string; accent: string; icon: string }[]).map(s => (
                      <div key={s.label} className="kpi" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, boxShadow: T.shadow, transition: "transform 0.2s,box-shadow 0.2s", cursor: "default" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: s.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: s.accent, marginBottom: 12 }}>{s.icon}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.8px", marginBottom: 2 }}>{s.value}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 1 }}>{s.label}</div>
                        <div style={{ fontSize: 11.5, color: T.text3 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts row */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                    {/* Plan distribution */}
                    <Card>
                      <SectionHeader title="Plan Distribution" sub="Salons per pricing tier" />
                      {[
                        { plan: "starter", count: planCounts.starter || 23, total: D.totalSalons },
                        { plan: "pro",     count: planCounts.pro     || 16, total: D.totalSalons },
                        { plan: "premium", count: planCounts.premium  || 8,  total: D.totalSalons },
                      ].map(({ plan, count, total }) => {
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={plan} style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 13, color: T.text, fontWeight: 500, textTransform: "capitalize" }}>{plan}</span>
                              <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>{count} salons · {pct}%</span>
                            </div>
                            <div style={{ height: 6, background: T.bg, borderRadius: 3 }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: PLAN_COLOR[plan], transition: "width 0.6s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </Card>

                    {/* Recent signups */}
                    <Card>
                      <SectionHeader title="Recent Signups" sub="Latest 5 salons" />
                      {salons.slice(0, 5).map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={s.name} size={30} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name}</div>
                              <div style={{ fontSize: 11, color: T.text3 }}>{s.owner_email}</div>
                            </div>
                          </div>
                          <StatusPill status={s.subscription_status} />
                        </div>
                      ))}
                    </Card>
                  </div>

                  {/* Revenue trend */}
                  <Card>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <SectionHeader title="Monthly Recurring Revenue" sub="12-month trend · Jun 2025 – May 2026" />
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>£4,847</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.green, background: T.greenSoft, padding: "2px 8px", borderRadius: 99 }}>↑ +23% MoM</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 110 }}>
                      {REV_MONTHS.map((r, i) => {
                        const h = Math.round((r.v / maxRev) * 95);
                        const isLast = i === REV_MONTHS.length - 1;
                        return (
                          <div key={r.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                            {isLast && (
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: T.indigo }}>£{(r.v/1000).toFixed(1)}k</div>
                            )}
                            <div style={{ width: "100%", height: `${h}px`, borderRadius: "5px 5px 0 0", background: isLast ? `linear-gradient(180deg,${T.indigo},#4338CA)` : T.indigoSoft, transition: "height 0.6s ease", marginTop: isLast ? 0 : "auto" }} />
                            <div style={{ fontSize: 9.5, color: isLast ? T.indigo : T.text3, fontWeight: isLast ? 700 : 400 }}>{r.m}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 28, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                      {[{ label: "12M Growth", val: "+70.7%" }, { label: "Best Month", val: "May 2026" }, { label: "Avg Monthly", val: "£3,905" }, { label: "NRR", val: "118%" }].map(m => (
                        <div key={m.label}>
                          <div style={{ fontSize: 10.5, color: T.text3, marginBottom: 2 }}>{m.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* ── SALONS ────────────────────────────────── */}
              {tab === "salons" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>{filteredSalons.length} salons · demo data</div>
                    <input
                      type="text" placeholder="Search by name or email…"
                      value={search} onChange={e => setSearch(e.target.value)}
                      style={{ height: 36, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.text, background: T.surface, width: 240, outline: "none" }}
                    />
                  </div>
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>{["Salon", "Owner", "Plan", "Status", "Bookings", "Location", "Last Active", "Joined"].map(h => <Th key={h}>{h}</Th>)}</tr>
                        </thead>
                        <tbody>
                          {filteredSalons.map(s => (
                            <tr key={s.id} className="salon-row">
                              <Td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar name={s.name} size={32} />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name}</div>
                                    <div style={{ fontSize: 11, color: T.text3 }}>{s.slug}</div>
                                  </div>
                                </div>
                              </Td>
                              <Td style={{ color: T.text2 }}>{s.owner_email}</Td>
                              <Td><PlanPill plan={s.subscription_plan ?? s.plan} /></Td>
                              <Td><StatusPill status={s.subscription_status} /></Td>
                              <Td style={{ fontWeight: 700 }}>{FAKE_BOOKINGS[s.name] ?? 50}</Td>
                              <Td style={{ color: T.text2 }}>{s.last_city ? `${s.last_city}, UK` : "—"}</Td>
                              <Td style={{ color: T.text3 }}>
                                {s.last_login_at ? (() => {
                                  const m = Math.floor((Date.now() - new Date(s.last_login_at).getTime()) / 60000);
                                  if (m < 60) return `${m}m ago`;
                                  if (m < 1440) return `${Math.floor(m/60)}h ago`;
                                  return `${Math.floor(m/1440)}d ago`;
                                })() : "Never"}
                              </Td>
                              <Td style={{ color: T.text3 }}>
                                {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {/* ── REVENUE ───────────────────────────────── */}
              {tab === "revenue" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                    {[
                      { label: "Active Paying",    value: `${D.active}`,            sub: "Salons paying now",     accent: T.amber },
                      { label: "Monthly Revenue",  value: `£${D.mrr.toLocaleString()}`, sub: "Total MRR",        accent: T.indigo },
                      { label: "Annual Run Rate",  value: `£${D.arr.toLocaleString()}`, sub: "Projected ARR",    accent: "#8B5CF6" },
                    ].map(s => (
                      <div key={s.label} className="kpi" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, boxShadow: T.shadow, transition: "transform 0.2s,box-shadow 0.2s" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: s.accent, letterSpacing: "-1px", marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.label}</div>
                        <div style={{ fontSize: 11.5, color: T.text3 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  <Card>
                    <SectionHeader title="Revenue by Plan" sub="Active subscriptions breakdown" />
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>{["Plan", "Salons", "Monthly Rev", "Annual Rev", "Avg Tenure"].map(h => <Th key={h}>{h}</Th>)}</tr>
                        </thead>
                        <tbody>
                          {[
                            { plan: "premium", salons: 8,  monthly: 792,  annual: 9504,  tenure: "14 months" },
                            { plan: "pro",     salons: 16, monthly: 944,  annual: 11328, tenure: "8 months" },
                            { plan: "starter", salons: 23, monthly: 667,  annual: 8004,  tenure: "5 months" },
                          ].map(r => (
                            <tr key={r.plan} className="salon-row">
                              <Td><PlanPill plan={r.plan} /></Td>
                              <Td style={{ fontWeight: 600 }}>{r.salons}</Td>
                              <Td style={{ fontWeight: 700, color: T.indigo }}>£{r.monthly.toLocaleString()}</Td>
                              <Td style={{ fontWeight: 700, color: "#8B5CF6" }}>£{r.annual.toLocaleString()}</Td>
                              <Td style={{ color: T.text2 }}>{r.tenure}</Td>
                            </tr>
                          ))}
                          <tr style={{ background: "#F8FAFC" }}>
                            <Td style={{ fontWeight: 800 }}>Total</Td>
                            <Td style={{ fontWeight: 800 }}>47</Td>
                            <Td style={{ fontWeight: 800, color: T.indigo }}>£{D.mrr.toLocaleString()}</Td>
                            <Td style={{ fontWeight: 800, color: "#8B5CF6" }}>£{D.arr.toLocaleString()}</Td>
                            <Td style={{ color: T.text2 }}>—</Td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Card>
                      <SectionHeader title="Growth Metrics" sub="Month-on-month" />
                      {[
                        { label: "New MRR",       value: "+£522",  color: T.green,  sub: "9 new salons" },
                        { label: "Expansion MRR", value: "+£177",  color: T.indigo, sub: "3 upgrades" },
                        { label: "Churned MRR",   value: "−£29",   color: T.red,    sub: "1 cancellation" },
                        { label: "Net New MRR",   value: "+£670",  color: T.amber,  sub: "Net growth" },
                      ].map((m, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.label}</div>
                            <div style={{ fontSize: 11, color: T.text3 }}>{m.sub}</div>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </Card>

                    <Card>
                      <SectionHeader title="Upcoming Renewals" sub="Next 30 days" />
                      {[
                        { name: "Shear Perfection", plan: "premium", date: "3 Jun 2026", val: "£99" },
                        { name: "Snip & Style",     plan: "starter", date: "7 Jun 2026", val: "£29" },
                        { name: "Glam & Go",        plan: "pro",     date: "18 Jun 2026", val: "£59" },
                        { name: "The Beauty Bar",   plan: "pro",     date: "24 Jun 2026", val: "£59" },
                      ].map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: T.text3 }}>{r.date}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <PlanPill plan={r.plan} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.indigo }}>{r.val}</span>
                          </div>
                        </div>
                      ))}
                    </Card>
                  </div>
                </div>
              )}

              {/* ── USERS ─────────────────────────────────── */}
              {tab === "users" && (
                <div>
                  <div style={{ marginBottom: 16, fontSize: 13, color: T.text2, fontWeight: 500 }}>{FAKE_USERS.length} users</div>
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>{["User", "Email", "Salon", "Plan", "Bookings", "Member Since"].map(h => <Th key={h}>{h}</Th>)}</tr>
                        </thead>
                        <tbody>
                          {FAKE_USERS.map((u, i) => (
                            <tr key={i} className="salon-row">
                              <Td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Avatar name={u.name} size={32} />
                                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{u.name.split(" ")[0]}</div>
                                </div>
                              </Td>
                              <Td style={{ color: T.text2 }}>{u.email}</Td>
                              <Td style={{ fontWeight: 500 }}>{u.salon}</Td>
                              <Td><PlanPill plan={u.plan} /></Td>
                              <Td style={{ fontWeight: 700 }}>{FAKE_BOOKINGS[u.salon] ?? 50}</Td>
                              <Td style={{ color: T.text3 }}>
                                {new Date(u.created).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
