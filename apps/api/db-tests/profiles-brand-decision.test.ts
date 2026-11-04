// L2C commit 07 — the claim, the release and the decision on an entry of queue 1 (0210;
// jalons/l2c/file.md A2, A3, A5 to A9, "Fonctions", "Codes", D81; 04 l. 2465-2480; 06 RG6, RG9,
// RG10, RG63 to RG69, RG78; 15 RG27 C1 to C8, RG35, RG36). L2C-V1 to V4 (the lock), L2C-D1 to D6
// (the decisions), the one profile.completed of RG78, the refusals role by role (RG6) and the codes
// of the register (T3); L2C commit 09a (0211): the code of the decision e-mail in its payload and the
// worker's read leads.read_brevo_profile_decision(). Each case runs in a rolled-back transaction of the local superuser, which
// acts as apps/api does (support.ts); L2C-V1 alone commits its fixture: two real concurrent
// transactions need rows both of them see.
import {
  accountIdOf,
  BRAND_LOGO_IDS,
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  REVIEW_ENTRY_IDS,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  type Actor,
} from "./support.ts";

const OBJECT_NOT_IN_PREREQUISITE_STATE = "55000";
const LOCK_NOT_AVAILABLE = "55P03";
const INVALID_PARAMETER_VALUE = "22023";
const CHECK_VIOLATION = "23514";
const INSUFFICIENT_PRIVILEGE = "42501";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const creatorA = accountIdOf("creator", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[] }
  | { outcome: "error"; code: string; detail?: string };

/** The statement with its `$n` written as literals (fixed test identifiers and texts). */
function inline(statement: string, values: readonly (string | null)[]): string {
  return statement.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = values[Number(index) - 1];
    if (value === undefined) {
      throw new Error(`no value for $${index}`);
    }
    return value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
  });
}

/** A statement in a savepoint: its rows, or its SQLSTATE and DETAIL. */
async function attempt(
  tx: Tx,
  statement: string,
  values: readonly (string | null)[] = [],
): Promise<Attempt> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(inline(statement, values)),
    );
    return { outcome: "rows", rows: [...rows] as Row[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) {
      throw error;
    }
    return { outcome: "error", code: found.code, detail: found.detail };
  }
}

function refusal(result: Attempt): { code: string; detail?: string } {
  return result.outcome === "error"
    ? { code: result.code, detail: result.detail }
    : { code: "rows" };
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`refused: ${result.code} ${result.detail ?? ""}`);
  }
  return result.rows;
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

type Internal = { account: string; role: "agent" | "admin" };
const AGENT_A: Internal = { account: agentA, role: "agent" };
const AGENT_B: Internal = { account: agentB, role: "agent" };
const ADMIN_A: Internal = { account: adminA, role: "admin" };

function asInternal<T>(
  tx: Tx,
  who: Internal,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal },
    fn,
  );
}

const PRESENTATION = "We design durable outdoor gear. ".repeat(4).trim(); // 127 characters
const OTHER_MESSAGE =
  "Please describe what your brand sells in your presentation.";

/** Completes brand A's profile as the superuser (the data set holds its lists); stays draft. */
async function completeBrandA(tx: Tx): Promise<void> {
  await tx`
    update profiles.advertiser_profiles
       set primary_sector_code = 'sports_leisure', company_size_band = '11_50',
           presentation = ${PRESENTATION}, contact_role = 'marketing'
     where account_id = ${brandA}`;
}

/** Brand A submits through its door; returns the open entry. */
async function submitBrandA(tx: Tx): Promise<string> {
  rowsOf(
    await asBrand(tx, brandA, () =>
      attempt(
        tx,
        "select status from profiles.submit_own_advertiser_profile()",
      ),
    ),
  );
  return openEntryOf(tx, brandA);
}

