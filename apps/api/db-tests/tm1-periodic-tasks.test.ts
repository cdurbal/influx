// TM1 (J7, commit 5) — the periodic tasks of E-4 `maintenance.run_periodic` as the worker runs them
// (decision 3 of the J7 start; 05 RG91, CA53; 16 RG113; 04 §9, 02 §18.5; decision 2 for the 30-day
// purge). Real database and the worker's pool (influx_worker_login), the modules of
// src/domains/maintenance, the Brevo double and the GoTrue double on the loopback, reached through
// the real adapters (16 RG148: no test reaches Brevo nor GoTrue). The database half of the run
// (claim, fencing, filters, refusals) is tm1-periodic-runs.
// Runs are COMMITTED (the worker writes in its own transactions) for the CURRENT periods, which
// ops.periodic_runs never lets anyone delete: the local superuser clears them before and after
// each case with the triggers of the table off (session_replication_role, local stack only).
// Accounts are committed too, as in tm1-brevo-inbound-worker.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { localRoleUrl } from "@influx/test-kit/db";
import {
  startGoTrueDouble,
  type GoTrueDouble,
} from "@influx/test-kit/gotrue-double";
import { captureLogStream, valuesFoundIn } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  closeDatabase,
  createWorkerDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import { processInboundEvent } from "../src/domains/leads/inbound/processing.ts";
import { createAuthOrphanPurge } from "../src/domains/maintenance/auth-orphan-purge.ts";
import { createBrevoReads } from "../src/domains/maintenance/brevo-reads.ts";
import { createBrevoReconciliation } from "../src/domains/maintenance/brevo-reconciliation.ts";
import {
  createBrevoInboundPurge,
  createPeriodicScheduler,
  createPeriodicStore,
  type PeriodicScheduler,
} from "../src/domains/maintenance/periodic.ts";
import { createLogger } from "../src/platform/logger.ts";
import { createGoTrueUserDirectory } from "../src/platform/supabase.ts";
import { TEST_SUPABASE_SECRET_KEY } from "../tests/helpers.ts";
import { localSuperuser, migrationRole } from "./support.ts";

const HOUR_MS = 3_600_000;

let migration: postgres.Sql;
let brevo: BrevoDouble;
let gotrue: GoTrueDouble;
const workers: WorkerDatabase[] = [];
const logs = captureLogStream();

/** One worker instance: its own pool, as two Railway replicas have. */
function workerDatabase(): WorkerDatabase {
  const database = createWorkerDatabase(
    {
      worker: {
        url: localRoleUrl("influx_worker_login"),
        role: "influx_worker_login",
        tls: false,
      },
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  workers.push(database);
  return database;
}

/** The scheduler as worker.ts builds it, the reconciliation due at any hour (not after 03:00). */
function scheduler(database: WorkerDatabase): PeriodicScheduler {
  const store = createPeriodicStore(database);
  const now = () => Date.now();
  return createPeriodicScheduler({
    store,
    runners: {
      brevo_reconciliation: createBrevoReconciliation({
        reads: createBrevoReads({
          apiKey: "local-double-key",
          baseUrl: brevo.baseUrl,
        }),
        store,
        now,
      }),
      auth_orphan_purge: createAuthOrphanPurge({
        directory: createGoTrueUserDirectory({
          url: gotrue.url,
          secretKey: TEST_SUPABASE_SECRET_KEY,
        }),
        store,
        now,
      }),
      brevo_inbound_purge: createBrevoInboundPurge(store),
    },
    logger: createLogger(
      { service: "worker", environment: "staging", version: "test" },
      logs.destination,
    ),
    now,
    reconciliationStartHourUtc: 0,
  });
}

/** The current periods are cleared: ops.periodic_runs refuses deletes, its triggers set aside. */
async function clearCurrentRuns(): Promise<void> {
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`
      delete from ops.periodic_runs
       where period_key in (to_char(now() at time zone 'UTC', 'YYYY-MM-DD'),
                            to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24'))`;
  });
}

