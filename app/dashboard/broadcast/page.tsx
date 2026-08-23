"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";

interface BroadcastMsg {
  id: string;
  title: string;
  message: string;
  channel: "whatsapp" | "sms" | "email";
  recipient_count: number;
  status: string;
  created_at: string;
}

function getTemplates(bt?: string) {
  const bookWord = ["gym","yoga","pt"].includes(bt ?? "") ? "session"
    : ["dental","physio"].includes(bt ?? "") ? "appointment"
    : "appointment";
  const visitWord = ["gym","yoga","pt"].includes(bt ?? "") ? "session"
    : ["spa","massage"].includes(bt ?? "") ? "treatment"
    : "visit";
  return [
    { label: "🎉 Special Offer",       message: `Hi {name}! 🌟 We have a special offer just for you at {salon}. Book this week and get 20% off. Book now: {link}` },
    { label: "🎂 Birthday Wish",       message: `Happy Birthday {name}! 🎂 As our valued client, enjoy a FREE birthday ${visitWord} this month at {salon}. Get in touch to book!` },
    { label: "📅 Booking Reminder",    message: `Hi {name}, just a reminder that {salon} is open and ready for you. Book your next ${bookWord}: {link}` },
    { label: "⭐ Review Request",      message: `Hi {name}! Thank you for visiting {salon}. We'd love to hear your feedback. Please leave us a review: {link}` },
    { label: "🎁 Loyalty Reward",      message: `Hi {name}! 🎁 You've earned enough loyalty points for a free reward at {salon}. Come in and claim it today!` },
  ];
}

function BroadcastContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [salonSlug, setSalonSlug] = useState("");
  const [history, setHistory] = useState<BroadcastMsg[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", channel: "whatsapp" as "whatsapp"|"sms"|"email", filter: "all" as "all"|"vip"|"new"|"inactive" });
  const [sending, setSending] = useState(false);
  const [businessType, setBusinessType] = useState<string | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      setSalonSlug(profile.salon.slug || "");
      setBusinessType(profile.salon.business_type ?? undefined);

      const { data: hist } = await supabase
        .from("broadcast_messages").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false });
      setHistory(hist || []);

      // Recipient count is server-derived (clients table, opted-in, has email) —
      // this fetch is read-only and purely for display; the send path re-derives
      // it itself and does not depend on this value.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          const res = await fetch("/api/broadcast/send", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const json = await res.json();
          if (res.ok) setRecipientCount(json.recipientCount ?? 0);
        } catch {
          // count is display-only — a failed fetch just leaves it at 0
        }
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const applyTemplate = (t: ReturnType<typeof getTemplates>[0]) => {
    const msg = t.message
      .replace(/{salon}/g, salonName)
      .replace(/{link}/g, `${typeof window !== "undefined" ? window.location.origin : ""}/book/${salonSlug}`);
    setForm(f => ({ ...f, message: msg, title: t.label.replace(/[^\w\s]/g, "").trim() }));
  };

  const handleSend = async () => {
    if (!salonId || !form.message || !form.title) { toast.error("Title and message required"); return; }
    if (!confirm(`Send to ${recipientCount} clients via ${form.channel.toUpperCase()}?`)) return;
    setSending(true);

    // 1. Log the broadcast first (status = "sending")
    const { data: broadcastRow, error: logErr } = await supabase
      .from("broadcast_messages")
      .insert({
        salon_id: salonId, title: form.title, message: form.message,
        channel: form.channel, recipient_count: recipientCount, status: "sending",
      })
      .select().single();

    if (logErr) { toast.error("Failed to log broadcast"); setSending(false); return; }

    // 2. Actually send via API
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/broadcast/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          broadcastId: broadcastRow?.id,
          channel: form.channel,
          title: form.title,
          message: form.message,
          filter: form.filter,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");

      const successCount = json.sent ?? 0;
      const errCount = json.errors?.length ?? 0;
      setHistory(p => [{ ...broadcastRow, status: "sent", recipient_count: successCount }, ...p]);

      if (errCount > 0) {
        toast.error(`Sent to ${successCount}, failed for ${errCount} clients`);
      } else {
        toast.success(`✅ Sent to ${successCount} clients!`);
      }
      setForm({ title: "", message: "", channel: "whatsapp", filter: "all" });
    } catch (e) {
      toast.error(`Send failed: ${e}`);
    }
    setSending(false);
  };

  const channelIcon = { whatsapp: "📱", sms: "💬", email: "📧" };
  const channelColor = { whatsapp: "#25D366", sms: "#C9A24B", email: "#F59E0B" };

  const Topbar = (
    <header style={{ background: "#1C2438", borderBottom: "1px solid #2a3350", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF" }}>📢 Broadcast Messages</div>
          <div style={{ fontSize: 11.5, color: "#aab1c4", marginTop: 1 }}>Send bulk messages to all clients</div>
        </div>
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#aab1c4" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>

        {/* Compose */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#F7F5EF", marginBottom: 20 }}>✍️ Compose Message</div>

            {/* Channel selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#aab1c4", display: "block", marginBottom: 8 }}>Channel</label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["whatsapp", "sms", "email"] as const).map(ch => (
                  <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                    style={{ flex: 1, padding: "10px 4px", borderRadius: 12, border: `2px solid ${form.channel === ch ? channelColor[ch] : "#2a3350"}`, background: form.channel === ch ? `${channelColor[ch]}12` : "#1C2438", cursor: "pointer", transition: "all 0.12s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 22 }}>{channelIcon[ch]}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: form.channel === ch ? channelColor[ch] : "#aab1c4", textTransform: "capitalize" }}>{ch}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#141A2E", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F7F5EF" }}>Recipients</div>
                <div style={{ fontSize: 11.5, color: "#aab1c4" }}>All {recipientCount} clients</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#C9A24B" }}>{recipientCount}</div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#aab1c4", display: "block", marginBottom: 6 }}>Campaign Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Summer Discount Campaign"
                style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#aab1c4" }}>Message *</label>
                <span style={{ fontSize: 11, color: "#aab1c4" }}>{form.message.length} chars</span>
              </div>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Type your message… Use {name} for client name, {salon} for salon name" rows={5}
                style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #2a3350", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
              <div style={{ fontSize: 11, color: "#aab1c4", marginTop: 4 }}>Variables: {"{"}<b>name</b>{"}"}, {"{"}<b>salon</b>{"}"}, {"{"}<b>link</b>{"}"}</div>
            </div>

            {/* Preview */}
            {form.message && (
              <div style={{ marginBottom: 16, padding: "14px 16px", background: "#141A2E", borderRadius: 12, border: "1.5px solid #2a3350" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#aab1c4", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview (for &quot;Sarah&quot;)</div>
                <div style={{ fontSize: 13.5, color: "#aab1c4", lineHeight: 1.7 }}>
                  {form.message.replace(/{name}/g, "Sarah").replace(/{salon}/g, salonName).replace(/{link}/g, "featuresalon.com/book")}
                </div>
              </div>
            )}

            <button onClick={handleSend} disabled={sending || !form.message || !form.title}
              style={{ width: "100%", padding: "13px", background: `linear-gradient(135deg,${channelColor[form.channel]},${channelColor[form.channel]}cc)`, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", opacity: !form.message || !form.title ? 0.5 : 1, boxShadow: `0 4px 14px ${channelColor[form.channel]}40`, transition: "all 0.15s" }}>
              {sending ? "Sending…" : `${channelIcon[form.channel]} Send to ${recipientCount} clients`}
            </button>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Templates */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, padding: "20px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#F7F5EF", marginBottom: 14 }}>⚡ Quick Templates</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {getTemplates(businessType).map((t: ReturnType<typeof getTemplates>[0], i: number) => (
                <button key={i} onClick={() => applyTemplate(t)}
                  style={{ padding: "10px 14px", background: "#141A2E", border: "1.5px solid #2a3350", borderRadius: 12, textAlign: "left", fontSize: 13, fontWeight: 600, color: "#aab1c4", cursor: "pointer", transition: "all 0.12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,75,0.10)"; e.currentTarget.style.borderColor = "rgba(201,162,75,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#141A2E"; e.currentTarget.style.borderColor = "#2a3350"; }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          <div style={{ background: "#1C2438", border: "1.5px solid #2a3350", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3350", fontSize: 14, fontWeight: 800, color: "#F7F5EF" }}>📋 Sent History</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#aab1c4", fontSize: 13 }}>No broadcasts sent yet</div>
              ) : history.map(h => (
                <div key={h.id} style={{ padding: "14px 18px", borderBottom: "1px solid #2a3350" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F7F5EF" }}>{h.title}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${channelColor[h.channel as keyof typeof channelColor]}18`, color: channelColor[h.channel as keyof typeof channelColor] }}>
                      {channelIcon[h.channel as keyof typeof channelIcon]} {h.channel}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#aab1c4", marginBottom: 4 }}>{h.recipient_count} recipients</div>
                  <div style={{ fontSize: 11, color: "#aab1c4" }}>{new Date(h.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function BroadcastPage() {
  return (
    <FeatureGate feature="analytics_basic">
      <BroadcastContent />
    </FeatureGate>
  );
}
