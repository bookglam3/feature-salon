"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { withMeridiem } from "@/app/lib/formatTime";

const ADMIN_EMAIL = "adilgill2008@gmail.com";
const TEMPLATE_STORE_KEY = "fs_broadcast_templates_v1";

const T = {
  bg: "#F6F8FC", surface: "#FFFFFF", nav: "#0A0F1C",
  navBorder: "rgba(255,255,255,0.07)", navText: "rgba(255,255,255,0.45)", navActive: "#FFFFFF",
  border: "#E2E8F0", text: "#0F172A", text2: "#64748B", text3: "#64748B",
  indigo: "#6366F1", indigoSoft: "#EEF2FF",
  green: "#10B981", greenSoft: "#ECFDF5",
  amber: "#F59E0B", amberSoft: "#FFFBEB",
  red: "#EF4444", redSoft: "#FEF2F2",
  shadow: "0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)",
};

type Channel    = "email" | "whatsapp" | "sms";
type CountryCode = "GB" | "PK" | "AE" | "SA";
type SendStatus  = "idle" | "sending" | "success" | "partial" | "failed" | "skipped";

interface Template {
  id: string; name: string; subject: string; body: string; builtIn?: boolean;
}
interface CountryConfig {
  code: CountryCode; flag: string; label: string;
  recipients: string; channels: Record<Channel, boolean>; enabled: boolean;
}
interface CountryResult {
  code: CountryCode; status: SendStatus; sent: number; failed: number; error?: string;
}
interface BroadcastLog {
  id: string; subject: string; channels: Channel[]; countries: string[];
  recipient_type: string; total_sent: number; total_failed: number; sent_at: string; status: string;
}

// ── Built-in templates ────────────────────────────────────────────────────────
const BUILT_IN: Template[] = [
  {
    id: "bi-sms", name: "We Miss You (WhatsApp/SMS)", subject: "We Miss You!", builtIn: true,
    body: "Hi {name}! 💕\nWe miss you at Anita Love Hair! 🌸\nAs a valued client, we'd love to welcome you back with an exclusive 20% OFF your next visit! \n📍 Book your appointment here:\nhttps://www.fresha.com/a/anita-love-hair-tunbridge-wells-119-camden-road-c8tlr8ew/booking?menu=true&pId=30502&cartId=8e4b384c-4e30-47a7-ae21-cb31b19e30e4\nUse code: WELCOME20 at checkout 💛\nSee you soon! \nAnita Love Hair Team 💇‍♀️",
  },
  {
    id: "bi-email", name: "We Miss You (Email)", subject: "We Miss You! Here's 20% OFF Just for You 💕", builtIn: true,
    body: "Hi {name},\n\nIt's been a while and we'd love to see you again at Anita Love Hair!\n\nAs a thank you for being such a valued client, we're offering you an exclusive 20% OFF your next appointment.\n\n✂️ Book Now & Save 20%:\nhttps://www.fresha.com/a/anita-love-hair-tunbridge-wells-119-camden-road-c8tlr8ew/booking?menu=true&pId=30502&cartId=8e4b384c-4e30-47a7-ae21-cb31b19e30e4\n\nWe can't wait to make you look and feel amazing again! 🌸\n\nWith love,\nAnita Love Hair Team 💇‍♀️",
  },
];

const COUNTRY_DEFS: Pick<CountryConfig, "code" | "flag" | "label">[] = [
  { code: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { code: "PK", flag: "🇵🇰", label: "Pakistan" },
  { code: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "SA", flag: "🇸🇦", label: "Saudi Arabia" },
];

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "▣", href: "/admin" },
  { key: "salons", label: "Salons", icon: "✂", href: "/admin" },
  { key: "revenue", label: "Revenue", icon: "₤", href: "/admin" },
  { key: "users", label: "Users", icon: "⊙", href: "/admin" },
  { key: "applications", label: "Applications", icon: "✦", href: "/admin" },
  { key: "verifications", label: "Verifications", icon: "🪪", href: "/admin" },
  { key: "announcements", label: "Announcements", icon: "◉", href: "/admin" },
  { key: "broadcast", label: "Broadcast", icon: "📣", href: "/admin/broadcast" },
  { key: "flags", label: "Feature Flags", icon: "⚑", href: "/admin" },
  { key: "settings", label: "Settings", icon: "◎", href: "/admin" },
];

