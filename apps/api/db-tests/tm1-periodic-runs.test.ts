// TM1 (J7, commit 2) — E-4 `maintenance.run_periodic`, the database half (migration 0117,
// decision 3 of the J7 start; 05 RG91, 16 RG113, 04 §9; decision 2 for the 30-day purge):
// ops.claim_periodic_run(), ops.finish_periodic_run(), ops.filter_auth_orphans(),
// ops.record_retention_purge(), ops.purge_brevo_inbound_events(), all owned by
// influx_maintenance_definer and executable by influx_worker only. The scheduler, the GoTrue calls
// and the reconciliation are commit 5.
//
// ops.periodic_runs refuses deletes, and a claimed CURRENT period would stand in the way of the
// next case: each case runs in ONE rolled-back transaction of the local superuser, the functions
// under the session_user / current_user pair of the worker (actAs, support.ts).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
} from "@influx/test-kit/db";
import { randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { actAs, localSuperuser, loginRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";

type Task =
  "brevo_reconciliation" | "auth_orphan_purge" | "brevo_inbound_purge";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** The current UTC period of a task, read from the transaction clock. */
async function currentPeriod(
  tx: postgres.TransactionSql,
  task: Task,
): Promise<string> {
  const [row] = await tx<{ key: string }[]>`
    select to_char(now() at time zone 'UTC',
                   case when ${task} = 'auth_orphan_purge' then 'YYYY-MM-DD"T"HH24'
                        else 'YYYY-MM-DD' end) as key`;
  if (row === undefined) {
    throw new Error("no clock");
  }
  return row.key;
}

type Claim = { run_id: string; attempt: number };

async function claim(
  tx: postgres.TransactionSql,
  task: Task,
  period?: string,
): Promise<Claim | undefined> {
  const key = period ?? (await currentPeriod(tx, task));
  return actAs(tx, "worker", async () => {
    const [row] = await tx<Claim[]>`
      select run_id::text, attempt from ops.claim_periodic_run(${task}::ops.periodic_task, ${key})`;
    return row;
  });
}

async function claimed(
  tx: postgres.TransactionSql,
  task: Task,
): Promise<Claim> {
  const run = await claim(tx, task);
  if (run === undefined) {
    throw new Error(`the current period of ${task} could not be claimed`);
  }
  return run;
}

function asWorker(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<ProbeResult> {
  return actAs(tx, "worker", () => probe(tx, statement, parameters));
}

async function runOf(tx: postgres.TransactionSql, id: string) {
  const [row] = await tx<
    {
      attempt: number;
      outcome: string | null;
      counts: Record<string, number>;
      finished_now: boolean | null;
      started_now: boolean;
    }[]
  >`
    select attempt, outcome::text, counts, finished_at = now() as finished_now,
           started_at = now() as started_now
      from ops.periodic_runs where id = ${id}`;
  return row;
}

async function purgeLines(tx: postgres.TransactionSql, run: string) {
  return tx<{ payload: Record<string, unknown>; actor_type: string }[]>`
    select payload, actor_type::text from audit.audit_events
     where event_type = 'retention.purged' and subject_type = 'periodic_run'
       and subject_id = ${run}`;
}

// ---------------------------------------------------------------------------------------------

describe("ops.claim_periodic_run()", () => {
  it("claims the current period once: attempt 1, then nothing while it runs", async () => {
    const result = await scenario(async (tx) => {
      const first = await claim(tx, "brevo_reconciliation");
      const second = await claim(tx, "brevo_reconciliation");
      const run =
        first === undefined ? undefined : await runOf(tx, first.run_id);
      return { first, second, run };
    });
    expect(result.first?.attempt).toBe(1);
    expect(result.second).toBeUndefined();
    expect(result.run).toMatchObject({
      attempt: 1,
      outcome: null,
      started_now: true,
    });
  });

  it("takes back a run left unfinished for over an hour: attempt + 1, counts reset", async () => {
    const result = await scenario(async (tx) => {
      const key = await currentPeriod(tx, "auth_orphan_purge");
      const [stale] = await tx<{ id: string }[]>`
        insert into ops.periodic_runs (task_code, period_key, started_at, counts)
        values ('auth_orphan_purge', ${key}, now() - interval '61 minutes', '{"listed": 3}')
        returning id::text`;
      const taken = await claim(tx, "auth_orphan_purge");
      return {
        stale: stale?.id,
        taken,
        run: stale === undefined ? undefined : await runOf(tx, stale.id),
      };
    });
    expect(result.taken).toEqual({ run_id: result.stale, attempt: 2 });
    expect(result.run).toMatchObject({
      attempt: 2,
      counts: {},
      started_now: true,
    });
  });

  it("leaves a finished period alone", async () => {
    const taken = await scenario(async (tx) => {
      const key = await currentPeriod(tx, "brevo_inbound_purge");
      await tx`
        insert into ops.periodic_runs
          (task_code, period_key, started_at, finished_at, outcome)
        values ('brevo_inbound_purge', ${key}, now() - interval '2 hours',
                now() - interval '2 hours', 'succeeded')`;
      return claim(tx, "brevo_inbound_purge");
    });
    expect(taken).toBeUndefined();
  });

  it.each([
    ["a past day", "brevo_reconciliation", "2026-01-01"],
    ["a day for an hourly task", "auth_orphan_purge", "today"],
    ["an hour for a daily task", "brevo_reconciliation", "this hour"],
  ] as const)(
    "refuses %s (22023): only the current period",
    async (_label, task, period) => {
      const result = await scenario(async (tx) => {
        const key =
          period === "today"
            ? await currentPeriod(tx, "brevo_reconciliation")
            : period === "this hour"
              ? await currentPeriod(tx, "auth_orphan_purge")
              : period;
        return asWorker(
          tx,
          "select * from ops.claim_periodic_run($1::ops.periodic_task, $2)",
          [task, key],
        );
      });
      expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    },
  );

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(
          tx,
          "select * from ops.claim_periodic_run('brevo_reconciliation', to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))",
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("ops.finish_periodic_run()", () => {
  it("closes the run of this attempt once, with its outcome and counts", async () => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_reconciliation");
      const finish = (attempt: number) =>
        actAs(tx, "worker", async () => {
          const [row] = await tx<{ done: boolean }[]>`
            select ops.finish_periodic_run(${run.run_id}::uuid, ${attempt}::smallint,
                     'succeeded', '{"found": 2, "gap": 1}'::jsonb) as done`;
          return row?.done;
        });
      return {
        first: await finish(1),
        again: await finish(1),
        run: await runOf(tx, run.run_id),
      };
    });
    expect(result.first).toBe(true);
    expect(result.again).toBe(false);
    expect(result.run).toMatchObject({
      outcome: "succeeded",
      counts: { found: 2, gap: 1 },
      finished_now: true,
    });
  });

  it("writes nothing for an attempt that was taken back (fencing)", async () => {
    const done = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_reconciliation");
      return actAs(tx, "worker", async () => {
        const [row] = await tx<{ done: boolean }[]>`
          select ops.finish_periodic_run(${run.run_id}::uuid, 2::smallint, 'failed') as done`;
        return row?.done;
      });
    });
    expect(done).toBe(false);
  });

  it.each([
    ["a negative count", { gap: -1 }],
    ["a decimal count", { gap: 1.5 }],
    ["a text value", { gap: "one" }],
    ["a key out of format", { "Gap-Count": 1 }],
    ["an array", [1, 2]],
  ])("refuses %s in the counts (22023)", async (_label, counts) => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_reconciliation");
      return asWorker(
        tx,
        "select ops.finish_periodic_run($1::uuid, 1::smallint, 'succeeded', $2::text::jsonb)",
        [run.run_id, JSON.stringify(counts)],
      );
    });
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("accepts well-formed counts through the same path (witness of the refusals above)", async () => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_reconciliation");
      return asWorker(
        tx,
        "select ops.finish_periodic_run($1::uuid, 1::smallint, 'succeeded', $2::text::jsonb)",
        [run.run_id, JSON.stringify({ gap: 0, found: 12 })],
      );
    });
    expect(result).toEqual({ outcome: "rows", count: 1 });
  });
});

