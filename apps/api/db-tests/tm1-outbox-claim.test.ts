// TM1 (J6, commit 2) — the database half of E-3 `leads.drain_outbox`, migration 0111: the four
// SECURITY DEFINER functions of the worker, owned by influx_leads_definer and executable by
// influx_worker only (03 P7): the claim of a batch (FOR UPDATE SKIP LOCKED, priority,
// available_at, id; RG77 per subject and destination, RG78 priority 0), the start of an attempt
// (state read at consumption, RG37), the four outcomes with the contact state and the
// transactional journal, the take-back of orphans (TM1.10), and the dry_run marker (decision 2 of
// the architect, J6). The register line of E-3 goes through audit.append_elevated() (EC-52 (3)).
// Queue lines are inserted and COMMITTED by the migration role, on fresh subjects, and removed
// after each case. While the worker claims, a transaction of the migration role holds every OTHER
// pending line of the stack (other files commit sign-ups): SKIP LOCKED passes over them, so that a
// case sees its own lines only. Worker transactions are rolled back, except where the contact
// state or the journal must be read back (committed, then removed). The last block runs the same
// four steps through the worker's module and pool (src/domains/leads/queue.ts; 18 T6.4, T6.5).
import {
  connectAsLoginRole,
  inRolledBackTransaction,
  localRoleUrl,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
  type UserContext,
} from "@influx/test-kit/db";
import { OUR_SCHEMAS } from "@influx/test-kit/rights";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createWorkerDatabase,
  type DbLogger,
  type WorkerDatabase,
} from "../src/db/index.ts";
import {
  beginOutboxAttempt,
  claimOutboxBatch,
  completeOutboxAttempt,
  recoverStaleOutboxLines,
} from "../src/domains/leads/queue.ts";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const NOT_IN_PROCESSING = "55000";

const WORKER = "tm1-worker-a";
const OTHER_WORKER = "tm1-worker-b";

/** The keys of leads.sync_settings that the worker reads (EC-8), never the signup_* ones. */
const WORKER_SETTINGS = [
  "apollo_legal_basis",
  "apollo_prospecting_countries",
  "apollo_scope",
  "brevo_list_ids",
  "brevo_template_ids",
  "rate_limits",
  "retry_schedule",
];

const FUNCTIONS = [
  "leads.claim_outbox_batch(text, integer)",
  "leads.begin_outbox_attempt(bigint, text)",
  "leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean, text, text, text, " +
    "integer, text, text, text, integer)",
  "leads.recover_stale_outbox_lines(integer)",
];

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// Lines, accounts and their removal
// ---------------------------------------------------------------------------------------------

type Destination = "brevo_contact" | "apollo_contact" | "brevo_transactional";

type LineSpec = {
  subject?: string;
  destination?: Destination;
  priority?: number;
  /** Seconds from now: negative = available for that long already, positive = in the future. */
  availableIn?: number;
  emailCode?: string;
  /** A line already taken: by which worker, how many seconds ago. */
  processing?: { by: string; secondsAgo: number };
  attempts?: number;
};

/** Lines and accounts of the current case, removed after it. */
const lines: string[] = [];
const accounts: string[] = [];

/** A committed queue line; the payload carries identifiers only (05 RG74). */
async function insertLine(spec: LineSpec = {}): Promise<string> {
  const subject = spec.subject ?? `account:${randomUUID()}`;
  const event = randomUUID();
  const payload: Record<string, string> = { event_id: event };
  if (subject.startsWith("account:")) {
    payload.account_id = subject.slice("account:".length);
  }
  if (spec.emailCode !== undefined) {
    payload.email_code = spec.emailCode;
  }
  const [row] = await migration.unsafe<{ id: string }[]>(
    `insert into leads.outbox_events
       (event_id, event_type, destination, subject_key, priority, payload, idempotency_key,
        available_at, status, locked_by, locked_at, attempts)
     values ($1, 'lead.created', $2::leads.outbox_destination, $3, $4::smallint, $5::jsonb, $6,
             now() + make_interval(secs => $7::double precision), $8::leads.outbox_status, $9,
             case when $9::text is null then null
                  else now() - make_interval(secs => $10::double precision) end,
             $11::smallint)
     returning id::text as id`,
    [
      event,
      spec.destination ?? "brevo_contact",
      subject,
      spec.priority ?? 100,
      payload,
      `tm1:${event}`,
      spec.availableIn ?? 0,
      spec.processing === undefined ? "pending" : "processing",
      spec.processing?.by ?? null,
      spec.processing?.secondsAgo ?? 0,
      spec.attempts ?? 0,
    ] as postgres.ParameterOrJSON<never>[],
  );
  if (row === undefined) {
    throw new Error("the queue line was not inserted");
  }
  lines.push(row.id);
  return row.id;
}

