/**
 * Tests for sql/2026-11-07-payments-owner-read*.sql on a throwaway LOCAL
 * Postgres 17 — never Supabase. Uses the stand-in schema
 * scripts/db-tests/supabase-mock.sql (roles, auth.uid(), salons and
 * appointments with their owner policies, two salons) plus a payments table
 * with RLS on and no policy, as live on 7 Nov 2026.
 *
 * Runs the pre-checks, the policy, a re-run (must fail and change nothing),
 * the after-check, the self-undoing test file, and the rollback — and checks
 * under RLS who can read what: each owner only their own salon's payments,
 * never another salon's or a payment with no booking; other users and the
 * public nothing; nobody can write.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node scripts/db-tests/payments-read-db-test.mjs
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

const PORT = 54334;
const dataDir = mkdtempSync(join(tmpdir(), "payments-read-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const sqlFile = (f) => readFileSync(join(repo, "sql", f), "utf8");
const MAIN = sqlFile("2026-11-07-payments-owner-read.sql");
const ROLLBACK = sqlFile("2026-11-07-payments-owner-read-rollback.sql");
const TEST = sqlFile("2026-11-07-payments-owner-read-test.sql");

let ok = 0, bad = 0;
const report = (good, label, extra = "") => { if (good) ok++; else bad++; console.log(`${good ? "✔" : "✘"} ${label}${extra ? "  " + extra : ""}`); };
async function run(label, sql, expectErrorIncludes) {
  try { await db.query(sql); report(!expectErrorIncludes, label); }
  catch (e) {
    await db.query("rollback").catch(() => {});
    report(!!expectErrorIncludes && e.message.includes(expectErrorIncludes), label, e.message.split("\n")[0]);
  }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;

function commentedQueries(text) {
  const out = {}; let label = null, cur = null;
  const flush = () => { if (cur) (out[label] ??= []).push(cur.join("\n")); cur = null; };
  for (const line of text.split("\n")) {
    const head = line.match(/^-- ([A-Z]|\d)\. /);
    if (head) { flush(); label = head[1]; continue; }
    if (cur !== null) {
      if (line.startsWith("-- ") && line.trim() !== "--") { cur.push(line.slice(3)); continue; }
      flush();
    }
    if (/^-- select /.test(line)) cur = [line.slice(3)];
  }
  flush();
  return out;
}
const pre = commentedQueries(MAIN.split("── Change")[0]);
const after = commentedQueries(MAIN.split("── After running")[1]);

const OWNER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", OWNER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SALON_A = "11111111-1111-1111-1111-111111111111", SALON_B = "22222222-2222-2222-2222-222222222222";
/** Rows visible to a role (and signed-in user) under RLS, in a transaction that is always rolled back. */
async function asUser(role, sub, sql) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
      [sub || "", JSON.stringify(sub ? { sub, role } : { role })]);
    await db.query(`set local role ${role}`);
    return (await db.query(sql)).rows;
  } catch (e) { return { error: e.message }; }
  finally { await db.query("rollback"); }
}

