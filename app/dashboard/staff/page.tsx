"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import { useToast } from "../components/Toast";
import type { StaffMember } from "../../types";
import { useSalon } from "../context/SalonContext";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const EMPTY_FORM = {
  name: "", email: "", role: "", active: true, services: [] as string[],
  working_hours: { Mon:{enabled:true,start:"09:00",end:"18:00"}, Tue:{enabled:true,start:"09:00",end:"18:00"}, Wed:{enabled:true,start:"09:00",end:"18:00"}, Thu:{enabled:true,start:"09:00",end:"18:00"}, Fri:{enabled:true,start:"09:00",end:"18:00"}, Sat:{enabled:false,start:"10:00",end:"16:00"}, Sun:{enabled:false,start:"10:00",end:"16:00"} } as Record<string,{enabled:boolean;start:string;end:string}>,
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const colors = ["#7C3AED","#10B981","#F59E0B","#EF4444","#6D28D9","#06B6D4"];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return <div style={{ width: 40, height: 40, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>;
}

export default function StaffPage() {
  const router = useRouter();
  const toast = useToast();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<{ id: string; name: string } | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember|null>(null);
  const [formTab, setFormTab] = useState<"info"|"services"|"hours">("info");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [salonServices, setSalonServices] = useState<{ id: string; name: string }[]>([]);
  const [serviceNameMap, setServiceNameMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Helper: get current user JWT for API calls
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadStaff = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/staff", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setStaffList(json.staff || []);
    } else {
      const json = await res.json().catch(() => ({}));
      console.error("[StaffPage] loadStaff failed:", res.status, json.error);
    }
  }, [getToken]);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }
        setSalon(profile.salon);
        await loadStaff();
        // Load real services from DB for the staff services tab
        const token = await getToken();
        const res = await fetch("/api/services", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const json = await res.json();
          const svcs: { id: string; name: string }[] = json.services || [];
          setSalonServices(svcs);
          // Build a map that resolves both UUID keys and name keys → display name.
          // This makes the card render correct regardless of how the DB value was stored.
          const map: Record<string, string> = {};
          svcs.forEach(s => { map[s.id] = s.name; map[s.name] = s.name; });
          setServiceNameMap(map);
        }
      } catch (e) { console.error("[StaffPage] load error:", e); } finally { setLoading(false); }
    };
    load();
  }, [router, loadStaff, getToken]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    setSubmitting(true);

    const token = await getToken();
    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      active: formData.active,
      services: formData.services,
      working_hours: formData.working_hours,
    };

    let res: Response;
    if (editingStaff) {
      res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingStaff.id, ...payload }),
      });
    } else {
      res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    }

    const json = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      console.error("[StaffPage] handleSubmit failed:", res.status, json.error);
      toast.error(editingStaff ? "Failed to update staff: " + (json.error || "Unknown error") : "Failed to add staff: " + (json.error || "Unknown error"));
      return;
    }

    toast.success(editingStaff ? "Staff updated!" : "Staff added!");
    setFormData(EMPTY_FORM); setShowForm(false); setEditingStaff(null); setFormTab("info");
    await loadStaff();
  }, [salon, editingStaff, formData, toast, loadStaff, getToken]);

  const handleEdit = useCallback((s: StaffMember) => {
    setEditingStaff(s);
    // Translate any stored UUIDs to names so the Services checkboxes populate correctly.
    const resolvedServices = (s.services || []).map((sv: string) => serviceNameMap[sv] ?? sv);
    setFormData({ name: s.name||"", email: s.email||"", role: s.role || vc.staffSingular.toLowerCase(), active: s.active??true, services: resolvedServices, working_hours: s.working_hours||EMPTY_FORM.working_hours });
    setFormTab("info"); setShowForm(true);
  }, [serviceNameMap, vc.staffSingular]);

  const handleToggle = useCallback(async (id: string, active: boolean) => {
    const token = await getToken();
    const res = await fetch("/api/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, active: !active }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.error("[StaffPage] handleToggle failed:", json.error);
      toast.error("Failed to update staff status");
      return;
    }
    toast.success(active ? "Staff deactivated" : "Staff activated");
    await loadStaff();
  }, [getToken, toast, loadStaff]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this staff member? This cannot be undone.")) return;
    const token = await getToken();
    const res = await fetch("/api/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.error("[StaffPage] handleDelete failed:", json.error);
      toast.error("Failed to delete staff");
      return;
    }
    toast.success("Staff deleted");
    await loadStaff();
  }, [getToken, toast, loadStaff]);

  const toggleService = useCallback((svc: string) => {
    setFormData(p => ({ ...p, services: p.services.includes(svc) ? p.services.filter(s => s !== svc) : [...p.services, svc] }));
  }, []);

  const updateHour = useCallback((day: string, field: string, value: string|boolean) => {
    setFormData(p => ({ ...p, working_hours: { ...p.working_hours, [day]: { ...p.working_hours[day], [field]: value } } }));
  }, []);

  const filtered = useMemo(() => staffList.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ), [staffList, searchTerm]);

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px" }}>{vc.staffPlural} Management</div>
          <div style={{ fontSize: 11.5, color: "#6B6577" }}>{staffList.length} {vc.staffPlural.toLowerCase()}</div>
        </div>
      </div>
      <button onClick={() => { setEditingStaff(null); setFormData({ ...EMPTY_FORM, role: vc.staffSingular.toLowerCase() }); setShowForm(true); }} style={{ background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.25)", whiteSpace: "nowrap", transition: "all 0.14s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "#6D28D9"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#7C3AED"; }}
      >+ Add {vc.staffSingular}</button>
    </header>
  );

  return (
    <DashboardShell salonName={salon?.name} topbar={Topbar}>
      <div style={{ padding: "24px 20px" }}>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={`Search ${vc.staffPlural.toLowerCase()} by name or email…`} style={{ width: "100%", maxWidth: 360, padding: "9px 13px", border: "1px solid #ECE9F1", borderRadius: "var(--r-sm)", fontSize: 13.5, fontFamily: "var(--font)", outline: "none", color: "#12101A" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Staff cards grid */}
        {filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
            <EmptyState icon="??" title={searchTerm ? `No ${vc.staffPlural.toLowerCase()} found` : `No ${vc.staffPlural.toLowerCase()} yet`} description={searchTerm ? "Try a different search" : `Add your first ${vc.staffSingular.toLowerCase()} to get started`} action={{ label: `+ Add ${vc.staffSingular}`, onClick: () => { setEditingStaff(null); setFormData({ ...EMPTY_FORM, role: vc.staffSingular.toLowerCase() }); setShowForm(true); } }} />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {filtered.map(s => {
              const wh = s.working_hours || {};
              const activeDays = DAYS.filter(d => wh[d]?.enabled);
              return (
                <div key={s.id} style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "var(--r-lg)", padding: "18px", boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)", transition: "all 0.14s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <Avatar name={s.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", letterSpacing: "-0.2px" }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#6B6577", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: s.active ? "var(--green-light)" : "var(--red-light)", color: s.active ? "var(--green)" : "var(--red)", border: `1px solid ${s.active ? "var(--green-pale)" : "var(--red-pale)"}`, whiteSpace: "nowrap" }}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "#EDE9FF", color: "#7C3AED", border: "1px solid #DDD6FE", textTransform: "capitalize" }}>{s.role}</span>
                    {activeDays.length > 0 && <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, background: "#F5F3FF", color: "#524D60", border: "1px solid #ECE9F1" }}>{activeDays.join(", ")}</span>}
                  </div>

                  {s.services?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
                      {s.services.slice(0,3).map((sv: string) => (
                        <span key={sv} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 4, background: "#F5F3FF", border: "1px solid #ECE9F1", color: "#524D60" }}>{serviceNameMap[sv] ?? sv}</span>
                      ))}
                      {s.services.length > 3 && <span style={{ fontSize: 10.5, color: "#6B6577" }}>+{s.services.length - 3} more</span>}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, paddingTop: 12, borderTop: "1px solid #ECE9F1" }}>
                    <button onClick={() => handleEdit(s)} style={{ flex: 1, padding: "7px", borderRadius: "var(--r-sm)", border: "1px solid #ECE9F1", background: "#FFFFFF", color: "#524D60", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", fontFamily: "var(--font)" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#ECE9F1"; e.currentTarget.style.color = "#524D60"; }}
                    >Edit</button>
                    <button onClick={() => handleToggle(s.id, s.active)} style={{ flex: 1, padding: "7px", borderRadius: "var(--r-sm)", border: "1px solid #ECE9F1", background: "#FFFFFF", color: s.active ? "var(--red)" : "var(--green)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", fontFamily: "var(--font)" }}>
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => handleDelete(s.id)} style={{ padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid #ECE9F1", background: "#FFFFFF", color: "#6B6577", fontSize: 12.5, cursor: "pointer", transition: "all 0.12s", fontFamily: "var(--font)" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.borderColor = "var(--red-pale)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#6B6577"; e.currentTarget.style.borderColor = "#ECE9F1"; }}
                    >🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingStaff(null); }} title={editingStaff ? `Edit ✏️ ${editingStaff.name}` : `Add New ${vc.staffSingular}`} maxWidth={520}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, background: "var(--slate-100)", padding: 3, borderRadius: 8, marginBottom: 20 }}>
          {(["info","services","hours"] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setFormTab(tab)} style={{ flex: 1, padding: "6px 12px", fontSize: 12.5, borderRadius: 6, border: "none", background: formTab === tab ? "#fff" : "transparent", color: formTab === tab ? "#0F172A" : "var(--text-3)", fontWeight: formTab === tab ? 600 : 400, cursor: "pointer", boxShadow: formTab === tab ? "var(--shadow-xs)" : "none", transition: "all 0.12s", fontFamily: "var(--font)", textTransform: "capitalize" }}>
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {formTab === "info" && (
            <>
              <FormGroup label="Name *"><Input placeholder="Jane Smith" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></FormGroup>
              <FormGroup label="Email *"><Input type="email" placeholder="name@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required /></FormGroup>
              <FormGroup label="Role"><Select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                <option value={vc.staffSingular.toLowerCase()}>{vc.staffSingular}</option>
                {editingStaff && formData.role && formData.role !== vc.staffSingular.toLowerCase() && !["receptionist","manager"].includes(formData.role) && (
                  <option value={formData.role}>{formData.role.split("-").map((w: string) => w[0].toUpperCase()+w.slice(1)).join(" ")}</option>
                )}
                <option value="receptionist">Receptionist</option>
                <option value="manager">Manager</option>
              </Select></FormGroup>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--slate-50)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                <label style={{ position: "relative", width: 32, height: 17, cursor: "pointer" }}>
                  <input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", inset: 0, background: formData.active ? "var(--green)" : "var(--slate-300)", borderRadius: 99, transition: "background 0.18s" }}>
                    <span style={{ position: "absolute", width: 11, height: 11, left: formData.active ? 18 : 3, top: 3, background: "#1C2438", borderRadius: "50%", transition: "left 0.18s" }} />
                  </span>
                </label>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Active — accepting bookings</span>
              </div>
            </>
          )}

          {formTab === "services" && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 14 }}>Select services this staff member provides:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {salonServices.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-3)", textAlign: "center", padding: "20px 0", width: "100%" }}>No services found. Add services in Settings first.</p>
              ) : salonServices.map(svc => {
                  const sel = formData.services.includes(svc.name);
                  return (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.name)} style={{ padding: "7px 14px", fontSize: 13, borderRadius: 99, border: `1px solid ${sel ? "var(--indigo)" : "var(--border)"}`, background: sel ? "var(--indigo-light)" : "#1C2438", color: sel ? "var(--indigo)" : "var(--text-2)", cursor: "pointer", fontWeight: sel ? 600 : 400, transition: "all 0.12s", fontFamily: "var(--font)" }}>
                      {svc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {formTab === "hours" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DAYS.map(day => {
                const h = formData.working_hours[day];
                return (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--r-sm)", background: h.enabled ? "var(--slate-50)" : "transparent", border: "1px solid var(--border)", transition: "background 0.12s" }}>
                    <div style={{ width: 36, fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{day}</div>
                    <label style={{ position: "relative", width: 28, height: 15, cursor: "pointer", flexShrink: 0 }}>
                      <input type="checkbox" checked={h.enabled} onChange={e => updateHour(day, "enabled", e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: h.enabled ? "var(--indigo)" : "var(--slate-300)", borderRadius: 99, transition: "background 0.18s" }}>
                        <span style={{ position: "absolute", width: 9, height: 9, left: h.enabled ? 16 : 3, top: 3, background: "#1C2438", borderRadius: "50%", transition: "left 0.18s" }} />
                      </span>
                    </label>
                    {h.enabled ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                        <input type="time" value={h.start} onChange={e => updateHour(day, "start", e.target.value)} style={{ padding: "5px 8px", fontSize: 12.5, border: "1px solid var(--border-2)", borderRadius: "var(--r-xs)", fontFamily: "var(--font)", outline: "none" }} />
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>to</span>
                        <input type="time" value={h.end} onChange={e => updateHour(day, "end", e.target.value)} style={{ padding: "5px 8px", fontSize: 12.5, border: "1px solid var(--border-2)", borderRadius: "var(--r-xs)", fontFamily: "var(--font)", outline: "none" }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>Day off</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <ModalActions>
            <BtnSecondary type="button" onClick={() => { setShowForm(false); setEditingStaff(null); setFormData(EMPTY_FORM); setFormTab("info"); }}>Cancel</BtnSecondary>
            <BtnPrimary type="submit" disabled={submitting}>{submitting ? "Saving…" : editingStaff ? "Save Changes" : `Add ${vc.staffSingular}`}</BtnPrimary>
          </ModalActions>
        </form>
      </Modal>
    </DashboardShell>
  );
}
