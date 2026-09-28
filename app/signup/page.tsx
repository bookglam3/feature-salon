"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import type { BusinessField } from "../lib/business-location";

type FieldErrors = Partial<Record<BusinessField, string>>;
const POSTCODE_UNAVAILABLE = "We couldn't check your postcode right now. Please try again in a minute.";

const C = { indigo:"#7C3AED", indigoDark:"#6D28D9", indigoSoft:"rgba(124,58,237,0.10)", green:"#047857", red:"#EF4444", text:"#12101A", text2:"#524D60", text3:"#6B6577", border:"#E6E2EF", bg:"#FFFFFF", formText:"#12101A", formText2:"#524D60" };
const STEPS = ["Account", "Your Business", "Verify Email", "Done!"];

const BUSINESS_TYPES = [
  { key:"hair",       label:"💇 Hair Salon"            },
  { key:"barber",     label:"✂️ Barbershop"             },
  { key:"beauty",     label:"💅 Beauty Salon"           },
  { key:"spa",        label:"🌿 Spa / Wellness"         },
  { key:"nail",       label:"💎 Nail Studio"            },
  { key:"gym",        label:"🏋️ Gym & Fitness Studio"  },
  { key:"yoga",       label:"🧘 Yoga & Pilates"         },
  { key:"physio",     label:"🤸 Physiotherapy"          },
  { key:"massage",    label:"💆 Massage Therapy"        },
  { key:"dental",     label:"🦷 Dental & Aesthetic"     },
  { key:"pt",         label:"🏃 Personal Trainer"       },
  { key:"other",      label:"🏠 Other"                  },
];

