// TM1.16 and the base part of TM1.12 (D67, 05 RG161, RG163, CA88; migration 0145): two triggers
// on leads.sync_settings.
// - The guard: a Brevo id once set (a sub-key of brevo_list_ids or brevo_template_ids) is never
//   set back to null nor removed, the two rows are never deleted nor truncated; replacing an id by
//   another positive integer and adding a sub-key at null stay possible. No execution role can lift
//   it (disable the trigger, drop it, or set session_replication_role): only a reviewed migration.
// - The journal: every write that changes a value, whatever the path (the worker's function, the
//   backoffice writer of 0141, direct SQL of an operator, a migration), writes EXACTLY ONE
//   settings.changed, chained by audit.append(), on the subject of EC-J8-28, with from/to (or their
//   digests beyond 3000 octets, EC-J8-30); a write that changes nothing writes nothing. The same
//   trigger keeps updated_at, the date of modification of the key read by the catch-up of RG161.
//   The backoffice path (2V, reevaluated) is covered on the real route by
//   t14-backoffice-actions-route.
//
// Each case runs in ONE rolled-back transaction of the local superuser (RG163 (1): an id posed here
// is undone by that isolation, never by a reset to null). The operator is the migration role
// (`postgres`, owner of the table, the runbook's SQL path), taken by SET SESSION AUTHORIZATION so
// that session_user names it as in a real session. Values are read first and changed relatively:
// a committed id left by another file of the local stack never decides the outcome.
import { inRolledBackTransaction, probe } from "@influx/test-kit/db";
import { EXECUTION_ROLES } from "@influx/test-kit/rights";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, localSuperuser } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const RESTRICT_VIOLATION = "23001";
const CHECK_VIOLATION = "23514";
const CONTEXT = "influx.sync_setting_change";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Ids = Record<string, number | null>;
type Line = {
  seq: string;
  actor_type: string;
  actor_account_id: string | null;
  payload: Record<string, Json>;
};

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** Direct SQL of an operator: the migration role, owner of the table (05 RG163, runbook). */
async function asOperator<T>(
  tx: postgres.TransactionSql,
  fn: () => Promise<T>,
): Promise<T> {
  await tx.unsafe("set local session authorization postgres");
  const result = await fn();
  await tx.unsafe("reset session authorization");
  return result;
}

/** One statement of the operator, inside a savepoint: rows affected, or the SQLSTATE. */
function operatorProbe(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
) {
  return asOperator(tx, () => probe(tx, statement, parameters));
}

async function valueOf(
  tx: postgres.TransactionSql,
  key: string,
): Promise<Json> {
  const [row] = await tx<{ value: Json }[]>`
    select value from leads.sync_settings where key = ${key}`;
  return row?.value ?? null;
}

async function stampsOf(
  tx: postgres.TransactionSql,
): Promise<Record<string, { updated_at: string; author: string | null }>> {
  const rows = await tx<
    { key: string; updated_at: string; author: string | null }[]
  >`
    select key, updated_at::text as updated_at, updated_by_account_id::text as author
      from leads.sync_settings order by key`;
  return Object.fromEntries(
    rows.map((row) => [
      row.key,
      { updated_at: row.updated_at, author: row.author },
    ]),
  );
}

/** The settings.changed lines of THIS transaction for a key (EC-J8-28 subject). */
function journalOf(tx: postgres.TransactionSql, key: string): Promise<Line[]> {
  return tx<Line[]>`
    select seq::text as seq, actor_type::text as actor_type,
           actor_account_id::text as actor_account_id, payload
      from audit.audit_events
     where event_type = 'settings.changed'
       and subject_type = 'setting'
       and subject_id = md5('leads.sync_settings:' || ${key})::uuid
       and occurred_at = now()
     order by seq`;
}

/** Every settings.changed line of THIS transaction, whatever the key. */
async function allLinesOfTransaction(
  tx: postgres.TransactionSql,
): Promise<number> {
  const [row] = await tx<{ n: number }[]>`
    select count(*)::int as n from audit.audit_events
     where event_type = 'settings.changed' and occurred_at = now()`;
  return row?.n ?? -1;
}

