import type { SupabaseClient } from "@supabase/supabase-js";
import { clashMessage, findSlotClash, type SlotBooking } from "./slotClash";

/**
 * Owner bookings from the dashboard (Home quick add, Bookings wizard and edit):
 * the slot check before saving, and the booking's price line item. The public
 * booking does both inside create_booking_with_services; the owner writes
 * directly under their own RLS policies, and may book over an existing
 * booking after confirming.
 */

/**
 * Checks the time against the salon's bookings as they are now. Returns true
 * to go ahead: the time is free, or the owner confirmed booking over it.
 */
export async function confirmOwnerSlot(supabase: SupabaseClient, args: {
  salonId: string; startIso: string; endIso: string; staffId: string | null; timeZone: string; excludeId?: string | null;
}): Promise<boolean> {
  // A booking can only overlap if it starts before this one ends and less
  // than a day before it starts (no booking is that long).
  const from = new Date(Date.parse(args.startIso) - 24 * 3600_000).toISOString();
  const [appts, staff] = await Promise.all([
    supabase.from("appointments").select("id, staff_id, date_time, end_time, status, client_name, staff(name)")
      .eq("salon_id", args.salonId).gt("date_time", from).lt("date_time", args.endIso)
      .order("date_time", { ascending: true }), // the question names the earliest booking in the way
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", args.salonId).eq("active", true),
  ]);
  if (appts.error || staff.error) {
    console.error("[owner booking] slot check failed:", appts.error?.message || staff.error?.message);
    return window.confirm("Couldn't check whether this time is free. Book anyway?");
  }
  const bookings: SlotBooking[] = (appts.data || []).map(a => {
    const st = a.staff as { name?: string } | { name?: string }[] | null;
    return {
      id: a.id, staffId: a.staff_id ?? null, start: a.date_time, end: a.end_time ?? null, status: a.status ?? null,
      clientName: a.client_name, staffName: (Array.isArray(st) ? st[0]?.name : st?.name) ?? null,
    };
  });
  const clash = findSlotClash({ start: args.startIso, end: args.endIso, staffId: args.staffId, activeStaffCount: staff.count ?? 0, excludeId: args.excludeId }, bookings);
  return clash ? window.confirm(clashMessage(clash, args.timeZone)) : true;
}

export interface OwnerLineItem {
  service_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  price_is_from: boolean;
  sort_order: number;
}

/** The booking's line item from the services table, like create_booking_with_services: null if it can't be read. */
export async function loadOwnerLineItem(supabase: SupabaseClient, salonId: string, serviceId: string): Promise<OwnerLineItem | null> {
  const { data, error } = await supabase.from("services")
    .select("id, name, price, duration_minutes, price_is_from").eq("id", serviceId).eq("salon_id", salonId).maybeSingle();
  if (error || !data) {
    console.error("[owner booking] couldn't read the service:", error?.message ?? "not found");
    return null;
  }
  return {
    service_id: data.id, name: data.name, price: Number(data.price),
    duration_minutes: data.duration_minutes || 30, price_is_from: data.price_is_from === true, sort_order: 0,
  };
}

/**
 * Saves the line item of a booking just created. If that fails the booking is
 * removed again, so there is never a booking without its price. Returns true when saved.
 */
export async function saveOwnerLineItem(supabase: SupabaseClient, appointmentId: string, item: OwnerLineItem): Promise<boolean> {
  const { error } = await supabase.from("appointment_services").insert({ appointment_id: appointmentId, ...item });
  if (!error) return true;
  console.error("[owner booking] line item not saved, removing the booking:", error.message);
  await supabase.from("appointments").delete().eq("id", appointmentId);
  return false;
}
