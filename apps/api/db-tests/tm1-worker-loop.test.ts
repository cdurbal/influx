// TM1 (J6, commit 3) — the worker loop of E-3 `leads.drain_outbox` (src/domains/leads/drain.ts)
// on the real queue: the worker's module and pool (queue.ts, influx_worker_login), with in-memory
// connectors (16 RG148: no test reaches Brevo or Apollo). 05 CA47 (a revocation before 50 ordinary
// lines), CA48 (the schedule of RG79, then the definitive failure at the tenth attempt), CA50 (two
// events of one account in the order of emission), and lead-pipeline T9 on the real pool: while a
// connector waits, the worker holds no transaction and no lock (02 §18.4 G4).
// Queue lines are inserted and COMMITTED by the migration role, on fresh subjects without an
// account (no contact state is written), and removed after each case. While the worker claims, a
// transaction of the migration role holds every OTHER pending line of the stack: SKIP LOCKED
// passes over them, so that a case sees its own lines only (as in tm1-outbox-claim).
import { inRolledBackTransaction, localRoleUrl } from "@influx/test-kit/db";
import { captureLogStream } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, createWorkerDatabase } from "../src/db/index.ts";
import type { CallResult, Connector } from "../src/domains/leads/connector.ts";
import {
  createOutboxDrain,
  type SyncSettings,
} from "../src/domains/leads/drain.ts";
import { createWorkerQueue } from "../src/domains/leads/queue.ts";
import type { ClaimedLine } from "../src/domains/leads/repository.ts";
import { createLogger } from "../src/platform/logger.ts";
import { migrationRole } from "./support.ts";

/** The starting values of 05 RG79 seeded by 0103 (EC-9). */
const SCHEDULE = [0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400];

let migration: postgres.Sql;

beforeAll(() => {
  migration = migrationRole();
});

const lines: string[] = [];

afterEach(async () => {
  const lineIds = lines.splice(0);
  if (lineIds.length > 0) {
    await migration`
      delete from leads.outbox_events where id = any (${lineIds}::bigint[])`;
  }
});

type LineSpec = {
  subject?: string;
  eventType?: string;
  priority?: number;
};

