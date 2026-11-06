/**
 * Tests for sql/2026-11-06-expire-pending-bookings*.sql on a throwaway LOCAL
 * Postgres 17 — never Supabase. pg_cron, pg_net and Vault are stand-ins
 * (scripts/db-tests/cron-mock.sql), the tables come from
 * scripts/db-tests/booking-mock.sql.
 *
 * Runs every pre-check and after-check query, the file, a re-run (must fail
 * and change nothing), the rollback and the file again — and runs the job's
 * command the way pg_cron would, to check the request it sends: the right URL,
 * "Bearer <the Vault secret>", an empty body, a 30 s timeout.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node scripts/db-tests/expire-pending-db-test.mjs
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

const PORT = 54332;
const dataDir = mkdtempSync(join(tmpdir(), "expire-pending-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const MAIN = readFileSync(join(repo, "sql", "2026-11-06-expire-pending-bookings.sql"), "utf8");
const ROLLBACK = readFileSync(join(repo, "sql", "2026-11-06-expire-pending-bookings-rollback.sql"), "utf8");

let ok = 0, bad = 0;
const report = (good, label, extra = "") => { if (good) ok++; else bad++; console.log(`${good ? "✔" : "✘"} ${label}${extra ? "  " + extra : ""}`); };
async function run(label, sql, expectErrorIncludes) {
  try {
    await db.query(sql);
    report(!expectErrorIncludes, label);
  } catch (e) {
    await db.query("rollback").catch(() => {});
    report(!!expectErrorIncludes && e.message.includes(expectErrorIncludes), label, e.message.split("\n")[0]);
  }
}
const rows = async (sql, params) => (await db.query(sql, params)).rows;

/** The commented-out queries in a SQL file, by their "A." / "1." label (several per label kept apart). */
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
const afterRollback = commentedQueries(ROLLBACK.split("After running")[1]);

