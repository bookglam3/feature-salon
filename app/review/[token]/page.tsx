"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ── Types ────────────────────────────────────────────────────
type VS =
  | { state: "loading" }
  | { state: "valid";     salon_name: string; service_name: string; appt_date: string }
  | { state: "invalid";   reason: string }
  | { state: "submitted"; salon_name: string };

// ── Star picker ──────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
            fontSize: 46, lineHeight: 1,
            color: n <= (hover || value) ? "#F59E0B" : "#E2E8F0",
            transform: n <= (hover || value) ? "scale(1.18)" : "scale(1)",
            transition: "all 0.1s",
          }}
        >★</button>
      ))}
    </div>
  );
}

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];

const INVALID_MSGS: Record<string, { icon: string; title: string; body: string }> = {
  not_found:        { icon: "🔍", title: "Link Not Found",          body: "This review link is not valid. Please check the link from your booking confirmation." },
  cancelled:        { icon: "❌", title: "Appointment Cancelled",    body: "Reviews cannot be submitted for cancelled appointments." },
  upcoming:         { icon: "📅", title: "Not Done Yet",            body: "You can leave a review once your appointment has taken place. Come back after your visit!" },
  already_reviewed: { icon: "✅", title: "Already Reviewed",        body: "You have already left a review for this appointment. Thank you!" },
  missing_token:    { icon: "🔍", title: "Link Not Found",          body: "This review link is not valid." },
};

// ── Page ─────────────────────────────────────────────────────
export default function ReviewPage() {
  const { token } = useParams() as { token: string };
  const [vs, setVs]         = useState<VS>({ state: "loading" });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]       = useState("");

  useEffect(() => {
    fetch(`/api/reviews?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          setVs({ state: "valid", salon_name: d.salon_name, service_name: d.service_name, appt_date: d.appt_date });
        } else {
          setVs({ state: "invalid", reason: d.reason || "not_found" });
        }
      })
      .catch(() => setVs({ state: "invalid", reason: "not_found" }));
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) { setFormErr("Please select a star rating."); return; }
    setSubmitting(true);
    setFormErr("");
    try {
      const res  = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment: comment.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        const name = vs.state === "valid" ? vs.salon_name : "";
        setVs({ state: "submitted", salon_name: name });
      } else {
        setFormErr(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setFormErr("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');`}</style>
      <div style={{
        background: "#fff", borderRadius: 24, padding: "40px 32px",
        maxWidth: 480, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
      }}>
        {children}
      </div>
    </div>
  );

  /* Loading */
  if (vs.state === "loading") return (
    <Shell>
      <div style={{ textAlign: "center", color: "#64748B", fontSize: 15, padding: "24px 0" }}>Loading…</div>
    </Shell>
  );

  /* Invalid states */
  if (vs.state === "invalid") {
    const m = INVALID_MSGS[vs.reason] ?? INVALID_MSGS.not_found;
    return (
      <Shell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 18 }}>{m.icon}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 10, letterSpacing: "-0.4px" }}>
            {m.title}
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{m.body}</p>
        </div>
      </Shell>
    );
  }

  /* Success */
  if (vs.state === "submitted") return (
    <Shell>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg,#10B981,#059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, margin: "0 auto 24px", boxShadow: "0 8px 28px rgba(16,185,129,0.4)",
        }}>✓</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", marginBottom: 10, letterSpacing: "-0.5px" }}>
          Thank You!
        </h1>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7 }}>
          Your review for <strong style={{ color: "#0F172A" }}>{vs.salon_name}</strong> has been submitted.
          It helps real clients discover great local businesses.
        </p>
      </div>
    </Shell>
  );

  /* Form */
  const apptDateLabel = vs.appt_date
    ? new Date(vs.appt_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <Shell>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>⭐</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 6, letterSpacing: "-0.4px" }}>
          Leave a Review
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
          How was your visit to <strong style={{ color: "#0F172A" }}>{vs.salon_name}</strong>?
        </p>
        {(vs.service_name || apptDateLabel) && (
          <div style={{
            display: "inline-block", marginTop: 10, padding: "4px 14px",
            background: "#F1F5F9", borderRadius: 20, fontSize: 12.5, color: "#475569", fontWeight: 600,
          }}>
            {[vs.service_name, apptDateLabel].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* Star rating */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: "#64748B", textAlign: "center",
          marginBottom: 14, textTransform: "uppercase", letterSpacing: "1.2px",
        }}>
          Your Rating *
        </div>
        <StarPicker value={rating} onChange={setRating} />
        <div style={{ textAlign: "center", marginTop: 10, minHeight: 20 }}>
          {rating > 0 && (
            <span style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>
              {RATING_LABELS[rating]}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: "#64748B", marginBottom: 10,
          textTransform: "uppercase", letterSpacing: "1.2px",
        }}>
          Comments{" "}
          <span style={{ color: "#CBD5E1", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
            (optional)
          </span>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, 500))}
          placeholder="Tell others about your experience…"
          rows={4}
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 12,
            border: "2px solid #E2E8F0", fontSize: 14, fontFamily: "inherit",
            color: "#0F172A", background: "#F8FAFC", resize: "none",
            outline: "none", transition: "border-color 0.18s, background 0.18s",
            boxSizing: "border-box",
          }}
          onFocus={e => { e.target.style.borderColor = "#667eea"; e.target.style.background = "#fff"; }}
          onBlur={e =>  { e.target.style.borderColor = "#E2E8F0"; e.target.style.background = "#F8FAFC"; }}
        />
        <div style={{ textAlign: "right", fontSize: 11.5, color: "#CBD5E1", marginTop: 4 }}>
          {comment.length}/500
        </div>
      </div>

      {formErr && (
        <div style={{
          padding: "12px 16px", background: "#FEF2F2", borderRadius: 10,
          border: "1px solid #FECACA", color: "#DC2626", fontSize: 13,
          fontWeight: 600, marginBottom: 16,
        }}>
          {formErr}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        style={{
          width: "100%", padding: "16px", borderRadius: 14, border: "none",
          background: rating === 0 ? "#F1F5F9" : "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
          color: rating === 0 ? "#64748B" : "#fff",
          fontSize: 16, fontWeight: 700,
          cursor: rating === 0 || submitting ? "not-allowed" : "pointer",
          boxShadow: rating === 0 ? "none" : "0 8px 20px rgba(102,126,234,0.38)",
          transition: "all 0.18s",
        }}
      >
        {submitting ? "Submitting…" : "Submit Review"}
      </button>

      <p style={{ textAlign: "center", fontSize: 12, color: "#64748B", marginTop: 14, lineHeight: 1.6 }}>
        Your first name only is shown publicly. Reviews help real clients find great businesses.
      </p>
    </Shell>
  );
}
