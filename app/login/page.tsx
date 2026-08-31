"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) {
      const msg = loginErr.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("wrong")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setError("EMAIL_NOT_CONFIRMED");
      } else {
        setError(loginErr.message);
      }
      setLoading(false);
    } else if (data.user) {
      // Fire-and-forget login log (IP + geo + device) — non-blocking
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch("/api/log-login", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {}); // non-fatal
        }
      } catch { /* non-fatal */ }
      window.location.href = "/dashboard";
    }
  };

  const resendVerification = async () => {
    await supabase.auth.resend({ type: "signup", email });
    setError("RESENT");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    });
    setResetLoading(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", border: "1px solid #ECE9F1",
    borderRadius: "10px", fontSize: "16px",
    color: "#12101A", outline: "none", boxSizing: "border-box",
    background: "#FFFFFF", transition: "border-color 0.15s, box-shadow 0.15s",
    WebkitAppearance: "none",
  };
  const focusIn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#7C3AED";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)";
    e.currentTarget.style.background = "#FFFFFF";
  };
  const focusOut = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#ECE9F1";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "#FFFFFF";
  };

  return (
    <main style={{
      minHeight: "100vh", background: "#F5F3FF",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: "20px",
        padding: "36px 28px", width: "100%", maxWidth: "420px",
        boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link href="/">
            <img src="/brand/logo-light-no-tagline.svg" alt="Feature Salon" style={{ height: 48, width: "auto", display: "inline-block" }} />
          </Link>
          <h1 style={{ fontSize: "14px", color: "#6B6577", marginTop: "8px", fontWeight: "normal" }}>
            {resetMode ? "Reset your password" : "Sign in to your salon"}
          </h1>
        </div>

        {error === "RESENT" && (
          <div style={{ background:"rgba(16,185,129,0.10)", border:"1px solid rgba(16,185,129,0.30)", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", fontSize:"13.5px", color:"#059669", display:"flex", alignItems:"center", gap:8 }}>
            ✅ Verification email resent! Check your inbox (and spam folder).
          </div>
        )}
        {error === "EMAIL_NOT_CONFIRMED" && (
          <div style={{ background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.30)", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", fontSize:"13px", color:"#B45309" }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>⚠ Email not verified yet</div>
            <div style={{ marginBottom:10, lineHeight:1.6 }}>Please check your inbox and click the verification link first. Can&apos;t find it?</div>
            <button onClick={resendVerification} style={{ background:"#F59E0B", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Resend Verification Email
            </button>
          </div>
        )}
        {error && error !== "EMAIL_NOT_CONFIRMED" && error !== "RESENT" && (
          <div style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13.5px", color: "#DC2626", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠</span> {error}
          </div>
        )}

        {resetMode ? (
          resetSent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#12101A", marginBottom: 8 }}>Check your inbox</div>
              <div style={{ fontSize: 13.5, color: "#6B6577", lineHeight: 1.7 }}>
                We sent a reset link to <strong>{resetEmail}</strong>.<br />
                Check spam if it doesn&apos;t arrive within 2 mins.
              </div>
              <button onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
                style={{ marginTop: 24, fontSize: 14, color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600, minHeight: 44 }}>
                ← Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#12101A", display: "block", marginBottom: "6px" }}>Email address</label>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="your@email.com" required style={inp} autoComplete="email" onFocus={focusIn} onBlur={focusOut} />
              </div>
              <button type="submit" disabled={resetLoading}
                style={{ width: "100%", padding: "13px", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, minHeight: 48, background: resetLoading ? "#D6D1DE" : "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", cursor: resetLoading ? "not-allowed" : "pointer" }}>
                {resetLoading ? "Sending…" : "Send Reset Link"}
              </button>
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button type="button" onClick={() => { setResetMode(false); setError(""); }}
                  style={{ fontSize: 13.5, color: "#6B6577", background: "none", border: "none", cursor: "pointer", minHeight: 44 }}>
                  ← Back to sign in
                </button>
              </div>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#12101A", display: "block", marginBottom: "6px" }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="sarah@thecutstudio.co.uk" required style={inp} autoComplete="email" onFocus={focusIn} onBlur={focusOut} />
              </div>
              <div style={{ marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#12101A", display: "block", marginBottom: "6px" }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={inp} autoComplete="current-password" onFocus={focusIn} onBlur={focusOut} />
              </div>
              <div style={{ textAlign: "right", marginBottom: "20px" }}>
                <button type="button" onClick={() => { setResetMode(true); setResetEmail(email); setError(""); }}
                  style={{ fontSize: "13px", color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontWeight: 600, minHeight: 36 }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading}
                style={{ width: "100%", padding: "13px", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, minHeight: 48, background: loading ? "#D6D1DE" : "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 14px rgba(124,58,237,0.3)" }}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <div style={{ textAlign: "center", margin: "24px 0 0", fontSize: "13.5px", color: "#6B6577" }}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" style={{ color: "#7C3AED", textDecoration: "none", fontWeight: 700 }}>Start free trial →</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}