/** A committed brevo_contact line; the payload carries identifiers only (05 RG74). */
async function insertLine(spec: LineSpec = {}): Promise<string> {
  const subject = spec.subject ?? `account:${randomUUID()}`;
  const event = randomUUID();
  const payload = JSON.stringify({
    event_id: event,
    account_id: subject.slice("account:".length),
  });
  const [row] = await migration<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (${event}, ${spec.eventType ?? "lead.created"}, 'brevo_contact', ${subject},
            ${spec.priority ?? 100}::smallint,
            ${payload}::text::jsonb,
            ${`tm1-loop:${event}`})
    returning id::text as id`;
  if (row === undefined) {
    throw new Error("the queue line was not inserted");
  }
  lines.push(row.id);
  return row.id;
}

type LineRow = {
  status: string;
  attempts: number;
  waits_seconds: number;
  completed: boolean;
  dry_run: boolean;
  last_error_code: string | null;
};

async function lineRow(id: string): Promise<LineRow> {
  const [row] = await migration<LineRow[]>`
    select status::text as status, attempts,
           round(extract(epoch from available_at - now()))::int as waits_seconds,
           completed_at is not null as completed, dry_run, last_error_code
      from leads.outbox_events where id = ${id}`;
  if (row === undefined) {
    throw new Error("the queue line was not found");
  }
  return row;
}

/** Runs `fn` while every pending line that is not one of this case's is held. */
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

/** An in-memory Brevo contact connector: records the lines it prepares and calls. */
function contactConnector(
  result: (line: ClaimedLine) => Promise<CallResult> | CallResult = () => ({
    kind: "succeeded",
    providerContactId: "tm1-loop-contact",
  }),
) {
  const prepared: string[] = [];
  const sent: string[] = [];
  const connector: Connector = {
    destination: "brevo_contact",
    hasCredentials: true,
    prepare(line) {
      prepared.push(line.id);
      return Promise.resolve({
        kind: "mapped",
        description: {
          operation: "upsert_contact",
          templateCode: null,
          attributeNames: ["LANGUAGE"],
          rejectedAttributeNames: [],
        },
        recipientDomain: "example.test",
        send: async () => {
          sent.push(line.id);
          return result(line);
        },
      });
    },
  };
  return { connector, prepared, sent };
}

/** One turn of the drain on the worker's pool, the other lines of the stack held. */
async function turnOnWorkerPool(
  connector: Connector,
  mode: SyncSettings["mode"],
): Promise<number> {
  const logger = createLogger(
    { service: "worker", environment: "staging", version: "test" },
    captureLogStream().destination,
  );
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
  try {
    const drain = createOutboxDrain({
      queue: createWorkerQueue(database),
      connectors: { brevo_contact: connector },
      worker: `tm1-loop-${randomUUID().slice(0, 8)}`,
      sync: {
        mode,
        environment: "staging",
        nonProductionRecipientAllowlist: ["example.test"],
      },
      logger,
      now: () => Date.now(),
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    });
    return await withOthersLocked(() =>
      drain.turn(new AbortController().signal),
    );
  } finally {
    await closeDatabase(database);
  }
}

describe("05 CA47, RG78: a revocation is processed before the ordinary lines", () => {
  it("takes a priority-0 line emitted after 50 ordinary lines first", async () => {
    const ordinary: string[] = [];
    for (let line = 0; line < 50; line += 1) {
      ordinary.push(await insertLine());
    }
    // RG78 gives a revocation priority 0; its code consent.revoked enters audit.event_types with
    // its emitter (J7), so the line is a lead.updated of priority 0 here.
    const revocation = await insertLine({
      eventType: "lead.updated",
      priority: 0,
    });
    const { connector, prepared } = contactConnector();

    expect(await turnOnWorkerPool(connector, "dry_run")).toBe(20);
    expect(prepared[0]).toBe(revocation);
    expect(await lineRow(revocation)).toMatchObject({
      status: "succeeded",
      dry_run: true,
    });
    // the batch holds 20 lines: the revocation and the 19 oldest ordinary ones
    expect(prepared.slice(1)).toEqual(ordinary.slice(0, 19));
    expect(await lineRow(ordinary[49] ?? "")).toMatchObject({
      status: "pending",
      attempts: 0,
    });
  });
});

describe("05 CA48, RG79: the retry schedule, then the definitive failure", () => {
  it("waits retry_schedule[attempt] after each failed attempt, and fails at the tenth, cause in clear", async () => {
    const id = await insertLine();
    const { connector, sent } = contactConnector(() => ({
      kind: "retry",
      errorCode: "brevo.unavailable",
      errorMessage: "Brevo answered 503",
    }));
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      // the wait is checked, then cut short: the next attempt is due now
      await migration`
        update leads.outbox_events set available_at = now() where id = ${id}`;
      expect(await turnOnWorkerPool(connector, "live")).toBe(1);
      const row = await lineRow(id);
      expect(row.attempts).toBe(attempt);
      if (attempt < 10) {
        expect(row).toMatchObject({
          status: "pending",
          last_error_code: "brevo.unavailable",
        });
        expect(row.waits_seconds).toBeGreaterThanOrEqual(
          (SCHEDULE[attempt] ?? 0) - 5,
        );
        expect(row.waits_seconds).toBeLessThanOrEqual(SCHEDULE[attempt] ?? 0);
      }
    }
    expect(sent).toHaveLength(10);
    // visible (failed, its cause in clear) and replayable from the backoffice (J8)
    expect(await lineRow(id)).toMatchObject({
      status: "failed",
      attempts: 10,
      completed: true,
      last_error_code: "brevo.unavailable",
    });
  });
});

describe("05 CA50, RG77: two events of one account, consumed in the order of emission", () => {
  it("never takes the second while the first is not closed", async () => {
    const subject = `account:${randomUUID()}`;
    const created = await insertLine({ subject });
    const updated = await insertLine({ subject, eventType: "lead.updated" });
    const { connector, prepared } = contactConnector();

    expect(await turnOnWorkerPool(connector, "dry_run")).toBe(1);
    expect(prepared).toEqual([created]);
    expect(await lineRow(updated)).toMatchObject({
      status: "pending",
      attempts: 0,
    });

    expect(await turnOnWorkerPool(connector, "dry_run")).toBe(1);
    expect(prepared).toEqual([created, updated]);
  });
});

describe("lead-pipeline T9, 02 §18.4 G4: no transaction and no lock while a connector waits", () => {
  it("leaves the worker's connections idle, outside any transaction, during the call", async () => {
    const id = await insertLine();
    let during: { state: string; locks: number }[] = [];
    // the provider is slow: it is still answering when its state is read
    const { connector } = contactConnector(async () => {
      during = await migration<{ state: string; locks: number }[]>`
        select a.state,
               (select count(*) from pg_catalog.pg_locks l
                 where l.pid = a.pid and l.relation = 'leads.outbox_events'::regclass)::int
                 as locks
          from pg_catalog.pg_stat_activity a
         where a.usename = 'influx_worker_login'
           and a.application_name = 'influx-worker'`;
      return { kind: "succeeded", providerContactId: "tm1-loop-contact" };
    });

    expect(await turnOnWorkerPool(connector, "live")).toBe(1);
    expect(during.length).toBeGreaterThan(0);
    expect(during.filter((backend) => backend.state !== "idle")).toEqual([]);
    expect(during.filter((backend) => backend.locks > 0)).toEqual([]);
    expect(await lineRow(id)).toMatchObject({ status: "succeeded" });
  });
});
