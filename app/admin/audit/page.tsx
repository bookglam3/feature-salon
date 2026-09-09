"use client";
import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────
interface LogEntry {
  id:          string;
  action:      string;
  resource:    string;
  resource_id: string | null;
  salon_id:    string | null;
  details:     string | null;
  ip_address:  string | null;
  created_at:  string;
  admin_role:  string;
  admin:       { full_name: string; email: string } | null;
}
interface AdminMeta { id: string; full_name: string; email: string; role: string; }

// ── Action colour map ─────────────────────────────────────────
const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  login:              { bg: "#064E3B", color: "#34D399" },
  logout:             { bg: "#1E1B4B", color: "#818CF8" },
  update_salon:       { bg: "#1C3A5E", color: "#60A5FA" },
  delete_salon:       { bg: "#450A0A", color: "#F87171" },
  create_salon:       { bg: "#064E3B", color: "#34D399" },
  invite_sent:        { bg: "#312E81", color: "#A5B4FC" },
  invite_revoked:     { bg: "#450A0A", color: "#F87171" },
  invite_accepted:    { bg: "#064E3B", color: "#34D399" },
  admin_deactivated:  { bg: "#450A0A", color: "#F87171" },
  admin_created:      { bg: "#064E3B", color: "#34D399" },
  broadcast_sent:     { bg: "#1A1A2E", color: "#C084FC" },
  plan_changed:       { bg: "#1C3A5E", color: "#60A5FA" },
  trial_extended:     { bg: "#2D1B00", color: "#FBBF24" },
  agent_approved:     { bg: "#064E3B", color: "#34D399" },
  agent_rejected:     { bg: "#450A0A", color: "#F87171" },
  flag_toggled:       { bg: "#2D1B00", color: "#FBBF24" },
  settings_updated:   { bg: "#1C3A5E", color: "#60A5FA" },
};
function actionStyle(action: string) {
  return ACTION_COLORS[action] ?? { bg: "#1F2937", color: "#9CA3AF" };
}