function pwStrength(p: string) {
  if (p.length < 6) return { label:"Weak", color:"#EF4444", w:"30%" };
  if (p.length < 10 || !/[0-9]/.test(p)) return { label:"Fair", color:"#F59E0B", w:"60%" };
  return { label:"Strong", color: "#047857", w:"100%" };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 1) return email;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 4))}@${domain}`;
}

function Inp({ label, type="text", value, onChange, placeholder, required, hint, right, error, note, onBlur, maxLength, autoComplete }:
  { label:string; type?:string; value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean; hint?:string; right?: React.ReactNode;
    error?:string; note?:React.ReactNode; onBlur?:()=>void; maxLength?:number; autoComplete?:string }) {
  const [f, setF] = useState(false);
  const ring = error ? "0 0 0 3px rgba(239,68,68,0.12)" : "0 0 0 3px rgba(124,58,237,0.12)";
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:13.5, fontWeight:600, color:"#2A2536", display:"block", marginBottom:7 }}>{label}{required && <span style={{color:C.indigo}}> *</span>}</label>
      <div style={{ position:"relative" }}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required}
          maxLength={maxLength} autoComplete={autoComplete} aria-invalid={error ? true : undefined}
          onFocus={()=>setF(true)} onBlur={()=>{ setF(false); onBlur?.(); }} className="signup-input"
          style={{ width:"100%", padding:"13px 15px", paddingRight: right?"44px":"15px", fontSize:14, color:C.formText, border:`1px solid ${error?C.red:f?C.indigo:C.border}`, borderRadius:11, outline:"none", boxSizing:"border-box", background:C.bg, transition:"border-color .15s, box-shadow .15s", boxShadow:f?ring:"none" }} />
        {right && <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)" }}>{right}</div>}
      </div>
      {error
        ? <div role="alert" style={{ fontSize:12, color:"#B91C1C", marginTop:5, lineHeight:1.5 }}>{error}</div>
        : note
          ? <div style={{ fontSize:12, marginTop:5, fontWeight:600 }}>{note}</div>
          : hint && <div style={{ fontSize:11, color:C.text3, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function EyeBtn({ show, toggle }: { show:boolean; toggle:()=>void }) {
  return (
    <button type="button" onClick={toggle} style={{ background:"none", border:"none", cursor:"pointer", color:"#6B6577", padding:0, lineHeight:1, display:"flex" }}>
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.87 20.87 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.87 20.87 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  // Step 0 — account info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  // Step 1 — business info
  const [salonName, setSalonName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeCheck, setPostcodeCheck] = useState<{ state:"idle"|"checking"|"ok"; town?:string }>({ state:"idle" });
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [terms, setTerms] = useState(false);
  const [category, setCategory] = useState("hair");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loadingText, setLoadingText] = useState("");
  const postcodeReq = useRef(0);
  // Finish mode: a signed-in, email-verified user with no salon yet (sent here
  // by the dashboard, or after /api/signup/complete failed post-verification).
  // Step 1 then also collects name + password and completes with their session.
  const [finishMode, setFinishMode] = useState(false);
  const [resuming, setResuming] = useState(false);
  // Step 2 — email OTP
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // /signup?finish=1 — resume for a signed-in user who has no salon yet
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("finish") !== "1") return;
    const resume = async () => {
      setResuming(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setResuming(false); return; } // not signed in — normal signup
      const { data: owned, error: ownedErr } = await supabase
        .from("salons").select("id").eq("owner_id", session.user.id).limit(1);
      if (!ownedErr && owned?.length) { router.replace("/dashboard"); return; }
      const meta = session.user.user_metadata ?? {};
      setEmail(session.user.email ?? "");
      if (typeof meta.full_name === "string") setFullName(meta.full_name);
      if (typeof meta.salon_name === "string") setSalonName(meta.salon_name);
      if (BUSINESS_TYPES.some(b => b.key === meta.business_type)) setCategory(meta.business_type);
      setFinishMode(true);
      setStep(1);
      setResuming(false);
    };
    resume();
  }, [router]);

  // Auto-redirect to dashboard after success screen
  useEffect(() => {
    if (step !== 3) return;
    const t = setTimeout(() => router.push("/dashboard"), 2000);
    return () => clearTimeout(t);
  }, [step, router]);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const pw = pwStrength(password);

  // ── Step 0: validate account fields, advance to step 1 ──────────
  const step0 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password.length > 72) { setError("Password must be 72 characters or fewer."); return; }
    if (password !== confirmPw) { setError("Passwords do not match."); return; }
    setError(""); setStep(1);
  };

  const clearFieldError = (field: BusinessField) =>
    setFieldErrors(errs => (errs[field] ? { ...errs, [field]: undefined } : errs));

  // ── Postcode: check on blur, show "✓ {town}" or the error ───────
  const checkPostcode = async () => {
    const value = postcode.trim();
    if (!value || postcodeCheck.state === "ok") return;
    const req = ++postcodeReq.current;
    setPostcodeCheck({ state:"checking" });
    let message = POSTCODE_UNAVAILABLE;
    try {
      const res = await fetch("/api/signup/validate-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodeOnly: true, postcode: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (req !== postcodeReq.current) return; // postcode was edited since — stale result
      if (res.ok) {
        setPostcode(json.postcode);
        setPostcodeCheck({ state:"ok", town: json.town });
        clearFieldError("postcode");
        return;
      }
      message = json.errors?.postcode || json.error || message;
    } catch {
      if (req !== postcodeReq.current) return;
    }
    setPostcodeCheck({ state:"idle" });
    setFieldErrors(errs => ({ ...errs, postcode: message }));
  };

  // ── Business details: instant empty-field check, then server validation ──
  const checkRequiredBusiness = (): boolean => {
    const missing: FieldErrors = {};
    if (!salonName.trim()) missing.businessName = "Business name is required.";
    if (!address.trim())   missing.addressLine1 = "Business address is required.";
    if (!postcode.trim())  missing.postcode = "Postcode is required.";
    if (!phone.trim())     missing.phone = "Business phone is required.";
    setFieldErrors(missing);
    return Object.keys(missing).length === 0;
  };

  const validateBusiness = async (): Promise<boolean> => {
    setLoadingText("Checking details…");
    try {
      const res = await fetch("/api/signup/validate-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: salonName, addressLine1: address, postcode, phone, company }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.errors && Object.keys(json.errors).length) {
          setFieldErrors(json.errors);
          if (json.errors.postcode) setPostcodeCheck({ state:"idle" });
        } else {
          setError(json.error || "We couldn't check your details. Please try again.");
        }
        return false;
      }
      setFieldErrors({});
      setPostcode(json.values.postcode);
      setPostcodeCheck({ state:"ok", town: json.values.town });
      return true;
    } catch {
      setError("We couldn't check your details. Please check your connection and try again.");
      return false;
    }
  };

  // ── Create the account + salon server-side (re-validates everything) ──
  const completeSignup = async (accessToken: string): Promise<{ ok: true } | { ok: false; error: string; errors?: FieldErrors }> => {
    try {
      const res = await fetch("/api/signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          fullName, password, salonName, addressLine1: address, postcode, phone, company, category,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error || "Failed to complete signup. Please try again.", errors: json.errors };
    } catch {
      return { ok: false, error: "Network error. Please check your connection and try again." };
    }

    // Notify founder — fire-and-forget, never blocks signup
    fetch("/api/notify-founder/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salonName, email, businessType: category, signedUpAt: new Date().toISOString() }),
    }).catch(() => {});
    return { ok: true };
  };

  // ── Step 1: validate business, then send email OTP (no account created yet).
  //    In finish mode there is already a verified session, so complete directly.
  const step1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (finishMode) {
      if (!fullName.trim()) { setError("Full name is required."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (password.length > 72) { setError("Password must be 72 characters or fewer."); return; }
      if (password !== confirmPw) { setError("Passwords do not match."); return; }
    }
    if (!checkRequiredBusiness()) return;
    if (!terms) { setError("Please accept the Terms & Conditions."); return; }
    setLoading(true);

    if (!(await validateBusiness())) { setLoading(false); return; }

    if (finishMode) {
      setLoadingText("Creating your account…");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session has expired. Please sign in again.");
        setLoading(false); return;
      }
      const result = await completeSignup(session.access_token);
      setLoading(false);
      if (!result.ok) {
        if (result.errors && Object.keys(result.errors).length) setFieldErrors(result.errors);
        else setError(result.error);
        return;
      }
      setStep(3);
      return;
    }

    setLoadingText("Sending code…");
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (otpErr) {
      const msg = otpErr.message;
      setError(
        msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")
          ? "An account with this email already exists. Please sign in."
          : msg,
      );
      setLoading(false); return;
    }

    startCooldown();
    setLoading(false);
    setStep(2);
  };

  // ── Step 2: verify OTP then complete signup server-side ──────────
  const verifyOtpAndComplete = async () => {
    if (otp.length !== 6 || otpLoading) return;
    setOtpLoading(true); setOtpError("");

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email, token: otp, type: "email",
    });

    if (verifyErr) {
      const msg = verifyErr.message.toLowerCase();
      setOtpError(
        msg.includes("expired") || msg.includes("invalid")
          ? "Incorrect code or it has expired. Try again or request a new one."
          : msg.includes("security") || msg.includes("rate")
            ? "Too many attempts. Please wait before requesting a new code."
            : verifyErr.message,
      );
      setOtpLoading(false); return;
    }

    if (!data.session) {
      setOtpError("Verification failed — no session. Please try again.");
      setOtpLoading(false); return;
    }

    // Complete account + salon creation server-side
    const result = await completeSignup(data.session.access_token);
    setOtpLoading(false);

    if (!result.ok) {
      // The email is verified and the session is live — the code can't be
      // reused, so don't loop back through it. Fix details on the finish screen.
      if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
      setCooldown(0); setOtp("");
      setFinishMode(true);
      setStep(1);
      if (result.errors && Object.keys(result.errors).length) {
        setFieldErrors(result.errors);
        setError("Your email is verified. Please fix the details below to finish.");
      } else {
        setError(result.error);
      }
      return;
    }

    setStep(3);
  };

  // ── Resend OTP with 60-second cooldown ───────────────────────────
  const resendOtp = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true); setOtpError("");
    const { error: resendErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (resendErr) {
      setOtpError(resendErr.message);
    } else {
      setOtp("");
      startCooldown();
    }
    setIsResending(false);
  };

  // ── Step 3: Success / redirect ───────────────────────────────────
  if (step === 3) return (
    <main className="signup-page" style={{ minHeight:"100vh", background:"#F5F3FF", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:20, padding:"48px 40px", maxWidth:460, width:"100%", textAlign:"center", boxShadow:"0 20px 60px -24px rgba(91,33,182,0.20)", border:"1px solid #F0EDF5" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"#7C3AED", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 20px", boxShadow:"0 8px 24px rgba(124,58,237,0.35)" }}>✓</div>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.formText, letterSpacing:"-0.5px", marginBottom:8 }}>{salonName} is ready!</h1>
        <p style={{ fontSize:14, color:C.formText2, lineHeight:1.7, marginBottom:20 }}>
          Email verified. Taking you to your dashboard…
        </p>
        {["Online booking page ready","WhatsApp reminders configured","14-day free trial started","Zero setup fees"].map(f=>(
          <div key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:C.formText2, padding:"7px 12px", background:"rgba(16,185,129,0.10)", borderRadius:8, marginBottom:8 }}>
            <span style={{color:C.green, fontWeight:800}}>✓</span> {f}
          </div>
        ))}
        <a href="/dashboard" style={{ display:"block", marginTop:24, padding:"14px", background:"linear-gradient(180deg, #7C3AED, #6D28D9)", color:"#fff", borderRadius:12, fontWeight:700, fontSize:15, textDecoration:"none", boxShadow:"0 8px 20px -6px rgba(124,58,237,0.45)" }}>
          Go to Dashboard →
        </a>
      </div>
    </main>
  );

  // ── Active error: steps 0-1 use `error`, step 2 uses `otpError` ──
  const activeError = step < 2 ? error : otpError;

  return (
    <main className="signup-page" style={{ minHeight:"100vh", background:"#F5F3FF", display:"flex" }}>
      {/* Left Panel */}
      <div style={{ width:440, position:"relative", overflow:"hidden", background:"linear-gradient(160deg, #5B21B6 0%, #6D28D9 55%, #7C3AED 100%)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"56px 44px", flexShrink:0 }} className="signup-left">
        <div style={{ position:"absolute", top:-120, right:-120, width:420, height:420, borderRadius:"50%", background:"radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-140, left:-100, width:360, height:360, borderRadius:"50%", background:"radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ marginBottom:32 }}>
            <span style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>Feature</span>
          </div>
          <h2 style={{ fontSize:32, fontWeight:800, color:"#fff", lineHeight:1.12, letterSpacing:"-0.02em", marginBottom:14 }}>Start growing your business with Feature</h2>
          <p style={{ fontSize:15, color:"#EDE9FF", lineHeight:1.6, marginBottom:28 }}>Everything you need to manage bookings, clients, staff and payments — all in one place.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:15, marginBottom:32 }}>
            {["Online booking 24/7","Zero commission","Automatic reminders","Secure payments"].map(f=>(
              <div key={f} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="12" height="10" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize:15, fontWeight:500, color:"#fff", lineHeight:1.4 }}>{f}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:13, color:"#D6C9F7", lineHeight:1.5, margin:0, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.15)" }}>Trusted by UK salons, barbers, gyms, spas and clinics.</p>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 24px" }}>
        <div style={{ width:"100%", maxWidth:520 }}>

          {/* Progress — hidden in finish mode, where there's no verify step */}
          {!finishMode && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:6 }}>
              {STEPS.map((s,i)=>(
                <div key={s} style={{ display:"flex", alignItems:"center", flex: i<STEPS.length-1?1:0 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", background: i<=step?C.indigo:C.border, color: i<=step?"#fff":C.text3, transition:"all .3s", boxShadow: i===step?"0 0 0 4px rgba(124,58,237,0.12)":"none" }}>
                      {i<step?"✓":i+1}
                    </div>
                    <span style={{ fontSize:12, fontWeight:i===step?600:500, color:i===step?C.formText:C.text3, whiteSpace:"nowrap" }}>{s}</span>
                  </div>
                  {i<STEPS.length-1 && <div style={{ flex:1, height:1.5, margin:"0 6px", marginBottom:18, background:i<step?C.indigo:C.border, transition:"background .3s" }}/>}
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Card */}
          <div style={{ background:"#FFFFFF", borderRadius:20, padding:"44px 44px", border:"1px solid #F0EDF5", boxShadow:"0 1px 2px rgba(18,16,26,0.04), 0 12px 32px -8px rgba(91,33,182,0.12), 0 30px 60px -30px rgba(18,16,26,0.12)", maxWidth:520, width:"100%", boxSizing:"border-box" }}>

          {/* Badge — only on steps 0 and 1 */}
          {step < 2 && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:800, color:C.indigo, letterSpacing:"2px", textTransform:"uppercase", background:C.indigoSoft, padding:"3px 10px", borderRadius:99, border:"1px solid rgba(124,58,237,0.30)" }}>14-Day Free Trial</div>
              <div style={{ fontSize:11, color:C.text3 }}>No credit card required</div>
            </div>
          )}

          {resuming ? (
            <div style={{ display:"flex", justifyContent:"center", padding:"40px 0" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid rgba(124,58,237,0.2)", borderTopColor:C.indigo, animation:"spin 0.7s linear infinite" }} />
            </div>
          ) : <>
          <h1 style={{ fontSize:26, fontWeight:900, color:C.formText, letterSpacing:"-0.8px", marginBottom:4, lineHeight:1.2 }}>
            {step===0 ? "Create your account" : step===1 ? (finishMode ? "Finish setting up your business" : "Tell us about your business") : "Check your inbox"}
          </h1>
          <p style={{ fontSize:13.5, color:C.formText2, marginBottom:20 }}>
            {step===0
              ? "Start your free trial in under 60 seconds."
              : step===1
                ? (finishMode
                    ? <>Signed in as <strong style={{color:C.formText}}>{email}</strong>. Add your business details to open your dashboard.</>
                    : "Help us personalise your experience.")
                : <>We sent a 6-digit code to <strong style={{color:C.formText}}>{maskEmail(email)}</strong>. Enter it below to verify your email.</>
            }
          </p>

          {/* Error banner */}
          {activeError && (
            <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"11px 14px", marginBottom:16, fontSize:13, color: "#B91C1C" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: activeError.includes("already exists")?8:0 }}>⚠ {activeError}</div>
              {activeError.includes("already exists") && <Link href="/login" style={{ fontSize:13, fontWeight:700, color:C.indigo, textDecoration:"none", background:C.indigoSoft, padding:"5px 12px", borderRadius:7, display:"inline-block", marginTop:4, border:"1px solid rgba(124,58,237,0.30)" }}>→ Sign in</Link>}
            </div>
          )}

          {/* ── Step 0: Account info ───────────────────────────────── */}
          {step===0 && (
            <form onSubmit={step0}>
              <Inp label="Full Name" value={fullName} onChange={setFullName} placeholder="Sarah Johnson" required />
              <Inp label="Email Address" type="email" value={email} onChange={setEmail} placeholder="sarah@yourbusiness.com" required />
              <div>
                <Inp label="Password" type={showPw?"text":"password"} value={password} onChange={setPassword} placeholder="Min. 8 characters" required
                  right={<EyeBtn show={showPw} toggle={()=>setShowPw(p=>!p)} />} />
                {password && (
                  <div style={{ marginTop:-10, marginBottom:14 }}>
                    <div style={{ height:3, background:C.border, borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:pw.w, background:pw.color, transition:"all .3s", borderRadius:99 }}/>
                    </div>
                    <div style={{ fontSize:11, color:pw.color, fontWeight:700, marginTop:4 }}>{pw.label}</div>
                  </div>
                )}
              </div>
              <Inp label="Confirm Password" type={showCpw?"text":"password"} value={confirmPw} onChange={setConfirmPw} placeholder="Repeat password" required
                right={<EyeBtn show={showCpw} toggle={()=>setShowCpw(p=>!p)} />} />
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:16, padding:"14px 16px", background:"#F7F5FF", border:"1px solid #EDE9FF", borderRadius:11 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.indigo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop:2, flexShrink:0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontSize:13, color:C.formText2, lineHeight:1.6 }}>Your data is encrypted and never shared. We comply with GDPR &amp; global data protection law.</span>
              </div>
              <button type="submit" className="btn-primary" style={{ width:"100%", padding:"14px", background:"linear-gradient(180deg, #7C3AED, #6D28D9)", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", boxShadow:"0 8px 20px -6px rgba(124,58,237,0.45)", transition:"all .15s" }}>
                Continue →
              </button>
              <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:C.text3 }}>
                Already have an account? <Link href="/login" style={{ color:C.indigo, fontWeight:700, textDecoration:"none" }}>Sign in →</Link>
              </div>
            </form>
          )}

          {/* ── Step 1: Business info ──────────────────────────────── */}
          {step===1 && (
            <form onSubmit={step1} noValidate>
              {finishMode && <>
                <Inp label="Full Name" value={fullName} onChange={setFullName} placeholder="Sarah Johnson" required maxLength={100} autoComplete="name" />
                <Inp label="Set a password" type={showPw?"text":"password"} value={password} onChange={setPassword} placeholder="Min. 8 characters" required
                  maxLength={72} autoComplete="new-password" hint="You'll use this to sign in." right={<EyeBtn show={showPw} toggle={()=>setShowPw(p=>!p)} />} />
                <Inp label="Confirm Password" type={showCpw?"text":"password"} value={confirmPw} onChange={setConfirmPw} placeholder="Repeat password" required
                  maxLength={72} autoComplete="new-password" right={<EyeBtn show={showCpw} toggle={()=>setShowCpw(p=>!p)} />} />
              </>}
              <Inp label="Business Name" value={salonName} onChange={v=>{ setSalonName(v); clearFieldError("businessName"); }} placeholder="e.g. The Cut Studio, Serenity Physio…" required
                maxLength={100} autoComplete="organization" error={fieldErrors.businessName} hint="Appears on your public booking page." />
              <Inp label="Business address (street and number)" value={address} onChange={v=>{ setAddress(v); clearFieldError("addressLine1"); }} placeholder="e.g. 12 High Street" required
                maxLength={150} autoComplete="address-line1" error={fieldErrors.addressLine1} />
              <Inp label="Postcode" value={postcode} placeholder="e.g. SW1A 1AA" required maxLength={10} autoComplete="postal-code"
                onChange={v=>{ setPostcode(v); postcodeReq.current++; setPostcodeCheck({ state:"idle" }); clearFieldError("postcode"); }}
                onBlur={checkPostcode} error={fieldErrors.postcode}
                note={postcodeCheck.state==="checking" ? <span style={{ color:C.text3, fontWeight:500 }}>Checking postcode…</span>
                  : postcodeCheck.state==="ok" ? <span style={{ color:C.green }}>✓ {postcodeCheck.town}</span> : undefined} />
              <Inp label="Business phone" type="tel" value={phone} onChange={v=>{ setPhone(v); clearFieldError("phone"); }} placeholder="07… or 020…" required
                maxLength={20} autoComplete="tel" error={fieldErrors.phone} hint="UK mobile, landline or 03 number." />
              <Inp label="Company Name (optional)" value={company} onChange={v=>{ setCompany(v); clearFieldError("company"); }} placeholder="Your registered company name"
                maxLength={100} error={fieldErrors.company} />
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:13.5, fontWeight:600, color:"#2A2536", display:"block", marginBottom:8 }}>Business Type</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }} className="salon-grid">
                  {BUSINESS_TYPES.map(o=>(
                    <button key={o.key} type="button" onClick={()=>setCategory(o.key)}
                      style={{ padding:"9px 12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left", border:`1px solid ${category===o.key?C.indigo:C.border}`, background:category===o.key?C.indigoSoft:C.bg, color:category===o.key?C.indigo:C.formText2, transition:"all .15s" }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:16, cursor:"pointer" }}>
                <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} style={{ width:16, height:16, marginTop:2, accentColor:C.indigo, flexShrink:0 }} />
                <span style={{ fontSize:12.5, color:C.formText2, lineHeight:1.6 }}>
                  I agree to the <Link href="/terms" style={{ color:C.indigo, textDecoration:"none", fontWeight:700 }}>Terms of Service</Link> and <Link href="/privacy" style={{ color:C.indigo, textDecoration:"none", fontWeight:700 }}>Privacy Policy</Link>
                </span>
              </label>
              <div style={{ display:"flex", gap:10 }}>
                {finishMode
                  ? <button type="button" onClick={async()=>{ await supabase.auth.signOut(); router.replace("/login"); }} style={{ padding:"13px 20px", borderRadius:12, border:`1px solid ${C.border}`, background:C.bg, color:C.formText2, fontSize:14, fontWeight:700, cursor:"pointer" }}>Sign out</button>
                  : <button type="button" onClick={()=>{ setStep(0); setError(""); }} style={{ padding:"13px 20px", borderRadius:12, border:`1px solid ${C.border}`, background:C.bg, color:C.formText2, fontSize:14, fontWeight:700, cursor:"pointer" }}>← Back</button>}
                <button type="submit" disabled={loading} className={loading ? undefined : "btn-primary"} style={{ flex:1, padding:"14px", background: loading?C.text3:"linear-gradient(180deg, #7C3AED, #6D28D9)", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor: loading?"not-allowed":"pointer", boxShadow: loading?"none":"0 8px 20px -6px rgba(124,58,237,0.45)", transition:"all .15s" }}>
                  {loading
                    ? <span>{loadingText} <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span></span>
                    : finishMode ? "Create My Business →" : "Send Verification Code →"}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Email OTP entry ────────────────────────────── */}
          {step===2 && (
            <div>
              {/* OTP input */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:13.5, fontWeight:600, color:"#2A2536", display:"block", marginBottom:7 }}>
                  6-digit code <span style={{color:C.indigo}}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(v);
                    setOtpError("");
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                    setOtp(pasted);
                    setOtpError("");
                  }}
                  onKeyDown={e => { if (e.key === "Enter") verifyOtpAndComplete(); }}
                  className="signup-input"
                  style={{
                    width:"100%", fontSize:38, fontWeight:800, letterSpacing:14,
                    textAlign:"center", padding:"18px 12px",
                    border:`1px solid ${otpError ? C.red : otp.length===6 ? C.green : C.border}`,
                    borderRadius:14, background:C.bg, color:C.formText, outline:"none",
                    fontFamily:"monospace", boxSizing:"border-box", caretColor:C.indigo,
                    transition:"border-color .15s, box-shadow .15s",
                    boxShadow: otp.length===6 ? `0 0 0 3px rgba(16,185,129,0.12)` : "none",
                  }}
                  placeholder="000000"
                />
              </div>

              {/* 10-minute hint */}
              <div style={{ background:"#F7F5FF", border:"1px solid #EDE9FF", borderRadius:11, padding:"14px 16px", marginBottom:16, fontSize:13, color:C.formText2 }}>
                ⏱ This code is valid for 10 minutes. Check your spam folder if you don&apos;t see it.
              </div>

              {/* Verify button */}
              <button
                onClick={verifyOtpAndComplete}
                disabled={otp.length !== 6 || otpLoading}
                className={otp.length === 6 && !otpLoading ? "btn-primary" : undefined}
                style={{
                  width:"100%", padding:"14px",
                  background: otp.length!==6 || otpLoading ? C.text3 : "linear-gradient(180deg, #7C3AED, #6D28D9)",
                  color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:700,
                  cursor: otp.length!==6 || otpLoading ? "not-allowed" : "pointer",
                  boxShadow: otp.length!==6 || otpLoading ? "none" : "0 8px 20px -6px rgba(124,58,237,0.45)",
                  transition:"all .15s", marginBottom:14,
                }}
              >
                {otpLoading
                  ? <span>Verifying… <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</span></span>
                  : "Verify & Create Account →"
                }
              </button>

              {/* Resend + back */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <button
                  type="button"
                  onClick={()=>{ setStep(1); setOtp(""); setOtpError(""); if(cooldownRef.current){clearInterval(cooldownRef.current);cooldownRef.current=null;}setCooldown(0); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:13, padding:0 }}
                >
                  ← Change details
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={cooldown > 0 || isResending}
                  style={{
                    background:"none", border:"none", cursor: cooldown>0||isResending ? "not-allowed" : "pointer",
                    color: cooldown>0||isResending ? C.text3 : C.indigo,
                    fontSize:13, fontWeight:700, padding:0, transition:"color .15s",
                  }}
                >
                  {isResending
                    ? "Sending…"
                    : cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : "Resend code"
                  }
                </button>
              </div>
            </div>
          )}
          </>}

          </div>
          {/* Trust badges */}
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:20, flexWrap:"wrap" }}>
            {[{icon:"🔒",text:"SSL Encrypted"},{icon:"🌍",text:"Global Servers"},{icon:"✓",text:"GDPR Compliant"}].map(b=>(
              <div key={b.text} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.text3 }}><span>{b.icon}</span>{b.text}</div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .signup-input::placeholder{color:#A8A2B8;}
        .btn-primary{transition:transform .15s, box-shadow .15s, background .15s;}
        .btn-primary:hover{transform:translateY(-1px); box-shadow:0 10px 26px -6px rgba(124,58,237,0.5); background:linear-gradient(180deg, #6D28D9, #5B21B6);}
        @media(max-width:768px){.signup-left{display:none!important;}.salon-grid{grid-template-columns:1fr!important;}}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
    </main>
  );
}
