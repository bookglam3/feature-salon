// Lifecycle email decisions: the rules in docs/lifecycle-emails.md as pure
// code. No imports, so scripts/test-lifecycle.mjs runs it directly under node.
// If a rule changes, change the doc first — it is the source of truth.

export type EmailKey =
  | "e1_welcome" | "e2_setup_help" | "e3_week_one" | "e4_trial_ending"
  | "e5_trial_ended" | "e6_monthly" | "e7_review" | "e8_gone_quiet";

export const EMAIL_KEYS: EmailKey[] = [
  "e1_welcome", "e2_setup_help", "e3_week_one", "e4_trial_ending",
  "e5_trial_ended", "e6_monthly", "e7_review", "e8_gone_quiet",
];

/** Most important first, when two are due the same day: 4 > 5 > 2 > 1 > 3 > 8 > 6 > 7. */
export const PRIORITY: EmailKey[] = [
  "e4_trial_ending", "e5_trial_ended", "e2_setup_help", "e1_welcome",
  "e3_week_one", "e8_gone_quiet", "e6_monthly", "e7_review",
];

/** Sent at most once per salon, ever. */
const ONE_TIME: ReadonlySet<EmailKey> = new Set<EmailKey>([
  "e1_welcome", "e2_setup_help", "e3_week_one", "e4_trial_ending", "e5_trial_ended", "e7_review",
]);

export type ServiceState = "none" | "samples_only" | "customised";

export interface SalonFacts {
  salonId: string;
  ownerId: string;
  ownerEmail: string | null;
  name: string;
  slug: string;
  createdAt: Date;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  isDemo: boolean;
  isStaging: boolean;
  optedOut: boolean;
  serviceState: ServiceState;
  /** When paying started: Stripe start date, or trial end for comped accounts. Null if not paying/unknown. */
  paidSince: Date | null;
  /** Most recent booking created for this salon (only the last ~30 days are loaded). */
  lastBookingAt: Date | null;
  /** Later of the dashboard login log and the owner's last sign-in. */
  lastLoginAt: Date | null;
}

/** A lifecycle email that really went out (email_log status 'sent' or 'sending'). */
export interface SentEmail {
  salonId: string;
  emailKey: EmailKey;
  sentAt: Date;
}

export interface DecideOptions {
  now: Date;
  reviewLinkSet: boolean;
  excludeEmails?: string[];
}

export type Decision =
  | { salonId: string; ownerId: string; action: "send"; emailKey: EmailKey; dedupeKey: string }
  | { salonId: string; ownerId: string; action: "skip"; reason: string };

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const TRIAL_DAYS = 14;

export const utcDate = (d: Date) => d.toISOString().slice(0, 10);

