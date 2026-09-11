"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "../components/Modal";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { describeReward, normaliseEmail, type RewardType } from "@/app/lib/loyalty";

/* ────────────────────────────────────────────────────────────────
   Visit-based loyalty (stamp card).

   Visits are COUNTED, never stored — they come from the
   loyalty_progress view, which counts completed appointments since
   the client's last redemption. Nothing on this page writes a visit
   count, so the numbers cannot drift from the bookings they derive
   from. The only writes here are the settings row and a redemption.

   The previous points system (loyalty_points / loyalty_transactions)
   is no longer read or written by this page. Those tables are
   deliberately left in place and untouched.
   ──────────────────────────────────────────────────────────────── */

interface Settings {
  salon_id: string;
  enabled: boolean;
  visits_required: number;
  reward_type: RewardType;
  reward_service_id: string | null;
  reward_value: number | null;
  reward_description: string | null;
}

interface ProgressRow {
  salon_id: string;
  client_email: string;
  client_name: string | null;
  visits: number;
  lifetime_visits: number;
  last_visit_at: string | null;
  rewards_redeemed: number;
  last_redeemed_at: string | null;
}

interface ServiceLite { id: string; name: string }

const DEFAULT_SETTINGS: Omit<Settings, "salon_id"> = {
  enabled: false,
  visits_required: 5,
  reward_type: "custom",
  reward_service_id: null,
  reward_value: null,
  reward_description: "",
};

const AVATAR_COLORS = ["#7C3AED", "#6D28D9", "#8B5CF6", "#A78BFA", "#EC4899"];
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const bg = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  const initials = (name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:800, color:"#fff", flexShrink:0 }}>
      {initials}
    </div>
  );
}

/* Stamp dots up to 10 required; beyond that a bar stays readable. */
function StampProgress({ visits, required }: { visits: number; required: number }) {
  const done = Math.min(visits, required);
  if (required <= 10) {
    return (
      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
        {Array.from({ length: required }).map((_, i) => (
          <span key={i} style={{
            width:11, height:11, borderRadius:"50%", flexShrink:0,
            background: i < done ? "#7C3AED" : "transparent",
            border: i < done ? "1px solid #7C3AED" : "1px solid #ECE9F1",
          }} />
        ))}
      </div>
    );
  }
  const pct = required > 0 ? (done / required) * 100 : 0;
  return (
    <div style={{ width:110, height:6, background:"#ECE9F1", borderRadius:99, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:"#7C3AED", borderRadius:99 }} />
    </div>
  );
}

function LoyaltyContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string|null>(null);
  const [salonName, setSalonName] = useState("");
  const [settings, setSettings] = useState<Settings|null>(null);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState<Omit<Settings, "salon_id">>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  const [redeemTarget, setRedeemTarget] = useState<ProgressRow|null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async (sid: string) => {
    const [{ data: s }, { data: svcs }, { data: progress }] = await Promise.all([
      supabase.from("loyalty_settings").select("*").eq("salon_id", sid).maybeSingle(),
      supabase.from("services").select("id, name").eq("salon_id", sid).order("name"),
      supabase.from("loyalty_progress").select("*").eq("salon_id", sid).order("visits", { ascending: false }),
    ]);
    setSettings(s ?? null);
    setForm(s ? {
      enabled: s.enabled,
      visits_required: s.visits_required,
      reward_type: s.reward_type,
      reward_service_id: s.reward_service_id,
      reward_value: s.reward_value,
      reward_description: s.reward_description ?? "",
    } : DEFAULT_SETTINGS);
    setServices(svcs ?? []);
    setRows(progress ?? []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      await load(profile.salon.id);
      setLoading(false);
    };
    init();
  }, [router, load]);

  const required = settings?.visits_required ?? 0;
  const enabled  = !!settings?.enabled;

  const rewardText = useMemo(() => {
    if (!settings) return "";
    const svc = services.find(s => s.id === settings.reward_service_id);
    return describeReward(settings, svc?.name ?? null);
  }, [settings, services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.client_name ?? "").toLowerCase().includes(q) ||
      r.client_email.toLowerCase().includes(q));
  }, [rows, search]);

  /* Every figure below is derived from real rows — no placeholders. */
  const withProgress  = rows.filter(r => r.visits > 0).length;
  const rewardsReady  = required > 0 ? rows.filter(r => r.visits >= required).length : 0;
  const totalRedeemed = rows.reduce((s, r) => s + (r.rewards_redeemed || 0), 0);

  const handleSaveSettings = async () => {
    if (!salonId) return;
    // Mirror the DB CHECK constraint so the owner gets a clear message
    // instead of a Postgres error.
    if (form.reward_type === "free_service" && !form.reward_service_id) {
      toast.error("Pick which service is free"); return;
    }
    if ((form.reward_type === "amount_off" || form.reward_type === "percent_off") &&
        (form.reward_value === null || Number.isNaN(form.reward_value))) {
      toast.error("Enter the reward amount"); return;
    }
    if (form.reward_type === "percent_off" && (form.reward_value ?? 0) > 100) {
      toast.error("A percentage can't be over 100"); return;
    }
    if (form.reward_type === "custom" && !form.reward_description?.trim()) {
      toast.error("Describe the reward"); return;
    }
    setSaving(true);
    const payload = {
      salon_id: salonId,
      enabled: form.enabled,
      visits_required: form.visits_required,
      reward_type: form.reward_type,
      // Only the field this reward_type uses is persisted; the others are
      // nulled so a stale value from a previous type can never be shown.
      reward_service_id: form.reward_type === "free_service" ? form.reward_service_id : null,
      reward_value: (form.reward_type === "amount_off" || form.reward_type === "percent_off") ? form.reward_value : null,
      reward_description: form.reward_type === "custom" ? form.reward_description?.trim() ?? "" : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("loyalty_settings").upsert(payload, { onConflict: "salon_id" });
    setSaving(false);
    if (error) { toast.error("Couldn't save settings"); return; }
    await load(salonId);
    setShowSettings(false);
    toast.success("Loyalty settings saved");
  };

  const handleRedeem = async () => {
    if (!salonId || !redeemTarget || required <= 0) return;
    setRedeeming(true);
    const email = normaliseEmail(redeemTarget.client_email);
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();

    // The card row carries the watermark. Upsert because a client who has
    // never redeemed has no card row yet — their progress came straight
    // from completed appointments.
    const { error: cardErr } = await supabase.from("loyalty_cards").upsert({
      salon_id: salonId,
      client_email: email,
      client_name: redeemTarget.client_name,
      last_redeemed_at: now,
      rewards_redeemed: (redeemTarget.rewards_redeemed || 0) + 1,
      updated_at: now,
    }, { onConflict: "salon_id,client_email" });

    if (cardErr) { setRedeeming(false); toast.error("Couldn't record the redemption"); return; }

    // Audit row. reward_snapshot freezes what the reward was at this moment,
    // so later settings changes can't rewrite history.
    await supabase.from("loyalty_redemptions").insert({
      salon_id: salonId,
      client_email: email,
      client_name: redeemTarget.client_name,
      redeemed_at: now,
      redeemed_by: user?.id ?? null,
      visits_at_redemption: redeemTarget.visits,
      reward_snapshot: settings ? {
        reward_type: settings.reward_type,
        reward_value: settings.reward_value,
        reward_description: settings.reward_description,
        reward_service_id: settings.reward_service_id,
        reward_text: rewardText,
        visits_required: settings.visits_required,
      } : null,
    });

    await load(salonId);
    setRedeeming(false);
    setRedeemTarget(null);
    toast.success("Reward redeemed — counter reset");
  };

  const Topbar = (
    <header style={{ background:"#FFFFFF", borderBottom:"1px solid #ECE9F1", padding:"0 24px", height:66, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 3px rgba(18,16,26,0.04)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>Loyalty</div>
          <div style={{ fontSize:11.5, color:"#6B6577", marginTop:1 }}>Stamp card — one stamp per completed visit</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => setShowSettings(true)} style={{ padding:"9px 14px", background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:12, fontSize:13, fontWeight:700, color:"#524D60", cursor:"pointer" }}>Settings</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:10, padding:"7px 14px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" style={{ background:"none", border:"none", outline:"none", fontSize:13, color:"#12101A", fontFamily:"inherit", width:160 }} />
        </div>
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding:40, textAlign:"center", color:"#6B6577" }}>Loading loyalty…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <style>{`.loy-row:hover { background:#FAF9FC; }`}</style>
      <div style={{ padding:"28px 24px", maxWidth:1360, margin:"0 auto" }}>

        {/* ── Stat cards — all four from real rows ── */}
        <div className="dash-stats" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:13, marginBottom:22 }}>
          <StatCard label="Programme" value={enabled ? "On" : "Off"} icon="🎟️" color={enabled ? "green" : "slate"}
            sub={enabled ? `${required} visits → ${rewardText}` : "not running"} />
          <StatCard label="Clients with progress" value={withProgress} icon="👥" color="indigo"
            sub={withProgress === 1 ? "has a stamp" : "have at least one stamp"} />
          <StatCard label="Rewards ready" value={rewardsReady} icon="🎁" color={rewardsReady > 0 ? "amber" : "slate"}
            sub={enabled ? (rewardsReady === 0 ? "none at the threshold" : "waiting to be redeemed") : "programme off"} />
          <StatCard label="Rewards redeemed" value={totalRedeemed} icon="✅" color="green"
            sub={totalRedeemed === 0 ? "no redemptions yet" : "all time"} />
        </div>

        {/* Programme-off notice — honest, not a fake preview. */}
        {!enabled && (
          <div style={{ background:"#F5F3FF", border:"1px solid #ECE9F1", borderRadius:14, padding:"16px 20px", marginBottom:22 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:"#12101A", marginBottom:4 }}>The stamp card is switched off</div>
            <div style={{ fontSize:12.5, color:"#524D60", lineHeight:1.6 }}>
              Visits below are still counted from completed appointments, so nothing is lost while it&apos;s off.
              Clients see no loyalty message in their emails until you turn it on.
            </div>
          </div>
        )}

        {/* ── Client progress ── */}
        <div style={{ background:"#FFFFFF", border:"1px solid #ECE9F1", borderRadius:20, overflow:"hidden", boxShadow:"0 1px 2px rgba(18,16,26,0.03)" }}>
          <div style={{ padding:"16px 22px", borderBottom:"1px solid #ECE9F1" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>
              Client progress <span style={{ fontSize:12, color:"#6B6577", fontWeight:600 }}>({filtered.length})</span>
            </div>
            <div style={{ fontSize:11, color:"#6B6577", marginTop:3 }}>
              Counted from completed appointments since each client&apos;s last reward
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="🎟️"
              title={search ? "No matching clients" : "No completed visits yet"}
              description={search
                ? "Try a different search term"
                : "A client appears here once one of their appointments is marked completed in Bookings."} />
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
                <thead>
                  <tr style={{ background:"#F5F3FF" }}>
                    {["Client","Progress","Visits","Redeemed","Last visit",""].map(h => (
                      <th key={h} style={{ fontSize:10, fontWeight:900, color:"#6B6577", textAlign:"left", padding:"11px 16px", letterSpacing:"0.8px", textTransform:"uppercase", borderBottom:"1px solid #ECE9F1" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const ready = enabled && required > 0 && r.visits >= required;
                    return (
                      <tr key={`${r.salon_id}:${r.client_email}`} className="loy-row" style={{ transition:"background 0.1s" }}>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <Avatar name={r.client_name || r.client_email} size={36} />
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:13.5, fontWeight:800, color:"#12101A" }}>{r.client_name || "Unnamed client"}</div>
                              <div style={{ fontSize:11.5, color:"#6B6577" }}>{r.client_email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1" }}>
                          {required > 0
                            ? <StampProgress visits={r.visits} required={required} />
                            : <span style={{ fontSize:12, color:"#6B6577" }}>—</span>}
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:14, fontWeight:800, color:"#12101A", whiteSpace:"nowrap" }}>
                          {required > 0 ? `${r.visits} / ${required}` : r.visits}
                          {ready && (
                            <span style={{ marginLeft:8, fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:99, background:"rgba(245,158,11,0.12)", color:"#92400E", border:"1px solid rgba(245,158,11,0.25)" }}>READY</span>
                          )}
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:13, color:"#524D60", fontWeight:700 }}>{r.rewards_redeemed || 0}</td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:12.5, color:"#524D60", whiteSpace:"nowrap" }}>
                          {r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "—"}
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", textAlign:"right" }}>
                          <button
                            onClick={() => setRedeemTarget(r)}
                            disabled={!ready}
                            title={!enabled ? "Turn the programme on first" : !ready ? `Needs ${required - r.visits} more visit${required - r.visits === 1 ? "" : "s"}` : undefined}
                            style={{
                              padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:700,
                              border:"none", whiteSpace:"nowrap",
                              background: ready ? "linear-gradient(135deg,#7C3AED,#6D28D9)" : "#F5F3FF",
                              color: ready ? "#fff" : "#6B6577",
                              cursor: ready ? "pointer" : "not-allowed",
                            }}>
                            Redeem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Settings ──
          Inside <Modal> the CSS custom properties resolve against :root,
          not .ds-layout (the portal token trap in DASHBOARD_RESTYLE_RULES),
          so every colour in here is a literal. */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Loyalty settings" maxWidth={460}
        footer={
          <ModalActions>
            <BtnSecondary onClick={() => setShowSettings(false)}>Cancel</BtnSecondary>
            <BtnPrimary onClick={handleSaveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</BtnPrimary>
          </ModalActions>
        }>
        <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:12, border:"1.5px solid #ECE9F1", background:"#F5F3FF", cursor:"pointer", marginBottom:16 }}>
          <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} style={{ width:16, height:16, accentColor:"#7C3AED" }} />
          <span style={{ fontSize:13.5, fontWeight:700, color:"#12101A" }}>Run the stamp card</span>
        </label>

        <FormGroup label="Visits needed for a reward" hint="Counted from completed appointments only — no-shows and cancellations don't earn a stamp.">
          <Input type="number" min={2} max={100} value={form.visits_required}
            onChange={e => setForm({ ...form, visits_required: parseInt(e.target.value) || 0 })} />
        </FormGroup>

        <FormGroup label="Reward">
          <Select value={form.reward_type}
            onChange={e => setForm({ ...form, reward_type: e.target.value as RewardType })}>
            <option value="free_service">Free service</option>
            <option value="amount_off">£ off</option>
            <option value="percent_off">% off</option>
            <option value="custom">Something else</option>
          </Select>
        </FormGroup>

        {form.reward_type === "free_service" && (
          <FormGroup label="Which service is free?"
            hint={services.length === 0 ? "You have no services yet — add one in Services first." : undefined}>
            <Select value={form.reward_service_id ?? ""}
              onChange={e => setForm({ ...form, reward_service_id: e.target.value || null })}>
              <option value="">Choose a service…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormGroup>
        )}

        {(form.reward_type === "amount_off" || form.reward_type === "percent_off") && (
          <FormGroup label={form.reward_type === "amount_off" ? "Amount off (£)" : "Percentage off (%)"}>
            <Input type="number" min={0} max={form.reward_type === "percent_off" ? 100 : undefined}
              value={form.reward_value ?? ""}
              onChange={e => setForm({ ...form, reward_value: e.target.value === "" ? null : parseFloat(e.target.value) })} />
          </FormGroup>
        )}

        {form.reward_type === "custom" && (
          <FormGroup label="Describe the reward" hint="Clients see this wording in their emails.">
            <Input value={form.reward_description ?? ""} placeholder="e.g. a free treatment upgrade"
              onChange={e => setForm({ ...form, reward_description: e.target.value })} />
          </FormGroup>
        )}

        <div style={{ marginTop:8, padding:"12px 14px", borderRadius:12, background:"#F5F3FF", border:"1px solid #ECE9F1" }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#6D28D9", letterSpacing:"1px", textTransform:"uppercase", marginBottom:5 }}>Clients will read</div>
          <div style={{ fontSize:12.5, color:"#12101A", lineHeight:1.6 }}>
            {form.enabled
              ? `You're at 2 of ${form.visits_required || "…"} visits — ${Math.max(0, (form.visits_required || 0) - 2)} more for ${describeReward(form, services.find(s => s.id === form.reward_service_id)?.name ?? null)}.`
              : "Nothing — the programme is off, so no loyalty message is added to their emails."}
          </div>
        </div>
      </Modal>

      {/* ── Redeem confirmation ── */}
      <Modal open={!!redeemTarget} onClose={() => setRedeemTarget(null)} title="Redeem reward" maxWidth={420}
        footer={
          <ModalActions>
            <BtnSecondary onClick={() => setRedeemTarget(null)}>Cancel</BtnSecondary>
            <BtnPrimary onClick={handleRedeem} disabled={redeeming}>{redeeming ? "Redeeming…" : "Confirm redemption"}</BtnPrimary>
          </ModalActions>
        }>
        {redeemTarget && (
          <div style={{ fontSize:13.5, color:"#12101A", lineHeight:1.7 }}>
            <div style={{ marginBottom:12 }}>
              <strong>{redeemTarget.client_name || redeemTarget.client_email}</strong> has
              {" "}{redeemTarget.visits} of {required} visits.
            </div>
            <div style={{ padding:"12px 14px", borderRadius:12, background:"#F5F3FF", border:"1px solid #ECE9F1", marginBottom:12 }}>
              Reward: <strong>{rewardText}</strong>
            </div>
            <div style={{ fontSize:12.5, color:"#524D60" }}>
              Their counter resets to zero — the next completed visit becomes visit 1.
              Visits already completed before now stop counting towards a future reward.
            </div>
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}

export default function LoyaltyPage() {
  return (
    <FeatureGate feature="analytics_basic">
      <LoyaltyContent />
    </FeatureGate>
  );
}
