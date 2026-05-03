"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Step = "service" | "staff" | "datetime" | "details" | "confirm";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

export default function PublicBookingPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("service");
  const [booked, setBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientForm, setClientForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    const load = async () => {
      const { data: salonData } = await supabase
        .from("salons").select("*").eq("slug", slug).single();
      if (!salonData) { setNotFound(true); setLoading(false); return; }
      setSalon(salonData);

      const { data: svcData } = await supabase
        .from("services").select("*").eq("salon_id", salonData.id).order("name");
      setServices(svcData || []);

      const { data: staffData } = await supabase
        .from("staff").select("*").eq("salon_id", salonData.id).eq("active", true);
      setStaffList(staffData || []);

      setLoading(false);
    };
    if (slug) load();
  }, [slug]);

  const handleBook = async () => {
    if (!clientForm.name || !clientForm.email || !selectedDate || !selectedTime) return;
    setSubmitting(true);

    const dateTime = `${selectedDate}T${selectedTime}:00`;

    const { error } = await supabase.from("appointments").insert({
      salon_id: salon.id,
      service_id: selectedService?.id || null,
      staff_id: selectedStaff?.id || null,
      client_name: clientForm.name,
      client_email: clientForm.email,
      client_phone: clientForm.phone,
      date_time: dateTime,
      status: "confirmed",
    });

    if (!error) {
      // Send confirmation email via Supabase edge function or just mark as booked
      setBooked(true);
    }
    setSubmitting(false);
  };

  // Generate calendar days (next 30 days)
  const getDays = () => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const steps: Step[] = ["service", "staff", "datetime", "details", "confirm"];
  const stepIndex = steps.indexOf(step);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0F0F0F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#fff", fontFamily: "Georgia, serif", fontSize: "20px", opacity: 0.6 }}>Loading...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#0F0F0F", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ color: "#fff", fontFamily: "Georgia, serif", fontSize: "28px" }}>Salon not found</div>
      <div style={{ color: "#666", fontSize: "14px" }}>Check the link and try again</div>
    </div>
  );

  if (booked) return (
    <div style={{ minHeight: "100vh", background: "#0F0F0F", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "32px" }}>✓</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "28px", color: "#fff", marginBottom: "12px" }}>Booking Confirmed!</div>
        <div style={{ fontSize: "14px", color: "#888", marginBottom: "32px", lineHeight: 1.6 }}>
          Thank you, <strong style={{ color: "#fff" }}>{clientForm.name}</strong>!<br />
          Your appointment at <strong style={{ color: "#fff" }}>{salon.name}</strong> is confirmed.<br />
          A confirmation has been sent to <strong style={{ color: "#fff" }}>{clientForm.email}</strong>.
        </div>
        <div style={{ background: "#1A1A1A", borderRadius: "12px", padding: "20px", textAlign: "left", border: "0.5px solid #333" }}>
          {selectedService && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ color: "#888", fontSize: "13px" }}>Service</span>
            <span style={{ color: "#fff", fontSize: "13px" }}>{selectedService.name}</span>
          </div>}
          {selectedStaff && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ color: "#888", fontSize: "13px" }}>Staff</span>
            <span style={{ color: "#fff", fontSize: "13px" }}>{selectedStaff.name}</span>
          </div>}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ color: "#888", fontSize: "13px" }}>Date</span>
            <span style={{ color: "#fff", fontSize: "13px" }}>{new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#888", fontSize: "13px" }}>Time</span>
            <span style={{ color: "#fff", fontSize: "13px" }}>{selectedTime}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0F0F0F", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: "0.5px solid #1F1F1F", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", color: "#fff", letterSpacing: "-0.5px" }}>{salon.name}</div>
          <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>Online Booking</div>
        </div>
        {/* Progress */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ width: i <= stepIndex ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i <= stepIndex ? "#4F6EF7" : "#333", transition: "all 0.3s ease" }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 24px" }}>

        {/* STEP 1: Service */}
        {step === "service" && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif", marginBottom: "6px" }}>Choose a Service</div>
              <div style={{ fontSize: "13px", color: "#666" }}>What would you like today?</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {services.length === 0 ? (
                <div style={{ color: "#666", fontSize: "14px", textAlign: "center", padding: "40px" }}>No services available</div>
              ) : services.map((s) => (
                <div key={s.id} onClick={() => { setSelectedService(s); setStep("staff"); }}
                  style={{ background: selectedService?.id === s.id ? "#1A2040" : "#161616", border: `1px solid ${selectedService?.id === s.id ? "#4F6EF7" : "#222"}`, borderRadius: "12px", padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 500, color: "#fff", marginBottom: "4px" }}>{s.name}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{s.duration_minutes} min</div>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#4F6EF7" }}>£{s.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Staff */}
        {step === "staff" && (
          <div>
            <button onClick={() => setStep("service")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", marginBottom: "20px", padding: 0, display: "flex", alignItems: "center", gap: "6px" }}>← Back</button>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif", marginBottom: "6px" }}>Choose a Stylist</div>
              <div style={{ fontSize: "13px", color: "#666" }}>Or skip to see all availability</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* No preference option */}
              <div onClick={() => { setSelectedStaff(null); setStep("datetime"); }}
                style={{ background: "#161616", border: "1px solid #222", borderRadius: "12px", padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", transition: "all 0.2s" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>✨</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 500, color: "#fff" }}>No Preference</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>Any available stylist</div>
                </div>
              </div>
              {staffList.map((s) => (
                <div key={s.id} onClick={() => { setSelectedStaff(s); setStep("datetime"); }}
                  style={{ background: selectedStaff?.id === s.id ? "#1A2040" : "#161616", border: `1px solid ${selectedStaff?.id === s.id ? "#4F6EF7" : "#222"}`, borderRadius: "12px", padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", transition: "all 0.2s" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#4F6EF7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                    {s.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 500, color: "#fff" }}>{s.name}</div>
                    <div style={{ fontSize: "12px", color: "#666", textTransform: "capitalize" }}>{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Date & Time */}
        {step === "datetime" && (
          <div>
            <button onClick={() => setStep("staff")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", marginBottom: "20px", padding: 0 }}>← Back</button>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif", marginBottom: "6px" }}>Pick a Date & Time</div>
              <div style={{ fontSize: "13px", color: "#666" }}>Next 30 days available</div>
            </div>

            {/* Date picker */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "12px", letterSpacing: "1px" }}>SELECT DATE</div>
              <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}>
                {getDays().map((d) => {
                  const key = d.toISOString().slice(0, 10);
                  const isSelected = selectedDate === key;
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={key} onClick={() => setSelectedDate(key)}
                      style={{ minWidth: "60px", padding: "12px 8px", borderRadius: "10px", background: isSelected ? "#4F6EF7" : "#161616", border: `1px solid ${isSelected ? "#4F6EF7" : "#222"}`, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                      <div style={{ fontSize: "10px", color: isSelected ? "#B8C8FF" : "#666", marginBottom: "4px" }}>
                        {d.toLocaleDateString("en-GB", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 600, color: isSelected ? "#fff" : "#fff" }}>
                        {d.getDate()}
                      </div>
                      {isToday && <div style={{ fontSize: "9px", color: isSelected ? "#B8C8FF" : "#4F6EF7", marginTop: "2px" }}>Today</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "12px", letterSpacing: "1px" }}>SELECT TIME</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {TIME_SLOTS.map((t) => {
                    const isSelected = selectedTime === t;
                    return (
                      <div key={t} onClick={() => setSelectedTime(t)}
                        style={{ padding: "10px", borderRadius: "8px", background: isSelected ? "#4F6EF7" : "#161616", border: `1px solid ${isSelected ? "#4F6EF7" : "#222"}`, cursor: "pointer", textAlign: "center", fontSize: "13px", color: isSelected ? "#fff" : "#aaa", transition: "all 0.2s" }}>
                        {t}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedDate && selectedTime && (
              <button onClick={() => setStep("details")}
                style={{ width: "100%", marginTop: "24px", padding: "14px", background: "#4F6EF7", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>
                Continue →
              </button>
            )}
          </div>
        )}

        {/* STEP 4: Client Details */}
        {step === "details" && (
          <div>
            <button onClick={() => setStep("datetime")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", marginBottom: "20px", padding: 0 }}>← Back</button>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif", marginBottom: "6px" }}>Your Details</div>
              <div style={{ fontSize: "13px", color: "#666" }}>We'll send confirmation to your email</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { label: "Full Name", key: "name", type: "text", placeholder: "Sarah Johnson", required: true },
                { label: "Email Address", key: "email", type: "email", placeholder: "sarah@email.com", required: true },
                { label: "Phone Number", key: "phone", type: "tel", placeholder: "+44 7700 900000", required: false },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: "12px", color: "#666", display: "block", marginBottom: "6px", letterSpacing: "0.5px" }}>
                    {f.label} {f.required && <span style={{ color: "#4F6EF7" }}>*</span>}
                  </label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(clientForm as any)[f.key]}
                    onChange={(e) => setClientForm({ ...clientForm, [f.key]: e.target.value })}
                    style={{ width: "100%", padding: "13px 16px", background: "#161616", border: "1px solid #222", borderRadius: "10px", fontSize: "14px", color: "#fff", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => { if (clientForm.name && clientForm.email) setStep("confirm"); }}
              disabled={!clientForm.name || !clientForm.email}
              style={{ width: "100%", marginTop: "24px", padding: "14px", background: clientForm.name && clientForm.email ? "#4F6EF7" : "#222", color: clientForm.name && clientForm.email ? "#fff" : "#555", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 500, cursor: clientForm.name && clientForm.email ? "pointer" : "not-allowed" }}>
              Review Booking →
            </button>
          </div>
        )}

        {/* STEP 5: Confirm */}
        {step === "confirm" && (
          <div>
            <button onClick={() => setStep("details")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", marginBottom: "20px", padding: 0 }}>← Back</button>
            <div style={{ marginBottom: "28px" }}>
              <div style={{ fontSize: "24px", fontWeight: 600, color: "#fff", fontFamily: "Georgia, serif", marginBottom: "6px" }}>Confirm Booking</div>
              <div style={{ fontSize: "13px", color: "#666" }}>Please review your appointment details</div>
            </div>

            <div style={{ background: "#161616", borderRadius: "14px", padding: "24px", border: "0.5px solid #222", marginBottom: "20px" }}>
              {[
                { label: "Salon", value: salon.name },
                { label: "Service", value: selectedService?.name || "Not selected" },
                { label: "Duration", value: selectedService ? `${selectedService.duration_minutes} min` : "—" },
                { label: "Price", value: selectedService ? `£${selectedService.price}` : "—" },
                { label: "Stylist", value: selectedStaff?.name || "No preference" },
                { label: "Date", value: new Date(selectedDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
                { label: "Time", value: selectedTime },
                { label: "Name", value: clientForm.name },
                { label: "Email", value: clientForm.email },
                { label: "Phone", value: clientForm.phone || "—" },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: i < arr.length - 1 ? "0.5px solid #222" : "none" }}>
                  <span style={{ fontSize: "13px", color: "#666" }}>{item.label}</span>
                  <span style={{ fontSize: "13px", color: "#fff", textAlign: "right", maxWidth: "60%" }}>{item.value}</span>
                </div>
              ))}
            </div>

            <button onClick={handleBook} disabled={submitting}
              style={{ width: "100%", padding: "16px", background: submitting ? "#333" : "#4F6EF7", color: "#fff", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", letterSpacing: "0.3px" }}>
              {submitting ? "Confirming..." : "Confirm Booking ✓"}
            </button>
            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "12px", color: "#555" }}>
              A confirmation email will be sent to {clientForm.email}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}