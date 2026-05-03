"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";

export default function ClientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }
        setSalon(profile.salon);

        const { data: appts } = await supabase
          .from("appointments")
          .select("client_name, client_email, client_phone, id, date_time, status, services(name, price)")
          .eq("salon_id", profile.salon.id)
          .order("date_time", { ascending: false });

        const clientMap = new Map();
        (appts || []).forEach((apt: any) => {
          const key = apt.client_email || apt.client_name;
          // FIX: handle services as array or object
          const servicePrice = Array.isArray(apt.services)
            ? apt.services.reduce((sum: number, s: any) => sum + (Number(s?.price ?? 0)), 0)
            : Number(apt.services?.price ?? 0);

          if (!clientMap.has(key)) {
            clientMap.set(key, {
              client_name: apt.client_name,
              client_email: apt.client_email,
              client_phone: apt.client_phone,
              lastBooking: new Date(apt.date_time),
              totalBookings: 1,
              totalSpent: servicePrice,
            });
          } else {
            const client = clientMap.get(key);
            client.totalBookings += 1;
            client.totalSpent += servicePrice;
          }
        });

        setClients(Array.from(clientMap.values()));
      } catch (error) {
        console.error("Error loading clients data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleClientClick = async (client: any) => {
    setSelectedClient(client);
    setHistoryLoading(true);

    const { data: history } = await supabase
      .from("appointments")
      .select("*, services(name, price), staff(name)")
      .eq("salon_id", salon.id)
      .eq("client_email", client.client_email)
      .order("date_time", { ascending: false });

    setClientHistory(history || []);
    setHistoryLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const filteredClients = clients.filter(c =>
    c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.client_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>
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
          {["Payments", "Reports"].map((item) => (
            <div key={item} onClick={() => router.push(`/dashboard/${item.toLowerCase()}`)}
              style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>{item}</div>
          ))}
          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div onClick={() => router.push("/dashboard/settings")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name || "My Salon"}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Clients</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{clients.length} total clients</div>
          </div>
          <input
            type="text" placeholder="Search clients..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: "8px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", width: "200px", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ padding: "24px", flex: 1, overflow: "auto", display: "flex", gap: "20px" }}>
          <div style={{ flex: selectedClient ? "0 0 55%" : "1", background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden", transition: "all 0.3s" }}>
            {filteredClients.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                {searchTerm ? "No clients found" : "No clients yet — bookings will appear here"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Name", "Email", "Phone", "Bookings", "Spent", "Last Visit"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c, idx) => (
                    <tr key={idx} onClick={() => handleClientClick(c)}
                      style={{ cursor: "pointer", background: selectedClient?.client_email === c.client_email ? "#F5F7FF" : "transparent" }}>
                      <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600, color: "#4F6EF7", flexShrink: 0 }}>
                            {c.client_name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: "13px", color: "#0F172A", fontWeight: 500 }}>{c.client_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{c.client_email || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{c.client_phone || "—"}</td>
                      <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                        <span style={{ background: "#EEF2FF", color: "#4F6EF7", fontSize: "12px", padding: "4px 10px", borderRadius: "20px" }}>
                          {c.totalBookings}
                        </span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", fontWeight: 500, borderBottom: "0.5px solid #F1F5F9" }}>
                        £{c.totalSpent}
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

          {selectedClient && (
            <div style={{ flex: "0 0 43%", background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: "#4F6EF7" }}>
                    {selectedClient.client_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{selectedClient.client_name}</div>
                    <div style={{ fontSize: "12px", color: "#94A3B8" }}>{selectedClient.client_email}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "18px" }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: "#E8EAF0" }}>
                {[
                  { label: "Total Visits", value: selectedClient.totalBookings },
                  { label: "Total Spent", value: `£${selectedClient.totalSpent}` },
                  { label: "Last Visit", value: selectedClient.lastBooking ? new Date(selectedClient.lastBooking).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—" },
                ].map((s) => (
                  <div key={s.label} style={{ background: "#FAFAFA", padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: 600, color: "#0F172A" }}>{s.value}</div>
                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "#0F172A" }}>Booking History</div>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {historyLoading ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>Loading...</div>
                ) : clientHistory.length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>No bookings found</div>
                ) : (
                  clientHistory.map((b) => (
                    <div key={b.id} style={{ padding: "14px 20px", borderBottom: "0.5px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "13px", color: "#0F172A", fontWeight: 500, marginBottom: "3px" }}>
                          {Array.isArray(b.services) ? b.services[0]?.name : b.services?.name || "Service"}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                          {new Date(b.date_time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          {b.staff?.name && ` · ${b.staff.name}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>
                          £{Array.isArray(b.services) ? b.services[0]?.price : b.services?.price || "—"}
                        </span>
                        <span style={{ background: b.status === "confirmed" ? "#ECFDF5" : b.status === "cancelled" ? "#FEF2F2" : "#FFF7ED", color: b.status === "confirmed" ? "#166634" : b.status === "cancelled" ? "#DC2626" : "#92400E", fontSize: "10px", padding: "2px 8px", borderRadius: "20px" }}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}