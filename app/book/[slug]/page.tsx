"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase";
import { getVerticalConfig } from "@/app/lib/verticalConfig";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

import {
  DAY_KEYS, COUNTRY_TIMEZONES, type BookedInterval,
  addMinutesToSlot, intervalsOverlap, utcToSalonTime, isStaffAvailableForWindow, computeBlocked,
} from "@/app/lib/slot-availability";

interface SalonData {
  id: string; name: string; slug: string; description?: string;
  logo_url?: string; payment_methods?: any;
  timezone?: string; country?: string; business_type?: string;
}
interface ServiceItem { id: string; name: string; price: number; duration?: number; duration_minutes?: number; description?: string; category_id?: string | null; gender_restriction?: "all" | "female" | "male"; price_is_from?: boolean; }
interface ServiceCategoryItem { id: string; name: string; sort_order: number; }
interface StaffMember {
  id: string; name: string; role?: string;
  working_hours?: Record<string, { enabled: boolean; start: string; end: string }>;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
const STRIPE_KEY_MISSING = !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30",
];

const SERVICE_ICONS: Record<string, string> = {
  haircut:"✂️",cut:"✂️",hair:"💇",color:"🎨",colour:"🎨",
  highlights:"✨",blowout:"💨",styling:"💫",beard:"🧔",shave:"🪒",
  facial:"🧖",massage:"💆",nails:"💅",manicure:"💅",pedicure:"🦶",
  wax:"🌿",threading:"🧵",lash:"👁️",brow:"🪮",keratin:"✨",treatment:"🌿",
};

// STEPS is computed dynamically in the component using bookingVc.staffSingular

function getServiceIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "💈";
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0,2).toUpperCase();
}

// Filter TIME_SLOTS to only those within staff working hours for the selected date
function getAvailableSlots(allSlots: string[], staff: StaffMember | null, date: Date): { slot: string; offDay: boolean } {
  void allSlots;
  if (!staff || !staff.working_hours) return { slot: "", offDay: false }; // no filtering
  const dayKey = DAY_KEYS[date.getDay()];
  const hours = staff.working_hours[dayKey];
  if (!hours?.enabled) return { slot: "", offDay: true }; // staff off this day
  return { slot: `${hours.start}–${hours.end}`, offDay: false };
}

function isSlotInRange(slot: string, staff: StaffMember | null, date: Date): boolean {
  if (!staff || !staff.working_hours) return true;
  const dayKey = DAY_KEYS[date.getDay()];
  const hours = staff.working_hours[dayKey];
  if (!hours?.enabled) return false;
  return slot >= hours.start && slot <= hours.end;
}

// Convert YYYY-MM-DD + HH:MM in the salon's timezone → UTC ISO string
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  // Get offset: create noon UTC on that date, see what local noon looks like
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const localNoonStr = noonUTC.toLocaleString("en-US", { timeZone: timezone });
  const localNoon = new Date(localNoonStr);
  const offsetMs = noonUTC.getTime() - localNoon.getTime();
  // Create target in "fake UTC" (as if timezone were UTC) then apply offset
  const fakeUTC = new Date(Date.UTC(y, m - 1, d, h, min, 0));
  return new Date(fakeUTC.getTime() + offsetMs).toISOString();
}

// ── Country definitions ───────────────────────────────────────
const COUNTRIES = [
  {
    code: "GB", flag: "🇬🇧", name: "UK", dial: "+44",
    // Accepts: 07xxxxxxxxx (11 digits) OR digits only without leading 0 (10 digits)
    validate: (d: string) => /^(07\d{9}|7\d{9}|447\d{9})$/.test(d),
    placeholder: "07911 123456", hint: "07xxx — 10 digits",
  },
  {
    code: "PK", flag: "🇵🇰", name: "Pakistan", dial: "+92",
    // Accepts: 03xxxxxxxxxx (11 digits) OR 3xxxxxxxxxx (10 digits without leading 0)
    validate: (d: string) => /^(03\d{9}|3\d{9}|923\d{9})$/.test(d),
    placeholder: "03464 503668", hint: "03xxx — 10 digits",
  },
  {
    code: "AE", flag: "🇦🇪", name: "UAE", dial: "+971",
    // Accepts: 05xxxxxxxx (9 digits) OR 5xxxxxxxx (8 digits without leading 0)
    validate: (d: string) => /^(05\d{8}|5\d{8}|9715\d{8})$/.test(d),
    placeholder: "050 123 4567", hint: "05xxx — 9 digits",
  },
  {
    code: "SA", flag: "🇸🇦", name: "Saudi Arabia", dial: "+966",
    validate: (d: string) => /^(05\d{8}|5\d{8}|9665\d{8})$/.test(d),
    placeholder: "050 123 4567", hint: "05xxx — 9 digits",
  },
] as const;
type CountryCode = typeof COUNTRIES[number]["code"];

function getCountryByCode(code: CountryCode) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function reviewerDisplayName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function isValidPhoneForCountry(raw: string, countryCode: CountryCode): boolean {
  const digits = raw.replace(/[\s\-\(\)]/g, ""); // strip formatting
  return getCountryByCode(countryCode).validate(digits);
}

// Build E.164 from whatever the user typed + selected country
function toE164(local: string, countryCode: CountryCode): string {
  const country = getCountryByCode(countryCode);
  const digits = local.replace(/[\s\-\(\)]/g, "");
  if (!digits) return "";
  // Already full E.164
  if (digits.startsWith("+")) return digits;
  // Already has country prefix digits (e.g. 923464...)
  if (countryCode === "GB"  && digits.startsWith("44"))  return `+${digits}`;
  if (countryCode === "PK"  && digits.startsWith("92"))  return `+${digits}`;
  if (countryCode === "AE"  && digits.startsWith("971")) return `+${digits}`;
  if (countryCode === "SA"  && digits.startsWith("966")) return `+${digits}`;
  // Leading zero — strip and prepend dial code
  if (digits.startsWith("0")) return `${country.dial}${digits.slice(1)}`;
  // Bare local digits — prepend dial code
  return `${country.dial}${digits}`;
}

/* ── Payment method types ── */
interface PaymentMethods {
  full_online: boolean;
  deposit_online: boolean;
  pay_at_salon: boolean;
  custom_deposit: boolean;
  deposit_percent: number;
}
const DEFAULT_PM: PaymentMethods = { full_online: true, deposit_online: true, pay_at_salon: false, custom_deposit: false, deposit_percent: 50 };

