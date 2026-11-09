// L2F commit 08 — the identifier changes and queue 6, 0233 (jalons/l2f/08.md; l2f/modele.md §1
// points 6, 12, 13, §2, §3 "0233", §4; fiche invariants 7, 8, 12; 08 RG78, CA54; 15 RG27, RG29).
// L2F-D14 an entry opened by a change of handle on a line holding « Compte vérifié », the badge kept,
// both handles kept internally (CA54); D15 « preuve exigée »: to_reconfirm, the public row declared,
// then the reconfirmation by queue 4; « même compte »: the finding written, the badge untouched; D16
// the line deleted: the open entries of queues 5 and 6 withdrawn, the badges left to the task. Each
// case runs in a rolled-back transaction of the local superuser, which writes the fixtures and acts
// as the creator, the agents and the admins exactly as apps/api takes the role.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  IDENTIFIER_CHANGE_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
const LOCK_NOT_AVAILABLE = "55P03";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;
const HANDLE_A = "t2_creator_a";
const NEW_HANDLE = "camille_cuisine_new";
const NEWER_HANDLE = "camille_cuisine_newer";

type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      detail: found.detail,
    };
  }
}

function refused(code: string, detail?: string) {
  return detail === undefined
    ? { outcome: "error", code }
    : { outcome: "error", code, detail };
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

const ROLE_OF: Readonly<Record<string, "agent" | "admin">> = {
  [agentA]: "agent",
  [agentB]: "agent",
  [adminA]: "admin",
  [adminB]: "admin",
};

/** Runs `fn` as the internal account `account` (agent or admin), aal2. */
function asInternal<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  session?: string,
): Promise<T> {
  const role = ROLE_OF[account] ?? "agent";
  return actAsInternal(
    tx,
    role === "admin" ? "influx_admin" : "influx_agent",
    {
      accountId: account,
      role,
      aal: "aal2",
      ...(session === undefined ? {} : { sessionId: session }),
    },
    fn,
  );
}

function asCreator<T>(
  tx: Tx,
  fn: () => Promise<T>,
  account: string = creatorA,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

const OPEN = "select * from verification.open_identifier_change($1::uuid)";
const RELEASE = "select verification.release_identifier_change($1::uuid)";
const EXTEND =
  "select verification.extend_identifier_change_claim($1::uuid) as expires";
const FORCE =
  "select verification.force_release_identifier_change_claim($1::uuid, $2::text) as holder";
const DOSSIER =
  "select * from verification.read_identifier_change_dossier($1::uuid)";
const CONFIRM =
  "select * from verification.confirm_identifier_change($1::uuid, $2::text, $3::text, $4::text)";
const REQUIRE_PROOF =
  "select * from verification.require_identifier_proof($1::uuid, $2::text, $3::text)";
const OPEN_REQUEST = "select * from verification.open_request($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const SUBMIT_DISPUTE =
  "select verification.submit_own_dispute($1::uuid, $2::uuid, $3::text, $4::text) as id";
const REQUEST_REVOCATION =
  "select verification.request_badge_revocation($1::uuid, $2::text, $3::text) as id";
const CONFIRM_2V =
  "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3::text) as mode";
const REVOKE =
  "select verification.revoke_badge($1::uuid, $2::uuid, $3::uuid, $4::text) as mode";

function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function code(): string {
  return `INFLUX-${randomUUID()
    .replace(/[^2-9]/g, "")
    .padEnd(8, "2")
    .slice(0, 8)}`;
}

/** A pending request of creator A on line A, and its code (as the doors of 0222 leave it). */
async function pendingRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
): Promise<{ request: string; code: string }> {
  const ownership = code();
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level, 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${creatorA}, 'network', ${ownership}, now() + interval '7 days')`;
  } else {
    await tx`
      insert into verification.evidence_files
        (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
         activated_at, retention_due_at)
      values (${row.id}, ${creatorA}, 'active', 500000, 400000, 1290, 2796,
              sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  }
  return { request: row.id, code: ownership };
}

/** « Compte vérifié » of line A granted by agent A through queue 4 with `handle`. */
async function grantAccount(
  tx: Tx,
  handle: string = HANDLE_A,
): Promise<Outcome<{ outcome: string; badge_id: string | null }>> {
  const ownership = await pendingRequest(tx, "account_verified");
  const [opened] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN_REQUEST, [
      ownership.request,
    ]),
  );
  return asInternal(tx, agentA, () =>
    run<{ outcome: string; badge_id: string | null }>(tx, GRANT_ACCOUNT, [
      ownership.request,
      opened?.review_token ?? null,
      ownership.code,
      handle,
      null,
      null,
    ]),
  );
}

