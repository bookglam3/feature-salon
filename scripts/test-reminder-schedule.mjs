/**
 * Unit tests for app/lib/reminders/schedule.ts — when each automatic message
 * is due (catch-up windows), "booked in time", one flag per message, repeat
 * clients for win-back and WhatsApp STOP replies.
 * Run: npm test   (or: node scripts/test-reminder-schedule.mjs)
 */

import {
  REMINDER_KINDS, SENT_FLAG, REQUIRED_STATUS, dueWindow, bookedInTime, isDue,
  phoneDigits, sameClient, isOptOutReply,
} from "../app/lib/reminders/schedule.ts";

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✅ PASS  ${label}`); }
  else { failed++; console.log(`  ❌ FAIL  ${label}\n           expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
}

const NOW = new Date("2026-11-09T12:00:00Z");
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const at = (ms) => new Date(NOW.getTime() + ms).toISOString();
const booking = (status, startMs, createdMs = -7 * DAY, sent = false) => ({ status, date_time: at(startMs), created_at: at(createdMs), sent });
const due = (kind, b, now = NOW) => isDue(kind, b, now);

console.log("\nOne sent flag per message");
check("every message has its own flag", REMINDER_KINDS.map(k => SENT_FLAG[k]), ["reminder_2h_sent", "reminder_24h_sent", "no_show_alert_sent", "thankyou_1h_sent", "winback_sent"]);
check("no two messages share a flag", new Set(Object.values(SENT_FLAG)).size, 5);
check("reminders, no-show and win-back need 'confirmed'; thank-you needs 'completed'",
  REMINDER_KINDS.map(k => REQUIRED_STATUS[k]), ["confirmed", "confirmed", "confirmed", "completed", "confirmed"]);

console.log("\n24h reminder: starts in 2h–24h, booked 24h+ ahead");
check("starts in exactly 24h → due", due("24h", booking("confirmed", 24 * HOUR)), true);
check("starts in 24h 1min → not yet", due("24h", booking("confirmed", 24 * HOUR + MIN)), false);
check("missed runs: starts in 5h, not sent → still due (catch-up)", due("24h", booking("confirmed", 5 * HOUR)), true);
check("starts in exactly 2h → no longer (the 2h one takes over)", due("24h", booking("confirmed", 2 * HOUR)), false);
check("booked 11h before the appointment → no 24h reminder", due("24h", booking("confirmed", 10 * HOUR, -1 * HOUR)), false);
check("booked exactly 24h before → due", due("24h", booking("confirmed", 10 * HOUR, 10 * HOUR - 24 * HOUR)), true);
check("unknown created_at (old row) → due", due("24h", { status: "confirmed", date_time: at(10 * HOUR), created_at: null, sent: false }), true);
check("already sent → not due", due("24h", booking("confirmed", 10 * HOUR, -7 * DAY, true)), false);
check("flag empty (null) → not due (as before)", due("24h", booking("confirmed", 10 * HOUR, -7 * DAY, null)), false);
check("pending / cancelled / completed → not due", ["pending", "cancelled", "completed"].map(st => due("24h", booking(st, 10 * HOUR))), [false, false, false]);

console.log("\n2h reminder: starts in 30m–2h, booked 2h+ ahead");
check("starts in exactly 2h → due", due("2h", booking("confirmed", 2 * HOUR)), true);
check("starts in 2h 1min → not yet", due("2h", booking("confirmed", 2 * HOUR + MIN)), false);
check("missed runs: starts in 45 min → still due", due("2h", booking("confirmed", 45 * MIN)), true);
check("starts in exactly 30 min → too late, skipped", due("2h", booking("confirmed", 30 * MIN)), false);
check("booked 1h before the appointment → no 2h reminder", due("2h", booking("confirmed", 1 * HOUR, -0)), false);
check("booked 25h ahead: gets BOTH (24h earlier, 2h now) — never the same one twice",
  [due("24h", booking("confirmed", 20 * HOUR, -5 * HOUR)), due("2h", booking("confirmed", 1 * HOUR, -24 * HOUR))], [true, true]);

console.log("\nAt any moment a booking is in at most one reminder window");
for (const ms of [24 * HOUR, 2 * HOUR + 1, 2 * HOUR, 2 * HOUR - 1, 30 * MIN + 1, 30 * MIN]) {
  const b = booking("confirmed", ms);
  check(`starts in ${ms / MIN} min → ${[due("24h", b), due("2h", b)].filter(Boolean).length} due`, [due("24h", b), due("2h", b)].filter(Boolean).length <= 1, true);
}

