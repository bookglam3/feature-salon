"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarPlus, Tag, UserPlus, Scissors, BarChart3,
  Clock, TrendingUp, BookOpen, Users,
  Download, Plus,
  Link2, ExternalLink, BarChart2,
  Sparkles, Leaf, Dumbbell, Stethoscope,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import { fromZonedTime } from "date-fns-tz";
import { COUNTRY_TIMEZONES } from "@/app/lib/slot-availability";
import DashboardShell, { HamburgerBtn } from "./components/DashboardShell";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "./components/Modal";
import EmptyState from "./components/EmptyState";
import { SkeletonDashboard } from "./components/SkeletonLoader";
import { useToast } from "./components/Toast";
import type { Salon, Appointment, Service } from "../types";
import OnboardingChecklist from "./components/OnboardingChecklist";
import { useSalon } from "./context/SalonContext";
import { resolveAppointmentServices, type ResolvedAppointmentServices } from "@/app/lib/appointmentServices";
import PushNotificationButton from "@/app/components/PushNotificationButton";

type StaffItem = { id: string; name: string };

const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"];

const PLAN_FEATURES: Record<string, { color: string; bg: string; border: string; badge: string; features: string[]; limit: string }> = {
  Starter: { color: "#aab1c4", bg: "#1C2438", border: "#2a3350", badge: "STARTER", features: ["Up to 50 bookings/mo", "1 staff member", "Basic analytics", "Email notifications", "Public booking page"], limit: "50 bookings/month" },
  Professional: { color: "#C9A24B", bg: "rgba(201,162,75,0.10)", border: "rgba(201,162,75,0.25)", badge: "PROFESSIONAL", features: ["Unlimited bookings", "Up to 5 staff", "Advanced analytics", "SMS + Email", "Custom offers", "Priority support"], limit: "Unlimited bookings" },
  Growth: { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", badge: "GROWTH", features: ["Unlimited bookings", "Up to 15 staff", "Revenue reports", "SMS + Email + WhatsApp", "Staff performance", "API access"], limit: "Unlimited bookings" },
  Enterprise: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", badge: "ENTERPRISE", features: ["Unlimited everything", "Unlimited staff", "White-label option", "Dedicated support", "Custom integrations", "SLA 99.9%"], limit: "Unlimited everything" },
};


/* ─── STATUS PILL ─────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    confirmed: { bg: "rgba(16,185,129,0.10)", color: "#047857", border: "rgba(16,185,129,0.25)", dot: "#10B981" },
    pending:   { bg: "rgba(245,158,11,0.12)",  color: "#B45309", border: "rgba(245,158,11,0.25)", dot: "#F59E0B" },
    cancelled: { bg: "rgba(239,68,68,0.10)",   color: "#B91C1C", border: "rgba(239,68,68,0.25)", dot: "#EF4444" },
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
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 14px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 16, cursor: "pointer", transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)", flex: 1, minWidth: 76, fontFamily: "inherit" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + "55"; e.currentTarget.style.boxShadow = `0 8px 28px rgba(18,16,26,0.12), 0 0 0 1px ${color}33`; e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"; e.currentTarget.style.background = `${color}14`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "#F5F3FF"; }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: color, transition: "transform 0.2s" }}>
        {lucideIcon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#524D60", whiteSpace: "nowrap", letterSpacing: "0.1px" }}>{label}</span>
    </button>
  );
}

/* ─── MINI STAT ───────────────────────────────────────────────── */
function MiniStat({ label, value, color, lucideIcon, sub, trend }: { label: string; value: string | number; color: string; lucideIcon: React.ReactNode; sub?: string; trend?: number | null }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 13, padding: 16, minHeight: 134, position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", transition: "box-shadow 0.2s ease, transform 0.2s ease", cursor: "default", boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(18,16,26,0.05), 0 12px 28px -14px rgba(18,16,26,0.14)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(18,16,26,0.03)"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "absolute", top: 16, right: 16, width: 31, height: 31, borderRadius: 9, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: color }}>
        {lucideIcon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#524D60", paddingRight: 40, lineHeight: 1.3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap", marginTop: "auto" }}>
        <div style={{ fontSize: 25, fontWeight: 700, color: "#12101A", letterSpacing: "-0.4px", lineHeight: 1 }}>{value}</div>
        {/* Rendered only when a real prior-period basis exists (trend === null
            means the previous 7 days had nothing to compare against, so we
            show no badge rather than invent a percentage). */}
      </div>
      {/* Real trend when a prior-period basis exists, otherwise the neutral
          sub-line. Never a fabricated percentage. */}
      {typeof trend === "number" ? (
        <div style={{ fontSize: 9, fontWeight: 600, marginTop: 6, color: trend >= 0 ? "#259466" : "#B91C1C", display: "flex", alignItems: "center", gap: 3 }}>
          <span>{trend >= 0 ? "\u2191" : "\u2193"}</span>{Math.abs(trend)}% vs last week
        </div>
      ) : sub ? (
        <div style={{ fontSize: 9, color: "#6B6577", marginTop: 6, fontWeight: 500 }}>{sub}</div>
      ) : null}
    </div>
  );
}

