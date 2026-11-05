-- =============================================================================
-- 0214_profiles_brand_review_entries_backfill
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 18a2 (jalons/l2c/18a2.md; fiche invariants 1, 14, 15; file.md A1). Defect seen
-- on staging on 2026-11-05: a brand profile submitted before 0207 is pending_review without any entry
-- of queue 1, so the queue is empty and the brand stays blocked, since submitting a pending_review
-- profile again writes nothing (0203, edge case 3). This migration opens the missing entries.
--
--   profiles.advertiser_review_entries   one open entry `submission` for each pending_review profile
--         without an open one. Its deadlines come from its BEFORE INSERT trigger (0207 §4.1, 04 §5.6):
--         created_at is the instant of this migration, the delay of the brand starts there and
--         submitted_at stays what it was.
--
-- Nothing else: no publication and no change of state (06 RG6), no line in leads.outbox_events nor in
-- the register (audit.append() needs an account in context; the entry itself is the trace), no right,
-- no function. Idempotent: a second run finds nothing to open.
--
-- EC-L2C-18a2 (micro-gaps, the safest choice):
--   EC-L2C-18a2-1  a deleted account is left out, of the insert and of the assertion: the erasure keeps
--                  the state of the profile and withdraws its open entry (0207, file.md A1), and the
--                  queue does not filter on the account: an entry would show an erased brand to an agent.
--   EC-L2C-18a2-2  a suspended account gets its entry, as a profile submitted before a suspension keeps
--                  its open one.
--   EC-L2C-18a2-3  the writer is the migration role, like the updates of 0141 and 0146: it holds
--                  BYPASSRLS (0206 inserts into backoffice.sla_policies, whose RLS is forced, with no
--                  policy for it) and owns what the SECURITY INVOKER trigger reads. The policy of
--                  influx_identity_definer only admits the account in context, one account at a time.
--
-- ROLLBACK (before any decision on these entries): delete the entries `submission` still open whose
-- created_at is the instant of this migration; none is referenced by a revision.

insert into profiles.advertiser_review_entries (account_id, kind)
select p.account_id, 'submission'::profiles.review_entry_kind
  from profiles.advertiser_profiles p
  join identity.accounts a on a.id = p.account_id
 where p.status = 'pending_review'
   and a.status <> 'deleted'
   and not exists (select 1 from profiles.advertiser_review_entries e
                    where e.account_id = p.account_id and e.state = 'open')
on conflict (account_id) where state = 'open' do nothing;

do $$
declare
  v_missing  bigint;
begin
  select count(*) into v_missing
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.status = 'pending_review'
     and a.status <> 'deleted'
     and not exists (select 1 from profiles.advertiser_review_entries e
                      where e.account_id = p.account_id and e.state = 'open');
  if v_missing > 0 then
    raise exception '% pending_review brand profiles still without an open entry', v_missing;
  end if;
end
$$;
