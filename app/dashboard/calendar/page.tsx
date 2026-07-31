"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import FeatureGate from "../components/FeatureGate";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useSalon } from "../context/SalonContext";
import { resolveAppointmentServices } from "@/app/lib/appointmentServices";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  date_time: string;
  status: "confirmed" | "pending" | "cancelled";
  services?: { name: string; price: number; price_is_from?: boolean } | null;
  staff?: { name: string } | null;
  // Multi-service aware (3C-2b-display) — combined across appointment_
  // services line items, falling back to the primary services join above
  // for bookings with no line items. Populated once at fetch time (see
  // CalendarContent's load()) so every sub-component below just reads
  // these fields directly, no prop-threading of a separate lookup map
  // through MonthView/WeekView/DayView/ApptModal needed.
  serviceName?: string;
  combinedPrice?: number;
  anyPriceIsFrom?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  confirmed: { bg: "rgba(16,185,129,0.10)", border: "#6EE7B7", text: "#065F46", dot: "#10B981" },
  pending:   { bg: "rgba(245,158,11,0.10)", border: "#FCD34D", text: "#F59E0B", dot: "#F59E0B" },
  cancelled: { bg: "rgba(239,68,68,0.10)", border: "#FCA5A5", text: "#991B1B", dot: "#EF4444" },
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am – 7pm
const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = "week" | "month" | "day";

