/**
 * Unit tests for the owner booking slot check (app/lib/slotClash.ts) — the
 * same rule the public booking uses. Pure — no DB, no network.
 * scripts/db-tests/owner-slot-db-test.mjs checks the rule against the SQL one.
 * Run: npm test   (or: node scripts/test-owner-slot.mjs)
 */

import { clashMessage, findSlotClash, overlappingBookings, slotAvailable } from "../app/lib/slotClash.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}\n           got      ${JSON.stringify(actual)}`); }
}

const T = (hhmm) => `2026-11-10T${hhmm}:00.000Z`;
const A = "staff-a", B = "staff-b";
const bk = (id, staffId, start, end, status = "confirmed", extra = {}) => ({ id, staffId, start: T(start), end: end ? T(end) : null, status, ...extra });
const req = (start, end, staffId, activeStaffCount, excludeId) => ({ start: T(start), end: T(end), staffId, activeStaffCount, excludeId });
const ids = (r) => r === null ? null : r.map(b => b.id);

console.log("\nOverlap");
const one = [bk("x", A, "10:00", "11:00")];
check("10:30–11:30 overlaps 10:00–11:00", ids(overlappingBookings(req("10:30", "11:30", A, 1), one)), ["x"]);
check("back to back (11:00–12:00) doesn't overlap", ids(overlappingBookings(req("11:00", "12:00", A, 1), one)), []);
check("ends exactly when it starts (09:00–10:00) doesn't overlap", ids(overlappingBookings(req("09:00", "10:00", A, 1), one)), []);
check("a booking with no end time counts as 30 minutes", [ids(overlappingBookings(req("10:20", "10:40", A, 1), [bk("y", A, "10:00", null)])), ids(overlappingBookings(req("10:30", "11:00", A, 1), [bk("y", A, "10:00", null)]))], [["y"], []]);
check("cancelled bookings don't count", ids(overlappingBookings(req("10:00", "11:00", A, 1), [bk("c", A, "10:00", "11:00", "cancelled")])), []);
check("a booking with no status doesn't count (like the SQL)", ids(overlappingBookings(req("10:00", "11:00", A, 1), [bk("n", A, "10:00", "11:00", null)])), []);
check("completed / no-show / pending still count", ids(overlappingBookings(req("10:00", "11:00", A, 3), [bk("1", A, "10:00", "11:00", "completed"), bk("2", B, "10:00", "11:00", "no_show"), bk("3", null, "10:00", "11:00", "pending")])), ["1", "2", "3"]);
check("editing: the booking itself never counts", ids(overlappingBookings(req("10:15", "11:15", A, 1, "x"), one)), []);

console.log("\nA chosen staff member");
check("their own booking at that time → taken", slotAvailable(req("10:00", "11:00", A, 2), one), false);
check("another staff member's booking → free (2 staff)", slotAvailable(req("10:00", "11:00", B, 2), one), true);
check("'any staff' booking with 2 staff → free", slotAvailable(req("10:00", "11:00", A, 2), [bk("n1", null, "10:00", "11:00")]), true);
check("'any staff' booking with 1 staff → taken", slotAvailable(req("10:00", "11:00", A, 1), [bk("n1", null, "10:00", "11:00")]), false);
check("B busy + an 'any staff' booking, 2 staff → A taken (the 'any' one needs A)", slotAvailable(req("10:00", "11:00", A, 2), [bk("b1", B, "10:00", "11:00"), bk("n1", null, "10:00", "11:00")]), false);

console.log("\nAny staff");
check("1 booking, 2 active staff → free", slotAvailable(req("10:00", "11:00", null, 2), one), true);
check("2 bookings, 2 active staff → taken", slotAvailable(req("10:00", "11:00", null, 2), [bk("x", A, "10:00", "11:00"), bk("y", B, "10:30", "11:30")]), false);
check("no active staff → the SQL says taken", slotAvailable(req("10:00", "11:00", null, 0), []), false);

console.log("\nWhen the owner is asked");
check("free time → not asked", findSlotClash(req("12:00", "13:00", A, 1), one), null);
check("clash → asked, with the booking in the way", ids(findSlotClash(req("10:30", "11:30", A, 1), one)), ["x"]);
check("no active staff but nothing booked → not asked", findSlotClash(req("10:00", "11:00", null, 0), []), null);
check("chosen staff with their own booking then: only theirs is named", ids(findSlotClash(req("10:00", "11:00", A, 2), [bk("n1", null, "10:00", "11:00"), bk("a1", A, "10:30", "11:00"), bk("b1", B, "10:00", "11:00")])), ["a1"]);
check("chosen staff free, but the others fill the salon: all of those are named", ids(findSlotClash(req("10:00", "11:00", A, 2), [bk("b1", B, "10:00", "11:00"), bk("n1", null, "10:00", "11:00")])), ["b1", "n1"]);
check("editing a booking into its own time → not asked", findSlotClash(req("10:00", "11:00", A, 1, "x"), one), null);
check("past date works the same (walk-ins)", ids(findSlotClash({ start: "2020-01-01T10:00:00Z", end: "2020-01-01T11:00:00Z", staffId: A, activeStaffCount: 1 }, [{ id: "old", staffId: A, start: "2020-01-01T10:30:00Z", end: "2020-01-01T11:30:00Z", status: "completed" }])), ["old"]);

console.log("\nThe question");
const clash = [bk("x", A, "10:00", "11:00", "confirmed", { clientName: "Sarah Johnson", staffName: "Jo" })];
check("Sarah Johnson, 10:00–11:00 (Jo)", clashMessage(clash, "UTC"), "This time already has a booking: Sarah Johnson, 10:00–11:00 (Jo). Book anyway?");
check("salon time zone (London in summer = UTC+1)", clashMessage([{ id: "s", staffId: A, start: "2026-07-10T09:00:00Z", end: "2026-07-10T10:00:00Z", status: "confirmed", clientName: "Sam" }], "Europe/London"), "This time already has a booking: Sam, 10:00–11:00. Book anyway?");
check("no end time → 30 minutes; no staff → no brackets", clashMessage([bk("y", null, "14:00", null, "confirmed", { clientName: "Ola" })], "UTC"), "This time already has a booking: Ola, 14:00–14:30. Book anyway?");
check("several in the way", clashMessage([...clash, bk("z", B, "10:30", "11:30", "confirmed", { clientName: "Bo" })], "UTC"), "This time already has a booking: Sarah Johnson, 10:00–11:00 (Jo) and 1 more. Book anyway?");
check("no client name", clashMessage([bk("q", null, "09:00", "09:45")], "UTC"), "This time already has a booking: Another client, 09:00–09:45. Book anyway?");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
