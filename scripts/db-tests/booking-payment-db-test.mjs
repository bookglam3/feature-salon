/**
 * Booking payment guard (guard 10) tests on a throwaway LOCAL Postgres 17 — never Supabase.
 *
 * Runs sql/2026-11-06-booking-payment-guard*.sql the way you run them in
 * Supabase (pre-checks, migration, re-run, the self-undoing test, after-checks,
 * rollback) against a stand-in schema (scripts/db-tests/booking-mock.sql), and
 * checks the SQL guard agrees with bookingPaymentAllowed() in
 * app/lib/payments/bookingPayment.ts on every combination of salon settings,
 * Stripe state, services and payment fields — and accepts everything the
 * booking page can send.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     --disable-warning=ExperimentalWarning scripts/db-tests/booking-payment-db-test.mjs
 * (installs outside the project, so package.json and node_modules are untouched)
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bookingPaymentAllowed, bookingPaymentFields, mergePaymentMethods, paymentOptions } from "../../app/lib/payments/bookingPayment.ts";

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

const PORT = 54331;
const dataDir = mkdtempSync(join(tmpdir(), "booking-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const sqlFile = (f) => readFileSync(join(repo, "sql", f), "utf8");
const MAIN = sqlFile("2026-11-06-booking-payment-guard.sql");
const ROLLBACK = sqlFile("2026-11-06-booking-payment-guard-rollback.sql");
const TEST = sqlFile("2026-11-06-booking-payment-guard-test.sql").replace("'your-test-salon-slug'", "'test-salon'");

let ok = 0, bad = 0;
const report = (good, label, extra = "") => { if (good) ok++; else bad++; console.log(`${good ? "✔" : "✘"} ${label}${extra ? "  " + extra : ""}`); };
async function run(label, sql, expectErrorIncludes) {
  try {
    const res = await db.query(sql);
    const last = [].concat(res).filter(r => r.rows?.length).pop();
    report(!expectErrorIncludes, label, last ? JSON.stringify(last.rows) : "");
  } catch (e) {
    await db.query("rollback").catch(() => {}); // a file stopped half way leaves its transaction open
    report(!!expectErrorIncludes && e.message.includes(expectErrorIncludes), label, e.message.split("\n").slice(0, 4).join(" | "));
  }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;

/** The commented-out read-only queries in a SQL file, by their "A." / "1." label. */
function commentedQueries(text) {
  const out = {}; let label = null, cur = null;
  for (const line of text.split("\n")) {
    const head = line.match(/^-- ([A-Z]|\d)\. /);
    if (head) { label = head[1]; continue; }
    if (cur !== null) {
      if (line.startsWith("-- ") && line.trim() !== "--") { cur.push(line.slice(3)); continue; }
      out[label] = (out[label] ? out[label] + "\n" : "") + cur.join("\n"); cur = null;
    }
    if (/^-- select /.test(line)) cur = [line.slice(3)];
  }
  return out;
}
const pre = commentedQueries(MAIN.split("── Change")[0]);
const after = commentedQueries(MAIN.split("── After running")[1]);
const afterRollback = commentedQueries(ROLLBACK);

// One booking as the public (anon) user, always rolled back. Returns "booked" or the error.
async function bookAsAnon(salonId, serviceIds, status, paymentStatus, paymentMethod) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true); set local role anon");
    const items = serviceIds.map((id, i) => ({ service_id: id, sort_order: i }));
    await db.query(
      "select public.create_booking_with_services(gen_random_uuid(), gen_random_uuid(), $1, 'T', 't@example.com', '+447700900000', $2, null, now() + interval '400 days', $3, $4, $5, $6::jsonb)",
      [salonId, serviceIds[0], status, paymentStatus, paymentMethod, JSON.stringify(items)]);
    return "booked";
  } catch (e) { return e.message; }
  finally { await db.query("rollback"); }
}

