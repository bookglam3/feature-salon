"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [salon, setSalon] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "", client_email: "", client_phone: "",
    service_id: "", staff_id: "", date: "", time: "",
  });

  const timeSlots = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];

  useEffect(() => {
    const loadData = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile || !profile.salon) { router.push("/login"); return; }
      setSalon(profile.salon);
      const salonId = profile.salon.id;
      const [{ data: appts }, { data: staffData }, { data: servicesData }] = await Promise.all([
        supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", salonId).order("date_time", { ascending: true }),
        supabase.from("staff").select("*").eq("salon_id", salonId),
        supabase.from("services").select("*").eq("salon_id", salonId),
      ]);
      setAppointments(appts || []);
      setStaff(staffData || []);
      setServices(servicesData || []);
      setLoading(false);
    };
    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleNewBooking = async () => {
    if (!salon) return;
    const date_time = new Date(formData.date + "T" + formData.time).toISOString();
    await supabase.from("appointments").insert({
      salon_id: salon.id,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      service_id: formData.service_id || null,
      staff_id: formData.staff_id || null,
      date_time,
      status: "confirmed",
    });
    setShowModal(false);
    setFormData({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
    const { data: appts } = await supabase.from("appointments").select("*, services(name,price), staff(name)").eq("salon_id", salon.id).order("date_time", { ascending: true });
    setAppointments(appts || []);
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/book/${salon?.slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const todayAppts = appointments.filter(a => new Date(a.date_time).toDateString() === new Date().toDateString());
  const revenue = todayAppts.reduce((sum, a) => sum + (a.services?.price || 0), 0);
  const filteredAppts = activeTab === "Today" ? todayAppts : activeTab === "Upcoming" ? appointments.filter(a => new Date(a.date_time) > new Date()) : appointments;

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2F4F7" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>
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
              style={{ padding: "9px 20px", fontSize: "13px", color: item.path === "/dashboard" ? "#4F6EF7" : "#64748B", background: item.path === "/dashboard" ? "#EEF2FF" : "transparent", borderRight: item.path === "/dashboard" ? "2px solid #4F6EF7" : "none", cursor: "pointer" }}>
              {item.label}
            </div>
          ))}
          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
          <div onClick={() => router.push("/dashboard/payments")} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Payments</div>
          <div onClick={() => router.push("/dashboard/reports")} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Reports</div>
          <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
          <div onClick={() => router.push("/dashboard/settings")} style={{ padding: "9px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>Settings</div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
          <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name}</div>
          <button onClick={handleLogout} style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Good morning 👋</div>
            <div style={{ fontSize: "12px", color: "#94A3B8" }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <button onClick={() => setShowModal(true)} style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer" }}>+ New Booking</button>
        </div>

        <div style={{ padding: "24px", flex: 1 }}>
          {/* BOOKING LINK BANNER */}
          <div style={{ background: "linear-gradient(135deg, #4F6EF7 0%, #7C3AED 100%)", borderRadius: "12px", padding: "18px 22px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>🔗 Your Booking Link</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>
                {typeof window !== "undefined" ? `${window.location.origin}/book/${salon?.slug}` : `/book/${salon?.slug}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleCopyLink}
                style={{ padding: "8px 18px", background: copied ? "#10B981" : "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
              <button onClick={() => window.open(`/book/${salon?.slug}`, "_blank")}
                style={{ padding: "8px 18px", background: "#fff", color: "#4F6EF7", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                Preview ↗
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Today's bookings", value: todayAppts.length.toString() },
              { label: "Revenue today", value: `£${revenue}` },
              { label: "Total bookings", value: appointments.length.toString() },
              { label: "Plan", value: salon?.plan || "Starter" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px" }}>{s.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 500, color: "#0F172A" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Appointments */}
          <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
              <div style={{ fontSize: "13px", fontWeight: 500 }}>Appointments</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["All", "Today", "Upcoming"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px", border: "0.5px solid", borderColor: activeTab === tab ? "#C7D2FE" : "#E8EAF0", background: activeTab === tab ? "#EEF2FF" : "#fff", color: activeTab === tab ? "#4F6EF7" : "#94A3B8", cursor: "pointer" }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            {filteredAppts.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                No appointments yet — share your booking link to get started!
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F9FC" }}>
                    {["Status","Client","Service","Staff","Date & Time","Amount"].map(h => (
                      <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAppts.map(a => (
                    <tr key={a.id}>
                      <td style={{ padding: "11px 18px" }}>
                        <span style={{ background: a.status === "confirmed" ? "#ECFDF5" : "#FFF7ED", color: a.status === "confirmed" ? "#059669" : "#D97706", fontSize: "10px", padding: "3px 8px", borderRadius: "20px" }}>{a.status}</span>
                      </td>
                      <td style={{ padding: "11px 18px", fontSize: "13px" }}>{a.client_name}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px" }}>{a.services?.name || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B" }}>{a.staff?.name || "—"}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B" }}>{new Date(a.date_time).toLocaleString("en-GB")}</td>
                      <td style={{ padding: "11px 18px", fontSize: "13px" }}>£{a.services?.price || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "440px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "20px" }}>New Booking</div>
            {[
              { label: "Client Name", key: "client_name", type: "text", placeholder: "Sarah Johnson" },
              { label: "Client Email", key: "client_email", type: "email", placeholder: "sarah@email.com" },
              { label: "Client Phone", key: "client_phone", type: "text", placeholder: "+44 7700 900000" },
              { label: "Date", key: "date", type: "date", placeholder: "" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key]}
                  onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", fontFamily: "inherit" }} />
              </div>
            ))}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>Time</label>
              <select value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit" }}>
                <option value="">Select time</option>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>Service</label>
              <select value={formData.service_id} onChange={e => setFormData({ ...formData, service_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit" }}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} — £{s.price}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>Staff</label>
              <select value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit" }}>
                <option value="">Select staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "10px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", cursor: "pointer", background: "#fff" }}>Cancel</button>
              <button onClick={handleNewBooking}
                style={{ flex: 1, padding: "10px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>Create Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}