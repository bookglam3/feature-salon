import type { SupabaseClient } from "@supabase/supabase-js";
import { paidPenceByBooking } from "./paymentLabel";

/**
 * Pence actually paid online per booking of one salon: its succeeded payments
 * rows, scoped through the booking (payments has no salon_id), the same way the
 * Payments page reads them. Readable by the salon's owner under the
 * payments_owner_read policy (sql/2026-11-07-payments-owner-read.sql).
 * On any error: an empty map — labels then show without an amount.
 */
export async function loadPaidPence(supabase: SupabaseClient, salonId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("payments")
    .select("appointment_id, amount, appointments!inner(salon_id)")
    .eq("appointments.salon_id", salonId)
    .eq("status", "succeeded");
  if (error) {
    console.error("[payments] couldn't load paid amounts:", error.message);
    return new Map();
  }
  return paidPenceByBooking(data || []);
}
