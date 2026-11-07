// L2E commit 11 — the database and packages/domain hold the same rules (jalons/l2e/11.md; fiche
// invariant 6; 08 RG36 to RG38bis, RG56, cas limite 2; 0221, 0222, 0224): L2E-U1 parity of the period
// (all four refusals, the boundary day of the freshness read from the table), of the typed figures,
// of the free texts, of the bounds (checks of the tables) and of the closed lists (enums and reason
// tables) with the constants of the domain and of the contract. The checks have no EXECUTE for
// anyone: the local superuser calls them, in a rolled-back transaction, as the decision functions do.
import {
  BRAND_REJECTION_REASON_CODES,
  CREATOR_REJECTION_REASON_CODES,
  VERIFICATION_ENGAGEMENT_BP_MAX,
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_LEGAL_NAME_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH,
  VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH,
} from "@influx/contracts/verification";
import {
  checkObservedFigures,
  checkObservedPeriod,
  INTERNAL_COMMENT_MAX_LENGTH,
  isInternalComment,
  isOwnershipCode,
  LEGAL_NAME_MAX_LENGTH,
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MIN_LENGTH,
  OBSERVED_ENGAGEMENT_BP_MAX,
  OBSERVED_HANDLE_MAX_LENGTH,
  OWNERSHIP_CODE_ALPHABET,
  REGISTRATION_NUMBER_MAX_LENGTH,
  VERIFICATION_BADGE_STATES,
  VERIFICATION_EVIDENCE_STATES,
  VERIFICATION_LEVELS,
  VERIFICATION_REQUEST_STATUSES,
} from "@influx/domain/verification";
import { inRolledBackTransaction } from "@influx/test-kit/db";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { localSuperuser } from "./support.ts";

type Tx = postgres.TransactionSql;

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** What a check says: nothing, or the DETAIL it raises. */
async function refusal(
  tx: Tx,
  statement: string,
  parameters: postgres.ParameterOrJSON<never>[],
): Promise<string | null> {
  await tx`savepoint probe`;
  try {
    await tx.unsafe(statement, parameters);
    await tx`release savepoint probe`;
    return null;
  } catch (error) {
    await tx`rollback to savepoint probe`;
    const found = error as { code?: string; detail?: string };
    if (found.code !== "22023") throw error;
    return found.detail ?? "";
  }
}

/** A calendar day `offset` days from the database's UTC today. */
async function dayAt(tx: Tx, offset: number): Promise<string> {
  const [row] = await tx<{ day: string }[]>`
    select to_char((now() at time zone 'UTC')::date + ${offset}::int, 'YYYY-MM-DD') as day`;
  return row?.day ?? "";
}

async function setting(tx: Tx, key: string): Promise<number> {
  const [row] = await tx<{ value: string }[]>`
    select value::text as value from backoffice.operational_settings where key = ${key}`;
  return Number(JSON.parse(row?.value ?? "null"));
}

/** The numbers of a check constraint's definition, by its name. */
async function constraintNumbers(
  tx: Tx,
  schema: string,
  table: string,
  name: string,
): Promise<number[]> {
  const [row] = await tx<{ definition: string }[]>`
    select pg_get_constraintdef(c.oid) as definition
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = ${schema} and t.relname = ${table} and c.conname = ${name}`;
  if (row === undefined)
    throw new Error(`${schema}.${table}.${name} is missing`);
  return [...row.definition.matchAll(/\d+/gu)].map((match) => Number(match[0]));
}

