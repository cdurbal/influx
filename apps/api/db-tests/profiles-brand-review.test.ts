// L2C commit 05 — the objects of queue 1, without any decision (0207; jalons/l2c/file.md A1, A3,
// A4, A6, D81; 04 §5.2, §5.6; 06 RG9, RG63 to RG68; 15 RG26, RG36): the two catalogues, the entry
// the submission opens in its transaction (one open at most, deadlines frozen by the base), the
// revisions attached to an entry of their own account, the bounds of the decision columns, the
// version token, and the reads role by role. The export and the erasure of the entries live in
// t8-privacy-execution.test.ts (EC-L2C-05-8). Each case runs in a rolled-back transaction of the
// local superuser, which acts as apps/api does (support.ts).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAsInternal, actAsMember, localSuperuser } from "./support.ts";

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  { outcome: "rows"; rows: Row[] } | { outcome: "error"; code: string };

/**
 * The statement with its `$n` written as literals: the cases share one list of values (fixed test
 * identifiers and texts), each statement using some of them only.
 */
function inline(statement: string, values: readonly (string | null)[]): string {
  return statement.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = values[Number(index) - 1];
    if (value === undefined) {
      throw new Error(`no value for $${index}`);
    }
    return value === null ? "null" : `'${value.replaceAll("'", "''")}'`;
  });
}

/** A statement in a savepoint: its rows, or its SQLSTATE. */
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
    const found = error as { code?: string };
    if (found.code === undefined) {
      throw error;
    }
    return { outcome: "error", code: found.code };
  }
}

function codeOf(result: Attempt): string {
  return result.outcome === "error" ? result.code : "rows";
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`refused: ${result.code}`);
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

function asAgent<T>(
  tx: Tx,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal },
    fn,
  );
}

const PRESENTATION = "We design durable outdoor gear. ".repeat(4).trim(); // 127 characters

/** Completes brand A's profile as the superuser (the data set holds its lists); stays draft. */
async function completeBrandA(tx: Tx): Promise<void> {
  await tx`
    update profiles.advertiser_profiles
       set primary_sector_code = 'sports_leisure', company_size_band = '11_50',
           presentation = ${PRESENTATION}, contact_role = 'marketing'
     where account_id = ${brandA}`;
}

async function submit(tx: Tx, account: string = brandA): Promise<Attempt> {
  return asBrand(tx, account, () =>
    attempt(
      tx,
      "select status, changed from profiles.submit_own_advertiser_profile()",
    ),
  );
}

type Entry = {
  id: string;
  kind: string;
  state: string;
  created_at: Date;
  sla_due_at: Date;
  escalate_at: Date | null;
};

/** The entries of an account opened in the scenario (the data set's closed one left out). */
async function openedEntries(tx: Tx, account: string): Promise<Entry[]> {
  return tx<Entry[]>`
    select id::text, kind::text, state::text, created_at, sla_due_at, escalate_at
      from profiles.advertiser_review_entries
     where account_id = ${account} and created_at = now()
     order by created_at, id`;
}

