/**
 * Standalone unit test for the capacity-aware slot logic.
 * Replicates the four pure functions from app/book/[slug]/page.tsx.
 * No DB, no network — all fake in-memory data.
 * Run: node scripts/test-slot-logic.mjs
 */

// ── Replicated pure functions (must stay in sync with page.tsx) ───────────────

function addMinutesToSlot(slot, minutes) {
  const [h, m] = slot.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isStaffAvailableForWindow(staff, slotStart, slotEnd, dayKey) {
  if (!staff.working_hours) return true;
  const hours = staff.working_hours[dayKey];
  if (!hours?.enabled) return false;
  return hours.start <= slotStart && hours.end >= slotEnd;
}

/**
 * Replicates the IIFE closures from the render function.
 * ctx = { selectedStaff, staffList, bookedSlots, serviceDuration, dayKey }
 */
function computeBlocked(t, { selectedStaff, staffList, bookedSlots, serviceDuration, dayKey }) {
  const slotEnd = addMinutesToSlot(t, serviceDuration);

  // staffId === null means "some real staff member, unrecorded" — blocks
  // every staff id, not just unassigned checks. See the same comment in
  // app/lib/slot-availability.ts for the full reasoning and the documented
  // multi-staff-salon TODO this deliberately does not solve yet.
  const isStaffBusy = (sId, slotStart, slotEnd) =>
    bookedSlots.some(b => (b.staffId === sId || b.staffId === null) && intervalsOverlap(slotStart, slotEnd, b.start, b.end));

  if (selectedStaff !== null) {
    return !isStaffAvailableForWindow(selectedStaff, t, slotEnd, dayKey)
      || isStaffBusy(selectedStaff.id, t, slotEnd);
  }
  const eligible = staffList.filter(s => isStaffAvailableForWindow(s, t, slotEnd, dayKey));
  if (eligible.length === 0) return true;
  return eligible.every(s => isStaffBusy(s.id, t, slotEnd));
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    console.log(`         expected: ${expected}  got: ${actual}`);
    failed++;
  }
}

// ── Case A: specific staff, 60-min service, one booking 10:00–11:00 ───────────

console.log("\n─── A: specific staff, 60-min, booking 10:00–11:00 ───────────────────");

const staffA = {
  id: "s1", name: "Alice",
  working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } },
};
const ctxA = {
  selectedStaff: staffA,
  staffList: [staffA],
  bookedSlots: [{ staffId: "s1", start: "10:00", end: "11:00" }],
  serviceDuration: 60,
  dayKey: "Mon",
};

assert("10:00 → blocked  (direct hit)",               computeBlocked("10:00", ctxA), true);
assert("10:30 → blocked  ([10:30,11:30) overlaps [10:00,11:00))", computeBlocked("10:30", ctxA), true);
assert("11:00 → free     (booking ended, no overlap)", computeBlocked("11:00", ctxA), false);
assert("09:30 → blocked  ([09:30,10:30) overlaps [10:00,11:00))", computeBlocked("09:30", ctxA), true);

// ── Case B: 3 staff, Any Available, all Mon 09:00–18:00 ───────────────────────

console.log("\n─── B: Any Available, 3 staff, 60-min service ────────────────────────");

const s1 = { id: "s1", name: "Alice", working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } } };
const s2 = { id: "s2", name: "Bob",   working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } } };
const s3 = { id: "s3", name: "Carol", working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } } };
const baseCtxB = { selectedStaff: null, staffList: [s1, s2, s3], serviceDuration: 60, dayKey: "Mon" };

assert("1 booking at 10:00 → 10:00 AVAILABLE (2 free staff)",
  computeBlocked("10:00", { ...baseCtxB, bookedSlots: [
    { staffId: "s1", start: "10:00", end: "11:00" },
  ]}), false);

assert("2 bookings at 10:00 → 10:00 AVAILABLE (1 free staff)",
  computeBlocked("10:00", { ...baseCtxB, bookedSlots: [
    { staffId: "s1", start: "10:00", end: "11:00" },
    { staffId: "s2", start: "10:00", end: "11:00" },
  ]}), false);

