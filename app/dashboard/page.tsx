"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarPlus, Tag, UserPlus, Scissors, BarChart3, Settings2,
  Clock, TrendingUp, BookOpen, Users,
  Search, Download, Plus,
  CheckCircle2, XCircle, Trash2,
  Link2, ExternalLink, BarChart2,
  Sparkles, Leaf, Dumbbell, Stethoscope,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "./components/DashboardShell";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "./components/Modal";
import EmptyState from "./components/EmptyState";
import { SkeletonDashboard } from "./components/SkeletonLoader";
import { useToast } from "./components/Toast";
import type { Salon, Appointment, Service, Offer } from "../types";
import OnboardingChecklist from "./components/OnboardingChecklist";
import { useSalon } from "./context/SalonContext";
import PushNotificationButton from "@/app/components/PushNotificationButton";

type StaffItem = { id: string; name: string };

const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];

const PLAN_FEATURES: Record<string, { color: string; bg: string; border: string; badge: string; features: string[]; limit: string }> = {
  Starter: { color: "#aab1c4", bg: "#1C2438", border: "#2a3350", badge: "STARTER", features: ["Up to 50 bookings/mo", "1 staff member", "Basic analytics", "Email notifications", "Public booking page"], limit: "50 bookings/month" },
  Professional: { color: "#C9A24B", bg: "rgba(201,162,75,0.10)", border: "rgba(201,162,75,0.25)", badge: "PROFESSIONAL", features: ["Unlimited bookings", "Up to 5 staff", "Advanced analytics", "SMS + Email", "Custom offers", "Priority support"], limit: "Unlimited bookings" },
  Growth: { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", badge: "GROWTH", features: ["Unlimited bookings", "Up to 15 staff", "Revenue reports", "SMS + Email + WhatsApp", "Staff performance", "API access"], limit: "Unlimited bookings" },
  Enterprise: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", badge: "ENTERPRISE", features: ["Unlimited everything", "Unlimited staff", "White-label option", "Dedicated support", "Custom integrations", "SLA 99.9%"], limit: "Unlimited everything" },
};

interface SalonExtended {
  subscription_status?: string;
  subscription_plan?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
}

/* ─── STATUS PILL ─────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    confirmed: { bg: "rgba(16,185,129,0.12)", color: "#34D399", border: "rgba(16,185,129,0.25)", dot: "#10B981" },
    pending:   { bg: "rgba(245,158,11,0.12)",  color: "#FCD34D", border: "rgba(245,158,11,0.25)", dot: "#F59E0B" },
    cancelled: { bg: "rgba(239,68,68,0.12)",   color: "#FCA5A5", border: "rgba(239,68,68,0.25)", dot: "#EF4444" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: "0.2px", textTransform: "capitalize", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0, boxShadow: `0 0 6px ${s.dot}` }} />
      {status}
    </span>
  );
}

/* ─── QUICK ACTION ────────────────────────────────────────────── */
function QuickAction({ lucideIcon, label, color, onClick }: { lucideIcon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)", flex: 1, minWidth: 76, fontFamily: "inherit" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + "55"; e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.35), 0 0 0 1px ${color}33`; e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"; e.currentTarget.style.background = `${color}14`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: color, transition: "transform 0.2s" }}>
        {lucideIcon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", letterSpacing: "0.1px" }}>{label}</span>
    </button>
  );
}

