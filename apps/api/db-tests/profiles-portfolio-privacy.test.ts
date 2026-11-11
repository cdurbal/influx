// L2G commit 05 — the data of L2G in the export, the erasure and the reads of the worker, 0245
// (jalons/l2g/05.md; l2g/modele.md point 14, §3 "0245", §4; fiche invariants 11, 13, 15; 04 §9.2; 07
// RG99, RG106 to RG110). L2G-D12: the visuals with their statements of RG83, the entries of queue 2 and
// the creator revisions in the export (never an agent, the internal comment, the key, the checksum nor
// a row key); the erasure puts every visual to purging, deletes the statements and the revisions,
// keeps the entries pseudonymous, and leaves no marker in any table. L2G-D13: the three reads of the
// worker serve RG107 only (codes, bands, a score, a boolean), never a column of RG108. Each case runs
// in ONE rolled-back transaction of the local superuser; the approval of a request runs as in
// t8-privacy-execution (2V requested by admin B, confirmed and consumed by admin A).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { OUR_SCHEMAS } from "@influx/test-kit/rights";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { DATA_EXPORT_CATEGORIES } from "../src/domains/privacy/notice.ts";
import {
  actAs,
  actAsInternal,
  actAsMember,
  bindRequestSession,
  letterName,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | undefined;

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");

const NOTICE = {
  language: "en",
  title: "Your data held by INFLUX",
  categories: Object.fromEntries(
    DATA_EXPORT_CATEGORIES.map((key) => [key, `Purpose of ${key}`]),
  ),
};

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[]; count: number }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Attempt> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return {
      outcome: "rows",
      rows: [...result] as Row[],
      count: Math.max(result.count, result.length),
    };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code === undefined) throw error;
    return {
      outcome: "error",
      code: failure.code,
      message: failure.message ?? "",
    };
  }
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.message}`);
  }
  return result.rows;
}

async function rows(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Row[]> {
  return rowsOf(await attempt(tx, statement, parameters));
}

function asCreator<T>(tx: Tx, account: string, fn: () => Promise<T>) {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

function asAgent<T>(tx: Tx, account: string, fn: () => Promise<T>) {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: account, role: "agent", aal: "aal2" },
    fn,
  );
}

function asAdmin<T>(tx: Tx, account: string, fn: () => Promise<T>) {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal: "aal2" },
    fn,
  );
}

// the fixtures (as profiles-creator-decisions: creator a of the data set) ------------------------

const HEADLINE = "Créatrice lifestyle à Rennes, voyages et cuisine";
const BIO =
  "Je partage chaque semaine des recettes de saison, des adresses de voyage et des routines simples. " +
  "Mes abonnés aiment le ton direct et les formats courts, tournés avec soin.";
const STATEMENT_KEY = "creatorProfile.portfolio.brandConsent";

const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

/** Two markers of letters: what the creator and the message carry, what the agent alone writes. */
function markers(): { member: string; internal: string } {
  return {
    member: letterName(randomUUID().slice(0, 8)),
    internal: letterName(randomUUID().slice(0, 8)),
  };
}

async function lineOf(tx: Tx, account: string): Promise<string> {
  const [line] = await tx<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts
     where account_id = ${account} and is_primary`;
  if (line === undefined) throw new Error("no line");
  return line.id;
}

async function deposit(
  tx: Tx,
  account: string,
  count: number,
  replaces?: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = await asCreator(tx, account, async () => {
      const [begun] = await rows(
        tx,
        "select * from profiles.begin_portfolio_upload($1::integer, $2::uuid)",
        [500_000, replaces],
      );
      const item = String(begun?.item_id);
      await rows(
        tx,
        "select * from profiles.store_portfolio_item($1::uuid, 400000, 1080, 1350, $2::text)",
        [item, sha(item)],
      );
      return item;
    });
    ids.push(id);
  }
  return ids;
}

/** Creator a ready to submit (07 RG16, 08 RG16): texts, topic, availability, figures, 3 visuals. */
async function readyProfile(
  tx: Tx,
): Promise<{ line: string; visuals: string[] }> {
  const line = await lineOf(tx, creatorA);
  await asCreator(tx, creatorA, async () => {
    await tx`
      update profiles.creator_public_profiles
         set headline = ${HEADLINE}, bio = ${BIO}, primary_topic_code = 'food',
             availability_band = 'lt_1m'
       where account_id = ${creatorA}`;
    await tx`
      update profiles.creator_social_accounts
         set profile_url = 'https://www.instagram.com/t2_creator_a'
       where id = ${line}`;
    await tx`select profiles.confirm_own_creator_figures(${line}::uuid, 48000, 12, 30)`;
  });
  const visuals = await deposit(tx, creatorA, 3);
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    select ${creatorA}, id, network_code, 'account_verified', 'pending'
      from profiles.creator_social_accounts where id = ${line}
    returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentB}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  await tx`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    select ${creatorA}, id, network_code, ${request?.id ?? null}, 'account_verified', ${agentB},
           now(), 'public_profile', handle
      from profiles.creator_social_accounts where id = ${line}`;
  return { line, visuals };
}