/** A committed member account (Belgium, English) with both consents granted at sign-up. */
async function createAccount(role: "advertiser" | "creator"): Promise<string> {
  const id = randomUUID();
  const creator = role === "creator";
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at)
      values (${id}, ${randomUUID()}, ${`tm1-${id}@example.test`}, now(), 'BE', 'en',
              ${creator ? "individual" : "business"}::identity.declared_status,
              ${creator}, case when ${creator} then now() end)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${id}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${id}, 'marketing_email', true, 'signup_form'),
             (${id}, 'commercial_prospection', true, 'signup_form')`;
  });
  accounts.push(id);
  return id;
}

afterEach(async () => {
  const lineIds = lines.splice(0);
  const accountIds = accounts.splice(0);
  if (lineIds.length > 0) {
    await migration`
      delete from leads.transactional_sends where outbox_event_id = any (${lineIds}::bigint[])`;
    await migration`
      delete from leads.outbox_events where id = any (${lineIds}::bigint[])`;
  }
  if (accountIds.length > 0) {
    await migration`
      delete from leads.contact_sync_states where account_id = any (${accountIds}::uuid[])`;
  }
});

/**
 * Runs `fn` while a transaction of the migration role holds every pending line that is not one
 * of this case's: the worker's SKIP LOCKED passes over them.
 */
function withOthersLocked<T>(fn: () => Promise<T>): Promise<T> {
  const own = [...lines];
  return inRolledBackTransaction(migration, async (blocker) => {
    await blocker`
      select id from leads.outbox_events
       where status = 'pending' and not (id = any (${own}::bigint[]))
         for update`;
    return fn();
  });
}

/** influx_worker taken the way the worker takes it, in a transaction always rolled back. */
function asWorker<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
  sql: postgres.Sql = loginRole("influx_worker_login"),
): Promise<T> {
  return inRolledBackTransaction(sql, async (tx) => {
    await takeRole(tx, "influx_worker");
    return fn(tx);
  });
}

/** The same, committed: for the cases that read back the contact state or the journal. */
async function committedAsWorker<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  let result: { value: T } | undefined;
  await loginRole("influx_worker_login").begin(async (tx) => {
    await takeRole(tx, "influx_worker");
    result = { value: await fn(tx) };
  });
  if (result === undefined) {
    throw new Error("the worker transaction did not complete");
  }
  return result.value;
}

// ---------------------------------------------------------------------------------------------
// The four functions, as the worker calls them
// ---------------------------------------------------------------------------------------------

type Claimed = {
  id: string;
  event_id: string;
  event_type: string;
  destination: string;
  subject_key: string;
  priority: number;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

const CLAIMED_COLUMNS =
  "outbox_id::text as id, event_id::text as event_id, event_type, destination::text as destination, " +
  "subject_key, priority, payload, idempotency_key";

async function claim(
  tx: postgres.TransactionSql,
  worker: string = WORKER,
  limit?: number,
): Promise<string[]> {
  return (await claimRows(tx, worker, limit)).map((row) => row.id);
}

async function claimRows(
  tx: postgres.TransactionSql,
  worker: string = WORKER,
  limit?: number,
): Promise<Claimed[]> {
  const rows =
    limit === undefined
      ? await tx.unsafe<Claimed[]>(
          `select ${CLAIMED_COLUMNS} from leads.claim_outbox_batch($1)`,
          [worker],
        )
      : await tx.unsafe<Claimed[]>(
          `select ${CLAIMED_COLUMNS} from leads.claim_outbox_batch($1, $2::integer)`,
          [worker, limit],
        );
  return [...rows];
}

type State = {
  attempt: number;
  account_id: string | null;
  account_status: string | null;
  account_role: string | null;
  declared_status: string | null;
  country_code: string | null;
  preferred_language: string | null;
  email_verified: boolean | null;
  marketing_email_consent: boolean | null;
  commercial_prospection_consent: boolean | null;
  settings: Record<string, unknown>;
};

const BEGIN =
  "select attempt, account_id::text as account_id, account_status, account_role, declared_status, " +
  "country_code, preferred_language, email_verified, marketing_email_consent, " +
  "commercial_prospection_consent, settings from leads.begin_outbox_attempt($1::bigint, $2)";

async function begin(
  tx: postgres.TransactionSql,
  id: string,
  worker: string = WORKER,
): Promise<State> {
  const [row] = await tx.unsafe<State[]>(BEGIN, [id, worker]);
  if (row === undefined) {
    throw new Error("begin_outbox_attempt returned no row");
  }
  return row;
}

function tryBegin(
  tx: postgres.TransactionSql,
  id: string,
  worker: string | null = WORKER,
): Promise<ProbeResult> {
  return probe(tx, BEGIN, [id, worker]);
}

type Outcome = {
  status: string;
  /** Explicit in every call; undefined here means false, null is the refused case. */
  dryRun?: boolean | null;
  skipReason?: string;
  errorCode?: string;
  errorMessage?: string;
  retryInSeconds?: number;
  providerMessageId?: string;
  providerContactId?: string;
  locale?: string;
  templateVersion?: number;
};

type Completed = {
  written_status: string;
  journal_inserted: boolean;
  account_id: string | null;
};

const COMPLETE =
  "select written_status::text as written_status, journal_inserted, account_id::text as account_id " +
  "from leads.complete_outbox_attempt(p_outbox_id => $1::bigint, p_worker => $2, " +
  "p_status => $3::leads.outbox_status, p_dry_run => $4::boolean, p_skip_reason => $5, " +
  "p_error_code => $6, p_error_message => $7, p_retry_in_seconds => $8::integer, " +
  "p_provider_message_id => $9, p_provider_contact_id => $10, p_locale => $11, " +
  "p_template_version => $12::integer)";

function completeParameters(
  id: string,
  outcome: Outcome,
  worker: string,
): postgres.ParameterOrJSON<never>[] {
  return [
    id,
    worker,
    outcome.status,
    outcome.dryRun === undefined ? false : outcome.dryRun,
    outcome.skipReason ?? null,
    outcome.errorCode ?? null,
    outcome.errorMessage ?? null,
    outcome.retryInSeconds ?? null,
    outcome.providerMessageId ?? null,
    outcome.providerContactId ?? null,
    outcome.locale ?? null,
    outcome.templateVersion ?? null,
  ] as postgres.ParameterOrJSON<never>[];
}

async function complete(
  tx: postgres.TransactionSql,
  id: string,
  outcome: Outcome,
  worker: string = WORKER,
): Promise<Completed> {
  const [row] = await tx.unsafe<Completed[]>(
    COMPLETE,
    completeParameters(id, outcome, worker),
  );
  if (row === undefined) {
    throw new Error("complete_outbox_attempt returned no row");
  }
  return row;
}

function tryComplete(
  tx: postgres.TransactionSql,
  id: string,
  outcome: Outcome,
  worker: string = WORKER,
): Promise<ProbeResult> {
  return probe(tx, COMPLETE, completeParameters(id, outcome, worker));
}

type Recovered = { id: string; written_status: string };

async function recover(
  tx: postgres.TransactionSql,
  staleAfterSeconds?: number,
): Promise<Recovered[]> {
  const rows =
    staleAfterSeconds === undefined
      ? await tx.unsafe<Recovered[]>(
          "select outbox_id::text as id, written_status::text as written_status " +
            "from leads.recover_stale_outbox_lines()",
        )
      : await tx.unsafe<Recovered[]>(
          "select outbox_id::text as id, written_status::text as written_status " +
            "from leads.recover_stale_outbox_lines($1::integer)",
          [staleAfterSeconds],
        );
  // stale lines of an interrupted earlier run may come back too: keep this case's own
  return rows
    .filter((row) => lines.includes(row.id))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

// ---------------------------------------------------------------------------------------------
// Reading back, as the migration role
// ---------------------------------------------------------------------------------------------

type LineRow = {
  status: string;
  skip_reason: string | null;
  attempts: number;
  waits_seconds: number;
  locked: boolean;
  completed: boolean;
  dry_run: boolean;
  provider_message_id: string | null;
  provider_contact_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

async function lineRow(id: string): Promise<LineRow> {
  const [row] = await migration<LineRow[]>`
    select status::text as status, skip_reason, attempts,
           round(extract(epoch from available_at - now()))::int as waits_seconds,
           (locked_by is not null or locked_at is not null) as locked,
           completed_at is not null as completed, dry_run, provider_message_id,
           provider_contact_id, last_error_code, last_error_message
      from leads.outbox_events where id = ${id}`;
  if (row === undefined) {
    throw new Error("the queue line was not found");
  }
  return row;
}

function contactStates(account: string) {
  return migration<
    {
      destination: string;
      last_status: string;
      external_contact_id: string | null;
      last_error_code: string | null;
      succeeded: boolean;
    }[]
  >`
    select destination::text as destination, last_status::text as last_status,
           external_contact_id, last_error_code, last_success_at is not null as succeeded
      from leads.contact_sync_states where account_id = ${account} order by destination`;
}

function journalOf(id: string) {
  return migration`
    select email_code, priority::text as priority, account_id::text as account_id,
           recipient_email, locale::text as locale, template_ref, template_version,
           status::text as status, sent_at is not null as sent, provider_message_id
      from leads.transactional_sends where outbox_event_id = ${id}`;
}

// ---------------------------------------------------------------------------------------------
// The column and the constraints of 0111
// ---------------------------------------------------------------------------------------------

describe("0111: the dry_run marker and the attempt bound of leads.outbox_events", () => {
  /** A line written directly by the migration role, in a rolled-back transaction. */
  function writeLine(
    tx: postgres.TransactionSql,
    columns: string,
    values: string,
  ): Promise<ProbeResult> {
    const event = randomUUID();
    return probe(
      tx,
      `insert into leads.outbox_events
         (event_id, event_type, destination, subject_key, payload, idempotency_key, ${columns})
       values ($1, 'lead.created', 'brevo_contact', $2, '{}', $3, ${values})`,
      [event, `account:${randomUUID()}`, `tm1:${event}`],
    );
  }

  it("refuses a dry run on a line that is not succeeded (23514)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await writeLine(tx, "status, dry_run", "'pending', true"),
      await writeLine(
        tx,
        "status, skip_reason, completed_at, dry_run",
        "'skipped', 'no_consent', now(), true",
      ),
      await writeLine(
        tx,
        "status, last_error_code, completed_at, dry_run",
        "'failed', 'mapping.invalid', now(), true",
      ),
    ]);
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "error", code: CHECK_VIOLATION },
    ]);
  });

  it("refuses a dry run that carries a provider id (23514), accepts one without", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await writeLine(
        tx,
        "status, completed_at, dry_run, provider_message_id",
        "'succeeded', now(), true, 'tm1-message'",
      ),
      await writeLine(
        tx,
        "status, completed_at, dry_run, provider_contact_id",
        "'succeeded', now(), true, 'tm1-contact'",
      ),
      await writeLine(
        tx,
        "status, completed_at, dry_run",
        "'succeeded', now(), true",
      ),
    ]);
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "rows", count: 1 },
    ]);
  });

  it("is false by default, and a processing column: the description stays immutable", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      await writeLine(tx, "status", "'pending'");
      const [line] = await tx<{ dry_run: boolean }[]>`
        select dry_run from leads.outbox_events
         where idempotency_key like 'tm1:%' and status = 'pending'
         order by id desc limit 1`;
      return [
        line?.dry_run,
        await probe(
          tx,
          "update leads.outbox_events set status = 'succeeded', completed_at = now(), " +
            "dry_run = true where idempotency_key like 'tm1:%' and status = 'pending'",
        ),
        await probe(
          tx,
          "update leads.outbox_events set event_type = 'lead.updated' " +
            "where idempotency_key like 'tm1:%' and dry_run",
        ),
      ];
    });
    expect(results[0]).toBe(false);
    expect(results[1]).toMatchObject({ outcome: "rows" });
    expect(results[2]).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("refuses a waiting line without an attempt left (RG79, 23514)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await writeLine(tx, "status, attempts", "'pending', 10"),
      await writeLine(tx, "status, attempts", "'pending', 9"),
      await writeLine(
        tx,
        "status, attempts, last_error_code, completed_at",
        "'failed', 10, 'brevo.unavailable', now()",
      ),
    ]);
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "rows", count: 1 },
      { outcome: "rows", count: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// The claim
// ---------------------------------------------------------------------------------------------

describe("TM1.7, RG77, RG78: leads.claim_outbox_batch()", () => {
  it("takes the lines in priority, available_at, id order, priority 0 first; a future line stays", async () => {
    const later = await insertLine({ availableIn: -3600 });
    const earlier = await insertLine({ availableIn: -7200 });
    const urgent = await insertLine({ priority: 0 });
    const future = await insertLine({ availableIn: 3600 });
    const claimed = await withOthersLocked(() =>
      asWorker((tx) => claimRows(tx)),
    );
    expect(claimed.map((row) => row.id)).toEqual([urgent, earlier, later]);
    expect(claimed.map((row) => row.id)).not.toContain(future);
    // what the loop needs, and identifiers only (05 RG74, TM1.9)
    for (const row of claimed) {
      expect(JSON.stringify(row)).not.toContain("@");
      expect(Object.keys(row.payload).sort()).toEqual([
        "account_id",
        "event_id",
      ]);
      expect(row).toMatchObject({
        event_type: "lead.created",
        destination: "brevo_contact",
        idempotency_key: `tm1:${row.event_id}`,
      });
      expect(row.subject_key).toBe(`account:${String(row.payload.account_id)}`);
    }
  });

  it("bounds the batch: 20 by default, p_limit from 1 to 50", async () => {
    for (let index = 0; index < 25; index += 1) {
      await insertLine();
    }
    const sizes = await withOthersLocked(() =>
      asWorker(async (tx) => [
        (await claim(tx, WORKER, 3)).length,
        (await claim(tx)).length,
        (await claim(tx)).length,
      ]),
    );
    expect(sizes).toEqual([3, 20, 2]);
  });

  it.each([0, 51, null])(
    "refuses a batch size of %s (22023)",
    async (limit) => {
      expect(
        await asWorker((tx) =>
          probe(tx, "select * from leads.claim_outbox_batch($1, $2::integer)", [
            WORKER,
            limit,
          ]),
        ),
      ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    },
  );

  it.each([
    ["empty", ""],
    ["longer than 100 characters", "w".repeat(101)],
    ["with a space", "tm1 worker"],
    ["null", null],
  ])("refuses a worker identifier %s (22023)", async (_label, worker) => {
    expect(
      await asWorker((tx) =>
        probe(tx, "select * from leads.claim_outbox_batch($1)", [worker]),
      ),
    ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("never gives one line to two concurrent takers (SKIP LOCKED, two connections)", async () => {
    const own: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      own.push(await insertLine());
    }
    const second = connectAsLoginRole("influx_worker_login", { max: 1 });
    try {
      const [first, other] = await withOthersLocked(() =>
        asWorker(async (tx) => {
          const mine = await claim(tx, WORKER, 6);
          // the first transaction is still open: its six lines are locked, not committed
          const theirs = await asWorker(
            (otherTx) => claim(otherTx, OTHER_WORKER),
            second,
          );
          return [mine, theirs];
        }),
      );
      expect(first).toHaveLength(6);
      expect(other).toHaveLength(4);
      expect(first.filter((id) => other.includes(id))).toEqual([]);
      expect([...first, ...other].sort()).toEqual([...own].sort());
    } finally {
      await second.end({ timeout: 1 });
    }
  });

  it("keeps a subject's next line from a concurrent taker until the first is done (TM1.7)", async () => {
    const subject = `account:${randomUUID()}`;
    const first = await insertLine({ subject });
    const next = await insertLine({ subject });
    const second = connectAsLoginRole("influx_worker_login", { max: 1 });
    try {
      const seen = await withOthersLocked(async () => {
        // the first line locked, not committed: the other taker skips it and keeps the next
        const uncommitted = await asWorker(async (tx) => ({
          mine: await claim(tx),
          theirs: await asWorker(
            (otherTx) => claim(otherTx, OTHER_WORKER),
            second,
          ),
        }));
        // the first line committed in processing, then succeeded
        const taken = await committedAsWorker((tx) => claim(tx));
        const whileProcessing = await asWorker(
          (tx) => claim(tx, OTHER_WORKER),
          second,
        );
        await committedAsWorker(async (tx) => {
          await begin(tx, first);
          return complete(tx, first, { status: "succeeded" });
        });
        const afterwards = await asWorker(
          (tx) => claim(tx, OTHER_WORKER),
          second,
        );
        return { uncommitted, taken, whileProcessing, afterwards };
      });
      expect(seen).toEqual({
        uncommitted: { mine: [first], theirs: [] },
        taken: [first],
        whileProcessing: [],
        afterwards: [next],
      });
    } finally {
      await second.end({ timeout: 1 });
    }
  });

  it("RG77: a subject's next line waits while the first is processing or waiting; destinations are independent (RG75)", async () => {
    const subject = `account:${randomUUID()}`;
    const first = await insertLine({ subject });
    const next = await insertLine({ subject });
    const apollo = await insertLine({ subject, destination: "apollo_contact" });
    const waitingSubject = `account:${randomUUID()}`;
    await insertLine({ subject: waitingSubject, availableIn: 3600 });
    const behindRetry = await insertLine({ subject: waitingSubject });
    const rounds = await withOthersLocked(() =>
      asWorker(async (tx) => {
        const one = await claim(tx);
        const two = await claim(tx);
        await begin(tx, first);
        await complete(tx, first, { status: "succeeded" });
        const three = await claim(tx);
        return [one, two, three];
      }),
    );
    expect(rounds).toEqual([[first, apollo], [], [next]]);
    expect(rounds.flat()).not.toContain(behindRetry);
  });

  it("RG78: a priority 0 line passes an older line of its subject waiting for a retry, never another priority 0 line", async () => {
    const subject = `account:${randomUUID()}`;
    const retrying = await insertLine({ subject, availableIn: 3600 });
    const firstUrgent = await insertLine({ subject, priority: 0 });
    const secondUrgent = await insertLine({ subject, priority: 0 });
    const rounds = await withOthersLocked(() =>
      asWorker(async (tx) => {
        const one = await claim(tx);
        await begin(tx, firstUrgent);
        await complete(tx, firstUrgent, { status: "succeeded" });
        const two = await claim(tx);
        await begin(tx, secondUrgent);
        await complete(tx, secondUrgent, { status: "succeeded" });
        const three = await claim(tx);
        return [one, two, three];
      }),
    );
    expect(rounds).toEqual([[firstUrgent], [secondUrgent], []]);
    expect(rounds.flat()).not.toContain(retrying);
  });

  it("RG78: an urgent line goes first even when emitted later; it waits while its subject is being processed", async () => {
    const subject = `account:${randomUUID()}`;
    const normal = await insertLine({ subject });
    const urgent = await insertLine({ subject, priority: 0 });
    const busySubject = `account:${randomUUID()}`;
    const running = await insertLine({ subject: busySubject });
    const rounds = await withOthersLocked(() =>
      asWorker(async (tx) => {
        const one = await claim(tx);
        // an urgent line emitted while its subject is in processing (committed elsewhere); a
        // minute in the past, since now() is the start of this long transaction
        const late = await insertLine({
          subject: busySubject,
          priority: 0,
          availableIn: -60,
        });
        const two = await claim(tx);
        await begin(tx, urgent);
        await complete(tx, urgent, { status: "succeeded" });
        await begin(tx, running);
        await complete(tx, running, { status: "succeeded" });
        const three = await claim(tx);
        return { one, two, three, late };
      }),
    );
    expect(rounds).toEqual({
      one: [urgent, running],
      two: [],
      three: [rounds.late, normal],
      late: rounds.late,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// The start of an attempt: the state, read at consumption
// ---------------------------------------------------------------------------------------------

describe("RG37: leads.begin_outbox_attempt()", () => {
  it("counts the attempt and reads the state at consumption: a consent withdrawn after emission is seen (TM1.4)", async () => {
    const account = await createAccount("creator");
    const id = await insertLine({ subject: `account:${account}` });
    const state = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        // the member withdraws after the emission of the line, before its consumption
        await migration`
          insert into identity.consent_events (account_id, purpose, granted, source)
          values (${account}, 'marketing_email', false, 'account_settings')`;
        return begin(tx, id);
      }),
    );
    expect(state).toEqual({
      attempt: 1,
      account_id: account,
      account_status: "active",
      account_role: "creator",
      declared_status: "individual",
      country_code: "BE",
      preferred_language: "en",
      email_verified: true,
      marketing_email_consent: false,
      commercial_prospection_consent: true,
      settings: expect.any(Object) as Record<string, unknown>,
    });
    expect(Object.keys(state.settings).sort()).toEqual(WORKER_SETTINGS);
    expect(state.settings.apollo_prospecting_countries).toEqual([]);
    expect(JSON.stringify(state)).not.toContain("@");
  });

  it("continues the count of attempts, and reads a refusal at the same instant as a grant as a refusal", async () => {
    const account = await createAccount("advertiser");
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.consent_events (account_id, purpose, granted, source)
        values (${account}, 'commercial_prospection', true, 'account_settings'),
               (${account}, 'commercial_prospection', false, 'account_settings')`;
    });
    const id = await insertLine({ subject: `account:${account}`, attempts: 4 });
    const state = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        return begin(tx, id);
      }),
    );
    expect(state).toMatchObject({
      attempt: 5,
      account_role: "advertiser",
      declared_status: "business",
      marketing_email_consent: true,
      commercial_prospection_consent: false,
    });
  });

  it("returns no account for a subject that is not an account, or an unknown one; the settings all the same", async () => {
    const introduction = await insertLine({
      subject: `introduction:${randomUUID()}`,
    });
    const unknown = await insertLine();
    const states = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        return [await begin(tx, introduction), await begin(tx, unknown)];
      }),
    );
    for (const state of states) {
      expect(state).toMatchObject({
        attempt: 1,
        account_id: null,
        account_status: null,
        account_role: null,
        marketing_email_consent: null,
        commercial_prospection_consent: null,
      });
      expect(Object.keys(state.settings).sort()).toEqual(WORKER_SETTINGS);
    }
  });

  it("refuses a line that is not in processing for this worker (55000), and a malformed worker (22023)", async () => {
    const waiting = await insertLine({ availableIn: 3600 });
    const taken = await insertLine();
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        return [
          await tryBegin(tx, waiting),
          await tryBegin(tx, taken, OTHER_WORKER),
          await tryBegin(tx, "-1"),
          await tryBegin(tx, taken, "tm1 worker"),
          await tryBegin(tx, taken, null),
          await tryBegin(tx, taken),
        ];
      }),
    );
    expect(results).toEqual([
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: INVALID_PARAMETER },
      { outcome: "error", code: INVALID_PARAMETER },
      { outcome: "rows", count: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// The four outcomes
// ---------------------------------------------------------------------------------------------

describe("leads.complete_outbox_attempt(): the four outcomes", () => {
  it("succeeded (live) on a contact line: closes the line, frees it, writes the contact state", async () => {
    const account = await createAccount("advertiser");
    const id = await insertLine({ subject: `account:${account}` });
    const result = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return complete(tx, id, {
          status: "succeeded",
          providerContactId: "brevo-4242",
        });
      }),
    );
    expect(result).toEqual({
      written_status: "succeeded",
      journal_inserted: false,
      account_id: account,
    });
    expect(await lineRow(id)).toMatchObject({
      status: "succeeded",
      attempts: 1,
      locked: false,
      completed: true,
      dry_run: false,
      skip_reason: null,
      provider_contact_id: "brevo-4242",
      provider_message_id: null,
    });
    expect(await contactStates(account)).toEqual([
      {
        destination: "brevo_contact",
        last_status: "succeeded",
        external_contact_id: "brevo-4242",
        last_error_code: null,
        succeeded: true,
      },
    ]);
    expect(await journalOf(id)).toEqual([]);
  });

  it("succeeded (live) on the welcome line: one P1 journal line tied to the queue line, and the caller is told (EC-52 (3))", async () => {
    const account = await createAccount("creator");
    const id = await insertLine({
      subject: `account:${account}`,
      destination: "brevo_transactional",
      emailCode: "account.welcome_creator",
    });
    const messageId = `<tm1-${randomUUID()}@smtp-relay.test>`;
    const result = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return complete(tx, id, {
          status: "succeeded",
          providerMessageId: messageId,
          locale: "en",
          templateVersion: 1,
        });
      }),
    );
    expect(result).toEqual({
      written_status: "succeeded",
      journal_inserted: true,
      account_id: account,
    });
    expect(await lineRow(id)).toMatchObject({
      status: "succeeded",
      provider_message_id: messageId,
      dry_run: false,
    });
    expect(await journalOf(id)).toEqual([
      {
        email_code: "account.welcome_creator",
        priority: "p1",
        account_id: account,
        recipient_email: null,
        locale: "en",
        template_ref: "account.welcome_creator",
        template_version: 1,
        status: "sent",
        sent: true,
        provider_message_id: messageId,
      },
    ]);
    // the channel of the sign-in code has no contact state (0101, RG35)
    expect(await contactStates(account)).toEqual([]);
  });

  it("skipped: a normal case with its reason, written in the contact state, never a failure (RG36, RG80)", async () => {
    const account = await createAccount("creator");
    const id = await insertLine({ subject: `account:${account}` });
    const result = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return complete(tx, id, {
          status: "skipped",
          skipReason: "no_consent",
        });
      }),
    );
    expect(result.written_status).toBe("skipped");
    expect(await lineRow(id)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
      completed: true,
      locked: false,
      last_error_code: null,
    });
    expect(await contactStates(account)).toEqual([
      {
        destination: "brevo_contact",
        last_status: "skipped",
        external_contact_id: null,
        last_error_code: "no_consent",
        succeeded: false,
      },
    ]);
  });

  it("never skips the welcome line for lack of marketing consent, even through the function (RG35, 23514)", async () => {
    const id = await insertLine({
      destination: "brevo_transactional",
      emailCode: "account.welcome_advertiser",
    });
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return [
          await tryComplete(tx, id, {
            status: "skipped",
            skipReason: "no_consent",
          }),
          await tryComplete(tx, id, {
            status: "skipped",
            skipReason: "skipped_non_production",
          }),
        ];
      }),
    );
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "rows", count: 1 },
    ]);
  });

  it("pending: the line waits its delay, lock freed, cause kept without any address, then is taken again (TM1.8)", async () => {
    const account = await createAccount("advertiser");
    const later = await insertLine({ subject: `account:${account}` });
    const now = await insertLine();
    const results = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, later);
        await begin(tx, now);
        return [
          await complete(tx, later, {
            status: "pending",
            errorCode: "brevo.rate_limited",
            errorMessage: "429 for tm1@example.test,\nretry later",
            retryInSeconds: 300,
          }),
          await complete(tx, now, {
            status: "pending",
            errorCode: "brevo.unavailable",
            retryInSeconds: 0,
          }),
        ];
      }),
    );
    expect(results.map((row) => row.written_status)).toEqual([
      "pending",
      "pending",
    ]);
    const waiting = await lineRow(later);
    expect(waiting).toMatchObject({
      status: "pending",
      attempts: 1,
      locked: false,
      completed: false,
      last_error_code: "brevo.rate_limited",
      last_error_message: "429 for [address], retry later",
    });
    expect(waiting.waits_seconds).toBeGreaterThanOrEqual(295);
    expect(waiting.waits_seconds).toBeLessThanOrEqual(300);
    expect(await contactStates(account)).toEqual([
      {
        destination: "brevo_contact",
        last_status: "pending",
        external_contact_id: null,
        last_error_code: "brevo.rate_limited",
        succeeded: false,
      },
    ]);
    // the line without delay is taken again at once, the other one is not
    expect(await withOthersLocked(() => asWorker((tx) => claim(tx)))).toEqual([
      now,
    ]);
  });

  it("turns the tenth transient failure into a definitive failure with its cause (RG79)", async () => {
    const tenth = await insertLine({ attempts: 9 });
    const first = await insertLine();
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        const attempts = [
          (await begin(tx, tenth)).attempt,
          (await begin(tx, first)).attempt,
        ];
        const pending = {
          status: "pending",
          errorCode: "brevo.unavailable",
          retryInSeconds: 60,
        };
        return {
          attempts,
          tenth: (await complete(tx, tenth, pending)).written_status,
          first: (await complete(tx, first, pending)).written_status,
        };
      }),
    );
    expect(results).toEqual({
      attempts: [10, 1],
      tenth: "failed",
      first: "pending",
    });
  });

  it("failed: needs a cause, closes the line, never taken again", async () => {
    const id = await insertLine();
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return [
          await tryComplete(tx, id, { status: "failed" }),
          (
            await complete(tx, id, {
              status: "failed",
              errorCode: "brevo.invalid_contact",
            })
          ).written_status,
          await claim(tx),
          await tryBegin(tx, id),
        ];
      }),
    );
    expect(results).toEqual([
      { outcome: "error", code: INVALID_PARAMETER },
      "failed",
      [],
      { outcome: "error", code: NOT_IN_PROCESSING },
    ]);
  });

  it("refuses an outcome on a line that is not in processing for this worker (55000)", async () => {
    const waiting = await insertLine({ availableIn: 3600 });
    const taken = await insertLine();
    const success = { status: "succeeded" };
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        return [
          await tryComplete(tx, waiting, success),
          await tryComplete(tx, taken, success, OTHER_WORKER),
          await tryComplete(tx, "-1", success),
          await tryComplete(tx, taken, success),
          await tryComplete(tx, taken, success),
        ];
      }),
    );
    expect(results).toEqual([
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "rows", count: 1 },
      { outcome: "error", code: NOT_IN_PROCESSING },
    ]);
  });

  it.each([
    ["processing as an outcome", { status: "processing" }],
    ["a null dry_run", { status: "succeeded", dryRun: null }],
    ["skipped without its reason", { status: "skipped" }],
    [
      "a reason without skipped",
      { status: "failed", errorCode: "tm1.x", skipReason: "no_consent" },
    ],
    ["pending without its delay", { status: "pending", errorCode: "tm1.x" }],
    [
      "a delay without pending",
      { status: "failed", errorCode: "tm1.x", retryInSeconds: 60 },
    ],
    [
      "a negative delay",
      { status: "pending", errorCode: "tm1.x", retryInSeconds: -1 },
    ],
    [
      "a delay over 48 hours",
      { status: "pending", errorCode: "tm1.x", retryInSeconds: 172801 },
    ],
    ["pending without a cause", { status: "pending", retryInSeconds: 60 }],
    ["a cause on a success", { status: "succeeded", errorCode: "tm1.x" }],
    [
      "a message without a cause",
      { status: "skipped", skipReason: "no_consent", errorMessage: "x" },
    ],
    [
      "a provider id on a skip",
      { status: "skipped", skipReason: "no_consent", providerContactId: "c" },
    ],
    [
      "a provider id in a dry run",
      { status: "succeeded", dryRun: true, providerContactId: "c" },
    ],
    ["a malformed worker", { status: "succeeded" }, "tm1 worker"],
  ] as [string, Outcome, string?][])(
    "refuses %s (22023)",
    async (_label, outcome, worker) => {
      // checked before the line is even looked for: no line is needed
      expect(
        await asWorker((tx) =>
          tryComplete(tx, "-1", outcome, worker ?? WORKER),
        ),
      ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    },
  );

  it("refuses what does not fit the destination of the line (22023)", async () => {
    const contact = await insertLine();
    const welcome = await insertLine({
      destination: "brevo_transactional",
      emailCode: "account.welcome_creator",
    });
    const results = await withOthersLocked(() =>
      asWorker(async (tx) => {
        await claim(tx);
        await begin(tx, contact);
        await begin(tx, welcome);
        const success = { status: "succeeded" };
        return [
          // a contact line: neither a message id nor the description of a journaled send
          await tryComplete(tx, contact, {
            ...success,
            providerMessageId: "m",
          }),
          await tryComplete(tx, contact, { ...success, locale: "fr" }),
          await tryComplete(tx, contact, { ...success, templateVersion: 1 }),
          // the welcome line, live: the message id (RG94) and the language of the journal
          await tryComplete(tx, welcome, { ...success, locale: "fr" }),
          await tryComplete(tx, welcome, {
            ...success,
            providerMessageId: "m",
          }),
          await tryComplete(tx, welcome, {
            ...success,
            providerMessageId: "m",
            locale: "fr",
            providerContactId: "c",
          }),
          // a dry run journals nothing, so it describes no send
          await tryComplete(tx, welcome, {
            ...success,
            dryRun: true,
            locale: "fr",
          }),
          // and what fits is accepted
          await tryComplete(tx, contact, {
            ...success,
            providerContactId: "c",
          }),
        ];
      }),
    );
    expect(results).toEqual([
      ...Array.from({ length: 7 }, () => ({
        outcome: "error",
        code: INVALID_PARAMETER,
      })),
      { outcome: "rows", count: 1 },
    ]);
  });

  it("dry run: a simulated success is marked, and writes neither the contact state nor the journal", async () => {
    const account = await createAccount("creator");
    const contact = await insertLine({ subject: `account:${account}` });
    const welcome = await insertLine({
      subject: `account:${account}`,
      destination: "brevo_transactional",
      emailCode: "account.welcome_creator",
    });
    const results = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, contact);
        await begin(tx, welcome);
        return [
          await complete(tx, contact, { status: "succeeded", dryRun: true }),
          await complete(tx, welcome, { status: "succeeded", dryRun: true }),
        ];
      }),
    );
    expect(results).toEqual([
      {
        written_status: "succeeded",
        journal_inserted: false,
        account_id: account,
      },
      {
        written_status: "succeeded",
        journal_inserted: false,
        account_id: account,
      },
    ]);
    for (const id of [contact, welcome]) {
      expect(await lineRow(id)).toMatchObject({
        status: "succeeded",
        dry_run: true,
        provider_message_id: null,
        provider_contact_id: null,
      });
    }
    expect(await contactStates(account)).toEqual([]);
    expect(await journalOf(welcome)).toEqual([]);
  });

  it("dry run: a rejection is the same failure as in live, unmarked, without contact state", async () => {
    const account = await createAccount("advertiser");
    const id = await insertLine({ subject: `account:${account}` });
    const result = await withOthersLocked(() =>
      committedAsWorker(async (tx) => {
        await claim(tx);
        await begin(tx, id);
        return complete(tx, id, {
          status: "failed",
          dryRun: true,
          errorCode: "mapping.rejected",
        });
      }),
    );
    expect(result.written_status).toBe("failed");
    expect(await lineRow(id)).toMatchObject({
      status: "failed",
      dry_run: false,
      completed: true,
      last_error_code: "mapping.rejected",
    });
    expect(await contactStates(account)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// The take-back of orphans
// ---------------------------------------------------------------------------------------------

describe("TM1.10: leads.recover_stale_outbox_lines()", () => {
  it("takes back a line left in processing past the threshold, loses nothing, and fails the one without an attempt left", async () => {
    const orphan = await insertLine({
      processing: { by: "tm1-dead", secondsAgo: 1200 },
      attempts: 3,
    });
    const exhausted = await insertLine({
      processing: { by: "tm1-dead", secondsAgo: 1200 },
      attempts: 10,
    });
    const fresh = await insertLine({
      processing: { by: "tm1-alive", secondsAgo: 60 },
      attempts: 1,
    });
    const recovered = await committedAsWorker((tx) => recover(tx));
    expect(recovered).toEqual([
      { id: orphan, written_status: "pending" },
      { id: exhausted, written_status: "failed" },
    ]);
    expect(await lineRow(orphan)).toMatchObject({
      status: "pending",
      attempts: 3,
      locked: false,
      completed: false,
      last_error_code: "worker_interrupted",
    });
    expect(await lineRow(exhausted)).toMatchObject({
      status: "failed",
      attempts: 10,
      locked: false,
      completed: true,
      last_error_code: "worker_interrupted",
    });
    expect(await lineRow(fresh)).toMatchObject({
      status: "processing",
      locked: true,
    });
    // not lost: the orphan is taken again
    expect(await withOthersLocked(() => asWorker((tx) => claim(tx)))).toEqual([
      orphan,
    ]);
  });

  it.each([599, 86401, null])(
    "refuses a threshold of %s seconds: from 600 (the floor) to a day (22023)",
    async (seconds) => {
      expect(
        await asWorker((tx) =>
          probe(
            tx,
            "select * from leads.recover_stale_outbox_lines($1::integer)",
            [seconds],
          ),
        ),
      ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    },
  );

  it("keeps a line whose attempt has just started: the start refreshes locked_at", async () => {
    const slow = await insertLine({
      processing: { by: WORKER, secondsAgo: 1200 },
    });
    const results = await asWorker(async (tx) => {
      const attempt = (await begin(tx, slow)).attempt;
      const recovered = await recover(tx, 600);
      const outcome = (await complete(tx, slow, { status: "succeeded" }))
        .written_status;
      return { attempt, recovered, outcome };
    });
    expect(results).toEqual({
      attempt: 1,
      recovered: [],
      outcome: "succeeded",
    });
  });

  it("refuses the late start or outcome of a line taken back (55000)", async () => {
    const late = await insertLine({
      processing: { by: WORKER, secondsAgo: 1200 },
    });
    const results = await asWorker(async (tx) => [
      await recover(tx),
      await tryComplete(tx, late, { status: "succeeded" }),
      await tryBegin(tx, late),
    ]);
    expect(results).toEqual([
      [{ id: late, written_status: "pending" }],
      { outcome: "error", code: NOT_IN_PROCESSING },
      { outcome: "error", code: NOT_IN_PROCESSING },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// E-3 only: who executes, who owns, what the worker holds
// ---------------------------------------------------------------------------------------------

describe("E-3: the four functions belong to influx_leads_definer and run for influx_worker only", () => {
  const CALLS = [
    "select * from leads.claim_outbox_batch('tm1-intruder')",
    "select * from leads.begin_outbox_attempt(-1, 'tm1-intruder')",
    "select * from leads.complete_outbox_attempt(-1, 'tm1-intruder', 'failed', false, " +
      "p_error_code => 'tm1.intruder')",
    "select * from leads.recover_stale_outbox_lines()",
  ];

  function contextOf(role: "advertiser" | "admin"): UserContext {
    return {
      accountId: dataSet.accounts[role].a.id,
      role,
      aal: role === "admin" ? "aal2" : "aal1",
    };
  }

  const INTRUDERS = {
    influx_auth: () =>
      inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
        await takeRole(tx, "influx_auth");
        return probeAll(tx);
      }),
    "influx_app without a role": () =>
      inRolledBackTransaction(loginRole("influx_app"), probeAll),
    influx_advertiser: () =>
      inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
        await takeRole(tx, "influx_advertiser", contextOf("advertiser"));
        return probeAll(tx);
      }),
    influx_admin: () =>
      inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
        await takeRole(tx, "influx_admin", contextOf("admin"));
        return probeAll(tx);
      }),
    "influx_worker_login without SET LOCAL ROLE": () =>
      inRolledBackTransaction(loginRole("influx_worker_login"), probeAll),
    influx_ops: () =>
      inRolledBackTransaction(loginRole("influx_ops_login"), async (tx) => {
        await takeRole(tx, "influx_ops");
        return probeAll(tx);
      }),
  } as const;

  async function probeAll(tx: postgres.TransactionSql): Promise<ProbeResult[]> {
    const results: ProbeResult[] = [];
    for (const call of CALLS) {
      results.push(await probe(tx, call));
    }
    return results;
  }

  it.each(Object.keys(INTRUDERS) as (keyof typeof INTRUDERS)[])(
    "%s executes none of them (42501)",
    async (intruder) => {
      expect(await INTRUDERS[intruder]()).toEqual(
        CALLS.map(() => ({ outcome: "error", code: INSUFFICIENT_PRIVILEGE })),
      );
    },
  );

  it.each(FUNCTIONS)(
    "%s: SECURITY DEFINER, volatile, owned by influx_leads_definer, empty search_path, EXECUTE for influx_worker only",
    async (fn) => {
      const [definition] = await migration`
        select pg_catalog.pg_get_userbyid(proowner) as owner, prosecdef, provolatile, proconfig
          from pg_catalog.pg_proc where oid = ${fn}::regprocedure`;
      expect(definition).toEqual({
        owner: "influx_leads_definer",
        prosecdef: true,
        provolatile: "v",
        proconfig: ['search_path=""'],
      });
      const grantees = await migration<{ grantee: string }[]>`
        select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee
          from pg_catalog.pg_proc p,
               pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
         where p.oid = ${fn}::regprocedure and a.privilege_type = 'EXECUTE'
         order by 1`;
      expect(grantees.map((row) => row.grantee)).toEqual([
        "influx_leads_definer",
        "influx_worker",
      ]);
    },
  );

  it("influx_leads_definer: NOLOGIN, NOINHERIT, nothing dangerous, no usable member, no CREATE left (C-9)", async () => {
    const [role] = await migration`
      select rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb,
             rolreplication
        from pg_catalog.pg_roles where rolname = 'influx_leads_definer'`;
    expect(role).toEqual({
      rolcanlogin: false,
      rolinherit: false,
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
    });
    const members = await migration`
      select mem.rolname from pg_catalog.pg_auth_members m
        join pg_catalog.pg_roles grp on grp.oid = m.roleid
        join pg_catalog.pg_roles mem on mem.oid = m.member
       where grp.rolname = 'influx_leads_definer'
         and not (mem.rolname = current_user and m.admin_option
                  and not m.inherit_option and not m.set_option)`;
    expect(members).toEqual([]);
    const [create] = await migration`
      select pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') as leads,
             pg_catalog.has_schema_privilege('influx_leads_definer', 'identity', 'CREATE') as identity`;
    expect(create).toEqual({ leads: false, identity: false });
  });

  it("influx_worker holds no table right: USAGE on leads and audit, EXECUTE on six functions (0112: the Brevo read)", async () => {
    const schemas = OUR_SCHEMAS as unknown as string[];
    const relations = await migration<{ name: string }[]>`
      select c.oid::regclass::text as name
        from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = any (${schemas})
         and ((c.relkind in ('r', 'p', 'v', 'm', 'f')
               and (pg_catalog.has_table_privilege('influx_worker', c.oid,
                      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                    or pg_catalog.has_any_column_privilege('influx_worker', c.oid,
                      'SELECT, INSERT, UPDATE, REFERENCES')))
           or (c.relkind = 'S'
               and pg_catalog.has_sequence_privilege('influx_worker', c.oid,
                     'USAGE, SELECT, UPDATE')))`;
    expect(relations).toEqual([]);
    const usage = await migration<{ name: string }[]>`
      select nspname as name from pg_catalog.pg_namespace
       where nspname = any (${schemas})
         and pg_catalog.has_schema_privilege('influx_worker', oid, 'USAGE')
       order by 1`;
    expect(usage.map((row) => row.name)).toEqual(["audit", "leads"]);
    const functions = await migration<{ name: string }[]>`
      select p.oid::regprocedure::text as name
        from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = any (${schemas})
         and pg_catalog.has_function_privilege('influx_worker', p.oid, 'EXECUTE')
       order by 1`;
    expect(functions.map((row) => row.name)).toEqual([
      "audit.append_elevated(text,uuid)",
      "leads.begin_outbox_attempt(bigint,text)",
      "leads.claim_outbox_batch(text,integer)",
      "leads.complete_outbox_attempt(bigint,text,leads.outbox_status,boolean,text,text,text,integer,text,text,text,integer)",
      "leads.read_brevo_subject(bigint,text)",
      "leads.recover_stale_outbox_lines(integer)",
    ]);
  });

  it("writes elevated.leads.drain_outbox on an account through audit.append_elevated(), and reaches nothing else of the register (EC-52 (3))", async () => {
    const account = dataSet.accounts.creator.a.id;
    const seq = await committedAsWorker(async (tx) => {
      const [row] = await tx<{ seq: string }[]>`
        select audit.append_elevated('leads.drain_outbox', ${account}::uuid)::text as seq`;
      return row?.seq;
    });
    const [line] = await migration`
      select event_type, subject_type, subject_id::text as subject_id,
             actor_type::text as actor_type, actor_account_id::text as actor_account_id, payload
        from audit.audit_events where chain_key = 'global' and seq = ${seq ?? "0"}`;
    expect(line).toEqual({
      event_type: "elevated.leads.drain_outbox",
      subject_type: "account",
      subject_id: account,
      actor_type: "system",
      actor_account_id: null,
      payload: { operation: "leads.drain_outbox" },
    });
    const refused = await asWorker(async (tx) => [
      await probe(
        tx,
        "select audit.append('account.role_granted', 'account', gen_random_uuid())",
      ),
      await probe(
        tx,
        "select audit.append_auth_event('agent.break_glass_login', gen_random_uuid())",
      ),
      await probe(tx, "select seq from audit.audit_events limit 1"),
      await probe(tx, "select code from audit.event_types limit 1"),
    ]);
    expect(refused).toEqual(
      Array.from({ length: 4 }, () => ({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      })),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The same four steps through the worker's module and its own pool (18 T6.4, T6.5; EC-52 (3))
// ---------------------------------------------------------------------------------------------

describe("T6.4: E-3 through withElevatedTransaction (src/domains/leads/queue.ts)", () => {
  const NO_AUDIT_LINE =
    'elevated transaction without effect to audit {"operation":"leads.drain_outbox"}';

  /** The pool of worker.ts, on the local stack, with its log lines kept. */
  function workerDatabase(): { database: WorkerDatabase; logs: string[] } {
    const logs: string[] = [];
    const write = (object: object, message: string) => {
      logs.push(`${message} ${JSON.stringify(object)}`);
    };
    const logger: DbLogger = { error: write, warn: write, info: write };
    const database = createWorkerDatabase(
      {
        worker: {
          url: localRoleUrl("influx_worker_login"),
          role: "influx_worker_login",
          tls: false,
        },
      },
      logger,
    );
    return { database, logs };
  }

  function registerLinesOf(requestIds: string[]) {
    return migration<
      {
        request_id: string;
        event_type: string;
        subject_type: string;
        subject_id: string;
      }[]
    >`
      select request_id, event_type, subject_type, subject_id::text as subject_id
        from audit.audit_events where request_id = any (${requestIds}) order by seq`;
  }

  it("takes a welcome line from claim to outcome: one register line, on the account, for its journal line only", async () => {
    const account = await createAccount("advertiser");
    const id = await insertLine({
      subject: `account:${account}`,
      destination: "brevo_transactional",
      emailCode: "account.welcome_advertiser",
    });
    const requests = {
      claim: `tm1-claim-${randomUUID()}`,
      begin: `tm1-begin-${randomUUID()}`,
      complete: `tm1-complete-${randomUUID()}`,
    };
    const messageId = `<tm1-${randomUUID()}@smtp-relay.test>`;
    const { database, logs } = workerDatabase();
    try {
      const claimed = await withOthersLocked(() =>
        claimOutboxBatch(database, requests.claim, WORKER),
      );
      expect(claimed).toEqual([
        {
          id,
          eventId: expect.any(String) as string,
          eventType: "lead.created",
          destination: "brevo_transactional",
          subjectKey: `account:${account}`,
          priority: 100,
          payload: expect.objectContaining({
            account_id: account,
            email_code: "account.welcome_advertiser",
          }) as Record<string, unknown>,
          idempotencyKey: expect.stringMatching(/^tm1:/) as string,
        },
      ]);

      const state = await beginOutboxAttempt(
        database,
        requests.begin,
        id,
        WORKER,
      );
      expect(state).toEqual({
        attempt: 1,
        account: {
          id: account,
          status: "active",
          role: "advertiser",
          declaredStatus: "business",
          countryCode: "BE",
          preferredLanguage: "en",
          emailVerified: true,
          marketingEmailConsent: true,
          commercialProspectionConsent: true,
        },
        settings: expect.any(Object) as Record<string, unknown>,
      });
      expect(Object.keys(state.settings).sort()).toEqual(WORKER_SETTINGS);

      const completed = await completeOutboxAttempt(
        database,
        requests.complete,
        id,
        WORKER,
        {
          status: "succeeded",
          dryRun: false,
          providerMessageId: messageId,
          locale: "en",
          templateVersion: 1,
        },
      );
      expect(completed).toEqual({
        writtenStatus: "succeeded",
        journalInserted: true,
      });
    } finally {
      await closeDatabase(database);
    }
    expect(await journalOf(id)).toHaveLength(1);
    // EC-52 (3): the journal line is the only subject; the claim and the start are a pino line each
    expect(await registerLinesOf(Object.values(requests))).toEqual([
      {
        request_id: requests.complete,
        event_type: "elevated.leads.drain_outbox",
        subject_type: "account",
        subject_id: account,
      },
    ]);
    expect(logs.filter((line) => line === NO_AUDIT_LINE)).toHaveLength(2);
  });

  it("closes contact lines (live success, skip, dry run) and makes one wait, without any register line", async () => {
    const live = await insertLine();
    const skipped = await insertLine();
    const simulated = await insertLine();
    const waiting = await insertLine({ destination: "apollo_contact" });
    const requestId = `tm1-contacts-${randomUUID()}`;
    const { database } = workerDatabase();
    try {
      const claimed = await withOthersLocked(() =>
        claimOutboxBatch(database, requestId, WORKER),
      );
      expect(claimed.map((line) => line.id).sort()).toEqual(
        [live, skipped, simulated, waiting].sort(),
      );
      for (const id of [live, skipped, simulated, waiting]) {
        const state = await beginOutboxAttempt(database, requestId, id, WORKER);
        // a subject without an account row: no account state, the settings all the same
        expect(state.account).toBeNull();
      }
      const written = [
        await completeOutboxAttempt(database, requestId, live, WORKER, {
          status: "succeeded",
          dryRun: false,
          providerContactId: "tm1-contact-42",
        }),
        await completeOutboxAttempt(database, requestId, skipped, WORKER, {
          status: "skipped",
          dryRun: false,
          reason: "no_consent",
        }),
        await completeOutboxAttempt(database, requestId, simulated, WORKER, {
          status: "succeeded",
          dryRun: true,
        }),
        await completeOutboxAttempt(database, requestId, waiting, WORKER, {
          status: "pending",
          dryRun: false,
          errorCode: "apollo.unavailable",
          errorMessage: "Apollo answered 503 for tm1@example.test",
          retryInSeconds: 60,
        }),
      ];
      expect(written).toEqual([
        { writtenStatus: "succeeded", journalInserted: false },
        { writtenStatus: "skipped", journalInserted: false },
        { writtenStatus: "succeeded", journalInserted: false },
        { writtenStatus: "pending", journalInserted: false },
      ]);
    } finally {
      await closeDatabase(database);
    }
    expect(await lineRow(live)).toMatchObject({
      status: "succeeded",
      provider_contact_id: "tm1-contact-42",
      dry_run: false,
    });
    expect(await lineRow(skipped)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
    });
    expect(await lineRow(simulated)).toMatchObject({
      status: "succeeded",
      dry_run: true,
    });
    const retried = await lineRow(waiting);
    expect(retried).toMatchObject({
      status: "pending",
      attempts: 1,
      locked: false,
      last_error_code: "apollo.unavailable",
      last_error_message: "Apollo answered 503 for [address]",
    });
    expect(retried.waits_seconds).toBeGreaterThanOrEqual(55);
    expect(retried.waits_seconds).toBeLessThanOrEqual(60);
    expect(await registerLinesOf([requestId])).toEqual([]);
  });

  it("takes back a stale line without any register line (TM1.10)", async () => {
    const stale = await insertLine({
      processing: { by: OTHER_WORKER, secondsAgo: 700 },
    });
    const fresh = await insertLine({
      processing: { by: OTHER_WORKER, secondsAgo: 10 },
    });
    const requestId = `tm1-recover-${randomUUID()}`;
    const { database } = workerDatabase();
    try {
      const recovered = await recoverStaleOutboxLines(database, requestId);
      // stale lines of an interrupted earlier run may come back too: keep this case's own
      expect(
        recovered.filter((line) => line.id === stale || line.id === fresh),
      ).toEqual([{ id: stale, writtenStatus: "pending" }]);
    } finally {
      await closeDatabase(database);
    }
    expect(await lineRow(fresh)).toMatchObject({ status: "processing" });
    expect(await registerLinesOf([requestId])).toEqual([]);
  });
});
