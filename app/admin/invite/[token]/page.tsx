"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ROLE_COLORS } from "@/app/types/admin";
import type { AdminRole } from "@/app/types/admin";

type Step = "loading" | "form" | "success" | "error";

interface InviteInfo {
  email:     string;
  role:      AdminRole;
  roleLabel: string;
  invitedBy: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router    = useRouter();

  const [step,      setStep]      = useState<Step>("loading");
  const [invite,    setInvite]    = useState<InviteInfo | null>(null);
  const [errorMsg,  setErrorMsg]  = useState("");
  const [fullName,  setFullName]  = useState("");
  const [password,  setPw]        = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [submitting,setSubmitting]= useState(false);

  // ── Validate token on mount ──────────────────────────────
  useEffect(() => {
    if (!token) { setStep("error"); setErrorMsg("Invalid invite link."); return; }

    fetch(`/api/admin/invites/validate/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.valid) {
          setErrorMsg(
            data.reason === "expired"      ? "This invite link has expired. Please ask for a new one." :
            data.reason === "already_used" ? "This invite has already been used. Try logging in." :
            data.reason === "revoked"      ? "This invite has been revoked. Contact the admin team." :
            "This invite link is invalid.",
          );
          setStep("error");
        } else {
          setInvite(data);
          setStep("form");
        }
      })
      .catch(() => { setErrorMsg("Could not validate invite. Check your connection."); setStep("error"); });
  }, [token]);

  // ── Submit form ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim())            { setErrorMsg("Please enter your full name."); return; }
    if (password.length < 8)         { setErrorMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm)        { setErrorMsg("Passwords do not match."); return; }

    setErrorMsg("");
    setSubmitting(true);
    try {
      const res  = await fetch("/api/admin/invites/accept", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, fullName, password }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error || "Something went wrong."); return; }
      setStep("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const roleColor = invite?.role ? ROLE_COLORS[invite.role] : "#6366F1";

  // ─── Shared shell ──────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A14",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "#13131F", borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1E1B4B,#312E81,#4F46E5)",
          padding: "36px 36px 28px", textAlign: "center",
        }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>
            {step === "success" ? "🎉" : step === "error" ? "⚠️" : "✉️"}
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: "0 0 6px", fontSize: 11, letterSpacing: "2.5px", textTransform: "uppercase" }}>
            Feature Salon
          </p>
          <h1 style={{ color: "#fff", margin: 0, fontSize: 22, fontWeight: 800 }}>
            {step === "success" ? "Welcome aboard!" :
             step === "error"   ? "Invalid Invite" :
             step === "loading" ? "Verifying invite…" :
             "Set up your account"}
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 36px 36px" }}>

          {/* ── LOADING ── */}
          {step === "loading" && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "24px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid rgba(99,102,241,0.3)", borderTop: "3px solid #6366F1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              Checking your invite link…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === "error" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
                <p style={{ color: "#FCA5A5", margin: 0, fontSize: 14, lineHeight: 1.7 }}>{errorMsg}</p>
              </div>
              <a href="mailto:hello@featuresalon.co.uk"
                style={{ fontSize: 13, color: "#4F46E5", textDecoration: "none" }}>
                Contact support →
              </a>
            </div>
          )}

          {/* ── FORM ── */}
          {step === "form" && invite && (
            <form onSubmit={handleSubmit}>
              {/* Role badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: `${roleColor}14`, border: `1.5px solid ${roleColor}40`,
                borderRadius: 12, padding: "10px 16px", marginBottom: 24,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: roleColor, boxShadow: `0 0 8px ${roleColor}` }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: `${roleColor}cc`, letterSpacing: "1.5px", textTransform: "uppercase" }}>Your Role</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{invite.roleLabel}</div>
                </div>
              </div>

              {/* Email (read-only) */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email address</label>
                <input
                  type="email" readOnly value={invite.email}
                  style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              {/* Full name */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Full name *</label>
                <input
                  type="text" placeholder="Jane Smith" required
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Password *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters" required
                    value={password} onChange={e => setPw(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 46 }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "rgba(255,255,255,0.35)" }}>
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
                {password && password.length < 8 && (
                  <p style={{ fontSize: 11.5, color: "#F59E0B", margin: "5px 0 0" }}>At least 8 characters required</p>
                )}
              </div>

              {/* Confirm password */}
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Confirm password *</label>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Repeat password" required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  style={{ ...inputStyle, borderColor: confirm && password !== confirm ? "#EF4444" : undefined }}
                />
                {confirm && password !== confirm && (
                  <p style={{ fontSize: 11.5, color: "#EF4444", margin: "5px 0 0" }}>Passwords do not match</p>
                )}
              </div>

              {/* Error */}
              {errorMsg && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                  <p style={{ color: "#FCA5A5", margin: 0, fontSize: 13 }}>⚠️ {errorMsg}</p>
                </div>
              )}

              <button type="submit" disabled={submitting}
                style={{
                  width: "100%", padding: "14px",
                  background: submitting ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#4F46E5,#7C3AED)",
                  color: "#fff", border: "none", borderRadius: 14,
                  fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: submitting ? "none" : "0 8px 28px rgba(79,70,229,0.4)",
                  transition: "all 0.18s",
                }}>
                {submitting ? "Creating your account…" : "Activate Account →"}
              </button>

              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
                Invited by {invite.invitedBy} · Link expires {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </form>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
                <p style={{ color: "#34D399", margin: 0, fontSize: 14, lineHeight: 1.7 }}>
                  Your admin account has been created successfully. You can now log in to the Feature Salon admin panel.
                </p>
              </div>
              <button onClick={() => router.push("/admin/login")}
                style={{
                  width: "100%", padding: "14px",
                  background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
                  color: "#fff", border: "none", borderRadius: 14,
                  fontSize: 15, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 8px 28px rgba(79,70,229,0.4)",
                }}>
                Go to Login →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: "rgba(255,255,255,0.4)", marginBottom: 7, letterSpacing: "0.5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12, fontSize: 14, color: "#fff",
  outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.18s",
};