/* ─── MONTH VIEW ─────────────────────────────────── */
interface MonthViewProps {
  currentDate: Date;
  monthDays: (Date | null)[];
  getApptsByDay: (day: Date) => Appointment[];
  today: Date;
  setSelectedAppt: (a: Appointment) => void;
}
function MonthView({ currentDate, monthDays, getApptsByDay, today, setSelectedAppt }: MonthViewProps) {
  const monthName = currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <div style={{ padding: "24px 24px", maxWidth: 1360, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, color: "#F7F5EF", marginBottom: 20, letterSpacing: "-0.5px" }}>{monthName}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#aab1c4", padding: "8px 0", letterSpacing: "0.5px", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {monthDays.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} style={{ minHeight: 90, background: "#141A2E", borderRadius: 10, border: "1.5px solid #2a3350" }} />;
          const dayAppts = getApptsByDay(day);
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()}
              style={{ minHeight: 90, background: isToday ? "rgba(201,162,75,0.10)" : "#1C2438", borderRadius: 10, border: `1.5px solid ${isToday ? "rgba(201,162,75,0.25)" : "#2a3350"}`, padding: "8px 8px", cursor: "default", transition: "all 0.12s" }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.borderColor = "rgba(201,162,75,0.25)"; }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.borderColor = "#2a3350"; }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 900 : 600, marginBottom: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: isToday ? "#C9A24B" : "transparent", color: isToday ? "#fff" : "#F7F5EF" }}>{day.getDate()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayAppts.slice(0, 3).map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                  return (
                    <div key={a.id} onClick={() => setSelectedAppt(a)}
                      style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "opacity 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "0.8"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      {new Date(a.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} {a.client_name}
                    </div>
                  );
                })}
                {dayAppts.length > 3 && <div style={{ fontSize: 9.5, color: "#aab1c4", fontWeight: 600, paddingLeft: 4 }}>+{dayAppts.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── WEEK VIEW ─────────────────────────────────── */
interface WeekViewProps {
  weekDays: Date[];
  appointments: Appointment[];
  today: Date;
  setSelectedAppt: (a: Appointment) => void;
}
function WeekView({ weekDays, appointments, today, setSelectedAppt }: WeekViewProps) {
  const label = `${weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  return (
    <div style={{ padding: "24px 24px", maxWidth: 1360, margin: "0 auto", overflowX: "auto" }}>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#F7F5EF", marginBottom: 20, letterSpacing: "-0.4px" }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7,1fr)", minWidth: 700 }}>
        <div style={{ borderRight: "1px solid #2a3350", borderBottom: "1px solid #2a3350" }} />
        {weekDays.map(day => {
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} style={{ textAlign: "center", padding: "10px 4px", borderRight: "1px solid #2a3350", borderBottom: "1px solid #2a3350", background: isToday ? "rgba(201,162,75,0.10)" : "#141A2E" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aab1c4", textTransform: "uppercase", letterSpacing: "0.5px" }}>{DAYS[(weekDays.indexOf(day))]}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? "#C9A24B" : "#F7F5EF", marginTop: 2 }}>{day.getDate()}</div>
            </div>
          );
        })}
        {HOURS.map(hour => (
          <React.Fragment key={hour}>
            <div style={{ padding: "6px 8px", fontSize: 10.5, color: "#aab1c4", fontWeight: 600, borderRight: "1px solid #2a3350", borderBottom: "1px solid #2a3350", textAlign: "right" }}>
              {hour}:00
            </div>
            {weekDays.map(day => {
              const cellAppts = appointments.filter(a => {
                const d = new Date(a.date_time);
                return sameDay(d, day) && d.getHours() === hour;
              });
              return (
                <div key={`${day.toISOString()}-${hour}`}
                  style={{ minHeight: 56, borderRight: "1px solid #2a3350", borderBottom: "1px solid #2a3350", padding: "3px 4px", position: "relative", background: sameDay(day, today) ? "#1C2438" : "#1C2438" }}>
                  {cellAppts.map(a => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                    return (
                      <div key={a.id} onClick={() => setSelectedAppt(a)}
                        style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, cursor: "pointer", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "all 0.12s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                      >
                        <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: sc.dot, marginRight: 4, verticalAlign: "middle" }} />
                        {a.client_name}
                        {a.serviceName && <span style={{ opacity: 0.7 }}> · {a.serviceName}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── DAY VIEW ──────────────────────────────────── */
interface DayViewProps {
  currentDate: Date;
  getApptsByDay: (day: Date) => Appointment[];
  setSelectedAppt: (a: Appointment) => void;
}
function DayView({ currentDate, getApptsByDay, setSelectedAppt }: DayViewProps) {
  const dayAppts = getApptsByDay(currentDate);
  const label = currentDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div style={{ padding: "24px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#F7F5EF", marginBottom: 20, letterSpacing: "-0.4px" }}>{label}</div>
      {HOURS.map(hour => {
        const hourAppts = dayAppts.filter(a => new Date(a.date_time).getHours() === hour);
        return (
          <div key={hour} style={{ display: "flex", gap: 14, marginBottom: 4, alignItems: "flex-start" }}>
            <div style={{ width: 50, fontSize: 11.5, color: "#aab1c4", fontWeight: 700, textAlign: "right", paddingTop: 10, flexShrink: 0 }}>{hour}:00</div>
            <div style={{ flex: 1, minHeight: 48, borderTop: "1px solid #2a3350", display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
              {hourAppts.map(a => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                return (
                  <div key={a.id} onClick={() => setSelectedAppt(a)}
                    style={{ padding: "10px 16px", borderRadius: 12, background: sc.bg, border: `1.5px solid ${sc.border}`, cursor: "pointer", transition: "all 0.12s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: sc.text }}>{a.client_name}</div>
                        <div style={{ fontSize: 12, color: "#aab1c4", marginTop: 2 }}>{a.serviceName || "No service"}{a.staff ? ` · ${a.staff.name}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {!!a.combinedPrice && <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981" }}>{a.anyPriceIsFrom ? "from " : ""}£{a.combinedPrice}</div>}
                        <div style={{ fontSize: 11, color: "#aab1c4", textTransform: "capitalize" }}>{a.status}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {dayAppts.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#aab1c4", fontSize: 15 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700 }}>No appointments on this day</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Use the dashboard to add a new booking</div>
        </div>
      )}
    </div>
  );
}

/* ─── APPOINTMENT DETAIL MODAL ───────────────────── */
interface ApptModalProps {
  selectedAppt: Appointment | null;
  setSelectedAppt: (a: Appointment | null) => void;
  onViewAll: () => void;
}
function ApptModal({ selectedAppt, setSelectedAppt, onViewAll }: ApptModalProps) {
  const { vc } = useSalon();
  if (!selectedAppt) return null;
  const sc = STATUS_COLORS[selectedAppt.status] || STATUS_COLORS.pending;
  return (
    <div onClick={() => setSelectedAppt(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1C2438", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#F7F5EF", letterSpacing: "-0.5px" }}>{vc.bookingSingular} Details</div>
          <button onClick={() => setSelectedAppt(null)} style={{ background: "#2a3350", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, color: "#aab1c4", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { icon: "👤", label: vc.clientSingular, value: selectedAppt.client_name },
            { icon: "💇", label: "Service",          value: selectedAppt.serviceName || "—" },
            { icon: "✂️", label: vc.staffSingular,   value: selectedAppt.staff?.name || "—" },
            { icon: "📅", label: "Date",             value: new Date(selectedAppt.date_time).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) },
            { icon: "💰", label: "Amount",           value: selectedAppt.combinedPrice ? `${selectedAppt.anyPriceIsFrom ? "from " : ""}£${selectedAppt.combinedPrice}` : "—" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#141A2E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#aab1c4", textTransform: "uppercase", letterSpacing: "0.5px" }}>{row.label}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F7F5EF", marginTop: 1 }}>{row.value}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: "10px 14px", borderRadius: 10, background: sc.bg, border: `1.5px solid ${sc.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: sc.text, textTransform: "capitalize" }}>Status: {selectedAppt.status}</span>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          <button onClick={() => setSelectedAppt(null)} style={{ flex: 1, padding: "11px", background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#aab1c4", cursor: "pointer" }}>Close</button>
          <button onClick={onViewAll} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#C9A24B,#0E1320)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(201,162,75,0.3)" }}>View All →</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN CALENDAR CONTENT ─────────────────────── */
function CalendarContent() {
  const router = useRouter();
  const { vc } = useSalon();
  const [salonName, setSalonName]   = useState("");
  const [appointments, setAppts]    = useState<Appointment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonName(profile.salon.name);
      const { data } = await supabase
        .from("appointments")
        .select("*, services(name,price,price_is_from), staff(name)")
        .eq("salon_id", profile.salon.id)
        .order("date_time", { ascending: true });
      const resolved = await resolveAppointmentServices(supabase, data || []);
      const enriched = (data || []).map(a => {
        const r = resolved.get(a.id);
        return { ...a, serviceName: r?.serviceName, combinedPrice: r?.combinedPrice, anyPriceIsFrom: r?.anyPriceIsFrom };
      });
      setAppts(enriched);
      setLoading(false);
    };
    load();
  }, [router]);

  const weekStart = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthDays = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [currentDate]);

  const getApptsByDay = useCallback((day: Date) =>
    appointments.filter(a => sameDay(new Date(a.date_time), day)), [appointments]);

  const nav = (dir: number) => {
    if (view === "week")  setCurrentDate(d => addDays(d, dir * 7));
    if (view === "day")   setCurrentDate(d => addDays(d, dir));
    if (view === "month") {
      setCurrentDate(d => {
        const nd = new Date(d);
        nd.setMonth(nd.getMonth() + dir);
        return nd;
      });
    }
  };

  const today = new Date();

  const Topbar = (
    <header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF", letterSpacing: "-0.4px" }}>🗓️ Calendar</div>
          <div style={{ fontSize: 11.5, color: "#aab1c4", marginTop: 1 }}>Visual appointment scheduler</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", background: "#2a3350", borderRadius: 10, padding: 3, gap: 2 }}>
          {(["day","week","month"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "none", background: view === v ? "#1C2438" : "transparent", color: view === v ? "#C9A24B" : "#aab1c4", cursor: "pointer", fontWeight: view === v ? 800 : 500, boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.12s", textTransform: "capitalize" }}>
              {v}
            </button>
          ))}
        </div>
        {(["←","Today","→"] as const).map((lbl, i) => (
          <button key={lbl}
            onClick={() => i === 1 ? setCurrentDate(new Date()) : nav(i === 0 ? -1 : 1)}
            style={{ padding: "7px 14px", background: i === 1 ? "linear-gradient(135deg,#C9A24B,#0E1320)" : "#1C2438", color: i === 1 ? "#fff" : "#aab1c4", border: `1.5px solid ${i === 1 ? "transparent" : "#2a3350"}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}>
            {lbl}
          </button>
        ))}
      </div>
    </header>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: 40, textAlign: "center", color: "#aab1c4" }}>Loading calendar…</div>
    </DashboardShell>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", padding: "12px 24px", display: "flex", gap: 24, alignItems: "center" }}>
        {[
          { label: `Total ${vc.bookingPlural}`, value: appointments.length, color: "#C9A24B" },
          { label: "Confirmed", value: appointments.filter(a => a.status === "confirmed").length, color: "#10B981" },
          { label: "Pending", value: appointments.filter(a => a.status === "pending").length, color: "#F59E0B" },
          { label: "Cancelled", value: appointments.filter(a => a.status === "cancelled").length, color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#F7F5EF" }}>{s.value}</span>
            <span style={{ fontSize: 12, color: "#aab1c4" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {view === "month" && <MonthView currentDate={currentDate} monthDays={monthDays} getApptsByDay={getApptsByDay} today={today} setSelectedAppt={setSelectedAppt} />}
      {view === "week"  && <WeekView weekDays={weekDays} appointments={appointments} today={today} setSelectedAppt={setSelectedAppt} />}
      {view === "day"   && <DayView currentDate={currentDate} getApptsByDay={getApptsByDay} setSelectedAppt={setSelectedAppt} />}
      <ApptModal selectedAppt={selectedAppt} setSelectedAppt={setSelectedAppt} onViewAll={() => { router.push("/dashboard/bookings"); setSelectedAppt(null); }} />
    </DashboardShell>
  );
}

export default function CalendarPage() {
  return (
    <FeatureGate feature="calendar">
      <CalendarContent />
    </FeatureGate>
  );
}