/** An open entry of brand A written as the superuser; returns its id. */
async function openEntry(tx: Tx, account: string = brandA): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into profiles.advertiser_review_entries (account_id, kind)
    values (${account}, 'submission') returning id::text`;
  if (row === undefined) {
    throw new Error("no entry");
  }
  return row.id;
}

// ---------------------------------------------------------------------------------------------
// The catalogues (file.md A4, A6) and the enums
// ---------------------------------------------------------------------------------------------

describe("file.md A4, A6: the two closed catalogues of queue 1", () => {
  it("lists the six moderated brand fields, their table and their label key", async () => {
    const rows = await localSuperuser()<Row[]>`
      select code, profile_kind::text as kind, target_table, label_key, is_active
        from profiles.moderated_fields order by code`;
    const field = (code: string, table: string): Row => ({
      code,
      kind: "advertiser",
      target_table: table,
      label_key: `field.${code}`,
      is_active: true,
    });
    expect(rows).toEqual([
      field("advertiser.brand_name", "profiles.advertiser_profiles"),
      field("advertiser.contact_role", "profiles.advertiser_profiles"),
      field("advertiser.logo", "profiles.brand_logo_objects"),
      field("advertiser.presentation", "profiles.advertiser_profiles"),
      field("advertiser.primary_sector", "profiles.advertiser_profiles"),
      field("advertiser.website_domain", "profiles.advertiser_profiles"),
    ]);
  });

  it("lists the eight reasons of 06 RG66 in order, `other` alone requiring the message to the brand", async () => {
    const rows = await localSuperuser()<Row[]>`
      select code, label_key, message_key, requires_member_message, position, is_active
        from profiles.advertiser_rejection_reasons order by position`;
    const codes = [
      "contact_in_public_field",
      "presentation_insufficient",
      "logo_non_compliant",
      "misleading_brand_name",
      "sector_inconsistent",
      "illicit_content",
      "duplicate_brand",
      "other",
    ];
    expect(rows).toEqual(
      codes.map((code, index) => ({
        code,
        label_key: `reason.profiles_advertiser.${code}`,
        message_key: `profileDecision.reason.${code}`,
        requires_member_message: code === "other",
        position: index + 1,
        is_active: true,
      })),
    );
  });

  it("holds the four enums of file.md A1 and 04 §5.2, in that order", async () => {
    const [row] = await localSuperuser()<Record<string, string[]>[]>`
      select pg_catalog.enum_range(null::profiles.profile_kind)::text[] as kind,
             pg_catalog.enum_range(null::profiles.revision_status)::text[] as revision,
             pg_catalog.enum_range(null::profiles.review_entry_kind)::text[] as entry_kind,
             pg_catalog.enum_range(null::profiles.review_entry_state)::text[] as entry_state`;
    expect(row).toEqual({
      kind: ["advertiser", "creator"],
      revision: [
        "pending_review",
        "approved",
        "rejected",
        "withdrawn",
        "superseded",
      ],
      entry_kind: ["submission", "revision"],
      entry_state: ["open", "published", "rejected", "withdrawn"],
    });
  });

  it.each([
    [
      "a code of another kind",
      "insert into profiles.moderated_fields (code, profile_kind, target_table, label_key) " +
        "values ('creator.headline', 'advertiser', 'profiles.x', 'field.creator.headline')",
    ],
    [
      "a label key that is not field.<code>",
      "insert into profiles.moderated_fields (code, profile_kind, target_table, label_key) " +
        "values ('advertiser.slogan', 'advertiser', 'profiles.x', 'field.slogan')",
    ],
    [
      "a reason whose message key is not profileDecision.reason.<code>",
      "insert into profiles.advertiser_rejection_reasons (code, label_key, message_key, position) " +
        "values ('spam', 'reason.profiles_advertiser.spam', 'reason.spam', 9)",
    ],
  ])("refuses %s (23514)", async (_label, statement) => {
    const result = await scenario((tx) => attempt(tx, statement));
    expect(codeOf(result)).toBe(CHECK_VIOLATION);
  });
});

// ---------------------------------------------------------------------------------------------
// The submission opens the entry (06 RG5, file.md A1, 04 §5.6)
// ---------------------------------------------------------------------------------------------

describe("06 RG5, file.md A1: the submission opens one entry of queue 1, in its transaction", () => {
  it("opens an open `submission` entry, its deadlines frozen from the policy, named by profile.submitted", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      rowsOf(await submit(tx));
      const entries = await openedEntries(tx, brandA);
      const [expected] = await tx<{ sla: Date; escalate: Date }[]>`
        select backoffice.business_deadline('profiles_advertiser', now(), 480) as sla,
               backoffice.business_deadline('profiles_advertiser',
                 backoffice.business_deadline('profiles_advertiser', now(), 480), 960) as escalate`;
      const lines = await tx<{ payload: Row }[]>`
        select payload from audit.audit_events
         where event_type = 'profile.submitted' and subject_id = ${brandA}`;
      return { entries, expected, lines };
    });
    expect(outcome.entries).toHaveLength(1);
    const [entry] = outcome.entries;
    expect(entry).toMatchObject({ kind: "submission", state: "open" });
    expect(entry?.sla_due_at).toEqual(outcome.expected?.sla);
    expect(entry?.escalate_at).toEqual(outcome.expected?.escalate);
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      { from_status: "draft", entry_id: entry?.id },
    ]);
  });

  it("opens no second entry for a second submission while waiting (edge case 3)", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      rowsOf(await submit(tx));
      const again = rowsOf(await submit(tx));
      return { again, entries: await openedEntries(tx, brandA) };
    });
    expect(outcome.again).toEqual([
      { status: "pending_review", changed: false },
    ]);
    expect(outcome.entries).toHaveLength(1);
  });

  it("opens a new entry after a refusal, the refused one staying closed", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      rowsOf(await submit(tx));
      await tx`
        update profiles.advertiser_review_entries
           set state = 'rejected', decided_by_account_id = ${agentA}, decided_at = now(),
               rejection_reason_code = 'presentation_insufficient', closed_at = now()
         where account_id = ${brandA} and state = 'open'`;
      await tx`
        update profiles.advertiser_profiles set status = 'rejected' where account_id = ${brandA}`;
      rowsOf(await submit(tx));
      return (await openedEntries(tx, brandA)).map((entry) => entry.state);
    });
    expect(outcome.sort()).toEqual(["open", "rejected"]);
  });

  it("keeps an entry still open instead of doubling it (rejected profile, entry left open)", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      const kept = await openEntry(tx);
      await tx`
        update profiles.advertiser_profiles set status = 'rejected' where account_id = ${brandA}`;
      rowsOf(await submit(tx));
      const [line] = await tx<{ payload: Row }[]>`
        select payload from audit.audit_events
         where event_type = 'profile.submitted' and subject_id = ${brandA}`;
      return { kept, entries: await openedEntries(tx, brandA), line };
    });
    expect(outcome.entries.map((entry) => entry.id)).toEqual([outcome.kept]);
    expect(outcome.line?.payload).toEqual({
      from_status: "rejected",
      entry_id: outcome.kept,
    });
  });

  it("opens nothing when the submission is refused (a required field missing, 23514)", async () => {
    const outcome = await scenario(async (tx) => ({
      submission: codeOf(await submit(tx)),
      entries: await openedEntries(tx, brandA),
    }));
    expect(outcome).toEqual({ submission: CHECK_VIOLATION, entries: [] });
  });

  it("freezes the deadlines at creation: whatever the writer gives, and a later policy changes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const [row] = await tx<{ id: string; sla_due_at: Date }[]>`
        insert into profiles.advertiser_review_entries
          (account_id, kind, created_at, sla_due_at, escalate_at)
        values (${brandA}, 'submission', '2001-01-01T00:00:00Z', '2001-01-01T00:00:00Z', null)
        returning id::text, sla_due_at`;
      const [expected] = await tx<{ sla: Date }[]>`
        select backoffice.business_deadline('profiles_advertiser', now(), 480) as sla`;
      await tx`
        update backoffice.sla_policies set target_decision_minutes = 960
         where queue_code = 'profiles_advertiser'`;
      const [after] = await tx<{ sla_due_at: Date }[]>`
        select sla_due_at from profiles.advertiser_review_entries where id = ${String(row?.id)}`;
      return {
        written: row?.sla_due_at,
        expected: expected?.sla,
        after: after?.sla_due_at,
      };
    });
    expect(outcome.written).toEqual(outcome.expected);
    expect(outcome.after).toEqual(outcome.expected);
  });
});

// ---------------------------------------------------------------------------------------------
// One open entry, the keys, the bounds (file.md A1, A6; EC-L2C-05-4, EC-L2C-05-5)
// ---------------------------------------------------------------------------------------------

describe("file.md A1: one open entry per account, the keys of the entries and the revisions", () => {
  it("refuses a second open entry for the same account (23505), not for another one", async () => {
    const outcome = await scenario(async (tx) => {
      await openEntry(tx, brandA);
      const same = await attempt(
        tx,
        "insert into profiles.advertiser_review_entries (account_id, kind) values ($1, 'revision')",
        [brandA],
      );
      const other = await attempt(
        tx,
        "insert into profiles.advertiser_review_entries (account_id, kind) values ($1, 'revision')",
        [brandB],
      );
      return { same: codeOf(same), other: codeOf(other) };
    });
    expect(outcome).toEqual({ same: UNIQUE_VIOLATION, other: "rows" });
  });

  it.each([
    [
      "an entry of an account without a brand profile",
      "insert into profiles.advertiser_review_entries (account_id, kind) values ($2, 'submission')",
    ],
    [
      "a revision of an unknown field",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id) values ($1, 'advertiser.slogan', '\"x\"', $3)",
    ],
    [
      "a revision attached to an entry of another account",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id) values ($4, 'advertiser.presentation', '\"x\"', $3)",
    ],
    [
      "a refusal of an unknown reason",
      "update profiles.advertiser_review_entries set state = 'rejected', decided_at = now(), " +
        "decided_by_account_id = $5, rejection_reason_code = 'spam', closed_at = now() " +
        "where id = $3",
    ],
  ])("refuses %s (23503)", async (_label, statement) => {
    const result = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      return attempt(tx, statement, [
        brandA,
        accountIdOf("creator", "a"),
        entry,
        brandB,
        agentA,
      ]);
    });
    expect(codeOf(result)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("keeps one pending revision per field and child row (23505), another row key being free", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      const insert = (rowKey: string | null) =>
        attempt(
          tx,
          "insert into profiles.profile_field_revisions (account_id, field_code, row_key, " +
            "proposed_value, advertiser_review_entry_id) " +
            "values ($1, 'advertiser.presentation', $2, $3::text::jsonb, $4)",
          [brandA, rowKey, JSON.stringify("A new presentation"), entry],
        );
      return {
        first: codeOf(await insert(null)),
        second: codeOf(await insert(null)),
        child: codeOf(await insert("row-1")),
      };
    });
    expect(outcome).toEqual({
      first: "rows",
      second: UNIQUE_VIOLATION,
      child: "rows",
    });
  });
});

describe("file.md A1, A6: the bounds of the decision columns (23514)", () => {
  const REJECTED =
    "state = 'rejected', decided_by_account_id = $2, decided_at = now(), closed_at = now(), " +
    "rejection_reason_code = 'other'";

  it.each([
    ["a closed entry left open", "closed_at = now()"],
    [
      "a published entry without its decision",
      "state = 'published', closed_at = now()",
    ],
    [
      "a refusal without reason",
      "state = 'rejected', decided_by_account_id = $2, decided_at = now(), closed_at = now()",
    ],
    [
      "a reason on a published entry",
      "state = 'published', decided_by_account_id = $2, decided_at = now(), closed_at = now(), " +
        "rejection_reason_code = 'other'",
    ],
    [
      "a decision instant without its author",
      "state = 'withdrawn', decided_at = now(), closed_at = now()",
    ],
    [
      "a message of 19 characters",
      `${REJECTED}, member_message = repeat('a', 19)`,
    ],
    [
      "a message of 501 characters",
      `${REJECTED}, member_message = repeat('a', 501)`,
    ],
    ["a message of spaces", `${REJECTED}, member_message = repeat(' ', 30)`],
    [
      "a message with a control character",
      `${REJECTED}, member_message = repeat('a', 20) || chr(7)`,
    ],
    ["a message on an open entry", "member_message = repeat('a', 30)"],
    [
      "an internal comment of 1 001 characters",
      "internal_comment = repeat('a', 1001)",
    ],
    ["an empty internal comment", "internal_comment = ''"],
    [
      "a claim without its expiry",
      "claimed_by_account_id = $2, claimed_at = now()",
    ],
    [
      "a claim expiring before it starts",
      "claimed_by_account_id = $2, claimed_at = now(), claim_expires_at = now() - interval '1 minute'",
    ],
    [
      "a forced release without its reason",
      "forced_release_at = now(), forced_release_by_account_id = $3, " +
        "forced_release_holder_account_id = $2",
    ],
  ])("refuses %s", async (_label, set) => {
    const result = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      return attempt(
        tx,
        `update profiles.advertiser_review_entries set ${set} where id = $1`,
        [entry, agentA, adminA],
      );
    });
    expect(codeOf(result)).toBe(CHECK_VIOLATION);
  });

  it("accepts a refusal `other` with a message of 20 and 500 characters, and a whole claim", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      const claim = await attempt(
        tx,
        "update profiles.advertiser_review_entries set claimed_by_account_id = $2, " +
          "claimed_at = now(), claim_expires_at = now() + interval '30 minutes', " +
          "internal_comment = 'Checked the website.' where id = $1",
        [entry, agentA],
      );
      const short = await attempt(
        tx,
        `update profiles.advertiser_review_entries set ${REJECTED}, ` +
          "member_message = repeat('a', 20) where id = $1",
        [entry, agentA],
      );
      const long = await attempt(
        tx,
        "update profiles.advertiser_review_entries set member_message = repeat('b', 500) " +
          "where id = $1 returning sla_breached",
        [entry],
      );
      return { claim: codeOf(claim), short: codeOf(short), long: rowsOf(long) };
    });
    expect(outcome).toEqual({
      claim: "rows",
      short: "rows",
      long: [{ sla_breached: false }],
    });
  });

  it("marks a decision after the deadline (sla_breached, 04 l. 2238)", async () => {
    const rows = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      await tx`
        update profiles.advertiser_review_entries
           set sla_due_at = created_at, escalate_at = null where id = ${entry}`;
      return rowsOf(
        await attempt(
          tx,
          "update profiles.advertiser_review_entries set state = 'published', " +
            "decided_by_account_id = $2, decided_at = now() + interval '1 second', " +
            "closed_at = now() + interval '1 second' where id = $1 returning sla_breached",
          [entry, agentA],
        ),
      );
    });
    expect(rows).toEqual([{ sla_breached: true }]);
  });

  it.each([
    [
      "a pending revision closed",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id, closed_at) values ($1, 'advertiser.presentation', '\"x\"', $2, now())",
    ],
    [
      "an approved revision left open",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id, status) values ($1, 'advertiser.presentation', '\"x\"', $2, 'approved')",
    ],
    [
      "a value of more than 8 000 bytes",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id) values ($1, 'advertiser.presentation', " +
        "to_jsonb(repeat(md5(random()::text), 300)), $2)",
    ],
    [
      "an empty row key",
      "insert into profiles.profile_field_revisions (account_id, field_code, row_key, " +
        "proposed_value, advertiser_review_entry_id) values ($1, 'advertiser.presentation', '', '\"x\"', $2)",
    ],
  ])("refuses %s", async (_label, statement) => {
    const result = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      return attempt(tx, statement, [brandA, entry]);
    });
    expect(codeOf(result)).toBe(CHECK_VIOLATION);
  });
});

// ---------------------------------------------------------------------------------------------
// The version token (file.md A3)
// ---------------------------------------------------------------------------------------------

async function tokenOf(
  tx: Tx,
  account: string = brandA,
): Promise<string | null> {
  const [row] = await tx<{ token: string | null }[]>`
    select profiles.advertiser_review_token(${account}) as token`;
  return row?.token ?? null;
}

describe("file.md A3: the version token changes with what the agent examines, and only with it", () => {
  it("is a SHA-256 in hex, the same twice, different from another brand's, NULL without a profile", async () => {
    const outcome = await scenario(async (tx) => ({
      first: await tokenOf(tx),
      second: await tokenOf(tx),
      other: await tokenOf(tx, brandB),
      none: await tokenOf(tx, randomUUID()),
    }));
    expect(outcome.first).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.second).toBe(outcome.first);
    expect(outcome.other).not.toBe(outcome.first);
    expect(outcome.none).toBeNull();
  });

  it.each([
    [
      "a column of the profile",
      "update profiles.advertiser_profiles set presentation = 'Another presentation' where account_id = $1",
    ],
    [
      "the country of the account",
      "update identity.accounts set country_code = 'BE' where id = $1",
    ],
    [
      "a list",
      "insert into profiles.advertiser_topics (account_id, slot, topic_code) values ($1, 2, 'travel')",
    ],
    [
      "the contact person",
      "update profiles.advertiser_contact_details set contact_phone = '+33100000001' where account_id = $1",
    ],
    [
      "the active logo",
      "update profiles.brand_logo_objects set state = 'purging', purge_requested_at = now() " +
        "where account_id = $1 and state = 'active'",
    ],
    [
      "a pending revision",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id) values ($1, 'advertiser.presentation', '\"x\"', $2)",
    ],
  ])("changes with %s", async (_label, statement) => {
    const outcome = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      const before = await tokenOf(tx);
      rowsOf(await attempt(tx, statement, [brandA, entry]));
      return { before, after: await tokenOf(tx) };
    });
    expect(outcome.after).not.toBe(outcome.before);
  });

  it("changes with the order of a list, the same values in another order", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        insert into profiles.advertiser_target_markets (account_id, slot, country_code)
        select ${brandA}, 2, code from reference.countries
         where code not in (select country_code from profiles.advertiser_target_markets
                             where account_id = ${brandA})
         order by code limit 1`;
      const before = await tokenOf(tx);
      await tx`update profiles.advertiser_target_markets set slot = 5
                where account_id = ${brandA} and slot = 1`;
      await tx`update profiles.advertiser_target_markets set slot = 1
                where account_id = ${brandA} and slot = 2`;
      await tx`update profiles.advertiser_target_markets set slot = 2
                where account_id = ${brandA} and slot = 5`;
      return { before, after: await tokenOf(tx) };
    });
    expect(outcome.after).not.toBe(outcome.before);
  });

  it.each([
    [
      "the status and the submission instant",
      "update profiles.advertiser_profiles set status = 'pending_review', submitted_at = now() " +
        "where account_id = $1",
    ],
    [
      "the completeness",
      "update profiles.advertiser_profiles set completeness_percent = 42 where account_id = $1",
    ],
    [
      "a value written again unchanged",
      "update profiles.advertiser_profiles set legal_name = legal_name where account_id = $1",
    ],
    [
      "a closed revision",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id, status, closed_at) " +
        "values ($1, 'advertiser.presentation', '\"x\"', $2, 'withdrawn', now())",
    ],
  ])("stays the same with %s", async (_label, statement) => {
    const outcome = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      const before = await tokenOf(tx);
      rowsOf(await attempt(tx, statement, [brandA, entry]));
      return { before, after: await tokenOf(tx) };
    });
    expect(outcome.after).toBe(outcome.before);
  });
});

