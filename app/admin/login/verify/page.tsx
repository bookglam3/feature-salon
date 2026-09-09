"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Verify2FAPage() {
  const router = useRouter();

  const [code,       setCode]       = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [useBackup,  setUseBackup]  = useState(false);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) { setError("Please enter a code."); return; }

    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/auth/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Verification failed."); return; }
      router.push("/admin");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07070F",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#0D0D1A", borderRadius: 24,
        border: "1px solid rgba(99,102,241,0.2)",
        overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1E1B4B,#312E81,#4F46E5)",
          padding: "32px 36px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: "0 0 4px", fontSize: 10, letterSpacing: "2.5px", textTransform: "uppercase" }}>
            Feature Salon Admin
          </p>
          <h1 style={{ color: "#fff", margin: 0, fontSize: 20, fontWeight: 800 }}>
            Two-Factor Verification
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", margin: "8px 0 0", fontSize: 13 }}>
            {useBackup ? "Enter a backup code" : "Enter the code from your authenticator app"}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "28px 32px 32px" }}>

          {/* Code input */}
          <div style={{ marginBottom: 20 }}>
            <label style={lblStyle}>
              {useBackup ? "Backup Code" : "Authenticator Code"}
            </label>
            <input
              type={useBackup ? "text" : "text"}
              inputMode={useBackup ? "text" : "numeric"}
              placeholder={useBackup ? "XXXX-XXXX" : "000000"}
              maxLength={useBackup ? 9 : 6}
              value={code}
              onChange={e => {
                let v = e.target.value;
                if (!useBackup) v = v.replace(/\D/g, "").slice(0, 6);
                setCode(v);
              }}
              autoFocus
              style={{
                width: "100%", padding: "14px 16px",
                fontSize: useBackup ? 20 : 28,
                letterSpacing: useBackup ? "4px" : "10px",
                textAlign: "center", fontWeight: 800,
                color: "#A5B4FC",
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 14, outline: "none", boxSizing: "border-box" as const,
                fontFamily: "monospace", textTransform: "uppercase" as const,
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "11px 14px", marginBottom: 18,
            }}>
              <p style={{ color: "#FCA5A5", margin: 0, fontSize: 13 }}>⚠️ {error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg,#4F46E5,#7C3AED)",
            color: "#fff", border: "none", borderRadius: 13,
            fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 6px 20px rgba(79,70,229,0.4)",
            fontFamily: "inherit",
          }}>
            {loading ? "Verifying…" : "Verify →"}
          </button>

          {/* Toggle backup / TOTP */}
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button type="button" onClick={() => { setUseBackup(b => !b); setCode(""); setError(""); }} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#4F46E5", fontSize: 12.5, fontWeight: 600,
            }}>
              {useBackup ? "← Use authenticator app instead" : "Use a backup code instead →"}
            </button>
          </div>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button type="button" onClick={handleLogout} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.2)", fontSize: 12,
            }}>
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const lblStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "rgba(255,255,255,0.35)", letterSpacing: "0.8px",
  textTransform: "uppercase", marginBottom: 8,
};
