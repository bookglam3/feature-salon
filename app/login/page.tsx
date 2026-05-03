"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "16px", padding: "48px", width: "100%", maxWidth: "420px" }}>

        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", color: "#0F172A", letterSpacing: "-0.5px", textDecoration: "none" }}>
            feature
          </Link>
          <p style={{ fontSize: "14px", color: "#64748B", marginTop: "8px" }}>Sign in to your salon</p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#EF4444" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@thecutstudio.co.uk"
              required
              style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: loading ? "#94A3B8" : "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ textAlign: "center", margin: "24px 0", fontSize: "13px", color: "#94A3B8" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "#4F6EF7", textDecoration: "none", fontWeight: 500 }}>
            Start free trial
          </Link>
        </div>

      </div>
    </main>
  );
}