async function openEntryOf(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from profiles.advertiser_review_entries
     where account_id = ${account} and state = 'open'`;
  if (row === undefined) {
    throw new Error("no open entry");
  }
  return row.id;
}

/** A complete brand A, submitted: its entry of kind `submission`. */
async function submittedBrandA(tx: Tx): Promise<string> {
  await completeBrandA(tx);
  return submitBrandA(tx);
}

type Opening = {
  outcome: string;
  holder: string | null;
  claimed_at: Date | null;
  claim_expires_at: Date | null;
  review_token: string | null;
};

async function openAs(tx: Tx, who: Internal, entry: string): Promise<Attempt> {
  return asInternal(tx, who, () =>
    attempt(
      tx,
      "select outcome, holder_account_id::text as holder, claimed_at, claim_expires_at, " +
        "review_token from profiles.open_advertiser_review_entry($1)",
      [entry],
    ),
  );
}

async function opened(tx: Tx, who: Internal, entry: string): Promise<Opening> {
  const [row] = rowsOf(await openAs(tx, who, entry));
  return row as Opening;
}

async function publishAs(
  tx: Tx,
  who: Internal,
  entry: string,
  token: string | null,
  comment: string | null = null,
): Promise<Attempt> {
  return asInternal(tx, who, () =>
    attempt(
      tx,
      "select decided_at, sla_breached, first_publication " +
        "from profiles.publish_advertiser_review_entry($1, $2, $3)",
      [entry, token, comment],
    ),
  );
}

async function rejectAs(
  tx: Tx,
  who: Internal,
  entry: string,
  token: string | null,
  reason: string | null,
  message: string | null = null,
  comment: string | null = null,
): Promise<Attempt> {
  return asInternal(tx, who, () =>
    attempt(
      tx,
      "select decided_at, sla_breached " +
        "from profiles.reject_advertiser_review_entry($1, $2, $3, $4, $5)",
      [entry, token, reason, message, comment],
    ),
  );
}

/** Opens as `who` and publishes with the token of the opening. */
async function claimAndPublish(
  tx: Tx,
  who: Internal,
  entry: string,
): Promise<Row> {
  const opening = await opened(tx, who, entry);
  const [row] = rowsOf(await publishAs(tx, who, entry, opening.review_token));
  return row as Row;
}

type Line = { event_type: string; actor: string | null; payload: Row };

/** The register lines of the transaction about a subject, in their order. */
async function linesOf(tx: Tx, subject: string): Promise<Line[]> {
  return tx<Line[]>`
    select event_type, actor_account_id::text as actor, payload from audit.audit_events
     where subject_id = ${subject} and occurred_at = now()
     order by seq`;
}

type Outbox = {
  event_type: string;
  destination: string;
  idempotency_key: string;
  priority: number;
  payload: Row;
};

async function outboxOf(tx: Tx, account: string): Promise<Outbox[]> {
  return tx<Outbox[]>`
    select event_type, destination::text, idempotency_key, priority, payload
      from leads.outbox_events
     where subject_key = ${`account:${account}`} and created_at = now()
       and event_type in ('profile.decision', 'profile.completed', 'lead.updated')
     order by event_type, destination`;
}

// ---------------------------------------------------------------------------------------------
// The catalogue of the forced release and the codes (file.md A8, "Codes"; T3)
// ---------------------------------------------------------------------------------------------

describe("file.md A8 and the codes: the forced release reasons and the nine codes of 0210 (T3)", () => {
  it("lists the three reasons of a forced release, label key reason.claim_release.<code>", async () => {
    const rows = await localSuperuser()<Row[]>`
      select code, label_key, is_active from backoffice.claim_release_reasons order by code`;
    expect(rows).toEqual(
      ["holder_absent", "overdue_entry", "wrong_claim"].map((code) => ({
        code,
        label_key: `reason.claim_release.${code}`,
        is_active: true,
      })),
    );
  });

  it("knows the decision, queue and lead codes with their domain, subject and severity", async () => {
    const rows = await localSuperuser()<Row[]>`
      select code, domain, subject_type, severity from audit.event_types
       where code in ('profile.published', 'profile.rejected', 'queue.entry_opened',
                      'queue.claim_forced_release', 'queue.claim_released',
                      'queue.claim_extended', 'queue.claim_expired', 'profile.completed',
                      'profile.decision')
         and is_active
       order by code`;
    const code = (
      name: string,
      domain: string,
      subject: string,
      severity: string,
    ) => ({
      code: name,
      domain,
      subject_type: subject,
      severity,
    });
    expect(rows).toEqual([
      code("profile.completed", "leads", "account", "info"),
      code("profile.decision", "profiles", "queue_entry", "info"),
      code("profile.published", "profiles", "advertiser_profile", "sensitive"),
      code("profile.rejected", "profiles", "advertiser_profile", "sensitive"),
      code("queue.claim_expired", "backoffice", "queue_entry", "info"),
      code("queue.claim_extended", "backoffice", "queue_entry", "info"),
      code(
        "queue.claim_forced_release",
        "backoffice",
        "queue_entry",
        "sensitive",
      ),
      code("queue.claim_released", "backoffice", "queue_entry", "info"),
      code("queue.entry_opened", "backoffice", "queue_entry", "sensitive"),
    ]);
  });

  it("refuses a forced release reason outside the closed list on an entry (foreign key, EC-L2C-05-2)", async () => {
    const result = await scenario((tx) =>
      attempt(
        tx,
        "update profiles.advertiser_review_entries set forced_release_at = now(), " +
          "forced_release_by_account_id = $1, forced_release_holder_account_id = $2, " +
          "forced_release_reason_code = 'bored' where id = $3",
        [adminA, agentA, REVIEW_ENTRY_IDS.a],
      ),
    );
    expect(refusal(result).code).toBe("23503");
  });
});

// ---------------------------------------------------------------------------------------------
// RG6: only an agent or an admin in aal2 reaches the six functions
// ---------------------------------------------------------------------------------------------

const DECISION_CALLS = [
  "select * from profiles.open_advertiser_review_entry($1)",
  "select profiles.release_advertiser_review_entry($1)",
  "select profiles.extend_advertiser_review_claim($1)",
  "select profiles.force_release_advertiser_review_claim($1, 'holder_absent')",
  "select * from profiles.publish_advertiser_review_entry($1, 'x', null)",
  "select * from profiles.reject_advertiser_review_entry($1, 'x', 'illicit_content', null, null)",
] as const;

describe("06 RG6, invariant 1: no member, task nor elevated role decides, and no agent outside aal2", () => {
  it.each([
    ["the brand itself", "brand"],
    ["a creator", "creator"],
    ["an agent in aal1", "agent_aal1"],
    ["an admin in aal1", "admin_aal1"],
  ] as const)(
    "refuses %s on all six functions (42501)",
    async (_label, who) => {
      const codes = await scenario(async (tx) => {
        const entry = await submittedBrandA(tx);
        const results: string[] = [];
        for (const call of DECISION_CALLS) {
          const run = () => attempt(tx, call, [entry]);
          const result =
            who === "brand"
              ? await asBrand(tx, brandA, run)
              : who === "creator"
                ? await actAsMember(
                    tx,
                    "influx_creator",
                    { accountId: creatorA, role: "creator", aal: "aal1" },
                    run,
                  )
                : await asInternal(
                    tx,
                    who === "agent_aal1" ? AGENT_A : ADMIN_A,
                    run,
                    "aal1",
                  );
          results.push(refusal(result).code);
        }
        return results;
      });
      expect(codes).toEqual(DECISION_CALLS.map(() => INSUFFICIENT_PRIVILEGE));
    },
  );

  it.each(["worker", "auth", "privacy", "ops"] as const)(
    "refuses the elevated role of %s on all six functions (42501)",
    async (actor: Actor) => {
      const codes = await scenario(async (tx) => {
        const entry = await submittedBrandA(tx);
        return actAs(tx, actor, async () => {
          const results: string[] = [];
          for (const call of DECISION_CALLS) {
            results.push(refusal(await attempt(tx, call, [entry])).code);
          }
          return results;
        });
      });
      expect(codes).toEqual(DECISION_CALLS.map(() => INSUFFICIENT_PRIVILEGE));
    },
  );

  it("answers an unknown entry and an entry of the caller's own account the same 42501 (C(3), T14)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const unknown = refusal(await openAs(tx, AGENT_A, randomUUID()));
      // D41 keeps one role per account: lifted in this rolled-back transaction only, so that the
      // account of brand A also holds an agent profile and opens its own entry
      await tx.unsafe(
        "alter table identity.account_roles drop constraint account_roles_single_role_mvp",
      );
      await tx`insert into identity.account_roles (account_id, role) values (${brandA}, 'agent')`;
      await tx`
        insert into identity.agent_profiles (account_id, first_name, activated_at, mfa_enrolled_at)
        values (${brandA}, 'Self', now(), now())`;
      const own = refusal(
        await openAs(tx, { account: brandA, role: "agent" }, entry),
      );
      return { unknown, own };
    });
    expect(outcome).toEqual({
      unknown: { code: INSUFFICIENT_PRIVILEGE, detail: undefined },
      own: { code: INSUFFICIENT_PRIVILEGE, detail: undefined },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Opening = claiming (15 C1, C2, RG35)
// ---------------------------------------------------------------------------------------------

describe("15 C1, C2, RG35: opening an entry claims it, or shows its holder", () => {
  it("claims a free entry for 30 minutes, renders the version token and journals the opening", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      const [expected] = await tx<{ token: string; expires: Date }[]>`
        select profiles.advertiser_review_token(${brandA}) as token,
               now() + interval '30 minutes' as expires`;
      const [row] = await tx<Row[]>`
        select claimed_by_account_id::text as holder, claimed_at = now() as now_claimed
          from profiles.advertiser_review_entries where id = ${entry}`;
      return { entry, opening, expected, row, lines: await linesOf(tx, entry) };
    });
    expect(outcome.opening).toEqual({
      outcome: "claimed",
      holder: agentA,
      claimed_at: expect.any(Date),
      claim_expires_at: outcome.expected?.expires,
      review_token: outcome.expected?.token,
    });
    expect(outcome.row).toEqual({ holder: agentA, now_claimed: true });
    expect(outcome.lines).toEqual([
      {
        event_type: "queue.entry_opened",
        actor: agentA,
        payload: { queue_code: "profiles_advertiser", outcome: "claimed" },
      },
    ]);
  });

  it("gives the holder his live claim back unchanged (`held`), with the token", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const first = await opened(tx, AGENT_A, entry);
      await tx`
        update profiles.advertiser_review_entries
           set claimed_at = now() - interval '10 minutes',
               claim_expires_at = now() + interval '20 minutes'
         where id = ${entry}`;
      const again = await opened(tx, AGENT_A, entry);
      const [expires] = await tx<
        { at: Date }[]
      >`select now() + interval '20 minutes' as at`;
      return { first, again, expires: expires?.at };
    });
    expect(outcome.again).toMatchObject({
      outcome: "held",
      holder: agentA,
      claim_expires_at: outcome.expires,
      review_token: outcome.first.review_token,
    });
  });

  it("shows a second agent the holder and his instant, read only, without a token (15 C2)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const first = await opened(tx, AGENT_A, entry);
      const second = await opened(tx, AGENT_B, entry);
      const [row] = await tx<{ holder: string }[]>`
        select claimed_by_account_id::text as holder
          from profiles.advertiser_review_entries where id = ${entry}`;
      return {
        first,
        second,
        holder: row?.holder,
        lines: await linesOf(tx, entry),
      };
    });
    expect(outcome.second).toEqual({
      outcome: "read_only",
      holder: agentA,
      claimed_at: outcome.first.claimed_at,
      claim_expires_at: outcome.first.claim_expires_at,
      review_token: null,
    });
    expect(outcome.holder).toBe(agentA);
    expect(
      outcome.lines.map((line) => [line.actor, line.payload.outcome]),
    ).toEqual([
      [agentA, "claimed"],
      [agentB, "read_only"],
    ]);
  });

  it("opens a closed entry as `closed`, journalled, nothing claimed", async () => {
    const outcome = await scenario(async (tx) => ({
      opening: await opened(tx, AGENT_A, REVIEW_ENTRY_IDS.a),
      lines: await linesOf(tx, REVIEW_ENTRY_IDS.a),
    }));
    expect(outcome.opening).toEqual({
      outcome: "closed",
      holder: null,
      claimed_at: null,
      claim_expires_at: null,
      review_token: null,
    });
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      { queue_code: "profiles_advertiser", outcome: "closed" },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2C-V1: two claims at the same moment, one winner (committed fixture, two connections)
// ---------------------------------------------------------------------------------------------

const second = connectAsLocalSuperuser({ max: 1 });
afterAll(async () => {
  await second.end({ timeout: 1 });
});

describe("L2C-V1, 04 l. 2465-2480, 15 C2: two simultaneous claims, one winner", () => {
  it("gives the entry to one agent; the other reads the winner's name, never an error", async () => {
    const migration = migrationRole();
    const account = randomUUID();
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${account}, ${randomUUID()}, ${`l2c-v1-${account}@example.test`}, now(), 'FR', 'fr',
                true, now(), 'business')`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${account}, 'advertiser')`;
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name, status)
        values (${account}, ${`L2C V1 ${account.slice(0, 8)}`}, 'pending_review')`;
    });
    const [created] = await migration<{ id: string }[]>`
      insert into profiles.advertiser_review_entries (account_id, kind)
      values (${account}, 'submission') returning id::text`;
    const entry = created?.id ?? "";
    const claim = (sql: postgres.Sql, who: Internal) =>
      sql.begin(async (tx) => {
        const [row] = rowsOf(await openAs(tx, who, entry));
        return row as Opening;
      });
    try {
      const results = await Promise.all([
        claim(localSuperuser(), AGENT_A),
        claim(second, AGENT_B),
      ]);
      const [row] = await migration<{ holder: string }[]>`
        select claimed_by_account_id::text as holder
          from profiles.advertiser_review_entries where id = ${entry}`;
      const winner = row?.holder;
      expect([agentA, agentB]).toContain(winner);
      expect(results.map((result) => result.outcome).sort()).toEqual([
        "claimed",
        "read_only",
      ]);
      expect(results.map((result) => result.holder)).toEqual([winner, winner]);
      const [lines] = await migration<{ n: number }[]>`
        select count(*)::int as n from audit.audit_events
         where event_type = 'queue.entry_opened' and subject_id = ${entry}`;
      expect(lines?.n).toBe(2);
    } finally {
      await migration`
        update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now()
         where id = ${entry}`;
    }
  });
});

