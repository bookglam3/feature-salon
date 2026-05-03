"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SERVICES_LIST = ["Haircut", "Hair Color", "Blowout", "Makeup", "Facial", "Manicure", "Pedicure", "Waxing", "Massage"];

export default function StaffPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"info" | "services" | "hours">("info");

  const emptyForm = {
    name: "",
    email: "",
    role: "stylist",
    active: true,
    services: [] as string[],
    working_hours: {
      Mon: { enabled: true, start: "09:00", end: "18:00" },
      Tue: { enabled: true, start: "09:00", end: "18:00" },
      Wed: { enabled: true, start: "09:00", end: "18:00" },
      Thu: { enabled: true, start: "09:00", end: "18:00" },
      Fri: { enabled: true, start: "09:00", end: "18:00" },
      Sat: { enabled: false, start: "10:00", end: "16:00" },
      Sun: { enabled: false, start: "10:00", end: "16:00" },
    } as Record<string, { enabled: boolean; start: string; end: string }>,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");

  const loadStaff = async (salonId: string) => {
    const { data } = await supabase.from("staff").select("*").eq("salon_id", salonId);
    setStaffList(data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) { router.push("/login"); return; }

        setSalon(profile.salon);
        await loadStaff(profile.salon.id);
      } catch (error) {
        console.error("Error loading staff data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;

    try {
      const payload = {
        salon_id: salon.id,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        active: formData.active,
        services: formData.services,
        working_hours: formData.working_hours,
      };

      if (editingStaff) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editingStaff.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert(payload);
        if (error) throw error;
      }

      setFormData(emptyForm);
      setShowForm(false);
      setEditingStaff(null);
      setActiveTab("info");
      await loadStaff(salon.id);
    } catch (error) {
      console.error("Error saving staff:", error);
      alert("Error saving staff member.");
    }
  };

  const handleEdit = (staff: any) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name || "",
      email: staff.email || "",
      role: staff.role || "stylist",
      active: staff.active ?? true,
      services: staff.services || [],
      working_hours: staff.working_hours || emptyForm.working_hours,
    });
    setActiveTab("info");
    setShowForm(true);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from("staff").update({ active: !currentActive }).eq("id", id);
    await loadStaff(salon?.id);
  };

  // FIX: removed requireOwner() call — handle via RLS or role check
  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
      await loadStaff(salon?.id);
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("Only salon owners can delete staff members.");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingStaff(null);
    setFormData(emptyForm);
    setActiveTab("info");
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service],
    }));
  };

  const updateWorkingHour = (day: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: { ...prev.working_hours[day], [field]: value },
      },
    }));
  };

  const filteredStaff = staffList.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

      {/* Sidebar */}
      <div style={{ width: "220px", background: "#fff", borderRight: "0.5px solid #E8EAF0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A", letterSpacing: "-0.5px" }}>feature</div>
        </div>

        <div style={{ padding: "8px 0", flex: 1 }}>
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Bookings", path: "/dashboard/bookings" },
            { label: "Clients", path: "/dashboard/clients" },
            { label: "Staff", path: "/dashboard/staff" },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => router.push(item.path)}
              style={{ padding: "9px 20px", fontSize: "13px", color: pathname === item.path ? "#4F6EF7" : "#64748B", background: pathname === item.path ? "#EEF2FF" : "transparent", borderRight: pathname === item.path ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          {["Payments", "Reports"].map((item) => (
            <div key={item} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>{item}</div>
          ))}

          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>

        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name || "My Salon"}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Staff Management</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{staffList.length} team members</div>
          </div>
          <button
            onClick={() => { setEditingStaff(null); setFormData(emptyForm); setShowForm(true); }}
            style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            + Add Staff
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {/* ── ADD / EDIT FORM ── */}
          {showForm && (
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", marginBottom: "20px", overflow: "hidden" }}>

              {/* Form header */}
              <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A" }}>
                  {editingStaff ? `Edit — ${editingStaff.name}` : "Add New Staff Member"}
                </div>
                {/* Tabs */}
                <div style={{ display: "flex", gap: "4px", background: "#F2F4F7", borderRadius: "8px", padding: "3px" }}>
                  {(["info", "services", "hours"] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      style={{ padding: "5px 14px", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", background: activeTab === tab ? "#fff" : "transparent", color: activeTab === tab ? "#0F172A" : "#64748B", fontWeight: activeTab === tab ? 500 : 400, boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "20px 24px" }}>

                {/* TAB: Info */}
                {activeTab === "info" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                    <input
                      type="text" placeholder="Name" value={formData.name} required
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                    />
                    <input
                      type="email" placeholder="Email" value={formData.email} required
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                    />
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}>
                      <option value="stylist">Stylist</option>
                      <option value="makeup-artist">Makeup Artist</option>
                      <option value="esthetician">Esthetician</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="manager">Manager</option>
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="checkbox" id="active" checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        style={{ width: "16px", height: "16px" }} />
                      <label htmlFor="active" style={{ fontSize: "13px", color: "#0F172A" }}>Active</label>
                    </div>
                  </div>
                )}

                {/* TAB: Services */}
                {activeTab === "services" && (
                  <div>
                    <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "14px" }}>Select services this staff member provides:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {SERVICES_LIST.map(service => {
                        const selected = formData.services.includes(service);
                        return (
                          <button
                            key={service} type="button"
                            onClick={() => toggleService(service)}
                            style={{ padding: "7px 16px", fontSize: "13px", borderRadius: "20px", border: `1px solid ${selected ? "#4F6EF7" : "#E8EAF0"}`, background: selected ? "#EEF2FF" : "#fff", color: selected ? "#4F6EF7" : "#64748B", cursor: "pointer", fontFamily: "inherit" }}>
                            {service}
                          </button>
                        );
                      })}
                    </div>
                    {formData.services.length > 0 && (
                      <div style={{ marginTop: "14px", fontSize: "12px", color: "#64748B" }}>
                        {formData.services.length} service{formData.services.length > 1 ? "s" : ""} selected
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Working Hours */}
                {activeTab === "hours" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "4px" }}>Set working hours for each day:</div>
                    {DAYS.map(day => {
                      const h = formData.working_hours[day];
                      return (
                        <div key={day} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "36px", fontSize: "13px", color: "#0F172A", fontWeight: 500 }}>{day}</div>
                          <input type="checkbox" checked={h.enabled}
                            onChange={(e) => updateWorkingHour(day, "enabled", e.target.checked)}
                            style={{ width: "15px", height: "15px", accentColor: "#4F6EF7" }} />
                          {h.enabled ? (
                            <>
                              <input type="time" value={h.start}
                                onChange={(e) => updateWorkingHour(day, "start", e.target.value)}
                                style={{ padding: "6px 10px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }} />
                              <span style={{ fontSize: "12px", color: "#94A3B8" }}>to</span>
                              <input type="time" value={h.end}
                                onChange={(e) => updateWorkingHour(day, "end", e.target.value)}
                                style={{ padding: "6px 10px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }} />
                            </>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#CBD5E1" }}>Day off</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Form buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                  <button type="submit"
                    style={{ flex: 1, padding: "10px 16px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                    {editingStaff ? "Save Changes" : "Add Staff"}
                  </button>
                  <button type="button" onClick={handleCancelForm}
                    style={{ flex: 1, padding: "10px 16px", background: "#E8EAF0", color: "#64748B", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom: "16px" }}>
            <input
              type="text" placeholder="Search staff..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: "8px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", width: "200px" }}
            />
          </div>

          {/* Staff Table */}
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
            {filteredStaff.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                {searchTerm ? "No staff found" : "No staff members yet"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Name", "Email", "Role", "Services", "Hours", "Status", "Actions"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => {
                    const services: string[] = s.services || [];
                    const wh: Record<string, any> = s.working_hours || {};
                    const activeDays = DAYS.filter(d => wh[d]?.enabled);
                    return (
                      <tr key={s.id}>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{s.name}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{s.email}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", borderBottom: "0.5px solid #F1F5F9" }}>
                          <span style={{ background: "#EEF2FF", color: "#4F6EF7", fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textTransform: "capitalize" }}>
                            {s.role}
                          </span>
                        </td>
                        {/* Services column */}
                        <td style={{ padding: "11px 18px", fontSize: "12px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9", maxWidth: "160px" }}>
                          {services.length === 0 ? (
                            <span style={{ color: "#CBD5E1" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {services.slice(0, 2).map(sv => (
                                <span key={sv} style={{ background: "#F8F9FC", border: "0.5px solid #E8EAF0", borderRadius: "4px", padding: "2px 7px", fontSize: "11px", color: "#64748B" }}>{sv}</span>
                              ))}
                              {services.length > 2 && (
                                <span style={{ fontSize: "11px", color: "#94A3B8" }}>+{services.length - 2}</span>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Working hours column */}
                        <td style={{ padding: "11px 18px", fontSize: "12px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>
                          {activeDays.length === 0 ? (
                            <span style={{ color: "#CBD5E1" }}>—</span>
                          ) : (
                            <span>{activeDays.join(", ")}</span>
                          )}
                        </td>
                        <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                          <span style={{ background: s.active ? "#ECFDF5" : "#FEF2F2", color: s.active ? "#166534" : "#DC2626", fontSize: "11px", padding: "4px 10px", borderRadius: "20px" }}>
                            {s.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", borderBottom: "0.5px solid #F1F5F9", whiteSpace: "nowrap" }}>
                          {/* Edit button */}
                          <button onClick={() => handleEdit(s)}
                            style={{ color: "#4F6EF7", background: "none", border: "none", cursor: "pointer", fontSize: "12px", marginRight: "10px" }}>
                            Edit
                          </button>
                          <button onClick={() => handleToggleActive(s.id, s.active)}
                            style={{ color: s.active ? "#DC2626" : "#166534", background: "none", border: "none", cursor: "pointer", fontSize: "12px", marginRight: "10px" }}>
                            {s.active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => handleDeleteStaff(s.id)}
                            style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}