describe("L2E-U1 parity: the period of a constat (0224 check_observed_period, 08 RG36, RG37, cas limite 2)", () => {
  it("gives the same refusal as packages/domain for every case, the boundary day of the freshness included", async () => {
    await scenario(async (tx) => {
      const freshness = await setting(tx, "evidence_freshness_days");
      expect(freshness).toBe(30);
      const today = await dayAt(tx, 0);
      const cases: [string, number | null, number | null][] = [
        ["both ends today", 0, 0],
        ["a month, ended yesterday", -29, -1],
        ["last fresh day", -40, -(freshness - 1)],
        ["first stale day", -40, -freshness],
        ["long stale", -90, -60],
        ["end tomorrow", -5, 1],
        ["start and end tomorrow", 1, 1],
        ["start after end", -1, -3],
        ["start after end, both stale", -10, -50],
        ["start missing", null, -2],
        ["end missing", -5, null],
        ["both missing", null, null],
      ];
      for (const [label, startOffset, endOffset] of cases) {
        const start =
          startOffset === null ? null : await dayAt(tx, startOffset);
        const end = endOffset === null ? null : await dayAt(tx, endOffset);
        const database = await refusal(
          tx,
          "select verification.check_observed_period($1::date, $2::date)",
          [start, end],
        );
        const domain = checkObservedPeriod({
          start,
          end,
          today,
          freshnessDays: freshness,
        });
        expect(domain.ok ? null : domain.reason, label).toBe(database);
      }
    });
  });

  it("moves with the setting alone: the same period passes at 60 days and is refused at 30, on both sides", async () => {
    await scenario(async (tx) => {
      const today = await dayAt(tx, 0);
      const start = await dayAt(tx, -60);
      const end = await dayAt(tx, -45);
      const call =
        "select verification.check_observed_period($1::date, $2::date)";
      expect(await refusal(tx, call, [start, end])).toBe("period_too_old");
      await tx`update backoffice.operational_settings set value = to_jsonb(60) where key = 'evidence_freshness_days'`;
      expect(await refusal(tx, call, [start, end])).toBeNull();
      expect(
        checkObservedPeriod({ start, end, today, freshnessDays: 60 }),
      ).toEqual({ ok: true });
      expect(
        checkObservedPeriod({ start, end, today, freshnessDays: 30 }),
      ).toEqual({ ok: false, reason: "period_too_old" });
    });
  });
});

describe("L2E-U1 parity: the typed figures (0224 check_observed_figures, 08 RG38, RG38bis, EC-L2E-12)", () => {
  it("names the same field as packages/domain, zero accepted, 350 % refused, an absent engagement accepted", async () => {
    await scenario(async (tx) => {
      type Figures = [
        number | null,
        number | null,
        number | null,
        number | null,
      ];
      const cases: [string, Figures][] = [
        ["usual", [47300, 12, 40, 350]],
        ["zeros", [0, 0, 0, 0]],
        ["no engagement", [1000, 3, 2, null]],
        ["full engagement", [1000, 3, 2, 10000]],
        ["engagement 350 %", [1000, 3, 2, 35000]],
        ["engagement over", [1000, 3, 2, 10001]],
        ["engagement negative", [1000, 3, 2, -1]],
        ["followers negative", [-1, 3, 2, null]],
        ["followers missing", [null, 3, 2, null]],
        ["posts negative", [10, -3, 2, null]],
        ["posts missing", [10, null, 2, null]],
        ["comments negative", [10, 3, -2, null]],
        ["comments missing", [10, 3, null, null]],
        ["first of two refusals", [-1, -1, -1, 99999]],
      ];
      for (const [label, [followers, posts, comments, engagement]] of cases) {
        const database = await refusal(
          tx,
          "select verification.check_observed_figures($1::bigint, $2::integer, $3::bigint, $4::integer)",
          [followers, posts, comments, engagement],
        );
        const domain = checkObservedFigures({
          followers,
          postsLast30Days: posts,
          avgComments: comments,
          engagementBp: engagement,
        });
        expect(domain.ok ? null : domain.field, label).toBe(database);
      }
    });
  });
});