// ---------------------------------------------------------------------------------------------
// L2C-V2 to V4: expiry, release, extension, forced release (15 C3, C4, file.md A8, A9)
// ---------------------------------------------------------------------------------------------

/** Brand A submitted and claimed by agent A, the claim pushed into the past and expired. */
async function expiredClaim(tx: Tx): Promise<{ entry: string; token: string }> {
  const entry = await submittedBrandA(tx);
  const opening = await opened(tx, AGENT_A, entry);
  await tx`
    update profiles.advertiser_review_entries
       set claimed_at = now() - interval '40 minutes',
           claim_expires_at = now() - interval '10 minutes'
     where id = ${entry}`;
  return { entry, token: opening.review_token ?? "" };
}

describe("L2C-V2, 15 C3, 06 CA18, file.md A9: an expired claim decides nothing and is taken over", () => {
  it("refuses the former holder's decision (55P03 none) and lets another agent claim, the abandonment written first", async () => {
    const outcome = await scenario(async (tx) => {
      const { entry, token } = await expiredClaim(tx);
      const late = refusal(await publishAs(tx, AGENT_A, entry, token));
      const takeover = await opened(tx, AGENT_B, entry);
      const [instants] = await tx<{ claimed: string; expired: string }[]>`
        select to_jsonb(now() - interval '40 minutes') #>> '{}' as claimed,
               to_jsonb(now() - interval '10 minutes') #>> '{}' as expired`;
      return { late, takeover, instants, lines: await linesOf(tx, entry) };
    });
    expect(outcome.late).toEqual({ code: LOCK_NOT_AVAILABLE, detail: "none" });
    expect(outcome.takeover).toMatchObject({
      outcome: "claimed",
      holder: agentB,
    });
    expect(outcome.lines.map((line) => [line.event_type, line.actor])).toEqual([
      ["queue.entry_opened", agentA],
      ["queue.claim_expired", agentB],
      ["queue.entry_opened", agentB],
    ]);
    expect(outcome.lines[1]?.payload).toEqual({
      queue_code: "profiles_advertiser",
      holder_account_id: agentA,
      claimed_at: outcome.instants?.claimed,
      expired_at: outcome.instants?.expired,
    });
  });
});