describe("ops.filter_auth_orphans() (04 §9: on auth_user_id, never on an address)", () => {
  it("returns the GoTrue ids no account references, without duplicates", async () => {
    const result = await scenario(async (tx) => {
      const [known] = await tx<{ id: string }[]>`
        select auth_user_id::text as id from identity.accounts
         where id = ${dataSet.accounts.creator.a.id}`;
      const orphan = randomUUID();
      const run = await claimed(tx, "auth_orphan_purge");
      const rows = await actAs(
        tx,
        "worker",
        () =>
          tx<{ auth_user_id: string }[]>`
          select auth_user_id::text from ops.filter_auth_orphans(${run.run_id}::uuid,
                   ${run.attempt}::smallint, ${[known?.id ?? "", orphan, orphan]}::uuid[])`,
      );
      return { orphan, rows: rows.map((row) => row.auth_user_id) };
    });
    expect(result.rows).toEqual([result.orphan]);
  });

  it("works inside the open auth_orphan_purge run of this attempt only (55000)", async () => {
    const results = await scenario(async (tx) => {
      const purge = await claimed(tx, "auth_orphan_purge");
      const other = await claimed(tx, "brevo_inbound_purge");
      const statement =
        "select * from ops.filter_auth_orphans($1::uuid, $2::smallint, array[gen_random_uuid()])";
      return [
        await asWorker(tx, statement, [purge.run_id, 2]),
        await asWorker(tx, statement, [other.run_id, other.attempt]),
      ];
    });
    expect(results).toEqual([
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
    ]);
  });

  it("refuses to name any orphan while identity.accounts reads empty (55000, J7S-2 breaker)", async () => {
    const results = await scenario(async (tx) => {
      const run = await claimed(tx, "auth_orphan_purge");
      const statement =
        "select * from ops.filter_auth_orphans($1::uuid, $2::smallint, array[gen_random_uuid()])";
      const witness = await asWorker(tx, statement, [run.run_id, run.attempt]);
      // A policy gone wrong: every account hidden from the owner of the function (rolled back).
      await tx`alter policy accounts_maintenance_definer_select on identity.accounts
                 using (false)`;
      return [
        witness,
        await asWorker(tx, statement, [run.run_id, run.attempt]),
      ];
    });
    expect(results).toEqual([
      { outcome: "rows", count: 1 },
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
    ]);
  });

  it.each([
    [
      "1001 ids",
      "select array_agg(gen_random_uuid()) from generate_series(1, 1001)",
    ],
    ["a NULL id", "select array[gen_random_uuid(), null]"],
  ])("refuses %s (22023)", async (_label, ids) => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "auth_orphan_purge");
      return asWorker(
        tx,
        `select * from ops.filter_auth_orphans($1::uuid, $2::smallint, (${ids}))`,
        [run.run_id, run.attempt],
      );
    });
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });
});

