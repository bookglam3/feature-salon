"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { salon_name: salonName } } });

    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user) {
      const { error: salonError } = await supabase.from("salons").insert({
        name: salonName,
        slug: salonName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        owner_id: data.user.id,
        owner_email: email,
        plan: "starter",
      });
      if (salonError) { setError("Failed to create salon: " + salonError.message); setLoading(false); return; }
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push("/dashboard"), 500);
    }
  };

  if (success) {
    return (
      <main style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "48px", textAlign: "center" }}>
          <div style={{ fontSize: "48px" }}>🎉</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#0F172A" }}>Welcome to Feature!</h2>
          <p style={{ color: "#64748B" }}>Account created! Redirecting to dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "16px", padding: "48px", width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: "28px", color: "#0F172A", textDecoration: "none" }}>feature</Link>
          <p style={{ fontSize: "14px", color: "#64748B", marginTop: "8px" }}>Start your free 14-day trial</p>
        </div>
        <div style={{ background: "#EEF2FF", border: "0.5px solid #C7D2FE", borderRadius: "8px", padding: "10px 16px", marginBottom: "24px", textAlign: "center", fontSize: "13px", color: "#4F6EF7" }}>
          ✓ No credit card required
        </div>
        {error && <div style={{ background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#EF4444" }}>{error}</div>}
        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Salon name</label>
            <input type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)} placeholder="The Cut Studio" required style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@thecutstudio.co.uk" required style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "6px" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} style={{ width: "100%", padding: "10px 14px", border: "0.5px solid #E8EAF0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: loading ? "#94A3B8" : "#4F6EF7", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
            {loading ? "Creating account..." : "Create free account"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "#94A3B8" }}>
          Already have an account?{" "}<Link href="/login" style={{ color: "#4F6EF7", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </div>
      </div>
    </main>
  );
}