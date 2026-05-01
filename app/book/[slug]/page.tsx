"use client";
import { useEffect, useState, use } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { supabase } from "../../lib/supabase";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({ service: null as any, staff: null as any, date: "", time: "" });
  const [client, setClient] = useState({ name: "", email: "", phone: "" });
  const [booked, setBooked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chargeNow, setChargeNow] = useState(false);
  const [cardElement, setCardElement] = useState<any>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [paymentError, setPaymentError] = useState("");

  const times = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];

  useEffect(() => {
    const load = async () => {
      const stripeObj = await stripePromise;
      setStripe(stripeObj);

      const { data: salonData } = await supabase.from("salons").select("*").eq("slug", slug).single();
      setSalon(salonData);
      if (salonData) {
        const { data: s } = await supabase.from("services").select("*").eq("salon_id", salonData.id);
        const { data: st } = await supabase.from("staff").select("*").eq("salon_id", salonData.id);
        setServices(s || []);
        setStaff(st || []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleBook = async () => {
    setSubmitting(true);
    setPaymentError("");

    try {
      const dateTime = new Date(`${selected.date}T${selected.time}`);
      
      // Create appointment
      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          salon_id: salon.id,
          service_id: selected.service.id,
          staff_id: selected.staff?.id || null,
          client_name: client.name,
          client_email: client.email,
          client_phone: client.phone,
          date_time: dateTime.toISOString(),
          status: chargeNow ? "pending" : "pending",
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Process payment if charge_now is enabled
      if (chargeNow && selected.service.price > 0 && stripe && cardElement) {
        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: selected.service.price,
            email: client.email,
            booking_id: appointmentData.id,
          }),
        });

        const paymentData = await response.json();

        if (!response.ok || paymentData.error) {
          setPaymentError(paymentData.error || "Payment failed");
          setSubmitting(false);
          return;
        }

        // Confirm payment with card
        const { error: confirmError, paymentIntent } = 
          await stripe.confirmCardPayment(paymentData.clientSecret, {
            payment_method: {
              card: cardElement,
              billing_details: { 
                name: client.name, 
                email: client.email,
              },
            },
          });

        if (confirmError) {
          setPaymentError(confirmError.message || "Payment failed");
          // Delete the appointment since payment failed
          await supabase
            .from("appointments")
            .delete()
            .eq("id", appointmentData.id);
          setSubmitting(false);
          return;
        }

        // Payment successful - update appointment status and store payment ID
        if (paymentIntent?.status === "succeeded") {
          await supabase
            .from("appointments")
            .update({ 
              status: "confirmed",
              stripe_payment_id: paymentIntent.id,
            })
            .eq("id", appointmentData.id);
        }
      }

      setBooked(true);
      setSubmitting(false);
    } catch (err: any) {
      setPaymentError(err.message || "Booking failed");
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>Loading...</div>
    </div>
  );

  if (!salon) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#0F172A", marginBottom: "8px" }}>Salon not found</div>
        <p style={{ color: "#64748B" }}>This booking link may be invalid.</p>
      </div>
    </div>
  );

  if (booked) return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "16px", padding: "48px", maxWidth: "420px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#0F172A", marginBottom: "8px" }}>Booking confirmed!</h2>
        <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>
          {selected.service?.name} on {new Date(`${selected.date}T${selected.time}`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {selected.time}
        </p>
        <p style={{ fontSize: "13px", color: "#94A3B8" }}>A confirmation will be sent to {client.email}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "20px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#0F172A", marginBottom: "4px" }}>{salon.name}</div>
        <div style={{ fontSize: "13px", color: "#64748B" }}>Book an appointment</div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", padding: "24px", background: "#fff", borderBottom: "0.5px solid #E8EAF0" }}>
        {["Service", "Date & Time", "Your details"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: step >= i + 1 ? "#4F6EF7" : "#E8EAF0", color: step >= i + 1 ? "#fff" : "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 500 }}>{i + 1}</div>
            <span style={{ fontSize: "13px", color: step === i + 1 ? "#0F172A" : "#94A3B8" }}>{s}</span>
            {i < 2 && <div style={{ width: "32px", height: "0.5px", background: "#E8EAF0" }}></div>}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: "560px", margin: "32px auto", padding: "0 20px" }}>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#0F172A", marginBottom: "20px" }}>Choose a service</h3>
            {services.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: "12px", padding: "32px", textAlign: "center", color: "#94A3B8" }}>No services available yet.</div>
            ) : (
              services.map((s) => (
                <div key={s.id} onClick={() => setSelected({ ...selected, service: s })} style={{ background: "#fff", border: selected.service?.id === s.id ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0", borderRadius: "12px", padding: "18px 20px", marginBottom: "10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 500, color: "#0F172A", marginBottom: "4px" }}>{s.name}</div>
                    <div style={{ fontSize: "13px", color: "#64748B" }}>{s.duration} min</div>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 500, color: "#4F6EF7" }}>£{s.price}</div>
                </div>
              ))
            )}

            {staff.length > 0 && (
              <div style={{ marginTop: "24px" }}>
                <h3 style={{ fontFamily: "Georgia, serif", fontSize: "18px", color: "#0F172A", marginBottom: "14px" }}>Choose a stylist (optional)</h3>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
                  {staff.map((st) => (
                    <div key={st.id} onClick={() => setSelected({ ...selected, staff: st })} style={{ background: "#fff", border: selected.staff?.id === st.id ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0", borderRadius: "10px", padding: "12px 18px", cursor: "pointer", fontSize: "13px", color: selected.staff?.id === st.id ? "#4F6EF7" : "#0F172A" }}>
                      {st.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!selected.service} style={{ marginTop: "24px", width: "100%", padding: "12px", background: selected.service ? "#4F6EF7" : "#E8EAF0", color: selected.service ? "#fff" : "#94A3B8", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: selected.service ? "pointer" : "not-allowed" }}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#0F172A", marginBottom: "20px" }}>Pick a date & time</h3>
            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "8px" }}>Select date</label>
              <input type="date" value={selected.date} onChange={(e) => setSelected({ ...selected, date: e.target.value })} min={new Date().toISOString().split("T")[0]}
                style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box" as const }} />
            </div>

            {selected.date && (
              <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "12px" }}>Select time</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {times.map((t) => (
                    <div key={t} onClick={() => setSelected({ ...selected, time: t })} style={{ padding: "8px", textAlign: "center", border: selected.time === t ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "13px", color: selected.time === t ? "#4F6EF7" : "#0F172A", cursor: "pointer", background: selected.time === t ? "#EEF2FF" : "#fff" }}>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", background: "#fff", color: "#0F172A", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!selected.date || !selected.time} style={{ flex: 2, padding: "12px", background: selected.date && selected.time ? "#4F6EF7" : "#E8EAF0", color: selected.date && selected.time ? "#fff" : "#94A3B8", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: selected.date && selected.time ? "pointer" : "not-allowed" }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: "22px", color: "#0F172A", marginBottom: "20px" }}>Your details</h3>
            <div style={{ background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: "10px", padding: "16px", marginBottom: "20px", fontSize: "13px", color: "#4F6EF7" }}>
              <strong>{selected.service?.name}</strong> — £{selected.service?.price} · {selected.date} at {selected.time}
              {selected.staff && ` · with ${selected.staff.name}`}
            </div>

            {paymentError && (
              <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#EF4444" }}>
                {paymentError}
              </div>
            )}

            <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
              {[
                { label: "Full name", key: "name", type: "text", placeholder: "Emma Wilson" },
                { label: "Email address", key: "email", type: "email", placeholder: "emma@email.co.uk" },
                { label: "Phone number", key: "phone", type: "tel", placeholder: "+44 7700 000000" },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={(client as any)[f.key]} onChange={(e) => setClient({ ...client, [f.key]: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              ))}
            </div>

            {selected.service?.price > 0 && (
              <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <input
                    type="checkbox"
                    id="charge-now"
                    checked={chargeNow}
                    onChange={(e) => setChargeNow(e.target.checked)}
                    style={{ cursor: "pointer", width: "18px", height: "18px" }}
                  />
                  <label htmlFor="charge-now" style={{ fontSize: "14px", color: "#0F172A", cursor: "pointer", fontWeight: 500 }}>
                    Charge my card now (£{selected.service?.price})
                  </label>
                </div>

                {chargeNow && (
                  <div style={{ background: "#F8F9FC", border: "0.5px solid #E8EAF0", borderRadius: "8px", padding: "16px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "10px" }}>Card details</label>
                    <div
                      ref={(el) => {
                        if (el && !cardElement && stripe) {
                          const elements = stripe.elements();
                          const element = elements.create("card");
                          element.mount(el);
                          setCardElement(element);
                        }
                      }}
                      style={{ padding: "12px", border: "0.5px solid #E8EAF0", borderRadius: "6px", background: "#fff" }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: "12px", background: "#fff", color: "#0F172A", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>← Back</button>
              <button onClick={handleBook} disabled={!client.name || !client.email || submitting} style={{ flex: 2, padding: "12px", background: client.name && client.email ? "#4F6EF7" : "#E8EAF0", color: client.name && client.email ? "#fff" : "#94A3B8", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: client.name && client.email ? "pointer" : "not-allowed" }}>
                {submitting ? "Processing..." : "Confirm booking"}
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: "center", padding: "32px", fontSize: "12px", color: "#CBD5E1" }}>
        Powered by <span style={{ fontFamily: "Georgia, serif", color: "#4F6EF7" }}>feature</span>
      </div>

    </div>
  );
}