// L2F commit 07 — the contests of a refusal or a withdrawal and queue 5, 0232 (jalons/l2f/07.md;
// l2f/modele.md §1 points 7 to 10, §2, §3 "0232", §4; l2f/textes.md « Contestation », « Issue »;
// fiche invariants 6, 8, 10, 12; 08 RG77, CA52, CA53; 15 RG27 C1 to C8, RG29). L2F-D11 a contest
// within 30 days accepted, at 31 refused, one per decision (CA52); D12 the decider refused while the
// team counts another person, 24 h for a single team; D13 overturned: a new date of decision (CA53);
// the double claim of the queue. Each case runs in a rolled-back transaction of the local superuser,
// which writes the fixtures and acts as the creator, the agents and the admins exactly as apps/api
// takes the role.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
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
const HANDLE_A = "t2_creator_a";

const TEXT = "The capture shows the native dashboard of my own account.";
const MESSAGE =
  "Your capture did not show the period required by the instructions.";

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

const SUBMIT =
  "select verification.submit_own_dispute($1::uuid, $2::uuid, $3::text, $4::text) as id";
const OPEN = "select * from verification.open_dispute($1::uuid)";
const RELEASE = "select verification.release_dispute($1::uuid)";
const EXTEND = "select verification.extend_dispute_claim($1::uuid) as expires";
const FORCE =
  "select verification.force_release_dispute_claim($1::uuid, $2::text) as holder";
const DOSSIER = "select * from verification.read_dispute_dossier($1::uuid)";
const EVIDENCE =
  "select verification.read_dispute_evidence($1::uuid, $2::uuid) as key";
const UPHOLD =
  "select * from verification.uphold_dispute($1::uuid, $2::text, $3::text, $4::text, $5::text)";
const OVERTURN_ACCOUNT =
  "select * from verification.overturn_refusal_account($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const OVERTURN_AUDIENCE =
  "select * from verification.overturn_refusal_audience($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const OVERTURN_REVOCATION =
  "select * from verification.overturn_revocation($1::uuid, $2::text, $3::text, $4::text)";
const OPEN_REQUEST = "select * from verification.open_request($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const REQUEST_REVOCATION =
  "select verification.request_badge_revocation($1::uuid, $2::text, $3::text) as id";
const CONFIRM =
  "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3::text) as mode";
const REVOKE =
  "select verification.revoke_badge($1::uuid, $2::uuid, $3::uuid, $4::text) as mode";
const ACCOUNT_BADGES =
  "select * from verification.read_account_badges($1::uuid)";

function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function code(): string {
  return `INFLUX-${randomUUID()
    .replace(/[^2-9]/g, "")
    .padEnd(8, "2")
    .slice(0, 8)}`;
}

/**
 * A request of creator A on line A refused `daysAgo` days ago by `decider`, as reject_request()
 * leaves it; an account request keeps its live code, an audience request one evidence row.
 */
