// The hourly purge of Supabase Storage (D80, jalons/l2b/stockage.md §7; 04 §5.11 rule 3; 0205;
// D82 (6), 0223): the objects of the logo and evidence rows to purge are removed through the API of
// Storage (a SQL DELETE on storage.objects is refused), then their rows forgotten. Model:
// auth_orphan_purge.
//   1. ops.claim_storage_purges(): the pending rows left over 15 minutes and the evidence past its
//      date pass to purging; a batch of purging rows not tried in the last 30 minutes is taken, its
//      attempts counted, each with its bucket.
//   2. Each object removed from its bucket (an absent object is a success: removed earlier, or never
//      written).
//   3. ops.complete_storage_purges(): a logo row deleted, an evidence row purged (its checksum and
//      findings kept), retention.purged written by the database in the same transaction.
//   4. ops.purge_storage_usage(): the daily usage older than 7 days deleted.
// A removal that fails leaves its row purging: the run is closed `failed` (code
// storage.remove_failed, alerted through the line of the scheduler), the next hour tries again. A
// stop requested between two removals leaves the rest purging. No key, account nor byte is logged
// (D60): counts only.
import type { ObjectStore } from "../../platform/storage.ts";
import {
  checkNotStopped,
  PeriodicTaskError,
  type PeriodicStore,
  type PeriodicTaskRunner,
} from "./periodic.ts";

/** Rows taken per call, and calls per run at most. */
export const STORAGE_PURGE_BATCH = 100;
export const STORAGE_PURGE_MAX_BATCHES = 10;

export function createStoragePurge(dependencies: {
  store: PeriodicStore;
  objects: ObjectStore;
}): PeriodicTaskRunner {
  const { store, objects } = dependencies;
  return async (run, counts, signal) => {
    counts.claimed = 0;
    counts.removed = 0;
    counts.remove_failed = 0;
    counts.purged = 0;
    counts.usage_purged = 0;

    for (let batch = 0; batch < STORAGE_PURGE_MAX_BATCHES; batch += 1) {
      checkNotStopped(signal);
      const claimed = await store.claimStoragePurges(run, STORAGE_PURGE_BATCH);
      counts.claimed += claimed.length;
      const removed: string[] = [];
      try {
        for (const candidate of claimed) {
          checkNotStopped(signal);
          const outcome = await objects.remove(
            candidate.bucket,
            candidate.objectKey,
          );
          if (outcome.ok) {
            removed.push(candidate.objectId);
          } else {
            counts.remove_failed += 1;
          }
        }
      } finally {
        // The objects removed are forgotten, even when a stop interrupts the batch.
        if (removed.length > 0) {
          counts.removed += removed.length;
          counts.purged += await store.completeStoragePurges(run, removed);
        }
      }
      if (claimed.length < STORAGE_PURGE_BATCH) {
        break;
      }
    }

    checkNotStopped(signal);
    counts.usage_purged = await store.purgeStorageUsage(run);

    if (counts.remove_failed > 0) {
      throw new PeriodicTaskError("storage.remove_failed");
    }
  };
}
