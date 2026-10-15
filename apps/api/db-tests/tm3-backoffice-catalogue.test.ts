// TM3 (J8, commit 2) — the catalogue of the backoffice queues, their delays and the alerts of
// Lot 1 (migrations 0129 and 0130; 15 RG26, RG29, RG38, §F; D39). The rights of the three tables
// are T2's (test-kit/rights); here: the content, and the two halves of 15 RG26 — no queue without
// a delay, no delay without a queue — held by the database. Every write is made by the migration
// role in a rolled-back transaction.
import { inRolledBackTransaction, type ProbeResult } from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { migrationRole } from "./support.ts";

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

let migration: postgres.Sql;

beforeAll(() => {
  migration = migrationRole();
});

type Attempt = ProbeResult & { constraint?: string };

/** One statement in a savepoint: the SQLSTATE and the constraint named by the error, if any. */
async function attempt(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const failure = error as { code?: string; constraint_name?: string };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      ...(failure.constraint_name === undefined
        ? {}
        : { constraint: failure.constraint_name }),
    };
  }
}

/** Checks the deferred key now, as COMMIT would (15 RG26: no queue without a delay). */
const CHECK_NOW = "set constraints backoffice.queues_sla_policy_fk immediate";

const D39_BUSINESS_HOURS = {
  time_zone: "UTC",
  days: [1, 2, 3, 4, 5],
  opens: "09:00",
  closes: "17:00",
};

describe("backoffice.queues: the closed catalogue of the J8 queues (15 RG26, RG29)", () => {
  it("holds the four queues the J8 fills, with the attributes of 15 RG29", async () => {
    const rows = await migration`
      select code, label_key, handled_by_roles::text[] as roles, allows_bulk_action as bulk,
             has_lock as lock, is_active, retired_at
        from backoffice.queues order by code`;
    expect(rows).toEqual([
      {
        code: "data_subject_requests",
        label_key: "queue.data_subject_requests",
        roles: ["agent", "admin"],
        bulk: false,
        lock: true,
        is_active: true,
        retired_at: null,
      },
      {
        code: "dual_control_pending",
        label_key: "queue.dual_control_pending",
        roles: ["admin"],
        bulk: false,
        lock: false,
        is_active: true,
        retired_at: null,
      },
      {
        code: "email_delivery_incidents",
        label_key: "queue.email_delivery_incidents",
        roles: ["agent", "admin"],
        bulk: false,
        lock: true,
        is_active: true,
        retired_at: null,
      },
      // 15 RG30: no lock, the replay is idempotent; the only bulk action of J8 (replay of 200)
      {
        code: "lead_sync_failures",
        label_key: "queue.lead_sync_failures",
        roles: ["agent", "admin"],
        bulk: true,
        lock: false,
        is_active: true,
        retired_at: null,
      },
    ]);
  });

  it("refuses a member as a handler, a label key other than queue.<code>, a malformed code", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await attempt(
        tx,
        `insert into backoffice.queues (code, label_key, spec_document, handled_by_roles,
                                        allows_bulk_action, has_lock)
         values ('t_member', 'queue.t_member', '15', '{agent,creator}', false, false)`,
      ),
      await attempt(
        tx,
        `insert into backoffice.queues (code, label_key, spec_document, handled_by_roles,
                                        allows_bulk_action, has_lock)
         values ('t_label', 'bo.queue.t_label', '15', '{agent}', false, false)`,
      ),
      await attempt(
        tx,
        `insert into backoffice.queues (code, label_key, spec_document, handled_by_roles,
                                        allows_bulk_action, has_lock)
         values ('T-Queue', 'queue.T-Queue', '15', '{agent}', false, false)`,
      ),
    ]);
    expect(results).toEqual([
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "queues_handled_by_internal",
      },
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "queues_label_key",
      },
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "queues_code_format",
      },
    ]);
  });
});

