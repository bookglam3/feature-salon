"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const ADMIN_EMAIL = "adilgill2008@gmail.com";
const PLAN_OPTIONS = ["starter", "pro", "premium"];

type Tab = "overview" | "salons" | "revenue" | "users" | "announcements" | "flags" | "settings" | "applications" | "verifications";
const PLAN_PRICE: Record<string, number> = { starter: 29, pro: 59, premium: 99 };
const PLAN_COLOR: Record<string, string> = { starter: "#6366F1", pro: "#10B981", premium: "#F59E0B" };

interface SalonAdmin {
  id: string; name: string; slug: string; plan: string; created_at: string;
  owner_id: string; owner_email: string; appointmentCount: number;
  subscription_status?: string; subscription_plan?: string;
  trial_ends_at?: string; current_period_end?: string;
  stripe_customer_id?: string; business_type?: string;
  [key: string]: unknown;
}
interface UserAdmin { id: string; email: string; salon: string; plan: string; created_at: string; }

interface Agent {
  id: string; full_name: string; phone: string; whatsapp?: string; city: string;
  experience: string; own_vehicle?: boolean; daily_availability: string; why_hire?: string;
  status: "pending" | "approved" | "rejected";
  referral_code?: string; admin_notes?: string; reviewed_at?: string;
  country?: string; street_address?: string; postcode?: string;
  id_card_number?: string; id_card_photo_url?: string; selfie_photo_url?: string;
  address_proof_url?: string;
  referred_salons?: number; created_at: string;
  verification_status?: "pending" | "verified" | "rejected" | "flagged";
  verification_notes?: string; verified_at?: string; verified_by?: string;
  auto_flags?: string[];
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#F6F8FC",
  surface: "#FFFFFF",
  nav: "#0A0F1C",
  navBorder: "rgba(255,255,255,0.07)",
  navText: "rgba(255,255,255,0.45)",
  navActive: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  text2: "#64748B",
  text3: "#64748B",
  indigo: "#6366F1",
  indigoSoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  shadow: "0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08),0 2px 4px rgba(0,0,0,0.04)",
};

// ─── Tiny shared primitives ───────────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 16, padding: 20, boxShadow: T.shadow,
    transition: "box-shadow 0.2s, transform 0.2s",
    ...style,
  }}>{children}</div>
);

const Pill = ({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: bg, color, display: "inline-block" }}>{children}</span>
);

const statusMeta: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "#ECFDF5", color: "#059669", label: "Active" },
  trial: { bg: "#FFFBEB", color: "#D97706", label: "Trial" },
  trialing: { bg: "#FFFBEB", color: "#D97706", label: "Trialing" },
  past_due: { bg: "#FEF2F2", color: "#DC2626", label: "Past Due" },
  cancelled: { bg: "#F1F5F9", color: "#64748B", label: "Cancelled" },
  pending: { bg: "#FFFBEB", color: "#C2410C", label: "Pending" },
  approved: { bg: "#ECFDF5", color: "#065F46", label: "Approved" },
  rejected: { bg: "#FEF2F2", color: "#991B1B", label: "Rejected" },
};
const StatusPill = ({ status }: { status: string }) => {
  const m = statusMeta[status] || { bg: "#F1F5F9", color: "#64748B", label: status };
  return <Pill bg={m.bg} color={m.color}>{m.label}</Pill>;
};

const Avatar = ({ name, size = 32, gradient = "135deg,#6366F1,#8B5CF6" }: { name: string; size?: number; gradient?: string }) => (
  <div style={{
    width: size, height: size, borderRadius: size / 3,
    background: `linear-gradient(${gradient})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.38, fontWeight: 700, color: "#fff", flexShrink: 0,
  }}>{name.charAt(0).toUpperCase()}</div>
);

const SectionHeader = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.2px" }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

const Btn = ({
  children, onClick, variant = "primary", size = "md", disabled, style,
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md"; disabled?: boolean; style?: React.CSSProperties;
}) => {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: T.indigo, color: "#fff", border: "none" },
    outline: { background: "transparent", color: T.text2, border: `1px solid ${T.border}` },
    danger: { background: T.redSoft, color: T.red, border: `1px solid #FECACA` },
    ghost: { background: T.indigoSoft, color: T.indigo, border: "none" },
  };
  const sizes: Record<string, React.CSSProperties> = {
    sm: { height: 30, padding: "0 12px", fontSize: 12, borderRadius: 8 },
    md: { height: 38, padding: "0 16px", fontSize: 13.5, borderRadius: 10 },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
      fontFamily: "inherit", transition: "all 0.15s",
      ...styles[variant], ...sizes[size], ...style,
    }}>{children}</button>
  );
};

const NAV_ITEMS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "▣" },
  { key: "salons", label: "Salons", icon: "✂" },
  { key: "revenue", label: "Revenue", icon: "₤" },
  { key: "users", label: "Users", icon: "⊙" },
  { key: "applications", label: "Applications", icon: "✦" },
  { key: "verifications", label: "Verifications", icon: "🪪" },
  { key: "announcements", label: "Announcements", icon: "◉" },
  { key: "flags", label: "Feature Flags", icon: "⚑" },
  { key: "settings", label: "Settings", icon: "◎" },
];

