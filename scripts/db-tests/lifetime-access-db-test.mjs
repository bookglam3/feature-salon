/**
 * Tests for sql/2026-11-08-lifetime-access*.sql on a throwaway LOCAL Postgres 17 — never Supabase.
 * Uses the stand-in schema scripts/db-tests/supabase-mock.sql (roles, auth.uid(), salons with the owner
 * policies and the salons_guard_sensitive_columns trigger as live, two salons).
 *
 * Runs the pre-checks, the file (with a slug filled in), a wrong slug (must change nothing), a re-run,
 * the after-checks, the self-undoing test file and the rollback — and checks who can set the flag:
 * never a signed-in owner or the public, always the server / SQL editor and a super admin.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node scripts/db-tests/lifetime-access-db-test.mjs
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

const PORT = 54336;
const dataDir = mkdtempSync(join(tmpdir(), "lifetime-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const sqlFile = (f) => readFileSync(join(repo, "sql", f), "utf8");
const RAW = sqlFile("2026-11-08-lifetime-access.sql");
const MAIN = RAW.replace("'<lifetime-salon-slug>';\n\n-- Stop", "'other-salon';\n\n-- Stop");
const ROLLBACK = sqlFile("2026-11-08-lifetime-access-rollback.sql");
const TEST = sqlFile("2026-11-08-lifetime-access-test.sql");

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
const pre = commentedQueries(RAW.split("── Change")[0]);
const after = commentedQueries(RAW.split("── After running")[1]);

const OWNER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", OWNER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SALON_A = "11111111-1111-1111-1111-111111111111", SALON_B = "22222222-2222-2222-2222-222222222222";
async function asUser(role, sub, sql) {
  await db.query("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [sub || "", JSON.stringify(sub ? { sub, role } : { role })]);
    await db.query(`set local role ${role}`);
    const r = await db.query(sql);
    return { rows: r.rowCount };
  } catch (e) { return { error: e.message }; }
  finally { await db.query("rollback"); }
}

try {
  await run("stand-in Supabase schema", readFileSync(join(here, "supabase-mock.sql"), "utf8"));
  await run("salons get created_at as live", "alter table public.salons add column created_at timestamptz default now(); update public.salons set created_at = now() - interval '1 day' where id = '11111111-1111-1111-1111-111111111111'");

  report((await rows(pre.A[0])).length === 0, "pre-check A: no lifetime_access column yet");
  report((await rows(pre.B[0].replace("<lifetime-salon-slug>", "other-salon"))).length === 1, "pre-check B: the slug matches exactly one salon");
  report((await rows(pre.C[0])).length === 1, "pre-check C: is_super_admin() exists");

  await run("the file with a wrong slug stops and changes nothing…", RAW.replace("'<lifetime-salon-slug>';\n\n-- Stop", "'no-such-salon';\n\n-- Stop"), "Expected exactly one salon with lifetime_access");
  report((await rows(pre.A[0])).length === 0, "…no column was left behind");
  await run("the file (lifetime salon = other-salon)", MAIN);
  await run("running it a second time fails (column already exists) and changes nothing", MAIN, "already exists");

  let r = await rows(after["1"][0]);
  report(r.length === 1 && r[0].data_type === "boolean" && r[0].is_nullable === "NO" && r[0].column_default === "false", "after-check 1: boolean, not null, default false", JSON.stringify(r));
  r = await rows(after["2"][0]);
  report(r.length === 1 && r[0].slug === "other-salon", "after-check 2: exactly one salon has it, the right one", JSON.stringify(r));
  r = await rows(after["3"][0]);
  report(r.length === 1 && r[0].action_timing === "BEFORE" && r[0].events === "INSERT, UPDATE", "after-check 3: the guard trigger is on", JSON.stringify(r));

  // who can set it
  let x = await asUser("authenticated", OWNER_A, `update public.salons set lifetime_access = true where id = '${SALON_A}'`);
  report(/Not allowed to change: lifetime_access/.test(x.error || ""), "an owner can't give their own salon lifetime access", JSON.stringify(x));
  x = await asUser("authenticated", OWNER_B, `update public.salons set lifetime_access = false where id = '${SALON_B}'`);
  report(/Not allowed to change: lifetime_access/.test(x.error || ""), "the lifetime owner can't change it either", JSON.stringify(x));
  x = await asUser("authenticated", OWNER_A, `update public.salons set name = 'Renamed' where id = '${SALON_A}'`);
  report(x.rows === 1, "owners can still update ordinary fields of their salon", JSON.stringify(x));
  x = await asUser("authenticated", OWNER_B, `update public.salons set name = 'Renamed' where id = '${SALON_B}'`);
  report(x.rows === 1, "…including the lifetime salon's owner", JSON.stringify(x));
  await db.query(`create policy "test owner insert" on public.salons for insert to authenticated with check (owner_id = auth.uid())`);
  x = await asUser("authenticated", OWNER_A, `insert into public.salons (owner_id, slug, name, lifetime_access) values ('${OWNER_A}', 'branch-2', 'Branch', true)`);
  report(/Not allowed to set: lifetime_access/.test(x.error || ""), "an owner can't create a (branch) salon with lifetime access", JSON.stringify(x));
  x = await asUser("authenticated", OWNER_A, `insert into public.salons (owner_id, slug, name) values ('${OWNER_A}', 'branch-3', 'Branch')`);
  report(x.rows === 1, "…but can create one without it (default false)", JSON.stringify(x));
  x = await asUser("anon", null, `update public.salons set lifetime_access = true`);
  report(x.error || x.rows === 0, "the public can't set it", JSON.stringify(x));
  await db.query("create or replace function public.is_super_admin() returns boolean language sql stable as $f$ select true $f$");
  x = await asUser("authenticated", OWNER_A, `update public.salons set lifetime_access = true where id = '${SALON_A}'`);
  report(!x.error && x.rows === 1, "a super admin passes the guard (changes it, then rolled back)", JSON.stringify(x));
  await db.query("create or replace function public.is_super_admin() returns boolean language sql stable as $f$ select false $f$");
  await db.query("begin"); await db.query(`update public.salons set lifetime_access = true where id = '${SALON_A}'`); await db.query("rollback");
  report(true, "the server / SQL editor (postgres) can change it");
  report((await rows("select count(*)::int as n from public.salons where lifetime_access"))[0].n === 1, "still exactly one lifetime salon after all of that");

  await run("self-undoing test file", TEST, "LIFETIME ACCESS TEST: 4 passed, 0 failed. Nothing was saved.");

  await run("rollback", ROLLBACK);
  report((await rows(pre.A[0])).length === 0, "after rollback: no column");
  report((await rows("select 1 from pg_proc where proname = 'salons_guard_lifetime_access'")).length === 0, "after rollback: no guard function");
  x = await asUser("authenticated", OWNER_A, `update public.salons set name = 'Again' where id = '${SALON_A}'`);
  report(x.rows === 1, "after rollback: owners update their salon as before", JSON.stringify(x));
  await run("the file again after rollback", MAIN);
  await run("self-undoing test file again", TEST, "LIFETIME ACCESS TEST: 4 passed, 0 failed.");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
