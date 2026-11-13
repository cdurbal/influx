// The fixtures that earlier runs leave COMMITTED in the local stack (random identifiers, never
// removed: the no-delete triggers), swept by the global setup before any file. Without it, the
// capped reads fill up with them run after run and the cases of a file no longer see their own
// rows: privacy.pending_work (oldest authorisation first, PENDING_WORK_LIMIT per tick) and
// GET /v1/bo/internal-accounts (INTERNAL_ACCOUNT_LIST_CAP). An interrupted run leaves them too, its
// afterAll never ran. Local stack only (disposable); the data set of T2 is kept.
import type postgres from "postgres";

export async function sweepStaleFixtures(
  migration: postgres.Sql,
): Promise<void> {
  await migration.begin(async (tx) => {
    // Executions left open: most wait, by design, for a Brevo confirmation no case sends. Their
    // request is closed (pending_work leaves a closed request out, EC-DZ-3).
    await tx`alter table backoffice.data_subject_requests disable trigger data_subject_requests_guard_update`;
    await tx`
      update backoffice.data_subject_requests d
         set status = 'closed', completed_at = now(), outcome_code = 'sans_objet'
        from privacy.request_executions e
       where e.request_id = d.id and e.completed_at is null and d.status <> 'closed'`;
    await tx`alter table backoffice.data_subject_requests enable trigger data_subject_requests_guard_update`;
    // Internal profiles still active, the T2 agents and admins (T2<role><side>) apart.
    await tx`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where is_active and not is_break_glass
         and coalesce(first_name, '') not like 'T2%'`;
    // Dual control requests still pending past their delay (24 h): the guard refuses to cancel or
    // confirm one that has expired, but admits pending to expired once the delay is over. Left
    // pending, such a row is a trap for any case that acts on every pending request. Only the
    // rows past their delay move, to the state the guard itself allows; none is deleted.
    await tx`
      update backoffice.dual_control_requests
         set state = 'expired'
       where state = 'pending' and expires_at <= pg_catalog.now()`;
    // Creator review entries still open from an earlier day: the queue reads the oldest deadline
    // first, so a leftover whose deadline fell behind the 3 hours the cases give their own late
    // entry takes the front of the queue (t14-creator-queue-route, "the next entry to open") from
    // the day after. Withdrawn, the state the cases themselves use; none is deleted, and nothing
    // runs yet, the sweep being before any file.
    await tx`
      update profiles.creator_review_entries
         set state = 'withdrawn', closed_at = pg_catalog.now()
       where state = 'open' and sla_due_at < pg_catalog.now() - interval '1 hour'`;
  });
}
