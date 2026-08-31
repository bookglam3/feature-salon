"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import FeatureGate from "../components/FeatureGate";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal from "../components/Modal";
import { useSalon } from "../context/SalonContext";
import { resolveAppointmentServices } from "@/app/lib/appointmentServices";

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  date_time: string;
  // Written on every booking create and returned by select("*") — it was
  // simply never declared here. Duration is derived from it below.
  end_time?: string | null;
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

/* ─── Initials avatar (no photo field exists on an appointment) ── */
const AVATAR_COLORS = ["#7C3AED", "#6D28D9", "#8B5CF6", "#A78BFA", "#EC4899"];
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (name || "?").split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 800, color: "#fff", flexShrink: 0, letterSpacing: "-0.3px" }}>
      {initials}
    </div>
  );
}

/* Duration in minutes from end_time, same arithmetic as the reschedule
   page. Returns null when end_time is absent (older rows) so the caller
   omits the line rather than assuming a length. */
function durationMins(a: Appointment): number | null {
  if (!a.end_time) return null;
  const mins = Math.round((new Date(a.end_time).getTime() - new Date(a.date_time).getTime()) / 60_000);
  return mins > 0 ? mins : null;
}

/* Digits only, with a UK 0-prefix promoted to 44 — same normalisation
   idea as the clients page, which strips non-digits before wa.me. */
function whatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return digits;
}

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
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, color: "#12101A", marginBottom: 20, letterSpacing: "-0.5px" }}>{monthName}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#6B6577", padding: "8px 0", letterSpacing: "0.5px", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {monthDays.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} style={{ minHeight: 90, background: "#F5F3FF", borderRadius: 10, border: "1.5px solid #ECE9F1" }} />;
          const dayAppts = getApptsByDay(day);
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()}
              style={{ minHeight: 90, background: isToday ? "rgba(124,58,237,0.10)" : "#FFFFFF", borderRadius: 10, border: `1.5px solid ${isToday ? "rgba(124,58,237,0.25)" : "#ECE9F1"}`, padding: "8px 8px", cursor: "default", transition: "all 0.12s" }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.borderColor = "rgba(124,58,237,0.25)"; }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.borderColor = "#ECE9F1"; }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 900 : 600, marginBottom: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: isToday ? "#7C3AED" : "transparent", color: isToday ? "#fff" : "#12101A" }}>{day.getDate()}</div>
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
                {dayAppts.length > 3 && <div style={{ fontSize: 9.5, color: "#6B6577", fontWeight: 600, paddingLeft: 4 }}>+{dayAppts.length - 3} more</div>}
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
const CELL_H = 60;
function WeekView({ weekDays, appointments, today, setSelectedAppt }: WeekViewProps) {
  /* Visible hour range. HOURS (7–19) stays the baseline, but it is widened
     to cover any booking that actually falls outside it — previously an
     08:00-or-21:00 appointment simply never rendered. Display range only;
     no query or date logic is involved. */
  const weekHours = appointments
    .filter(a => weekDays.some(d => sameDay(new Date(a.date_time), d)))
    .map(a => new Date(a.date_time).getHours());
  const from = Math.min(HOURS[0], ...weekHours);
  const to   = Math.max(HOURS[HOURS.length - 1], ...weekHours);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "58px repeat(7,minmax(96px,1fr))", minWidth: 720, border: "1px solid #ECE9F1", borderRadius: 14, overflow: "hidden", background: "#FFFFFF" }}>
        <div style={{ borderRight: "1px solid #ECE9F1", borderBottom: "1px solid #ECE9F1", background: "#FBFAFD" }} />
        {weekDays.map((day, di) => {
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} style={{ textAlign: "center", padding: "11px 4px", borderRight: di < 6 ? "1px solid #ECE9F1" : "none", borderBottom: "1px solid #ECE9F1", background: isToday ? "#F5F3FF" : "#FBFAFD" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "#9A94A8", textTransform: "uppercase", letterSpacing: "0.7px" }}>{DAYS[di]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? "#7C3AED" : "#12101A", marginTop: 3, letterSpacing: "-0.3px" }}>{day.getDate()}</div>
            </div>
          );
        })}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div style={{ padding: "6px 8px", fontSize: 10, color: "#9A94A8", fontWeight: 600, borderRight: "1px solid #ECE9F1", borderBottom: "1px solid #ECE9F1", textAlign: "right", background: "#FBFAFD" }}>
              {String(hour).padStart(2, "0")}:00
            </div>
            {weekDays.map((day, di) => {
              const cellAppts = appointments.filter(a => {
                const d = new Date(a.date_time);
                return sameDay(d, day) && d.getHours() === hour;
              });
              return (
                <div key={`${day.toISOString()}-${hour}`}
                  style={{ height: CELL_H, borderRight: di < 6 ? "1px solid #ECE9F1" : "none", borderBottom: "1px solid #ECE9F1", position: "relative", background: sameDay(day, today) ? "#FCFBFE" : "#FFFFFF" }}>
                  {cellAppts.map((a, idx) => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                    const d = new Date(a.date_time);
                    /* Minute-accurate placement: a 09:30 now sits half-way
                       down the 09:00 row instead of at its top. Concurrent
                       bookings in the same hour split the width side by side
                       rather than overlapping. */
                    const topPct = (d.getMinutes() / 60) * 100;
                    const n = cellAppts.length;
                    return (
                      <div key={a.id} onClick={() => setSelectedAppt(a)} title={`${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${a.client_name}`}
                        style={{ position: "absolute", top: `${topPct}%`, left: `calc(${(idx / n) * 100}% + 3px)`, width: `calc(${100 / n}% - 6px)`,
                          background: sc.bg, border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.dot}`, borderRadius: 7,
                          padding: "3px 6px", cursor: "pointer", overflow: "hidden", transition: "box-shadow 0.12s, transform 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(18,16,26,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                      >
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} {a.client_name}
                        </div>
                        {a.serviceName && n === 1 && (
                          <div style={{ fontSize: 9, color: sc.text, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.serviceName}</div>
                        )}
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
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, color: "#12101A", marginBottom: 20, letterSpacing: "-0.4px" }}>{label}</div>
      {HOURS.map(hour => {
        const hourAppts = dayAppts.filter(a => new Date(a.date_time).getHours() === hour);
        return (
          <div key={hour} style={{ display: "flex", gap: 14, marginBottom: 4, alignItems: "flex-start" }}>
            <div style={{ width: 50, fontSize: 11.5, color: "#6B6577", fontWeight: 700, textAlign: "right", paddingTop: 10, flexShrink: 0 }}>{hour}:00</div>
            <div style={{ flex: 1, minHeight: 48, borderTop: "1px solid #ECE9F1", display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
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
                        <div style={{ fontSize: 12, color: "#6B6577", marginTop: 2 }}>{a.serviceName || "No service"}{a.staff ? ` · ${a.staff.name}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {!!a.combinedPrice && <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981" }}>{a.anyPriceIsFrom ? "from " : ""}£{a.combinedPrice}</div>}
                        <div style={{ fontSize: 11, color: "#6B6577", textTransform: "capitalize" }}>{a.status}</div>
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
        <div style={{ textAlign: "center", padding: "60px 0", color: "#6B6577", fontSize: 15 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700 }}>No appointments on this day</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Use the dashboard to add a new booking</div>
        </div>
      )}
    </div>
  );
}

/* ─── APPOINTMENT DETAIL MODAL ───────────────────── */
/* Detail row — module scope so it isn't re-created on every render. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid #ECE9F1" }}>
      <span style={{ fontSize: 12, color: "#6B6577" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#12101A", textAlign: "right" }}>{value}</span>
    </div>
  );
}

/* ─── AGENDA ROW (mobile day list) ─────────────────────────────
   Time · status accent · name · service/staff · price — all real. */
function AgendaRow({ a, onClick }: { a: Appointment; onClick: () => void }) {
  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
  return (
    <div onClick={onClick} className="cal-agenda-row"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 4px", borderTop: "1px solid #ECE9F1", cursor: "pointer" }}>
      <div style={{ width: 46, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>
        {new Date(a.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ width: 3, alignSelf: "stretch", minHeight: 34, borderRadius: 99, background: sc.dot, flexShrink: 0 }} />
      <Avatar name={a.client_name} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.client_name}</div>
        <div style={{ fontSize: 11, color: "#6B6577", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.serviceName || "No service"}{a.staff?.name ? ` \u00b7 ${a.staff.name}` : ""}
        </div>
      </div>
      {typeof a.combinedPrice === "number" && a.combinedPrice > 0 && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#12101A", flexShrink: 0 }}>£{a.combinedPrice}{a.anyPriceIsFrom ? "+" : ""}</div>
      )}
    </div>
  );
}

/* Next free whole hour on a day, within the visible business window.
   Returns null when every slot is taken so the caller drops the time
   rather than inventing one. */
function nextFreeTime(dayAppts: Appointment[]): string | null {
  const taken = new Set(dayAppts.map(a => new Date(a.date_time).getHours()));
  const free = HOURS.find(h => !taken.has(h));
  return free === undefined ? null : `${String(free).padStart(2, "0")}:00`;
}

interface ApptDrawerProps {
  selectedAppt: Appointment | null;
  setSelectedAppt: (a: Appointment | null) => void;
  onViewAll: () => void;
  salonName: string;
}
/* ─── APPOINTMENT DETAIL DRAWER ──────────────────────────────────
   Every value comes off selectedAppt. Contact actions render only when
   the underlying field actually has a value — no dead buttons. */
function ApptDrawer({ selectedAppt, setSelectedAppt, onViewAll, salonName }: ApptDrawerProps) {
  const { vc } = useSalon();
  if (!selectedAppt) return null;
  const a = selectedAppt;
  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
  const mins = durationMins(a);
  const firstName = (a.client_name || "").split(" ")[0];
  const waText = encodeURIComponent(`Hi ${firstName}, this is ${salonName} regarding your appointment.`);

  return (
    <Modal
      open={!!selectedAppt}
      onClose={() => setSelectedAppt(null)}
      title={`${vc.bookingSingular} details`}
      side="right"
      maxWidth={420}
      footer={
        <div style={{ display: "flex", gap: 8, paddingTop: 16 }}>
          <button onClick={() => setSelectedAppt(null)} style={{ flex: 1, padding: "11px", background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#6B6577", cursor: "pointer" }}>Close</button>
          <button onClick={onViewAll} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>View all →</button>
        </div>
      }
    >
      {/* Header — initials avatar, real name, real status */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, paddingBottom: 18, borderBottom: "1px solid #ECE9F1" }}>
        <Avatar name={a.client_name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.client_name}</div>
          <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 3, textTransform: "capitalize" }}>
            {a.status} · Calendar {vc.bookingSingular.toLowerCase()}
          </div>
        </div>
      </div>

      {/* When / what */}
      <div style={{ background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 12, padding: "14px 16px", margin: "18px 0" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A" }}>
          {vc.bookingSingular} at {new Date(a.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 12, color: "#6B6577", marginTop: 4 }}>
          {new Date(a.date_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        {a.serviceName && <div style={{ fontSize: 12.5, color: "#12101A", marginTop: 8, fontWeight: 600 }}>{a.serviceName}</div>}
        {(mins || a.staff?.name) && (
          <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 3 }}>
            {mins ? `${mins} min` : ""}{mins && a.staff?.name ? " with " : ""}{!mins && a.staff?.name ? "with " : ""}{a.staff?.name || ""}
          </div>
        )}
      </div>

      {/* Contact — each action only when its field exists */}
      {(a.client_phone || a.client_email) && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#9A94A8", letterSpacing: "0.9px", textTransform: "uppercase", marginBottom: 10 }}>
            {vc.clientSingular} contact
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {a.client_phone && (
              <a href={`tel:${a.client_phone}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Call {vc.clientSingular.toLowerCase()} · {a.client_phone}
              </a>
            )}
            {a.client_phone && (
              <a href={`https://wa.me/${whatsAppNumber(a.client_phone)}?text=${waText}`} target="_blank" rel="noopener"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(16,185,129,0.10)", color: "#047857", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Message on WhatsApp
              </a>
            )}
            {a.client_email && (
              <a href={`mailto:${a.client_email}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#FFFFFF", color: "#6B6577", border: "1px solid #ECE9F1", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}>
                {a.client_email}
              </a>
            )}
          </div>
        </>
      )}

      {/* Details */}
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#9A94A8", letterSpacing: "0.9px", textTransform: "uppercase", marginBottom: 4 }}>
        {vc.bookingSingular} details
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid #ECE9F1" }}>
        <span style={{ fontSize: 12, color: "#6B6577" }}>Status</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: "capitalize" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{a.status}
        </span>
      </div>
      {a.staff?.name && <DetailRow label={vc.staffSingular} value={a.staff.name} />}
      {mins !== null && <DetailRow label="Duration" value={`${mins} min`} />}
      {typeof a.combinedPrice === "number" && a.combinedPrice > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#12101A" }}>Total</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#12101A", letterSpacing: "-0.4px" }}>
            £{a.combinedPrice}{a.anyPriceIsFrom ? "+" : ""}
          </span>
        </div>
      )}
    </Modal>
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
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>Calendar</div>
      </div>
      <a href="/dashboard/bookings"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", borderRadius: 10, fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
        + New {vc.bookingSingular.toLowerCase()}
      </a>
    </header>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: 40, textAlign: "center", color: "#6B6577" }}>Loading calendar…</div>
    </DashboardShell>
  );

  const weekAppts = appointments.filter(a => weekDays.some(d => sameDay(new Date(a.date_time), d)));
  const dayAppts = getApptsByDay(currentDate);
  const rangeLabel = `${weekDays[0].toLocaleDateString("en-GB", { day: "numeric" })}–${weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  const freeTime = nextFreeTime(dayAppts);

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <style>{`
        .cal-agenda-row:hover { background: #FAF9FC; }
        .cal-desktop { display: block; }
        .cal-mobile  { display: none; }
        @media (max-width: 900px) {
          .cal-desktop { display: none; }
          .cal-mobile  { display: block; }
        }
        .cal-daypills::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ padding: "26px 24px 40px", maxWidth: 1360, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9A94A8", letterSpacing: "0.2px" }}>
            {weekAppts.length} {weekAppts.length === 1 ? vc.bookingSingular.toLowerCase() : vc.bookingPlural.toLowerCase()} this week
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#12101A", letterSpacing: "-0.5px", margin: "6px 0 0", lineHeight: 1.2 }}>Calendar</h1>
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {([["\u2039", -1], ["Today", 0], ["\u203a", 1]] as const).map(([lbl, dir]) => (
                <button key={lbl} onClick={() => dir === 0 ? setCurrentDate(new Date()) : nav(dir)}
                  style={{ minWidth: lbl === "Today" ? undefined : 34, padding: lbl === "Today" ? "7px 14px" : "7px 0", background: "#FFFFFF", color: "#6B6577", border: "1px solid #ECE9F1", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.14s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.color = "#6B6577"; }}
                >{lbl}</button>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>{rangeLabel}</div>
          </div>
          <div style={{ display: "flex", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 10, padding: 3, gap: 2 }}>
            {(["day","week","month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ fontSize: 11.5, padding: "5px 13px", borderRadius: 8, border: "none", background: view === v ? "#EDE9FF" : "transparent", color: view === v ? "#6D28D9" : "#6B6577", cursor: "pointer", fontWeight: view === v ? 700 : 500, transition: "all 0.14s", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ── Status counts (real) ── */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
          {[
            { label: "Confirmed", value: appointments.filter(a => a.status === "confirmed").length, color: "#10B981" },
            { label: "Pending", value: appointments.filter(a => a.status === "pending").length, color: "#F59E0B" },
            { label: "Cancelled", value: appointments.filter(a => a.status === "cancelled").length, color: "#EF4444" },
          ].map(st => (
            <div key={st.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#12101A" }}>{st.value}</span>
              <span style={{ fontSize: 12, color: "#6B6577" }}>{st.label}</span>
            </div>
          ))}
        </div>

        {/* ── Desktop: the grid views ── */}
        <div className="cal-desktop">
          {view === "month" && <MonthView currentDate={currentDate} monthDays={monthDays} getApptsByDay={getApptsByDay} today={today} setSelectedAppt={setSelectedAppt} />}
          {view === "week"  && <WeekView weekDays={weekDays} appointments={appointments} today={today} setSelectedAppt={setSelectedAppt} />}
          {view === "day"   && <DayView currentDate={currentDate} getApptsByDay={getApptsByDay} setSelectedAppt={setSelectedAppt} />}
        </div>

        {/* ── Mobile: day pills + agenda (not hour-bound, so nothing hides) ── */}
        <div className="cal-mobile">
          <div className="cal-daypills" style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
            {weekDays.map((day, di) => {
              const active = sameDay(day, currentDate);
              return (
                <button key={day.toISOString()} onClick={() => setCurrentDate(day)}
                  style={{ flex: "1 0 auto", minWidth: 46, padding: "9px 6px", borderRadius: 11, cursor: "pointer",
                    background: active ? "#7C3AED" : "#FFFFFF", color: active ? "#fff" : "#6B6577",
                    border: `1px solid ${active ? "#7C3AED" : "#ECE9F1"}`, transition: "all 0.14s" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", opacity: active ? 0.85 : 1 }}>{DAYS[di][0]}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, letterSpacing: "-0.2px" }}>{day.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 14, padding: "4px 16px 16px", boxShadow: "0 1px 2px rgba(18,16,26,0.03)" }}>
            <div style={{ padding: "14px 4px 4px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>
                {currentDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div style={{ fontSize: 10.5, color: "#9A94A8", marginTop: 3 }}>
                {dayAppts.length} {dayAppts.length === 1 ? vc.bookingSingular.toLowerCase() : vc.bookingPlural.toLowerCase()}
              </div>
            </div>

            {dayAppts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 12px", borderTop: "1px solid #ECE9F1", marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A" }}>Nothing booked</div>
                <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 4 }}>This day is completely free.</div>
              </div>
            ) : (
              <div style={{ marginTop: 6 }}>
                {dayAppts.map(a => <AgendaRow key={a.id} a={a} onClick={() => setSelectedAppt(a)} />)}
              </div>
            )}

            <button onClick={() => router.push("/dashboard/bookings")}
              style={{ width: "100%", marginTop: 14, padding: "12px", background: "transparent", border: "1.5px dashed #D6D1DE", borderRadius: 11, color: "#6B6577", fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.14s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#D6D1DE"; e.currentTarget.style.color = "#6B6577"; }}
            >
              + Add {vc.bookingSingular.toLowerCase()}{freeTime ? ` at ${freeTime}` : ""}
            </button>
          </div>
        </div>
      </div>

      <ApptDrawer selectedAppt={selectedAppt} setSelectedAppt={setSelectedAppt} salonName={salonName} onViewAll={() => { router.push("/dashboard/bookings"); setSelectedAppt(null); }} />
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
