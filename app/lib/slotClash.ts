/**
 * Is a time already taken? The same rule the public booking uses —
 * create_booking_with_services' inline capacity check (and check_slot_available):
 *
 *   • a booking overlaps when it starts before the new one ends and ends after
 *     the new one starts (no end_time = 30 minutes); cancelled ones don't count;
 *   • a chosen staff member: none of their own bookings may overlap, and the
 *     other active staff must be able to cover every "any staff" booking;
 *   • "any staff": fewer overlapping bookings than active staff.
 * Working hours are not part of it (owners book walk-ins and out-of-hours).
 *
 * No imports, so node runs it directly in scripts/test-owner-slot.mjs;
 * scripts/db-tests/owner-slot-db-test.mjs checks it against the SQL rule.
 */

export interface SlotBooking {
  id: string;
  staffId: string | null;
  /** ISO timestamps */
  start: string;
  end: string | null;
  status: string | null;
  clientName?: string | null;
  staffName?: string | null;
}

export interface SlotRequest {
  start: string;
  end: string;
  /** null = any staff */
  staffId: string | null;
  activeStaffCount: number;
  /** The booking being edited — never clashes with itself. */
  excludeId?: string | null;
}

const NO_END_MINUTES = 30;

/** Bookings that overlap the requested window. */
export function overlappingBookings(req: SlotRequest, bookings: SlotBooking[]): SlotBooking[] {
  const start = Date.parse(req.start), end = Date.parse(req.end);
  return bookings.filter(b => {
    if (b.id === req.excludeId) return false;
    // SQL: status != 'cancelled' — a NULL status doesn't count either
    if (b.status == null || b.status === "cancelled") return false;
    const bStart = Date.parse(b.start);
    const bEnd = b.end ? Date.parse(b.end) : bStart + NO_END_MINUTES * 60_000;
    return bStart < end && bEnd > start;
  });
}

/** Would the public booking accept this time? */
export function slotAvailable(req: SlotRequest, bookings: SlotBooking[]): boolean {
  const overlapping = overlappingBookings(req, bookings);
  if (req.staffId === null) return overlapping.length < req.activeStaffCount;
  if (overlapping.some(b => b.staffId === req.staffId)) return false;
  const busyOther = overlapping.filter(b => b.staffId !== null && b.staffId !== req.staffId).length;
  const busyNull = overlapping.filter(b => b.staffId === null).length;
  return req.activeStaffCount - busyOther > busyNull;
}

/**
 * The bookings in the way, or null when the owner needn't be asked: the time
 * is free, or nothing actually overlaps (e.g. a salon with no active staff).
 * For a chosen staff member with their own booking at that time, just theirs;
 * otherwise every overlapping booking (together they fill the salon).
 */
export function findSlotClash(req: SlotRequest, bookings: SlotBooking[]): SlotBooking[] | null {
  const overlapping = overlappingBookings(req, bookings);
  if (overlapping.length === 0 || slotAvailable(req, bookings)) return null;
  const own = req.staffId === null ? [] : overlapping.filter(b => b.staffId === req.staffId);
  return own.length ? own : overlapping;
}

/** "This time already has a booking: Sarah Johnson, 10:00–11:00 (Jo). Book anyway?" */
export function clashMessage(clash: SlotBooking[], timeZone: string): string {
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  const b = clash[0];
  const end = b.end ?? new Date(Date.parse(b.start) + NO_END_MINUTES * 60_000).toISOString();
  const who = b.clientName?.trim() || "Another client";
  const staff = b.staffName?.trim() ? ` (${b.staffName.trim()})` : "";
  const more = clash.length > 1 ? ` and ${clash.length - 1} more` : "";
  return `This time already has a booking: ${who}, ${time(b.start)}–${time(end)}${staff}${more}. Book anyway?`;
}
