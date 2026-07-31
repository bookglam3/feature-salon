// Shared multi-service display resolver for the dashboard.
//
// No dashboard surface shares a common appointments-fetching function —
// confirmed by grep (bookings, dashboard home, calendar, clients, payments,
// reports each run their own independent query). This helper is what's
// actually shared: one extra bulk query per surface (not N+1 — a single
// `.in(appointment_id, ids)` call), reused everywhere instead of six
// independent copies of the same fallback logic.
//
// Same pattern as 3D's confirmation-email fix: combined name (joined),
// combined price (summed, Number(...) cast — numeric(10,2) columns come
// back from PostgREST as strings), any-price-is-from (OR across items).
// Falls back to the single primary `services` join for bookings with no
// appointment_services rows (pre-3C-1 data) — so old bookings still show
// correctly, not blank.
//
// Also returns `lines` — the individual resolved service entries, always
// at least one (the primary-service fallback becomes a one-item array
// here too). Single-row display surfaces (table rows, calendar cards, the
// detail modal) only need serviceName/combinedPrice/anyPriceIsFrom.
// Per-service AGGREGATIONS (reports' revenue-by-service breakdown,
// clients' per-client service-history counts) need `lines` instead —
// attributing a 4-service booking's revenue to one artificial combined-
// name bucket would be wrong; each real service needs its own count and
// its own revenue, from the same underlying data.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedServiceLine {
  name: string;
  price: number;
  price_is_from: boolean;
}

export interface ResolvedAppointmentServices {
  serviceName: string;
  combinedPrice: number;
  anyPriceIsFrom: boolean;
  lines: ResolvedServiceLine[];
}

type PrimaryServiceJoin =
  | { name?: string; price?: number; price_is_from?: boolean }
  | { name?: string; price?: number; price_is_from?: boolean }[]
  | null
  | undefined;

export async function resolveAppointmentServices(
  supabase: SupabaseClient,
  appointments: { id: string; services?: PrimaryServiceJoin }[]
): Promise<Map<string, ResolvedAppointmentServices>> {
  const resultMap = new Map<string, ResolvedAppointmentServices>();
  const ids = appointments.map(a => a.id);
  if (ids.length === 0) return resultMap;

  const { data: lineItems } = await supabase
    .from("appointment_services")
    .select("appointment_id, name, price, price_is_from")
    .in("appointment_id", ids)
    .order("sort_order", { ascending: true });

  const grouped = new Map<string, { name: string; price: number; price_is_from: boolean | null }[]>();
  for (const li of lineItems || []) {
    const arr = grouped.get(li.appointment_id) || [];
    arr.push(li);
    grouped.set(li.appointment_id, arr);
  }

  for (const a of appointments) {
    const items = grouped.get(a.id);
    if (items && items.length > 0) {
      const lines: ResolvedServiceLine[] = items.map(li => ({
        name: li.name,
        price: Number(li.price),
        price_is_from: li.price_is_from === true,
      }));
      resultMap.set(a.id, {
        serviceName: lines.map(l => l.name).join(", "),
        combinedPrice: lines.reduce((sum, l) => sum + l.price, 0),
        anyPriceIsFrom: lines.some(l => l.price_is_from),
        lines,
      });
    } else {
      const svc = Array.isArray(a.services) ? a.services[0] : a.services;
      const name = svc?.name || "";
      const price = Number(svc?.price ?? 0);
      const priceIsFrom = !!svc?.price_is_from;
      resultMap.set(a.id, {
        serviceName: name,
        combinedPrice: price,
        anyPriceIsFrom: priceIsFrom,
        lines: name ? [{ name, price, price_is_from: priceIsFrom }] : [],
      });
    }
  }
  return resultMap;
}