async function submit(tx: Tx): Promise<string> {
  const [submitted] = await asCreator(tx, creatorA, () =>
    rows(tx, "select * from profiles.submit_own_creator_profile()"),
  );
  if (!submitted?.entry_id) throw new Error("not submitted");
  return String(submitted.entry_id);
}

async function tokenOf(tx: Tx, call: string, id: string): Promise<string> {
  const [opened] = await asAgent(tx, agentA, () => rows(tx, call, [id]));
  return String(opened?.review_token);
}

const OPEN_ENTRY = "select * from profiles.open_creator_review_entry($1::uuid)";
const OPEN_ITEM = "select * from profiles.open_portfolio_item($1::uuid)";

async function rejectEntry(
  tx: Tx,
  entry: string,
  message: string,
  comment: string,
): Promise<void> {
  const token = await tokenOf(tx, OPEN_ENTRY, entry);
  await asAgent(tx, agentA, () =>
    rows(
      tx,
      "select * from profiles.reject_creator_review_entry($1::uuid, $2::text, 'other', $3::text, $4::text)",
      [entry, token, message, comment],
    ),
  );
}

async function publishEntry(
  tx: Tx,
  entry: string,
  comment?: string,
): Promise<void> {
  const token = await tokenOf(tx, OPEN_ENTRY, entry);
  await asAgent(tx, agentA, () =>
    rows(
      tx,
      "select * from profiles.publish_creator_review_entry($1::uuid, $2::text, $3::text)",
      [entry, token, comment],
    ),
  );
}

async function approveItem(
  tx: Tx,
  item: string,
  comment?: string,
): Promise<void> {
  const token = await tokenOf(tx, OPEN_ITEM, item);
  await asAgent(tx, agentA, () =>
    rows(
      tx,
      "select * from profiles.approve_portfolio_item($1::uuid, $2::text, $3::text)",
      [item, token, comment],
    ),
  );
}

async function rejectItem(tx: Tx, item: string, reason: string): Promise<void> {
  const token = await tokenOf(tx, OPEN_ITEM, item);
  await asAgent(tx, agentA, () =>
    rows(
      tx,
      "select * from profiles.reject_portfolio_item($1::uuid, $2::text, $3::text, null)",
      [item, token, reason],
    ),
  );
}

type Story = {
  tags: { member: string; internal: string };
  visuals: string[];
  entries: { refused: string; published: string; revision: string };
  caption: string;
  revisedCaption: string;
  revisedHeadline: string;
  message: string;
};

/**
 * The whole life of L2G for creator a: a caption with its statement, a submission refused with a
 * message (`other`), submitted again and published, visual 1 approved, then a headline and a caption
 * revised (a new statement): the open entry of the revision. Every agent comment carries the
 * internal marker, every text of the creator or to him the member marker.
 */
async function story(tx: Tx): Promise<Story> {
  const tags = markers();
  const { visuals } = await readyProfile(tx);
  const first = visuals[0] ?? "";
  const caption = `Collaboration avec une maison de thé ${tags.member}`;
  const revisedCaption = `Collaboration renouvelée ${tags.member}`;
  const revisedHeadline = `Créatrice culinaire ${tags.member} et voyages`;
  const message = `Merci de nous écrire ${tags.member} pour préciser vos contenus.`;
  const comment = `Internal ${tags.internal}`;
  await asCreator(tx, creatorA, () =>
    rows(
      tx,
      "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, true)",
      [first, caption],
    ),
  );
  const refused = await submit(tx);
  await rejectEntry(tx, refused, message, comment);
  const published = await submit(tx);
  await publishEntry(tx, published, comment);
  await approveItem(tx, first, comment);
  const [revised] = await asCreator(tx, creatorA, () =>
    rows(
      tx,
      "select * from profiles.submit_own_creator_revision('creator.headline', null, $1::jsonb)",
      [revisedHeadline],
    ),
  );
  await asCreator(tx, creatorA, () =>
    rows(
      tx,
      "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, true)",
      [first, revisedCaption],
    ),
  );
  return {
    tags,
    visuals,
    entries: { refused, published, revision: String(revised?.entry_id) },
    caption,
    revisedCaption,
    revisedHeadline,
    message,
  };
}

// the rights of the data subject -----------------------------------------------------------------

async function adminSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) throw new Error("no session");
  return row.id;
}