/* ─── REVENUE MINI BARS ───────────────────────────────────────── */
function RevenueMiniChart({ appointments, serviceDisplay }: { appointments: Appointment[]; serviceDisplay: Map<string, ResolvedAppointmentServices> }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = new Date();
  const dayRevenue = days.map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (now.getDay() - 1 - i));
    return appointments.filter(a => {
      const ad = new Date(a.date_time);
      return ad.toDateString() === d.toDateString() && a.status === "confirmed";
    }).reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
  });
  const max = Math.max(...dayRevenue, 1);
  const todayIdx = (now.getDay() + 6) % 7;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, paddingTop: 8 }}>
      {dayRevenue.map((rev, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div title={`£${rev}`} style={{ width: "100%", borderRadius: "5px 5px 0 0", height: `${Math.max((rev / max) * 52, 4)}px`, background: rev === max && rev > 0 ? "linear-gradient(180deg,#ac7bff,#7440dd)" : "#e9e1f6", boxShadow: "none", transition: "all 0.3s ease", cursor: "default" }} />
          <span style={{ fontSize: 9, color: i === todayIdx ? "#6D28D9" : "#6B6577", fontWeight: i === todayIdx ? 700 : 500 }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── AVATAR (initials only — Appointment carries no photo field) ─
   Same colour/initials derivation the staff list uses elsewhere. */
const AVATAR_COLORS = ["#7C3AED", "#6D28D9", "#8B5CF6", "#A78BFA", "#EC4899"];
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (name || "?").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 900, color: "#fff", flexShrink: 0, letterSpacing: "-0.3px" }}>
      {initials}
    </div>
  );
}

/* ─── SCHEDULE ROW (shared by Today's + Recent) ────────────────
   Every field is real: time from date_time, initials from client_name,
   service via serviceDisplay, staff from the join, price from
   combinedPrice. No duration is shown because the appointments query
   carries none (services(name,price) only) — omitted rather than faked. */
