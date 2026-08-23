import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * FROM address for all platform emails.
 *
 * IMPORTANT — Multi-tenant fix:
 * "onboarding@resend.dev" only delivers to the Resend account owner's email.
 * Any other recipient (other salon owners / their clients) will silently fail.
 * Use a VERIFIED custom domain address instead.
 *
 * Setup: Resend Dashboard → Domains → Add featuresalon.co.uk → verify DNS
 * Then set FROM_EMAIL=noreply@featuresalon.co.uk in Vercel env vars.
 */
const FROM = process.env.FROM_EMAIL || "noreply@featuresalon.co.uk";

// ─────────────────────────────────────────
// Business-type–aware Email Terms
// ─────────────────────────────────────────
type EmailTerms = {
  serviceEmoji: string;
  serviceLabel: string;
  staffEmoji: string;
  staffLabel: string;
  bookingWord: string;   // "appointment" | "session" | "class" | "treatment"
  headerIcon: string;    // shown after "Booking Confirmed!"
  greetingLine: string;  // body line after "Hi {name},"
};

function getEmailTerms(businessType?: string): EmailTerms {
  switch (businessType) {
    case "barber":
      return { serviceEmoji:"✂️", serviceLabel:"Service",    staffEmoji:"💈", staffLabel:"Barber",           bookingWord:"appointment", headerIcon:"✂️", greetingLine:"We can't wait to see you!" };
    case "beauty":
      return { serviceEmoji:"✨", serviceLabel:"Treatment",  staffEmoji:"✨", staffLabel:"Beauty Therapist", bookingWord:"appointment", headerIcon:"✨", greetingLine:"We can't wait to see you!" };
    case "nail":
      return { serviceEmoji:"💅", serviceLabel:"Service",    staffEmoji:"💅", staffLabel:"Nail Technician",  bookingWord:"appointment", headerIcon:"💅", greetingLine:"We can't wait to see you!" };
    case "spa":
      return { serviceEmoji:"🌿", serviceLabel:"Treatment",  staffEmoji:"🌿", staffLabel:"Therapist",        bookingWord:"treatment",   headerIcon:"🌿", greetingLine:"We look forward to welcoming you." };
    case "massage":
      return { serviceEmoji:"💆", serviceLabel:"Treatment",  staffEmoji:"🤲", staffLabel:"Therapist",        bookingWord:"treatment",   headerIcon:"💆", greetingLine:"We look forward to welcoming you." };
    case "gym":
      return { serviceEmoji:"🏋️", serviceLabel:"Session",    staffEmoji:"🏋️", staffLabel:"Trainer",          bookingWord:"session",     headerIcon:"🏋️", greetingLine:"We're looking forward to seeing you!" };
    case "yoga":
      return { serviceEmoji:"🧘", serviceLabel:"Class",      staffEmoji:"🧘", staffLabel:"Instructor",       bookingWord:"class",       headerIcon:"🧘", greetingLine:"See you on the mat!" };
    case "physio":
      return { serviceEmoji:"🤸", serviceLabel:"Session",    staffEmoji:"🤸", staffLabel:"Physiotherapist",  bookingWord:"session",     headerIcon:"🤸", greetingLine:"We look forward to helping you." };
    case "dental":
      return { serviceEmoji:"🦷", serviceLabel:"Appointment",staffEmoji:"🦷", staffLabel:"Practitioner",     bookingWord:"appointment", headerIcon:"🦷", greetingLine:"We look forward to seeing you." };
    case "pt":
      return { serviceEmoji:"🏃", serviceLabel:"Session",    staffEmoji:"🏃", staffLabel:"Personal Trainer", bookingWord:"session",     headerIcon:"🏃", greetingLine:"Ready to help you smash your goals!" };
    case "hair":
    default:
      return { serviceEmoji:"✂️", serviceLabel:"Service",    staffEmoji:"💇", staffLabel:"Stylist",          bookingWord:"appointment", headerIcon:"✂️", greetingLine:"We can't wait to see you!" };
  }
}

// Helper — wraps every resend.emails.send with clear error logging
async function sendEmailSafe(payload: Parameters<typeof resend.emails.send>[0]) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error(
      `[email] ❌ Resend error sending to ${payload.to} from ${payload.from}:`,
      JSON.stringify(error)
    );
    throw new Error(`Resend delivery failed: ${JSON.stringify(error)}`);
  }
  console.log(`[email] ✅ Sent "${payload.subject}" → ${payload.to} (id=${data?.id})`);
  return data;
}

