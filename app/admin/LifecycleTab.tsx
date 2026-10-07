"use client";
import { useEffect, useState } from "react";

// Admin → Lifecycle Emails. Read-only view of what the daily cron would do
// today, the recent email_log, and a preview / "send test to features@" tool.
// Test sends never go to owners. Palette matches the admin page's T tokens.

const C = {
  surface: "#FFFFFF", bg: "#F6F8FC", border: "#E2E8F0", text: "#0F172A", text2: "#64748B",
  indigo: "#6366F1", indigoSoft: "#EEF2FF", green: "#047857", greenSoft: "#ECFDF5",
  amber: "#B45309", amberSoft: "#FFFBEB", red: "#B91C1C", redSoft: "#FEF2F2",
};

const EMAILS: { key: string; label: string }[] = [
  { key: "e1_welcome", label: "1 · Welcome" },
  { key: "e2_setup_help", label: "2 · Setup help" },
  { key: "e3_week_one", label: "3 · One-week check-in" },
  { key: "e4_trial_ending", label: "4 · Trial ending soon" },
  { key: "e5_trial_ended", label: "5 · Trial ended" },
  { key: "e6_monthly", label: "6 · Monthly check-in" },
  { key: "e7_review", label: "7 · Google review request" },
  { key: "e8_gone_quiet", label: "8 · Gone quiet" },
];
const labelFor = (key?: string) => EMAILS.find(e => e.key === key)?.label ?? key ?? "";

interface TodayRow {
  salonId: string; salonName: string; ownerEmail: string | null; segment: string;
  action: "send" | "skip"; emailKey?: string; subject?: string; reason?: string;
}
interface LogRow { id: number; salonName: string; email_key: string; status: string; sent_at: string; error: string | null }
interface Data { live: boolean; reviewLinkSet: boolean; unsubscribeConfigured: boolean; today: TodayRow[]; recent: LogRow[] }

const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 };
const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: C.text2, padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${C.border}`, background: C.bg };
const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: "top" };
const btn: React.CSSProperties = { border: `1px solid ${C.border}`, background: C.surface, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

function Chip({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
      background: ok ? C.greenSoft : C.amberSoft, color: ok ? C.green : C.amber, marginRight: 8 }}>
      {children}
    </span>
  );
}

export default function LifecycleTab() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [salonId, setSalonId] = useState("");
  const [emailKey, setEmailKey] = useState("e1_welcome");
  const [preview, setPreview] = useState<{ subject: string; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/lifecycle");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(json.error || "Failed to load lifecycle emails."); return; }
        setData(json);
        setSalonId(json.today?.[0]?.salonId ?? "");
      } catch {
        setLoadError("Network error — could not load lifecycle emails.");
      }
    })();
  }, []);

  const run = async (action: "preview" | "send_test", forSalon = salonId, forKey = emailKey) => {
    if (!forSalon || busy) return;
    setBusy(action); setMessage("");
    try {
      const res = await fetch("/api/admin/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, salonId: forSalon, emailKey: forKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage(json.error || "Failed."); return; }
      if (action === "preview") setPreview({ subject: json.subject, text: json.text });
      else setMessage(`Test sent to ${json.to}.`);
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy("");
    }
  };

  const previewFor = (row: TodayRow) => {
    if (!row.emailKey) return;
    setSalonId(row.salonId); setEmailKey(row.emailKey);
    run("preview", row.salonId, row.emailKey);
  };

  if (loadError) return <div style={{ ...card, color: C.red, background: C.redSoft }}>{loadError}</div>;
  if (!data) return <div style={{ ...card, color: C.text2 }}>Loading lifecycle emails…</div>;

  const today = [...data.today].sort((a, b) => (a.action === b.action ? 0 : a.action === "send" ? -1 : 1));
  const dueCount = today.filter(r => r.action === "send").length;

  return (
    <div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16 }}>
        Automated emails to salon owners (docs/lifecycle-emails.md). The cron runs daily at 09:00 UTC.
      </div>

      <div style={card}>
        <Chip ok={data.live}>{data.live ? "Live: emails are sent" : "Dry run: nothing is sent"}</Chip>
        <Chip ok={data.unsubscribeConfigured}>{data.unsubscribeConfigured ? "Unsubscribe secret set" : "LIFECYCLE_UNSUBSCRIBE_SECRET missing"}</Chip>
        <Chip ok={data.reviewLinkSet}>{data.reviewLinkSet ? "Email 7 on" : "Email 7 off (no GOOGLE_REVIEW_LINK)"}</Chip>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: C.text }}>
          Today: {dueCount} email{dueCount === 1 ? "" : "s"} due
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Salon", "Owner", "Segment", "Today", ""].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {today.map(r => (
                <tr key={r.salonId}>
                  <td style={td}>{r.salonName}</td>
                  <td style={td}>{r.ownerEmail ?? "—"}</td>
                  <td style={td}>{r.segment}</td>
                  <td style={td}>
                    {r.action === "send"
                      ? <><strong style={{ color: C.indigo }}>{labelFor(r.emailKey)}</strong><div style={{ color: C.text2, fontSize: 12 }}>{r.subject}</div></>
                      : <span style={{ color: C.text2 }}>{r.reason}</span>}
                  </td>
                  <td style={td}>{r.action === "send" && <button style={btn} onClick={() => previewFor(r)}>Preview</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Preview any email</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select aria-label="Salon" value={salonId} onChange={e => setSalonId(e.target.value)} style={{ ...btn, fontWeight: 500 }}>
            {data.today.map(r => <option key={r.salonId} value={r.salonId}>{r.salonName}</option>)}
          </select>
          <select aria-label="Email" value={emailKey} onChange={e => setEmailKey(e.target.value)} style={{ ...btn, fontWeight: 500 }}>
            {EMAILS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <button style={btn} disabled={!!busy} onClick={() => run("preview")}>{busy === "preview" ? "Loading…" : "Preview"}</button>
          <button style={{ ...btn, background: C.indigo, color: "#FFFFFF", border: "none" }} disabled={!!busy} onClick={() => run("send_test")}>
            {busy === "send_test" ? "Sending…" : "Send test to features@"}
          </button>
        </div>
        {message && <div style={{ fontSize: 13, color: message.startsWith("Test sent") ? C.green : C.red, marginBottom: 12 }}>{message}</div>}
        {preview && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.text2 }}>Subject: </span><strong>{preview.subject}</strong>
            </div>
            <pre style={{ margin: 0, padding: 14, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit", color: C.text }}>{preview.text}</pre>
          </div>
        )}
        <div style={{ fontSize: 12, color: C.text2, marginTop: 10 }}>
          Previews and test sends use a dummy unsubscribe link, so clicking it never unsubscribes the real owner.
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: C.text }}>Recent log</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["When (UTC)", "Salon", "Email", "Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.recent.length === 0
                ? <tr><td style={{ ...td, color: C.text2 }} colSpan={4}>Nothing logged yet.</td></tr>
                : data.recent.map(r => (
                  <tr key={r.id}>
                    <td style={td}>{r.sent_at.slice(0, 16).replace("T", " ")}</td>
                    <td style={td}>{r.salonName}</td>
                    <td style={td}>{labelFor(r.email_key)}</td>
                    <td style={td}>{r.status}{r.error ? <div style={{ color: C.red, fontSize: 12 }}>{r.error}</div> : null}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
