"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import EmptyState from "../components/EmptyState";
import StatCard from "../components/StatCard";

/* A row from the real `payments` table (written by the Stripe webhook),
   joined to its appointment purely to recover the client's name and to
   scope the query to this salon — `payments` itself carries no salon_id. */
type PaymentRow = {
  id: string;
  amount: number;
  currency: string | null;
  status: string;                 // 'succeeded' | 'failed' | 'refunded'
  deposit_only: boolean | null;
  created_at: string;
  appointment_id: string | null;
  appointments?: { client_name: string | null; salon_id: string } | null;
};

type Balance = { amount: number; currency: string };
type Payout  = { id: string; amount: number; currency: string; status: string; arrival_date: number; description?: string | null };
type StripeStatus = {
  connected?: boolean;
  balance?: { available: Balance[]; pending: Balance[] };
  payouts?: Payout[];
};

const PAGE_SIZE = 8;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const money = (n: number, ccy = "gbp") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: (ccy || "gbp").toUpperCase(), maximumFractionDigits: 2 }).format(n);

/* Status pill — semantic, and only for statuses the data can actually hold. */
function PaymentPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string; label: string }> = {
    succeeded: { bg: "rgba(16,185,129,0.10)", color: "#047857", border: "rgba(16,185,129,0.25)", dot: "#10B981", label: "Paid" },
    failed:    { bg: "rgba(239,68,68,0.10)",  color: "#B91C1C", border: "rgba(239,68,68,0.25)",  dot: "#EF4444", label: "Failed" },
    refunded:  { bg: "rgba(245,158,11,0.12)", color: "#B45309", border: "rgba(245,158,11,0.25)", dot: "#F59E0B", label: "Refunded" },
  };
  const s = map[status] || { bg: "#F5F3FF", color: "#524D60", border: "#ECE9F1", dot: "#6B6577", label: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />{s.label}
    </span>
  );
}

/* Initials avatar — no photo field exists on a payment or an appointment. */
const AVATAR_COLORS = ["#7C3AED", "#6D28D9", "#8B5CF6", "#A78BFA", "#EC4899"];
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

