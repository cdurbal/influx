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
  });
}