export function trialEnd(s: Pick<SalonFacts, "trialEndsAt" | "createdAt">): Date {
  return s.trialEndsAt ?? new Date(s.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

/** Paying = status 'active' (Stripe or comped), or a Stripe subscription that is trialing. */
export function isPaying(s: Pick<SalonFacts, "subscriptionStatus" | "subscriptionId">): boolean {
  const status = (s.subscriptionStatus ?? "").toLowerCase();
  if (status === "active") return true;
  return !!s.subscriptionId && status === "trialing";
}

/** Never subscribed: no Stripe subscription and status empty or 'trial' (so not past-due/cancelled). */
export function neverSubscribed(s: Pick<SalonFacts, "subscriptionStatus" | "subscriptionId">): boolean {
  const status = (s.subscriptionStatus ?? "").toLowerCase();
  return !s.subscriptionId && (status === "" || status === "trial");
}

export function segmentLabel(s: SalonFacts, now: Date): string {
  if (isPaying(s)) return s.subscriptionId ? "paying" : "paying (comped)";
  if (neverSubscribed(s)) return now.getTime() < trialEnd(s).getTime() ? "in trial" : "trial ended";
  return s.subscriptionStatus || "unknown";
}

const TEST_NAME = /\btest|\bdemo\b|\bdummy\b/i;
const TEST_EMAIL = /@(example\.(com|org|net)|test\.com|mailinator\.com)$|\+test@/i;

/** Why a salon never gets lifecycle emails, or null if it can. */
export function exclusionReason(s: SalonFacts, excludeEmails: string[] = []): string | null {
  if (s.isDemo) return "demo salon";
  if (s.isStaging) return "staging salon";
  if (s.optedOut) return "owner unsubscribed";
  const email = (s.ownerEmail ?? "").trim().toLowerCase();
  if (!email.includes("@")) return "no owner email";
  if (excludeEmails.map(e => e.trim().toLowerCase()).includes(email)) return "on the exclude list";
  if (TEST_EMAIL.test(email) || TEST_NAME.test(s.name) || TEST_NAME.test(s.slug)) return "looks like a test salon";
  return null;
}

export interface ServiceRow {
  name: string;
  price: number | null;
  durationMinutes: number | null;
}

const serviceKey = (s: ServiceRow) =>
  `${s.name.trim().toLowerCase()}|${Number(s.price ?? 0)}|${Number(s.durationMinutes ?? 0)}`;

/** "samples_only" = every active service still matches a signup sample's name, price and length. */
export function classifyServices(services: ServiceRow[], samples: ServiceRow[]): ServiceState {
  if (services.length === 0) return "none";
  const sampleKeys = new Set(samples.map(serviceKey));
  return services.every(s => sampleKeys.has(serviceKey(s))) ? "samples_only" : "customised";
}

export const dedupeKeyFor = (key: EmailKey, now: Date) =>
  ONE_TIME.has(key) ? key : `${key}:${utcDate(now)}`;

const latest = (dates: Date[]) =>
  dates.length ? Math.max(...dates.map(d => d.getTime())) : null;

/** Every email this salon qualifies for today, ignoring the one-per-owner-per-day choice. */
export function dueEmails(s: SalonFacts, salonSent: SentEmail[], ownerSent: SentEmail[], opts: DecideOptions): EmailKey[] {
  const now = opts.now.getTime();
  const age = now - s.createdAt.getTime();
  const ageDays = Math.floor(age / DAY_MS);
  const end = trialEnd(s).getTime();
  const paying = isPaying(s);
  const fresh = neverSubscribed(s);
  const inTrial = fresh && now < end;
  const sentKeys = new Set(salonSent.map(e => e.emailKey));
  const once = (k: EmailKey) => !sentKeys.has(k);
  const lastOf = (k: EmailKey) => latest(salonSent.filter(e => e.emailKey === k).map(e => e.sentAt));
  const due: EmailKey[] = [];

  // 1–5: the trial sequence, by send window. Not subject to the 7-day cap.
  if (once("e1_welcome") && age >= 0 && age <= 36 * HOUR_MS) due.push("e1_welcome");
  if (fresh && once("e2_setup_help") && ageDays >= 2 && ageDays <= 4 && s.serviceState !== "customised") due.push("e2_setup_help");
  if (inTrial && once("e3_week_one") && ageDays >= 7 && ageDays <= 9) due.push("e3_week_one");
  const daysLeft = Math.ceil((end - now) / DAY_MS);
  if (fresh && once("e4_trial_ending") && daysLeft >= 1 && daysLeft <= 3) due.push("e4_trial_ending");
  const daysSinceEnd = Math.floor((now - end) / DAY_MS);
  if (fresh && once("e5_trial_ended") && daysSinceEnd >= 2 && daysSinceEnd <= 7) due.push("e5_trial_ended");

  // 6–8: never within 7 days of any other lifecycle email to this owner.
  const lastToOwner = latest(ownerSent.map(e => e.sentAt));
  if (lastToOwner !== null && now - lastToOwner < 7 * DAY_MS) return due;

  const paidDays = paying && s.paidSince ? (now - s.paidSince.getTime()) / DAY_MS : null;
  if (paidDays !== null && paidDays >= 30) {
    const last6 = lastOf("e6_monthly");
    if (last6 === null || now - last6 >= 30 * DAY_MS) due.push("e6_monthly");
  }
  if (opts.reviewLinkSet && paidDays !== null && paidDays >= 30 && paidDays <= 60 && once("e7_review")
      && s.lastBookingAt && now - s.lastBookingAt.getTime() <= 30 * DAY_MS) {
    due.push("e7_review");
  }
  const quiet = (d: Date | null) => !d || now - d.getTime() >= 14 * DAY_MS;
  if ((inTrial || paying) && ageDays >= 14 && quiet(s.lastBookingAt) && quiet(s.lastLoginAt)) {
    const last8 = lastOf("e8_gone_quiet");
    if (last8 === null || now - last8 >= 60 * DAY_MS) due.push("e8_gone_quiet");
  }
  return due;
}

/**
 * One decision per salon. Each owner gets at most one lifecycle email per day
 * (the most important one due across their salons); everything else is a skip
 * with a reason, so the admin view can show why.
 */
export function decide(salons: SalonFacts[], sent: SentEmail[], opts: DecideOptions): Decision[] {
  const today = utcDate(opts.now);
  const ownerOf = new Map(salons.map(s => [s.salonId, s.ownerId]));
  const bySalon = new Map<string, SentEmail[]>();
  const byOwner = new Map<string, SentEmail[]>();
  for (const e of sent) {
    bySalon.set(e.salonId, [...(bySalon.get(e.salonId) ?? []), e]);
    const owner = ownerOf.get(e.salonId);
    if (owner) byOwner.set(owner, [...(byOwner.get(owner) ?? []), e]);
  }

  const result = new Map<string, Decision>();
  const best = new Map<string, { salonId: string; key: EmailKey }[]>(); // per owner

  for (const s of salons) {
    const skip = (reason: string) => result.set(s.salonId, { salonId: s.salonId, ownerId: s.ownerId, action: "skip", reason });
    const excluded = exclusionReason(s, opts.excludeEmails);
    if (excluded) { skip(excluded); continue; }
    const ownerSent = byOwner.get(s.ownerId) ?? [];
    if (ownerSent.some(e => utcDate(e.sentAt) === today)) { skip("owner already emailed today"); continue; }
    const due = dueEmails(s, bySalon.get(s.salonId) ?? [], ownerSent, opts);
    if (due.length === 0) { skip("nothing due today"); continue; }
    const top = [...due].sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0];
    best.set(s.ownerId, [...(best.get(s.ownerId) ?? []), { salonId: s.salonId, key: top }]);
  }

  for (const [ownerId, picks] of best) {
    picks.sort((a, b) => PRIORITY.indexOf(a.key) - PRIORITY.indexOf(b.key));
    const [winner, ...rest] = picks;
    result.set(winner.salonId, { salonId: winner.salonId, ownerId, action: "send", emailKey: winner.key, dedupeKey: dedupeKeyFor(winner.key, opts.now) });
    for (const r of rest) {
      result.set(r.salonId, { salonId: r.salonId, ownerId, action: "skip", reason: `owner gets ${winner.key} for another salon today` });
    }
  }

  return salons.map(s => result.get(s.salonId)!);
}