async function execute(
  tx: Tx,
  account: string,
  type: "access" | "erasure",
): Promise<string> {
  // the data set may hold an open request of that type already (one open per type): it is taken
  const [open] = await tx<{ id: string }[]>`
    select id::text from backoffice.data_subject_requests
     where requester_account_id = ${account} and request_type = ${type}::backoffice.data_request_type
       and status <> 'closed'`;
  const [deposited] =
    open === undefined
      ? await tx<{ id: string }[]>`
          insert into backoffice.data_subject_requests (request_type, requester_account_id)
          values (${type}::backoffice.data_request_type, ${account})
          returning id::text`
      : [open];
  const request = String(deposited?.id);
  const payload = JSON.stringify({ request_id: request, request_type: type });
  const [dual] = await asAdmin(tx, adminB, () =>
    rows(
      tx,
      "select backoffice.request_dual_control('privacy.approve_data_request', $1::text::jsonb, $2)::text as id",
      [payload, "request_instructed"],
    ),
  );
  const session = await adminSession(tx, adminA);
  await asAdmin(tx, adminA, async () => {
    await bindRequestSession(tx, session);
    await rows(
      tx,
      "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode",
      [session, String(dual?.id), undefined],
    );
    await rows(
      tx,
      "select backoffice.approve_data_request_execution($1::uuid, $2::uuid, $3::uuid, " +
        "$4::backoffice.data_request_type, $5)",
      [session, String(dual?.id), request, type, "request_instructed"],
    );
  });
  await actAs(tx, "privacy", () =>
    rows(
      tx,
      "select request_type from privacy.execute_request($1::uuid, $2::text::jsonb)",
      [request, type === "access" ? JSON.stringify(NOTICE) : undefined],
    ),
  );
  return request;
}

async function exportOf(tx: Tx, account: string) {
  const request = await execute(tx, account, "access");
  const [stored] = await tx<{ content: string }[]>`
    select content from privacy.data_exports where request_id = ${request}`;
  const content = String(stored?.content);
  const file = JSON.parse(content) as { data: { creator_profile: Row } };
  return { content, profile: file.data.creator_profile };
}

/** The tables of our schemas holding a row whose text carries `tag`, in any column. */
async function tablesCarrying(tx: Tx, tag: string): Promise<string[]> {
  const tables = await tx<{ name: string }[]>`
    select format('%I.%I', n.nspname, c.relname) as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
     order by 1`;
  const found: string[] = [];
  for (const { name } of tables) {
    const [row] = await tx.unsafe<{ hits: number }[]>(
      `select count(*)::int as hits from ${name} t where to_jsonb(t)::text ilike $1`,
      [`%${tag}%`],
    );
    if ((row?.hits ?? 0) > 0) found.push(name);
  }
  return found;
}

const byKey =
  (...keys: string[]) =>
  (left: Row, right: Row) =>
    keys
      .map((key) => String(left[key]).localeCompare(String(right[key])))
      .find((order) => order !== 0) ?? 0;

const instant = expect.stringMatching(/Z$/);

// ---------------------------------------------------------------------------------------------
// L2G-D12: the export
// ---------------------------------------------------------------------------------------------

