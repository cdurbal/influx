// L2F commit 06 — the withdrawal of a badge under dual control, 0231 (jalons/l2f/06.md; l2f/modele.md
// §1 points 4, 5, §2, §3 "0231", §4; l2f/textes.md « Retrait »; fiche invariants 3 to 5, 10, 12; 08
// RG73 to RG76, CA49 to CA51; 06 RG55, CA32; 03 §1.3 PD1 to PD7). TM5.4: without a 2V, with the 2V
// of another badge or reason, expired, consumed, confirmed by the requester outside the degraded form:
// refused; confirmed: withdrawn once. L2F-D7 an agent asks, a distinct admin confirms, the payload
// compared whole (CA49), and the degraded form; D8 the badge disappears, the public row and
// lead.updated (CA50), the audience carried along; D9 each reason, its message, its escalation
// (CA51, 06 CA32); D10 PLT-5, PLS-5, PLS-6: a lax payload or setting refused at its creation. Each
// case runs in a rolled-back transaction of the local superuser, which writes the fixtures and acts
// as the agent and the admins exactly as apps/api takes the role.
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
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
const CHECK_VIOLATION = "23514";

const creatorA = accountIdOf("creator", "a");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;

const MESSAGE = "Your profile breached the terms on several published posts.";
const JUSTIFICATION =
  "Single administrator during the launch phase, withdrawal reviewed alone.";

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

function asAgent<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    fn,
  );
}

function asAdmin<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  session?: string,
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    {
      accountId: account,
      role: "admin",
      aal: "aal2",
      ...(session === undefined ? {} : { sessionId: session }),
    },
    fn,
  );
}

const OPEN = "select * from verification.open_request($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const REQUEST =
  "select verification.request_badge_revocation($1::uuid, $2::text, $3::text) as id";
const CONFIRM =
  "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3::text) as mode";
const REVOKE =
  "select verification.revoke_badge($1::uuid, $2::uuid, $3::uuid, $4::text) as mode";
const RECAP = "select * from verification.read_badge_revocation($1::uuid)";
const ACCOUNT_BADGES =
  "select * from verification.read_account_badges($1::uuid)";

function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
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

/** PD7: deactivates every admin but `account` (the degraded mode of a single operator). */
async function onlyAdmin(tx: Tx, account: string): Promise<void> {
  await tx`
    update identity.agent_profiles p
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${account}
     where p.account_id <> ${account}
       and p.is_active
       and exists (select 1 from identity.account_roles r
                    where r.account_id = p.account_id and r.role = 'admin')`;
}

/** Moves a 2V request back in time (its guard refuses it: disabled here). */
async function ageRequest(
  tx: Tx,
  request: string,
  seconds: number,
): Promise<void> {
  await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
  await tx`
    update backoffice.dual_control_requests
       set requested_at = requested_at - make_interval(secs => ${seconds}),
           expires_at   = expires_at   - make_interval(secs => ${seconds}),
           created_at   = created_at   - make_interval(secs => ${seconds})
     where id = ${request}`;
  await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
}

