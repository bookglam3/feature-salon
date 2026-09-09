"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useSalon } from "../context/SalonContext";
import type { Service } from "../../types";

// ─── Types ────────────────────────────────────────────────────
interface PaymentMethods {
  full_online: boolean;
  deposit_online: boolean;
  pay_at_salon: boolean;
  custom_deposit: boolean;
  deposit_percent: number;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  full_online: true,
  deposit_online: true,
  pay_at_salon: false,
  custom_deposit: false,
  deposit_percent: 50,
};

interface SalonData {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  owner_email?: string;
  logo_url?: string;
  description?: string;
  reminders_enabled?: boolean;
  review_link?: string;
  whatsapp_enabled?: boolean;
  payment_methods?: Partial<PaymentMethods>;
}

// ─── Toggle switch ────────────────────────────────────────────
function Toggle({
  id, checked, onChange, disabled,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={checked}
      disabled={disabled} onClick={() => onChange(!checked)}
      style={{
        position: "relative", display: "inline-flex", width: 44, height: 24,
        borderRadius: 999, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#7C3AED" : "#D6D1DE", transition: "background 0.2s",
        flexShrink: 0, padding: 0, opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transition: "left 0.2s",
      }} />
    </button>
  );
}

// ─── Payment Method Row ───────────────────────────────────────
function PaymentMethodRow({
  title, description, checked, id, onChange, children,
}: {
  title: string; description: string;
  checked: boolean; id: string; onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1.5px solid ${checked ? "#7C3AED" : "#ECE9F1"}`,
      borderRadius: 12, padding: "16px 18px", marginBottom: 10,
      background: checked ? "#F5F3FF" : "#FFFFFF",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: checked ? "#12101A" : "#12101A" }}>{title}</div>
            <div style={{ fontSize: 12, color: checked ? "#524D60" : "#524D60", marginTop: 2 }}>{description}</div>
          </div>
        </div>
        <Toggle id={id} checked={checked} onChange={onChange} />
      </div>
      {checked && children && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #ECE9F1" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Booking Page Preview ─────────────────────────────────────
function BookingPreview({ pm, price = 65 }: { pm: PaymentMethods; price?: number }) {
  const depositPct = pm.custom_deposit ? pm.deposit_percent : 50;
  const depositAmt = ((price * depositPct) / 100).toFixed(2);

  const options = [
    pm.full_online    && { label: "Pay Full Amount",     sub: "Pay 100% now — nothing due at the salon", amount: `£${price}`, color: "#7C3AED" },
    pm.deposit_online && { label: "50% Deposit",          sub: "Pay half now, remainder at salon",         amount: `£${(price * 0.5).toFixed(2)}`, color: "#10B981" },
    pm.custom_deposit && { label: `${depositPct}% Deposit`, sub: `Pay ${depositPct}% now, remainder at salon`, amount: `£${depositAmt}`, color: "#F59E0B" },
    pm.pay_at_salon   && { label: "Pay at Salon",         sub: "No payment required now",                  amount: "£0",    color: "#524D60" },
  ].filter(Boolean) as { label: string; sub: string; amount: string; color: string }[];

  if (!options.length) {
    return (
      <div style={{ padding: "16px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA", fontSize: 12, color: "#DC2626" }}>
        ⚠️ No payment methods enabled &mdash; clients won&apos;t be able to complete bookings.
      </div>
    );
  }

  return (
    <div style={{ background: "#F5F3FF", borderRadius: 12, padding: 16, border: "1px solid #ECE9F1" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>
        Preview — How clients see it
      </div>
      {options.map((opt, i) => (
        <div key={i} style={{
          border: `2px solid ${i === 0 ? "#7C3AED" : "#ECE9F1"}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 8,
          background: i === 0 ? "rgba(124,58,237,0.04)" : "white",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A" }}>{opt.label}</div>
            <div style={{ fontSize: 11, color: "#524D60", marginTop: 2 }}>{opt.sub}</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: opt.color }}>{opt.amount}</div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#524D60", marginTop: 4, textAlign: "center" }}>
        Example service price: £{price}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Main Settings Page