/** The line is a link of the global chain: its prev_hash is the row_hash of the line before. */
async function isChained(
  tx: postgres.TransactionSql,
  seq: string,
): Promise<boolean> {
  const [row] = await tx<{ chained: boolean }[]>`
    select e.prev_hash = p.row_hash as chained
      from audit.audit_events e
      join audit.audit_events p on p.chain_key = e.chain_key and p.seq = e.seq - 1
     where e.chain_key = 'global' and e.seq = ${seq}::bigint`;
  return row?.chained === true;
}

/** A positive id that differs from every id of `ids`. */
function freshId(ids: Ids, offset = 0): number {
  const taken = new Set(Object.values(ids));
  let id = 800_000 + offset + Math.floor(Math.random() * 100_000);
  while (taken.has(id)) id += 1;
  return id;
}

async function listIdsOf(tx: postgres.TransactionSql): Promise<Ids> {
  return (await valueOf(tx, "brevo_list_ids")) as Ids;
}

/** Sets brevo_list_ids.creators to a fresh id, as the operator; returns the value before and after. */
async function setCreatorsList(
  tx: postgres.TransactionSql,
): Promise<{ before: Ids; after: Ids }> {
  const before = await listIdsOf(tx);
  const id = freshId(before);
  await asOperator(
    tx,
    () => tx`
      update leads.sync_settings
         set value = jsonb_set(value, '{creators}', to_jsonb(${id}::int))
       where key = 'brevo_list_ids'`,
  );
  return { before, after: { ...before, creators: id } };
}

/**
 * Constant statements per execution role (03 P7 rule 4: never an interpolated role name), the way
 * apps/api takes each one: the connection role, then SET LOCAL ROLE for a business role.
 */
const BECOME: Readonly<
  Record<(typeof EXECUTION_ROLES)[number], readonly string[]>
> = {
  influx_app: ["set local session authorization influx_app"],
  influx_auth_login: ["set local session authorization influx_auth_login"],
  influx_worker_login: ["set local session authorization influx_worker_login"],
  influx_ops_login: ["set local session authorization influx_ops_login"],
  influx_privacy_login: [
    "set local session authorization influx_privacy_login",
  ],
  influx_advertiser: [
    "set local session authorization influx_app",
    "set local role influx_advertiser",
  ],
  influx_creator: [
    "set local session authorization influx_app",
    "set local role influx_creator",
  ],
  influx_agent: [
    "set local session authorization influx_app",
    "set local role influx_agent",
  ],
  influx_admin: [
    "set local session authorization influx_app",
    "set local role influx_admin",
  ],
  influx_auth: [
    "set local session authorization influx_auth_login",
    "set local role influx_auth",
  ],
  influx_worker: [
    "set local session authorization influx_worker_login",
    "set local role influx_worker",
  ],
  influx_ops: [
    "set local session authorization influx_ops_login",
    "set local role influx_ops",
  ],
  influx_privacy: [
    "set local session authorization influx_privacy_login",
    "set local role influx_privacy",
  ],
};

const LIFTS = [
  "alter table leads.sync_settings disable trigger sync_settings_guard_write",
  "alter table leads.sync_settings disable trigger sync_settings_journal_change",
  "alter table leads.sync_settings disable trigger all",
  "drop trigger sync_settings_guard_write on leads.sync_settings",
  "set local session_replication_role = replica",
  "create or replace function leads.guard_sync_setting_write() returns trigger language plpgsql as $$ begin return new; end $$",
] as const;