async function accountBadge(tx: Tx): Promise<string> {
  const granted = await grantAccount(tx);
  const badge =
    granted.outcome === "rows" ? granted.rows[0]?.badge_id : undefined;
  if (badge == null)
    throw new Error(`no account badge: ${JSON.stringify(granted)}`);
  return badge;
}

/**
 * « Audience vérifiée » of line A asked (or `request` again) and opened, then granted by agent A
 * with `handle`.
 */
async function grantAudience(
  tx: Tx,
  handle: string,
  existing?: string,
): Promise<Outcome<{ outcome: string; badge_id: string | null }>> {
  const request =
    existing ?? (await pendingRequest(tx, "audience_verified")).request;
  const [opened] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN_REQUEST, [request]),
  );
  return asInternal(tx, agentA, () =>
    run<{ outcome: string; badge_id: string | null }>(tx, GRANT_AUDIENCE, [
      request,
      opened?.review_token ?? null,
      47_300,
      3,
      250,
      350,
      day(-20),
      day(-1),
      handle,
      null,
    ]),
  );
}

/** Line A declared, then both badges granted by agent A through queue 4 (the public row observed). */
async function observedLineA(
  tx: Tx,
): Promise<{ account: string; audience: string }> {
  await tx`
    update profiles.creator_social_accounts
       set followers_count = 120000, posts_last_30_days = 14, avg_comments_per_post = 35,
           avg_reach_per_post = 12000, engagement_rate_bp = 900
     where id = ${lineA}`;
  const account = await accountBadge(tx);
  const granted = await grantAudience(tx, HANDLE_A);
  const audience =
    granted.outcome === "rows" ? granted.rows[0]?.badge_id : undefined;
  if (audience == null) throw new Error("no audience badge");
  return { account, audience };
}

/** A holding « Compte vérifié » written directly on `line` (an approved request), as 0230 tests do. */
async function directBadge(
  tx: Tx,
  account: string,
  line: string,
  network: string,
  handle: string,
): Promise<string> {
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${account}, ${line}, ${network}, 'account_verified', 'pending')
    returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] = await tx<{ id: string }[]>`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    values (${account}, ${line}, ${network}, ${request?.id ?? null}, 'account_verified',
            ${agentA}, now(), 'public_profile', ${handle})
    returning id::text`;
  if (badge === undefined) throw new Error("no badge");
  return badge.id;
}

/** The creator declares `handle` on his line, through his own role (the path of apps/api). */
function rename(
  tx: Tx,
  handle: string | null,
  line: string = lineA,
  account: string = creatorA,
): Promise<unknown> {
  return asCreator(
    tx,
    () =>
      tx`update profiles.creator_social_accounts set handle = ${handle} where id = ${line}`,
    account,
  );
}

type Entry = {
  id: string;
  state: string;
  badge_id: string;
  previous_handle: string | null;
  new_handle: string | null;
  change_count: number;
  observed_handle: string | null;
  decided_by: string | null;
  withdrawn_cause: string | null;
  claimed_by: string | null;
};

async function entriesOf(tx: Tx, line: string = lineA): Promise<Entry[]> {
  return tx<Entry[]>`
    select id::text, state::text, badge_id::text, previous_handle, new_handle, change_count,
           observed_handle, decided_by_account_id::text as decided_by, withdrawn_cause,
           claimed_by_account_id::text as claimed_by
      from verification.identifier_change_reviews
     where social_account_id = ${line}
       and id <> all (${Object.values(IDENTIFIER_CHANGE_IDS)}::uuid[])
     order by created_at, id`;
}