/** A pending request of creator A on line A, and its code (as the doors of 0222 leave it). */
async function pendingRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
): Promise<{ request: string; code: string }> {
  const code = `INFLUX-${randomUUID()
    .replace(/[^2-9]/g, "")
    .padEnd(8, "2")
    .slice(0, 8)}`;
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level, 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${creatorA}, 'network', ${code}, now() + interval '7 days')`;
  }
  return { request: row.id, code };
}

async function claim(tx: Tx, request: string): Promise<string> {
  const [opened] = await asAgent(tx, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN, [request]),
  );
  if (opened?.review_token == null) throw new Error("not claimed");
  return opened.review_token;
}

/**
 * Line A declared (120 000 followers), then « Compte vérifié » and « Audience vérifiée » granted by
 * agent A through the functions (the public row observed). Returns both badges.
 */
async function observedLineA(
  tx: Tx,
): Promise<{ account: string; audience: string }> {
  await tx`
    update profiles.creator_social_accounts
       set followers_count = 120000, posts_last_30_days = 14, avg_comments_per_post = 35,
           avg_reach_per_post = 12000, engagement_rate_bp = 900
     where id = ${lineA}`;
  const ownership = await pendingRequest(tx, "account_verified");
  const ownershipToken = await claim(tx, ownership.request);
  const [account] = await asAgent(tx, () =>
    tx.unsafe<{ badge_id: string | null }[]>(GRANT_ACCOUNT, [
      ownership.request,
      ownershipToken,
      ownership.code,
      "t2_creator_a",
      null,
      null,
    ]),
  );
  if (account?.badge_id == null) throw new Error("no account badge");
  const { request } = await pendingRequest(tx, "audience_verified");
  await tx`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${request}, ${creatorA}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  const token = await claim(tx, request);
  const [audience] = await asAgent(tx, () =>
    tx.unsafe<{ badge_id: string | null }[]>(GRANT_AUDIENCE, [
      request,
      token,
      47_300,
      3,
      250,
      350,
      day(-20),
      day(-1),
      "t2_creator_a",
      null,
    ]),
  );
  if (audience?.badge_id == null) throw new Error("no audience badge");
  return { account: account.badge_id, audience: audience.badge_id };
}

/** A brand badge of brand A, granted today, valid 12 months. */
async function brandBadge(tx: Tx): Promise<string> {
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests (account_id, level, status)
    values (${brandA}, 'brand_verified', 'pending') returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] = await tx<{ id: string }[]>`
    insert into verification.badges
      (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
       registry_source_id, expires_at)
    select ${brandA}, ${request?.id ?? null}, 'brand_verified', ${agentA}, now(),
           'domain_and_registry', s.id, now() + interval '12 months'
      from verification.registry_sources s where s.is_active order by s.id limit 1
    returning id::text`;
  if (badge === undefined) throw new Error("no brand badge");
  return badge.id;
}

/** Agent A asks the withdrawal of `badge`; returns the 2V request id. */
async function agentRequests(
  tx: Tx,
  badge: string,
  reason: string,
  message: string | null = null,
): Promise<string> {
  const [row] = await asAgent(tx, () =>
    tx.unsafe<{ id: string }[]>(REQUEST, [badge, reason, message]),
  );
  if (row === undefined) throw new Error("no request");
  return row.id;
}

/** Admin `account` confirms `request` (peer). */
async function confirms(
  tx: Tx,
  account: string,
  request: string,
  justification: string | null = null,
): Promise<Outcome<{ mode: string }>> {
  const session = await freshSession(tx, account);
  return asAdmin(
    tx,
    account,
    () => run<{ mode: string }>(tx, CONFIRM, [session, request, justification]),
    session,
  );
}

/** Admin `account` withdraws `badge` for `request` and `reason`, R fresh. */
async function revokes(
  tx: Tx,
  account: string,
  request: string,
  badge: string,
  reason: string,
): Promise<Outcome<{ mode: string }>> {
  const session = await freshSession(tx, account);
  return asAdmin(
    tx,
    account,
    () => run<{ mode: string }>(tx, REVOKE, [session, request, badge, reason]),
    session,
  );
}

async function stateOf(tx: Tx, badge: string): Promise<string> {
  const [row] = await tx<{ state: string }[]>`
    select state::text from verification.badges where id = ${badge}`;
  return row?.state ?? "none";
}

type RegisterLine = {
  code: string;
  actor: string | null;
  subject: string;
  payload: Record<string, unknown>;
};

async function registerOf(tx: Tx, subjects: string[]): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type as code, actor_account_id::text as actor, subject_id::text as subject,
           payload
      from audit.audit_events
     where subject_id::text = any (${subjects})
       and (event_type like 'verification.%' or event_type like 'dual_control.%')
     order by seq`;
}

async function outboxMark(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select coalesce(max(id), 0)::text as id from leads.outbox_events`;
  return row?.id ?? "0";
}

