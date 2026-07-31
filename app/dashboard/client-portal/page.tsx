"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";
import { resolveAppointmentServices } from "@/app/lib/appointmentServices";

interface ClientRecord {
  email: string;
  name: string;
  phone: string;
  count: number;
  revenue: number;
  last_visit: string;
  statuses: string[];
}

interface AppointmentRow {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: string;
  date_time: string;
  services?: { price: number }[] | null;
}

function ClientPortalContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonName, setSalonName] = useState("");
  const [salonSlug, setSalonSlug] = useState("");
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonName(profile.salon.name);
      setSalonSlug(profile.salon.slug);
      const { data } = await supabase
        .from("appointments")
        .select("id, client_name, client_email, client_phone, status, date_time, services(price)")
        .eq("salon_id", profile.salon.id)
        .order("date_time", { ascending: false });
      const resolved = await resolveAppointmentServices(supabase, data || []);

      // Group by email
      const map: Record<string, ClientRecord> = {};
      (data || [] as AppointmentRow[]).forEach((a: AppointmentRow) => {
        const key = a.client_email || a.client_name;
        if (!map[key]) {
          map[key] = { email: a.client_email, name: a.client_name, phone: a.client_phone, count: 0, revenue: 0, last_visit: a.date_time, statuses: [] };
        }
        map[key].count++;
        map[key].revenue += resolved.get(a.id)?.combinedPrice ?? 0;
        map[key].statuses.push(a.status);
        if (a.date_time > map[key].last_visit) map[key].last_visit = a.date_time;
      });
      setClients(Object.values(map).sort((a, b) => b.revenue - a.revenue));
      setLoading(false);
    };
    load();
  }, [router]);

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const sendPortalLink = (client: ClientRecord) => {
    const link = `${origin}/book/${salonSlug}?client=${encodeURIComponent(client.email || client.name)}`;
    navigator.clipboard.writeText(link);
    toast.success(`Portal link copied for ${client.name}!`);
  };

  const Topbar = (
    <header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>🔐 Client Portal</div>
          <div style={{ fontSize: 11.5, color: "#aab1c4", marginTop: 1 }}>Manage client profiles & self-service</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 10, padding: "7px 14px" }}>
        <span style={{ fontSize: 14, color: "#aab1c4" }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "#F7F5EF", fontFamily: "inherit", width: 180 }} />
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#aab1c4" }}>Loading clients…</div></DashboardShell>;

  const COLORS = ["#C9A24B","#10B981","#F59E0B","#EC4899","#E7C878","#06B6D4"];

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Clients", value: clients.length, icon: "👥", color: "#C9A24B" },
            { label: "Returning", value: clients.filter(c => c.count > 1).length, icon: "🔄", color: "#10B981" },
            { label: "Total Revenue", value: `£${clients.reduce((s,c) => s + c.revenue, 0)}`, icon: "💰", color: "#F59E0B" },
            { label: "Avg. Bookings", value: clients.length ? (clients.reduce((s,c) => s + c.count, 0) / clients.length).toFixed(1) : "0", icon: "📋", color: "#EC4899" },
          ].map(s => (
            <div key={s.label} style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#aab1c4", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</span>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#F7F5EF" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Clients table */}
        <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid #2a3350", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>All Clients <span style={{ fontSize: 12, fontWeight: 600, color: "#aab1c4" }}>({filtered.length})</span></div>
            <button onClick={() => {
              const csv = [["Name","Email","Phone","Bookings","Revenue","Last Visit"],
                ...filtered.map(c => [c.name, c.email, c.phone, c.count, `£${c.revenue}`, new Date(c.last_visit).toLocaleDateString("en-GB")])
              ].map(r => r.join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "clients.csv"; a.click();
              toast.success("Clients exported!");
            }} style={{ padding: "7px 14px", background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: "#aab1c4" }}>📥 Export</button>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#aab1c4" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 700 }}>{search ? "No clients match your search" : "No clients yet"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#141A2E" }}>
                    {["Client","Contact","Bookings","Revenue","Last Visit","Type","Actions"].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "#aab1c4", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid #2a3350" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const initials = c.name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "??";
                    const color = COLORS[c.name?.charCodeAt(0) % COLORS.length || 0];
                    const isVIP = c.count >= 5 || c.revenue >= 200;
                    const isNew = c.count === 1;
                    return (
                      <tr key={i} style={{ transition: "background 0.1s", cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#141A2E"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                        onClick={() => setSelected(c)}>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 11, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{initials}</div>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#F7F5EF" }}>{c.name}</div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350", fontSize: 12.5, color: "#aab1c4" }}>
                          <div>{c.email || "—"}</div>
                          <div style={{ color: "#aab1c4", fontSize: 11.5 }}>{c.phone || "—"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350", fontSize: 14, fontWeight: 800, color: "#F7F5EF" }}>{c.count}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350", fontSize: 14, fontWeight: 800, color: "#10B981" }}>£{c.revenue}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350", fontSize: 12.5, color: "#aab1c4" }}>{new Date(c.last_visit).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: isVIP ? "rgba(245,158,11,0.10)" : isNew ? "rgba(201,162,75,0.10)" : "rgba(16,185,129,0.06)", color: isVIP ? "#F59E0B" : isNew ? "#C9A24B" : "#10B981" }}>
                            {isVIP ? "⭐ VIP" : isNew ? "🆕 New" : "🔄 Regular"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #2a3350" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => sendPortalLink(c)} style={{ padding: "5px 12px", background: "rgba(201,162,75,0.10)", color: "#C9A24B", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🔗 Portal</button>
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

      {/* Client Detail Modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1C2438", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#F7F5EF" }}>Client Profile</div>
              <button onClick={() => setSelected(null)} style={{ background: "#2a3350", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, color: "#aab1c4", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "16px", background: "#141A2E", borderRadius: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: COLORS[selected.name?.charCodeAt(0) % COLORS.length || 0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff" }}>
                {selected.name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#F7F5EF" }}>{selected.name}</div>
                <div style={{ fontSize: 12.5, color: "#aab1c4", marginTop: 2 }}>{selected.email}</div>
                <div style={{ fontSize: 12, color: "#aab1c4" }}>{selected.phone}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Bookings", value: selected.count, color: "#C9A24B" },
                { label: "Total Spent", value: `£${selected.revenue}`, color: "#10B981" },
                { label: "Last Visit", value: new Date(selected.last_visit).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), color: "#F59E0B" },
                { label: "Client Type", value: selected.count >= 5 || selected.revenue >= 200 ? "⭐ VIP" : selected.count === 1 ? "🆕 New" : "🔄 Regular", color: "#EC4899" },
              ].map(s => (
                <div key={s.label} style={{ background: "#141A2E", borderRadius: 12, padding: "14px 16px", border: `1.5px solid ${s.color}20` }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#aab1c4", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { sendPortalLink(selected); setSelected(null); }} style={{ flex: 1, padding: 12, background: "linear-gradient(135deg,#C9A24B,#0E1320)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(201,162,75,0.3)" }}>🔗 Copy Portal Link</button>
              <button onClick={() => setSelected(null)} style={{ padding: 12, background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#aab1c4", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
export default function ClientPortalPage() {
  return (
    <FeatureGate feature="client_portal">
      <ClientPortalContent />
    </FeatureGate>
  );
}