describe("L2C-V3, 15 C3: the holder releases or extends his claim, nobody else", () => {
  it("releases: the entry is free again, line queue.claim_released, no comment", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await opened(tx, AGENT_A, entry);
      const stranger = refusal(
        await asInternal(tx, AGENT_B, () =>
          attempt(tx, "select profiles.release_advertiser_review_entry($1)", [
            entry,
          ]),
        ),
      );
      rowsOf(
        await asInternal(tx, AGENT_A, () =>
          attempt(tx, "select profiles.release_advertiser_review_entry($1)", [
            entry,
          ]),
        ),
      );
      const [row] = await tx<Row[]>`
        select claimed_by_account_id, claimed_at, claim_expires_at
          from profiles.advertiser_review_entries where id = ${entry}`;
      const next = await opened(tx, AGENT_B, entry);
      const lines = await linesOf(tx, entry);
      return { stranger, row, next, released: lines[1] };
    });
    expect(outcome.stranger).toEqual({
      code: LOCK_NOT_AVAILABLE,
      detail: agentA,
    });
    expect(outcome.row).toEqual({
      claimed_by_account_id: null,
      claimed_at: null,
      claim_expires_at: null,
    });
    expect(outcome.next.outcome).toBe("claimed");
    expect(outcome.released).toMatchObject({
      event_type: "queue.claim_released",
      actor: agentA,
      payload: {
        queue_code: "profiles_advertiser",
        holder_account_id: agentA,
        claimed_at: expect.any(String),
      },
    });
  });

  it("extends: a new expiry of now() + 30 minutes, line queue.claim_extended; refused to another agent", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await opened(tx, AGENT_A, entry);
      await tx`
        update profiles.advertiser_review_entries
           set claimed_at = now() - interval '25 minutes',
               claim_expires_at = now() + interval '5 minutes'
         where id = ${entry}`;
      const stranger = refusal(
        await asInternal(tx, AGENT_B, () =>
          attempt(tx, "select profiles.extend_advertiser_review_claim($1)", [
            entry,
          ]),
        ),
      );
      const [extended] = rowsOf(
        await asInternal(tx, AGENT_A, () =>
          attempt(
            tx,
            "select profiles.extend_advertiser_review_claim($1) as expires",
            [entry],
          ),
        ),
      );
      const [expected] = await tx<
        { at: Date }[]
      >`select now() + interval '30 minutes' as at`;
      const lines = await linesOf(tx, entry);
      return { stranger, extended, expected: expected?.at, line: lines[1] };
    });
    expect(outcome.stranger).toEqual({
      code: LOCK_NOT_AVAILABLE,
      detail: agentA,
    });
    expect(outcome.extended).toEqual({ expires: outcome.expected });
    expect(outcome.line).toMatchObject({
      event_type: "queue.claim_extended",
      payload: { holder_account_id: agentA, queue_code: "profiles_advertiser" },
    });
  });

  it("refuses to release or extend an expired claim (55P03 none) or a closed entry (55000 entry_closed)", async () => {
    const outcome = await scenario(async (tx) => {
      const { entry } = await expiredClaim(tx);
      const call = (statement: string, id: string) =>
        asInternal(tx, AGENT_A, () => attempt(tx, statement, [id]));
      return {
        release: refusal(
          await call(
            "select profiles.release_advertiser_review_entry($1)",
            entry,
          ),
        ),
        extend: refusal(
          await call(
            "select profiles.extend_advertiser_review_claim($1)",
            entry,
          ),
        ),
        closed: refusal(
          await call(
            "select profiles.release_advertiser_review_entry($1)",
            REVIEW_ENTRY_IDS.a,
          ),
        ),
      };
    });
    expect(outcome).toEqual({
      release: { code: LOCK_NOT_AVAILABLE, detail: "none" },
      extend: { code: LOCK_NOT_AVAILABLE, detail: "none" },
      closed: {
        code: OBJECT_NOT_IN_PREREQUISITE_STATE,
        detail: "entry_closed",
      },
    });
  });
});

