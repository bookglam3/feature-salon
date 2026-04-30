"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [salon, setSalon] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: salonData } = await supabase
        .from("salons").select("*").eq("owner_id", user.id).single();
      setSalon(salonData);

      if (salonData) {
        const { data: appts } = await supabase
          .from("appointments").select("*, services(name, price), staff(name)")
          .eq("salon_id", salonData.id)
          .order("date_time", { ascending: true });
        setAppointments(appts || []);
      }
      setLoading(false);
    };
    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const todayAppts = appointments.filter(a => {
    const today = new Date().toDateString();
    return new Date(a.date_time).toDateString() === today;
  });

  const revenue = todayAppts.reduce((sum, a) => sum + (a.services?.price || 0), 0);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

      {/* Sidebar */}
      <div style={{ width: "220px", background: "#fff", borderRight: "0.5px solid #E8EAF0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</div>
        </div>

        <div style={{ padding: "8px 0", flex: 1 }}>
          {[
            { label: "Dashboard", active: true },
            { label: "Bookings", active: false },
            { label: "Clients", active: false },
            { label: "Staff", active: false },
          ].map((item) => (
            <div key={item.label} style={{ padding: "9px 20px", fontSize: "13px", color: item.active ? "#4F6EF7" : "#64748B", background: item.active ? "#EEF2FF" : "transparent", borderRight: item.active ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          {["Payments", "Reports"].map((item) => (
            <div key={item} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>{item}</div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name || "My Salon"}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Good morning 👋</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <button style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            + New Booking
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1 }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Today's bookings", value: todayAppts.length.toString() },
              { label: "Revenue today", value: `£${revenue}` },
              { label: "Total bookings", value: appointments.length.toString() },
              { label: "Salon", value: salon?.plan === "professional" ? "Pro ✓" : "Starter" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 500, color: "#0F172A" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Appointments Table */}
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>Appointments</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["All", "Today", "Upcoming"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px", border: "0.5px solid", borderColor: activeTab === tab ? "#C7D2FE" : "#E8EAF0", background: activeTab === tab ? "#EEF2FF" : "#fff", color: activeTab === tab ? "#4F6EF7" : "#94A3B8", cursor: "pointer" }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {appointments.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                No appointments yet — share your booking link to get started!
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Status", "Client", "Service", "Staff", "Date & Time", "Amount"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                        <span style={{ background: a.status === "confirmed" ? "#ECFDF5" : "#FFF7ED", color: a.status === "confirmed" ? "#059669" : "#D97706", fontSize: "10px", padding: "3px 8px", borderRadius: "20px" }}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{a.client_name}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{a.services?.name || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{a.staff?.name || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{new Date(a.date_time).toLocaleString("en-GB")}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>£{a.services?.price || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}