const STATUS_META: Record<SendStatus, { bg: string; color: string; label: string; icon: string }> = {
  idle:    { bg: T.bg,         color: T.text3,  label: "Not sent",  icon: "○" },
  sending: { bg: T.indigoSoft, color: T.indigo, label: "Sending…",  icon: "●" },
  success: { bg: T.greenSoft,  color: T.green,  label: "Sent",      icon: "✓" },
  partial: { bg: T.amberSoft,  color: T.amber,  label: "Partial",   icon: "!" },
  failed:  { bg: T.redSoft,    color: T.red,    label: "Failed",    icon: "✗" },
  skipped: { bg: T.bg,         color: T.text3,  label: "Skipped",   icon: "—" },
};

const MSG_VARS = [
  { tag: "{name}",       sample: "Sarah",      desc: "Recipient name" },
  { tag: "{salon_name}", sample: "Glow Studio", desc: "Salon name" },
  { tag: "{link}",       sample: "featuresalon.co.uk/book/glow", desc: "Booking link" },
];

// ── Utilities ────────────────────────────────────────────────────────────────
function splitList(raw: string): string[] {
  return raw.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
}
function partitionList(raw: string) {
  const items = splitList(raw);
  return { emails: items.filter(x => x.includes("@")), phones: items.filter(x => !x.includes("@")) };
}
function isRTL(s: string): boolean { return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(s); }
function applyVarSamples(t: string) {
  return t.replace(/\{name\}/g, "Sarah").replace(/\{salon_name\}/g, "Glow Studio").replace(/\{link\}/g, "featuresalon.co.uk/book/glow");
}
function initCountries(): CountryConfig[] {
  return COUNTRY_DEFS.map(d => ({
    ...d, recipients: "", enabled: true,
    channels: { email: d.code === "GB", whatsapp: d.code !== "GB", sms: false },
  }));
}
function loadCustomTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(TEMPLATE_STORE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function persistCustomTemplates(ts: Template[]) {
  try { localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(ts.filter(t => !t.builtIn))); } catch {}
}

