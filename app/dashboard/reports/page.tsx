"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import FeatureGate from "../components/FeatureGate";
import { resolveAppointmentServices, type ResolvedAppointmentServices } from "@/app/lib/appointmentServices";

interface Appointment {
  id: string;
  client_name: string;
  date_time: string;
  status: string;
  services?: { name: string; price: number } | null;
  staff?: { name: string } | null;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function BarChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#aab1c4", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
        {data.map((val, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div title={`£${val}`}
              style={{ width: "100%", borderRadius: "5px 5px 0 0", height: `${Math.max((val / max) * 100, 4)}px`, background: `linear-gradient(180deg,${color},${color}99)`, transition: "all 0.4s ease", cursor: "default", position: "relative" }}
              onMouseEnter={e => {
                const tip = document.createElement("div");
                tip.id = "chart-tip";
                tip.style.cssText = `position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#F7F5EF;color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;`;
                tip.textContent = `£${val}`;
                e.currentTarget.appendChild(tip);
              }}
              onMouseLeave={() => { document.getElementById("chart-tip")?.remove(); }}
            />
            <span style={{ fontSize: 9.5, color: "#aab1c4", fontWeight: 600 }}>{MONTHS[i % 12]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 18, padding: "22px 20px", position: "relative", overflow: "hidden", transition: "all 0.18s", cursor: "default" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 12px 32px ${color}20`; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = `${color}40`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#2a3350"; }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${color},${color}66)`, borderRadius: "18px 18px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#aab1c4", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#F7F5EF", letterSpacing: "-1px", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function ReportsContent() {
  const router = useRouter();
  const [salonName, setSalonName] = useState("");
  const [appointments, setAppts] = useState<Appointment[]>([]);
  const [serviceDisplay, setServiceDisplay] = useState<Map<string, ResolvedAppointmentServices>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonName(profile.salon.name);
      const { data } = await supabase
        .from("appointments")
        .select("*, services(name,price), staff(name)")
        .eq("salon_id", profile.salon.id)
        .order("date_time", { ascending: true });
      setAppts(data || []);
      setServiceDisplay(await resolveAppointmentServices(supabase, data || []));
      setLoading(false);
    };
    load();
  }, [router]);

  const confirmed = useMemo(() => appointments.filter(a => a.status === "confirmed"), [appointments]);

  // Revenue by month (last 12 months)
  const monthlyRevenue = useMemo(() => {
    const n = new Date();
    return Array.from({ length: 12 }, (_, idx) => {
      const mo = (n.getMonth() - 11 + idx + 12) % 12;
      const yr = n.getFullYear() - (n.getMonth() - 11 + idx < 0 ? 1 : 0);
      return confirmed.filter(a => {
        const d = new Date(a.date_time);
        return d.getMonth() === mo && d.getFullYear() === yr;
      }).reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
    });
  }, [confirmed, serviceDisplay]);

  // Bookings by month (last 12)
  const monthlyBookings = useMemo(() => {
    const n = new Date();
    return Array.from({ length: 12 }, (_, idx) => {
      const mo = (n.getMonth() - 11 + idx + 12) % 12;
      const yr = n.getFullYear() - (n.getMonth() - 11 + idx < 0 ? 1 : 0);
      return appointments.filter(a => {
        const d = new Date(a.date_time);
        return d.getMonth() === mo && d.getFullYear() === yr;
      }).length;
    });
  }, [appointments]);

  // Stats
  const totalRevenue = useMemo(() => confirmed.reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0), [confirmed, serviceDisplay]);
  const thisMonthRevenue = useMemo(() => {
    const n = new Date();
    return confirmed.filter(a => {
      const d = new Date(a.date_time);
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
  }, [confirmed, serviceDisplay]);
  const avgOrderValue = useMemo(() => confirmed.length ? (totalRevenue / confirmed.length).toFixed(2) : "0.00", [totalRevenue, confirmed]);

  // Top services — per-line-item breakdown: a multi-service booking
  // attributes its count/revenue to EACH of its real services, not one
  // combined-name bucket (that would undercount every service but the
  // first, and invent phantom "A, B, C" buckets).
  const topServices = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    confirmed.forEach(a => {
      const lines = serviceDisplay.get(a.id)?.lines;
      const items = lines && lines.length > 0 ? lines : [{ name: "Unknown", price: 0 }];
      items.forEach(item => {
        const name = item.name || "Unknown";
        if (!map[name]) map[name] = { count: 0, revenue: 0 };
        map[name].count++;
        map[name].revenue += item.price || 0;
      });
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  }, [confirmed, serviceDisplay]);

  // Top staff
  const topStaff = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    confirmed.forEach(a => {
      const name = a.staff?.name || "Unassigned";
      if (!map[name]) map[name] = { count: 0, revenue: 0 };
      map[name].count++;
      map[name].revenue += serviceDisplay.get(a.id)?.combinedPrice ?? 0;
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  }, [confirmed, serviceDisplay]);

  // Peak hours
  const peakHours = useMemo(() => {
    const map: Record<number, number> = {};
    appointments.forEach(a => {
      const h = new Date(a.date_time).getHours();
      map[h] = (map[h] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [appointments]);

  // Conversion rate
  const conversionRate = useMemo(() => {
    if (!appointments.length) return "0";
    return ((confirmed.length / appointments.length) * 100).toFixed(1);
  }, [appointments, confirmed]);

  const Topbar = (
    <header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF", letterSpacing: "-0.4px" }}>📊 Revenue Analytics</div>
          <div style={{ fontSize: 11.5, color: "#aab1c4", marginTop: 1 }}>Track your business growth</div>
        </div>
      </div>
      <button
        onClick={() => {
          const rows = [["Month", "Revenue", "Bookings"]];
          const labels = Array.from({ length: 12 }, (_, idx) => MONTHS[(new Date().getMonth() - 11 + idx + 12) % 12]);
          labels.forEach((l, idx) => rows.push([l, `£${monthlyRevenue[idx]}`, String(monthlyBookings[idx])]));
          const csv = rows.map(r => r.join(",")).join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = "revenue-report.csv"; a.click();
        }}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "linear-gradient(135deg,#C9A24B,#0E1320)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(201,162,75,0.3)" }}>
        📥 Export CSV
      </button>
    </header>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: 40, textAlign: "center", color: "#aab1c4" }}>Loading analytics…</div>
    </DashboardShell>
  );

  const COLORS = ["#C9A24B", "#10B981", "#F59E0B", "#EC4899", "#E7C878"];

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 28 }}>
          <StatCard icon="💰" label="Total Revenue" value={`£${totalRevenue}`} sub="All confirmed bookings" color="#10B981" />
          <StatCard icon="📅" label="This Month" value={`£${thisMonthRevenue}`} sub={new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} color="#C9A24B" />
          <StatCard icon="🧾" label="Avg. Order Value" value={`£${avgOrderValue}`} sub="Per confirmed booking" color="#F59E0B" />
          <StatCard icon="✅" label="Conversion Rate" value={`${conversionRate}%`} sub="Confirmed vs total" color="#EC4899" />
          <StatCard icon="📋" label="Total Bookings" value={String(appointments.length)} sub={`${confirmed.length} confirmed`} color="#E7C878" />
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <BarChart data={monthlyRevenue} color="#C9A24B" label="Monthly Revenue (Last 12 Months)" />
          </div>
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <BarChart data={monthlyBookings} color="#10B981" label="Monthly Bookings (Last 12 Months)" />
          </div>
        </div>

