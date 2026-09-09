"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import Modal, { FormGroup, ModalActions, BtnPrimary, BtnSecondary } from "../components/Modal";
import { useToast } from "../components/Toast";
import { ToastProvider } from "../components/Toast";

// ─── Types ─────────────────────────────────────────────────────
interface LoginLog {
  id: string;
  salon_name: string;
  owner_email: string;
  ip_address: string;
  city: string;
  country: string;
  country_code: string;
  isp: string;
  device: string;
  logged_at: string;
}

interface SalonEntry {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan: string;
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
  created_at: string;
  last_ip: string | null;
  last_city: string | null;
  last_country: string | null;
  country_code: string | null;
  last_device: string | null;
  last_login_at: string | null;
}

interface Agent {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  city: string;
  experience: string;
  own_vehicle: boolean;
  daily_availability: string;
  why_hire: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  referral_code: string | null;
  referred_salons: number;
}

const EXPERIENCE_LABELS: Record<string, string> = {
  "fresher": "Fresher",
  "less-than-1": "< 1 year",
  "1-2": "1–2 years",
  "2-5": "2–5 years",
  "5+": "5+ years",
};

const AVAIL_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "mornings": "Mornings",
  "evenings": "Evenings",
  "weekends": "Weekends",
};

const STATUS_STYLE = {
  pending:  { bg: "#FFFBEB", color: "#F59E0B", border: "rgba(245,158,11,0.25)", label: "⏳ Pending" },
  approved: { bg: "rgba(16,185,129,0.10)", color: "#065F46", border: "#059669", label: "✅ Approved" },
  rejected: { bg: "rgba(239,68,68,0.10)", color: "#991B1B", border: "rgba(239,68,68,0.25)", label: "❌ Rejected" },
};