// ─────────────────────────────────────────
// UK Date Formatter
// ─────────────────────────────────────────
function formatDate(dateTime: string) {
  const date = new Date(dateTime);
  return {
    formattedDate: date.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "Europe/London",
    }),
    formattedTime: date.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Europe/London",
    }),
  };
}

// ─────────────────────────────────────────
// Shared Email Template
// ─────────────────────────────────────────
function emailTemplate({
  title, clientName, message, serviceName,
  formattedDate, formattedTime, staffName, salonName,
  color, price, extra, unsubLink, terms,
}: {
  title: string; clientName: string; message: string;
  serviceName?: string; formattedDate?: string; formattedTime?: string;
  staffName?: string; salonName: string; color: string;
  price?: number; extra?: string; unsubLink?: string; terms?: EmailTerms;
}) {
  unsubLink = unsubLink ?? `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe`;
  return `
  <!DOCTYPE html>
  <html lang="en-GB">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
  <body style="margin:0;padding:0;background:#F4F4F5;">
    <div style="max-width:520px;margin:32px auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,${color} 0%,#7B2D52 100%);padding:32px 28px;text-align:center;">
        <p style="color:rgba(255,255,255,0.7);margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salonName}</p>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600;">${title}</h1>
      </div>

      <!-- Body -->
      <div style="background:#fff;padding:28px;">
        <p style="font-size:15px;margin:0 0 14px;color:#222;">Dear <strong>${clientName}</strong>,</p>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">${message}</p>

        ${(formattedDate || serviceName) ? `
        <div style="background:#FDF5F8;border:1px solid #F0C4D4;border-radius:10px;padding:18px 20px;margin-bottom:22px;">
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            ${formattedDate ? `<tr><td style="color:#999;padding:6px 0;width:120px;">📅 Date</td><td style="font-weight:600;">${formattedDate}</td></tr>` : ""}
            ${formattedTime ? `<tr><td style="color:#999;padding:6px 0;">🕐 Time</td><td style="font-weight:600;">${formattedTime}</td></tr>` : ""}
            ${serviceName ? `<tr><td style="color:#999;padding:6px 0;">${terms?.serviceEmoji ?? "✂️"} ${terms?.serviceLabel ?? "Service"}</td><td style="font-weight:600;">${serviceName}</td></tr>` : ""}
            ${staffName ? `<tr><td style="color:#999;padding:6px 0;">${terms?.staffEmoji ?? "👩"} ${terms?.staffLabel ?? "Stylist"}</td><td style="font-weight:600;">${staffName}</td></tr>` : ""}
            ${price ? `<tr><td style="color:#999;padding:6px 0;">💷 Price</td><td style="font-weight:700;color:${color};">£${price}</td></tr>` : ""}
          </table>
        </div>` : ""}

        ${extra ?? ""}

        <p style="font-size:13px;color:#aaa;margin:16px 0 0;line-height:1.6;">
          If you need to reschedule or cancel, please contact us at your earliest convenience.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:16px 28px;text-align:center;">
        <p style="font-size:12px;color:#ccc;margin:0;line-height:1.7;">
          ${salonName} &bull; United Kingdom<br/>
          This is an automated message — please do not reply directly to this email.<br/>
          <a href="${unsubLink}" style="color:#bbb;text-decoration:underline;font-size:11px;">Unsubscribe from reminders</a>
        </p>
      </div>

    </div>
  </body>
  </html>`;
}

