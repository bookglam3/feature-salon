"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const service   = params.get("service") || "Appointment";
  const date      = params.get("date") || "";
  const time      = params.get("time") || "";
  const name      = params.get("name") || "";
  const amount    = params.get("amount") || "";
  const deposit   = params.get("deposit") === "true";
  const salon     = params.get("salon") || "the business";
  const apptId      = params.get("appt_id") || "";
  const salonSlug   = params.get("slug") || "";
  const reviewToken = params.get("review_token") || "";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes bounceIn{0%{opacity:0;transform:scale(0.5)}70%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}} @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background: "#fff", borderRadius: 28, padding: "48px 32px", maxWidth: 480, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.3)", animation: "slideUp 0.5s ease-out" }}>

        {/* Success icon */}
        <div style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg,#10b981 0%,#059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, margin: "0 auto 24px", boxShadow: "0 8px 24px rgba(16,185,129,0.4)", animation: "bounceIn 0.6s ease-out 0.2s both" }}>✓</div>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 8, background: "linear-gradient(135deg,#10b981 0%,#059669 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Payment Successful!
        </h1>
        <p style={{ fontSize: 15, color: "#64748B", marginBottom: 32, lineHeight: 1.6 }}>
          {deposit
            ? `Your 50% deposit for ${salon} has been paid. Please pay the remaining balance at the salon.`
            : `Your booking at ${salon} is confirmed and fully paid.`}
        </p>

        {/* Booking summary */}
        <div style={{ padding: 24, background: "linear-gradient(135deg,#F8FAFC,#F1F5F9)", borderRadius: 20, textAlign: "left", border: "1px solid #E2E8F0", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}>Booking Summary</div>
          {[
            { label: "Client",  value: name },
            { label: "Service", value: service },
            { label: "Date",    value: date },
            { label: "Time",    value: time },
            { label: deposit ? "Deposit Paid" : "Total Paid", value: amount ? `£${amount}` : "" },
          ].filter(r => r.value).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 4 ? "1px solid #E2E8F0" : "none" }}>
              <span style={{ fontSize: 13.5, color: "#64748B", fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontSize: 13.5, color: "#0F172A", fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
          {deposit && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <p style={{ fontSize: 12.5, color: "#92400E", fontWeight: 600, margin: 0 }}>Remaining 50% balance is due at the salon. Please bring this confirmation.</p>
            </div>
          )}
        </div>

        <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>A confirmation email has been sent to your inbox.</p>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {apptId && (
            <a href={`/reschedule/${apptId}?token=${reviewToken}`}
              style={{ display: "block", padding: "13px", background: "#F1F5F9", color: "#475569", borderRadius: 14, textDecoration: "none", fontSize: 14, fontWeight: 700, border: "1.5px solid #E2E8F0" }}>
              📅 Manage / Reschedule Appointment
            </a>
          )}
          {reviewToken && (
            <a href={`/review/${reviewToken}`}
              style={{ display: "block", padding: "13px", background: "#FFFBEB", color: "#D97706", borderRadius: 14, textDecoration: "none", fontSize: 14, fontWeight: 700, border: "1.5px solid #FDE68A" }}>
              ⭐ Leave a Review After Your Visit
            </a>
          )}
          {salonSlug ? (
            <a href={`/book/${salonSlug}`}
              style={{ display: "block", padding: "13px", background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", color: "#fff", borderRadius: 14, textDecoration: "none", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 20px rgba(102,126,234,0.4)" }}>
              Book Another Appointment →
            </a>
          ) : (
            <button onClick={() => window.history.back()}
              style={{ padding: "13px", background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(102,126,234,0.4)" }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"sans-serif" }}>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}