describe("L2C-V4, 15 C4, file.md A8: an admin lifts an orphan claim with a typed reason", () => {
  const FORCE =
    "select profiles.force_release_advertiser_review_claim($1, $2) as holder";

  it("frees the entry, keeps who, when, whom and why, and journals it nominatively", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await opened(tx, AGENT_A, entry);
      const [forced] = rowsOf(
        await asInternal(tx, ADMIN_A, () =>
          attempt(tx, FORCE, [entry, "holder_absent"]),
        ),
      );
      const [row] = await tx<Row[]>`
        select claimed_by_account_id, forced_release_at = now() as now_forced,
               forced_release_by_account_id::text as by,
               forced_release_holder_account_id::text as holder, forced_release_reason_code
          from profiles.advertiser_review_entries where id = ${entry}`;
      const lines = await linesOf(tx, entry);
      return { forced, row, line: lines[1] };
    });
    expect(outcome.forced).toEqual({ holder: agentA });
    expect(outcome.row).toEqual({
      claimed_by_account_id: null,
      now_forced: true,
      by: adminA,
      holder: agentA,
      forced_release_reason_code: "holder_absent",
    });
    expect(outcome.line).toEqual({
      event_type: "queue.claim_forced_release",
      actor: adminA,
      payload: {
        queue_code: "profiles_advertiser",
        holder_account_id: agentA,
        reason_code: "holder_absent",
      },
    });
  });

  it("refuses an agent (42501, his attempt journalled by record_refused_action), an unknown reason, no live claim", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const free = refusal(
        await asInternal(tx, ADMIN_A, () =>
          attempt(tx, FORCE, [entry, "holder_absent"]),
        ),
      );
      await opened(tx, AGENT_A, entry);
      const agent = refusal(
        await asInternal(tx, AGENT_B, () =>
          attempt(tx, FORCE, [entry, "holder_absent"]),
        ),
      );
      rowsOf(
        await asInternal(tx, AGENT_B, () =>
          attempt(
            tx,
            "select backoffice.record_refused_action('queue.force_release_claim')",
          ),
        ),
      );
      const reason = refusal(
        await asInternal(tx, ADMIN_A, () =>
          attempt(tx, FORCE, [entry, "bored"]),
        ),
      );
      const [refused] = await tx<{ payload: Row }[]>`
        select payload from audit.audit_events
         where event_type = 'backoffice.action_refused' and subject_id = ${agentB}
           and occurred_at = now()`;
      return { free, agent, reason, refused: refused?.payload };
    });
    expect(outcome).toEqual({
      free: { code: LOCK_NOT_AVAILABLE, detail: "none" },
      agent: { code: INSUFFICIENT_PRIVILEGE, detail: undefined },
      reason: { code: INVALID_PARAMETER_VALUE, detail: "reason" },
      refused: {
        action_code: "queue.force_release_claim",
        required_role: "admin",
      },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2C-D1 to D6: the decisions (06 RG6, RG9, RG10, RG65 to RG69, RG78; 15 C6, C8)
// ---------------------------------------------------------------------------------------------

describe("L2C-D1, 06 RG6, RG69, RG78: publishing a submission", () => {
  it("publishes the profile, closes the entry, queues the decision e-mail and profile.completed, journals it", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      const [published] = rowsOf(
        await publishAs(
          tx,
          AGENT_A,
          entry,
          opening.review_token,
          "Checked against the site.",
        ),
      );
      const [profile] = await tx<Row[]>`
        select status::text, first_published_at = now() as first_now
          from profiles.advertiser_profiles where account_id = ${brandA}`;
      const [row] = await tx<Row[]>`
        select state::text, decided_by_account_id::text as decider, decided_at = now() as now_decided,
               closed_at = now() as now_closed, internal_comment, sla_breached
          from profiles.advertiser_review_entries where id = ${entry}`;
      const lines = await linesOf(tx, brandA);
      return {
        entry,
        published,
        profile,
        row,
        outbox: await outboxOf(tx, brandA),
        line: lines.find((line) => line.event_type === "profile.published"),
      };
    });
    expect(outcome.published).toEqual({
      decided_at: expect.any(Date),
      sla_breached: false,
      first_publication: true,
    });
    expect(outcome.profile).toEqual({ status: "published", first_now: true });
    expect(outcome.row).toEqual({
      state: "published",
      decider: agentA,
      now_decided: true,
      now_closed: true,
      internal_comment: "Checked against the site.",
      sla_breached: false,
    });
    const decision = outcome.outbox.find(
      (line) => line.event_type === "profile.decision",
    );
    expect(decision).toEqual({
      event_type: "profile.decision",
      destination: "brevo_transactional",
      idempotency_key: `profile.decision:${outcome.entry}`,
      priority: 100,
      payload: {
        event_id: expect.any(String),
        account_id: brandA,
        entry_id: outcome.entry,
        // 0211: the code 0111 requires on the success of a transactional line
        email_code: "profile.decision",
      },
    });
    expect(
      outcome.outbox
        .filter((line) => line.event_type === "profile.completed")
        .map((line) => [
          line.destination,
          line.idempotency_key,
          Object.keys(line.payload).sort(),
        ]),
    ).toEqual([
      [
        "apollo_contact",
        `profile.completed:${brandA}`,
        ["account_id", "event_id"],
      ],
      [
        "brevo_contact",
        `profile.completed:${brandA}`,
        ["account_id", "event_id"],
      ],
    ]);
    expect(outcome.line).toEqual({
      event_type: "profile.published",
      actor: agentA,
      payload: {
        entry_id: outcome.entry,
        kind: "submission",
        fields: [],
        late: false,
      },
    });
  });

  it("marks a decision after the deadline as late, and still takes it (15 C8)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await tx`
        update profiles.advertiser_review_entries
           set created_at = now() - interval '5 days', sla_due_at = now() - interval '4 days',
               escalate_at = now() - interval '2 days'
         where id = ${entry}`;
      const published = await claimAndPublish(tx, AGENT_A, entry);
      const lines = await linesOf(tx, brandA);
      return {
        published,
        line: lines.find((line) => line.event_type === "profile.published"),
      };
    });
    expect(outcome.published).toMatchObject({ sla_breached: true });
    expect(outcome.line?.payload).toMatchObject({ late: true });
  });
});

describe("L2C-D2, 06 RG10, RG65, RG66: refusing a submission with a typed reason", () => {
  it("gives the profile back to the brand, closes the entry with its reason and queues the decision e-mail only", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      rowsOf(
        await rejectAs(
          tx,
          AGENT_A,
          entry,
          opening.review_token,
          "other",
          OTHER_MESSAGE,
        ),
      );
      const [profile] = await tx<Row[]>`
        select status::text, first_published_at from profiles.advertiser_profiles
         where account_id = ${brandA}`;
      const [row] = await tx<Row[]>`
        select state::text, rejection_reason_code, member_message, internal_comment
          from profiles.advertiser_review_entries where id = ${entry}`;
      const lines = await linesOf(tx, brandA);
      const outbox = await outboxOf(tx, brandA);
      // RG10: the brand corrects and submits again, a new entry
      await tx`update profiles.advertiser_profiles set company_size_band = '1_10'
                where account_id = ${brandA}`;
      const again = await submitBrandA(tx);
      return { entry, profile, row, lines, outbox, again };
    });
    expect(outcome.profile).toEqual({
      status: "rejected",
      first_published_at: null,
    });
    expect(outcome.row).toEqual({
      state: "rejected",
      rejection_reason_code: "other",
      member_message: OTHER_MESSAGE,
      internal_comment: null,
    });
    expect(outcome.outbox.map((line) => line.event_type)).toEqual([
      "profile.decision",
    ]);
    expect(
      outcome.lines.find((line) => line.event_type === "profile.rejected"),
    ).toEqual({
      event_type: "profile.rejected",
      actor: agentA,
      payload: {
        entry_id: outcome.entry,
        kind: "submission",
        reason_code: "other",
        late: false,
      },
    });
    expect(outcome.again).not.toBe(outcome.entry);
  });
});

describe("L2C-D3, 06 RG65, RG66, invariant 3: a refusal is never mute, `other` carries its message", () => {
  it.each([
    ["no reason", null, null, "reason"],
    ["a reason outside the list", "bored", null, "reason"],
    ["`other` without its message", "other", null, "member_message"],
    [
      "`other` with a message under 20 characters",
      "other",
      "Too short.",
      "member_message",
    ],
    [
      "a message for a reason that asks none",
      "illicit_content",
      OTHER_MESSAGE,
      "member_message",
    ],
  ])("refuses %s (22023)", async (_label, reason, message, detail) => {
    const result = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      return refusal(
        await rejectAs(
          tx,
          AGENT_A,
          entry,
          opening.review_token,
          reason,
          message,
        ),
      );
    });
    expect(result).toEqual({ code: INVALID_PARAMETER_VALUE, detail });
  });

  it("refuses an internal comment of more than 1 000 characters on either decision (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      const long = "x".repeat(1001);
      return {
        publish: refusal(
          await publishAs(tx, AGENT_A, entry, opening.review_token, long),
        ),
        reject: refusal(
          await rejectAs(
            tx,
            AGENT_A,
            entry,
            opening.review_token,
            "illicit_content",
            null,
            long,
          ),
        ),
      };
    });
    expect(outcome).toEqual({
      publish: { code: INVALID_PARAMETER_VALUE, detail: "internal_comment" },
      reject: { code: INVALID_PARAMETER_VALUE, detail: "internal_comment" },
    });
  });

  it("is held by the base too: a rejected entry without a reason is refused (23514)", async () => {
    const result = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      return attempt(
        tx,
        "update profiles.advertiser_review_entries set state = 'rejected', " +
          "decided_by_account_id = $1, decided_at = now(), closed_at = now() where id = $2",
        [agentA, entry],
      );
    });
    expect(refusal(result).code).toBe(CHECK_VIOLATION);
  });
});

describe("L2C-D4, invariant 4, file.md A3: the decision is bound to the version examined", () => {
  it("refuses a decision once the brand wrote after the opening (55000 stale_token), then takes it with the new token", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      await asBrand(
        tx,
        brandA,
        () =>
          tx`update profiles.advertiser_profiles set company_size_band = '1_10'
            where account_id = ${brandA}`,
      );
      const stale = refusal(
        await publishAs(tx, AGENT_A, entry, opening.review_token),
      );
      const staleReject = refusal(
        await rejectAs(
          tx,
          AGENT_A,
          entry,
          opening.review_token,
          "illicit_content",
        ),
      );
      const missing = refusal(await publishAs(tx, AGENT_A, entry, null));
      const reread = await opened(tx, AGENT_A, entry);
      const [published] = rowsOf(
        await publishAs(tx, AGENT_A, entry, reread.review_token),
      );
      return {
        stale,
        staleReject,
        missing,
        changed: reread.review_token !== opening.review_token,
        published,
      };
    });
    expect(outcome.stale).toEqual({
      code: OBJECT_NOT_IN_PREREQUISITE_STATE,
      detail: "stale_token",
    });
    expect(outcome.staleReject).toEqual(outcome.stale);
    expect(outcome.missing).toEqual(outcome.stale);
    expect(outcome.changed).toBe(true);
    expect(outcome.published).toMatchObject({ first_publication: true });
  });
});

describe("L2C-D5, invariant 4: the required fields are recontrolled at the publication", () => {
  it("refuses to publish a profile a required field of which is missing (23514, its code as DETAIL)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await tx`delete from profiles.advertiser_topics where account_id = ${brandA}`;
      const opening = await opened(tx, AGENT_A, entry);
      const result = refusal(
        await publishAs(tx, AGENT_A, entry, opening.review_token),
      );
      const [profile] = await tx<{ status: string }[]>`
        select status::text from profiles.advertiser_profiles where account_id = ${brandA}`;
      return { result, status: profile?.status };
    });
    expect(outcome).toEqual({
      result: { code: CHECK_VIOLATION, detail: "topics" },
      status: "pending_review",
    });
  });
});

describe("L2C-D6, invariant 2, 06 CA17, CA18: only the holder of a live claim decides", () => {
  it("refuses another agent (55P03, the holder as DETAIL), an unclaimed entry (none) and a closed one (entry_closed)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      const token = await tx<{ t: string }[]>`
        select profiles.advertiser_review_token(${brandA}) as t`;
      const unclaimed = refusal(
        await publishAs(tx, AGENT_A, entry, token[0]?.t ?? ""),
      );
      const opening = await opened(tx, AGENT_A, entry);
      const stranger = refusal(
        await publishAs(tx, AGENT_B, entry, opening.review_token),
      );
      const strangerReject = refusal(
        await rejectAs(
          tx,
          AGENT_B,
          entry,
          opening.review_token,
          "illicit_content",
        ),
      );
      rowsOf(await publishAs(tx, AGENT_A, entry, opening.review_token));
      const closed = refusal(
        await publishAs(tx, AGENT_A, entry, opening.review_token),
      );
      return { unclaimed, stranger, strangerReject, closed };
    });
    expect(outcome).toEqual({
      unclaimed: { code: LOCK_NOT_AVAILABLE, detail: "none" },
      stranger: { code: LOCK_NOT_AVAILABLE, detail: agentA },
      strangerReject: { code: LOCK_NOT_AVAILABLE, detail: agentA },
      closed: {
        code: OBJECT_NOT_IN_PREREQUISITE_STATE,
        detail: "entry_closed",
      },
    });
  });

  it("lets an admin decide as an agent does, never on his own claim lost (15 RG29: agent and admin)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      return claimAndPublish(tx, ADMIN_A, entry);
    });
    expect(outcome).toMatchObject({ first_publication: true });
  });
});

// ---------------------------------------------------------------------------------------------
// RG9 on a published profile: a revision approved or refused (file.md A2, A4)
// ---------------------------------------------------------------------------------------------

const NEW_PRESENTATION =
  "We design durable outdoor gear and repair it for life. ".repeat(3).trim();
const IN_REVIEW_LOGO = "00000000-0000-4000-8000-0000000c0de1";

/** Brand A published (first publication already done), a presentation and a logo proposed. */
async function revisedBrandA(tx: Tx): Promise<string> {
  await completeBrandA(tx);
  await tx`
    update profiles.advertiser_profiles
       set status = 'published', first_published_at = now() - interval '30 days'
     where account_id = ${brandA}`;
  await tx`
    insert into profiles.brand_logo_objects
      (id, account_id, state, received_bytes, byte_size, width, height)
    values (${IN_REVIEW_LOGO}, ${brandA}, 'in_review', 30000, 15000, 256, 256)`;
  await asBrand(tx, brandA, async () => {
    rowsOf(
      await attempt(
        tx,
        "select * from profiles.submit_own_advertiser_revision('advertiser.presentation', to_jsonb($1::text))",
        [NEW_PRESENTATION],
      ),
    );
    rowsOf(
      await attempt(
        tx,
        "select * from profiles.submit_own_advertiser_revision('advertiser.logo', " +
          "jsonb_build_object('logo_object_id', $1::uuid))",
        [IN_REVIEW_LOGO],
      ),
    );
  });
  return openEntryOf(tx, brandA);
}

async function logoStates(tx: Tx): Promise<Row[]> {
  return tx<Row[]>`
    select id::text, state::text, activated_at is not null as activated,
           purge_requested_at is not null as purge
      from profiles.brand_logo_objects
     where account_id = ${brandA} and id in (${BRAND_LOGO_IDS.a}, ${IN_REVIEW_LOGO})
     order by id`;
}

describe("06 RG9, file.md A2, A4: a revision of a published profile, approved or refused", () => {
  it("applies the values, activates the logo under review, purges the previous one, approves the revisions; lead.updated", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await revisedBrandA(tx);
      const published = await claimAndPublish(tx, AGENT_A, entry);
      const [profile] = await tx<Row[]>`
        select status::text, presentation from profiles.advertiser_profiles
         where account_id = ${brandA}`;
      const revisions = await tx<Row[]>`
        select field_code, status::text, closed_at = now() as now_closed
          from profiles.profile_field_revisions
         where advertiser_review_entry_id = ${entry} order by field_code`;
      const lines = await linesOf(tx, brandA);
      return {
        published,
        profile,
        revisions,
        logos: await logoStates(tx),
        outbox: await outboxOf(tx, brandA),
        line: lines.find((line) => line.event_type === "profile.published"),
        entry,
      };
    });
    expect(outcome.published).toMatchObject({ first_publication: false });
    expect(outcome.profile).toEqual({
      status: "published",
      presentation: NEW_PRESENTATION,
    });
    expect(outcome.revisions).toEqual([
      { field_code: "advertiser.logo", status: "approved", now_closed: true },
      {
        field_code: "advertiser.presentation",
        status: "approved",
        now_closed: true,
      },
    ]);
    expect(outcome.logos).toEqual([
      { id: BRAND_LOGO_IDS.a, state: "purging", activated: true, purge: true },
      { id: IN_REVIEW_LOGO, state: "active", activated: true, purge: false },
    ]);
    expect(
      outcome.outbox.map((line) => [line.event_type, line.destination]),
    ).toEqual([
      ["lead.updated", "apollo_contact"],
      ["lead.updated", "brevo_contact"],
      ["profile.decision", "brevo_transactional"],
    ]);
    expect(outcome.line?.payload).toEqual({
      entry_id: outcome.entry,
      kind: "revision",
      fields: ["advertiser.logo", "advertiser.presentation"],
      late: false,
    });
  });

  it("refuses a revision: the profile stays published with its validated values, the logo under review goes to purge", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await revisedBrandA(tx);
      const opening = await opened(tx, AGENT_A, entry);
      rowsOf(
        await rejectAs(
          tx,
          AGENT_A,
          entry,
          opening.review_token,
          "logo_non_compliant",
        ),
      );
      const [profile] = await tx<Row[]>`
        select status::text, presentation from profiles.advertiser_profiles
         where account_id = ${brandA}`;
      const revisions = await tx<{ status: string }[]>`
        select status::text from profiles.profile_field_revisions
         where advertiser_review_entry_id = ${entry}`;
      return {
        profile,
        revisions: revisions.map((row) => row.status),
        logos: await logoStates(tx),
        outbox: (await outboxOf(tx, brandA)).map((line) => line.event_type),
      };
    });
    expect(outcome.profile).toEqual({
      status: "published",
      presentation: PRESENTATION,
    });
    expect(outcome.revisions).toEqual(["rejected", "rejected"]);
    expect(outcome.logos).toEqual([
      { id: BRAND_LOGO_IDS.a, state: "active", activated: true, purge: false },
      { id: IN_REVIEW_LOGO, state: "purging", activated: false, purge: true },
    ]);
    expect(outcome.outbox).toEqual(["profile.decision"]);
  });

  it("applies the constraint of the column at the approval: a value it refuses refuses the publication (23514)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await revisedBrandA(tx);
      // a value the door would have stopped, written as the superuser (file.md A4: the column
      // constraint is the last word)
      await tx`
        update profiles.profile_field_revisions set proposed_value = to_jsonb(${"x".repeat(5000)}::text)
         where advertiser_review_entry_id = ${entry} and field_code = 'advertiser.presentation'`;
      const opening = await opened(tx, AGENT_A, entry);
      return refusal(await publishAs(tx, AGENT_A, entry, opening.review_token))
        .code;
    });
    expect(outcome).toBe(CHECK_VIOLATION);
  });
});

// ---------------------------------------------------------------------------------------------
// 06 RG78, CA40: one profile.completed per account, whatever the path
// ---------------------------------------------------------------------------------------------

describe("06 RG78, CA40: profile.completed once per account, lead.updated afterwards", () => {
  it("emits one profile.completed after a refusal, a new submission, a publication and a published revision", async () => {
    const outcome = await scenario(async (tx) => {
      const first = await submittedBrandA(tx);
      const opening = await opened(tx, AGENT_A, first);
      rowsOf(
        await rejectAs(
          tx,
          AGENT_A,
          first,
          opening.review_token,
          "presentation_insufficient",
        ),
      );
      await tx`update profiles.advertiser_profiles set company_size_band = '1_10'
                where account_id = ${brandA}`;
      const second = await submitBrandA(tx);
      const firstPublication = await claimAndPublish(tx, AGENT_B, second);
      await asBrand(tx, brandA, () =>
        attempt(
          tx,
          "select * from profiles.submit_own_advertiser_revision('advertiser.presentation', to_jsonb($1::text))",
          [NEW_PRESENTATION],
        ),
      );
      const revision = await openEntryOf(tx, brandA);
      const republication = await claimAndPublish(tx, AGENT_A, revision);
      const counts = await tx<{ event_type: string; n: number }[]>`
        select event_type, count(*)::int as n from leads.outbox_events
         where subject_key = ${`account:${brandA}`} and created_at = now()
           and event_type in ('profile.completed', 'lead.updated', 'profile.decision')
         group by event_type order by event_type`;
      return { firstPublication, republication, counts };
    });
    expect(outcome.firstPublication).toMatchObject({ first_publication: true });
    expect(outcome.republication).toMatchObject({ first_publication: false });
    expect(outcome.counts).toEqual([
      { event_type: "lead.updated", n: 2 },
      { event_type: "profile.completed", n: 2 },
      { event_type: "profile.decision", n: 3 },
    ]);
  });

  it("never lets a profile of brand B be decided through an entry of brand A (the entry names its account)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await claimAndPublish(tx, AGENT_A, entry);
      const [b] = await tx<{ status: string }[]>`
        select status::text from profiles.advertiser_profiles where account_id = ${brandB}`;
      return b?.status;
    });
    expect(outcome).toBe("draft");
  });
});

// ---------------------------------------------------------------------------------------------
// RG25, RG70 (file.md A7): duplicate brands, computed at the read
// ---------------------------------------------------------------------------------------------

describe("06 RG25, RG70, file.md A7: duplicate brand candidates", () => {
  it("normalises case, accents, spaces and punctuation, and nothing under two characters", async () => {
    const [row] = await localSuperuser()<Row[]>`
      select profiles.normalized_brand_name('Café  du-Monde!') as a,
             profiles.normalized_brand_name('CAFE DU MONDE') as b,
             profiles.normalized_brand_name(' é ') as short,
             profiles.normalized_brand_name(null) as none`;
    expect(row).toEqual({
      a: "cafedumonde",
      b: "cafedumonde",
      short: null,
      none: null,
    });
  });

  it("names the published brands of other accounts sharing the name or the domain, for agent and admin in aal2", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update profiles.advertiser_profiles
           set status = 'published', legal_name = 'Maison Été', website_domain = 'maison.example'
         where account_id = ${brandB}`;
      const call =
        "select account_id::text, matched_on from profiles.advertiser_duplicate_candidates($1, $2, $3)";
      const agent = rowsOf(
        await asInternal(tx, AGENT_A, () =>
          attempt(tx, call, [brandA, "maison ete", "MAISON.example"]),
        ),
      );
      const self = rowsOf(
        await asInternal(tx, AGENT_A, () =>
          attempt(tx, call, [brandB, "maison ete", "maison.example"]),
        ),
      );
      const member = refusal(
        await asBrand(tx, brandA, () =>
          attempt(tx, call, [brandA, "maison ete", null]),
        ),
      );
      return { agent, self, member };
    });
    expect(outcome.agent).toEqual([
      { account_id: brandB, matched_on: "brand_name" },
      { account_id: brandB, matched_on: "domain" },
    ]);
    expect(outcome.self).toEqual([]);
    expect(outcome.member.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

// ---------------------------------------------------------------------------------------------
// 0211 (L2C commit 09a): the code of the decision e-mail and the worker's read of the decision
// ---------------------------------------------------------------------------------------------

const READ_DECISION =
  "select decision, reason_code, member_message, preferred_language " +
  "from leads.read_brevo_profile_decision($1::bigint, $2)";

/** The profile.decision line of the account, put in processing for the worker w1. */
async function decisionLineInProcessing(
  tx: Tx,
  account: string,
): Promise<{ id: string; payload: Row }> {
  const [line] = await tx<{ id: string; payload: Row }[]>`
    update leads.outbox_events
       set status = 'processing', locked_by = 'w1', locked_at = now()
     where subject_key = ${`account:${account}`} and event_type = 'profile.decision'
       and created_at = now()
    returning id::text, payload`;
  if (line === undefined) {
    throw new Error("no profile.decision line");
  }
  return line;
}

/** Brand A refused with `other`, its message and an internal comment; its line in processing. */
async function refusedBrandALine(
  tx: Tx,
): Promise<{ entry: string; id: string; payload: Row }> {
  const entry = await submittedBrandA(tx);
  const opening = await opened(tx, AGENT_A, entry);
  rowsOf(
    await rejectAs(
      tx,
      AGENT_A,
      entry,
      opening.review_token,
      "other",
      OTHER_MESSAGE,
      "Internal: the same brand as last week.",
    ),
  );
  return { entry, ...(await decisionLineInProcessing(tx, brandA)) };
}

function readAsWorker(tx: Tx, line: string, worker = "w1"): Promise<Attempt> {
  return actAs(tx, "worker", () => attempt(tx, READ_DECISION, [line, worker]));
}

async function languageOf(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ language: string }[]>`
    select preferred_language::text as language from identity.accounts where id = ${account}`;
  if (row === undefined) {
    throw new Error("no account");
  }
  return row.language;
}