function ApptRow({ appt, serviceName, price, onClick }: { appt: Appointment; serviceName?: string; price?: number; onClick: () => void }) {
  const accent = AVATAR_COLORS[(appt.client_name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div className="bk-schedule-row" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 76, padding: "12px 20px", borderTop: "1px solid #eeecf2", cursor: "pointer", transition: "background 0.14s ease" }}
    >
      {/* Time (real, from date_time) */}
      <div style={{ width: 46, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>
          {new Date(appt.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Accent line, tinted to match the client's avatar colour */}
      <div style={{ width: 3, alignSelf: "stretch", minHeight: 40, borderRadius: 99, background: accent, opacity: 0.85, flexShrink: 0 }} />

      <Avatar name={appt.client_name} size={38} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{appt.client_name}</div>
        <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {serviceName || "No service"}{appt.staff?.name ? ` \u00b7 ${appt.staff.name}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <StatusPill status={appt.status} />
        {typeof price === "number" && price > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>£{price}</div>
        )}
        <span className="bk-row-menu" aria-hidden="true"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, color: "#6B6577", fontSize: 13, letterSpacing: "0.5px", transition: "all 0.14s ease" }}>
          &#8942;
        </span>
      </div>
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

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [formData, setFormData] = useState({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
  // Multi-service aware (3C-2b-display) — see app/lib/appointmentServices.ts
  const [serviceDisplay, setServiceDisplay] = useState<Map<string, ResolvedAppointmentServices>>(new Map());

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalon(profile.salon);
      const id = profile.salon.id;
      // The offers query was dropped along with the Special Offers card —
      // offer management lives on its own page and nothing here reads it.
      const [{ data: appts }, { data: staffData }, { data: svcs }] = await Promise.all([
        supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", id).order("date_time", { ascending: true }),
        supabase.from("staff").select("id,name").eq("salon_id", id).eq("active", true),
        supabase.from("services").select("*").eq("salon_id", id),
      ]);
      setAppointments(appts || []); setStaff(staffData || []); setServices(svcs || []);
      setServiceDisplay(await resolveAppointmentServices(supabase, appts || []));
      setLoading(false);
    };
    load();
  }, [router]);

  const reloadAppts = useCallback(async () => {
    if (!salon) return;
    const { data } = await supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", salon.id).order("date_time", { ascending: true });
    setAppointments(data || []);
    setServiceDisplay(await resolveAppointmentServices(supabase, data || []));
  }, [salon]);

  const handleNewBooking = useCallback(async () => {
    if (!salon || !formData.client_name || !formData.date || !formData.time) { toast.error("Fill required fields"); return; }
    // Same fromZonedTime conversion as the public booking page (8b3ea7e) —
    // a bare `new Date(dateStr+"T"+timeStr)` parses in the RUNTIME's own
    // timezone, not the salon's, whenever the browser's OS timezone differs
    // from the salon's configured one.
    const salonTz = salon.timezone || COUNTRY_TIMEZONES[salon.country || ""] || "Europe/London";
    const date_time = fromZonedTime(`${formData.date}T${formData.time}:00`, salonTz).toISOString();
    // Stage 1 of the interval-overlap fix: end_time written at booking time.
    // service_id is optional here (formData.service_id || null) — same
    // 30-min fallback as every other duration-less write path in the codebase.
    const selectedSvc = services.find(s => s.id === formData.service_id);
    const durationMin = selectedSvc?.duration_minutes || 30;
    const end_time = new Date(new Date(date_time).getTime() + durationMin * 60_000).toISOString();
    const { data: inserted, error } = await supabase.from("appointments").insert({
      salon_id: salon.id,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      service_id: formData.service_id || null,
      staff_id: formData.staff_id || null,
      date_time, end_time,
      status: "confirmed",
    }).select("id").single();
    if (error) { toast.error("Failed to create booking"); return; }
    // Send email + WhatsApp via the same route as online bookings
    if (formData.client_email && inserted?.id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
          body: JSON.stringify({ appointmentId: inserted.id, skipOwnerPush: true }),
        });
        if (res.ok) {
          toast.success("Booking created! Confirmation sent to client.");
        } else {
          toast.error("Booking created, but the confirmation email failed to send.");
        }
      } catch {
        toast.error("Booking created, but the confirmation email failed to send.");
      }
    } else {
      toast.success("Booking created!");
    }
    setShowModal(false);
    setFormData({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
    await reloadAppts();
  }, [salon, formData, toast, reloadAppts]);

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
      const sd = serviceDisplay.get(a.id);
      rows.push([a.client_name, sd?.serviceName || "", a.staff?.name || "", new Date(a.date_time).toLocaleString("en-GB"), sd?.combinedPrice ? `£${sd.combinedPrice}` : "", a.status]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `appointments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    toast.success("CSV exported!");
  }, [appointments, toast, serviceDisplay]);

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
  const revenue = useMemo(() => todayAppts.reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0), [todayAppts, serviceDisplay]);
  const totalRevenue = useMemo(() => confirmedAppts.reduce((s, a) => s + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0), [confirmedAppts, serviceDisplay]);

  /* ── Recent bookings: the 5 most recently scheduled, newest first.
     Pure derivation over the appointments already in state. */
  const recentAppts = useMemo(
    () => [...appointments].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()).slice(0, 5),
    [appointments]
  );

  /* ── Real 7-day trends: last 7 days vs the 7 before ──────────────
     Derived purely from the `appointments` already in state (date_time +
     status + resolved price) — no new query, no invented figures. Returns
     null when the prior window has no basis to compare against, and the
     badge is then simply not rendered. */
  const trends = useMemo(() => {
    const DAY = 86400000;
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const within = (a: Appointment, from: number, to: number) => {
      const t = new Date(a.date_time).getTime();
      return t >= from && t < to;
    };
    const last7 = appointments.filter(a => within(a, now - 7 * DAY, now));
    const prev7 = appointments.filter(a => within(a, now - 14 * DAY, now - 7 * DAY));
    const rev = (list: Appointment[]) => list
      .filter(a => a.status === "confirmed")
      .reduce((sum, a) => sum + (serviceDisplay.get(a.id)?.combinedPrice ?? 0), 0);
    const pct = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
    return {
      apptPct: pct(last7.length, prev7.length),
      revPct: pct(rev(last7), rev(prev7)),
    };
  }, [appointments, serviceDisplay]);

  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? "Good morning ☀️" : h < 17 ? "Good afternoon 👋" : "Good evening 🌙"; }, []);
  const plan = salon?.plan || "Starter";
  const planInfo = PLAN_FEATURES[plan] || PLAN_FEATURES.Starter;



  /* ── Loading ── */
  if (loading) return (
    <DashboardShell salonName="" topbar={<header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", height: 58, display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}><div style={{ width: 36, height: 12, borderRadius: 6 }} className="skeleton" /><div style={{ width: 140, height: 12, borderRadius: 6 }} className="skeleton" /></header>}>
      <SkeletonDashboard />
    </DashboardShell>
  );

  /* ── Topbar ── */
  const Topbar = (
    <header style={{ background: "#FFFFFF", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      {/* minWidth:0 on this row and the wrapping div below is what lets the
          greeting text actually shrink instead of forcing the topbar wider
          than the viewport — a flex item's default min-width:auto blocks
          that unless overridden at every level down to the truncating text
          itself. Everything else in this topbar (badge/export/date) is
          already hidden or shrunk at <=767px; this was the one remaining
          unguarded piece, and the only one whose width depends on
          user/salon data (a long salon name) rather than a fixed label. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <HamburgerBtn />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#12101A", letterSpacing: "-0.4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{greeting}, {salon?.name?.split(" ")[0]}</div>
          <div className="dash-greeting-date" style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Plan badge */}
        <div className="dash-topbar-badge" style={{ padding: "5px 14px", borderRadius: 99, background: "#EDE9FF", border: "1px solid rgba(124,58,237,0.20)", fontSize: 10.5, fontWeight: 900, color: "#6D28D9", letterSpacing: "1px" }}>{planInfo.badge}</div>
        {/* Export */}
        <button onClick={handleExportCSV} title="Export CSV" className="dash-topbar-export"
          style={{ width: 38, height: 38, borderRadius: 10, background: "#F5F3FF", border: "1px solid #ECE9F1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#524D60", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FF"; e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#6D28D9"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F5F3FF"; e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.color = "#524D60"; }}
        ><Download size={15} strokeWidth={2} /></button>
        {/* New Booking */}
        <button onClick={() => setShowModal(true)} className="dash-topbar-newbtn"
          style={{ display: "flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 11, border: "1px solid rgba(124,58,237,0.2)", cursor: "pointer", boxShadow: "0 4px 18px rgba(124,58,237,0.45)", whiteSpace: "nowrap", letterSpacing: "-0.1px", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(124,58,237,0.65)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(124,58,237,0.45)"; }}
        ><Plus size={15} strokeWidth={2.5} /> New {vc.bookingSingular}</button>
      </div>
    </header>
  );

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <DashboardShell salonName={salon?.name} topbar={Topbar}>
      <div className="dash-wrap" style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>
      {/* Page-local polish: pseudo-states inline styles can't express. */}
      <style>{`
        .bk-schedule-row:hover { background: #FAF9FC; }
        .bk-schedule-row:hover .bk-row-menu { background: #F1EDFA; color: #6D28D9; }
        @media (max-width: 767px) {
          .dash-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

        {/* ── 1. Greeting ───────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6B6577", letterSpacing: "0.2px", marginBottom: 7 }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#12101A", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.2 }}>
              {greeting}, {salon?.name?.split(" ")[0]}!
            </h1>
            <p style={{ fontSize: 12.5, color: "#524D60", margin: "6px 0 0" }}>
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>
          {/* Booking-link actions preserved from the old banner — handleCopyLink stays wired */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleCopyLink}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: copied ? "rgba(37,148,102,0.08)" : "#FFFFFF", color: copied ? "#259466" : "#524D60", border: `1px solid ${copied ? "rgba(37,148,102,0.25)" : "#ECE9F1"}`, borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              <Link2 size={12} strokeWidth={2} />{copied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={() => window.open(`/book/${salon?.slug}`, "_blank")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: "#FFFFFF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              <ExternalLink size={12} strokeWidth={2} />Preview
            </button>
            <a href="/dashboard/reports"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: "#FFFFFF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 11.5, fontWeight: 600, textDecoration: "none", transition: "all 0.15s" }}>
              <BarChart2 size={12} strokeWidth={2} />Reports
            </a>
          </div>
        </div>

        {/* ── 2. Four stat cards (all real, already-computed values) ── */}
        <div className="dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13, marginBottom: 24 }}>
          <MiniStat label={`Today's ${vc.bookingPlural.toLowerCase()}`} value={todayAppts.length} color="#7C3AED" lucideIcon={<BookOpen size={17} strokeWidth={1.8} />} sub={`${todayAppts.filter(a => a.status === "confirmed").length} confirmed today`} trend={trends.apptPct} />
          <MiniStat label="Today's revenue" value={`£${revenue}`} color="#10B981" lucideIcon={<TrendingUp size={17} strokeWidth={1.8} />} sub="today" trend={trends.revPct} />
          <MiniStat label="Upcoming" value={upcomingAppts.length} color="#7C3AED" lucideIcon={<Clock size={17} strokeWidth={1.8} />} sub="scheduled" />
          <MiniStat label="Pending" value={pendingAppts.length} color="#F59E0B" lucideIcon={<Users size={17} strokeWidth={1.8} />} sub="awaiting confirmation" />
        </div>

        {/* ── Push Notifications ─────────────────────────────────── */}
        {salon?.id && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <PushNotificationButton salonId={salon.id} />
          </div>
        )}

        {/* ── 3. Today's schedule ────────────────────────────────── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, overflow: "hidden", marginBottom: 24, boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Today&apos;s schedule</div>
              <div style={{ fontSize: 10, color: "#6B6577", marginTop: 3 }}>{todayAppts.length} {todayAppts.length === 1 ? vc.bookingSingular.toLowerCase() : vc.bookingPlural.toLowerCase()} scheduled</div>
            </div>
            <a href="/dashboard/calendar" style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", textDecoration: "none" }}>View calendar →</a>
          </div>
          {todayAppts.length === 0 ? (
            <EmptyState icon="📅" title={`No ${vc.bookingPlural.toLowerCase()} today`} description="Your schedule is clear for the rest of the day" />
          ) : (
            <>
              <div>
                {todayAppts.map(a => (
                  <ApptRow key={a.id} appt={a} serviceName={serviceDisplay.get(a.id)?.serviceName} price={serviceDisplay.get(a.id)?.combinedPrice} onClick={() => router.push("/dashboard/bookings")} />
                ))}
              </div>
              <div style={{ borderTop: "1px solid #eeecf2", padding: "13px 20px", textAlign: "center" }}>
                <a href="/dashboard/bookings" style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", textDecoration: "none" }}>View all {vc.bookingPlural.toLowerCase()}</a>
              </div>
            </>
          )}
        </div>

        {/* ── 4. This week ───────────────────────────────────────── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, padding: "18px 20px", marginBottom: 24, boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>This week</div>
            <div style={{ fontSize: 10, color: "#6B6577" }}>Daily revenue · confirmed only</div>
          </div>
          <RevenueMiniChart appointments={appointments} serviceDisplay={serviceDisplay} />
          {/* Totals — both figures are existing memos, not new maths */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTop: "1px solid #eeecf2" }}>
            <div>
              <div style={{ fontSize: 10, color: "#6B6577", marginBottom: 4 }}>Total {vc.bookingPlural.toLowerCase()}</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#12101A", letterSpacing: "-0.4px", lineHeight: 1 }}>{appointments.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#6B6577", marginBottom: 4 }}>Revenue (confirmed)</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#259466", letterSpacing: "-0.4px", lineHeight: 1 }}>£{totalRevenue}</div>
            </div>
          </div>
        </div>

        {/* ── 5. Quick Actions ───────────────────────────────────── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 20, padding: "20px 22px", marginBottom: 20, boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#6B6577", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 16 }}>Quick Actions</div>
          <div className="dash-quick-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
            <QuickAction lucideIcon={<CalendarPlus size={20} strokeWidth={1.8} />} label={`New ${vc.bookingSingular}`} color="#7C3AED" onClick={() => setShowModal(true)} />
            <QuickAction lucideIcon={<UserPlus size={20} strokeWidth={1.8} />} label={`Add ${vc.clientSingular}`} color="#7C3AED" onClick={() => router.push("/dashboard/clients")} />
            <QuickAction lucideIcon={<Tag size={20} strokeWidth={1.8} />} label="Add Service" color="#10B981" onClick={() => router.push("/dashboard/services")} />
            <QuickAction lucideIcon={STAFF_ICON_MAP[vc.staffIcon] ?? <Scissors size={20} strokeWidth={1.8} />} label={`Manage ${vc.staffPlural}`} color="#7C3AED" onClick={() => router.push("/dashboard/staff")} />
            <QuickAction lucideIcon={<BarChart3 size={20} strokeWidth={1.8} />} label="View Reports" color="#7C3AED" onClick={() => router.push("/dashboard/reports")} />
          </div>
        </div>

        {/* ── Booking link (reuses handleCopyLink + the existing origin/slug) ── */}
        {salon?.slug && (
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, padding: "18px 20px", marginBottom: 24, boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Your booking link</div>
            <div style={{ fontSize: 10, color: "#6B6577", marginTop: 3, marginBottom: 13 }}>Share this so clients can book themselves in</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 200, padding: "9px 13px", background: "#F8F7FB", border: "1px solid #eeecf2", borderRadius: 9, fontSize: 11.5, color: "#524D60", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {origin}/book/{salon.slug}
              </div>
              <button onClick={handleCopyLink}
                style={{ padding: "9px 16px", background: copied ? "rgba(37,148,102,0.08)" : "linear-gradient(135deg,#7C3AED,#6D28D9)", color: copied ? "#259466" : "#fff", border: copied ? "1px solid rgba(37,148,102,0.25)" : "none", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <a href={`/book/${salon.slug}`} target="_blank" rel="noopener"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "#7C3AED", textDecoration: "none", marginTop: 12 }}>
              Open public booking page <ExternalLink size={11} strokeWidth={2} />
            </a>
          </div>
        )}

        {/* ── 6. Recent Bookings ─────────────────────────────────── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 20, overflow: "hidden", marginBottom: 28, boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid #ECE9F1", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Recent {vc.bookingPlural.toLowerCase()}</div>
            <a href="/dashboard/bookings" style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED", textDecoration: "none" }}>View all →</a>
          </div>
          {recentAppts.length === 0 ? (
            <EmptyState icon="📋" title={`No ${vc.bookingPlural.toLowerCase()} yet`} description={`Your most recent ${vc.bookingPlural.toLowerCase()} will appear here`} />
          ) : (
            <div>
              {recentAppts.map(a => (
                <ApptRow key={a.id} appt={a} serviceName={serviceDisplay.get(a.id)?.serviceName} price={serviceDisplay.get(a.id)?.combinedPrice} onClick={() => router.push("/dashboard/bookings")} />
              ))}
            </div>
          )}
        </div>


      {/* ── New Booking Modal ─────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`New ${vc.bookingSingular}`}
        footer={
          <ModalActions>
            <BtnSecondary onClick={() => setShowModal(false)}>Cancel</BtnSecondary>
            <BtnPrimary onClick={handleNewBooking} disabled={!formData.client_name || !formData.date || !formData.time}>Create Booking</BtnPrimary>
          </ModalActions>
        }
      >
        <div style={{ margin: "0 0 10px", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", letterSpacing: "0.8px", textTransform: "uppercase" }}>Client Details</div>
        </div>
        <FormGroup label="Client Name *"><Input placeholder="Sarah Johnson" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} /></FormGroup>
        <FormGroup label="Email"><Input type="email" placeholder="sarah@email.com" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} /></FormGroup>
        <FormGroup label="Phone"><Input placeholder="+44 7700 900000" value={formData.client_phone} onChange={e => setFormData({ ...formData, client_phone: e.target.value })} /></FormGroup>
        <div style={{ margin: "16px 0 10px", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", letterSpacing: "0.8px", textTransform: "uppercase" }}>Appointment Details</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormGroup label="Date *"><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></FormGroup>
          <FormGroup label="Time *"><Select value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })}><option value="">Select time</option>{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</Select></FormGroup>
        </div>
        <FormGroup label="Service"><Select value={formData.service_id} onChange={e => setFormData({ ...formData, service_id: e.target.value })}><option value="">Select service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} — £{s.price}</option>)}</Select></FormGroup>
        <FormGroup label={vc.staffSingular}><Select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}><option value="">Assign {vc.staffSingular.toLowerCase()} (optional)</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormGroup>
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