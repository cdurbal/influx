// The hourly purge of the GoTrue users without an INFLUX account (04 §9, 02 §18.5 R1, D43;
// decision 3 of the J7 start). Every address asked for a code leaves a GoTrue user; after 24 hours
// without becoming an account, it is deleted, so that auth.users never grows into a directory of
// the addresses tried.
//   1. admin.listUsers, page after page; a user is a candidate when created_at, updated_at and
//      last_sign_in_at are ALL over 24 hours old (a code asked for again, a sign-in, keep it).
//   2. ops.filter_auth_orphans(): those no identity.accounts.auth_user_id references. On the id,
//      NEVER on an address: an account deleted logically keeps its line, hence its user.
//   3. Before each admin.deleteUser: the user read again (still over 24 hours old), then the
//      account checked again; then deleted through the administration API, never a DELETE on
//      `auth`.
//   4. retention.purged (auth_orphan_users, count) on the run, even when a later step failed.
// No address of a listed user is ever read, and none is logged (D60): ids and instants, and counts.
//
// First, in the same run, the realignment of C5.b (J7 commit 7 review, 0125): the address of
// GoTrue follows identity.accounts.email. For each account that changed address recently
// (ops.gotrue_realignment_candidates), the GoTrue user is read; when its address differs from the
// one in force, read again just before, GoTrue takes the database's. If another GoTrue user holds
// that address (email_exists: typically one created by a code asked for the old address while the
// account could not sign in), it is deleted when no account references it, then the move is tried
// once more. Counts: realign_checked, gotrue_realigned, gotrue_realign_failed,
// realign_orphans_deleted (in retention.purged with the purge). Addresses stay in memory.
import type {
  GoTrueUserActivity,
  GoTrueUserDirectory,
} from "../../platform/supabase.ts";
import {
  checkNotStopped,
  PeriodicTaskError,
  type PeriodicCounts,
  type PeriodicRun,
  type PeriodicStore,
  type PeriodicTaskRunner,
} from "./periodic.ts";

/** 04 §9: the age after which a user without an account is purged. */
export const AUTH_ORPHAN_AGE_MS = 24 * 3_600_000;
/** Users per page of admin.listUsers (and per call of ops.filter_auth_orphans, 1000 at most). */
export const LIST_PAGE_SIZE = 1_000;
/** Pages listed per run at most; the rest waits for the next hour. */
export const MAX_LIST_PAGES = 100;
/** Deletions per run at most (the loop of the worker stays short); the rest, the next hour. */
export const MAX_DELETIONS_PER_RUN = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Created, updated and last signed in over 24 hours before `now` (never signed in counts). */
export function isPurgeableAge(user: GoTrueUserActivity, now: number): boolean {
  const limit = now - AUTH_ORPHAN_AGE_MS;
  return (
    user.createdAt < limit &&
    (user.updatedAt ?? user.createdAt) < limit &&
    (user.lastSignInAt === null || user.lastSignInAt < limit)
  );
}

function gotrueFailure(reason: "rejected" | "unavailable"): PeriodicTaskError {
  return new PeriodicTaskError(`gotrue.${reason}`);
}

/**
 * C5.b: GoTrue set to the address in force of each account that changed address recently. An
 * outage of GoTrue stops the run (the next hour tries again); a refusal is counted and skipped.
 */
