// L2G commit 04 — the claim and the decisions of queues 2 (creator profiles) and 3 (visuals), 0244
// (jalons/l2g/04.md; l2g/modele.md points 1 to 3, 6, 10, §3 "0244", §4; fiche invariants 5, 7, 8, 10,
// 11, 13; 07 RG4 to RG10, RG77 to RG83, RG93 to RG99; 15 RG27 C1 to C8, RG35, RG36). TM5.5 (base): a
// profile is published by a decision of an agent or an admin only, and no role but its creator and
// the agents reads a visual not approved; L2G-D8 the lock, the version token and the conflict of
// interest on both queues; L2G-D9 the publication, profile.completed once then lead.updated; L2G-D10
// the refusal, its closed reason and message, the submission again; L2G-D11 a visual: one decision,
// a reason of RG79, the replacement, exif_stripped, the statement of RG83 kept. The doors and the
// decisions run in rolled-back transactions of the local superuser, as apps/api calls them.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const LOCK_NOT_AVAILABLE = "55P03";

const creatorA = accountIdOf("creator", "a");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
};
type Parameter = postgres.ParameterOrJSON<never> | undefined;
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...result] as T[] };
  } catch (error) {
    const found = error as { code?: string; message?: string; detail?: string };
    if (found.code === undefined) throw error;
    return {
      outcome: "error",
      code: found.code,
      message: found.message ?? "",
      detail: found.detail,
    };
  }
}

async function rows<T>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<T[]> {
  const found = await run<T>(tx, statement, parameters);
  if (found.outcome === "error") {
    throw new Error(`${found.code} ${found.message} (${found.detail ?? ""})`);
  }
  return found.rows;
}

function refused(code: string, message?: string, detail?: string): unknown {
  return expect.objectContaining({
    outcome: "error",
    code,
    ...(message === undefined ? {} : { message }),
    ...(detail === undefined ? {} : { detail }),
  });
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asCreator<T>(tx: Tx, account: string, fn: () => Promise<T>) {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

function asBrand<T>(tx: Tx, fn: () => Promise<T>) {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brandA, role: "advertiser", aal: "aal1" },
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
) {
  return actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal },
    fn,
  );
}

// the calls --------------------------------------------------------------------------------------

const OPEN_ENTRY = "select * from profiles.open_creator_review_entry($1::uuid)";
const RELEASE_ENTRY = "select profiles.release_creator_review_entry($1::uuid)";
const EXTEND_ENTRY =
  "select profiles.extend_creator_review_claim($1::uuid) as expires";
const FORCE_ENTRY =
  "select profiles.force_release_creator_review_claim($1::uuid, $2::text) as holder";
const PUBLISH =
  "select * from profiles.publish_creator_review_entry($1::uuid, $2::text, $3::text)";
const REJECT_ENTRY =
  "select * from profiles.reject_creator_review_entry($1::uuid, $2::text, $3::text, $4::text, $5::text)";
const READ_ENTRY_ITEM =
  "select * from profiles.read_creator_review_portfolio_item($1::uuid, $2::uuid)";
const OPEN_ITEM = "select * from profiles.open_portfolio_item($1::uuid)";
const RELEASE_ITEM = "select profiles.release_portfolio_item($1::uuid)";
const EXTEND_ITEM =
  "select profiles.extend_portfolio_item_claim($1::uuid) as expires";
const FORCE_ITEM =
  "select profiles.force_release_portfolio_item_claim($1::uuid, $2::text) as holder";
const APPROVE =
  "select * from profiles.approve_portfolio_item($1::uuid, $2::text, $3::text)";
const REJECT_ITEM =
  "select * from profiles.reject_portfolio_item($1::uuid, $2::text, $3::text, $4::text)";
const READ_ITEM =
  "select * from profiles.read_portfolio_item_for_review($1::uuid)";

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  review_token: string | null;
};

async function open(
  tx: Tx,
  who: Internal,
  call: string,
  id: string,
): Promise<Opened> {
  const [opened] = await asInternal(tx, who, () =>
    rows<Opened>(tx, call, [id]),
  );
  if (opened === undefined) throw new Error("no opening");
  return opened;
}

// the fixtures -----------------------------------------------------------------------------------

const HEADLINE = "Créatrice lifestyle à Rennes, voyages et cuisine";
const BIO =
  "Je partage chaque semaine des recettes de saison, des adresses de voyage et des routines simples. " +
  "Mes abonnés aiment le ton direct et les formats courts, tournés avec soin.";
const OTHER_MESSAGE =
  "Merci de nous écrire pour préciser la nature de vos contenus.";

const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