describe("backoffice.sla_policies: one delay per queue, as data (D39, 15 RG29, RG38)", () => {
  it("gives each J8 queue its delay; the proposals of 15 Q4 are provisional", async () => {
    const rows = await migration`
      select queue_code, target_claim_minutes as claim, target_decision_minutes as decision,
             business_hours, escalate_after_minutes as escalate, is_provisional, is_active
        from backoffice.sla_policies order by queue_code`;
    expect(rows).toEqual([
      // internal objective of 10 business days; the legal month is data_subject_requests.due_at
      {
        queue_code: "data_subject_requests",
        claim: 480,
        decision: 4800,
        business_hours: D39_BUSINESS_HOURS,
        escalate: 480,
        is_provisional: false,
        is_active: true,
      },
      // 24 calendar hours, then expiry (15 RG31): no business hours, no escalation
      {
        queue_code: "dual_control_pending",
        claim: null,
        decision: 1440,
        business_hours: null,
        escalate: null,
        is_provisional: false,
        is_active: true,
      },
      {
        queue_code: "email_delivery_incidents",
        claim: 240,
        decision: 960,
        business_hours: D39_BUSINESS_HOURS,
        escalate: 480,
        is_provisional: true,
        is_active: true,
      },
      {
        queue_code: "lead_sync_failures",
        claim: null,
        decision: 960,
        business_hours: D39_BUSINESS_HOURS,
        escalate: 480,
        is_provisional: true,
        is_active: true,
      },
    ]);
  });

  it("gives a queue loaded later the starting value of D39 (one business day, Monday to Friday)", async () => {
    const policy = await inRolledBackTransaction(migration, async (tx) => {
      await tx`
        insert into backoffice.queues (code, label_key, spec_document, handled_by_roles,
                                       allows_bulk_action, has_lock)
        values ('t_later_queue', 'queue.t_later_queue', '13 §B', '{agent,admin}', false, true)`;
      await tx`insert into backoffice.sla_policies (queue_code) values ('t_later_queue')`;
      await tx.unsafe(CHECK_NOW);
      const [row] = await tx`
        select target_decision_minutes as decision, escalate_after_minutes as escalate,
               business_hours, target_claim_minutes as claim, is_provisional
          from backoffice.sla_policies where queue_code = 't_later_queue'`;
      return row;
    });
    expect(policy).toEqual({
      decision: 480,
      escalate: 480,
      business_hours: D39_BUSINESS_HOURS,
      claim: null,
      is_provisional: false,
    });
  });

  it("refuses a delay without a queue (23503)", async () => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      attempt(
        tx,
        "insert into backoffice.sla_policies (queue_code) values ('t_no_such_queue')",
      ),
    );
    expect(result).toEqual({
      outcome: "error",
      code: FOREIGN_KEY_VIOLATION,
      constraint: "sla_policies_queue_fk",
    });
  });

  it("refuses a queue without a delay, checked as at COMMIT (23503)", async () => {
    const result = await inRolledBackTransaction(migration, async (tx) => {
      await tx`
        insert into backoffice.queues (code, label_key, spec_document, handled_by_roles,
                                       allows_bulk_action, has_lock)
        values ('t_orphan_queue', 'queue.t_orphan_queue', '15', '{agent}', false, false)`;
      return attempt(tx, CHECK_NOW);
    });
    expect(result).toEqual({
      outcome: "error",
      code: FOREIGN_KEY_VIOLATION,
      constraint: "queues_sla_policy_fk",
    });
  });

  it("refuses to remove the delay of a queue that stays in the catalogue (23503)", async () => {
    const result = await inRolledBackTransaction(migration, async (tx) => {
      await tx`delete from backoffice.sla_policies where queue_code = 'lead_sync_failures'`;
      return attempt(tx, CHECK_NOW);
    });
    expect(result).toEqual({
      outcome: "error",
      code: FOREIGN_KEY_VIOLATION,
      constraint: "queues_sla_policy_fk",
    });
  });

  it.each([
    ["a missing member", '{"time_zone": "UTC", "days": [1], "opens": "09:00"}'],
    [
      "an unknown member",
      '{"time_zone": "UTC", "days": [1], "opens": "09:00", "closes": "17:00", "lunch": true}',
    ],
    [
      "a day out of range",
      '{"time_zone": "UTC", "days": [0, 1], "opens": "09:00", "closes": "17:00"}',
    ],
    [
      "a closing before the opening",
      '{"time_zone": "UTC", "days": [1], "opens": "17:00", "closes": "09:00"}',
    ],
    [
      "an unknown time zone (trigger)",
      '{"time_zone": "Mars/Olympus_Mons", "days": [1], "opens": "09:00", "closes": "17:00"}',
    ],
    [
      "a day listed twice (trigger)",
      '{"time_zone": "UTC", "days": [1, 1], "opens": "09:00", "closes": "17:00"}',
    ],
  ])("refuses business hours with %s (23514)", async (_label, hours) => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      attempt(
        tx,
        "update backoffice.sla_policies set business_hours = $1::jsonb where queue_code = 'lead_sync_failures'",
        [hours],
      ),
    );
    expect(result).toMatchObject({ outcome: "error", code: CHECK_VIOLATION });
  });

  it("accepts a valid IANA time zone, a row update and not a deployment (15 RG38)", async () => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      attempt(
        tx,
        `update backoffice.sla_policies
            set business_hours = '{"time_zone": "Europe/London", "days": [1, 2, 3, 4, 5],
                                   "opens": "08:30", "closes": "16:30"}'::jsonb,
                target_decision_minutes = 480
          where queue_code = 'email_delivery_incidents'`,
      ),
    );
    expect(result).toEqual({ outcome: "rows", count: 1 });
  });
});

