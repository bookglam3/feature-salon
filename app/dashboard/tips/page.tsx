"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Tip { id: string; client_name: string; amount: number; method: string; note: string; created_at: string; staff?: { name: string } | null; }
interface StaffMember { id: string; name: string; }

export default function TipsPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client_name: "", amount: "", staff_id: "", method: "cash", note: "" });

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from("tips").select("*, staff(name)").eq("salon_id", profile.salon.id).order("created_at", { ascending: false }),
        supabase.from("staff").select("id,name").eq("salon_id", profile.salon.id),
      ]);
      setTips(t || []);
      setStaff(s || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const totalTips = useMemo(() => tips.reduce((s, t) => s + t.amount, 0), [tips]);
  const staffTips = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    tips.forEach(t => {
      const n = t.staff?.name || "Unassigned";
      if (!map[n]) map[n] = { name: n, total: 0, count: 0 };
      map[n].total += t.amount; map[n].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tips]);

  const handleAdd = async () => {
    if (!salonId || !form.amount) { toast.error("Amount required"); return; }
    const { data, error } = await supabase.from("tips").insert({
      salon_id: salonId, client_name: form.client_name || "Anonymous",
      amount: parseFloat(form.amount), method: form.method,
      staff_id: form.staff_id || null, note: form.note,
    }).select("*, staff(name)").single();
    if (error) { toast.error("Failed to save tip"); return; }
    setTips(p => [data, ...p]);
    toast.success(`£${form.amount} tip recorded!`);
    setShowModal(false);
    setForm({ client_name: "", amount: "", staff_id: "", method: "cash", note: "" });
  };

  const methodColor: Record<string, string> = { cash: "#10B981", card: "#7C3AED", online: "#F59E0B" };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Tips</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Track staff gratuities</div>
        </div>
      </div>
      <button onClick={() => setShowModal(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>+ Record Tip</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Tips", value: `£${totalTips.toFixed(2)}`, icon: "💸", color: "#10B981" },
            { label: "This Month", value: `£${tips.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth()).reduce((s,t) => s + t.amount, 0).toFixed(2)}`, icon: "📅", color: "#7C3AED" },
            { label: "Total Count", value: tips.length, icon: "🧾", color: "#F59E0B" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</span>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          {/* Tips table */}
          <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            {tips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💸</div>
                <div style={{ fontWeight: 700 }}>No tips recorded yet</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#F5F3FF" }}>
                  {["Date", "Client", "Staff", "Amount", "Method", "Note"].map(h => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "#524D60", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid #ECE9F1" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {tips.map(tip => (
                    <tr key={tip.id} style={{ transition: "background 0.1s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{new Date(tip.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>{tip.client_name}</td>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{tip.staff?.name || "—"}</td>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 16, fontWeight: 900, color: "#10B981" }}>£{tip.amount.toFixed(2)}</td>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: `${methodColor[tip.method]}18`, color: methodColor[tip.method], textTransform: "capitalize" }}>{tip.method}</span>
                      </td>
                      <td style={{ padding: "11px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{tip.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Staff leaderboard */}
          <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #ECE9F1", fontSize: 14, fontWeight: 800, color: "#12101A" }}>Staff Leaderboard</div>
            <div style={{ padding: 16 }}>
              {staffTips.length === 0 ? <div style={{ textAlign: "center", padding: "30px 0", color: "#524D60", fontSize: 13 }}>No data yet</div> :
                staffTips.map((s, i) => {
                  const COLS = ["#F59E0B", "#64748B", "#CD7F32"];
                  const col = COLS[i] || "#7C3AED";
                  const initials = s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 11, background: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{i < 3 ? ["🥇","🥈","🥉"][i] : initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>{s.name}</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#10B981" }}>£{s.total.toFixed(2)}</div>
                        </div>
                        <div style={{ height: 5, background: "#ECE9F1", borderRadius: 99 }}>
                          <div style={{ height: "100%", borderRadius: 99, background: col, width: `${(s.total / staffTips[0].total) * 100}%` }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#524D60", marginTop: 2 }}>{s.count} tips</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, border: "1px solid #ECE9F1", boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>Record Tip</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Client Name</label>
                <input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Anonymous" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Amount (£) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" step="0.50" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Method</label>
                  <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                    <option value="cash">Cash</option><option value="card">Card</option><option value="online">Online</option>
                  </select></div>
              </div>
              <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Staff Member</label>
                <select value={form.staff_id} onChange={e => setForm(p => ({ ...p, staff_id: e.target.value }))} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                  <option value="">Unassigned</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Note</label>
                <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Optional note…" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>

              {/* Quick amounts */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 8 }}>Quick Amount</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[2, 5, 10, 20].map(amt => (
                    <button key={amt} onClick={() => setForm(p => ({ ...p, amount: String(amt) }))}
                      style={{ flex: 1, padding: "8px 4px", background: form.amount === String(amt) ? "rgba(16,185,129,0.10)" : "#F5F3FF", border: `1.5px solid ${form.amount === String(amt) ? "#10B981" : "#ECE9F1"}`, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", color: form.amount === String(amt) ? "#10B981" : "#524D60" }}>
                      £{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAdd} disabled={!form.amount} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: !form.amount ? 0.5 : 1 }}>Save Tip</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
