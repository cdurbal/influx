// D68 (founder, 2026-10-17) — leads.apply_brevo_ids_from_environment() (migration 0139): the
// worker writes the Brevo ids of its environment into leads.sync_settings at start. Only the
// sub-keys given are merged, never a null (05 RG163); a change is journaled settings.changed
// (reason environment, EC-J8-28 subject); influx_worker executes it, no other role of ours does.
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

/** Starting values of 0103 / 0118, whatever an earlier run of the local stack left. */
async function resetIds(tx: postgres.TransactionSql): Promise<void> {
  await tx`update leads.sync_settings set value = '{"advertisers": null, "creators": null}'
            where key = 'brevo_list_ids'`;
  await tx`update leads.sync_settings
              set value = '{"account.welcome_advertiser": null, "account.welcome_creator": null,
                            "auth.email_changed_notice": null}'
            where key = 'brevo_template_ids'`;
}

function apply(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
  templateIds: Record<string, unknown>,
): Promise<string[]> {
  return actAs(tx, "worker", async () => {
    const [row] = await tx<{ changed: string[] }[]>`
      select leads.apply_brevo_ids_from_environment(
               ${JSON.stringify(listIds)}::text::jsonb, ${JSON.stringify(templateIds)}::text::jsonb) as changed`;
    return row?.changed ?? [];
  });
}

function refusalOf(
  tx: postgres.TransactionSql,
  listIds: Record<string, unknown>,
  templateIds: Record<string, unknown>,
) {
  return actAs(tx, "worker", () =>
    probe(
      tx,
      "select leads.apply_brevo_ids_from_environment($1::text::jsonb, $2::text::jsonb)",
      [JSON.stringify(listIds), JSON.stringify(templateIds)],
    ),
  );
}

async function settingsOf(tx: postgres.TransactionSql) {
  const rows = await tx<
    {
      key: string;
      value: Record<string, number | null>;
      author: string | null;
    }[]
  >`
    select key, value, updated_by_account_id::text as author from leads.sync_settings
     where key in ('brevo_list_ids', 'brevo_template_ids') order by key`;
  return Object.fromEntries(rows.map((row) => [row.key, row]));
}

async function journalOf(tx: postgres.TransactionSql, key: string) {
  return tx<{ actor_type: string; payload: Record<string, unknown> }[]>`
    select actor_type::text, payload from audit.audit_events
     where event_type = 'settings.changed'
       and subject_id = md5('leads.sync_settings:' || ${key})::uuid
       and occurred_at = now()
     order by seq`;
}

describe("D68 — the Brevo ids of the worker's environment (0139)", () => {
  it("merges the sub-keys given, leaves the others alone, and journals each changed key", async () => {
    await scenario(async (tx) => {
      await resetIds(tx);
      const changed = await apply(
        tx,
        { advertisers: 3, creators: 4 },
        { "account.welcome_creator": 12 },
      );
      expect(changed).toEqual(["brevo_list_ids", "brevo_template_ids"]);

      const settings = await settingsOf(tx);
      expect(settings.brevo_list_ids?.value).toEqual({
        advertisers: 3,
        creators: 4,
      });
      expect(settings.brevo_template_ids?.value).toEqual({
        "account.welcome_advertiser": null,
        "account.welcome_creator": 12,
        "auth.email_changed_notice": null,
      });
      expect(settings.brevo_list_ids?.author).toBeNull();

      const [line] = await journalOf(tx, "brevo_list_ids");
      expect(line).toEqual({
        actor_type: "system",
        payload: expect.objectContaining({
          key: "brevo_list_ids",
          from: { advertisers: null, creators: null },
          to: { advertisers: 3, creators: 4 },
          reason_code: "environment",
        }),
      });
    });
  });

  it("writes nothing when the values are already those of the environment", async () => {
    await scenario(async (tx) => {
      await resetIds(tx);
      await apply(tx, { advertisers: 3 }, {});
      expect(await apply(tx, { advertisers: 3 }, {})).toEqual([]);
      expect(await journalOf(tx, "brevo_list_ids")).toHaveLength(1);
      expect(await journalOf(tx, "brevo_template_ids")).toHaveLength(0);
    });
  });

  it.each([
    ["an unknown list", { partners: 3 }, {}],
    ["an unknown template", {}, { "privacy.request_received": 3 }],
    ["a null id (05 RG163)", { advertisers: null }, {}],
    ["a zero id", {}, { "account.welcome_advertiser": 0 }],
    ["a decimal id", { creators: 1.5 }, {}],
    ["an id as text", { creators: "4" }, {}],
  ])("refuses %s, and changes nothing", async (_case, listIds, templateIds) => {
    await scenario(async (tx) => {
      await resetIds(tx);
      expect(await refusalOf(tx, listIds, templateIds)).toEqual({
        outcome: "error",
        code: INVALID_PARAMETER,
      });
      const settings = await settingsOf(tx);
      expect(settings.brevo_list_ids?.value).toEqual({
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
            "select leads.apply_brevo_ids_from_environment('{\"advertisers\": 3}'::jsonb, '{}'::jsonb)",
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