// ═══════════════════════════════════════════════
// 1. BOOKING CONFIRMATION
// ═══════════════════════════════════════════════
export async function sendBookingEmails({
  clientEmail, clientName, clientPhone, serviceName,
  dateTime, staffName, salonName, salonOwnerEmail, price,
  salonAddress, cancelLink, dashboardUrl, paymentStatus, depositOnly, businessType,
  salonId, appointmentId, priceIsFrom,
}: {
  clientEmail: string; clientName: string; clientPhone: string;
  serviceName: string; dateTime: string; staffName?: string;
  salonName: string; salonOwnerEmail: string; price?: number;
  salonAddress?: string; cancelLink?: string; dashboardUrl?: string;
  paymentStatus?: string; depositOnly?: boolean; businessType?: string;
  // Only used for the error log below if salonOwnerEmail can't be resolved.
  salonId?: string; appointmentId?: string;
  priceIsFrom?: boolean;
}) {
  const { formattedDate, formattedTime } = formatDate(dateTime);
  const terms = getEmailTerms(businessType);
  const detailsLabel = terms.bookingWord.charAt(0).toUpperCase() + terms.bookingWord.slice(1) + " Details";

  // ── Payment status badge for owner email ──
  const paymentBadge = (() => {
    if (paymentStatus === "paid")         return { label: "Paid in Full",     color: "#059669", bg: "#D1FAE5" };
    if (paymentStatus === "deposit_paid") return { label: "Deposit Paid (50%)", color: "#D97706", bg: "#FEF3C7" };
    return                                       { label: "Unpaid",             color: "#DC2626", bg: "#FEE2E2" };
  })();

  const amountPaid = depositOnly && price ? (price * 0.5).toFixed(2) : price?.toFixed(2);
  const amountDue  = depositOnly && price ? (price * 0.5).toFixed(2) : undefined;
  // "from" only belongs on a figure that hasn't been definitively charged yet —
  // a completed online payment (full or deposit) is a concrete fact, not an
  // estimate. Only the un-charged pay-at-salon amount, or the still-uncollected
  // deposit remainder, are genuinely "from" figures.
  const amountPaidPrefix = priceIsFrom && paymentStatus !== "paid" && !depositOnly ? "from " : "";
  const amountDuePrefix  = priceIsFrom ? "from " : "";

  // ── CLIENT EMAIL ──────────────────────────────────────────
  const clientHtml = `
  <!DOCTYPE html>
  <html lang="en-GB">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
  <body style="margin:0;padding:0;background:#F4F4F5;">
    <div style="max-width:540px;margin:32px auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#C2185B 0%,#7B2D52 100%);padding:36px 28px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:14px;">✅</div>
        <p style="color:rgba(255,255,255,0.75);margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salonName}</p>
        <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Booking Confirmed! ${terms.headerIcon}</h1>
      </div>

      <!-- Greeting -->
      <div style="background:#fff;padding:28px 28px 0;">
        <p style="font-size:16px;margin:0 0 6px;color:#111;">Hi <strong>${clientName}</strong> 👋</p>
        <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">Your ${terms.bookingWord} at <strong>${salonName}</strong> is confirmed. ${terms.greetingLine}</p>

        <!-- Booking Card -->
        <div style="background:#FDF5F8;border:1.5px solid #F0C4D4;border-radius:12px;padding:20px 22px;margin-bottom:22px;">
          <div style="font-size:11px;font-weight:700;color:#C2185B;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">${detailsLabel}</div>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="color:#999;padding:7px 0;width:130px;">${terms.serviceEmoji} ${terms.serviceLabel}</td><td style="font-weight:600;color:#0F172A;">${serviceName}</td></tr>
            ${staffName ? `<tr><td style="color:#999;padding:7px 0;">${terms.staffEmoji} ${terms.staffLabel}</td><td style="font-weight:600;color:#0F172A;">${staffName}</td></tr>` : ""}
            <tr><td style="color:#999;padding:7px 0;">📅 Date</td><td style="font-weight:600;color:#0F172A;">${formattedDate}</td></tr>
            <tr><td style="color:#999;padding:7px 0;">🕐 Time</td><td style="font-weight:700;color:#C2185B;font-size:16px;">${formattedTime}</td></tr>
            ${price ? `<tr><td style="color:#999;padding:7px 0;">💷 Price</td><td style="font-weight:700;color:#0F172A;">${amountPaidPrefix}£${amountPaid}${depositOnly ? ` <span style='color:#D97706;font-size:12px;'>(deposit — ${amountDuePrefix}£${amountDue} due at salon)</span>` : ""}</td></tr>` : ""}
          </table>
        </div>

        ${salonAddress ? `
        <!-- Location -->
        <div style="background:#F8FAFF;border:1px solid #E0E7FF;border-radius:12px;padding:16px 20px;margin-bottom:22px;display:flex;align-items:flex-start;gap:12px;">
          <span style="font-size:20px;">📍</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#4F6EF7;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Location</div>
            <div style="font-size:14px;color:#334155;font-weight:500;line-height:1.5;">${salonAddress}</div>
            <a href="https://maps.google.com/?q=${encodeURIComponent(salonAddress)}" style="font-size:12px;color:#4F6EF7;font-weight:600;text-decoration:none;margin-top:6px;display:inline-block;">Open in Google Maps →</a>
          </div>
        </div>` : ""}

        <!-- Need to change? -->
        <div style="background:#FFFBF0;border:1px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:13px;color:#78350F;line-height:1.6;">
            <strong>Need to reschedule or cancel?</strong><br/>
            Please give us at least 24 hours notice. Contact us directly or
            ${cancelLink ? `<a href="${cancelLink}" style="color:#C2185B;font-weight:600;"> click here to manage your booking</a>.` : " get in touch as soon as possible."}
          </div>
        </div>

        <p style="font-size:13px;color:#94A3B8;margin:0 0 4px;line-height:1.6;">We look forward to welcoming you.</p>
        <p style="font-size:13px;color:#94A3B8;margin:0;line-height:1.6;">— The ${salonName} Team</p>
      </div>

      <!-- Footer -->
      <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:18px 28px;text-align:center;margin-top:28px;">
        <p style="font-size:12px;color:#bbb;margin:0;line-height:1.8;">
          ${salonName} &bull; United Kingdom<br/>
          This is an automated confirmation — please do not reply to this email.<br/>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe" style="color:#bbb;text-decoration:underline;font-size:11px;">Unsubscribe from reminders</a>
        </p>
      </div>
    </div>
  </body>
  </html>`;

  // ── OWNER EMAIL ───────────────────────────────────────────
  const ownerHtml = `
  <!DOCTYPE html>
  <html lang="en-GB">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
  <body style="margin:0;padding:0;background:#F4F4F5;">
    <div style="max-width:540px;margin:32px auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1E3A8A 0%,#3730A3 100%);padding:36px 28px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:14px;">🎉</div>
        <p style="color:rgba(255,255,255,0.75);margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salonName}</p>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">New Booking!</h1>
      </div>

      <div style="background:#fff;padding:28px;">

        <!-- Payment badge -->
        <div style="text-align:center;margin-bottom:22px;">
          <span style="display:inline-block;background:${paymentBadge.bg};color:${paymentBadge.color};font-size:13px;font-weight:700;padding:6px 18px;border-radius:999px;border:1.5px solid ${paymentBadge.color};">
            💳 ${paymentBadge.label}
          </span>
        </div>

        <!-- Client Details -->
        <div style="background:#F8FAFF;border:1.5px solid #E0E7FF;border-radius:12px;padding:20px 22px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#3730A3;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Client Details</div>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="color:#999;padding:7px 0;width:110px;">👤 Name</td><td style="font-weight:700;color:#0F172A;font-size:16px;">${clientName}</td></tr>
            <tr><td style="color:#999;padding:7px 0;">📱 Phone</td><td style="font-weight:600;color:#0F172A;"><a href="tel:${clientPhone}" style="color:#3730A3;text-decoration:none;">${clientPhone}</a></td></tr>
            <tr><td style="color:#999;padding:7px 0;">📧 Email</td><td style="font-weight:600;color:#0F172A;"><a href="mailto:${clientEmail}" style="color:#3730A3;text-decoration:none;">${clientEmail}</a></td></tr>
          </table>
        </div>

        <!-- Appointment Details -->
        <div style="background:#FDF5F8;border:1.5px solid #F0C4D4;border-radius:12px;padding:20px 22px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;color:#C2185B;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">${detailsLabel}</div>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="color:#999;padding:7px 0;width:110px;">${terms.serviceEmoji} ${terms.serviceLabel}</td><td style="font-weight:600;color:#0F172A;">${serviceName}</td></tr>
            ${staffName ? `<tr><td style="color:#999;padding:7px 0;">${terms.staffEmoji} ${terms.staffLabel}</td><td style="font-weight:600;color:#0F172A;">${staffName}</td></tr>` : ""}
            <tr><td style="color:#999;padding:7px 0;">📅 Date</td><td style="font-weight:600;color:#0F172A;">${formattedDate}</td></tr>
            <tr><td style="color:#999;padding:7px 0;">🕐 Time</td><td style="font-weight:700;color:#C2185B;font-size:16px;">${formattedTime}</td></tr>
            ${price ? `<tr><td style="color:#999;padding:7px 0;">💷 Amount</td><td style="font-weight:700;color:#059669;">${amountPaidPrefix}£${amountPaid} ${depositOnly ? `<span style='color:#D97706;font-size:12px;'>(deposit — ${amountDuePrefix}£${amountDue} due at salon)</span>` : "received"}</td></tr>` : ""}
          </table>
        </div>

        <!-- Dashboard CTA -->
        ${dashboardUrl ? `
        <div style="text-align:center;margin-bottom:8px;">
          <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#1E3A8A 0%,#3730A3 100%);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(55,48,163,0.3);">View in Dashboard →</a>
        </div>` : ""}
      </div>

      <!-- Footer -->
      <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:16px 28px;text-align:center;">
        <p style="font-size:12px;color:#bbb;margin:0;line-height:1.8;">
          ${salonName} &bull; Powered by feature &bull; United Kingdom<br/>
          This is an automated notification from your booking system.
        </p>
      </div>
    </div>
  </body>
  </html>`;

  const sends = [
    sendEmailSafe({
      from: FROM, to: clientEmail,
      subject: `Booking Confirmed! ${terms.headerIcon} — ${salonName}`,
      html: clientHtml,
    }),
  ];

  // Never send the owner's "New Booking!" copy to the client as a fallback —
  // if we can't resolve a real owner address, skip that send and log it
  // loudly instead. The client confirmation above still goes out regardless.
  if (salonOwnerEmail) {
    sends.push(sendEmailSafe({
      from: FROM, to: salonOwnerEmail,
      subject: `New Booking! ${clientName} — ${formattedDate} at ${formattedTime}`,
      html: ownerHtml,
    }));
  } else {
    console.error(
      `[email] ❌ Owner email could not be resolved — "New Booking!" notification NOT sent. ` +
      `salon_id=${salonId ?? "unknown"} appointment_id=${appointmentId ?? "unknown"}`
    );
  }

  await Promise.all(sends);
}

