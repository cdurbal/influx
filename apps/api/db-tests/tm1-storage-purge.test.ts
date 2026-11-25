// L2B commit 09 — the hourly task storage_purge of E-4 against the REAL Supabase Storage of the local
// stack (0205; D80, jalons/l2b/stockage.md §7; 04 §5.11 rule 3): the objects of the purging rows and
// of the pending rows left over 15 minutes are removed, their rows deleted with retention.purged on
// the run; an active logo and a fresh upload are never touched; the daily usage older than 7 days is
// purged; a removal that fails leaves its row purging, counted, and closes the run failed (retried
// the next hour). Worker pool (influx_worker_login) and the modules of src/domains/maintenance, as
// worker.ts builds them. Runs of the CURRENT hour are committed: the local superuser clears those of
// storage_purge before and after each case, the triggers of the table off (as tm1-periodic-tasks).
import { localRoleUrl, requireLocalAuth } from "@influx/test-kit/db";
import { captureLogStream } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createWorkerDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import {
  createPeriodicScheduler,
  createPeriodicStore,
} from "../src/domains/maintenance/periodic.ts";
import { createStoragePurge } from "../src/domains/maintenance/storage-purge.ts";
import { createLogger } from "../src/platform/logger.ts";
import {
  createObjectStore,
  type ObjectStore,
} from "../src/platform/storage.ts";
import { localSuperuser, migrationRole } from "./support.ts";

let migration: postgres.Sql;
let worker: WorkerDatabase;
let store: ObjectStore;
const logs = captureLogStream();
const accounts: string[] = [];

/** Some bytes standing for a stored WebP (the purge never reads them). */
const BYTES = new Uint8Array(
  Buffer.from("RIFF\x0c\x00\x00\x00WEBPVP8 ", "latin1"),
);

function scheduler(objects: ObjectStore) {
  const periodic = createPeriodicStore(worker);
  return createPeriodicScheduler({
    store: periodic,
    runners: {
      storage_purge: createStoragePurge({ store: periodic, objects }),
    },
    logger: createLogger(
      { service: "worker", environment: "staging", version: "test" },
      logs.destination,
    ),
    now: () => Date.now(),
  });
}

async function clearStorageRuns(): Promise<void> {
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`delete from ops.periodic_runs where task_code = 'storage_purge'`;
  });
}

/** A committed brand with its (minimal) profile. */
async function newBrand(): Promise<string> {
  const id = randomUUID();
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at)
      values (${id}, ${randomUUID()}, ${`tm1-storage-${id}@example.test`}, now(), 'FR', 'fr',
              'business'::identity.declared_status, true, now())`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${id}, 'advertiser'::identity.account_role)`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name)
      values (${id}, ${`Maison ${id.slice(0, 8)}`})`;
  });
  accounts.push(id);
  return id;
}

type Kind = "purging" | "stale_pending" | "fresh_pending" | "active";

/** A logo row of `kind`, its object written to Storage under the key of the base. */
async function logoRow(
  account: string,
  kind: Kind,
): Promise<{ id: string; key: string }> {
  const [row] = await migration<{ id: string; object_key: string }[]>`
    insert into profiles.brand_logo_objects
      (account_id, received_bytes, state, created_at, byte_size, width, height, activated_at,
       purge_requested_at)
    values (${account}, 1000,
            ${kind === "purging" ? "purging" : kind === "active" ? "active" : "pending"}::profiles.brand_logo_state,
            now() - ${kind === "stale_pending" ? "20 minutes" : "1 minute"}::interval,
            ${kind === "active" ? 900 : null}, ${kind === "active" ? 512 : null},
            ${kind === "active" ? 512 : null}, ${kind === "active" ? new Date() : null},
            ${kind === "purging" ? new Date() : null})
    returning id::text as id, object_key`;
  if (row === undefined) {
    throw new Error("no logo row");
  }
  const written = await store.write(
    "brand-logo",
    row.object_key,
    BYTES,
    "image/webp",
  );
  expect(written.ok).toBe(true);
  return { id: row.id, key: row.object_key };
}

async function stateOf(id: string) {
  const [row] = await migration<
    { state: string; purge_attempts: number; tried: boolean }[]
  >`
    select state::text as state, purge_attempts,
           last_purge_attempt_at is not null as tried
      from profiles.brand_logo_objects where id = ${id}`;
  return row ?? null;
}

async function exists(key: string): Promise<boolean> {
  const read = await store.read("brand-logo", key);
  expect(read.ok).toBe(true);
  return read.ok && read.value !== null;
}

async function runOfStoragePurge() {
  const [run] = await migration<
    { id: string; outcome: string | null; counts: Record<string, number> }[]
  >`
    select id::text, outcome::text as outcome, counts from ops.periodic_runs
     where task_code = 'storage_purge'
       and period_key = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24')`;
  if (run === undefined) {
    throw new Error("no storage_purge run");
  }
  return run;
}

