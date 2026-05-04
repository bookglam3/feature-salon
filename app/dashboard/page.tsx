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
  const [origin, setOrigin] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "", client_email: "", client_phone: "",
    service_id: "", staff_id: "", date: "", time: "",
  });

  const timeSlots = [
    "09:00","09:30","10:00","10:30","11:00","11:30","12:00",
    "12:30","13:00","13:30","14:00","14:30","15:00","15:30",
    "16:00","16:30","17:00","17:30",
  ];

  useEffect(() => { setOrigin(window.location.origin); }, []);

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
    const selectedService = services.find(s => s.id === formData.service_id);
const selectedStaff = staff.find(s => s.id === formData.staff_id);
await fetch("/api/send-booking-emails", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clientEmail: formData.client_email,
    clientName: formData.client_name,
    clientPhone: formData.client_phone,
    serviceName: selectedService?.name || "Service",
    dateTime: date_time,
    staffName: selectedStaff?.name,
    salonName: salon.name,
    salonOwnerEmail: salon.owner_email,
  }),
});
    setShowModal(false);
    setFormData({ client_name: "", client_email: "", client_phone: "", service_id: "", staff_id: "", date: "", time: "" });
    const { data: appts } = await supabase.from("appointments")
      .select("*, services(name,price), staff(name)")
      .eq("salon_id", salon.id)
      .order("date_time", { ascending: true });
    setAppointments(appts || []);
  };

  const handleCopyLink = () => {
    const link = `${origin}/book/${salon?.slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bookingLink = `${origin}/book/${salon?.slug}`;
  const todayAppts = appointments.filter(
    a => new Date(a.date_time).toDateString() === new Date().toDateString()
  );
  const revenue = todayAppts.reduce((sum, a) => sum + (a.services?.price || 0), 0);
  const filteredAppts =
    activeTab === "Today" ? todayAppts :
    activeTab === "Upcoming" ? appointments.filter(a => new Date(a.date_time) > new Date()) :
    appointments;

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Bookings",  path: "/dashboard/bookings" },
    { label: "Clients",   path: "/dashboard/clients" },
    { label: "Staff",     path: "/dashboard/staff" },
    { label: "Payments",  path: "/dashboard/payments" },
    { label: "Reports",   path: "/dashboard/reports" },
    { label: "Settings",  path: "/dashboard/settings" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2F4F7" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <>
      {/* ── Global responsive styles ── */}
      <style>{`
        * { box-sizing: border-box; }

        /* Sidebar overlay on mobile */
        .sidebar-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 40;
        }
        .sidebar-overlay.open { display: block; }

        /* Sidebar */
        .sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 220px;
          background: #fff;
          border-right: 0.5px solid #E8EAF0;
          display: flex; flex-direction: column;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
        }
        @media (min-width: 768px) {
          .sidebar { position: relative; transform: none !important; }
          .sidebar-overlay { display: none !important; }
          .hamburger { display: none !important; }
          .main-layout { margin-left: 0; }
        }
        .sidebar.open { transform: translateX(0); }

        /* Stats grid: 2-col on mobile, 4-col on desktop */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (min-width: 768px) {
          .stats-grid { grid-template-columns: repeat(4, 1fr); }
        }

        /* Booking banner */
        .booking-banner {
          background: linear-gradient(135deg, #4F6EF7 0%, #7C3AED 100%);
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        @media (min-width: 600px) {
          .booking-banner {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
          }
        }
        .banner-btns { display: flex; gap: 8px; flex-wrap: wrap; }

        /* Table hidden on mobile — show cards instead */
        .appt-table { display: none; }
        .appt-cards { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
        @media (min-width: 768px) {
          .appt-table { display: table; width: 100%; border-collapse: collapse; }
          .appt-cards { display: none; }
        }

        /* Modal: full-screen on mobile */
        .modal-box {
          background: #fff;
          border-radius: 12px;
          padding: 24px 20px;
          width: 100%;
          max-width: 440px;
          max-height: 95vh;
          overflow-y: auto;
          margin: 0 12px;
        }
        @media (max-width: 480px) {
          .modal-box {
            border-radius: 16px 16px 0 0;
            margin: 0;
            max-height: 92vh;
            position: fixed;
            bottom: 0; left: 0; right: 0;
          }
        }

        /* Topbar booking button — compact on mobile */
        .new-booking-btn {
          background: #4F6EF7; color: #fff;
          font-size: 13px; padding: 8px 18px;
          border-radius: 8px; border: none; cursor: pointer;
          white-space: nowrap;
        }
        @media (max-width: 480px) {
          .new-booking-btn { padding: 8px 12px; font-size: 12px; }
        }

        /* Appointment card (mobile) */
        .appt-card {
          background: #fff;
          border: 0.5px solid #E8EAF0;
          border-radius: 10px;
          padding: 14px;
        }
        .appt-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .appt-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .appt-card-field { font-size: 11px; color: #94A3B8; }
        .appt-card-val { font-size: 13px; color: #0F172A; font-weight: 500; }
        .status-badge {
          font-size: 10px; padding: 3px 9px;
          border-radius: 20px; display: inline-block;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex" }}>

        {/* Sidebar overlay (mobile) */}
        <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

        {/* ── Sidebar ── */}
        <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div style={{ padding: "20px", borderBottom: "0.5px solid #E8EAF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A" }}>feature</div>
            {/* Close btn (mobile only) */}
            <button onClick={() => setSidebarOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#94A3B8", display: "block" }}
              className="hamburger">✕</button>
          </div>

          <div style={{ padding: "8px 0", flex: 1 }}>
            {navItems.slice(0, 4).map(item => (
              <div key={item.label} onClick={() => { router.push(item.path); setSidebarOpen(false); }}
                style={{
                  padding: "10px 20px", fontSize: "13px", cursor: "pointer",
                  color: item.path === "/dashboard" ? "#4F6EF7" : "#64748B",
                  background: item.path === "/dashboard" ? "#EEF2FF" : "transparent",
                  borderRight: item.path === "/dashboard" ? "2px solid #4F6EF7" : "none",
                }}>
                {item.label}
              </div>
            ))}
            <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>FINANCE</div>
            {navItems.slice(4, 6).map(item => (
              <div key={item.label} onClick={() => { router.push(item.path); setSidebarOpen(false); }}
                style={{ padding: "10px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>
                {item.label}
              </div>
            ))}
            <div style={{ padding: "12px 20px 4px", fontSize: "9px", color: "#CBD5E1", letterSpacing: "2px" }}>SYSTEM</div>
            <div onClick={() => { router.push("/dashboard/settings"); setSidebarOpen(false); }}
              style={{ padding: "10px 20px", fontSize: "13px", color: "#64748B", cursor: "pointer" }}>
              Settings
            </div>
          </div>

          <div style={{ padding: "16px 20px", borderTop: "0.5px solid #E8EAF0" }}>
            <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>{salon?.name}</div>
            <button onClick={handleLogout}
              style={{ fontSize: "12px", color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Sign out
            </button>
          </div>
        </div>

        {/* ── Main ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Topbar */}
          <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Hamburger (mobile) */}
              <button className="hamburger" onClick={() => setSidebarOpen(true)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ display: "block", width: "20px", height: "1.5px", background: "#0F172A" }} />
                <span style={{ display: "block", width: "20px", height: "1.5px", background: "#0F172A" }} />
                <span style={{ display: "block", width: "20px", height: "1.5px", background: "#0F172A" }} />
              </button>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A" }}>Good morning 👋</div>
                <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
            <button onClick={() => setShowModal(true)} className="new-booking-btn">+ New Booking</button>
          </div>

          {/* Content */}
          <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>

            {/* Booking link banner */}
            <div className="booking-banner">
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>🔗 Your Booking Link</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {salon?.slug ? bookingLink : "Loading..."}
                </div>
              </div>
              <div className="banner-btns">
                <button onClick={handleCopyLink}
                  style={{ padding: "8px 16px", background: copied ? "#10B981" : "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                  {copied ? "✓ Copied!" : "Copy Link"}
                </button>
                <button onClick={() => window.open(`/book/${salon?.slug}`, "_blank")}
                  style={{ padding: "8px 16px", background: "#fff", color: "#4F6EF7", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                  Preview ↗
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              {[
                { label: "Today's bookings", value: todayAppts.length.toString() },
                { label: "Revenue today",    value: `£${revenue}` },
                { label: "Total bookings",   value: appointments.length.toString() },
                { label: "Plan",             value: salon?.plan || "Starter" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px" }}>{s.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: 500, color: "#0F172A" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Appointments */}
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #E8EAF0", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500 }}>Appointments</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["All", "Today", "Upcoming"].map(tab => (
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
                <>
                  {/* Desktop table */}
                  <table className="appt-table">
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
                          <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                            <span style={{ background: a.status === "confirmed" ? "#ECFDF5" : a.status === "cancelled" ? "#FEE2E2" : "#FFF7ED", color: a.status === "confirmed" ? "#059669" : a.status === "cancelled" ? "#DC2626" : "#D97706", fontSize: "10px", padding: "3px 8px", borderRadius: "20px" }}>
                              {a.status}
                            </span>
                          </td>
                          <td style={{ padding: "11px 18px", fontSize: "13px", borderBottom: "0.5px solid #F1F5F9" }}>{a.client_name}</td>
                          <td style={{ padding: "11px 18px", fontSize: "13px", borderBottom: "0.5px solid #F1F5F9" }}>{a.services?.name || "—"}</td>
                          <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{a.staff?.name || "—"}</td>
                          <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{new Date(a.date_time).toLocaleString("en-GB")}</td>
                          <td style={{ padding: "11px 18px", fontSize: "13px", borderBottom: "0.5px solid #F1F5F9" }}>£{a.services?.price || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile cards */}
                  <div className="appt-cards">
                    {filteredAppts.map(a => {
                      const statusColor =
                        a.status === "confirmed" ? { bg: "#ECFDF5", txt: "#059669" } :
                        a.status === "cancelled" ? { bg: "#FEE2E2", txt: "#DC2626" } :
                        { bg: "#FFF7ED", txt: "#D97706" };
                      return (
                        <div key={a.id} className="appt-card">
                          <div className="appt-card-top">
                            <div style={{ fontSize: "14px", fontWeight: 500, color: "#0F172A" }}>{a.client_name}</div>
                            <span className="status-badge" style={{ background: statusColor.bg, color: statusColor.txt }}>{a.status}</span>
                          </div>
                          <div className="appt-card-grid">
                            <div>
                              <div className="appt-card-field">Service</div>
                              <div className="appt-card-val">{a.services?.name || "—"}</div>
                            </div>
                            <div>
                              <div className="appt-card-field">Amount</div>
                              <div className="appt-card-val">£{a.services?.price || "—"}</div>
                            </div>
                            <div>
                              <div className="appt-card-field">Staff</div>
                              <div className="appt-card-val" style={{ fontWeight: 400, color: "#64748B" }}>{a.staff?.name || "—"}</div>
                            </div>
                            <div>
                              <div className="appt-card-field">Date & Time</div>
                              <div className="appt-card-val" style={{ fontWeight: 400, color: "#64748B", fontSize: "12px" }}>
                                {new Date(a.date_time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── New Booking Modal ── */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="modal-box">
              <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                New Booking
                <button onClick={() => setShowModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#94A3B8" }}>✕</button>
              </div>

              {[
                { label: "Client Name",  key: "client_name",  type: "text",  placeholder: "Sarah Johnson" },
                { label: "Client Email", key: "client_email", type: "email", placeholder: "sarah@email.com" },
                { label: "Client Phone", key: "client_phone", type: "text",  placeholder: "+44 7700 900000" },
                { label: "Date",         key: "date",         type: "date",  placeholder: "" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key]}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", outline: "none" }} />
                </div>
              ))}

              {[
                { label: "Time",    key: "time",       opts: timeSlots.map(t => ({ v: t, l: t })) },
                { label: "Service", key: "service_id", opts: services.map(s => ({ v: s.id, l: `${s.name} — £${s.price}` })) },
                { label: "Staff",   key: "staff_id",   opts: staff.map(s => ({ v: s.id, l: s.name })) },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 500, display: "block", marginBottom: "5px" }}>{f.label}</label>
                  <select value={(formData as any)[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", background: "#fff" }}>
                    <option value="">Select {f.label.toLowerCase()}</option>
                    {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: "12px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", cursor: "pointer", background: "#fff" }}>
                  Cancel
                </button>
                <button onClick={handleNewBooking}
                  style={{ flex: 1, padding: "12px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontWeight: 500 }}>
                  Create Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}