describe("ops.record_retention_purge() (retention.purged of a purge through an API)", () => {
  it("writes {category, count} on the run, as a system act of the worker", async () => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "auth_orphan_purge");
      await actAs(
        tx,
        "worker",
        () =>
          tx`select ops.record_retention_purge(${run.run_id}::uuid, ${run.attempt}::smallint,
                    'auth_orphan_users', 3)`,
      );
      return purgeLines(tx, run.run_id);
    });
    expect(result).toEqual([
      {
        payload: { category: "auth_orphan_users", count: 3 },
        actor_type: "system",
      },
    ]);
  });

  it.each([
    ["nothing purged", "auth_orphan_users", 0, INVALID_PARAMETER],
    ["an unknown category", "brevo_inbound_events", 1, INVALID_PARAMETER],
  ] as const)("refuses %s", async (_label, category, count, code) => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "auth_orphan_purge");
      return asWorker(
        tx,
        "select ops.record_retention_purge($1::uuid, $2::smallint, $3, $4)",
        [run.run_id, run.attempt, category, count],
      );
    });
    expect(result).toEqual({ outcome: "error", code });
  });

  it("refuses a run of another task (55000)", async () => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_reconciliation");
      return asWorker(
        tx,
        "select ops.record_retention_purge($1::uuid, $2::smallint, $3, 1)",
        [run.run_id, run.attempt, "auth_orphan_users"],
      );
    });
    expect(result).toEqual({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
  });
});