/** The primary line of `account` in the data set. */
async function lineOf(tx: Tx, account: string): Promise<string> {
  const [line] = await tx<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts
     where account_id = ${account} and is_primary`;
  if (line === undefined) throw new Error("no line");
  return line.id;
}

/** `account` deposits `count` visuals through the doors of 0242; their ids. */
async function deposit(
  tx: Tx,
  account: string,
  count: number,
  replaces?: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = await asCreator(tx, account, async () => {
      const [begun] = await rows<{ item_id: string }>(
        tx,
        "select * from profiles.begin_portfolio_upload($1::integer, $2::uuid)",
        [500_000, replaces],
      );
      if (begun === undefined) throw new Error("no deposit");
      await rows(
        tx,
        "select * from profiles.store_portfolio_item($1::uuid, 400000, 1080, 1350, $2::text)",
        [begun.item_id, sha(begun.item_id)],
      );
      return begun.item_id;
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Blocks 1 to 7 of creator a complete (07 RG16, 08 RG16): the texts, the topic, the availability,
 * the URL and the figures of the primary line, three visuals, an active « Compte vérifié » written
 * directly as the decision of 0224 would. Returns the line and the visuals.
 */
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
  await accountBadge(tx, line);
  return { line, visuals };
}

/** An active « Compte vérifié » on `line` of creator a, written as the decision of 0224 would. */
async function accountBadge(tx: Tx, line: string): Promise<void> {
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
}

/** Creator a submits: the open entry of queue 2. */
async function submit(tx: Tx): Promise<string> {
  const [submitted] = await asCreator(tx, creatorA, () =>
    rows<{ entry_id: string | null; missing_fields: string[] }>(
      tx,
      "select * from profiles.submit_own_creator_profile()",
    ),
  );
  if (!submitted?.entry_id) {
    throw new Error(`not submitted: ${submitted?.missing_fields.join(", ")}`);
  }
  return submitted.entry_id;
}

/** A ready profile submitted, opened and published by agent a; the visuals. */
async function published(tx: Tx): Promise<{ line: string; visuals: string[] }> {
  const ready = await readyProfile(tx);
  const entry = await submit(tx);
  const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
  await asInternal(tx, AGENT_A, () =>
    rows(tx, PUBLISH, [entry, opened.review_token, undefined]),
  );
  return ready;
}

async function profileOf(tx: Tx) {
  const [row] = await tx<
    { status: string; published_at: Date | null; headline: string | null }[]
  >`
    select status::text, published_at, headline from profiles.creator_public_profiles
     where account_id = ${creatorA}`;
  return row;
}

async function entryOf(tx: Tx, id: string) {
  const [row] = await tx<
    {
      state: string;
      decided_by: string | null;
      reason: string | null;
      member_message: string | null;
      internal_comment: string | null;
    }[]
  >`
    select state::text, decided_by_account_id::text as decided_by,
           rejection_reason_code as reason, member_message, internal_comment
      from profiles.creator_review_entries where id = ${id}`;
  return row;
}

async function itemOf(tx: Tx, id: string) {
  const [row] = await tx<
    {
      state: string;
      display_order: number | null;
      decided_by: string | null;
      reason: string | null;
      retention_days: number | null;
      brand_declaration_id: string | null;
    }[]
  >`
    select state::text, display_order::int, decided_by_account_id::text as decided_by,
           rejection_reason_code as reason,
           round(extract(epoch from (retention_due_at - now())) / 86400)::int as retention_days,
           brand_declaration_id::text
      from profiles.portfolio_items where id = ${id}`;
  return row;
}

async function outboxOf(tx: Tx) {
  return tx<
    {
      event_type: string;
      destination: string;
      idempotency_key: string;
      payload: Record<string, unknown>;
    }[]
  >`
    select event_type, destination::text, idempotency_key, payload - 'event_id' as payload
      from leads.outbox_events
     where subject_key = ${`account:${creatorA}`} and status = 'pending'
       and created_at >= now()
     order by id`;
}

async function registerOf(tx: Tx, event: string, subject?: string) {
  return tx<
    {
      subject_id: string;
      actor: string | null;
      payload: Record<string, unknown>;
    }[]
  >`
    select subject_id::text, actor_account_id::text as actor,
           payload - 'db_session_user' as payload
      from audit.audit_events
     where event_type = ${event}
       and (${subject ?? null}::uuid is null or subject_id = ${subject ?? null}::uuid)
       and occurred_at >= now()
     order by seq`;
}

async function scoreOf(tx: Tx): Promise<number | undefined> {
  const [row] = await tx<{ score: number }[]>`
    select completeness_percent::int as score from profiles.creator_identities
     where account_id = ${creatorA}`;
  return row?.score;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// TM5.5 (base): a decision publishes, nobody else; a visual not approved reaches no brand
// ---------------------------------------------------------------------------------------------

describe("TM5.5: a creator profile is published by a decision of an agent or an admin only, and no visual not approved reaches a brand (07 RG5, RG78, 03 C(16))", () => {
  it("refuses `published` written by the creator, an agent, an admin and the brand; the decision publishes", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const write = `update profiles.creator_public_profiles set status = 'published'
                      where account_id = '${creatorA}'`;
      const creator = await asCreator(tx, creatorA, () => run(tx, write));
      const brand = await asBrand(tx, () => run(tx, write));
      const agent = await asInternal(tx, AGENT_A, () => run(tx, write));
      const admin = await asInternal(tx, ADMIN_A, () => run(tx, write));
      const before = (await profileOf(tx))?.status;
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const decided = await asInternal(tx, AGENT_A, () =>
        rows(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      return {
        creator,
        brand,
        agent,
        admin,
        before,
        decided,
        after: (await profileOf(tx))?.status,
      };
    });
    for (const attempt of [
      outcome.creator,
      outcome.brand,
      outcome.agent,
      outcome.admin,
    ]) {
      expect(attempt).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    }
    expect(outcome.before).toBe("pending_review");
    expect(outcome.decided).toEqual([
      expect.objectContaining({ first_publication: true, sla_breached: false }),
    ]);
    expect(outcome.after).toBe("published");
  });

  it("serves no visual to the brand, pending nor approved, and lets no member approve one", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await published(tx);
      const [first] = visuals;
      const opened = await open(tx, AGENT_A, OPEN_ITEM, first ?? "");
      await asInternal(tx, AGENT_A, () =>
        rows(tx, APPROVE, [first, opened.review_token, undefined]),
      );
      const brandRead = await asBrand(tx, () =>
        run(tx, "select id from profiles.portfolio_items"),
      );
      const brandDecision = await asBrand(tx, () =>
        run(tx, OPEN_ITEM, [visuals[1]]),
      );
      const creatorApproval = await asCreator(tx, creatorA, () =>
        run(
          tx,
          `update profiles.portfolio_items set state = 'approved' where id = '${visuals[1]}'`,
        ),
      );
      const creatorDecision = await asCreator(tx, creatorA, () =>
        run(tx, OPEN_ITEM, [visuals[1]]),
      );
      return {
        brandRead,
        brandDecision,
        creatorApproval,
        creatorDecision,
        states: await tx<{ state: string }[]>`
          select state::text from profiles.portfolio_items
           where id = any (${visuals}::uuid[]) order by state`,
      };
    });
    expect(outcome.brandRead).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.brandDecision).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.creatorApproval).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.creatorDecision).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.states.map((row) => row.state)).toEqual([
      "approved",
      "pending",
      "pending",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D8: the lock, the version token, the conflict of interest (15 RG27, RG36)
// ---------------------------------------------------------------------------------------------

describe("L2G-D8: one holder decides, on the version he opened, never on an account he holds (07 RG94, 15 C1 to C4, RG36)", () => {
  it("claims at the opening, shows the holder to a second agent read only, keeps the holder's claim, journals each opening", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const first = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const second = await open(tx, AGENT_B, OPEN_ENTRY, entry);
      const again = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const byB = await asInternal(tx, AGENT_B, () =>
        run(tx, PUBLISH, [entry, first.review_token, undefined]),
      );
      return {
        entry,
        first,
        second,
        again,
        byB,
        lines: await registerOf(tx, "queue.entry_opened", entry),
      };
    });
    expect(outcome.first).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentA,
    });
    expect(outcome.first.review_token).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.second).toMatchObject({
      outcome: "read_only",
      holder_account_id: agentA,
      review_token: null,
    });
    expect(outcome.again).toMatchObject({
      outcome: "held",
      review_token: outcome.first.review_token,
    });
    expect(outcome.byB).toEqual(refused(LOCK_NOT_AVAILABLE, undefined, agentA));
    expect(outcome.lines.map((line) => line.payload)).toEqual(
      ["claimed", "read_only", "held"].map((result) => ({
        queue_code: "profiles_creator",
        outcome: result,
      })),
    );
  });

  it("refuses a decision after the release or the expiry (55P03 none), and journals the claim taken over", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await asInternal(tx, AGENT_A, () => rows(tx, RELEASE_ENTRY, [entry]));
      const released = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await tx`
        update profiles.creator_review_entries
           set claimed_at = now() - interval '40 minutes',
               claim_expires_at = now() - interval '10 minutes'
         where id = ${entry}`;
      const expired = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      const takenOver = await open(tx, AGENT_B, OPEN_ENTRY, entry);
      return {
        released,
        expired,
        takenOver,
        releasedLines: await registerOf(tx, "queue.claim_released", entry),
        expiredLines: await registerOf(tx, "queue.claim_expired", entry),
        status: (await profileOf(tx))?.status,
      };
    });
    expect(outcome.released).toEqual(
      refused(LOCK_NOT_AVAILABLE, undefined, "none"),
    );
    expect(outcome.expired).toEqual(
      refused(LOCK_NOT_AVAILABLE, undefined, "none"),
    );
    expect(outcome.takenOver.outcome).toBe("claimed");
    expect(outcome.releasedLines).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          queue_code: "profiles_creator",
          holder_account_id: agentA,
        }),
      }),
    ]);
    expect(outcome.expiredLines).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ holder_account_id: agentA }),
      }),
    ]);
    expect(outcome.status).toBe("pending_review");
  });

  it("refuses a version changed after the opening (55000 stale_token): a visual deposited, a text written", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await deposit(tx, creatorA, 1);
      const afterDeposit = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      const reopened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await asCreator(tx, creatorA, () =>
        rows(
          tx,
          `update profiles.creator_public_profiles set travel_scope = 'international'
            where account_id = '${creatorA}'`,
        ),
      );
      const afterText = await asInternal(tx, AGENT_A, () =>
        run(tx, REJECT_ENTRY, [
          entry,
          reopened.review_token,
          "bio_insufficient",
          undefined,
          undefined,
        ]),
      );
      return { opened, reopened, afterDeposit, afterText };
    });
    expect(outcome.afterDeposit).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
    expect(outcome.reopened.review_token).not.toBe(outcome.opened.review_token);
    expect(outcome.afterText).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
  });

  it("refuses an account the agent holds on both queues (42501, 15 RG36), his release left open", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const item = await open(tx, AGENT_A, OPEN_ITEM, visuals[0] ?? "");
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${creatorA}`;
      return asInternal(tx, AGENT_A, async () => ({
        openEntry: await run(tx, OPEN_ENTRY, [entry]),
        publish: await run(tx, PUBLISH, [
          entry,
          opened.review_token,
          undefined,
        ]),
        reject: await run(tx, REJECT_ENTRY, [
          entry,
          opened.review_token,
          "bio_insufficient",
          undefined,
          undefined,
        ]),
        extend: await run(tx, EXTEND_ENTRY, [entry]),
        readEntry: await run(tx, READ_ENTRY_ITEM, [entry, visuals[0]]),
        openItem: await run(tx, OPEN_ITEM, [visuals[0]]),
        approve: await run(tx, APPROVE, [
          visuals[0],
          item.review_token,
          undefined,
        ]),
        readItem: await run(tx, READ_ITEM, [visuals[0]]),
        release: await run(tx, RELEASE_ENTRY, [entry]),
        releaseItem: await run(tx, RELEASE_ITEM, [visuals[0]]),
      }));
    });
    const { release, releaseItem, ...decisions } = outcome;
    for (const attempt of Object.values(decisions)) {
      expect(attempt).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    }
    expect(release).toMatchObject({ outcome: "rows" });
    expect(releaseItem).toMatchObject({ outcome: "rows" });
  });

  it("answers an unknown entry or visual, an upload, and every act outside an agent or admin in aal2 as 42501 (T14, 07 RG5)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const entry = await submit(tx);
      const [upload] = await asCreator(tx, creatorA, () =>
        rows<{ item_id: string }>(
          tx,
          "select * from profiles.begin_portfolio_upload(1000, null)",
        ),
      );
      const unknown = "00000000-0000-4000-8000-000000000044";
      const calls: [string, Parameter[]][] = [
        [OPEN_ENTRY, [entry]],
        [RELEASE_ENTRY, [entry]],
        [EXTEND_ENTRY, [entry]],
        [FORCE_ENTRY, [entry, "holder_absent"]],
        [PUBLISH, [entry, "x", undefined]],
        [REJECT_ENTRY, [entry, "x", "bio_insufficient", undefined, undefined]],
        [READ_ENTRY_ITEM, [entry, visuals[0]]],
        [OPEN_ITEM, [visuals[0]]],
        [RELEASE_ITEM, [visuals[0]]],
        [EXTEND_ITEM, [visuals[0]]],
        [FORCE_ITEM, [visuals[0], "holder_absent"]],
        [APPROVE, [visuals[0], "x", undefined]],
        [REJECT_ITEM, [visuals[0], "x", "watermark", undefined]],
        [READ_ITEM, [visuals[0]]],
      ];
      const results: Outcome<unknown>[] = [];
      for (const [call, parameters] of calls) {
        results.push(
          await asCreator(tx, creatorA, () => run(tx, call, parameters)),
        );
        results.push(await asBrand(tx, () => run(tx, call, parameters)));
        results.push(
          await asInternal(
            tx,
            AGENT_A,
            () => run(tx, call, parameters),
            "aal1",
          ),
        );
      }
      const strangers = await asInternal(tx, AGENT_A, async () => [
        await run(tx, OPEN_ENTRY, [unknown]),
        await run(tx, OPEN_ITEM, [unknown]),
        await run(tx, OPEN_ITEM, [upload?.item_id]),
        await run(tx, READ_ENTRY_ITEM, [entry, unknown]),
      ]);
      return { results, strangers };
    });
    expect(outcome.results).toHaveLength(42);
    for (const attempt of outcome.results) {
      expect(attempt).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    }
    // an unknown visual of a held entry is looked at only under a live claim: 55P03 first
    for (const attempt of outcome.strangers.slice(0, 3)) {
      expect(attempt).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    }
    expect(outcome.strangers[3]).toEqual(refused(LOCK_NOT_AVAILABLE));
  });

  it("extends the holder's claim, lets an admin lift it with a typed reason, refuses the agent and an untyped reason (15 C3, C4)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const entry = await submit(tx);
      await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await open(tx, AGENT_A, OPEN_ITEM, visuals[0] ?? "");
      const extended = await asInternal(tx, AGENT_A, () =>
        rows<{ expires: Date }>(tx, EXTEND_ENTRY, [entry]),
      );
      const extendedItem = await asInternal(tx, AGENT_A, () =>
        rows<{ expires: Date }>(tx, EXTEND_ITEM, [visuals[0]]),
      );
      const notHolder = await asInternal(tx, AGENT_B, () =>
        run(tx, EXTEND_ENTRY, [entry]),
      );
      const byAgent = await asInternal(tx, AGENT_B, () =>
        run(tx, FORCE_ENTRY, [entry, "holder_absent"]),
      );
      const untyped = await asInternal(tx, ADMIN_A, () =>
        run(tx, FORCE_ITEM, [visuals[0], "because"]),
      );
      const lifted = await asInternal(tx, ADMIN_A, () =>
        rows<{ holder: string }>(tx, FORCE_ENTRY, [entry, "holder_absent"]),
      );
      const liftedItem = await asInternal(tx, ADMIN_A, () =>
        rows<{ holder: string }>(tx, FORCE_ITEM, [visuals[0], "wrong_claim"]),
      );
      const [entryRow] = await tx<
        { holder: string | null; dispossessed: string }[]
      >`
        select claimed_by_account_id::text as holder,
               forced_release_holder_account_id::text as dispossessed
          from profiles.creator_review_entries where id = ${entry}`;
      return {
        extended,
        extendedItem,
        notHolder,
        byAgent,
        untyped,
        lifted,
        liftedItem,
        entryRow,
        forced: await registerOf(tx, "queue.claim_forced_release"),
      };
    });
    expect(outcome.extended[0]?.expires).toBeInstanceOf(Date);
    expect(outcome.extendedItem[0]?.expires).toBeInstanceOf(Date);
    expect(outcome.notHolder).toEqual(
      refused(LOCK_NOT_AVAILABLE, undefined, agentA),
    );
    expect(outcome.byAgent).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.untyped).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(outcome.lifted).toEqual([{ holder: agentA }]);
    expect(outcome.liftedItem).toEqual([{ holder: agentA }]);
    expect(outcome.entryRow).toEqual({ holder: null, dispossessed: agentA });
    expect(outcome.forced.map((line) => line.payload)).toEqual([
      {
        queue_code: "profiles_creator",
        holder_account_id: agentA,
        reason_code: "holder_absent",
      },
      {
        queue_code: "portfolio_moderation",
        holder_account_id: agentA,
        reason_code: "wrong_claim",
      },
    ]);
  });

  it("claims a visual of queue 3, shows it read only to a second agent, refuses a caption changed since the opening", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const item = visuals[0] ?? "";
      const first = await open(tx, AGENT_A, OPEN_ITEM, item);
      const second = await open(tx, AGENT_B, OPEN_ITEM, item);
      await asCreator(tx, creatorA, () =>
        rows(
          tx,
          "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, false)",
          [item, "Un plat de saison"],
        ),
      );
      const stale = await asInternal(tx, AGENT_A, () =>
        run(tx, APPROVE, [item, first.review_token, undefined]),
      );
      return {
        first,
        second,
        stale,
        lines: await registerOf(tx, "queue.entry_opened", item),
        state: (await itemOf(tx, item))?.state,
      };
    });
    expect(outcome.first).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentA,
    });
    expect(outcome.second).toMatchObject({
      outcome: "read_only",
      holder_account_id: agentA,
    });
    expect(outcome.stale).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      { queue_code: "portfolio_moderation", outcome: "claimed" },
      { queue_code: "portfolio_moderation", outcome: "read_only" },
    ]);
    expect(outcome.state).toBe("pending");
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D9: the publication
// ---------------------------------------------------------------------------------------------