// ═════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const router = useRouter();
  const { vc } = useSalon();
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [description, setDescription] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Services — read-only here; full management lives on /dashboard/services.
  // Kept so the Payment Methods preview below can show a real example price.
  const [services, setServices] = useState<Service[]>([]);

  // Booking link copy
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const handleCopyLink = useCallback(() => {
    if (!salon) return;
    navigator.clipboard.writeText(`${origin}/book/${salon.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [origin, salon]);

  // Reminder settings
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reviewLink, setReviewLink] = useState("");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);

  // WhatsApp settings
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [waSaved, setWaSaved] = useState(false);

  // Payment methods
  const [pm, setPm] = useState<PaymentMethods>(DEFAULT_PAYMENT_METHODS);
  const [pmSaving, setPmSaving] = useState(false);
  const [pmSaved, setPmSaved] = useState(false);

  // Account / password
  const [userEmail, setUserEmail] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");

      const { data: salonData } = await supabase
        .from("salons").select("*").eq("owner_id", user.id).single();

      setSalon(salonData);
      setSalonName(salonData?.name || "");
      setLogoUrl(salonData?.logo_url || "");
      setLogoUrlInput(salonData?.logo_url || "");
      setDescription(salonData?.description || "");
      setRemindersEnabled(salonData?.reminders_enabled ?? true);
      setReviewLink(salonData?.review_link || "");
      setWhatsappEnabled(salonData?.whatsapp_enabled ?? false);

      // Load payment methods — fall back to defaults if column missing
      if (salonData?.payment_methods) {
        setPm({ ...DEFAULT_PAYMENT_METHODS, ...salonData.payment_methods });
      }

      if (salonData) {
        // Use API route (service-role) to bypass any RLS issues
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || "";
        const svcRes = await fetch("/api/services", { headers: { Authorization: `Bearer ${token}` } });
        if (svcRes.ok) { const json = await svcRes.json(); setServices(json.services || []); }
      }

      setLoading(false);
    };
    loadData();
  }, [router]);

  const handleSaveBrand = async () => {
    if (!salon) return;
    setSaving(true); setSaveError("");
    const finalLogoUrl = (logoUrl && !logoUrl.startsWith("data:")) ? logoUrl
      : (logoUrlInput.trim() || null);
    const newSlug = salonName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const slugChanged = newSlug !== salon.slug && salonName !== salon.name;
    const { error } = await supabase.from("salons").update({
      name: salonName,
      logo_url: finalLogoUrl,
      description: description || null,
      ...(slugChanged ? { slug: newSlug } : {}),
    }).eq("id", salon.id);
    if (error) { setSaveError("Failed to save brand settings. Please try again."); setSaving(false); return; }
    if (finalLogoUrl) setLogoUrl(finalLogoUrl);
    if (slugChanged) setSalon((prev: SalonData | null) => prev ? { ...prev, slug: newSlug } : prev);
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = async (file: File) => {
    if (!salon) return;
    if (!file.type.startsWith("image/")) { setLogoError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoError("Image must be less than 5MB."); return; }
    setLogoError("");
    setLogoUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-logo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      setLogoUrl(json.url);
      setLogoUrlInput(json.url);
    } catch (err) {
      setLogoError(`Upload failed: ${err}. You can paste a logo URL below instead.`);
    }
    setLogoUploading(false);
  };

  const handleToggleReminders = async (value: boolean) => {
    setRemindersEnabled(value);
    if (!salon) return;
    const { error } = await supabase.from("salons").update({ reminders_enabled: value }).eq("id", salon.id);
    if (error) setRemindersEnabled(!value); // revert on failure
  };

  const handleSaveReminders = async () => {
    if (!salon) return;
    setReminderSaving(true); setSaveError("");
    const { error } = await supabase.from("salons").update({
      reminders_enabled: remindersEnabled, review_link: reviewLink || null,
    }).eq("id", salon.id);
    if (error) { setSaveError("Failed to save reminder settings. Please try again."); setReminderSaving(false); return; }
    setReminderSaved(true); setReminderSaving(false);
    setTimeout(() => setReminderSaved(false), 2000);
  };

  const handleToggleWhatsApp = async (value: boolean) => {
    setWhatsappEnabled(value);
    if (!salon) return;
    const { error } = await supabase.from("salons").update({ whatsapp_enabled: value }).eq("id", salon.id);
    if (error) { setWhatsappEnabled(!value); return; } // revert on failure
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 1500);
  };

  const handleSavePaymentMethods = async () => {
    if (!salon) return;
    const pct = Math.min(100, Math.max(1, pm.deposit_percent || 50));
    const sanitised = { ...pm, deposit_percent: pct };
    setPm(sanitised);
    setPmSaving(true); setSaveError("");
    const { error } = await supabase.from("salons").update({ payment_methods: sanitised }).eq("id", salon.id);
    if (error) { setSaveError("Failed to save payment settings. Please try again."); setPmSaving(false); return; }
    setPmSaved(true); setPmSaving(false);
    setTimeout(() => setPmSaved(false), 2000);
  };

  const updatePm = (key: keyof PaymentMethods, value: boolean | number) =>
    setPm(prev => ({ ...prev, [key]: value }));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!pwForm.current) { setPwError("Enter your current password."); return; }
    if (!pwForm.newPw || pwForm.newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("New passwords do not match."); return; }
    if (pwForm.current === pwForm.newPw) { setPwError("New password must be different from current."); return; }
    setPwSaving(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: pwForm.current });
    if (signInErr) { setPwError("Current password is incorrect."); setPwSaving(false); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.newPw });
    if (updateErr) { setPwError(updateErr.message); setPwSaving(false); return; }
    setPwSuccess(true);
    setPwForm({ current: "", newPw: "", confirm: "" });
    setPwSaving(false);
    setTimeout(() => setPwSuccess(false), 4000);
  };

  if (loading) return (
    <DashboardShell salonName="">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#7C3AED" }}>feature</div>
      </div>
    </DashboardShell>
  );

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#FFFFFF", borderRadius: "16px",
    border: "1px solid #ECE9F1", padding: "24px", marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(18,16,26,0.04), 0 8px 24px -12px rgba(18,16,26,0.08)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "12px", color: "#524D60", display: "block", marginBottom: "6px", fontWeight: 500,
  };
  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: "14px", border: "1px solid #ECE9F1",
    borderRadius: "8px", width: "100%", maxWidth: "360px",
    boxSizing: "border-box", outline: "none", color: "#12101A",
  };
  const inputFocus = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "#7C3AED";
      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = "#ECE9F1";
      e.currentTarget.style.boxShadow = "none";
    },
  };
  const saveBtn = (isSaved: boolean, isSaving: boolean, label: string) => ({
    style: {
      padding: "10px 20px",
      background: isSaved ? "#10B981" : "#7C3AED",
      color: "#fff", border: "none", borderRadius: "8px",
      fontSize: "13px", cursor: "pointer", fontWeight: 600,
      transition: "background 0.2s",
    } as React.CSSProperties,
    children: isSaved ? "Saved ✓" : isSaving ? "Saving…" : label,
  });

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A", letterSpacing: "-0.4px" }}>Settings</div>
          <div style={{ fontSize: 11.5, color: "#6B6577", marginTop: 1 }}>Manage your {vc.productName.replace(" OS","")}</div>
        </div>
      </div>
    </header>
  );

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 740 }}>

      {saveError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #DC2626", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#DC2626", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {saveError}</span>
          <button onClick={() => setSaveError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── Booking Link ── */}
      <div style={{ ...cardStyle, background: "linear-gradient(135deg,#0F0B2D 0%,#3730A3 60%,#7C3AED 100%)", border: "none", marginBottom: 20 }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Your Booking Page</div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: 4 }}>{salon?.name}</div>
        <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginBottom: 18, wordBreak: "break-all" }}>{origin}/book/{salon?.slug}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleCopyLink}
            style={{ padding: "10px 20px", background: copied ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.12)", color: "#fff", border: `1.5px solid ${copied ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.25)"}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", backdropFilter: "blur(8px)" }}
          >
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
          <button
            onClick={() => window.open(`/book/${salon?.slug}`, "_blank")}
            style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
          >
            Preview ↗
          </button>
        </div>
      </div>

      {/* ── Salon Brand ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A", marginBottom: "4px" }}>{vc.productName.replace(" OS","")} Brand</div>
        <p style={{ fontSize: "13px", color: "#524D60", marginBottom: "20px" }}>
          Your logo and name appear on the public booking page.
        </p>

        {/* Logo upload area */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>{vc.productName.replace(" OS","")} Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>

            {/* Logo preview circle */}
            <div
              onClick={() => logoInputRef.current?.click()}
              style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden", border: "2.5px dashed #D6D1DE", flexShrink: 0, background: "linear-gradient(135deg,#7C3AED,#5B21B6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", transition: "border-color 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#D6D1DE"; }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#7C3AED"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "#D6D1DE"; }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
            >
              {logoUploading ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 24, height: 24, border: "3px solid #9A94A8", borderTop: "3px solid white", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 4px" }} />
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>Uploading...</span>
                </div>
              ) : logoUrl ? (
                <Image src={logoUrl} alt="Logo" width={96} height={96} style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  onError={() => setLogoUrl("")} />
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>📸</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 4, fontWeight: 600 }}>Upload</div>
                </div>
              )}
              {logoUrl && !logoUploading && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}>
                  <span style={{ color: "#fff", fontSize: 22 }}>✏️</span>
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A", marginBottom: 8 }}>{salonName || `Your ${vc.productName.replace(" OS","")}`}</div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                style={{ padding: "9px 18px", background: "rgba(124,58,237,0.10)", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#7C3AED", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
              >
                {logoUploading ? "Uploading…" : "Upload Logo"}
              </button>
              {logoUrl && (
                <button type="button" onClick={() => { setLogoUrl(""); setLogoUrlInput(""); }} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Remove logo</button>
              )}
              <p style={{ fontSize: 11, color: "#524D60", margin: "8px 0 0", lineHeight: 1.5 }}>PNG, JPG, WEBP · Max 5MB<br />Click or drag & drop on the circle</p>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
          />

          {/* Error message */}
          {logoError && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#F5F3FF", border: "1.5px solid #FECACA", borderRadius: 10, fontSize: 12.5, color: "#DC2626", lineHeight: 1.6 }}>
              ⚠️ {logoError}
            </div>
          )}

          {/* Fallback: paste logo URL directly */}
          <div style={{ marginTop: 14 }}>
            <label style={{ ...labelStyle, marginBottom: 4 }}>
              Or paste logo URL directly <span style={{ color: "#524D60", fontWeight: 400 }}>(if upload doesn&apos;t work)</span>
            </label>
            <input
              id="logo-url-input"
              type="url"
              placeholder="https://example.com/your-logo.png"
              value={logoUrlInput}
              onChange={e => {
                setLogoUrlInput(e.target.value);
                if (e.target.value.trim()) setLogoUrl(e.target.value.trim());
              }}
              style={{ ...inputStyle, maxWidth: "420px" }} {...inputFocus}
            />
          </div>
        </div>


        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="salon-name" style={labelStyle}>{vc.productName.replace(" OS","")} Name</label>
          <input id="salon-name" value={salonName} onChange={e => setSalonName(e.target.value)} style={inputStyle} {...inputFocus} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="salon-desc" style={labelStyle}>Description <span style={{ color: "#524D60", fontWeight: 400 }}>(shows under salon name on booking page)</span></label>
          <input
            id="salon-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Premium hair salon in Manchester city centre"
            style={{ ...inputStyle, maxWidth: "420px" }} {...inputFocus}
          />
        </div>

        <style>{`
          @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
          input::placeholder{color:#6B6577}
        `}</style>
        <button onClick={handleSaveBrand} disabled={saving || logoUploading} {...saveBtn(saved, saving, "Save Brand")} />
      </div>

      {/* ── Payment Methods ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A", marginBottom: "4px" }}>
          Payment Methods
        </div>
        <p style={{ fontSize: "13px", color: "#524D60", marginBottom: "20px" }}>
          Choose which payment options clients can use when booking. Changes apply instantly on your booking page.
        </p>

        {/* Method toggles */}
        <PaymentMethodRow
          id="pm-full"
          title="Full Payment Online"
          description="Client pays 100% now via Stripe. Nothing due at salon."
          checked={pm.full_online}
          onChange={v => updatePm("full_online", v)}
        />

        <PaymentMethodRow
          id="pm-deposit"
          title="50% Deposit Online"
          description="Client pays half now, remaining 50% due at salon."
          checked={pm.deposit_online}
          onChange={v => updatePm("deposit_online", v)}
        />

        <PaymentMethodRow
          id="pm-custom"
          title="Custom % Deposit Online"
          description="Set your own deposit percentage."
          checked={pm.custom_deposit}
          onChange={v => updatePm("custom_deposit", v)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label htmlFor="deposit-pct" style={{ fontSize: 12, color: "#524D60", fontWeight: 500 }}>
              Deposit Percentage
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                id="deposit-pct"
                type="number"
                min={1} max={99} step={1}
                value={pm.deposit_percent}
                onChange={e => updatePm("deposit_percent", Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{
                  width: 72, padding: "8px 10px", fontSize: 14, fontWeight: 700,
                  border: "1.5px solid #7C3AED", borderRadius: 8, color: "#12101A",
                  textAlign: "center", outline: "none",
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#7C3AED" }}>%</span>
            </div>
            <span style={{ fontSize: 12, color: "#524D60" }}>
              Client pays {pm.deposit_percent}% now, {100 - pm.deposit_percent}% at salon
            </span>
          </div>
        </PaymentMethodRow>

        <PaymentMethodRow
          id="pm-salon"
          title="Pay at Salon"
          description="No online payment required. Client pays in full at appointment."
          checked={pm.pay_at_salon}
          onChange={v => updatePm("pay_at_salon", v)}
        />

        {/* Warning if only pay_at_salon */}
        {pm.pay_at_salon && !pm.full_online && !pm.deposit_online && !pm.custom_deposit && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            background: "#FFFBF0", border: "0.5px solid #FDE68A",
            borderRadius: 8, padding: "12px 14px", marginBottom: 16,
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: "12px", color: "#F59E0B", lineHeight: 1.6 }}>
              <strong>Pay at Salon only</strong> — Stripe payment will be skipped entirely.
              Clients will confirm their booking without any upfront payment.
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: "0.5px solid #ECE9F1", margin: "20px 0" }} />

        {/* Live Preview */}
        <div style={{ marginBottom: 20 }}>
          <BookingPreview pm={pm} price={services[0]?.price || 65} />
        </div>

        <button
          id="save-payment-methods-btn"
          onClick={handleSavePaymentMethods}
          disabled={pmSaving}
          {...saveBtn(pmSaved, pmSaving, "Save Payment Settings")}
        />
      </div>

      {/* ── Automated Reminders ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A" }}>Automated Reminders</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "12px", color: remindersEnabled ? "#10B981" : "#6B6577", fontWeight: 600 }}>
              {remindersEnabled ? "On" : "Off"}
            </span>
            <Toggle id="reminders-toggle" checked={remindersEnabled} onChange={handleToggleReminders} />
          </div>
        </div>
        <p style={{ fontSize: "13px", color: "#524D60", marginBottom: "20px" }}>
          Automatically send WhatsApp &amp; email reminders to clients.
          All messages include a GDPR opt-out link. Timezone: <strong>Europe/London</strong> (GMT/BST auto).
        </p>
        <div style={{ background: "#F8FAFF", border: "0.5px solid #E0E7FF", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#7C3AED", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "12px" }}>
            Message Schedule
          </div>
          {[
            { time: "24 hours before", msg: "\"Your appointment is tomorrow at [time]\"", channel: "WhatsApp + Email" },
            { time: "2 hours before",  msg: "\"Your appointment is in 2 hours\"",          channel: "WhatsApp + Email" },
            { time: "1 hour after",   msg: "\"Thank you for visiting! [review link]\"",  channel: "WhatsApp + Email" },
            { time: "6 weeks after",  msg: "\"Ready for your next appointment?\"",        channel: "WhatsApp + Email" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < 3 ? "0.5px solid #EEF0F8" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#12101A" }}>{row.time}</div>
                <div style={{ fontSize: "12px", color: "#524D60", margin: "2px 0" }}>{row.msg}</div>
                <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, color: "#7C3AED", background: "rgba(124,58,237,0.10)", padding: "2px 8px", borderRadius: 6, marginTop: 4 }}>{row.channel}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="review-link" style={labelStyle}>
            Google Reviews Link <span style={{ color: "#524D60", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="review-link" type="url"
            placeholder="https://g.page/r/your-salon/review"
            value={reviewLink} onChange={e => setReviewLink(e.target.value)}
            style={{ ...inputStyle, maxWidth: "400px" }} {...inputFocus}
          />
          <p style={{ fontSize: "11.5px", color: "#524D60", margin: "6px 0 0" }}>
            Sent in the 1h post-visit thank-you WhatsApp &amp; email.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#F5F3FF", border: "0.5px solid #BBF7D0", borderRadius: "8px", padding: "12px 14px", marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", color: "#15803D", lineHeight: 1.6 }}>
            <strong>GDPR Compliant</strong> &mdash; Every WhatsApp message includes a STOP opt-out link and every email includes an unsubscribe link.
          </div>
        </div>
        <button id="save-reminders-btn" onClick={handleSaveReminders} disabled={reminderSaving} {...saveBtn(reminderSaved, reminderSaving, "Save Reminder Settings")} />
      </div>

      {/* ── WhatsApp Reminders ── */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A" }}>WhatsApp Reminders</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "12px", color: whatsappEnabled ? "#10B981" : "#6B6577", fontWeight: 600 }}>
              {waSaved ? "Saved ✓" : whatsappEnabled ? "On" : "Off"}
            </span>
            <Toggle id="whatsapp-toggle" checked={whatsappEnabled} onChange={handleToggleWhatsApp} />
          </div>
        </div>
        <p style={{ fontSize: "13px", color: "#524D60", margin: "6px 0 20px" }}>
          Send automated WhatsApp messages via Twilio. Clients must have WhatsApp and their number must be active.
          Messages are sent in <strong>English</strong> with GDPR opt-out included.
        </p>

        {/* Setup guide: Sandbox + Production */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>

          {/* Sandbox panel */}
          <div style={{ background: "#F5F3FF", border: "1.5px solid #FDE68A", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#F59E0B", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Testing (Sandbox)</div>
            <div style={{ fontSize: "12px", color: "#78350F", lineHeight: 1.8 }}>
              <div>1. Go to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED" }}>Twilio Console</a></div>
              <div>2. Messaging → Try it Out → WhatsApp</div>
              <div>3. Your client texts <code style={{ background: "rgba(245,158,11,0.10)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>join &lt;code&gt;</code> to <strong>+1 415 523 8886</strong></div>
              <div style={{ marginTop: 6, color: "#B45309", fontStyle: "italic" }}>⚠️ Only pre-joined numbers receive messages</div>
            </div>
          </div>

          {/* Production panel */}
          <div style={{ background: "#F5F3FF", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#14532D", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Production (All Clients)</div>
            <div style={{ fontSize: "12px", color: "#15803D", lineHeight: 1.8 }}>
              <div>1. <a href="https://www.twilio.com/en-us/whatsapp/request-access" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED" }}>Apply for WhatsApp Business</a></div>
              <div>2. Verify your Meta Business Account</div>
              <div>3. Set your Twilio WhatsApp sender</div>
              <div>4. Update <code style={{ background: "#DCFCE7", padding: "1px 5px", borderRadius: 4 }}>TWILIO_WHATSAPP_FROM</code> in Vercel env</div>
              <div style={{ marginTop: 6, color: "#10B981", fontWeight: 600 }}>✅ Then ALL clients get messages</div>
            </div>
          </div>
        </div>

        {/* Message schedule */}
        <div style={{ background: "#F5F3FF", border: "0.5px solid #BBF7D0", borderRadius: 10, padding: "16px", marginBottom: 18 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803D", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
            WhatsApp Message Schedule
          </div>
          {[
            { time: "Instantly",       msg: "Booking confirmation with date, time, service & cancel link" },
            { time: "24 hours before", msg: "\"Your appointment is tomorrow at [time]\"" },
            { time: "2 hours before",  msg: "\"Your appointment is in 2 hours at [time]\"" },
            { time: "6 weeks after",   msg: "\"Time for your next appointment! Book now: [link]\"" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: i < 3 ? "0.5px solid #D1FAE5" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#12101A" }}>{row.time}</div>
                <div style={{ fontSize: "12px", color: "#524D60", margin: "2px 0" }}>{row.msg}</div>
                <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 600, color: "#10B981", background: "rgba(16,185,129,0.12)", padding: "2px 8px", borderRadius: 6, marginTop: 4 }}>WhatsApp</span>
              </div>
            </div>
          ))}
        </div>

        {/* Country support */}
        <div style={{ background: "#F8FAFF", border: "0.5px solid #E0E7FF", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#7C3AED", marginBottom: 6 }}>Supported Countries (Auto-detected)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { flag: "🇬🇧", label: "UK", fmt: "+44" },
              { flag: "🇵🇰", label: "Pakistan", fmt: "+92" },
              { flag: "🇦🇪", label: "UAE", fmt: "+971" },
              { flag: "🇸🇦", label: "Saudi Arabia", fmt: "+966" },
            ].map(c => (
              <span key={c.label} style={{ fontSize: "12px", background: "rgba(124,58,237,0.10)", color: "#6D28D9", padding: "4px 10px", borderRadius: 20, fontWeight: 500 }}>
                {c.flag} {c.label} <span style={{ color: "#7C3AED", fontWeight: 400 }}>({c.fmt})</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: "11.5px", color: "#524D60", marginTop: 8 }}>
            Country code is auto-detected from the phone number entered at booking.
          </div>
        </div>

        {/* GDPR */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#F5F3FF", border: "0.5px solid #BBF7D0", borderRadius: "8px", padding: "12px 14px" }}>
          <div style={{ fontSize: "12px", color: "#15803D", lineHeight: 1.6 }}>
            <strong>GDPR Compliant</strong> — Every WhatsApp message includes a STOP opt-out link.
            Configure the webhook in Twilio Console → Messaging → Senders → WhatsApp sandbox →
            <code style={{ background: "rgba(16,185,129,0.12)", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>https://featuresalon.co.uk/api/whatsapp-optout</code>
          </div>
        </div>
      </div>

      {/* ── Services ── */}
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A" }}>Services</div>
          <div style={{ fontSize: "12px", color: "#524D60", marginTop: 2 }}>{services.length} service{services.length !== 1 ? "s" : ""} · categories, pricing &amp; gender restrictions now live on their own page</div>
        </div>
        <button onClick={() => router.push("/dashboard/services")} style={{ padding: "10px 20px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
          Manage Services →
        </button>
      </div>

      {/* ── Payout Settings ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#12101A", marginBottom: "4px" }}>Payout Settings</div>
        <div style={{ fontSize: "12.5px", color: "#524D60", marginBottom: "16px" }}>
          Connect your Stripe account to receive automatic payouts from bookings.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "linear-gradient(135deg,#F0F4FF,#EEF2FF)", border: "1px solid #ECE9F1", borderRadius: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1E1B4B" }}>Stripe Connect Express</div>
            <div style={{ fontSize: 11.5, color: "#7C3AED", marginTop: 2 }}>2% platform fee · automatic payouts · Stripe-powered</div>
          </div>
        </div>
        <button
          onClick={() => router.push("/dashboard/earnings")}
          style={{ padding: "10px 20px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}
        >
          Manage Payouts →
        </button>
      </div>

      {/* ── Account / Password ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#12101A", marginBottom: "4px" }}>Account</div>
        <p style={{ fontSize: "13px", color: "#524D60", marginBottom: "20px" }}>Manage your login credentials.</p>

        <div style={{ marginBottom: 20, padding: "12px 16px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#524D60", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>Logged in as</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#12101A" }}>{userEmail}</div>
          </div>
        </div>

        {pwError && <div style={{ padding: "10px 14px", background: "#F5F3FF", border: "1.5px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#DC2626", marginBottom: 14 }}>⚠️ {pwError}</div>}
        {pwSuccess && <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.10)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 10, fontSize: 13, color: "#10B981", marginBottom: 14 }}>✅ Password changed!</div>}

        <div style={{ fontSize: 13, fontWeight: 700, color: "#12101A", marginBottom: 12 }}>Change Password</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw.current ? "text" : "password"} value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} placeholder="Your current password" style={{ ...inputStyle, maxWidth: "100%", paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#524D60" }}>{showPw.current ? "🙈" : "👁️"}</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw.newPw ? "text" : "password"} value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} placeholder="Min. 8 characters" style={{ ...inputStyle, maxWidth: "100%", paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#524D60" }}>{showPw.newPw ? "🙈" : "👁️"}</button>
            </div>
            {pwForm.newPw && pwForm.newPw.length < 8 && <div style={{ fontSize: 11.5, color: "#F59E0B", marginTop: 4 }}>At least 8 characters required</div>}
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPw.confirm ? "text" : "password"} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Repeat new password" style={{ ...inputStyle, maxWidth: "100%", paddingRight: 44, borderColor: pwForm.confirm && pwForm.newPw !== pwForm.confirm ? "#EF4444" : undefined }} />
              <button type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#524D60" }}>{showPw.confirm ? "🙈" : "👁️"}</button>
            </div>
            {pwForm.confirm && pwForm.newPw !== pwForm.confirm && <div style={{ fontSize: 11.5, color: "#EF4444", marginTop: 4 }}>Passwords do not match</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleChangePassword} disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm} style={{ padding: "10px 22px", background: "linear-gradient(135deg,#5B21B6,#7C3AED)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (!pwForm.current || !pwForm.newPw || !pwForm.confirm) ? 0.4 : 1 }}>{pwSaving ? "Updating…" : "🔐 Update Password"}</button>
          <div style={{ width: 1, height: 28, background: "#ECE9F1" }} />
          <button onClick={handleLogout} style={{ padding: "10px 18px", background: "#F5F3FF", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Sign out</button>
        </div>
      </div>
      </div>
    </DashboardShell>
  );
}