/* ── Stripe Payment Form ── */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CheckoutForm({ amount, chargeAmount, methodLabel, bookingId, reviewToken, onSuccess: _, onError, slug, service, date, time, name, salon }:
  { amount: number; chargeAmount: number; methodLabel: string; bookingId: string; reviewToken: string; onSuccess: ()=>void; onError:(msg:string)=>void; slug:string; service:string; date:string; time:string; name:string; salon:string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${appUrl}/payment/success?service=${encodeURIComponent(service)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&name=${encodeURIComponent(name)}&amount=${chargeAmount.toFixed(2)}&deposit=${chargeAmount < amount}&salon=${encodeURIComponent(salon)}&appt_id=${encodeURIComponent(bookingId)}&slug=${encodeURIComponent(slug)}${reviewToken ? `&review_token=${encodeURIComponent(reviewToken)}` : ""}`,
      },
    });
    if (error) { onError(error.message || "Payment failed"); setProcessing(false); }
  };

  return (
    <form onSubmit={handlePay}>
      <PaymentElement options={{ layout: "tabs" }} />
      <button type="submit" disabled={!stripe || processing} className="btn" style={{ marginTop: 24 }}>
        {processing ? "Processing..." : `Pay £${chargeAmount.toFixed(2)} — ${methodLabel}`}
      </button>
      <p style={{ textAlign:"center",fontSize:12,color:"#94A3B8",marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
        <span>🔒</span> Secured by Stripe · SSL Encrypted
      </p>
    </form>
  );
}
export default function BookingPage() {
  const { slug } = useParams() as { slug: string };

  const [salon, setSalon] = useState<SalonData | null>(null);
  const [bookingVc, setBookingVc] = useState(getVerticalConfig("other"));
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryItem[]>([]);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("all");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [selDate, setSelDate] = useState<Date|null>(null);
  const [selTime, setSelTime] = useState("");
  const [form, setForm] = useState({ name:"", email:"", phone:"" });
  const [errors, setErrors] = useState({ email:"", phone:"" });
  const [countryCode, setCountryCode] = useState<CountryCode>("GB"); // default UK
  const [phoneRaw, setPhoneRaw] = useState(""); // local format as typed
  const [countryDropOpen, setCountryDropOpen] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<string>(""); // 'full_online'|'deposit_online'|'custom_deposit'|'pay_at_salon'
  const [clientSecret, setClientSecret] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [paymentError, setPaymentError] = useState("");

  // Confirmation screen state (for pay_at_salon and free services)
  const [confirmedBooking, setConfirmedBooking] = useState<{ service: string; date: string; time: string; name: string; salon: string; apptId: string; paymentStatus: string; servicePrice: number; servicePriceIsFrom: boolean } | null>(null);

  // Review token — captured at booking time, shown as a "leave a review" link
  const [reviewToken, setReviewToken] = useState("");

  // Published reviews for this salon (shown below the booking widget)
  const [salonReviews, setSalonReviews] = useState<{ client_name: string; rating: number; comment: string | null; created_at: string }[]>([]);

  // Track already-booked time slots for selected date/staff
  const [bookedSlots, setBookedSlots] = useState<BookedInterval[]>([]);

  // Phone OTP verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpChallenge, setOtpChallenge] = useState("");

  const loadBookedSlots = useCallback(async (date: Date, _staffId: string | null, salonId: string, salonTz = "Europe/London") => {
    // _staffId kept for call-site compatibility; capacity filtering done in render, not the query
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    // Query wider window to account for timezone differences
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("appointments") as any)
      .select("staff_id, date_time, services(duration_minutes)")
      .eq("salon_id", salonId)
      .gte("date_time", `${dateStr}T00:00:00`)
      .lte("date_time", `${dateStr}T23:59:59`)
      .not("status", "eq", "cancelled");
    // Build [start, end) intervals tagged by staff for per-staff capacity checks
    const intervals = (data || []).map((a: { staff_id: string | null; date_time: string; services: { duration_minutes?: number } | null }) => {
      const start = utcToSalonTime(a.date_time, salonTz);
      const duration = a.services?.duration_minutes || 30;
      return { staffId: a.staff_id, start, end: addMinutesToSlot(start, duration) };
    });
    setBookedSlots(intervals);
  }, []);

  // Auto-detect country from IP — tries two services, falls back to PK
  useEffect(() => {
    const SUPPORTED: Record<string, CountryCode> = { GB: "GB", PK: "PK", AE: "AE", SA: "SA" };

    const tryDetect = async () => {
      // Primary: ipapi.co
      try {
        const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        const detected = SUPPORTED[d.country_code];
        if (detected) { setCountryCode(detected); return; }
      } catch { /* try backup */ }

      // Backup: ip-api.com (different provider, higher rate limit)
      try {
        const r = await fetch("https://ip-api.com/json/?fields=countryCode", { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        const detected = SUPPORTED[d.countryCode];
        if (detected) { setCountryCode(detected); return; }
      } catch { /* both failed — keep default PK */ }
    };

    tryDetect();
  }, []);

  // Close dropdown on outside click — must check the FULL wrapper, not just the trigger
  // (checking only the trigger causes the dropdown to close before the option click fires)
  useEffect(() => {
    if (!countryDropOpen) return;
    const handler = (e: MouseEvent) => {
      const wrapper = document.getElementById("phone-picker-wrapper");
      if (wrapper && !wrapper.contains(e.target as Node)) setCountryDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryDropOpen]);

  // Keep form.phone (E.164) in sync whenever raw input or country changes
  useEffect(() => {
    const e164 = toE164(phoneRaw, countryCode);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(prev => ({ ...prev, phone: e164 }));
  }, [phoneRaw, countryCode]);


  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: s } = await supabase.from("salons").select("id,name,slug,description,logo_url,payment_methods,timezone,country,business_type").eq("slug", slug).single();
      if (!s) { setNotFound(true); setLoading(false); return; }
      setSalon(s);
      setBookingVc(getVerticalConfig(s.business_type));
      const [{ data: sv },{ data: st },{ data: rv },{ data: cats }] = await Promise.all([
        supabase.from("services").select("*").eq("salon_id", s.id).order("price"),
        supabase.from("staff").select("*").eq("salon_id", s.id).eq("active", true),
        supabase.from("reviews").select("client_name,rating,comment,created_at").eq("salon_id", s.id).eq("is_published", true).order("created_at",{ascending:false}).limit(10),
        supabase.from("service_categories").select("id,name,sort_order").eq("salon_id", s.id).order("sort_order"),
      ]);
      setServices(sv||[]);
      setStaffList(st||[]);
      setSalonReviews(rv||[]);
      setCategories(cats||[]);
      setLoading(false);
    })();
  }, [slug]);

  const validateForm = useCallback(() => {
    const newErrors = { email:"", phone:"" };
    if (form.email && !isValidEmail(form.email)) newErrors.email = "Please enter a valid email address";
    const country = getCountryByCode(countryCode);
    if (!phoneRaw.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!isValidPhoneForCountry(phoneRaw, countryCode)) {
      newErrors.phone = `Enter a valid ${country.name} number (${country.hint})`;
    }
    setErrors(newErrors);
    return !newErrors.email && !newErrors.phone;
  }, [form.email, phoneRaw, countryCode]);

  // Derive available payment options from salon.payment_methods
  // Category filter tabs — only categories with at least one service render a tab.
  // If a business has never created a category, this list is empty and no tab
  // row renders at all, leaving the flat service list exactly as before.
  const categoriesWithServices = categories.filter(cat => services.some(s => s.category_id === cat.id));
  const visibleServices = selectedCategoryTab === "all"
    ? services
    : services.filter(s => s.category_id === selectedCategoryTab);

  const salonPm: PaymentMethods = salon?.payment_methods
    ? { ...DEFAULT_PM, ...salon.payment_methods }
    : DEFAULT_PM;

  // A variable-priced ("from £X") service can't be paid in full online — the
  // final amount is unknown and there's no balance-due flow, so the salon would
  // be locked into charging the listed floor price. Just omit the option.
  const isFromService = !!selectedService?.price_is_from;

  const paymentOptionsRaw = [
    (salonPm.full_online && !isFromService) && { id: "full_online",    label: "Pay Full Amount",           sub: "Pay 100% now — nothing due at the salon", pct: 100,                      color: "#667eea" },
    salonPm.deposit_online && { id: "deposit_online",  label: "50% Deposit",               sub: "Pay half now, remainder at salon",         pct: 50,                       color: "#10B981" },
    salonPm.custom_deposit && { id: "custom_deposit",  label: `${salonPm.deposit_percent}% Deposit`, sub: `Pay ${salonPm.deposit_percent}% now, remainder at salon`, pct: salonPm.deposit_percent, color: "#F59E0B" },
    salonPm.pay_at_salon   && { id: "pay_at_salon",   label: "Pay at Salon",               sub: "No payment required now",                  pct: 0,                        color: "#94A3B8" },
  ].filter(Boolean) as { id: string; label: string; sub: string; pct: number; color: string }[];

  // Fallback: if the salon's only enabled method was full online payment, hiding
  // it for a "from" service would leave zero bookable options. Force Pay at
  // Salon on instead of silently falling through to a broken $0/pending booking.
  const paymentOptions = (isFromService && paymentOptionsRaw.length === 0)
    ? [{ id: "pay_at_salon", label: "Pay at Salon", sub: "No payment required now", pct: 0, color: "#94A3B8" }]
    : paymentOptionsRaw;

  // Auto-select first available option
  const selectedOption = paymentOptions.find(o => o.id === paymentMethod) || paymentOptions[0];
  const chargeAmount = selectedOption ? (selectedService?.price || 0) * selectedOption.pct / 100 : 0;
  const isPayAtSalon = selectedOption?.id === "pay_at_salon";

  // Step 3 -> Step 4: Save appointment + conditionally create PaymentIntent
  const handleProceedToPayment = useCallback(async () => {
    if (!salon || !selectedService || !selDate || !selTime || !form.name.trim()) return;
    if (!validateForm()) return;
    setSubmitting(true);

    // Determine salon timezone: from salon data or fallback to Europe/London
    const salonTz: string = salon.timezone
      || COUNTRY_TIMEZONES[salon.country || ""]
      || "Europe/London";
    const dateStr = `${selDate.getFullYear()}-${String(selDate.getMonth()+1).padStart(2,"0")}-${String(selDate.getDate()).padStart(2,"0")}`;
    const iso = localTimeToUTC(dateStr, selTime, salonTz);

    // DEPLOY AFTER check_slot_available's new signature is live — the 4th
    // arg (p_duration_minutes) doesn't exist until then. Safe to deploy the
    // function first without this change (DEFAULT NULL keeps old callers
    // working); this line is what starts using the real duration.
    const { data: slotFree } = await supabase.rpc("check_slot_available", {
      p_salon_id:  salon.id,
      p_date_time: iso,
      p_staff_id:  selectedStaff?.id ?? null,
      p_duration_minutes: selectedService.duration_minutes ?? selectedService.duration ?? 30,
    });
    if (slotFree === false) { alert("This time slot is already booked. Please choose another time."); setSubmitting(false); return; }

    const pm = selectedOption?.id || "full_online";

    // Single source of truth for "this booking needs no online payment right
    // now" (pay-at-salon, or a genuinely £0 service) — computed once and used
    // for BOTH the insert's status/payment_status AND the branch below that
    // skips Stripe. These must never be decided separately: if they disagree,
    // the client sees "confirmed" on screen and in the confirmation email
    // while the row is silently stuck at status=pending/payment_status=pending.
    const isImmediatelyConfirmed = isPayAtSalon || chargeAmount === 0;

    // Build insert — payment_method column only exists after migration
    // salon.payment_methods being set is the proxy for whether migration has run
    const hasMigration = !!salon?.payment_methods;
    // id and review_token are generated client-side (crypto.randomUUID(), same
    // CSPRNG class as Postgres's gen_random_uuid() default) so the insert never
    // needs .select()/RETURNING to read them back. RETURNING is evaluated under
    // SELECT RLS, and appointments deliberately has no anon SELECT policy — an
    // insert-only anon key must never be able to read booking rows back.
    const bookingId = crypto.randomUUID();
    const reviewToken = crypto.randomUUID();
    // Stage 1 of the interval-overlap fix: end_time written at booking time
    // instead of re-derived live from services.duration_minutes on every
    // slot check (a live re-derivation would retroactively change a past
    // booking's occupied window if the service's duration is edited later).
    const serviceDurationMin = selectedService.duration_minutes ?? selectedService.duration ?? 30;
    const endTimeIso = new Date(new Date(iso).getTime() + serviceDurationMin * 60_000).toISOString();
    const payload = {
      id: bookingId, review_token: reviewToken,
      salon_id: salon.id, client_name: form.name, client_email: form.email,
      client_phone: form.phone, service_id: selectedService.id,
      staff_id: selectedStaff?.id || null, date_time: iso, end_time: endTimeIso,
      status: isImmediatelyConfirmed ? "confirmed" : "pending",
      payment_status: isImmediatelyConfirmed ? "pay_at_salon" : "pending",
      ...(hasMigration ? { payment_method: pm } : {}),
    };
    const { error } = await supabase
      .from("appointments")
      .insert(payload);

    if (error) {
      alert("Booking failed: " + (error?.message || "Unknown error."));
      setSubmitting(false); return;
    }
    setBookingId(bookingId);
    setReviewToken(reviewToken);

    // Pay at salon OR free service (£0) — skip Stripe, show confirmation directly
    if (isImmediatelyConfirmed) {
      // Fire confirmation email immediately (no Stripe webhook needed)
      fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: bookingId, token: reviewToken }),
      }).catch(e => console.error("[send-confirmation] failed:", e));

      const dateStr = selDate?.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}) || "";
      const servicePrice = selectedService?.price ?? 0;
      const payStatus = servicePrice > 0 ? "pay_at_salon" : "free";
      setConfirmedBooking({ service: selectedService.name, date: dateStr, time: selTime, name: form.name, salon: salon.name, apptId: bookingId, paymentStatus: payStatus, servicePrice, servicePriceIsFrom: !!selectedService?.price_is_from });
      setSubmitting(false);
      setStep(5);
      return;
    }

    // Online payment — create Stripe PaymentIntent
    const res = await fetch("/api/create-payment-intent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: selectedService.price, charge_amount: chargeAmount,
        email: form.email, booking_id: bookingId,
        salon_name: salon.name, service_name: selectedService.name,
        deposit_only: pm !== "full_online",
        salon_id: salon.id,
      }),
    });
    const data = await res.json();
    console.log("[PaymentIntent] response:", data);
    if (data.error || !data.clientSecret) {
      console.error("[PaymentIntent] error:", data.error);
      alert("Payment setup failed: " + (data.error || "Could not connect to payment provider."));
      setSubmitting(false); return;
    }
    setClientSecret(data.clientSecret);
    setSubmitting(false);
    setStep(4);
  }, [salon, selectedService, selectedStaff, selDate, selTime, form, selectedOption, isPayAtSalon, chargeAmount, validateForm]);

  const handleSendOtp = useCallback(async () => {
    if (!validateForm()) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error || "Failed to send code"); setOtpLoading(false); return; }
      setOtpChallenge(data.challenge || "");
      setOtpSent(true);
      setOtpCode("");
    } catch {
      setOtpError("Could not send verification code. Please try again.");
    }
    setOtpLoading(false);
  }, [form.email, validateForm]);

  const handleVerifyOtp = useCallback(async () => {
    if (!otpCode.trim()) { setOtpError("Please enter the code"); return; }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: otpCode, challenge: otpChallenge }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error || "Invalid code"); setOtpLoading(false); return; }
      setPhoneVerified(true);
      setOtpSent(false);
      await handleProceedToPayment();
    } catch {
      setOtpError("Verification failed. Please try again.");
    }
    setOtpLoading(false);
  }, [otpCode, form.email, otpChallenge, handleProceedToPayment]);

  const steps = ["Service", bookingVc.staffSingular, "Date & Time", "Details", "Payment"];
  // Salon-like verticals (scissors/sparkles/leaf) have relevant per-service emoji — others get a neutral icon
  const isSalonLike = ["scissors", "sparkles", "leaf"].includes(bookingVc.staffIcon);

  const canNext0 = !!selectedService;
  const canNext1 = staffConfirmed;
  const canNext2 = !!selDate && !!selTime;
  const canSubmit = !!form.name.trim() && !!form.email && !!form.phone && !errors.email && !errors.phone;
  const todayStr = new Date().toISOString().split("T")[0];

  if (loading) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
        <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:18,fontWeight:700,color:"white",textAlign:"center" }}>
          <div style={{ width:40,height:40,border:"3px solid rgba(255,255,255,0.3)",borderTop:"3px solid white",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px" }}></div>
          Loading...
        </div>
      </div>
    </>
  );

  if (notFound) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      Booking page not found.
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
        body{background:#F8FAFF;}
        input,button,textarea,select{-webkit-appearance:none;appearance:none;font-family:inherit;}
        .page-bg{min-height:100vh;background:linear-gradient(180deg,#667eea 0%,#764ba2 100%);padding-bottom:40px;}
        .container{max-width:680px;margin:auto;padding:0 20px;}
        .hero{padding:48px 20px 120px;text-align:center;position:relative;}
        .hero-bg{position:absolute;inset:0;background:url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23ffffff" fill-opacity="0.1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,112C1248,107,1344,117,1392,122.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>') no-repeat bottom;background-size:cover;opacity:0.3;}
        .logo-wrapper{width:104px;height:104px;border-radius:28px;background:white;padding:6px;margin:0 auto 20px;box-shadow:0 16px 32px rgba(0,0,0,0.25);position:relative;z-index:1;border:3px solid rgba(255,255,255,0.3);}
        .logo{width:100%;height:100%;border-radius:22px;object-fit:cover;}
        .logo-placeholder{width:100%;height:100%;border-radius:22px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:white;}
        .hero h1{font-size:32px;font-weight:800;letter-spacing:-1px;color:white;margin-bottom:8px;position:relative;z-index:1;}
        .hero p{font-size:15px;color:rgba(255,255,255,0.95);position:relative;z-index:1;font-weight:500;}
        .card{background:white;border-radius:24px;margin-top:-80px;position:relative;z-index:2;box-shadow:0 20px 60px rgba(0,0,0,0.15);padding:32px 24px;animation:slideUp 0.5s ease-out;}
        .progress{display:flex;gap:8px;margin-bottom:32px;}
        .progress-step{flex:1;height:4px;background:#E2E8F0;border-radius:2px;transition:all 0.3s;}
        .progress-step.active{background:linear-gradient(90deg,#667eea 0%,#764ba2 100%);box-shadow:0 2px 8px rgba(102,126,234,0.4);}
        .progress-labels{display:flex;justify-content:space-between;margin-bottom:24px;}
        .progress-label{font-size:12px;font-weight:600;color:#94A3B8;transition:color 0.3s;}
        .progress-label.active{color:#667eea;}
        h2{font-size:24px;font-weight:800;letter-spacing:-0.6px;margin-bottom:20px;color:#0F172A;}
        .item-card{border:2px solid #E2E8F0;border-radius:16px;padding:18px;margin-bottom:12px;cursor:pointer;background:white;transition:all 0.2s;display:flex;align-items:center;gap:16px;}
        .item-card:hover{border-color:#CBD5E1;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.08);}
        .item-card.selected{border-color:#667eea;background:linear-gradient(135deg,rgba(102,126,234,0.05) 0%,rgba(118,75,162,0.05) 100%);box-shadow:0 4px 12px rgba(102,126,234,0.2);}
        .item-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#F1F5F9 0%,#E2E8F0 100%);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
        .item-content{flex:1;}
        .item-content h3{font-size:16px;font-weight:700;letter-spacing:-0.3px;margin-bottom:4px;color:#0F172A;}
        .item-content p{font-size:14px;color:#64748B;font-weight:600;}
        .item-meta{font-size:13px;color:#64748B;font-weight:500;}
        .cat-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;margin-bottom:6px;-webkit-overflow-scrolling:touch;scrollbar-width:none;max-width:100%;}
        .cat-tabs::-webkit-scrollbar{display:none;}
        .cat-tab{flex-shrink:0;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:700;border:1.5px solid #64748B;background:#fff;color:#1E293B;cursor:pointer;white-space:nowrap;font-family:inherit;transition:background 0.15s,border-color 0.15s,color 0.15s;}
        .cat-tab:hover{border-color:#334155;}
        .cat-tab:focus-visible{outline:3px solid #0F172A;outline-offset:2px;}
        .cat-tab.active{background:#0F172A;border-color:#0F172A;color:#fff;}
        .btn{width:100%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:16px;border-radius:14px;font-weight:700;cursor:pointer;margin-top:24px;font-size:16px;letter-spacing:-0.3px;box-shadow:0 8px 16px rgba(102,126,234,0.4);transition:all 0.2s;}
        .btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 24px rgba(102,126,234,0.5);}
        .btn:disabled{opacity:0.5;cursor:not-allowed;box-shadow:none;}
        .back-btn{background:none;border:none;color:#667eea;font-weight:700;cursor:pointer;margin-bottom:20px;font-size:15px;padding:8px 0;display:flex;align-items:center;gap:6px;}
        .input-group{margin-bottom:20px;}
        .input-label{display:block;font-size:14px;font-weight:700;color:#334155;margin-bottom:8px;letter-spacing:-0.2px;}
        .input{width:100%;padding:14px 16px;border-radius:12px;border:2px solid #E2E8F0;font-size:15px;font-weight:600;color:#0F172A;transition:all 0.2s;background:#F8FAFC;}
        .input:focus{outline:none;border-color:#667eea;background:white;box-shadow:0 0 0 4px rgba(102,126,234,0.1);}
        .input.error{border-color:#EF4444;background:#FEF2F2;}
        .error-text{font-size:13px;color:#EF4444;font-weight:600;margin-top:6px;display:block;}
        .time-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px;}
        .time-btn{padding:12px;border-radius:12px;border:2px solid #E2E8F0;background:white;cursor:pointer;font-weight:700;font-size:14px;color:#334155;transition:all 0.2s;}
        .time-btn.selected{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-color:transparent;box-shadow:0 4px 12px rgba(102,126,234,0.4);}
        .time-btn:disabled{opacity:0.3;cursor:not-allowed;}
        .summary{padding:20px;background:linear-gradient(135deg,#F8FAFC 0%,#F1F5F9 100%);border-radius:16px;margin-top:24px;border:2px solid #E2E8F0;}
        .summary-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;}
        .summary-row:last-child{border-bottom:none;padding-bottom:0;}
        .summary-label{font-size:14px;color:#64748B;font-weight:600;}
        .summary-value{font-size:14px;color:#0F172A;font-weight:700;}
        .deposit-option{border:2px solid #E2E8F0;border-radius:16px;padding:16px;cursor:pointer;transition:all 0.2s;margin-bottom:10px;}
        .deposit-option.selected{border-color:#667eea;background:linear-gradient(135deg,rgba(102,126,234,0.05),rgba(118,75,162,0.05));}
        .summary-total{color:#667eea;font-size:18px}
        @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @media(max-width:640px){.time-grid{grid-template-columns:repeat(3,1fr)}.hero{padding:32px 20px 100px}.hero h1{font-size:26px}.card{padding:24px 20px;margin-top:-60px}.logo-wrapper{width:88px;height:88px}.time-btn{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center}}
        @media(max-width:480px){.progress-label{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:20%}.otp-input{font-size:24px;letter-spacing:8px}.summary-total{font-size:16px}}
      `}</style>

      <div className="page-bg">
        <div className="hero">
          <div className="hero-bg"></div>
          <div className="logo-wrapper">
            {salon?.logo_url
              ? <Image src={salon.logo_url} className="logo" alt={salon.name} width={92} height={92} style={{ borderRadius: 22, objectFit: "cover" }}/>
              : <div className="logo-placeholder">{getInitials(salon?.name||"S")}</div>}
          </div>
          <h1>{salon?.name}</h1>
          {salon?.description && <p>{salon.description}</p>}
        </div>

        <div className="container">
          <div className="card">
            <div className="progress">
              {steps.map((_,i) => <div key={i} className={`progress-step ${i<=step?"active":""}`}></div>)}
            </div>
            <div className="progress-labels">
              {steps.map((label,i) => <span key={i} className={`progress-label ${i<=step?"active":""}`}>{label}</span>)}
            </div>

            {/* Step 0: Service */}
            {step===0 && (
              <>
                <h2>Choose Your Service</h2>
                {categoriesWithServices.length > 0 && (
                  <div className="cat-tabs" aria-label="Filter services by category">
                    <button type="button" aria-pressed={selectedCategoryTab === "all"}
                      className={`cat-tab ${selectedCategoryTab === "all" ? "active" : ""}`}
                      onClick={() => setSelectedCategoryTab("all")}>All</button>
                    {categoriesWithServices.map(cat => (
                      <button key={cat.id} type="button" aria-pressed={selectedCategoryTab === cat.id}
                        className={`cat-tab ${selectedCategoryTab === cat.id ? "active" : ""}`}
                        onClick={() => setSelectedCategoryTab(cat.id)}>{cat.name}</button>
                    ))}
                  </div>
                )}
                {services.length === 0 ? (
                  <div style={{ textAlign:"center",padding:"32px 16px",background:"#F8FAFF",borderRadius:16,border:"1.5px dashed #C7D2FE" }}>
                    <div style={{ fontSize:48,marginBottom:12 }}>📋</div>
                    <div style={{ fontSize:16,fontWeight:700,color:"#0F172A",marginBottom:8 }}>No services available yet</div>
                    <div style={{ fontSize:13,color:"#64748B",lineHeight:1.6 }}>{salon?.name} hasn&apos;t set up their services yet.<br/>Please contact them directly to book.</div>
                  </div>
                ) : (
                  visibleServices.map(s => {
                    const metaParts = [
                      ((s.duration_minutes ?? 0) > 0 || (s.duration ?? 0) > 0) ? `${s.duration_minutes || s.duration} mins` : null,
                      (s.gender_restriction && s.gender_restriction !== "all") ? (s.gender_restriction === "female" ? "Female only" : "Men only") : null,
                    ].filter(Boolean);
                    return (
                    <div key={s.id} className={`item-card ${selectedService?.id===s.id?"selected":""}`} onClick={()=>setSelectedService(s)}>
                      <div className="item-icon">{isSalonLike ? getServiceIcon(s.name) : "📋"}</div>
                      <div className="item-content">
                        <h3>{s.name}</h3>
                        <p>{s.price_is_from ? "from " : ""}£{s.price}</p>
                        {metaParts.length > 0 && <span className="item-meta">{metaParts.join(" · ")}</span>}
                        {s.description && <span style={{display:"block",fontSize:12,color:"#94A3B8",fontStyle:"italic",marginTop:2}}>{s.description}</span>}
                      </div>
                    </div>
                    );
                  })
                )}
                <button className="btn" disabled={!canNext0} onClick={()=>setStep(1)}>Continue →</button>
              </>
            )}

            {/* Step 1: Staff */}
            {step===1 && (
              <>
                <button onClick={()=>setStep(0)} className="back-btn">← Back to Services</button>
                <h2>Select Your {bookingVc.staffSingular}</h2>
                <div className={`item-card ${staffConfirmed&&selectedStaff===null?"selected":""}`} onClick={()=>{setSelectedStaff(null);setStaffConfirmed(true);}}>
                  <div className="item-icon">👥</div>
                  <div className="item-content"><h3>Any Available {bookingVc.staffSingular}</h3><p>We will assign the best available</p></div>
                </div>
                {staffList.map(s => (
                  <div key={s.id} className={`item-card ${selectedStaff?.id===s.id?"selected":""}`} onClick={()=>{setSelectedStaff(s);setStaffConfirmed(true);}}>
                    <div className="item-icon">{getInitials(s.name)}</div>
                    <div className="item-content"><h3>{s.name}</h3>{s.role&&<p>{s.role}</p>}</div>
                  </div>
                ))}
                <button className="btn" disabled={!canNext1} onClick={()=>setStep(2)}>Continue →</button>
              </>
            )}

            {/* Step 2: Date & Time */}
            {step===2 && (
              <>
                <button onClick={()=>setStep(1)} className="back-btn">← Back to {bookingVc.staffSingular}</button>
                <h2>Pick Date & Time</h2>
                <div className="input-group">
                  <label className="input-label">Select Date</label>
                  <input type="date" className="input" min={todayStr} onChange={e=>{
                    const d = new Date(e.target.value + "T12:00:00Z"); // noon UTC avoids date-shift
                    setSelDate(d);
                    setSelTime("");
                    if (!salon) return;
                    const salonTz: string = salon.timezone
                      || COUNTRY_TIMEZONES[salon.country || ""] || "Europe/London";
                    loadBookedSlots(d, selectedStaff?.id || null, salon.id, salonTz);
                  }}/>
                </div>
                {selDate && (() => {
                  const { offDay, slot: hoursLabel } = getAvailableSlots(TIME_SLOTS, selectedStaff, selDate);
                  if (offDay) return (
                    <div style={{ padding:"16px",background:"#FFF7ED",borderRadius:14,border:"1.5px solid #FED7AA",textAlign:"center" }}>
                      <div style={{ fontSize:28,marginBottom:8 }}>😴</div>
                      <div style={{ fontSize:15,fontWeight:700,color:"#9A3412" }}>{selectedStaff?.name} is off on this day</div>
                      <div style={{ fontSize:13,color:"#C2410C",marginTop:4 }}>Please choose a different date or select &quot;Any Available Staff&quot;</div>
                    </div>
                  );
                  const now = new Date();
                  const filteredSlots = TIME_SLOTS.filter(t => isSlotInRange(t, selectedStaff, selDate));
                  const serviceDuration = selectedService
                    ? (selectedService.duration_minutes ?? selectedService.duration ?? 30)
                    : 30;
                  const dayKey = DAY_KEYS[selDate.getDay()];

                  const cbOpts = { selectedStaff, staffList, bookedIntervals: bookedSlots, serviceDuration, dayKey };

                  const availableCount = filteredSlots.filter(t => {
                    const dt = new Date(`${selDate.getFullYear()}-${String(selDate.getMonth()+1).padStart(2,"0")}-${String(selDate.getDate()).padStart(2,"0")}T${t}`);
                    const isPast = dt < now && selDate.toDateString()===now.toDateString();
                    return !isPast && !computeBlocked(t, cbOpts);
                  }).length;
                  return (
                    <>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                        <label className="input-label" style={{margin:0}}>Available Times</label>
                        {selectedStaff && hoursLabel && (
                          <span style={{ fontSize:11.5,color:"#64748B",background:"#F1F5F9",padding:"3px 10px",borderRadius:20,fontWeight:600,flexShrink:0 }}>
                            {selectedStaff.name}: {hoursLabel}
                          </span>
                        )}
                      </div>
                      {availableCount === 0 ? (
                        <div style={{ padding:"20px",background:"#FEF2F2",borderRadius:14,border:"1.5px solid #FECACA",textAlign:"center",marginBottom:12 }}>
                          <div style={{ fontSize:28,marginBottom:8 }}>📵</div>
                          <div style={{ fontSize:15,fontWeight:700,color:"#991B1B" }}>Fully Booked</div>
                          <div style={{ fontSize:13,color:"#B91C1C",marginTop:4 }}>No slots left for this day. Please pick a different date.</div>
                        </div>
                      ) : (
                        <div className="time-grid">
                          {filteredSlots.map(t => {
                            const dt = new Date(`${selDate.getFullYear()}-${String(selDate.getMonth()+1).padStart(2,"0")}-${String(selDate.getDate()).padStart(2,"0")}T${t}`);
                            const isPast = dt < now && selDate.toDateString()===now.toDateString();
                            const slotEnd = addMinutesToSlot(t, serviceDuration);
                            const isBlocked = computeBlocked(t, cbOpts);
                            const isEligible = selectedStaff !== null
                              ? isStaffAvailableForWindow(selectedStaff, t, slotEnd, dayKey)
                              : staffList.some(s => isStaffAvailableForWindow(s, t, slotEnd, dayKey));
                            const disabled = isPast || isBlocked;
                            return (
                              <button key={t} disabled={disabled}
                                className={`time-btn ${selTime===t?"selected":""}`}
                                onClick={()=>!disabled&&setSelTime(t)}
                                title={isBlocked ? (isEligible ? "Fully booked" : "Outside working hours") : ""}
                                style={isBlocked ? { textDecoration:"line-through",opacity:0.45,cursor:"not-allowed",fontSize:12 } : {}}>
                                {t}{isBlocked ? <span style={{display:"block",fontSize:9,color:"#EF4444",fontWeight:700}}>Taken</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button className="btn" disabled={!canNext2} onClick={()=>setStep(3)}>Continue →</button>
                    </>
                  );
                })()}
              </>
            )}

            {/* Step 3: Details + Payment Option */}
            {step===3 && (
              <>
                <button onClick={()=>setStep(2)} className="back-btn">← Back to Date & Time</button>
                <h2>Your Information</h2>
                <div className="input-group">
                  <label className="input-label">Full Name *</label>
                  <input className="input" placeholder="John Doe" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
                </div>
                <div className="input-group">
                  <label className="input-label">Email Address *</label>
                  <input className={`input ${errors.email?"error":""}`} placeholder="john@example.com" type="email" value={form.email} onChange={e=>{setForm({...form,email:e.target.value});if(errors.email)setErrors({...errors,email:""});}} onBlur={validateForm}/>
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>
                <div className="input-group">
                  <label className="input-label">Phone Number *</label>
                  <div id="phone-picker-wrapper" style={{ position: "relative" }}>
                    <div style={{ display: "flex", border: `2px solid ${errors.phone ? "#EF4444" : "#E2E8F0"}`, borderRadius: 12, overflow: "visible", background: errors.phone ? "#FEF2F2" : "#F8FAFC", transition: "all 0.2s" }}>
                      {/* Country dropdown trigger */}
                      <button
                        id="phone-country-btn"
                        type="button"
                        onClick={() => setCountryDropOpen(o => !o)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "14px 12px", background: "transparent", border: "none", borderRight: "2px solid #E2E8F0", cursor: "pointer", flexShrink: 0, fontWeight: 700, fontSize: 14, color: "#334155", whiteSpace: "nowrap" }}
                      >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{getCountryByCode(countryCode).flag}</span>
                        <span>{getCountryByCode(countryCode).dial}</span>
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>▼</span>
                      </button>
                      {/* Number input */}
                      <input
                        id="phone-number-input"
                        type="tel"
                        className={errors.phone ? "error" : ""}
                        placeholder={getCountryByCode(countryCode).placeholder}
                        value={phoneRaw}
                        onChange={e => {
                          const raw = e.target.value;
                          setPhoneRaw(raw); // E.164 sync handled by useEffect
                          if (errors.phone) setErrors(prev => ({ ...prev, phone: "" }));
                        }}
                        onBlur={validateForm}
                        style={{ flex: 1, padding: "14px 16px", border: "none", background: "transparent", fontSize: 15, fontWeight: 600, color: "#0F172A", outline: "none", minWidth: 0 }}
                      />
                    </div>
                    {/* Dropdown */}
                    {countryDropOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100, background: "white", border: "2px solid #E2E8F0", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 220 }}>
                        {COUNTRIES.map(c => (
                          <button
                            key={c.code}
                            type="button"
                            id={`country-opt-${c.code}`}
                            onClick={() => {
                              setCountryCode(c.code);      // triggers useEffect → updates form.phone
                              setCountryDropOpen(false);
                              setErrors(prev => ({ ...prev, phone: "" }));
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", border: "none", background: countryCode === c.code ? "#F1F5FF" : "white", cursor: "pointer", fontSize: 14, fontWeight: countryCode === c.code ? 700 : 500, color: "#0F172A", textAlign: "left", transition: "background 0.15s" }}
                          >
                            <span style={{ fontSize: 20 }}>{c.flag}</span>
                            <span style={{ flex: 1 }}>{c.name}</span>
                            <span style={{ color: "#94A3B8", fontWeight: 600 }}>{c.dial}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.phone
                    ? <span className="error-text">{errors.phone}</span>
                    : <span style={{ fontSize: 12, color: "#94A3B8", marginTop: 5, display: "block" }}>{getCountryByCode(countryCode).hint} · Auto-detected from your location</span>
                  }
                </div>

                {/* Dynamic payment options from salon settings */}
                {paymentOptions.length > 0 && (
                  <div style={{marginTop:24}}>
                    <div className="input-label" style={{marginBottom:12}}>Payment Option</div>
                    {paymentOptions.map(opt => {
                      const servicePrice = selectedService?.price || 0;
                      const amt = opt.pct === 0 ? servicePrice : servicePrice * opt.pct / 100;
                      const isSelected = (paymentMethod || paymentOptions[0]?.id) === opt.id;
                      return (
                        <div key={opt.id} className={`deposit-option ${isSelected ? "selected" : ""}`} onClick={() => setPaymentMethod(opt.id)}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                            <div>
                              <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>{opt.label}</div>
                              <div style={{fontSize:13,color:"#64748B",marginTop:2}}>{opt.sub}</div>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:18,fontWeight:800,color:opt.color}}>{selectedService?.price_is_from ? "from " : ""}£{amt.toFixed(2)}</div>
                              {opt.pct < 100 && opt.pct > 0 && <div style={{fontSize:11,color:"#94A3B8"}}>today</div>}
                              {opt.pct === 0 && <div style={{fontSize:11,color:"#94A3B8"}}>at salon</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="summary">
                  <div className="summary-row"><span className="summary-label">Service</span><span className="summary-value">{selectedService?.name}</span></div>
                  {isPayAtSalon && (
                    <div className="summary-row">
                      <span className="summary-label">Price</span>
                      <span className="summary-value">{selectedService?.price_is_from ? "from " : ""}£{(selectedService?.price || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="summary-row"><span className="summary-label">{bookingVc.staffSingular}</span><span className="summary-value">{selectedStaff?.name||"Any available"}</span></div>
                  <div className="summary-row"><span className="summary-label">Date</span><span className="summary-value">{selDate?.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</span></div>
                  <div className="summary-row"><span className="summary-label">Time</span><span className="summary-value">{selTime}</span></div>
                  <div className="summary-row"><span className="summary-label">{isPayAtSalon ? "Due Now" : selectedOption?.pct === 100 ? "Total" : "Deposit Due"}</span><span className="summary-value summary-total">£{chargeAmount.toFixed(2)}{isPayAtSalon ? " (pay at salon)" : ""}</span></div>
                </div>

                {/* OTP Verification Screen */}
                {otpSent && !phoneVerified ? (
                  <div style={{ marginTop: 24, background: "#F8FAFF", border: "2px solid #667eea", borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Verify Your Email</div>
                    <div style={{ fontSize: 14, color: "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
                      We&apos;ve sent a 6-digit code to<br/>
                      <strong style={{ color: "#0F172A" }}>{form.email}</strong>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="otp-input"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
                      style={{ width: "100%", padding: "16px", fontSize: 28, fontWeight: 800, letterSpacing: 12, textAlign: "center", border: `2px solid ${otpError ? "#EF4444" : "#667eea"}`, borderRadius: 14, outline: "none", background: "#fff", color: "#0F172A", boxSizing: "border-box", marginBottom: 8 }}
                    />
                    {otpError && <div style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, marginBottom: 12 }}>{otpError}</div>}
                    <button
                      className="btn"
                      disabled={otpCode.length < 4 || otpLoading || submitting}
                      onClick={handleVerifyOtp}
                      style={{ marginTop: 8 }}
                    >
                      {otpLoading || submitting ? "Verifying…" : "Verify & Continue →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtpError(""); setOtpCode(""); }}
                      style={{ background: "none", border: "none", color: "#667eea", fontWeight: 700, cursor: "pointer", fontSize: 14, marginTop: 14, display: "block", width: "100%" }}
                    >
                      ← Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpLoading}
                      style={{ background: "none", border: "none", color: "#94A3B8", fontWeight: 600, cursor: "pointer", fontSize: 13, marginTop: 4, display: "block", width: "100%" }}
                    >
                      Resend Code
                    </button>
                  </div>
                ) : (
                  <button className="btn" disabled={!canSubmit || submitting || otpLoading} onClick={handleSendOtp}>
                    {otpLoading ? "Sending code…" : submitting ? "Setting up payment…" : "Proceed to Payment →"}
                  </button>
                )}
              </>
            )}

            {/* Step 4: Stripe Payment */}
            {step===4 && clientSecret && (
              <>
                <button onClick={()=>setStep(3)} className="back-btn">← Back to Details</button>
                {STRIPE_KEY_MISSING && (
                  <div style={{ padding:"14px 16px",background:"#FEF2F2",borderRadius:12,border:"1px solid #FECACA",marginBottom:16,fontSize:13,color:"#DC2626",fontWeight:600 }}>
                    ⚠️ Online payments are not configured. Please contact the salon to pay in person.
                  </div>
                )}
                <h2>Secure Payment</h2>
                <div style={{padding:"14px 16px",background:"#F8FAFC",borderRadius:12,border:"1px solid #E2E8F0",marginBottom:20}}>
                  <div style={{fontSize:12,color:"#64748B",fontWeight:600,marginBottom:4}}>Paying for</div>
                  <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>{selectedService?.name} at {salon?.name}</div>
                   <div style={{fontSize:13,color:"#667eea",fontWeight:700,marginTop:2}}>
                    £{chargeAmount.toFixed(2)}
                    {selectedOption && selectedOption.pct < 100 ? ` (${selectedOption.label})` : ""}
                   </div>
                </div>
                {paymentError && <div style={{padding:"12px 14px",background:"#FEF2F2",borderRadius:10,border:"1px solid #FECACA",color:"#EF4444",fontSize:13,fontWeight:600,marginBottom:16}}>⚠️ {paymentError}</div>}
                <Elements stripe={stripePromise} options={{ clientSecret, appearance:{ theme:"stripe", variables:{ colorPrimary:"#667eea", borderRadius:"12px", fontFamily:"'Plus Jakarta Sans', system-ui, sans-serif" } } }}>
                  <CheckoutForm
                    amount={selectedService?.price||0}
                    chargeAmount={chargeAmount}
                    methodLabel={selectedOption?.label||"Pay"}
                    bookingId={bookingId}
                    reviewToken={reviewToken}
                    onSuccess={()=>setStep(5)}
                    onError={msg=>setPaymentError(msg)}
                    slug={slug}
                    service={selectedService?.name||""}
                    date={selDate?.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})||""}
                    time={selTime}
                    name={form.name}
                    salon={salon?.name||""}
                  />
                </Elements>
              </>
            )}

            {/* Step 5: Booking Confirmed (pay_at_salon) */}
            {step===5 && confirmedBooking && (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                {/* Success icon */}
                <div style={{ width: 88, height: 88, borderRadius: "50%", background: "linear-gradient(135deg,#10B981 0%,#059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 12px 32px rgba(16,185,129,0.35)" }}>
                  <span style={{ fontSize: 40 }}>✓</span>
                </div>

                <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.8px", marginBottom: 8 }}>Booking Confirmed!</h2>
                <p style={{ fontSize: 15, color: "#64748B", fontWeight: 500, marginBottom: 28 }}>We look forward to seeing you, {confirmedBooking.name}.</p>

                {/* Details card */}
                <div style={{ background: "linear-gradient(135deg,#F8FAFC 0%,#F1F5F9 100%)", borderRadius: 20, border: "2px solid #E2E8F0", padding: "24px 20px", textAlign: "left", marginBottom: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {/* Service */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✂️</div>
                      <div>
                        <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Service</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{confirmedBooking.service}</div>
                      </div>
                    </div>
                    {/* Date */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📅</div>
                      <div>
                        <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{confirmedBooking.date}</div>
                      </div>
                    </div>
                    {/* Time */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🕐</div>
                      <div>
                        <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Time</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{confirmedBooking.time}</div>
                      </div>
                    </div>
                    {/* Payment */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#10B981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💳</div>
                      <div>
                        <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Payment</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          {confirmedBooking.paymentStatus === "free" ? (
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#6366F1", background: "rgba(99,102,241,0.1)", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(99,102,241,0.2)" }}>Free Service — No Payment</span>
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.2)" }}>Pay at Salon — {confirmedBooking.servicePriceIsFrom ? "from " : ""}£{confirmedBooking.servicePrice.toFixed(2)} due at salon</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirmation note */}
                <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500, lineHeight: 1.6 }}>A confirmation has been sent to your email and phone. Please arrive a few minutes early.</p>

                {/* Action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                  {confirmedBooking?.apptId && (
                    <a href={`/reschedule/${confirmedBooking.apptId}?token=${reviewToken}`}
                      style={{ display: "block", padding: "12px 24px", background: "#F1F5F9", color: "#475569", borderRadius: 12, textDecoration: "none", fontSize: 13, fontWeight: 700, border: "1.5px solid #E2E8F0", textAlign: "center" }}>
                      📅 Manage / Reschedule Appointment
                    </a>
                  )}
                  {reviewToken && (
                    <a href={`/review/${reviewToken}`}
                      style={{ display: "block", padding: "12px 24px", background: "#FFFBEB", color: "#D97706", borderRadius: 12, textDecoration: "none", fontSize: 13, fontWeight: 700, border: "1.5px solid #FDE68A", textAlign: "center" }}>
                      ⭐ Leave a Review After Your Visit
                    </a>
                  )}
                  <a href={`/book/${slug}`}
                    style={{ display: "block", padding: "12px 24px", background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", color: "#fff", borderRadius: 12, textDecoration: "none", fontSize: 13, fontWeight: 700, textAlign: "center", boxShadow: "0 4px 12px rgba(102,126,234,0.35)" }}>
                    📅 Book Another Appointment
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Reviews section (below booking widget) ── */}
        {salon && (() => {
          const avg = salonReviews.length
            ? salonReviews.reduce((s, r) => s + r.rating, 0) / salonReviews.length
            : 0;
          return (
            <div style={{ maxWidth: 480, margin: "24px auto 40px", width: "100%", padding: "0 16px" }}>
              <div style={{ background: "#fff", borderRadius: 24, border: "2px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                {/* Header */}
                <div style={{ padding: "18px 24px", background: "linear-gradient(135deg,#F8FAFC,#F1F5F9)", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px" }}>Client Reviews</div>
                    {salonReviews.length > 0 && (
                      <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                        {avg.toFixed(1)} ★ · {salonReviews.length} review{salonReviews.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  {salonReviews.length > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: "#F59E0B", letterSpacing: "-1px", lineHeight: 1 }}>{avg.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>out of 5</div>
                    </div>
                  )}
                </div>

                {salonReviews.length === 0 ? (
                  <div style={{ padding: "36px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>No reviews yet</div>
                    <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>Be the first to leave a review after your visit</div>
                  </div>
                ) : (
                  <div>
                    {salonReviews.map((r, i) => (
                      <div key={i} style={{ padding: "16px 24px", borderBottom: i < salonReviews.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{reviewerDisplayName(r.client_name)}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                              {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                          <div style={{ color: "#F59E0B", fontSize: 14, letterSpacing: 1, flexShrink: 0 }}>
                            {"★".repeat(r.rating)}<span style={{ color: "#E2E8F0" }}>{"★".repeat(5 - r.rating)}</span>
                          </div>
                        </div>
                        {r.comment && (
                          <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.65, margin: 0 }}>&ldquo;{r.comment}&rdquo;</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Powered by Feature */}
        <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
          <a
            href="https://featuresalon.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 12, textDecoration: "none",
              background: "rgba(255,255,255,0.95)",
              padding: "5px 14px",
              borderRadius: 999,
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            }}
          >
            <span style={{ color: "#6b7280", fontWeight: 500 }}>Powered by</span>
            {" "}
            <span style={{ fontWeight: 700, color: "#7C3AED" }}>Feature</span>
          </a>
        </div>

      </div>
    </>
  );
}