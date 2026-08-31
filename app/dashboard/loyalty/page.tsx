"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";

interface LoyaltyClient {
  id: string;
  client_email: string;
  client_name: string;
  points: number;
  total_earned: number;
  total_redeemed: number;
}

function getTiers(bt?: string | null) {
  const freeWord = ["gym","yoga","pt"].includes(bt ?? "") ? "session"
    : ["dental","physio"].includes(bt ?? "") ? "consultation"
    : "visit";
  return [
    { name:"Bronze",  min:0,    max:199,  color:"#CD7F32", icon:"🥉", perks:"5% discount on next visit" },
    { name:"Silver",  min:200,  max:499,  color:"#9A94A8", icon:"🥈", perks:"10% discount + priority booking" },
    { name:"Gold",    min:500,  max:999,  color:"#F59E0B", icon:"🥇", perks:`15% discount + free ${freeWord}` },
    { name:"Platinum",min:1000, max:Infinity, color:"#7C3AED", icon:"💎", perks:"20% off + VIP access" },
  ];
}

type Tier = { name:string; min:number; max:number; color:string; icon:string; perks:string };

function getTier(points: number, tiers: Tier[]) {
  return tiers.find(t => points >= t.min && points <= t.max) || tiers[0];
}

function TierBadge({ points, tiers }: { points: number; tiers: Tier[] }) {
  const tier = getTier(points, tiers);
  return (
    <span style={{ fontSize:10.5, fontWeight:800, padding:"3px 9px", borderRadius:99, background:`${tier.color}18`, color:tier.color, border:`1px solid ${tier.color}40` }}>
      {tier.icon} {tier.name}
    </span>
  );
}

function LoyaltyContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string|null>(null);
  const [salonName, setSalonName] = useState("");
  const [businessType, setBusinessType] = useState<string|null>(null);
  const [clients, setClients] = useState<LoyaltyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<LoyaltyClient|null>(null);
  const [adjForm, setAdjForm] = useState({ type:"earn", points:"", note:"" });
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [pointsPerPound, setPointsPerPound] = useState(10);
  const tiers = getTiers(businessType);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      setBusinessType(profile.salon.business_type ?? null);

      // Load loyalty — if no records, auto-create from appointments
      const { data: existing } = await supabase.from("loyalty_points").select("*").eq("salon_id", profile.salon.id).order("points", { ascending:false });
      if (existing && existing.length > 0) {
        setClients(existing);
      } else {
        // Seed from appointments
        const { data: appts } = await supabase.from("appointments").select("client_name, client_email, status, services(price)").eq("salon_id", profile.salon.id).eq("status","confirmed");
        const map: Record<string, { name:string; pts:number }> = {};
        (appts||[]).forEach((a: { client_email: string; client_name: string; services?: { price?: number }[] | null }) => {
          const key = a.client_email || a.client_name;
          if (!map[key]) map[key] = { name: a.client_name, pts: 0 };
          map[key].pts += Math.floor(((a.services?.[0]?.price) || 0) * 10);
        });
        const inserts = Object.entries(map).map(([email, v]) => ({
          salon_id: profile.salon.id, client_email: email, client_name: v.name,
          points: v.pts, total_earned: v.pts, total_redeemed: 0
        }));
        if (inserts.length) {
          const { data: seeded } = await supabase.from("loyalty_points").insert(inserts).select();
          setClients(seeded || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const filtered = useMemo(() =>
    clients.filter(c => c.client_name?.toLowerCase().includes(search.toLowerCase()) || c.client_email?.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  const handleAdjust = async () => {
    if (!selectedClient || !adjForm.points) return;
    setSaving(true);
    const pts = parseInt(adjForm.points);
    const newPoints = adjForm.type === "earn" || adjForm.type === "bonus"
      ? selectedClient.points + pts
      : Math.max(0, selectedClient.points - pts);

    const { error } = await supabase.from("loyalty_points").update({
      points: newPoints,
      total_earned: adjForm.type === "earn" || adjForm.type === "bonus" ? selectedClient.total_earned + pts : selectedClient.total_earned,
      total_redeemed: adjForm.type === "redeem" ? selectedClient.total_redeemed + pts : selectedClient.total_redeemed,
      updated_at: new Date().toISOString(),
    }).eq("id", selectedClient.id).eq("salon_id", salonId!);

    if (!error) {
      await supabase.from("loyalty_transactions").insert({
        salon_id: salonId, client_email: selectedClient.client_email,
        points: pts, type: adjForm.type, note: adjForm.note
      });
      setClients(p => p.map(c => c.id === selectedClient.id ? { ...c, points: newPoints,
        total_earned: adjForm.type !== "redeem" ? c.total_earned + pts : c.total_earned,
        total_redeemed: adjForm.type === "redeem" ? c.total_redeemed + pts : c.total_redeemed,
      } : c).sort((a,b) => b.points - a.points));
      toast.success("Points updated!");
    }
    setSaving(false);
    setShowModal(false);
    setAdjForm({ type:"earn", points:"", note:"" });
  };

  const totalPoints = clients.reduce((s,c) => s + c.points, 0);

  const Topbar = (
    <header style={{ background:"#FFFFFF", borderBottom:"1px solid #ECE9F1", padding:"0 24px", height:66, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>Loyalty Points</div>
          <div style={{ fontSize:11.5, color:"#9A94A8", marginTop:1 }}>Reward your loyal clients</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => setShowSetup(true)} style={{ padding:"9px 14px", background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:12, fontSize:13, fontWeight:700, color:"#6B6577", cursor:"pointer" }}>⚙️ Settings</button>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:10, padding:"7px 14px" }}>
          <span style={{ fontSize:14, color:"#9A94A8" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…" style={{ background:"none", border:"none", outline:"none", fontSize:13, color:"#12101A", fontFamily:"inherit", width:160 }} />
        </div>
      </div>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding:40, textAlign:"center", color:"#9A94A8" }}>Loading loyalty…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding:"28px 24px", maxWidth:1360, margin:"0 auto" }}>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
          {[
            { label:"Total Members", value:clients.length, icon:"👥", color:"#7C3AED" },
            { label:"Points Outstanding", value:totalPoints.toLocaleString(), icon:"💎", color:"#F59E0B" },
            { label:"Gold+ Members", value:clients.filter(c=>c.points>=500).length, icon:"🥇", color:"#F59E0B" },
            { label:"Pts/£ Rate", value:`${pointsPerPound} pts`, icon:"💰", color:"#10B981" },
          ].map(s => (
            <div key={s.label} style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:16, padding:"18px 16px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:s.color }} />
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:10, fontWeight:800, color:"#9A94A8", textTransform:"uppercase", letterSpacing:"0.8px" }}>{s.label}</span>
                <span style={{ fontSize:18 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize:26, fontWeight:900, color:"#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tiers info */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
          {tiers.map((tier: Tier) => (
            <div key={tier.name} style={{ background:"#FFFFFF", border:`1.5px solid ${tier.color}30`, borderRadius:16, padding:"16px", borderTop:`3px solid ${tier.color}` }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{tier.icon}</div>
              <div style={{ fontSize:13, fontWeight:800, color:tier.color, marginBottom:2 }}>{tier.name}</div>
              <div style={{ fontSize:11, color:"#9A94A8", marginBottom:6 }}>{tier.min}{tier.max === Infinity ? "+" : `–${tier.max}`} pts</div>
              <div style={{ fontSize:11.5, color:"#6B6577", lineHeight:1.5 }}>{tier.perks}</div>
              <div style={{ fontSize:11, fontWeight:700, color:tier.color, marginTop:8 }}>{clients.filter(c => getTier(c.points, tiers).name === tier.name).length} clients</div>
            </div>
          ))}
        </div>

        {/* Client table */}
        <div style={{ background:"#FFFFFF", border:"1.5px solid #ECE9F1", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ padding:"16px 22px", borderBottom:"1px solid #ECE9F1" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#12101A" }}>All Members <span style={{ fontSize:12, color:"#9A94A8", fontWeight:600 }}>({filtered.length})</span></div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:"#9A94A8" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
              <div style={{ fontWeight:700 }}>No loyalty members yet</div>
              <div style={{ fontSize:13, marginTop:4 }}>Members are auto-created from confirmed bookings</div>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
                <thead>
                  <tr style={{ background:"#F5F3FF" }}>
                    {["Client","Tier","Points","Earned","Redeemed","Actions"].map(h => (
                      <th key={h} style={{ fontSize:10, fontWeight:900, color:"#9A94A8", textAlign:"left", padding:"11px 16px", letterSpacing:"0.8px", textTransform:"uppercase", borderBottom:"1px solid #ECE9F1" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const tier = getTier(c.points, tiers);
                    const next = tiers[tiers.indexOf(tier)+1];
                    const progress = next ? ((c.points - tier.min) / (tier.max - tier.min)) * 100 : 100;
                    return (
                      <tr key={c.id} style={{ transition:"background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F5F3FF"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:36, height:36, borderRadius:11, background:`hsl(${c.client_name.charCodeAt(0)*37%360},55%,55%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff", flexShrink:0 }}>
                              {c.client_name.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize:13.5, fontWeight:800, color:"#12101A" }}>{c.client_name}</div>
                              <div style={{ fontSize:11.5, color:"#9A94A8" }}>{c.client_email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1" }}>
                          <TierBadge points={c.points} tiers={tiers} />
                          {next && (
                            <div style={{ marginTop:6 }}>
                              <div style={{ height:4, background:"#ECE9F1", borderRadius:99, width:80 }}>
                                <div style={{ height:"100%", borderRadius:99, background:tier.color, width:`${progress}%` }} />
                              </div>
                              <div style={{ fontSize:9.5, color:"#9A94A8", marginTop:2 }}>{next.min - c.points} pts to {next.name}</div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:18, fontWeight:900, color:tier.color }}>{c.points.toLocaleString()}</td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:13, color:"#10B981", fontWeight:700 }}>+{c.total_earned}</td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1", fontSize:13, color:"#EF4444", fontWeight:700 }}>-{c.total_redeemed}</td>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #ECE9F1" }}>
                          <button onClick={() => { setSelectedClient(c); setShowModal(true); }} style={{ padding:"6px 14px", background:"linear-gradient(135deg,#7C3AED,#6D28D9)", color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>Adjust</button>
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

      {/* Adjust Modal */}
      {showModal && selectedClient && (
        <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#FFFFFF", borderRadius:20, padding:28, width:"100%", maxWidth:420, boxShadow:"0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#12101A", marginBottom:4 }}>Adjust Points</div>
            <div style={{ fontSize:13, color:"#6B6577", marginBottom:20 }}>{selectedClient.client_name} · <strong style={{ color:getTier(selectedClient.points, tiers).color }}>{selectedClient.points} pts</strong></div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B6577", display:"block", marginBottom:6 }}>Type</label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {(["earn","redeem","bonus"] as const).map(t => (
                    <button key={t} onClick={() => setAdjForm({...adjForm, type:t})}
                      style={{ padding:"8px 4px", borderRadius:10, border:`1.5px solid ${adjForm.type===t ? "#7C3AED" : "#ECE9F1"}`, background: adjForm.type===t ? "rgba(124,58,237,0.10)" : "#FFFFFF", color: adjForm.type===t ? "#7C3AED" : "#6B6577", fontSize:12.5, fontWeight:700, cursor:"pointer", textTransform:"capitalize", transition:"all 0.12s" }}>
                      {t === "earn" ? "💰" : t === "redeem" ? "🎁" : "⭐"} {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B6577", display:"block", marginBottom:6 }}>Points *</label>
                <input type="number" value={adjForm.points} onChange={e => setAdjForm({...adjForm, points:e.target.value})} placeholder="e.g. 50"
                  style={{ width:"100%", padding:"10px 13px", border:"1.5px solid #ECE9F1", borderRadius:10, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:"#6B6577", display:"block", marginBottom:6 }}>Note (optional)</label>
                <input value={adjForm.note} onChange={e => setAdjForm({...adjForm, note:e.target.value})} placeholder="e.g. Birthday bonus"
                  style={{ width:"100%", padding:"10px 13px", border:"1.5px solid #ECE9F1", borderRadius:10, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex:1, padding:12, background:"#F5F3FF", border:"1.5px solid #ECE9F1", borderRadius:12, fontSize:13.5, fontWeight:700, color:"#6B6577", cursor:"pointer" }}>Cancel</button>
              <button onClick={handleAdjust} disabled={saving || !adjForm.points} style={{ flex:2, padding:12, background:"linear-gradient(135deg,#7C3AED,#6D28D9)", border:"none", borderRadius:12, fontSize:13.5, fontWeight:700, color:"#fff", cursor:"pointer", opacity:!adjForm.points?0.5:1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSetup && (
        <div onClick={() => setShowSetup(false)} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#FFFFFF", borderRadius:20, padding:28, width:"100%", maxWidth:420, boxShadow:"0 32px 80px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#12101A", marginBottom:20 }}>Loyalty Settings</div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"#6B6577", display:"block", marginBottom:6 }}>Points per £1 spent</label>
              <input type="number" value={pointsPerPound} onChange={e => setPointsPerPound(parseInt(e.target.value))}
                style={{ width:"100%", padding:"10px 13px", border:"1.5px solid #ECE9F1", borderRadius:10, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
              <div style={{ fontSize:12, color:"#9A94A8", marginTop:6 }}>e.g. £50 service = {50*pointsPerPound} points</div>
            </div>
            <div style={{ marginTop:16, padding:"14px 16px", background:"rgba(124,58,237,0.10)", borderRadius:12 }}>
              <div style={{ fontSize:12.5, fontWeight:700, color:"#7C3AED", marginBottom:8 }}>Tier Breakdown</div>
              {tiers.map((t: Tier) => (
                <div key={t.name} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6B6577", marginBottom:4 }}>
                  <span>{t.icon} {t.name}</span>
                  <span>{t.min}{t.max===Infinity?"+":` – ${t.max}`} pts = £{Math.floor(t.min/pointsPerPound)} spent</span>
                </div>
              ))}
            </div>
            <button onClick={() => { toast.success("Settings saved!"); setShowSetup(false); }} style={{ marginTop:20, width:"100%", padding:12, background:"linear-gradient(135deg,#7C3AED,#6D28D9)", border:"none", borderRadius:12, fontSize:13.5, fontWeight:700, color:"#fff", cursor:"pointer" }}>Save Settings</button>
          </div>
        </div>
      )}
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