async function refusedRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
  daysAgo: number,
  options: { decider?: string; evidence?: "active" | "purged" } = {},
): Promise<{ request: string; code: string; evidence: string | null }> {
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
       rejection_reason_code)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level, 'rejected',
            now() - make_interval(days => ${daysAgo + 2}),
            now() - make_interval(days => ${daysAgo + 1}),
            now() - make_interval(days => ${daysAgo + 1}) + interval '1 hour',
            now() - make_interval(days => ${daysAgo + 1}) + interval '2 hours',
            ${options.decider ?? agentA}, now() - make_interval(days => ${daysAgo}),
            now() - make_interval(days => ${daysAgo}),
            ${level === "account_verified" ? "ownership_not_proven" : "evidence_too_old"})
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  const ownership = code();
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${creatorA}, 'network', ${ownership}, now() + interval '7 days')`;
  }
  let evidence: string | null = null;
  if (options.evidence !== undefined) {
    const purged = options.evidence === "purged";
    const [file] = await tx<{ id: string }[]>`
      insert into verification.evidence_files
        (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
         activated_at, retention_due_at, purge_requested_at, deleted_at)
      values (${row.id}, ${creatorA}, ${options.evidence}::verification.evidence_state, 500000,
              400000, 1290, 2796, sha256(${randomUUID()}::bytea),
              now() - make_interval(days => ${daysAgo + 1}), now() + interval '30 days',
              ${purged ? new Date() : null}, ${purged ? new Date() : null})
      returning id::text`;
    evidence = file?.id ?? null;
  }
  return { request: row.id, code: ownership, evidence };
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
  }
  return { request: row.id, code: ownership };
}

/** « Compte vérifié » of line A granted by agent A through queue 4. */
async function accountBadge(tx: Tx): Promise<string> {
  const ownership = await pendingRequest(tx, "account_verified");
  const [opened] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN_REQUEST, [
      ownership.request,
    ]),
  );
  const [granted] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ badge_id: string | null }[]>(GRANT_ACCOUNT, [
      ownership.request,
      opened?.review_token ?? null,
      ownership.code,
      HANDLE_A,
      null,
      null,
    ]),
  );
  if (granted?.badge_id == null) throw new Error("no account badge");
  return granted.badge_id;
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
  const { request } = await pendingRequest(tx, "audience_verified");
  await tx`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${request}, ${creatorA}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  const [opened] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN_REQUEST, [request]),
  );
  const [audience] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ badge_id: string | null }[]>(GRANT_AUDIENCE, [
      request,
      opened?.review_token ?? null,
      47_300,
      3,
      250,
      350,
      day(-20),
      day(-1),
      HANDLE_A,
      null,
    ]),
  );
  if (audience?.badge_id == null) throw new Error("no audience badge");
  return { account, audience: audience.badge_id };
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
async function withdrawn(
  tx: Tx,
  badge: string,
  reason: string,
): Promise<string> {
  const [asked] = await asInternal(tx, agentA, () =>
    tx.unsafe<{ id: string }[]>(REQUEST_REVOCATION, [badge, reason, null]),
  );
  const request = asked?.id ?? "";
  const confirmSession = await freshSession(tx, adminB);
  await asInternal(
    tx,
    adminB,
    () => tx.unsafe(CONFIRM, [confirmSession, request, null]),
    confirmSession,
  );
  const revokeSession = await freshSession(tx, adminB);
  await asInternal(
    tx,
    adminB,
    () => tx.unsafe(REVOKE, [revokeSession, request, badge, reason]),
    revokeSession,
  );
  return request;
}

/** Creator A contests; returns the outcome of the door. */
function submit(
  tx: Tx,
  target: { request?: string; badge?: string },
  reason = "misread",
  text: string | null = null,
  account: string = creatorA,
): Promise<Outcome<{ id: string }>> {
  return asCreator(
    tx,
    () =>
      run<{ id: string }>(tx, SUBMIT, [
        target.request ?? null,
        target.badge ?? null,
        reason,
        text,
      ]),
    account,
  );
}

async function submitted(
  tx: Tx,
  target: { request?: string; badge?: string },
  reason = "misread",
  text: string | null = null,
): Promise<string> {
  const found = await submit(tx, target, reason, text);
  if (found.outcome !== "rows" || found.rows[0] === undefined) {
    throw new Error(`not submitted: ${JSON.stringify(found)}`);
  }
  return found.rows[0].id;
}

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  review_token: string | null;
};

function open(tx: Tx, account: string, dispute: string) {
  return asInternal(tx, account, () => run<Opened>(tx, OPEN, [dispute]));
}

async function tokenOf(
  tx: Tx,
  account: string,
  dispute: string,
): Promise<string> {
  const opened = await open(tx, account, dispute);
  const token =
    opened.outcome === "rows" ? opened.rows[0]?.review_token : undefined;
  if (token == null) throw new Error(`not claimed: ${JSON.stringify(opened)}`);
  return token;
}

/** Deactivates every internal profile but `account`'s (a team of one person). */
async function aloneIn(tx: Tx, account: string): Promise<void> {
  await tx`
    update identity.agent_profiles
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${account}
     where account_id <> ${account} and is_active`;
}

