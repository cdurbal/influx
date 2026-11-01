// D68 (founder, 2026-10-17), amended by D69 (2026-10-18) — leads.apply_brevo_ids_from_environment()
// (migrations 0139, 0140): the worker writes the Brevo LIST ids of its environment into
// leads.sync_settings at start; no template id any more (every queue e-mail is written by INFLUX).
// Only the sub-keys given are merged, never a null (05 RG163); a change is journaled
// settings.changed (reason environment, EC-J8-28 subject) by the trigger of leads.sync_settings
// (0145), exactly once; influx_worker executes it, no other role of ours does. 0146 (J9 D67-b): it
// is the start step of the worker and also returns the worker keys in force after it, for the
// start check of 05 RG162 (read now, RG81), and the start instant by the database clock (RG161).
//
// Each case runs in ONE rolled-back transaction of the local superuser, the function under the
// session_user / current_user pair of the worker (actAs, support.ts). RG163 (1), 0145: an id once
// set never goes back to null, so no case resets the ids; each reads them first and changes them
// relatively (another file of the local stack may have committed ids).
import { inRolledBackTransaction, probe, takeRole } from "@influx/test-kit/db";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, localSuperuser } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** A positive id that differs from every id of `ids`. */
function freshId(ids: Record<string, number | null> | undefined): number {
  const taken = new Set(Object.values(ids ?? {}));
  let id = 600_000 + Math.floor(Math.random() * 100_000);
  while (taken.has(id)) id += 1;
  return id;
}

type Start = {
  changed_keys: string[];
  settings: Record<string, unknown>;
  started_now: boolean;
};

function start(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
): Promise<Start | undefined> {
  return actAs(tx, "worker", async () => {
    const [row] = await tx<Start[]>`
      select changed_keys, settings, started_at = now() as started_now
        from leads.apply_brevo_ids_from_environment(
               ${JSON.stringify(listIds)}::text::jsonb)`;
    return row;
  });
}

async function apply(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
): Promise<string[]> {
  return (await start(tx, listIds))?.changed_keys ?? [];
}

/** The seven worker keys as leads.begin_outbox_attempt() reads them (EC-8). */
async function workerKeysOf(tx: postgres.TransactionSql) {
  const [row] = await tx<{ settings: Record<string, unknown> }[]>`
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) as settings
      from leads.sync_settings
     where key in ('apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
                   'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids')`;
  return row?.settings;
}

function refusalOf(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
) {
  return actAs(tx, "worker", () =>
    probe(
      tx,
      "select leads.apply_brevo_ids_from_environment($1::text::jsonb)",
      [JSON.stringify(listIds)],
    ),
  );
}

async function listIdsOf(tx: postgres.TransactionSql) {
  const [row] = await tx<
    { value: Record<string, number | null>; author: string | null }[]
  >`
    select value, updated_by_account_id::text as author from leads.sync_settings
     where key = 'brevo_list_ids'`;
  return row;
}

async function journalOf(tx: postgres.TransactionSql) {
  return tx<{ actor_type: string; payload: Record<string, unknown> }[]>`
    select actor_type::text, payload from audit.audit_events
     where event_type = 'settings.changed'
       and subject_id = md5('leads.sync_settings:brevo_list_ids')::uuid
       and occurred_at = now()
     order by seq`;
}

describe("D68, D69 — the Brevo list ids of the worker's environment (0139, 0140)", () => {
  it("merges the sub-keys given, leaves the others alone, and journals the change once", async () => {
    await scenario(async (tx) => {
      const before = (await listIdsOf(tx))?.value;
      const creators = freshId(before);
      expect(await apply(tx, { creators })).toEqual(["brevo_list_ids"]);

      const ids = await listIdsOf(tx);
      expect(ids?.value).toEqual({ ...before, creators });
      expect(ids?.author).toBeNull();

      // 0145: one line per change, written by the trigger, never a second one by the function
      expect(await journalOf(tx)).toEqual([
        {
          actor_type: "system",
          payload: {
            key: "brevo_list_ids",
            from: before,
            to: { ...before, creators },
            reason_code: "environment",
          },
        },
      ]);
    });
  });

  it("writes nothing when the values are already those of the environment", async () => {
    await scenario(async (tx) => {
      const advertisers = freshId((await listIdsOf(tx))?.value);
      await apply(tx, { advertisers });
      expect(await apply(tx, { advertisers })).toEqual([]);
      expect(await apply(tx, {})).toEqual([]);
      expect(await journalOf(tx)).toHaveLength(1);
    });
  });

  it("0146, 05 RG162: returns the seven worker keys in force after the step, and the start instant", async () => {
    await scenario(async (tx) => {
      const unchanged = await start(tx, {});
      expect(unchanged?.changed_keys).toEqual([]);
      expect(unchanged?.settings).toEqual(await workerKeysOf(tx));
      expect(unchanged?.started_now).toBe(true);
      // never a signup_* key: what the worker reads, nothing more
      expect(Object.keys(unchanged?.settings ?? {}).sort()).toEqual([
        "apollo_excluded_countries",
        "apollo_legal_basis",
        "apollo_scope",
        "brevo_list_ids",
        "brevo_template_ids",
        "rate_limits",
        "retry_schedule",
      ]);

      const creators = freshId((await listIdsOf(tx))?.value);
      const changed = await start(tx, { creators });
      expect(changed?.changed_keys).toEqual(["brevo_list_ids"]);
      // the merge itself, as the next attempt will read it
      expect(changed?.settings).toEqual(await workerKeysOf(tx));
      expect(
        (changed?.settings.brevo_list_ids as Record<string, unknown>).creators,
      ).toBe(creators);
    });
  });

  it("D69: no template id is ever written, brevo_template_ids stays empty", async () => {
    await scenario(async (tx) => {
      await apply(tx, { advertisers: 3, creators: 4 });
      const [row] = await tx<{ value: Record<string, unknown> }[]>`
        select value from leads.sync_settings where key = 'brevo_template_ids'`;
      expect(row?.value).toEqual({});
    });
  });

  it.each([
    ["an unknown list", { partners: 3 }],
    ["a template key (D69)", { "account.welcome_creator": 3 }],
    ["a null id (05 RG163)", { advertisers: null }],
    ["a zero id", { advertisers: 0 }],
    ["a decimal id", { creators: 1.5 }],
    ["an id as text", { creators: "4" }],
  ])("refuses %s, and changes nothing", async (_case, listIds) => {
    await scenario(async (tx) => {
      const before = (await listIdsOf(tx))?.value;
      expect(await refusalOf(tx, listIds)).toEqual({
        outcome: "error",
        code: INVALID_PARAMETER,
      });
      expect((await listIdsOf(tx))?.value).toEqual(before);
      expect(await journalOf(tx)).toEqual([]);
    });
  });

  it.each(["influx_auth", "influx_admin", "influx_privacy"] as const)(
    "is executable by influx_worker only, not by %s",
    async (role) => {
      await scenario(async (tx) => {
        await takeRole(tx, role);
        expect(
          await probe(
            tx,
            "select leads.apply_brevo_ids_from_environment('{\"advertisers\": 3}'::jsonb)",
          ),
        ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
      });
    },
  );

  it("leaves the worker without any direct right on leads.sync_settings", async () => {
    await scenario(async (tx) => {
      expect(
        await actAs(tx, "worker", () =>
          probe(
            tx,
            "update leads.sync_settings set value = value where key = 'brevo_list_ids'",
          ),
        ),
      ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    });
  });
});
