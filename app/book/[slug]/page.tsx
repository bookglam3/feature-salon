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
  const [chargeNow, setChargeNow] = useState(true);
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

      // Process payment if service has a price
      if (selected.service.price > 0 && stripe && cardElement) {
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

      // Send confirmation emails
      try {
        await fetch('/api/send-booking-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: appointmentData.id,
            clientEmail: client.email,
            clientName: client.name,
            serviceName: selected.service.name,
            dateTime: dateTime.toISOString(),
            staffName: selected.staff?.name,
            salonName: salon.name,
            clientPhone: client.phone,
            salonOwnerEmail: null, // TODO: Add salon owner email to salons table
          }),
        });
      } catch (emailError) {
        console.error('Error sending emails:', emailError);
        // Don't fail the booking if emails fail
      }
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
    <div style={{
      minHeight: "100vh",
      background: "#F2F4F7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      "@media (max-width: 767px)": { padding: "16px" }
    }}>
      <div style={{
        background: "#fff",
        border: "0.5px solid #E8EAF0",
        borderRadius: "16px",
        padding: "48px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        "@media (max-width: 767px)": { padding: "32px 24px" }
      }}>
        <div style={{
          fontSize: "48px",
          marginBottom: "16px",
          "@media (max-width: 767px)": { fontSize: "40px", marginBottom: "12px" }
        }}>
          ✅
        </div>
        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: "24px",
          color: "#0F172A",
          marginBottom: "8px",
          "@media (max-width: 767px)": { fontSize: "20px" }
        }}>
          Booking confirmed!
        </h2>
        <p style={{
          fontSize: "14px",
          color: "#64748B",
          marginBottom: "24px",
          "@media (max-width: 767px)": { fontSize: "13px", marginBottom: "20px" }
        }}>
          {selected.service?.name} on {new Date(`${selected.date}T${selected.time}`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at {selected.time}
        </p>
        <p style={{
          fontSize: "13px",
          color: "#94A3B8",
          "@media (max-width: 767px)": { fontSize: "12px" }
        }}>
          A confirmation will be sent to {client.email}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7" }}>

      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "0.5px solid #E8EAF0",
        padding: "20px",
        textAlign: "center",
        "@media (max-width: 767px)": { padding: "16px 20px" }
      }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: "24px",
          color: "#0F172A",
          marginBottom: "4px",
          "@media (max-width: 767px)": { fontSize: "20px" }
        }}>
          {salon.name}
        </div>
        <div style={{ fontSize: "13px", color: "#64748B" }}>Book an appointment</div>
      </div>

      {/* Progress */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "8px",
        padding: "24px 20px",
        background: "#fff",
        borderBottom: "0.5px solid #E8EAF0",
        overflowX: "auto",
        "@media (max-width: 767px)": { padding: "16px 20px", gap: "6px" }
      }}>
        {["Service", "Date & Time", "Your details"].map((s, i) => (
          <div key={s} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0
          }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: step >= i + 1 ? "#4F6EF7" : "#E8EAF0",
              color: step >= i + 1 ? "#fff" : "#94A3B8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              "@media (max-width: 767px)": { width: "24px", height: "24px", fontSize: "11px" }
            }}>
              {i + 1}
            </div>
            <span style={{
              fontSize: "13px",
              color: step === i + 1 ? "#0F172A" : "#94A3B8",
              whiteSpace: "nowrap",
              "@media (max-width: 767px)": { fontSize: "12px" }
            }}>
              {s}
            </span>
            {i < 2 && (
              <div style={{
                width: "16px",
                height: "0.5px",
                background: "#E8EAF0",
                "@media (max-width: 767px)": { width: "12px" }
              }} />
            )}
          </div>
        ))}
      </div>

      <div style={{
        maxWidth: "560px",
        margin: "32px auto",
        padding: "0 20px",
        "@media (max-width: 767px)": { margin: "20px auto", padding: "0 16px" }
      }}>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h3 style={{
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: "#0F172A",
              marginBottom: "20px",
              "@media (max-width: 767px)": { fontSize: "20px", marginBottom: "16px" }
            }}>
              Choose a service
            </h3>
            {services.length === 0 ? (
              <div style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "32px",
                textAlign: "center",
                color: "#94A3B8",
                "@media (max-width: 767px)": { padding: "24px 16px" }
              }}>
                No services available yet.
              </div>
            ) : (
              services.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelected({ ...selected, service: s })}
                  style={{
                    background: "#fff",
                    border: selected.service?.id === s.id ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0",
                    borderRadius: "12px",
                    padding: "18px 20px",
                    marginBottom: "10px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.2s",
                    "@media (max-width: 767px)": { padding: "16px", marginBottom: "8px" }
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#0F172A",
                      marginBottom: "4px",
                      "@media (max-width: 767px)": { fontSize: "14px" }
                    }}>
                      {s.name}
                    </div>
                    <div style={{
                      fontSize: "13px",
                      color: "#64748B",
                      "@media (max-width: 767px)": { fontSize: "12px" }
                    }}>
                      {s.duration_minutes} min
                    </div>
                  </div>
                  <div style={{
                    fontSize: "18px",
                    fontWeight: 500,
                    color: "#4F6EF7",
                    "@media (max-width: 767px)": { fontSize: "16px" }
                  }}>
                    £{s.price}
                  </div>
                </div>
              ))
            )}

            {staff.length > 0 && (
              <div style={{ marginTop: "24px", "@media (max-width: 767px)": { marginTop: "20px" } }}>
                <h3 style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "18px",
                  color: "#0F172A",
                  marginBottom: "14px",
                  "@media (max-width: 767px)": { fontSize: "16px", marginBottom: "12px" }
                }}>
                  Choose a stylist (optional)
                </h3>
                <div style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  "@media (max-width: 767px)": { gap: "8px" }
                }}>
                  {staff.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setSelected({ ...selected, staff: st })}
                      style={{
                        background: "#fff",
                        border: selected.staff?.id === st.id ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0",
                        borderRadius: "10px",
                        padding: "12px 18px",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: selected.staff?.id === st.id ? "#4F6EF7" : "#0F172A",
                        transition: "all 0.2s",
                        "@media (max-width: 767px)": { padding: "10px 14px", fontSize: "12px" }
                      }}
                    >
                      {st.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!selected.service}
              style={{
                marginTop: "24px",
                width: "100%",
                padding: "12px",
                background: selected.service ? "#4F6EF7" : "#E8EAF0",
                color: selected.service ? "#fff" : "#94A3B8",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: selected.service ? "pointer" : "not-allowed",
                "@media (max-width: 767px)": { marginTop: "20px", padding: "14px", fontSize: "15px" }
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h3 style={{
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: "#0F172A",
              marginBottom: "20px",
              "@media (max-width: 767px)": { fontSize: "20px", marginBottom: "16px" }
            }}>
              Pick a date & time
            </h3>
            <div style={{
              background: "#fff",
              border: "0.5px solid #E8EAF0",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "16px",
              "@media (max-width: 767px)": { padding: "16px" }
            }}>
              <label style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#0F172A",
                display: "block",
                marginBottom: "8px",
                "@media (max-width: 767px)": { fontSize: "12px" }
              }}>
                Select date
              </label>
              <input
                type="date"
                value={selected.date}
                onChange={(e) => setSelected({ ...selected, date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "0.5px solid #E8EAF0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                  "@media (max-width: 767px)": { padding: "12px 14px", fontSize: "16px" }
                }}
              />
            </div>

            {selected.date && (
              <div style={{
                background: "#fff",
                border: "0.5px solid #E8EAF0",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "16px",
                "@media (max-width: 767px)": { padding: "16px" }
              }}>
                <label style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#0F172A",
                  display: "block",
                  marginBottom: "12px",
                  "@media (max-width: 767px)": { fontSize: "12px", marginBottom: "10px" }
                }}>
                  Select time
                </label>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                  gap: "8px",
                  "@media (max-width: 767px)": { gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: "6px" }
                }}>
                  {times.map((t) => (
                    <div
                      key={t}
                      onClick={() => setSelected({ ...selected, time: t })}
                      style={{
                        padding: "8px",
                        textAlign: "center",
                        border: selected.time === t ? "1.5px solid #4F6EF7" : "0.5px solid #E8EAF0",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: selected.time === t ? "#4F6EF7" : "#0F172A",
                        cursor: "pointer",
                        background: selected.time === t ? "#EEF2FF" : "#fff",
                        transition: "all 0.2s",
                        "@media (max-width: 767px)": { padding: "10px 6px", fontSize: "12px" }
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              display: "flex",
              gap: "10px",
              "@media (max-width: 767px)": { flexDirection: "column", gap: "8px" }
            }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#fff",
                  color: "#0F172A",
                  border: "0.5px solid #E8EAF0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  "@media (max-width: 767px)": { padding: "14px", fontSize: "15px" }
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selected.date || !selected.time}
                style={{
                  flex: 2,
                  padding: "12px",
                  background: selected.date && selected.time ? "#4F6EF7" : "#E8EAF0",
                  color: selected.date && selected.time ? "#fff" : "#94A3B8",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: selected.date && selected.time ? "pointer" : "not-allowed",
                  "@media (max-width: 767px)": { flex: "none", padding: "14px", fontSize: "15px" }
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h3 style={{
              fontFamily: "Georgia, serif",
              fontSize: "22px",
              color: "#0F172A",
              marginBottom: "20px",
              "@media (max-width: 767px)": { fontSize: "20px", marginBottom: "16px" }
            }}>
              Your details
            </h3>
            <div style={{
              background: "#EEF2FF",
              border: "0.5px solid #C7D2FE",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#4F6EF7",
              "@media (max-width: 767px)": { padding: "14px", fontSize: "12px", marginBottom: "16px" }
            }}>
              <strong>{selected.service?.name}</strong> — £{selected.service?.price} · {selected.date} at {selected.time}
              {selected.staff && ` · with ${selected.staff.name}`}
            </div>

            {paymentError && (
              <div style={{
                background: "#FEF2F2",
                border: "0.5px solid #FECACA",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#EF4444",
                "@media (max-width: 767px)": { padding: "10px 14px", fontSize: "12px" }
              }}>
                {paymentError}
              </div>
            )}

            <div style={{
              background: "#fff",
              border: "0.5px solid #E8EAF0",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "16px",
              "@media (max-width: 767px)": { padding: "20px" }
            }}>
              {[
                { label: "Full name", key: "name", type: "text", placeholder: "Emma Wilson" },
                { label: "Email address", key: "email", type: "email", placeholder: "emma@email.co.uk" },
                { label: "Phone number", key: "phone", type: "tel", placeholder: "+44 7700 000000" },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: "16px", "@media (max-width: 767px)": { marginBottom: "14px" } }}>
                  <label style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0F172A",
                    display: "block",
                    marginBottom: "6px",
                    "@media (max-width: 767px)": { fontSize: "12px", marginBottom: "4px" }
                  }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(client as any)[f.key]}
                    onChange={(e) => setClient({ ...client, [f.key]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "0.5px solid #E8EAF0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#0F172A",
                      outline: "none",
                      boxSizing: "border-box",
                      "@media (max-width: 767px)": { padding: "12px 14px", fontSize: "16px" }
                    }}
                  />
                </div>
              ))}
            </div>

            {selected.service?.price > 0 && (
              <div style={{
                background: "#fff",
                border: "0.5px solid #E8EAF0",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "16px",
                "@media (max-width: 767px)": { padding: "16px" }
              }}>
                <div style={{ marginBottom: "16px", "@media (max-width: 767px)": { marginBottom: "14px" } }}>
                  <label style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0F172A",
                    display: "block",
                    marginBottom: "10px",
                    "@media (max-width: 767px)": { fontSize: "12px", marginBottom: "8px" }
                  }}>
                    Card details
                  </label>
                  <div
                    ref={(el) => {
                      if (el && !cardElement && stripe) {
                        const elements = stripe.elements();
                        const element = elements.create("card");
                        element.mount(el);
                        setCardElement(element);
                      }
                    }}
                    style={{
                      padding: "12px",
                      border: "0.5px solid #E8EAF0",
                      borderRadius: "6px",
                      background: "#fff",
                      "@media (max-width: 767px)": { padding: "14px" }
                    }}
                  />
                </div>
                <div style={{
                  fontSize: "14px",
                  color: "#0F172A",
                  fontWeight: 500,
                  "@media (max-width: 767px)": { fontSize: "13px" }
                }}>
                  Total: £{selected.service?.price}
                </div>
              </div>
            )}

            <div style={{
              display: "flex",
              gap: "10px",
              "@media (max-width: 767px)": { flexDirection: "column", gap: "8px" }
            }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#fff",
                  color: "#0F172A",
                  border: "0.5px solid #E8EAF0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                  "@media (max-width: 767px)": { padding: "14px", fontSize: "15px" }
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleBook}
                disabled={!client.name || !client.email || submitting || (selected.service?.price > 0 && !cardElement)}
                style={{
                  flex: 2,
                  padding: "12px",
                  background: client.name && client.email && (selected.service?.price === 0 || cardElement) ? "#4F6EF7" : "#E8EAF0",
                  color: client.name && client.email && (selected.service?.price === 0 || cardElement) ? "#fff" : "#94A3B8",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: client.name && client.email && (selected.service?.price === 0 || cardElement) ? "pointer" : "not-allowed",
                  "@media (max-width: 767px)": { flex: "none", padding: "14px", fontSize: "15px" }
                }}
              >
                {submitting ? "Processing..." : "Confirm booking"}
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{
        textAlign: "center",
        padding: "32px",
        fontSize: "12px",
        color: "#CBD5E1",
        "@media (max-width: 767px)": { padding: "24px 16px", fontSize: "11px" }
      }}>
        Powered by <span style={{ fontFamily: "Georgia, serif", color: "#4F6EF7" }}>feature</span>
      </div>

    </div>
  );
}