// ═══════════════════════════════════════════════
// 2. REMINDER — 1 Day Before
// ═══════════════════════════════════════════════
export async function send24hReminder({
  to, clientName, serviceName, staffName, salonName, dateTime, price, businessType,
}: {
  to: string; clientName: string; serviceName: string;
  staffName?: string; salonName: string; dateTime: string; price?: number; businessType?: string;
}) {
  const { formattedDate, formattedTime } = formatDate(dateTime);
  const terms = getEmailTerms(businessType);
  await sendEmailSafe({
    from: FROM, to,
    subject: `Reminder: Your ${terms.bookingWord} tomorrow at ${formattedTime} — ${salonName}`,
    html: emailTemplate({
      title: `${terms.bookingWord.charAt(0).toUpperCase() + terms.bookingWord.slice(1)} Reminder — Tomorrow ⏰`, clientName,
      message: `This is a friendly reminder that you have a ${terms.bookingWord} with us <strong>tomorrow</strong>. We look forward to welcoming you.`,
      serviceName, formattedDate, formattedTime, staffName, salonName, color: "#C2185B", price, terms,
    }),
  });
}

// ═══════════════════════════════════════════════
// 3. REMINDER — 2 Hours Before
// ═══════════════════════════════════════════════
export async function send2hReminder({
  to, clientName, serviceName, staffName, salonName, dateTime, price, businessType,
}: {
  to: string; clientName: string; serviceName: string;
  staffName?: string; salonName: string; dateTime: string; price?: number; businessType?: string;
}) {
  const { formattedDate, formattedTime } = formatDate(dateTime);
  const terms = getEmailTerms(businessType);
  await sendEmailSafe({
    from: FROM, to,
    subject: `See you in 2 hours — ${salonName}`,
    html: emailTemplate({
      title: `See You Soon — 2 Hours to Go! ${terms.headerIcon}`, clientName,
      message: `Just a quick reminder that your ${terms.bookingWord} is in <strong>2 hours</strong>. We are looking forward to seeing you shortly!`,
      serviceName, formattedDate, formattedTime, staffName, salonName, color: "#C2185B", price, terms,
    }),
  });
}