describe("backoffice.alert_definitions: the alerts of Lot 1 (15 §F, 16 RG98)", () => {
  it("holds the fourteen alerts whose condition reads objects of J8, with nature and recipients", async () => {
    const rows = await migration<
      {
        code: string;
        nature: string;
        recipients: string[];
        is_active: boolean;
      }[]
    >`
      select code, nature::text as nature, recipient_roles as recipients, is_active
        from backoffice.alert_definitions
       order by substr(code, 3)::int`;
    expect(rows.map((row) => [row.code, row.nature, row.recipients])).toEqual([
      ["AL2", "etat", ["agent", "admin"]],
      ["AL5", "etat", ["agent", "admin"]],
      ["AL24", "etat", ["owner_agent", "admin"]],
      ["AL25", "evenement", ["admin"]],
      ["AL26", "etat", ["admin"]],
      ["AL27", "etat", ["admin"]],
      ["AL33", "evenement", ["founder", "admin"]],
      ["AL34", "evenement", ["admin"]],
      ["AL35", "evenement", ["admin"]],
      ["AL36", "evenement", ["founder", "admin"]],
      ["AL37", "evenement", ["admin", "founder"]],
      ["AL40", "etat", ["admin"]],
      ["AL41", "etat", ["admin"]],
      ["AL48", "etat", ["admin"]],
    ]);
    expect(rows.every((row) => row.is_active)).toBe(true);
  });

  it("writes the starting thresholds as data (05 RG79, 15 §F, 16 RG98, EC-43)", async () => {
    const rows = await migration<{ code: string; threshold: unknown }[]>`
      select code, threshold_value as threshold from backoffice.alert_definitions
       where code in ('AL5', 'AL26', 'AL35', 'AL40', 'AL48') order by code`;
    expect(
      Object.fromEntries(rows.map((row) => [row.code, row.threshold])),
    ).toEqual({
      AL5: {
        basis: "sla_policies.target_decision_minutes",
        oldest_entry_age_multiplier: 2,
      },
      AL26: {
        brevo_contact_max_minutes: 60,
        apollo_contact_max_minutes: 1440,
        min_share_bp: 9900,
      },
      AL35: { basis: "user_agent_summary", unseen_for_days: 30 },
      AL40: { days_before_due: 7 },
      AL48: {
        median_delivery_seconds_max: 60,
        p90_delivery_seconds_max: 180,
        no_sign_in_within_minutes: 10,
        no_sign_in_share_max_bp: 1500,
        delivered_share_min_bp: 9700,
      },
    });
  });

  it("refuses an unknown recipient, a label key other than alert.<code>, a threshold that is not an object", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await attempt(
        tx,
        `insert into backoffice.alert_definitions
           (code, label_key, nature, threshold_value, recipient_roles, source_document)
         values ('AL6', 'alert.AL6', 'evenement', '{}', '{member}', '13 A4')`,
      ),
      await attempt(
        tx,
        `insert into backoffice.alert_definitions
           (code, label_key, nature, threshold_value, recipient_roles, source_document)
         values ('AL6', 'bo.alert.AL6', 'evenement', '{}', '{owner_agent}', '13 A4')`,
      ),
      await attempt(
        tx,
        `insert into backoffice.alert_definitions
           (code, label_key, nature, threshold_value, recipient_roles, source_document)
         values ('AL6', 'alert.AL6', 'evenement', '[3, 6]', '{owner_agent}', '13 A4')`,
      ),
    ]);
    expect(results).toEqual([
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "alert_definitions_recipients_closed",
      },
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "alert_definitions_label_key",
      },
      {
        outcome: "error",
        code: CHECK_VIOLATION,
        constraint: "alert_definitions_threshold_object",
      },
    ]);
  });
});
