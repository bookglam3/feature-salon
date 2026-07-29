// Pure helpers for capacity-aware slot availability.
// Shared by: app/book/[slug]/page.tsx, app/reschedule/[id]/page.tsx

export const DAY_KEYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;

export const COUNTRY_TIMEZONES: Record<string, string> = {
  GB: "Europe/London",
  PK: "Asia/Karachi",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
};

export interface BookedInterval {
  staffId: string | null;
  start: string; // HH:MM in salon local time
  end: string;   // HH:MM in salon local time
}

// Minimal staff shape needed by slot logic — structural subset of each page's StaffMember
export interface StaffForSlots {
  id: string;
  working_hours?: Record<string, { enabled: boolean; start: string; end: string }>;
}

export function addMinutesToSlot(slot: string, minutes: number): string {
  const [h, m] = slot.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function utcToSalonTime(isoStr: string, timezone: string): string {
  return new Date(isoStr).toLocaleTimeString("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// Returns true if staff can serve the full window [slotStart, slotEnd) on dayKey.
export function isStaffAvailableForWindow(
  staff: StaffForSlots, slotStart: string, slotEnd: string, dayKey: string
): boolean {
  if (!staff.working_hours) return true;
  const hours = staff.working_hours[dayKey];
  if (!hours?.enabled) return false;
  return hours.start <= slotStart && hours.end >= slotEnd;
}

export interface ComputeBlockedOpts {
  selectedStaff: StaffForSlots | null; // null = "Any Available"
  staffList: StaffForSlots[];
  bookedIntervals: BookedInterval[];
  serviceDuration: number;
  dayKey: string;
}

// Capacity-pool model — mirrors check_slot_available's plpgsql body
// (supabase-check-slot-capacity-pool-fix.sql). Keep both in sync; the
// derivation and the "flexible pool, not fixed-unknown-identity" business
// assumption are documented in that file's header, not repeated here.
//
// staffId === null on a booked interval means "some real staff member did
// this, identity unrecorded" — it occupies exactly one pool slot, not every
// staff id at once (that was the pre-fix behavior, over-conservative for a
// genuinely multi-staff salon: one Any-Available booking would show every
// staff member busy for Any-Available checks, and any specific-staff
// request would be blocked by a null row that may have belonged to someone
// else entirely).
export function computeBlocked(t: string, opts: ComputeBlockedOpts): boolean {
  const { selectedStaff, staffList, bookedIntervals, serviceDuration, dayKey } = opts;
  const slotEnd = addMinutesToSlot(t, serviceDuration);
  const overlapping = bookedIntervals.filter(b => intervalsOverlap(t, slotEnd, b.start, b.end));

  if (selectedStaff !== null) {
    if (!isStaffAvailableForWindow(selectedStaff, t, slotEnd, dayKey)) return true;
    if (overlapping.some(b => b.staffId === selectedStaff.id)) return true;

    // selectedStaff can only be guaranteed free if enough OTHER staff exist
    // to absorb every unidentified (null-staff) booking without needing
    // selectedStaff. Pool size uses staffList.length (all active staff),
    // not a working-hours-filtered count — deliberately matching
    // check_slot_available's pool definition so client and server can never
    // disagree on this specific comparison. See that file for the N=1
    // boundary check showing this is a strict generalization of the
    // previous "any null row blocks any specific request" rule, not a
    // divergent one.
    const busyOther = overlapping.filter(b => b.staffId !== null && b.staffId !== selectedStaff.id).length;
    const busyNull = overlapping.filter(b => b.staffId === null).length;
    return (staffList.length - busyOther) <= busyNull;
  }

  // "Any Available": block only if every eligible (working-hours-filtered)
  // staff member is occupied. Each overlapping interval — specific or
  // null-staff — occupies exactly one distinct staff member, guaranteed by
  // the branch above never letting two overlapping intervals resolve to the
  // same staff, so a raw count is a valid stand-in for "how many are busy."
  const eligible = staffList.filter(s => isStaffAvailableForWindow(s, t, slotEnd, dayKey));
  if (eligible.length === 0) return true;
  return overlapping.length >= eligible.length;
}