async function realignGoTrue(
  directory: GoTrueUserDirectory,
  store: PeriodicStore,
  run: PeriodicRun,
  counts: PeriodicCounts,
  signal: AbortSignal,
): Promise<void> {
  counts.realign_checked = 0;
  counts.gotrue_realigned = 0;
  counts.gotrue_realign_failed = 0;
  counts.realign_orphans_deleted = 0;
  for (const candidate of await store.realignmentCandidates(run, null)) {
    checkNotStopped(signal);
    counts.realign_checked += 1;
    const held = await directory.readUserAddress(candidate.authUserId);
    if (!held.ok) {
      if (held.reason === "unavailable") {
        throw gotrueFailure("unavailable");
      }
      counts.gotrue_realign_failed += 1;
      continue;
    }
    if (held.value.email === candidate.email) {
      continue;
    }
    // Read again as late as possible: a change may have completed since the first read.
    const [fresh] = await store.realignmentCandidates(run, candidate.accountId);
    if (fresh === undefined || fresh.email === held.value.email) {
      continue;
    }
    let moved = await directory.moveUserAddress(fresh.authUserId, fresh.email);
    if (
      !moved.ok &&
      moved.reason === "rejected" &&
      moved.errorCode === "email_exists"
    ) {
      const holder = await directory.userOfAddress(fresh.email);
      if (
        holder.ok &&
        holder.value !== fresh.authUserId &&
        UUID.test(holder.value) &&
        (await store.filterAuthOrphans(run, [holder.value])).length === 1
      ) {
        const deleted = await directory.deleteUser(holder.value);
        if (deleted.ok) {
          counts.realign_orphans_deleted += 1;
        }
        if (deleted.ok || deleted.status === 404) {
          moved = await directory.moveUserAddress(
            fresh.authUserId,
            fresh.email,
          );
        }
      }
    }
    if (moved.ok) {
      counts.gotrue_realigned += 1;
    } else if (moved.reason === "unavailable") {
      throw gotrueFailure("unavailable");
    } else {
      counts.gotrue_realign_failed += 1;
    }
  }
}

export function createAuthOrphanPurge(dependencies: {
  directory: GoTrueUserDirectory;
  store: PeriodicStore;
  now: () => number;
}): PeriodicTaskRunner {
  const { directory, store, now } = dependencies;
  return async (run, counts, signal) => {
    try {
      await realignGoTrue(directory, store, run, counts, signal);
    } finally {
      // A deletion made is traced, even when the run stops here.
      if ((counts.realign_orphans_deleted ?? 0) > 0) {
        await store.recordAuthOrphanPurge(
          run,
          counts.realign_orphans_deleted ?? 0,
        );
      }
    }

    counts.listed = 0;
    counts.aged = 0;
    counts.orphans = 0;
    counts.deleted = 0;
    counts.kept = 0;
    counts.gone = 0;

    const orphans: string[] = [];
    let page: number | null = 1;
    for (
      let listed = 0;
      page !== null && listed < MAX_LIST_PAGES;
      listed += 1
    ) {
      checkNotStopped(signal);
      const outcome = await directory.listUsers(page, LIST_PAGE_SIZE);
      if (!outcome.ok) {
        throw gotrueFailure(outcome.reason);
      }
      counts.listed += outcome.value.users.length;
      const aged = outcome.value.users
        .filter((user) => UUID.test(user.userId) && isPurgeableAge(user, now()))
        .map((user) => user.userId);
      counts.aged += aged.length;
      if (aged.length > 0) {
        orphans.push(...(await store.filterAuthOrphans(run, aged)));
      }
      page = outcome.value.nextPage;
    }
    counts.orphans = orphans.length;

    try {
      for (const userId of orphans.slice(0, MAX_DELETIONS_PER_RUN)) {
        checkNotStopped(signal);
        const read = await directory.readUser(userId);
        if (!read.ok) {
          if (read.status === 404) {
            counts.gone += 1;
            continue;
          }
          throw gotrueFailure(read.reason);
        }
        if (!isPurgeableAge(read.value, now())) {
          counts.kept += 1;
          continue;
        }
        // An account may have been created since the listing: checked again, on the id, as late
        // as possible before the delete.
        const still = await store.filterAuthOrphans(run, [userId]);
        if (still.length === 0) {
          counts.kept += 1;
          continue;
        }
        const deleted = await directory.deleteUser(userId);
        if (!deleted.ok) {
          if (deleted.status === 404) {
            counts.gone += 1;
            continue;
          }
          throw gotrueFailure(deleted.reason);
        }
        counts.deleted += 1;
      }
    } finally {
      // Every deletion made is traced, even when a later one failed or a stop was requested.
      if (counts.deleted > 0) {
        await store.recordAuthOrphanPurge(run, counts.deleted);
      }
    }
  };
}