console.log("\nThank-you: completed, 1h–24h after the start");
check("completed 3h ago → due", due("thankyou", booking("completed", -3 * HOUR)), true);
check("completed 30 min ago → not yet", due("thankyou", booking("completed", -30 * MIN)), false);
check("completed 25h ago → too old (no burst of old bookings)", due("thankyou", booking("completed", -25 * HOUR)), false);
check("still 'confirmed' → no thank-you", due("thankyou", booking("confirmed", -3 * HOUR)), false);

console.log("\nNo-show alert: still confirmed, 30m–12h after the start");
check("started 45 min ago → due", due("noshow", booking("confirmed", -45 * MIN)), true);
check("started 20 min ago → not yet", due("noshow", booking("confirmed", -20 * MIN)), false);
check("missed runs: started 11h ago → still due", due("noshow", booking("confirmed", -11 * HOUR)), true);
check("started 13h ago → too old", due("noshow", booking("confirmed", -13 * HOUR)), false);
check("marked completed / no_show → no alert", [due("noshow", booking("completed", -1 * HOUR)), due("noshow", booking("no_show", -1 * HOUR))], [false, false]);

console.log("\nWin-back: 42–43 days after");
check("42.5 days ago → due", due("winback", booking("confirmed", -42.5 * DAY, -50 * DAY)), true);
check("41 days ago → not yet", due("winback", booking("confirmed", -41 * DAY, -50 * DAY)), false);
check("60 days ago → too old (no burst on the first run)", due("winback", booking("confirmed", -60 * DAY, -70 * DAY)), false);

console.log("\nClock change (Europe/London, last Sunday of October): windows are real hours");
{
  // Sun 25 Oct 2026 10:00 London = 10:00 UTC (GMT). 24 real hours before = Sat 24 Oct 10:00 UTC = 11:00 London (BST).
  const start = "2026-10-25T10:00:00Z";
  const b = { status: "confirmed", date_time: start, created_at: "2026-10-01T00:00:00Z", sent: false };
  check("Sat 10:59 London (09:59 UTC) → not yet", isDue("24h", b, new Date("2026-10-24T09:59:00Z")), false);
  check("Sat 11:00 London (10:00 UTC) → due, exactly 24 real hours before", isDue("24h", b, new Date("2026-10-24T10:00:00Z")), true);
  check("2h reminder at 08:00 London (08:00 UTC) on the day", isDue("2h", b, new Date("2026-10-25T08:00:00Z")), true);
}
check("bookedInTime ignores bad dates (treats as yes)", bookedInTime("24h", "not a date", "also not"), true);
check("windows are relative to now", [dueWindow("2h", NOW).after.toISOString(), dueWindow("2h", NOW).upTo.toISOString()], ["2026-11-09T12:30:00.000Z", "2026-11-09T14:00:00.000Z"]);

console.log("\nSame client (win-back skips clients who booked again)");
check("07… and +44 7… are the same phone", [phoneDigits("07700 900123"), phoneDigits("+44 7700 900123"), phoneDigits("0044 7700 900123")], ["447700900123", "447700900123", "447700900123"]);
check("same email in another case → same client", sameClient({ client_email: "Jo@Example.com" }, { client_email: " jo@example.com " }), true);
check("same phone, different format → same client", sameClient({ client_phone: "07700900123" }, { client_phone: "+447700900123" }), true);
check("different email and phone → not the same", sameClient({ client_email: "a@x.com", client_phone: "07700900123" }, { client_email: "b@x.com", client_phone: "07700900999" }), false);
check("both empty → not the same", sameClient({}, { client_email: "", client_phone: null }), false);

console.log("\nWhatsApp STOP replies");
check("STOP in any case / with a full stop / STOP ALL / UNSUBSCRIBE / OPT OUT",
  ["STOP", "stop", " Stop. ", "STOP ALL", "stopall", "Unsubscribe", "opt out", "END", "quit!"].map(isOptOutReply), Array(9).fill(true));
check("not an opt-out: cancel (may mean the appointment), sentences, empty",
  ["cancel", "Cancel please", "stop by at 3?", "Please stop", "", null].map(isOptOutReply), Array(6).fill(false));

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log("─".repeat(60) + "\n");
if (failed > 0) process.exit(1);
