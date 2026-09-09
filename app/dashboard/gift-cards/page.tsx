"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";

interface DiscountCode {
  id: string;
  salon_id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface GiftCard {
  id: string;
  salon_id: string;
  code: string;
  amount: number;
  remaining: number;
  recipient_name: string;
  recipient_email: string;
  is_redeemed: boolean;
  created_at: string;
}

function genCode(prefix = "GIFT") {
  return prefix + "-" + Math.random().toString(36).toUpperCase().slice(2, 8);
}

function GiftCardsContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [tab, setTab] = useState<"discount" | "gift">("discount");
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [gifts, setGifts] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [codeForm, setCodeForm] = useState({ code: genCode("DEAL"), type: "percentage", value: "", max_uses: "", expires_at: "" });
  const [giftForm, setGiftForm] = useState({ recipient_name: "", recipient_email: "", amount: "" });

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const [{ data: dc }, { data: gc }] = await Promise.all([
        supabase.from("discount_codes").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false }),
        supabase.from("gift_cards").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false }),
      ]);
      setCodes(dc || []);
      setGifts(gc || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleAddCode = async () => {
    if (!salonId || !codeForm.value) { toast.error("Fill all fields"); return; }
    const { data, error } = await supabase.from("discount_codes").insert({
      salon_id: salonId, code: codeForm.code.toUpperCase(),
      type: codeForm.type, value: parseFloat(codeForm.value),
      max_uses: codeForm.max_uses ? parseInt(codeForm.max_uses) : null,
      expires_at: codeForm.expires_at || null, uses: 0, is_active: true,
    }).select().single();
    if (error) { toast.error("Code already exists or error"); return; }
    setCodes(p => [data, ...p]);
    toast.success("Discount code created!");
    setShowCodeModal(false);
    setCodeForm({ code: genCode("DEAL"), type: "percentage", value: "", max_uses: "", expires_at: "" });
  };

  const handleAddGift = async () => {
    if (!salonId || !giftForm.amount || !giftForm.recipient_name) { toast.error("Fill all fields"); return; }
    const code = genCode("GIFT");
    const { data, error } = await supabase.from("gift_cards").insert({
      salon_id: salonId, code, amount: parseFloat(giftForm.amount),
      remaining: parseFloat(giftForm.amount),
      recipient_name: giftForm.recipient_name,
      recipient_email: giftForm.recipient_email,
      is_redeemed: false,
    }).select().single();
    if (error) { toast.error("Failed to create gift card"); return; }
    setGifts(p => [data, ...p]);
    toast.success("Gift card created!");
    setShowGiftModal(false);
    setGiftForm({ recipient_name: "", recipient_email: "", amount: "" });
  };

  const toggleCode = async (id: string, current: boolean) => {
    await supabase.from("discount_codes").update({ is_active: !current }).eq("id", id);
    setCodes(p => p.map(c => c.id === id ? { ...c, is_active: !current } : c));
    toast.success(current ? "Code deactivated" : "Code activated");
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this code?")) return;
    await supabase.from("discount_codes").delete().eq("id", id);
    setCodes(p => p.filter(c => c.id !== id));
    toast.success("Code deleted");
  };

  const deleteGift = async (id: string) => {
    if (!confirm("Delete this gift card?")) return;
    await supabase.from("gift_cards").delete().eq("id", id);
    setGifts(p => p.filter(g => g.id !== id));
    toast.success("Gift card deleted");
  };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Gift Cards & Discount Codes</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Boost revenue with promotions</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setShowCodeModal(true)} style={{ padding: "9px 16px", background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "1px solid #ECE9F1", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Discount Code</button>
        <button onClick={() => setShowGiftModal(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>+ Gift Card</button>
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;


  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Active Codes", value: codes.filter(c => c.is_active).length, icon: "🏷️", color: "#7C3AED" },
            { label: "Total Uses", value: codes.reduce((s, c) => s + c.uses, 0), icon: "📊", color: "#047857" },
            { label: "Gift Cards", value: gifts.length, icon: "🎁", color: "#F59E0B" },
            { label: "Gift Value", value: `£${gifts.reduce((s, g) => s + g.remaining, 0)}`, icon: "💰", color: "#EC4899" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</span>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ background: "#ECE9F1", borderRadius: 12, padding: 4, display: "inline-flex", gap: 2, marginBottom: 20 }}>
          {(["discount", "gift"] as const).map(id => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: tab === id ? "#fff" : "transparent", color: tab === id ? "#7C3AED" : "#524D60", fontWeight: tab === id ? 800 : 500, fontSize: 13, cursor: "pointer", boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.12s" }}>
              {id === "discount" ? `Discount Codes (${codes.length})` : `Gift Cards (${gifts.length})`}
            </button>
          ))}
        </div>

        {/* Discount Codes */}
        {tab === "discount" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {codes.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div><div style={{ fontWeight: 700 }}>No discount codes yet</div></div>}
            {codes.map(code => {
              const expired = code.expires_at && new Date(code.expires_at) < new Date();
              const exhausted = code.max_uses && code.uses >= code.max_uses;
              return (
                <div key={code.id} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, opacity: code.is_active && !expired && !exhausted ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ background: "rgba(124,58,237,0.10)", border: "2px dashed rgba(124,58,237,0.25)", borderRadius: 10, padding: "8px 16px", fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: "#7C3AED", letterSpacing: 2 }}>{code.code}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#12101A" }}>{code.type === "percentage" ? `${code.value}% off` : `£${code.value} off`}</div>
                      <div style={{ fontSize: 12, color: "#524D60", marginTop: 2 }}>
                        {code.uses} uses{code.max_uses ? ` / ${code.max_uses} max` : ""} · {expired ? "⚠️ Expired" : code.expires_at ? `Expires ${new Date(code.expires_at).toLocaleDateString("en-GB")}` : "No expiry"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => { navigator.clipboard.writeText(code.code); toast.success("Code copied!"); }} style={{ padding: "6px 12px", background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#524D60" }}>Copy</button>
                    <label style={{ position: "relative", width: 32, height: 18, cursor: "pointer" }}>
                      <input type="checkbox" checked={code.is_active} onChange={() => toggleCode(code.id, code.is_active)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: code.is_active ? "#10B981" : "#524D60", borderRadius: 99, transition: "background 0.18s" }}>
                        <span style={{ position: "absolute", width: 12, height: 12, left: code.is_active ? 17 : 3, top: 3, background: "#FFFFFF", borderRadius: "50%", transition: "left 0.18s" }} />
                      </span>
                    </label>
                    <button onClick={() => deleteCode(code.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#524D60" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }} onMouseLeave={e => { e.currentTarget.style.color = "#524D60"; }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Gift Cards */}
        {tab === "gift" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {gifts.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60", gridColumn: "1/-1" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎁</div><div style={{ fontWeight: 700 }}>No gift cards yet</div></div>}
            {gifts.map(g => (
              <div key={g.id} style={{ background: "linear-gradient(135deg,#5B21B6,#7C3AED)", borderRadius: 20, padding: "24px 22px", color: "#fff", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <div style={{ position: "absolute", bottom: -30, left: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Gift Card</div>
                    <span style={{ fontSize: 22 }}>🎁</span>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900, letterSpacing: 3, marginBottom: 16, color: "rgba(255,255,255,0.9)" }}>{g.code}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>For {g.recipient_name}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-1px" }}>£{g.remaining} <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>/ £{g.amount}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { navigator.clipboard.writeText(g.code); toast.success("Gift code copied!"); }} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff" }}>Copy</button>
                      <button onClick={() => deleteGift(g.id)} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                    </div>
                  </div>
                  {g.is_redeemed && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.2)", padding: "4px 10px", borderRadius: 99, display: "inline-block" }}>✅ Redeemed</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discount Code Modal */}
      {showCodeModal && (
        <div onClick={() => setShowCodeModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>New Discount Code</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={codeForm.code} onChange={e => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })} style={{ flex: 1, padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, fontFamily: "monospace", fontWeight: 700, outline: "none" }} />
                  <button onClick={() => setCodeForm({ ...codeForm, code: genCode("DEAL") })} style={{ padding: "10px 14px", background: "#ECE9F1", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#524D60", whiteSpace: "nowrap" }}>Random</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Type</label>
                  <select value={codeForm.type} onChange={e => setCodeForm({ ...codeForm, type: e.target.value as "percentage" | "fixed" })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (£)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Value *</label>
                  <input type="number" value={codeForm.value} onChange={e => setCodeForm({ ...codeForm, value: e.target.value })} placeholder={codeForm.type === "percentage" ? "e.g. 20" : "e.g. 10"} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Max Uses (optional)</label>
                  <input type="number" value={codeForm.max_uses} onChange={e => setCodeForm({ ...codeForm, max_uses: e.target.value })} placeholder="Unlimited" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Expires (optional)</label>
                  <input type="date" value={codeForm.expires_at} onChange={e => setCodeForm({ ...codeForm, expires_at: e.target.value })} style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCodeModal(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddCode} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>Create Code</button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Card Modal */}
      {showGiftModal && (
        <div onClick={() => setShowGiftModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>New Gift Card</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Recipient Name *</label>
                <input value={giftForm.recipient_name} onChange={e => setGiftForm({ ...giftForm, recipient_name: e.target.value })} placeholder="Sarah Johnson" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Email (optional)</label>
                <input type="email" value={giftForm.recipient_email} onChange={e => setGiftForm({ ...giftForm, recipient_email: e.target.value })} placeholder="sarah@email.com" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Amount (£) *</label>
                <input type="number" value={giftForm.amount} onChange={e => setGiftForm({ ...giftForm, amount: e.target.value })} placeholder="e.g. 50" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowGiftModal(false)} style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddGift} style={{ flex: 2, padding: 12, background: "linear-gradient(135deg,#10B981,#059669)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>Create Gift Card</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
export default function GiftCardsPage() {
  return (
    <FeatureGate feature="gift_cards">
      <GiftCardsContent />
    </FeatureGate>
  );
}