async function openEntry(tx: Tx, line: string = lineA): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from verification.identifier_change_reviews
     where social_account_id = ${line} and state = 'open'`;
  if (row === undefined) throw new Error("no open entry");
  return row.id;
}

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  review_token: string | null;
};

function open(tx: Tx, account: string, entry: string) {
  return asInternal(tx, account, () => run<Opened>(tx, OPEN, [entry]));
}

async function tokenOf(
  tx: Tx,
  account: string,
  entry: string,
): Promise<string> {
  const opened = await open(tx, account, entry);
  const token =
    opened.outcome === "rows" ? opened.rows[0]?.review_token : undefined;
  if (token == null) throw new Error(`not claimed: ${JSON.stringify(opened)}`);
  return token;
}

async function badgeOf(tx: Tx, badge: string) {
  const [row] = await tx<
    { state: string; handle: string | null; ended: boolean }[]
  >`
    select state::text, observed_handle_at_decision as handle, ended_at is not null as ended
      from verification.badges where id = ${badge}`;
  return row;
}

async function publicSourceOf(tx: Tx): Promise<string | undefined> {
  const [row] = await tx<{ source: string }[]>`
    select figures_source as source from profiles.creator_public_networks
     where social_account_id = ${lineA}`;
  return row?.source;
}

type RegisterLine = {
  code: string;
  actor: string | null;
  payload: Record<string, unknown>;
};

async function registerOf(tx: Tx, subject: string): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type as code, actor_account_id::text as actor, payload
      from audit.audit_events
     where subject_id = ${subject}
     order by seq`;
}

async function outboxMark(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select coalesce(max(id), 0)::text as id from leads.outbox_events`;
  return row?.id ?? "0";
}

async function queueAfter(
  tx: Tx,
  mark: string,
): Promise<{ type: string; key: string; payload: Record<string, unknown> }[]> {
  return tx`
    select event_type as type, idempotency_key as key, payload
      from leads.outbox_events
     where subject_key = ${`account:${creatorA}`} and id > ${mark}::bigint
     order by id`;
}

/** A fresh backoffice session of an internal account: TOTP proven now (0012 trigger). */
async function freshSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp',
            'firefox.linux')
    returning id::text`;
  if (row === undefined) throw new Error("no session");
  return row.id;
}

/** `badge` withdrawn under 2V: asked by agent A, confirmed and executed by admin B. */
async function withdrawn(tx: Tx, badge: string, reason: string) {
  const [asked] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ id: string }[]>(REQUEST_REVOCATION, [badge, reason, null]),
  );
  const request = asked?.id ?? "";
  const confirmSession = await freshSession(tx, adminB);
  await asInternal(
    tx,
    adminB,
    () => tx.unsafe(CONFIRM_2V, [confirmSession, request, null]),
    confirmSession,
  );
  const revokeSession = await freshSession(tx, adminB);
  await asInternal(
    tx,
    adminB,
    () => tx.unsafe(REVOKE, [revokeSession, request, badge, reason]),
    revokeSession,
  );
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// L2F-D14: the entry of queue 6, the badge kept, the handles kept internally (08 RG78, CA54)
// ---------------------------------------------------------------------------------------------

