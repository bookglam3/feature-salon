"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import StatCard from "../components/StatCard";
import { useSalon } from "../context/SalonContext";
import { resolveAppointmentServices } from "../../lib/appointmentServices";

type SortKey = "name" | "bookings" | "spent" | "lastVisit";

interface ClientRecord {
  name: string; email: string; phone: string;
  lastVisit: Date; bookings: number; spent: number;
  note?: string; services: Record<string, number>;
  imported?: boolean;
}
interface HistoryItem {
  id: string; date_time: string; status: string;
  services?: { name?: string; price?: number }[] | { name?: string; price?: number } | null;
  staff?: { name: string } | null;
  // Multi-service aware (3C-2b-display) — combined across appointment_
  // services line items, falling back to the primary services join above.
  serviceName?: string;
  combinedPrice?: number;
}
type SalonData = { id: string; slug?: string };

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ["#C9A24B","#10B981","#F59E0B","#EF4444","#E7C878","#06B6D4","#EC4899"];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 800, color: "#fff", flexShrink: 0, letterSpacing: -0.5,
    }}>{name?.charAt(0).toUpperCase() || "?"}</div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastVisit");
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMsg, setNoteMsg] = useState("");

  useEffect(() => {
    (async () => {
      const profile = await getCurrentUserProfile();
      if (!profile) { router.push("/login"); return; }
      setSalon(profile.salon);
      const { data: appts } = await supabase
        .from("appointments")
        .select("client_name,client_email,client_phone,id,date_time,status,services(name,price)")
        .eq("salon_id", profile.salon.id)
        .order("date_time", { ascending: false });

      const resolved = await resolveAppointmentServices(supabase, appts || []);

      const map = new Map<string, ClientRecord>();
      (appts || []).forEach((a: {
        client_name: string; client_email: string; client_phone: string;
        id: string; date_time: string; status: string;
        services?: { name?: string; price?: number }[] | { name?: string; price?: number } | null;
      }) => {
        const key = a.client_email || a.client_name;
        const r = resolved.get(a.id);
        const price = r?.combinedPrice ?? 0;
        const lines = r?.lines ?? [];
        if (!map.has(key)) {
          const services: Record<string, number> = {};
          lines.forEach(l => { services[l.name] = (services[l.name] || 0) + 1; });
          map.set(key, { name: a.client_name, email: a.client_email, phone: a.client_phone, lastVisit: new Date(a.date_time), bookings: 1, spent: price, services });
        } else {
          const c = map.get(key)!;
          c.bookings += 1; c.spent += price;
          lines.forEach(l => { c.services[l.name] = (c.services[l.name] || 0) + 1; });
        }
      });

      // Merge in persisted clients (e.g. CSV-imported) that may have zero bookings yet
      const { data: persisted } = await supabase
        .from("clients")
        .select("id,name,email,phone,notes,last_visit_at,created_at")
        .eq("salon_id", profile.salon.id);

      (persisted || []).forEach((c: {
        id: string; name: string; email: string | null; phone: string | null;
        notes: string | null; last_visit_at: string | null; created_at: string;
      }) => {
        const key = c.email || c.phone || c.id;
        if (map.has(key)) {
          const existing = map.get(key)!;
          if (c.notes && !existing.note) existing.note = c.notes;
        } else {
          map.set(key, {
            name: c.name, email: c.email || "", phone: c.phone || "",
            lastVisit: new Date(c.last_visit_at || c.created_at),
            bookings: 0, spent: 0, services: {}, note: c.notes || undefined, imported: true,
          });
        }
      });

      setClients(Array.from(map.values()));
      setLoading(false);
    })();
  }, [router]);

  const openClient = async (c: ClientRecord) => {
    setSelected(c); setNote(c.note || ""); setHistLoading(true);
    const { data } = await supabase.from("appointments")
      .select("*,services(name,price),staff(name)")
      .eq("salon_id", salon?.id ?? "").eq("client_email", c.email)
      .order("date_time", { ascending: false });
    const resolved = await resolveAppointmentServices(supabase, data || []);
    const enriched = (data || []).map(h => {
      const r = resolved.get(h.id);
      return { ...h, serviceName: r?.serviceName, combinedPrice: r?.combinedPrice };
    });
    setHistory(enriched); setHistLoading(false);
  };

  const saveNote = async () => {
    if (!selected) return;
    setNoteSaving(true);
    setClients(p => p.map(c => c.email === selected.email ? { ...c, note } : c));
    setSelected((p: ClientRecord | null) => p ? { ...p, note } : null);
    setNoteMsg("✓ Saved"); setTimeout(() => setNoteMsg(""), 2000);
    setNoteSaving(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients
      .filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q))
      .sort((a, b) => {
        if (sortKey === "name") return (a.name || "").localeCompare(b.name || "");
        if (sortKey === "bookings") return b.bookings - a.bookings;
        if (sortKey === "spent") return b.spent - a.spent;
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      });
  }, [clients, search, sortKey]);

  const topSpender = clients.reduce<ClientRecord | null>((max, c) => c.spent > (max?.spent || 0) ? c : max, null);
  const newThisMonth = clients.filter(c => {
    const d = new Date(c.lastVisit); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const avgSpend = clients.length ? Math.round(clients.reduce((s, c) => s + c.spent, 0) / clients.length) : 0;
  const favService = (c: ClientRecord) => {
    if (!c.services || Object.keys(c.services).length === 0) return null;
    return Object.entries(c.services).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
  };
  const daysSince = (d: Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  const statusColor = (s: string) =>
    s === "confirmed" ? { bg: "rgba(16,185,129,0.10)", color: "#10B981", border: "rgba(16,185,129,0.25)" }
    : s === "cancelled" ? { bg: "rgba(239,68,68,0.10)", color: "#DC2626", border: "rgba(239,68,68,0.25)" }
    : { bg: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "rgba(245,158,11,0.25)" };

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.4px" }}>{vc.clientPlural}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{clients.length} {vc.clientPlural.toLowerCase()} in CRM</div>
        </div>
      </div>
      <button onClick={() => router.push("/dashboard/clients/import")}
        style={{ padding: "8px 16px", background: "var(--indigo)", color: "#fff", fontSize: 13, fontWeight: 600, borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
        ⬆ Import {vc.clientPlural}
      </button>
    </header>
  );

  return (
    <DashboardShell salonName={salon ? undefined : ""} topbar={Topbar}>
      <div style={{ padding: "20px 20px 32px" }}>

        {/* Stats */}
        <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          <StatCard label={`Total ${vc.clientPlural}`} value={clients.length} icon="👤" color="indigo" sub="all time" />
          <StatCard label="New This Month" value={newThisMonth} icon="✨" color="green" sub="vs last month" />
          <StatCard label="Avg Spend" value={avgSpend} icon="💷" color="amber" prefix="£" sub={`per ${vc.clientSingular.toLowerCase()}`} />
          <StatCard label="Top Spender" value={topSpender ? topSpender.spent : 0} icon="🏆" color="red" prefix="£" sub={topSpender?.name || "—"} />
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Client list */}
          <div style={{ flex: selected ? "0 0 100%" : "1", minWidth: 0, background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
            {/* Toolbar */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #2a3350", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#141A2E" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 160, background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 10, padding: "8px 12px" }}
                onFocusCapture={e => { e.currentTarget.style.borderColor = "#C9A24B"; e.currentTarget.style.background = "#1C2438"; }}
                onBlurCapture={e => { e.currentTarget.style.borderColor = "#2a3350"; e.currentTarget.style.background = "#141A2E"; }}
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.75" stroke="#94A3B8" strokeWidth="1.75"/><path d="M13 13L17 17" stroke="#94A3B8" strokeWidth="1.75" strokeLinecap="round"/></svg>
                <input type="text" placeholder={`Search ${vc.clientPlural.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-1)", fontFamily: "var(--font)", width: "100%" }} />
              </div>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                style={{ padding: "8px 12px", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 12.5, fontFamily: "var(--font)", background: "#1C2438", cursor: "pointer", outline: "none", color: "var(--text-1)" }}>
                <option value="lastVisit">Latest Visit</option>
                <option value="spent">Most Spent</option>
                <option value="bookings">Most Bookings</option>
                <option value="name">Name A–Z</option>
              </select>
              <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap", fontWeight: 600 }}>{filtered.length} {vc.clientPlural.toLowerCase()}</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "56px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 6 }}>{search ? `No ${vc.clientPlural.toLowerCase()} found` : `No ${vc.clientPlural.toLowerCase()} yet`}</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>{vc.clientPlural} appear here after their first booking</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
                  <thead>
                    <tr style={{ background: "#141A2E" }}>
                      {[vc.clientSingular,"Contact","Bookings","Spent","Last Visit",""].map(h => (
                        <th key={h} style={{ fontSize: 10.5, color: "var(--text-3)", textAlign: "left", padding: "11px 16px", fontWeight: 800, borderBottom: "1.5px solid #2a3350", letterSpacing: "0.7px", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const ds = daysSince(c.lastVisit);
                      const isActive = selected?.email === c.email;
                      return (
                        <tr key={i} onClick={() => openClient(c)}
                          style={{ cursor: "pointer", background: isActive ? "rgba(201,162,75,0.10)" : "transparent", transition: "background 0.1s" }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#FAFBFF"; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <td style={{ padding: "13px 16px", borderBottom: "1px solid #2a3350" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={c.name} size={34} />
                              <div>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }}>{c.name}</div>
                                {favService(c) && <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>⭐ {favService(c)}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", borderBottom: "1px solid #2a3350" }}>
                            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{c.email || "—"}</div>
                            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>{c.phone || "—"}</div>
                          </td>
                          <td style={{ padding: "13px 16px", borderBottom: "1px solid #2a3350" }}>
                            <span style={{ background: "rgba(201,162,75,0.10)", color: "#C9A24B", fontSize: 12, padding: "3px 10px", borderRadius: 99, fontWeight: 800, border: "1px solid rgba(201,162,75,0.25)" }}>{c.bookings}</span>
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13.5, fontWeight: 800, color: "var(--text-1)", borderBottom: "1px solid #2a3350" }}>£{c.spent.toFixed(0)}</td>
                          <td style={{ padding: "13px 16px", borderBottom: "1px solid #2a3350" }}>
                            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>{new Date(c.lastVisit).toLocaleDateString("en-GB")}</div>
                            <div style={{ fontSize: 10.5, color: ds > 60 ? "var(--red)" : ds > 30 ? "var(--amber)" : "var(--green)", marginTop: 1, fontWeight: 700 }}>
                              {ds === 0 ? "Today" : `${ds}d ago`}
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", borderBottom: "1px solid #2a3350" }}>
                            <span style={{ fontSize: 11.5, color: "#C9A24B", fontWeight: 700, background: "rgba(201,162,75,0.10)", padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(201,162,75,0.25)" }}>View →</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width: "100%", background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(201,162,75,0.12)", display: "flex", flexDirection: "column", maxHeight: "82vh" }}>
              {/* Header */}
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #2a3350", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg,rgba(201,162,75,0.10),rgba(14,19,32,0.95))", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar name={selected.name} size={44} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.3px" }}>{selected.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{selected.email}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)}
                  style={{ background: "var(--slate-100)", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", fontSize: 14, color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--slate-200)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--slate-100)"; }}
                >✕</button>
              </div>

              {/* Quick actions */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #2a3350", display: "flex", gap: 8, flexShrink: 0 }}>
                {selected.phone && (
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener"
                    style={{ flex: 1, background: "rgba(16,185,129,0.10)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "9px", fontSize: 12.5, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block" }}>
                    💬 WhatsApp
                  </a>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`}
                    style={{ flex: 1, background: "rgba(201,162,75,0.10)", color: "#C9A24B", border: "1px solid rgba(201,162,75,0.25)", borderRadius: 10, padding: "9px", fontSize: 12.5, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block" }}>
                    📞 Call
                  </a>
                )}
                {salon?.slug && (
                  <a href={`/book/${salon.slug}`} target="_blank" rel="noopener"
                    style={{ flex: 1, background: "#141A2E", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px", fontSize: 12.5, fontWeight: 700, textAlign: "center", textDecoration: "none", display: "block" }}>
                    📅 Book Again
                  </a>
                )}
              </div>

              {/* Stats bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#2a3350", flexShrink: 0 }}>
                {[
                  { label: "Visits", value: selected.bookings },
                  { label: "Total Spent", value: `£${selected.spent.toFixed(0)}` },
                  { label: "Fav Service", value: favService(selected) || "—" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#141A2E", padding: "13px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: "var(--text-1)", letterSpacing: "-0.5px" }}>{s.value}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #2a3350", flexShrink: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-3)", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>Notes</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Add notes about this client…"
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 13, fontFamily: "var(--font)", resize: "none", outline: "none", color: "var(--text-1)", boxSizing: "border-box", background: "#141A2E" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 600 }}>{noteMsg}</span>
                  <button onClick={saveNote} disabled={noteSaving}
                    style={{ padding: "6px 16px", background: "#C9A24B", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Save Note
                  </button>
                </div>
              </div>

              {/* Booking history */}
              <div style={{ padding: "12px 18px 6px", flexShrink: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-3)", letterSpacing: "1px", textTransform: "uppercase" }}>Booking History</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {histLoading ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Loading…</div>
                ) : history.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No bookings found</div>
                ) : history.map(b => {
                  const sc = statusColor(b.status);
                  return (
                    <div key={b.id} style={{ padding: "13px 18px", borderBottom: "1px solid #2a3350", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)", marginBottom: 3 }}>
                          {b.serviceName || "Service"}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                          {new Date(b.date_time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          {b.staff?.name && ` · ${b.staff.name}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-1)", marginBottom: 4 }}>
                          £{b.combinedPrice ?? 0}
                        </div>
                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: 10.5, padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>{b.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}