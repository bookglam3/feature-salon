"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import StatCard from "../components/StatCard";
import { resolveAppointmentServices, type ResolvedAppointmentServices } from "../../lib/appointmentServices";

type Appt = { id: string; client_name: string; status: string; date_time: string; services?: { name: string; price: number } | null; staff?: { name: string } | null };

export default function PaymentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [serviceDisplay, setServiceDisplay] = useState<Map<string, ResolvedAppointmentServices>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [salonName, setSalonName] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: salonData } = await supabase.from("salons").select("id,name").eq("owner_id", user.id).single();
      if (salonData) {
        setSalonName(salonData.name || "");
        const { data: appts } = await supabase.from("appointments")
          .select("*, services(name, price), staff(name)")
          .eq("salon_id", salonData.id)
          .order("date_time", { ascending: false });
        setAppointments(appts || []);
        setServiceDisplay(await resolveAppointmentServices(supabase, appts || []));
      }
      setLoading(false);
    };
    loadData();
  }, [router]);

  const totalCollected = appointments.filter(a => a.status === "confirmed").reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
  const pending       = appointments.filter(a => a.status === "pending").reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
  const refunded      = appointments.filter(a => a.status === "cancelled").reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);

  const filtered = appointments.filter(a => {
    const matchTab = activeTab === "All" ? true : activeTab === "Paid" ? a.status === "confirmed" : activeTab === "Pending" ? a.status === "pending" : a.status === "cancelled";
    const matchSearch = search === "" || a.client_name?.toLowerCase().includes(search.toLowerCase()) || serviceDisplay.get(a.id)?.serviceName?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const statusStyle = (s: string) =>
    s === "confirmed" ? { bg: "rgba(16,185,129,0.10)", color: "#10B981", border: "rgba(16,185,129,0.25)", dot: "#10B981" }
    : s === "cancelled" ? { bg: "rgba(239,68,68,0.10)", color: "#DC2626", border: "rgba(239,68,68,0.25)", dot: "#EF4444" }
    : { bg: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "rgba(245,158,11,0.25)", dot: "#F59E0B" };

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.4px" }}>Payments</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{appointments.length} transactions total</div>
        </div>
      </div>
    </header>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "20px 20px 32px" }}>

        {/* Stats */}
        <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label="Total Collected" value={Math.round(totalCollected)} icon="💳" color="green" prefix="£" sub={`${appointments.filter(a => a.status === "confirmed").length} payments`} />
          <StatCard label="Pending" value={Math.round(pending)} icon="⏳" color="amber" prefix="£" sub={`${appointments.filter(a => a.status === "pending").length} unpaid`} />
          <StatCard label="Refunded" value={Math.round(refunded)} icon="↩️" color="red" prefix="£" sub={`${appointments.filter(a => a.status === "cancelled").length} refunds`} />
          <StatCard label="All Transactions" value={appointments.length} icon="📋" color="indigo" sub="total records" />
        </div>

        {/* Table card */}
        <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
          {/* Toolbar */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #2a3350", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", background: "#FAFBFF" }}>
            <div style={{ display: "flex", gap: 2, background: "#2a3350", borderRadius: 10, padding: 3 }}>
              {["All","Paid","Pending","Cancelled"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, border: "none", background: activeTab === tab ? "#fff" : "transparent", color: activeTab === tab ? "#C9A24B" : "var(--text-3)", cursor: "pointer", fontWeight: activeTab === tab ? 700 : 500, boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.07)" : "none", transition: "all 0.12s", fontFamily: "var(--font)" }}>{tab}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 10, padding: "7px 12px", minWidth: 180 }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = "#C9A24B"; e.currentTarget.style.background = "#1C2438"; }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = "#2a3350"; e.currentTarget.style.background = "#141A2E"; }}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.75" stroke="#94A3B8" strokeWidth="1.75"/><path d="M13 13L17 17" stroke="#94A3B8" strokeWidth="1.75" strokeLinecap="round"/></svg>
              <input type="text" placeholder="Search client, service…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-1)", fontFamily: "var(--font)", width: "100%" }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>No payments found</div>
              <div style={{ fontSize: 13, color: "var(--text-3)" }}>Payments appear here once bookings are created</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr style={{ background: "#141A2E" }}>
                    {["Status","Client","Service","Staff","Date","Amount"].map(h => (
                      <th key={h} style={{ fontSize: 10.5, color: "var(--text-3)", textAlign: "left", padding: "11px 18px", fontWeight: 800, borderBottom: "1.5px solid #2a3350", letterSpacing: "0.7px", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => {
                    const sc = statusStyle(a.status);
                    return (
                      <tr key={a.id}
                        style={{ transition: "background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FAFBFF"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <td style={{ padding: "13px 18px", borderBottom: "1px solid #2a3350" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: 10.5, padding: "3px 10px", borderRadius: 99, fontWeight: 700 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", borderBottom: "1px solid #2a3350" }}>{a.client_name}</td>
                        <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-2)", borderBottom: "1px solid #2a3350" }}>{serviceDisplay.get(a.id)?.serviceName || "—"}</td>
                        <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-3)", borderBottom: "1px solid #2a3350" }}>{a.staff?.name || "—"}</td>
                        <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--text-2)", borderBottom: "1px solid #2a3350" }}>{new Date(a.date_time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 900, color: a.status === "confirmed" ? "#10B981" : "var(--text-1)", borderBottom: "1px solid #2a3350" }}>
                          £{(serviceDisplay.get(a.id)?.combinedPrice ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}  