try {
  await run("stand-in Supabase tables", readFileSync(join(here, "booking-mock.sql"), "utf8"));
  await run("stand-in pg_cron / pg_net / Vault", readFileSync(join(here, "cron-mock.sql"), "utf8"));

  // ── pre-checks: each runs; C and D see the right bookings ─────────────────
  const SALON = "11111111-1111-1111-1111-111111111111", CUT = "11111111-0000-0000-0000-000000000001";
  const add = (id, st, ps, pi, ageMin, dayOffset = 10) => db.query(
    "insert into public.appointments (id, salon_id, service_id, status, payment_status, payment_intent_id, created_at, date_time) " +
    "values ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval, now() + ($8 || ' days')::interval)",
    [id, SALON, CUT, st, ps, pi, String(ageMin), String(dayOffset)]);
  await add("a0000000-0000-4000-8000-000000000001", "pending", "pending", "pi_old", 45);       // C: would be released
  await add("a0000000-0000-4000-8000-000000000002", "pending", "failed", "pi_failed", 90);     // C: would be released
  await add("a0000000-0000-4000-8000-000000000003", "pending", "pending", "pi_new", 10);       // too new
  await add("a0000000-0000-4000-8000-000000000004", "pending", "pending", null, 600);          // D: no PaymentIntent (owner-made or old)
  await add("a0000000-0000-4000-8000-000000000005", "pending", "pay_at_salon", null, 600);     // pay at salon (rescheduled)
  await add("a0000000-0000-4000-8000-000000000006", "confirmed", "deposit_paid", "pi_paid", 600);
  for (const k of ["A", "B", "C", "D", "E", "F"]) report(!!pre[k], `pre-check ${k} found in the file`);
  await rows(pre.A[0]); report(true, "pre-check A runs");
  let r = await rows(pre.B[0]);
  report(r.length === 5, "pre-check B: 5 columns", JSON.stringify(r.map(x => `${x.column_name}:${x.data_type}:${x.column_default ?? ""}`)));
  r = await rows(pre.C[0]);
  report(JSON.stringify(r.map(x => x.payment_intent_id)) === '["pi_failed","pi_old"]', "pre-check C lists exactly the 2 bookings the first run would release", JSON.stringify(r.map(x => x.payment_intent_id)));
  r = await rows(pre.D[0]);
  report(r.length === 1 && Number(r[0].pending_unpaid_future) === 1, "pre-check D counts the pending booking with no PaymentIntent (not pay-at-salon, not paid)", JSON.stringify(r));
  report((await rows(pre.E[0])).length === 0, "pre-check E: no job yet");
  report((await rows(pre.F[0])).length === 0, "pre-check F: no secret yet");

  // ── the file ───────────────────────────────────────────────────────────────
  await run("migration", MAIN);
  const jobs = await rows("select jobname, schedule, active, command from cron.job");
  report(jobs.length === 1 && jobs[0].jobname === "expire-pending-bookings" && jobs[0].schedule === "*/5 * * * *" && jobs[0].active,
    "one job: expire-pending-bookings, every 5 minutes, active");
  const secrets = await rows("select name, secret from vault.secrets");
  report(secrets.length === 1 && /^[0-9a-f]{64}$/.test(secrets[0].secret), "one Vault secret: 64 random hex characters");
  const secret = secrets[0]?.secret;

  // run the job's command the way pg_cron does
  await db.query(jobs[0].command);
  let req = (await rows("select * from net.http_request_queue order by id desc limit 1"))[0];
  report(req?.method === "POST" && req.url === "https://featuresalon.co.uk/api/cron/expire-pending-bookings", "the job POSTs to https://featuresalon.co.uk/api/cron/expire-pending-bookings", req?.url);
  report(req?.headers?.Authorization === `Bearer ${secret}` && req?.headers?.["Content-Type"] === "application/json", "with Authorization: Bearer <the Vault secret>");
  report(JSON.stringify(req?.body) === "{}" && req?.timeout_milliseconds === 30000, "empty body (a real run, not a dry run), 30 s timeout");
  report(!jobs[0].command.includes(secret), "the secret is not written into the job (read from Vault at each run)");

  // ── after-checks ───────────────────────────────────────────────────────────
  for (const k of ["1", "2", "3", "4"]) report(!!after[k], `after-check ${k} found in the file`);
  r = await rows(after["1"][0]);
  report(r.length === 1 && r[0].decrypted_secret === secret, "after-check 1 shows the secret (for Vercel)");
  r = await rows(after["2"][0]);
  req = (await rows("select * from net.http_request_queue where id = $1", [r[0].request_id]))[0];
  report(JSON.stringify(req?.body) === '{"dry_run":true}' && req?.headers?.Authorization === `Bearer ${secret}`, "after-check 2 sends a dry run with the secret");
  report(after["2"][1]?.includes("net._http_response where id ="), "after-check 2 then reads that request's answer");
  await db.query("insert into net._http_response (id, status_code, content) values ($1, 200, $2)", [r[0].request_id, '{"dryRun":true,"due":0}']);
  r = await rows(after["2"][1].replace("<the request_id from above>", String(r[0].request_id)));
  report(r[0]?.status_code === 200, "after-check 2 second line runs (with the number filled in)");
  await db.query("insert into cron.job_run_details (jobid, status, start_time) select jobid, 'succeeded', now() from cron.job");
  r = await rows(after["3"][0]);
  report(r.length === 1 && r[0].active === true && r[0].status === "succeeded", "after-check 3 shows the job and its runs", JSON.stringify(r));
  await db.query("insert into net._http_response (id, status_code, content) values (99, 200, '{\"dryRun\":false,\"due\":0,\"bookingsCancelled\":0}'), (100, 401, '{\"error\":\"Unauthorized\"}'), (101, 200, '{\"other\":1}')");
  r = await rows(after["4"][0]);
  report(r.length === 2 && r.some(x => x.status_code === 401), "after-check 4 shows the job's answers (incl. 401), not other pg_net traffic", JSON.stringify(r.map(x => x.status_code)));

  // ── re-run, rollback ───────────────────────────────────────────────────────
  await run("running the file a second time fails (the secret already exists)…", MAIN, "duplicate key");
  report((await rows("select count(*)::int as n from cron.job"))[0].n === 1 && (await rows("select count(*)::int as n from vault.secrets"))[0].n === 1,
    "…and changes nothing (still one job, one secret)");
  await run("rollback", ROLLBACK);
  for (const q of afterRollback["null"] ?? Object.values(afterRollback).flat()) report((await rows(q)).length === 0, `after rollback: ${q.split(" from ")[1].split(" where")[0]} is empty`);
  await run("rollback a second time fails (nothing to remove) and changes nothing", ROLLBACK, "could not find valid entry");
  await run("the file again after rollback", MAIN);
  report((await rows("select count(*)::int as n from cron.job"))[0].n === 1, "job back");
  r = await rows("select count(*)::int as n from public.appointments where status = 'cancelled'");
  report(r[0].n === 0, "the SQL itself never touches a booking (the app does the work)");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