assert("3 bookings at 10:00 → 10:00 BLOCKED (all busy)",
  computeBlocked("10:00", { ...baseCtxB, bookedSlots: [
    { staffId: "s1", start: "10:00", end: "11:00" },
    { staffId: "s2", start: "10:00", end: "11:00" },
    { staffId: "s3", start: "10:00", end: "11:00" },
  ]}), true);

// 10:30 is also blocked (all 60-min bookings at 10:00 run until 11:00, overlapping [10:30,11:30))
assert("3 bookings at 10:00 → 10:30 BLOCKED ([10:30,11:30) overlaps [10:00,11:00))",
  computeBlocked("10:30", { ...baseCtxB, bookedSlots: [
    { staffId: "s1", start: "10:00", end: "11:00" },
    { staffId: "s2", start: "10:00", end: "11:00" },
    { staffId: "s3", start: "10:00", end: "11:00" },
  ]}), true);

// 11:00 is free: [11:00,12:00) vs [10:00,11:00) → "11:00" < "11:00" is false → no overlap
assert("3 bookings at 10:00 → 11:00 FREE (half-open interval: bookings ended)",
  computeBlocked("11:00", { ...baseCtxB, bookedSlots: [
    { staffId: "s1", start: "10:00", end: "11:00" },
    { staffId: "s2", start: "10:00", end: "11:00" },
    { staffId: "s3", start: "10:00", end: "11:00" },
  ]}), false);

// ── Case C: working-hours edge — shift 09:00–13:00, 60-min service ─────────────

console.log("\n─── C: shift ends 13:00, 60-min service (window-end check) ───────────");

const staffC = {
  id: "sc", name: "Dawn",
  working_hours: { Mon: { enabled: true, start: "09:00", end: "13:00" } },
};
const ctxC = { selectedStaff: staffC, staffList: [staffC], bookedSlots: [], serviceDuration: 60, dayKey: "Mon" };

// 12:00 + 60 min = 13:00; hours.end >= slotEnd → "13:00" >= "13:00" → true → eligible
assert("12:00 → free   (ends exactly at shift end 13:00)", computeBlocked("12:00", ctxC), false);
// 12:30 + 60 min = 13:30; "13:00" >= "13:30" → false → ineligible → blocked
assert("12:30 → blocked (would end 13:30, past shift end 13:00)", computeBlocked("12:30", ctxC), true);

// ── Case D: off day — only staff, Any Available ────────────────────────────────

console.log("\n─── D: off day, Any Available (only one staff) ────────────────────────");

const staffD = {
  id: "sd", name: "Eve",
  working_hours: {
    Mon: { enabled: true,  start: "09:00", end: "18:00" },
    Sun: { enabled: false, start: "09:00", end: "18:00" },
  },
};
const ctxDSun = { selectedStaff: null, staffList: [staffD], bookedSlots: [], serviceDuration: 60, dayKey: "Sun" };
const ctxDMon = { ...ctxDSun, dayKey: "Mon" };

assert("Sun (off day, only staff) → 10:00 BLOCKED (no eligible staff)", computeBlocked("10:00", ctxDSun), true);
assert("Mon (on day, no bookings) → 10:00 FREE",                         computeBlocked("10:00", ctxDMon), false);

// ── Case E: staff with undefined working_hours → available all day ─────────────

console.log("\n─── E: undefined working_hours → always available ─────────────────────");

const staffE = { id: "se", name: "Frank" }; // no working_hours property
const ctxE = { selectedStaff: staffE, staffList: [staffE], serviceDuration: 60, dayKey: "Mon" };

assert("No working_hours, no bookings → 10:00 FREE",
  computeBlocked("10:00", { ...ctxE, bookedSlots: [] }), false);

assert("No working_hours, booking 10:00–11:00 → 10:00 BLOCKED",
  computeBlocked("10:00", { ...ctxE, bookedSlots: [{ staffId: "se", start: "10:00", end: "11:00" }] }), true);