const ROLE_COLORS: Record<string, string> = {
  super_admin:   "#B91C1C",
  ops_manager:   "#4F46E5",
  support_agent: "#92400E",
  sales_agent:   "#047857",
  developer:     "#155E75",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return {
    rel:  relativeTime(d),
    abs:  d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}
function relativeTime(d: Date) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const RESOURCES = ["salons", "appointments", "admin_users", "admin_invites", "sales_agents", "broadcast"];

// ── Component ─────────────────────────────────────────────────
export default function AuditLogPage() {
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [admins,   setAdmins]   = useState<AdminMeta[]>([]);
  const [actions,  setActions]  = useState<string[]>([]);

  // Filters
  const [page,     setPage]     = useState(1);
  const [adminId,  setAdminId]  = useState("");
  const [action,   setAction]   = useState("");
  const [resource, setResource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // Load filter meta (admins + distinct actions)
  useEffect(() => {
    fetch("/api/admin/audit", { method: "POST" })
      .then(r => r.json())
      .then(d => { setAdmins(d.admins ?? []); setActions(d.actions ?? []); })
      .catch(() => null);
  }, []);

  const fetchLogs = useCallback(async (p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (adminId)  params.set("adminId",  adminId);
    if (action)   params.set("action",   action);
    if (resource) params.set("resource", resource);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo)   params.set("dateTo",   dateTo);

    try {
      const res  = await fetch(`/api/admin/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setPage(p);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, adminId, action, resource, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => fetchLogs(1);
  const clearFilters = () => {
    setAdminId(""); setAction(""); setResource("");
    setDateFrom(""); setDateTo("");
    setTimeout(() => fetchLogs(1), 0);
  };

  const hasFilters = adminId || action || resource || dateFrom || dateTo;

  return (
    <div style={{
      minHeight: "100vh", background: "#07070F",
      fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#E2E8F0",
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#312E81;border-radius:3px}
        select,input{outline:none;font-family:inherit}
        select:focus,input:focus{border-color:#6366F1!important}
        .log-row:hover td{background:rgba(99,102,241,0.04)!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn 0.2s ease both}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Top bar ── */}
      <header style={{
        background: "#0D0D1A", borderBottom: "1px solid rgba(99,102,241,0.2)",
        padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
              borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>📋</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.3px" }}>Audit Logs</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                {total.toLocaleString()} records · 90-day retention
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(page)}
          style={{
            padding: "8px 16px", background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)", borderRadius: 9,
            color: "#818CF8", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          ↻ Refresh
        </button>
      </header>

      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Filters ── */}
        <div style={{
          background: "#0D0D1A", border: "1px solid rgba(99,102,241,0.15)",
          borderRadius: 16, padding: "18px 20px", marginBottom: 20,
          display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
        }}>

          {/* Date From */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lblStyle}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={inputStyle} />
          </div>

          {/* Date To */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lblStyle}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={inputStyle} />
          </div>

          {/* Action */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lblStyle}>Action</label>
            <select value={action} onChange={e => setAction(e.target.value)} style={selectStyle}>
              <option value="">All actions</option>
              {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          {/* Resource */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lblStyle}>Resource</label>
            <select value={resource} onChange={e => setResource(e.target.value)} style={selectStyle}>
              <option value="">All resources</option>
              {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Admin */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lblStyle}>Admin</label>
            <select value={adminId} onChange={e => setAdminId(e.target.value)} style={selectStyle}>
              <option value="">All admins</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            {hasFilters && (
              <button onClick={clearFilters} style={{
                padding: "9px 16px", background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
                color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer",
              }}>Clear</button>
            )}
            <button onClick={applyFilters} style={{
              padding: "9px 20px",
              background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
              border: "none", borderRadius: 9,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
            }}>Apply Filters</button>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: "#0D0D1A", border: "1px solid rgba(99,102,241,0.15)",
          borderRadius: 16, overflow: "hidden",
        }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{
                width: 36, height: 36, border: "3px solid rgba(99,102,241,0.2)",
                borderTopColor: "#6366F1", borderRadius: "50%",
                animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
              }} />
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading logs…</div>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No logs found</div>
              {hasFilters && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 6 }}>Try clearing the filters</div>}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }} className="fade">
                <thead>
                  <tr>
                    {["Time", "Admin", "Action", "Resource", "Details", "IP"].map(h => (
                      <th key={h} style={{
                        padding: "13px 16px", textAlign: "left",
                        fontSize: 10.5, fontWeight: 700, letterSpacing: "1px",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
                        borderBottom: "1px solid rgba(99,102,241,0.12)",
                        background: "#0A0A18", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const t    = fmtTime(log.created_at);
                    const ac   = actionStyle(log.action);
                    const role = log.admin_role;
                    return (
                      <tr key={log.id} className="log-row"
                        style={{ borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>

                        {/* Time */}
                        <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: 13, color: "#E2E8F0", fontWeight: 500 }}>{t.rel}</div>
                          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{t.abs}</div>
                        </td>

                        {/* Admin */}
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: `linear-gradient(135deg,${ROLE_COLORS[role] ?? "#6366F1"}44,${ROLE_COLORS[role] ?? "#6366F1"}22)`,
                              border: `1px solid ${ROLE_COLORS[role] ?? "#6366F1"}44`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 800, color: ROLE_COLORS[role] ?? "#818CF8",
                            }}>
                              {(log.admin?.full_name ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#E2E8F0", whiteSpace: "nowrap" }}>
                                {log.admin?.full_name ?? "Unknown"}
                              </div>
                              <div style={{
                                fontSize: 10, color: ROLE_COLORS[role] ?? "#818CF8",
                                fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                              }}>
                                {role?.replace(/_/g, " ")}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{
                            display: "inline-block", padding: "4px 10px", borderRadius: 6,
                            background: ac.bg, color: ac.color,
                            fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                          }}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Resource */}
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ fontSize: 12.5, color: "#64748B", fontWeight: 500 }}>{log.resource}</div>
                          {log.resource_id && (
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2, fontFamily: "monospace" }}>
                              {log.resource_id.slice(0, 8)}…
                            </div>
                          )}
                        </td>

                        {/* Details */}
                        <td style={{ padding: "13px 16px", maxWidth: 280 }}>
                          <div style={{
                            fontSize: 12.5, color: "#64748B", lineHeight: 1.5,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {log.details ?? "—"}
                          </div>
                        </td>

                        {/* IP */}
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{
                            fontSize: 11.5, color: "rgba(255,255,255,0.25)",
                            fontFamily: "monospace",
                          }}>
                            {log.ip_address ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)" }}>
              Page {page} of {pages} · {total.toLocaleString()} total
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <PagBtn disabled={page === 1} onClick={() => fetchLogs(page - 1)}>← Prev</PagBtn>
              {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                const p = page <= 4 ? i + 1 : page - 3 + i;
                if (p < 1 || p > pages) return null;
                return (
                  <PagBtn key={p} active={p === page} onClick={() => fetchLogs(p)}>
                    {p}
                  </PagBtn>
                );
              })}
              <PagBtn disabled={page === pages} onClick={() => fetchLogs(page + 1)}>Next →</PagBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PagBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode; onClick: () => void;
  disabled?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      border: "1px solid rgba(99,102,241,0.2)",
      background: active ? "linear-gradient(135deg,#4F46E5,#7C3AED)" : "rgba(99,102,241,0.08)",
      color: active ? "#fff" : disabled ? "rgba(255,255,255,0.2)" : "#818CF8",
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
    }}>{children}</button>
  );
}

const lblStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.3)",
  textTransform: "uppercase", letterSpacing: "0.8px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
  color: "#E2E8F0", fontSize: 13, height: 38,
  colorScheme: "dark",
};

const selectStyle: React.CSSProperties = {
  padding: "0 12px", background: "#13131F",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
  color: "#E2E8F0", fontSize: 13, height: 38, minWidth: 150,
  cursor: "pointer",
};