// ═══════════════════════════════════════════════
// 4. WIN-BACK — 6 Weeks After Last Visit
// ═══════════════════════════════════════════════
export async function sendWinbackEmail({
  to, clientName, salonName, lastServiceName, bookingLink, unsubLink,
}: {
  to: string; clientName: string; salonName: string;
  lastServiceName?: string; bookingLink: string; unsubLink?: string;
}) {
  await sendEmailSafe({
    from: FROM, to,
    subject: `We'd love to see you again — ${salonName}`,
    html: emailTemplate({
      title: "We Miss You! 💕", clientName,
      message: `It has been a little while since your last visit${lastServiceName ? ` for your <strong>${lastServiceName}</strong>` : ""}, and we would love to welcome you back. As a valued client, we are offering you an exclusive discount on your next appointment.`,
      salonName, color: "#C2185B", unsubLink,
      extra: `
        <div style="background:linear-gradient(135deg,#FDE8F0,#F3E8FD);border:1.5px solid #C2185B;border-radius:12px;padding:22px;margin-bottom:20px;text-align:center;">
          <p style="font-size:11px;color:#C2185B;font-weight:600;margin:0 0 6px;letter-spacing:1.5px;text-transform:uppercase;">Exclusive Returning Client Offer</p>
          <p style="font-size:40px;font-weight:700;color:#C2185B;margin:0 0 4px;line-height:1;">10% OFF</p>
          <p style="font-size:13px;color:#888;margin:0 0 18px;">Simply mention this email when booking</p>
          <a href="${bookingLink}" style="display:inline-block;background:#C2185B;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Book My Appointment →</a>
        </div>
        <p style="font-size:12px;color:#bbb;text-align:center;margin:0;">Offer valid for a limited time. Cannot be combined with other promotions.</p>
      `,
    }),
  });
}

