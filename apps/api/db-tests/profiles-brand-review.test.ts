// L2C commit 05 — the objects of queue 1, without any decision (0207; jalons/l2c/file.md A1, A3,
// A4, A6, D81; 04 §5.2, §5.6; 06 RG9, RG63 to RG68; 15 RG26, RG36): the two catalogues, the entry
// the submission opens in its transaction (one open at most, deadlines frozen by the base), the
// revisions attached to an entry of their own account, the bounds of the decision columns, the
// version token, and the reads role by role. The export and the erasure of the entries live in
// t8-privacy-execution.test.ts (EC-L2C-05-8). Each case runs in a rolled-back transaction of the
// local superuser, which acts as apps/api does (support.ts).
// L2C commit 06 (0208, 0209; file.md A3, A4; L2BS-1): the freeze of a published and of a suspended
// profile (L2C-G1 to G5, by the role influx_advertiser, without the API), the member door of RG9
// (CA15, CA16), the logo under review, the writes during an examination, L2BT-7. L2BT-3 lives in
// profiles-brand-route.test.ts: two real concurrent submissions need committed rows.
import {
  accountIdOf,
  BRAND_LOGO_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAsInternal, actAsMember, localSuperuser } from "./support.ts";

const OBJECT_NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
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
  | { outcome: "rows"; rows: Row[] }
  | { outcome: "error"; code: string; detail?: string };

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
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) {
      throw error;
    }
    return { outcome: "error", code: found.code, detail: found.detail };
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

// ---------------------------------------------------------------------------------------------
// L2C commit 06: the freeze and the member door (0209)
// ---------------------------------------------------------------------------------------------

/** Sets the state as the superuser (no decision exists before commit 07). */
async function setStatus(
  tx: Tx,
  status: string,
  account: string = brandA,
): Promise<void> {
  await tx.unsafe(
    "update profiles.advertiser_profiles " +
      "set status = $1::profiles.advertiser_profile_status where account_id = $2",
    [status, account],
  );
}

/** Brand A complete, with a website, in the given state. */
async function brandAIn(tx: Tx, status: string): Promise<void> {
  await completeBrandA(tx);
  await tx`
    update profiles.advertiser_profiles set website_domain = 'brand-a.example'
     where account_id = ${brandA}`;
  await setStatus(tx, status);
}

function door(
  tx: Tx,
  field: string,
  json: string | null,
  account: string = brandA,
): Promise<Attempt> {
  return asBrand(tx, account, () =>
    attempt(
      tx,
      "select revision_status::text as status, entry_id::text as entry " +
        "from profiles.submit_own_advertiser_revision($1, $2::jsonb)",
      [field, json],
    ),
  );
}

type Revision = { value: unknown; status: string; entry: string };

/** The revisions written in the scenario, oldest first (the data set's closed one left out). */
function revisionsOf(tx: Tx, field: string): Promise<Revision[]> {
  return tx<Revision[]>`
    select proposed_value as value, status::text as status,
           advertiser_review_entry_id::text as entry
      from profiles.profile_field_revisions
     where account_id = ${brandA} and field_code = ${field} and submitted_at = now()
     order by status = 'pending_review', id`;
}

function registerLines(tx: Tx, code: string): Promise<Row[]> {
  return tx<Row[]>`
    select payload from audit.audit_events
     where event_type = ${code} and subject_id = ${brandA} and occurred_at = now()`;
}

async function leadUpdates(tx: Tx): Promise<number> {
  const [row] = await tx<{ n: number }[]>`
    select count(*)::int as n from leads.outbox_events
     where event_type = 'lead.updated' and subject_key = ${`account:${brandA}`}`;
  return Number(row?.n);
}

