// Server-only: loads everything the lifecycle rules need (service role),
// plans today's emails, and renders/sends them. Used by the daily cron
// (/api/cron/lifecycle-emails) and the admin view (/api/admin/lifecycle).

import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getDefaultServices } from "@/app/lib/defaultServices";
import { getVerticalConfig } from "@/app/lib/verticalConfig";
import {
  DAY_MS, classifyServices, decide, isPaying, trialEnd,
  type Decision, type EmailKey, type SalonFacts, type SentEmail, type ServiceRow,
} from "./decide";
import { firstNameFrom, renderEmail, type RenderedEmail } from "./templates";
import { signUnsubscribeToken } from "./token";

export const SITE_URL = "https://featuresalon.co.uk";
export const LIFECYCLE_FROM = "Feature Team <features@featuresalon.co.uk>";
export const LIFECYCLE_REPLY_TO = "features@featuresalon.co.uk";

export interface LifecycleConfig {
  live: boolean;
  unsubscribeSecret: string;
  googleReviewLink: string;
  excludeEmails: string[];
}

export function lifecycleConfig(): LifecycleConfig {
  return {
    live: process.env.LIFECYCLE_EMAILS_LIVE === "true",
    unsubscribeSecret: process.env.LIFECYCLE_UNSUBSCRIBE_SECRET ?? "",
    googleReviewLink: (process.env.GOOGLE_REVIEW_LINK ?? "").trim(),
    excludeEmails: (process.env.LIFECYCLE_EXCLUDE_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean),
  };
}

export interface LoadedSalon extends SalonFacts {
  businessType: string | null;
  fullName: string | null;
}

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every page of a query (PostgREST returns at most 1000 rows per request). */
async function fetchAll<T>(page: (from: number, to: number) => QueryResult<T>): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

const toDate = (v: unknown) => (v ? new Date(String(v)) : null);
const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

/** When a paying salon started paying: Stripe's subscription start date; comped accounts use trial end. */
async function paidSinceFor(salons: LoadedSalon[]): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  const stripe = key ? new Stripe(key) : null;
  for (const s of salons) {
    if (!isPaying(s)) continue;
    if (!s.subscriptionId) { s.paidSince = trialEnd(s); continue; }
    if (!stripe) continue;
    try {
      const sub = await stripe.subscriptions.retrieve(s.subscriptionId);
      s.paidSince = new Date(sub.start_date * 1000);
    } catch (err) {
      console.error("[lifecycle] couldn't read Stripe subscription for salon", s.salonId, err);
    }
  }
}

