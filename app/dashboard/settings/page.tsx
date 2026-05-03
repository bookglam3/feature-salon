"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", duration_minutes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile) { window.location.href = "/login"; return; }

      setSalon(profile.salon);

      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("salon_id", profile.salon_id)
        .order("created_at");
      setServices(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const openAdd = () => {
    setEditingService(null);
    setForm({ name: "", price: "", duration_minutes: "" });
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditingService(s);
    setForm({ name: s.name, price: s.price.toString(), duration_minutes: s.duration_minutes.toString() });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.duration_minutes) return;
    setSaving(true);
    if (editingService) {
      await supabase.from("services").update({
        name: form.name,
        price: parseFloat(form.price),
        duration_minutes: parseInt(form.duration_minutes),
      }).eq("id", editingService.id);
    } else {
      await supabase.from("services").insert({
        salon_id: salon.id,
        name: form.name,
        price: parseFloat(form.price),
        duration_minutes: parseInt(form.duration_minutes),
      });
    }
    const { data } = await supabase.from("services").select("*").eq("salon_id", salon.id).order("created_at");
    setServices(data || []);
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    await supabase.from("services").delete().eq("id", id);
    setServices(services.filter(s => s.id !== id));
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2F4F7" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

      {/* Sidebar */}
      <div style={{ width: "220px", background: "#fff", borderRight: "0.5px solid #E8EAF0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A" }}>feature</div>
        </div>
        <div style={{ padding: "8px 0", flex: 1 }}>
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Bookings", path: "/dashboard/bookings" },
            { label: "Clients", path: "/dashboard/clients" },
            { label: "Staff", path: "/dashboard/staff" },
          ].map((item) => (
            <div key={item.label} onClick={() => router.push(item.path)}
              style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}
          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          <div onClick={() => router.push("/dashboard/payments")} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Payments</div>
          <div onClick={() => router.push("/dashboard/reports")} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Reports</div>
          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div onClick={() => router.push("/dashboard/settings")}
            style={{ padding: "9px 20px", fontSize: "13px", color: "#4F6EF7", background: "#EEF2FF", borderRight: "2px solid #4F6EF7", cursor: "pointer" }}>
            Settings
          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name}</div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
            style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#0F172A", margin: 0 }}>Settings</h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Manage your salon services</p>
        </div>

        {/* Services Section */}
        <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid #E8EAF0" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500, color: "#0F172A" }}>Services</div>
              <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{services.length} service{services.length !== 1 ? "s" : ""}</div>
            </div>
            <button onClick={openAdd} style={{ background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}>
              + Add Service
            </button>
          </div>

          {services.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
              No services yet — add your first service!
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9FC" }}>
                  {["Service name", "Duration", "Price", "Actions"].map(h => (
                    <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 20px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id} style={{ borderTop: "0.5px solid #F1F5F9" }}>
                    <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>{s.name}</td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: "#64748B" }}>{s.duration_minutes} min</td>
                    <td style={{ padding: "14px 20px", fontSize: "13px", color: "#4F6EF7", fontWeight: 500 }}>£{s.price}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <button onClick={() => openEdit(s)} style={{ fontSize: "12px", color: "#4F6EF7", background: "none", border: "none", cursor: "pointer", marginRight: "12px" }}>Edit</button>
                      <button onClick={() => handleDelete(s.id)} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "400px" }}>
            <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "20px", color: "#0F172A" }}>
              {editingService ? "Edit Service" : "Add Service"}
            </div>
            {[
              { label: "Service name", key: "name", type: "text", placeholder: "e.g. Haircut" },
              { label: "Price (£)", key: "price", type: "number", placeholder: "e.g. 35" },
              { label: "Duration (minutes)", key: "duration_minutes", type: "number", placeholder: "e.g. 60" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px", color: "#0F172A" }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "10px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", cursor: "pointer", background: "#fff" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "10px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}