describe("L2G-D12: the data of L2G in the export (art. 15; fiche invariant 15)", () => {
  it("exports each visual with its statements, each entry of queue 2 and each revision; never an agent, the internal comment, the key, the checksum nor a row key", async () => {
    const outcome = await scenario(async (tx) => {
      const told = await story(tx);
      const declarations = await tx<{ id: string }[]>`
        select id::text from profiles.portfolio_brand_declarations where account_id = ${creatorA}`;
      const [now] = await tx<
        { at: string }[]
      >`select privacy.iso_utc(now()) as at`;
      return {
        told,
        declarations,
        now: now?.at,
        ...(await exportOf(tx, creatorA)),
      };
    });
    const { told, profile, content } = outcome;
    // the entries and revisions of this transaction (the data set holds older ones, exported too)
    const ofNow = (rows: Row[], key: string) =>
      rows.filter((row) => row[key] === outcome.now);
    expect(outcome.now).toEqual(instant);
    expect((profile.review_entries as Row[]).length).toBeGreaterThan(3);
    // the data set holds one purged visual of creator a: exported, its caption gone
    const portfolio = (profile.portfolio as Row[]).filter(
      (visual) => visual.state !== "purged",
    );
    expect(portfolio).toHaveLength(3);
    expect(
      (profile.portfolio as Row[])
        .filter((visual) => visual.state === "purged")
        .map((visual) => visual.caption),
    ).toEqual([null]);
    const first = portfolio.find((visual) => visual.state === "approved");
    expect(first).toEqual({
      state: "approved",
      display_order: 1,
      replacement: false,
      byte_size: 400000,
      width: 1080,
      height: 1350,
      caption: told.caption,
      created_at: instant,
      stored_at: instant,
      decided_at: instant,
      rejection_reason: null,
      withdrawn_at: null,
      purged_at: null,
      brand_declarations: expect.any(Array),
    });
    expect(
      [...(first?.brand_declarations as Row[])].sort(byKey("caption")),
    ).toEqual([
      {
        caption: told.caption,
        statement_key: STATEMENT_KEY,
        declared_at: instant,
      },
      {
        caption: told.revisedCaption,
        statement_key: STATEMENT_KEY,
        declared_at: instant,
      },
    ]);
    expect(
      portfolio
        .filter((visual) => visual !== first)
        .map((visual) => [
          visual.state,
          visual.caption,
          visual.decided_at,
          visual.brand_declarations,
        ]),
    ).toEqual([
      ["pending", null, null, []],
      ["pending", null, null, []],
    ]);
    expect(
      ofNow(profile.review_entries as Row[], "created_at").sort(
        byKey("kind", "state"),
      ),
    ).toEqual([
      {
        kind: "revision",
        state: "open",
        created_at: instant,
        decided_at: null,
        rejection_reason: null,
        member_message: null,
        closed_at: null,
      },
      {
        kind: "submission",
        state: "published",
        created_at: instant,
        decided_at: instant,
        rejection_reason: null,
        member_message: null,
        closed_at: instant,
      },
      {
        kind: "submission",
        state: "rejected",
        created_at: instant,
        decided_at: instant,
        rejection_reason: "other",
        member_message: told.message,
        closed_at: instant,
      },
    ]);
    // EC-L2G-05-2: no row key, no id of a statement in the value of a caption
    expect(ofNow(profile.field_revisions as Row[], "submitted_at")).toEqual([
      {
        field: "creator.headline",
        proposed_value: told.revisedHeadline,
        status: "pending_review",
        submitted_at: instant,
        closed_at: null,
      },
      {
        field: "creator.portfolio_caption",
        proposed_value: { caption: told.revisedCaption },
        status: "pending_review",
        submitted_at: instant,
        closed_at: null,
      },
    ]);
    // never the agent, his comment, the key, the checksum, a visual, a statement or an entry id
    expect(content).toContain(told.tags.member);
    for (const absent of [
      told.tags.internal,
      agentA,
      ...told.visuals,
      ...told.visuals.map((visual) => sha(visual)),
      ...outcome.declarations.map((row) => row.id),
      ...Object.values(told.entries),
    ]) {
      expect(content.includes(absent)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D12: the erasure
// ---------------------------------------------------------------------------------------------

/** The L2G rows of `account`; its visuals among `items` only (the data set holds others). */
async function portfolioStateOf(tx: Tx, account: string, items: string[]) {
  return {
    visuals: await tx<Row[]>`
      select state::text, caption, internal_comment, brand_declaration_id,
             decided_by_account_id::text as decided_by, purge_requested_at is not null as requested
        from profiles.portfolio_items where account_id = ${account} and id = any (${items}::uuid[])
       order by decided_by_account_id nulls last, id`,
    // every visual of the account: what the erasure leaves of them
    texts: await tx<Row[]>`
      select state::text from profiles.portfolio_items
       where account_id = ${account}
         and (caption is not null or internal_comment is not null
              or brand_declaration_id is not null or state not in ('purging', 'purged'))`,
    declarations: await tx<Row[]>`
      select id from profiles.portfolio_brand_declarations where account_id = ${account}`,
    revisions: await tx<Row[]>`
      select id from profiles.creator_field_revisions where account_id = ${account}`,
    // the entries of this transaction (the data set holds an older one)
    entries: await tx<Row[]>`
      select kind::text, state::text, member_message, internal_comment,
             decided_by_account_id::text as decided_by, closed_at is not null as closed
        from profiles.creator_review_entries
       where account_id = ${account} and created_at = now()
       order by kind, state`,
    // every entry of the account still open or holding a text
    entryTexts: await tx<Row[]>`
      select state::text from profiles.creator_review_entries
       where account_id = ${account}
         and (state = 'open' or member_message is not null or internal_comment is not null)`,
  };
}

describe("L2G-D12: the data of L2G in the erasure (04 §9.2; modele -14)", () => {
  it("puts every visual to purging at once, empties captions and comments, deletes the statements and the revisions, keeps the entries pseudonymous (the open one withdrawn)", async () => {
    const outcome = await scenario(async (tx) => {
      const told = await story(tx);
      await execute(tx, creatorA, "erasure");
      return portfolioStateOf(tx, creatorA, told.visuals);
    });
    expect(outcome.texts).toEqual([]);
    // the decision of the approved visual and its decider kept (06 RG6), nothing else of it
    expect(outcome.visuals).toEqual([
      {
        state: "purging",
        caption: null,
        internal_comment: null,
        brand_declaration_id: null,
        decided_by: agentA,
        requested: true,
      },
      ...[1, 2].map(() => ({
        state: "purging",
        caption: null,
        internal_comment: null,
        brand_declaration_id: null,
        decided_by: null,
        requested: true,
      })),
    ]);
    expect(outcome.declarations).toEqual([]);
    expect(outcome.revisions).toEqual([]);
    expect(outcome.entryTexts).toEqual([]);
    expect(outcome.entries).toEqual([
      {
        kind: "revision",
        state: "withdrawn",
        member_message: null,
        internal_comment: null,
        decided_by: null,
        closed: true,
      },
      {
        kind: "submission",
        state: "published",
        member_message: null,
        internal_comment: null,
        decided_by: agentA,
        closed: true,
      },
      {
        kind: "submission",
        state: "rejected",
        member_message: null,
        internal_comment: null,
        decided_by: agentA,
        closed: true,
      },
    ]);
  });

  it("leaves no marker in any table of the base, where it found them before", async () => {
    const outcome = await scenario(async (tx) => {
      const told = await story(tx);
      const before = {
        member: await tablesCarrying(tx, told.tags.member),
        internal: await tablesCarrying(tx, told.tags.internal),
      };
      await execute(tx, creatorA, "erasure");
      return {
        before,
        after: {
          member: await tablesCarrying(tx, told.tags.member),
          internal: await tablesCarrying(tx, told.tags.internal),
        },
      };
    });
    expect(outcome.before.member).toEqual(
      expect.arrayContaining([
        "profiles.creator_field_revisions",
        "profiles.creator_review_entries",
        "profiles.portfolio_brand_declarations",
        "profiles.portfolio_items",
      ]),
    );
    expect(outcome.before.internal).toEqual(
      expect.arrayContaining([
        "profiles.creator_review_entries",
        "profiles.portfolio_items",
      ]),
    );
    expect(outcome.after).toEqual({ member: [], internal: [] });
  });

  it("leaves the visuals, statements and entries of another creator untouched", async () => {
    const outcome = await scenario(async (tx) => {
      await story(tx);
      const [other] = await deposit(tx, creatorB, 1);
      await asCreator(tx, creatorB, () =>
        rows(
          tx,
          "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, true)",
          [other, "Une autre créatrice"],
        ),
      );
      const before = await portfolioStateOf(tx, creatorB, [other ?? ""]);
      await execute(tx, creatorA, "erasure");
      return {
        before,
        after: await portfolioStateOf(tx, creatorB, [other ?? ""]),
      };
    });
    expect(outcome.after).toEqual(outcome.before);
    expect(outcome.after.visuals).toEqual([
      expect.objectContaining({
        state: "pending",
        caption: "Une autre créatrice",
      }),
    ]);
    expect(outcome.after.texts).toEqual([{ state: "pending" }]);
    expect(outcome.after.declarations.length).toBeGreaterThanOrEqual(1);
  });

  it("lets influx_privacy_definer write nothing of an account that is not erased", async () => {
    const outcome = await scenario(async (tx) => {
      const told = await story(tx);
      const before = await portfolioStateOf(tx, creatorA, told.visuals);
      await tx.unsafe("set local role influx_privacy_definer");
      const results = [
        await attempt(
          tx,
          "update profiles.portfolio_items set state = 'purging', caption = null, internal_comment = null, " +
            "brand_declaration_id = null where account_id = $1",
          [creatorA],
        ),
        await attempt(
          tx,
          "delete from profiles.portfolio_brand_declarations where account_id = $1",
          [creatorA],
        ),
        await attempt(
          tx,
          "delete from profiles.creator_field_revisions where account_id = $1",
          [creatorA],
        ),
        await attempt(
          tx,
          "update profiles.creator_review_entries set member_message = null, internal_comment = null " +
            "where account_id = $1 and state <> 'open'",
          [creatorA],
        ),
      ];
      await tx.unsafe("reset role");
      return {
        results,
        before,
        after: await portfolioStateOf(tx, creatorA, told.visuals),
      };
    });
    for (const result of outcome.results) {
      expect(result).toMatchObject({ outcome: "rows", count: 0 });
    }
    expect(outcome.after).toEqual(outcome.before);
    expect(outcome.after.revisions.length).toBeGreaterThanOrEqual(2);
    expect(outcome.after.entryTexts.length).toBeGreaterThanOrEqual(3);
    expect(outcome.after.visuals.map((visual) => visual.state)).toEqual([
      "approved",
      "pending",
      "pending",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D13: the reads of the worker
// ---------------------------------------------------------------------------------------------

const READ_PROFILE_DECISION =
  "select kind, decision, reason_code, member_message, preferred_language " +
  "from leads.read_brevo_creator_profile_decision($1::bigint, $2)";
const READ_PORTFOLIO_DECISION =
  "select decision, reason_code, replacement, deposited_on::text as deposited_on, preferred_language " +
  "from leads.read_brevo_portfolio_decision($1::bigint, $2)";
const READ_ATTRIBUTES =
  "select * from leads.read_creator_profile_attributes($1::bigint, $2)";

/** The pending line of creator a of `event` naming `key` = `id`, put in processing for w1. */
async function inProcessing(
  tx: Tx,
  event: string,
  key: "entry_id" | "item_id",
  id: string,
): Promise<string> {
  const [line] = await tx<{ id: string }[]>`
    update leads.outbox_events
       set status = 'processing', locked_by = 'w1', locked_at = now()
     where subject_key = ${`account:${creatorA}`} and event_type = ${event}
       and payload ->> ${key} = ${id} and status = 'pending'
    returning id::text`;
  if (line === undefined) throw new Error(`no ${event} line`);
  return line.id;
}

/** A contact line of `account` in processing for w1 (`destination`). */
async function contactLine(
  tx: Tx,
  account: string,
  destination = "brevo_contact",
): Promise<string> {
  const [line] = await tx<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status, locked_by,
       locked_at)
    values (gen_random_uuid(), 'lead.updated', ${destination}::leads.outbox_destination,
            ${`account:${account}`}, jsonb_build_object('account_id', ${account}::uuid),
            ${`lead.updated:${randomUUID()}`}, 'processing', 'w1', now())
    returning id::text`;
  return String(line?.id);
}

function asWorker(
  tx: Tx,
  call: string,
  line: string,
  worker = "w1",
): Promise<Attempt> {
  return actAs(tx, "worker", () => attempt(tx, call, [line, worker]));
}

async function accountOf(tx: Tx, account: string) {
  const [row] = await tx<{ language: string; today: string }[]>`
    select preferred_language::text as language,
           (now() at time zone coalesce(timezone, 'UTC'))::date::text as today
      from identity.accounts where id = ${account}`;
  return row;
}

describe("L2G-D13: the reads of the worker serve RG107 only, never RG108 (07 RG99, RG106 to RG110)", () => {
  it("reads the decision of a creator profile: a refused submission with its message, then its publication", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const refused = await submit(tx);
      const message =
        "Merci de nous écrire pour préciser la nature de vos contenus.";
      await rejectEntry(tx, refused, message, "Internal: seen last week.");
      const refusal = rowsOf(
        await asWorker(
          tx,
          READ_PROFILE_DECISION,
          await inProcessing(
            tx,
            "creator_profile.decision",
            "entry_id",
            refused,
          ),
        ),
      );
      const published = await submit(tx);
      await publishEntry(tx, published, "Internal: fine.");
      const publication = rowsOf(
        await asWorker(
          tx,
          READ_PROFILE_DECISION,
          await inProcessing(
            tx,
            "creator_profile.decision",
            "entry_id",
            published,
          ),
        ),
      );
      return {
        message,
        refusal,
        publication,
        account: await accountOf(tx, creatorA),
      };
    });
    expect(outcome.refusal).toEqual([
      {
        kind: "submission",
        decision: "rejected",
        reason_code: "other",
        member_message: outcome.message,
        preferred_language: outcome.account?.language,
      },
    ]);
    expect(outcome.publication).toEqual([
      {
        kind: "submission",
        decision: "published",
        reason_code: null,
        member_message: null,
        preferred_language: outcome.account?.language,
      },
    ]);
  });

  it("reads the decision of a visual: approved, refused with its reason, a replacement, the date of its deposit", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const [first, second] = visuals as [string, string];
      await approveItem(tx, first, "Internal: fine.");
      await rejectItem(tx, second, "watermark");
      const [replacement] = await deposit(tx, creatorA, 1, first);
      await approveItem(tx, replacement ?? "");
      const read = async (item: string) =>
        rowsOf(
          await asWorker(
            tx,
            READ_PORTFOLIO_DECISION,
            await inProcessing(tx, "portfolio.decision", "item_id", item),
          ),
        );
      return {
        approved: await read(first),
        refused: await read(second),
        replaced: await read(replacement ?? ""),
        account: await accountOf(tx, creatorA),
      };
    });
    const language = outcome.account?.language;
    const today = outcome.account?.today;
    // EC-L2G-05-5: the first visual, replaced since (withdrawn), keeps its decision
    expect(outcome.approved).toEqual([
      {
        decision: "approved",
        reason_code: null,
        replacement: false,
        deposited_on: today,
        preferred_language: language,
      },
    ]);
    expect(outcome.refused).toEqual([
      {
        decision: "rejected",
        reason_code: "watermark",
        replacement: false,
        deposited_on: today,
        preferred_language: language,
      },
    ]);
    expect(outcome.replaced).toEqual([
      {
        decision: "approved",
        reason_code: null,
        replacement: true,
        deposited_on: today,
        preferred_language: language,
      },
    ]);
  });

  it("reads the creator attributes of a Brevo contact: codes, bands, the score and the first publication, the listed lines only", async () => {
    const outcome = await scenario(async (tx) => {
      const { line } = await readyProfile(tx);
      const draft = rowsOf(
        await asWorker(tx, READ_ATTRIBUTES, await contactLine(tx, creatorA)),
      );
      await publishEntry(tx, await submit(tx));
      const published = rowsOf(
        await asWorker(tx, READ_ATTRIBUTES, await contactLine(tx, creatorA)),
      );
      const [facts] = await tx<Row[]>`
        select n.audience_band, p.main_audience_country::text as country,
               i.completeness_percent::int as score
          from profiles.creator_public_networks n
          join profiles.creator_public_profiles p on p.account_id = n.account_id
          join profiles.creator_identities i on i.account_id = n.account_id
         where n.social_account_id = ${line}`;
      return { draft, published, facts };
    });
    expect(outcome.draft).toEqual([
      expect.objectContaining({
        profile_status: "draft",
        primary_topic_code: "food",
        network_codes: "",
        main_audience_band: null,
        ever_published: false,
      }),
    ]);
    expect(outcome.facts?.audience_band).toEqual(expect.any(String));
    expect(outcome.published).toEqual([
      {
        profile_status: "published",
        completeness_percent: outcome.facts?.score,
        primary_topic_code: "food",
        network_codes: "instagram",
        main_audience_band: outcome.facts?.audience_band,
        main_audience_country: outcome.facts?.country,
        ever_published: true,
      },
    ]);
  });

  it("never serves a column of RG108: the columns of the reads, the rights of their owner, the values served", async () => {
    const migration = migrationRole();
    const columns = await migration<{ name: string; columns: string[] }[]>`
      select p.proname::text as name,
             array(select n from unnest(p.proargnames, p.proargmodes) as a (n, m)
                    where m = 't') as columns
        from pg_catalog.pg_proc p
       where p.oid in ('leads.read_brevo_creator_profile_decision(bigint, text)'::regprocedure,
                       'leads.read_brevo_portfolio_decision(bigint, text)'::regprocedure,
                       'leads.read_creator_profile_attributes(bigint, text)'::regprocedure)
       order by 1`;
    const rights = await migration<{ name: string }[]>`
      select c.oid::regclass::text || '.' || a.attname as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       where n.nspname = 'profiles'
         and (c.relname like 'creator\\_%' or c.relname like 'portfolio\\_%')
         and pg_catalog.has_column_privilege('influx_leads_definer', c.oid, a.attname,
                                             'SELECT, INSERT, UPDATE, REFERENCES')
       order by 1`;
    expect(columns).toEqual([
      {
        name: "read_brevo_creator_profile_decision",
        columns: [
          "kind",
          "decision",
          "reason_code",
          "member_message",
          "preferred_language",
        ],
      },
      {
        name: "read_brevo_portfolio_decision",
        columns: [
          "decision",
          "reason_code",
          "replacement",
          "deposited_on",
          "preferred_language",
        ],
      },
      {
        name: "read_creator_profile_attributes",
        columns: [
          "profile_status",
          "completeness_percent",
          "primary_topic_code",
          "network_codes",
          "main_audience_band",
          "main_audience_country",
          "ever_published",
        ],
      },
    ]);
    expect(rights.map((row) => row.name)).toEqual([
      "profiles.creator_identities.account_id",
      "profiles.creator_identities.completeness_percent",
      "profiles.creator_public_networks.account_id",
      "profiles.creator_public_networks.audience_band",
      "profiles.creator_public_networks.is_primary",
      "profiles.creator_public_networks.listed_at",
      "profiles.creator_public_networks.network_code",
      "profiles.creator_public_profiles.account_id",
      "profiles.creator_public_profiles.main_audience_country",
      "profiles.creator_public_profiles.primary_topic_code",
      "profiles.creator_public_profiles.published_at",
      "profiles.creator_public_profiles.status",
      "profiles.creator_review_entries.account_id",
      "profiles.creator_review_entries.id",
      "profiles.creator_review_entries.kind",
      "profiles.creator_review_entries.member_message",
      "profiles.creator_review_entries.rejection_reason_code",
      "profiles.creator_review_entries.state",
      "profiles.portfolio_items.account_id",
      "profiles.portfolio_items.decided_at",
      "profiles.portfolio_items.id",
      "profiles.portfolio_items.rejection_reason_code",
      "profiles.portfolio_items.replaces_item_id",
      "profiles.portfolio_items.stored_at",
    ]);
    // the values served for a published creator with a caption: no handle, URL, figure nor caption
    const served = await scenario(async (tx) => {
      const told = await story(tx);
      const [handle] = await tx<{ handle: string; pseudonym: string | null }[]>`
        select handle, pseudonym from profiles.creator_social_accounts
         where account_id = ${creatorA} and is_primary`;
      const read = [
        ...rowsOf(
          await asWorker(tx, READ_ATTRIBUTES, await contactLine(tx, creatorA)),
        ),
        ...rowsOf(
          await asWorker(
            tx,
            READ_PORTFOLIO_DECISION,
            await inProcessing(
              tx,
              "portfolio.decision",
              "item_id",
              told.visuals[0] ?? "",
            ),
          ),
        ),
      ];
      return { told, handle, text: JSON.stringify(read) };
    });
    for (const absent of [
      served.handle?.handle ?? "",
      "instagram.com",
      "48000",
      served.told.tags.member,
      served.told.tags.internal,
    ]) {
      expect(absent).not.toBe("");
      expect(served.text.includes(absent)).toBe(false);
    }
  });

  it("refuses every role but the worker (42501), another worker (55000) and a line of another kind or destination (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      await approveItem(tx, visuals[0] ?? "");
      const line = await inProcessing(
        tx,
        "portfolio.decision",
        "item_id",
        visuals[0] ?? "",
      );
      const contact = await contactLine(tx, creatorA);
      const apollo = await contactLine(tx, creatorA, "apollo_contact");
      const codeOf = (result: Attempt) =>
        result.outcome === "error" ? result.code : "rows";
      const roles: string[] = [];
      for (const call of [
        READ_PROFILE_DECISION,
        READ_PORTFOLIO_DECISION,
        READ_ATTRIBUTES,
      ]) {
        const target = call === READ_ATTRIBUTES ? contact : line;
        roles.push(
          codeOf(
            await asCreator(tx, creatorA, () =>
              attempt(tx, call, [target, "w1"]),
            ),
          ),
          codeOf(
            await asAgent(tx, agentA, () => attempt(tx, call, [target, "w1"])),
          ),
          codeOf(
            await asAdmin(tx, adminA, () => attempt(tx, call, [target, "w1"])),
          ),
          codeOf(
            await actAs(tx, "privacy", () => attempt(tx, call, [target, "w1"])),
          ),
          codeOf(
            await actAs(tx, "auth", () => attempt(tx, call, [target, "w1"])),
          ),
        );
      }
      return {
        roles,
        otherWorker: [
          codeOf(await asWorker(tx, READ_PORTFOLIO_DECISION, line, "w2")),
          codeOf(await asWorker(tx, READ_ATTRIBUTES, contact, "w2")),
          codeOf(await asWorker(tx, READ_PROFILE_DECISION, line, "w2")),
        ],
        otherLine: [
          // a portfolio line read as a profile decision, a contact line as a decision
          codeOf(await asWorker(tx, READ_PROFILE_DECISION, line)),
          codeOf(await asWorker(tx, READ_PORTFOLIO_DECISION, contact)),
          // RG109: Apollo receives nothing more than at Lot 1
          codeOf(await asWorker(tx, READ_ATTRIBUTES, apollo)),
          codeOf(await asWorker(tx, READ_ATTRIBUTES, line)),
        ],
      };
    });
    expect(outcome.roles).toEqual(
      outcome.roles.map(() => INSUFFICIENT_PRIVILEGE),
    );
    expect(outcome.otherWorker).toEqual(
      outcome.otherWorker.map(() => NOT_IN_PREREQUISITE_STATE),
    );
    expect(outcome.otherLine).toEqual(
      outcome.otherLine.map(() => INVALID_PARAMETER),
    );
  });

  it("serves no row once the account is erased, nor for an entry or a visual the line's account does not hold", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      await approveItem(tx, visuals[0] ?? "");
      const entry = await submit(tx);
      await publishEntry(tx, entry);
      const item = await inProcessing(
        tx,
        "portfolio.decision",
        "item_id",
        visuals[0] ?? "",
      );
      const decision = await inProcessing(
        tx,
        "creator_profile.decision",
        "entry_id",
        entry,
      );
      const contact = await contactLine(tx, creatorA);
      const foreign = async (event: string, key: string, id: string) => {
        const [line] = await tx<{ id: string }[]>`
          insert into leads.outbox_events
            (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
             locked_by, locked_at)
          values (gen_random_uuid(), ${event}, 'brevo_transactional', ${`account:${creatorB}`},
                  jsonb_build_object('account_id', ${creatorB}::uuid, ${key}::text, ${id}::uuid,
                                     'email_code', ${event}::text),
                  ${`${event}:${randomUUID()}`}, 'processing', 'w1', now())
          returning id::text`;
        return String(line?.id);
      };
      const others = [
        rowsOf(
          await asWorker(
            tx,
            READ_PORTFOLIO_DECISION,
            await foreign("portfolio.decision", "item_id", visuals[0] ?? ""),
          ),
        ),
        rowsOf(
          await asWorker(
            tx,
            READ_PROFILE_DECISION,
            await foreign("creator_profile.decision", "entry_id", entry),
          ),
        ),
      ];
      const before = [
        rowsOf(await asWorker(tx, READ_PORTFOLIO_DECISION, item)).length,
        rowsOf(await asWorker(tx, READ_PROFILE_DECISION, decision)).length,
        rowsOf(await asWorker(tx, READ_ATTRIBUTES, contact)).length,
      ];
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${creatorA}`;
      const erased = [
        rowsOf(await asWorker(tx, READ_PORTFOLIO_DECISION, item)),
        rowsOf(await asWorker(tx, READ_PROFILE_DECISION, decision)),
        rowsOf(await asWorker(tx, READ_ATTRIBUTES, contact)),
      ];
      return { others, before, erased };
    });
    expect(outcome.others).toEqual([[], []]);
    expect(outcome.before).toEqual([1, 1, 1]);
    expect(outcome.erased).toEqual([[], [], []]);
  });
});