/** Moves the submission of a contest back (its trigger freezes it: disabled here). */
async function ageDispute(tx: Tx, dispute: string, hours: number) {
  await tx`alter table verification.disputes disable trigger disputes_prepare`;
  await tx`
    update verification.disputes
       set submitted_at = submitted_at - make_interval(hours => ${hours})
     where id = ${dispute}`;
  await tx`alter table verification.disputes enable trigger disputes_prepare`;
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

async function disputeOf(tx: Tx, dispute: string) {
  const [row] = await tx<
    {
      state: string;
      review_mode: string | null;
      outcome_reason_code: string | null;
      withdrawn_cause: string | null;
      claimed_by: string | null;
      deciders: string[];
    }[]
  >`
    select state::text, review_mode, outcome_reason_code, withdrawn_cause,
           claimed_by_account_id::text as claimed_by,
           original_decider_ids::text[] as deciders
      from verification.disputes where id = ${dispute}`;
  return row;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// L2F-D11: within 30 days of the notification, once per decision (08 RG77, CA52)
// ---------------------------------------------------------------------------------------------

describe("L2F-D11: a creator contests a refusal or a withdrawal within 30 days, once per decision (CA52)", () => {
  it("accepts a refusal notified 10 days ago (journalled, acknowledged), refuses it twice, at 31 days (closing date), and accepts at 30 days", async () => {
    const found = await scenario(async (tx) => {
      const tenDays = await refusedRequest(tx, "account_verified", 10);
      const mark = await outboxMark(tx);
      const accepted = await submit(
        tx,
        { request: tenDays.request },
        "other",
        TEXT,
      );
      const dispute =
        accepted.outcome === "rows" ? (accepted.rows[0]?.id ?? "") : "";
      const queue = await queueAfter(tx, mark);
      const again = await submit(tx, { request: tenDays.request });
      const late = await refusedRequest(tx, "audience_verified", 31);
      const tooLate = await submit(tx, { request: late.request });
      const [deadline] = await tx<{ at: string }[]>`
        select to_char((decided_at + interval '30 days') at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
          from verification.verification_requests where id = ${late.request}`;
      // 30 days minus a minute: still open
      await tx`
        update verification.verification_requests
           set decided_at = now() - interval '30 days' + interval '1 minute',
               closed_at  = now() - interval '30 days' + interval '1 minute'
         where id = ${late.request}`;
      const thirtyDays = await submit(tx, { request: late.request });
      return {
        accepted: accepted.outcome,
        row: await disputeOf(tx, dispute),
        register: await registerOf(tx, dispute),
        queue,
        again,
        tooLate,
        deadline: deadline?.at,
        thirtyDays: thirtyDays.outcome,
        dispute,
      };
    });
    expect(found.accepted).toBe("rows");
    expect(found.row).toMatchObject({
      state: "open",
      review_mode: null,
      claimed_by: null,
      deciders: [agentA],
    });
    expect(
      found.register.map((line) => [line.code, line.actor, line.payload]),
    ).toEqual([
      [
        "verification.dispute_submitted",
        creatorA,
        expect.objectContaining({
          level: "account_verified",
          reason_code: "other",
          badge_id: null,
        }),
      ],
    ]);
    // fiche invariant 12: never the text of the creator in the register nor the queue
    expect(JSON.stringify(found.register)).not.toContain(TEXT);
    expect(found.queue.map((line) => [line.type, line.key])).toEqual([
      [
        "verification.dispute_received",
        `verification.dispute_received:${found.dispute}`,
      ],
    ]);
    expect(Object.keys(found.queue[0]?.payload ?? {}).sort()).toEqual([
      "account_id",
      "dispute_id",
      "email_code",
      "event_id",
    ]);
    expect(JSON.stringify(found.queue)).not.toContain(TEXT);
    expect(found.again).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "already_disputed"),
    );
    expect(found.tooLate).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, found.deadline),
    );
    expect(found.thirtyDays).toBe("rows");
  });

  it("refuses what is not a contestable decision of the caller: another's, unknown, approved, closed, the audience carried along; a reason outside the list, `other` without text; the brand never executes", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 5);
      const [approved] = await tx<{ id: string }[]>`
        select id::text from verification.verification_requests
         where account_id = ${creatorA} and status = 'approved' limit 1`;
      const [closedRequest] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
           rejection_reason_code)
        values (${creatorA}, ${lineA}, 'instagram', 'audience_verified', 'closed',
                now() - interval '3 days', now() - interval '2 days',
                now() - interval '2 days', now() - interval '2 days', ${agentA},
                now() - interval '1 day', now() - interval '1 day', 'account_unavailable')
        returning id::text`;
      const { account, audience } = await observedLineA(tx);
      await withdrawn(tx, account, "owner_changed");
      return {
        other: await submit(
          tx,
          { request: refusal.request },
          "misread",
          null,
          creatorB,
        ),
        unknown: await submit(tx, { request: randomUUID() }),
        both: await submit(tx, { request: refusal.request, badge: account }),
        approved: await submit(tx, { request: approved?.id ?? randomUUID() }),
        closed: await submit(tx, { request: closedRequest?.id ?? "" }),
        holding: await submit(tx, { badge: await accountBadgeOfB(tx) }),
        carried: await submit(tx, { badge: audience }),
        reason: await submit(tx, { request: refusal.request }, "minor"),
        noText: await submit(tx, { request: refusal.request }, "other"),
        blankText: await submit(
          tx,
          { request: refusal.request },
          "misread",
          "   ",
        ),
        brand: await actAsMember(
          tx,
          "influx_advertiser",
          { accountId: brandA, role: "advertiser", aal: "aal1" },
          () => run(tx, SUBMIT, [refusal.request, null, "misread", null]),
        ),
        named: await submit(tx, { badge: account }),
      };
    });
    expect(found.other).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.unknown).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.both).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.approved).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "not_disputable"),
    );
    expect(found.closed).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "not_disputable"),
    );
    expect(found.holding).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.carried).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "not_disputable"),
    );
    expect(found.reason).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "reason"),
    );
    expect(found.noText).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "text"),
    );
    expect(found.blankText).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "text"),
    );
    expect(found.brand).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    // the badge named by the 2V is contestable
    expect(found.named.outcome).toBe("rows");
  });

  it("freezes the requester and the executor of the 2V as deciders; the creator reads his contest without lock, agent, deciders nor comment; agent and admin read queue 5", async () => {
    const found = await scenario(async (tx) => {
      const { account } = await observedLineA(tx);
      await withdrawn(tx, account, "owner_changed");
      const dispute = await submitted(tx, { badge: account });
      const own = await asCreator(tx, () =>
        run<{ id: string }>(
          tx,
          "select id::text, state::text from verification.disputes order by id",
        ),
      );
      const lock = await asCreator(tx, () =>
        run(tx, "select claimed_by_account_id from verification.disputes"),
      );
      const deciders = await asCreator(tx, () =>
        run(tx, "select original_decider_ids from verification.disputes"),
      );
      const agent = await asInternal(tx, agentB, () =>
        run<{ id: string }>(
          tx,
          "select id::text from verification.disputes where id = $1",
          [dispute],
        ),
      );
      const badges = await asInternal(tx, agentB, () =>
        run<{
          badge_id: string;
          dispute_id: string | null;
          dispute_state: string | null;
        }>(tx, ACCOUNT_BADGES, [creatorA]),
      );
      return {
        row: await disputeOf(tx, dispute),
        own,
        lock,
        deciders,
        agent,
        badges,
        dispute,
        account,
      };
    });
    expect(found.row?.deciders.sort()).toEqual([agentA, adminB].sort());
    const ownIds =
      found.own.outcome === "rows" ? found.own.rows.map((row) => row.id) : [];
    expect(ownIds).toContain(found.dispute);
    // the inert contest of creator B (data set) is never his
    expect(ownIds).not.toContain("00000000-0000-4000-8000-00000000ff1e");
    expect(found.lock).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.deciders).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.agent).toMatchObject({
      outcome: "rows",
      rows: [{ id: found.dispute }],
    });
    // the block of the account carries the contest of its withdrawal (modele §3)
    expect(found.badges.outcome).toBe("rows");
    const listed = found.badges.outcome === "rows" ? found.badges.rows : [];
    expect(listed).toContainEqual(
      expect.objectContaining({
        badge_id: found.account,
        dispute_id: found.dispute,
        dispute_state: "open",
      }),
    );
  });
});

/** A holding « Compte vérifié » of creator B (another account): never contestable by creator A. */
async function accountBadgeOfB(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from verification.badges where account_id = ${creatorB} limit 1`;
  return row?.id ?? randomUUID();
}

