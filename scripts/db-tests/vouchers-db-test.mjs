/**
 * Gift voucher database tests on a throwaway LOCAL Postgres 17 — never Supabase.
 *
 * Runs every voucher SQL file the way you run them in Supabase (migrations,
 * re-runs, both self-undoing test scripts, rollback) against a stand-in
 * schema (scripts/db-tests/supabase-mock.sql), then tests what one SQL editor
 * session can't: several connections redeeming the same voucher at the very
 * same moment.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/voucher-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/voucher-db-deps node scripts/db-tests/vouchers-db-test.mjs
 * (installs outside the project, so package.json and node_modules are untouched)
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const PORT = 54329;
const dataDir = mkdtempSync(join(tmpdir(), "voucher-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();

const ADMIN = { host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres" };
const sqlFile = (f) => readFileSync(join(repo, "sql", f), "utf8");
const db = new pg.Client({ ...ADMIN, database: "postgres" });
await db.connect();

let ok = 0, bad = 0;
const report = (good, label, extra = "") => { if (good) ok++; else bad++; console.log(`${good ? "✔" : "✘"} ${label}${extra ? "  " + extra : ""}`); };
async function run(label, sql, expectErrorIncludes) {
  try {
    const res = await db.query(sql);
    const last = [].concat(res).filter(r => r.rows?.length).pop();
    report(!expectErrorIncludes, label, last ? JSON.stringify(last.rows) : "");
  } catch (e) {
    report(!!expectErrorIncludes && e.message.includes(expectErrorIncludes), label, e.message);
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

try {
  await run("stand-in Supabase schema", readFileSync(join(here, "supabase-mock.sql"), "utf8"));
  await run("step 1 migration", sqlFile("2026-10-10-gift-vouchers-step1.sql"));
  await run("step 1 tests", sqlFile("2026-10-10-gift-vouchers-step1-test.sql").replace("'your-test-salon-slug'", "'test-salon'"), "54 passed, 0 failed");
  // a gift card made on the old page after step 1 — step 2 must copy it too
  await db.query("insert into gift_cards (salon_id, code, amount, remaining, recipient_name) values ('11111111-1111-1111-1111-111111111111', 'GIFT-LATE', 15, 15, 'Late')");
  await run("step 2 migration", sqlFile("2026-10-10-gift-vouchers-step2.sql"));
  await run("step 2 migration again (safe to re-run)", sqlFile("2026-10-10-gift-vouchers-step2.sql"));
  report((await one("select count(*)::int n from vouchers where reference = 'GIFT-LATE'")).n === 1, "step 2 copied the late gift card");
  const t2 = sqlFile("2026-10-10-gift-vouchers-step2-test.sql");
  const counts = "select (select count(*) from vouchers) v, (select count(*) from voucher_redemptions) r, (select count(*) from voucher_holds) h";
  const before = await one(counts);
  await run("step 2 tests (salon with a booking and a service)", t2.replace("'your-test-salon-slug'", "'test-salon'"), "0 failed, 0 skipped");
  await run("step 2 tests (salon without them: skips reported)", t2.replace("'your-test-salon-slug'", "'other-salon'"), "0 failed");
  report(JSON.stringify(before) === JSON.stringify(await one(counts)), "the test scripts saved nothing");
  await run("step 1 tests still pass after step 2", sqlFile("2026-10-10-gift-vouchers-step1-test.sql").replace("'your-test-salon-slug'", "'test-salon'"), "54 passed, 0 failed");

  // ── At the same moment: separate connections, each holding its transaction open ──
  const SALON = "11111111-1111-1111-1111-111111111111";
  const connect = async () => { const c = new pg.Client({ ...ADMIN, database: "postgres" }); await c.connect(); await c.query("set role service_role"); return c; };
  const clients = await Promise.all(Array.from({ length: 10 }, connect));
  const attempt = async (c, sql, params, pause) => {
    await c.query("begin");
    try { await c.query(sql, params); await c.query(`select pg_sleep(${pause})`); await c.query("commit"); return "ok"; }
    catch (e) { await c.query("rollback"); return e.message; }
  };

  const money = await one("select public.create_voucher(p_salon_id => $1, p_kind => 'money', p_reference => 'RACE-MONEY', p_source => 'dashboard', p_amount_pence => 5000) ->> 'id' as id", [SALON]);
  const t0 = Date.now();
  const r1 = await Promise.all(clients.map(c => attempt(c, "select public.redeem_voucher_amount($1, $2, 1000)", [SALON, money.id], 0.15)));
  const m = await one("select remaining_pence, (select count(*)::int from voucher_redemptions where voucher_id = $1) n, (select coalesce(sum(amount_pence), 0)::int from voucher_redemptions where voucher_id = $1) s from vouchers where id = $1", [money.id]);
  report(r1.filter(x => x === "ok").length === 5 && r1.filter(x => x === "insufficient_balance").length === 5 && m.remaining_pence === 0 && m.n === 5 && m.s === 5000,
    "10 × £10 at the same moment on a £50 voucher → exactly 5 succeed, 5 refused, £0 left",
    `took ${Date.now() - t0}ms — they queued on the voucher lock`);

  const sv = await one("select public.create_voucher(p_salon_id => $1, p_kind => 'service', p_reference => 'RACE-SERVICE', p_source => 'dashboard', p_services => jsonb_build_array(jsonb_build_object('service_id', (select id from services where salon_id = $1 and archived_at is null order by name limit 1), 'quantity', 3))) ->> 'id' as id", [SALON]);
  const line = await one("select id from voucher_services where voucher_id = $1", [sv.id]);
  const r2 = await Promise.all(clients.slice(0, 7).map(c => attempt(c, "select public.redeem_voucher_service($1, $2, $3, 1)", [SALON, sv.id, line.id], 0.1)));
  const used = (await one("select used_quantity from voucher_services where id = $1", [line.id])).used_quantity;
  report(r2.filter(x => x === "ok").length === 3 && r2.filter(x => x === "service_used_up").length === 4 && used === 3,
    "7 × 1 service at the same moment on a 3-service voucher → exactly 3 succeed");

  const cv = await one("select public.create_voucher(p_salon_id => $1, p_kind => 'money', p_reference => 'RACE-CANCEL', p_source => 'dashboard', p_amount_pence => 3000) ->> 'id' as id", [SALON]);
  const [cancelled, redeemed] = await Promise.all([
    attempt(clients[0], "select public.cancel_voucher($1, $2, 'Race test', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')", [SALON, cv.id], 0.1),
    attempt(clients[1], "select public.redeem_voucher_amount($1, $2, 1000)", [SALON, cv.id], 0.1),
  ]);
  const c = await one("select status, remaining_pence, (select count(*)::int from voucher_redemptions where voucher_id = $1) n from vouchers where id = $1", [cv.id]);
  report(cancelled === "ok" && c.status === "cancelled" &&
    ((redeemed === "ok" && c.remaining_pence === 2000 && c.n === 1) || (redeemed === "voucher_cancelled" && c.remaining_pence === 3000 && c.n === 0)),
    "cancel and redeem at the same moment → one clean order, never half-done", `redeem: ${redeemed}`);
  await Promise.all(clients.map(x => x.end()));

  // ── Rollback keeps every row ──
  const snap = "select (select count(*) from vouchers) v, (select count(*) from voucher_redemptions) r, (select count(*)::int from pg_proc where proname in ('create_voucher','redeem_voucher_amount','redeem_voucher_service','cancel_voucher','search_vouchers','voucher_stats','get_voucher')) f";
  const pre = await one(snap);
  await run("step 2 rollback", sqlFile("2026-10-10-gift-vouchers-step2-rollback.sql"));
  const post = await one(snap);
  report(pre.v === post.v && pre.r === post.r && post.f === 0, "rollback removed the 7 functions and kept every voucher and redemption", JSON.stringify({ pre, post }));
  await run("step 2 migration after rollback", sqlFile("2026-10-10-gift-vouchers-step2.sql"));
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