type QueueLine = {
  type: string;
  destination: string;
  key: string;
  payload: Record<string, unknown>;
};

async function queueAfter(
  tx: Tx,
  account: string,
  mark: string,
): Promise<QueueLine[]> {
  return tx<QueueLine[]>`
    select event_type as type, destination::text, idempotency_key as key, payload
      from leads.outbox_events
     where subject_key = ${`account:${account}`} and id > ${mark}::bigint
     order by id`;
}

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

// ---------------------------------------------------------------------------------------------
// TM5.4: no withdrawal without the 2V of exactly this badge and reason (08 RG75, 03 PD1 to PD7)
// ---------------------------------------------------------------------------------------------

describe("TM5.4: a badge is withdrawn under its own confirmed 2V only, and once", () => {
  it("refuses without 2V, with the 2V of another badge or reason, expired, or confirmed by the requester while a peer exists; never a direct write", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      // without any 2V: an unknown request
      const none = await revokes(
        tx,
        adminA,
        randomUUID(),
        audience,
        "influx_error",
      );
      // a direct write of an execution role: no right on the table
      const direct = await asAdmin(tx, adminA, () =>
        run(
          tx,
          `update verification.badges set state = 'revoked', revoked_at = now(),
                  revocation_reason_code = 'influx_error' where id = $1`,
          [audience],
        ),
      );
      // the 2V of the audience badge, confirmed: refused for the account badge or another reason
      const request = await agentRequests(tx, audience, "influx_error");
      await confirms(tx, adminB, request);
      const otherBadge = await revokes(
        tx,
        adminB,
        request,
        account,
        "influx_error",
      );
      const otherReason = await revokes(
        tx,
        adminB,
        request,
        audience,
        "forged_evidence",
      );
      // the requester alone while a peer admin exists: never confirmed, never executed
      const own = await asAdmin(tx, adminA, () =>
        run<{ id: string }>(tx, REQUEST, [account, "influx_error", null]),
      );
      const ownRequest = own.outcome === "rows" ? (own.rows[0]?.id ?? "") : "";
      await ageRequest(tx, ownRequest, 120);
      const selfConfirm = await confirms(tx, adminA, ownRequest, JUSTIFICATION);
      const selfExecute = await revokes(
        tx,
        adminA,
        ownRequest,
        account,
        "influx_error",
      );
      return {
        none,
        direct,
        otherBadge,
        otherReason,
        selfConfirm,
        selfExecute,
        states: [await stateOf(tx, audience), await stateOf(tx, account)],
      };
    });
    expect(found.none).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.direct).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.otherBadge).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.otherReason).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.selfConfirm).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.selfExecute).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.states).toEqual(["active", "active"]);
  });

  it("refuses an expired 2V, withdraws once with a confirmed one, then refuses its replay (consumed)", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      const expired = await agentRequests(tx, audience, "influx_error");
      await ageRequest(tx, expired, 25 * 3600);
      const lateConfirm = await confirms(tx, adminA, expired);
      const lateExecute = await revokes(
        tx,
        adminA,
        expired,
        audience,
        "influx_error",
      );
      const request = await agentRequests(tx, audience, "influx_error");
      await confirms(tx, adminA, request);
      const first = await revokes(
        tx,
        adminA,
        request,
        audience,
        "influx_error",
      );
      const replay = await revokes(
        tx,
        adminA,
        request,
        audience,
        "influx_error",
      );
      const [consumed] = await tx<{ consumed: boolean }[]>`
        select consumed_at is not null as consumed
          from backoffice.dual_control_requests where id = ${request}`;
      const [revoked] = await tx<{ n: number }[]>`
        select count(*)::int as n from audit.audit_events
         where event_type = 'verification.badge_revoked' and subject_id = ${audience}`;
      return {
        lateConfirm,
        lateExecute,
        first,
        replay,
        consumed: consumed?.consumed,
        lines: revoked?.n,
        state: await stateOf(tx, audience),
      };
    });
    expect(found.lateConfirm).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.lateExecute).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.first).toMatchObject({
      outcome: "rows",
      rows: [{ mode: "peer" }],
    });
    expect(found.replay).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.consumed).toBe(true);
    expect(found.lines).toBe(1);
    expect(found.state).toBe("revoked");
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D7: the agent asks, a distinct admin confirms; the degraded form of a single operator (CA49)
// ---------------------------------------------------------------------------------------------