export async function loadLifecycleData(db: SupabaseClient, now: Date): Promise<{ salons: LoadedSalon[]; sent: SentEmail[] }> {
  const since31 = new Date(now.getTime() - 31 * DAY_MS).toISOString();

  const [salonRows, serviceRows, bookingRows, loginRows, logRows] = await Promise.all([
    fetchAll<Record<string, unknown>>((f, t) => db.from("salons")
      .select("id,name,slug,owner_id,owner_email,business_type,created_at,trial_ends_at,subscription_status,subscription_id,is_demo_data,is_staging,lifecycle_emails_opt_out")
      .order("id").range(f, t)),
    fetchAll<Record<string, unknown>>((f, t) => db.from("services")
      .select("id,salon_id,name,price,duration_minutes").is("archived_at", null)
      .order("id").range(f, t)),
    fetchAll<Record<string, unknown>>((f, t) => db.from("appointments")
      .select("id,salon_id,created_at").gte("created_at", since31)
      .order("id").range(f, t)),
    fetchAll<Record<string, unknown>>((f, t) => db.from("login_logs")
      .select("salon_id,logged_at").gte("logged_at", since31)
      .order("logged_at").range(f, t)),
    fetchAll<Record<string, unknown>>((f, t) => db.from("email_log")
      .select("id,salon_id,email_key,sent_at").in("status", ["sent", "sending"])
      .order("id").range(f, t)),
  ]);

  // Owners' names and last sign-in, from Supabase auth.
  const users = new Map<string, { fullName: string | null; lastSignIn: Date | null }>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      const name = (u.user_metadata as Record<string, unknown> | null)?.full_name;
      users.set(u.id, { fullName: typeof name === "string" ? name : null, lastSignIn: toDate(u.last_sign_in_at) });
    }
    if (data.users.length < 1000) break;
  }

  const servicesBySalon = new Map<string, ServiceRow[]>();
  for (const r of serviceRows) {
    const id = String(r.salon_id);
    servicesBySalon.set(id, [...(servicesBySalon.get(id) ?? []),
      { name: String(r.name ?? ""), price: r.price as number | null, durationMinutes: r.duration_minutes as number | null }]);
  }
  const lastBooking = new Map<string, Date>();
  for (const r of bookingRows) lastBooking.set(String(r.salon_id), later(lastBooking.get(String(r.salon_id)) ?? null, toDate(r.created_at))!);
  const lastLogin = new Map<string, Date>();
  for (const r of loginRows) lastLogin.set(String(r.salon_id), later(lastLogin.get(String(r.salon_id)) ?? null, toDate(r.logged_at))!);

  const salons: LoadedSalon[] = salonRows.map(r => {
    const id = String(r.id);
    const ownerId = String(r.owner_id ?? "");
    const businessType = (r.business_type as string | null) ?? null;
    const samples = getDefaultServices(businessType ?? "")
      .map(s => ({ name: s.name, price: s.price, durationMinutes: s.duration_minutes }));
    const user = users.get(ownerId);
    return {
      salonId: id,
      ownerId,
      ownerEmail: (r.owner_email as string | null) ?? null,
      name: String(r.name ?? ""),
      slug: String(r.slug ?? ""),
      createdAt: toDate(r.created_at) ?? now,
      trialEndsAt: toDate(r.trial_ends_at),
      subscriptionStatus: (r.subscription_status as string | null) ?? null,
      subscriptionId: (r.subscription_id as string | null) ?? null,
      isDemo: r.is_demo_data === true,
      isStaging: r.is_staging === true,
      optedOut: r.lifecycle_emails_opt_out === true,
      serviceState: classifyServices(servicesBySalon.get(id) ?? [], samples),
      paidSince: null,
      lastBookingAt: lastBooking.get(id) ?? null,
      lastLoginAt: later(lastLogin.get(id) ?? null, user?.lastSignIn ?? null),
      businessType,
      fullName: user?.fullName ?? null,
    };
  });

  await paidSinceFor(salons);

  const sent: SentEmail[] = logRows.map(r => ({
    salonId: String(r.salon_id),
    emailKey: r.email_key as EmailKey,
    sentAt: toDate(r.sent_at) ?? now,
  }));

  return { salons, sent };
}

export async function planToday(db: SupabaseClient, now: Date, cfg: LifecycleConfig): Promise<{ salons: LoadedSalon[]; decisions: Decision[] }> {
  const { salons, sent } = await loadLifecycleData(db, now);
  const decisions = decide(salons, sent, { now, reviewLinkSet: !!cfg.googleReviewLink, excludeEmails: cfg.excludeEmails });
  return { salons, decisions };
}

export function unsubscribeUrlFor(salonId: string, cfg: LifecycleConfig): string {
  return cfg.unsubscribeSecret
    ? `${SITE_URL}/unsubscribe/emails?t=${encodeURIComponent(signUnsubscribeToken(salonId, cfg.unsubscribeSecret))}`
    : `${SITE_URL}/unsubscribe/emails?t=(LIFECYCLE_UNSUBSCRIBE_SECRET not set)`;
}

/** Previews and test sends use a link for a salon that doesn't exist, so clicking it unsubscribes nobody. */
const DUMMY_SALON_ID = "00000000-0000-0000-0000-000000000000";

export function buildEmail(
  salon: LoadedSalon, key: EmailKey, cfg: LifecycleConfig, opts: { forTest?: boolean } = {},
): RenderedEmail & { unsubscribeUrl: string } {
  const unsubscribeUrl = unsubscribeUrlFor(opts.forTest ? DUMMY_SALON_ID : salon.salonId, cfg);
  const email = renderEmail(key, {
    firstName: firstNameFrom(salon.fullName),
    salonName: salon.name,
    slug: salon.slug,
    staffLabel: getVerticalConfig(salon.businessType).staffPlural,
    serviceState: salon.serviceState,
    trialEnd: trialEnd(salon),
    unsubscribeUrl,
    googleReviewLink: cfg.googleReviewLink,
    siteUrl: SITE_URL,
  });
  return { ...email, unsubscribeUrl };
}

/** Headers that let Gmail/Outlook offer one-click unsubscribe (RFC 8058). */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  const oneClick = unsubscribeUrl.replace("/unsubscribe/emails?", "/api/lifecycle/unsubscribe?");
  return {
    "List-Unsubscribe": `<${oneClick}>, <mailto:${LIFECYCLE_REPLY_TO}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
