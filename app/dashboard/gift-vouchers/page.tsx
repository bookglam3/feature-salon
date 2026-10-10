"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal, { FormGroup, Input, ModalActions, BtnPrimary, BtnSecondary } from "../components/Modal";
import { useToast } from "../components/Toast";
import {
  defaultExpiry, formatPence, formatUkDate, parsePoundsToPence, ukToday,
  validateCreateInput, voucherDisplayState, type VoucherDisplayState,
} from "@/app/lib/vouchers/input";

// ─── Types (shapes returned by /api/vouchers) ────────────────────────────────
interface VoucherRow {
  id: string; kind: "money" | "service"; reference: string; status: string; source: string;
  amount_pence: number | null; remaining_pence: number | null; held_pence: number;
  services_total: number; services_used: number; services_held: number;
  buyer_name: string | null; recipient_name: string | null;
  issued_on: string; expires_on: string | null; is_expired: boolean; created_at: string;
}
interface Stats { outstanding_pence: number; held_pence: number; unused_services: number; active_count: number; expired_balance_pence: number }
interface ServiceOption { id: string; name: string; price: number | string | null }
interface ListResponse { salonId: string; vouchers: VoucherRow[]; stats: Stats; canCreate: boolean; services?: ServiceOption[] }
interface VoucherDetail {
  voucher: {
    id: string; kind: "money" | "service"; reference: string; status: string; source: string;
    amount_pence: number | null; remaining_pence: number | null; held_pence: number; available_pence: number | null;
    buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null;
    recipient_name: string | null; recipient_email: string | null; recipient_phone: string | null;
    notes: string | null; issued_on: string; expires_on: string | null; is_expired: boolean;
    cancelled_at: string | null; cancel_reason: string | null; created_at: string;
  };
  services: { id: string; service_name: string; quantity: number; used_quantity: number; held_quantity: number }[];
  redemptions: { id: string; redeemed_at: string; amount_pence: number | null; service_name: string | null; quantity: number | null; expired_override: boolean; note: string | null }[];
  holds: { id: string; amount_pence: number | null; service_name: string | null; quantity: number | null; appointment_at: string | null; client_name: string | null }[];
}

// ─── API ─────────────────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || "Something went wrong. Please try again.", json.code);
  return json as T;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

// ─── Small pieces ────────────────────────────────────────────────────────────
const C = {
  text: "#12101A", muted: "#524D60", faint: "#6B6577", line: "#ECE9F1", purple: "#7C3AED", soft: "#F5F3FF",
  green: "#047857", amber: "#B45309", amberBg: "#FFFBF0", amberLine: "#FDE68A", red: "#B91C1C", redBg: "#FEF2F2", redLine: "#FECACA",
};

const STATE_STYLE: Record<VoucherDisplayState, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",    color: C.green, bg: "rgba(16,185,129,0.12)" },
  used:      { label: "Used up",   color: C.muted, bg: "#F1EFF5" },
  expired:   { label: "Expired",   color: C.amber, bg: C.amberBg },
  cancelled: { label: "Cancelled", color: C.red,   bg: C.redBg },
};

const SOURCE_LABEL: Record<string, string> = {
  physical: "Paper voucher", dashboard: "Added here (generated code)", online: "Bought online", migrated: "Copied from old gift cards",
};

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>{children}</span>;
}

function StateBadge({ state }: { state: VoucherDisplayState }) {
  const s = STATE_STYLE[state];
  return <Badge color={s.color} bg={s.bg}>{s.label}</Badge>;
}