// ═══════════════════════════════════════════════
// 5. THANK YOU — 1 Hour After Appointment
// ═══════════════════════════════════════════════
export async function sendThankyouEmail({
  to, clientName, salonName, serviceName, reviewLink,
}: {
  to: string; clientName: string; salonName: string;
  serviceName?: string; reviewLink?: string;
}) {
  await sendEmailSafe({
    from: FROM, to,
    subject: `Thank you for visiting ${salonName} today! 💕`,
    html: emailTemplate({
      title: "Thank You for Your Visit! 🌟", clientName,
      message: `It was wonderful to have you with us today${serviceName ? ` for your <strong>${serviceName}</strong>` : ""}. We hope you love the results!`,
      salonName, color: "#C2185B",
      extra: reviewLink ? `
        <div style="background:linear-gradient(135deg,#FDE8F0,#F3E8FD);border:1.5px solid #C2185B;border-radius:12px;padding:22px;margin-bottom:20px;text-align:center;">
          <p style="font-size:15px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Share Your Experience</p>
          <p style="font-size:13px;color:#555;margin:0 0 18px;">Your feedback means the world to us and helps other clients find us.</p>
          <a href="${reviewLink}" style="display:inline-block;background:#C2185B;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Leave a Review ⭐</a>
        </div>
        <p style="font-size:12px;color:#bbb;text-align:center;margin:0;">Takes less than 60 seconds — and it makes a huge difference. Thank you! 🙏</p>
      ` : undefined,
    }),
  });
}

// ═══════════════════════════════════════════════
// 6. OFFER EMAIL — When Owner Adds an Offer
// ═══════════════════════════════════════════════
export async function sendOfferEmail({
  to, clientName, salonName, offerTitle, offerDescription,
  discountPercent, expiresAt, bookingLink, unsubLink,
}: {
  to: string; clientName: string; salonName: string;
  offerTitle: string; offerDescription?: string;
  discountPercent?: number; expiresAt?: string; bookingLink: string;
  unsubLink?: string;
}) {
  const expiryFormatted = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  await sendEmailSafe({
    from: FROM, to,
    subject: `Exclusive Offer for You — ${salonName}`,
    html: emailTemplate({
      title: "A Special Offer Just for You 🏷️", clientName,
      message: "As one of our valued clients, we wanted to share this exclusive offer with you before anyone else.",
      salonName, color: "#C2185B", unsubLink,
      extra: `
        <div style="background:linear-gradient(135deg,#FDE8F0,#F3E8FD);border:1.5px solid #C2185B;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
          ${discountPercent ? `<p style="font-size:48px;font-weight:700;color:#C2185B;margin:0 0 8px;line-height:1;">${discountPercent}% OFF</p>` : ""}
          <p style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">${offerTitle}</p>
          ${offerDescription ? `<p style="font-size:14px;color:#555;margin:0 0 12px;">${offerDescription}</p>` : ""}
          ${expiryFormatted ? `<p style="font-size:12px;color:#888;margin:0 0 18px;">⏳ Valid until <strong>${expiryFormatted}</strong></p>` : ""}
          <a href="${bookingLink}" style="display:inline-block;background:#C2185B;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Book This Offer →</a>
        </div>
        <p style="font-size:12px;color:#bbb;text-align:center;margin:0;">This offer is exclusively available to our existing clients.</p>
      `,
    }),
  });
}