// ---------------------------------------------------------------------------------------------
// The reads, role by role (file.md A1; 15 RG36 C(3)), and no direct write
// ---------------------------------------------------------------------------------------------

describe("file.md A1: who reads the entries and the revisions, and nobody writes them", () => {
  it("lets the brand read its own entries and revisions only, never the lock nor the internal comment", async () => {
    const outcome = await scenario(async (tx) => {
      const entryA = await openEntry(tx, brandA);
      await openEntry(tx, brandB);
      await tx`
        insert into profiles.profile_field_revisions
          (account_id, field_code, proposed_value, advertiser_review_entry_id)
        values (${brandA}, 'advertiser.presentation', '"x"', ${entryA})`;
      return asBrand(tx, brandA, async () => ({
        entries: rowsOf(
          await attempt(
            tx,
            "select account_id::text, state::text from profiles.advertiser_review_entries " +
              "where created_at = now()",
          ),
        ),
        revisions: rowsOf(
          await attempt(
            tx,
            "select account_id::text from profiles.profile_field_revisions where created_at = now()",
          ),
        ),
        lock: codeOf(
          await attempt(
            tx,
            "select claimed_by_account_id from profiles.advertiser_review_entries",
          ),
        ),
        comment: codeOf(
          await attempt(
            tx,
            "select internal_comment from profiles.advertiser_review_entries",
          ),
        ),
        deadline: codeOf(
          await attempt(
            tx,
            "select sla_due_at from profiles.advertiser_review_entries",
          ),
        ),
      }));
    });
    expect(outcome).toEqual({
      entries: [{ account_id: brandA, state: "open" }],
      revisions: [{ account_id: brandA }],
      lock: INSUFFICIENT_PRIVILEGE,
      comment: INSUFFICIENT_PRIVILEGE,
      deadline: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("lets agent and admin read every entry in aal2, nothing in aal1, never the entries of their own account (C(3))", async () => {
    const outcome = await scenario(async (tx) => {
      await openEntry(tx, brandA);
      const entryB = await openEntry(tx, brandB);
      await tx`
        insert into profiles.profile_field_revisions
          (account_id, field_code, proposed_value, advertiser_review_entry_id)
        values (${brandB}, 'advertiser.presentation', '"x"', ${entryB})`;
      const read =
        "select account_id::text from profiles.advertiser_review_entries " +
        "where created_at = now() order by 1";
      const readRevisions =
        "select account_id::text from profiles.profile_field_revisions where created_at = now()";
      // C(3): an internal holding one of these accounts (an advertiser profile requires the
      // advertiser role, so the context alone names it, which is what the policy reads)
      const asOwner = <T>(fn: () => Promise<T>) =>
        actAsInternal(
          tx,
          "influx_agent",
          { accountId: brandB, role: "agent", aal: "aal2" },
          fn,
        );
      return {
        aal2: rowsOf(await asAgent(tx, () => attempt(tx, read))),
        aal2Revisions: rowsOf(
          await asAgent(tx, () => attempt(tx, readRevisions)),
        ),
        aal1: rowsOf(await asAgent(tx, () => attempt(tx, read), "aal1")),
        aal1Revisions: rowsOf(
          await asAgent(tx, () => attempt(tx, readRevisions), "aal1"),
        ),
        own: rowsOf(await asOwner(() => attempt(tx, read))),
        ownRevisions: rowsOf(await asOwner(() => attempt(tx, readRevisions))),
        admin: rowsOf(
          await actAsInternal(
            tx,
            "influx_admin",
            { accountId: adminA, role: "admin", aal: "aal2" },
            () => attempt(tx, read),
          ),
        ),
      };
    });
    const both = [{ account_id: brandA }, { account_id: brandB }].sort((a, b) =>
      a.account_id.localeCompare(b.account_id),
    );
    expect(outcome).toEqual({
      aal2: both,
      aal2Revisions: [{ account_id: brandB }],
      aal1: [],
      aal1Revisions: [],
      own: [{ account_id: brandA }],
      ownRevisions: [],
      admin: both,
    });
  });

  it.each([
    [
      "the brand opens an entry",
      "brand",
      "insert into profiles.advertiser_review_entries (account_id, kind) values ($1, 'submission')",
    ],
    [
      "the brand closes its entry",
      "brand",
      "update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now() where id = $2",
    ],
    [
      "the brand writes a revision",
      "brand",
      "insert into profiles.profile_field_revisions (account_id, field_code, proposed_value, " +
        "advertiser_review_entry_id) values ($1, 'advertiser.presentation', '\"x\"', $2)",
    ],
    [
      "an agent publishes an entry",
      "agent",
      "update profiles.advertiser_review_entries set state = 'published' where id = $2",
    ],
    [
      "an agent claims an entry",
      "agent",
      "update profiles.advertiser_review_entries set claimed_by_account_id = $3 where id = $2",
    ],
    [
      "an agent deletes a revision",
      "agent",
      "delete from profiles.profile_field_revisions where account_id = $1",
    ],
    [
      "an agent adds a reason",
      "agent",
      "insert into profiles.advertiser_rejection_reasons (code, label_key, message_key, position) " +
        "values ('spam', 'reason.profiles_advertiser.spam', 'profileDecision.reason.spam', 9)",
    ],
    [
      "the brand reads the reasons",
      "brand",
      "select code from profiles.advertiser_rejection_reasons",
    ],
    [
      "the brand reads the moderated fields",
      "brand",
      "select code from profiles.moderated_fields",
    ],
    [
      "the brand computes a token",
      "brand",
      "select profiles.advertiser_review_token($1)",
    ],
  ])("refuses that %s (42501)", async (_label, actor, statement) => {
    const result = await scenario(async (tx) => {
      const entry = await openEntry(tx, brandA);
      const parameters = [brandA, entry, agentA];
      return actor === "brand"
        ? asBrand(tx, brandA, () => attempt(tx, statement, parameters))
        : asAgent(tx, () => attempt(tx, statement, parameters));
    });
    expect(codeOf(result)).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("refuses a creator any read of the entries, the revisions and the catalogues (42501)", async () => {
    const outcome = await scenario((tx) =>
      actAsMember(
        tx,
        "influx_creator",
        {
          accountId: accountIdOf("creator", "a"),
          role: "creator",
          aal: "aal1",
        },
        async () => {
          const codes: string[] = [];
          for (const table of [
            "advertiser_review_entries",
            "profile_field_revisions",
            "moderated_fields",
            "advertiser_rejection_reasons",
          ]) {
            codes.push(
              codeOf(await attempt(tx, `select 1 from profiles.${table}`)),
            );
          }
          return codes;
        },
      ),
    );
    expect(outcome).toEqual([
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
    ]);
  });
});