function Notice({ tone, children }: { tone: "error" | "warn" | "info"; children: React.ReactNode }) {
  const t = tone === "error" ? { c: C.red, bg: C.redBg, b: C.redLine } : tone === "warn" ? { c: C.amber, bg: C.amberBg, b: C.amberLine } : { c: "#5B21B6", bg: C.soft, b: "#DDD6FE" };
  return (
    <div role={tone === "error" ? "alert" : undefined} style={{ fontSize: 13, color: t.c, background: t.bg, border: `1px solid ${t.b}`, borderRadius: 10, padding: "10px 14px", lineHeight: 1.5, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" style={{ display: "flex", background: C.line, borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
                   background: value === o.id ? "#FFFFFF" : "transparent", color: value === o.id ? C.purple : C.muted,
                   fontWeight: value === o.id ? 700 : 500, boxShadow: value === o.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** − n + control. onStep gets ±1 so fast double taps both count (callers apply it to the latest state). */
function Stepper({ value, max, onStep, label }: { value: number; max: number; onStep: (delta: 1 | -1) => void; label: string }) {
  const btn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#FFFFFF", color: C.text, fontSize: 16, cursor: "pointer", lineHeight: 1 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button type="button" aria-label={`Fewer ${label}`} style={btn} onClick={() => onStep(-1)} disabled={value <= 0}>−</button>
      <span aria-live="polite" style={{ minWidth: 22, textAlign: "center", fontWeight: 700, color: C.text }}>{value}</span>
      <button type="button" aria-label={`More ${label}`} style={btn} onClick={() => onStep(1)} disabled={value >= max}>+</button>
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 14,
  color: C.text, background: "#FFFFFF", outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
};

function balanceLine(v: Pick<VoucherRow, "kind" | "remaining_pence" | "amount_pence" | "services_total" | "services_used">) {
  if (v.kind === "money") return { main: `${formatPence(v.remaining_pence)} left`, sub: `of ${formatPence(v.amount_pence)}` };
  const left = Math.max(0, v.services_total - v.services_used);
  return { main: `${left} service${left === 1 ? "" : "s"} left`, sub: `of ${v.services_total}` };
}

// ─── Add voucher ─────────────────────────────────────────────────────────────
function AddVoucherModal({ salonId, services, onClose, onCreated }: {
  salonId: string; services: ServiceOption[]; onClose: () => void; onCreated: (v: { id: string; reference: string }) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<"money" | "service">("money");
  const [mode, setMode] = useState<"generate" | "paper">("generate");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [noExpiry, setNoExpiry] = useState(false);
  const [expiresOn, setExpiresOn] = useState(() => defaultExpiry());
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [recipient, setRecipient] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const body = {
      salon_id: salonId, kind, reference_mode: mode, reference, amount,
      services: Object.entries(qty).filter(([, q]) => q > 0).map(([service_id, quantity]) => ({ service_id, quantity })),
      buyer_name: buyer.name, buyer_email: buyer.email, buyer_phone: buyer.phone,
      recipient_name: recipient.name, recipient_email: recipient.email, recipient_phone: recipient.phone,
      notes, expires_on: noExpiry ? null : expiresOn,
    };
    const check = validateCreateInput(body);
    if (!check.ok) { setError(check.error); return; }
    setSaving(true); setError("");
    try {
      const created = await api<{ id: string; reference: string }>("/api/vouchers", { method: "POST", body: JSON.stringify(body) });
      toast.success(`Voucher ${created.reference} added.`);
      onCreated(created);
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  };

  const person = (label: string, value: typeof buyer, set: (v: typeof buyer) => void) => (
    <fieldset style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px 0", margin: "0 0 16px" }}>
      <legend style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, padding: "0 6px" }}>{label} <span style={{ fontWeight: 400 }}>(optional)</span></legend>
      <div className="gv-grid">
        <FormGroup label="Name"><Input value={value.name} maxLength={100} onChange={e => set({ ...value, name: e.target.value })} /></FormGroup>
        <FormGroup label="Email"><Input type="email" value={value.email} maxLength={254} onChange={e => set({ ...value, email: e.target.value })} /></FormGroup>
        <FormGroup label="Phone"><Input type="tel" value={value.phone} maxLength={30} onChange={e => set({ ...value, phone: e.target.value })} /></FormGroup>
      </div>
    </fieldset>
  );

  return (
    <Modal open onClose={onClose} title="Add a gift voucher" maxWidth={600}
      footer={<ModalActions><BtnSecondary type="button" onClick={onClose}>Cancel</BtnSecondary><BtnPrimary type="button" onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add voucher"}</BtnPrimary></ModalActions>}>
      {error && <Notice tone="error">{error}</Notice>}

      <FormGroup label="Voucher type">
        <Segmented value={kind} onChange={setKind} options={[{ id: "money", label: "Money (£)" }, { id: "service", label: "Services" }]} />
      </FormGroup>

      <FormGroup label="Code" hint={mode === "generate" ? "A secure random code like GV-7KQM-4XP2-WR9D is created for you." : "Type the reference printed on the paper voucher. Capital letters don't matter."}>
        <Segmented value={mode} onChange={setMode} options={[{ id: "generate", label: "Generate secure code" }, { id: "paper", label: "Paper voucher reference" }]} />
        {mode === "paper" && (
          <Input value={reference} maxLength={40} placeholder="e.g. 0457 or SPRING-24-012" onChange={e => setReference(e.target.value)} style={{ marginTop: 8 }} aria-label="Paper voucher reference" />
        )}
      </FormGroup>

      {kind === "money" ? (
        <FormGroup label="Amount (£)" hint="Between £0.01 and £5,000.">
          <Input inputMode="decimal" value={amount} placeholder="e.g. 50" onChange={e => setAmount(e.target.value)} />
        </FormGroup>
      ) : (
        <FormGroup label="Services on this voucher">
          {services.length === 0 ? (
            <Notice tone="info">You have no services yet. Add them on the Services page first.</Notice>
          ) : (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, maxHeight: 260, overflowY: "auto" }}>
              {services.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderTop: i ? `1px solid ${C.line}` : "none", background: (qty[s.id] ?? 0) > 0 ? C.soft : "#FFFFFF" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    {s.price !== null && s.price !== "" && <div style={{ fontSize: 12, color: C.faint }}>{formatPence(Math.round(Number(s.price) * 100))}</div>}
                  </div>
                  <Stepper label={s.name} value={qty[s.id] ?? 0} max={50}
                    onStep={d => setQty(q => ({ ...q, [s.id]: Math.min(50, Math.max(0, (q[s.id] ?? 0) + d)) }))} />
                </div>
              ))}
            </div>
          )}
        </FormGroup>
      )}

      <FormGroup label="Expiry" hint={noExpiry ? "This voucher never expires." : "Valid until the end of this day (UK time). Default: 12 months."}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Input type="date" value={expiresOn} min={ukToday()} disabled={noExpiry} onChange={e => setExpiresOn(e.target.value)} style={{ maxWidth: 200, opacity: noExpiry ? 0.5 : 1 }} aria-label="Expiry date" />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} /> No expiry
          </label>
        </div>
      </FormGroup>

      {person("Bought by", buyer, setBuyer)}
      {person("For (recipient)", recipient, setRecipient)}

      <FormGroup label="Notes (optional)">
        <textarea value={notes} maxLength={1000} rows={2} onChange={e => setNotes(e.target.value)} style={textareaStyle} />
      </FormGroup>
    </Modal>
  );
}