async function pendingLogo(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into profiles.brand_logo_objects (account_id, received_bytes)
    values (${brandA}, 1000) returning id::text`;
  if (row === undefined) {
    throw new Error("no logo row");
  }
  return row.id;
}

function activate(tx: Tx, logo: string): Promise<Attempt> {
  return asBrand(tx, brandA, () =>
    attempt(
      tx,
      "select previous_logo_id::text as id " +
        "from profiles.activate_brand_logo($1, 500, 512, 512)",
      [logo],
    ),
  );
}

function removeLogo(tx: Tx): Promise<Attempt> {
  return asBrand(tx, brandA, () =>
    attempt(
      tx,
      "select logo_id::text as id from profiles.remove_own_brand_logo()",
    ),
  );
}

/** Every logo row of brand A: id to state. */
async function logoStates(tx: Tx): Promise<Record<string, string>> {
  const rows = await tx<{ id: string; state: string }[]>`
    select id::text, state::text from profiles.brand_logo_objects
     where account_id = ${brandA}`;
  return Object.fromEntries(rows.map((row) => [row.id, row.state]));
}

/**
 * As the owner of the member doors, around them: what a door could do by mistake. The transaction
 * of the local superuser takes the role and the context directly, then gives both back.
 */
async function asDoorOwner<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await tx`select
    pg_catalog.set_config('influx.account', ${brandA}, true),
    pg_catalog.set_config('influx.role', 'advertiser', true),
    pg_catalog.set_config('influx.aal', 'aal1', true)`;
  await tx.unsafe("set local role influx_identity_definer");
  const result = await fn();
  await tx.unsafe("reset role");
  return result;
}

function rename(tx: Tx, name: string): Promise<Attempt> {
  return asBrand(tx, brandA, () =>
    attempt(
      tx,
      "select identity.update_own_account(null, null, null, $1) as changed",
      [name],
    ),
  );
}

async function legalNameOf(tx: Tx): Promise<string> {
  const [row] = await tx<{ legal_name: string }[]>`
    select legal_name from profiles.advertiser_profiles where account_id = ${brandA}`;
  return String(row?.legal_name);
}

const FROZEN = OBJECT_NOT_IN_PREREQUISITE_STATE;
const OTHER_TEXT = "Another honest presentation of the brand. "
  .repeat(4)
  .trim();

describe("L2C-G1: a moderated column of a published profile, by influx_advertiser directly (L2BS-1)", () => {
  it.each([
    ["presentation", `'${OTHER_TEXT}'`, "advertiser.presentation"],
    ["website_domain", "'other.example'", "advertiser.website_domain"],
    ["contact_role", "'executive'", "advertiser.contact_role"],
    ["primary_sector_code", "'alcohol'", "advertiser.primary_sector"],
  ])(
    "refuses %s (55000), the field named, the live value kept",
    async (column, value, code) => {
      const outcome = await scenario(async (tx) => {
        await brandAIn(tx, "published");
        const read = () =>
          tx.unsafe(
            `select ${column} as value from profiles.advertiser_profiles where account_id = $1`,
            [brandA],
          );
        const [before] = await read();
        const write = await asBrand(tx, brandA, () =>
          attempt(
            tx,
            `update profiles.advertiser_profiles set ${column} = ${value} where account_id = $1`,
            [brandA],
          ),
        );
        const [after] = await read();
        return { write, same: before?.value === after?.value };
      });
      expect(outcome.write).toMatchObject({ code: FROZEN, detail: code });
      expect(outcome.same).toBe(true);
    },
  );

  it("frees a deactivated field: the direct write passes, the door refuses it (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      await tx`
        update profiles.moderated_fields set is_active = false
         where code = 'advertiser.presentation'`;
      return {
        write: await asBrand(tx, brandA, () =>
          attempt(
            tx,
            `update profiles.advertiser_profiles set presentation = '${OTHER_TEXT}'
              where account_id = $1 returning 1 as one`,
            [brandA],
          ),
        ),
        proposal: await door(
          tx,
          "advertiser.presentation",
          JSON.stringify(OTHER_TEXT),
        ),
      };
    });
    expect(rowsOf(outcome.write)).toEqual([{ one: 1 }]);
    expect(codeOf(outcome.proposal)).toBe(INVALID_PARAMETER_VALUE);
  });
});

describe("L2C-G2: the lists of a suspended profile, by influx_advertiser directly", () => {
  it.each([
    [
      "advertiser_secondary_sectors",
      "(account_id, slot, sector_code)",
      "2, 'alcohol'",
    ],
    [
      "advertiser_target_markets",
      "(account_id, slot, country_code)",
      "2, 'DE'",
    ],
    ["advertiser_working_languages", "(account_id, language_code)", "'de'"],
    ["advertiser_topics", "(account_id, slot, topic_code)", "2, 'unknown'"],
    ["advertiser_networks", "(account_id, network_code)", "'unknown'"],
    ["advertiser_formats", "(account_id, format_code)", "'unknown'"],
    [
      "advertiser_audience_countries",
      "(account_id, slot, country_code)",
      "2, 'DE'",
    ],
    ["advertiser_usage_rights", "(account_id, usage_right_code)", "'unknown'"],
  ])(
    "refuses an insert and a delete on %s (55000)",
    async (table, columns, values) => {
      const outcome = await scenario(async (tx) => {
        await setStatus(tx, "suspended");
        return asBrand(tx, brandA, async () => ({
          insert: await attempt(
            tx,
            `insert into profiles.${table} ${columns} values ($1, ${values})`,
            [brandA],
          ),
          remove: await attempt(
            tx,
            `delete from profiles.${table} where account_id = $1`,
            [brandA],
          ),
        }));
      });
      expect(codeOf(outcome.insert)).toBe(FROZEN);
      expect(codeOf(outcome.remove)).toBe(FROZEN);
    },
  );

  it("leaves another brand's rows to the policy of the table: nothing deleted, nothing refused", async () => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "suspended", brandB);
      return asBrand(tx, brandA, () =>
        attempt(
          tx,
          "delete from profiles.advertiser_topics where account_id = $1 returning 1",
          [brandB],
        ),
      );
    });
    expect(rowsOf(outcome)).toEqual([]);
  });
});

describe("L2C-G3: the logo, by influx_advertiser through its doors, by their owner around them", () => {
  it("refuses a suspended profile: upload, activation and removal (55000), the rows untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await setStatus(tx, "suspended");
      return {
        logo,
        begin: await asBrand(tx, brandA, () =>
          attempt(
            tx,
            "select logo_id from profiles.begin_brand_logo_upload(1000)",
          ),
        ),
        activation: await activate(tx, logo),
        removal: await removeLogo(tx),
        states: await logoStates(tx),
      };
    });
    expect(codeOf(outcome.begin)).toBe(FROZEN);
    expect(codeOf(outcome.activation)).toBe(FROZEN);
    expect(codeOf(outcome.removal)).toBe(FROZEN);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "active",
      [outcome.logo]: "pending",
    });
  });

  it("refuses the owner of the doors moving the active logo out of a published profile (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "published");
      return asDoorOwner(tx, () =>
        attempt(
          tx,
          "update profiles.brand_logo_objects " +
            "set state = 'purging', purge_requested_at = now() where id = $1",
          [BRAND_LOGO_IDS.a],
        ),
      );
    });
    expect(outcome).toMatchObject({ code: FROZEN, detail: "advertiser.logo" });
  });

  it("refuses the owner of the doors activating a logo on a published profile (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await tx`
        update profiles.brand_logo_objects
           set state = 'purging', purge_requested_at = now()
         where id = ${BRAND_LOGO_IDS.a}`;
      await setStatus(tx, "published");
      return asDoorOwner(tx, () =>
        attempt(
          tx,
          "update profiles.brand_logo_objects set state = 'active', byte_size = 1, width = 1, " +
            "height = 1, activated_at = now() where id = $1",
          [logo],
        ),
      );
    });
    expect(outcome).toMatchObject({ code: FROZEN, detail: "advertiser.logo" });
  });
});

describe("L2C-G4: the company name (identity.update_own_account, file.md A4)", () => {
  it("refuses a change on a suspended profile (55000) and keeps the name", async () => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "suspended");
      return {
        write: await rename(tx, "Maison Autre"),
        name: await legalNameOf(tx),
      };
    });
    expect(codeOf(outcome.write)).toBe(FROZEN);
    expect(outcome.name).not.toBe("Maison Autre");
  });

  it("refuses the owner of the doors writing the name of a published profile (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "published");
      return asDoorOwner(tx, () =>
        attempt(
          tx,
          "update profiles.advertiser_profiles set legal_name = 'Maison Autre'",
        ),
      );
    });
    expect(outcome).toMatchObject({
      code: FROZEN,
      detail: "advertiser.brand_name",
    });
  });

  it("deposits a revision on a published profile: the name stays, no lead.updated", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const leads = await leadUpdates(tx);
      const write = await rename(tx, "Maison Autre");
      return {
        write,
        name: await legalNameOf(tx),
        added: (await leadUpdates(tx)) - leads,
        revisions: await revisionsOf(tx, "advertiser.brand_name"),
      };
    });
    expect(rowsOf(outcome.write)).toEqual([{ changed: true }]);
    expect(outcome.name).not.toBe("Maison Autre");
    expect(outcome.added).toBe(0);
    expect(outcome.revisions).toMatchObject([
      { value: "Maison Autre", status: "pending_review" },
    ]);
  });

  it("answers false for the validated name with nothing pending; a return to it withdraws", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const name = await legalNameOf(tx);
      const unchanged = await rename(tx, name);
      await rename(tx, "Maison Autre");
      const back = await rename(tx, name);
      return {
        unchanged,
        back,
        revisions: await revisionsOf(tx, "advertiser.brand_name"),
      };
    });
    expect(rowsOf(outcome.unchanged)).toEqual([{ changed: false }]);
    expect(rowsOf(outcome.back)).toEqual([{ changed: true }]);
    expect(outcome.revisions).toMatchObject([{ status: "withdrawn" }]);
  });

  it("keeps the direct rename outside published, and the country immediate on published", async () => {
    const outcome = await scenario(async (tx) => {
      const leads = await leadUpdates(tx);
      const draft = await rename(tx, "Maison Brouillon");
      await brandAIn(tx, "published");
      const country = await asBrand(tx, brandA, () =>
        attempt(
          tx,
          "select identity.update_own_account('DE', null, null, null) as changed",
        ),
      );
      const [row] = await tx<{ country: string }[]>`
        select country_code::text as country from identity.accounts where id = ${brandA}`;
      return {
        draft,
        country,
        accountCountry: row?.country,
        name: await legalNameOf(tx),
        added: (await leadUpdates(tx)) - leads,
      };
    });
    expect(rowsOf(outcome.draft)).toEqual([{ changed: true }]);
    expect(rowsOf(outcome.country)).toEqual([{ changed: true }]);
    expect(outcome.accountCountry).toBe("DE");
    expect(outcome.name).toBe("Maison Brouillon");
    expect(outcome.added).toBe(4); // two changes, two destinations each
  });
});

describe("L2C-G5: every other write of a suspended profile, by influx_advertiser directly", () => {
  it.each([
    [
      "a column with immediate effect",
      "update profiles.advertiser_profiles set company_size_band = '1_10' where account_id = $1",
    ],
    [
      "the stored score",
      "update profiles.advertiser_profiles set completeness_percent = 10 where account_id = $1",
    ],
    [
      "a moderated column",
      `update profiles.advertiser_profiles set presentation = '${OTHER_TEXT}' where account_id = $1`,
    ],
    [
      "the contact person",
      "update profiles.advertiser_contact_details set contact_first_name = 'Ana' where account_id = $1",
    ],
  ])("refuses %s (55000)", async (_label, statement) => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "suspended");
      return asBrand(tx, brandA, () => attempt(tx, statement, [brandA]));
    });
    expect(codeOf(outcome)).toBe(FROZEN);
  });

  it("refuses a first contact row (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      await setStatus(tx, "suspended");
      await tx`delete from profiles.advertiser_contact_details where account_id = ${brandA}`;
      return asBrand(tx, brandA, () =>
        attempt(
          tx,
          "insert into profiles.advertiser_contact_details (account_id, contact_first_name) " +
            "values ($1, 'Ana')",
          [brandA],
        ),
      );
    });
    expect(codeOf(outcome)).toBe(FROZEN);
  });
});

describe("CA15: the member door of RG9 on a published profile (file.md A3, A4)", () => {
  const PRESENTATION_FIELD = "advertiser.presentation";
  const proposed = JSON.stringify(OTHER_TEXT);

  it("deposits the value, opens one revision entry, keeps the live row and the state", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const before = await tokenOf(tx);
      const result = await door(tx, PRESENTATION_FIELD, proposed);
      const [profile] = await tx<{ status: string; presentation: string }[]>`
        select status::text, presentation from profiles.advertiser_profiles
         where account_id = ${brandA}`;
      return {
        result,
        profile,
        entries: await openedEntries(tx, brandA),
        revisions: await revisionsOf(tx, PRESENTATION_FIELD),
        lines: await registerLines(tx, "profile.revision_submitted"),
        tokenChanged: before !== (await tokenOf(tx)),
      };
    });
    const [row] = rowsOf(outcome.result);
    expect(row?.status).toBe("pending_review");
    expect(outcome.profile).toEqual({
      status: "published",
      presentation: PRESENTATION,
    });
    expect(outcome.entries).toHaveLength(1);
    expect(outcome.entries[0]).toMatchObject({
      id: row?.entry,
      kind: "revision",
      state: "open",
    });
    expect(outcome.entries[0]?.sla_due_at).toBeInstanceOf(Date);
    expect(outcome.revisions).toEqual([
      { value: OTHER_TEXT, status: "pending_review", entry: row?.entry },
    ]);
    expect(outcome.lines).toEqual([
      { payload: { field_code: PRESENTATION_FIELD, entry_id: row?.entry } },
    ]);
    expect(outcome.tokenChanged).toBe(true);
  });

  it("replaces the pending value: superseded, one pending, the same entry; the same value writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      await door(tx, PRESENTATION_FIELD, proposed);
      const replaced = `${OTHER_TEXT} Replaced.`;
      await door(tx, PRESENTATION_FIELD, JSON.stringify(replaced));
      const token = await tokenOf(tx);
      const again = await door(
        tx,
        PRESENTATION_FIELD,
        JSON.stringify(replaced),
      );
      return {
        replaced,
        again,
        tokenKept: token === (await tokenOf(tx)),
        entries: await openedEntries(tx, brandA),
        revisions: await revisionsOf(tx, PRESENTATION_FIELD),
        lines: await registerLines(tx, "profile.revision_submitted"),
      };
    });
    const entry = outcome.entries[0]?.id;
    expect(outcome.entries).toHaveLength(1);
    expect(rowsOf(outcome.again)).toEqual([
      { status: "pending_review", entry },
    ]);
    expect(outcome.tokenKept).toBe(true);
    expect(outcome.revisions).toEqual([
      { value: OTHER_TEXT, status: "superseded", entry },
      { value: outcome.replaced, status: "pending_review", entry },
    ]);
    expect(outcome.lines).toHaveLength(2);
  });

  it("withdraws on a return to the validated value: the entry closes, the token comes back", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const before = await tokenOf(tx);
      await door(tx, PRESENTATION_FIELD, proposed);
      const back = await door(
        tx,
        PRESENTATION_FIELD,
        JSON.stringify(PRESENTATION),
      );
      const [entry] = await tx<{ state: string; closed: boolean }[]>`
        select state::text, closed_at is not null as closed
          from profiles.advertiser_review_entries
         where account_id = ${brandA} and created_at = now()`;
      return {
        back,
        entry,
        tokenBack: before === (await tokenOf(tx)),
        revisions: await revisionsOf(tx, PRESENTATION_FIELD),
        lines: await registerLines(tx, "profile.revision_withdrawn"),
      };
    });
    expect(rowsOf(outcome.back)).toMatchObject([{ status: "withdrawn" }]);
    expect(outcome.entry).toEqual({ state: "withdrawn", closed: true });
    expect(outcome.tokenBack).toBe(true);
    expect(outcome.revisions).toMatchObject([{ status: "withdrawn" }]);
    expect(outcome.lines).toHaveLength(1);
  });

  it("keeps the entry open while another field waits, and joins an entry already open", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const joined = await openEntry(tx);
      await door(tx, PRESENTATION_FIELD, proposed);
      await door(tx, "advertiser.contact_role", '"executive"');
      await door(tx, "advertiser.contact_role", '"marketing"');
      return {
        joined,
        entries: await openedEntries(tx, brandA),
        presentation: await revisionsOf(tx, PRESENTATION_FIELD),
      };
    });
    expect(outcome.entries).toMatchObject([
      { id: outcome.joined, state: "open" },
    ]);
    expect(outcome.presentation).toMatchObject([
      { status: "pending_review", entry: outcome.joined },
    ]);
  });

  it("closes a claimed entry too: the agent finds it closed (file.md A3, C7)", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      await door(tx, PRESENTATION_FIELD, proposed);
      await tx`
        update profiles.advertiser_review_entries
           set claimed_by_account_id = ${agentA}, claimed_at = now(),
               claim_expires_at = now() + interval '30 minutes'
         where account_id = ${brandA} and state = 'open'`;
      return {
        back: await door(tx, PRESENTATION_FIELD, JSON.stringify(PRESENTATION)),
        entries: await openedEntries(tx, brandA),
      };
    });
    expect(rowsOf(outcome.back)).toMatchObject([{ status: "withdrawn" }]);
    expect(outcome.entries).toMatchObject([{ state: "withdrawn" }]);
  });

  it("answers (NULL, NULL) for the validated value with nothing pending, and opens nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      return {
        result: await door(
          tx,
          PRESENTATION_FIELD,
          JSON.stringify(PRESENTATION),
        ),
        entries: await openedEntries(tx, brandA),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([{ status: null, entry: null }]);
    expect(outcome.entries).toEqual([]);
  });

  it.each([
    ["advertiser.brand_name", "null", "legal_name"],
    ["advertiser.brand_name", '" "', "legal_name"],
    ["advertiser.presentation", "null", "presentation"],
    ["advertiser.presentation", '"Too short."', "presentation"],
    ["advertiser.contact_role", "null", "contact_role"],
    ["advertiser.primary_sector", "null", "primary_sector"],
  ])(
    "refuses %s emptied with %s (23514), the code named",
    async (field, json, code) => {
      const outcome = await scenario(async (tx) => {
        await brandAIn(tx, "published");
        return {
          result: await door(tx, field, json),
          entries: await openedEntries(tx, brandA),
        };
      });
      expect(outcome.result).toMatchObject({
        code: CHECK_VIOLATION,
        detail: code,
      });
      expect(outcome.entries).toEqual([]);
    },
  );

  it("takes the removal of an optional field as a revision (JSON null)", async () => {
    const revisions = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      await door(tx, "advertiser.website_domain", "null");
      return revisionsOf(tx, "advertiser.website_domain");
    });
    expect(revisions).toMatchObject([
      { value: null, status: "pending_review" },
    ]);
  });

  it.each([
    ["an unknown field", "advertiser.unknown", '"x"'],
    ["a field that is not moderated", "advertiser.company_size", '"1_10"'],
    ["a number", PRESENTATION_FIELD, "120"],
    ["an object", PRESENTATION_FIELD, '{"text": "x"}'],
    ["no value at all", PRESENTATION_FIELD, null],
    ["a logo as a text", "advertiser.logo", '"x"'],
    ["a logo with another key", "advertiser.logo", '{"logo": null}'],
    [
      "a logo that is no identifier",
      "advertiser.logo",
      '{"logo_object_id": "x"}',
    ],
    [
      "a logo of nobody",
      "advertiser.logo",
      `{"logo_object_id": "${randomUUID()}"}`,
    ],
    [
      "a logo of another brand",
      "advertiser.logo",
      `{"logo_object_id": "${BRAND_LOGO_IDS.b}"}`,
    ],
  ])("refuses %s (22023)", async (_label, field, json) => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      return door(tx, field, json);
    });
    expect(codeOf(outcome)).toBe(INVALID_PARAMETER_VALUE);
  });

  it.each([["draft"], ["pending_review"], ["rejected"], ["suspended"]])(
    "refuses a %s profile (55000)",
    async (status) => {
      const outcome = await scenario(async (tx) => {
        await brandAIn(tx, status);
        return door(tx, PRESENTATION_FIELD, proposed);
      });
      expect(codeOf(outcome)).toBe(FROZEN);
    },
  );

  it("refuses an agent and a creator (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const statement =
        "select * from profiles.submit_own_advertiser_revision('advertiser.presentation', 'null')";
      return {
        agent: await asAgent(tx, () => attempt(tx, statement)),
        creator: await actAsMember(
          tx,
          "influx_creator",
          {
            accountId: accountIdOf("creator", "a"),
            role: "creator",
            aal: "aal1",
          },
          () => attempt(tx, statement),
        ),
      };
    });
    expect(codeOf(outcome.agent)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(codeOf(outcome.creator)).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("refuses the owner of the doors any decision: no approval, no publication (RG6, 42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      await door(tx, PRESENTATION_FIELD, proposed);
      return asDoorOwner(tx, async () => ({
        revision: await attempt(
          tx,
          "update profiles.profile_field_revisions set status = 'approved', closed_at = now() " +
            "where status = 'pending_review'",
        ),
        entry: await attempt(
          tx,
          "update profiles.advertiser_review_entries set state = 'published', closed_at = now() " +
            "where state = 'open'",
        ),
      }));
    });
    expect(codeOf(outcome.revision)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(codeOf(outcome.entry)).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("lets the brand ask only whether a code is moderated, and the guard stay out of reach", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        active: await attempt(
          tx,
          "select profiles.moderated_field_is_active('advertiser.presentation') as answer",
        ),
        unknown: await attempt(
          tx,
          "select profiles.moderated_field_is_active('advertiser.company_size') as answer",
        ),
        guard: await attempt(
          tx,
          "select profiles.guard_advertiser_member_write()",
        ),
      })),
    );
    expect(rowsOf(outcome.active)).toEqual([{ answer: true }]);
    expect(rowsOf(outcome.unknown)).toEqual([{ answer: false }]);
    expect(codeOf(outcome.guard)).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("CA16: a field with immediate effect on a published profile", () => {
  it("applies the column, the list and the contact person at once, without revision nor entry", async () => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "published");
      const writes = await asBrand(tx, brandA, async () => [
        await attempt(
          tx,
          `update profiles.advertiser_profiles
              set presentation = presentation, company_size_band = '1_10', completeness_percent = 80
            where account_id = $1 returning 1 as one`,
          [brandA],
        ),
        await attempt(
          tx,
          "insert into profiles.advertiser_target_markets (account_id, slot, country_code) " +
            "values ($1, 2, 'DE') returning 1 as one",
          [brandA],
        ),
        await attempt(
          tx,
          "update profiles.advertiser_contact_details set contact_first_name = 'Ana' " +
            "where account_id = $1 returning 1 as one",
          [brandA],
        ),
      ]);
      const [row] = await tx<{ band: string; name: string }[]>`
        select p.company_size_band as band, c.contact_first_name as name
          from profiles.advertiser_profiles p
          join profiles.advertiser_contact_details c on c.account_id = p.account_id
         where p.account_id = ${brandA}`;
      return { writes, row, entries: await openedEntries(tx, brandA) };
    });
    for (const write of outcome.writes) {
      expect(rowsOf(write)).toEqual([{ one: 1 }]);
    }
    expect(outcome.row).toEqual({ band: "1_10", name: "Ana" });
    expect(outcome.entries).toEqual([]);
  });

  it("records one lead.updated per destination when published, nothing otherwise (RG78)", async () => {
    const outcome = await scenario(async (tx) => {
      const call = () =>
        asBrand(tx, brandA, () =>
          attempt(
            tx,
            "select profiles.record_own_advertiser_profile_change() as recorded",
          ),
        );
      const leads = await leadUpdates(tx);
      const draft = await call();
      const afterDraft = (await leadUpdates(tx)) - leads;
      await brandAIn(tx, "published");
      const published = await call();
      const [event] = await tx<{ payload: Row; destinations: string }[]>`
        select max(payload::text)::jsonb as payload,
               string_agg(destination::text, ',' order by destination::text) as destinations
          from leads.outbox_events
         where event_type = 'lead.updated' and subject_key = ${`account:${brandA}`}
         group by event_id
         order by max(created_at) desc limit 1`;
      return {
        draft,
        afterDraft,
        published,
        event,
        added: (await leadUpdates(tx)) - leads,
      };
    });
    expect(rowsOf(outcome.draft)).toEqual([{ recorded: false }]);
    expect(outcome.afterDraft).toBe(0);
    expect(rowsOf(outcome.published)).toEqual([{ recorded: true }]);
    expect(outcome.added).toBe(2);
    expect(outcome.event?.destinations).toBe("apollo_contact,brevo_contact");
    expect(Object.keys(outcome.event?.payload ?? {}).sort()).toEqual([
      "account_id",
      "event_id",
    ]);
  });
});

describe("the logo of a published profile waits under review (file.md A4)", () => {
  it("proposes the new object: in_review, the active logo stays, one revision", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      const before = await tokenOf(tx);
      return {
        logo,
        result: await activate(tx, logo),
        states: await logoStates(tx),
        revisions: await revisionsOf(tx, "advertiser.logo"),
        tokenChanged: before !== (await tokenOf(tx)),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([]);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "active",
      [outcome.logo]: "in_review",
    });
    expect(outcome.revisions).toMatchObject([
      { value: { logo_object_id: outcome.logo }, status: "pending_review" },
    ]);
    expect(outcome.tokenChanged).toBe(true);
  });

  it("replaces a logo under review: the previous one purged and returned, the active one kept", async () => {
    const outcome = await scenario(async (tx) => {
      const first = await pendingLogo(tx);
      const second = await pendingLogo(tx);
      await brandAIn(tx, "published");
      await activate(tx, first);
      return {
        first,
        second,
        result: await activate(tx, second),
        states: await logoStates(tx),
        revisions: await revisionsOf(tx, "advertiser.logo"),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([{ id: outcome.first }]);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "active",
      [outcome.first]: "purging",
      [outcome.second]: "in_review",
    });
    expect(outcome.revisions.map((row) => row.status)).toEqual([
      "superseded",
      "pending_review",
    ]);
  });

  it("proposes the removal: the active logo stays, the logo under review purged and returned", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      await activate(tx, logo);
      return {
        logo,
        result: await removeLogo(tx),
        states: await logoStates(tx),
        revisions: await revisionsOf(tx, "advertiser.logo"),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([{ id: outcome.logo }]);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "active",
      [outcome.logo]: "purging",
    });
    expect(outcome.revisions).toMatchObject([
      { status: "superseded" },
      { value: { logo_object_id: null }, status: "pending_review" },
    ]);
  });

  it("withdraws when a brand without logo removes the one under review", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`delete from profiles.brand_logo_objects where account_id = ${brandA}`;
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      await activate(tx, logo);
      return {
        logo,
        result: await removeLogo(tx),
        states: await logoStates(tx),
        entries: await openedEntries(tx, brandA),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([{ id: outcome.logo }]);
    expect(outcome.states).toEqual({ [outcome.logo]: "purging" });
    expect(outcome.entries).toMatchObject([{ state: "withdrawn" }]);
  });

  it("purges what the door no longer proposes, for a member calling it directly", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      await activate(tx, logo);
      return {
        logo,
        back: await door(
          tx,
          "advertiser.logo",
          `{"logo_object_id": "${BRAND_LOGO_IDS.a}"}`,
        ),
        states: await logoStates(tx),
      };
    });
    expect(rowsOf(outcome.back)).toMatchObject([{ status: "withdrawn" }]);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "active",
      [outcome.logo]: "purging",
    });
  });

  it("refuses a pending row as a proposal (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      return door(tx, "advertiser.logo", `{"logo_object_id": "${logo}"}`);
    });
    expect(codeOf(outcome)).toBe(INVALID_PARAMETER_VALUE);
  });

  it("holds one logo under review per brand, stored and never activated (23505, 23514)", async () => {
    const outcome = await scenario(async (tx) => {
      const [first, second, third] = [
        await pendingLogo(tx),
        await pendingLogo(tx),
        await pendingLogo(tx),
      ];
      const stored =
        "state = 'in_review', byte_size = 1, width = 1, height = 1";
      await attempt(
        tx,
        `update profiles.brand_logo_objects set ${stored} where id = $1`,
        [first],
      );
      return {
        two: await attempt(
          tx,
          `update profiles.brand_logo_objects set ${stored} where id = $1`,
          [second],
        ),
        unstored: await attempt(
          tx,
          "update profiles.brand_logo_objects set state = 'in_review' where id = $1",
          [third],
        ),
        activated: await attempt(
          tx,
          `update profiles.brand_logo_objects set ${stored}, activated_at = now() where id = $1`,
          [third],
        ),
      };
    });
    expect(codeOf(outcome.two)).toBe(UNIQUE_VIOLATION);
    expect(codeOf(outcome.unstored)).toBe(CHECK_VIOLATION);
    expect(codeOf(outcome.activated)).toBe(CHECK_VIOLATION);
  });

  it("keeps a logo under review out of the reach of the purge (0205 tightened)", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "published");
      await activate(tx, logo);
      await tx.unsafe("set local role influx_maintenance_definer");
      const seen = await tx`
        select id from profiles.brand_logo_objects where id = ${logo}`;
      const moved = await tx`
        update profiles.brand_logo_objects
           set state = 'purging', purge_requested_at = now() where id = ${logo}`;
      await tx.unsafe("reset role");
      return { seen: seen.length, moved: moved.count };
    });
    expect(outcome).toEqual({ seen: 0, moved: 0 });
  });
});

describe("file.md A3: a write during the examination changes the token", () => {
  it.each([
    [
      "a moderated column",
      `update profiles.advertiser_profiles set presentation = '${OTHER_TEXT}' where account_id = $1`,
    ],
    [
      "an immediate column",
      "update profiles.advertiser_profiles set company_size_band = '1_10' where account_id = $1",
    ],
    [
      "a list",
      "insert into profiles.advertiser_target_markets (account_id, slot, country_code) values ($1, 2, 'DE')",
    ],
    [
      "the contact person",
      "update profiles.advertiser_contact_details set contact_first_name = 'Ana' where account_id = $1",
    ],
  ])("%s, permitted while pending_review", async (_label, statement) => {
    const outcome = await scenario(async (tx) => {
      await brandAIn(tx, "pending_review");
      const before = await tokenOf(tx);
      const write = await asBrand(tx, brandA, () =>
        attempt(tx, statement, [brandA]),
      );
      return { write, changed: before !== (await tokenOf(tx)) };
    });
    expect(outcome.write.outcome).toBe("rows");
    expect(outcome.changed).toBe(true);
  });

  it("the logo, activated at once while pending_review", async () => {
    const outcome = await scenario(async (tx) => {
      const logo = await pendingLogo(tx);
      await brandAIn(tx, "pending_review");
      const before = await tokenOf(tx);
      const result = await activate(tx, logo);
      return {
        logo,
        result,
        states: await logoStates(tx),
        changed: before !== (await tokenOf(tx)),
      };
    });
    expect(rowsOf(outcome.result)).toEqual([{ id: BRAND_LOGO_IDS.a }]);
    expect(outcome.states).toEqual({
      [BRAND_LOGO_IDS.a]: "purging",
      [outcome.logo]: "active",
    });
    expect(outcome.changed).toBe(true);
  });
});

describe("L2BT-7: the company name and the country of a submission (0203, RG15)", () => {
  it("refuses a name of invisible characters, which the column admits (23514, legal_name)", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      await tx`
        update profiles.advertiser_profiles set legal_name = ${"  "}
         where account_id = ${brandA}`;
      return submit(tx);
    });
    expect(outcome).toMatchObject({
      code: CHECK_VIOLATION,
      detail: "legal_name",
    });
  });

  it.each([
    ["absent", "{}"],
    ["null", '{"country": null}'],
    ["empty", '{"country": ""}'],
  ])(
    "counts a country %s as missing (the column forbids it on a row: not null, foreign key)",
    async (_label, json) => {
      const [row] = await localSuperuser()<{ missing: string[] }[]>`
        select profiles.advertiser_missing_required_fields(${json}::jsonb) as missing`;
      expect(row?.missing).toContain("country");
    },
  );
});
