// L2E commit 11 — the database and packages/domain hold the same rules (jalons/l2e/11.md; fiche
// invariant 6; 08 RG36 to RG38bis, RG56, cas limite 2; 0221, 0222, 0224): L2E-U1 parity of the period
// (all four refusals, the boundary day of the freshness read from the table), of the typed figures,
// of the free texts, of the bounds (checks of the tables) and of the closed lists (enums and reason
// tables) with the constants of the domain and of the contract. The checks have no EXECUTE for
// anyone: the local superuser calls them, in a rolled-back transaction, as the decision functions do.
import {
  BRAND_CONSTAT_CHANNELS,
  BRAND_REJECTION_REASON_CODES,
  CREATOR_REJECTION_REASON_CODES,
  DISPUTE_KINDS,
  DISPUTE_OUTCOME_REASON_CODES as CONTRACT_DISPUTE_OUTCOME_REASON_CODES,
  DISPUTE_OUTCOMES,
  DISPUTE_REASON_CODES as CONTRACT_DISPUTE_REASON_CODES,
  DISPUTE_REVIEW_MODES,
  DISPUTE_WITHDRAWN_CAUSES,
  IDENTIFIER_REVIEW_STATES,
  IDENTIFIER_WITHDRAWN_CAUSES,
  OPENING_REASON_CODES as CONTRACT_OPENING_REASON_CODES,
  REVOCATION_REASON_CODES as CONTRACT_REVOCATION_REASON_CODES,
  VERIFICATION_DISPUTE_TEXT_MAX_LENGTH,
  VERIFICATION_ENGAGEMENT_BP_MAX,
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_LEGAL_NAME_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH,
  VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH,
} from "@influx/contracts/verification";
import {
  checkDisputeText,
  checkObservedFigures,
  checkObservedPeriod,
  checkRevocationReason,
  CONSUMER_EMAIL_DOMAINS,
  DISPUTE_OUTCOME_REASONS,
  DISPUTE_REASONS,
  DISPUTE_STATES,
  DISPUTE_TEXT_MAX_LENGTH,
  disputeWindow,
  INTERNAL_COMMENT_MAX_LENGTH,
  isInternalComment,
  isOwnershipCode,
  LEGAL_NAME_MAX_LENGTH,
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MIN_LENGTH,
  OBSERVED_ENGAGEMENT_BP_MAX,
  OBSERVED_CHANNELS,
  OBSERVED_HANDLE_MAX_LENGTH,
  OPENING_REASONS,
  OWNERSHIP_CODE_ALPHABET,
  REGISTRATION_NUMBER_MAX_LENGTH,
  REVOCATION_REASONS,
  VERIFICATION_BADGE_STATES,
  VERIFICATION_EVIDENCE_STATES,
  VERIFICATION_LEVELS,
  VERIFICATION_OPENERS,
  VERIFICATION_PARAMETERS,
  VERIFICATION_REQUEST_STATUSES,
} from "@influx/domain/verification";
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { actAsMember, localSuperuser, testDataSet } from "./support.ts";

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

// ---------------------------------------------------------------------------------------------
// L2F commit 11: the cycle of the badge (0230 to 0234), jalons/l2f/11.md. The lists, the window of a
// contest and the settings of packages/domain are held equal to the tables the migrations wrote.
// ---------------------------------------------------------------------------------------------