describe("ops.purge_brevo_inbound_events() (decision 2: 30 days after the outcome, never before)", () => {
  /** A raw line received `days` ago, with an outcome `processedDaysAgo` ago (or none). */
  async function rawLine(
    tx: postgres.TransactionSql,
    days: number,
    processedDaysAgo: number | null,
  ): Promise<string> {
    const [row] = await tx<{ id: string }[]>`
      insert into leads.brevo_inbound_events
        (origin, dedup_key, event, occurred_at, received_at)
      values ('webhook', ${randomBytes(32)}, 'delivered',
              now() - make_interval(days => ${days}), now() - make_interval(days => ${days}))
      returning id::text`;
    if (row === undefined) {
      throw new Error("no line");
    }
    if (processedDaysAgo !== null) {
      await tx`
        insert into leads.brevo_inbound_outcomes (event_id, outcome, processed_at)
        values (${row.id}, 'informative', now() - make_interval(days => ${processedDaysAgo}))`;
    }
    return row.id;
  }

  async function remaining(tx: postgres.TransactionSql, ids: string[]) {
    const rows = await tx<{ id: string; with_outcome: boolean }[]>`
      select e.id::text,
             exists (select 1 from leads.brevo_inbound_outcomes o where o.event_id = e.id)
               as with_outcome
        from leads.brevo_inbound_events e where e.id = any (${ids}::uuid[])`;
    return rows;
  }

  it("deletes the lines processed over 30 days ago with their outcome, keeps the others, writes retention.purged", async () => {
    const result = await scenario(async (tx) => {
      const old = await rawLine(tx, 40, 31);
      const recent = await rawLine(tx, 40, 29);
      const waiting = await rawLine(tx, 40, null);
      const run = await claimed(tx, "brevo_inbound_purge");
      const count = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ count: number }[]>`
          select ops.purge_brevo_inbound_events(${run.run_id}::uuid, ${run.attempt}::smallint)
                   as count`;
        return row?.count;
      });
      return {
        count,
        old,
        recent,
        waiting,
        left: await remaining(tx, [old, recent, waiting]),
        lines: await purgeLines(tx, run.run_id),
      };
    });
    expect(result.count).toBe(1);
    expect(result.left.map((row) => row.id).sort()).toEqual(
      [result.recent, result.waiting].sort(),
    );
    expect(result.lines).toEqual([
      {
        payload: { category: "brevo_inbound_events", count: 1 },
        actor_type: "system",
      },
    ]);
  });

  it("writes no register line when nothing is due", async () => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, "brevo_inbound_purge");
      const count = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ count: number }[]>`
          select ops.purge_brevo_inbound_events(${run.run_id}::uuid, ${run.attempt}::smallint)
                   as count`;
        return row?.count;
      });
      return { count, lines: await purgeLines(tx, run.run_id) };
    });
    expect(result).toEqual({ count: 0, lines: [] });
  });

  it("deletes at most the batch size", async () => {
    const count = await scenario(async (tx) => {
      for (let index = 0; index < 3; index += 1) {
        await rawLine(tx, 40, 31);
      }
      const run = await claimed(tx, "brevo_inbound_purge");
      return actAs(tx, "worker", async () => {
        const [row] = await tx<{ count: number }[]>`
          select ops.purge_brevo_inbound_events(${run.run_id}::uuid, ${run.attempt}::smallint, 2)
                   as count`;
        return row?.count;
      });
    });
    expect(count).toBe(2);
  });

  it.each([
    ["a batch of 0", "brevo_inbound_purge", 0, INVALID_PARAMETER],
    ["a batch of 10001", "brevo_inbound_purge", 10001, INVALID_PARAMETER],
    [
      "a run of another task",
      "auth_orphan_purge",
      10,
      NOT_IN_PREREQUISITE_STATE,
    ],
  ] as const)("refuses %s", async (_label, task, limit, code) => {
    const result = await scenario(async (tx) => {
      const run = await claimed(tx, task);
      return asWorker(
        tx,
        "select ops.purge_brevo_inbound_events($1::uuid, $2::smallint, $3)",
        [run.run_id, run.attempt, limit],
      );
    });
    expect(result).toEqual({ outcome: "error", code });
  });
});

describe("ops.periodic_runs is written through the functions only", () => {
  it.each([
    [
      "changes the period",
      "update ops.periodic_runs set period_key = '2026-01-02' where period_key = '2026-01-01'",
    ],
    [
      "reopens a finished run",
      "update ops.periodic_runs set finished_at = null, outcome = null where period_key = '2026-01-01'",
    ],
    [
      "deletes a run",
      "delete from ops.periodic_runs where period_key = '2026-01-01'",
    ],
  ])(
    "stops even the superuser when it %s (42501)",
    async (_label, statement) => {
      expect(await scenario((tx) => probe(tx, statement))).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );
});
