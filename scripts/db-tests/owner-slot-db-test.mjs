/**
 * The owner booking slot check (app/lib/slotClash.ts → slotAvailable) against
 * the public booking's own rule, on a throwaway LOCAL Postgres 17 — never Supabase.
 *
 * For thousands of generated situations (0–3 active staff plus an inactive one,
 * up to 4 existing bookings with any staff / "any staff" / no end time / every
 * status, a request for a chosen or any staff member) it books through the live
 * create_booking_with_services (sql/2026-11-06-booking-payment-guard.sql, on the
 * stand-in schema scripts/db-tests/booking-mock.sql) and checks the TypeScript
 * rule gives the same answer: booked ⇔ available, SLOT_UNAVAILABLE ⇔ taken.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     --disable-warning=ExperimentalWarning scripts/db-tests/owner-slot-db-test.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { slotAvailable } from "../../app/lib/slotClash.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const deps = process.env.DB_TEST_DEPS || repo;
let pg, EmbeddedPostgres;
try {
  pg = (await import(pathToFileURL(join(deps, "node_modules/pg/lib/index.js")).href)).default;
  ({ default: EmbeddedPostgres } = await import(pathToFileURL(join(deps, "node_modules/embedded-postgres/dist/index.js")).href));
} catch {
  console.error("Missing test dependencies. See the instructions at the top of this file.");
  process.exit(2);
}

const PORT = 54335;
const dataDir = mkdtempSync(join(tmpdir(), "owner-slot-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

let ok = 0, bad = 0;
const report = (good, label, extra = "") => { if (good) ok++; else bad++; console.log(`${good ? "✔" : "✘"} ${label}${extra ? "  " + extra : ""}`); };

// deterministic "random" (mulberry32 — the low bits of a plain LCG repeat too soon)
let seed = 20261107;
const rnd = (n) => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
};
const pick = (arr) => arr[rnd(arr.length)];

try {
  await db.query(readFileSync(join(here, "booking-mock.sql"), "utf8"));
  await db.query(readFileSync(join(repo, "sql", "2026-11-06-booking-payment-guard.sql"), "utf8"));
  report(true, "stand-in schema + the live booking function (2026-11-06)");

  // one salon per staff set-up: 0–3 active staff + one inactive
  const salons = [];
  for (let active = 0; active <= 3; active++) {
    const [{ id }] = await q("insert into salons (slug, stripe_account_id, charges_enabled) values ($1, 'acct_x', true) returning id", [`s${active}`]);
    const staff = [];
    for (let i = 0; i < active; i++) staff.push((await q("insert into staff (salon_id, name, active) values ($1, $2, true) returning id", [id, `A${i}`]))[0].id);
    const inactive = (await q("insert into staff (salon_id, name, active) values ($1, 'Off', false) returning id", [id]))[0].id;
    const services = {};
    for (const mins of [30, 60, 90]) services[mins] = (await q("insert into services (salon_id, name, price, duration_minutes) values ($1, $2, 20, $3) returning id", [id, `S${mins}`, mins]))[0].id;
    salons.push({ id, active, staff, inactive, services });
  }

  const BASE = Date.parse("2027-03-01T12:00:00Z");
  const iso = (min) => new Date(BASE + min * 60_000).toISOString();
  const STATUSES = ["confirmed", "pending", "completed", "no_show", "cancelled", null];
  let n = 0, mismatches = [], taken = 0;
  for (let i = 0; i < 4000; i++) {
    const s = pick(salons);
    const staffChoices = [null, ...s.staff, s.inactive];
    const bookings = [];
    for (let k = rnd(5); k > 0; k--) {
      const start = (rnd(17) - 8) * 15;                      // -120 … +120 minutes
      const len = pick([null, 15, 30, 45, 60, 90, 120]);
      bookings.push({ id: crypto.randomUUID(), staffId: pick(staffChoices), start: iso(start), end: len === null ? null : iso(start + len), status: pick(STATUSES) });
    }
    const reqStaff = pick(staffChoices);
    const mins = pick([30, 60, 90]);
    const reqStart = (rnd(13) - 6) * 15;

    await db.query("begin");
    let sqlResult;
    try {
      for (const b of bookings) {
        await db.query("insert into appointments (id, salon_id, staff_id, date_time, end_time, status) values ($1, $2, $3, $4, $5, $6)",
          [b.id, s.id, b.staffId, b.start, b.end, b.status]);
      }
      await db.query("set local role anon");
      await db.query("select create_booking_with_services(gen_random_uuid(), gen_random_uuid(), $1, 'T', 't@example.com', '+447700900000', $2, $3, $4, 'pending', 'pending', null, $5::jsonb)",
        [s.id, s.services[mins], reqStaff, iso(reqStart), JSON.stringify([{ service_id: s.services[mins], sort_order: 0 }])]);
      sqlResult = "booked";
    } catch (e) { sqlResult = e.message; }
    finally { await db.query("rollback"); }

    const ts = slotAvailable({ start: iso(reqStart), end: iso(reqStart + mins), staffId: reqStaff, activeStaffCount: s.active }, bookings);
    n++;
    if (!ts) taken++;
    const want = ts ? "booked" : "SLOT_UNAVAILABLE";
    if (sqlResult !== want) mismatches.push({ active: s.active, reqStaff, mins, reqStart, bookings, sql: sqlResult, ts });
  }
  report(mismatches.length === 0, `slotAvailable() == the booking function on all ${n} situations (${n - taken} free, ${taken} taken)`,
    mismatches.slice(0, 3).map(m => JSON.stringify(m)).join("\n   "));
  report(taken > 200 && n - taken > 200, "both answers covered many times");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