describe("L2F-U1 parity: the reasons and the closed lists of the cycle of the badge (0231, 0232, 0234)", () => {
  it("holds the reasons of a withdrawal of the table, with their levels, message and escalation, in the order of the domain and the contract", async () => {
    await scenario(async (tx) => {
      const rows = await tx<
        {
          code: string;
          levels: string;
          requires: boolean;
          escalates: boolean;
        }[]
      >`
        select code, levels::text as levels, requires_member_message as requires,
               escalates_to_admin as escalates
          from verification.revocation_reasons where is_active order by position`;
      expect(
        rows.map((row) => ({
          code: row.code,
          levels: row.levels.slice(1, -1).split(","),
          requiresMemberMessage: row.requires,
          escalatesToAdmin: row.escalates,
        })),
      ).toEqual(
        REVOCATION_REASONS.map((reason) => ({
          code: reason.code,
          levels: [...reason.levels],
          requiresMemberMessage: reason.requiresMemberMessage,
          escalatesToAdmin: reason.escalatesToAdmin,
        })),
      );
      expect(rows.map((row) => row.code)).toEqual([
        ...CONTRACT_REVOCATION_REASON_CODES,
      ]);
    });
  });

  it("refuses a withdrawal as packages/domain does, for every level, every reason and every message", async () => {
    await scenario(async (tx) => {
      const messages: (string | null)[] = [
        null,
        "m".repeat(19),
        "m".repeat(20),
        "m".repeat(500),
        "m".repeat(501),
        " ".repeat(30),
        "bell\u0007 and more words",
      ];
      const reasons = [
        ...REVOCATION_REASONS.map((reason) => reason.code),
        "other",
        "unknown",
      ];
      let compared = 0;
      for (const level of VERIFICATION_LEVELS) {
        for (const reasonCode of reasons) {
          for (const memberMessage of messages) {
            const database = await refusal(
              tx,
              "select verification.check_revocation_reason($1::verification.badge_level, $2::text, $3::text)",
              [level, reasonCode, memberMessage],
            );
            const domain = checkRevocationReason({
              level,
              reasonCode,
              memberMessage,
            });
            expect(
              domain.ok ? null : domain.refusal,
              `${level} ${reasonCode} ${JSON.stringify(memberMessage)}`,
            ).toBe(database);
            compared += 1;
          }
        }
      }
      expect(compared).toBe(3 * 9 * 7);
    });
  });

  it("holds the reasons and the motives of a contest, and the reasons of an opening, as the domain and the contract list them", async () => {
    await scenario(async (tx) => {
      const disputeReasons = await tx<{ code: string; requires: boolean }[]>`
        select code, requires_text as requires from verification.dispute_reasons
         where is_active order by position`;
      expect(
        disputeReasons.map((row) => ({
          code: row.code,
          requiresText: row.requires,
        })),
      ).toEqual(DISPUTE_REASONS.map((reason) => ({ ...reason })));
      expect(disputeReasons.map((row) => row.code)).toEqual([
        ...CONTRACT_DISPUTE_REASON_CODES,
      ]);
      const outcomes = await tx<
        { code: string; outcome: string; requires: boolean }[]
      >`
        select code, outcome::text as outcome, requires_member_message as requires
          from verification.dispute_outcome_reasons where is_active order by position`;
      expect(
        outcomes.map((row) => ({
          code: row.code,
          outcome: row.outcome,
          requiresMemberMessage: row.requires,
        })),
      ).toEqual(DISPUTE_OUTCOME_REASONS.map((reason) => ({ ...reason })));
      expect(outcomes.map((row) => row.code)).toEqual([
        ...CONTRACT_DISPUTE_OUTCOME_REASON_CODES,
      ]);
      const opening = await tx<{ code: string; requires: boolean }[]>`
        select code, requires_comment as requires from verification.opening_reasons
         where is_active order by position`;
      expect(
        opening.map((row) => ({
          code: row.code,
          requiresComment: row.requires,
        })),
      ).toEqual(OPENING_REASONS.map((reason) => ({ ...reason })));
      expect(opening.map((row) => row.code)).toEqual([
        ...CONTRACT_OPENING_REASON_CODES,
      ]);
    });
  });

  it("holds the enums and the checks of the cycle with the domain and the contract", async () => {
    await scenario(async (tx) => {
      const labels = async (type: string) =>
        (
          await tx<{ label: string }[]>`
            select unnest(enum_range(null::${tx.unsafe(`verification.${type}`)}))::text as label`
        ).map((row) => row.label);
      expect(await labels("dispute_state")).toEqual([...DISPUTE_STATES]);
      expect(await labels("identifier_review_state")).toEqual([
        ...IDENTIFIER_REVIEW_STATES,
      ]);
      const literals = async (table: string, name: string) => {
        const [row] = await tx<{ definition: string }[]>`
          select pg_get_constraintdef(c.oid) as definition
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
           where n.nspname = 'verification' and t.relname = ${table} and c.conname = ${name}`;
        if (row === undefined) throw new Error(`${table}.${name} is missing`);
        return [...row.definition.matchAll(/'([a-z_]+)'::text/gu)].map(
          (match) => match[1] ?? "",
        );
      };
      expect(
        await literals("ownership_codes", "ownership_codes_channel"),
      ).toEqual([...OBSERVED_CHANNELS]);
      expect([...BRAND_CONSTAT_CHANNELS]).toEqual([...OBSERVED_CHANNELS]);
      expect(await literals("disputes", "disputes_withdrawn_cause")).toEqual([
        ...DISPUTE_WITHDRAWN_CAUSES,
      ]);
      expect(
        await literals(
          "identifier_change_reviews",
          "identifier_change_reviews_withdrawn_cause",
        ),
      ).toEqual([...IDENTIFIER_WITHDRAWN_CAUSES]);
      expect(await literals("disputes", "disputes_review_mode")).toEqual([
        ...DISPUTE_REVIEW_MODES,
      ]);
      expect([...DISPUTE_OUTCOMES]).toEqual(["upheld", "overturned"]);
      expect([...DISPUTE_KINDS]).toEqual(["refusal", "revocation"]);
      expect([...VERIFICATION_OPENERS]).toEqual(["member", "agent"]);
    });
  });

  it("lists the consumer mailboxes of the table, the 45 of the annexe, and nothing else", async () => {
    await scenario(async (tx) => {
      const rows = await tx<{ domain: string }[]>`
        select domain from verification.consumer_email_domains order by domain`;
      expect(rows.map((row) => row.domain)).toEqual(
        [...CONSUMER_EMAIL_DOMAINS].sort(),
      );
    });
  });
});