describe("L2F-D14: a changed handle on a verified line opens one entry of queue 6, the badge stays (CA54)", () => {
  it("opens one entry, updates it at each change, keeps the badge, withdraws it on the way back; never a handle in the register; nothing for a case change nor a line without badge", async () => {
    const found = await scenario(async (tx) => {
      const badge = await accountBadge(tx);
      await rename(tx, HANDLE_A.toUpperCase());
      const afterCase = await entriesOf(tx);
      await rename(tx, NEW_HANDLE);
      const first = await entriesOf(tx);
      await rename(tx, NEWER_HANDLE);
      const second = await entriesOf(tx);
      const badgeWhileOpen = await badgeOf(tx, badge);
      const entry = second[0]?.id ?? "";
      const creatorReads = await asCreator(tx, () =>
        run(tx, "select id from verification.identifier_change_reviews"),
      );
      const brandReads = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        () => run(tx, "select id from verification.identifier_change_reviews"),
      );
      await rename(tx, ` @${HANDLE_A}`);
      // line B holds no « Compte vérifié » (its badge of the data set is revoked)
      await rename(tx, "t2_creator_b_new", lineB, creatorB);
      return {
        badge,
        afterCase,
        first,
        second,
        badgeWhileOpen,
        creatorReads,
        brandReads,
        back: await entriesOf(tx),
        lineB: await entriesOf(tx, lineB),
        register: await registerOf(tx, entry),
      };
    });
    expect(found.afterCase).toEqual([]);
    expect(found.first).toMatchObject([
      {
        state: "open",
        badge_id: found.badge,
        previous_handle: HANDLE_A,
        new_handle: NEW_HANDLE,
        change_count: 1,
      },
    ]);
    expect(found.second).toMatchObject([
      {
        id: found.first[0]?.id,
        state: "open",
        previous_handle: HANDLE_A,
        new_handle: NEWER_HANDLE,
        change_count: 2,
      },
    ]);
    // RG78: the badge stays, untouched
    expect(found.badgeWhileOpen).toEqual({
      state: "active",
      handle: HANDLE_A,
      ended: false,
    });
    expect(found.creatorReads).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.brandReads).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.back).toMatchObject([
      {
        state: "withdrawn",
        withdrawn_cause: "reverted",
        new_handle: NEWER_HANDLE,
      },
    ]);
    expect(found.lineB).toEqual([]);
    expect(
      found.register.map((line) => [line.code, line.actor, line.payload]),
    ).toEqual([
      [
        "verification.identifier_changed",
        creatorA,
        { network_code: "instagram", change_count: 1 },
      ],
      [
        "verification.identifier_changed",
        creatorA,
        { network_code: "instagram", change_count: 2 },
      ],
      [
        "verification.identifier_change_withdrawn",
        creatorA,
        { cause: "reverted", badge_id: found.badge },
      ],
    ]);
    // fiche invariant 12: never a handle in the register
    const register = JSON.stringify(found.register);
    expect(register).not.toContain(NEW_HANDLE);
    expect(register).not.toContain(HANDLE_A);
  });

  it("holds the queue rules: an atomic claim, read-only for another agent, the dossier to the holder only, a forced release by an admin alone, nothing on a held account nor for a member", async () => {
    const found = await scenario(async (tx) => {
      await accountBadge(tx);
      await rename(tx, NEW_HANDLE);
      const entry = await openEntry(tx);
      const claimed = await open(tx, agentA, entry);
      const other = await open(tx, agentB, entry);
      const otherDossier = await asInternal(tx, agentB, () =>
        run(tx, DOSSIER, [entry]),
      );
      const dossier = await asInternal(tx, agentA, () =>
        run<{
          previous_handle: string;
          new_handle: string;
          handle: string;
          badge_state: string;
          change_count: number;
          review_token: string;
        }>(tx, DOSSIER, [entry]),
      );
      const extended = await asInternal(tx, agentA, () =>
        run(tx, EXTEND, [entry]),
      );
      const otherRelease = await asInternal(tx, agentB, () =>
        run(tx, RELEASE, [entry]),
      );
      const agentForce = await asInternal(tx, agentB, () =>
        run(tx, FORCE, [entry, "holder_absent"]),
      );
      const adminForce = await asInternal(tx, adminA, () =>
        run<{ holder: string }>(tx, FORCE, [entry, "holder_absent"]),
      );
      const afterForce = await entriesOf(tx);
      await tx`update identity.accounts set owner_agent_id = ${agentB} where id = ${creatorA}`;
      const held = await open(tx, agentB, entry);
      const creatorOpens = await asCreator(tx, () => run(tx, OPEN, [entry]));
      const unknown = await open(tx, agentA, randomUUID());
      return {
        claimed,
        other,
        otherDossier,
        dossier,
        extended: extended.outcome,
        otherRelease,
        agentForce,
        adminForce,
        afterForce,
        held,
        creatorOpens,
        unknown,
      };
    });
    expect(found.claimed).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "claimed", holder_account_id: agentA }],
    });
    expect(found.other).toMatchObject({
      outcome: "rows",
      rows: [
        { outcome: "read_only", holder_account_id: agentA, review_token: null },
      ],
    });
    expect(found.otherDossier).toMatchObject(
      refused(LOCK_NOT_AVAILABLE, agentA),
    );
    const claimedToken =
      found.claimed.outcome === "rows"
        ? found.claimed.rows[0]?.review_token
        : undefined;
    expect(found.dossier).toMatchObject({
      outcome: "rows",
      rows: [
        {
          previous_handle: HANDLE_A,
          new_handle: NEW_HANDLE,
          handle: NEW_HANDLE,
          badge_state: "active",
          change_count: 1,
          review_token: claimedToken,
        },
      ],
    });
    expect(found.extended).toBe("rows");
    expect(found.otherRelease).toMatchObject(
      refused(LOCK_NOT_AVAILABLE, agentA),
    );
    expect(found.agentForce).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.adminForce).toMatchObject({
      outcome: "rows",
      rows: [{ holder: agentA }],
    });
    expect(found.afterForce).toMatchObject([
      { state: "open", claimed_by: null },
    ]);
    expect(found.held).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.creatorOpens).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.unknown).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D15: « même compte » or « preuve exigée », then the reconfirmation by queue 4