// ---------------------------------------------------------------------------------------------
// L2F-D12: another person than the decider; a single team, after 24 h (08 RG77, modele point 10)
// ---------------------------------------------------------------------------------------------

describe("L2F-D12: the decider never decides while another person exists; a single team waits 24 h", () => {
  it("opens read only for the decider, lets another agent claim and uphold (independent), the outcome journalled and notified", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 3);
      const dispute = await submitted(tx, { request: refusal.request });
      const decider = await open(tx, agentA, dispute);
      const token = await tokenOf(tx, agentB, dispute);
      const mark = await outboxMark(tx);
      const upheld = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [
          dispute,
          token,
          "decision_confirmed",
          null,
          "Read again.",
        ]),
      );
      const register = await registerOf(tx, dispute);
      return {
        decider,
        upheld,
        row: await disputeOf(tx, dispute),
        register,
        queue: await queueAfter(tx, mark),
        request: await tx<{ status: string }[]>`
          select status::text from verification.verification_requests
           where id = ${refusal.request}`,
        dispute,
      };
    });
    expect(found.decider).toMatchObject({
      outcome: "rows",
      rows: [
        { outcome: "read_only", holder_account_id: null, review_token: null },
      ],
    });
    expect(found.upheld).toMatchObject({
      outcome: "rows",
      rows: [
        { outcome: "upheld", review_mode: "independent", sla_breached: false },
      ],
    });
    expect(found.row).toMatchObject({
      state: "upheld",
      review_mode: "independent",
      outcome_reason_code: "decision_confirmed",
      claimed_by: null,
    });
    expect(found.request[0]?.status).toBe("rejected");
    const decided = found.register.find(
      (line) => line.code === "verification.dispute_decided",
    );
    expect(decided).toEqual({
      code: "verification.dispute_decided",
      actor: agentB,
      payload: {
        outcome: "upheld",
        outcome_reason_code: "decision_confirmed",
        review_mode: "independent",
        badge_id: null,
        late: false,
      },
    });
    expect(JSON.stringify(found.register)).not.toContain("Read again.");
    expect(found.queue.map((line) => [line.type, line.key])).toEqual([
      [
        "verification.dispute_outcome",
        `verification.dispute_outcome:${found.dispute}`,
      ],
    ]);
  });

  it("lets the decider of a single team claim, refuses him before 24 h (seconds left) and as soon as another person exists, then decides after the delay (delayed)", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 3);
      const dispute = await submitted(tx, { request: refusal.request });
      await aloneIn(tx, agentA);
      const token = await tokenOf(tx, agentA, dispute);
      const uphold = () =>
        asInternal(tx, agentA, () =>
          run(tx, UPHOLD, [dispute, token, "new_request_needed", null, null]),
        );
      const early = await uphold();
      await tx`
        update identity.agent_profiles
           set is_active = true, deactivated_at = null, deactivated_by_account_id = null
         where account_id = ${adminB}`;
      const twoPersons = await uphold();
      await aloneIn(tx, agentA);
      await ageDispute(tx, dispute, 25);
      const late = await uphold();
      return { early, twoPersons, late, row: await disputeOf(tx, dispute) };
    });
    expect(found.early).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
    const seconds = Number(
      found.early.outcome === "error" ? found.early.detail : 0,
    );
    expect(seconds).toBeGreaterThan(86_000);
    expect(seconds).toBeLessThanOrEqual(86_400);
    expect(found.twoPersons).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "reviewer_is_decider"),
    );
    expect(found.late).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "upheld", review_mode: "delayed" }],
    });
    expect(found.row).toMatchObject({
      state: "upheld",
      review_mode: "delayed",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D13: overturned, a new date of decision (08 CA53; modele point 9)
// ---------------------------------------------------------------------------------------------

describe("L2F-D13: an overturned contest gives the badge back with a new date of decision (CA53)", () => {
  it("overturns a refused « Compte vérifié » on its original dossier: the code and the handle typed again, a badge granted now, the request kept refused, lead.updated", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 10);
      const dispute = await submitted(tx, { request: refusal.request });
      const token = await tokenOf(tx, agentB, dispute);
      const overturn = (observedCode: string, handle: string) =>
        asInternal(tx, agentB, () =>
          run<{ outcome: string; badge_id: string }>(tx, OVERTURN_ACCOUNT, [
            dispute,
            token,
            observedCode,
            handle,
            null,
            null,
          ]),
        );
      const wrongCode = await overturn("INFLUX-99999999", HANDLE_A);
      const otherHandle = await overturn(refusal.code, "someone_else");
      const wrongKind = await asInternal(tx, agentB, () =>
        run(tx, OVERTURN_REVOCATION, [dispute, token, HANDLE_A, null]),
      );
      const mark = await outboxMark(tx);
      const granted = await overturn(
        ` ${refusal.code.toLowerCase()} `,
        `@${HANDLE_A}`,
      );
      const badge =
        granted.outcome === "rows" ? (granted.rows[0]?.badge_id ?? "") : "";
      const [row] = await tx<
        {
          state: string;
          dispute_id: string;
          request_id: string;
          new_date: boolean;
        }[]
      >`
        select b.state::text, b.dispute_id::text, b.request_id::text,
               b.granted_at > r.decided_at + interval '9 days' as new_date
          from verification.badges b
          join verification.verification_requests r on r.id = b.request_id
         where b.id = ${badge}`;
      const replay = await asInternal(tx, agentB, () =>
        run(tx, OVERTURN_ACCOUNT, [
          dispute,
          token,
          refusal.code,
          HANDLE_A,
          null,
          null,
        ]),
      );
      return {
        wrongCode,
        otherHandle,
        wrongKind,
        granted,
        row,
        dispute,
        refusal,
        status: await disputeOf(tx, dispute),
        queue: await queueAfter(tx, mark),
        register: await registerOf(tx, dispute),
        replay,
      };
    });
    expect(found.wrongCode).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "code_mismatch"),
    );
    expect(found.otherHandle).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "observed_handle_mismatch"),
    );
    expect(found.wrongKind).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "level"),
    );
    expect(found.granted).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "overturned", review_mode: "independent" }],
    });
    expect(found.row).toEqual({
      state: "active",
      dispute_id: found.dispute,
      request_id: found.refusal.request,
      new_date: true,
    });
    expect(found.status).toMatchObject({
      state: "overturned",
      outcome_reason_code: "decision_overturned",
    });
    expect(found.queue.map((line) => line.type)).toEqual([
      "verification.dispute_outcome",
      "lead.updated",
    ]);
    expect(found.register.at(-1)?.payload).toMatchObject({
      outcome: "overturned",
      outcome_reason_code: "decision_overturned",
      badge_id:
        found.granted.outcome === "rows" ? found.granted.rows[0]?.badge_id : "",
    });
    expect(found.replay).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "entry_closed"),
    );
  });

  it("overturns a withdrawal: a new « Compte vérifié » and the audience it carried along, granted now, their original expiry, the public row observed again; an expired one is never restored", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      // the original decisions, 20 days ago (CA53 is observable within one transaction)
      await tx`
        update verification.badges set granted_at = granted_at - interval '20 days'
         where id in (${account}, ${audience})`;
      await withdrawn(tx, account, "owner_changed");
      const dispute = await submitted(tx, { badge: account });
      // admin B executed the withdrawal: admin A reviews
      const token = await tokenOf(tx, adminA, dispute);
      const dossier = await asInternal(tx, adminA, () =>
        run<{ kind: string; cascade_badge_ids: string[]; handle: string }>(
          tx,
          DOSSIER,
          [dispute],
        ),
      );
      const restored = await asInternal(tx, adminA, () =>
        run<{ badge_id: string }>(tx, OVERTURN_REVOCATION, [
          dispute,
          token,
          HANDLE_A,
          null,
        ]),
      );
      const holding = await tx<
        {
          level: string;
          dispute_id: string;
          new_date: boolean;
          same_expiry: boolean;
        }[]
      >`
        select b.level::text, b.dispute_id::text,
               b.granted_at > o.granted_at + interval '19 days' as new_date,
               b.expires_at is not distinct from o.expires_at as same_expiry
          from verification.badges b
          join verification.badges o
            on o.account_id = b.account_id and o.social_account_id = b.social_account_id
           and o.level = b.level and o.id in (${account}, ${audience})
         where b.account_id = ${creatorA} and b.state = 'active'
         order by b.level`;
      const [publicRow] = await tx<{ figures_source: string }[]>`
        select figures_source from profiles.creator_public_networks
         where social_account_id = ${lineA}`;

      // an audience withdrawn whose expiry passed meanwhile is never given back
      const [current] = await tx<{ id: string }[]>`
        select id::text from verification.badges
         where account_id = ${creatorA} and level = 'audience_verified' and state = 'active'`;
      const currentAudience = current?.id ?? "";
      await withdrawn(tx, currentAudience, "influx_error");
      await tx`
        update verification.badges
           set granted_at = now() - interval '100 days', expires_at = now() - interval '1 day'
         where id = ${currentAudience}`;
      const second = await submitted(tx, { badge: currentAudience });
      const secondToken = await tokenOf(tx, adminA, second);
      const expired = await asInternal(tx, adminA, () =>
        run(tx, OVERTURN_REVOCATION, [second, secondToken, HANDLE_A, null]),
      );
      return { dossier, restored, holding, publicRow, expired };
    });
    expect(found.dossier).toMatchObject({
      outcome: "rows",
      rows: [{ kind: "revocation", handle: HANDLE_A }],
    });
    const cascade =
      found.dossier.outcome === "rows"
        ? found.dossier.rows[0]?.cascade_badge_ids
        : [];
    expect(cascade).toHaveLength(1);
    expect(found.restored).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "overturned" }],
    });
    expect(found.holding).toEqual([
      expect.objectContaining({
        level: "account_verified",
        new_date: true,
        same_expiry: true,
      }),
      expect.objectContaining({
        level: "audience_verified",
        new_date: true,
        same_expiry: true,
      }),
    ]);
    expect(found.publicRow?.figures_source).not.toBe("declared");
    expect(found.expired).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "restore_expired"),
    );
  });

  it("refuses to overturn a refused audience whose evidence is purged (missing_evidence), upholds it with new_request_needed; overturns one whose evidence is active, valid from the refusal", async () => {
    const found = await scenario(async (tx) => {
      await tx`
        update profiles.creator_social_accounts
           set followers_count = 120000, posts_last_30_days = 14, avg_comments_per_post = 35,
               engagement_rate_bp = 900
         where id = ${lineA}`;
      await accountBadge(tx);
      const purged = await refusedRequest(tx, "audience_verified", 5, {
        evidence: "purged",
      });
      const dispute = await submitted(tx, { request: purged.request });
      const token = await tokenOf(tx, agentB, dispute);
      const figures = [47_300, 3, 250, 350, day(-20), day(-6), HANDLE_A, null];
      const missing = await asInternal(tx, agentB, () =>
        run(tx, OVERTURN_AUDIENCE, [dispute, token, ...figures]),
      );
      const evidenceRead = await asInternal(tx, agentB, () =>
        run(tx, EVIDENCE, [dispute, purged.evidence]),
      );
      const otherWithout = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [dispute, token, "other", null, null]),
      );
      const overturnReason = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [dispute, token, "decision_overturned", null, null]),
      );
      const superfluous = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [dispute, token, "new_request_needed", MESSAGE, null]),
      );
      const upheld = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [dispute, token, "new_request_needed", null, null]),
      );

      const active = await refusedRequest(tx, "audience_verified", 5, {
        evidence: "active",
      });
      const second = await submitted(tx, { request: active.request });
      const secondToken = await tokenOf(tx, agentB, second);
      const dossier = await asInternal(tx, agentB, () =>
        run<{ evidence: { state: string }[] }>(tx, DOSSIER, [second]),
      );
      const key = await asInternal(tx, agentB, () =>
        run<{ key: string }>(tx, EVIDENCE, [second, active.evidence]),
      );
      const future = await asInternal(tx, agentB, () =>
        run(tx, OVERTURN_AUDIENCE, [
          second,
          secondToken,
          47_300,
          3,
          250,
          350,
          day(-20),
          day(-1),
          HANDLE_A,
          null,
        ]),
      );
      const granted = await asInternal(tx, agentB, () =>
        run<{ badge_id: string }>(tx, OVERTURN_AUDIENCE, [
          second,
          secondToken,
          ...figures,
        ]),
      );
      const badge =
        granted.outcome === "rows" ? (granted.rows[0]?.badge_id ?? "") : "";
      const [row] = await tx<{ from_refusal: boolean; dispute_id: string }[]>`
        select b.expires_at = r.decided_at + interval '90 days' as from_refusal,
               b.dispute_id::text
          from verification.badges b
          join verification.verification_requests r on r.id = b.request_id
         where b.id = ${badge}`;
      const viewed = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'verification.evidence_viewed' and subject_id = ${active.request}`;
      return {
        missing,
        evidenceRead,
        otherWithout,
        overturnReason,
        superfluous,
        upheld,
        dossier,
        key,
        future,
        granted,
        row,
        viewed: viewed.map((line) => line.payload),
        second,
        evidence: active.evidence,
      };
    });
    expect(found.missing).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "missing_evidence"),
    );
    expect(found.evidenceRead).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.otherWithout).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "member_message"),
    );
    expect(found.overturnReason).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "reason"),
    );
    expect(found.superfluous).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "member_message"),
    );
    expect(found.upheld).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "upheld" }],
    });
    expect(found.dossier).toMatchObject({
      outcome: "rows",
      rows: [{ evidence: [expect.objectContaining({ state: "active" })] }],
    });
    expect(found.key.outcome).toBe("rows");
    expect(found.future).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "period_future"),
    );
    expect(found.granted).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "overturned" }],
    });
    expect(found.row).toEqual({ from_refusal: true, dispute_id: found.second });
    expect(found.viewed).toEqual([
      {
        evidence_id: found.evidence,
        level: "audience_verified",
        dispute_id: found.second,
      },
    ]);
  });

  it("closes an open contest when a badge of the same level is granted on the line meanwhile (superseded)", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 4);
      const dispute = await submitted(tx, { request: refusal.request });
      const badge = await accountBadge(tx);
      return {
        row: await disputeOf(tx, dispute),
        register: await registerOf(tx, dispute),
        badge,
        opened: await open(tx, agentB, dispute),
      };
    });
    expect(found.row).toMatchObject({
      state: "withdrawn",
      withdrawn_cause: "superseded",
    });
    expect(found.register.at(-1)).toMatchObject({
      code: "verification.dispute_withdrawn",
      payload: { cause: "superseded", badge_id: found.badge },
    });
    expect(found.opened).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "closed" }],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Queue 5: the double claim, its release, extension, forced release; the account held (15 RG27)
// ---------------------------------------------------------------------------------------------

describe("queue 5: one holder at a time, released, extended, lifted by an admin; never an account held (15 RG27 C1 to C4, RG36)", () => {
  it("serves the second opener read only, refuses his decision (55P03), lets an admin lift the claim, refuses a stale token, an agent's forced release and an account held", async () => {
    const found = await scenario(async (tx) => {
      const refusal = await refusedRequest(tx, "account_verified", 2);
      const dispute = await submitted(tx, { request: refusal.request });
      const first = await open(tx, agentB, dispute);
      const second = await open(tx, adminB, dispute);
      const token =
        first.outcome === "rows" ? (first.rows[0]?.review_token ?? "") : "";
      const byOther = await asInternal(tx, adminB, () =>
        run(tx, UPHOLD, [dispute, token, "decision_confirmed", null, null]),
      );
      const extended = await asInternal(tx, agentB, () =>
        run(tx, EXTEND, [dispute]),
      );
      const agentForce = await asInternal(tx, agentB, () =>
        run(tx, FORCE, [dispute, "holder_absent"]),
      );
      const forced = await asInternal(tx, adminA, () =>
        run<{ holder: string }>(tx, FORCE, [dispute, "holder_absent"]),
      );
      const dispossessed = await asInternal(tx, agentB, () =>
        run(tx, UPHOLD, [dispute, token, "decision_confirmed", null, null]),
      );
      const adminToken = await tokenOf(tx, adminB, dispute);
      await tx`update profiles.creator_social_accounts set pseudonym = 'Changed meanwhile' where id = ${lineA}`;
      const stale = await asInternal(tx, adminB, () =>
        run(tx, UPHOLD, [
          dispute,
          adminToken,
          "decision_confirmed",
          null,
          null,
        ]),
      );
      const released = await asInternal(tx, adminB, () =>
        run(tx, RELEASE, [dispute]),
      );
      await tx`update identity.accounts set owner_agent_id = ${agentB} where id = ${creatorA}`;
      const held = await open(tx, agentB, dispute);
      const queueLines = await tx<
        { code: string; payload: Record<string, unknown> }[]
      >`
        select event_type as code, payload from audit.audit_events
         where subject_id = ${dispute} and event_type like 'queue.%' order by seq`;
      return {
        first,
        second,
        byOther,
        extended: extended.outcome,
        agentForce,
        forced,
        dispossessed,
        stale,
        released: released.outcome,
        held,
        queueLines,
      };
    });
    expect(found.first).toMatchObject({
      outcome: "rows",
      rows: [{ outcome: "claimed", holder_account_id: agentB }],
    });
    expect(found.second).toMatchObject({
      outcome: "rows",
      rows: [
        { outcome: "read_only", holder_account_id: agentB, review_token: null },
      ],
    });
    expect(found.byOther).toMatchObject(refused(LOCK_NOT_AVAILABLE, agentB));
    expect(found.extended).toBe("rows");
    expect(found.agentForce).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.forced).toMatchObject({
      outcome: "rows",
      rows: [{ holder: agentB }],
    });
    expect(found.dispossessed).toMatchObject(
      refused(LOCK_NOT_AVAILABLE, "none"),
    );
    expect(found.stale).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token"),
    );
    expect(found.released).toBe("rows");
    expect(found.held).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.queueLines.map((line) => line.code)).toEqual([
      "queue.entry_opened",
      "queue.entry_opened",
      "queue.claim_extended",
      "queue.claim_forced_release",
      "queue.entry_opened",
      "queue.claim_released",
    ]);
    for (const line of found.queueLines) {
      expect(line.payload.queue_code).toBe("verification_disputes");
    }
  });
});
