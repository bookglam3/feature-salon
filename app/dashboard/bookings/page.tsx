"use client";

import { useState } from "react";

const bookings = [
  { id: 1, client: "Ayesha Khan", service: "Hair Color + Cut", staff: "Sara Ahmed", date: "30 Apr 2026", time: "10:00 AM", duration: "90 min", status: "confirmed", amount: 4500, avatar: "AK", color: "#3b5bdb" },
  { id: 2, client: "Fatima Malik", service: "Bridal Makeup", staff: "Nadia Hussain", date: "30 Apr 2026", time: "11:30 AM", duration: "120 min", status: "in-progress", amount: 12000, avatar: "FM", color: "#7c3aed" },
  { id: 3, client: "Zara Siddiqui", service: "Facial + Cleanup", staff: "Hina Baig", date: "30 Apr 2026", time: "01:00 PM", duration: "60 min", status: "pending", amount: 2800, avatar: "ZS", color: "#0891b2" },
  { id: 4, client: "Maryam Tariq", service: "Manicure + Pedicure", staff: "Sara Ahmed", date: "30 Apr 2026", time: "02:30 PM", duration: "75 min", status: "confirmed", amount: 3200, avatar: "MT", color: "#3b5bdb" },
  { id: 5, client: "Sana Riaz", service: "Keratin Treatment", staff: "Nadia Hussain", date: "30 Apr 2026", time: "04:00 PM", duration: "180 min", status: "cancelled", amount: 8500, avatar: "SR", color: "#dc2626" },
  { id: 6, client: "Hira Baig", service: "Threading + Waxing", staff: "Hina Baig", date: "01 May 2026", time: "10:00 AM", duration: "45 min", status: "confirmed", amount: 1500, avatar: "HB", color: "#3b5bdb" },
  { id: 7, client: "Noor Fatima", service: "Hair Spa", staff: "Sara Ahmed", date: "01 May 2026", time: "12:00 PM", duration: "60 min", status: "pending", amount: 3500, avatar: "NF", color: "#0891b2" },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  confirmed:     { label: "Confirmed",   bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  "in-progress": { label: "In Progress", bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  pending:       { label: "Pending",     bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  cancelled:     { label: "Cancelled",   bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

const stats = [
  { label: "Today's Bookings", value: "24", icon: "📅", change: "+3", up: true },
  { label: "In Progress",      value: "6",  icon: "⚡", change: "Active", up: null },
  { label: "Revenue Today",    value: "₨89,400", icon: "💰", change: "+12%", up: true },
  { label: "Cancellations",    value: "2",  icon: "✕", change: "-1", up: false },
];

export default function BookingsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");

  const filtered = bookings.filter(b => {
    const matchStatus = filter === "all" || b.status === filter;
    const matchSearch = [b.client, b.service, b.staff].some(v =>
      v.toLowerCase().includes(search.toLowerCase())
    );
    return matchStatus && matchSearch;
  });

  const sel = bookings.find(b => b.id === selected);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif", color: "#0f172a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .btn-blue { background: #3b5bdb; color: white; border: none; cursor: pointer; transition: background 0.15s; }
        .btn-blue:hover { background: #3451c7; }
        .btn-outline { background: white; color: #374151; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.15s; }
        .btn-outline:hover { border-color: #3b5bdb; color: #3b5bdb; background: #eff6ff; }
        .row:hover { background: #f8fafc !important; }
        .stat-card { transition: all 0.2s; cursor: default; }
        .stat-card:hover { box-shadow: 0 4px 20px rgba(59,91,219,0.1); transform: translateY(-1px); }
        .filter-btn { cursor: pointer; border: none; transition: all 0.15s; }
        .filter-btn:hover { background: #eff6ff !important; color: #3b5bdb !important; }
        input:focus { outline: none; border-color: #3b5bdb !important; box-shadow: 0 0 0 3px rgba(59,91,219,0.1); }
        .booking-card { transition: all 0.2s; cursor: pointer; }
        .booking-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .slide-in { animation: slideIn 0.25s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>Appointments</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>Wednesday, 30 April 2026</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>↓ Export</button>
          <button className="btn-blue" style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>+ New Booking</button>
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                {s.up !== null && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: s.up ? "#f0fdf4" : "#fef2f2", color: s.up ? "#16a34a" : "#dc2626" }}>
                    {s.change}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, service, staff..."
              style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "white", color: "#0f172a" }} />
          </div>

          <div style={{ display: "flex", background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4, gap: 2 }}>
            {["all", "confirmed", "in-progress", "pending", "cancelled"].map(f => (
              <button key={f} className="filter-btn" onClick={() => setFilter(f)}
                style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: filter === f ? "#3b5bdb" : "transparent", color: filter === f ? "white" : "#64748b" }}>
                {f === "in-progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4, gap: 2, marginLeft: "auto" }}>
            {(["list", "grid"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, border: "none", cursor: "pointer", background: view === v ? "#f1f5f9" : "transparent", color: view === v ? "#0f172a" : "#94a3b8" }}>
                {v === "list" ? "☰" : "⊞"}
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {view === "list" ? (
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                {/* Table Head */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", gap: 12 }}>
                  <div>Client</div><div>Service</div><div>Staff</div><div>Time</div><div>Amount</div><div>Status</div>
                </div>

                {filtered.length === 0 ? (
                  <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                    <div style={{ fontSize: 14 }}>No bookings found</div>
                  </div>
                ) : filtered.map(b => {
                  const sc = statusConfig[b.status];
                  const isSel = selected === b.id;
                  return (
                    <div key={b.id} className="row" onClick={() => setSelected(isSel ? null : b.id)}
                      style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: "1px solid #f8fafc", alignItems: "center", cursor: "pointer", gap: 12, background: isSel ? "#eff6ff" : "white", borderLeft: isSel ? "3px solid #3b5bdb" : "3px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: b.color + "18", color: b.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{b.avatar}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{b.client}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{b.duration}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{b.service}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{b.staff}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{b.time}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#3b5bdb" }}>₨{b.amount.toLocaleString()}</div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span className={b.status === "in-progress" ? "pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: sc.text, flexShrink: 0 }} />
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                {filtered.map(b => {
                  const sc = statusConfig[b.status];
                  return (
                    <div key={b.id} className="booking-card" onClick={() => setSelected(selected === b.id ? null : b.id)}
                      style={{ background: "white", border: "1px solid #e2e8f0", borderTop: `3px solid ${b.color}`, borderRadius: 12, padding: "18px 20px", boxShadow: selected === b.id ? "0 0 0 2px #3b5bdb" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: b.color + "18", color: b.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{b.avatar}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{b.client}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>{b.staff}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>{b.service}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>🕐 {b.time} · {b.duration}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#3b5bdb" }}>₨{b.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>Showing {filtered.length} of {bookings.length} appointments</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-outline" style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12 }}>← Prev</button>
                <button className="btn-outline" style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12 }}>Next →</button>
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          {sel && (
            <div className="slide-in" style={{ width: 268, flexShrink: 0 }}>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, position: "sticky", top: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Detail</span>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 20, lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: sel.color + "18", color: sel.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{sel.avatar}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{sel.client}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Regular Client</div>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginBottom: 16 }}>
                  {[["Service", sel.service], ["Staff", sel.staff], ["Date", sel.date], ["Time", sel.time], ["Duration", sel.duration]].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{l}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Total Amount</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3b5bdb" }}>₨{sel.amount.toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn-blue" style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ Mark Complete</button>
                  <button className="btn-outline" style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 500 }}>✎ Edit Booking</button>
                  <button style={{ padding: 10, borderRadius: 8, fontSize: 13, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", fontWeight: 500 }}>Cancel Appointment</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}