// ─── Voucher detail: redeem, goodwill, cancel, history ───────────────────────
function VoucherDetailModal({ salonId, voucherId, onClose, onChanged }: {
  salonId: string; voucherId: string; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<VoucherDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [svcQty, setSvcQty] = useState<Record<string, number>>({});
  const [goodwill, setGoodwill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let alive = true;
    api<VoucherDetail>(`/api/vouchers/${voucherId}?salon_id=${encodeURIComponent(salonId)}`)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setLoadError(errorText(e)); });
    return () => { alive = false; };
  }, [salonId, voucherId]);

  const v = data?.voucher;
  const cancelled = v?.status === "cancelled";
  const expired = !!v?.is_expired && !cancelled;
  const canAct = !!v && !cancelled && (!expired || goodwill);

  const redeem = async (payload: Record<string, unknown>, success: (d: VoucherDetail) => string) => {
    setBusy(true); setActionError("");
    try {
      const res = await api<{ voucher: VoucherDetail | null }>(`/api/vouchers/${voucherId}/redeem`, {
        method: "POST", body: JSON.stringify({ salon_id: salonId, note, expired_override: goodwill, ...payload }),
      });
      if (res.voucher) setData(res.voucher);
      setAmount(""); setNote(""); setSvcQty({}); setGoodwill(false);
      toast.success(res.voucher ? success(res.voucher) : "Redeemed.");
      onChanged();
    } catch (e) {
      setActionError(errorText(e));
      if (e instanceof ApiError && e.code === "voucher_expired") setGoodwill(false);
    } finally {
      setBusy(false);
    }
  };

  const redeemAmount = () => {
    if (!v) return;
    const pence = parsePoundsToPence(amount);
    if (pence === null || pence < 1) { setActionError("Enter the amount to take off, e.g. 25 or 12.50."); return; }
    if (v.available_pence !== null && pence > v.available_pence) { setActionError(`Only ${formatPence(v.available_pence)} is available on this voucher.`); return; }
    redeem({ type: "amount", amount }, d => `${formatPence(pence)} redeemed. ${formatPence(d.voucher.remaining_pence)} left.`);
  };

  const redeemService = (lineId: string, name: string, quantity: number) => {
    redeem({ type: "service", voucher_service_id: lineId, quantity }, () => `${quantity} × ${name} marked as used.`);
  };

  const cancelVoucher = async () => {
    setBusy(true); setActionError("");
    try {
      const res = await api<{ voucher: VoucherDetail | null }>(`/api/vouchers/${voucherId}/cancel`, {
        method: "POST", body: JSON.stringify({ salon_id: salonId, reason }),
      });
      if (res.voucher) setData(res.voucher);
      setCancelOpen(false); setReason("");
      toast.success("Voucher cancelled.");
      onChanged();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const copyRef = () => {
    if (!v) return;
    navigator.clipboard?.writeText(v.reference).then(() => toast.success("Code copied."), () => toast.error("Couldn't copy — select the code instead."));
  };

  const history: { at: string; title: string; detail?: string | null; tag?: string }[] = [];
  if (data && v) {
    for (const r of data.redemptions) {
      history.push({
        at: r.redeemed_at,
        title: r.amount_pence !== null ? `Redeemed ${formatPence(r.amount_pence)}` : `Used ${r.quantity} × ${r.service_name ?? "service"}`,
        detail: r.note, tag: r.expired_override ? "Goodwill after expiry" : undefined,
      });
    }
    if (v.cancelled_at) history.push({ at: v.cancelled_at, title: "Cancelled", detail: v.cancel_reason });
    history.push({ at: v.created_at, title: `Added — ${SOURCE_LABEL[v.source] ?? v.source}`, detail: v.kind === "money" ? `Value ${formatPence(v.amount_pence)}` : null });
    history.sort((a, b) => b.at.localeCompare(a.at));
  }
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const state = v ? voucherDisplayState({
    status: v.status, kind: v.kind, is_expired: v.is_expired, remaining_pence: v.remaining_pence,
    services_total: data!.services.reduce((s, x) => s + x.quantity, 0), services_used: data!.services.reduce((s, x) => s + x.used_quantity, 0),
  }) : "active";

  return (
    <Modal open onClose={onClose} title="Gift voucher" side="right" maxWidth={560}>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      {!data && !loadError && <div style={{ padding: "40px 0", textAlign: "center", color: C.muted }}>Loading…</div>}
      {data && v && (
        <div>
          {/* Code + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: 1, wordBreak: "break-all" }}>{v.reference}</span>
            <button type="button" onClick={copyRef} style={{ padding: "4px 10px", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.purple, cursor: "pointer" }}>Copy</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            <Badge color={C.purple} bg="rgba(124,58,237,0.10)">{v.kind === "money" ? "Money" : "Services"}</Badge>
            <StateBadge state={state} />
          </div>

          {/* Balance */}
          <div style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            {v.kind === "money" ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>{formatPence(v.remaining_pence)} <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>left of {formatPence(v.amount_pence)}</span></div>
                {v.held_pence > 0 && <div style={{ fontSize: 12.5, color: C.amber, marginTop: 4 }}>{formatPence(v.held_pence)} on hold for upcoming bookings · {formatPence(v.available_pence)} available now</div>}
              </>
            ) : (
              data.services.map(s => {
                const left = s.quantity - s.used_quantity;
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.service_name}</span>
                    <span style={{ fontSize: 13, color: left > 0 ? C.text : C.faint, whiteSpace: "nowrap" }}>
                      {left} of {s.quantity} left{s.held_quantity > 0 ? ` · ${s.held_quantity} on hold` : ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Details */}
          <dl className="gv-dl">
            <dt>Expires</dt>
            <dd style={{ color: expired ? C.amber : C.text, fontWeight: expired ? 700 : 500 }}>{v.expires_on ? `${formatUkDate(v.expires_on)}${expired ? " (expired)" : ""}` : "No expiry"}</dd>
            <dt>Issued</dt><dd>{formatUkDate(v.issued_on)}</dd>
            {(v.buyer_name || v.buyer_email || v.buyer_phone) && <><dt>Bought by</dt><dd>{[v.buyer_name, v.buyer_email, v.buyer_phone].filter(Boolean).join(" · ")}</dd></>}
            {(v.recipient_name || v.recipient_email || v.recipient_phone) && <><dt>For</dt><dd>{[v.recipient_name, v.recipient_email, v.recipient_phone].filter(Boolean).join(" · ")}</dd></>}
            {v.notes && <><dt>Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{v.notes}</dd></>}
          </dl>

          {actionError && <Notice tone="error">{actionError}</Notice>}

          {/* Expired: goodwill needs an explicit extra step */}
          {expired && !goodwill && (
            <Notice tone="warn">
              This voucher expired on {formatUkDate(v.expires_on)}, so it can&apos;t be redeemed as normal.
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => { setGoodwill(true); setActionError(""); }} style={{ padding: "8px 14px", background: "#FFFFFF", border: `1px solid ${C.amberLine}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: C.amber, cursor: "pointer" }}>
                  Redeem as goodwill…
                </button>
              </div>
            </Notice>
          )}
          {expired && goodwill && (
            <Notice tone="warn">
              <strong>Goodwill redemption.</strong> This will be recorded in the voucher&apos;s history as used after it expired.{" "}
              <button type="button" onClick={() => setGoodwill(false)} style={{ background: "none", border: "none", padding: 0, color: C.purple, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Don&apos;t redeem</button>
            </Notice>
          )}

          {/* Redeem */}
          {canAct && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Redeem</div>
              {v.kind === "money" ? (
                (v.available_pence ?? 0) > 0 ? (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Input inputMode="decimal" aria-label="Amount to take off (£)" placeholder="Amount (£)" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: "1 1 140px", width: "auto" }} />
                      <BtnSecondary type="button" onClick={() => setAmount(((v.available_pence ?? 0) / 100).toFixed(2))} style={{ flex: "0 0 auto" }}>All {formatPence(v.available_pence)}</BtnSecondary>
                    </div>
                    <Input aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500} value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 8 }} />
                    <BtnPrimary type="button" disabled={busy} onClick={redeemAmount} style={{ width: "100%", marginTop: 10 }}>
                      {busy ? "Saving…" : goodwill ? "Confirm goodwill redemption" : "Redeem amount"}
                    </BtnPrimary>
                  </>
                ) : <div style={{ fontSize: 13, color: C.muted }}>Nothing left to redeem{v.held_pence > 0 ? " — the rest is on hold for upcoming bookings" : ""}.</div>
              ) : (
                <>
                  {data.services.map(s => {
                    const avail = s.quantity - s.used_quantity - s.held_quantity;
                    const n = Math.min(svcQty[s.id] ?? 1, Math.max(avail, 1));
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.line}`, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: avail > 0 ? C.text : C.faint }}>{s.service_name}</span>
                        {avail > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {avail > 1 && <Stepper label={s.service_name} value={n} max={avail}
                              onStep={d => setSvcQty(q => ({ ...q, [s.id]: Math.min(avail, Math.max(1, (q[s.id] ?? 1) + d)) }))} />}
                            <BtnPrimary type="button" disabled={busy} onClick={() => redeemService(s.id, s.service_name, n)} style={{ flex: "0 0 auto", padding: "8px 14px", fontSize: 13 }}>
                              {goodwill ? "Confirm goodwill use" : "Mark used"}
                            </BtnPrimary>
                          </div>
                        ) : <span style={{ fontSize: 12.5, color: C.faint }}>{s.held_quantity > 0 ? "Rest on hold" : "All used"}</span>}
                      </div>
                    );
                  })}
                  <Input aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500} value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 8 }} />
                </>
              )}
            </div>
          )}

          {/* Holds */}
          {data.holds.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Applied to upcoming bookings</div>
              {data.holds.map(h => (
                <div key={h.id} style={{ fontSize: 13, color: C.text, padding: "8px 12px", background: C.amberBg, border: `1px solid ${C.amberLine}`, borderRadius: 10, marginBottom: 6 }}>
                  {h.amount_pence !== null ? formatPence(h.amount_pence) : `${h.quantity} × ${h.service_name ?? "service"}`}
                  {h.client_name ? ` · ${h.client_name}` : ""}{h.appointment_at ? ` · ${when(h.appointment_at)}` : ""}
                </div>
              ))}
            </div>
          )}

          {/* History */}
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>History</div>
          <ol style={{ listStyle: "none", padding: 0, margin: "0 0 18px" }}>
            {history.map((h, i) => (
              <li key={i} style={{ padding: "10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{h.title}</span>
                  <span style={{ fontSize: 12, color: C.faint }}>{when(h.at)}</span>
                </div>
                {h.tag && <div style={{ marginTop: 4 }}><Badge color={C.amber} bg={C.amberBg}>{h.tag}</Badge></div>}
                {h.detail && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, whiteSpace: "pre-wrap" }}>{h.detail}</div>}
              </li>
            ))}
          </ol>

          {/* Cancel */}
          {!cancelled && (
            cancelOpen ? (
              <div style={{ border: `1px solid ${C.redLine}`, background: C.redBg, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>Cancel this voucher?</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>It can&apos;t be used after this. The reason is saved in the history.</div>
                <textarea aria-label="Reason for cancelling" placeholder="Reason (required), e.g. refunded to buyer" value={reason} maxLength={500} rows={2} onChange={e => setReason(e.target.value)} style={textareaStyle} />
                <ModalActions>
                  <BtnSecondary type="button" onClick={() => { setCancelOpen(false); setReason(""); }}>Keep voucher</BtnSecondary>
                  <BtnPrimary type="button" disabled={busy || reason.trim().length < 3} onClick={cancelVoucher} style={{ background: C.red, boxShadow: "none" }}>
                    {busy ? "Cancelling…" : "Cancel voucher"}
                  </BtnPrimary>
                </ModalActions>
              </div>
            ) : (
              <button type="button" onClick={() => { setCancelOpen(true); setActionError(""); }} style={{ background: "none", border: "none", padding: 0, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancel voucher…
              </button>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
// Toasts are shown from the modals: they render inside DashboardShell's
// ToastProvider, this page component does not.
export default function GiftVouchersPage() {
  const router = useRouter();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [query, setQuery] = useState("");
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [listError, setListError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const seq = useRef(0);
  const firstLoad = useRef(true);

  useEffect(() => {
    getCurrentUserProfile().then(profile => {
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
    });
  }, [router]);

  const load = useCallback(async (q: string) => {
    if (!salonId) return;
    const mine = ++seq.current;
    const isFirst = firstLoad.current;
    setSearching(true);
    try {
      const params = new URLSearchParams({ salon_id: salonId });
      if (q.trim()) params.set("q", q.trim());
      if (isFirst) params.set("include", "services");
      const data = await api<ListResponse>(`/api/vouchers?${params}`);
      if (mine !== seq.current) return; // a newer search already answered
      setVouchers(data.vouchers); setStats(data.stats); setCanCreate(data.canCreate); setListError("");
      if (data.services) setServices(data.services);
      if (isFirst) {
        firstLoad.current = false;
        // Arrived from the old Gift Cards page's "+ Gift Card" button
        if (new URLSearchParams(window.location.search).get("new") === "1") {
          if (data.canCreate) setShowAdd(true);
          router.replace("/dashboard/gift-vouchers");
        }
      }
    } catch (e) {
      if (mine === seq.current) setListError(errorText(e));
    } finally {
      if (mine === seq.current) { setSearching(false); setLoading(false); }
    }
  }, [salonId, router]);

  useEffect(() => {
    if (!salonId) return;
    const t = setTimeout(() => load(query), firstLoad.current ? 0 : 300);
    return () => clearTimeout(t);
  }, [salonId, query, load]);

  const closeAdd = useCallback(() => setShowAdd(false), []);
  const closeDetail = useCallback(() => setOpenId(null), []);
  const refresh = useCallback(() => { load(query); }, [load, query]);
  const created = useCallback((v: { id: string; reference: string }) => {
    setShowAdd(false);
    setOpenId(v.id);
    load(query);
  }, [load, query]);

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: `1px solid ${C.line}`, padding: "0 16px", minHeight: 62, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <HamburgerBtn />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Gift Vouchers</div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>Add, find and redeem vouchers</div>
        </div>
      </div>
      <button type="button" onClick={() => setShowAdd(true)} disabled={!canCreate}
        title={canCreate ? undefined : "Adding vouchers is part of the Pro and Business plans"}
        style={{ padding: "9px 16px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : 0.45, whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
        + Add voucher
      </button>
    </header>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <style>{`
        .gv-wrap { padding: 24px 24px 48px; max-width: 1100px; margin: 0 auto; }
        .gv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .gv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); column-gap: 10px; }
        .gv-row { width: 100%; text-align: left; background: #FFFFFF; border: 1px solid #ECE9F1; border-radius: 14px; padding: 14px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; transition: border-color .12s, box-shadow .12s; }
        .gv-row:hover, .gv-row:focus-visible { border-color: #C4B5FD; box-shadow: 0 4px 16px -8px rgba(124,58,237,.35); outline: none; }
        .gv-dl { display: grid; grid-template-columns: 96px 1fr; gap: 6px 12px; margin: 0 0 16px; font-size: 13px; }
        .gv-dl dt { color: #6B6577; } .gv-dl dd { margin: 0; color: #12101A; word-break: break-word; }
        @media (max-width: 599px) { .gv-wrap { padding: 16px 16px 40px; } }
      `}</style>
      <div className="gv-wrap">
        {!loading && !canCreate && (
          <Notice tone="info">Adding vouchers is part of the <strong>Pro</strong> and <strong>Business</strong> plans. You can still find and redeem vouchers you&apos;ve already sold.</Notice>
        )}

        {/* Stats */}
        <div className="gv-stats">
          {[
            { label: "Outstanding balance", value: stats ? formatPence(stats.outstanding_pence) : "—",
              sub: stats ? (stats.held_pence > 0 ? `${formatPence(stats.held_pence)} of it on hold for bookings` : "Nothing on hold") : "" },
            { label: "Active vouchers", value: stats ? String(stats.active_count) : "—", sub: "With money or services left" },
            { label: "Unused services", value: stats ? String(stats.unused_services) : "—", sub: "On service vouchers" },
            ...(stats && stats.expired_balance_pence > 0
              ? [{ label: "Expired, not used", value: formatPence(stats.expired_balance_pence), sub: "Not counted above" }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: C.text, marginTop: 6, letterSpacing: "-0.5px" }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Input type="search" value={query} onChange={e => setQuery(e.target.value)} maxLength={100}
            placeholder="Search by code/reference or buyer/recipient name" aria-label="Search vouchers"
            style={{ padding: "12px 14px", fontSize: 14.5, borderRadius: 12 }} />
          {searching && !loading && <span style={{ position: "absolute", right: 14, top: 13, fontSize: 12, color: C.faint }}>Searching…</span>}
        </div>

        {listError && <Notice tone="error">{listError} <button type="button" onClick={refresh} style={{ background: "none", border: "none", color: C.purple, fontWeight: 700, cursor: "pointer", padding: 0 }}>Try again</button></Notice>}

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: C.muted }}>Loading…</div>
        ) : vouchers.length === 0 && !listError ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: C.muted, background: "#FFFFFF", border: `1px dashed ${C.line}`, borderRadius: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{query.trim() ? "No vouchers match your search" : "No gift vouchers yet"}</div>
            <div style={{ fontSize: 13 }}>{query.trim() ? "Try part of the code or a name." : canCreate ? "Add one with “+ Add voucher” — paper or with a generated code." : ""}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {vouchers.map(v => {
              const b = balanceLine(v);
              const names = [v.buyer_name, v.recipient_name].filter(Boolean).join(" → ");
              return (
                <button key={v.id} type="button" className="gv-row" onClick={() => setOpenId(v.id)}>
                  <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14.5, fontWeight: 800, color: C.text, letterSpacing: 0.5, wordBreak: "break-all" }}>{v.reference}</span>
                      <StateBadge state={voucherDisplayState(v)} />
                    </div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                      {names || (v.kind === "money" ? "Money voucher" : "Service voucher")}
                      {" · "}{v.expires_on ? `${v.is_expired ? "Expired" : "Expires"} ${formatUkDate(v.expires_on)}` : "No expiry"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{b.main}</div>
                    <div style={{ fontSize: 12, color: C.faint }}>{b.sub}{v.held_pence > 0 || v.services_held > 0 ? " · some on hold" : ""}</div>
                  </div>
                </button>
              );
            })}
            {vouchers.length === 50 && <div style={{ fontSize: 12.5, color: C.faint, textAlign: "center", padding: 8 }}>Showing the first 50 — search to narrow down.</div>}
          </div>
        )}
      </div>

      {showAdd && salonId && <AddVoucherModal salonId={salonId} services={services} onClose={closeAdd} onCreated={created} />}
      {openId && salonId && <VoucherDetailModal salonId={salonId} voucherId={openId} onClose={closeDetail} onChanged={refresh} />}
    </DashboardShell>
  );
}