describe("05 RG163, CA88, TM1.16 — a Brevo id once set never becomes empty (0145)", () => {
  it("replaces a set list id by another positive integer", async () => {
    await scenario(async (tx) => {
      const { after } = await setCreatorsList(tx);
      const next = freshId(after, 100_000);
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = jsonb_set(value, '{creators}', to_jsonb($1::int)) where key = 'brevo_list_ids'",
          [next],
        ),
      ).toEqual({ outcome: "rows", count: 1 });
      expect(await listIdsOf(tx)).toEqual({ ...after, creators: next });
    });
  });

  it.each([
    ["set back to null", "jsonb_set(value, '{creators}', 'null')"],
    ["removed", "value - 'creators'"],
    ["removed with the whole object", "'{}'::jsonb"],
  ])(
    "refuses a set list id %s (23001), and changes nothing",
    async (_case, expression) => {
      await scenario(async (tx) => {
        const { after } = await setCreatorsList(tx);
        expect(
          await operatorProbe(
            tx,
            `update leads.sync_settings set value = ${expression} where key = 'brevo_list_ids'`,
          ),
        ).toEqual({ outcome: "error", code: RESTRICT_VIOLATION });
        expect(await listIdsOf(tx)).toEqual(after);
      });
    },
  );

  it("leaves a value that is not a positive integer to the CHECK of 0103 (23514), not to the guard", async () => {
    await scenario(async (tx) => {
      await setCreatorsList(tx);
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = jsonb_set(value, '{creators}', '\"4\"') where key = 'brevo_list_ids'",
        ),
      ).toEqual({ outcome: "error", code: CHECK_VIOLATION });
    });
  });

  it("accepts a new sub-key at null, and its removal while it is still null", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = value || '{\"partners\": null}' where key = 'brevo_list_ids'",
        ),
      ).toEqual({ outcome: "rows", count: 1 });
      expect(await listIdsOf(tx)).toEqual({ ...before, partners: null });
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = value - 'partners' where key = 'brevo_list_ids'",
        ),
      ).toEqual({ outcome: "rows", count: 1 });
    });
  });

  it("guards brevo_template_ids the same way if a sub-key comes back (D69: empty today)", async () => {
    await scenario(async (tx) => {
      const ok = { outcome: "rows", count: 1 };
      const refused = { outcome: "error", code: RESTRICT_VIOLATION };
      const write = (expression: string) =>
        operatorProbe(
          tx,
          `update leads.sync_settings set value = ${expression} where key = 'brevo_template_ids'`,
        );
      expect(await write("value || '{\"future.notice\": null}'")).toEqual(ok);
      expect(await write("jsonb_set(value, '{future.notice}', '5')")).toEqual(
        ok,
      );
      expect(await write("jsonb_set(value, '{future.notice}', '6')")).toEqual(
        ok,
      );
      expect(
        await write("jsonb_set(value, '{future.notice}', 'null')"),
      ).toEqual(refused);
      expect(await write("value - 'future.notice'")).toEqual(refused);
      expect(await write("'{}'::jsonb")).toEqual(refused);
    });
  });

  it.each(["brevo_list_ids", "brevo_template_ids"])(
    "refuses the deletion of the row %s (23001)",
    async (key) => {
      await scenario(async (tx) => {
        expect(
          await operatorProbe(
            tx,
            "delete from leads.sync_settings where key = $1",
            [key],
          ),
        ).toEqual({ outcome: "error", code: RESTRICT_VIOLATION });
      });
    },
  );

  it("refuses to rename a Brevo key away (23001) and to truncate the table (23001)", async () => {
    await scenario(async (tx) => {
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set key = 'signup_consent_required' where key = 'brevo_list_ids'",
        ),
      ).toEqual({ outcome: "error", code: RESTRICT_VIOLATION });
      expect(await operatorProbe(tx, "truncate leads.sync_settings")).toEqual({
        outcome: "error",
        code: RESTRICT_VIOLATION,
      });
    });
  });

  it("holds against the worker's own function: it replaces, it never empties", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      const id = freshId(before);
      const changed = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ changed: string[] }[]>`
          select leads.apply_brevo_ids_from_environment(
                   ${JSON.stringify({ advertisers: id })}::text::jsonb) as changed`;
        return row?.changed;
      });
      expect(changed).toEqual(["brevo_list_ids"]);
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = jsonb_set(value, '{advertisers}', 'null') where key = 'brevo_list_ids'",
        ),
      ).toEqual({ outcome: "error", code: RESTRICT_VIOLATION });
    });
  });

  it("covers every execution role of 03 P7 below", () => {
    expect(Object.keys(BECOME).sort()).toEqual([...EXECUTION_ROLES].sort());
  });

  it.each([...EXECUTION_ROLES])(
    "cannot be lifted by %s: no disable, no drop, no replica mode, no replaced function (42501)",
    async (role) => {
      await scenario(async (tx) => {
        for (const lift of LIFTS) {
          for (const statement of BECOME[role]) {
            await tx.unsafe(statement);
          }
          const outcome = await probe(tx, lift);
          await tx.unsafe("reset role");
          await tx.unsafe("reset session authorization");
          expect(outcome, lift).toEqual({
            outcome: "error",
            code: INSUFFICIENT_PRIVILEGE,
          });
        }
      });
    },
  );

  it("is held by the migration role: table and guard owned by it, the journal by influx_leads_definer, all enabled", async () => {
    await scenario(async (tx) => {
      const [table] = await tx<{ owner: string }[]>`
        select pg_get_userbyid(relowner) as owner from pg_class
         where oid = 'leads.sync_settings'::regclass`;
      expect(table?.owner).toBe("postgres");
      const triggers = await tx<
        {
          name: string;
          enabled: string;
          fn: string;
          owner: string;
          definer: boolean;
        }[]
      >`
        select t.tgname as name, t.tgenabled as enabled, p.oid::regprocedure::text as fn,
               pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer
          from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where t.tgrelid = 'leads.sync_settings'::regclass and not t.tgisinternal
         order by t.tgname`;
      expect(triggers).toEqual([
        {
          name: "sync_settings_assert_value",
          enabled: "O",
          fn: "leads.assert_sync_setting_value()",
          owner: "postgres",
          definer: false,
        },
        {
          name: "sync_settings_guard_truncate",
          enabled: "O",
          fn: "leads.guard_sync_setting_write()",
          owner: "postgres",
          definer: false,
        },
        {
          name: "sync_settings_guard_write",
          enabled: "O",
          fn: "leads.guard_sync_setting_write()",
          owner: "postgres",
          definer: false,
        },
        {
          name: "sync_settings_journal_change",
          enabled: "O",
          fn: "leads.journal_sync_setting_change()",
          owner: "influx_leads_definer",
          definer: true,
        },
      ]);
    });
  });
});