// ---------------------------------------------------------------------------------------------

describe("L2F-D15: the agent confirms the same account, or requires a proof (to_reconfirm), then queue 4 gives the state back", () => {
  it("« même compte »: the typed handle must be the declared one, the token the current one; the finding written, the badge untouched, nothing sent; the next change starts from the finding; never on a handle verified elsewhere", async () => {
    const found = await scenario(async (tx) => {
      const badge = await accountBadge(tx);
      await rename(tx, NEW_HANDLE);
      const entry = await openEntry(tx);
      const token = await tokenOf(tx, agentA, entry);
      const mismatch = await asInternal(tx, agentA, () =>
        run(tx, CONFIRM, [entry, token, "someone_else", null]),
      );
      await rename(tx, NEWER_HANDLE);
      const stale = await asInternal(tx, agentA, () =>
        run(tx, CONFIRM, [entry, token, NEWER_HANDLE, null]),
      );
      const fresh = await tokenOf(tx, agentA, entry);
      const mark = await outboxMark(tx);
      const confirmed = await asInternal(tx, agentA, () =>
        run<{ outcome: string; sla_breached: boolean }>(tx, CONFIRM, [
          entry,
          fresh,
          " @Camille_Cuisine_Newer ",
          "Same account, the bio and the posts are unchanged.",
        ]),
      );
      const queue = await queueAfter(tx, mark);
      const row = (await entriesOf(tx))[0];
      const badgeAfter = await badgeOf(tx, badge);
      await rename(tx, "camille_cuisine_third");
      const next = (await entriesOf(tx)).find(
        (entry) => entry.state === "open",
      );
      // creator B holds « Compte vérifié » on "taken_handle" (instagram as line A: edge case l. 800)
      const [lineOfB] = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts
          (account_id, network_code, is_primary, handle, followers_count)
        values (${creatorB}, 'instagram', false, 'taken_handle', 1000)
        returning id::text`;
      await directBadge(
        tx,
        creatorB,
        lineOfB?.id ?? "",
        "instagram",
        "taken_handle",
      );
      await rename(tx, "taken_handle");
      const takenEntry = await openEntry(tx);
      const takenToken = await tokenOf(tx, agentA, takenEntry);
      const taken = await asInternal(tx, agentA, () =>
        run(tx, CONFIRM, [takenEntry, takenToken, "taken_handle", null]),
      );
      return {
        badge,
        entry,
        mismatch,
        stale,
        confirmed,
        queue,
        row,
        badgeAfter,
        next,
        taken,
        register: await registerOf(tx, entry),
      };
    });
    expect(found.mismatch).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "observed_handle_mismatch"),
    );
    expect(found.stale).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token"),
    );
    expect(found.confirmed).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "confirmed", sla_breached: false }],
    });
    expect(found.row).toMatchObject({
      state: "confirmed",
      observed_handle: "@Camille_Cuisine_Newer",
      decided_by: agentA,
      claimed_by: null,
    });
    // EC-L2F-13: the badge is never rewritten; EC-L2F-08-9: nothing is sent
    expect(found.badgeAfter).toEqual({
      state: "active",
      handle: HANDLE_A,
      ended: false,
    });
    expect(found.queue).toEqual([]);
    expect(found.next).toMatchObject({
      state: "open",
      previous_handle: "@Camille_Cuisine_Newer",
      new_handle: "camille_cuisine_third",
    });
    expect(found.taken).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "handle_already_verified"),
    );
    expect(found.register.map((line) => [line.code, line.payload])).toEqual([
      [
        "verification.identifier_changed",
        { network_code: "instagram", change_count: 1 },
      ],
      [
        "queue.entry_opened",
        { queue_code: "identity_change_review", outcome: "claimed" },
      ],
      [
        "verification.identifier_changed",
        { network_code: "instagram", change_count: 2 },
      ],
      [
        "queue.entry_opened",
        { queue_code: "identity_change_review", outcome: "held" },
      ],
      [
        "verification.identifier_confirmed",
        { network_code: "instagram", badge_id: found.badge, late: false },
      ],
    ]);
    expect(JSON.stringify(found.register)).not.toContain("Camille");
  });

  it("« preuve exigée »: no audience while the entry is open; then both badges to_reconfirm, the public row declared, the e-mail and lead.updated queued; a new finding of queue 4 gives both back", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      const observedBefore = await publicSourceOf(tx);
      await rename(tx, NEW_HANDLE);
      const entry = await openEntry(tx);
      const audienceWhileOpen = await grantAudience(tx, NEW_HANDLE);
      const [pendingAudience] = await tx<{ id: string }[]>`
        select id::text from verification.verification_requests
         where social_account_id = ${lineA} and level = 'audience_verified'
           and status = 'pending'`;
      const token = await tokenOf(tx, agentB, entry);
      const mark = await outboxMark(tx);
      const required = await asInternal(tx, agentB, () =>
        run<{
          outcome: string;
          badge_id: string;
          audience_badge_ids: string[];
        }>(tx, REQUIRE_PROOF, [entry, token, null]),
      );
      const queue = await queueAfter(tx, mark);
      const doubted = {
        account: await badgeOf(tx, account),
        audience: await badgeOf(tx, audience),
        source: await publicSourceOf(tx),
        entry: (await entriesOf(tx))[0],
      };
      const audienceInDoubt = await grantAudience(
        tx,
        NEW_HANDLE,
        pendingAudience?.id,
      );
      // the reconfirmation: a new « Compte vérifié » on the new handle, through queue 4
      const reconfirmed = await grantAccount(tx, NEW_HANDLE);
      const newBadge =
        reconfirmed.outcome === "rows"
          ? (reconfirmed.rows[0]?.badge_id ?? "")
          : "";
      return {
        account,
        audience,
        entry,
        observedBefore,
        audienceWhileOpen,
        required,
        queue,
        doubted,
        audienceInDoubt,
        reconfirmed,
        after: {
          old: await badgeOf(tx, account),
          fresh: newBadge === "" ? undefined : await badgeOf(tx, newBadge),
          audience: await badgeOf(tx, audience),
          source: await publicSourceOf(tx),
        },
        entryRegister: await registerOf(tx, entry),
        badgeRegister: newBadge === "" ? [] : await registerOf(tx, newBadge),
      };
    });
    expect(found.observedBefore).toBe("agent_observed");
    expect(found.audienceWhileOpen).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "ownership_prerequisite"),
    );
    expect(found.required).toMatchObject({
      outcome: "rows",
      rows: [
        {
          outcome: "proof_required",
          badge_id: found.account,
          audience_badge_ids: [found.audience],
        },
      ],
    });
    expect(found.doubted.account?.state).toBe("to_reconfirm");
    expect(found.doubted.audience?.state).toBe("to_reconfirm");
    // fiche invariant 2: the public row back to the declared figures
    expect(found.doubted.source).toBe("declared");
    expect(found.doubted.entry).toMatchObject({
      state: "proof_required",
      decided_by: agentB,
      observed_handle: null,
    });
    expect(found.queue.map((line) => [line.type, line.key])).toEqual([
      [
        "verification.reconfirm_required",
        `verification.reconfirm_required:${found.entry}`,
      ],
      ["lead.updated", expect.stringMatching(/^lead\.updated:/)],
    ]);
    expect(Object.keys(found.queue[0]?.payload ?? {}).sort()).toEqual([
      "account_id",
      "email_code",
      "event_id",
      "review_id",
    ]);
    expect(JSON.stringify(found.queue)).not.toContain(NEW_HANDLE);
    // RG12: no audience without an active « Compte vérifié »
    expect(found.audienceInDoubt).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "ownership_prerequisite"),
    );
    expect(found.reconfirmed).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "granted" }],
    });
    expect(found.after.old?.state).toBe("replaced");
    expect(found.after.fresh).toEqual({
      state: "active",
      handle: NEW_HANDLE,
      ended: false,
    });
    // modele point 13: the audience comes back, its expiry still ahead; the public row observed
    expect(found.after.audience?.state).toBe("active");
    expect(found.after.source).toBe("agent_observed");
    expect(
      found.entryRegister
        .filter((line) => line.code.startsWith("verification."))
        .map((line) => [line.code, line.actor, line.payload]),
    ).toEqual([
      [
        "verification.identifier_changed",
        creatorA,
        { network_code: "instagram", change_count: 1 },
      ],
      [
        "verification.identifier_proof_required",
        agentB,
        {
          network_code: "instagram",
          badge_id: found.account,
          audience_badge_ids: [found.audience],
          late: false,
        },
      ],
    ]);
    expect(
      found.badgeRegister.map((line) => [line.code, line.payload]),
    ).toEqual([
      [
        "verification.badge_reconfirmed",
        {
          replaced_badge_id: found.account,
          review_id: found.entry,
          audience_badge_ids: [found.audience],
        },
      ],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D16: the line deleted, the badge ended (modele point 6)
// ---------------------------------------------------------------------------------------------

describe("L2F-D16: a deleted line closes its open entries of queues 5 and 6; an ended badge closes its entry", () => {
  it("withdraws the open entry and the open contest of a deleted line (line_deleted), and leaves its badge to the task", async () => {
    const found = await scenario(async (tx) => {
      const [line] = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts
          (account_id, network_code, is_primary, handle, followers_count)
        values (${creatorA}, 'youtube', false, 'identifier_yt', 1000)
        returning id::text`;
      const lineId = line?.id ?? "";
      const badgeId = await directBadge(
        tx,
        creatorA,
        lineId,
        "youtube",
        "identifier_yt",
      );
      const [refusal] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
           rejection_reason_code)
        values (${creatorA}, ${lineId}, 'youtube', 'audience_verified', 'rejected',
                now() - interval '4 days', now() - interval '3 days',
                now() - interval '3 days' + interval '1 hour',
                now() - interval '3 days' + interval '2 hours', ${agentA},
                now() - interval '2 days', now() - interval '2 days', 'evidence_too_old')
        returning id::text`;
      const [dispute] = await asCreator(tx, () =>
        tx.unsafe<{ id: string }[]>(SUBMIT_DISPUTE, [
          refusal?.id ?? null,
          null,
          "misread",
          null,
        ]),
      );
      await rename(tx, "identifier_yt_new", lineId);
      const entry = await openEntry(tx, lineId);
      await open(tx, agentA, entry);
      await asCreator(
        tx,
        () =>
          tx`delete from profiles.creator_social_accounts where id = ${lineId}`,
      );
      const [contest] = await tx<{ state: string; cause: string | null }[]>`
        select state::text, withdrawn_cause as cause from verification.disputes
         where id = ${dispute?.id ?? null}`;
      return {
        entries: await entriesOf(tx, lineId),
        contest,
        badge: await badgeOf(tx, badgeId),
        entryRegister: await registerOf(tx, entry),
        disputeRegister: await registerOf(tx, dispute?.id ?? ""),
        badgeId,
      };
    });
    expect(found.entries).toMatchObject([
      { state: "withdrawn", withdrawn_cause: "line_deleted", claimed_by: null },
    ]);
    expect(found.contest).toEqual({
      state: "withdrawn",
      cause: "line_deleted",
    });
    // modele point 6: the badge is ended by the task only (0230, cause line_deleted)
    expect(found.badge?.state).toBe("active");
    expect(found.entryRegister.at(-1)).toMatchObject({
      code: "verification.identifier_change_withdrawn",
      actor: creatorA,
      payload: { cause: "line_deleted", badge_id: found.badgeId },
    });
    expect(found.disputeRegister.at(-1)).toMatchObject({
      code: "verification.dispute_withdrawn",
      payload: { cause: "line_deleted" },
    });
  });

  it("withdraws the open entry whose « Compte vérifié » is withdrawn under 2V (badge_ended)", async () => {
    const found = await scenario(async (tx) => {
      const badge = await accountBadge(tx);
      await rename(tx, NEW_HANDLE);
      const entry = await openEntry(tx);
      await withdrawn(tx, badge, "owner_changed");
      return {
        entries: await entriesOf(tx),
        register: await registerOf(tx, entry),
        badge,
      };
    });
    expect(found.entries).toMatchObject([
      { state: "withdrawn", withdrawn_cause: "badge_ended" },
    ]);
    expect(found.register.at(-1)).toMatchObject({
      code: "verification.identifier_change_withdrawn",
      payload: { cause: "badge_ended", badge_id: found.badge },
    });
  });
});