describe("L2E-U1 parity: the free texts, the bounds and the code (0221, 0222, 0224)", () => {
  it("accepts and refuses the same internal comments", async () => {
    await scenario(async (tx) => {
      const texts: (string | null)[] = [
        "Capture lisible.",
        "x".repeat(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH),
        "x".repeat(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH + 1),
        "",
        "   ",
        "two\nlines",
        "tab\there",
        "bell\u0007",
        "delete\u007F",
        "next\u0085line",
        "émoji 😀 ok",
        "😀".repeat(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH),
      ];
      for (const text of texts) {
        const database = await refusal(
          tx,
          "select verification.check_internal_comment($1::text)",
          [text],
        );
        expect(isInternalComment(text ?? "x"), JSON.stringify(text)).toBe(
          database === null,
        );
      }
    });
  });

  it("holds the same bounds as the checks of the tables, in the domain and in the contract", async () => {
    await scenario(async (tx) => {
      expect(
        await constraintNumbers(
          tx,
          "verification",
          "ownership_codes",
          "ownership_codes_observed_handle",
        ),
      ).toContain(OBSERVED_HANDLE_MAX_LENGTH);
      expect(
        await constraintNumbers(
          tx,
          "verification",
          "verification_requests",
          "verification_requests_member_message_length",
        ),
      ).toEqual(
        expect.arrayContaining([
          MEMBER_MESSAGE_MIN_LENGTH,
          MEMBER_MESSAGE_MAX_LENGTH,
        ]),
      );
      expect(
        await constraintNumbers(
          tx,
          "verification",
          "verification_requests",
          "verification_requests_internal_comment_length",
        ),
      ).toEqual(expect.arrayContaining([1, INTERNAL_COMMENT_MAX_LENGTH]));
      expect(
        await constraintNumbers(
          tx,
          "verification",
          "badges",
          "badges_engagement_bp",
        ),
      ).toEqual(expect.arrayContaining([0, OBSERVED_ENGAGEMENT_BP_MAX]));
      expect(
        await constraintNumbers(
          tx,
          "profiles",
          "advertiser_internal_details",
          "advertiser_internal_details_legal_name",
        ),
      ).toEqual(expect.arrayContaining([1, LEGAL_NAME_MAX_LENGTH]));
      expect(
        await constraintNumbers(
          tx,
          "profiles",
          "advertiser_internal_details",
          "advertiser_internal_details_registration_number",
        ),
      ).toEqual(expect.arrayContaining([1, REGISTRATION_NUMBER_MAX_LENGTH]));
    });
    expect(VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH).toBe(
      OBSERVED_HANDLE_MAX_LENGTH,
    );
    expect(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH).toBe(
      INTERNAL_COMMENT_MAX_LENGTH,
    );
    expect(VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH).toBe(
      MEMBER_MESSAGE_MIN_LENGTH,
    );
    expect(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH).toBe(
      MEMBER_MESSAGE_MAX_LENGTH,
    );
    expect(VERIFICATION_LEGAL_NAME_MAX_LENGTH).toBe(LEGAL_NAME_MAX_LENGTH);
    expect(VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH).toBe(
      REGISTRATION_NUMBER_MAX_LENGTH,
    );
    expect(VERIFICATION_ENGAGEMENT_BP_MAX).toBe(OBSERVED_ENGAGEMENT_BP_MAX);
  });

  it("issues only codes the domain reads, from the alphabet it holds", async () => {
    await scenario(async (tx) => {
      const [source] = await tx<{ prosrc: string }[]>`
        select prosrc from pg_proc
         where proname = 'new_ownership_code' and pronamespace = 'verification'::regnamespace`;
      expect(source?.prosrc).toContain(`'${OWNERSHIP_CODE_ALPHABET}'`);
      const codes = await tx<{ code: string }[]>`
        select verification.new_ownership_code() as code from generate_series(1, 300)`;
      expect(codes).toHaveLength(300);
      expect(codes.filter((row) => !isOwnershipCode(row.code))).toEqual([]);
    });
  });
});

describe("L2E-U1 parity: the closed lists (0221) with the domain and the contract", () => {
  it("holds the same enums, in the same order", async () => {
    await scenario(async (tx) => {
      const labels = async (type: string) =>
        (
          await tx<{ label: string }[]>`
            select unnest(enum_range(null::${tx.unsafe(`verification.${type}`)}))::text as label`
        ).map((row) => row.label);
      expect(await labels("badge_level")).toEqual([...VERIFICATION_LEVELS]);
      expect(await labels("request_status")).toEqual([
        ...VERIFICATION_REQUEST_STATUSES,
      ]);
      expect(await labels("badge_state")).toEqual([
        ...VERIFICATION_BADGE_STATES,
      ]);
      expect(await labels("evidence_state")).toEqual([
        ...VERIFICATION_EVIDENCE_STATES,
      ]);
    });
  });

  it("holds the same reasons of refusal, by population and position, as the contract", async () => {
    await scenario(async (tx) => {
      const codes = async (population: string) =>
        (
          await tx<{ code: string }[]>`
            select code from verification.rejection_reasons
             where population = ${population} and is_active order by position`
        ).map((row) => row.code);
      expect(await codes("creator")).toEqual([
        ...CREATOR_REJECTION_REASON_CODES,
      ]);
      expect(await codes("brand")).toEqual([...BRAND_REJECTION_REASON_CODES]);
    });
  });
});
