"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface WaitlistEntry {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  status: "waiting" | "contacted" | "booked" | "removed";
  created_at: string;
}

const STATUS_MAP = {
  waiting:   { label: "Waiting",   bg: "rgba(245,158,11,0.10)", color: "#F59E0B" },
  contacted: { label: "Contacted", bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
  booked:    { label: "Booked ✓",  bg: "rgba(16,185,129,0.10)", color: "#047857" },
  removed:   { label: "Removed",   bg: "#F5F3FF", color: "#524D60" },
};

export default function WaitlistPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "contacted" | "booked">("waiting");
  const [form, setForm] = useState({ client_name: "", client_email: "", client_phone: "", preferred_date: "", preferred_time: "", notes: "" });

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const { data } = await supabase.from("waitlist").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: true });
      setEntries(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleAdd = async () => {
    if (!salonId || !form.client_name) { toast.error("Client name required"); return; }
    const { data, error } = await supabase.from("waitlist").insert({ salon_id: salonId, ...form }).select().single();
    if (error) { toast.error("Failed to add"); return; }
    setEntries(p => [...p, data]);
    toast.success(`${form.client_name} added to waitlist!`);
    setShowModal(false);
    setForm({ client_name: "", client_email: "", client_phone: "", preferred_date: "", preferred_time: "", notes: "" });
  };

  const updateStatus = async (id: string, status: WaitlistEntry["status"]) => {
    await supabase.from("waitlist").update({ status }).eq("id", id);
    setEntries(p => p.map(e => e.id === id ? { ...e, status } : e));
    toast.success(`Status updated to ${status}`);
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("waitlist").delete().eq("id", id);
    setEntries(p => p.filter(e => e.id !== id));
    toast.success("Removed from waitlist");
  };

  const handleNotify = async (entry: WaitlistEntry) => {
    if (!entry.client_phone && !entry.client_email) {
      toast.error("No phone or email — cannot notify this client");
      return;
    }
    setNotifying(entry.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/notify-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ waitlist_id: entry.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      const parts = [];
      if (json.whatsappSent) parts.push("WhatsApp");
      if (json.emailSent) parts.push("Email");
      toast.success(`✅ Notified via ${parts.join(" + ") || "notification sent"}!`);
      setEntries(p => p.map(e => e.id === entry.id ? { ...e, status: "contacted" } : e));
    } catch (err) {
      toast.error(`Failed: ${err}`);
    }
    setNotifying(null);
  };

  const filtered = filter === "all" ? entries : entries.filter(e => e.status === filter);

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Waitlist</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Manage clients waiting for slots</div>
        </div>
      </div>
      <button onClick={() => setShowModal(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(245,158,11,0.3)" }}>+ Add to Waitlist</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {([["all","Total","⏳","#7C3AED"], ["waiting","Waiting","🕐","#F59E0B"], ["contacted","Contacted","📞","#7C3AED"], ["booked","Booked","✅","#10B981"]] as const).map(([key, label, icon, color]) => (
            <div key={key} onClick={() => setFilter(key as typeof filter)} style={{ background: filter === key ? "#F5F3FF" : "#FFFFFF", border: `2px solid ${filter === key ? color : "#ECE9F1"}`, borderRadius: 16, padding: "18px 16px", cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.15s" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, opacity: filter === key ? 1 : 0.3 }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
                <span style={{ fontSize: 18 }}>{icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#12101A" }}>{key === "all" ? entries.length : entries.filter(e => e.status === key).length}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <div style={{ fontWeight: 700 }}>No entries in waitlist</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#F5F3FF" }}>
                    {["#", "Client", "Preferred Date/Time", "Notes", "Status", "Actions"].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "#524D60", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid #ECE9F1" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => {
                    const sm = STATUS_MAP[e.status];
                    return (
                      <tr key={e.id} style={{ transition: "background 0.1s" }}
                        onMouseEnter={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                        onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 13, color: "#524D60", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#12101A" }}>{e.client_name}</div>
                          <div style={{ fontSize: 11.5, color: "#524D60" }}>{e.client_phone || e.client_email || "—"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>
                          {e.preferred_date ? new Date(e.preferred_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Flexible"}
                          {e.preferred_time ? ` at ${e.preferred_time}` : ""}
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60", maxWidth: 200 }}>{e.notes || "—"}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <select value={e.status} onChange={ev => updateStatus(e.id, ev.target.value as WaitlistEntry["status"])}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #ECE9F1", fontSize: 12, fontWeight: 700, cursor: "pointer", background: sm.bg, color: sm.color, outline: "none" }}>
                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {/* Notify via WhatsApp + Email */}
                            {e.status === "waiting" && (e.client_phone || e.client_email) && (
                              <button
                                onClick={() => handleNotify(e)}
                                disabled={notifying === e.id}
                                style={{ padding: "5px 10px", background: notifying === e.id ? "#D6D1DE" : "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: notifying === e.id ? "not-allowed" : "pointer", color: notifying === e.id ? "#6B6577" : "#FFFFFF", whiteSpace: "nowrap" }}
                              >
                                {notifying === e.id ? "Sending…" : "Notify"}
                              </button>
                            )}
                            {e.client_phone && <button onClick={() => { navigator.clipboard.writeText(e.client_phone); toast.success("Phone copied!"); }} style={{ padding: "5px 10px", background: "#F5F3FF", border: "1.5px solid #BBF7D0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#047857" }}>📞</button>}
                            <button onClick={() => deleteEntry(e.id)} style={{ padding: "5px 10px", background: "#F5F3FF", border: "1.5px solid #FECACA", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#B91C1C" }}>✕</button>
                          </div>
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

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, border: "1px solid #ECE9F1", boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>Add to Waitlist</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "client_name", label: "Name *", placeholder: "Sarah Johnson", type: "text" },
                { key: "client_phone", label: "Phone", placeholder: "+44 7700 900000", type: "tel" },
                { key: "client_email", label: "Email", placeholder: "sarah@email.com", type: "email" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Preferred Date</label>
                  <input type="date" value={form.preferred_date} onChange={e => setForm(p => ({ ...p, preferred_date: e.target.value }))} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Preferred Time</label>
                  <input type="time" value={form.preferred_time} onChange={e => setForm(p => ({ ...p, preferred_time: e.target.value }))} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Service requested, special requirements…" rows={2} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#F59E0B,#D97706)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Add to Waitlist</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