        {/* Top Services + Top Staff */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
          {/* Top Services */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3350" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>🏆 Top Services</div>
              <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 2 }}>By revenue generated</div>
            </div>
            <div style={{ padding: 16 }}>
              {topServices.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#aab1c4" }}>No data yet</div>
                : topServices.map(([name, data], i) => {
                  const maxRev = topServices[0][1].revenue || 1;
                  return (
                    <div key={name} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F7F5EF", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: `${COLORS[i]}20`, color: COLORS[i], fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                          {name}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>£{data.revenue}</div>
                          <div style={{ fontSize: 10.5, color: "#aab1c4" }}>{data.count} bookings</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: "#2a3350", borderRadius: 99 }}>
                        <div style={{ height: "100%", borderRadius: 99, background: COLORS[i], width: `${(data.revenue / maxRev) * 100}%`, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Top Staff */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3350" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>✂️ Staff Performance</div>
              <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 2 }}>By revenue generated</div>
            </div>
            <div style={{ padding: 16 }}>
              {topStaff.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#aab1c4" }}>No data yet</div>
                : topStaff.map(([name, data], i) => {
                  const maxRev = topStaff[0][1].revenue || 1;
                  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 11, background: COLORS[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F7F5EF" }}>{name}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>£{data.revenue}</div>
                        </div>
                        <div style={{ height: 6, background: "#2a3350", borderRadius: 99 }}>
                          <div style={{ height: "100%", borderRadius: 99, background: COLORS[i], width: `${(data.revenue / maxRev) * 100}%`, transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: "#aab1c4", marginTop: 3 }}>{data.count} bookings</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Peak Hours + Status breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Peak Hours */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3350" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>⏰ Peak Hours</div>
              <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 2 }}>Busiest times of day</div>
            </div>
            <div style={{ padding: 16 }}>
              {peakHours.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#aab1c4" }}>No data yet</div>
                : peakHours.map(([hour, count]) => {
                  const maxCount = parseInt(peakHours[0][1] as unknown as string) || 1;
                  const hNum = parseInt(hour);
                  const label = `${hNum}:00 – ${hNum + 1}:00`;
                  return (
                    <div key={hour} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 80, fontSize: 12.5, fontWeight: 700, color: "#aab1c4", flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, height: 8, background: "#2a3350", borderRadius: 99 }}>
                        <div style={{ height: "100%", borderRadius: 99, background: "#C9A24B", width: `${(count / maxCount) * 100}%`, transition: "width 0.6s ease" }} />
                      </div>
                      <div style={{ width: 28, fontSize: 12.5, fontWeight: 800, color: "#C9A24B", textAlign: "right" }}>{count}</div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Status breakdown */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3350" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>📋 Booking Status</div>
              <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 2 }}>Overview of all bookings</div>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Confirmed", count: appointments.filter(a => a.status === "confirmed").length, color: "#10B981", bg: "rgba(16,185,129,0.10)" },
                { label: "Pending",   count: appointments.filter(a => a.status === "pending").length,   color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
                { label: "Cancelled", count: appointments.filter(a => a.status === "cancelled").length, color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
              ].map(s => {
                const pct = appointments.length ? (s.count / appointments.length) * 100 : 0;
                return (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#F7F5EF" }}>{s.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 99, background: s.bg, color: s.color }}>{s.count}</span>
                        <span style={{ fontSize: 12, color: "#aab1c4" }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: "#2a3350", borderRadius: 99 }}>
                      <div style={{ height: "100%", borderRadius: 99, background: s.color, width: `${pct}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}

export default function ReportsPage() {
  return (
    <FeatureGate feature="analytics_basic">
      <ReportsContent />
    </FeatureGate>
  );
}