"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { COUNTRY_TIMEZONES } from "../../lib/slot-availability";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import { useToast } from "../components/Toast";
import type { Appointment, Service } from "../../types";
import { useSalon } from "../context/SalonContext";

type StaffItem = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  confirmed: "dk-badge-green",
  pending:   "dk-badge-indigo",
  cancelled: "dk-badge-red",
  completed: "dk-badge-green",
  no_show:   "dk-badge-amber",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "dk-badge-slate";
  return <span className={`dk-badge ${cls}`}>{status.replace("_"," ")}</span>;
}

const EMPTY_FORM = { client_name: "", client_email: "", client_phone: "", staff_id: "", service_id: "", date_time: "", status: "pending", notes: "",
  // beauty consultation fields
  skin_type: "", allergies: "no", allergy_details: "", previous_treatments: "", medical_conditions: "", patch_test: false,
};

export default function BookingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<{ id: string; name: string; timezone?: string | null; country?: string | null } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [view, setView] = useState<"table"|"calendar">("table");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: salonData } = await supabase.from("salons").select("*").eq("owner_id", user.id).single();
      setSalon(salonData);
      if (salonData) {
        const [{ data: appts }, { data: staffData }, { data: svcs }] = await Promise.all([
          supabase.from("appointments").select("*, services(name,price,price_is_from), staff(name)").eq("salon_id", salonData.id).order("date_time", { ascending: true }),
          supabase.from("staff").select("id,name").eq("salon_id", salonData.id),
          supabase.from("services").select("*").eq("salon_id", salonData.id),
        ]);
        setAppointments(appts || []);
        setStaff(staffData || []);
        setServices(svcs || []);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const reloadAppts = useCallback(async () => {
    if (!salon) return;
    const { data } = await supabase.from("appointments").select("*, services(name,price,price_is_from), staff(name)").eq("salon_id", salon.id).order("date_time", { ascending: true });
    setAppointments(data || []);
  }, [salon]);

  const serializeNotes = useCallback((fd: typeof EMPTY_FORM, hasConsultation: boolean): string | null => {
    if (!hasConsultation) return fd.notes || null;
    const consultation = { skin_type: fd.skin_type, allergies: fd.allergies, allergy_details: fd.allergy_details, previous_treatments: fd.previous_treatments, medical_conditions: fd.medical_conditions, patch_test: fd.patch_test };
    return JSON.stringify({ consultation, notes: fd.notes });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!salon) return;
    const notesValue = serializeNotes(formData, vc.consultationForm);
    // Stage 1 of the interval-overlap fix: end_time written at booking time.
    // formData.service_id can be "" (no service selected) — this form allows
    // that, unlike the public booking page — so the 30-min fallback matches
    // the same default used everywhere else in the codebase, not a guess.
    const selectedSvc = services.find(s => s.id === formData.service_id);
    const durationMin = selectedSvc?.duration_minutes || 30;
    // Same fromZonedTime conversion as the public booking page (8b3ea7e).
    // Previously date_time was formData.date_time passed straight through
    // (Postgres treats the offset-less string as UTC), while end_time was
    // separately derived via new Date(formData.date_time) (parsed in the
    // BROWSER's timezone) — two different interpreters for the same
    // instant, which could silently disagree (e.g. store a zero-duration
    // appointment for a 60-min service). Both now derive from one corrected
    // instant, so they can no longer contradict each other.
    const salonTz = salon.timezone || COUNTRY_TIMEZONES[salon.country || ""] || "Europe/London";
    const startIso = formData.date_time ? fromZonedTime(`${formData.date_time}:00`, salonTz).toISOString() : null;
    const endTimeIso = startIso
      ? new Date(new Date(startIso).getTime() + durationMin * 60_000).toISOString()
      : null;
    if (editingId) {
      const { error } = await supabase.from("appointments").update({ client_name: formData.client_name, client_email: formData.client_email, client_phone: formData.client_phone, staff_id: formData.staff_id || null, service_id: formData.service_id, date_time: startIso, end_time: endTimeIso, status: formData.status, notes: notesValue }).eq("id", editingId);
      if (error) { toast.error("Failed to update booking"); return; }
      toast.success("Booking updated!");
    } else {
      const { data: inserted, error } = await supabase
        .from("appointments")
        .insert({ salon_id: salon.id, client_name: formData.client_name, client_email: formData.client_email, client_phone: formData.client_phone, staff_id: formData.staff_id || null, service_id: formData.service_id, date_time: startIso, end_time: endTimeIso, status: formData.status, notes: notesValue })
        .select("id")
        .single();
      if (error) { toast.error("Failed to create booking"); return; }

      if (formData.client_email && inserted?.id) {
        setSendingEmail(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const appUrl = window.location.origin;
          const res = await fetch(`${appUrl}/api/send-confirmation`, {
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
        setSendingEmail(false);
      } else {
        toast.success("Booking created!");
      }
    }
    setFormData(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    await reloadAppts();
  }, [salon, editingId, formData, vc, toast, reloadAppts, serializeNotes]);

  const handleEdit = useCallback((a: Appointment) => {
    setEditingId(a.id);
    let parsed = { notes: a.notes || "", skin_type: "", allergies: "no", allergy_details: "", previous_treatments: "", medical_conditions: "", patch_test: false };
    if (vc.consultationForm && a.notes) {
      try {
        const p = JSON.parse(a.notes);
        if (p.consultation) { parsed = { notes: p.notes || "", ...p.consultation }; }
      } catch { /* plain text notes — leave as-is */ }
    }
    // Previously a.date_time.slice(0,16) — the raw UTC digits, mislabeled
    // as local time in the datetime-local input. Harmless-by-coincidence
    // while the write side was also a raw passthrough (round-tripped back
    // to the same wrong-but-consistent value); now that the write side does
    // a real salon-local -> UTC conversion, this MUST convert UTC -> salon-
    // local first, or saving an edit that never touched the date field
    // would silently shift a correct booking's time. formatInTimeZone
    // (date-fns-tz, already a dependency) rather than utcToSalonTime —
    // that helper only returns the time portion (HH:mm), not the date, and
    // the local calendar date can differ from the UTC one near midnight.
    const salonTz = salon?.timezone || COUNTRY_TIMEZONES[salon?.country || ""] || "Europe/London";
    setFormData({ client_name: a.client_name || "", client_email: a.client_email || "", client_phone: a.client_phone || "", staff_id: a.staff_id || "", service_id: a.service_id || "", date_time: a.date_time ? formatInTimeZone(a.date_time, salonTz, "yyyy-MM-dd'T'HH:mm") : "", status: a.status || "pending", ...parsed });
    setShowForm(true);
  }, [vc, salon]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("Delete this booking? This cannot be undone.")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Booking deleted");
    await reloadAppts();
  }, [toast, reloadAppts]);

  const filtered = useMemo(() => {
    const now = new Date();
    let list = appointments;
    if (activeTab === "Today")     list = list.filter(a => new Date(a.date_time).toDateString() === now.toDateString());
    else if (activeTab === "Upcoming")  list = list.filter(a => new Date(a.date_time) > now && a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show");
    else if (activeTab === "Completed") list = list.filter(a => a.status === "completed");
    else if (activeTab === "Cancelled") list = list.filter(a => a.status === "cancelled" || a.status === "no_show");
    if (search) list = list.filter(a => a.client_name?.toLowerCase().includes(search.toLowerCase()) || a.services?.name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [appointments, activeTab, search]);

  const getWeekDays = useCallback(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
  }, [weekOffset]);

  const weekDays = getWeekDays();

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header className="elite-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF", letterSpacing: "-0.4px" }}>{vc.bookingPlural}</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{appointments.length} total {vc.bookingPlural.toLowerCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="elite-tabs">
          {(["table","calendar"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`elite-tab${view === v ? " active" : ""}`}>
              {v === "table" ? "Table" : "Calendar"}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData(EMPTY_FORM); }}
          className="elite-btn-primary"
        >+ New {vc.bookingSingular}</button>
      </div>
    </header>
  );

  return (
    <DashboardShell salonName={salon?.name} topbar={Topbar}>
      <div style={{ padding: "24px 20px" }}>

        {/* Search + Tabs bar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client or service…"
            className="elite-input"
            style={{ flex: 1, minWidth: 160 }}
          />
          <div className="elite-tabs" style={{ flexWrap: "wrap" }}>
            {["All","Today","Upcoming","Completed","Cancelled"].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`elite-tab${activeTab === t ? " active" : ""}`}>{t}</button>
            ))}
          </div>
        </div>

        {view === "table" ? (
          <div className="elite-table-wrap fade-in-up">
            {filtered.length === 0 ? (
              <EmptyState title="No bookings found" description={search ? "Try a different search term" : "Create your first booking to get started"} action={{ label: "+ New Booking", onClick: () => setShowForm(true) }} />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="elite-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      {["Status", vc.clientSingular, "Service", vc.staffSingular, "Date & Time","Amount","Actions"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.id}>
                        <td><StatusPill status={a.status} /></td>
                        <td style={{ fontWeight: 700, color: "#F7F5EF" }}>{a.client_name}</td>
                        <td style={{ color: "rgba(255,255,255,0.55)" }}>{a.services?.name || <span style={{opacity:.3}}>—</span>}</td>
                        <td style={{ color: "rgba(255,255,255,0.4)" }}>{a.staff?.name || <span style={{fontSize:11,opacity:.4}}>Any</span>}</td>
                        <td style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{new Date(a.date_time).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                        <td style={{ fontWeight: 700, color: "#34D399" }}>{a.services?.price ? `${a.services.price_is_from ? "from " : ""}£${a.services.price}` : <span style={{opacity:.3}}>—</span>}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleEdit(a)} className="elite-btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>Edit</button>
                            {a.status !== "completed" && a.status !== "cancelled" && (
                              <button onClick={async () => { await supabase.from("appointments").update({ status: "completed" }).eq("id", a.id); await reloadAppts(); toast.success("Marked complete ✓"); }} className="elite-btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5, color: "#34D399", borderColor: "rgba(16,185,129,0.2)" }}>Done</button>
                            )}
                            {a.status !== "no_show" && a.status !== "cancelled" && a.status !== "completed" && (
                              <button onClick={async () => { await supabase.from("appointments").update({ status: "no_show" }).eq("id", a.id); await reloadAppts(); toast.success("No-show marked"); }} className="elite-btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5, color: "#FCD34D", borderColor: "rgba(245,158,11,0.2)" }}>No-show</button>
                            )}
                            <button onClick={() => handleDelete(a.id)} className="elite-btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5, color: "#FCA5A5", borderColor: "rgba(239,68,68,0.2)" }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Calendar View */
          <div className="elite-table-wrap fade-in-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <button onClick={() => setWeekOffset(w => w - 1)} className="elite-btn-ghost" style={{ padding: "5px 12px" }}>←</button>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F7F5EF" }}>
                {weekDays[0].toLocaleDateString("en-GB",{day:"numeric",month:"short"})} – {weekDays[6].toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setWeekOffset(0)} className="elite-btn-ghost" style={{ padding: "5px 12px", color: "#C9A24B", borderColor: "rgba(201,162,75,0.25)" }}>Today</button>
                <button onClick={() => setWeekOffset(w => w + 1)} className="elite-btn-ghost" style={{ padding: "5px 12px" }}>→</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid rgba(255,255,255,0.07)", overflowX: "auto" }}>
              {weekDays.map((day, i) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderRight: i < 6 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day.getDay()]}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: isToday ? "linear-gradient(135deg,#C9A24B,#0E1320)" : "transparent", color: isToday ? "#fff" : "#2a3350", fontSize: 13, fontWeight: isToday ? 800 : 500, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: isToday ? "0 4px 12px rgba(201,162,75,0.45)" : "none" }}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", minHeight: 280, overflowX: "auto" }}>
              {weekDays.map((day, i) => {
                const dayAppts = appointments.filter(a => new Date(a.date_time).toDateString() === day.toDateString());
                return (
                  <div key={i} style={{ padding: 6, borderRight: i < 6 ? "1px solid rgba(255,255,255,0.05)" : "none", minHeight: 200 }}>
                    {dayAppts.map(a => (
                      <div key={a.id} onClick={() => handleEdit(a)}
                        style={{ background: "rgba(201,162,75,0.12)", borderRadius: 7, padding: "5px 8px", marginBottom: 4, cursor: "pointer", borderLeft: "3px solid #C9A24B", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,75,0.22)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,162,75,0.12)"; }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#C9A24B" }}>{new Date(a.date_time).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>
                        <div style={{ fontSize: 10.5, color: "#F7F5EF", fontWeight: 600 }}>{a.client_name}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{a.services?.name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? `Edit ${vc.bookingSingular}` : `New ${vc.bookingSingular}`}>
        <form onSubmit={handleSubmit}>
          <FormGroup label="Client Name *"><Input placeholder="Sarah Johnson" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} required /></FormGroup>
          <FormGroup label="Email"><Input type="email" placeholder="sarah@email.com" value={formData.client_email} onChange={e => setFormData({ ...formData, client_email: e.target.value })} /></FormGroup>
          <FormGroup label="Phone"><Input placeholder="+44 7700 900000" value={formData.client_phone} onChange={e => setFormData({ ...formData, client_phone: e.target.value })} /></FormGroup>
          <FormGroup label="Date & Time *"><Input type="datetime-local" value={formData.date_time} onChange={e => setFormData({ ...formData, date_time: e.target.value })} required /></FormGroup>
          <FormGroup label="Service"><Select value={formData.service_id} onChange={e => setFormData({ ...formData, service_id: e.target.value })}><option value="">Select service</option>{services.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price_is_from ? "from " : ""}{s.price}</option>)}</Select></FormGroup>
          <FormGroup label={vc.staffSingular}><Select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}><option value="">Any Available {vc.staffSingular}</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></FormGroup>
          <FormGroup label="Status"><Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">✓ Completed</option><option value="no_show">💤 No-show</option><option value="cancelled">Cancelled</option></Select></FormGroup>
          {vc.treatmentNotes && (
            <FormGroup label="Treatment Notes">
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Clinical observations, treatment plan, follow-up notes…"
                rows={4}
                style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #2a3350", borderRadius: 10, resize: "vertical", fontFamily: "inherit", color: "#F7F5EF", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#C9A24B"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a3350"; }}
              />
            </FormGroup>
          )}

          {vc.consultationForm && (
            <>
              <div style={{ margin: "16px 0 10px", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A24B", letterSpacing: "0.8px", textTransform: "uppercase" }}>Beauty Consultation</div>
              </div>
              <FormGroup label="Skin Type">
                <Select value={formData.skin_type} onChange={e => setFormData({ ...formData, skin_type: e.target.value })}>
                  <option value="">Select skin type</option>
                  <option value="normal">Normal</option>
                  <option value="dry">Dry</option>
                  <option value="oily">Oily</option>
                  <option value="combination">Combination</option>
                  <option value="sensitive">Sensitive</option>
                </Select>
              </FormGroup>
              <FormGroup label="Known Allergies?">
                <Select value={formData.allergies} onChange={e => setFormData({ ...formData, allergies: e.target.value, allergy_details: e.target.value === "no" ? "" : formData.allergy_details })}>
                  <option value="no">No known allergies</option>
                  <option value="yes">Yes — has allergies</option>
                </Select>
              </FormGroup>
              {formData.allergies === "yes" && (
                <FormGroup label="Allergy Details">
                  <Input
                    placeholder="e.g. latex, fragrance, nickel…"
                    value={formData.allergy_details}
                    onChange={e => setFormData({ ...formData, allergy_details: e.target.value })}
                  />
                </FormGroup>
              )}
              <FormGroup label="Previous Beauty Treatments">
                <textarea
                  value={formData.previous_treatments}
                  onChange={e => setFormData({ ...formData, previous_treatments: e.target.value })}
                  placeholder="e.g. facials, waxing, lash extensions…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #2a3350", borderRadius: 10, resize: "vertical", fontFamily: "inherit", color: "#F7F5EF", lineHeight: 1.6, outline: "none", boxSizing: "border-box", background: "transparent" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#C9A24B"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#2a3350"; }}
                />
              </FormGroup>
              <FormGroup label="Medical Conditions / Medications">
                <textarea
                  value={formData.medical_conditions}
                  onChange={e => setFormData({ ...formData, medical_conditions: e.target.value })}
                  placeholder="e.g. rosacea, eczema, pregnancy, blood thinners…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #2a3350", borderRadius: 10, resize: "vertical", fontFamily: "inherit", color: "#F7F5EF", lineHeight: 1.6, outline: "none", boxSizing: "border-box", background: "transparent" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#C9A24B"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#2a3350"; }}
                />
              </FormGroup>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 14px", padding: "10px 12px", background: "rgba(201,162,75,0.06)", borderRadius: 10, border: "1px solid rgba(201,162,75,0.15)", cursor: "pointer" }} onClick={() => setFormData(f => ({ ...f, patch_test: !f.patch_test }))}>
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${formData.patch_test ? "#C9A24B" : "#2a3350"}`, background: formData.patch_test ? "#C9A24B" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {formData.patch_test && <span style={{ color: "#0E1320", fontSize: 11, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#F7F5EF" }}>Patch Test Consent</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Client consents to patch test before treatment</div>
                </div>
              </div>
              <FormGroup label="Additional Notes">
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any other notes about this client or appointment…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1.5px solid #2a3350", borderRadius: 10, resize: "vertical", fontFamily: "inherit", color: "#F7F5EF", lineHeight: 1.6, outline: "none", boxSizing: "border-box", background: "transparent" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#C9A24B"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#2a3350"; }}
                />
              </FormGroup>
            </>
          )}
          {!editingId && formData.client_email && (
            <p style={{ fontSize: 12, color: "#10B981", margin: "0 0 12px", fontWeight: 500 }}>✉️ Confirmation email will be sent to {formData.client_email}</p>
          )}
          <ModalActions><BtnSecondary type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</BtnSecondary><BtnPrimary type="submit" disabled={sendingEmail}>{sendingEmail ? "Sending confirmation…" : editingId ? "Update" : "Create Booking"}</BtnPrimary></ModalActions>
        </form>
      </Modal>
    </DashboardShell>
  );
}

