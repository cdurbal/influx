// L2E commit 05 — the verification core, 0221 (jalons/l2e/05.md, l2e/modele.md §3, §4, §5;
// fiche invariants 1, 4, 6, 7, 11): L2E-D1 an evidence row never without its date of purge, L2E-D2
// a refusal never mute (and never with a reason of the other population), L2E-D3 the audience badge
// never without its four values, L2E-D4 one holding badge per (account, line, level); plus the
// catalogues, the parameters of 08 RG100, queue 4, the deadlines frozen at the submission and the
// advertiser kept off the schema (EC-L2E-18). Rights per table and role are probed by T2
// (t2-rls-matrix, test-kit/rights). Each case runs in a rolled-back transaction.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
  VERIFICATION_IDS,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const NOT_NULL_VIOLATION = "23502";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;

type Outcome =
  | { outcome: "rows"; count: number }
  | { outcome: "error"; code: string; constraint: string | undefined };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE and constraint. */
async function run(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const found = error as { code?: string; constraint_name?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      constraint: found.constraint_name,
    };
  }
}

function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : { outcome: "error", code, constraint };
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };

/** A request of creator A on his primary line, at `level` and `status` (draft by default). */
async function insertCreatorRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
  status: "draft" | "pending" = "draft",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level,
            ${status}::verification.request_status)
    returning id`;
  if (row === undefined) throw new Error("no request inserted");
  return row.id;
}

/** The columns of a valid audience badge of creator A, keyed for an INSERT ... VALUES. */
const AUDIENCE_BADGE = {
  observed_followers: "47300",
  observed_posts_last_30_days: "14",
  observed_avg_comments: "35",
  observed_period_start: "current_date - 30",
  observed_period_end: "current_date - 2",
  declared_posts_at_decision: "14",
  declared_comments_at_decision: "35",
} as const;

function audienceBadgeInsert(
  request: string,
  without?: keyof typeof AUDIENCE_BADGE,
  state = "active",
): string {
  const figures = Object.entries(AUDIENCE_BADGE).filter(
    ([column]) => column !== without,
  );
  return `insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision, expires_at, state,
       ${figures.map(([column]) => column).join(", ")})
    values ('${creatorA}', '${lineA}', 'instagram', '${request}', 'audience_verified',
            '${agentA}', now(), 'native_dashboard', 't2_creator_a', now() + interval '90 days',
            '${state}', ${figures.map(([, value]) => value).join(", ")})`;
}

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

describe("the closed catalogues of 0221 (08 RG57, RG59, RG73; 06 RG51-RG52; EC-L2E-11)", () => {
  it("holds the sixteen creator reasons and the six brand reasons, in their order, with their flags", async () => {
    const rows = await migration<
      {
        population: string;
        code: string;
        message: boolean;
        escalates: boolean;
        purges: boolean;
      }[]
    >`
      select population, code, requires_member_message as message,
             escalates_to_admin as escalates, purges_evidence as purges
        from verification.rejection_reasons
       where is_active
       order by population desc, position`;
    expect(rows.map((row) => `${row.population}.${row.code}`)).toEqual([
      ...[
        "missing_evidence",
        "evidence_too_old",
        "evidence_unreadable",
        "evidence_wrong_source",
        "evidence_too_wide",
        "ownership_not_proven",
        "account_not_public",
        "ownership_prerequisite",
        "evidence_inconsistent",
        "evidence_suspected_forgery",
        "shared_account",
        "agency_managed",
        "terms_breach",
        "minor",
        "account_unavailable",
        "other",
      ].map((code) => `creator.${code}`),
      ...[
        "domain_code_not_found",
        "registration_not_found",
        "registration_unverifiable_country",
        "name_mismatch",
        "account_unavailable",
        "other",
      ].map((code) => `brand.${code}`),
    ]);
    const flagged = (flag: "message" | "escalates" | "purges") =>
      rows
        .filter((row) => row[flag])
        .map((row) => `${row.population}.${row.code}`);
    // RG57 « message dédié », modele §3: other and terms_breach
    expect(flagged("message")).toEqual([
      "creator.terms_breach",
      "creator.other",
      "brand.other",
    ]);
    // RG59: signals on the account, escalated to an administrator
    expect(flagged("escalates")).toEqual([
      "creator.evidence_suspected_forgery",
      "creator.shared_account",
      "creator.terms_breach",
      "creator.minor",
    ]);
    // RG88: third-party data, purged at once
    expect(flagged("purges")).toEqual(["creator.evidence_too_wide"]);
  });

  it("holds the five revocation reasons of 08 RG73", async () => {
    // 0231 (06 RG55): the brand reasons join the table; a creator badge keeps the five of RG73
    const rows = await migration<{ code: string }[]>`
      select code from verification.revocation_reasons
       where is_active
         and levels && array['account_verified', 'audience_verified']::verification.badge_level[]
       order by code`;
    expect(rows.map((row) => row.code)).toEqual([
      "account_closed",
      "forged_evidence",
      "influx_error",
      "owner_changed",
      "terms_breach",
    ]);
  });

  it("loads the sources of l2e/registres.md: the admitted ones active, those « à confirmer » inactive", async () => {
    const rows = await migration<
      { country: string | null; type: string; active: boolean }[]
    >`
      select country_code as country, source_type as type, is_active as active
        from verification.registry_sources
       order by source_type, country_code nulls first`;
    const active = (type: string) =>
      rows
        .filter((row) => row.type === type && row.active)
        .map((row) => row.country);
    const inactive = (type: string) =>
      rows
        .filter((row) => row.type === type && !row.active)
        .map((row) => row.country);
    expect(active("e_justice")).toHaveLength(30);
    expect(active("e_justice")).toEqual(
      expect.arrayContaining(["FR", "DE", "IS", "LI", "NO"]),
    );
    expect(active("gleif")).toEqual([null]);
    expect(active("national")).toEqual(["AU", "SG"]);
    expect(inactive("national")).toEqual([
      "BR",
      "CA",
      "CH",
      "GB",
      "IN",
      "JP",
      "NO",
      "NZ",
    ]);
    // registres.md: the United States go through GLEIF, then a list of States, empty
    expect(rows.filter((row) => row.country === "US")).toEqual([]);
  });

  it("keeps one active source per country and https only (23505, 23514)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await run(
        tx,
        `update verification.registry_sources set is_active = true
          where country_code = 'NO' and source_type = 'national'`,
      ),
      await run(
        tx,
        `insert into verification.registry_sources
           (country_code, source_type, name, url, checked_on)
         values ('US', 'national', 'T2 register', 'http://example.test/', current_date)`,
      ),
      await run(
        tx,
        `insert into verification.registry_sources
           (country_code, source_type, name, url, checked_on)
         values ('US', 'gleif', 'T2 register', 'https://example.test/', current_date)`,
      ),
    ]);
    expect(results).toEqual([
      refusedBy(UNIQUE_VIOLATION, "registry_sources_one_active"),
      refusedBy(CHECK_VIOLATION, "registry_sources_url"),
      refusedBy(CHECK_VIOLATION, "registry_sources_country"),
    ]);
  });
});

describe("queue 4 and the parameters of 08 RG100 (modele §4, D79)", () => {
  it("loads each parameter with its value of D79, beside claim_expiry_minutes", async () => {
    const rows = await migration<{ key: string; value: number }[]>`
      select key, value from backoffice.operational_settings order by key`;
    expect(Object.fromEntries(rows.map((row) => [row.key, row.value]))).toEqual(
      {
        audience_badge_validity_days: 90,
        audience_drop_alert_percent: 40,
        badge_grace_days: 30,
        // 0230 (L2F commit 05): the reminder before the expiry (08 RG70 « J-15 »)
        badge_reminder_days: 15,
        brand_badge_validity_months: 12,
        claim_expiry_minutes: 30,
        // 0232 (L2F commit 07): a decider of a single team decides a contest after it (08 RG77)
        dispute_reflection_hours: 24,
        dispute_window_days: 30,
        evidence_freshness_days: 30,
        evidence_max_files_per_request: 6,
        evidence_max_upload_bytes: 8388608,
        evidence_retention_days: 45,
        figures_gap_alert_percent: 30,
        findings_retention_days: 1095,
        rejection_cap_count: 3,
        rejection_cap_window_days: 30,
        request_retry_hours: 24,
        verification_code_validity_days: 7,
      },
    );
  });

  it.each([
    ["a fraction", "evidence_retention_days", "45.5"],
    ["a string", "verification_code_validity_days", '"7"'],
    ["above the ceiling of D82", "evidence_max_upload_bytes", "8388609"],
    ["zero", "rejection_cap_count", "0"],
  ])("refuses %s (23514)", async (_label, key, value) => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      run(
        tx,
        "update backoffice.operational_settings set value = $1::text::jsonb where key = $2",
        [value, key],
      ),
    );
    expect(result).toEqual(
      refusedBy(CHECK_VIOLATION, `operational_settings_${key}`),
    );
  });
});

describe("verification_requests: the entry of queue 4 (D81, file.md A1)", () => {
  it("freezes submitted_at, sla_due_at and escalate_at at the submission, whatever the writer gave", async () => {
    const row = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "account_verified");
      const [draft] = await tx<{ deadline: Date | null }[]>`
        select sla_due_at as deadline from verification.verification_requests
         where id = ${request}`;
      await tx`
        update verification.verification_requests
           set status = 'pending', sla_due_at = now() + interval '100 days'
         where id = ${request}`;
      const [submitted] = await tx<
        { submitted: boolean; frozen: boolean; escalation: boolean }[]
      >`
        select submitted_at = now() as submitted,
               sla_due_at = backoffice.business_deadline('verification', now(), 480) as frozen,
               escalate_at = backoffice.business_deadline('verification', sla_due_at, 960)
                 as escalation
          from verification.verification_requests where id = ${request}`;
      await tx`
        update verification.verification_requests
           set sla_due_at = now() + interval '100 days', escalate_at = null
         where id = ${request}`;
      const [kept] = await tx<{ kept: boolean }[]>`
        select sla_due_at = backoffice.business_deadline('verification', now(), 480) as kept
          from verification.verification_requests where id = ${request}`;
      return { draft: draft?.deadline, ...submitted, ...kept };
    });
    expect(row).toEqual({
      draft: null,
      submitted: true,
      frozen: true,
      escalation: true,
      kept: true,
    });
  });

  it("keeps one draft or pending request per (account, line, level) (RG21, 23505)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      await insertCreatorRequest(tx, "account_verified");
      return [
        await run(
          tx,
          `insert into verification.verification_requests
             (account_id, social_account_id, network_code, level, status)
           values ($1, $2, 'instagram', 'account_verified', 'pending')`,
          [creatorA, lineA],
        ),
        // another level of the same line is another triplet
        await run(
          tx,
          `insert into verification.verification_requests
             (account_id, social_account_id, network_code, level)
           values ($1, $2, 'instagram', 'audience_verified')`,
          [creatorA, lineA],
        ),
      ];
    });
    expect(results).toEqual([
      refusedBy(UNIQUE_VIOLATION, "verification_requests_one_open"),
      ACCEPTED_ONE,
    ]);
  });

  it("moves forward only: an ended request never changes status (55000)", async () => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      run(
        tx,
        `update verification.verification_requests set status = 'pending' where id = $1`,
        [VERIFICATION_IDS.request.a],
      ),
    );
    expect(result).toEqual(refusedBy(NOT_IN_PREREQUISITE_STATE));
  });

  it("L2E-D2: refuses a mute refusal, a creator reason on a brand request, a closure without account_unavailable", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(
        tx,
        "account_verified",
        "pending",
      );
      const [brand] = await tx<{ id: string }[]>`
        insert into verification.verification_requests (account_id, level, status)
        values (${brandA}, 'brand_verified', 'pending') returning id`;
      const decided = `decided_by_account_id = '${agentA}', decided_at = now(), closed_at = now()`;
      return [
        await run(
          tx,
          `update verification.verification_requests set status = 'rejected', ${decided}
            where id = $1`,
          [request],
        ),
        await run(
          tx,
          `update verification.verification_requests
              set status = 'rejected', rejection_reason_code = 'evidence_too_old', ${decided}
            where id = $1`,
          [brand?.id ?? ""],
        ),
        await run(
          tx,
          `update verification.verification_requests
              set status = 'closed', rejection_reason_code = 'other', closed_at = now()
            where id = $1`,
          [request],
        ),
        await run(
          tx,
          `update verification.verification_requests
              set status = 'rejected', rejection_reason_code = 'evidence_too_old', ${decided}
            where id = $1`,
          [request],
        ),
      ];
    });
    expect(results).toEqual([
      refusedBy(CHECK_VIOLATION, "verification_requests_rejection_reason"),
      refusedBy(FOREIGN_KEY_VIOLATION, "verification_requests_reason_fk"),
      refusedBy(CHECK_VIOLATION, "verification_requests_closed_reason"),
      ACCEPTED_ONE,
    ]);
  });

  it("refuses an approval without the named person who decided (RG47, 23514)", async () => {
    const result = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(
        tx,
        "account_verified",
        "pending",
      );
      return run(
        tx,
        `update verification.verification_requests set status = 'approved', closed_at = now()
          where id = $1`,
        [request],
      );
    });
    expect(result).toEqual(
      refusedBy(CHECK_VIOLATION, "verification_requests_decided"),
    );
  });
});

describe("ownership_codes and evidence_files (RG22, RG23, RG86)", () => {
  it("refuses an ambiguous code, a second live code and a finding without its handle", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "account_verified");
      const insert = (code: string, extra = "", values = "") =>
        run(
          tx,
          `insert into verification.ownership_codes
             (request_id, account_id, kind, code, expires_at${extra})
           values ($1, $2, 'network', '${code}', now() + interval '7 days'${values})`,
          [request, creatorA],
        );
      return [
        await insert("INFLUX-ABCDEFG0"),
        await insert("INFLUX-ABCDEFGH"),
        await insert("INFLUX-ABCDEFGJ"),
        await insert(
          "INFLUX-ABCDEFGK",
          ", observed_by_account_id, observed_at",
          `, '${agentA}', now()`,
        ),
      ];
    });
    expect(results).toEqual([
      refusedBy(CHECK_VIOLATION, "ownership_codes_code_shape"),
      ACCEPTED_ONE,
      refusedBy(UNIQUE_VIOLATION, "ownership_codes_one_live"),
      refusedBy(CHECK_VIOLATION, "ownership_codes_observed_network"),
    ]);
  });

  it("L2E-D1: refuses an evidence row without its date of purge (23502), accepts it with one", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "audience_verified");
      return [
        await run(
          tx,
          `insert into verification.evidence_files (request_id, account_id, received_bytes)
           values ($1, $2, 900000)`,
          [request, creatorA],
        ),
        await run(
          tx,
          `insert into verification.evidence_files
             (request_id, account_id, received_bytes, retention_due_at)
           values ($1, $2, 900000, now() + interval '45 days')`,
          [request, creatorA],
        ),
      ];
    });
    expect(results).toEqual([refusedBy(NOT_NULL_VIOLATION), ACCEPTED_ONE]);
  });

  it("generates the key from the account, the request and the row, never from the client", async () => {
    const row = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "audience_verified");
      const [evidence] = await tx<{ ok: boolean }[]>`
        insert into verification.evidence_files
          (request_id, account_id, received_bytes, retention_due_at)
        values (${request}, ${creatorA}, 900000, now() + interval '45 days')
        returning object_key = account_id || '/' || request_id || '/' || id || '.webp' as ok`;
      return evidence;
    });
    expect(row).toEqual({ ok: true });
  });
});

describe("badges: what the badge asserts (04 l. 1586, l. 6391)", () => {
  it.each(Object.keys(AUDIENCE_BADGE) as (keyof typeof AUDIENCE_BADGE)[])(
    "L2E-D3: refuses an audience badge without %s (23514)",
    async (column) => {
      const result = await inRolledBackTransaction(migration, async (tx) => {
        const request = await insertCreatorRequest(tx, "audience_verified");
        return run(tx, audienceBadgeInsert(request, column));
      });
      expect(result).toEqual(
        refusedBy(CHECK_VIOLATION, "badges_audience_figures"),
      );
    },
  );

  it("refuses a negative figure, an engagement above 100 % and an account badge with an expiry", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "audience_verified");
      return [
        await run(tx, audienceBadgeInsert(request).replace("47300,", "-1,")),
        await run(
          tx,
          audienceBadgeInsert(request)
            .replace("state,", "state, observed_engagement_bp,")
            .replace("'active',", "'active', 10001,"),
        ),
        await run(
          tx,
          `insert into verification.badges
             (account_id, social_account_id, network_code, request_id, level,
              granted_by_account_id, granted_at, evidence_source, observed_handle_at_decision,
              expires_at)
           values ($1, $2, 'instagram', $3, 'account_verified', $4, now(), 'public_profile',
                   't2_creator_a', now() + interval '90 days')`,
          [creatorA, lineA, VERIFICATION_IDS.request.a, agentA],
        ),
      ];
    });
    expect(results).toEqual([
      refusedBy(CHECK_VIOLATION, "badges_figures_positive"),
      refusedBy(CHECK_VIOLATION, "badges_engagement_bp"),
      refusedBy(CHECK_VIOLATION, "badges_expiry"),
    ]);
  });

  it("L2E-D4: one holding badge per (account, line, level); a replaced badge leaves the place", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const request = await insertCreatorRequest(tx, "audience_verified");
      return [
        await run(tx, audienceBadgeInsert(request)),
        await run(tx, audienceBadgeInsert(request, undefined, "to_reconfirm")),
        await run(tx, audienceBadgeInsert(request, undefined, "replaced")),
        await run(
          tx,
          `update verification.badges set state = 'replaced'
            where request_id = $1 and state = 'active'`,
          [request],
        ),
        await run(tx, audienceBadgeInsert(request, undefined, "to_refresh")),
      ];
    });
    expect(results).toEqual([
      ACCEPTED_ONE,
      refusedBy(UNIQUE_VIOLATION, "badges_holding_unique"),
      ACCEPTED_ONE,
      ACCEPTED_ONE,
      ACCEPTED_ONE,
    ]);
  });
});

describe("rights the T2 matrix does not read (fiche invariant 1, EC-L2E-18)", () => {
  it("gives influx_advertiser nothing on the schema verification, USAGE included", async () => {
    const [row] = await migration<{ usage: boolean; defaults: number }[]>`
      select pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE')
               as usage,
             (select count(*)::int
                from pg_catalog.pg_default_acl d, pg_catalog.aclexplode(d.defaclacl) a
               where d.defaclnamespace = 'verification'::regnamespace
                 and a.grantee = 'influx_advertiser'::regrole::oid) as defaults`;
    expect(row).toEqual({ usage: false, defaults: 0 });
  });

  it("answers 42501 to the advertiser, and to the creator on the lock, the finding and the key", async () => {
    const results = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => [
        await actAsMember(
          tx,
          "influx_advertiser",
          { accountId: brandA, role: "advertiser", aal: "aal2" },
          () => run(tx, "select id from verification.verification_requests"),
        ),
        ...(await actAsMember(
          tx,
          "influx_creator",
          { accountId: creatorA, role: "creator", aal: "aal1" },
          async () => [
            await run(
              tx,
              "select status from verification.verification_requests",
            ),
            await run(
              tx,
              "select claimed_by_account_id from verification.verification_requests",
            ),
            await run(
              tx,
              "select observed_handle from verification.ownership_codes",
            ),
            await run(tx, "select object_key from verification.evidence_files"),
            await run(tx, "select observed_followers from verification.badges"),
          ],
        )),
      ],
    );
    expect(results).toEqual([
      refusedBy(INSUFFICIENT_PRIVILEGE),
      expect.objectContaining({ outcome: "rows" }),
      refusedBy(INSUFFICIENT_PRIVILEGE),
      refusedBy(INSUFFICIENT_PRIVILEGE),
      refusedBy(INSUFFICIENT_PRIVILEGE),
      refusedBy(INSUFFICIENT_PRIVILEGE),
    ]);
  });
});