describe("L2F-D7: an agent asks, an administrator distinct from him confirms, the payload compared whole (CA49)", () => {
  it("writes the 2V of verification.revoke_badge {account_id, badge_id, reason_code} with the message outside it, journals the request, and the confirmer withdraws (peer)", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      const request = await agentRequests(
        tx,
        audience,
        "terms_breach",
        MESSAGE,
      );
      const [row] = await tx<
        {
          action_code: string;
          payload: Record<string, unknown>;
          reason_code: string;
          requested_by: string;
          state: string;
        }[]
      >`
        select action_code, payload, reason_code, requested_by_account_id::text as requested_by,
               state::text
          from backoffice.dual_control_requests where id = ${request}`;
      const pending = await asAgent(tx, () =>
        run<{
          pending_revocation_id: string | null;
          pending_revocation_state: string | null;
        }>(tx, ACCOUNT_BADGES, [creatorA]),
      );
      const recap = await asAdmin(tx, adminA, () => run(tx, RECAP, [request]));
      const agentRecap = await asAgent(tx, () => run(tx, RECAP, [request]));
      const again = await asAgent(tx, () =>
        run(tx, REQUEST, [audience, "terms_breach", MESSAGE]),
      );
      const confirmed = await confirms(tx, adminA, request);
      // the agent who asked never executes: the function refuses him
      const byAgent = await asAgent(tx, () =>
        run(tx, REVOKE, [randomUUID(), request, audience, "terms_breach"]),
      );
      const executed = await revokes(
        tx,
        adminA,
        request,
        audience,
        "terms_breach",
      );
      const register = await registerOf(tx, [audience, request]);
      return {
        row,
        pending,
        recap,
        agentRecap,
        again,
        confirmed,
        byAgent,
        executed,
        register,
        request,
        audience,
      };
    });
    expect(found.row).toEqual({
      action_code: "verification.revoke_badge",
      payload: {
        account_id: creatorA,
        badge_id: found.audience,
        reason_code: "terms_breach",
      },
      reason_code: "terms_breach",
      requested_by: agentA,
      state: "pending",
    });
    expect(found.pending.outcome).toBe("rows");
    const listed =
      found.pending.outcome === "rows" ? found.pending.rows : ([] as never[]);
    expect(listed).toContainEqual(
      expect.objectContaining({
        pending_revocation_id: found.request,
        pending_revocation_state: "pending",
      }),
    );
    // never a handle nor a figure in the block of the account (0232: the contest of each badge)
    for (const line of listed) {
      expect(Object.keys(line).sort()).toEqual([
        "badge_id",
        "dispute_id",
        "dispute_state",
        "ended_at",
        "expires_at",
        "granted_at",
        "level",
        "network_code",
        "pending_revocation_id",
        "pending_revocation_state",
        "revocation_reason_code",
        "revocation_request_id",
        "revoked_at",
        "social_account_id",
        "state",
      ]);
    }
    expect(found.recap).toMatchObject({
      outcome: "rows",
      rows: [
        {
          badge_id: found.audience,
          account_id: creatorA,
          level: "audience_verified",
          reason_code: "terms_breach",
          member_message: MESSAGE,
          requested_by_account_id: agentA,
          dual_control_state: "pending",
          cascade_badge_ids: [],
        },
      ],
    });
    expect(found.agentRecap).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.again).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "revocation_pending"),
    );
    expect(found.confirmed).toMatchObject({
      outcome: "rows",
      rows: [{ mode: "peer" }],
    });
    expect(found.byAgent).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.executed).toMatchObject({
      outcome: "rows",
      rows: [{ mode: "peer" }],
    });
    expect(
      found.register.map((line) => [line.code, line.actor, line.payload]),
    ).toEqual([
      [
        "dual_control.requested",
        agentA,
        {
          action_code: "verification.revoke_badge",
          reason_code: "terms_breach",
          action_payload: {
            account_id: creatorA,
            badge_id: found.audience,
            reason_code: "terms_breach",
          },
        },
      ],
      [
        "verification.revocation_requested",
        agentA,
        {
          level: "audience_verified",
          reason_code: "terms_breach",
          dual_control_request_id: found.request,
          escalated: true,
        },
      ],
      [
        "dual_control.confirmed",
        adminA,
        { action_code: "verification.revoke_badge", dual_control: "peer" },
      ],
      [
        "verification.badge_revoked",
        adminA,
        {
          level: "audience_verified",
          reason_code: "terms_breach",
          dual_control_request_id: found.request,
          dual_control: "peer",
        },
      ],
    ]);
    // fiche invariant 12: the message to the member is never in the register
    expect(JSON.stringify(found.register)).not.toContain(MESSAGE);
  });

  it("lets a single administrator ask, confirm alone 60 s later with a justification and withdraw, marked degraded_single_operator (PD1 to PD7)", async () => {
    const found = await scenario(async (tx) => {
      const badge = await brandBadge(tx);
      await onlyAdmin(tx, adminA);
      const asked = await asAdmin(tx, adminA, () =>
        run<{ id: string }>(tx, REQUEST, [badge, "company_dissolved", null]),
      );
      const request = asked.outcome === "rows" ? (asked.rows[0]?.id ?? "") : "";
      const tooSoon = await confirms(tx, adminA, request, JUSTIFICATION);
      await ageRequest(tx, request, 61);
      const confirmed = await confirms(tx, adminA, request, JUSTIFICATION);
      const executed = await revokes(
        tx,
        adminA,
        request,
        badge,
        "company_dissolved",
      );
      const [line] = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'verification.badge_revoked' and subject_id = ${badge}`;
      return {
        tooSoon,
        confirmed,
        executed,
        payload: line?.payload,
        state: await stateOf(tx, badge),
      };
    });
    expect(found.tooSoon).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.confirmed).toMatchObject({
      outcome: "rows",
      rows: [{ mode: "degraded_single_operator" }],
    });
    expect(found.executed).toMatchObject({
      outcome: "rows",
      rows: [{ mode: "degraded_single_operator" }],
    });
    expect(found.payload).toMatchObject({
      level: "brand_verified",
      reason_code: "company_dissolved",
      dual_control: "degraded_single_operator",
    });
    expect(found.state).toBe("revoked");
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D8: the badge disappears at once, nothing served outside the backoffice (RG76, CA50)
// ---------------------------------------------------------------------------------------------

describe("L2F-D8: a withdrawn badge disappears at once; the public row, lead.updated and the e-mail follow (RG76, CA50)", () => {
  it("withdraws « Compte vérifié » with the audience of its line, derives the public row back to the declared, queues one e-mail and lead.updated; members read nothing of it", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      const request = await agentRequests(tx, account, "owner_changed");
      const recap = await asAdmin(tx, adminA, () => run(tx, RECAP, [request]));
      await confirms(tx, adminA, request);
      const mark = await outboxMark(tx);
      await revokes(tx, adminA, request, account, "owner_changed");
      const [row] = await tx<
        { audience_band: string | null; figures_source: string }[]
      >`
        select audience_band, figures_source
          from profiles.creator_public_networks where social_account_id = ${lineA}`;
      const [carried] = await tx<
        { state: string; reason: string | null; request: string | null }[]
      >`
        select state::text, revocation_reason_code as reason,
               revocation_request_id::text as request
          from verification.badges where id = ${audience}`;
      const cascade = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'verification.badge_revoked' and subject_id = ${audience}`;
      const creator = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creatorA, role: "creator", aal: "aal1" },
        () =>
          run(
            tx,
            "select count(*) from verification.badge_revocation_requests",
          ),
      );
      const brand = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        () =>
          run(
            tx,
            "select count(*) from verification.badge_revocation_requests",
          ),
      );
      return {
        recap,
        account: await stateOf(tx, account),
        carried,
        row,
        cascade: cascade.map((line) => line.payload),
        queue: await queueAfter(tx, creatorA, mark),
        creator,
        brand,
        accountBadge: account,
        audienceBadge: audience,
        request,
      };
    });
    expect(found.recap).toMatchObject({
      outcome: "rows",
      rows: [{ cascade_badge_ids: [found.audienceBadge] }],
    });
    expect(found.account).toBe("revoked");
    expect(found.carried).toEqual({
      state: "revoked",
      reason: "owner_changed",
      request: found.request,
    });
    expect(found.row).toMatchObject({
      audience_band: "mid",
      figures_source: "declared",
    });
    expect(found.cascade).toEqual([
      {
        level: "audience_verified",
        reason_code: "owner_changed",
        dual_control_request_id: found.request,
        dual_control: "peer",
        cascade_of: found.accountBadge,
      },
    ]);
    expect(found.queue.map((line) => [line.type, line.destination])).toEqual([
      ["verification.revoked_notice", "brevo_transactional"],
      ["lead.updated", "brevo_contact"],
    ]);
    expect(found.queue[0]?.key).toBe(
      `verification.revoked_notice:${found.accountBadge}`,
    );
    expect(Object.keys(found.queue[0]?.payload ?? {}).sort()).toEqual([
      "account_id",
      "badge_id",
      "email_code",
      "event_id",
    ]);
    expect(found.creator).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.brand).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D9: each reason of its level, its message, its escalation (08 RG73, RG74, 06 RG55, CA51, CA32)