describe("05 RG163 (2), D67 (v), TM1.16 — settings.changed written by the trigger, whatever the path (0145)", () => {
  it("journals a direct SQL write of the operator once, chained, named by its connection role", async () => {
    await scenario(async (tx) => {
      const { before, after } = await setCreatorsList(tx);
      const lines = await journalOf(tx, "brevo_list_ids");
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        actor_type: "system",
        actor_account_id: null,
        payload: {
          key: "brevo_list_ids",
          from: before,
          to: after,
          db_session_user: "postgres",
        },
      });
      expect(Object.keys(lines[0]?.payload ?? {}).sort()).toEqual([
        "db_session_user",
        "from",
        "key",
        "to",
      ]);
      expect(await isChained(tx, lines[0]?.seq ?? "0")).toBe(true);
      expect(await allLinesOfTransaction(tx)).toBe(1);
    });
  });

  it("journals the worker's function once, reason environment, without the connection role (actor system)", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      const id = freshId(before);
      await actAs(
        tx,
        "worker",
        () => tx`
        select leads.apply_brevo_ids_from_environment(
                 ${JSON.stringify({ creators: id })}::text::jsonb)`,
      );
      const lines = await journalOf(tx, "brevo_list_ids");
      expect(lines).toHaveLength(1);
      expect(lines[0]).toEqual({
        seq: expect.any(String),
        actor_type: "system",
        actor_account_id: null,
        payload: {
          key: "brevo_list_ids",
          from: before,
          to: { ...before, creators: id },
          reason_code: "environment",
        },
      });
      expect(await isChained(tx, lines[0]?.seq ?? "0")).toBe(true);
    });
  });

  it("hands the context of a function to its own write only: a later SQL write of the transaction carries none", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      await actAs(
        tx,
        "worker",
        () => tx`
        select leads.apply_brevo_ids_from_environment(
                 ${JSON.stringify({ creators: freshId(before) })}::text::jsonb)`,
      );
      await setCreatorsList(tx);
      const lines = await journalOf(tx, "brevo_list_ids");
      expect(lines.map((line) => line.payload.reason_code ?? null)).toEqual([
        "environment",
        null,
      ]);
      expect(lines[1]?.payload.db_session_user).toBe("postgres");
    });
  });

  it("writes nothing, and moves no date nor author, for a write that changes no value", async () => {
    await scenario(async (tx) => {
      const stamps = await stampsOf(tx);
      expect(
        await operatorProbe(tx, "update leads.sync_settings set value = value"),
      ).toEqual({ outcome: "rows", count: Object.keys(stamps).length });
      expect(await stampsOf(tx)).toEqual(stamps);
      expect(await allLinesOfTransaction(tx)).toBe(0);
    });
  });

  it("journals every key changed by one statement once, each on its own subject", async () => {
    await scenario(async (tx) => {
      const consent = await valueOf(tx, "signup_consent_required");
      const days = await valueOf(tx, "signup_invitation_validity_days");
      await asOperator(
        tx,
        () => tx`
        update leads.sync_settings
           set value = case key when 'signup_consent_required' then to_jsonb(not (value::text::boolean))
                                else to_jsonb(case when value::text::int = 30 then 31 else 30 end) end
         where key in ('signup_consent_required', 'signup_invitation_validity_days')`,
      );
      const consentLines = await journalOf(tx, "signup_consent_required");
      const daysLines = await journalOf(tx, "signup_invitation_validity_days");
      expect(consentLines.map((line) => line.payload.from)).toEqual([consent]);
      expect(daysLines.map((line) => line.payload.from)).toEqual([days]);
      expect(await allLinesOfTransaction(tx)).toBe(2);
    });
  });

  it("journals a deletion and an insertion of a non-Brevo key (a migration's path), from or to null", async () => {
    await scenario(async (tx) => {
      const days = await valueOf(tx, "signup_invitation_validity_days");
      await asOperator(tx, async () => {
        await tx`delete from leads.sync_settings where key = 'signup_invitation_validity_days'`;
        await tx`insert into leads.sync_settings (key, value)
                 values ('signup_invitation_validity_days', ${JSON.stringify(days)}::text::jsonb)`;
      });
      const lines = await journalOf(tx, "signup_invitation_validity_days");
      expect(lines.map((line) => [line.payload.from, line.payload.to])).toEqual(
        [
          [days, null],
          [null, days],
        ],
      );
    });
  });

  it("EC-J8-30: journals the digests, never the values, when a value exceeds 3000 octets", async () => {
    await scenario(async (tx) => {
      const before = await valueOf(tx, "apollo_legal_basis");
      await asOperator(
        tx,
        () => tx`
        update leads.sync_settings
           set value = jsonb_build_object(
                 'default', 'consentement_requis',
                 'by_country', (select jsonb_object_agg(c.code, 'interet_legitime_avec_opposition')
                                  from (select code from reference.countries order by code limit 100) c))
         where key = 'apollo_legal_basis'`,
      );
      const after = await valueOf(tx, "apollo_legal_basis");
      const [digests] = await tx<
        { from_md5: string; to_md5: string; large: boolean }[]
      >`
        select md5(${JSON.stringify(before)}::text::jsonb::text) as from_md5,
               md5(${JSON.stringify(after)}::text::jsonb::text) as to_md5,
               octet_length(${JSON.stringify(after)}::text::jsonb::text) > 3000 as large`;
      expect(digests?.large).toBe(true);
      const lines = await journalOf(tx, "apollo_legal_basis");
      expect(lines).toHaveLength(1);
      expect(lines[0]?.payload).toEqual({
        key: "apollo_legal_basis",
        from_md5: digests?.from_md5,
        to_md5: digests?.to_md5,
        db_session_user: "postgres",
      });
    });
  });

  it.each([
    [
      "claims the worker's reason outside the worker's session",
      { key: "brevo_list_ids", reason_code: "environment" },
    ],
    ["names another key", { key: "apollo_scope", reason_code: "environment" }],
    [
      "claims a 2V outside the backoffice's session",
      {
        key: "brevo_list_ids",
        reason_code: "founder_decision",
        dual_control_request_id: "00000000-0000-4000-8000-000000000001",
        dual_control: "peer",
        reevaluated: 0,
      },
    ],
    ["carries an unknown field", { key: "brevo_list_ids", note: "x" }],
  ])(
    "refuses a write whose context %s (22023), and journals nothing",
    async (_case, context) => {
      await scenario(async (tx) => {
        const before = await listIdsOf(tx);
        await asOperator(
          tx,
          () =>
            tx`select set_config(${CONTEXT}, ${JSON.stringify(context)}, true)`,
        );
        expect(
          await operatorProbe(
            tx,
            "update leads.sync_settings set value = jsonb_set(value, '{creators}', to_jsonb($1::int)) where key = 'brevo_list_ids'",
            [freshId(before)],
          ),
        ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
        expect(await listIdsOf(tx)).toEqual(before);
        expect(await allLinesOfTransaction(tx)).toBe(0);
      });
    },
  );

  it("refuses a context that is not JSON (22023)", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      await asOperator(
        tx,
        () => tx`select set_config(${CONTEXT}, 'not json', true)`,
      );
      expect(
        await operatorProbe(
          tx,
          "update leads.sync_settings set value = jsonb_set(value, '{creators}', to_jsonb($1::int)) where key = 'brevo_list_ids'",
          [freshId(before)],
        ),
      ).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    });
  });

  it("leaves a single writer of settings.changed in the base: the trigger function", async () => {
    await scenario(async (tx) => {
      const writers = await tx<{ fn: string }[]>`
        select p.oid::regprocedure::text as fn from pg_proc p
         where p.prosrc like '%''settings.changed''%' order by 1`;
      expect(writers.map((row) => row.fn)).toEqual([
        "leads.journal_sync_setting_change()",
      ]);
    });
  });
});

