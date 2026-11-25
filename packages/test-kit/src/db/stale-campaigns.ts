// The published or paused campaigns that earlier runs leave in the local stack (random identifiers,
// never removed: the no-delete triggers), closed before any suite. The creator's feed (L3D) reads
// every published campaign, so the fixtures of a run would otherwise meet those of all the runs before
// it. Closed, the state a campaign ends in: the migration role (outside `influx_%`, the closure guard
// of 0309 does not apply to it), no trigger disabled, nothing deleted, the register (`audit.*`) and
// the snapshots untouched. Local stack only (disposable).
import type postgres from "postgres";

/** Closes every published or paused campaign of the stack; returns how many it closed. */
export async function closeStalePublishedCampaigns(
  migration: postgres.Sql | postgres.TransactionSql,
): Promise<number> {
  const rows = await migration<{ id: string }[]>`
    update campaigns.campaigns
       set status = 'closed'
     where status in ('published', 'paused')
    returning id::text as id`;
  return rows.length;
}