beforeAll(async () => {
  migration = migrationRole();
  const local = await requireLocalAuth();
  store = createObjectStore({ url: local.apiUrl, secretKey: local.secretKey });
  worker = createWorkerDatabase(
    {
      worker: {
        url: localRoleUrl("influx_worker_login"),
        role: "influx_worker_login",
        tls: false,
      },
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  // whatever an earlier file left purging is purged first, so that each case sees its own rows
  await clearStorageRuns();
  await scheduler(store).tick(new AbortController().signal);
});

beforeEach(async () => {
  await clearStorageRuns();
});

afterAll(async () => {
  await clearStorageRuns();
  if (accounts.length > 0) {
    const rows = await migration<{ object_key: string }[]>`
      select object_key from profiles.brand_logo_objects where account_id = any (${accounts}::uuid[])`;
    for (const row of rows) {
      await store.remove("brand-logo", row.object_key);
    }
    await migration`
      delete from profiles.brand_logo_objects where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = any (${accounts}::uuid[])`;
  }
  await closeDatabase(worker);
});

describe("storage_purge (0205; stockage.md §7)", () => {
  it("removes the objects of the purging and stale pending rows, deletes those rows, keeps the others", async () => {
    const account = await newBrand();
    const purging = await logoRow(account, "purging");
    const stale = await logoRow(account, "stale_pending");
    const fresh = await logoRow(account, "fresh_pending");
    const active = await logoRow(account, "active");

    await scheduler(store).tick(new AbortController().signal);

    const run = await runOfStoragePurge();
    expect(run.outcome).toBe("succeeded");
    expect(run.counts).toMatchObject({
      claimed: 2,
      removed: 2,
      remove_failed: 0,
      purged: 2,
    });
    expect(await stateOf(purging.id)).toBeNull();
    expect(await stateOf(stale.id)).toBeNull();
    expect(await exists(purging.key)).toBe(false);
    expect(await exists(stale.key)).toBe(false);
    expect((await stateOf(fresh.id))?.state).toBe("pending");
    expect((await stateOf(active.id))?.state).toBe("active");
    expect(await exists(fresh.key)).toBe(true);
    expect(await exists(active.key)).toBe(true);

    const lines = await migration<{ payload: Record<string, unknown> }[]>`
      select payload from audit.audit_events
       where event_type = 'retention.purged' and subject_id = ${run.id}`;
    expect(lines.map((line) => line.payload)).toContainEqual({
      category: "brand_logo_objects",
      count: 2,
    });
  });

  it("purges the daily usage older than 7 days, and nothing more recent", async () => {
    const account = await newBrand();
    await migration`
      insert into profiles.storage_daily_usage
        (account_id, bucket_id, usage_day, upload_count, received_bytes)
      values (${account}, 'brand-logo', (now() at time zone 'UTC')::date - 8, 3, 3000),
             (${account}, 'brand-logo', (now() at time zone 'UTC')::date - 7, 2, 2000),
             (${account}, 'brand-logo', (now() at time zone 'UTC')::date, 1, 1000)`;
    await scheduler(store).tick(new AbortController().signal);
    const days = await migration<{ age: number }[]>`
      select ((now() at time zone 'UTC')::date - usage_day) as age
        from profiles.storage_daily_usage where account_id = ${account}
       order by usage_day`;
    expect(days.map((row) => row.age)).toEqual([7, 0]);
    expect(
      (await runOfStoragePurge()).counts.usage_purged,
    ).toBeGreaterThanOrEqual(1);
  });

  it("keeps a row whose removal fails purging, its attempt counted, and closes the run failed", async () => {
    const account = await newBrand();
    const purging = await logoRow(account, "purging");
    const failing: ObjectStore = {
      ...store,
      async remove() {
        return {
          ok: false,
          reason: "unavailable",
          status: 503,
          errorCode: null,
        };
      },
    };
    await scheduler(failing).tick(new AbortController().signal);
    const run = await runOfStoragePurge();
    expect(run.outcome).toBe("failed");
    expect(run.counts).toMatchObject({
      claimed: 1,
      remove_failed: 1,
      purged: 0,
    });
    expect(await stateOf(purging.id)).toEqual({
      state: "purging",
      purge_attempts: 1,
      tried: true,
    });
    expect(await exists(purging.key)).toBe(true);
    expect(logs.text()).toContain("storage.remove_failed");
    expect(logs.text().includes(purging.key)).toBe(false);
  });

  it("refuses the functions outside an open storage_purge run of the attempt (55000), as influx_worker", async () => {
    const periodic = createPeriodicStore(worker);
    const stranger = { runId: randomUUID(), attempt: 1 };
    await expect(
      periodic.claimStoragePurges(stranger, 10),
    ).rejects.toMatchObject({
      cause: { code: "55000" },
    });
    await expect(
      periodic.completeStoragePurges(stranger, [randomUUID()]),
    ).rejects.toMatchObject({ cause: { code: "55000" } });
    await expect(periodic.purgeStorageUsage(stranger)).rejects.toMatchObject({
      cause: { code: "55000" },
    });
  });
});
