/**
 * Tests for sql/2026-11-09-reminders-every-15-min*.sql on a throwaway LOCAL Postgres 17 — never Supabase.
 * Uses booking-mock.sql (salons, appointments) and cron-mock.sql (stand-ins for pg_cron, pg_net and
 * Vault with the same names and arguments), plus the reminder flag columns as live.
 *
 * Checks the pre-checks (D counts exactly what the app's windows would send), the file (job, secret,
 * trigger), the job's request, the after-checks, the self-undoing trigger test, a wrong schema (missing
 * column → nothing changed), a re-run and the rollback.
 *
 * Not part of `npm test` (it downloads a Postgres build). To run:
 *   npm install --prefix /tmp/booking-db-deps embedded-postgres@17.10.0-beta.17 pg@8.23.0
 *   DB_TEST_DEPS=/tmp/booking-db-deps node scripts/db-tests/reminders-db-test.mjs
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

const PORT = 54339;
const dataDir = mkdtempSync(join(tmpdir(), "reminders-db-test-"));
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORT, persistent: false, onLog: () => {} });
await server.initialise();
await server.start();
const db = new pg.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres" });
await db.connect();

const MAIN = readFileSync(join(repo, "sql", "2026-11-09-reminders-every-15-min.sql"), "utf8");
const ROLLBACK = readFileSync(join(repo, "sql", "2026-11-09-reminders-every-15-min-rollback.sql"), "utf8");
const TEST = readFileSync(join(repo, "sql", "2026-11-09-reminders-every-15-min-test.sql"), "utf8");

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
const afterRollback = commentedQueries(ROLLBACK.split("After running")[1].replace(/^-- select/gm, "-- 9. x\n-- select"));

const FLAGS = ["reminder_24h_sent", "reminder_2h_sent", "whatsapp_24h_sent", "whatsapp_2h_sent", "thankyou_1h_sent", "no_show_alert_sent", "winback_sent"];
const SALON = "11111111-1111-1111-1111-111111111111";
let n = 0;
const add = (status, startOffset, createdOffset, extra = {}) => {
  n++;
  const id = `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const cols = ["id", "salon_id", "status", "date_time", "created_at", ...Object.keys(extra)];
  const vals = [id, SALON, status, startOffset, createdOffset, ...Object.values(extra)];
  return db.query(`insert into public.appointments (${cols.join(", ")}) values ($1, $2, $3, now() + $4::interval, now() + $5::interval${Object.keys(extra).map((_, i) => `, $${i + 6}`).join("")})`, vals);
};

try {
  await run("stand-in Supabase tables", readFileSync(join(here, "booking-mock.sql"), "utf8"));
  await run("stand-in pg_cron / pg_net / Vault", readFileSync(join(here, "cron-mock.sql"), "utf8"));
  await run("salons.reminders_enabled as live", "alter table public.salons add column reminders_enabled boolean default true");

  // a wrong schema first: a flag column missing → the file stops and changes nothing
  await run("reminder flags, except no_show_alert_sent", FLAGS.filter(f => f !== "no_show_alert_sent").map(f => `alter table public.appointments add column ${f} boolean not null default false;`).join("\n"));
  await run("the file stops when a flag column is missing…", MAIN, "missing a reminder flag column");
  report((await rows("select count(*)::int as n from cron.job"))[0].n === 0 && (await rows("select count(*)::int as n from vault.secrets"))[0].n === 0
    && (await rows("select 1 from pg_proc where proname = 'appointments_reset_reminders_on_reschedule'")).length === 0, "…and nothing was changed (no job, secret or trigger)");
  await run("no_show_alert_sent as live", "alter table public.appointments add column no_show_alert_sent boolean not null default false");

  // bookings for pre-check D: each line one case
  await add("confirmed", "10 hours", "-3 days");                 // 24h: due
  await add("confirmed", "10 hours", "-1 hour");                 // 24h: booked 11h ahead → no 24h (2h later)
  await add("confirmed", "30 hours", "-3 days");                 // too far
  await add("confirmed", "1 hour", "-3 days");                   // 2h: due
  await add("confirmed", "1 hour", "-30 minutes");               // 2h: booked 1.5h ahead → none
  await add("confirmed", "10 minutes", "-3 days");               // too close for the 2h
  await add("completed", "-3 hours", "-3 days");                 // thank-you
  await add("completed", "-30 hours", "-3 days");                // thank-you: too old
  await add("confirmed", "-2 hours", "-3 days");                 // no-show alert
  await add("confirmed", "-20 hours", "-3 days");                // no-show: too old
  await add("confirmed", "-42 days -12 hours", "-50 days");      // win-back
  await add("confirmed", "-60 days", "-70 days");                // win-back: too old
  await add("pending", "10 hours", "-3 days");                   // not confirmed → nothing
  await add("confirmed", "10 hours", "-3 days", { reminder_24h_sent: true }); // already sent
  await add("cancelled", "1 hour", "-3 days");                   // cancelled → nothing

  for (const k of ["A", "B", "C", "D", "E", "F"]) report(!!pre[k], `pre-check ${k} found in the file`);
  await rows(pre.A[0]); report(true, "pre-check A runs");
  let r = await rows(pre.B[0]);
  report(r.length === 9 && r.filter(x => x.data_type === "boolean" && x.column_default === "false").length === 7, "pre-check B: 9 columns, 7 boolean flags default false", JSON.stringify(r.map(x => x.column_name)));
  r = await rows(pre.C[0]); report(Array.isArray(r), `pre-check C runs (${r.length} triggers today)`);
  r = await rows(pre.D[0]);
  const d = Object.fromEntries(r.map(x => [x.message, Number(x.bookings)]));
  report(JSON.stringify(d) === JSON.stringify({ "1 24h reminder": 1, "2 2h reminder": 1, "3 thank-you": 1, "4 no-show alert (owner)": 1, "5 win-back email": 1 }),
    "pre-check D counts exactly one booking per message (same windows as the app)", JSON.stringify(d));
  await db.query("update public.salons set reminders_enabled = false");
  report((await rows(pre.D[0])).length === 0, "pre-check D: salon with reminders off → nothing");
  await db.query("update public.salons set reminders_enabled = true");
  report((await rows(pre.E[0])).length === 0, "pre-check E: no job yet");
  report((await rows(pre.F[0])).length === 0, "pre-check F: no secret yet");

  // ── the file ─────────────────────────────────────────────────────────────
  await run("migration", MAIN);
  const jobs = await rows("select jobname, schedule, active, command from cron.job");
  report(jobs.length === 1 && jobs[0].jobname === "send-reminders" && jobs[0].schedule === "*/15 * * * *" && jobs[0].active, "one job: send-reminders, every 15 minutes, active");
  const secrets = await rows("select name, secret from vault.secrets");
  report(secrets.length === 1 && secrets[0].name === "reminders_cron_secret" && /^[0-9a-f]{64}$/.test(secrets[0].secret), "one Vault secret: 64 random hex characters");
  const secret = secrets[0]?.secret;
  await db.query(jobs[0].command);
  let req = (await rows("select * from net.http_request_queue order by id desc limit 1"))[0];
  report(req?.method === "POST" && req.url === "https://featuresalon.co.uk/api/send-reminder", "the job POSTs to https://featuresalon.co.uk/api/send-reminder", req?.url);
  report(req?.headers?.Authorization === `Bearer ${secret}` && !req.url.includes(secret), "secret in the Authorization header, not in the URL");
  report(JSON.stringify(req?.body) === "{}" && req?.timeout_milliseconds === 60000, "empty body (a real run), 60 s timeout");
  report(!jobs[0].command.includes(secret), "the secret is not written into the job (read from Vault at each run)");

  // ── the trigger ──────────────────────────────────────────────────────────
  const id = "b0000000-0000-4000-8000-000000000001";
  await db.query(`update public.appointments set ${FLAGS.map(f => `${f} = true`).join(", ")} where id = $1`, [id]);
  await db.query("update public.appointments set notes = 'x', status = 'confirmed' where id = $1", [id]);
  r = (await rows("select * from public.appointments where id = $1", [id]))[0];
  report(FLAGS.every(f => r[f] === true), "changing notes / status keeps every flag");
  await db.query("update public.appointments set date_time = date_time where id = $1", [id]);
  r = (await rows("select * from public.appointments where id = $1", [id]))[0];
  report(FLAGS.every(f => r[f] === true), "saving the same date/time keeps every flag");
  await db.query("update public.appointments set date_time = date_time + interval '2 days' where id = $1", [id]);
  r = (await rows("select * from public.appointments where id = $1", [id]))[0];
  report(!r.reminder_24h_sent && !r.reminder_2h_sent && !r.whatsapp_24h_sent && !r.whatsapp_2h_sent && !r.no_show_alert_sent, "a new date/time makes 24h, 2h (and their WhatsApp) and no-show due again");
  report(r.thankyou_1h_sent === true && r.winback_sent === true, "…thank-you and win-back stay sent");

  // ── after-checks ─────────────────────────────────────────────────────────
  for (const k of ["1", "2", "3", "4", "5"]) report(!!after[k], `after-check ${k} found in the file`);
  r = await rows(after["1"][0]);
  report(r.length === 1 && r[0].decrypted_secret === secret, "after-check 1 shows the secret (for Vercel)");
  r = await rows(after["2"][0]);
  req = (await rows("select * from net.http_request_queue where id = $1", [r[0].request_id]))[0];
  report(JSON.stringify(req?.body) === '{"dry_run":true}' && req?.headers?.Authorization === `Bearer ${secret}` && req.url === "https://featuresalon.co.uk/api/send-reminder", "after-check 2 sends a dry run with the secret");
  await db.query("insert into net._http_response (id, status_code, content) values ($1, 200, $2)", [r[0].request_id, '{"dryRun":true,"checkedAt":"x"}']);
  r = await rows(after["2"][1].replace("<the request_id from above>", String(r[0].request_id)));
  report(r[0]?.status_code === 200, "after-check 2 second line runs (with the number filled in)");
  await db.query("insert into cron.job_run_details (jobid, status, start_time) select jobid, 'succeeded', now() from cron.job");
  r = await rows(after["3"][0]);
  report(r.length === 1 && r[0].active === true && r[0].status === "succeeded" && r[0].schedule === "*/15 * * * *", "after-check 3 shows the job and its runs");
  await db.query(`insert into net._http_response (id, status_code, content) values (900, 200, '{"dryRun":false,"checkedAt":"y","sent":{}}'), (901, 500, '{"error":"REMINDERS_CRON_SECRET is not set"}'), (902, 200, '{"other":1}')`);
  r = await rows(after["4"][0]);
  report(r.length === 3 && r.some(x => x.status_code === 500) && !r.some(x => x.content.includes('"other"')), "after-check 4 shows the job's answers (incl. 'not set'), not other pg_net traffic", JSON.stringify(r.map(x => x.status_code)));
  r = await rows(after["5"][0]);
  report(r.length === 1 && r[0].action_timing === "BEFORE" && r[0].event_manipulation === "UPDATE", "after-check 5: the trigger is on");

  await run("self-undoing trigger test", TEST, "REMINDER TRIGGER TEST: 3 passed, 0 failed. Nothing was saved.");
  r = (await rows("select * from public.appointments order by created_at desc limit 1"))[0];
  report(r.notes === null && FLAGS.every(f => r[f] === false || f === "reminder_24h_sent"), "…and it saved nothing");

  // ── re-run, rollback ─────────────────────────────────────────────────────
  await run("running the file a second time fails and changes nothing", MAIN, "already exists");
  report((await rows("select count(*)::int as n from cron.job"))[0].n === 1, "…still one job");
  await run("rollback", ROLLBACK);
  report((await rows("select count(*)::int as n from cron.job"))[0].n === 0, "after rollback: no job");
  report((await rows("select count(*)::int as n from vault.secrets"))[0].n === 0, "after rollback: no secret");
  report((await rows("select 1 from pg_proc where proname = 'appointments_reset_reminders_on_reschedule'")).length === 0, "after rollback: no trigger function");
  const rbChecks = afterRollback["9"] ?? [];
  report(rbChecks.length === 3, "rollback file has 3 after-checks");
  for (const q of rbChecks) report((await rows(q)).length === 0, `rollback after-check: 0 rows (${q.split("\n")[0].slice(0, 50)}…)`);
  await db.query("update public.appointments set reminder_24h_sent = true, date_time = date_time + interval '1 day' where id = $1", [id]);
  r = (await rows("select reminder_24h_sent from public.appointments where id = $1", [id]))[0];
  report(r.reminder_24h_sent === true, "after rollback: time changes no longer reset flags");
  await run("the file again after rollback", MAIN);
  await run("self-undoing trigger test again", TEST, "REMINDER TRIGGER TEST: 3 passed, 0 failed.");
} finally {
  await db.end();
  await server.stop();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log(`\n${ok} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
