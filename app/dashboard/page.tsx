"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import DashboardSidebar from "./Sidebar";

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [salon, setSalon] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    service_id: "",
    staff_id: "",
    date: "",
    time: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: salonData, error: salonError } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", user.id)
        .single();

      if (salonError || !salonData) {
        router.push("/login");
        return;
      }

      setSalon(salonData);

      const [{ data: appts }, { data: staffData }, { data: servicesData }] = await Promise.all([
        supabase
          .from("appointments")
          .select("*, services(name, price), staff(name)")
          .eq("salon_id", salonData.id)
          .order("date_time", { ascending: true }),
        supabase
          .from("staff")
          .select("*")
          .eq("salon_id", salonData.id),
        supabase
          .from("services")
          .select("*")
          .eq("salon_id", salonData.id),
      ]);

      setAppointments(appts || []);
      setStaff(staffData || []);
      setServices(servicesData || []);
      setLoading(false);
    };

    loadData();
  }, [router]);

  const reloadAppointments = async () => {
    if (!salon) return;
    const { data: appts } = await supabase
      .from("appointments")
      .select("*, services(name, price), staff(name)")
      .eq("salon_id", salon.id)
      .order("date_time", { ascending: true });
    setAppointments(appts || []);
  };

  const todayAppointments = appointments.filter((appointment) => {
    const today = new Date().toDateString();
    return new Date(appointment.date_time).toDateString() === today;
  });

  const upcomingAppointments = appointments.filter((appointment) => {
    return new Date(appointment.date_time) > new Date();
  });

  const filteredAppointments = activeTab === "Today"
    ? todayAppointments
    : activeTab === "Upcoming"
      ? upcomingAppointments
      : appointments;

  const revenue = appointments.reduce((sum, appointment) => {
    return sum + (appointment.services?.price || 0);
  }, 0);

  const handleCreateBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!formData.client_name || !formData.service_id || !formData.date || !formData.time) {
      setError("Please complete the required fields.");
      return;
    }

    const dateTime = new Date(`${formData.date}T${formData.time}`);
    if (Number.isNaN(dateTime.getTime())) {
      setError("Please select a valid date and time.");
      return;
    }

    const { error: createError } = await supabase.from("appointments").insert({
      salon_id: salon.id,
      client_name: formData.client_name,
      client_email: formData.client_email,
      client_phone: formData.client_phone,
      service_id: formData.service_id,
      staff_id: formData.staff_id || null,
      date_time: dateTime.toISOString(),
      status: "pending",
    });

    if (createError) {
      setError(createError.message);
      return;
    }

    setShowModal(false);
    setFormData({
      client_name: "",
      client_email: "",
      client_phone: "",
      service_id: "",
      staff_id: "",
      date: "",
      time: "",
    });
    await reloadAppointments();
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>feature</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7", display: "flex" }}>
      <DashboardSidebar />

      <main style={{ flex: 1, backgroundColor: "#F2F4F7", padding: "28px 32px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "14px", color: "#64748B" }}>Salon dashboard</p>
            <h1 style={{ margin: 0, fontSize: "32px", color: "#0F172A" }}>Welcome back</h1>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              border: "none",
              borderRadius: "12px",
              backgroundColor: "#4F6EF7",
              color: "#ffffff",
              padding: "12px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            + New Booking
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginTop: "24px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0" }}>
            <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Today bookings</div>
            <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700 }}>{todayAppointments.length}</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0" }}>
            <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Revenue</div>
            <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700 }}>£{revenue.toFixed(2)}</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0" }}>
            <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Total bookings</div>
            <div style={{ fontSize: "36px", color: "#0F172A", fontWeight: 700 }}>{appointments.length}</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "22px", border: "0.5px solid #E8EAF0" }}>
            <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Plan</div>
            <div style={{ fontSize: "24px", color: "#0F172A", fontWeight: 700, textTransform: "capitalize" }}>{salon?.plan || "Starter"}</div>
          </div>
        </div>

        {showModal && (
          <div style={{ marginTop: "24px", backgroundColor: "#ffffff", border: "0.5px solid #E8EAF0", borderRadius: "24px", padding: "28px", maxWidth: "780px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#64748B", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>New booking</div>
                <h2 style={{ margin: 0, fontSize: "22px", color: "#0F172A" }}>Create client appointment</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError("");
                }}
                style={{ border: "none", backgroundColor: "transparent", color: "#475569", cursor: "pointer", fontSize: "14px" }}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateBooking} style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Client name</label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(event) => setFormData({ ...formData, client_name: event.target.value })}
                  placeholder="E.g. Sarah Jones"
                  required
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Client email</label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(event) => setFormData({ ...formData, client_email: event.target.value })}
                  placeholder="client@example.com"
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Phone number</label>
                <input
                  type="tel"
                  value={formData.client_phone}
                  onChange={(event) => setFormData({ ...formData, client_phone: event.target.value })}
                  placeholder="07400 123456"
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Service</label>
                <select
                  value={formData.service_id}
                  onChange={(event) => setFormData({ ...formData, service_id: event.target.value })}
                  required
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.name} (£{service.price})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Staff member</label>
                <select
                  value={formData.staff_id}
                  onChange={(event) => setFormData({ ...formData, staff_id: event.target.value })}
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                >
                  <option value="">Any available staff</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                  required
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", color: "#0F172A", fontWeight: 600 }}>Time</label>
                <select
                  value={formData.time}
                  onChange={(event) => setFormData({ ...formData, time: event.target.value })}
                  required
                  style={{ border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "#0F172A" }}
                >
                  <option value="">Select time</option>
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                  }}
                  style={{ border: "1px solid #E8EAF0", backgroundColor: "#ffffff", color: "#475569", borderRadius: "12px", padding: "12px 18px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ border: "none", backgroundColor: "#4F6EF7", color: "#ffffff", borderRadius: "12px", padding: "12px 18px", cursor: "pointer" }}
                >
                  Create booking
                </button>
              </div>

              {error && (
                <div style={{ gridColumn: "1 / -1", color: "#DC2626", fontSize: "13px" }}>{error}</div>
              )}
            </form>
          </div>
        )}

        <div style={{ marginTop: "28px", backgroundColor: "#ffffff", borderRadius: "20px", overflow: "hidden", border: "0.5px solid #E8EAF0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "18px", padding: "24px 28px", borderBottom: "0.5px solid #E8EAF0" }}>
            <div>
              <p style={{ margin: 0, fontSize: "14px", color: "#64748B" }}>Appointments</p>
              <h2 style={{ margin: 0, fontSize: "20px", color: "#0F172A" }}>Recent bookings</h2>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["All", "Today", "Upcoming"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    border: "none",
                    backgroundColor: activeTab === tab ? "#4F6EF7" : "#F8FAFC",
                    color: activeTab === tab ? "#ffffff" : "#475569",
                    borderRadius: "999px",
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px", backgroundColor: "#ffffff" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "0.5px solid #E8EAF0" }}>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Status</th>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Client</th>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Service</th>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Staff</th>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Date & time</th>
                  <th style={{ padding: "16px 18px", fontSize: "12px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "1px" }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "22px 18px", color: "#64748B", fontSize: "14px" }}>No appointments available.</td>
                  </tr>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} style={{ borderBottom: "0.5px solid #F1F5F9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", backgroundColor: appointment.status === "confirmed" ? "#ECFDF5" : "#EFF6FF", color: appointment.status === "confirmed" ? "#166534" : "#1D4ED8", fontSize: "12px", fontWeight: 600 }}>
                          {appointment.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: "14px", color: "#0F172A" }}>{appointment.client_name}</td>
                      <td style={{ padding: "14px 18px", fontSize: "14px", color: "#0F172A" }}>{appointment.services?.name || "—"}</td>
                      <td style={{ padding: "14px 18px", fontSize: "14px", color: "#64748B" }}>{appointment.staff?.name || "—"}</td>
                      <td style={{ padding: "14px 18px", fontSize: "14px", color: "#0F172A" }}>{new Date(appointment.date_time).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td style={{ padding: "14px 18px", fontSize: "14px", color: "#0F172A" }}>£{appointment.services?.price?.toFixed(2) || "0.00"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
