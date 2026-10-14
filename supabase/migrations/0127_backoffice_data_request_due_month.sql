-- =============================================================================
-- 0127_backoffice_data_request_due_month
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, after commit 8. The deadline of a data subject request (15 RG73;
-- GDPR and UK GDPR art. 12(3): ONE CALENDAR MONTH after receipt), decision of
-- expert-conformite-rgpd on 2026-10-14: "received + 30 days" (0120) overshoots the
-- legal month when the month is shorter (received on 31 January: 2 March instead of
-- 28 February). Until 0502 writes the month itself, due_at is the EARLIER of the two:
--
--   due_at = least(received_at + 720 hours,
--                  (received_at in UTC + 1 month) back to UTC)
--
-- computed in UTC (PostgreSQL clamps 31 January + 1 month to 28 or 29 February),
-- independent of the session time zone. Never later than the legal month, never
-- later than the 30 days announced so far.
--
-- ROLLBACK (before any real request): restore the 0120 trigger function
-- backoffice.prepare_data_subject_request() and the CHECK data_subject_requests_due
-- (due_at = received_at + interval '720 hours').
-- =============================================================================

create or replace function backoffice.prepare_data_subject_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.received_at  := pg_catalog.now();
  new.due_at       := least(pg_catalog.now() + interval '720 hours',
                            ((pg_catalog.now() at time zone 'UTC') + interval '1 month')
                              at time zone 'UTC');
  new.created_at   := pg_catalog.now();
  new.updated_at   := pg_catalog.now();
  new.status       := 'received';
  new.completed_at := null;
  new.outcome_code := null;
  return new;
end
$$;

comment on function backoffice.prepare_data_subject_request() is
  'BEFORE INSERT on backoffice.data_subject_requests: received_at = now(), due_at = the earlier of '
  'now() + 30 days and now() + one calendar month in UTC (0127, art. 12(3)), status received. '
  'SECURITY INVOKER, reads nothing.';

alter table backoffice.data_subject_requests
  drop constraint if exists data_subject_requests_due;
alter table backoffice.data_subject_requests
  add constraint data_subject_requests_due
  check (due_at = least(received_at + interval '720 hours',
                        ((received_at at time zone 'UTC') + interval '1 month') at time zone 'UTC'));

comment on column backoffice.data_subject_requests.due_at is
  'The legal deadline (15 RG73, art. 12(3)): the earlier of received_at + 30 days and received_at + '
  'one calendar month in UTC (0127), computed by the BEFORE INSERT trigger and held by a CHECK '
  '(a GENERATED column cannot hold timestamptz arithmetic).';

-- End-state assertion: the rule on the dates where it bites -------------------------------------------

do $$
declare
  v_due  timestamptz;
begin
  -- 31 January: the month ends on 28 February (2027 is not a leap year), before the 30 days
  select least(t + interval '720 hours', ((t at time zone 'UTC') + interval '1 month') at time zone 'UTC')
    into v_due
    from (select timestamptz '2027-01-31 22:00:00+00' as t) s;
  if v_due <> timestamptz '2027-02-28 22:00:00+00' then
    raise exception 'unexpected deadline for 31 January: %', v_due;
  end if;
  -- 15 October: 30 days is earlier than the month of 31 days
  select least(t + interval '720 hours', ((t at time zone 'UTC') + interval '1 month') at time zone 'UTC')
    into v_due
    from (select timestamptz '2026-10-15 08:00:00+00' as t) s;
  if v_due <> timestamptz '2026-11-14 08:00:00+00' then
    raise exception 'unexpected deadline for 15 October: %', v_due;
  end if;
end
$$;
