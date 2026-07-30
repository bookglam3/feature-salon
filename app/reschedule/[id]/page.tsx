"use client";
import { useEffect, useState, use, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { supabase } from "@/app/lib/supabase";
import { fromZonedTime } from "date-fns-tz";
import {
  DAY_KEYS, COUNTRY_TIMEZONES, type BookedInterval,
  addMinutesToSlot, utcToSalonTime, isStaffAvailableForWindow, computeBlocked,
} from "@/app/lib/slot-availability";

interface Appointment {
  id: string;
  salon_id: string;
  staff_id: string | null;
  client_name: string;
  date_time: string;
  end_time: string | null;
  status: string;
  services: { name: string; price: number; duration_minutes?: number } | null;
  line_items?: { name: string; price: number; duration_minutes?: number }[];
  salon: { name: string; slug: string; timezone?: string; country?: string } | null;
  notes?: string;
}

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30",
];

function RescheduleContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [status, setStatus] = useState<"idle" | "rescheduled" | "cancelled" | "error">("idle");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; working_hours?: Record<string, { enabled: boolean; start: string; end: string }> }[]>([]);
  const [bookedIntervals, setBookedIntervals] = useState<BookedInterval[]>([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loadAvailability = async (date: string, salonId: string, apptId: string, tz: string) => {
    const { data: st } = await supabase
      .from("staff")
      .select("id, working_hours")
      .eq("salon_id", salonId)
      .eq("active", true);
    setStaffList(st || []);

    // end_time added — mirrors the PATCH handler's resolveEnd() fallback:
    // real end_time if present, else derived from the candidate's own
    // primary service duration. Without this, the grid could show a slot
    // as free that a multi-service booking actually occupies, only for the
    // server to correctly reject it on submit — a UX mismatch, not a
    // corruption risk (the server gate is authoritative either way), but
    // worth closing so the grid and the gate agree.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appts } = await (supabase.from("appointments") as any)
      .select("staff_id, date_time, end_time, services(duration_minutes)")
      .eq("salon_id", salonId)
      .gte("date_time", `${date}T00:00:00`)
      .lte("date_time", `${date}T23:59:59`)
      .not("status", "eq", "cancelled")
      .neq("id", apptId);

    const intervals: BookedInterval[] = (appts || []).map(
      (a: { staff_id: string | null; date_time: string; end_time: string | null; services: { duration_minutes?: number } | { duration_minutes?: number }[] | null }) => {
        const start = utcToSalonTime(a.date_time, tz);
        if (a.end_time) {
          return { staffId: a.staff_id, start, end: utcToSalonTime(a.end_time, tz) };
        }
        const svc = Array.isArray(a.services) ? a.services[0] : a.services;
        const dur = svc?.duration_minutes || 30;
        return { staffId: a.staff_id, start, end: addMinutesToSlot(start, dur) };
      }
    );
    setBookedIntervals(intervals);
  };

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/appointment/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setAppt(data);
      if (data?.date_time) {
        const d = new Date(data.date_time);
        const initDate = d.toISOString().slice(0, 10);
        setNewDate(initDate);
        setNewTime(d.toTimeString().slice(0, 5));
        if (data.salon_id) {
          const tz = data.salon?.timezone || COUNTRY_TIMEZONES[data.salon?.country || ""] || "Europe/London";
          await loadAvailability(initDate, data.salon_id, data.id, tz);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleReschedule = async () => {
    if (!newDate || !newTime) return;
    setSubmitting(true);
    // Same fromZonedTime conversion as the public booking page (8b3ea7e) —
    // the salon's timezone is already fetched via GET /api/appointment/[id]
    // and used elsewhere in this file (loadAvailability, the date picker);
    // this was the one write path still bypassing it.
    const tz = appt?.salon?.timezone || COUNTRY_TIMEZONES[appt?.salon?.country || ""] || "Europe/London";
    const newDateTime = fromZonedTime(`${newDate}T${newTime}:00`, tz).toISOString();
    const res = await fetch(`/api/appointment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reschedule",
        date_time: newDateTime,
        notes: `Rescheduled by client${note ? `: ${note}` : ""}.`,
        note,
        token,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { setStatus("error"); return; }
    setStatus("rescheduled");
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setSubmitting(true);
    const res = await fetch(`/api/appointment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        notes: `Cancelled by client${note ? `: ${note}` : ""}.`,
        note,
        token,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { setStatus("error"); return; }
    setStatus("cancelled");
  };

  const salonName = appt?.salon?.name || "the salon";

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", color: "#94A3B8" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Loading your appointment…</div>
      </div>
    </div>
  );

  if (!appt) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", color: "#94A3B8", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>Appointment Not Found</div>
        <div style={{ fontSize: 14, color: "#64748B" }}>This link may be invalid or expired.</div>
      </div>
    </div>
  );

  if (status === "rescheduled") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#F0FDF4,#ECFDF5)", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 24, boxShadow: "0 16px 60px rgba(0,0,0,0.1)", maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>Rescheduled!</div>
        <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>Your appointment has been rescheduled. The salon has been notified and will confirm your new time.</div>
        <div style={{ marginTop: 20, padding: "14px 20px", background: "#F0FDF4", borderRadius: 14, fontSize: 15, fontWeight: 700, color: "#059669" }}>
          📅 {new Date(`${newDate}T${newTime}`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {newTime}
        </div>
      </div>
    </div>
  );

  if (status === "cancelled") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FEF2F2,#FFF1F2)", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 24, boxShadow: "0 16px 60px rgba(0,0,0,0.1)", maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>😢</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginBottom: 8 }}>Appointment Cancelled</div>
        <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>Your appointment has been cancelled. The salon has been notified. We hope to see you again soon!</div>
        <a href={`/book/${appt?.salon?.slug || ""}`}
          style={{ display: "block", marginTop: 20, padding: "12px", background: "linear-gradient(135deg,#6366F1,#4F46E5)", color: "#fff", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
          Book Again →
        </a>
      </div>
    </div>
  );

  const apptDate = new Date(appt.date_time);
  const isPast = apptDate < new Date();
  const isCancelled = appt.status === "cancelled";

  const today = new Date();
  const availableSlots = newDate ? TIME_SLOTS.filter(t => {
    const isToday = newDate === todayStr;
    if (!isToday) return true;
    const [h, m] = t.split(":").map(Number);
    return h > today.getHours() || (h === today.getHours() && m > today.getMinutes());
  }) : TIME_SLOTS;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#F8FAFC,#EEF2FF)", fontFamily: "system-ui,sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>Manage Your Appointment</div>
          <div style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>{salonName}</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Your Appointment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Client",  value: appt.client_name },
              {
                label: (appt.line_items && appt.line_items.length > 1) ? "Services" : "Service",
                // Multi-service aware: shows every booked service, not just
                // the primary. Falls back to the single `services` join for
                // bookings that predate multi-service (empty line_items).
                value: (appt.line_items && appt.line_items.length > 0)
                  ? appt.line_items.map(li => li.name).join(", ")
                  : (appt.services?.name || "—"),
              },
              { label: "Date",    value: apptDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }) },
              { label: "Time",    value: apptDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13.5, color: "#64748B" }}>{label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5, color: "#64748B" }}>Status</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: isCancelled ? "#FEF2F2" : "#ECFDF5", color: isCancelled ? "#DC2626" : "#059669" }}>
                {appt.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {!isPast && !isCancelled ? (
          <>
            <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 16 }}>🔄 Reschedule</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>New Date</label>
                  <input type="date" value={newDate} onChange={e => {
                    const d = e.target.value;
                    setNewDate(d);
                    setNewTime("");
                    if (appt?.salon_id) {
                      const tz = appt.salon?.timezone || COUNTRY_TIMEZONES[appt.salon?.country || ""] || "Europe/London";
                      loadAvailability(d, appt.salon_id, appt.id, tz);
                    }
                  }}
                    min={todayStr}
                    style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E2E8F0", borderRadius: 12, fontSize: 15, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 8 }}>New Time</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {(() => {
                      const selectedStaff = appt?.staff_id
                        ? (staffList.find(s => s.id === appt.staff_id) ?? null)
                        : null;
                      // This booking's own combined duration — preserved from its
                      // current end_time - date_time, same as the PATCH handler's
                      // fix, NOT re-derived from the primary service alone. Without
                      // this, the grid would treat a 158-min multi-service booking
                      // as 20 minutes long while picking its own new time, showing
                      // a slot free that the real (longer) booking would overflow
                      // into an adjacent appointment.
                      const serviceDuration = appt?.end_time
                        ? Math.round((new Date(appt.end_time).getTime() - new Date(appt.date_time).getTime()) / 60_000)
                        : (appt?.services?.duration_minutes || 30);
                      const dayKey = newDate ? DAY_KEYS[new Date(newDate + "T12:00:00Z").getDay()] : "";
                      const cbOpts = { selectedStaff, staffList, bookedIntervals, serviceDuration, dayKey };
                      return availableSlots.map(t => {
                        const isBlocked = newDate ? computeBlocked(t, cbOpts) : false;
                        const slotEnd = addMinutesToSlot(t, serviceDuration);
                        const isEligible = staffList.length === 0 || staffList.some(s => isStaffAvailableForWindow(s, t, slotEnd, dayKey));
                        return (
                          <button key={t} type="button"
                            disabled={isBlocked}
                            onClick={() => !isBlocked && setNewTime(t)}
                            title={isBlocked ? (isEligible ? "Fully booked" : "Outside working hours") : ""}
                            style={{
                              padding: "8px 4px", borderRadius: 8,
                              border: `1.5px solid ${newTime === t ? "#6366F1" : isBlocked ? "rgba(239,68,68,0.3)" : "#E2E8F0"}`,
                              background: newTime === t ? "#EEF2FF" : isBlocked ? "rgba(239,68,68,0.05)" : "#F8FAFC",
                              color: newTime === t ? "#4F46E5" : isBlocked ? "#FCA5A5" : "#475569",
                              fontSize: 13, fontWeight: newTime === t ? 700 : 500,
                              cursor: isBlocked ? "not-allowed" : "pointer",
                              opacity: isBlocked ? 0.5 : 1,
                              transition: "all 0.12s",
                              textDecoration: isBlocked ? "line-through" : "none",
                            }}>
                            {t}
                            {isBlocked ? <span style={{ display: "block", fontSize: 9, color: "#EF4444", fontWeight: 700 }}>Taken</span> : null}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Note (optional)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Any reason or special request…" rows={2}
                    style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E2E8F0", borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <button onClick={handleReschedule} disabled={!newDate || !newTime || submitting}
                style={{ marginTop: 16, width: "100%", padding: 14, background: !newDate || !newTime ? "#E2E8F0" : "linear-gradient(135deg,#6366F1,#4F46E5)", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, color: !newDate || !newTime ? "#94A3B8" : "#fff", cursor: !newDate || !newTime ? "not-allowed" : "pointer", boxShadow: !newDate || !newTime ? "none" : "0 4px 20px rgba(99,102,241,0.4)" }}>
                {submitting ? "Saving…" : "Confirm Reschedule →"}
              </button>
            </div>

            <div style={{ textAlign: "center" }}>
              <button onClick={handleCancel} disabled={submitting}
                style={{ padding: "10px 24px", background: "#FEF2F2", color: "#DC2626", border: "1.5px solid #FECACA", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                ✕ Cancel Appointment
              </button>
            </div>
          </>
        ) : (
          <div style={{ background: "#F1F5F9", borderRadius: 16, padding: "20px", textAlign: "center", color: "#64748B", fontSize: 14 }}>
            {isPast ? "⏰ This appointment has already passed and cannot be changed." : "This appointment has been cancelled."}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#94A3B8" }}>
          Powered by <strong>Feature Salon</strong>
        </div>
      </div>
    </div>
  );
}

export default function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>Loading…</div>}>
      <RescheduleContent params={params} />
    </Suspense>
  );
}
