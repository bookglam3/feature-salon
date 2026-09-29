"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import type { BusinessField } from "../lib/business-location";

type FieldErrors = Partial<Record<BusinessField, string>>;
type AccountErrors = Partial<Record<"fullName" | "email" | "password", string>>;
const POSTCODE_UNAVAILABLE = "We couldn't check your postcode right now. Please try again in a minute.";
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = ["Account", "Business", "Verify"];

const BUSINESS_TYPES = [
  { key:"hair",    label:"Hair Salon"           },
  { key:"barber",  label:"Barbershop"           },
  { key:"beauty",  label:"Beauty Salon"         },
  { key:"spa",     label:"Spa / Wellness"       },
  { key:"nail",    label:"Nail Studio"          },
  { key:"gym",     label:"Gym & Fitness Studio" },
  { key:"yoga",    label:"Yoga & Pilates"       },
  { key:"physio",  label:"Physiotherapy"        },
  { key:"massage", label:"Massage Therapy"      },
  { key:"dental",  label:"Dental & Aesthetic"   },
  { key:"pt",      label:"Personal Trainer"     },
  { key:"other",   label:"Other"                },
];

const BENEFITS = [
  "One flat monthly fee, zero commission",
  "Online booking 24/7 with your own link",
  "WhatsApp & email reminders",
];

// ── Small building blocks ───────────────────────────────────────────

function CheckIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Status line under the field (e.g. "✓ Westminster"), announced politely. */
  note?: React.ReactNode;
  right?: React.ReactNode;
};

function Field({ id, label, error, hint, note, right, ...input }: FieldProps) {
  const hasNote = note !== undefined;
  const describedBy = [
    error ? `${id}-error` : hint ? `${id}-hint` : null,
    hasNote ? `${id}-note` : null,
  ].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ minWidth:0 }}>
      <label htmlFor={id} className="su-label">{label}</label>
      <div style={{ position:"relative" }}>
        <input id={id} {...input} className="su-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy}
          style={right ? { paddingRight:52 } : undefined} />
        {right && <div style={{ position:"absolute", top:0, bottom:0, right:2, display:"flex", alignItems:"center" }}>{right}</div>}
      </div>
      {error
        ? <p id={`${id}-error`} role="alert" className="su-msg su-msg-error">{error}</p>
        : hint && <p id={`${id}-hint`} className="su-msg">{hint}</p>}
      {hasNote && <p id={`${id}-note`} aria-live="polite" className="su-msg">{error ? null : note}</p>}
    </div>
  );
}

function SelectField({ id, label, value, onChange, options }:
  { id:string; label:string; value:string; onChange:(v:string)=>void; options:{ key:string; label:string }[] }) {
  return (
    <div style={{ minWidth:0 }}>
      <label htmlFor={id} className="su-label">{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className="su-input su-select">
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );
}

function EyeBtn({ show, toggle }: { show:boolean; toggle:()=>void }) {
  return (
    <button type="button" onClick={toggle} className="su-icon-btn" aria-label="Show password" aria-pressed={show}>
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.87 20.87 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.87 20.87 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div style={{ marginBottom:24 }}>
      <p className="su-step">Step {step + 1} of {STEPS.length} <span aria-hidden="true">·</span> {STEPS[step]}</p>
      <div style={{ display:"flex", gap:6 }} aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex:1, height:4, borderRadius:99, background: i <= step ? "#7C3AED" : "#E5E7EB", transition:"background .3s" }} />
        ))}
      </div>
    </div>
  );
}

/** Six single-digit boxes. Typing advances, Backspace on an empty box goes
 *  back, and pasting (or one-time-code autofill of) a full code fills all six. */
