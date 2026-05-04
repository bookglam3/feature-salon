"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "adilgill2008@gmail.com";
const PLAN_OPTIONS = ["starter", "pro", "premium"];

type Tab = "overview" | "salons" | "users" | "settings";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [salons, setSalons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [error, setError] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [searchSalon, setSearchSalon] = useState("");
  const [searchUser, setSearchUser] = useState("");

  useEffect(() => {
    const loadAdmin = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push("/dashboard");
        return;
      }

      const { data: salonData } = await supabase
        .from("salons")
        .select("id, name, slug, plan, created_at, owner_id, owner_email")
        .order("created_at", { ascending: false });

      const { data: appointmentData } = await supabase
        .from("appointments")
        .select("id, salon_id, services(price)");

      const bookingsBySalon: Record<string, number> = {};
      (appointmentData || []).forEach((a: any) => {
        bookingsBySalon[a.salon_id] = (bookingsBySalon[a.salon_id] || 0) + 1;
      });

      const revenue = (appointmentData || []).reduce((sum: number, a: any) => {
        return sum + (Array.isArray(a.services)
          ? a.services.reduce((s: number, sv: any) => s + (Number(sv?.price ?? 0)), 0)
          : Number(a.services?.price ?? 0));
      }, 0);

      const salonsWithCounts = (salonData || []).map((salon: any) => ({
        ...salon,
        appointmentCount: bookingsBySalon[salon.id] || 0,
      }));

      setSalons(salonsWithCounts);
      setTotalRevenue(revenue);
      setTotalBookings((appointmentData || []).length);

      const userList = (salonData || []).map((s: any) => ({
        id: s.owner_id,
        email: s.owner_email,
        salon: s.name,
        plan: s.plan,
        created_at: s.created_at,
      }));
      setUsers(userList);
      setLoading(false);
    };

    loadAdmin();
  }, [router]);

  const updateSalonPlan = async (salonId: string, plan: string) => {
    const { error: updateError } = await supabase.from("salons").update({ plan }).eq("id", salonId);
    if (updateError) { setError(updateError.message); return; }
    setSalons((prev) => prev.map((s) => s.id === salonId ? { ...s, plan } : s));
  };

  const deleteSalon = async (salonId: string) => {
    if (!confirm("Delete this salon and all its records?")) return;
    const { error: deleteError } = await supabase.from("salons").delete().eq("id", salonId);
    if (deleteError) { setError(deleteError.message); return; }
    setSalons((prev) => prev.filter((s) => s.id !== salonId));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const filteredSalons = salons.filter(s =>
    s.name?.toLowerCase().includes(searchSalon.toLowerCase()) ||
    s.owner_email?.toLowerCase().includes(searchSalon.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.salon?.toLowerCase().includes(searchUser.toLowerCase())
  );

  const planCounts = PLAN_OPTIONS.reduce((acc, plan) => {
    acc[plan] = salons.filter(s => s.plan === plan).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0F0F0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature admin</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0A0A0A", display: "flex", fontFamily: "system-ui, sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: "240px", background: "#111", borderRight: "0.5px solid #222", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 20px", borderBottom: "0.5px solid #222" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#fff" }}>feature</div>
          <div style={{ fontSize: "11px", color: "#555", marginTop: "4px", letterSpacing: "2px" }}>SUPER ADMIN</div>
        </div>
        <div style={{ padding: "12px 0", flex: 1 }}>
          {([
            { key: "overview", label: "Overview", icon: "📊" },
            { key: "salons", label: "Salons", icon: "💈" },
            { key: "users", label: "Users", icon: "👥" },
            { key: "settings", label: "Settings", icon: "⚙️" },
          ] as { key: Tab; label: string; icon: string }[]).map((item) => (
            <div key={item.key} onClick={() => setActiveTab(item.key)}
              style={{ padding: "10px 20px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", color: activeTab === item.key ? "#4F6EF7" : "#666", background: activeTab === item.key ? "#1A1A2E" : "transparent", borderLeft: activeTab === item.key ? "2px solid #4F6EF7" : "2px solid transparent" }}>
              <span>{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #222" }}>
          <div style={{ fontSize: "11px", color: "#555", marginBottom: "8px" }}>{ADMIN_EMAIL}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ background: "#111", borderBottom: "0.5px solid #222", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>
              {activeTab === "overview" && "Platform Overview"}
              {activeTab === "salons" && "Salons Management"}
              {activeTab === "users" && "Users Management"}
              {activeTab === "settings" && "Platform Settings"}
            </div>
            <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>Super Admin Panel</div>
          </div>
          {maintenanceMode && (
            <div style={{ background: "#FEF2F2", color: "#DC2626", fontSize: "12px", padding: "6px 14px", borderRadius: "20px", border: "1px solid #FECACA" }}>
              🔴 Maintenance Mode ON
            </div>
          )}
        </div>

        <div style={{ padding: "28px" }}>
          {error && (
            <div style={{ marginBottom: "20px", padding: "14px 18px", backgroundColor: "#1A0000", border: "0.5px solid #7F1D1D", borderRadius: "10px", color: "#FCA5A5", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {activeTab === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "28px" }}>
                {[
                  { label: "Total Salons", value: salons.length, icon: "💈" },
                  { label: "Total Bookings", value: totalBookings, icon: "📅" },
                  { label: "Total Revenue", value: `£${totalRevenue.toFixed(2)}`, icon: "💰" },
                  { label: "Total Users", value: users.length, icon: "👥" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>{s.icon}</div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{s.value}</div>
                    <div style={{ fontSize: "12px", color: "#555" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff", marginBottom: "16px" }}>Plan Distribution</div>
                  {PLAN_OPTIONS.map((plan) => {
                    const count = planCounts[plan] || 0;
                    const pct = salons.length > 0 ? (count / salons.length) * 100 : 0;
                    return (
                      <div key={plan} style={{ marginBottom: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", color: "#aaa", textTransform: "capitalize" }}>{plan}</span>
                          <span style={{ fontSize: "12px", color: "#fff" }}>{count} salons</span>
                        </div>
                        <div style={{ height: "6px", background: "#222", borderRadius: "3px" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: plan === "starter" ? "#4F6EF7" : plan === "pro" ? "#10B981" : "#F59E0B", borderRadius: "3px" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff", marginBottom: "16px" }}>Recent Salons</div>
                  {salons.slice(0, 5).map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #1A1A1A" }}>
                      <div>
                        <div style={{ fontSize: "13px", color: "#fff" }}>{s.name}</div>
                        <div style={{ fontSize: "11px", color: "#555" }}>{s.owner_email}</div>
                      </div>
                      <span style={{ fontSize: "11px", background: "#1A1A2E", color: "#4F6EF7", padding: "3px 8px", borderRadius: "20px", textTransform: "capitalize" }}>{s.plan}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "salons" && (
            <div>
              <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", color: "#555" }}>{filteredSalons.length} salons</div>
                <input type="text" placeholder="Search salons..." value={searchSalon}
                  onChange={(e) => setSearchSalon(e.target.value)}
                  style={{ padding: "8px 14px", background: "#111", border: "0.5px solid #333", borderRadius: "8px", color: "#fff", fontSize: "13px", width: "220px", outline: "none" }} />
              </div>
              <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0A0A0A" }}>
                      {["Salon", "Owner Email", "Plan", "Bookings", "Created", "Actions"].map(h => (
                        <th key={h} style={{ fontSize: "11px", color: "#555", textAlign: "left", padding: "12px 18px", fontWeight: 500, borderBottom: "0.5px solid #222", letterSpacing: "1px" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalons.map((salon) => (
                      <tr key={salon.id} style={{ borderBottom: "0.5px solid #1A1A1A" }}>
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ fontSize: "13px", color: "#fff", fontWeight: 500 }}>{salon.name}</div>
                          <div style={{ fontSize: "11px", color: "#555" }}>{salon.slug}</div>
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: "12px", color: "#666" }}>{salon.owner_email || salon.owner_id?.slice(0, 8) + "..."}</td>
                        <td style={{ padding: "13px 18px" }}>
                          <select value={salon.plan || "starter"} onChange={(e) => updateSalonPlan(salon.id, e.target.value)}
                            style={{ padding: "6px 10px", background: "#1A1A1A", border: "0.5px solid #333", borderRadius: "6px", color: "#fff", fontSize: "12px", cursor: "pointer" }}>
                            {PLAN_OPTIONS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: "13px", color: "#fff" }}>{salon.appointmentCount}</td>
                        <td style={{ padding: "13px 18px", fontSize: "12px", color: "#555" }}>{new Date(salon.created_at).toLocaleDateString("en-GB")}</td>
                        <td style={{ padding: "13px 18px" }}>
                          <button onClick={() => deleteSalon(salon.id)}
                            style={{ background: "#1A0000", color: "#EF4444", border: "0.5px solid #7F1D1D", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", color: "#555" }}>{filteredUsers.length} users</div>
                <input type="text" placeholder="Search users..." value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  style={{ padding: "8px 14px", background: "#111", border: "0.5px solid #333", borderRadius: "8px", color: "#fff", fontSize: "13px", width: "220px", outline: "none" }} />
              </div>
              <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0A0A0A" }}>
                      {["User", "Salon", "Plan", "Joined"].map(h => (
                        <th key={h} style={{ fontSize: "11px", color: "#555", textAlign: "left", padding: "12px 18px", fontWeight: 500, borderBottom: "0.5px solid #222", letterSpacing: "1px" }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={i} style={{ borderBottom: "0.5px solid #1A1A1A" }}>
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#1A1A2E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#4F6EF7", fontWeight: 700 }}>
                              {u.email?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", color: "#fff" }}>{u.email}</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: "13px", color: "#666" }}>{u.salon}</td>
                        <td style={{ padding: "13px 18px" }}>
                          <span style={{ fontSize: "11px", background: "#1A1A2E", color: "#4F6EF7", padding: "3px 10px", borderRadius: "20px", textTransform: "capitalize" }}>{u.plan}</span>
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: "12px", color: "#555" }}>{new Date(u.created_at).toLocaleDateString("en-GB")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "600px" }}>
              <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff", marginBottom: "4px" }}>Maintenance Mode</div>
                    <div style={{ fontSize: "12px", color: "#555" }}>Show maintenance page to all users</div>
                  </div>
                  <button onClick={() => setMaintenanceMode(!maintenanceMode)}
                    style={{ padding: "8px 18px", background: maintenanceMode ? "#7F1D1D" : "#1A2040", color: maintenanceMode ? "#FCA5A5" : "#4F6EF7", border: `1px solid ${maintenanceMode ? "#991B1B" : "#4F6EF7"}`, borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                    {maintenanceMode ? "Turn OFF" : "Turn ON"}
                  </button>
                </div>
              </div>
              <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff", marginBottom: "4px" }}>Announcement Banner</div>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "14px" }}>Show a banner to all salon owners</div>
                <textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Write an announcement..." rows={3}
                  style={{ width: "100%", padding: "10px 14px", background: "#0A0A0A", border: "0.5px solid #333", borderRadius: "8px", color: "#fff", fontSize: "13px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                <button style={{ marginTop: "10px", padding: "8px 18px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                  Save Announcement
                </button>
              </div>
              <div style={{ background: "#111", border: "0.5px solid #222", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "#fff", marginBottom: "12px" }}>Admin Access</div>
                <div style={{ fontSize: "13px", color: "#555", marginBottom: "8px" }}>Only this email can access admin panel:</div>
                <div style={{ fontSize: "13px", color: "#4F6EF7", background: "#0A0A1A", padding: "10px 14px", borderRadius: "8px", fontFamily: "monospace" }}>
                  {ADMIN_EMAIL}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}