// ─── Table primitives ─────────────────────────────────────────────────────────
const Th = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase",
    color: T.text3, padding: "11px 16px", textAlign: "left",
    borderBottom: `1px solid ${T.border}`, background: T.bg,
  }}>{children}</th>
);
const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text, verticalAlign: "middle", ...style }}>{children}</td>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, accent, icon }: {
  label: string; value: string | number; sub: string; accent: string; icon: string;
}) => (
  <Card style={{ cursor: "default" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: accent + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, color: accent,
      }}>{icon}</div>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.8px", marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 11.5, color: T.text3 }}>{sub}</div>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [salons, setSalons] = useState<SalonAdmin[]>([]);
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [error, setError] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [searchSalon, setSearchSalon] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [extendMsg, setExtendMsg] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [agentSearch, setAgentSearch] = useState("");
  const [agentSort, setAgentSort] = useState<"latest" | "oldest">("latest");
  const [agentPage, setAgentPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  // ── Verification tab state ──
  const [verifFilter, setVerifFilter] = useState<"all"|"pending"|"flagged"|"verified"|"rejected">("all");
  const [verifSearch, setVerifSearch] = useState("");
  const [verifyLoading, setVerifyLoading] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string|null>(null);
  const [selectedVerif, setSelectedVerif] = useState<Agent|null>(null);
  const [verifNotes, setVerifNotes] = useState("");
  // ── Add Salon modal ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", ownerEmail: "", businessType: "salon", plan: "starter" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Auth + data load ──
  useEffect(() => {
    const loadAdmin = async () => {
      // Auth is handled by JWT middleware — no email check needed here

      const { data: salonData } = await supabase
        .from("salons")
        .select("id, name, slug, plan, created_at, owner_id, owner_email, subscription_status, subscription_plan, subscription_id, stripe_customer_id, trial_ends_at, current_period_end, business_type")
        .eq("is_demo_data", false)
        .order("created_at", { ascending: false });

      const { data: appointmentData } = await supabase
        .from("appointments")
        .select("id, salon_id, services(price)");

      const bookingsBySalon: Record<string, number> = {};
      (appointmentData || []).forEach((a: { salon_id: string; services?: { price?: number }[] | { price?: number } | null }) => {
        bookingsBySalon[a.salon_id] = (bookingsBySalon[a.salon_id] || 0) + 1;
      });

      const salonsWithCounts = (salonData || []).map(salon => ({
        ...salon,
        appointmentCount: bookingsBySalon[salon.id] || 0,
      }));

      setSalons(salonsWithCounts as SalonAdmin[]);
      setTotalBookings((appointmentData || []).length);
      setUsers((salonData || []).map(s => ({ id: s.owner_id, email: s.owner_email, salon: s.name, plan: s.plan, created_at: s.created_at })));
      setLoading(false);
    };
    loadAdmin();
  }, [router]);

  // ── Agents ──
  const loadAgents = async () => {
    setAgentsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    try {
      const res = await fetch("/api/partners", { headers: { "Authorization": `Bearer ${token}` } });
      const json = await res.json();
      if (res.ok) setAgents(json.agents || []);
    } catch { /* silent */ }
    finally { setAgentsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "applications" && agents.length === 0) loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Actions ──
  const applyAgentAction = async (id: string, status: "approved" | "rejected", notes: string) => {
    setActionLoading(id + status);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    try {
      const res = await fetch("/api/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ id, status, admin_notes: notes }),
      });
      const json = await res.json();
      if (res.ok && json.agent) { setAgents(p => p.map(a => a.id === id ? json.agent : a)); setSelectedAgent(json.agent); }
    } catch { /* silent */ }
    finally { setActionLoading(""); }
  };

  // ── Verification actions (direct Supabase, admin-only) ──
  const applyVerification = async (
    id: string,
    verification_status: "verified" | "rejected" | "flagged",
    notes: string
  ) => {
    setVerifyLoading(id + verification_status);
    const { data, error: e } = await supabase
      .from("sales_agents")
      .update({
        verification_status,
        verification_notes: notes,
        verified_at: new Date().toISOString(),
        verified_by: ADMIN_EMAIL,
      })
      .eq("id", id)
      .select()
      .single();
    if (!e && data) {
      setAgents(p => p.map(a => a.id === id ? { ...a, ...data } : a));
      setSelectedVerif(prev => prev?.id === id ? { ...prev, ...data } : prev);
    } else if (e) setError(e.message);
    setVerifyLoading("");
  };

  useEffect(() => {
    if (activeTab === "verifications" && agents.length === 0) loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const updateSalonPlan = async (salonId: string, plan: string) => {
    const { error: e } = await supabase.from("salons").update({ plan }).eq("id", salonId);
    if (e) { setError(e.message); return; }
    setSalons(p => p.map(s => s.id === salonId ? { ...s, plan } : s));
  };

  const updateSalonStatus = async (salonId: string, status: string) => {
    const { error: e } = await supabase.from("salons").update({ subscription_status: status }).eq("id", salonId);
    if (e) { setError(e.message); return; }
    setSalons(p => p.map(s => s.id === salonId ? { ...s, subscription_status: status } : s));
  };

  const extendTrial = async (salonId: string) => {
    const days = parseInt(extendDays[salonId] || "7");
    const newDate = new Date(Date.now() + days * 86400000).toISOString();
    const { error: e } = await supabase.from("salons").update({ trial_ends_at: newDate, subscription_status: "trial" }).eq("id", salonId);
    if (e) { setError(e.message); return; }
    setSalons(p => p.map(s => s.id === salonId ? { ...s, trial_ends_at: newDate, subscription_status: "trial" } : s));
    setExtendMsg(p => ({ ...p, [salonId]: `✓ Extended ${days}d` }));
    setTimeout(() => setExtendMsg(p => { const n = { ...p }; delete n[salonId]; return n; }), 3000);
  };

  const deleteSalon = async (salonId: string) => {
    if (!confirm("Delete this salon and all its records?")) return;
    const { error: e } = await supabase.from("salons").delete().eq("id", salonId);
    if (e) { setError(e.message); return; }
    setSalons(p => p.filter(s => s.id !== salonId));
  };

  const saveAnnouncement = async () => {
    setAnnSaving(true);
    await supabase.from("salons").update({ announcement } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setTimeout(() => setAnnSaving(false), 1000);
  };

  // ── Derived stats ──
  const mrr = salons.filter(s => s.subscription_status === "active").reduce((sum, s) => sum + (PLAN_PRICE[s.subscription_plan || s.plan] || 0), 0);
  const trialCount = salons.filter(s => s.subscription_status === "trial" || s.subscription_status === "trialing").length;
  const activeCount = salons.filter(s => s.subscription_status === "active").length;
  const cancelledCount = salons.filter(s => s.subscription_status === "cancelled").length;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const newThisWeek = salons.filter(s => new Date(s.created_at) >= weekAgo).length;
  const newThisMonth = salons.filter(s => new Date(s.created_at) >= monthAgo).length;
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const trialsEndingSoon = salons.filter(s =>
    (s.subscription_status === "trial" || s.subscription_status === "trialing") &&
    s.trial_ends_at && new Date(s.trial_ends_at) >= now && new Date(s.trial_ends_at) <= in7Days
  );
  const pastDueSalons = salons.filter(s => s.subscription_status === "past_due");

  const filteredSalons = salons.filter(s =>
    s.name?.toLowerCase().includes(searchSalon.toLowerCase()) ||
    s.owner_email?.toLowerCase().includes(searchSalon.toLowerCase())
  );
  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.salon?.toLowerCase().includes(searchUser.toLowerCase())
  );
  const planCounts = PLAN_OPTIONS.reduce((acc, plan) => {
    acc[plan] = salons.filter(s => s.plan === plan).length;
    return acc;
  }, {} as Record<string, number>);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const createSalon = async () => {
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/admin/salons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          addForm.name,
          owner_email:   addForm.ownerEmail,
          business_type: addForm.businessType,
          plan:          addForm.plan,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setAddError(json.error || "Failed to create salon"); return; }
      setSalons(p => [{ ...json.salon, subscription_status: "trial", appointmentCount: 0 } as SalonAdmin, ...p]);
      setShowAddModal(false);
      setAddForm({ name: "", ownerEmail: "", businessType: "salon", plan: "starter" });
      setActiveTab("salons");
    } catch {
      setAddError("Network error — please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Slug", "Owner Email", "Business Type", "Plan", "Sub Status", "Sub Plan", "Signed Up", "Trial Ends", "Next Billing", "Bookings", "Stripe Customer ID"];
    const rows = filteredSalons.map(s => [
      s.name,
      s.slug,
      s.owner_email || "",
      s.business_type || "—",
      s.plan || "starter",
      s.subscription_status || "trial",
      s.subscription_plan || "—",
      new Date(s.created_at).toLocaleDateString("en-GB"),
      s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString("en-GB") : "—",
      s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-GB") : "pending Stripe",
      String(s.appointmentCount),
      s.stripe_customer_id || "—",
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-salons-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TAB_TITLE: Record<Tab, string> = {
    overview: "Platform Overview", salons: "Salons", revenue: "Revenue & Billing",
    users: "Users", applications: "Applications", verifications: "Document Verifications",
    announcements: "Announcements", flags: "Feature Flags", settings: "Settings",
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: "100vh", background: T.nav,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, border: `3px solid rgba(99,102,241,0.2)`,
        borderTopColor: T.indigo, borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>LOADING</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── Shell ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Plus Jakarta Sans','Segoe UI',sans-serif}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .tab-content{animation:fadeUp 0.25s ease both}
        .nav-item{transition:all 0.15s;cursor:pointer}
        .nav-item:hover{background:rgba(255,255,255,0.06)!important;color:#fff!important}
        .kpi:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important}
        .salon-row:hover td{background:#F8FAFC!important}
        .user-row:hover td{background:#F8FAFC!important}
        .flag-row:hover td{background:#F8FAFC!important}
        .action-btn{transition:all 0.12s;cursor:pointer}
        .action-btn:hover{border-color:${T.indigo}!important;color:${T.indigo}!important;background:${T.indigoSoft}!important}
        select{font-family:inherit;cursor:pointer;outline:none}
        select:focus{border-color:${T.indigo}!important}
        input{font-family:inherit}
        input:focus{border-color:${T.indigo}!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)!important;outline:none}
        textarea:focus{border-color:${T.indigo}!important;outline:none}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
      `}</style>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 232, minHeight: "100vh", background: T.nav, flexShrink: 0,
        display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh",
      }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${T.navBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: T.indigo, borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#fff", fontWeight: 800, letterSpacing: -0.5,
            }}>F</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>feature</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 1 }}>Super Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV_ITEMS.map(item => (
            <div key={item.key} className="nav-item"
              onClick={() => setActiveTab(item.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, marginBottom: 2,
                color: activeTab === item.key ? T.navActive : T.navText,
                background: activeTab === item.key ? "rgba(99,102,241,0.18)" : "transparent",
                fontSize: 13.5, fontWeight: activeTab === item.key ? 600 : 500,
                position: "relative",
              }}>
              {activeTab === item.key && (
                <div style={{
                  position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)",
                  width: 3, height: 20, background: T.indigo, borderRadius: "0 3px 3px 0",
                }} />
              )}
              <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
              {item.label}
              {item.key === "applications" && agents.filter(a => a.status === "pending").length > 0 && (
                <span style={{
                  marginLeft: "auto", background: T.red, color: "#fff",
                  fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 99,
                }}>{agents.filter(a => a.status === "pending").length}</span>
              )}
            </div>
          ))}
          {/* Broadcast — separate page */}
          <a href="/admin/broadcast" className="nav-item" style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 8, marginBottom: 2,
            color: T.navText, background: "transparent",
            fontSize: 13.5, fontWeight: 500, textDecoration: "none",
          }}>
            <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>📣</span>
            Broadcast
          </a>
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 10px", borderTop: `1px solid ${T.navBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8 }}>
            <Avatar name="A" size={32} gradient="135deg,#6366F1,#8B5CF6" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Adil Gill</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Super Admin</div>
            </div>
            <button onClick={handleLogout} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.3)", fontSize: 13, padding: 4,
              transition: "color 0.15s",
            }} title="Sign out">⏻</button>
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Header */}
        <header style={{
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          padding: "0 24px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 0 #E2E8F0",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: "-0.3px" }}>{TAB_TITLE[activeTab]}</div>
            <div style={{ fontSize: 11.5, color: T.text3 }}>Feature Salon Platform</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {maintenanceMode && (
              <div style={{ background: T.redSoft, color: T.red, fontSize: 11.5, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: `1px solid #FECACA` }}>
                ● Maintenance ON
              </div>
            )}
            <Btn variant="primary" size="sm" onClick={() => { setShowAddModal(true); setAddError(""); }}>
              + Add Salon
            </Btn>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {error && (
            <div style={{
              marginBottom: 20, padding: "12px 16px",
              background: T.redSoft, border: `1px solid #FECACA`,
              borderRadius: 10, color: "#DC2626", fontSize: 13,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              ⚠ {error}
              <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16 }}>×</button>
            </div>
          )}

          <div className="tab-content" key={activeTab}>

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
                  {([
                    { label: "Monthly Revenue", value: mrr > 0 ? `£${mrr}` : "—", sub: mrr > 0 ? `ARR £${mrr * 12}` : "pending Stripe", accent: T.indigo, icon: "£" },
                    { label: "Active Salons", value: activeCount, sub: "Currently paying", accent: T.green, icon: "✓" },
                    { label: "On Trial", value: trialCount, sub: "Free trial period", accent: T.amber, icon: "⏱" },
                    { label: "Cancelled", value: cancelledCount, sub: "Churned accounts", accent: T.red, icon: "✕" },
                    { label: "Total Salons", value: salons.length, sub: "All time signups", accent: "#8B5CF6", icon: "✂" },
                    { label: "New This Week", value: newThisWeek, sub: "Signed up last 7 days", accent: "#06B6D4", icon: "↑" },
                    { label: "New This Month", value: newThisMonth, sub: "Signed up last 30 days", accent: "#0EA5E9", icon: "✦" },
                    { label: "Total Bookings", value: totalBookings, sub: "Across all salons", accent: "#64748B", icon: "✦" },
                  ] as { label: string; value: string | number; sub: string; accent: string; icon: string }[]).map(s => (
                    <div key={s.label} className="kpi" style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 16, padding: 20, boxShadow: T.shadow,
                      transition: "transform 0.2s,box-shadow 0.2s", cursor: "default",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: s.accent + "18", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 16, color: s.accent, marginBottom: 12,
                      }}>{s.icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.8px", marginBottom: 2 }}>{s.value}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 1 }}>{s.label}</div>
                      <div style={{ fontSize: 11.5, color: T.text3 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── Alert: Trials ending soon ── */}
                {trialsEndingSoon.length > 0 && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 16 }}>⏰</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>Trials ending in 7 days ({trialsEndingSoon.length})</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {trialsEndingSoon.map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 9, padding: "9px 14px", border: "1px solid #FDE68A" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 1 }}>{s.owner_email}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706" }}>
                              Ends {s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748B", textTransform: "capitalize" }}>{s.business_type || "salon"} · {s.plan}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Alert: Past due / payment failed ── */}
                {pastDueSalons.length > 0 && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 16 }}>⚠</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B" }}>Payment failed / Past due ({pastDueSalons.length})</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pastDueSalons.map(s => (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 9, padding: "9px 14px", border: "1px solid #FECACA" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 1 }}>{s.owner_email}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>Past Due</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{s.stripe_customer_id ? `Stripe: ${s.stripe_customer_id.slice(0, 12)}…` : "No Stripe ID"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Card>
                    <SectionHeader title="Plan Distribution" sub="Salons per pricing tier" />
                    {PLAN_OPTIONS.map(plan => {
                      const count = planCounts[plan] || 0;
                      const pct = salons.length > 0 ? (count / salons.length) * 100 : 0;
                      return (
                        <div key={plan} style={{ marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: T.text, fontWeight: 500, textTransform: "capitalize" }}>{plan}</span>
                            <span style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>{count} salons · {Math.round(pct)}%</span>
                          </div>
                          <div style={{ height: 6, background: T.bg, borderRadius: 3 }}>
                            <div style={{
                              height: "100%", width: `${pct}%`, borderRadius: 3,
                              background: PLAN_COLOR[plan], transition: "width 0.6s ease",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </Card>

                  <Card>
                    <SectionHeader title="Recent Signups" sub="Latest 5 salons" />
                    {salons.slice(0, 5).map(s => (
                      <div key={s.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 0", borderBottom: `1px solid ${T.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={s.name} size={30} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: T.text3 }}>{s.owner_email}</div>
                          </div>
                        </div>
                        <StatusPill status={s.subscription_status || "trial"} />
                      </div>
                    ))}
                  </Card>
                </div>
              </div>
            )}

            {/* ── SALONS ───────────────────────────────────────────────── */}
            {activeTab === "salons" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>{filteredSalons.length} salons found</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text" placeholder="Search by name or email…" value={searchSalon}
                      onChange={e => setSearchSalon(e.target.value)}
                      style={{
                        height: 36, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 8,
                        fontSize: 13, color: T.text, background: T.surface, width: 240,
                        transition: "border-color 0.15s,box-shadow 0.15s",
                      }}
                    />
                    <button
                      onClick={exportCSV}
                      style={{
                        height: 36, padding: "0 16px", borderRadius: 8, border: `1px solid ${T.green}`,
                        background: T.greenSoft, color: T.green, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                        transition: "all 0.15s", whiteSpace: "nowrap",
                      }}
                    >
                      ↓ Export CSV
                    </button>
                  </div>
                </div>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>{["Salon", "Owner", "Type", "Plan", "Status", "Trial Ends", "Next Billing", "Bookings", "Created", "Actions"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                      <tbody>
                        {filteredSalons.map(salon => (
                          <tr key={salon.id} className="salon-row">
                            <Td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <Avatar name={salon.name} size={30} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{salon.name}</div>
                                  <div style={{ fontSize: 11, color: T.text3 }}>{salon.slug}</div>
                                </div>
                              </div>
                            </Td>
                            <Td style={{ color: T.text2, fontSize: 12.5 }}>{salon.owner_email || salon.owner_id?.slice(0, 8) + "…"}</Td>
                            <Td>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text2, textTransform: "capitalize" }}>
                                {salon.business_type || <span style={{ color: T.text3 }}>—</span>}
                              </span>
                            </Td>
                            <Td>
                              <select
                                value={salon.plan || "starter"}
                                onChange={e => updateSalonPlan(salon.id, e.target.value)}
                                style={{
                                  padding: "5px 10px", background: T.bg, border: `1px solid ${T.border}`,
                                  borderRadius: 7, color: T.text, fontSize: 12.5,
                                }}
                              >
                                {PLAN_OPTIONS.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                              </select>
                            </Td>
                            <Td>
                              <select
                                value={salon.subscription_status || "trial"}
                                onChange={e => updateSalonStatus(salon.id, e.target.value)}
                                style={{
                                  padding: "5px 10px", background: T.bg, border: `1px solid ${T.border}`,
                                  borderRadius: 7, fontSize: 12.5,
                                  color: statusMeta[salon.subscription_status || "trial"]?.color || T.text2,
                                }}
                              >
                                {["trial", "trialing", "active", "past_due", "cancelled"].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </Td>
                            <Td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                              {salon.trial_ends_at
                                ? <span style={{ color: new Date(salon.trial_ends_at) <= in7Days && new Date(salon.trial_ends_at) >= now ? T.amber : T.text2, fontWeight: new Date(salon.trial_ends_at) <= in7Days && new Date(salon.trial_ends_at) >= now ? 700 : 400 }}>
                                    {new Date(salon.trial_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                                  </span>
                                : <span style={{ color: T.text3 }}>—</span>}
                            </Td>
                            <Td style={{ fontSize: 12, color: T.text2, whiteSpace: "nowrap" }}>
                              {salon.current_period_end
                                ? new Date(salon.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                                : <span style={{ color: T.text3, fontSize: 11 }}>pending Stripe</span>}
                            </Td>
                            <Td style={{ fontWeight: 600 }}>{salon.appointmentCount}</Td>
                            <Td style={{ color: T.text2, fontSize: 12 }}>{new Date(salon.created_at).toLocaleDateString("en-GB")}</Td>
                            <Td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <input
                                    type="number" placeholder="7"
                                    value={extendDays[salon.id] || ""}
                                    onChange={e => setExtendDays(p => ({ ...p, [salon.id]: e.target.value }))}
                                    style={{
                                      width: 42, padding: "4px 6px", background: T.bg,
                                      border: `1px solid ${T.border}`, borderRadius: 6, color: T.text, fontSize: 11,
                                    }}
                                  />
                                  <button
                                    className="action-btn"
                                    onClick={() => extendTrial(salon.id)}
                                    style={{
                                      padding: "4px 8px", background: T.indigoSoft, color: T.indigo,
                                      border: `1px solid #C7D2FE`, borderRadius: 6, fontSize: 11, fontWeight: 600,
                                    }}
                                  >+days</button>
                                </div>
                                {extendMsg[salon.id] && (
                                  <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>{extendMsg[salon.id]}</span>
                                )}
                                <button
                                  className="action-btn"
                                  onClick={() => deleteSalon(salon.id)}
                                  style={{
                                    padding: "4px 10px", background: T.redSoft, color: T.red,
                                    border: `1px solid #FECACA`, borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  }}
                                >Delete</button>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── USERS ────────────────────────────────────────────────── */}
            {activeTab === "users" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>{filteredUsers.length} users</div>
                  <input
                    type="text" placeholder="Search by email or salon…" value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    style={{
                      height: 36, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 8,
                      fontSize: 13, color: T.text, background: T.surface, width: 240,
                    }}
                  />
                </div>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["User", "Salon", "Plan", "Joined"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {filteredUsers.map((u, i) => (
                        <tr key={i} className="user-row">
                          <Td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={u.email} size={30} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{u.email}</span>
                            </div>
                          </Td>
                          <Td style={{ color: T.text2 }}>{u.salon}</Td>
                          <Td>
                            <Pill bg={T.indigoSoft} color={T.indigo}>{u.plan}</Pill>
                          </Td>
                          <Td style={{ color: T.text2, fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString("en-GB")}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* ── REVENUE ──────────────────────────────────────────────── */}
            {activeTab === "revenue" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
                  {([
                    { label: "MRR", value: `£${mrr}`, accent: T.green, sub: "Monthly Recurring" },
                    { label: "ARR", value: `£${mrr * 12}`, accent: T.indigo, sub: "Annual Recurring" },
                    { label: "Active Paying", value: activeCount, accent: T.amber, sub: "Salons paying now" },
                    { label: "Churn Rate", value: salons.length ? `${Math.round((cancelledCount / salons.length) * 100)}%` : "0%", accent: T.red, sub: "Of all signups" },
                  ] as { label: string; value: string | number; accent: string; sub: string }[]).map(s => (
                    <div key={s.label} className="kpi" style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 16, padding: 20, boxShadow: T.shadow,
                      transition: "transform 0.2s,box-shadow 0.2s",
                    }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: s.accent, marginBottom: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.label}</div>
                      <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <Card>
                  <SectionHeader title="Revenue by Plan" sub="Active subscriptions breakdown" />
                  {PLAN_OPTIONS.map(plan => {
                    const count = salons.filter(s => s.subscription_status === "active" && (s.subscription_plan === plan || s.plan === plan)).length;
                    const rev = count * (PLAN_PRICE[plan] || 0);
                    return (
                      <div key={plan} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: PLAN_COLOR[plan], flexShrink: 0,
                        }} />
                        <div style={{ width: 72, fontSize: 13, color: T.text, fontWeight: 500, textTransform: "capitalize" }}>{plan}</div>
                        <div style={{ flex: 1, height: 7, background: T.bg, borderRadius: 4 }}>
                          <div style={{
                            height: "100%", borderRadius: 4, background: PLAN_COLOR[plan],
                            width: `${mrr > 0 ? (rev / mrr * 100) : 0}%`, transition: "width 0.6s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 700, width: 110, textAlign: "right" }}>£{rev}/mo · {count} salons</div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}

            {/* ── ANNOUNCEMENTS ────────────────────────────────────────── */}
            {activeTab === "announcements" && (
              <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 16 }}>
                <Card>
                  <SectionHeader title="Send Announcement" sub="Broadcasts to every salon dashboard" />
                  <textarea
                    value={announcement}
                    onChange={e => setAnnouncement(e.target.value)}
                    placeholder="e.g. We're rolling out a new feature next week…"
                    rows={4}
                    style={{
                      width: "100%", padding: "12px 14px", border: `1px solid ${T.border}`,
                      borderRadius: 10, fontSize: 13, color: T.text, resize: "vertical",
                      fontFamily: "inherit", background: T.bg, marginBottom: 14,
                      transition: "border-color 0.15s",
                    }}
                  />
                  <Btn variant="primary" onClick={saveAnnouncement} style={{ background: annSaving ? T.green : T.indigo }}>
                    {annSaving ? "✓ Saved!" : "Send to All Salons"}
                  </Btn>
                </Card>
                <Card>
                  <SectionHeader title="Email Blast" sub="Coming soon — requires Resend integration" />
                  <div style={{ fontSize: 13, color: T.text3 }}>
                    Send a direct email to all registered salon owners. Connect Resend in your environment variables to enable this.
                  </div>
                </Card>
              </div>
            )}

            {/* ── FLAGS ────────────────────────────────────────────────── */}
            {activeTab === "flags" && (
              <div>
                <div style={{ fontSize: 13, color: T.text2, marginBottom: 16 }}>
                  Toggle features per salon. Changes apply immediately without a deploy.
                </div>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Salon", "WhatsApp", "Reminders", "Online Bookings", "Actions"].map(h => <Th key={h}>{h}</Th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {salons.map(salon => (
                        <tr key={salon.id} className="flag-row">
                          <Td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar name={salon.name} size={28} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{salon.name}</div>
                                <div style={{ fontSize: 11, color: T.text3 }}>{salon.owner_email}</div>
                              </div>
                            </div>
                          </Td>
                          {(["whatsapp_enabled", "reminders_enabled"] as const).map(flag => (
                            <Td key={flag}>
                              <button
                                onClick={async () => {
                                  const newVal = !salon[flag];
                                  await supabase.from("salons").update({ [flag]: newVal }).eq("id", salon.id);
                                  setSalons(p => p.map(s => s.id === salon.id ? { ...s, [flag]: newVal } : s));
                                }}
                                style={{
                                  padding: "5px 14px", borderRadius: 99, border: "none", cursor: "pointer",
                                  fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                                  background: salon[flag] ? T.greenSoft : T.bg,
                                  color: salon[flag] ? T.green : T.text3,
                                }}
                              >
                                {salon[flag] ? "ON" : "OFF"}
                              </button>
                            </Td>
                          ))}
                          <Td><StatusPill status={salon.subscription_status || "trial"} /></Td>
                          <Td>
                            <a href={`/book/${salon.slug}`} target="_blank" rel="noopener"
                              style={{ fontSize: 12, color: T.indigo, fontWeight: 600, textDecoration: "none" }}>
                              View Booking →
                            </a>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* ── APPLICATIONS ─────────────────────────────────────────── */}
            {activeTab === "applications" && (() => {
              const PER_PAGE = 25;
              const filtered = agents
                .filter(a => agentFilter === "all" || a.status === agentFilter)
                .filter(a => {
                  const q = agentSearch.toLowerCase();
                  return !q || a.full_name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.phone.includes(q);
                })
                .sort((a, b) => agentSort === "latest"
                  ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
              const page = Math.min(agentPage, totalPages);
              const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
              const counts = {
                all: agents.length,
                pending: agents.filter(a => a.status === "pending").length,
                approved: agents.filter(a => a.status === "approved").length,
                rejected: agents.filter(a => a.status === "rejected").length,
              };

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
                    {([
                      { key: "all", label: "Total", value: counts.all, accent: T.indigo, icon: "⊙" },
                      { key: "pending", label: "Pending", value: counts.pending, accent: T.amber, icon: "⏱" },
                      { key: "approved", label: "Approved", value: counts.approved, accent: T.green, icon: "✓" },
                      { key: "rejected", label: "Rejected", value: counts.rejected, accent: T.red, icon: "✕" },
                    ] as { key: "all" | "pending" | "approved" | "rejected"; label: string; value: number; accent: string; icon: string }[]).map(s => (
                      <div key={s.key} className="kpi"
                        onClick={() => { setAgentFilter(s.key); setAgentPage(1); }}
                        style={{
                          background: T.surface,
                          border: `1px solid ${agentFilter === s.key ? s.accent : T.border}`,
                          borderRadius: 14, padding: 18, cursor: "pointer",
                          boxShadow: agentFilter === s.key ? `0 0 0 3px ${s.accent}18` : T.shadow,
                          transition: "all 0.15s",
                        }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: s.accent + "18", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 14, color: s.accent, marginBottom: 10,
                        }}>{s.icon}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.accent, letterSpacing: "-0.8px" }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: T.text2, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Toolbar */}
                  <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: "12px 16px",
                    display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["all", "pending", "approved", "rejected"] as const).map(f => (
                        <button key={f} onClick={() => { setAgentFilter(f); setAgentPage(1); }}
                          style={{
                            padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer",
                            fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                            background: agentFilter === f ? T.indigo : T.bg,
                            color: agentFilter === f ? "#fff" : T.text2,
                          }}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}{f !== "all" && ` (${counts[f]})`}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text" placeholder="Search name, city, phone…"
                        value={agentSearch}
                        onChange={e => { setAgentSearch(e.target.value); setAgentPage(1); }}
                        style={{
                          height: 34, padding: "0 12px", border: `1px solid ${T.border}`,
                          borderRadius: 8, fontSize: 12.5, color: T.text, background: T.bg, width: 200,
                        }}
                      />
                      <button
                        onClick={() => setAgentSort(s => s === "latest" ? "oldest" : "latest")}
                        style={{
                          height: 34, padding: "0 12px", borderRadius: 8, background: T.bg,
                          border: `1px solid ${T.border}`, fontSize: 12, cursor: "pointer",
                          color: T.text2, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
                        }}>
                        {agentSort === "latest" ? "↓ Latest" : "↑ Oldest"}
                      </button>
                      <button onClick={loadAgents}
                        style={{
                          height: 34, padding: "0 12px", borderRadius: 8, background: T.indigoSoft,
                          border: "none", fontSize: 12, cursor: "pointer", color: T.indigo,
                          fontWeight: 700, fontFamily: "inherit",
                        }}>↻ Refresh</button>
                    </div>
                  </div>

                  {/* Table */}
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    {agentsLoading ? (
                      <div style={{ padding: 48, textAlign: "center", color: T.text3, fontSize: 14 }}>Loading applications…</div>
                    ) : visible.length === 0 ? (
                      <div style={{ padding: 56, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>◌</div>
                        <div style={{ fontSize: 14, color: T.text3, fontWeight: 500 }}>No applications found</div>
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>{["Applicant", "City", "Experience", "Availability", "Applied", "Status", ""].map(h => <Th key={h}>{h}</Th>)}</tr>
                          </thead>
                          <tbody>
                            {visible.map(a => (
                              <tr key={a.id} className="salon-row">
                                <Td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <Avatar name={a.full_name} size={32} />
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.full_name}</div>
                                      <div style={{ fontSize: 11, color: T.text3 }}>{a.phone}</div>
                                    </div>
                                  </div>
                                </Td>
                                <Td style={{ color: T.text2 }}>{a.city}</Td>
                                <Td style={{ color: T.text2, textTransform: "capitalize" }}>{a.experience?.replace(/-/g, " ")}</Td>
                                <Td style={{ color: T.text2, textTransform: "capitalize" }}>{a.daily_availability?.replace(/-/g, " ")}</Td>
                                <Td style={{ color: T.text3, fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString("en-GB")}</Td>
                                <Td>
                                  <StatusPill status={a.status} />
                                  {a.referral_code && (
                                    <div style={{ fontSize: 10, color: T.text3, marginTop: 3, fontFamily: "monospace" }}>{a.referral_code}</div>
                                  )}
                                </Td>
                                <Td>
                                  <button
                                    className="action-btn"
                                    onClick={() => { setSelectedAgent(a); setModalNotes(a.admin_notes || ""); }}
                                    style={{
                                      padding: "5px 14px", borderRadius: 7, background: T.indigoSoft,
                                      color: T.indigo, border: "none", fontSize: 12, fontWeight: 600,
                                    }}>View →</button>
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                      <Btn variant="outline" size="sm" onClick={() => setAgentPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</Btn>
                      <span style={{ fontSize: 13, color: T.text2 }}>Page {page} of {totalPages}</span>
                      <Btn variant="outline" size="sm" onClick={() => setAgentPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</Btn>
                    </div>
                  )}

                  {/* Detail Modal */}
                  {selectedAgent && (
                    <div
                      onClick={e => { if (e.target === e.currentTarget) setSelectedAgent(null); }}
                      style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                      }}>
                      <div style={{
                        background: T.surface, borderRadius: 20, width: "100%", maxWidth: 680,
                        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
                        animation: "fadeUp 0.2s ease",
                      }}>
                        {/* Modal header */}
                        <div style={{
                          background: T.nav, borderRadius: "20px 20px 0 0",
                          padding: "22px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <Avatar name={selectedAgent.full_name} size={44} gradient="135deg,#6366F1,#8B5CF6" />
                            <div>
                              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{selectedAgent.full_name}</div>
                              <StatusPill status={selectedAgent.status} />
                            </div>
                          </div>
                          <button onClick={() => setSelectedAgent(null)} style={{
                            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
                            padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1,
                          }}>×</button>
                        </div>

                        <div style={{ padding: "22px 24px" }}>
                          {/* Info grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                            {([
                              { label: "Phone", value: selectedAgent.phone },
                              { label: "WhatsApp", value: selectedAgent.whatsapp || "—" },
                              { label: "City", value: selectedAgent.city },
                              { label: "Country", value: selectedAgent.country || "GB" },
                              { label: "Experience", value: selectedAgent.experience?.replace(/-/g, " ") || "—" },
                              { label: "Availability", value: selectedAgent.daily_availability?.replace(/-/g, " ") || "—" },
                              { label: "Vehicle", value: selectedAgent.own_vehicle ? "Yes ✓" : "No" },
                              { label: "Applied", value: new Date(selectedAgent.created_at).toLocaleDateString("en-GB") },
                            ]).map(f => (
                              <div key={f.label} style={{ background: T.bg, borderRadius: 9, padding: "10px 14px" }}>
                                <div style={{ fontSize: 10.5, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{f.label}</div>
                                <div style={{ fontSize: 13, color: T.text, fontWeight: 500, textTransform: "capitalize" }}>{f.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Why hire */}
                          {selectedAgent.why_hire && (
                            <div style={{
                              background: T.indigoSoft, borderRadius: 10, padding: "13px 16px",
                              marginBottom: 16, border: `1px solid #C7D2FE`,
                            }}>
                              <div style={{ fontSize: 10.5, color: T.indigo, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Why They Should Be Hired</div>
                              <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>{selectedAgent.why_hire}</p>
                            </div>
                          )}

                          {/* ID verification */}
                          {selectedAgent.id_card_number && (
                            <div style={{
                              background: T.amberSoft, borderRadius: 10, padding: "13px 16px",
                              marginBottom: 16, border: `1px solid #FDE68A`,
                            }}>
                              <div style={{ fontSize: 10.5, color: T.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Identity Verification</div>
                              <div style={{ fontSize: 12, color: "#92400E", marginBottom: 10 }}>ID: <strong>{selectedAgent.id_card_number}</strong></div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {selectedAgent.id_card_photo_url && (
                                  <a href={selectedAgent.id_card_photo_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 12, color: T.indigo, fontWeight: 600, textDecoration: "none", background: T.indigoSoft, padding: "4px 12px", borderRadius: 6 }}>
                                    View ID Photo ↗
                                  </a>
                                )}
                                {selectedAgent.selfie_photo_url && (
                                  <a href={selectedAgent.selfie_photo_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 12, color: T.green, fontWeight: 600, textDecoration: "none", background: T.greenSoft, padding: "4px 12px", borderRadius: 6 }}>
                                    View Selfie ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Referral code */}
                          {selectedAgent.referral_code && (
                            <div style={{
                              background: T.greenSoft, borderRadius: 10, padding: "13px 16px",
                              marginBottom: 16, border: `1px solid #6EE7B7`,
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                              <div>
                                <div style={{ fontSize: 10.5, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Referral Code</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: "#065F46", fontFamily: "monospace" }}>{selectedAgent.referral_code}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: T.text3 }}>Referred Salons</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: T.green }}>{selectedAgent.referred_salons || 0}</div>
                              </div>
                            </div>
                          )}

                          {/* Admin notes */}
                          <div style={{ marginBottom: 18 }}>
                            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                              Internal Notes
                            </label>
                            <textarea
                              value={modalNotes} onChange={e => setModalNotes(e.target.value)}
                              rows={3} placeholder="Notes visible only to admins…"
                              style={{
                                width: "100%", padding: "10px 14px", borderRadius: 9,
                                border: `1px solid ${T.border}`, fontSize: 13, color: T.text,
                                resize: "vertical", fontFamily: "inherit", background: T.bg,
                              }}
                            />
                          </div>

                          {/* Action buttons */}
                          {selectedAgent.status === "pending" ? (
                            <div style={{ display: "flex", gap: 10 }}>
                              <button
                                onClick={() => applyAgentAction(selectedAgent.id, "approved", modalNotes)}
                                disabled={!!actionLoading}
                                style={{
                                  flex: 1, padding: 13, borderRadius: 10, border: "none", cursor: actionLoading ? "not-allowed" : "pointer",
                                  background: actionLoading ? T.text3 : T.green, color: "#fff", fontSize: 14, fontWeight: 700,
                                  fontFamily: "inherit", opacity: actionLoading ? 0.7 : 1, transition: "all 0.15s",
                                }}>
                                {actionLoading === selectedAgent.id + "approved" ? "Approving…" : "✓ Approve & Generate Code"}
                              </button>
                              <button
                                onClick={() => applyAgentAction(selectedAgent.id, "rejected", modalNotes)}
                                disabled={!!actionLoading}
                                style={{
                                  flex: 1, padding: 13, borderRadius: 10, border: "none", cursor: actionLoading ? "not-allowed" : "pointer",
                                  background: actionLoading ? T.text3 : T.red, color: "#fff", fontSize: 14, fontWeight: 700,
                                  fontFamily: "inherit", opacity: actionLoading ? 0.7 : 1, transition: "all 0.15s",
                                }}>
                                {actionLoading === selectedAgent.id + "rejected" ? "Rejecting…" : "✕ Reject Application"}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {selectedAgent.status === "approved" && (
                                <Btn variant="danger" onClick={() => applyAgentAction(selectedAgent.id, "rejected", modalNotes)} disabled={!!actionLoading}>
                                  Revoke Approval
                                </Btn>
                              )}
                              {selectedAgent.status === "rejected" && (
                                <Btn variant="ghost" style={{ color: T.green, background: T.greenSoft }} onClick={() => applyAgentAction(selectedAgent.id, "approved", modalNotes)} disabled={!!actionLoading}>
                                  Re-approve
                                </Btn>
                              )}
                              <Btn variant="ghost" onClick={() => applyAgentAction(selectedAgent.id, selectedAgent.status as "approved" | "rejected", modalNotes)}>
                                Save Notes
                              </Btn>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── VERIFICATIONS ──────────────────────────────────────── */}
            {activeTab === "verifications" && (() => {
              const FLAG_LABEL: Record<string, { label: string; color: string; bg: string }> = {
                missing_selfie:   { label: "No Selfie",    color: "#C2410C", bg: "#FFF7ED" },
                missing_id_photo: { label: "No ID Photo",  color: "#B45309", bg: "#FFFBEB" },
                missing_id_number:{ label: "No ID Number", color: "#7C3AED", bg: "#F5F3FF" },
                duplicate_cnic:   { label: "Duplicate CNIC", color: "#DC2626", bg: "#FEF2F2" },
              };
              const VSTATUS: Record<string, { label: string; color: string; bg: string }> = {
                pending:  { label: "Pending",  color: "#C2410C", bg: "#FFF7ED" },
                flagged:  { label: "Flagged",  color: "#DC2626", bg: "#FEF2F2" },
                verified: { label: "Verified", color: "#065F46", bg: "#ECFDF5" },
                rejected: { label: "Rejected", color: "#991B1B", bg: "#FEF2F2" },
              };
              const vFiltered = agents
                .filter(a => verifFilter === "all" || (a.verification_status || "pending") === verifFilter)
                .filter(a => {
                  const q = verifSearch.toLowerCase();
                  return !q || a.full_name.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q) || a.phone?.includes(q) || a.id_card_number?.includes(q);
                });
              const vCounts = {
                all: agents.length,
                pending:  agents.filter(a => (a.verification_status || "pending") === "pending").length,
                flagged:  agents.filter(a => a.verification_status === "flagged").length,
                verified: agents.filter(a => a.verification_status === "verified").length,
                rejected: agents.filter(a => a.verification_status === "rejected").length,
              };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
                    {([
                      { key: "all",      label: "Total",    value: vCounts.all,      accent: T.indigo },
                      { key: "pending",  label: "Pending",  value: vCounts.pending,  accent: T.amber },
                      { key: "flagged",  label: "Flagged",  value: vCounts.flagged,  accent: T.red },
                      { key: "verified", label: "Verified", value: vCounts.verified, accent: T.green },
                      { key: "rejected", label: "Rejected", value: vCounts.rejected, accent: "#6B7280" },
                    ] as { key: typeof verifFilter; label: string; value: number; accent: string }[]).map(s => (
                      <div key={s.key} className="kpi"
                        onClick={() => setVerifFilter(s.key)}
                        style={{
                          background: T.surface, borderRadius: 14, padding: "16px 18px", cursor: "pointer",
                          border: `1px solid ${verifFilter === s.key ? s.accent : T.border}`,
                          boxShadow: verifFilter === s.key ? `0 0 0 3px ${s.accent}20` : T.shadow,
                          transition: "all 0.15s",
                        }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.accent }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: T.text2, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Toolbar */}
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, color: T.text2 }}>{vFiltered.length} applicants</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="text" placeholder="Search name, CNIC, phone…" value={verifSearch}
                        onChange={e => setVerifSearch(e.target.value)}
                        style={{ height: 34, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, color: T.text, background: T.bg, width: 220 }} />
                      <button onClick={loadAgents} style={{ height: 34, padding: "0 12px", borderRadius: 8, background: T.indigoSoft, border: "none", fontSize: 12, cursor: "pointer", color: T.indigo, fontWeight: 700, fontFamily: "inherit" }}>↻</button>
                    </div>
                  </div>

                  {/* Table */}
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    {agentsLoading ? (
                      <div style={{ padding: 48, textAlign: "center", color: T.text3 }}>Loading…</div>
                    ) : vFiltered.length === 0 ? (
                      <div style={{ padding: 56, textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>◌</div>
                        <div style={{ fontSize: 14, color: T.text3 }}>No records found</div>
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead><tr>{["Applicant", "CNIC", "Documents", "Auto Flags", "Status", ""].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                          <tbody>
                            {vFiltered.map(a => {
                              const vs = VSTATUS[a.verification_status || "pending"];
                              const flags = a.auto_flags || [];
                              return (
                                <tr key={a.id} className="salon-row">
                                  <Td>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <Avatar name={a.full_name} size={32} />
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.full_name}</div>
                                        <div style={{ fontSize: 11, color: T.text3 }}>{a.phone} · {a.city}</div>
                                      </div>
                                    </div>
                                  </Td>
                                  <Td style={{ fontSize: 12, fontFamily: "monospace", color: T.text2 }}>
                                    {a.id_card_number || <span style={{ color: T.red, fontSize: 11 }}>Missing</span>}
                                  </Td>
                                  <Td>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {a.id_card_photo_url ? (
                                        <button onClick={() => setLightboxUrl(a.id_card_photo_url!)}
                                          style={{ padding: "3px 10px", borderRadius: 6, background: T.indigoSoft, color: T.indigo, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                          ID Card
                                        </button>
                                      ) : <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>No ID</span>}
                                      {a.selfie_photo_url ? (
                                        <button onClick={() => setLightboxUrl(a.selfie_photo_url!)}
                                          style={{ padding: "3px 10px", borderRadius: 6, background: T.greenSoft, color: T.green, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                          Selfie
                                        </button>
                                      ) : <span style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>No Selfie</span>}
                                      {a.address_proof_url && (
                                        <button onClick={() => setLightboxUrl(a.address_proof_url!)}
                                          style={{ padding: "3px 10px", borderRadius: 6, background: T.amberSoft, color: T.amber, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                          Address
                                        </button>
                                      )}
                                    </div>
                                  </Td>
                                  <Td>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {flags.length === 0
                                        ? <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>✓ Clean</span>
                                        : flags.map(f => {
                                          const fm = FLAG_LABEL[f] || { label: f, color: T.text2, bg: T.bg };
                                          return (
                                            <span key={f} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: fm.bg, color: fm.color }}>
                                              {fm.label}
                                            </span>
                                          );
                                        })
                                      }
                                    </div>
                                  </Td>
                                  <Td>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: vs.bg, color: vs.color }}>{vs.label}</span>
                                  </Td>
                                  <Td>
                                    <button className="action-btn"
                                      onClick={() => { setSelectedVerif(a); setVerifNotes(a.verification_notes || ""); }}
                                      style={{ padding: "5px 14px", borderRadius: 7, background: T.indigoSoft, color: T.indigo, border: "none", fontSize: 12, fontWeight: 600 }}>
                                      Review →
                                    </button>
                                  </Td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>

                  {/* Lightbox */}
                  {lightboxUrl && (
                    <div onClick={() => setLightboxUrl(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                      <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lightboxUrl} alt="Document" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} />
                        <button onClick={() => setLightboxUrl(null)}
                          style={{ position: "absolute", top: -12, right: -12, width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                          ×
                        </button>
                        <a href={lightboxUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ position: "absolute", bottom: -44, left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 99, textDecoration: "none", backdropFilter: "blur(8px)" }}>
                          Open full size ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Detail / Review Modal */}
                  {selectedVerif && (
                    <div onClick={e => { if (e.target === e.currentTarget) setSelectedVerif(null); }}
                      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                      <div style={{ background: T.surface, borderRadius: 20, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease" }}>
                        {/* Header */}
                        <div style={{ background: T.nav, borderRadius: "20px 20px 0 0", padding: "22px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <Avatar name={selectedVerif.full_name} size={44} />
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{selectedVerif.full_name}</div>
                              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{selectedVerif.phone} · {selectedVerif.city}</div>
                            </div>
                          </div>
                          <button onClick={() => setSelectedVerif(null)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
                        </div>

                        <div style={{ padding: "22px 24px" }}>
                          {/* Auto-flags */}
                          {(selectedVerif.auto_flags || []).length > 0 && (
                            <div style={{ background: T.redSoft, border: `1px solid #FECACA`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.red, marginBottom: 8 }}>⚠ Auto-detected issues</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {(selectedVerif.auto_flags || []).map(f => {
                                  const fm = FLAG_LABEL[f] || { label: f, color: T.red, bg: "#FEF2F2" };
                                  return <span key={f} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: fm.bg, color: fm.color }}>{fm.label}</span>;
                                })}
                              </div>
                            </div>
                          )}

                          {/* Documents preview */}
                          <div style={{ marginBottom: 18 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Documents</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                              {[
                                { label: "ID Card", url: selectedVerif.id_card_photo_url, accent: T.indigo },
                                { label: "Selfie", url: selectedVerif.selfie_photo_url, accent: T.green },
                                { label: "Address Proof", url: selectedVerif.address_proof_url, accent: T.amber },
                              ].map(doc => (
                                <div key={doc.label} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bg }}>
                                  {doc.url ? (
                                    <div style={{ position: "relative", cursor: "zoom-in" }} onClick={() => setLightboxUrl(doc.url!)}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={doc.url} alt={doc.label} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: 22, opacity: 0 }}>🔍</span>
                                      </div>
                                      <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: 11.5, fontWeight: 600, color: doc.accent }}>{doc.label}</span>
                                        <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>✓ Uploaded</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
                                      <div style={{ fontSize: 24, opacity: 0.3 }}>📄</div>
                                      <div style={{ fontSize: 11, color: T.text3 }}>{doc.label} not uploaded</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Info */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                            {[
                              { label: "CNIC / ID Number", value: selectedVerif.id_card_number || "—" },
                              { label: "Country", value: selectedVerif.country || "GB" },
                              { label: "Address", value: selectedVerif.street_address || "—" },
                              { label: "Postcode", value: selectedVerif.postcode || "—" },
                            ].map(f => (
                              <div key={f.label} style={{ background: T.bg, borderRadius: 9, padding: "10px 14px" }}>
                                <div style={{ fontSize: 10.5, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{f.label}</div>
                                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{f.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Admin notes */}
                          <div style={{ marginBottom: 18 }}>
                            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Verification Notes</label>
                            <textarea value={verifNotes} onChange={e => setVerifNotes(e.target.value)} rows={3}
                              placeholder="Internal notes about this document review…"
                              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, color: T.text, resize: "vertical", fontFamily: "inherit", background: T.bg }} />
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button
                              onClick={() => applyVerification(selectedVerif.id, "verified", verifNotes)}
                              disabled={!!verifyLoading}
                              style={{ flex: 1, minWidth: 120, padding: "12px", borderRadius: 10, border: "none", background: verifyLoading ? T.text3 : T.green, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: verifyLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: verifyLoading ? 0.7 : 1, transition: "all 0.15s" }}>
                              {verifyLoading === selectedVerif.id + "verified" ? "Verifying…" : "✓ Mark Verified"}
                            </button>
                            <button
                              onClick={() => applyVerification(selectedVerif.id, "flagged", verifNotes)}
                              disabled={!!verifyLoading}
                              style={{ flex: 1, minWidth: 120, padding: "12px", borderRadius: 10, border: "none", background: verifyLoading ? T.text3 : T.amber, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: verifyLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: verifyLoading ? 0.7 : 1, transition: "all 0.15s" }}>
                              {verifyLoading === selectedVerif.id + "flagged" ? "Flagging…" : "⚑ Flag for Review"}
                            </button>
                            <button
                              onClick={() => applyVerification(selectedVerif.id, "rejected", verifNotes)}
                              disabled={!!verifyLoading}
                              style={{ flex: 1, minWidth: 120, padding: "12px", borderRadius: 10, border: "none", background: verifyLoading ? T.text3 : T.red, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: verifyLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: verifyLoading ? 0.7 : 1, transition: "all 0.15s" }}>
                              {verifyLoading === selectedVerif.id + "rejected" ? "Rejecting…" : "✕ Reject Documents"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── SETTINGS ─────────────────────────────────────────────── */}
            {activeTab === "settings" && (
              <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 3 }}>Maintenance Mode</div>
                      <div style={{ fontSize: 12.5, color: T.text3 }}>Shows a maintenance page to all salon users</div>
                    </div>
                    <button
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      style={{
                        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", border: "none", transition: "all 0.15s",
                        background: maintenanceMode ? T.redSoft : T.indigoSoft,
                        color: maintenanceMode ? T.red : T.indigo,
                      }}>
                      {maintenanceMode ? "Turn OFF" : "Turn ON"}
                    </button>
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10 }}>Admin Access</div>
                  <div style={{ fontSize: 12.5, color: T.text2, marginBottom: 10 }}>Only this email can access the admin panel:</div>
                  <div style={{
                    fontSize: 13, color: T.indigo, background: T.indigoSoft,
                    padding: "10px 14px", borderRadius: 8, fontFamily: "monospace",
                    border: `1px solid #C7D2FE`,
                  }}>{ADMIN_EMAIL}</div>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Add Salon Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); setAddError(""); } }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
          <div style={{
            background: T.surface, borderRadius: 20, width: "100%", maxWidth: 480,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease",
          }}>
            {/* Modal header */}
            <div style={{
              background: T.nav, borderRadius: "20px 20px 0 0",
              padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Add New Salon</div>
              <button onClick={() => { setShowAddModal(false); setAddError(""); }} style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
                padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1,
              }}>×</button>
            </div>

            {/* Form body */}
            <div style={{ padding: 24 }}>
              {addError && (
                <div style={{
                  background: T.redSoft, border: `1px solid #FECACA`,
                  borderRadius: 9, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: T.red,
                }}>{addError}</div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Salon name */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Salon Name *
                  </label>
                  <input
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Luxe Hair Studio"
                    style={{
                      width: "100%", height: 38, padding: "0 12px", border: `1px solid ${T.border}`,
                      borderRadius: 8, fontSize: 13.5, color: T.text, background: T.bg, boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Owner email */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Owner Email *
                  </label>
                  <input
                    type="email"
                    value={addForm.ownerEmail}
                    onChange={e => setAddForm(f => ({ ...f, ownerEmail: e.target.value }))}
                    placeholder="owner@theirsalon.co.uk"
                    style={{
                      width: "100%", height: 38, padding: "0 12px", border: `1px solid ${T.border}`,
                      borderRadius: 8, fontSize: 13.5, color: T.text, background: T.bg, boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>
                    A set-password email will be sent to this address.
                  </div>
                </div>

                {/* Business type */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Business Type
                  </label>
                  <select
                    value={addForm.businessType}
                    onChange={e => setAddForm(f => ({ ...f, businessType: e.target.value }))}
                    style={{
                      width: "100%", height: 38, padding: "0 12px", border: `1px solid ${T.border}`,
                      borderRadius: 8, fontSize: 13.5, color: T.text, background: T.bg, fontFamily: "inherit",
                    }}
                  >
                    <option value="salon">Salon</option>
                    <option value="barbershop">Barbershop</option>
                    <option value="spa">Spa</option>
                    <option value="nail studio">Nail Studio</option>
                    <option value="beauty studio">Beauty Studio</option>
                  </select>
                </div>

                {/* Plan */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Plan
                  </label>
                  <select
                    value={addForm.plan}
                    onChange={e => setAddForm(f => ({ ...f, plan: e.target.value }))}
                    style={{
                      width: "100%", height: 38, padding: "0 12px", border: `1px solid ${T.border}`,
                      borderRadius: 8, fontSize: 13.5, color: T.text, background: T.bg, fontFamily: "inherit",
                    }}
                  >
                    {PLAN_OPTIONS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <Btn variant="outline" onClick={() => { setShowAddModal(false); setAddError(""); }} style={{ flex: 1 }}>
                  Cancel
                </Btn>
                <button
                  onClick={createSalon}
                  disabled={addLoading || !addForm.name.trim() || !addForm.ownerEmail.trim()}
                  style={{
                    flex: 2, height: 38, borderRadius: 10, border: "none", fontFamily: "inherit",
                    background: (addLoading || !addForm.name.trim() || !addForm.ownerEmail.trim()) ? T.text3 : T.indigo,
                    color: "#fff", fontWeight: 700, fontSize: 13.5,
                    cursor: (addLoading || !addForm.name.trim() || !addForm.ownerEmail.trim()) ? "not-allowed" : "pointer",
                  }}
                >
                  {addLoading ? "Creating…" : "Create Salon & Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}