describe("L2F-U1 parity: the settings of the cycle of the badge (0221, 0230, 0232)", () => {
  it("starts each setting at the value of the domain and refuses a value outside its bounds, a fraction too", async () => {
    await scenario(async (tx) => {
      const attempt = async (key: string, value: number) => {
        await tx`savepoint probe`;
        try {
          await tx`update backoffice.operational_settings set value = to_jsonb(${value}::numeric) where key = ${key}`;
          await tx`rollback to savepoint probe`;
          return "accepted";
        } catch (error) {
          await tx`rollback to savepoint probe`;
          return (error as { code?: string }).code ?? "unknown";
        }
      };
      for (const parameter of VERIFICATION_PARAMETERS) {
        expect(await setting(tx, parameter.key), parameter.key).toBe(
          parameter.start,
        );
        expect(await attempt(parameter.key, parameter.min), parameter.key).toBe(
          "accepted",
        );
        expect(await attempt(parameter.key, parameter.max), parameter.key).toBe(
          "accepted",
        );
        expect(
          await attempt(parameter.key, parameter.min - 1),
          parameter.key,
        ).toBe("23514");
        expect(
          await attempt(parameter.key, parameter.max + 1),
          parameter.key,
        ).toBe("23514");
        expect(
          await attempt(parameter.key, parameter.min + 0.5),
          parameter.key,
        ).toBe("23514");
      }
    });
  });
});