function OtpBoxes({ digits, onChange, onSubmit, invalid, describedBy }:
  { digits:string[]; onChange:(d:string[])=>void; onSubmit:()=>void; invalid:boolean; describedBy?:string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(digits.length - 1, i))];
    el?.focus(); el?.select();
  };
  const fillFrom = (start: number, value: string) => {
    const next = [...digits];
    for (let k = 0; k < value.length && start + k < next.length; k++) next[start + k] = value[k];
    onChange(next);
    focus(start + value.length);
  };
  return (
    <fieldset style={{ border:0, padding:0, margin:0, minWidth:0 }}>
      <legend className="su-label">Verification code</legend>
      <div className="su-otp-row">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            value={d}
            className="su-input su-otp"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1} of ${digits.length}`}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onFocus={e => e.target.select()}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, "");
              if (!v) { const next = [...digits]; next[i] = ""; onChange(next); return; }
              if (v.length === 2 && d) { fillFrom(i, v[0] === d ? v[1] : v[0]); return; } // typed over a filled box
              fillFrom(v.length >= digits.length ? 0 : i, v.slice(0, digits.length));
            }}
            onPaste={e => {
              e.preventDefault();
              const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits.length);
              if (v) fillFrom(v.length === digits.length ? 0 : i, v);
            }}
            onKeyDown={e => {
              if (e.key === "Backspace" && !d && i > 0) {
                e.preventDefault();
                const next = [...digits]; next[i - 1] = ""; onChange(next); focus(i - 1);
              } else if (e.key === "ArrowLeft" && i > 0) {
                e.preventDefault(); focus(i - 1);
              } else if (e.key === "ArrowRight" && i < digits.length - 1) {
                e.preventDefault(); focus(i + 1);
              } else if (e.key === "Enter") {
                onSubmit();
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Step 0 — account info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountErrors, setAccountErrors] = useState<AccountErrors>({});
  // Step 1 — business info
  const [salonName, setSalonName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [postcodeCheck, setPostcodeCheck] = useState<{ state:"idle"|"checking"|"ok"; town?:string }>({ state:"idle" });
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("hair");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loadingText, setLoadingText] = useState("");
  const postcodeReq = useRef(0);
  // Finish mode: a signed-in, email-verified user with no salon yet (sent here
  // by the dashboard, or after /api/signup/complete failed post-verification).
  // Step 1 then also collects name + password and completes with their session.
  const [finishMode, setFinishMode] = useState(false);
  const [resuming, setResuming] = useState(false);
  // Step 2 — email OTP (six boxes; the code is complete when all are filled)
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(6).fill(""));
  const otp = otpDigits.join("");
  const clearOtp = () => setOtpDigits(Array(6).fill(""));
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

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

  // Move focus to the new step's heading so keyboard and screen-reader users
  // aren't left on a button that no longer exists. (Verify focuses digit 1.)
  useEffect(() => {
    if (step === 1 || step === 3) headingRef.current?.focus();
  }, [step, resuming]);

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

  // ── Account fields: shown inline under each field ────────────────
  const checkAccount = (includeEmail: boolean): boolean => {
    const errs: AccountErrors = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    if (includeEmail && !EMAIL_FORMAT.test(email.trim())) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (password.length > 72) errs.password = "Password must be 72 characters or fewer.";
    setAccountErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearAccountError = (field: keyof AccountErrors) =>
    setAccountErrors(errs => (errs[field] ? { ...errs, [field]: undefined } : errs));

  // ── Step 0: validate account fields, advance to step 1 ──────────
  const step0 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAccount(true)) return;
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
        body: JSON.stringify({ businessName: salonName, addressLine1: address, postcode, phone }),
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
          fullName, password, salonName, addressLine1: address, postcode, phone, category,
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
    const accountOk = finishMode ? checkAccount(false) : true;
    const businessOk = checkRequiredBusiness();
    if (!accountOk || !businessOk) return;
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
      setCooldown(0); clearOtp();
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
      clearOtp();
      startCooldown();
    }
    setIsResending(false);
  };

  const backFromVerify = () => {
    setStep(1); clearOtp(); setOtpError("");
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
    setCooldown(0);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  // ── Copy per step ────────────────────────────────────────────────
  const title =
    step === 0 ? "Create your account"
    : step === 1 ? (finishMode ? "Finish setting up your business" : "Tell us about your business")
    : "Check your inbox";
  const subtitle =
    step === 0 ? "Start your 14-day free trial. No card required."
    : step === 1
      ? (finishMode
          ? <>Signed in as <strong className="su-strong">{email}</strong>. Add your details to open your dashboard.</>
          : "Feature is currently available to businesses in the UK.")
      : <>We sent a code to <strong className="su-strong">{email}</strong></>;

  const passwordField = (
    <Field id="su-password" label="Password" type={showPw ? "text" : "password"} value={password}
      onChange={e => { setPassword(e.target.value); clearAccountError("password"); }}
      autoComplete="new-password" maxLength={72} hint="At least 8 characters" error={accountErrors.password}
      right={<EyeBtn show={showPw} toggle={() => setShowPw(p => !p)} />} />
  );
  const nameField = (
    <Field id="su-name" label="Full name" value={fullName}
      onChange={e => { setFullName(e.target.value); clearAccountError("fullName"); }}
      placeholder="Sarah Johnson" autoComplete="name" maxLength={100} error={accountErrors.fullName} />
  );

  return (
    <main className="signup-page su-page">
      <div className="su-form-col">
        <Link href="/" className="su-logo">
          <Image src="/brand/logo-light-no-tagline.svg" alt="Feature" width={82} height={36} loading="eager" />
        </Link>

        <div className="su-center">
          <div className="su-content">
            {resuming ? (
              <div style={{ display:"flex", justifyContent:"center", padding:"48px 0" }}>
                <div className="su-loading" role="status" aria-label="Loading your account" />
              </div>
            ) : step === 3 ? (
              // ── Done ──────────────────────────────────────────────
              <div style={{ textAlign:"center" }}>
                <div className="su-done-icon"><CheckIcon size={28} color="#047857" /></div>
                <h1 ref={headingRef} tabIndex={-1} className="su-h1">You&apos;re all set</h1>
                <p className="su-sub">Taking you to your dashboard…</p>
                <Link href="/dashboard" className="su-btn">Go to dashboard</Link>
              </div>
            ) : (
              <>
                {step === 1 && !finishMode && (
                  <button type="button" className="su-back" onClick={() => { setStep(0); setError(""); }}>← Back</button>
                )}
                {step === 2 && <button type="button" className="su-back" onClick={backFromVerify}>← Back</button>}
                {!finishMode && <Progress step={step} />}

                <h1 ref={headingRef} tabIndex={-1} className="su-h1">{title}</h1>
                <p className="su-sub">{subtitle}</p>

                {step < 2 && error && (
                  <div role="alert" className="su-banner">
                    {error}
                    {error.includes("already exists") && <> <Link href="/login">Log in</Link></>}
                  </div>
                )}

                {/* ── Step 0: Account ─────────────────────────────── */}
                {step === 0 && (
                  <form onSubmit={step0} noValidate className="su-form">
                    {nameField}
                    <Field id="su-email" label="Email" type="email" value={email}
                      onChange={e => { setEmail(e.target.value); clearAccountError("email"); }}
                      placeholder="you@yourbusiness.co.uk" autoComplete="email" autoCapitalize="none" spellCheck={false}
                      maxLength={254} error={accountErrors.email} />
                    {passwordField}
                    <button type="submit" className="su-btn" style={{ marginTop:8 }}>Continue</button>
                  </form>
                )}

                {/* ── Step 1: Business (plus name + password in finish mode) ── */}
                {step === 1 && (
                  <form onSubmit={step1} noValidate className="su-form">
                    {finishMode && <>{nameField}{passwordField}</>}
                    <Field id="su-business" label="Business name" value={salonName}
                      onChange={e => { setSalonName(e.target.value); clearFieldError("businessName"); }}
                      placeholder="e.g. The Cut Studio" autoComplete="organization" maxLength={100} error={fieldErrors.businessName} />
                    <SelectField id="su-type" label="Business type" value={category} onChange={setCategory} options={BUSINESS_TYPES} />
                    <Field id="su-address" label="Business address" value={address}
                      onChange={e => { setAddress(e.target.value); clearFieldError("addressLine1"); }}
                      placeholder="e.g. 12 High Street" autoComplete="address-line1" maxLength={150}
                      error={fieldErrors.addressLine1} />
                    <div className="su-pair">
                      <Field id="su-postcode" label="Postcode" value={postcode}
                        onChange={e => { setPostcode(e.target.value); postcodeReq.current++; setPostcodeCheck({ state:"idle" }); clearFieldError("postcode"); }}
                        onBlur={checkPostcode} placeholder="SW1A 1AA" autoComplete="postal-code" autoCapitalize="characters"
                        spellCheck={false} maxLength={10} error={fieldErrors.postcode}
                        note={postcodeCheck.state === "checking" ? "Checking postcode…"
                          : postcodeCheck.state === "ok" ? <span className="su-ok">✓ {postcodeCheck.town}</span> : null} />
                      <Field id="su-phone" label="Business phone" type="tel" value={phone}
                        onChange={e => { setPhone(e.target.value); clearFieldError("phone"); }}
                        placeholder="07… or 020…" autoComplete="tel" maxLength={20}
                        hint="UK mobile, landline or 03 number" error={fieldErrors.phone} />
                    </div>
                    <button type="submit" disabled={loading} className="su-btn" style={{ marginTop:8 }}>
                      {loading
                        ? <><span className="su-spinner" aria-hidden="true" />{loadingText}</>
                        : finishMode ? "Create my business" : "Send verification code"}
                    </button>
                    <p className="su-fine">
                      By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
                    </p>
                  </form>
                )}

                {/* ── Step 2: Verify ──────────────────────────────── */}
                {step === 2 && (
                  <div className="su-form">
                    <div>
                      <OtpBoxes digits={otpDigits} onChange={d => { setOtpDigits(d); setOtpError(""); }}
                        onSubmit={verifyOtpAndComplete} invalid={!!otpError} describedBy={otpError ? "su-otp-error" : undefined} />
                      {otpError && <p id="su-otp-error" role="alert" className="su-msg su-msg-error">{otpError}</p>}
                    </div>
                    <button type="button" onClick={verifyOtpAndComplete} disabled={otp.length !== 6 || otpLoading} className="su-btn" style={{ marginTop:8 }}>
                      {otpLoading ? <><span className="su-spinner" aria-hidden="true" />Verifying…</> : "Verify & create account"}
                    </button>
                    <p className="su-fine">
                      Can&apos;t find it? Check your spam folder.{" "}
                      {isResending
                        ? "Sending…"
                        : cooldown > 0
                          ? `Resend code in ${cooldown}s`
                          : <button type="button" className="su-link" onClick={resendOtp}>Resend code</button>}
                    </p>
                  </div>
                )}

                {step < 2 && !finishMode && (
                  <p className="su-footer">Already have an account? <Link href="/login">Log in</Link></p>
                )}
                {finishMode && (
                  <p className="su-footer">Not you? <button type="button" className="su-link" onClick={signOut}>Sign out</button></p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Brand panel (desktop only) ─────────────────────────────── */}
      <aside className="su-panel" aria-label="Why Feature">
        <div className="su-panel-inner">
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <Image src="/brand/logo-app-icon.svg" alt="" width={40} height={40} style={{ borderRadius:10 }} />
            <span style={{ fontSize:22, fontWeight:700, color:"#FFFFFF", letterSpacing:"-0.02em" }}>Feature</span>
          </div>
          <h2 className="su-panel-h">Run your salon, not your admin</h2>
          <ul className="su-benefits">
            {BENEFITS.map(b => (
              <li key={b}><span className="su-benefit-icon"><CheckIcon size={14} color="#FFFFFF" /></span>{b}</li>
            ))}
          </ul>
        </div>
      </aside>

      <style>{CSS}</style>
    </main>
  );
}

// Inline styles can't express :focus, :hover, ::placeholder or media queries,
// so those live here. Colours: text #111827, muted #6B7280 (4.8:1 on white),
// border #D1D5DB, brand #7C3AED, error #DC2626, success #047857.
const CSS = `
.su-page{min-height:100vh;display:flex;background:#FFFFFF;color:#111827;}
/* 96px bottom on phones keeps the last line clear of the site-wide WhatsApp button (fixed, 56px, 24px up). */
.su-form-col{flex:1;min-width:0;display:flex;flex-direction:column;padding:20px 16px 96px;}
.su-logo{align-self:flex-start;display:inline-flex;border-radius:6px;}
.su-center{flex:1;display:flex;flex-direction:column;justify-content:flex-start;padding-top:32px;}
.su-content{width:100%;max-width:420px;margin:0 auto;}
.su-h1{font-size:28px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:#111827;margin:0 0 8px;outline:none;}
.su-sub{font-size:15px;line-height:1.55;color:#6B7280;margin:0 0 28px;overflow-wrap:anywhere;}
.su-strong{color:#111827;font-weight:600;}
.su-step{font-size:13px;font-weight:500;color:#6B7280;margin:0 0 8px;}
.su-form{display:flex;flex-direction:column;gap:16px;}
.su-label{display:block;font-size:14px;font-weight:500;color:#111827;margin:0 0 6px;padding:0;}
.su-input{width:100%;height:48px;box-sizing:border-box;border:1px solid #D1D5DB;border-radius:10px;padding:0 14px;font-family:inherit;font-size:15px;color:#111827;background:#FFFFFF;outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none;}
.su-input::placeholder{color:#6B7280;opacity:1;}
.su-input:focus{border-color:#7C3AED;box-shadow:0 0 0 3px rgba(124,58,237,0.15);}
.su-input[aria-invalid="true"]{border-color:#DC2626;}
.su-select{padding-right:40px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%236B7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;background-size:16px;}
.su-msg{font-size:13px;line-height:1.45;color:#6B7280;margin:6px 0 0;}
.su-msg:empty{margin:0;}
.su-msg-error{color:#DC2626;}
.su-ok{color:#047857;font-weight:500;}
.su-pair{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;}
.su-btn{width:100%;height:48px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:none;border-radius:10px;background:#7C3AED;color:#FFFFFF;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .15s;}
.su-btn:hover:not(:disabled){background:#6D28D9;}
.su-btn:disabled{opacity:.6;cursor:not-allowed;}
.su-icon-btn{width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:8px;background:none;color:#6B7280;cursor:pointer;}
.su-icon-btn:hover{color:#111827;}
.su-link{padding:0;border:none;background:none;font:inherit;font-weight:500;color:#7C3AED;cursor:pointer;border-radius:4px;}
.su-link:hover,.su-fine a:hover,.su-footer a:hover,.su-banner a:hover{text-decoration:underline;}
/* Buttons get min-height:44px globally (tap target), so a small margin reads as ~16px. */
.su-back{display:flex;align-items:center;width:fit-content;margin:0 0 4px;padding:0;border:none;background:none;font:inherit;font-size:14px;font-weight:500;color:#6B7280;cursor:pointer;border-radius:4px;}
.su-back:hover{color:#111827;}
.su-fine{font-size:13px;line-height:1.5;color:#6B7280;text-align:center;margin:0;}
.su-footer{font-size:14px;color:#6B7280;text-align:center;margin:28px 0 0;}
.su-fine a,.su-footer a,.su-banner a{color:#7C3AED;font-weight:500;text-decoration:none;}
.su-banner{margin:0 0 20px;padding:12px 14px;border:1px solid #FECACA;border-radius:10px;background:#FEF2F2;color:#B91C1C;font-size:14px;line-height:1.5;}
.su-btn:focus-visible,.su-link:focus-visible,.su-icon-btn:focus-visible,.su-back:focus-visible,.su-logo:focus-visible,.su-fine a:focus-visible,.su-footer a:focus-visible,.su-banner a:focus-visible{outline:2px solid #7C3AED;outline-offset:2px;}
.su-otp-row{display:flex;gap:8px;}
.su-otp{flex:1 1 0;min-width:0;max-width:56px;height:56px;padding:0;text-align:center;font-size:22px;font-weight:600;}
.su-done-icon{width:56px;height:56px;margin:0 auto 20px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;}
.su-spinner{display:inline-block;width:16px;height:16px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(255,255,255,0.45);border-top-color:#FFFFFF;animation:su-spin .7s linear infinite;}
.su-loading{width:28px;height:28px;box-sizing:border-box;border-radius:50%;border:3px solid rgba(124,58,237,0.2);border-top-color:#7C3AED;animation:su-spin .7s linear infinite;}
@keyframes su-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){.su-spinner,.su-loading{animation-duration:1.6s;}}
.su-panel{display:none;}
.su-panel-h{font-size:40px;font-weight:600;line-height:1.15;letter-spacing:-0.02em;color:#FFFFFF;margin:32px 0 28px;max-width:440px;}
.su-benefits{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:16px;}
.su-benefits li{display:flex;align-items:center;gap:12px;font-size:16px;line-height:1.4;color:#FFFFFF;}
.su-benefit-icon{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;}
@media (min-width:900px){
  .su-form-col{padding:32px 48px 40px;}
  .su-center{justify-content:center;padding-top:24px;}
  .su-pair{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}
  .su-panel{display:block;flex:0 0 46%;max-width:640px;background:linear-gradient(165deg,#7C3AED 0%,#5B21B6 55%,#3B0764 100%);}
  .su-panel-inner{position:sticky;top:0;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:56px;}
}
`;
