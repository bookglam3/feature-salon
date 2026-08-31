"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Balance { amount: number; currency: string; }
interface Payout {
  id: string; amount: number; currency: string;
  status: string; arrival_date: number; created: number; description: string | null;
}
interface ConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarded_at?: string;
  balance?: { available: Balance[]; pending: Balance[] };
  payouts?: Payout[];
}

const STATUS_COLORS: Record<string, string> = {
  paid: "#10B981",
  in_transit: "#F59E0B",
  pending: "#7C3AED",
  failed: "#EF4444",
  canceled: "#9A94A8",
};

function fmt(amount: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function EarningsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [salonName, setSalonName] = useState("");
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [dashLinking, setDashLinking] = useState(false);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, []);

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) { router.push("/login"); return; }
    const res = await fetch("/api/stripe-connect/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }, [getToken, router]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: salon } = await supabase.from("salons").select("name").eq("owner_id", user.id).single();
      setSalonName(salon?.name || "");
      await loadStatus();
    };
    init();
  }, [router, loadStatus]);

  // Show toast on redirect from onboarding
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast.success("Stripe account connected! 🎉");
      loadStatus();
    } else if (searchParams.get("error")) {
      toast.error("Connection issue — please try again.");
    }
  }, [searchParams, toast, loadStatus]);

  const [connectError, setConnectError] = useState("");

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      const token = await getToken();
      if (!token) { setConnectError("Not logged in — please refresh and try again."); setConnecting(false); return; }

      const res = await fetch("/api/stripe-connect/create-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (json.url) {
        window.location.href = json.url;
      } else {
        const errMsg = json.error || `Error ${res.status} — please try again`;
        setConnectError(errMsg);
        toast.error(errMsg);
        setConnecting(false);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error — please try again";
      setConnectError(errMsg);
      toast.error(errMsg);
      setConnecting(false);
    }
  };

  const handleStripeDashboard = async () => {
    setDashLinking(true);
    const token = await getToken();
    const res = await fetch("/api/stripe-connect/dashboard-link", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
    else toast.error("Could not open Stripe Dashboard");
    setDashLinking(false);
  };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => { }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>Earnings & Payouts</div>
          <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 1 }}>Stripe Connect — salon payout management</div>
        </div>
      </div>
      {status?.connected && (
        <button onClick={handleStripeDashboard} disabled={dashLinking}
          style={{ padding: "8px 16px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#7C3AED", cursor: "pointer" }}>
          {dashLinking ? "Opening…" : "↗ Stripe Dashboard"}
        </button>
      )}
    </header>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ textAlign: "center", color: "#6B6577" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading earnings…</div>
        </div>
      </div>
    </DashboardShell>
  );

  const available = status?.balance?.available?.[0]?.amount ?? 0;
  const pending = status?.balance?.pending?.[0]?.amount ?? 0;
  const currency = status?.balance?.available?.[0]?.currency || "gbp";

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Not Connected State ── */}
        {!status?.connected && (
          <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 24, padding: "60px 40px", textAlign: "center", maxWidth: 560, margin: "60px auto" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🏦</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.5px" }}>Connect Your Stripe Account</h2>
            <p style={{ fontSize: 14, color: "#6B6577", lineHeight: 1.7, margin: "0 0 32px" }}>
              Receive automatic payouts directly to your bank account for every booking. Automatic payouts with a low <strong style={{ color: "#7C3AED" }}>2% platform fee</strong>.
            </p>
            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32, textAlign: "left" }}>
              {[
                { icon: "⚡", text: "Automatic payouts — no manual transfers" },
                { icon: "📊", text: "Full payout history & balance tracking" },
                { icon: "🔒", text: "Powered by Stripe — bank-level security" },
                { icon: "🌍", text: "UK, EU, and international bank accounts" },
              ].map(f => (
                <div key={f.text} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#F5F3FF", borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, color: "#12101A", fontWeight: 500 }}>{f.text}</span>
                </div>
              ))}
            </div>
            <button onClick={handleConnect} disabled={connecting}
              style={{ width: "100%", padding: "16px", background: connecting ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, color: "#fff", cursor: connecting ? "not-allowed" : "pointer", boxShadow: "0 8px 30px rgba(124,58,237,0.4)", letterSpacing: "-0.2px" }}>
              {connecting ? "Redirecting to Stripe…" : "Connect Stripe Account"}
            </button>
            {connectError && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, fontSize: 12.5, color: "#DC2626", fontWeight: 600 }}>
                ❌ {connectError}
              </div>
            )}
            <p style={{ fontSize: 11.5, color: "#9A94A8", marginTop: 12 }}>
              Secure onboarding via Stripe Express. Takes ~2 minutes.
            </p>
          </div>
        )}

        {/* ── Connected State ── */}
        {status?.connected && (
          <>
            {/* Status banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: status.charges_enabled ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${status.charges_enabled ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`, borderRadius: 14, marginBottom: 24 }}>
              <span style={{ fontSize: 22 }}>{status.charges_enabled ? "✅" : "⏳"}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: status.charges_enabled ? "#059669" : "#B45309" }}>
                  {status.charges_enabled ? "Stripe Account Active — Payouts Enabled" : "Onboarding Incomplete — Complete verification in Stripe"}
                </div>
                {status.onboarded_at && (
                  <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 2 }}>
                    Connected {new Date(status.onboarded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
              </div>
              {!status.charges_enabled && (
                <button onClick={handleConnect} style={{ marginLeft: "auto", padding: "8px 16px", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#B45309", cursor: "pointer" }}>
                  Complete Setup →
                </button>
              )}
            </div>

            {/* Balance cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Available Balance", value: fmt(available, currency), icon: "💵", color: "#059669", desc: "Ready to pay out to your bank" },
                { label: "Pending Balance", value: fmt(pending, currency), icon: "⏳", color: "#F59E0B", desc: "Processing — arrives in 2-7 days" },
                { label: "Platform Fee", value: "2%", icon: "🏷️", color: "#7C3AED", desc: "Kept per transaction" },
              ].map(s => (
                <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 20, padding: "22px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: s.color }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6B6577", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</span>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: "-1px", marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: "#9A94A8" }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div style={{ background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 16, padding: "18px 22px", marginBottom: 24, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#7C3AED", minWidth: 120 }}>How it works</div>
              {[
                { from: "Client pays £100", to: "Platform fee: £2", via: "→" },
                { from: "Remaining balance", to: "Auto to your bank", via: "→" },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6B6577" }}>
                  <span style={{ color: "#6B6577", fontWeight: 700 }}>{step.from}</span>
                  <span style={{ color: "#7C3AED", fontWeight: 800 }}>{step.via}</span>
                  <span style={{ color: "#059669", fontWeight: 700 }}>{step.to}</span>
                </div>
              ))}
            </div>

            {/* Payout history */}
            <div style={{ background: "#FFFFFF", border: "1px solid #ECE9F1", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(124,58,237,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Payout History</div>
                <button onClick={handleStripeDashboard} disabled={dashLinking}
                  style={{ padding: "7px 14px", background: "rgba(124,58,237,0.15)", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#7C3AED", cursor: "pointer" }}>
                  {dashLinking ? "…" : "View All in Stripe ↗"}
                </button>
              </div>

              {(!status.payouts || status.payouts.length === 0) ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#9A94A8" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No payouts yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Payouts appear here after your first booking payment</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: "#F5F3FF" }}>
                        {["Amount", "Status", "Arrival Date", "Created", "Description"].map(h => (
                          <th key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9A94A8", textAlign: "left", padding: "10px 16px", letterSpacing: "0.8px", textTransform: "uppercase", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {status.payouts.map(p => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #F5F3FF", transition: "background 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                          <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 900, color: "#059669" }}>{fmt(p.amount, p.currency)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 99, background: `${STATUS_COLORS[p.status] || "#9A94A8"}20`, color: STATUS_COLORS[p.status] || "#9A94A8", textTransform: "capitalize" }}>
                              {p.status === "in_transit" ? "In Transit" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B6577" }}>{fmtDate(p.arrival_date)}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B6577" }}>{fmtDate(p.created)}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#6B6577" }}>{p.description || "Automatic payout"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