describe("L2G-D9: the publication lists the lines, writes published_at once and profile.completed the first time only (07 RG5, RG9, RG106)", () => {
  it("publishes a submission: the lines listed, the entry decided, the decision e-mail, profile.completed, the register, the score", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await tx`
        update profiles.creator_identities set completeness_percent = 1
         where account_id = ${creatorA}`;
      const decided = await asInternal(tx, AGENT_A, () =>
        rows(tx, PUBLISH, [entry, opened.review_token, "Profil cohérent."]),
      );
      return {
        entry,
        decided,
        profile: await profileOf(tx),
        unlisted: await tx`
          select 1 from profiles.creator_public_networks
           where account_id = ${creatorA} and listed_at is null`,
        row: await entryOf(tx, entry),
        outbox: await outboxOf(tx),
        lines: await registerOf(tx, "creator_profile.published", creatorA),
        score: await scoreOf(tx),
      };
    });
    expect(outcome.decided).toEqual([
      expect.objectContaining({ sla_breached: false, first_publication: true }),
    ]);
    expect(outcome.profile?.status).toBe("published");
    expect(outcome.profile?.published_at).toBeInstanceOf(Date);
    expect(outcome.unlisted).toHaveLength(0);
    expect(outcome.row).toMatchObject({
      state: "published",
      decided_by: agentA,
      internal_comment: "Profil cohérent.",
    });
    expect(outcome.outbox).toEqual([
      {
        event_type: "creator_profile.decision",
        destination: "brevo_transactional",
        idempotency_key: `creator_profile.decision:${outcome.entry}`,
        payload: {
          account_id: creatorA,
          entry_id: outcome.entry,
          email_code: "creator_profile.decision",
        },
      },
      ...["brevo_contact", "apollo_contact"].map((destination) => ({
        event_type: "profile.completed",
        destination,
        idempotency_key: `profile.completed:${creatorA}`,
        payload: { account_id: creatorA },
      })),
    ]);
    // fiche invariant 13: codes and ids, never the comment nor a text
    expect(outcome.lines).toEqual([
      {
        subject_id: creatorA,
        actor: agentA,
        payload: {
          entry_id: outcome.entry,
          kind: "submission",
          fields: [],
          late: false,
        },
      },
    ]);
    expect(outcome.score).toBe(84);
  });

  it("publishes a revision: the value applied, published_at kept, lead.updated instead of profile.completed", async () => {
    const outcome = await scenario(async (tx) => {
      await published(tx);
      const firstAt = (await profileOf(tx))?.published_at;
      const [revised] = await asCreator(tx, creatorA, () =>
        rows<{ entry_id: string }>(
          tx,
          "select * from profiles.submit_own_creator_revision('creator.headline', null, $1::jsonb)",
          ["Créatrice culinaire, saisons et voyages"],
        ),
      );
      const entry = revised?.entry_id ?? "";
      const servedMeanwhile = (await profileOf(tx))?.headline;
      const opened = await open(tx, AGENT_B, OPEN_ENTRY, entry);
      const decided = await asInternal(tx, AGENT_B, () =>
        rows(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      return {
        firstAt,
        servedMeanwhile,
        decided,
        profile: await profileOf(tx),
        revisions: await tx<{ status: string }[]>`
          select status::text from profiles.creator_field_revisions
           where creator_review_entry_id = ${entry}`,
        events: (await outboxOf(tx))
          .filter((line) => line.event_type !== "creator_profile.decision")
          .map((line) => [line.event_type, line.destination]),
        lines: await registerOf(tx, "creator_profile.published", creatorA),
      };
    });
    expect(outcome.servedMeanwhile).toBe(HEADLINE);
    expect(outcome.decided).toEqual([
      expect.objectContaining({ first_publication: false }),
    ]);
    expect(outcome.profile).toMatchObject({
      status: "published",
      headline: "Créatrice culinaire, saisons et voyages",
    });
    expect(outcome.profile?.published_at).toEqual(outcome.firstAt);
    expect(outcome.revisions).toEqual([{ status: "approved" }]);
    // the first publication of this transaction wrote profile.completed; the revision, lead.updated
    expect(outcome.events.slice(-2)).toEqual([
      ["lead.updated", "brevo_contact"],
      ["lead.updated", "apollo_contact"],
    ]);
    expect(
      outcome.events.filter(([type]) => type === "profile.completed"),
    ).toHaveLength(2);
    expect(outcome.lines.at(-1)?.payload).toEqual(
      expect.objectContaining({
        kind: "revision",
        fields: ["creator.headline"],
      }),
    );
  });

  it("recontrols the required fields of a submission (23514 portfolio when fewer than 3 visuals are left)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const entry = await submit(tx);
      await asCreator(tx, creatorA, () =>
        rows(tx, "select profiles.remove_own_portfolio_item($1::uuid)", [
          visuals[0],
        ]),
      );
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const decided = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      return { decided, status: (await profileOf(tx))?.status };
    });
    expect(outcome.decided).toEqual(
      refused(CHECK_VIOLATION, undefined, "portfolio"),
    );
    expect(outcome.status).toBe("pending_review");
  });

  it("applies a URL through its guard (23514 off its network), lists a line added, refuses a handle now under « Compte vérifié » (EC-L2G-04-5)", async () => {
    const outcome = await scenario(async (tx) => {
      const { line } = await published(tx);
      const revise = (field: string, row: string, value: unknown) =>
        asCreator(tx, creatorA, () =>
          rows<{ entry_id: string }>(
            tx,
            "select * from profiles.submit_own_creator_revision($1::text, $2::text, $3::jsonb)",
            [field, row, value as Parameter],
          ),
        );
      const [url] = await revise(
        "creator.network_url",
        line,
        "https://example.org/me",
      );
      const entry = url?.entry_id ?? "";
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const offNetwork = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, opened.review_token, undefined]),
      );
      await revise(
        "creator.network_url",
        line,
        "https://www.instagram.com/t2_new",
      );
      const [extra] = await asCreator(tx, creatorA, () =>
        rows<{ id: string }>(
          tx,
          `insert into profiles.creator_social_accounts (account_id, network_code, handle)
           values ('${creatorA}', 'tiktok', 'second_line') returning id::text`,
        ),
      );
      await revise("creator.network_line", extra?.id ?? "", {});
      const reopened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const applied = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, reopened.review_token, undefined]),
      );
      // a handle revision on the line listed now, then a « Compte vérifié » granted on it
      const [handle] = await revise(
        "creator.network_handle",
        extra?.id ?? "",
        "t2_renamed",
      );
      await accountBadge(tx, extra?.id ?? "");
      const handleEntry = handle?.entry_id ?? "";
      const third = await open(tx, AGENT_A, OPEN_ENTRY, handleEntry);
      const verified = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [handleEntry, third.review_token, undefined]),
      );
      const [lineRow] = await tx<
        { url: string; listed: boolean; handle: string }[]
      >`
        select n.profile_url as url,
               (select x.handle from profiles.creator_social_accounts x
                 where x.id = ${extra?.id ?? null}::uuid) as handle,
               (select c.listed_at is not null from profiles.creator_public_networks c
                 where c.social_account_id = ${extra?.id ?? null}::uuid) as listed
          from profiles.creator_social_accounts n where n.id = ${line}`;
      return { offNetwork, applied, verified, lineRow };
    });
    expect(outcome.offNetwork).toEqual(refused(CHECK_VIOLATION));
    expect(outcome.applied).toMatchObject({ outcome: "rows" });
    expect(outcome.lineRow).toMatchObject({
      url: "https://www.instagram.com/t2_new",
      listed: true,
    });
    expect(outcome.lineRow?.handle).not.toBe("t2_renamed");
    expect(outcome.verified).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "verified_handle",
        "creator.network_handle",
      ),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D10: the refusal of a profile