describe("0211, invariants 8, 10: the decision e-mail names its code, the worker reads its decision", () => {
  it("queues the refusal with email_code and serves its reason, the agent's message and the brand's language", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await refusedBrandALine(tx);
      return {
        line,
        language: await languageOf(tx, brandA),
        read: rowsOf(await readAsWorker(tx, line.id)),
      };
    });
    expect(outcome.line.payload).toEqual({
      event_id: expect.any(String),
      account_id: brandA,
      entry_id: outcome.line.entry,
      email_code: "profile.decision",
    });
    expect(outcome.read).toEqual([
      {
        decision: "rejected",
        reason_code: "other",
        member_message: OTHER_MESSAGE,
        preferred_language: outcome.language,
      },
    ]);
  });

  it("serves a publication without reason nor message", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedBrandA(tx);
      await claimAndPublish(tx, AGENT_A, entry);
      const line = await decisionLineInProcessing(tx, brandA);
      return {
        language: await languageOf(tx, brandA),
        read: rowsOf(await readAsWorker(tx, line.id)),
      };
    });
    expect(outcome.read).toEqual([
      {
        decision: "published",
        reason_code: null,
        member_message: null,
        preferred_language: outcome.language,
      },
    ]);
  });

  it("never serves the internal comment: no column of the read, no right of its owner nor of the worker", async () => {
    const migration = migrationRole();
    const [columns] = await migration<{ names: string[] }[]>`
      select array(select n from unnest(p.proargnames, p.proargmodes) as a (n, m)
                    where m = 't') as names
        from pg_catalog.pg_proc p
       where p.oid = 'leads.read_brevo_profile_decision(bigint, text)'::regprocedure`;
    const rights = await migration<{ role: string; name: string }[]>`
      select r.role, c.attname::text as name
        from unnest(array['influx_leads_definer', 'influx_worker']) as r (role),
             pg_catalog.pg_attribute c
       where c.attrelid = 'profiles.advertiser_review_entries'::regclass
         and c.attnum > 0 and not c.attisdropped
         and pg_catalog.has_column_privilege(r.role, c.attrelid, c.attname, 'SELECT')
       order by 1, 2`;
    expect(columns?.names).toEqual([
      "decision",
      "reason_code",
      "member_message",
      "preferred_language",
    ]);
    expect(rights).toEqual([
      { role: "influx_leads_definer", name: "account_id" },
      { role: "influx_leads_definer", name: "id" },
      { role: "influx_leads_definer", name: "member_message" },
      { role: "influx_leads_definer", name: "rejection_reason_code" },
      { role: "influx_leads_definer", name: "state" },
    ]);
  });

  it("refuses every role but the worker (42501), another worker (55000) and another line (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await refusedBrandALine(tx);
      const call = (fn: () => Promise<Attempt>) => fn().then(refusal);
      const roles = {
        brand: await call(() =>
          asBrand(tx, brandA, () =>
            attempt(tx, READ_DECISION, [line.id, "w1"]),
          ),
        ),
        agent: await call(() =>
          asInternal(tx, AGENT_A, () =>
            attempt(tx, READ_DECISION, [line.id, "w1"]),
          ),
        ),
        admin: await call(() =>
          asInternal(tx, ADMIN_A, () =>
            attempt(tx, READ_DECISION, [line.id, "w1"]),
          ),
        ),
        auth: await call(() =>
          actAs(tx, "auth", () => attempt(tx, READ_DECISION, [line.id, "w1"])),
        ),
        privacy: await call(() =>
          actAs(tx, "privacy", () =>
            attempt(tx, READ_DECISION, [line.id, "w1"]),
          ),
        ),
        ops: await call(() =>
          actAs(tx, "ops", () => attempt(tx, READ_DECISION, [line.id, "w1"])),
        ),
      };
      const otherWorker = refusal(await readAsWorker(tx, line.id, "w2"));
      const [contact] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           locked_by, locked_at)
        values (gen_random_uuid(), 'lead.updated', 'brevo_contact', ${`account:${brandA}`},
                jsonb_build_object('account_id', ${brandA}::uuid, 'entry_id', ${line.entry}::uuid),
                ${`lead.updated:${randomUUID()}`}, 'processing', 'w1', now())
        returning id::text`;
      const otherLine = refusal(await readAsWorker(tx, contact?.id ?? "0"));
      return { roles, otherWorker, otherLine };
    });
    for (const result of Object.values(outcome.roles)) {
      expect(result.code).toBe(INSUFFICIENT_PRIVILEGE);
    }
    expect(outcome.otherWorker.code).toBe(OBJECT_NOT_IN_PREREQUISITE_STATE);
    expect(outcome.otherLine.code).toBe(INVALID_PARAMETER_VALUE);
  });

  it("serves no row once the account is erased, nor for an entry the line's account does not hold", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await refusedBrandALine(tx);
      const [foreign] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           locked_by, locked_at)
        values (gen_random_uuid(), 'profile.decision', 'brevo_transactional',
                ${`account:${brandB}`},
                jsonb_build_object('account_id', ${brandB}::uuid, 'entry_id', ${line.entry}::uuid,
                                   'email_code', 'profile.decision'),
                ${`profile.decision:${randomUUID()}`}, 'processing', 'w1', now())
        returning id::text`;
      const other = rowsOf(await readAsWorker(tx, foreign?.id ?? "0"));
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${brandA}`;
      const erased = rowsOf(await readAsWorker(tx, line.id));
      return { other, erased };
    });
    expect(outcome.other).toEqual([]);
    expect(outcome.erased).toEqual([]);
  });
});
