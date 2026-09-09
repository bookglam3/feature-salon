"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface ClosedDate {
  id: string;
  date: string;
  reason: string;
}

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0,0,0,0);
  return d;
}

export default function ClosedDatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string|null>(null);
  const [salonName, setSalonName] = useState("");
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const { data } = await supabase.from("closed_dates").select("*").eq("salon_id", profile.salon.id).order("date");
      setClosedDates(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const weekDays = Array.from({length:7},(_,i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const isClosed = (date: Date) => {
    const ds = date.toISOString().slice(0,10);
    return closedDates.find(c => c.date === ds);
  };

  const handleAdd = async () => {
    if (!salonId || !form.date) { toast.error("Date required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("closed_dates").insert({
      salon_id: salonId, date: form.date, reason: form.reason
    }).select().single();
    if (error) { toast.error("Date already closed or error"); setSaving(false); return; }
    setClosedDates(p => [...p, data].sort((a,b) => a.date.localeCompare(b.date)));
    toast.success("Closed date added!");
    setShowModal(false);
    setForm({ date: "", reason: "" });
    setSaving(false);
  };

  const handleRemove = async (id: string, date: string) => {
    await supabase.from("closed_dates").delete().eq("id", id);
    setClosedDates(p => p.filter(c => c.id !== id));
    toast.success(`${date} removed`);
  };

  const quickAdd = async (date: Date, reason: string) => {
    if (!salonId) return;
    const ds = date.toISOString().slice(0,10);
    const existing = closedDates.find(c => c.date === ds);
    if (existing) { handleRemove(existing.id, ds); return; }
    const { data, error } = await supabase.from("closed_dates").insert({ salon_id: salonId, date: ds, reason }).select().single();
    if (!error && data) {
      setClosedDates(p => [...p, data].sort((a,b) => a.date.localeCompare(b.date)));
      toast.success(`${ds} marked as closed`);
    }
  };

  const Topbar = (
    <header style={{ background:"#FFFFFF", borderBottom:"1px solid #ECE9F1", padding:"0 24px", height:66, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>Closed Dates</div>
          <div style={{ fontSize:11.5, color:"#6B6577", marginTop:1 }}>Manage holidays & salon closures</div>
        </div>
      </div>
      <button onClick={() => setShowModal(true)} style={{ padding:"9px 18px", background:"linear-gradient(135deg,#EF4444,#DC2626)", color:"#fff", border:"none", borderRadius:12, fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(239,68,68,0.3)" }}>+ Add Closure</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding:40, textAlign:"center", color:"#6B6577" }}>Loading…</div></DashboardShell>;

  const now = new Date();
  const upcoming = closedDates.filter(c => c.date >= now.toISOString().slice(0,10));
  const past = closedDates.filter(c => c.date < now.toISOString().slice(0,10));

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding:"28px 24px", maxWidth:1200, margin:"0 auto" }}>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
          {[
            { label:"Total Closures", value:closedDates.length, icon:"🚫", color:"#EF4444" },
            { label:"Upcoming", value:upcoming.length, icon:"📅", color:"#F59E0B" },
            { label:"Past Closures", value:past.length, icon:"✅", color:"#10B981" },
          ].map(s => (
            <div key={s.label} style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:16, padding:"18px 20px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:s.color }} />
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:10, fontWeight:800, color:"#6B6577", textTransform:"uppercase", letterSpacing:"0.8px" }}>{s.label}</span>
                <span style={{ fontSize:20 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize:28, fontWeight:900, color:"#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20 }}>
          {/* Calendar */}
          <div style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid #ECE9F1", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>
                {weekDays[0].toLocaleDateString("en-GB", { day:"numeric", month:"short" })} – {weekDays[6].toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {(["← Prev","Today","Next →"] as const).map((lbl,i) => (
                  <button key={lbl} onClick={() => {
                    if (i === 1) setWeekStart(getMonday(new Date()));
                    else { const d = new Date(weekStart); d.setDate(d.getDate() + (i===0?-7:7)); setWeekStart(d); }
                  }} style={{ padding:"6px 12px", background: i===1 ? "#7C3AED" : "#F5F3FF", color: i===1 ? "#fff" : "#524D60", border:`1.5px solid ${i===1 ? "transparent" : "#ECE9F1"}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:0 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign:"center", padding:"10px 4px", fontSize:10, fontWeight:800, color:"#6B6577", textTransform:"uppercase", letterSpacing:"0.5px", borderBottom:"1px solid #ECE9F1", background:"#F5F3FF" }}>{d}</div>
              ))}
              {weekDays.map(day => {
                const closed = isClosed(day);
                const isToday = day.toDateString() === now.toDateString();
                const isPast = day < now && !isToday;
                return (
                  <div key={day.toISOString()}
                    onClick={() => !isPast && quickAdd(day, "Holiday")}
                    style={{ minHeight:80, padding:"10px 8px", borderRight:"1px solid #ECE9F1", borderBottom:"1px solid #ECE9F1", background: closed ? "rgba(239,68,68,0.10)" : isToday ? "rgba(124,58,237,0.10)" : "#FFFFFF", cursor: isPast ? "default" : "pointer", transition:"all 0.15s", position:"relative" }}
                    onMouseEnter={e => { if (!isPast) e.currentTarget.style.background = closed ? "rgba(239,68,68,0.10)" : "#F5F3FF"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = closed ? "rgba(239,68,68,0.10)" : isToday ? "rgba(124,58,237,0.10)" : "#FFFFFF"; }}
                  >
                    <div style={{ fontSize:13, fontWeight: isToday ? 900 : 600, color: closed ? "#DC2626" : isToday ? "#7C3AED" : isPast ? "#524D60" : "#12101A", marginBottom:4 }}>{day.getDate()}</div>
                    {closed && (
                      <div style={{ fontSize:9.5, fontWeight:700, color:"#DC2626", background:"rgba(239,68,68,0.10)", padding:"2px 6px", borderRadius:5, lineHeight:1.4 }}>
                        🚫 {closed.reason || "Closed"}
                      </div>
                    )}
                    {!closed && !isPast && (
                      <div style={{ fontSize:9, color:"#524D60", marginTop:4 }}>Click to close</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* List */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Upcoming closures */}
            <div style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #ECE9F1" }}>
                <div style={{ fontSize:14, fontWeight:800, color:"#12101A" }}>Upcoming Closures</div>
              </div>
              <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8, maxHeight:280, overflowY:"auto" }}>
                {upcoming.length === 0 && <div style={{ textAlign:"center", padding:"20px 0", color:"#6B6577", fontSize:13 }}>No upcoming closures</div>}
                {upcoming.map(c => (
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(239,68,68,0.10)", border:"1.5px solid #FECACA", borderRadius:12 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#DC2626" }}>{new Date(c.date + "T00:00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}</div>
                      <div style={{ fontSize:11.5, color:"#EF4444", marginTop:2 }}>{c.reason || "No reason given"}</div>
                    </div>
                    <button onClick={() => handleRemove(c.id, c.date)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#DC2626" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }} onMouseLeave={e => { e.currentTarget.style.color = "#DC2626"; }}>🗑</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick add common */}
            <div style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:20, padding:"16px 20px" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#12101A", marginBottom:12 }}>Quick Add UK Holidays</div>
              {[
                { label:"Christmas Day", date:"2025-12-25" },
                { label:"Boxing Day", date:"2025-12-26" },
                { label:"New Year's Day", date:"2026-01-01" },
                { label:"Easter Monday", date:"2026-04-06" },
                { label:"Early May Bank", date:"2026-05-04" },
              ].map(h => {
                const isCl = closedDates.find(c => c.date === h.date);
                return (
                  <button key={h.date} onClick={async () => {
                    if (!salonId) return;
                    if (isCl) { handleRemove(isCl.id, h.date); return; }
                    const { data } = await supabase.from("closed_dates").insert({ salon_id: salonId, date: h.date, reason: h.label }).select().single();
                    if (data) { setClosedDates(p => [...p, data].sort((a,b) => a.date.localeCompare(b.date))); toast.success(`${h.label} added!`); }
                  }}
                  style={{ width:"100%", textAlign:"left", padding:"8px 12px", marginBottom:6, borderRadius:10, border:`1.5px solid ${isCl ? "rgba(239,68,68,0.25)" : "#ECE9F1"}`, background: isCl ? "rgba(239,68,68,0.10)" : "#F5F3FF", fontSize:12.5, fontWeight:600, color: isCl ? "#DC2626" : "#524D60", cursor:"pointer", display:"flex", justifyContent:"space-between", transition:"all 0.12s" }}>
                    <span>{h.label}</span>
                    <span style={{ fontSize:11, color:"#6B6577" }}>{isCl ? "✓ Added" : h.date}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#FFFFFF", borderRadius:20, padding:28, width:"100%", maxWidth:400, boxShadow:"0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#12101A", marginBottom:20 }}>Add Closure</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#524D60", display:"block", marginBottom:6 }}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} style={{ width:"100%", padding:"10px 13px", border:"1.5px solid #ECE9F1", borderRadius:10, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#524D60", display:"block", marginBottom:6 }}>Reason (optional)</label>
                <input value={form.reason} onChange={e => setForm({...form, reason:e.target.value})} placeholder="e.g. Christmas, Holiday, Staff Training" style={{ width:"100%", padding:"10px 13px", border:"1.5px solid #ECE9F1", borderRadius:10, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex:1, padding:12, background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:12, fontSize:13.5, fontWeight:700, color:"#524D60", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.date} style={{ flex:2, padding:12, background:"linear-gradient(135deg,#EF4444,#DC2626)", border:"none", borderRadius:12, fontSize:13.5, fontWeight:700, color:"#fff", cursor:"pointer", opacity: !form.date ? 0.5 : 1 }}>
                {saving ? "Saving…" : "Add Closure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