// ═══════════════════════════════════════════════
// 7. NO-SHOW ALERT — To Salon Owner
// ═══════════════════════════════════════════════
export async function sendNoShowAlertEmail({
  to, ownerName, clientName, serviceName, dateTime, salonName, dashboardUrl, businessType,
}: {
  to: string;
  ownerName?: string;
  clientName: string;
  serviceName?: string;
  dateTime: string;
  salonName: string;
  dashboardUrl?: string;
  businessType?: string;
}) {
  const { formattedDate, formattedTime } = formatDate(dateTime);
  const terms = getEmailTerms(businessType);
  const greeting = ownerName ? ownerName : "there";

  await sendEmailSafe({
    from: FROM,
    to,
    subject: `⚠️ Possible No-Show: ${clientName} — ${formattedTime} today`,
    html: `
    <!DOCTYPE html>
    <html lang="en-GB">
    <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
    <body style="margin:0;padding:0;background:#F4F4F5;">
      <div style="max-width:520px;margin:32px auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#DC2626 0%,#991B1B 100%);padding:32px 28px;text-align:center;">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">⚠️</div>
          <p style="color:rgba(255,255,255,0.8);margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;">${salonName}</p>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Possible No-Show</h1>
        </div>

        <!-- Body -->
        <div style="background:#fff;padding:28px;">
          <p style="font-size:15px;margin:0 0 14px;color:#222;">Hi <strong>${greeting}</strong>,</p>
          <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 22px;">
            It looks like <strong>${clientName}</strong> may not have shown up for their appointment that was scheduled for <strong>${formattedTime}</strong> today. The booking is still marked as <em>confirmed</em>.
          </p>

          <!-- Appointment Details -->
          <div style="background:#FFF5F5;border:1.5px solid #FCA5A5;border-radius:12px;padding:18px 20px;margin-bottom:22px;">
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="color:#999;padding:6px 0;width:110px;">👤 Client</td><td style="font-weight:700;color:#0F172A;">${clientName}</td></tr>
              ${serviceName ? `<tr><td style="color:#999;padding:6px 0;">${terms.serviceEmoji} ${terms.serviceLabel}</td><td style="font-weight:600;color:#0F172A;">${serviceName}</td></tr>` : ""}
              <tr><td style="color:#999;padding:6px 0;">📅 Date</td><td style="font-weight:600;color:#0F172A;">${formattedDate}</td></tr>
              <tr><td style="color:#999;padding:6px 0;">🕐 Time</td><td style="font-weight:700;color:#DC2626;font-size:16px;">${formattedTime}</td></tr>
            </table>
          </div>

          <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">
            Please update the booking status in your dashboard. If the client did attend, you can mark it as <strong>Completed</strong>. If not, mark it as <strong>No-Show</strong> to keep your records accurate.
          </p>

          ${dashboardUrl ? `
          <div style="text-align:center;margin-bottom:8px;">
            <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#DC2626 0%,#991B1B 100%);color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(220,38,38,0.3);">Update Booking Status →</a>
          </div>` : ""}
        </div>

        <!-- Footer -->
        <div style="background:#F9F9F9;border-top:1px solid #EFEFEF;padding:16px 28px;text-align:center;">
          <p style="font-size:12px;color:#bbb;margin:0;line-height:1.8;">
            ${salonName} • Powered by feature • United Kingdom<br/>
            This is an automated alert from your booking system.
          </p>
        </div>
      </div>
    </body>
    </html>`,
  });
}