// ─── Main Component ────────────────────────────────────────────
function PartnersPageInner() {
  const router = useRouter();
  const toast = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Agent | null>(null);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [logsFilter, setLogsFilter] = useState("");

  // All Salons
  const [allSalons, setAllSalons] = useState<SalonEntry[]>([]);
  const [salonLoading, setSalonLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState("all");
  const [salonSearch, setSalonSearch] = useState("");
  const [editSalon, setEditSalon] = useState<SalonEntry | null>(null);
  const [editForm, setEditForm] = useState({ subscription_status: "", subscription_plan: "", name: "", timezone: "Europe/London" });
  const [editSaving, setEditSaving] = useState(false);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadAgents = useCallback(async () => {
    const token = await getToken();
    const url = filter === "all" ? "/api/partners" : `/api/partners?status=${filter}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      setAgents(json.agents || []);
    } else {
      toast.error("Failed to load partner applications");
    }
  }, [filter, getToken, toast]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      // ── Verify admin status server-side (email never exposed to client) ──
      const token = await getToken();
      const checkRes = await fetch("/api/admin/check", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { isAdmin } = await checkRes.json();
      if (!isAdmin) { router.replace("/dashboard"); return; }
      // ────────────────────────────────────────────────────────────────────
      const { data: salon } = await supabase.from("salons").select("name").eq("owner_id", user.id).single();
      setSalonName(salon?.name || "");
      await loadAgents();
      // Load login logs (newest first, last 100)
      const { data: logs } = await supabase
        .from("login_logs")
        .select("id,salon_name,owner_email,ip_address,city,country,country_code,isp,device,logged_at")
        .order("logged_at", { ascending: false })
        .limit(100);
      setLoginLogs(logs || []);
      setLoading(false);
    };
    init();
  }, [router, loadAgents]);

  // Load all salons separately
  useEffect(() => {
    const loadSalons = async () => {
      const token = await getToken();
      const res = await fetch("/api/admin/salons", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const json = await res.json(); setAllSalons(json.salons || []); }
      setSalonLoading(false);
    };
    loadSalons();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) loadAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openReview = (agent: Agent, status: "approved" | "rejected") => {
    setSelected(agent);
    setReviewStatus(status);
    setReviewNotes(agent.admin_notes || "");
    setReviewModal(true);
  };

  const handleReview = async () => {
    if (!selected) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch("/api/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: selected.id, status: reviewStatus, admin_notes: reviewNotes }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(json.error || "Failed to update"); return; }
    toast.success(reviewStatus === "approved" ? "Application approved! Referral code generated." : "Application rejected.");
    setReviewModal(false);
    setSelected(null);
    await loadAgents();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${code}`);
    setCopiedCode(code);
    toast.info("Referral link copied!");
    setTimeout(() => setCopiedCode(""), 2500);
  };

  const filtered = agents.filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.phone.includes(search) ||
    a.city.toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats
  const stats = {
    total: agents.length,
    pending: agents.filter(a => a.status === "pending").length,
    approved: agents.filter(a => a.status === "approved").length,
    rejected: agents.filter(a => a.status === "rejected").length,
    referred: agents.reduce((s, a) => s + (a.referred_salons || 0), 0),
  };

  const openEdit = (s: SalonEntry) => {
    setEditSalon(s);
    setEditForm({
      subscription_status: s.subscription_status || "trial",
      subscription_plan: s.subscription_plan || "starter",
      name: s.name,
      timezone: (s as any).timezone as string || "Europe/London",
    });
  };

  const handleSaveSalon = async () => {
    if (!editSalon) return;
    setEditSaving(true);
    const token = await getToken();
    const res = await fetch("/api/admin/salons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: editSalon.id, ...editForm }),
    });
    if (res.ok) {
      setAllSalons(prev => prev.map(s => s.id === editSalon.id ? { ...s, ...editForm } : s));
      toast.success("Salon updated!");
      setEditSalon(null);
    } else { toast.error("Update failed"); }
    setEditSaving(false);
  };

  const COUNTRY_TABS = [
    { key: "all",  label: "🌍 All" },
    { key: "UK",   label: "🇬🇧 UK" },
    { key: "PK",   label: "🇵🇰 Pakistan" },
    { key: "AE",   label: "🇦🇪 UAE" },
    { key: "SA",   label: "🇸🇦 Saudi Arabia" },
    { key: "none", label: "❓ No Login" },
  ];

  const visibleSalons = allSalons.filter(s => {
    const matchCountry = countryFilter === "all" ? true
      : countryFilter === "none" ? !s.last_country
      : s.country_code === countryFilter;
    const q = salonSearch.toLowerCase();
    const matchSearch = !q || [s.name, s.owner_email, s.last_ip, s.last_city, s.last_country].some(v => v?.toLowerCase().includes(q));
    return matchCountry && matchSearch;
  });

  const SUB_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
    trial:     { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", border: "rgba(124,58,237,0.3)",  label: "🎁 Trial" },
    trialing:  { bg: "rgba(124,58,237,0.12)",  color: "#7C3AED", border: "rgba(124,58,237,0.3)",  label: "⏳ Trialing" },
    active:    { bg: "rgba(16,185,129,0.12)",  color: "#059669", border: "rgba(16,185,129,0.3)",  label: "✅ Active" },
    past_due:  { bg: "rgba(245,158,11,0.12)",  color: "#B45309", border: "rgba(245,158,11,0.3)",  label: "⚠️ Past Due" },
    cancelled: { bg: "rgba(239,68,68,0.12)",   color: "#B91C1C", border: "rgba(239,68,68,0.3)",   label: "❌ Cancelled" },
    unpaid:    { bg: "rgba(239,68,68,0.12)",   color: "#B91C1C", border: "rgba(239,68,68,0.3)",   label: "🔴 Unpaid" },
  };

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px" }}>Partner Applications</div>
          <div style={{ fontSize: 11.5, color: "#6B6577" }}>{stats.pending} pending review</div>
        </div>
      </div>
      <a
        href="/partner"
        target="_blank"
        style={{ background: "#7C3AED", color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r-sm)", textDecoration: "none", whiteSpace: "nowrap" }}
      >
        View Form →
      </a>
    </header>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "24px 20px" }}>

        {/* All Salons — Country Intelligence Panel */}
        <div style={{ background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 20, overflow: "hidden", marginBottom: 24 }}>
          {/* Header */}
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #ECE9F1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>All Salons</div>
              <div style={{ fontSize: 12, color: "#6B6577", marginTop: 2 }}>{allSalons.length} total · filter by country</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input value={salonSearch} onChange={e => setSalonSearch(e.target.value)} placeholder="Search name, email, IP…" style={{ padding: "7px 12px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 13, color: "#12101A", outline: "none", width: 220 }} />
              <span style={{ fontSize: 12, color: "#6B6577" }}>{visibleSalons.length} shown</span>
            </div>
          </div>

          {/* Country Tabs */}
          <div style={{ display: "flex", gap: 4, padding: "12px 18px", borderBottom: "1px solid #F5F3FF", overflowX: "auto" }}>
            {COUNTRY_TABS.map(t => {
              const count = t.key === "all" ? allSalons.length
                : t.key === "none" ? allSalons.filter(s => !s.last_country).length
                : allSalons.filter(s => s.country_code === t.key).length;
              return (
                <button key={t.key} onClick={() => setCountryFilter(t.key)}
                  style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12.5, fontWeight: countryFilter === t.key ? 800 : 500, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${countryFilter === t.key ? "rgba(124,58,237,0.5)" : "#ECE9F1"}`, background: countryFilter === t.key ? "rgba(124,58,237,0.18)" : "transparent", color: countryFilter === t.key ? "#7C3AED" : "#524D60", transition: "all 0.15s" }}
                >{t.label} <span style={{ opacity: 0.6, fontSize: 11 }}>({count})</span></button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            {salonLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#6B6577", fontSize: 13 }}>Loading salons…</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr>
                    {["Salon", "Owner Email", "Plan", "Status", "Last Login Location", "IP", "Device", "Joined", "Actions"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 9.5, fontWeight: 800, color: "#6B6577", textAlign: "left", letterSpacing: "0.8px", textTransform: "uppercase", background: "#F5F3FF", borderBottom: "1px solid #F5F3FF", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleSalons.map(s => {
                    const badge = SUB_BADGE[s.subscription_status] || SUB_BADGE.trial;
                    const flag = s.country_code ? String.fromCodePoint(...[...s.country_code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : "";
                    const isMobile = s.last_device?.includes("Mobile");
                    return (
                      <tr key={s.id}
                        onMouseEnter={e => (e.currentTarget.style.background = "#F5F3FF")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        style={{ transition: "background 0.1s" }}
                      >
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#12101A" }}>{s.name}</div>
                          <div style={{ fontSize: 10.5, color: "#6B6577", marginTop: 2 }}>/book/{s.slug}</div>
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF", fontSize: 12, color: "#524D60", maxWidth: 180 }}>{s.owner_email}</td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: "#ECE9F1", color: "#524D60", textTransform: "capitalize" }}>{s.subscription_plan || s.plan || "starter"}</span>
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: "nowrap" }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF", fontSize: 12.5, color: "#524D60", whiteSpace: "nowrap" }}>
                          {s.last_country ? `${flag} ${s.last_city || ""}, ${s.last_country}` : <span style={{ color: "#6B6577" }}>No login yet</span>}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          {s.last_ip ? <span style={{ fontFamily: "monospace", fontSize: 12, color: "#0891B2", background: "rgba(6,182,212,0.08)", padding: "2px 7px", borderRadius: 5, border: "1px solid rgba(6,182,212,0.2)" }}>{s.last_ip}</span> : <span style={{ color: "#ECE9F1", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          {s.last_device ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: isMobile ? "rgba(236,72,153,0.1)" : "rgba(124,58,237,0.1)", color: isMobile ? "#F472B6" : "#7C3AED", border: `1px solid ${isMobile ? "rgba(236,72,153,0.2)" : "rgba(124,58,237,0.2)"}` }}>{s.last_device}</span> : <span style={{ color: "#ECE9F1", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF", fontSize: 11, color: "#ECE9F1", whiteSpace: "nowrap" }}>
                          {new Date(s.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                        </td>
                        <td style={{ padding: "11px 14px", borderBottom: "1px solid #F5F3FF" }}>
                          <button onClick={() => openEdit(s)}
                            style={{ padding: "5px 12px", background: "rgba(124,58,237,0.12)", border: "1px solid #ECE9F1", color: "#7C3AED", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(124,58,237,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(124,58,237,0.12)"; }}
                          >Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleSalons.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#6B6577", fontSize: 13 }}>No salons found for this filter</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Edit Salon Modal */}
        {editSalon && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
            <div style={{ background: "#13111F", border: "1px solid #ECE9F1", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#12101A", marginBottom: 4 }}>Edit Salon</div>
              <div style={{ fontSize: 12, color: "#6B6577", marginBottom: 22 }}>{editSalon.name} · {editSalon.owner_email}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, color: "#524D60", fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Salon Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "9px 12px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 14, color: "#12101A", outline: "none", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, color: "#524D60", fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Subscription Status</label>
                <select value={editForm.subscription_status} onChange={e => setEditForm(f => ({ ...f, subscription_status: e.target.value }))} style={{ width: "100%", padding: "9px 12px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 14, color: "#12101A", outline: "none" }}>
                  <option value="trial">🎁 Trial</option>
                  <option value="trialing">⏳ Trialing</option>
                  <option value="active">✅ Active</option>
                  <option value="past_due">⚠️ Past Due</option>
                  <option value="cancelled">❌ Cancelled</option>
                  <option value="unpaid">🔴 Unpaid</option>
                </select>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 11.5, color: "#524D60", fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Plan</label>
                <select value={editForm.subscription_plan} onChange={e => setEditForm(f => ({ ...f, subscription_plan: e.target.value }))} style={{ width: "100%", padding: "9px 12px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 14, color: "#12101A", outline: "none" }}>
                  <option value="starter">Starter — £29/mo</option>
                  <option value="pro">Pro — £59/mo</option>
                  <option value="business">Business — £99/mo</option>
                  <option value="enterprise">Enterprise — Custom</option>
                </select>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 11.5, color: "#524D60", fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Timezone</label>
                <select value={editForm.timezone} onChange={e => setEditForm(f => ({ ...f, timezone: e.target.value }))} style={{ width: "100%", padding: "9px 12px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 14, color: "#12101A", outline: "none" }}>
                  <option value="Europe/London">🇬🇧 UK — Europe/London (GMT/BST)</option>
                  <option value="Asia/Karachi">🇵🇰 Pakistan — Asia/Karachi (PKT +5)</option>
                  <option value="Asia/Dubai">🇦🇪 UAE — Asia/Dubai (GST +4)</option>
                  <option value="Asia/Riyadh">🇸🇦 Saudi Arabia — Asia/Riyadh (AST +3)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditSalon(null)} style={{ flex: 1, padding: 11, background: "#F5F3FF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveSalon} disabled={editSaving} style={{ flex: 1, padding: 11, background: editSaving ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: editSaving ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total",    value: stats.total,    color: "#7C3AED",   bg: "#EDE9FF" },
            { label: "Pending",  value: stats.pending,  color: "#F59E0B",          bg: "#FFFBEB" },
            { label: "Approved", value: stats.approved, color: "var(--green)",    bg: "var(--green-light)" },
            { label: "Rejected", value: stats.rejected, color: "var(--red)",      bg: "var(--red-light)" },
            { label: "Signups Referred", value: stats.referred, color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "var(--r-lg)", padding: "14px 16px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: "#6B6577", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", background: "#F5F3FF", borderRadius: "var(--r-sm)", padding: 3, gap: 2 }}>
            {(["all", "pending", "approved", "rejected"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 6, border: "none", background: filter === f ? "#fff" : "transparent", color: filter === f ? "#12101A" : "#6B6577", fontWeight: filter === f ? 600 : 400, cursor: "pointer", textTransform: "capitalize", transition: "all 0.12s", boxShadow: filter === f ? "var(--shadow-xs)" : "none" }}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, city…"
            style={{ flex: 1, minWidth: 180, maxWidth: 300, padding: "8px 13px", border: "1px solid #ECE9F1", borderRadius: "var(--r-sm)", fontSize: 13.5, outline: "none", fontFamily: "var(--font)", color: "#12101A" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Table / Cards */}
        {filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "var(--r-lg)", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", marginBottom: 6 }}>No applications yet</div>
            <div style={{ fontSize: 13, color: "#6B6577" }}>Share <strong>/partner</strong> with potential agents to start receiving applications.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(agent => {
              const st = STATUS_STYLE[agent.status];
              return (
                <div key={agent.id} style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "var(--r-lg)", padding: "16px 18px", transition: "box-shadow 0.14s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, #7C3AED, #7C3AED)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, fontWeight: 800, color: "#fff",
                      }}>
                        {agent.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>{agent.full_name}</div>
                        <div style={{ fontSize: 12, color: "#6B6577", marginTop: 1 }}>
                          📍 {agent.city} · 📞 {agent.phone}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#6B6577" }}>
                        {new Date(agent.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Details chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {[
                      `🎓 ${EXPERIENCE_LABELS[agent.experience] || agent.experience}`,
                      `⏰ ${AVAIL_LABELS[agent.daily_availability] || agent.daily_availability}`,
                      agent.own_vehicle ? "🚗 Has vehicle" : "🚶 No vehicle",
                      agent.whatsapp ? `💬 WhatsApp: ${agent.whatsapp}` : "",
                    ].filter(Boolean).map(chip => (
                      <span key={chip} style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 99, background: "#F5F3FF", color: "#524D60", border: "1px solid #ECE9F1" }}>
                        {chip}
                      </span>
                    ))}
                  </div>

                  {/* Why hire */}
                  <div style={{ fontSize: 13, color: "#524D60", lineHeight: 1.6, marginBottom: 12, padding: "10px 12px", background: "#F5F3FF", borderRadius: "var(--r-sm)", borderLeft: "3px solid #DDD6FE" }}>
                    {agent.why_hire.length > 180 ? agent.why_hire.slice(0, 180) + "…" : agent.why_hire}
                  </div>

                  {/* Referral code (approved only) */}
                  {agent.referral_code && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F5F3FF", borderRadius: "var(--r-sm)", marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6577", textTransform: "uppercase", letterSpacing: "0.5px" }}>Referral Code:</span>
                      <code style={{ fontSize: 13, fontWeight: 800, color: "#7C3AED", background: "#EDE9FF", padding: "2px 10px", borderRadius: 6 }}>
                        {agent.referral_code}
                      </code>
                      <span style={{ fontSize: 12, color: "#6B6577" }}>→ {agent.referred_salons} signups</span>
                      <button
                        onClick={() => copyCode(agent.referral_code!)}
                        style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: copiedCode === agent.referral_code ? "var(--green)" : "#7C3AED", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                      >
                        {copiedCode === agent.referral_code ? "✓ Copied" : "Copy Link"}
                      </button>
                    </div>
                  )}

                  {/* Admin notes */}
                  {agent.admin_notes && (
                    <div style={{ fontSize: 12.5, color: "#524D60", padding: "8px 12px", background: "#F5F3FF", borderRadius: "var(--r-sm)", marginBottom: 12, borderLeft: "3px solid #FDE68A" }}>
                      📝 <strong>Note:</strong> {agent.admin_notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {agent.status !== "approved" && (
                      <button
                        onClick={() => openReview(agent, "approved")}
                        style={{ padding: "7px 16px", background: "var(--green-light)", color: "var(--green)", border: "1px solid var(--green-pale)", borderRadius: "var(--r-sm)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                      >
                        ✅ Approve
                      </button>
                    )}
                    {agent.status !== "rejected" && (
                      <button
                        onClick={() => openReview(agent, "rejected")}
                        style={{ padding: "7px 16px", background: "var(--red-light)", color: "var(--red)", border: "1px solid var(--red-pale)", borderRadius: "var(--r-sm)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                      >
                        ❌ Reject
                      </button>
                    )}
                    {agent.status !== "pending" && (
                      <button
                        onClick={() => openReview(agent, "approved")}
                        style={{ padding: "7px 16px", background: "#FFFFFF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: "var(--r-sm)", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)" }}
                      >
                        📝 Edit Notes
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        open={reviewModal}
        onClose={() => { setReviewModal(false); setSelected(null); }}
        title={reviewStatus === "approved" ? "✅ Approve Application" : "❌ Reject Application"}
        maxWidth={480}
      >
        {selected && (
          <>
            <div style={{ padding: "12px 14px", background: "#F5F3FF", borderRadius: "var(--r-sm)", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A" }}>{selected.full_name}</div>
              <div style={{ fontSize: 12.5, color: "#6B6577", marginTop: 2 }}>{selected.city} · {selected.phone}</div>
            </div>

            {reviewStatus === "approved" && !selected.referral_code && (
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(16,185,129,0.10)", border: "1px solid #059669", borderRadius: "var(--r-sm)", fontSize: 13, color: "#065F46" }}>
                🔗 A unique referral code will be automatically generated upon approval.
              </div>
            )}

            <FormGroup label="Admin Notes (optional)" hint="These notes are internal only — not shown to the applicant.">
              <textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={4}
                placeholder={reviewStatus === "approved" ? "e.g. Strong candidate, good experience in Lahore area." : "e.g. Not enough experience at this time. May reapply in 3 months."}
                style={{
                  width: "100%", padding: "10px 13px", border: "1px solid #ECE9F1",
                  borderRadius: "var(--r-sm)", fontSize: 13.5, fontFamily: "var(--font)",
                  outline: "none", resize: "vertical", color: "#12101A", lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </FormGroup>

            <ModalActions>
              <BtnSecondary type="button" onClick={() => { setReviewModal(false); setSelected(null); }}>Cancel</BtnSecondary>
              <BtnPrimary
                type="button"
                disabled={saving}
                onClick={handleReview}
                style={{ background: reviewStatus === "approved" ? "var(--green)" : "var(--red)" }}
              >
                {saving ? "Saving…" : reviewStatus === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </BtnPrimary>
            </ModalActions>
          </>
        )}
      </Modal>

      {/* ── Login History ─────────────────────────────────────── */}
      <div style={{ padding: "0 24px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 20, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #ECE9F1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Salon Login History</div>
              <div style={{ fontSize: 12, color: "#6B6577", marginTop: 2 }}>{loginLogs.length} recent logins · IP + location tracked</div>
            </div>
            <input
              value={logsFilter}
              onChange={e => setLogsFilter(e.target.value)}
              placeholder="Search salon, email, IP, city…"
              style={{ padding: "8px 14px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 13, color: "#12101A", outline: "none", width: 260 }}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  {["Salon", "Email", "IP Address", "Location", "ISP", "Device", "Time"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 800, color: "#6B6577", textAlign: "left", letterSpacing: "0.8px", textTransform: "uppercase", background: "#F5F3FF", borderBottom: "1px solid #F5F3FF" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loginLogs
                  .filter(l => !logsFilter.trim() || [
                    l.salon_name, l.owner_email, l.ip_address, l.city, l.country, l.isp
                  ].some(v => v?.toLowerCase().includes(logsFilter.toLowerCase())))
                  .map(log => {
                    const flag = log.country_code ? String.fromCodePoint(...[...log.country_code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : "🌐";
                    const isMobile = log.device?.includes("Mobile");
                    return (
                      <tr key={log.id}
                        onMouseEnter={e => (e.currentTarget.style.background = "#F5F3FF")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        style={{ transition: "background 0.1s" }}
                      >
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF", fontSize: 13, fontWeight: 700, color: "#12101A" }}>{log.salon_name || "—"}</td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF", fontSize: 12, color: "#524D60" }}>{log.owner_email}</td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 12.5, color: "#0891B2", background: "rgba(6,182,212,0.08)", padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(6,182,212,0.2)" }}>{log.ip_address}</span>
                        </td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF", fontSize: 12.5, color: "#524D60" }}>{flag} {log.city}{log.city && log.country ? ", " : ""}{log.country}</td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF", fontSize: 11.5, color: "#6B6577" }}>{log.isp || "—"}</td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: isMobile ? "rgba(236,72,153,0.12)" : "rgba(124,58,237,0.12)", color: isMobile ? "#F472B6" : "#7C3AED", border: `1px solid ${isMobile ? "rgba(236,72,153,0.25)" : "rgba(124,58,237,0.25)"}` }}>{log.device || "Unknown"}</span>
                        </td>
                        <td style={{ padding: "11px 16px", borderBottom: "1px solid #F5F3FF", fontSize: 11.5, color: "#6B6577", whiteSpace: "nowrap" }}>
                          {new Date(log.logged_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                {loginLogs.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#6B6577", fontSize: 13 }}>No login history yet — logs appear after first salon login</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

// Wrap in ToastProvider for standalone use
export default function PartnersPage() {
  return (
    <ToastProvider>
      <PartnersPageInner />
    </ToastProvider>
  );
}
