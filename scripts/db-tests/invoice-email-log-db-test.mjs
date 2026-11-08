/**
 * Tests for sql/2026-11-09-invoice-email-log*.sql on a throwaway LOCAL Postgres 17 — never Supabase.
 * Uses the stand-in schema scripts/db-tests/supabase-mock.sql (roles, auth.uid(), salons, Supabase-like
 * grants) plus a stand-in invoices table.
 *
 * Runs the pre-checks, the file, a re-run (must fail and change nothing), the after-checks, the
 * self-undoing test file and the rollback — and checks that only the server can use the log: a
 * signed-in owner or the public can't read, add, change or delete rows.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node scripts/db-tests/invoice-email-log-db-test.mjs
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

const PORT = 54338;
const dataDir = mkdtempSync(join(tmpdir(), "invoice-log-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const sqlFile = (f) => readFileSync(join(repo, "sql", f), "utf8");
const MAIN = sqlFile("2026-11-09-invoice-email-log.sql");
const ROLLBACK = sqlFile("2026-11-09-invoice-email-log-rollback.sql");
const TEST = sqlFile("2026-11-09-invoice-email-log-test.sql");

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

const OWNER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SALON_A = "11111111-1111-1111-1111-111111111111";
async function as(role, sub, sql) {
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
  await run("salons get created_at as live", "alter table public.salons add column created_at timestamptz default now()");
  await run("stand-in invoices table", `create table public.invoices (id uuid primary key default gen_random_uuid(), salon_id uuid references public.salons(id),
    invoice_number text, client_name text, client_email text, items jsonb, subtotal numeric, tax_rate numeric, tax_amount numeric, total numeric,
    due_date date, notes text, status text, created_at timestamptz default now());
    insert into public.invoices (salon_id, invoice_number) values ('${SALON_A}', 'INV-1'), ('${SALON_A}', 'INV-2');`);

  report((await rows(pre.A[0]))[0]?.already_there === null, "pre-check A: no table yet");
  report((await rows(pre.B[0])).length === 13, "pre-check B: invoices has the 13 columns the code reads");
  const preC = await rows(pre.C[0]);
  report(preC.length === 1 && Number(preC[0].invoices_30_days) === 2, "pre-check C: invoice counts per salon", JSON.stringify(preC));

  await run("the file", MAIN);
  await run("running it a second time fails and changes nothing", MAIN, "already exists");

  report((await rows(after["1"][0]))[0]?.created === "invoice_email_log", "after-check 1: the table is there");
  let a2 = await rows(after["2"][0]);
  report(a2.length === 1 && a2[0].rls_on === true && Number(a2[0].policies) === 0, "after-check 2: RLS on, no policies", JSON.stringify(a2));
  report((await rows(after["3"][0])).length === 0, "after-check 3: no grants for anon / authenticated");

  // who can use it
  let x = await as("authenticated", OWNER_A, "select * from public.invoice_email_log");
  report(/permission denied/.test(x.error || ""), "an owner can't read the log", JSON.stringify(x));
  x = await as("authenticated", OWNER_A, `insert into public.invoice_email_log (salon_id, invoice_id, status) values ('${SALON_A}', 'x', 'sent')`);
  report(/permission denied/.test(x.error || ""), "an owner can't add rows", JSON.stringify(x));
  await db.query(`insert into public.invoice_email_log (salon_id, invoice_id, status) values ('${SALON_A}', 'inv', 'sent')`);
  x = await as("authenticated", OWNER_A, `delete from public.invoice_email_log`);
  report(/permission denied/.test(x.error || ""), "an owner can't delete rows (reset the count)", JSON.stringify(x));
  x = await as("authenticated", OWNER_A, `update public.invoice_email_log set status = 'failed'`);
  report(/permission denied/.test(x.error || ""), "an owner can't change rows", JSON.stringify(x));
  x = await as("anon", null, "select * from public.invoice_email_log");
  report(/permission denied/.test(x.error || ""), "the public can't read it", JSON.stringify(x));
  x = await as("service_role", null, `insert into public.invoice_email_log (salon_id, invoice_id, status) values ('${SALON_A}', 'y', 'sending') returning id`);
  report(!x.error && x.rows === 1, "the server (service role) can write", JSON.stringify(x));
  x = await as("service_role", null, `insert into public.invoice_email_log (salon_id, invoice_id, status) values ('${SALON_A}', 'y', 'bogus')`);
  report(/check constraint/.test(x.error || ""), "status must be sending / sent / failed / refused", JSON.stringify(x));
  await db.query("delete from public.invoices where invoice_number = 'INV-1'");
  report(Number((await rows("select count(*) from public.invoice_email_log"))[0].count) === 1, "deleting an invoice doesn't delete its log rows (count can't be reset)");

  await run("self-undoing test file", TEST, "INVOICE EMAIL LOG TEST: 4 passed, 0 failed. Nothing was saved.");
  report(Number((await rows("select count(*) from public.invoice_email_log"))[0].count) === 1, "…and it saved nothing");

  await run("rollback", ROLLBACK);
  report((await rows(pre.A[0]))[0]?.already_there === null, "after rollback: no table");
  await run("the file again after rollback", MAIN);
  await run("self-undoing test file again", TEST, "INVOICE EMAIL LOG TEST: 4 passed, 0 failed.");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