assert("No working_hours, booking 10:00–11:00 → 09:00 FREE (no overlap)",
  computeBlocked("09:00", { ...ctxE, bookedSlots: [{ staffId: "se", start: "10:00", end: "11:00" }] }), false);

// ── Case F: cancelled bookings must NOT block ─────────────────────────────────

console.log("\n─── F: cancelled bookings excluded from bookedSlots ───────────────────");
//
// The DB query uses .not("status", "eq", "cancelled") — cancelled rows never
// reach the bookedSlots array. We verify the in-memory side: an absent interval
// does NOT block; a present interval DOES.

const staffF = {
  id: "sf", name: "Grace",
  working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } },
};

assert("Empty bookedSlots (cancelled excluded) → 10:00 FREE",
  computeBlocked("10:00", { selectedStaff: staffF, staffList: [staffF], bookedSlots: [], serviceDuration: 60, dayKey: "Mon" }),
  false);

assert("Confirmed booking present → 10:00 BLOCKED (sanity: non-cancelled rows block)",
  computeBlocked("10:00", { selectedStaff: staffF, staffList: [staffF], bookedSlots: [{ staffId: "sf", start: "10:00", end: "11:00" }], serviceDuration: 60, dayKey: "Mon" }),
  true);

// Also verify cross-staff isolation: staffF's booking must NOT block staffG
const staffG = {
  id: "sg", name: "Hank",
  working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } },
};
assert("staffF booking at 10:00 must NOT block staffG's 10:00 slot (specific-staff mode)",
  computeBlocked("10:00", { selectedStaff: staffG, staffList: [staffF, staffG], bookedSlots: [{ staffId: "sf", start: "10:00", end: "11:00" }], serviceDuration: 60, dayKey: "Mon" }),
  false);

// ── Case G: staff_id = null ("Any Available" booking) blocks regardless of
// which staff id is being checked — the fix for Anita's one-staff-salon gap ──

console.log("\n─── G: null staff_id blocks specific-staff AND any-available checks ───");

const staffH = {
  id: "sh", name: "Hana",
  working_hours: { Mon: { enabled: true, start: "09:00", end: "18:00" } },
};

// G1: an existing "Any Available" (staffId: null) booking must block a
// SPECIFIC staff member's check — this is the actual bug being fixed. Before
// the fix, b.staffId === sId ("sh") would never match a stored null, so this
// assertion would have failed (returned false / free).
assert("null-staff booking blocks a SPECIFIC staff check (10:00)",
  computeBlocked("10:00", {
    selectedStaff: staffH, staffList: [staffH],
    bookedSlots: [{ staffId: null, start: "10:00", end: "11:00" }],
    serviceDuration: 60, dayKey: "Mon",
  }), true);

// G2: the same null-staff booking must also block an "Any Available" check
// (single staff in the pool) — this direction was ALSO broken before the fix,
// since the any-available branch calls the same isStaffBusy(s.id) helper.
assert("null-staff booking also blocks an ANY-AVAILABLE check (10:00)",
  computeBlocked("10:00", {
    selectedStaff: null, staffList: [staffH],
    bookedSlots: [{ staffId: null, start: "10:00", end: "11:00" }],
    serviceDuration: 60, dayKey: "Mon",
  }), true);

// G3: "vice versa" — a booking made under a SPECIFIC named staff member must
// still correctly block a later "Any Available" check against that same
// (single) staff pool. This direction already worked before the fix (a real
// staffId matches s.id directly) — included as a regression guard, not a new
// fix, to prove the change above didn't disturb it.
assert("specific-staff booking still blocks an ANY-AVAILABLE check (vice versa, 10:00)",
  computeBlocked("10:00", {
    selectedStaff: null, staffList: [staffH],
    bookedSlots: [{ staffId: "sh", start: "10:00", end: "11:00" }],
    serviceDuration: 60, dayKey: "Mon",
  }), true);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");

if (failed > 0) process.exit(1);
