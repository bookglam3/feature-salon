"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ClientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: salonData } = await supabase
        .from("salons").select("*").eq("owner_id", user.id).single();
      setSalon(salonData);

      if (salonData) {
        // Get all unique clients from appointments
        const { data: appts } = await supabase
          .from("appointments")
          .select("client_name, client_email, client_phone, id, date_time")
          .eq("salon_id", salonData.id)
          .order("date_time", { ascending: false });

        // Group by client email to get unique clients with latest booking
        const clientMap = new Map();
        (appts || []).forEach((apt) => {
          if (!clientMap.has(apt.client_email)) {
            clientMap.set(apt.client_email, {
              client_name: apt.client_name,
              client_email: apt.client_email,
              client_phone: apt.client_phone,
              lastBooking: new Date(apt.date_time),
              totalBookings: 1,
            });
          } else {
            const client = clientMap.get(apt.client_email);
            client.totalBookings += 1;
          }
        });

        setClients(Array.from(clientMap.values()));
      }
      setLoading(false);
    };
    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const filteredClients = clients.filter(c =>
    c.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            { label: "Dashboard", path: "/dashboard" },
            { label: "Bookings", path: "/dashboard/bookings" },
            { label: "Clients", path: "/dashboard/clients" },
            { label: "Staff", path: "/dashboard/staff" },
          ].map((item) => (
            <div 
              key={item.label} 
              onClick={() => router.push(item.path)}
              style={{ padding: "9px 20px", fontSize: "13px", color: pathname === item.path ? "#4F6EF7" : "#64748B", background: pathname === item.path ? "#EEF2FF" : "transparent", borderRight: pathname === item.path ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
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
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Clients</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{clients.length} total clients</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "8px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", width: "200px" }}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {/* Clients Table */}
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
            {filteredClients.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                {searchTerm ? "No clients found" : "No clients yet"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Name", "Email", "Phone", "Total Bookings", "Last Booking"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{c.client_name}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{c.client_email}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{c.client_phone || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>
                        <span style={{ background: "#EEF2FF", color: "#4F6EF7", fontSize: "12px", padding: "4px 10px", borderRadius: "20px" }}>
                          {c.totalBookings}
                        </span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>
                        {c.lastBooking ? new Date(c.lastBooking).toLocaleDateString("en-GB") : "—"}
                      </td>
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