try {
  await run("stand-in Supabase schema", readFileSync(join(here, "supabase-mock.sql"), "utf8"));
  await run("payments as live: RLS on, no policy", `
    create table public.payments (
      id uuid primary key default gen_random_uuid(), appointment_id uuid references public.appointments(id) on delete set null,
      stripe_payment_intent_id text not null, amount numeric(10,2) not null, currency text default 'gbp', status text not null,
      deposit_only boolean default false, receipt_email text, created_at timestamptz default now());
    alter table public.payments enable row level security;
    insert into public.appointments (id, salon_id, status) values
      ('a1111111-0000-4000-8000-000000000001', '${SALON_A}', 'confirmed'),
      ('a1111111-0000-4000-8000-000000000002', '${SALON_A}', 'confirmed'),
      ('b2222222-0000-4000-8000-000000000001', '${SALON_B}', 'confirmed');
    insert into public.payments (appointment_id, stripe_payment_intent_id, amount, status, deposit_only) values
      ('a1111111-0000-4000-8000-000000000001', 'pi_a1', 30.00, 'succeeded', true),
      ('a1111111-0000-4000-8000-000000000002', 'pi_a2', 45.50, 'succeeded', false),
      ('a1111111-0000-4000-8000-000000000002', 'pi_a2f', 45.50, 'failed', false),
      ('b2222222-0000-4000-8000-000000000001', 'pi_b1', 20.00, 'succeeded', false),
      (null, 'pi_orphan', 18.00, 'succeeded', false);`);

  // ── before: nobody can read ──
  report((await asUser("authenticated", OWNER_A, "select * from public.payments")).length === 0, "BEFORE: owner A sees 0 payments (RLS on, no policy) — the empty Payments page");

  // ── pre-checks ──
  report((await rows(pre.A[0])).length === 0, "pre-check A: no policy yet");
  report((await rows(pre.A[1]))[0]?.rls_on === true, "pre-check A: RLS on");
  report((await rows(pre.B[0]))[0]?.authenticated_can_select === true, "pre-check B: signed-in users have SELECT on payments");

  // ── the policy ──
  await run("migration", MAIN);
  await run("running it a second time fails (policy already exists)…", MAIN, "already exists");
  report((await rows("select count(*)::int as n from pg_policies where tablename = 'payments'"))[0].n === 1, "…and changes nothing (one policy)");
  const pol = await rows(after["1"][0]);
  report(pol.length === 1 && pol[0].policyname === "payments_owner_read" && pol[0].cmd === "SELECT" && String(pol[0].roles) === "{authenticated}",
    "after-check 1: payments_owner_read, SELECT, {authenticated}", JSON.stringify(pol.map(p => [p.policyname, p.cmd, p.roles])));

  // ── who sees what ──
  const ids = (r) => Array.isArray(r) ? r.map(x => x.stripe_payment_intent_id).sort().join(",") : JSON.stringify(r);
  let r = await asUser("authenticated", OWNER_A, "select stripe_payment_intent_id from public.payments");
  report(ids(r) === "pi_a1,pi_a2,pi_a2f", "owner A sees exactly salon A's 3 payments (succeeded and failed)", ids(r));
  r = await asUser("authenticated", OWNER_B, "select stripe_payment_intent_id from public.payments");
  report(ids(r) === "pi_b1", "owner B sees only salon B's payment", ids(r));
  r = await asUser("authenticated", OWNER_A, "select p.stripe_payment_intent_id from public.payments p join public.appointments a on a.id = p.appointment_id where a.salon_id = '" + SALON_B + "'");
  report(Array.isArray(r) && r.length === 0, "owner A asking for salon B's payments gets none");
  r = await asUser("authenticated", OWNER_A, "select p.appointment_id, p.amount from public.payments p join public.appointments a on a.id = p.appointment_id where a.salon_id = '" + SALON_A + "' and p.status = 'succeeded'");
  report(Array.isArray(r) && r.length === 2 && r.map(x => Number(x.amount)).sort((x, y) => x - y).join(",") === "30,45.5", "the app's query (salon A, succeeded) gives the real amounts £30 and £45.50", JSON.stringify(r));
  r = await asUser("authenticated", "cccccccc-cccc-cccc-cccc-cccccccccccc", "select * from public.payments");
  report(Array.isArray(r) && r.length === 0, "another signed-in user (owns no salon) sees 0");
  r = await asUser("anon", null, "select * from public.payments");
  report(Array.isArray(r) && r.length === 0, "the public (anon) sees 0");
  r = await asUser("authenticated", OWNER_A, "select * from public.payments where appointment_id is null");
  report(Array.isArray(r) && r.length === 0, "a payment linked to no booking is visible to nobody");
  for (const [what, sql] of [
    ["insert", "insert into public.payments (stripe_payment_intent_id, amount, status) values ('pi_x', 1, 'succeeded') returning id"],
    ["update", "update public.payments set amount = 0 returning id"],
    ["delete", "delete from public.payments returning id"],
  ]) {
    const res = await asUser("authenticated", OWNER_A, sql);
    report(res.error?.includes("row-level security") || (Array.isArray(res) && res.length === 0), `owner A can't ${what} payments`, res.error ? res.error.slice(0, 60) : `${res.length} rows`);
  }
  report((await rows("select count(*)::int as n, sum(amount)::text as s from public.payments"))[0].n === 5, "no payment was changed by any of that");

  // ── the self-undoing test file ──
  await run("self-undoing test file", TEST, "PAYMENTS READ TEST: passed. The owner sees 3 of their salon's 3 payments, another signed-in user sees 0, the public sees 0. Nothing was saved.");

  // ── rollback ──
  await run("rollback", ROLLBACK);
  report((await rows("select policyname from pg_policies where tablename = 'payments'")).length === 0, "after rollback: no policy");
  report((await asUser("authenticated", OWNER_A, "select * from public.payments")).length === 0, "after rollback: owner A sees 0 again");
  await run("the policy again after rollback", MAIN);
  await run("self-undoing test file again", TEST, "PAYMENTS READ TEST: passed.");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
