"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function ResetContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const token_hash = params.get("token_hash");
      const type = params.get("type");

      if (token_hash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash,
        });
        if (!error) {
          setValidSession(true);
          setChecking(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setValidSession(true);
      } else {
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
      setChecking(false);
    };
    verify();
  }, [params]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2500);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0",
    borderRadius: "8px", fontSize: "14px", color: "#0F172A", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "16px", padding: "48px", width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <a href="/"><img src="/brand/logo-light.svg" alt="Feature Salon" style={{ height: 48, width: "auto", display: "inline-block" }} /></a>
          <p style={{ fontSize: "14px", color: "#64748B", marginTop: "8px" }}>Set your new password</p>
        </div>

        {checking ? (
          <div style={{ textAlign: "center", color: "#64748B", padding: "24px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            Verifying reset link…
          </div>
        ) : done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Password Updated!</div>
            <div style={{ fontSize: 13, color: "#64748B" }}>Redirecting you to your dashboard…</div>
          </div>
        ) : !validSession ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 14, color: "#EF4444", marginBottom: 20, lineHeight: 1.6 }}>{error}</div>
            <a href="/login" style={{ color: "#4F6EF7", fontSize: 13, fontWeight: 600 }}>
              ← Back to Login
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#EF4444" }}>
                {error}
              </div>
            )}
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required minLength={8} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password" required style={inputStyle} />
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "12px", background: loading ? "#64748B" : "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Saving…" : "Set New Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F2F4F7" }} />}>
      <ResetContent />
    </Suspense>
  );
}