// ── Shared components ────────────────────────────────────────────────────────
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.shadow, ...style }}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 6 }}>{children}</div>
);
const Th = ({ children }: { children: React.ReactNode }) => (
  <th style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" as const, color: T.text3, padding: "11px 16px", textAlign: "left" as const, borderBottom: `1px solid ${T.border}`, background: T.bg }}>{children}</th>
);
const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "13px 16px", fontSize: 13.5, color: T.text, verticalAlign: "middle" as const, ...style }}>{children}</td>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const router = useRouter();
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [authorised,  setAuthorised]  = useState(false);
  const [loggedInAs,  setLoggedInAs]  = useState<string | null>(null);

  const [caps, setCaps]               = useState({ email: true, sms: true, whatsapp: false });
  const [logs, setLogs]               = useState<BroadcastLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [subject, setSubject]         = useState("");
  const [message, setMessage]         = useState("");

  const [countries, setCountries]     = useState<CountryConfig[]>(initCountries);
  const [results,   setResults]       = useState<CountryResult[]>(
    COUNTRY_DEFS.map(d => ({ code: d.code, status: "idle" as SendStatus, sent: 0, failed: 0 }))
  );
  const [isSendingAll, setIsSendingAll] = useState(false);

  const [customTemplates,    setCustomTemplates]    = useState<Template[]>([]);
  const [appliedTemplateId,  setAppliedTemplateId]  = useState<string | null>(null);

  const [showPreview,      setShowPreview]      = useState(false);
  const [showConfirmAll,   setShowConfirmAll]   = useState(false);
  const [confirmCountry,   setConfirmCountry]   = useState<CountryCode | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName,  setNewTemplateName]  = useState("");
  const [feedback,         setFeedback]         = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      setLoggedInAs(user?.email ?? null);
      if (user?.email === ADMIN_EMAIL) setAuthorised(true);
      setAuthChecked(true);
    })();
  }, [router]);

  useEffect(() => { setCustomTemplates(loadCustomTemplates()); }, []);

  // ── Load capabilities + logs ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/broadcast", { headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
      if (res.ok) {
        const json = await res.json();
        setCaps(json.capabilities || { email: false, sms: false, whatsapp: false });
        setLogs(json.logs || []);
      }
    } catch (e) { console.error("[broadcast] loadAll", e); }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => { if (authorised) loadAll(); }, [authorised, loadAll]);

  // ── Variable insertion ───────────────────────────────────────────────────
  const insertVar = (tag: string) => {
    const el = msgRef.current;
    if (!el) { setMessage(m => m + tag); return; }
    const s = el.selectionStart ?? message.length;
    const e = el.selectionEnd   ?? message.length;
    const next = message.slice(0, s) + tag + message.slice(e);
    setMessage(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length); });
  };

  // ── Templates ────────────────────────────────────────────────────────────
  const allTemplates = useMemo(() => [...BUILT_IN, ...customTemplates], [customTemplates]);

  const applyTemplate = (t: Template) => {
    setSubject(t.subject);
    setMessage(t.body);
    setAppliedTemplateId(t.id);
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim()) return;
    const t: Template = { id: `custom-${Date.now()}`, name: newTemplateName.trim(), subject: subject.trim(), body: message.trim() };
    const updated = [...customTemplates, t];
    setCustomTemplates(updated);
    persistCustomTemplates(updated);
    setShowSaveTemplate(false);
    setNewTemplateName("");
    setFeedback({ kind: "success", text: `Template "${t.name}" saved.` });
  };

  const deleteTemplate = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    persistCustomTemplates(updated);
    if (appliedTemplateId === id) setAppliedTemplateId(null);
  };

  // ── Country updates ──────────────────────────────────────────────────────
  const updateCountry = (code: CountryCode, patch: Partial<CountryConfig>) =>
    setCountries(prev => prev.map(c => c.code === code ? { ...c, ...patch } : c));

  const toggleChannel = (code: CountryCode, ch: Channel) =>
    setCountries(prev => prev.map(c => c.code === code ? { ...c, channels: { ...c.channels, [ch]: !c.channels[ch] } } : c));

  // ── Send one country (optionally force a single channel) ─────────────────
  const sendToCountry = async (code: CountryCode, forceChannel?: Channel) => {
    const country = countries.find(c => c.code === code);
    if (!country) return;
    setConfirmCountry(null);

    const { emails, phones } = partitionList(country.recipients);
    const picked: Channel[] = forceChannel ? [forceChannel] : (Object.keys(country.channels) as Channel[]).filter(ch => country.channels[ch] && caps[ch]);

    setResults(prev => prev.map(r => r.code === code ? { ...r, status: "sending", sent: 0, failed: 0, error: undefined } : r));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), channels: picked, recipientType: "custom", countries: [code], customEmails: emails.join("\n"), customPhones: phones.join("\n") }),
      });
      const json = await res.json();
      if (res.ok) {
        const st: SendStatus = json.totalFailed === 0 && json.totalSent > 0 ? "success" : json.totalSent === 0 ? "failed" : "partial";
        setResults(prev => prev.map(r => r.code === code ? { ...r, status: st, sent: json.totalSent, failed: json.totalFailed } : r));
        setFeedback({ kind: st === "failed" ? "error" : "success", text: `${country.flag} ${country.label}: ${json.totalSent} sent, ${json.totalFailed} failed` });
      } else {
        setResults(prev => prev.map(r => r.code === code ? { ...r, status: "failed", error: json.error } : r));
        setFeedback({ kind: "error", text: json.error || "Send failed" });
      }
    } catch (e) {
      setResults(prev => prev.map(r => r.code === code ? { ...r, status: "failed", error: "Network error" } : r));
      setFeedback({ kind: "error", text: "Network error" });
    }
    loadAll();
  };

  // ── Send all countries ───────────────────────────────────────────────────
  const handleSendAll = async () => {
    setShowConfirmAll(false);
    setIsSendingAll(true);
    setFeedback(null);
    setResults(COUNTRY_DEFS.map(d => ({ code: d.code, status: "idle" as SendStatus, sent: 0, failed: 0 })));

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";
    let totalSent = 0, totalFailed = 0;

    for (const country of countries) {
      const { emails, phones } = partitionList(country.recipients);
      const picked = (Object.keys(country.channels) as Channel[]).filter(ch => country.channels[ch] && caps[ch]);

      if (!country.enabled || (emails.length === 0 && phones.length === 0)) {
        setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: "skipped" } : r));
        continue;
      }
      if (picked.length === 0) {
        setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: "skipped", error: "No channels" } : r));
        continue;
      }

      setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: "sending" } : r));

      try {
        const res = await fetch("/api/admin/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject: subject.trim(), message: message.trim(), channels: picked, recipientType: "custom", countries: [country.code], customEmails: emails.join("\n"), customPhones: phones.join("\n") }),
        });
        const json = await res.json();
        if (res.ok) {
          const st: SendStatus = json.totalFailed === 0 && json.totalSent > 0 ? "success" : json.totalSent === 0 ? "failed" : "partial";
          setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: st, sent: json.totalSent, failed: json.totalFailed } : r));
          totalSent   += json.totalSent   || 0;
          totalFailed += json.totalFailed || 0;
        } else {
          setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: "failed", error: json.error } : r));
        }
      } catch {
        setResults(prev => prev.map(r => r.code === country.code ? { ...r, status: "failed", error: "Network error" } : r));
      }
    }

    setIsSendingAll(false);
    setFeedback({ kind: totalFailed === 0 ? "success" : "error", text: `All countries processed — ${totalSent} sent, ${totalFailed} failed.` });
    loadAll();
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const msgIsRTL = useMemo(() => isRTL(message) || isRTL(subject), [message, subject]);

  const enabledWithRecipients = useMemo(
    () => countries.filter(c => c.enabled && splitList(c.recipients).length > 0),
    [countries]
  );
  const totalEnabledRecipients = useMemo(
    () => enabledWithRecipients.reduce((acc, c) => acc + splitList(c.recipients).length, 0),
    [enabledWithRecipients]
  );
  const sendAllProgress = useMemo(() => {
    const total = countries.length;
    if (total === 0) return 0;
    const done = results.filter(r => r.status !== "idle" && r.status !== "sending").length;
    return Math.round((done / total) * 100);
  }, [countries, results]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  // ── Loading / auth screens ────────────────────────────────────────────────
  if (!authChecked) return (
    <div style={{ minHeight: "100vh", background: T.nav, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.2)", borderTopColor: T.indigo, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!authorised) return (
    <div style={{ minHeight: "100vh", background: T.nav, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Access Denied</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 340 }}>
        Logged in as: <strong style={{ color: "#F59E0B" }}>{loggedInAs || "not logged in"}</strong><br/>
        Required: <strong style={{ color: "#047857" }}>{ADMIN_EMAIL}</strong>
      </div>
      <a href="/login" style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: "#6366F1", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Login →</a>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .nav-item{transition:all 0.15s;cursor:pointer;text-decoration:none}
        .nav-item:hover{background:rgba(255,255,255,0.06)!important;color:#fff!important}
        input,textarea,select{font-family:inherit}
        input:focus,textarea:focus{border-color:${T.indigo}!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)!important;outline:none}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        .chip{cursor:pointer;transition:all 0.12s;user-select:none}
        .chip:hover{border-color:${T.indigo}!important;background:${T.indigoSoft}!important;color:${T.indigo}!important}
        .tpl-card{cursor:pointer;transition:all 0.15s;border:1.5px solid ${T.border};border-radius:12px}
        .tpl-card:hover{border-color:${T.indigo}!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
        .tpl-applied{border-color:${T.indigo}!important;background:${T.indigoSoft}!important}
        .ch-btn{transition:all 0.15s;cursor:pointer;user-select:none}
        .row-hover:hover td{background:#F8FAFC!important}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 232, minHeight: "100vh", background: T.nav, flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${T.navBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, background: T.indigo, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 800 }}>F</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" }}>feature</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 1 }}>Super Admin</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {NAV_ITEMS.map(item => {
            const active = item.key === "broadcast";
            return (
              <a key={item.key} href={item.href} className="nav-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, marginBottom: 2, color: active ? T.navActive : T.navText, background: active ? "rgba(99,102,241,0.18)" : "transparent", fontSize: 13.5, fontWeight: active ? 600 : 500, position: "relative" }}>
                {active && <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: T.indigo, borderRadius: "0 3px 3px 0" }} />}
                <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div style={{ padding: "14px 10px", borderTop: `1px solid ${T.navBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Adil Gill</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Super Admin</div>
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 13, padding: 4 }}>⏻</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Header */}
        <header style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Broadcast Notifications</div>
            <div style={{ fontSize: 11.5, color: T.text3 }}>Send targeted messages by country with templates</div>
          </div>
          <button onClick={() => setShowSaveTemplate(true)} disabled={!subject && !message}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12.5, fontWeight: 600, color: T.indigo, cursor: (!subject && !message) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!subject && !message) ? 0.4 : 1 }}>
            💾 Save as Template
          </button>
        </header>

        {/* Send-all progress bar */}
        {isSendingAll && (
          <div style={{ height: 3, background: T.bg }}>
            <div style={{ height: "100%", width: `${sendAllProgress}%`, background: `linear-gradient(90deg,${T.indigo},#8B5CF6)`, transition: "width 0.5s ease", animation: "pulse 1.5s infinite" }} />
          </div>
        )}

        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

            {/* Feedback */}
            {feedback && (
              <div style={{ padding: "12px 16px", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 8, background: feedback.kind === "success" ? T.greenSoft : T.redSoft, border: `1px solid ${feedback.kind === "success" ? "#A7F3D0" : "#FECACA"}`, color: feedback.kind === "success" ? "#065F46" : "#991B1B" }}>
                {feedback.text}
                <button onClick={() => setFeedback(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>×</button>
              </div>
            )}

            {/* ── Templates ───────────────────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>📋 Message Templates</div>
                <div style={{ fontSize: 11.5, color: T.text3 }}>Click any template to auto-fill the message</div>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                {allTemplates.map(t => (
                  <div key={t.id} onClick={() => applyTemplate(t)}
                    className={`tpl-card${appliedTemplateId === t.id ? " tpl-applied" : ""}`}
                    style={{ flexShrink: 0, width: 220, padding: "14px 16px", background: T.surface, position: "relative" }}>
                    {t.builtIn
                      ? <div style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: T.indigoSoft, color: T.indigo, textTransform: "uppercase" }}>Built-in</div>
                      : <button onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }}
                          style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 99, border: "none", background: T.redSoft, color: T.red, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    }
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 5, paddingRight: 40, lineHeight: 1.3 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.5, overflow: "hidden", maxHeight: 36 }}>{t.body.slice(0, 80)}…</div>
                    {appliedTemplateId === t.id && <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, color: T.indigo }}>✓ Applied</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Compose ─────────────────────────────────────────────── */}
            <Card style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Compose Message</div>
                <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>Shared across all countries. Supports English, Urdu, Arabic.</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <Label>Subject (for Email channel)</Label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. We Miss You! Here's 20% OFF Just for You 💕"
                  dir={msgIsRTL ? "rtl" : "ltr"}
                  style={{ width: "100%", height: 42, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13.5, color: T.text, background: T.bg }} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Label>Message Body</Label>
                  <div style={{ fontSize: 11, color: T.text3 }}>
                    {message.length} chars
                    {message.length > 160 && <span style={{ color: T.amber }}> · {Math.ceil(message.length / 160)} SMS parts</span>}
                  </div>
                </div>
                <textarea ref={msgRef} value={message} onChange={e => setMessage(e.target.value)}
                  rows={7} dir={msgIsRTL ? "rtl" : "ltr"}
                  placeholder={"Hi {name}! 💕\nWe miss you at Anita Love Hair!…"}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13.5, color: T.text, resize: "vertical", background: T.bg, lineHeight: 1.6 }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>Insert variable:</span>
                {MSG_VARS.map(v => (
                  <button key={v.tag} onClick={() => insertVar(v.tag)} className="chip" title={v.desc}
                    style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${T.border}`, background: T.bg, fontSize: 12, color: T.text2, fontFamily: "monospace", cursor: "pointer", fontWeight: 600 }}>
                    {v.tag}
                  </button>
                ))}
                <button onClick={() => setShowPreview(true)} disabled={!subject && !message}
                  style={{ marginLeft: "auto", height: 30, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12, color: T.text2, cursor: (!subject && !message) ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                  👁 Preview
                </button>
                {msgIsRTL && <span style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>RTL detected</span>}
              </div>
            </Card>

            {/* ── Countries Grid ───────────────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>🌍 Recipients by Country</div>
                <div style={{ fontSize: 11.5, color: T.text3 }}>Paste emails or phone numbers — auto-detected per line</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {countries.map(country => {
                  const { emails, phones } = partitionList(country.recipients);
                  const count = emails.length + phones.length;
                  const result = results.find(r => r.code === country.code);
                  const stMeta = STATUS_META[result?.status ?? "idle"];
                  const enabledChs = (Object.keys(country.channels) as Channel[]).filter(ch => country.channels[ch] && caps[ch]);
                  const canSend = count > 0 && enabledChs.length > 0 && !!subject.trim() && !!message.trim();

                  return (
                    <Card key={country.code} style={{ padding: 0, overflow: "hidden" }}>
                      {/* Country header */}
                      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{country.flag}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{country.label}</div>
                          <div style={{ fontSize: 10.5, color: T.text3 }}>
                            {count > 0
                              ? [emails.length > 0 && `${emails.length} email${emails.length !== 1 ? "s" : ""}`, phones.length > 0 && `${phones.length} phone${phones.length !== 1 ? "s" : ""}`].filter(Boolean).join(" · ")
                              : "No recipients yet"}
                          </div>
                        </div>
                        {/* Enable toggle */}
                        <button onClick={() => updateCountry(country.code, { enabled: !country.enabled })}
                          style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${country.enabled ? T.green : T.border}`, background: country.enabled ? T.greenSoft : "transparent", fontSize: 11, fontWeight: 700, color: country.enabled ? T.green : T.text3, cursor: "pointer", fontFamily: "inherit" }}>
                          {country.enabled ? "✓ On" : "Off"}
                        </button>
                        {/* Status badge */}
                        {(result?.status ?? "idle") !== "idle" && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: stMeta.bg, color: stMeta.color }}>
                            {stMeta.icon} {stMeta.label}
                          </span>
                        )}
                      </div>

                      {/* Recipient textarea */}
                      <div style={{ padding: "12px 16px 8px" }}>
                        <textarea value={country.recipients} onChange={e => updateCountry(country.code, { recipients: e.target.value })}
                          rows={5} placeholder={country.code === "GB" ? "jane@salon.co.uk\nbob@example.com\n07700123456" : "+923001234567\n+923211234567\nname@example.com"}
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 12, color: T.text, resize: "vertical", background: T.bg, fontFamily: "monospace", lineHeight: 1.5 }} />
                      </div>

                      {/* Result info */}
                      {result && !["idle", "sending", "skipped"].includes(result.status) && (
                        <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, fontSize: 11.5 }}>
                          {result.error
                            ? <span style={{ color: T.red }}>Error: {result.error}</span>
                            : <>{result.sent > 0 && <span style={{ color: T.green, fontWeight: 700 }}>✓ {result.sent} sent</span>}{result.failed > 0 && <span style={{ color: T.red, fontWeight: 700, marginLeft: 6 }}>✗ {result.failed} failed</span>}</>}
                        </div>
                      )}

                      {/* Per-channel send buttons */}
                      <div style={{ padding: "0 16px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {([
                          { ch: "email"    as Channel, icon: "✉",  label: "Email",    color: T.indigo },
                          { ch: "whatsapp" as Channel, icon: "💬", label: "WhatsApp", color: T.green  },
                          { ch: "sms"      as Channel, icon: "📱", label: "SMS",      color: T.amber  },
                        ]).filter(({ ch }) => caps[ch]).map(({ ch, icon, label, color }) => {
                          const hasRecipients = ch === "email" ? partitionList(country.recipients).emails.length > 0 : partitionList(country.recipients).phones.length > 0;
                          const active = hasRecipients && !!subject.trim() && !!message.trim() && result?.status !== "sending" && !isSendingAll;
                          return (
                            <button key={ch} onClick={() => active && sendToCountry(country.code, ch)}
                              disabled={!active}
                              style={{ flex: 1, minWidth: 80, height: 36, borderRadius: 8, border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: active ? "pointer" : "not-allowed", transition: "all 0.15s", background: active ? color : T.border, color: active ? "#fff" : T.text3 }}>
                              {result?.status === "sending" ? "…" : `${icon} ${label}`}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* ── Send All ─────────────────────────────────────────────── */}
            <Card style={{ padding: 24, background: enabledWithRecipients.length > 0 ? "linear-gradient(135deg,#1e1b4b,#312e81)" : T.surface, border: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: enabledWithRecipients.length > 0 ? "#fff" : T.text }}>
                    🌍 Send to All Enabled Countries
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 3, color: enabledWithRecipients.length > 0 ? "rgba(255,255,255,0.6)" : T.text3 }}>
                    {enabledWithRecipients.length > 0
                      ? `${enabledWithRecipients.map(c => `${c.flag} ${c.label}`).join(" · ")} — ${totalEnabledRecipients} recipients total`
                      : "Add recipients to at least one country to enable"}
                  </div>
                </div>
                <button onClick={() => setShowConfirmAll(true)}
                  disabled={enabledWithRecipients.length === 0 || isSendingAll || !subject.trim() || !message.trim()}
                  style={{ height: 48, padding: "0 32px", borderRadius: 12, border: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: (enabledWithRecipients.length > 0 && !isSendingAll && subject.trim() && message.trim()) ? "pointer" : "not-allowed", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 8px 24px rgba(99,102,241,0.4)", opacity: (enabledWithRecipients.length === 0 || isSendingAll || !subject.trim() || !message.trim()) ? 0.4 : 1 }}>
                  {isSendingAll ? `Sending… ${sendAllProgress}%` : "▶ Send All"}
                </button>
              </div>

              {/* Per-country status during send-all */}
              {isSendingAll && (
                <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {countries.filter(c => c.enabled).map(c => {
                    const r = results.find(x => x.code === c.code);
                    const m = STATUS_META[r?.status ?? "idle"];
                    return (
                      <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                        <span style={{ fontSize: 14 }}>{c.flag}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{c.label}</span>
                        <span style={{ fontSize: 12, color: m.color, fontWeight: 800 }}>{m.icon}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* ── Broadcast Logs ───────────────────────────────────────── */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Broadcast Logs</div>
                  <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>Last 200 broadcast attempts</div>
                </div>
                <button onClick={loadAll} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: T.indigoSoft, border: "none", fontSize: 12, cursor: "pointer", color: T.indigo, fontWeight: 700, fontFamily: "inherit" }}>↻ Refresh</button>
              </div>
              {logsLoading ? (
                <div style={{ padding: 48, textAlign: "center", color: T.text3 }}>Loading…</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: 56, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>◌</div>
                  <div style={{ fontSize: 14, color: T.text3 }}>No broadcasts sent yet</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>{["Date", "Subject", "Channels", "Sent", "Failed", "Status"].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                    <tbody>
                      {logs.map(log => {
                        const logMeta: Record<string, { bg: string; color: string; label: string }> = {
                          success: { bg: "#ECFDF5", color: "#059669", label: "Success" },
                          partial: { bg: "#FFFBEB", color: "#D97706", label: "Partial" },
                          failed:  { bg: "#FEF2F2", color: "#B91C1C", label: "Failed" },
                          sending: { bg: "#EEF2FF", color: "#4F46E5", label: "Sending" },
                        };
                        const lm = logMeta[log.status] || logMeta.success;
                        return (
                          <tr key={log.id} className="row-hover">
                            <Td style={{ color: T.text2, fontSize: 12.5, whiteSpace: "nowrap" }}>
                              {withMeridiem(new Date(log.sent_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true}))}
                            </Td>
                            <Td>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{log.subject}</div>
                              <div style={{ fontSize: 11, color: T.text3, textTransform: "capitalize" }}>{log.recipient_type}</div>
                            </Td>
                            <Td>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {(log.channels || []).map(c => (
                                  <span key={c} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.indigoSoft, color: T.indigo, textTransform: "uppercase" }}>{c}</span>
                                ))}
                              </div>
                            </Td>
                            <Td style={{ fontWeight: 700 }}>{log.total_sent}</Td>
                            <Td style={{ fontWeight: 700, color: log.total_failed ? T.red : T.text2 }}>{log.total_failed}</Td>
                            <Td><span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: lm.bg, color: lm.color }}>{lm.label}</span></Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

          </div>
        </main>
      </div>

      {/* ── Preview Modal ─────────────────────────────────────────────────── */}
      {showPreview && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowPreview(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.surface, borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease" }}>
            <div style={{ background: T.nav, borderRadius: "20px 20px 0 0", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Message Preview</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Variables shown with sample values</div>
              </div>
              <button onClick={() => setShowPreview(false)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: "#F4F4F5", borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <div style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", padding: "28px 22px", textAlign: "center" }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Feature Salon</div>
                  <div dir={msgIsRTL ? "rtl" : "ltr"} style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>
                    {applyVarSamples(subject) || "(subject)"}
                  </div>
                </div>
                <div dir={msgIsRTL ? "rtl" : "ltr"} style={{ padding: 22, fontSize: 13.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#fff" }}>
                  {applyVarSamples(message) || "(message body)"}
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "12px 14px", background: T.indigoSoft, borderRadius: 10, border: `1px solid #C7D2FE` }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.indigo, marginBottom: 6 }}>Variable samples</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {MSG_VARS.map(v => <span key={v.tag} style={{ fontSize: 11.5, color: T.text2, fontFamily: "monospace" }}><strong>{v.tag}</strong> → &ldquo;{v.sample}&rdquo;</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Single Country ─────────────────────────────────────────── */}
      {confirmCountry && (() => {
        const c = countries.find(x => x.code === confirmCountry)!;
        const { emails, phones } = partitionList(c.recipients);
        const cnt = emails.length + phones.length;
        const chs = (Object.keys(c.channels) as Channel[]).filter(ch => c.channels[ch] && caps[ch]);
        return (
          <div onClick={e => { if (e.target === e.currentTarget) setConfirmCountry(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.surface, borderRadius: 18, width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", padding: 28, animation: "fadeUp 0.2s ease" }}>
              <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>{c.flag}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8, textAlign: "center" }}>Send to {c.label}?</div>
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.65, marginBottom: 20, textAlign: "center" }}>
                <strong>{cnt}</strong> recipient{cnt !== 1 ? "s" : ""} via <strong>{chs.join(", ")}</strong>.<br/>This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmCountry(null)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => sendToCountry(confirmCountry)} style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: T.indigo, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, Send</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Confirm Send All ───────────────────────────────────────────────── */}
      {showConfirmAll && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowConfirmAll(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.surface, borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", padding: 28, animation: "fadeUp 0.2s ease" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🌍</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8, textAlign: "center" }}>Send to All Countries?</div>
            <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.65, marginBottom: 16, textAlign: "center" }}>
              <strong>{totalEnabledRecipients}</strong> total recipients across:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {enabledWithRecipients.map(c => (
                <span key={c.code} style={{ padding: "5px 12px", borderRadius: 99, background: T.indigoSoft, color: T.indigo, fontSize: 12.5, fontWeight: 600 }}>
                  {c.flag} {c.label} ({splitList(c.recipients).length})
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowConfirmAll(false)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSendAll} style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: T.indigo, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, Send All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save Template Modal ────────────────────────────────────────────── */}
      {showSaveTemplate && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowSaveTemplate(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(10,15,28,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.surface, borderRadius: 18, width: "100%", maxWidth: 380, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", padding: 28, animation: "fadeUp 0.2s ease" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>💾 Save Template</div>
            <div style={{ fontSize: 12.5, color: T.text3, marginBottom: 16 }}>Name this template for quick reuse.</div>
            <input type="text" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveTemplate(); }}
              placeholder="e.g. Black Friday Promo" autoFocus
              style={{ width: "100%", height: 44, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.text, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowSaveTemplate(false)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={saveTemplate} disabled={!newTemplateName.trim()}
                style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: newTemplateName.trim() ? T.indigo : T.border, color: "#fff", fontSize: 14, fontWeight: 700, cursor: newTemplateName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
