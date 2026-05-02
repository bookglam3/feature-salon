"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: "📊" },
  { label: "Bookings", path: "/dashboard/bookings", icon: "📅" },
  { label: "Clients", path: "/dashboard/clients", icon: "👥" },
  { label: "Staff", path: "/dashboard/staff", icon: "👤" },
  { label: "Payments", path: "/dashboard/payments", icon: "💳" },
  { label: "Reports", path: "/dashboard/reports", icon: "📈" },
  { label: "Settings", path: "/dashboard/settings", icon: "⚙️" },
];

export default function BookingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [viewMode, setViewMode] = useState("table"); // "table" or "calendar"
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    staff_id: "",
    service_id: "",
    date_time: "",
    status: "pending",
  });
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await getCurrentUserProfile();

        if (!profile) {
          router.push("/login");
          return;
        }

        setSalon(profile.salons);

        const { data: appts } = await supabase
          .from("appointments").select("*, services(name, price), staff(name)")
          .eq("salon_id", profile.salon_id)
          .order("date_time", { ascending: true });
        setAppointments(appts || []);

        const { data: staffData } = await supabase
          .from("staff").select("*").eq("salon_id", profile.salon_id);
        setStaff(staffData || []);

        const { data: servicesData } = await supabase
          .from("services").select("*").eq("salon_id", profile.salon_id);
        setServices(servicesData || []);
      } catch (error) {
        console.error("Error loading bookings data:", error);
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

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;

    const { error } = await supabase.from("appointments").insert({
      salon_id: salon.id,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      staff_id: formData.staff_id,
      service_id: formData.service_id,
      date_time: formData.date_time,
      status: formData.status,
    });

    if (!error) {
      setFormData({
        client_name: "",
        client_email: "",
        client_phone: "",
        staff_id: "",
        service_id: "",
        date_time: "",
        status: "pending",
      });
      setShowForm(false);
      // Reload bookings
      const { data: appts } = await supabase
        .from("appointments").select("*, services(name, price), staff(name)")
        .eq("salon_id", salon.id)
        .order("date_time", { ascending: true });
      setAppointments(appts || []);
    }
  };

  const filteredAppointments = appointments.filter(a => {
    if (activeTab === "All") return true;
    const apptDate = new Date(a.date_time).toDateString();
    const today = new Date().toDateString();
    if (activeTab === "Today") return apptDate === today;
    if (activeTab === "Upcoming") return new Date(a.date_time) > new Date();
    return true;
  });

  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter(a => {
      const apptDate = new Date(a.date_time);
      return apptDate.toDateString() === date.toDateString();
    });
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    await supabase.from("appointments").update({ status: newStatus }).eq("id", appointmentId);
    // Reload appointments
    const { data: appts } = await supabase
      .from("appointments").select("*, services(name, price), staff(name)")
      .eq("salon_id", salon.id)
      .order("date_time", { ascending: true });
    setAppointments(appts || []);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7" }}>
      {/* Mobile Header */}
      <div style={{
        display: "block",
        backgroundColor: "#ffffff",
        borderBottom: "0.5px solid #E8EAF0",
        padding: "12px 16px",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "#0F172A" }}>feature</div>
          <button
            type="button"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            style={{
              border: "none",
              backgroundColor: "transparent",
              fontSize: "20px",
              cursor: "pointer",
              color: "#475569"
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 40,
          display: "flex"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            width: "280px",
            padding: "24px",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "#0F172A" }}>feature</div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                style={{ border: "none", backgroundColor: "transparent", fontSize: "20px", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {navItems.map((item) => {
                const active = pathname === item.path;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      router.push(item.path);
                      setShowMobileMenu(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      border: "none",
                      backgroundColor: active ? "#EEF2FF" : "transparent",
                      color: active ? "#4F6EF7" : "#475569",
                      fontSize: "16px",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px"
                    }}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div style={{ flex: 1 }} onClick={() => setShowMobileMenu(false)} />
        </div>
      )}

      <div style={{ display: "flex" }}>
        {/* Desktop Sidebar - Hidden on mobile */}
        <div style={{
          width: "220px",
          background: "#fff",
          borderRight: "0.5px solid #E8EAF0",
          flexShrink: 0,
          display: "none",
          "@media (min-width: 768px)": { display: "flex", flexDirection: "column" }
        }}>
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
                style={{
                  padding: "9px 20px",
                  fontSize: "13px",
                  color: pathname === item.path ? "#4F6EF7" : "#64748B",
                  background: pathname === item.path ? "#EEF2FF" : "transparent",
                  borderRight: pathname === item.path ? "2px solid #4F6EF7" : "none",
                  cursor: "pointer"
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>

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
            <div style={{ fontSize: "17px", fontWeight: 500, color: "#0F172A" }}>Bookings</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{appointments.length} total appointments</div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "4px", border: "0.5px solid #E8EAF0", borderRadius: "8px", padding: "2px" }}>
              <button 
                onClick={() => setViewMode("table")}
                style={{ 
                  padding: "6px 12px", 
                  border: "none", 
                  borderRadius: "6px", 
                  background: viewMode === "table" ? "#4F6EF7" : "transparent", 
                  color: viewMode === "table" ? "#fff" : "#64748B", 
                  fontSize: "12px", 
                  cursor: "pointer" 
                }}
              >
                Table
              </button>
              <button 
                onClick={() => setViewMode("calendar")}
                style={{ 
                  padding: "6px 12px", 
                  border: "none", 
                  borderRadius: "6px", 
                  background: viewMode === "calendar" ? "#4F6EF7" : "transparent", 
                  color: viewMode === "calendar" ? "#fff" : "#64748B", 
                  fontSize: "12px", 
                  cursor: "pointer" 
                }}
              >
                Calendar
              </button>
            </div>
            <button onClick={() => setShowForm(true)} style={{ background: "#4F6EF7", color: "#fff", fontSize: "13px", padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
              + New Booking
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", flex: 1, overflow: "auto" }}>

          {showForm && (
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", padding: "24px", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A", marginBottom: "18px" }}>Create New Booking</div>
              <form onSubmit={handleCreateBooking} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                <input
                  type="text"
                  placeholder="Client Name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <input
                  type="email"
                  placeholder="Client Email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <input
                  type="tel"
                  placeholder="Client Phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <select
                  value={formData.service_id}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                >
                  <option value="">Select Service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} - £{s.price}</option>
                  ))}
                </select>
                <select
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                >
                  <option value="">Select Staff</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={formData.date_time}
                  onChange={(e) => setFormData({ ...formData, date_time: e.target.value })}
                  required
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                />
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ padding: "10px 12px", fontSize: "13px", border: "0.5px solid #E8EAF0", borderRadius: "6px", fontFamily: "inherit" }}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1" }}>
                  <button type="submit" style={{ flex: 1, padding: "10px 16px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>Create</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px 16px", background: "#E8EAF0", color: "#64748B", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Bookings Table */}
          {viewMode === "table" && (
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>All Bookings</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["All", "Today", "Upcoming"].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px", border: "0.5px solid", borderColor: activeTab === tab ? "#C7D2FE" : "#E8EAF0", background: activeTab === tab ? "#EEF2FF" : "#fff", color: activeTab === tab ? "#4F6EF7" : "#94A3B8", cursor: "pointer" }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAppointments.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#94A3B8", fontSize: "14px" }}>
                  No bookings found
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8F9FC" }}>
                      {["Status", "Client", "Service", "Staff", "Date & Time", "Amount"].map((h) => (
                        <th key={h} style={{ fontSize: "11px", color: "#94A3B8", textAlign: "left", padding: "10px 18px", fontWeight: 500, borderBottom: "0.5px solid #E8EAF0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((a) => (
                      <tr key={a.id}>
                        <td style={{ padding: "11px 18px", borderBottom: "0.5px solid #F1F5F9" }}>
                          <span style={{ background: a.status === "confirmed" ? "#ECFDF5" : a.status === "cancelled" ? "#FEE2E2" : "#FFF7ED", color: a.status === "confirmed" ? "#059669" : a.status === "cancelled" ? "#DC2626" : "#D97706", fontSize: "10px", padding: "3px 8px", borderRadius: "20px" }}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{a.client_name}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>{a.services?.name || "—"}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{a.staff?.name || "—"}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#64748B", borderBottom: "0.5px solid #F1F5F9" }}>{new Date(a.date_time).toLocaleString("en-GB")}</td>
                        <td style={{ padding: "11px 18px", fontSize: "13px", color: "#0F172A", borderBottom: "0.5px solid #F1F5F9" }}>£{a.services?.price || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Calendar View */}
          {viewMode === "calendar" && (
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "10px", overflow: "hidden" }}>
              {/* Calendar Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid #E8EAF0" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A" }}>
                  {getWeekDates(currentWeek)[0].toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["All", "Today", "Upcoming"].map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "6px", border: "0.5px solid", borderColor: activeTab === tab ? "#C7D2FE" : "#E8EAF0", background: activeTab === tab ? "#EEF2FF" : "#fff", color: activeTab === tab ? "#4F6EF7" : "#94A3B8", cursor: "pointer" }}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const newDate = new Date(currentWeek);
                      newDate.setDate(currentWeek.getDate() - 7);
                      setCurrentWeek(newDate);
                    }}
                    style={{ padding: "4px 8px", border: "0.5px solid #E8EAF0", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
                  >
                    ‹
                  </button>
                  <button 
                    onClick={() => setCurrentWeek(new Date())}
                    style={{ fontSize: "11px", padding: "4px 8px", border: "0.5px solid #E8EAF0", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => {
                      const newDate = new Date(currentWeek);
                      newDate.setDate(currentWeek.getDate() + 7);
                      setCurrentWeek(newDate);
                    }}
                    style={{ padding: "4px 8px", border: "0.5px solid #E8EAF0", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "600px" }}>
                {getWeekDates(currentWeek).map((date, index) => {
                  const dayAppointments = getAppointmentsForDay(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div key={index} style={{ borderRight: index < 6 ? "0.5px solid #F1F5F9" : "none", borderBottom: "0.5px solid #F1F5F9", padding: "8px" }}>
                      <div style={{ 
                        fontSize: "12px", 
                        fontWeight: 500, 
                        color: isToday ? "#4F6EF7" : "#64748B", 
                        marginBottom: "8px",
                        textAlign: "center",
                        padding: "4px",
                        background: isToday ? "#EEF2FF" : "transparent",
                        borderRadius: "4px"
                      }}>
                        {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {dayAppointments.map((appointment) => (
                          <div 
                            key={appointment.id} 
                            style={{ 
                              background: appointment.status === "confirmed" ? "#ECFDF5" : appointment.status === "cancelled" ? "#FEE2E2" : "#FFF7ED",
                              border: "1px solid",
                              borderColor: appointment.status === "confirmed" ? "#A7F3D0" : appointment.status === "cancelled" ? "#FECACA" : "#FED7AA",
                              borderRadius: "6px", 
                              padding: "6px 8px", 
                              fontSize: "11px",
                              cursor: "pointer",
                              position: "relative"
                            }}
                            onClick={() => {
                              const newStatus = appointment.status === "confirmed" ? "cancelled" : "confirmed";
                              if (confirm(`Change status to ${newStatus}?`)) {
                                handleStatusChange(appointment.id, newStatus);
                              }
                            }}
                          >
                            <div style={{ fontWeight: 500, color: "#0F172A", marginBottom: "2px" }}>
                              {new Date(appointment.date_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div style={{ color: "#374151", fontSize: "10px" }}>{appointment.client_name}</div>
                            <div style={{ color: "#6B7280", fontSize: "10px" }}>{appointment.services?.name}</div>
                            {appointment.staff?.name && (
                              <div style={{ color: "#9CA3AF", fontSize: "10px" }}>with {appointment.staff.name}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div style={{
        display: "flex",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#ffffff",
        borderTop: "0.5px solid #E8EAF0",
        padding: "8px 0",
        zIndex: 50,
        "@media (min-width: 768px)": { display: "none" }
      }}>
        {navItems.slice(0, 5).map((item) => {
          const active = pathname === item.path;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.path)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                padding: "8px",
                border: "none",
                backgroundColor: "transparent",
                color: active ? "#4F6EF7" : "#64748B",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Add padding bottom for mobile nav */}
      <div style={{ height: "80px", "@media (min-width: 768px)": { display: "none" } }} />
    </div>
  );
}