describe("L2F-U2 parity: the window and the text of a contest (0232 submit_own_dispute, 08 RG77, CA52)", () => {
  const creator = accountIdOf("creator", "a");
  const agent = accountIdOf("agent", "a");
  const line = CREATOR_SOCIAL_ACCOUNT_IDS.a;

  beforeAll(async () => {
    await testDataSet();
  });

  /** A request of creator A refused `seconds` seconds before the database's `now()`, as reject_request() leaves it. */
  async function refusedAgo(tx: Tx, seconds: number): Promise<string> {
    const [row] = await tx<{ id: string }[]>`
      insert into verification.verification_requests
        (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
         rejection_reason_code)
      values (${creator}, ${line}, 'instagram', 'account_verified', 'rejected',
              now() - make_interval(secs => ${seconds + 172800}),
              now() - make_interval(secs => ${seconds + 86400}),
              now() - make_interval(secs => ${seconds + 86400}) + interval '1 hour',
              now() - make_interval(secs => ${seconds + 86400}) + interval '2 hours',
              ${agent}, now() - make_interval(secs => ${seconds}),
              now() - make_interval(secs => ${seconds}), 'ownership_not_proven')
      returning id::text as id`;
    if (row === undefined) throw new Error("no request");
    return row.id;
  }

  /** What the creator's door says of a contest, rolled back whatever it says: null, or the DETAIL of the refusal. */
  async function submitted(
    tx: Tx,
    request: string,
    reason: string,
    text: string | null,
  ): Promise<string | null> {
    return actAsMember(
      tx,
      "influx_creator",
      { accountId: creator, role: "creator", aal: "aal1" },
      async () => {
        await tx`savepoint probe`;
        try {
          await tx.unsafe(
            "select verification.submit_own_dispute($1::uuid, null::uuid, $2::text, $3::text)",
            [request, reason, text],
          );
          await tx`rollback to savepoint probe`;
          return null;
        } catch (error) {
          await tx`rollback to savepoint probe`;
          const found = error as { code?: string; detail?: string };
          if (found.code !== "55000" && found.code !== "22023") throw error;
          return found.detail ?? "";
        }
      },
    );
  }

  it("opens and closes the window where packages/domain does, the closing instant included", async () => {
    await scenario(async (tx) => {
      const windowDays = await setting(tx, "dispute_window_days");
      expect(windowDays).toBe(30);
      const day = 86_400;
      const offsets: [string, number][] = [
        ["fresh", 60],
        ["29 days", 29 * day],
        ["30 days exactly", 30 * day],
        ["30 days and a second", 30 * day + 1],
        ["31 days", 31 * day],
      ];
      const opened: boolean[] = [];
      for (const [label, seconds] of offsets) {
        const request = await refusedAgo(tx, seconds);
        const [clock] = await tx<{ now: Date; decided: Date }[]>`
          select now() as now, decided_at as decided
            from verification.verification_requests where id = ${request}`;
        if (clock === undefined) throw new Error("no clock");
        const database = await submitted(tx, request, "misread", null);
        const domain = disputeWindow({
          notifiedAt: clock.decided,
          now: clock.now,
          windowDays,
        });
        expect(domain.open, label).toBe(database === null);
        if (database !== null)
          expect(database, label).toBe(
            // the detail of dispute_window_closed is the closing instant, ISO, to the second
            domain.closesAt.toISOString().slice(0, 19) + "Z",
          );
        opened.push(domain.open);
      }
      expect(opened).toEqual([true, true, true, false, false]);
    });
  });

  it("moves with the setting alone: 40 days is open at 45 and closed at 30, on both sides", async () => {
    await scenario(async (tx) => {
      const request = await refusedAgo(tx, 40 * 86_400);
      const [clock] = await tx<{ now: Date; decided: Date }[]>`
        select now() as now, decided_at as decided
          from verification.verification_requests where id = ${request}`;
      if (clock === undefined) throw new Error("no clock");
      expect(await submitted(tx, request, "misread", null)).not.toBeNull();
      await tx`update backoffice.operational_settings set value = to_jsonb(45) where key = 'dispute_window_days'`;
      expect(await submitted(tx, request, "misread", null)).toBeNull();
      expect(
        disputeWindow({
          notifiedAt: clock.decided,
          now: clock.now,
          windowDays: 45,
        }).open,
      ).toBe(true);
      expect(
        disputeWindow({
          notifiedAt: clock.decided,
          now: clock.now,
          windowDays: 30,
        }).open,
      ).toBe(false);
    });
  });

  it("refuses the same texts, `other` without one included, as the contact-free rules of packages/domain", async () => {
    await scenario(async (tx) => {
      const request = await refusedAgo(tx, 60);
      const cases: [string, string, string | null][] = [
        ["no text, misread", "misread", null],
        ["no text, other", "other", null],
        ["text, other", "other", "My capture shows the period asked for."],
        ["blank", "misread", "   "],
        ["empty", "misread", ""],
        ["1 000 characters", "misread", "x".repeat(DISPUTE_TEXT_MAX_LENGTH)],
        [
          "1 001 characters",
          "misread",
          "x".repeat(DISPUTE_TEXT_MAX_LENGTH + 1),
        ],
        ["control character", "misread", "bell\u0007 in the text"],
        ["two lines", "misread", "two\nlines"],
        ["emoji", "other", "😀 it is mine"],
        ["a pseudo", "other", "It is @maison.aube, as shown."],
      ];
      for (const [label, reasonCode, text] of cases) {
        const database = await submitted(tx, request, reasonCode, text);
        const domain = checkDisputeText({ reasonCode, text });
        expect(domain.ok, label).toBe(database === null);
        if (database !== null) expect(database, label).toBe("text");
      }
      expect(VERIFICATION_DISPUTE_TEXT_MAX_LENGTH).toBe(
        DISPUTE_TEXT_MAX_LENGTH,
      );
    });
  });
});
