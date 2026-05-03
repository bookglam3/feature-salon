"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  // Stats
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalRevenue: 0,
    totalClients: 0,
    newClients: 0,
  });

  // Chart data
  const [bookingsByDay, setBookingsByDay] = useState<{ label: string; count: number }[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<{ label: string; amount: number }[]>([]);
  const [topServices, setTopServices] = useState<{ name: string; count: number }[]>([]);
  const [topStaff, setTopStaff] = useState<{ name: string; count: number }[]>([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }
        setSalon(profile.salon);
        await fetchReports(profile.salon.id, period);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router, period]);

  const fetchReports = async (salonId: string, days: string) => {
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days));
    const fromISO = from.toISOString();

    // Bookings
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("salon_id", salonId)
      .gte("created_at", fromISO);

    const all = bookings || [];
    const completed = all.filter((b) => b.status === "completed");
    const cancelled = all.filter((b) => b.status === "cancelled");
    const revenue = completed.reduce((sum, b) => sum + (b.price || 0), 0);

    // Clients
    const { count: totalClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salonId);

    const { count: newClients } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .gte("created_at", fromISO);

    setStats({
      totalBookings: all.length,
      completedBookings: completed.length,
      cancelledBookings: cancelled.length,
      totalRevenue: revenue,
      totalClients: totalClients || 0,
      newClients: newClients || 0,
    });

    // Bookings by day (last N days)
    const dayMap: Record<string, number> = {};
    const revenueMap: Record<string, number> = {};
    const numDays = parseInt(days);
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[key] = 0;
      revenueMap[key] = 0;
    }
    all.forEach((b) => {
      const key = new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dayMap[key] !== undefined) dayMap[key]++;
      if (b.status === "completed" && revenueMap[key] !== undefined) {
        revenueMap[key] += b.price || 0;
      }
    });

    // For 30/90 days group by week
    if (numDays > 14) {
      const weekBookings: Record<string, number> = {};
      const weekRevenue: Record<string, number> = {};
      Object.entries(dayMap).forEach(([label, count], i) => {
        const weekLabel = `Week ${Math.floor(i / 7) + 1}`;
        weekBookings[weekLabel] = (weekBookings[weekLabel] || 0) + count;
        weekRevenue[weekLabel] = (weekRevenue[weekLabel] || 0) + (revenueMap[label] || 0);
      });
      setBookingsByDay(Object.entries(weekBookings).map(([label, count]) => ({ label, count })));
      setRevenueByDay(Object.entries(weekRevenue).map(([label, amount]) => ({ label, amount })));
    } else {
      setBookingsByDay(Object.entries(dayMap).map(([label, count]) => ({ label, count })));
      setRevenueByDay(Object.entries(revenueMap).map(([label, amount]) => ({ label, amount })));
    }

    // Top services
    const serviceCount: Record<string, number> = {};
    all.forEach((b) => {
      if (b.service_name) serviceCount[b.service_name] = (serviceCount[b.service_name] || 0) + 1;
    });
    setTopServices(
      Object.entries(serviceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    );

    // Top staff
    const staffCount: Record<string, number> = {};
    all.forEach((b) => {
      if (b.staff_name) staffCount[b.staff_name] = (staffCount[b.staff_name] || 0) + 1;
    });
    setTopStaff(
      Object.entries(staffCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    );
  };

  // Simple bar chart renderer
  const BarChart = ({ data, valueKey, color }: { data: any[]; valueKey: string; color: string }) => {
    const max = Math.max(...data.map((d) => d[valueKey]), 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px", padding: "8px 0" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max((d[valueKey] / max) * 100, 4)}%`,
                  background: color,
                  borderRadius: "3px 3px 0 0",
                  transition: "height 0.3s ease",
                  minHeight: d[valueKey] > 0 ? "4px" : "2px",
                  opacity: d[valueKey] > 0 ? 1 : 0.2,
                }}
              />
            </div>
            <div style={{ fontSize: "9px", color: "#94A3B8", textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  const completionRate = stats.totalBookings > 0
    ? Math.round((stats.completedBookings / stats.totalBookings) * 100)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

      {/* Sidebar */}
      <div style={{ width: "220px", background: "#fff", borderRight: "0.5px solid #E8EAF0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</div>
        </div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Bookings", path: "/dashboard/bookings" },
            { label: "Clients", path: "/dashboard/clients" },
            { label: "Staff", path: "/dashboard/staff" },
          ].map((item) => (
            <div key={item.label} onClick={() => router.push(item.path)}
              style={{ padding: "9px 20px", fontSize: "13px", color: pathname === item.path ? "#4F6EF7" : "#64748B", background: pathname === item.path ? "#EEF2FF" : "transparent", borderRight: pathname === item.path ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          <div onClick={() => router.push("/dashboard/payments")}
            style={{ padding: "9px 20px", fontSize: "13px", color: pathname === "/dashboard/payments" ? "#4F6EF7" : "#64748B", cursor: "pointer" }}>
            Payments
          </div>
          <div onClick={() => router.push("/dashboard/reports")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#4F6EF7", background: "#EEF2FF", borderRight: "2px solid #4F6EF7", cursor: "pointer" }}>
            Reports
          </div>

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div onClick={() => router.push("/dashboard/settings")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name || "My Salon"}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Reports</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Salon performance & trends</div>
          </div>
          {/* Period selector */}
          <div style={{ display: "flex", gap: "4px", background: "#F2F4F7", borderRadius: "8px", padding: "3px" }}>
            {(["7", "30", "90"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: "5px 14px", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", background: period === p ? "#fff" : "transparent", color: period === p ? "#0F172A" : "#64748B", fontWeight: period === p ? 500 : 400, boxShadow: period === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {p === "7" ? "7 days" : p === "30" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {/* ── STAT CARDS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Total Bookings", value: stats.totalBookings, color: "#4F6EF7", bg: "#EEF2FF" },
              { label: "Completed", value: stats.completedBookings, color: "#166534", bg: "#ECFDF5" },
              { label: "Cancelled", value: stats.cancelledBookings, color: "#DC2626", bg: "#FEF2F2" },
              { label: "Revenue", value: `$${stats.totalRevenue.toLocaleString()}`, color: "#0F172A", bg: "#F8F9FC" },
              { label: "Total Clients", value: stats.totalClients, color: "#0F172A", bg: "#F8F9FC" },
              { label: "New Clients", value: stats.newClients, color: "#7C3AED", bg: "#F5F3FF" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "16px 18px" }}>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "#0F172A" }}>{s.value}</div>
                {s.label === "Completed" && (
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#94A3B8" }}>{completionRate}% completion rate</div>
                )}
              </div>
            ))}
          </div>

          {/* ── CHARTS ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px" }}>

            {/* Bookings chart */}
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "18px 20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", marginBottom: "4px" }}>Bookings</div>
              <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Last {period} days</div>
              {bookingsByDay.length > 0 ? (
                <BarChart data={bookingsByDay} valueKey="count" color="#4F6EF7" />
              ) : (
                <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: "13px" }}>No data</div>
              )}
            </div>

            {/* Revenue chart */}
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "18px 20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", marginBottom: "4px" }}>Revenue</div>
              <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "12px" }}>Last {period} days</div>
              {revenueByDay.length > 0 ? (
                <BarChart data={revenueByDay} valueKey="amount" color="#10B981" />
              ) : (
                <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: "13px" }}>No data</div>
              )}
            </div>
          </div>

          {/* ── TOP TABLES ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

            {/* Top Services */}
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Top Services</div>
              </div>
              {topServices.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#CBD5E1", fontSize: "13px" }}>No data yet</div>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  {topServices.map((s, i) => {
                    const max = topServices[0].count;
                    return (
                      <div key={s.name} style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "18px", fontSize: "11px", color: "#94A3B8", textAlign: "right" }}>#{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", color: "#0F172A", marginBottom: "4px" }}>{s.name}</div>
                          <div style={{ height: "4px", background: "#F1F5F9", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${(s.count / max) * 100}%`, background: "#4F6EF7", borderRadius: "2px" }} />
                          </div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", minWidth: "24px", textAlign: "right" }}>{s.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Staff */}
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Top Staff</div>
              </div>
              {topStaff.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#CBD5E1", fontSize: "13px" }}>No data yet</div>
              ) : (
                <div style={{ padding: "8px 0" }}>
                  {topStaff.map((s, i) => {
                    const max = topStaff[0].count;
                    return (
                      <div key={s.name} style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "18px", fontSize: "11px", color: "#94A3B8", textAlign: "right" }}>#{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", color: "#0F172A", marginBottom: "4px" }}>{s.name}</div>
                          <div style={{ height: "4px", background: "#F1F5F9", borderRadius: "2px" }}>
                            <div style={{ height: "100%", width: `${(s.count / max) * 100}%`, background: "#10B981", borderRadius: "2px" }} />
                          </div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", minWidth: "24px", textAlign: "right" }}>{s.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}