// ---------------------------------------------------------------------------------------------

describe("L2G-D10: a refusal carries a reason of RG96, the message for `other` only; the creator submits again at once (07 RG10, RG96, RG98)", () => {
  it("gives a refused submission back to the creator, who submits again without delay", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const decided = await asInternal(tx, AGENT_A, () =>
        rows(tx, REJECT_ENTRY, [
          entry,
          opened.review_token,
          "bio_insufficient",
          undefined,
          "Bio trop vague.",
        ]),
      );
      const status = (await profileOf(tx))?.status;
      const row = await entryOf(tx, entry);
      const decisionMail = (await outboxOf(tx)).map((line) => line.event_type);
      const lines = await registerOf(tx, "creator_profile.rejected", creatorA);
      const again = await submit(tx);
      return { entry, decided, status, row, decisionMail, lines, again };
    });
    expect(outcome.decided).toEqual([
      expect.objectContaining({ sla_breached: false }),
    ]);
    expect(outcome.status).toBe("rejected");
    expect(outcome.row).toMatchObject({
      state: "rejected",
      decided_by: agentA,
      reason: "bio_insufficient",
      member_message: null,
    });
    expect(outcome.decisionMail).toEqual(["creator_profile.decision"]);
    expect(outcome.lines).toEqual([
      expect.objectContaining({
        payload: {
          entry_id: outcome.entry,
          kind: "submission",
          reason_code: "bio_insufficient",
          late: false,
        },
      }),
    ]);
    expect(outcome.again).not.toBe(outcome.entry);
  });

  it("requires the message for `other` only, 20 to 500 characters, and a reason of the closed list", async () => {
    const outcome = await scenario(async (tx) => {
      await readyProfile(tx);
      const entry = await submit(tx);
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const token = opened.review_token;
      return asInternal(tx, AGENT_A, async () => ({
        unknown: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "too_pretty",
          undefined,
          undefined,
        ]),
        otherMute: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "other",
          undefined,
          undefined,
        ]),
        otherShort: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "other",
          "Trop court.",
          undefined,
        ]),
        fixWithMessage: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "bio_insufficient",
          OTHER_MESSAGE,
          undefined,
        ]),
        longComment: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "bio_insufficient",
          undefined,
          "x".repeat(1001),
        ]),
        other: await run(tx, REJECT_ENTRY, [
          entry,
          token,
          "other",
          OTHER_MESSAGE,
          undefined,
        ]),
        message: (await entryOf(tx, entry))?.member_message,
      }));
    });
    expect(outcome.unknown).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    for (const attempt of [
      outcome.otherMute,
      outcome.otherShort,
      outcome.fixWithMessage,
    ]) {
      expect(attempt).toEqual(
        refused(INVALID_PARAMETER, "member_message", "member_message"),
      );
    }
    expect(outcome.longComment).toEqual(
      refused(INVALID_PARAMETER, "internal_comment", "internal_comment"),
    );
    expect(outcome.other).toMatchObject({ outcome: "rows" });
  });

  it("refuses a revision and leaves the profile published, the validated value served (CA48)", async () => {
    const outcome = await scenario(async (tx) => {
      await published(tx);
      const [revised] = await asCreator(tx, creatorA, () =>
        rows<{ entry_id: string }>(
          tx,
          "select * from profiles.submit_own_creator_revision('creator.headline', null, $1::jsonb)",
          ["Retrouvez-moi sur @t2_creator_a, cuisine"],
        ),
      );
      const entry = revised?.entry_id ?? "";
      const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
      await asInternal(tx, AGENT_A, () =>
        rows(tx, REJECT_ENTRY, [
          entry,
          opened.review_token,
          "identifier_in_text",
          undefined,
          undefined,
        ]),
      );
      return {
        profile: await profileOf(tx),
        revisions: await tx<{ status: string }[]>`
          select status::text from profiles.creator_field_revisions
           where creator_review_entry_id = ${entry}`,
      };
    });
    expect(outcome.profile).toMatchObject({
      status: "published",
      headline: HEADLINE,
    });
    expect(outcome.revisions).toEqual([{ status: "rejected" }]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D11: a visual, one decision
// ---------------------------------------------------------------------------------------------

describe("L2G-D11: a visual is approved, or refused with a reason of RG79; a replacement takes the place of its original (07 RG78 to RG83, RG97)", () => {
  it("approves a visual: the decider, the e-mail, the register; the statement of RG83 kept", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const item = visuals[0] ?? "";
      await asCreator(tx, creatorA, () =>
        rows(
          tx,
          "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, true)",
          [item, "Collaboration avec une maison de thé"],
        ),
      );
      const declaration = (await itemOf(tx, item))?.brand_declaration_id;
      const opened = await open(tx, AGENT_A, OPEN_ITEM, item);
      const decided = await asInternal(tx, AGENT_A, () =>
        rows(tx, APPROVE, [item, opened.review_token, undefined]),
      );
      return {
        item,
        declaration,
        decided,
        row: await itemOf(tx, item),
        statements: await tx`
          select 1 from profiles.portfolio_brand_declarations where id = ${declaration ?? null}`,
        outbox: await outboxOf(tx),
        lines: await registerOf(tx, "portfolio.approved", item),
      };
    });
    expect(outcome.decided).toEqual([
      expect.objectContaining({ sla_breached: false }),
    ]);
    expect(outcome.row).toMatchObject({
      state: "approved",
      decided_by: agentA,
      display_order: 1,
      brand_declaration_id: outcome.declaration,
    });
    expect(outcome.declaration).toBeTruthy();
    expect(outcome.statements).toHaveLength(1);
    expect(outcome.outbox).toEqual([
      {
        event_type: "portfolio.decision",
        destination: "brevo_transactional",
        idempotency_key: `portfolio.decision:${outcome.item}`,
        payload: {
          account_id: creatorA,
          item_id: outcome.item,
          email_code: "portfolio.decision",
        },
      },
    ]);
    expect(outcome.lines).toEqual([
      {
        subject_id: outcome.item,
        actor: agentA,
        payload: { replaces_item_id: null, late: false },
      },
    ]);
  });

  it("refuses a visual with a reason of the grid: its place freed, its object kept 30 days; never `other`", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await published(tx);
      const item = visuals[1] ?? "";
      const scoreBefore = await scoreOf(tx);
      const opened = await open(tx, AGENT_A, OPEN_ITEM, item);
      const other = await asInternal(tx, AGENT_A, () =>
        run(tx, REJECT_ITEM, [item, opened.review_token, "other", undefined]),
      );
      const decided = await asInternal(tx, AGENT_A, () =>
        rows(tx, REJECT_ITEM, [
          item,
          opened.review_token,
          "handle_in_image",
          undefined,
        ]),
      );
      return {
        other,
        decided,
        scoreBefore,
        score: await scoreOf(tx),
        row: await itemOf(tx, item),
        events: (await outboxOf(tx)).map((line) => [
          line.event_type,
          line.destination,
        ]),
        lines: await registerOf(tx, "portfolio.rejected", item),
      };
    });
    expect(outcome.other).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(outcome.row).toMatchObject({
      state: "rejected",
      reason: "handle_in_image",
      display_order: null,
      retention_days: 30,
    });
    // RG88: three deposited became two; the published profile's score left Brevo (EC-L2G-04-7)
    expect(outcome.scoreBefore).toBe(84);
    expect(outcome.score).toBe(78);
    expect(outcome.events).toEqual(
      expect.arrayContaining([
        ["portfolio.decision", "brevo_transactional"],
        ["lead.updated", "brevo_contact"],
        ["lead.updated", "apollo_contact"],
      ]),
    );
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      { reason_code: "handle_in_image", replaces_item_id: null, late: false },
    ]);
  });

  it("serves the original until its replacement is approved, then gives the replacement its place (RG81, CA44); a refused replacement leaves it", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const [original = "", second = ""] = visuals;
      for (const item of [original, second]) {
        const opened = await open(tx, AGENT_A, OPEN_ITEM, item);
        await asInternal(tx, AGENT_A, () =>
          rows(tx, APPROVE, [item, opened.review_token, undefined]),
        );
      }
      const placeOf = async (id: string) =>
        (await itemOf(tx, id))?.display_order;
      const originalPlace = await placeOf(original);
      const [refusedOne = ""] = await deposit(tx, creatorA, 1, second);
      const openedRefused = await open(tx, AGENT_B, OPEN_ITEM, refusedOne);
      await asInternal(tx, AGENT_B, () =>
        rows(tx, REJECT_ITEM, [
          refusedOne,
          openedRefused.review_token,
          "watermark",
          undefined,
        ]),
      );
      const [replacement = ""] = await deposit(tx, creatorA, 1, original);
      const meanwhile = await itemOf(tx, original);
      const opened = await open(tx, AGENT_B, OPEN_ITEM, replacement);
      await asInternal(tx, AGENT_B, () =>
        rows(tx, APPROVE, [replacement, opened.review_token, undefined]),
      );
      return {
        originalPlace,
        meanwhile,
        original: await itemOf(tx, original),
        replacement: await itemOf(tx, replacement),
        second: await itemOf(tx, second),
        refusedOne: await itemOf(tx, refusedOne),
        lines: await registerOf(tx, "portfolio.approved", replacement),
      };
    });
    expect(outcome.meanwhile).toMatchObject({ state: "approved" });
    expect(outcome.original).toMatchObject({
      state: "withdrawn",
      display_order: null,
      retention_days: 30,
    });
    expect(outcome.replacement).toMatchObject({
      state: "approved",
      display_order: outcome.originalPlace,
    });
    expect(outcome.second).toMatchObject({ state: "approved" });
    expect(outcome.refusedOne).toMatchObject({ state: "rejected" });
    expect(outcome.lines[0]?.payload).toEqual(
      expect.objectContaining({ replaces_item_id: expect.any(String) }),
    );
  });

  it("refuses an approval without exif_stripped (23514, T9.10, RG80)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const item = visuals[0] ?? "";
      await tx`update profiles.portfolio_items set exif_stripped = false where id = ${item}`;
      const opened = await open(tx, AGENT_A, OPEN_ITEM, item);
      const approved = await asInternal(tx, AGENT_A, () =>
        run(tx, APPROVE, [item, opened.review_token, undefined]),
      );
      return { approved, state: (await itemOf(tx, item))?.state };
    });
    expect(outcome.approved).toEqual(refused(CHECK_VIOLATION));
    expect(outcome.state).toBe("pending");
  });

  it("hands the key of a visual to the holder of a live claim only, each read journalled (modele point 10)", async () => {
    const outcome = await scenario(async (tx) => {
      const { visuals } = await readyProfile(tx);
      const item = visuals[0] ?? "";
      const entry = await submit(tx);
      const beforeClaim = await asInternal(tx, AGENT_A, () =>
        run(tx, READ_ITEM, [item]),
      );
      await open(tx, AGENT_A, OPEN_ITEM, item);
      await open(tx, AGENT_A, OPEN_ENTRY, entry);
      const notHolder = await asInternal(tx, AGENT_B, () =>
        run(tx, READ_ITEM, [item]),
      );
      const read = await asInternal(tx, AGENT_A, () =>
        rows<{ state: string; object_key: string }>(tx, READ_ITEM, [item]),
      );
      const readFromEntry = await asInternal(tx, AGENT_A, () =>
        rows<{ state: string; object_key: string }>(tx, READ_ENTRY_ITEM, [
          entry,
          visuals[1],
        ]),
      );
      return {
        item,
        entry,
        beforeClaim,
        notHolder,
        read,
        readFromEntry,
        lines: await registerOf(tx, "queue.portfolio_read"),
      };
    });
    expect(outcome.beforeClaim).toEqual(
      refused(LOCK_NOT_AVAILABLE, undefined, "none"),
    );
    expect(outcome.notHolder).toEqual(
      refused(LOCK_NOT_AVAILABLE, undefined, agentA),
    );
    expect(outcome.read).toEqual([
      expect.objectContaining({
        state: "pending",
        object_key: `${creatorA}/${outcome.item}.webp`,
      }),
    ]);
    expect(outcome.readFromEntry[0]?.state).toBe("pending");
    // never the key in the register
    expect(outcome.lines).toEqual([
      {
        subject_id: outcome.item,
        actor: agentA,
        payload: {
          queue_code: "portfolio_moderation",
          item_id: outcome.item,
          state: "pending",
        },
      },
      expect.objectContaining({
        subject_id: outcome.entry,
        payload: expect.objectContaining({ queue_code: "profiles_creator" }),
      }),
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L3A-T1 (0301, L2GS-8): a publication needs an active account; the other acts stay possible
// ---------------------------------------------------------------------------------------------

/** Account of creator a put out of `active`, as the backoffice or the erasure would. */
async function leaveActive(tx: Tx, status: "suspended" | "deleted") {
  await (status === "suspended"
    ? tx`update identity.accounts set status = 'suspended', suspended_at = now()
          where id = ${creatorA}`
    : tx`update identity.accounts set status = 'deleted', deleted_at = now()
          where id = ${creatorA}`);
}

/** A ready profile submitted and opened by agent a, then its account out of `active`. */
async function openedThenLeft(
  tx: Tx,
  status: "suspended" | "deleted",
): Promise<{ entry: string; token: string | null }> {
  await readyProfile(tx);
  const entry = await submit(tx);
  const opened = await open(tx, AGENT_A, OPEN_ENTRY, entry);
  await leaveActive(tx, status);
  return { entry, token: opened.review_token };
}

describe("L3A-T1, L2GS-8: no publication of an account that is not active; the refusal, the release and the extension stay possible (fiche L3A invariant 4)", () => {
  it("L3A-T1.1 refuses to publish a suspended account (55000 account_not_active, DETAIL profile_state), nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const { entry, token } = await openedThenLeft(tx, "suspended");
      const attempt = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, token, undefined]),
      );
      return {
        attempt,
        status: (await profileOf(tx))?.status,
        state: (await entryOf(tx, entry))?.state,
        mails: await outboxOf(tx),
        lines: await registerOf(tx, "creator_profile.published", creatorA),
      };
    });
    expect(outcome.attempt).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "account_not_active", "profile_state"),
    );
    expect(outcome.status).toBe("pending_review");
    expect(outcome.state).toBe("open");
    expect(outcome.mails).toEqual([]);
    expect(outcome.lines).toEqual([]);
  });

  it("L3A-T1.2 refuses to publish a deleted account, an admin as an agent (55000 account_not_active)", async () => {
    const outcome = await scenario(async (tx) => {
      const { entry, token } = await openedThenLeft(tx, "deleted");
      const agent = await asInternal(tx, AGENT_A, () =>
        run(tx, PUBLISH, [entry, token, undefined]),
      );
      await asInternal(tx, AGENT_A, () => rows(tx, RELEASE_ENTRY, [entry]));
      const reopened = await open(tx, ADMIN_A, OPEN_ENTRY, entry);
      const admin = await asInternal(tx, ADMIN_A, () =>
        run(tx, PUBLISH, [entry, reopened.review_token, undefined]),
      );
      return { agent, admin, status: (await profileOf(tx))?.status };
    });
    for (const attempt of [outcome.agent, outcome.admin]) {
      expect(attempt).toEqual(
        refused(
          NOT_IN_PREREQUISITE_STATE,
          "account_not_active",
          "profile_state",
        ),
      );
    }
    expect(outcome.status).toBe("pending_review");
  });

  it("L3A-T1.3 releases, extends and refuses an entry of a suspended account", async () => {
    const outcome = await scenario(async (tx) => {
      const { entry } = await openedThenLeft(tx, "suspended");
      const extended = await asInternal(tx, AGENT_A, () =>
        run(tx, EXTEND_ENTRY, [entry]),
      );
      const released = await asInternal(tx, AGENT_A, () =>
        run(tx, RELEASE_ENTRY, [entry]),
      );
      const reopened = await open(tx, AGENT_B, OPEN_ENTRY, entry);
      const decided = await asInternal(tx, AGENT_B, () =>
        run(tx, REJECT_ENTRY, [
          entry,
          reopened.review_token,
          "bio_insufficient",
          undefined,
          undefined,
        ]),
      );
      return {
        extended,
        released,
        reopened: reopened.outcome,
        decided,
        row: await entryOf(tx, entry),
        status: (await profileOf(tx))?.status,
      };
    });
    expect(outcome.extended).toMatchObject({ outcome: "rows" });
    expect(outcome.released).toMatchObject({ outcome: "rows" });
    expect(outcome.reopened).toBe("claimed");
    expect(outcome.decided).toMatchObject({ outcome: "rows" });
    expect(outcome.row).toMatchObject({
      state: "rejected",
      decided_by: agentB,
      reason: "bio_insufficient",
    });
    expect(outcome.status).toBe("rejected");
  });
});