/* Last 7 days of REAL succeeded payments, bucketed by created_at. */
function RevenueBars({ payments }: { payments: PaymentRow[] }) {
  const bars = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const total = payments
        .filter(p => p.status === "succeeded" && new Date(p.created_at).toDateString() === d.toDateString())
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return { label: DAYS[(d.getDay() + 6) % 7], total, isToday: d.toDateString() === now.toDateString() };
    });
  }, [payments]);
  const max = Math.max(...bars.map(b => b.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96, paddingTop: 10 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div title={money(b.total)} style={{ width: "100%", borderRadius: "6px 6px 0 0", height: `${Math.max((b.total / max) * 74, 4)}px`, background: b.total === max && b.total > 0 ? "linear-gradient(180deg,#ac7bff,#7440dd)" : "#e9e1f6", transition: "height 0.3s ease" }} />
          <span style={{ fontSize: 9.5, color: b.isToday ? "#6D28D9" : "#6B6577", fontWeight: b.isToday ? 700 : 500 }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [salonName, setSalonName] = useState("");

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: salonData } = await supabase.from("salons").select("id,name").eq("owner_id", user.id).single();
      if (salonData) {
        setSalonName(salonData.name || "");
        /* Real payments, scoped to this salon through the appointment join
           (the payments table has no salon_id of its own). */
        const { data: pays } = await supabase
          .from("payments")
          .select("id, amount, currency, status, deposit_only, created_at, appointment_id, appointments!inner(client_name, salon_id)")
          .eq("appointments.salon_id", salonData.id)
          .order("created_at", { ascending: false });
        setPayments((pays || []) as unknown as PaymentRow[]);

        /* Live Stripe balance + payouts — same route the earnings page uses. */
        const token = await getToken();
        if (token) {
          const res = await fetch("/api/stripe-connect/status", { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) setStripe(await res.json());
        }
      }
      setLoading(false);
    };
    loadData();
  }, [router, getToken]);

  /* ── Real derived totals (from payments, not booking values) ── */
  const grossRevenue = useMemo(() => payments.filter(p => p.status === "succeeded").reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const refunds      = useMemo(() => payments.filter(p => p.status === "refunded").reduce((s, p) => s + Number(p.amount || 0), 0), [payments]);
  const succeededCount = payments.filter(p => p.status === "succeeded").length;
  const refundCount    = payments.filter(p => p.status === "refunded").length;

  const available = stripe?.balance?.available?.[0]?.amount ?? null;
  const pendingBal = stripe?.balance?.pending?.[0]?.amount ?? null;
  const balanceCcy = stripe?.balance?.available?.[0]?.currency || "gbp";

  /* Only a genuinely pending Stripe payout, with its real arrival_date.
     No projection — when there isn't one, the card is not rendered. */
  const nextPayout = useMemo(() => (stripe?.payouts || []).find(p => p.status === "pending" || p.status === "in_transit") || null, [stripe]);

  const filtered = useMemo(() => payments.filter(p => {
    const matchTab =
      activeTab === "All" ? true :
      activeTab === "Paid" ? p.status === "succeeded" :
      activeTab === "Failed" ? p.status === "failed" :
      p.status === "refunded";
    const name = p.appointments?.client_name || "";
    const matchSearch = search === "" || name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  }), [payments, activeTab, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const paged = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px" }}>Payments</div>
          <div style={{ fontSize: 11, color: "#6B6577", marginTop: 1 }}>{payments.length} payment{payments.length === 1 ? "" : "s"} recorded</div>
        </div>
      </div>
    </header>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <style>{`
        .pay-row:hover { background: #FAF9FC; }
        .pay-tab { padding: 6px 13px; border-radius: 8px; border: none; background: transparent; color: #524D60; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.14s; font-family: var(--font); }
        .pay-tab:hover { color: #12101A; }
        .pay-tab.active { background: #EDE9FF; color: #6D28D9; font-weight: 700; }
      `}</style>
      <div style={{ padding: "24px 20px 40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── 1. Stat cards — every figure from real data ── */}
        <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 22 }}>
          <StatCard label="Gross revenue" value={grossRevenue.toFixed(2)} icon="💷" color="green" prefix="£"
            sub={`${succeededCount} successful payment${succeededCount === 1 ? "" : "s"}`} />
          <StatCard label="Available balance" value={available === null ? "—" : available.toFixed(2)} icon="🏦" color="indigo"
            prefix={available === null ? undefined : "£"}
            sub={available === null ? "Stripe not connected" : `ready to pay out (${balanceCcy.toUpperCase()})`} />
          <StatCard label="Pending balance" value={pendingBal === null ? "—" : pendingBal.toFixed(2)} icon="⏳" color="amber"
            prefix={pendingBal === null ? undefined : "£"}
            sub={pendingBal === null ? "Stripe not connected" : "clearing with Stripe"} />
          <StatCard label="Refunds" value={refunds.toFixed(2)} icon="↩️" color="red" prefix="£"
            sub={`${refundCount} refund${refundCount === 1 ? "" : "s"}`} />
        </div>

        {/* ── 2. Revenue overview — real succeeded payments by day ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, padding: "18px 20px", marginBottom: 22, boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Revenue overview</div>
            <div style={{ fontSize: 10, color: "#6B6577" }}>Last 7 days · successful payments only</div>
          </div>
          <RevenueBars payments={payments} />
        </div>

        {/* ── 3. Next payout — only when Stripe reports a real pending one ── */}
        {nextPayout && (
          <div style={{ background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 14, padding: "16px 20px", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>Next automatic payout</div>
              <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 3 }}>
                Arrives {new Date(nextPayout.arrival_date * 1000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                {" · "}{nextPayout.status.replace("_", " ")}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#12101A", letterSpacing: "-0.5px" }}>
              {money(nextPayout.amount, nextPayout.currency)}
            </div>
          </div>
        )}

        {/* ── 4. Transactions ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #eeecf2", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Transactions</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 2, background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 10, padding: 3 }}>
                {["All", "Paid", "Failed", "Refunded"].map(t => (
                  <button key={t} onClick={() => { setActiveTab(t); setPage(0); }} className={`pay-tab${activeTab === t ? " active" : ""}`}>{t}</button>
                ))}
              </div>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search client…"
                style={{ padding: "8px 12px", background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 12.5, color: "#12101A", outline: "none", minWidth: 150, fontFamily: "var(--font)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.boxShadow = "none"; }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="💳" title={payments.length === 0 ? "No payments yet" : "No matching payments"}
              description={payments.length === 0 ? "Payments appear here once clients pay online through Stripe" : "Try a different filter or search term"} />
          ) : (
            <>
              {paged.map(p => {
                const name = p.appointments?.client_name?.trim() || "Unknown client";
                return (
                  <div key={p.id} className="pay-row" style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 20px", borderTop: "1px solid #eeecf2", transition: "background 0.14s" }}>
                    <Avatar name={name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 2 }}>
                        {p.deposit_only ? "Deposit" : "Payment"} · {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px", flexShrink: 0 }}>
                      {money(Number(p.amount || 0), p.currency || "gbp")}
                    </div>
                    <PaymentPill status={p.status} />
                  </div>
                );
              })}

              {pageCount > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderTop: "1px solid #eeecf2", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11.5, color: "#6B6577" }}>
                    Showing {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}
                      style={{ padding: "7px 14px", background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 12, fontWeight: 700, color: pageSafe === 0 ? "#D6D1DE" : "#524D60", cursor: pageSafe === 0 ? "default" : "pointer" }}>Previous</button>
                    <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={pageSafe >= pageCount - 1}
                      style={{ padding: "7px 14px", background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 12, fontWeight: 700, color: pageSafe >= pageCount - 1 ? "#D6D1DE" : "#524D60", cursor: pageSafe >= pageCount - 1 ? "default" : "pointer" }}>Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
