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

export function computeBlocked(t: string, opts: ComputeBlockedOpts): boolean {
  const { selectedStaff, staffList, bookedIntervals, serviceDuration, dayKey } = opts;
  const slotEnd = addMinutesToSlot(t, serviceDuration);

  // staffId === null on a booked interval means "some real staff member did
  // this, we just didn't record who" (an "Any Available" booking) — not
  // "no one." Treated as blocking every staff id, not just unassigned
  // checks: correct for a single/low-staff salon (there's no one else it
  // could have been); over-conservative for a genuinely multi-staff salon
  // (could show a staff member busy who wasn't the one who actually took
  // that booking). TODO: replace with a real capacity-pool model (track
  // unassigned-bookings-per-window against total active staff count) once a
  // multi-staff salon needs it — deliberately not built now.
  const isStaffBusy = (sId: string): boolean =>
    bookedIntervals.some(b => (b.staffId === sId || b.staffId === null) && intervalsOverlap(t, slotEnd, b.start, b.end));

  if (selectedStaff !== null) {
    return !isStaffAvailableForWindow(selectedStaff, t, slotEnd, dayKey) || isStaffBusy(selectedStaff.id);
  }
  const eligible = staffList.filter(s => isStaffAvailableForWindow(s, t, slotEnd, dayKey));
  if (eligible.length === 0) return true;
  return eligible.every(s => isStaffBusy(s.id));
}
