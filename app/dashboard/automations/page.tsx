"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Automation {
  id?: string;
  type: string;
  is_active: boolean;
  channel: string;
  message: string;
  days_before: number;
  reward: string;
}

const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    type: "birthday",
    is_active: false,
    channel: "whatsapp",
    message: "🎂 Happy Birthday {name}! As our special client, enjoy a FREE birthday treat at {salon} this month. Call us to book! 🎉",
    days_before: 1,
    reward: "Free treatment",
  },
  {
    type: "winback",
    is_active: false,
    channel: "whatsapp",
    message: "Hi {name}! 💕 We miss you at {salon}! It's been a while since your last visit. Come back and enjoy 15% off your next appointment. Book now!",
    days_before: 60,
    reward: "15% discount",
  },
  {
    type: "anniversary",
    is_active: false,
    channel: "whatsapp",
    message: "🎉 Happy 1-year anniversary with {salon}, {name}! Thank you for being a loyal client. Enjoy a special gift on us — ask us when you visit!",
    days_before: 0,
    reward: "Anniversary gift",
  },
  {
    type: "referral",
    is_active: false,
    channel: "whatsapp",
    message: "Hi {name}! 🌟 Love {salon}? Share with a friend and both of you get £10 off your next visit! Just ask them to mention your name when booking.",
    days_before: 0,
    reward: "£10 for both",
  },
];

const TYPE_META: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  birthday:    { icon: "🎂", label: "Birthday Message",     desc: "Auto-send on client's birthday",           color: "#EC4899" },
  winback:     { icon: "💔", label: "Win-Back Campaign",    desc: "Re-engage clients who haven't visited",    color: "#F59E0B" },
  anniversary: { icon: "🎉", label: "Loyalty Anniversary",  desc: "Celebrate 1 year with your salon",         color: "#7C3AED" },
  referral:    { icon: "🔗", label: "Referral Prompt",      desc: "Encourage clients to refer friends",       color: "#047857" },
};

export default function AutomationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [automations, setAutomations] = useState<Automation[]>(DEFAULT_AUTOMATIONS);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      const { data } = await supabase.from("automations").select("*").eq("salon_id", profile.salon.id);
      if (data && data.length > 0) {
        // Merge saved with defaults
        const merged = DEFAULT_AUTOMATIONS.map(def => {
          const saved = data.find(d => d.type === def.type);
          return saved ? { ...def, ...saved } : def;
        });
        setAutomations(merged);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const save = async (automation: Automation) => {
    if (!salonId) return;
    const { error } = await supabase.from("automations").upsert({
      salon_id: salonId, type: automation.type, is_active: automation.is_active,
      channel: automation.channel, message: automation.message,
      days_before: automation.days_before, reward: automation.reward,
    }, { onConflict: "salon_id,type" });
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Automation saved!");
    setEditing(null);
  };

  const toggleActive = async (type: string, current: boolean) => {
    setAutomations(p => p.map(a => a.type === type ? { ...a, is_active: !current } : a));
    if (salonId) {
      await supabase.from("automations").upsert({
        salon_id: salonId, type, is_active: !current,
        message: automations.find(a => a.type === type)?.message || "",
      }, { onConflict: "salon_id,type" });
      toast.success(current ? "Automation paused" : "Automation activated!");
    }
  };

  const update = (type: string, field: string, value: string | number | boolean) => {
    setAutomations(p => p.map(a => a.type === type ? { ...a, [field]: value } : a));
  };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Automations</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Birthday, Win-back & Referral messages</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#047857" }}>✓ {automations.filter(a => a.is_active).length} Active</span>
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>

        {/* Info banner */}
        <div style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.10),rgba(124,58,237,0.04))", border: "1px solid #ECE9F1", borderRadius: 16, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 28 }}>🤖</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#12101A" }}>Automated Messages</div>
            <div style={{ fontSize: 13, color: "#524D60", marginTop: 2, lineHeight: 1.5 }}>
              Set up once, send automatically. Use <strong>{"{name}"}</strong>, <strong>{"{salon}"}</strong>, <strong>{"{link}"}</strong> as variables. Messages are sent via your chosen channel.
            </div>
          </div>
        </div>

        {/* Automation cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {automations.map(auto => {
            const meta = TYPE_META[auto.type];
            const isEditing = editing === auto.type;
            return (
              <div key={auto.type} style={{ background: "#FFFFFF", border: `1.5px solid ${auto.is_active ? meta.color + "40" : "#ECE9F1"}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", transition: "all 0.2s" }}>
                <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{meta.icon}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>{meta.label}</div>
                      <div style={{ fontSize: 12.5, color: "#524D60", marginTop: 2 }}>{meta.desc}</div>
                      {auto.reward && <div style={{ fontSize: 11.5, fontWeight: 700, color: meta.color, marginTop: 4 }}>Reward: {auto.reward}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {auto.is_active && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: `${meta.color}18`, color: meta.color }}>● ACTIVE</span>}
                    <label style={{ position: "relative", width: 44, height: 24, cursor: "pointer", flexShrink: 0 }}>
                      <input type="checkbox" checked={auto.is_active} onChange={() => toggleActive(auto.type, auto.is_active)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: auto.is_active ? meta.color : "#524D60", borderRadius: 99, transition: "background 0.18s" }}>
                        <span style={{ position: "absolute", width: 16, height: 16, left: auto.is_active ? 24 : 4, top: 4, background: "#FFFFFF", borderRadius: "50%", transition: "left 0.18s", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
                      </span>
                    </label>
                    <button onClick={() => setEditing(isEditing ? null : auto.type)} style={{ padding: "7px 14px", background: isEditing ? "rgba(124,58,237,0.10)" : "#F5F3FF", border: `1.5px solid ${isEditing ? "rgba(124,58,237,0.25)" : "#ECE9F1"}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: isEditing ? "#7C3AED" : "#524D60", cursor: "pointer" }}>
                      {isEditing ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div style={{ borderTop: "1px solid #ECE9F1", padding: "20px 24px", background: "#F5F3FF" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Channel</label>
                          <select value={auto.channel} onChange={e => update(auto.type, "channel", e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="sms">SMS</option>
                            <option value="email">Email</option>
                          </select>
                        </div>
                        {auto.type === "winback" && (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Trigger after (days inactive)</label>
                            <input type="number" value={auto.days_before} onChange={e => update(auto.type, "days_before", parseInt(e.target.value))}
                              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Reward (optional)</label>
                          <input value={auto.reward} onChange={e => update(auto.type, "reward", e.target.value)} placeholder="e.g. 10% off"
                            style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Message</label>
                        <textarea value={auto.message} onChange={e => update(auto.type, "message", e.target.value)} rows={3}
                          style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
                        <div style={{ fontSize: 11, color: "#524D60", marginTop: 4 }}>Variables: {"{name}"}, {"{salon}"}, {"{link}"}</div>
                      </div>
                    </div>
                    <button onClick={() => save(auto)} style={{ marginTop: 14, padding: "10px 24px", background: `linear-gradient(135deg,${meta.color},${meta.color}cc)`, border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px ${meta.color}40` }}>Save Automation</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