// ---------------------------------------------------------------------------------------------

describe("L2F-D9: the closed lists of the creator and of the brand, the message, the escalation (CA51, 06 CA32)", () => {
  it("holds the reasons of textes.md, refuses a reason outside the level of the badge, a missing or superfluous message, a badge not holding, an account held", async () => {
    const reasons = await migration<
      {
        code: string;
        levels: string;
        message: boolean;
        escalates: boolean;
      }[]
    >`
      select code, levels::text as levels, requires_member_message as message,
             escalates_to_admin as escalates
        from verification.revocation_reasons where is_active order by position`;
    expect(reasons).toEqual([
      {
        code: "forged_evidence",
        levels: "{account_verified,audience_verified,brand_verified}",
        message: false,
        escalates: true,
      },
      {
        code: "account_closed",
        levels: "{account_verified,audience_verified}",
        message: false,
        escalates: false,
      },
      {
        code: "owner_changed",
        levels: "{account_verified,audience_verified}",
        message: false,
        escalates: true,
      },
      {
        code: "terms_breach",
        levels: "{account_verified,audience_verified,brand_verified}",
        message: true,
        escalates: true,
      },
      {
        code: "influx_error",
        levels: "{account_verified,audience_verified,brand_verified}",
        message: false,
        escalates: true,
      },
      {
        code: "company_dissolved",
        levels: "{brand_verified}",
        message: false,
        escalates: false,
      },
      {
        code: "domain_transferred",
        levels: "{brand_verified}",
        message: false,
        escalates: false,
      },
    ]);

    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      const brand = await brandBadge(tx);
      const ask = (badge: string, reason: string, message: string | null) =>
        asAgent(tx, () => run(tx, REQUEST, [badge, reason, message]));
      const outcomes = {
        brandReasonOnCreator: await ask(account, "company_dissolved", null),
        creatorReasonOnBrand: await ask(brand, "owner_changed", null),
        unknown: await ask(account, "minor", null),
        missingMessage: await ask(audience, "terms_breach", null),
        shortMessage: await ask(audience, "terms_breach", "Too short."),
        superfluousMessage: await ask(audience, "influx_error", MESSAGE),
      };
      // each reason of its level is accepted (one live 2V per badge: a fresh badge each time)
      const accepted: Record<string, string> = {};
      for (const reason of [
        "forged_evidence",
        "terms_breach",
        "influx_error",
        "company_dissolved",
        "domain_transferred",
      ]) {
        await tx`
          update verification.badges set state = 'replaced'
           where account_id = ${brandA} and state = 'active'`;
        const asked = await ask(
          await brandBadge(tx),
          reason,
          reason === "terms_breach" ? MESSAGE : null,
        );
        accepted[`brand.${reason}`] = asked.outcome;
      }
      for (const reason of [
        "forged_evidence",
        "account_closed",
        "owner_changed",
        "terms_breach",
        "influx_error",
      ]) {
        const [badge] = await tx<{ id: string }[]>`
          select id::text from verification.badges
           where account_id = ${creatorA} and state = 'active'
             and level = 'account_verified' and social_account_id = ${lineA}`;
        const asked = await ask(
          badge?.id ?? "",
          reason,
          reason === "terms_breach" ? MESSAGE : null,
        );
        accepted[`creator.${reason}`] = asked.outcome;
        // the next reason needs no live 2V on this badge: the pending one cancelled by an admin
        await tx`
          update backoffice.dual_control_requests set state = 'cancelled',
                 cancelled_by_account_id = ${adminA}
           where action_code = 'verification.revoke_badge' and state = 'pending'`;
      }
      const escalated = await tx<{ reason: string; escalated: boolean }[]>`
        select payload ->> 'reason_code' as reason, (payload ->> 'escalated')::boolean as escalated
          from audit.audit_events
         where event_type = 'verification.revocation_requested'
         order by seq`;
      // a badge not holding, an account held by the agent
      await tx`update verification.badges set state = 'expired' where id = ${audience}`;
      const notHolding = await ask(audience, "influx_error", null);
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${creatorA}`;
      const held = await ask(account, "influx_error", null);
      const heldRead = await asAgent(tx, () =>
        run(tx, ACCOUNT_BADGES, [creatorA]),
      );
      const ownRead = await asAgent(tx, () =>
        run(tx, ACCOUNT_BADGES, [agentA]),
      );
      return {
        outcomes,
        accepted,
        escalated,
        notHolding,
        held,
        heldRead: heldRead.outcome,
        ownRead,
      };
    });
    expect(found.outcomes.brandReasonOnCreator).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "reason"),
    );
    expect(found.outcomes.creatorReasonOnBrand).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "reason"),
    );
    expect(found.outcomes.unknown).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "reason"),
    );
    expect(found.outcomes.missingMessage).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "member_message"),
    );
    expect(found.outcomes.shortMessage).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "member_message"),
    );
    expect(found.outcomes.superfluousMessage).toMatchObject(
      refused(INVALID_PARAMETER_VALUE, "member_message"),
    );
    expect(Object.values(found.accepted)).toEqual(Array(10).fill("rows"));
    const flags = Object.fromEntries(
      reasons.map((reason) => [reason.code, reason.escalates]),
    );
    expect(found.escalated).toHaveLength(10);
    for (const line of found.escalated) {
      expect(line.escalated).toBe(flags[line.reason]);
    }
    expect(found.notHolding).toMatchObject(
      refused(NOT_IN_PREREQUISITE_STATE, "badge_not_holding"),
    );
    expect(found.held).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    // the reads of an account serve an account held (modele §3), never the caller's own
    expect(found.heldRead).toBe("rows");
    expect(found.ownRead).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D10: PLT-5, PLS-5, PLS-6 — a lax payload or setting refused at its creation
// ---------------------------------------------------------------------------------------------

describe("L2F-D10: the canonical payload and the settings test the type strictly (PLT-5, PLS-5, PLS-6)", () => {
  it("refuses a non-string Apollo basis at the request, a non-numeric Brevo id in the settings, the withdrawal through the admin door, and keeps the wrappers to their owner", async () => {
    const basis = (byCountry: unknown) => ({
      key: "apollo_legal_basis",
      value: { default: "consentement_requis", by_country: byCountry },
    });
    const found = await scenario(async (tx) => {
      const request = (action: string, payload: unknown) =>
        asAdmin(tx, adminA, () =>
          run(
            tx,
            "select backoffice.request_dual_control($1::text, $2::text::jsonb, $3::text) as id",
            [action, JSON.stringify(payload), "founder_decision"],
          ),
        );
      // the CHECK of leads.sync_settings on a temporary copy (LIKE, defaults and constraints): the
      // real rows are held by other files of the suite, an upsert of a valid value would wait
      await tx.unsafe(
        "create temporary table sync_settings_probe (like leads.sync_settings including defaults including constraints) on commit drop",
      );
      const setting = (key: string, value: unknown) =>
        run(
          tx,
          "insert into sync_settings_probe (key, value) values ($1, $2::text::jsonb)",
          [key, JSON.stringify(value)],
        );
      const [copied] = await tx<{ n: number }[]>`
        select count(*)::int as n from pg_catalog.pg_constraint
         where conrelid = 'sync_settings_probe'::regclass
           and conname = 'sync_settings_value_shape'`;
      return {
        copied: copied?.n,
        number: await request("leads.change_apollo_setting", basis({ FR: 1 })),
        array: await request(
          "leads.change_apollo_setting",
          basis({ FR: ["consentement_requis"] }),
        ),
        object: await request("leads.change_apollo_setting", basis({ FR: {} })),
        valid: await request(
          "leads.change_apollo_setting",
          basis({ FR: "interet_legitime_avec_opposition" }),
        ),
        adminDoor: await request("verification.revoke_badge", {
          account_id: creatorA,
          badge_id: randomUUID(),
          reason_code: "founder_decision",
        }),
        emptyList: await setting("brevo_list_ids", { creators: [] }),
        nullList: await setting("brevo_list_ids", { creators: [null] }),
        template: await setting("brevo_template_ids", {
          "verification.decision": [],
        }),
        listNull: await setting("brevo_list_ids", { creators: null }),
        listNumber: await setting("brevo_list_ids", { creators: 3 }),
      };
    });
    expect(found.number).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.array).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.object).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.valid.outcome).toBe("rows");
    expect(found.adminDoor).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
    expect(found.copied).toBe(1);
    expect(found.emptyList).toMatchObject(refused(CHECK_VIOLATION));
    expect(found.nullList).toMatchObject(refused(CHECK_VIOLATION));
    expect(found.template).toMatchObject(refused(CHECK_VIOLATION));
    expect(found.listNull.outcome).toBe("rows");
    expect(found.listNumber.outcome).toBe("rows");

    // the agent door opens one action only, and nobody but the owner of the verification calls it
    const [rights] = await migration<Record<string, boolean>[]>`
      select
        has_function_privilege('influx_agent',
          'backoffice.open_dual_control_for(text,jsonb,text)', 'EXECUTE') as agent_open,
        has_function_privilege('influx_admin',
          'backoffice.consume_dual_control_for(uuid,uuid,text,jsonb,text)', 'EXECUTE') as admin_consume,
        has_function_privilege('influx_verification_definer',
          'backoffice.open_dual_control_for(text,jsonb,text)', 'EXECUTE') as owner_open,
        has_function_privilege('influx_agent',
          'verification.request_badge_revocation(uuid,text,text)', 'EXECUTE') as agent_request,
        has_function_privilege('influx_advertiser',
          'verification.request_badge_revocation(uuid,text,text)', 'EXECUTE') as advertiser_request,
        has_table_privilege('influx_verification_definer', 'backoffice.dual_control_requests',
          'SELECT') as owner_reads_2v`;
    expect(rights).toEqual({
      agent_open: false,
      admin_consume: false,
      owner_open: true,
      agent_request: true,
      advertiser_request: false,
      owner_reads_2v: false,
    });
  });
});
