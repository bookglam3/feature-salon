"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Referral {
  id: string;
  referrer_name: string;
  referrer_email: string;
  referee_name: string;
  referee_email: string;
  code: string;
  status: "pending" | "completed" | "rewarded";
  reward_given: boolean;
  created_at: string;
}

const STATUS_MAP = {
  pending:   { label: "Pending",   bg: "rgba(245,158,11,0.10)", color: "#F59E0B" },
  completed: { label: "Completed", bg: "rgba(124,58,237,0.10)", color: "#7C3AED" },
  rewarded:  { label: "Rewarded ✓", bg: "rgba(16,185,129,0.10)", color: "#10B981" },
};

function genCode(name: string) {
  return name.trim().split(" ")[0].toUpperCase().slice(0, 6) + Math.floor(Math.random() * 1000);
}

export default function ReferralsPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [salonSlug, setSalonSlug] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ referrer_name: "", referrer_email: "", referee_name: "", referee_email: "" });
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      setSalonSlug(profile.salon.slug || "");
      const { data } = await supabase.from("referrals").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false });
      setReferrals(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleAdd = async () => {
    if (!salonId || !form.referrer_name) { toast.error("Referrer name required"); return; }
    const code = genCode(form.referrer_name);
    const { data, error } = await supabase.from("referrals").insert({ salon_id: salonId, ...form, code, status: "pending", reward_given: false }).select().single();
    if (error) { toast.error("Failed to create referral"); return; }
    setReferrals(p => [data, ...p]);
    toast.success("Referral created!");
    setShowModal(false);
    setForm({ referrer_name: "", referrer_email: "", referee_name: "", referee_email: "" });
  };

  const updateStatus = async (id: string, status: Referral["status"]) => {
    await supabase.from("referrals").update({ status, reward_given: status === "rewarded" }).eq("id", id);
    setReferrals(p => p.map(r => r.id === id ? { ...r, status, reward_given: status === "rewarded" } : r));
    toast.success(`Status: ${status}`);
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${origin}/book/${salonSlug}?ref=${code}`);
    toast.success("Referral link copied!");
  };

  const totalRewarded = referrals.filter(r => r.status === "rewarded").length;
  const totalCompleted = referrals.filter(r => r.status === "completed" || r.status === "rewarded").length;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Referral Program</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Track client referrals & rewards</div>
        </div>
      </div>
      <button onClick={() => setShowModal(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>+ New Referral</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Referrals", value: referrals.length, color: "#7C3AED" },
            { label: "Completed", value: totalCompleted, color: "#10B981" },
            { label: "Rewarded", value: totalRewarded, color: "#F59E0B" },
            { label: "Conversion", value: referrals.length ? `${Math.round((totalCompleted/referrals.length)*100)}%` : "0%", color: "#EC4899" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", border: "1.5px solid #BBF7D0", borderRadius: 20, padding: "20px 24px", marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { step: "1", icon: "👤", title: "Client Refers", desc: "Existing client shares their unique referral link" },
            { step: "2", icon: "📅", title: "Friend Books", desc: "Friend uses the link to make a booking" },
            { step: "3", icon: "🎁", title: "Both Rewarded", desc: "Both get a discount on their next visit" },
          ].map(s => (
            <div key={s.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#12101A" }}>{s.icon} {s.title}</div>
                <div style={{ fontSize: 12, color: "#524D60", marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          {referrals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 700 }}>No referrals yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Create a referral for a client and share their unique link</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead><tr style={{ background: "#F5F3FF" }}>
                  {["Referrer", "Friend", "Code", "Status", "Date", "Actions"].map(h => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "#524D60", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid #ECE9F1" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {referrals.map(r => {
                    const sm = STATUS_MAP[r.status];
                    return (
                      <tr key={r.id} style={{ transition: "background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#12101A" }}>{r.referrer_name}</div>
                          <div style={{ fontSize: 11.5, color: "#524D60" }}>{r.referrer_email || "—"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>{r.referee_name || "—"}</div>
                          <div style={{ fontSize: 11.5, color: "#524D60" }}>{r.referee_email || "—"}</div>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: "#7C3AED", background: "rgba(124,58,237,0.10)", padding: "3px 8px", borderRadius: 6 }}>{r.code}</span>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <select value={r.status} onChange={e => updateStatus(r.id, e.target.value as Referral["status"])}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #ECE9F1", fontSize: 12, fontWeight: 700, background: sm.bg, color: sm.color, outline: "none", cursor: "pointer" }}>
                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1", fontSize: 12.5, color: "#524D60" }}>{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td style={{ padding: "12px 16px", borderBottom: "1px solid #ECE9F1" }}>
                          <button onClick={() => copyLink(r.code)} style={{ padding: "6px 12px", background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Copy Link</button>
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>New Referral</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ padding: "14px 16px", background: "#F5F3FF", borderRadius: 12, fontSize: 13, color: "#10B981" }}>
                <strong>Who is referring?</strong> (existing client)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Name *</label>
                  <input value={form.referrer_name} onChange={e => setForm(p => ({ ...p, referrer_name: e.target.value }))} placeholder="Sarah" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Email</label>
                  <input type="email" value={form.referrer_email} onChange={e => setForm(p => ({ ...p, referrer_email: e.target.value }))} placeholder="sarah@email.com" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
              </div>
              <div style={{ padding: "14px 16px", background: "rgba(124,58,237,0.10)", borderRadius: 12, fontSize: 13, color: "#7C3AED" }}>
                <strong>Who are they referring?</strong> (optional — fill later)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Friend Name</label>
                  <input value={form.referee_name} onChange={e => setForm(p => ({ ...p, referee_name: e.target.value }))} placeholder="John" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Friend Email</label>
                  <input type="email" value={form.referee_email} onChange={e => setForm(p => ({ ...p, referee_email: e.target.value }))} placeholder="john@email.com" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAdd} disabled={!form.referrer_name} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: !form.referrer_name ? 0.5 : 1 }}>Create Referral</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
