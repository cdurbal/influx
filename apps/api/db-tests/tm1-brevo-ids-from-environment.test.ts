// D68 (founder, 2026-10-17), amended by D69 (2026-10-18) — leads.apply_brevo_ids_from_environment()
// (migrations 0139, 0140): the worker writes the Brevo LIST ids of its environment into
// leads.sync_settings at start; no template id any more (every queue e-mail is written by INFLUX).
// Only the sub-keys given are merged, never a null (05 RG163); a change is journaled
// settings.changed (reason environment, EC-J8-28 subject); influx_worker executes it, no other role
// of ours does.
//
// Each case runs in ONE rolled-back transaction of the local superuser, the function under the
// session_user / current_user pair of the worker (actAs, support.ts).
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

/** Starting value of 0103, whatever an earlier run of the local stack left. */
async function resetIds(tx: postgres.TransactionSql): Promise<void> {
  await tx`update leads.sync_settings set value = '{"advertisers": null, "creators": null}'
            where key = 'brevo_list_ids'`;
}

function apply(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
): Promise<string[]> {
  return actAs(tx, "worker", async () => {
    const [row] = await tx<{ changed: string[] }[]>`
      select leads.apply_brevo_ids_from_environment(
               ${JSON.stringify(listIds)}::text::jsonb) as changed`;
    return row?.changed ?? [];
  });
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
  it("merges the sub-keys given, leaves the others alone, and journals the change", async () => {
    await scenario(async (tx) => {
      await resetIds(tx);
      expect(await apply(tx, { creators: 4 })).toEqual(["brevo_list_ids"]);

      const ids = await listIdsOf(tx);
      expect(ids?.value).toEqual({ advertisers: null, creators: 4 });
      expect(ids?.author).toBeNull();

      const [line] = await journalOf(tx);
      expect(line).toEqual({
        actor_type: "system",
        payload: expect.objectContaining({
          key: "brevo_list_ids",
          from: { advertisers: null, creators: null },
          to: { advertisers: null, creators: 4 },
          reason_code: "environment",
        }),
      });
    });
  });

  it("writes nothing when the values are already those of the environment", async () => {
    await scenario(async (tx) => {
      await resetIds(tx);
      await apply(tx, { advertisers: 3 });
      expect(await apply(tx, { advertisers: 3 })).toEqual([]);
      expect(await apply(tx, {})).toEqual([]);
      expect(await journalOf(tx)).toHaveLength(1);
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
      await resetIds(tx);
      expect(await refusalOf(tx, listIds)).toEqual({
        outcome: "error",
        code: INVALID_PARAMETER,
      });
      expect((await listIdsOf(tx))?.value).toEqual({
        advertisers: null,
        creators: null,
      });
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
