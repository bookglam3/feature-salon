"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile, requireOwner } from "../../lib/auth";

export default function StaffPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "stylist",
    active: true,
  });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (!profile) {
          router.push("/login");
          return;
        }

        setSalon(profile.salons);

        const { data: staffData } = await supabase
          .from("staff").select("*").eq("salon_id", profile.salon_id);
        setStaffList(staffData || []);
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

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;

    try {
      await requireOwner(); // Only owners can add staff

      const { error } = await supabase.from("staff").insert({
        salon_id: salon.id,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        active: formData.active,
      });

      if (!error) {
        setFormData({ name: "", email: "", role: "stylist", active: true });
        setShowForm(false);
        // Reload staff
        const { data: staffData } = await supabase
          .from("staff").select("*").eq("salon_id", salon.id);
        setStaffList(staffData || []);
      }
    } catch (error) {
      console.error("Error adding staff:", error);
      alert("Only salon owners can add staff members.");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from("staff").update({ active: !currentActive }).eq("id", id);
    const { data: staffData } = await supabase
      .from("staff").select("*").eq("salon_id", salon?.id);
    setStaffList(staffData || []);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;

    try {
      await requireOwner(); // Only owners can delete staff

      await supabase.from("staff").delete().eq("id", id);
      const { data: staffData } = await supabase
        .from("staff").select("*").eq("salon_id", salon?.id);
      setStaffList(staffData || []);
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("Only salon owners can delete staff members.");
    }
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
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
          <button onClick={() => setShowForm(true)} style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            + Add Staff
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {showForm && (
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "24px", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A", marginBottom: "18px" }}>Add New Staff Member</div>
              <form onSubmit={handleAddStaff} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                >
                  <option value="stylist">Stylist</option>
                  <option value="makeup-artist">Makeup Artist</option>
                  <option value="esthetician">Esthetician</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="manager">Manager</option>
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    style={{ width: "16px", height: "16px" }}
                  />
                  <label htmlFor="active" style={{ fontSize: "13px", color: "#0F172A" }}>Active</label>
                </div>
                <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1" }}>
                  <button type="submit" style={{ flex: 1, padding: "10px 16px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>Add</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px 16px", background: "#E8EAF0", color: "#64748B", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
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
                    {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{s.name}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{s.email}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>
                        <span style={{ background: "#EEF2FF", color: "#4F6EF7", fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textTransform: "capitalize" }}>
                          {s.role}
                        </span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>
                        <span style={{ background: s.active ? "#ECFDF5" : "#FEF2F2", color: s.active ? "#166534" : "#DC2626", fontSize: "11px", padding: "4px 10px", borderRadius: "20px", textTransform: "capitalize" }}>
                          {s.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>
                        <button
                          onClick={() => handleToggleActive(s.id, s.active)}
                          style={{ color: s.active ? "#DC2626" : "#166534", background: "none", border: "none", cursor: "pointer", fontSize: "12px", marginRight: "12px" }}
                        >
                          {s.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s.id)}
                          style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