/* ─── MINI STAT ───────────────────────────────────────────────── */
function MiniStat({ label, value, color, lucideIcon, sub }: { label: string; value: string | number; color: string; lucideIcon: React.ReactNode; sub?: string }) {
  return (
    <div style={{ background: "linear-gradient(145deg,#100F1C,#130F2A)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px 18px", position: "relative", overflow: "hidden", transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)", cursor: "default", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px ${color}33`; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = `${color}33`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
    >
      {/* Gradient top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}44)`, borderRadius: "18px 18px 0 0" }} />
      {/* Ambient glow orb */}
      <div style={{ position: "absolute", bottom: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: `${color}0C`, pointerEvents: "none", filter: "blur(20px)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.9px" }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: `${color}18`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", color: color, boxShadow: `0 4px 14px ${color}25` }}>
          {lucideIcon}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: "#F7F5EF", letterSpacing: "-1.5px", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 7, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

/* ─── SEARCH BAR ──────────────────────────────────────────────── */
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 13px", minWidth: 220, transition: "all 0.18s" }}
      onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(201,162,75,0.5)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(201,162,75,0.12)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(201,162,75,0.05)"; }}
      onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
    >
      <Search size={13} strokeWidth={2} color="rgba(255,255,255,0.22)" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search..."} style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "#F7F5EF", fontFamily: "inherit", width: "100%" }} />
      {value && <button onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>}
    </div>
  );
}

/* ─── REVENUE MINI BARS ───────────────────────────────────────── */
function RevenueMiniChart({ appointments }: { appointments: Appointment[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const dayRevenue = days.map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (now.getDay() - 1 - i));
    return appointments.filter(a => {
      const ad = new Date(a.date_time);
      return ad.toDateString() === d.toDateString() && a.status === "confirmed";
    }).reduce((s, a) => s + (a.services?.price || 0), 0);
  });
  const max = Math.max(...dayRevenue, 1);
  const todayIdx = (now.getDay() + 6) % 7;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, paddingTop: 8 }}>
      {dayRevenue.map((rev, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div title={`£${rev}`} style={{ width: "100%", borderRadius: "5px 5px 0 0", height: `${Math.max((rev / max) * 52, 4)}px`, background: i === todayIdx ? "linear-gradient(180deg,#C9A24B,#4C1D95)" : "rgba(201,162,75,0.15)", boxShadow: i === todayIdx ? "0 0 12px rgba(201,162,75,0.4)" : "none", transition: "all 0.3s ease", cursor: "default" }} />
          <span style={{ fontSize: 9, color: i === todayIdx ? "#C9A24B" : "rgba(255,255,255,0.25)", fontWeight: i === todayIdx ? 800 : 500 }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── MAIN PAGE ───────────────────────────────────────────────── */
const STAFF_ICON_MAP: Record<string, React.ReactNode> = {
  scissors:    <Scissors size={20} strokeWidth={1.8} />,
  sparkles:    <Sparkles size={20} strokeWidth={1.8} />,
  leaf:        <Leaf size={20} strokeWidth={1.8} />,
  dumbbell:    <Dumbbell size={20} strokeWidth={1.8} />,
  stethoscope: <Stethoscope size={20} strokeWidth={1.8} />,
  users:       <Users size={20} strokeWidth={1.8} />,
};
const STAFF_EMOJI_MAP: Record<string, string> = {
  scissors:"✂️", sparkles:"✨", leaf:"🌿", dumbbell:"🏋️", stethoscope:"🩺", users:"👥",
};

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
  const [offerForm, setOfferForm] = useState({ title: "", description: "", discount_type: "percentage", discount_value: "", valid_until: "", active: true });

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalon(profile.salon);
      const id = profile.salon.id;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: appts }, { data: staffData }, { data: svcs }, { data: ofrs }] = await Promise.all([
        supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", id).order("date_time", { ascending: true }),
        supabase.from("staff").select("id,name").eq("salon_id", id).eq("active", true),
        supabase.from("services").select("*").eq("salon_id", id),
        supabase.from("offers").select("*").eq("salon_id", id).eq("active", true).or(`valid_until.is.null,valid_until.gte.${today}`).order("created_at", { ascending: false }),
      ]);
      setAppointments(appts || []); setStaff(staffData || []); setServices(svcs || []); setOffers(ofrs || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const reloadAppts = useCallback(async () => {
    if (!salon) return;
    const { data } = await supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", salon.id).order("date_time", { ascending: true });
    setAppointments(data || []);
  }, [salon]);

  /* ── Update appointment status ── */
  const handleUpdateStatus = useCallback(async (id: string, status: "confirmed" | "pending" | "cancelled") => {
    setUpdatingId(id);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update status"); }
    else {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      toast.success(`Appointment ${status}`);
    }
    setUpdatingId(null);
  }, [toast]);

  /* ── Delete appointment ── */
  const handleDeleteAppt = useCallback(async (id: string) => {
    if (!confirm("Delete this appointment?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    setAppointments(prev => prev.filter(a => a.id !== id));
    toast.success("Appointment deleted");
  }, [toast]);

  const handleNewBooking = useCallback(async () => {
    if (!salon || !formData.client_name || !formData.date || !formData.time) { toast.error("Fill required fields"); return; }
    const date_time = new Date(formData.date + "T" + formData.time).toISOString();
    const { data: inserted, error } = await supabase.from("appointments").insert({
      salon_id: salon.id,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      service_id: formData.service_id || null,
      staff_id: formData.staff_id || null,
      date_time,
      status: "confirmed",
    }).select("id, review_token").single();
    if (error) { toast.error("Failed to create booking"); return; }
    // Send email + WhatsApp via the same route as online bookings
    if (formData.client_email && inserted?.id) {
      let confirmationSent = false;
      try {
        const res = await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: inserted.id, token: inserted.review_token, skipOwnerPush: true }),
        });
        confirmationSent = res.ok;
      } catch { /* non-fatal */ }
      toast[confirmationSent ? "success" : "error"](
        confirmationSent ? "Booking created! Confirmation sent to client." : "Booking created, but the confirmation email failed to send."
      );
    } else {
      toast.success("Booking created!");
    }
    setShowModal(false);
    setFormData({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
    await reloadAppts();
  }, [salon, formData, toast, reloadAppts]);

  const handleAddOffer = useCallback(async () => {
    if (!salon || !offerForm.title) { toast.error("Title required"); return; }
    const { data, error } = await supabase.from("offers").insert({ salon_id: salon.id, title: offerForm.title, description: offerForm.description, discount_type: offerForm.discount_type, discount_value: parseFloat(offerForm.discount_value) || 0, valid_until: offerForm.valid_until || null, active: offerForm.active }).select();
    if (error) { toast.error("Failed to add offer"); return; }
    if (data) setOffers(p => [data[0], ...p]);
    toast.success("Offer added!");
    setShowOfferModal(false);
    setOfferForm({ title: "", description: "", discount_type: "percentage", discount_value: "", valid_until: "", active: true });
  }, [salon, offerForm, toast]);

  const handleToggleOffer = useCallback(async (id: string, current: boolean) => {
    await supabase.from("offers").update({ active: !current }).eq("id", id);
    setOffers(p => p.map(o => o.id === id ? { ...o, active: !current } : o));
    toast.success(current ? "Offer paused" : "Offer activated");
  }, [toast]);

  const handleDeleteOffer = useCallback(async (id: string) => {
    await supabase.from("offers").delete().eq("id", id);
    setOffers(p => p.filter(o => o.id !== id));
    toast.success("Offer removed");
  }, [toast]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${origin}/book/${salon?.slug}`);
    setCopied(true);
    toast.success("Booking link copied!");
    setTimeout(() => setCopied(false), 2500);
  }, [origin, salon, toast]);

  /* ── Export CSV ── */
  const handleExportCSV = useCallback(() => {
    const rows = [["Client", "Service", "Staff", "Date & Time", "Amount", "Status"]];
    appointments.forEach(a => {
      rows.push([a.client_name, a.services?.name || "", a.staff?.name || "", new Date(a.date_time).toLocaleString("en-GB"), a.services?.price ? `£${a.services.price}` : "", a.status]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    toast.success("CSV exported!");
  }, [appointments, toast]);

  /* ── Computed values ── */
  const todayAppts = useMemo(() => {
    const t = new Date().toDateString();
    return appointments.filter(a => new Date(a.date_time).toDateString() === t);
  }, [appointments]);
  const upcomingAppts = useMemo(() => {
    const n = new Date();
    return appointments.filter(a => new Date(a.date_time) > n && a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show");
  }, [appointments]);
  const confirmedAppts = useMemo(() => appointments.filter(a => a.status === "confirmed"), [appointments]);
  const pendingAppts = useMemo(() => appointments.filter(a => a.status === "pending"), [appointments]);
  const revenue = useMemo(() => todayAppts.reduce((s, a) => s + (a.services?.price || 0), 0), [todayAppts]);
  const totalRevenue = useMemo(() => confirmedAppts.reduce((s, a) => s + (a.services?.price || 0), 0), [confirmedAppts]);

  const filteredAppts = useMemo(() => {
    let list = appointments;
    if (activeTab === "Today")     list = todayAppts;
    if (activeTab === "Upcoming")  list = upcomingAppts;
    if (activeTab === "Confirmed") list = confirmedAppts;
    if (activeTab === "Pending")   list = pendingAppts;
    if (activeTab === "Completed") list = appointments.filter(a => a.status === "completed");
    if (activeTab === "Cancelled") list = appointments.filter(a => a.status === "cancelled");
    if (activeTab === "No-show")   list = appointments.filter(a => a.status === "no_show");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.client_name?.toLowerCase().includes(q) || a.services?.name?.toLowerCase().includes(q) || a.staff?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [activeTab, appointments, todayAppts, upcomingAppts, confirmedAppts, pendingAppts, searchQuery]);

  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? "Good morning ☀️" : h < 17 ? "Good afternoon 👋" : "Good evening 🌙"; }, []);
  const plan = salon?.plan || "Starter";
  const planInfo = PLAN_FEATURES[plan] || PLAN_FEATURES.Starter;

  const salonExt = salon as unknown as SalonExtended;
  const subStatus = salonExt?.subscription_status || "trial";
  const subPlan = salonExt?.subscription_plan || "starter";
  const trialEnd = salonExt?.trial_ends_at || null;
  const periodEnd = salonExt?.current_period_end || null;
  const hasCustId = !!(salonExt?.stripe_customer_id);
  const trialDaysLeft = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    return trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86400000)) : 0;
  }, [trialEnd]);

  const SUB_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    trial: { label: "Free Trial", color: "#C9A24B", bg: "rgba(201,162,75,0.12)" },
    trialing: { label: "Trial", color: "#E7C878", bg: "rgba(201,162,75,0.08)" },
    active: { label: "Active", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
    past_due: { label: "Past Due", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    cancelled: { label: "Cancelled", color: "#DC2626", bg: "rgba(239,68,68,0.12)" },
    unpaid: { label: "Unpaid", color: "#DC2626", bg: "rgba(239,68,68,0.12)" },
  };
  const statusBadge = SUB_STATUS_MAP[subStatus] || SUB_STATUS_MAP.trial;
  const PLAN_PRICE: Record<string, string> = { starter: "£29", pro: "£59", business: "£99" };

  const handleManageSub = async () => {
    if (!hasCustId) { router.push("/subscribe"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/subscription/portal", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else toast.error("Could not open billing portal");
  };

  /* ── Loading ── */
  if (loading) return (
    <DashboardShell salonName="" topbar={<header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", height: 58, display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}><div style={{ width: 36, height: 12, borderRadius: 6 }} className="skeleton" /><div style={{ width: 140, height: 12, borderRadius: 6 }} className="skeleton" /></header>}>
      <SkeletonDashboard />
    </DashboardShell>
  );

  /* ── Topbar ── */
  const Topbar = (
    <header style={{ background: "rgba(10,9,20,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#F7F5EF", letterSpacing: "-0.4px" }}>{greeting}, {salon?.name?.split(" ")[0]}</div>
          <div className="dash-greeting-date" style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Plan badge */}
        <div className="dash-topbar-badge" style={{ padding: "5px 14px", borderRadius: 99, background: "rgba(201,162,75,0.15)", border: "1px solid rgba(201,162,75,0.25)", fontSize: 10.5, fontWeight: 900, color: "#C9A24B", letterSpacing: "1px" }}>{planInfo.badge}</div>
        {/* Export */}
        <button onClick={handleExportCSV} title="Export CSV" className="dash-topbar-export"
          style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,75,0.12)"; e.currentTarget.style.borderColor = "rgba(201,162,75,0.28)"; e.currentTarget.style.color = "#C9A24B"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
        ><Download size={15} strokeWidth={2} /></button>
        {/* New Booking */}
        <button onClick={() => setShowModal(true)} className="dash-topbar-newbtn"
          style={{ display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#C9A24B,#0E1320)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", boxShadow: "0 4px 18px rgba(201,162,75,0.45)", whiteSpace: "nowrap", letterSpacing: "-0.1px", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(201,162,75,0.65)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(201,162,75,0.45)"; }}
        ><Plus size={15} strokeWidth={2.5} /> New {vc.bookingSingular}</button>
      </div>
    </header>
  );

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <DashboardShell salonName={salon?.name} topbar={Topbar}>
      <div className="dash-wrap" style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>


        {/* ── Welcome Banner ────────────────────────────────────── */}
        <div className="dash-banner" style={{ background: "linear-gradient(135deg,#0F0B2D 0%,#1E1448 30%,#4C1D95 65%,#C9A24B 100%)", borderRadius: 24, padding: "32px 36px", marginBottom: 24, position: "relative", overflow: "hidden", boxShadow: "0 16px 56px rgba(201,162,75,0.35)" }}>
          {/* decorative circles */}
          <div style={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", bottom: -80, right: 100, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
          <div style={{ position: "absolute", top: 20, right: 200, width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "3px", textTransform: "uppercase", marginBottom: 8 }}>{vc.dashboardLabel}</div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-1px", margin: 0, lineHeight: 1.1 }}>{salon?.name}</h1>
              <p className="dash-banner-meta" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: 0, marginTop: 8 }}>
                {todayAppts.length} {todayAppts.length !== 1 ? vc.bookingPlural.toLowerCase() : vc.bookingSingular.toLowerCase()} today · £{revenue} earned so far
              </p>
            </div>
            <div className="dash-banner-btns" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={handleCopyLink}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)", color: "#fff", border: `1px solid ${copied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.14)"}`, borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", backdropFilter: "blur(8px)" }}>
                <Link2 size={13} strokeWidth={2} />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button onClick={() => window.open(`/book/${salon?.slug}`, "_blank")}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", backdropFilter: "blur(8px)" }}>
                <ExternalLink size={13} strokeWidth={2} />
                Preview
              </button>
              <a href="/dashboard/reports"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", textDecoration: "none", backdropFilter: "blur(8px)" }}>
                <BarChart2 size={13} strokeWidth={2} />
                Reports
              </a>
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ─────────────────────────────────────────── */}
        <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          <MiniStat label="Upcoming" value={upcomingAppts.length} color="#C9A24B" lucideIcon={<Clock size={17} strokeWidth={1.8} />} sub={`${confirmedAppts.length} confirmed`} />
          <MiniStat label="Total Revenue" value={`£${totalRevenue}`} color="#10B981" lucideIcon={<TrendingUp size={17} strokeWidth={1.8} />} sub="all confirmed" />
          <MiniStat label={`Total ${vc.bookingPlural}`} value={appointments.length} color="#E7C878" lucideIcon={<BookOpen size={17} strokeWidth={1.8} />} sub={`${pendingAppts.length} pending`} />
          <MiniStat label={vc.staffPlural} value={staff.length} color="#EC4899" lucideIcon={<Users size={17} strokeWidth={1.8} />} sub="active team" />
        </div>

        {/* ── Push Notifications ─────────────────────────────────── */}
        {salon?.id && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <PushNotificationButton salonId={salon.id} />
          </div>
        )}

        {/* ── Quick Actions ──────────────────────────────────────── */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "20px 22px", marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.25)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 16 }}>Quick Actions</div>
          <div className="dash-quick-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
            <QuickAction lucideIcon={<CalendarPlus size={20} strokeWidth={1.8} />} label={`New ${vc.bookingSingular}`} color="#C9A24B" onClick={() => setShowModal(true)} />
            <QuickAction lucideIcon={<Tag size={20} strokeWidth={1.8} />} label="Add Offer" color="#10B981" onClick={() => setShowOfferModal(true)} />
            <QuickAction lucideIcon={<UserPlus size={20} strokeWidth={1.8} />} label={`Add ${vc.clientSingular}`} color="#E7C878" onClick={() => router.push("/dashboard/clients")} />
            <QuickAction lucideIcon={STAFF_ICON_MAP[vc.staffIcon] ?? <Scissors size={20} strokeWidth={1.8} />} label={`Add ${vc.staffSingular}`} color="#EC4899" onClick={() => router.push("/dashboard/staff")} />
            <QuickAction lucideIcon={<BarChart3 size={20} strokeWidth={1.8} />} label="Reports" color="#F59E0B" onClick={() => router.push("/dashboard/reports")} />
            <QuickAction lucideIcon={<Settings2 size={20} strokeWidth={1.8} />} label="Settings" color="#06B6D4" onClick={() => router.push("/dashboard/settings")} />
          </div>
        </div>


        {/* ── Two-Column Layout ─────────────────────────────────── */}
        <div className="dash-cols" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* LEFT ────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>


              {/* All Appointments Table */}
              <div style={{ background: "#100F1C", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>All {vc.bookingPlural}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={`Search ${vc.clientSingular.toLowerCase()}, service...`} />
                    <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", padding: 3, borderRadius: 10 }}>
                      {["All", "Today", "Upcoming", "Confirmed", "Pending", "Completed", "Cancelled", "No-show"].map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                          style={{ fontSize: 11.5, padding: "5px 12px", borderRadius: 8, border: "none", background: activeTab === t ? "rgba(201,162,75,0.25)" : "transparent", color: activeTab === t ? "#C9A24B" : "rgba(255,255,255,0.35)", cursor: "pointer", fontWeight: activeTab === t ? 800 : 500, boxShadow: activeTab === t ? "0 1px 4px rgba(0,0,0,0.2)" : "none", transition: "all 0.12s", whiteSpace: "nowrap" }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredAppts.length === 0 ? (
                  <EmptyState icon="📋" title="No appointments found" description={searchQuery ? "Try a different search term" : "No appointments match this filter"} />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    {/* Desktop table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                      <thead className="dash-table-head">
                        <tr>
                          {["Status", vc.clientSingular, "Service", vc.staffSingular, "Date & Time", "Amount", "Actions"].map(h => (
                            <th key={h} style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.3)", textAlign: "left", padding: "11px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppts.map(a => (
                          <React.Fragment key={a.id}>
                            {/* Desktop row */}
                            <tr key={`row-${a.id}`} className="dash-appt-row dk-table-row" style={{ transition: "background 0.1s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                            >
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><StatusPill status={a.status} /></td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13.5, fontWeight: 800, color: "#F7F5EF" }}>{a.client_name}</td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{a.services?.name || "—"}</td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{a.staff?.name || "—"}</td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 12.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>{new Date(a.date_time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 800, color: "#34D399" }}>{a.services?.price ? `£${a.services.price}` : "—"}</td>
                              <td style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  {a.status !== "confirmed" && (
                                    <button onClick={() => handleUpdateStatus(a.id, "confirmed")} disabled={updatingId === a.id}
                                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer", opacity: updatingId === a.id ? 0.5 : 1 }}>
                                      <CheckCircle2 size={13} strokeWidth={2} />
                                    </button>
                                  )}
                                  {a.status !== "cancelled" && (
                                    <button onClick={() => handleUpdateStatus(a.id, "cancelled")} disabled={updatingId === a.id}
                                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#FCA5A5", cursor: "pointer", opacity: updatingId === a.id ? 0.5 : 1 }}>
                                      <XCircle size={13} strokeWidth={2} />
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteAppt(a.id)}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.15s" }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; e.currentTarget.style.color = "#FCA5A5"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                  ><Trash2 size={13} strokeWidth={2} /></button>
                                </div>
                              </td>
                            </tr>
                            {/* Mobile card */}
                            <tr key={`card-${a.id}`} className="dash-appt-card" style={{ display: "none" }}>
                              <td colSpan={7} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: "#F7F5EF", marginBottom: 2 }}>{a.client_name}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{a.services?.name || "No service"}{a.staff?.name ? ` · ${a.staff.name}` : ""}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{new Date(a.date_time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{a.services?.price ? ` · £${a.services.price}` : ""}</div>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                                    <StatusPill status={a.status} />
                                    <div style={{ display: "flex", gap: 5 }}>
                                      {a.status !== "confirmed" && <button onClick={() => handleUpdateStatus(a.id, "confirmed")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", cursor: "pointer" }}><CheckCircle2 size={13} strokeWidth={2} /></button>}
                                      {a.status !== "cancelled" && <button onClick={() => handleUpdateStatus(a.id, "cancelled")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#FCA5A5", cursor: "pointer" }}><XCircle size={13} strokeWidth={2} /></button>}
                                      <button onClick={() => handleDeleteAppt(a.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}><Trash2 size={13} strokeWidth={2} /></button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                    <div className="dash-table-footer" style={{ padding: "12px 22px", fontSize: 12, color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      Showing {filteredAppts.length} of {appointments.length} total {vc.bookingPlural.toLowerCase()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT ───────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Revenue Chart */}
              <div style={{ background: "#100F1C", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", padding: "18px 22px", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F7F5EF", marginBottom: 4 }}>This Week&apos;s Revenue</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Daily breakdown (confirmed)</div>
                <RevenueMiniChart appointments={appointments} />
              </div>

              {/* Subscription Plan */}
              <div style={{ background: "#100F1C", border: "1px solid rgba(201,162,75,0.2)", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(201,162,75,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1.5px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Current Plan</div>
                    <div style={{ padding: "4px 12px", borderRadius: 99, background: "rgba(201,162,75,0.2)", color: "#C9A24B", fontSize: 10, fontWeight: 900, letterSpacing: "0.8px", border: "1px solid rgba(201,162,75,0.3)" }}>{statusBadge.label}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#F7F5EF", letterSpacing: "-0.5px", textTransform: "capitalize" }}>{subPlan} Plan</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{PLAN_PRICE[subPlan] || "£29"}/month</div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  {(subStatus === "trial" || subStatus === "trialing") && (
                    <div style={{ background: trialDaysLeft <= 3 ? "rgba(239,68,68,0.10)" : "rgba(201,162,75,0.10)", border: `1.5px solid ${trialDaysLeft <= 3 ? "rgba(239,68,68,0.25)" : "rgba(201,162,75,0.25)"}`, borderRadius: 12, padding: "11px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: trialDaysLeft <= 3 ? "#EF4444" : "#C9A24B" }}>
                        {trialDaysLeft === 0 ? "⚠️ Trial ended — subscribe to continue" : `🎁 ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in free trial`}
                      </div>
                    </div>
                  )}
                  {subStatus === "active" && periodEnd && (
                    <div style={{ background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "11px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#10B981" }}>✅ Next billing: {new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                  )}
                  {subStatus === "past_due" && (
                    <div style={{ background: "rgba(245,158,11,0.10)", border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "11px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#F59E0B" }}>⚠️ Payment failed — update your card</div>
                    </div>
                  )}
                  <button onClick={handleManageSub}
                    style={{ width: "100%", textAlign: "center", padding: "12px", background: `linear-gradient(135deg,${statusBadge.color} 0%,${statusBadge.color}cc 100%)`, color: "#fff", borderRadius: 12, fontSize: 13.5, fontWeight: 800, border: "none", cursor: "pointer", letterSpacing: "-0.2px", boxShadow: `0 4px 14px ${statusBadge.color}30`, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                  >
                    {subStatus === "active" || subStatus === "trialing" ? "Manage Subscription →" : hasCustId ? "Reactivate / Upgrade →" : "Choose a Plan →"}
                  </button>
                  {subStatus !== "active" && <div style={{ textAlign: "center", fontSize: 11.5, color: "#aab1c4", marginTop: 10 }}>Plans from £29/month · Cancel anytime</div>}
                </div>
              </div>

              {/* Special Offers */}
              <div style={{ background: "#100F1C", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>Special Offers</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{offers.length} active offer{offers.length !== 1 ? "s" : ""}</div>
                  </div>
                  <button onClick={() => setShowOfferModal(true)}
                    style={{ padding: "7px 16px", background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}
                  >+ Add</button>
                </div>
                {offers.length === 0 ? (
                  <EmptyState icon="🎁" title="No offers yet" description="Attract clients with special deals" action={{ label: "+ Create Offer", onClick: () => setShowOfferModal(true) }} />
                ) : (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {offers.map(offer => {
                      const label = offer.discount_type === "percentage" ? `${offer.discount_value}% off` : `£${offer.discount_value} off`;
                      const expired = offer.valid_until && new Date(offer.valid_until) < new Date();
                      return (
                        <div key={offer.id}
                          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", opacity: offer.active ? 1 : 0.5, transition: "all 0.18s", background: "rgba(255,255,255,0.02)" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,162,75,0.25)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; e.currentTarget.style.background = "rgba(201,162,75,0.04)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#F7F5EF", lineHeight: 1.3 }}>{offer.title}</div>
                            <label style={{ position: "relative", width: 32, height: 18, cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
                              <input type="checkbox" checked={offer.active} onChange={() => handleToggleOffer(offer.id, offer.active)} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{ position: "absolute", inset: 0, background: offer.active ? "#10B981" : "#aab1c4", borderRadius: 99, transition: "background 0.18s" }}>
                                <span style={{ position: "absolute", width: 12, height: 12, left: offer.active ? 17 : 3, top: 3, background: "#1C2438", borderRadius: "50%", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                              </span>
                            </label>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)" }}>{label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: expired ? "#EF4444" : "#94A3B8", fontWeight: 500 }}>{expired ? "Expired" : offer.valid_until ? `Until ${new Date(offer.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No expiry"}</span>
                              <button onClick={() => handleDeleteOffer(offer.id)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 0, width: 24, height: 24, transition: "color 0.12s" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#FCA5A5"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
                              ><Trash2 size={14} strokeWidth={2} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Team Overview */}
              <div style={{ background: "#100F1C", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>{vc.staffPlural} Overview</div>
                  <a href="/dashboard/staff" style={{ fontSize: 12.5, fontWeight: 700, color: "#C9A24B", textDecoration: "none", padding: "6px 14px", background: "rgba(201,162,75,0.12)", borderRadius: 8, border: "1px solid rgba(201,162,75,0.2)" }}>Manage →</a>
                </div>
                {staff.length === 0 ? (
                  <EmptyState icon={STAFF_EMOJI_MAP[vc.staffIcon] ?? "✂️"} title={`No ${vc.staffPlural.toLowerCase()}`} description={`Add ${vc.staffPlural.toLowerCase()} to assign ${vc.bookingPlural.toLowerCase()}`} action={{ label: `Add ${vc.staffSingular}`, onClick: () => router.push("/dashboard/staff") }} />
                ) : (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    {staff.slice(0, 5).map(s => {
                      const colors = ["#C9A24B", "#10B981", "#F59E0B", "#EF4444", "#E7C878"];
                      const bg = colors[s.name.charCodeAt(0) % colors.length];
                      const initials = s.name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
                      const staffAppts = appointments.filter(a => a.staff_id === s.id && a.status === "confirmed");
                      return (
                        <div key={s.id}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, border: "1px solid rgba(255,255,255,0.07)", transition: "all 0.12s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(201,162,75,0.2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
                        >
                          <div style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0, boxShadow: `0 4px 10px ${bg}55` }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#F7F5EF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)" }}>{staffAppts.length} confirmed {staffAppts.length !== 1 ? vc.bookingPlural.toLowerCase() : vc.bookingSingular.toLowerCase()}</div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)", flexShrink: 0 }}>Active</div>
                        </div>
                      );
                    })}
                    {staff.length > 5 && <div style={{ fontSize: 12, color: "#aab1c4", textAlign: "center", padding: "6px 0" }}>+{staff.length - 5} more {vc.staffPlural.toLowerCase()}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

      {/* ── New Booking Modal ─────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={`New ${vc.bookingSingular}`}>
        <FormGroup label="Client Name *"><Input placeholder="Sarah Johnson" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} /></FormGroup>
        <FormGroup label="Email"><Input type="email" placeholder="sarah@email.com" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} /></FormGroup>
        <FormGroup label="Phone"><Input placeholder="+44 7700 900000" value={formData.client_phone} onChange={e => setFormData({ ...formData, client_phone: e.target.value })} /></FormGroup>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormGroup label="Date *"><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></FormGroup>
          <FormGroup label="Time *"><Select value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })}><option value="">Select time</option>{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</Select></FormGroup>
        </div>
        <FormGroup label="Service"><Select value={formData.service_id} onChange={e => setFormData({ ...formData, service_id: e.target.value })}><option value="">Select service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} — £{s.price}</option>)}</Select></FormGroup>
        <FormGroup label={vc.staffSingular}><Select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}><option value="">Assign {vc.staffSingular.toLowerCase()} (optional)</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormGroup>
        <ModalActions><BtnSecondary onClick={() => setShowModal(false)}>Cancel</BtnSecondary><BtnPrimary onClick={handleNewBooking} disabled={!formData.client_name || !formData.date || !formData.time}>Create Booking</BtnPrimary></ModalActions>
      </Modal>

      {/* ── Add Offer Modal ───────────────────────────────────────── */}
      <Modal open={showOfferModal} onClose={() => setShowOfferModal(false)} title="Add Special Offer">
        <FormGroup label="Offer Title *"><Input placeholder="e.g. Summer Special" value={offerForm.title} onChange={e => setOfferForm({ ...offerForm, title: e.target.value })} /></FormGroup>
        <FormGroup label="Description"><textarea placeholder="Describe your offer..." value={offerForm.description} onChange={e => setOfferForm({ ...offerForm, description: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 14, resize: "vertical", fontFamily: "inherit", outline: "none" }} /></FormGroup>
        <FormGroup label="Discount">
          <div style={{ display: "flex", gap: 8 }}>
            <Select value={offerForm.discount_type} onChange={e => setOfferForm({ ...offerForm, discount_type: e.target.value })} style={{ flex: "0 0 150px" }}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed (£)</option></Select>
            <Input type="number" min="0" placeholder={offerForm.discount_type === "percentage" ? "e.g. 20" : "e.g. 10"} value={offerForm.discount_value} onChange={e => setOfferForm({ ...offerForm, discount_value: e.target.value })} />
          </div>
        </FormGroup>
        <FormGroup label="Valid Until (optional)"><Input type="date" value={offerForm.valid_until} onChange={e => setOfferForm({ ...offerForm, valid_until: e.target.value })} /></FormGroup>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#141A2E", borderRadius: 12, border: "1.5px solid #2a3350", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F7F5EF" }}>Publish on booking page</div>
            <div style={{ fontSize: 11.5, color: "#aab1c4", marginTop: 2 }}>Clients see this immediately</div>
          </div>
          <label style={{ position: "relative", width: 34, height: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={offerForm.active} onChange={e => setOfferForm({ ...offerForm, active: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: "absolute", inset: 0, background: offerForm.active ? "#10B981" : "#aab1c4", borderRadius: 99, transition: "background 0.18s" }}>
              <span style={{ position: "absolute", width: 12, height: 12, left: offerForm.active ? 19 : 3, top: 3, background: "#1C2438", borderRadius: "50%", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
            </span>
          </label>
        </div>
        <ModalActions><BtnSecondary onClick={() => setShowOfferModal(false)}>Cancel</BtnSecondary><BtnPrimary onClick={handleAddOffer} disabled={!offerForm.title}>Save Offer</BtnPrimary></ModalActions>
      </Modal>
      </div>

      {/* ── Floating Onboarding Checklist ── */}
      <OnboardingChecklist
        services={services.length}
        staff={staff.length}
        bookingLink={`${origin}/book/${salon?.slug}`}
        salonSlug={salon?.slug || ""}
        businessType={salon?.business_type ?? undefined}
      />

    </DashboardShell>
  );
}