try {
  await run("stand-in Supabase schema", readFileSync(join(here, "booking-mock.sql"), "utf8"));
  await run("the function as it is live today (2026-11-05 version, from the rollback file)", ROLLBACK);

  // ── pre-checks ─────────────────────────────────────────────────────────────
  for (const k of ["A", "B", "C", "D", "E"]) report(!!pre[k], `pre-check ${k} found in the file`);
  let r = await rows(pre.A);
  report(r.length === 1 && r[0].is_2026_11_05_version === true && r[0].already_changed === false, "pre-check A: live function is exactly the 2026-11-05 version", JSON.stringify(r));
  r = await rows(pre.B);
  report(r.length === 6, "pre-check B: 6 columns listed", JSON.stringify(r.map(x => `${x.table_name}.${x.column_name}:${x.data_type}`)));
  r = await rows(pre.C);
  report(r.length === 1 && Number(r[0].salons_that_differ) === 0, "pre-check C: page and function see the same settings", JSON.stringify(r));
  r = await rows(pre.D);
  report(r.length === 0, "pre-check D: no odd saved settings", JSON.stringify(r));
  await db.query("update public.salons set payment_methods = payment_methods || '{\"pay_at_salon\": \"yes\"}' where slug = 'test-salon'");
  r = await rows(pre.D);
  report(r.length === 1, "pre-check D lists a salon with an odd switch value");
  await db.query("update public.salons set payment_methods = payment_methods || '{\"pay_at_salon\": true}' where slug = 'test-salon'");
  await rows(pre.E);
  report(true, "pre-check E runs");

  // The hole, before the change
  const SALON = "11111111-1111-1111-1111-111111111111", CUT = "11111111-0000-0000-0000-000000000001";
  await db.query("update public.salons set payment_methods = '{\"full_online\": true, \"deposit_online\": true, \"pay_at_salon\": false}' where id = $1", [SALON]);
  report(await bookAsAnon(SALON, [CUT], "confirmed", "pay_at_salon", "pay_at_salon") === "booked",
    "BEFORE: anyone can book a confirmed 'pay at salon' slot at an online-only salon (the hole)");

  // ── change ─────────────────────────────────────────────────────────────────
  await run("migration", MAIN);
  await run("migration again (safe to re-run)", MAIN);
  report(await bookAsAnon(SALON, [CUT], "confirmed", "pay_at_salon", "pay_at_salon") === "PAYMENT_OPTION_NOT_ALLOWED", "AFTER: the same booking is refused");
  report(await bookAsAnon(SALON, [CUT], "pending", "pending", "deposit_online") === "booked", "AFTER: the online deposit booking the page sends still works");
  await db.query("update public.salons set payment_methods = '{\"full_online\": true, \"deposit_online\": true, \"pay_at_salon\": true, \"custom_deposit\": false, \"deposit_percent\": 50}' where id = $1", [SALON]);

  r = await rows(after["1"]);
  report(r.length === 1 && r[0].is_2026_11_06_version === true, "after-check 1: new function is live", JSON.stringify(r));
  r = await rows(after["2"]);
  report(r.length === 1 && r[0].security_definer === true && r[0].anon_can_execute === true && JSON.stringify(r[0].settings) === '["search_path=public"]',
    "after-check 2: still security definer, public can still execute, same search_path", JSON.stringify(r));
  let rowsInsert = await rows("select count(*)::int as n from public.appointments");
  const salonBefore = await rows("select payment_methods, stripe_account_id, charges_enabled from public.salons where id = $1", [SALON]);
  await run("self-undoing test file (jsonb column)", TEST, "PAYMENT GUARD TESTS: 14 passed, 0 failed. Nothing was saved.");
  report((await rows("select count(*)::int as n from public.appointments"))[0].n === rowsInsert[0].n
    && JSON.stringify(await rows("select payment_methods, stripe_account_id, charges_enabled from public.salons where id = $1", [SALON])) === JSON.stringify(salonBefore),
    "the test file saved nothing (no bookings, salon settings unchanged)");

  // ── parity: SQL guard 10 vs bookingPaymentAllowed(), every combination ────
  const SETTINGS = [null, "null", "{}", "[]", '"x"', "false", "0", "true"];
  for (let f = 0; f < 16; f++) {
    for (const pct of ["30", "100", null, "null", '"30"', "0", "150", "50.5", "true"]) {
      const o = { full_online: !!(f & 1), deposit_online: !!(f & 2), pay_at_salon: !!(f & 4), custom_deposit: !!(f & 8) };
      let s = JSON.stringify(o);
      if (pct !== null) s = s.slice(0, -1) + `,"deposit_percent":${pct}}`;
      SETTINGS.push(s);
    }
  }
  SETTINGS.push('{"full_online":"yes"}', '{"full_online":0,"deposit_online":1}', '{"pay_at_salon":null}', '{"pay_at_salon":""}',
    '{"pay_at_salon":"false","full_online":false}', '{"custom_deposit":{},"deposit_percent":25}', '{"custom_deposit":[],"deposit_percent":25,"deposit_online":false}');
  // prices as the booking page gets them (numbers); B is free, E is 1p, F has a half penny at 50%
  const PRICES = { A: [40, false], B: [0, false], C: [40, true], D: [25.5, true], E: [0.01, false], F: [33.33, false] };
  const SETS = [["A"], ["B"], ["C"], ["A", "D"], ["E"], ["F"], ["A", "A"]];
  const TUPLES = [];
  for (const st of ["pending", "confirmed"]) for (const ps of ["pending", "pay_at_salon"])
    for (const pm of [null, "full_online", "deposit_online", "custom_deposit", "pay_at_salon", "pending"]) TUPLES.push([st, ps, pm]);

  await db.query("create table public._case (n int primary key, salon_id uuid, service_ids uuid[], st text, ps text, pm text, result text)");
  const salons = [];
  for (const settings of SETTINGS) for (const ready of [true, false]) {
    const [{ id }] = await rows(
      "insert into public.salons (slug, payment_methods, stripe_account_id, charges_enabled) values (gen_random_uuid()::text, $1::jsonb, $2, $3) returning id",
      [settings, ready ? "acct_x" : null, ready]);
    await db.query("insert into public.staff (salon_id, name) values ($1, 'S')", [id]);
    const svc = {};
    for (const [k, [price, from]] of Object.entries(PRICES)) {
      svc[k] = (await rows("insert into public.services (salon_id, name, price, duration_minutes, price_is_from) values ($1, $2, $3, 30, $4) returning id", [id, k, price, from]))[0].id;
    }
    salons.push({ id, settings, ready, svc });
  }
  const cases = [];
  for (const s of salons) for (const set of SETS) for (const [st, ps, pm] of TUPLES) {
    const saved = s.settings === null ? null : JSON.parse(s.settings);
    const totalPrice = set.reduce((sum, k) => sum + PRICES[k][0], 0);
    const anyFrom = set.some(k => PRICES[k][1]);
    const allowed = bookingPaymentAllowed({ savedSettings: saved, onlineReady: s.ready, anyPriceIsFrom: anyFrom, totalPrice, status: st, paymentStatus: ps, paymentMethod: pm });
    const expected = allowed ? "booked" : ps === "pending" && !s.ready ? "ONLINE_PAYMENTS_UNAVAILABLE" : "PAYMENT_OPTION_NOT_ALLOWED";
    cases.push({ n: cases.length, s, set, st, ps, pm, saved, totalPrice, anyFrom, expected });
  }
  for (let i = 0; i < cases.length; i += 2000) {
    const chunk = cases.slice(i, i + 2000);
    await db.query(
      "insert into public._case (n, salon_id, service_ids, st, ps, pm) " +
      "select u.n, u.salon_id, string_to_array(u.ids, ',')::uuid[], u.st, u.ps, u.pm " +
      "from unnest($1::int[], $2::uuid[], $3::text[], $4::text[], $5::text[], $6::text[]) as u(n, salon_id, ids, st, ps, pm)",
      [chunk.map(c => c.n), chunk.map(c => c.s.id), chunk.map(c => c.set.map(k => c.s.svc[k]).join(",")), chunk.map(c => c.st), chunk.map(c => c.ps), chunk.map(c => c.pm)]);
  }
  const t0 = Date.now();
  await db.query(`do $$
    declare c record; v text;
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      for c in select * from public._case order by n loop
        begin
          set local role anon;
          perform public.create_booking_with_services(gen_random_uuid(), gen_random_uuid(), c.salon_id, 'T', 't@example.com', '+447700900000',
            c.service_ids[1], null, now() + interval '400 days', c.st, c.ps, c.pm,
            (select jsonb_agg(jsonb_build_object('service_id', id, 'sort_order', o - 1) order by o) from unnest(c.service_ids) with ordinality u(id, o)));
          raise exception 'BOOKED_ROLLED_BACK';
        exception when others then v := sqlerrm;
        end;
        reset role;
        update public._case set result = case when v = 'BOOKED_ROLLED_BACK' then 'booked' else v end where n = c.n;
      end loop;
    end $$`);
  const results = new Map((await rows("select n, result from public._case")).map(x => [x.n, x.result]));
  const mismatches = cases.filter(c => results.get(c.n) !== c.expected);
  report(mismatches.length === 0, `SQL guard 10 == bookingPaymentAllowed() on all ${cases.length} combinations (${SETTINGS.length} settings × 2 Stripe states × ${SETS.length} service sets × ${TUPLES.length} payment fields, ${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    mismatches.slice(0, 5).map(c => JSON.stringify({ settings: c.s.settings, ready: c.s.ready, set: c.set, st: c.st, ps: c.ps, pm: c.pm, sql: results.get(c.n), ts: c.expected })).join("\n   "));
  const bookedCount = cases.filter(c => results.get(c.n) === "booked").length;
  report(bookedCount > 0 && bookedCount < cases.length, `both outcomes covered: ${bookedCount} booked, ${cases.length - bookedCount} refused`);

  // every booking the booking page can send is accepted (its Stripe check said ready/not ready, or never answered)
  let pageSends = 0, pageRefused = [];
  const byKey = new Map(cases.map(c => [`${c.s.id}|${c.set.join("+")}|${c.st}|${c.ps}|${c.pm}`, c]));
  for (const s of salons) for (const set of SETS) for (const pageReady of [s.ready, null]) {
    const saved = s.settings === null ? null : JSON.parse(s.settings);
    const totalPrice = set.reduce((sum, k) => sum + PRICES[k][0], 0), anyFrom = set.some(k => PRICES[k][1]);
    const options = paymentOptions(mergePaymentMethods(saved), pageReady, anyFrom);
    for (const choice of options.length ? options.map(o => o.id) : [""]) {
      const f = bookingPaymentFields(options, choice, totalPrice, Boolean(saved));
      const c = byKey.get(`${s.id}|${set.join("+")}|${f.status}|${f.paymentStatus}|${f.paymentMethod}`);
      pageSends++;
      const want = f.paymentStatus === "pending" && !s.ready ? "ONLINE_PAYMENTS_UNAVAILABLE" : "booked";
      if (!c || results.get(c.n) !== want) pageRefused.push({ settings: s.settings, ready: s.ready, pageReady, set, f, got: c && results.get(c.n) });
    }
  }
  report(pageRefused.length === 0, `every one of the ${pageSends} bookings the page can send is accepted (an online one only when Stripe is really ready)`,
    pageRefused.slice(0, 5).map(x => JSON.stringify(x)).join("\n   "));
  await db.query("drop table public._case");

  // ── the column as json instead of jsonb ───────────────────────────────────
  await db.query("drop view public.public_salons; alter table public.salons alter column payment_methods type json using payment_methods::json; " +
    "create view public.public_salons as select id, slug, name, payment_methods from public.salons; grant all on public.public_salons to anon");
  r = await rows(pre.C);
  report(Number(r[0].salons_that_differ) === 0, "json column: pre-check C runs");
  await rows(pre.D); await rows(pre.E);
  await run("json column: self-undoing test file", TEST, "PAYMENT GUARD TESTS: 14 passed, 0 failed. Nothing was saved.");
  await db.query("drop view public.public_salons; alter table public.salons alter column payment_methods type jsonb using payment_methods::jsonb; " +
    "create view public.public_salons as select id, slug, name, payment_methods from public.salons");

  // ── rollback ───────────────────────────────────────────────────────────────
  await run("rollback", ROLLBACK);
  r = await rows(afterRollback["1"] ?? Object.values(afterRollback)[0]);
  report(r.length === 1 && r[0].is_2026_11_05_version === true, "after rollback: back to exactly the 2026-11-05 version", JSON.stringify(r));
  r = await rows(pre.A);
  report(r[0].is_2026_11_05_version === true && r[0].already_changed === false, "after rollback: pre-check A passes again (migration can be re-run)");
  await run("rollback again (safe to re-run)", ROLLBACK);
  await run("migration after rollback", MAIN);
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
