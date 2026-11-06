-- Stand-ins for the Supabase extensions sql/2026-11-06-expire-pending-bookings*.sql
-- uses: pg_cron (cron.schedule / cron.unschedule / cron.job / cron.job_run_details),
-- pg_net (net.http_post / net._http_response) and Vault (vault.create_secret /
-- vault.secrets / vault.decrypted_secrets) — same names, arguments and the
-- behaviour the SQL relies on. net.http_post only records the request.
-- Used only by scripts/db-tests/expire-pending-db-test.mjs on a throwaway local
-- Postgres — never run this against Supabase.

create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text not null, command text not null, active boolean not null default true);
create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, return_message text, start_time timestamptz);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $f$
declare v_id bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v_id;
  return v_id;
end $f$;
create function cron.unschedule(job_name text) returns boolean language plpgsql as $f$
begin
  delete from cron.job where jobname = job_name;
  if not found then raise exception 'could not find valid entry for job ''%''', job_name; end if;
  return true;
end $f$;

create schema net;
create table net.http_request_queue (id bigserial primary key, method text, url text, headers jsonb, body jsonb, timeout_milliseconds int);
create table net._http_response (id bigint, status_code int, content text, created timestamptz default now());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                              headers jsonb default '{"Content-Type": "application/json"}', timeout_milliseconds int default 5000)
returns bigint language plpgsql as $f$
declare v_id bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, body, timeout_milliseconds) returning id into v_id;
  return v_id;
end $f$;

create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text not null);
create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language plpgsql as $f$
declare v_id uuid;
begin
  insert into vault.secrets (name, description, secret) values (new_name, new_description, new_secret) returning id into v_id;
  return v_id;
end $f$;