/** Every waiting raw line processed by the worker's module (E-3): the stack is left clean. */
async function processWaiting(): Promise<number> {
  const database = workers[0];
  if (database === undefined) {
    throw new Error("no worker pool");
  }
  let processed = 0;
  while ((await processInboundEvent(database, randomUUID())) !== null) {
    processed += 1;
  }
  return processed;
}

type Run = {
  id: string;
  task_code: string;
  attempt: number;
  outcome: string | null;
  counts: Record<string, number>;
};

async function currentRuns(): Promise<Run[]> {
  return migration<Run[]>`
    select id::text, task_code::text, attempt, outcome::text, counts
      from ops.periodic_runs
     where period_key in (to_char(now() at time zone 'UTC', 'YYYY-MM-DD'),
                          to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24'))
     order by task_code`;
}

async function runOf(task: string): Promise<Run> {
  const run = (await currentRuns()).find((row) => row.task_code === task);
  if (run === undefined) {
    throw new Error(`no run of ${task}`);
  }
  return run;
}

type Account = { id: string; email: string; authUserId: string };

/** A committed creator as the sign-up leaves it (consent given), active or deleted. */
async function createAccount(
  options: { authUserId?: string; deleted?: boolean } = {},
): Promise<Account> {
  const id = randomUUID();
  const authUserId = options.authUserId ?? randomUUID();
  const email = `tm1-periodic-${id}@example.test`;
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at, status, deleted_at)
      values (${id}, ${authUserId}, ${email}, now(), 'BE', 'fr',
              'individual'::identity.declared_status, true, now(),
              ${options.deleted === true ? "deleted" : "active"}::identity.account_status,
              ${options.deleted === true ? new Date() : null})`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${id}, 'creator'::identity.account_role)`;
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${id}, 'marketing_email', true, 'signup_form'),
             (${id}, 'commercial_prospection', true, 'signup_form')`;
  });
  return { id, email, authUserId };
}

/** The Brevo contact of an account, as operation 1 left it. */
function brevoContactOf(account: Account, id: number): void {
  const at = new Date(Date.now() - 10 * 24 * HOUR_MS).toISOString();
  brevo.contacts.set(account.email, {
    id,
    email: account.email,
    attributes: { INFLUX_ACCOUNT_ID: account.id },
    listIds: [3],
    emailBlacklisted: false,
    createdAt: at,
    modifiedAt: at,
  });
}

async function marketingConsentsOf(account: string) {
  return migration<{ granted: boolean; source: string }[]>`
    select granted, source::text as source from identity.consent_events
     where account_id = ${account} and purpose = 'marketing_email'
     order by occurred_at, granted desc`;
}

async function retentionLinesOf(run: string) {
  return migration<{ payload: Record<string, unknown> }[]>`
    select payload from audit.audit_events
     where event_type = 'retention.purged' and subject_id = ${run}`;
}

const signal = () => new AbortController().signal;

beforeAll(async () => {
  migration = migrationRole();
  brevo = await startBrevoDouble();
  gotrue = await startGoTrueDouble();
  workerDatabase();
  await processWaiting();
});

afterAll(async () => {
  await processWaiting();
  await clearCurrentRuns();
  for (const database of workers) {
    await closeDatabase(database);
  }
  await brevo.close();
  await gotrue.close();
});

beforeEach(async () => {
  brevo.reset();
  gotrue.reset();
  await processWaiting();
  await clearCurrentRuns();
});

afterEach(async () => {
  await processWaiting();
});

describe("05 CA53, RG91, 16 RG113: the daily reconciliation of the last 48 hours", () => {
  it("catches an unsubscription whose webhook was lost, through the webhook's own path; the gap is counted", async () => {
    const lost = await createAccount();
    brevoContactOf(lost, 1);
    // Brevo applied the unsubscription; its webhook never reached INFLUX.
    brevo.webhookEvent("unsubscribed", lost.email, {
      campaignId: 54,
      tsEvent: Math.floor((Date.now() - 5 * HOUR_MS) / 1000),
    });

    await scheduler(workerDatabase()).tick(signal());

    const run = await runOf("brevo_reconciliation");
    expect(run).toMatchObject({ attempt: 1, outcome: "succeeded" });
    expect(run.counts).toMatchObject({ unsubscribed_found: 1, gap: 1 });
    const [line] = await migration<
      { origin: string; event: string; account_ref: string | null }[]
    >`
      select origin::text, event, account_ref::text from leads.brevo_inbound_events
       where email = ${lost.email}`;
    expect(line).toEqual({
      origin: "reconciliation",
      event: "unsubscribed",
      account_ref: lost.id,
    });

    // The worker processes it like a webhook line: the consent withdrawn, source brevo_webhook.
    expect(await processWaiting()).toBeGreaterThanOrEqual(1);
    expect(await marketingConsentsOf(lost.id)).toEqual([
      { granted: true, source: "signup_form" },
      { granted: false, source: "brevo_webhook" },
    ]);
  });

  it("writes nothing again for what the webhook already brought, ignores the older and the subscribed contacts", async () => {
    const received = await createAccount();
    const old = await createAccount();
    const subscribed = await createAccount();
    brevoContactOf(received, 1);
    brevoContactOf(old, 2);
    brevoContactOf(subscribed, 3);
    brevo.webhookEvent("unsubscribed", received.email, {
      tsEvent: Math.floor((Date.now() - 5 * 60_000) / 1000),
    });
    // Brought by the webhook (the route's write), with the same instant to the second: the
    // reconciliation finds the same dedup key and writes nothing (RG146-5).
    const occurred = brevo.contacts.get(received.email)?.modifiedAt ?? "";
    await localSuperuser()`
      select leads.insert_brevo_inbound_event('webhook', 'unsubscribed',
               ${occurred}::timestamptz, null, ${received.email}, 54, null, null, null)`;
    brevo.webhookEvent("unsubscribed", old.email, {
      tsEvent: Math.floor((Date.now() - 50 * HOUR_MS) / 1000),
    });
    const contact = brevo.contacts.get(subscribed.email);
    if (contact !== undefined) {
      contact.modifiedAt = new Date().toISOString();
    }

    await scheduler(workerDatabase()).tick(signal());

    expect((await runOf("brevo_reconciliation")).counts).toMatchObject({
      contacts_listed: 2,
      unsubscribed_found: 1,
      gap: 0,
    });
    const lines = await migration<{ email: string }[]>`
      select email from leads.brevo_inbound_events
       where email = any (${[received.email, old.email, subscribed.email]}::text[])
         and origin = 'reconciliation'`;
    expect(lines).toEqual([]);
  });

  it("catches a lost transactional complaint (operation 10), with its message-id", async () => {
    const account = await createAccount();
    const messageId = `<${randomUUID()}@double.brevo.test>`;
    brevo.webhookEvent("transactional_spam", account.email, {
      messageId,
      tsEvent: Math.floor((Date.now() - HOUR_MS) / 1000),
    });

    await scheduler(workerDatabase()).tick(signal());

    expect((await runOf("brevo_reconciliation")).counts).toMatchObject({
      spam_found: 1,
      gap: 1,
    });
    const [line] = await migration<
      { origin: string; event: string; provider_message_id: string }[]
    >`
      select origin::text, event, provider_message_id from leads.brevo_inbound_events
       where email = ${account.email}`;
    expect(line).toEqual({
      origin: "reconciliation",
      event: "spam",
      provider_message_id: messageId,
    });
    const reads = brevo.requests.map((request) => request.path.split("?")[0]);
    expect(reads).toEqual(["/v3/contacts", "/v3/smtp/statistics/events"]);
  });

  it("closes the run failed on a Brevo outage, with a closed code and no address in the logs", async () => {
    const account = await createAccount();
    brevoContactOf(account, 1);
    brevo.webhookEvent("unsubscribed", account.email);
    brevo.queue({ status: 503, body: { code: "internal_error" } });
    const before = logs.lines().length;

    await scheduler(workerDatabase()).tick(signal());

    expect(await runOf("brevo_reconciliation")).toMatchObject({
      outcome: "failed",
      counts: {},
    });
    const written = logs.lines().slice(before).join("\n");
    expect(written).toContain('"errorCode":"brevo.unavailable"');
    expect(valuesFoundIn(written, [account.email, account.id])).toEqual([]);
  });
});

describe("04 §9, 02 §18.5: the hourly purge of the GoTrue users without an account", () => {
  it("keeps an orphan of 23 hours, purges one of 25 hours, by the administration API, with retention.purged", async () => {
    const young = gotrue.addUser({ ageHours: 23 });
    const old = gotrue.addUser({ ageHours: 25 });

    await scheduler(workerDatabase()).tick(signal());

    expect([...gotrue.users.keys()]).toEqual([young]);
    const deletes = gotrue.requests.filter(
      (request) => request.method === "DELETE",
    );
    expect(deletes.map((request) => request.path)).toEqual([
      `/auth/v1/admin/users/${old}`,
    ]);
    const run = await runOf("auth_orphan_purge");
    expect(run).toMatchObject({ outcome: "succeeded" });
    expect(run.counts).toMatchObject({
      listed: 2,
      aged: 1,
      orphans: 1,
      deleted: 1,
    });
    expect(await retentionLinesOf(run.id)).toEqual([
      { payload: { category: "auth_orphan_users", count: 1 } },
    ]);
  });

  it("never purges the user of an account, even deleted (on auth_user_id, never on an address)", async () => {
    const active = gotrue.addUser({ ageHours: 72 });
    const deleted = gotrue.addUser({ ageHours: 72 });
    await createAccount({ authUserId: active });
    await createAccount({ authUserId: deleted, deleted: true });

    await scheduler(workerDatabase()).tick(signal());

    expect([...gotrue.users.keys()].sort()).toEqual([active, deleted].sort());
    expect(gotrue.requests.some((request) => request.method === "DELETE")).toBe(
      false,
    );
    const run = await runOf("auth_orphan_purge");
    expect(run.counts).toMatchObject({ aged: 2, orphans: 0, deleted: 0 });
    expect(await retentionLinesOf(run.id)).toEqual([]);
  });

  it("keeps an old orphan that asked for a code or signed in within 24 hours", async () => {
    const updated = gotrue.addUser({ ageHours: 72, updatedHoursAgo: 2 });
    const signedIn = gotrue.addUser({
      ageHours: 72,
      updatedHoursAgo: 30,
      signedInHoursAgo: 3,
    });

    await scheduler(workerDatabase()).tick(signal());

    expect([...gotrue.users.keys()].sort()).toEqual([updated, signedIn].sort());
  });

  it("keeps the user whose account appeared after the listing (checked again before the delete)", async () => {
    const adopted = gotrue.addUser({ ageHours: 30 });
    let created = false;
    // The account is created between the listing and the delete: when the user is read again.
    const directory = createGoTrueUserDirectory({
      url: gotrue.url,
      secretKey: TEST_SUPABASE_SECRET_KEY,
    });
    const store = createPeriodicStore(workers[0] as WorkerDatabase);
    const purge = createAuthOrphanPurge({
      directory: {
        ...directory,
        async readUser(userId) {
          const read = await directory.readUser(userId);
          if (!created) {
            created = true;
            await createAccount({ authUserId: adopted });
          }
          return read;
        },
      },
      store,
      now: () => Date.now(),
    });
    const periodic = createPeriodicScheduler({
      store,
      runners: { auth_orphan_purge: purge },
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
      now: () => Date.now(),
    });

    await periodic.tick(signal());

    expect(gotrue.users.has(adopted)).toBe(true);
    expect((await runOf("auth_orphan_purge")).counts).toMatchObject({
      orphans: 1,
      kept: 1,
      deleted: 0,
    });
    expect(gotrue.requests.some((request) => request.method === "DELETE")).toBe(
      false,
    );
  });
});

describe("decision 3: one run per period, whatever the number of worker instances", () => {
  it("runs each task once with two instances ticking together", async () => {
    const orphan = gotrue.addUser({ ageHours: 25 });
    const account = await createAccount();
    brevoContactOf(account, 1);
    brevo.webhookEvent("unsubscribed", account.email);
    const first = scheduler(workerDatabase());
    const second = scheduler(workerDatabase());

    await Promise.all([first.tick(signal()), second.tick(signal())]);

    const runs = await currentRuns();
    expect(
      runs.map((run) => [run.task_code, run.attempt, run.outcome]),
    ).toEqual([
      ["auth_orphan_purge", 1, "succeeded"],
      ["brevo_inbound_purge", 1, "succeeded"],
      ["brevo_reconciliation", 1, "succeeded"],
    ]);
    expect(gotrue.users.has(orphan)).toBe(false);
    expect(
      gotrue.requests.filter((request) => request.method === "DELETE"),
    ).toHaveLength(1);
    expect(
      gotrue.requests.filter((request) =>
        request.path.startsWith("/auth/v1/admin/users?"),
      ),
    ).toHaveLength(1);
    expect(
      brevo.requests.filter((request) =>
        request.path.startsWith("/v3/contacts?"),
      ),
    ).toHaveLength(1);
    const lines = await migration<{ id: string }[]>`
      select id::text from leads.brevo_inbound_events
       where email = ${account.email} and origin = 'reconciliation'`;
    expect(lines).toHaveLength(1);

    // A later tick of either instance, in the same periods, claims nothing more.
    await second.tick(signal());
    await scheduler(workerDatabase()).tick(signal());
    expect((await currentRuns()).map((run) => run.attempt)).toEqual([1, 1, 1]);
    expect(
      gotrue.requests.filter((request) =>
        request.path.startsWith("/auth/v1/admin/users?"),
      ),
    ).toHaveLength(1);
  });
});

describe("C5.b (J7 commit 7 review, 0125): the hourly pass sets GoTrue back to the address in force", () => {
  /**
   * An address change of `account` whose both codes were typed `minutesAgo` minutes ago: open
   * (the completion failed after GoTrue) or closed. Written by the local superuser, its dates being
   * the database functions' own (the route test drives them end to end).
   */
  async function confirmedChange(
    account: Account,
    newEmail: string,
    options: { minutesAgo?: number; closed?: boolean } = {},
  ): Promise<void> {
    const minutes = options.minutesAgo ?? 16;
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into identity.email_change_requests
          (id, account_id, old_email, new_email, created_at, expires_at, old_code_hash,
           new_code_hash, old_confirmed_at, new_confirmed_at, cancelled_at, cancel_reason)
        select ${randomUUID()}, ${account.id}, ${account.email}, ${newEmail}, c.at,
               c.at + interval '24 hours',
               case when ${options.closed === true} then null else sha256('old'::bytea || c.salt) end,
               case when ${options.closed === true} then null else sha256('new'::bytea || c.salt) end,
               c.ready, c.ready,
               case when ${options.closed === true} then c.ready end,
               case when ${options.closed === true}
                    then 'address_unavailable'::identity.email_change_cancel_reason end
          from (select now() - make_interval(mins => ${minutes} + 5) as at,
                       now() - make_interval(mins => ${minutes}) as ready,
                       convert_to(gen_random_uuid()::text, 'UTF8') as salt) c`;
    });
  }

  /** The pool of the file: one per case would exhaust the role's connections. */
  function sharedWorker(): WorkerDatabase {
    const database = workers[0];
    if (database === undefined) {
      throw new Error("no worker pool");
    }
    return database;
  }

  /** The condition the sign-in checks once GoTrue verified a code (verify-code step 6). */
  async function signInMatches(account: Account): Promise<boolean> {
    const [row] = await migration<{ email: string; auth_user_id: string }[]>`
      select email, auth_user_id::text from identity.accounts where id = ${account.id}`;
    return (
      row !== undefined &&
      gotrue.users.get(row.auth_user_id)?.email === row.email
    );
  }

  it("GoTrue left on the new address after a failed completion: set back, the sign-in by the old address matches again", async () => {
    const account = await createAccount();
    const newEmail = `tm1-periodic-new-${randomUUID()}@example.test`;
    gotrue.addUser({ ageHours: 48, id: account.authUserId, email: newEmail });
    await confirmedChange(account, newEmail);
    expect(await signInMatches(account)).toBe(false);

    await scheduler(sharedWorker()).tick(signal());

    expect(gotrue.users.get(account.authUserId)?.email).toBe(account.email);
    expect(await signInMatches(account)).toBe(true);
    expect(
      gotrue.requests.filter(
        (request) =>
          request.method === "PUT" &&
          request.path === `/auth/v1/admin/users/${account.authUserId}`,
      ),
    ).toHaveLength(1);
    const run = await runOf("auth_orphan_purge");
    expect(run.outcome).toBe("succeeded");
    expect(run.counts.gotrue_realigned).toBeGreaterThanOrEqual(1);
    expect(valuesFoundIn(logs.text(), [account.email, newEmail])).toEqual([]);
  });

  it("an orphan created meanwhile on the old address (a code asked while locked out) is deleted, then GoTrue is set back", async () => {
    const account = await createAccount();
    const newEmail = `tm1-periodic-new-${randomUUID()}@example.test`;
    gotrue.addUser({ ageHours: 48, id: account.authUserId, email: newEmail });
    const orphan = gotrue.addUser({ ageHours: 0, email: account.email });
    await confirmedChange(account, newEmail, { closed: true });

    await scheduler(sharedWorker()).tick(signal());

    expect(gotrue.users.has(orphan)).toBe(false);
    expect(gotrue.users.get(account.authUserId)?.email).toBe(account.email);
    expect(await signInMatches(account)).toBe(true);
    const run = await runOf("auth_orphan_purge");
    expect(run.counts).toMatchObject({ realign_orphans_deleted: 1 });
    expect(await retentionLinesOf(run.id)).toContainEqual({
      payload: { category: "auth_orphan_users", count: 1 },
    });
  });

  it("never deletes the user of another account holding the address: counted failed, nothing deleted", async () => {
    const account = await createAccount();
    const other = await createAccount();
    const newEmail = `tm1-periodic-new-${randomUUID()}@example.test`;
    gotrue.addUser({ ageHours: 48, id: account.authUserId, email: newEmail });
    // the other account's user holds the first account's address (a divergence of its own)
    gotrue.addUser({
      ageHours: 48,
      id: other.authUserId,
      email: account.email,
    });
    await confirmedChange(account, newEmail);

    await scheduler(sharedWorker()).tick(signal());

    expect(gotrue.users.get(other.authUserId)?.email).toBe(account.email);
    expect(gotrue.users.get(account.authUserId)?.email).toBe(newEmail);
    expect(
      gotrue.requests.some(
        (request) =>
          request.method === "DELETE" &&
          request.path === `/auth/v1/admin/users/${other.authUserId}`,
      ),
    ).toBe(false);
    expect(
      (await runOf("auth_orphan_purge")).counts.gotrue_realign_failed,
    ).toBeGreaterThanOrEqual(1);
  });

  it("leaves alone a change confirmed less than 15 minutes ago (its completion may be in flight) and a GoTrue user already aligned", async () => {
    const inFlight = await createAccount();
    const aligned = await createAccount();
    const newEmail = `tm1-periodic-new-${randomUUID()}@example.test`;
    gotrue.addUser({ ageHours: 48, id: inFlight.authUserId, email: newEmail });
    gotrue.addUser({
      ageHours: 48,
      id: aligned.authUserId,
      email: aligned.email,
    });
    await confirmedChange(inFlight, newEmail, { minutesAgo: 2 });
    await confirmedChange(
      aligned,
      `tm1-periodic-x-${randomUUID()}@example.test`,
      {
        closed: true,
      },
    );

    await scheduler(sharedWorker()).tick(signal());

    expect(gotrue.users.get(inFlight.authUserId)?.email).toBe(newEmail);
    expect(gotrue.users.get(aligned.authUserId)?.email).toBe(aligned.email);
    expect(
      gotrue.requests.filter(
        (request) =>
          request.method === "PUT" &&
          (request.path.endsWith(inFlight.authUserId) ||
            request.path.endsWith(aligned.authUserId)),
      ),
    ).toEqual([]);
  });
});