describe("05 RG161, TM1.12 (base) — the date of modification of each key, kept by the base (0145)", () => {
  it("a direct SQL correction moves the date of its key to the time of the write; no other key moves", async () => {
    await scenario(async (tx) => {
      const stamps = await stampsOf(tx);
      await setCreatorsList(tx);
      const [moved] = await tx<{ after_start: boolean; not_future: boolean }[]>`
        select updated_at > now() as after_start, updated_at <= clock_timestamp() as not_future
          from leads.sync_settings where key = 'brevo_list_ids'`;
      // clock_timestamp(), not now(): a correction made DURING an attempt is dated after its start
      expect(moved).toEqual({ after_start: true, not_future: true });
      const now = await stampsOf(tx);
      for (const key of Object.keys(stamps)) {
        if (key !== "brevo_list_ids") {
          expect(now[key], key).toEqual(stamps[key]);
        }
      }
    });
  });

  it("the worker's function moves the date of its key too", async () => {
    await scenario(async (tx) => {
      const before = await listIdsOf(tx);
      await actAs(
        tx,
        "worker",
        () => tx`
        select leads.apply_brevo_ids_from_environment(
                 ${JSON.stringify({ advertisers: freshId(before) })}::text::jsonb)`,
      );
      const [moved] = await tx<{ after_start: boolean }[]>`
        select updated_at > now() as after_start
          from leads.sync_settings where key = 'brevo_list_ids'`;
      expect(moved?.after_start).toBe(true);
    });
  });
});
