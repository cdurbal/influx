// T8 (J8, commit 3) — the two invitations of the backoffice, never merged (migration 0131, EC-J8-2):
// identity.internal_invitations (15 RG99, 03 MFA-1, B-8: admin, R, 72 hours, single use, bound to
// the address; an admin invitation under 2V, EC-J8-12) and backoffice.member_invitations (05 RG116
// to RG119, D54: agent or admin, 30 days in configuration, single use, attribution of the author at
// sign-up, never a blocked sign-up).
//
// Each case runs in ONE rolled-back transaction of the local superuser, which writes the fixtures
// and acts as apps/api does (influx_app then a business role; influx_auth_login then influx_auth).
// The two concurrency cases commit their fixtures on the disposable local stack (random addresses).
import {
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  type DataSet,
} from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  bindRequestSession,
  localSuperuser,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

let dataSet: DataSet;
let adminA: string;
let adminB: string;
let agentA: string;
let agentB: string;

beforeAll(async () => {
  dataSet = await testDataSet();
  adminA = dataSet.accounts.admin.a.id;
  adminB = dataSet.accounts.admin.b.id;
  agentA = dataSet.accounts.agent.a.id;
  agentB = dataSet.accounts.agent.b.id;
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Record<string, unknown>[] }
  | { outcome: "error"; code: string; message: string };

/** One statement in a savepoint: its rows, or the SQLSTATE and message. */
async function attempt(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as Record<string, unknown>[] };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      message: failure.message ?? "",
    };
  }
}

/**
 * A statement whose $1 is p_session_id, in the session of the request (J8S-3, 0142): the claim
 * session_id carries the same session, as apps/api passes `context.sessionId` to both.
 */
async function attemptInSession(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[],
): Promise<Attempt> {
  await bindRequestSession(tx, String(parameters[0]));
  return attempt(tx, statement, parameters);
}

const FORBIDDEN = {
  outcome: "error",
  code: INSUFFICIENT_PRIVILEGE,
  message: "forbidden",
} as const;

function asInternal<T>(
  tx: postgres.TransactionSql,
  role: "agent" | "admin",
  account: string,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: account, role, aal },
    fn,
  );
}

/** A token or code of a link and its SHA-256 (what apps/api stores). */
function digest(): Buffer {
  return createHash("sha256").update(randomBytes(32)).digest();
}

function address(label: string): string {
  return `t8-inv-${label}-${randomUUID()}@example.test`;
}

/** A fresh backoffice session of an internal account: TOTP proven now (0012 trigger). */
async function freshSession(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

/** Ages a whole session, its second-factor proof included (the guard refuses it: disabled here). */
async function ageSession(
  tx: postgres.TransactionSql,
  session: string,
  seconds: number,
): Promise<void> {
  await tx`alter table identity.sessions disable trigger sessions_guard_update`;
  await tx`
    update identity.sessions
       set created_at          = created_at          - make_interval(secs => ${seconds}),
           last_activity_at    = last_activity_at    - make_interval(secs => ${seconds}),
           idle_expires_at     = idle_expires_at     - make_interval(secs => ${seconds}),
           absolute_expires_at = absolute_expires_at - make_interval(secs => ${seconds}),
           mfa_verified_at     = mfa_verified_at     - make_interval(secs => ${seconds})
     where id = ${session}`;
  await tx`alter table identity.sessions enable trigger sessions_guard_update`;
}

const CREATE_INTERNAL =
  "select * from identity.create_internal_invitation($1::uuid, $2, $3::identity.account_role, $4, $5)";

async function createInternal(
  tx: postgres.TransactionSql,
  call: { email: string; role?: string; token?: Buffer; reason?: string },
  admin = adminA,
): Promise<{ id: string; token: Buffer; email: string }> {
  const token = call.token ?? digest();
  const session = await freshSession(tx, admin);
  const result = await asInternal(tx, "admin", admin, () =>
    attemptInSession(tx, CREATE_INTERNAL, [
      session,
      call.email,
      call.role ?? "agent",
      token,
      call.reason ?? "new_team_member",
    ]),
  );
  if (result.outcome !== "rows") {
    throw new Error(`no invitation: ${result.code} ${result.message}`);
  }
  return {
    id: String(result.rows[0]?.invitation_id),
    token,
    email: call.email.trim().toLowerCase(),
  };
}

const ACCEPT =
  "select identity.accept_internal_invitation($1, $2::uuid, $3, $4, 'FR', 'fr') as account";

function accept(
  tx: postgres.TransactionSql,
  token: Buffer,
  email: string,
  firstName = "Camille",
): Promise<Attempt> {
  return actAs(tx, "auth", () =>
    attempt(tx, ACCEPT, [token, randomUUID(), email, firstName]),
  );
}

async function isValid(
  tx: postgres.TransactionSql,
  token: Buffer,
  email: string,
): Promise<unknown> {
  return actAs(tx, "auth", async () => {
    const [row] = await tx<{ valid: boolean }[]>`
      select identity.internal_invitation_is_valid(${token}, ${email}) as valid`;
    return row?.valid;
  });
}

async function registerLines(
  tx: postgres.TransactionSql,
  eventType: string,
  subject: string,
): Promise<{ actor_type: string; payload: Record<string, unknown> }[]> {
  return tx<{ actor_type: string; payload: Record<string, unknown> }[]>`
    select actor_type::text as actor_type, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_id = ${subject}
     order by seq`;
}

// ---------------------------------------------------------------------------------------------

describe("identity.create_internal_invitation() (15 RG99, 03 §3.1 J · R)", () => {
  it("writes a 72-hour invitation, the address normalised, and a register line without it", async () => {
    const email = address("create");
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, {
        email: `  ${email.toUpperCase()} `,
      });
      const [row] = await tx<
        {
          email: string;
          role: string;
          lifetime: number;
          now: boolean;
          two_v: boolean;
          by: string;
        }[]
      >`
        select email, proposed_role::text as role,
               extract(epoch from expires_at - created_at)::int as lifetime,
               created_at = now() as now, requires_dual_control as two_v,
               created_by_account_id::text as by
          from identity.internal_invitations where id = ${created.id}`;
      const lines = await registerLines(
        tx,
        "internal_invitation.created",
        created.id,
      );
      return { row, lines };
    });
    expect(outcome.row).toEqual({
      email,
      role: "agent",
      lifetime: 72 * 3600,
      now: true,
      two_v: false,
      by: adminA,
    });
    expect(outcome.lines).toEqual([
      {
        actor_type: "admin",
        payload: {
          proposed_role: "agent",
          reason_code: "new_team_member",
          requires_dual_control: false,
        },
      },
    ]);
    expect(JSON.stringify(outcome.lines)).not.toContain("@");
  });

  it("refuses an admin without a fresh second factor (R), in aal1, and an agent by privilege", async () => {
    const outcome = await scenario(async (tx) => {
      const stale = await freshSession(tx, adminA);
      await ageSession(tx, stale, 301);
      const withStale = await asInternal(tx, "admin", adminA, () =>
        attemptInSession(tx, CREATE_INTERNAL, [
          stale,
          address("r"),
          "agent",
          digest(),
          "new_team_member",
        ]),
      );
      const fresh = await freshSession(tx, adminA);
      const inAal1 = await asInternal(
        tx,
        "admin",
        adminA,
        () =>
          attemptInSession(tx, CREATE_INTERNAL, [
            fresh,
            address("aal1"),
            "agent",
            digest(),
            "new_team_member",
          ]),
        "aal1",
      );
      // another admin's session is not the caller's R
      const otherSession = await asInternal(tx, "admin", adminB, () =>
        attemptInSession(tx, CREATE_INTERNAL, [
          fresh,
          address("other"),
          "agent",
          digest(),
          "new_team_member",
        ]),
      );
      const agentSession = await freshSession(tx, agentA);
      const agent = await asInternal(tx, "agent", agentA, () =>
        attemptInSession(tx, CREATE_INTERNAL, [
          agentSession,
          address("agent"),
          "agent",
          digest(),
          "new_team_member",
        ]),
      );
      return { withStale, inAal1, otherSession, agent };
    });
    expect(outcome.withStale).toEqual(FORBIDDEN);
    expect(outcome.inAal1).toEqual(FORBIDDEN);
    expect(outcome.otherSession).toEqual(FORBIDDEN);
    expect(outcome.agent).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("refuses a member role, a reason outside the list and a malformed digest", async () => {
    const outcome = await scenario(async (tx) => {
      const session = await freshSession(tx, adminA);
      const call = (role: string, reason: string, token: Buffer) =>
        asInternal(tx, "admin", adminA, () =>
          attemptInSession(tx, CREATE_INTERNAL, [
            session,
            address("shape"),
            role,
            token,
            reason,
          ]),
        );
      return [
        await call("advertiser", "new_team_member", digest()),
        await call("agent", "because", digest()),
        await call("agent", "new_team_member", randomBytes(16)),
      ];
    });
    expect(outcome).toEqual([FORBIDDEN, FORBIDDEN, FORBIDDEN]);
  });

  it("refuses an address that has an account, and a second live invitation for one address (EC-J8-15)", async () => {
    const email = address("twice");
    const outcome = await scenario(async (tx) => {
      const session = await freshSession(tx, adminA);
      const existing = await asInternal(tx, "admin", adminA, () =>
        attemptInSession(tx, CREATE_INTERNAL, [
          session,
          "t2-creator-a@example.test",
          "agent",
          digest(),
          "new_team_member",
        ]),
      );
      await createInternal(tx, { email });
      const second = await asInternal(tx, "admin", adminA, () =>
        attemptInSession(tx, CREATE_INTERNAL, [
          session,
          email,
          "agent",
          digest(),
          "new_team_member",
        ]),
      );
      return { existing, second };
    });
    expect(outcome.existing).toEqual(FORBIDDEN);
    expect(outcome.second).toEqual(FORBIDDEN);
  });

  it("never lets the admin read the token digest, nor write the table directly", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email: address("digest") });
      return asInternal(tx, "admin", adminA, async () => ({
        digest: await attempt(
          tx,
          "select token_hash from identity.internal_invitations where id = $1",
          [created.id],
        ),
        listed: await attempt(
          tx,
          "select id, email from identity.internal_invitations where id = $1",
          [created.id],
        ),
        update: await attempt(
          tx,
          "update identity.internal_invitations set revoked_at = now() where id = $1",
          [created.id],
        ),
      }));
    });
    expect(outcome.digest).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.listed).toMatchObject({ outcome: "rows" });
    expect(outcome.update).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("identity.accept_internal_invitation() (15 RG99, B-8, influx_auth)", () => {
  it("creates the account, its role, its profile and the enrollment token of the same digest", async () => {
    const email = address("accept");
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email });
      const validBefore = await isValid(tx, created.token, email);
      const accepted = await accept(
        tx,
        created.token,
        email.toUpperCase(),
        " Camille ",
      );
      if (accepted.outcome !== "rows") {
        throw new Error(`refused: ${accepted.code}`);
      }
      const account = String(accepted.rows[0]?.account);
      const [state] = await tx<
        {
          email: string;
          role: string;
          granted_by: string;
          first_name: string;
          invited_by: string;
          active: boolean;
          factor: string | null;
          display_name: string;
          token_matches: boolean;
          token_expiry_matches: boolean;
          accepted_now: boolean;
        }[]
      >`
        select a.email, r.role::text as role, r.granted_by_account_id::text as granted_by,
               p.first_name, p.invited_by_account_id::text as invited_by, p.is_active as active,
               p.mfa_factor_id::text as factor, a.display_name,
               t.token_hash = i.token_hash as token_matches,
               t.expires_at = i.expires_at as token_expiry_matches,
               i.accepted_at = now() as accepted_now
          from identity.accounts a
          join identity.account_roles r on r.account_id = a.id
          join identity.agent_profiles p on p.account_id = a.id
          join identity.mfa_enrollment_tokens t on t.account_id = a.id
          join identity.internal_invitations i on i.account_id = a.id
         where a.id = ${account}`;
      const enrollable = await actAs(tx, "auth", async () => {
        const [row] = await tx<{ ok: boolean }[]>`
          select identity.enrollment_token_is_valid(${account}::uuid, ${created.token}) as ok`;
        return row?.ok;
      });
      const validAfter = await isValid(tx, created.token, email);
      const accepted_line = await registerLines(
        tx,
        "internal_invitation.accepted",
        created.id,
      );
      const granted = await registerLines(tx, "account.role_granted", account);
      return {
        validBefore,
        state,
        enrollable,
        validAfter,
        accepted_line,
        granted,
        account,
        invitation: created.id,
      };
    });
    expect(outcome.validBefore).toBe(true);
    expect(outcome.state).toEqual({
      email,
      role: "agent",
      granted_by: adminA,
      first_name: "Camille",
      invited_by: adminA,
      active: true,
      factor: null,
      display_name: "Camille",
      token_matches: true,
      token_expiry_matches: true,
      accepted_now: true,
    });
    expect(outcome.enrollable).toBe(true);
    expect(outcome.validAfter).toBe(false);
    expect(outcome.accepted_line).toEqual([
      {
        actor_type: "system",
        payload: { account_id: outcome.account, role: "agent" },
      },
    ]);
    expect(outcome.granted).toEqual([
      {
        actor_type: "system",
        payload: {
          role: "agent",
          reason_code: "internal_invitation",
          internal_invitation_id: outcome.invitation,
          granted_by_account_id: adminA,
          dual_control_request_id: null,
        },
      },
    ]);
  });

  it("is bound to the address: another address is refused, and the invitation stays usable", async () => {
    const email = address("bound");
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email });
      const other = await accept(tx, created.token, address("other"));
      const valid = await isValid(tx, created.token, email);
      return { other, valid };
    });
    expect(outcome.other).toEqual(FORBIDDEN);
    expect(outcome.valid).toBe(true);
  });

  it("is single use: the second acceptance of the same link is refused", async () => {
    const email = address("once");
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email });
      const first = await accept(tx, created.token, email);
      const second = await accept(tx, created.token, email);
      return { first: first.outcome, second };
    });
    expect(outcome.first).toBe("rows");
    expect(outcome.second).toEqual(FORBIDDEN);
  });

  it("refuses an expired invitation (72 hours) and a revoked one", async () => {
    const outcome = await scenario(async (tx) => {
      const old = await createInternal(tx, { email: address("expired") });
      await tx`alter table identity.internal_invitations disable trigger internal_invitations_guard_update`;
      await tx`
        update identity.internal_invitations
           set created_at = created_at - interval '73 hours',
               expires_at = expires_at - interval '73 hours'
         where id = ${old.id}`;
      await tx`alter table identity.internal_invitations enable trigger internal_invitations_guard_update`;
      const expired = await accept(tx, old.token, old.email);
      const expiredValid = await isValid(tx, old.token, old.email);

      const revoked = await createInternal(tx, { email: address("revoked") });
      const revocation = await asInternal(tx, "admin", adminB, () =>
        attempt(
          tx,
          "select identity.revoke_internal_invitation($1::uuid, 'no_longer_needed')",
          [revoked.id],
        ),
      );
      const afterRevocation = await accept(tx, revoked.token, revoked.email);
      const lines = await registerLines(
        tx,
        "internal_invitation.revoked",
        revoked.id,
      );
      return {
        expired,
        expiredValid,
        revocation: revocation.outcome,
        afterRevocation,
        lines,
      };
    });
    expect(outcome.expired).toEqual(FORBIDDEN);
    expect(outcome.expiredValid).toBe(false);
    expect(outcome.revocation).toBe("rows");
    expect(outcome.afterRevocation).toEqual(FORBIDDEN);
    expect(outcome.lines).toEqual([
      { actor_type: "admin", payload: { reason_code: "no_longer_needed" } },
    ]);
  });

  it("refuses a revocation by an agent, with a reason outside the list, or of an accepted invitation", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email: address("revoke") });
      const REVOKE = "select identity.revoke_internal_invitation($1::uuid, $2)";
      const agent = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, REVOKE, [created.id, "no_longer_needed"]),
      );
      const reason = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, REVOKE, [created.id, "changed_my_mind"]),
      );
      await accept(tx, created.token, created.email);
      const accepted = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, REVOKE, [created.id, "no_longer_needed"]),
      );
      return { agent, reason, accepted };
    });
    expect(outcome.agent).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.reason).toEqual(FORBIDDEN);
    expect(outcome.accepted).toEqual(FORBIDDEN);
  });

  it("is executable by influx_auth only (not by an admin nor a member)", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email: address("exec") });
      const params = [
        created.token,
        randomUUID(),
        created.email,
        "Camille",
      ] as const;
      const admin = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, ACCEPT, [...params]),
      );
      const member = await actAsMember(
        tx,
        "influx_creator",
        {
          accountId: dataSet.accounts.creator.a.id,
          role: "creator",
          aal: "aal1",
        },
        () => attempt(tx, ACCEPT, [...params]),
      );
      return { admin, member };
    });
    expect(outcome.admin).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.member).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("gives one winner to two concurrent acceptances of the same link (committed fixture)", async () => {
    const email = address("race");
    const token = digest();
    // committed: the admin's session and the invitation, written as the admin would (the function)
    const setup = connectAsLocalSuperuser({ max: 2 });
    try {
      await setup.begin(async (tx) => {
        await createInternal(tx, { email, token });
      });
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstDone: (value: Attempt) => void = () => undefined;
      const firstResult = new Promise<Attempt>((resolve) => {
        firstDone = resolve;
      });
      const first = setup.begin(async (tx) => {
        firstDone(await accept(tx, token, email));
        await hold;
      });
      expect((await firstResult).outcome).toBe("rows");
      const second = inRolledBackTransaction(setup, (tx) =>
        accept(tx, token, email),
      );
      // the second one waits on the row lock until the first commits
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await first;
      expect(await second).toEqual(FORBIDDEN);
    } finally {
      await setup.end({ timeout: 1 });
    }
  });
});

describe("an invitation proposing admin needs a dual control (EC-J8-12, 15 RG101)", () => {
  const REQUEST =
    "select backoffice.request_dual_control('identity.invite_admin', jsonb_build_object('invitation_id', $1::uuid), 'new_team_member')::text as id";
  const APPROVE =
    "select identity.approve_admin_invitation($1::uuid, $2::uuid, $3::uuid, 'new_team_member')";

  it("is unusable until its 2V is confirmed and executed by the confirmer, then accepted", async () => {
    const email = address("admin");
    const outcome = await scenario(async (tx) => {
      const created = await createInternal(tx, { email, role: "admin" });
      const before = await accept(tx, created.token, email);
      const validBefore = await isValid(tx, created.token, email);

      const requested = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, REQUEST, [created.id]),
      );
      const request = String(
        requested.outcome === "rows" ? requested.rows[0]?.id : "",
      );
      const sessionB = await freshSession(tx, adminB);
      await asInternal(tx, "admin", adminB, () =>
        attemptInSession(
          tx,
          "select backoffice.confirm_dual_control($1::uuid, $2::uuid)",
          [sessionB, request],
        ),
      );
      // the requester is not the confirmer: he cannot execute it
      const sessionA = await freshSession(tx, adminA);
      const byRequester = await asInternal(tx, "admin", adminA, () =>
        attemptInSession(tx, APPROVE, [sessionA, request, created.id]),
      );
      const approved = await asInternal(tx, "admin", adminB, () =>
        attemptInSession(tx, APPROVE, [sessionB, request, created.id]),
      );
      const again = await asInternal(tx, "admin", adminB, () =>
        attemptInSession(tx, APPROVE, [sessionB, request, created.id]),
      );
      const validAfter = await isValid(tx, created.token, email);
      const confirmed = await registerLines(
        tx,
        "internal_invitation.confirmed",
        created.id,
      );
      const accepted = await accept(tx, created.token, email);
      const account =
        accepted.outcome === "rows" ? String(accepted.rows[0]?.account) : "";
      const [role] = await tx<{ role: string }[]>`
        select role::text as role from identity.account_roles where account_id = ${account}`;
      const granted = await registerLines(tx, "account.role_granted", account);
      return {
        before,
        validBefore,
        requested: requested.outcome,
        byRequester,
        approved: approved.outcome,
        again,
        validAfter,
        confirmed,
        role,
        granted,
        request,
      };
    });
    expect(outcome.before).toEqual(FORBIDDEN);
    expect(outcome.validBefore).toBe(false);
    expect(outcome.requested).toBe("rows");
    expect(outcome.byRequester).toEqual(FORBIDDEN);
    expect(outcome.approved).toBe("rows");
    expect(outcome.again).toEqual(FORBIDDEN);
    expect(outcome.validAfter).toBe(true);
    expect(outcome.confirmed).toEqual([
      {
        actor_type: "admin",
        payload: {
          reason_code: "new_team_member",
          dual_control_request_id: outcome.request,
          dual_control: "peer",
        },
      },
    ]);
    expect(outcome.role).toEqual({ role: "admin" });
    expect(outcome.granted[0]?.payload).toMatchObject({
      role: "admin",
      dual_control_request_id: outcome.request,
    });
  });

  it("refuses a 2V request on an agent invitation, and the approval without a fresh factor", async () => {
    const outcome = await scenario(async (tx) => {
      const agentInvite = await createInternal(tx, {
        email: address("agent-2v"),
      });
      const onAgent = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, REQUEST, [agentInvite.id]),
      );
      const adminInvite = await createInternal(tx, {
        email: address("admin-r"),
        role: "admin",
      });
      const requested = await asInternal(tx, "admin", adminA, () =>
        attempt(tx, REQUEST, [adminInvite.id]),
      );
      const request = String(
        requested.outcome === "rows" ? requested.rows[0]?.id : "",
      );
      const sessionB = await freshSession(tx, adminB);
      await asInternal(tx, "admin", adminB, () =>
        attemptInSession(
          tx,
          "select backoffice.confirm_dual_control($1::uuid, $2::uuid)",
          [sessionB, request],
        ),
      );
      await ageSession(tx, sessionB, 301);
      const stale = await asInternal(tx, "admin", adminB, () =>
        attemptInSession(tx, APPROVE, [sessionB, request, adminInvite.id]),
      );
      return { onAgent, stale };
    });
    expect(outcome.onAgent).toEqual(FORBIDDEN);
    expect(outcome.stale).toEqual(FORBIDDEN);
  });
});

// ---------------------------------------------------------------------------------------------

const CREATE_MEMBER =
  "select * from backoffice.create_member_invitation($1, $2::identity.account_role, $3, $4)";

async function createMember(
  tx: postgres.TransactionSql,
  call: {
    email?: string;
    role?: string;
    language?: string;
    code?: Buffer;
  } = {},
  author: { role: "agent" | "admin"; id: string } = {
    role: "agent",
    id: agentA,
  },
): Promise<{ id: string; code: Buffer }> {
  const code = call.code ?? digest();
  const result = await asInternal(tx, author.role, author.id, () =>
    attempt(tx, CREATE_MEMBER, [
      call.email ?? address("member"),
      call.role ?? "creator",
      call.language ?? "fr",
      code,
    ]),
  );
  if (result.outcome !== "rows") {
    throw new Error(`no member invitation: ${result.code} ${result.message}`);
  }
  return { id: String(result.rows[0]?.invitation_id), code };
}

/** The account created by the sign-up transaction (as provision_account would): created now. */
async function newMember(
  tx: postgres.TransactionSql,
  role: "advertiser" | "creator" = "creator",
  createdAt: "now" | "yesterday" = "now",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, country_code, preferred_language, declared_status, created_at)
    values (${id}, ${randomUUID()}, ${address("signup")}, 'FR', 'fr',
            ${role === "advertiser" ? "business" : "individual"}::identity.declared_status,
            (${createdAt}::text)::timestamptz)`;
  await tx`insert into identity.account_roles (account_id, role)
           values (${id}, ${role}::identity.account_role)`;
  return id;
}

function redeem(
  tx: postgres.TransactionSql,
  account: string,
  code: Buffer | null,
): Promise<unknown> {
  return actAs(tx, "auth", async () => {
    const [row] = await tx<{ outcome: string }[]>`
      select backoffice.redeem_member_invitation(${account}::uuid, ${code}) as outcome`;
    return row?.outcome;
  });
}

async function accountSource(tx: postgres.TransactionSql, account: string) {
  const [row] = await tx<
    { owner: string | null; invitation: string | null; assignments: number }[]
  >`
    select a.owner_agent_id::text as owner, a.signup_invitation_id::text as invitation,
           (select count(*)::int from backoffice.ownership_assignments o
             where o.account_id = a.id) as assignments
      from identity.accounts a where a.id = ${account}`;
  return row;
}

describe("backoffice.create_member_invitation() (05 RG116, D54)", () => {
  it("lets an agent invite: 30 days from the setting, the address normalised, a register line without it", async () => {
    const email = address("m-create");
    const outcome = await scenario(async (tx) => {
      const created = await createMember(tx, {
        email: ` ${email.toUpperCase()}`,
      });
      const [row] = await tx<
        {
          email: string;
          role: string;
          language: string;
          days: number;
          by: string;
        }[]
      >`
        select email, proposed_role::text as role, preferred_language as language,
               extract(epoch from expires_at - created_at)::int / 86400 as days,
               created_by_account_id::text as by
          from backoffice.member_invitations where id = ${created.id}`;
      const lines = await registerLines(
        tx,
        "member_invitation.created",
        created.id,
      );
      return { row, lines };
    });
    expect(outcome.row).toEqual({
      email,
      role: "creator",
      language: "fr",
      days: 30,
      by: agentA,
    });
    expect(outcome.lines).toEqual([
      {
        actor_type: "agent",
        payload: { proposed_role: "creator", preferred_language: "fr" },
      },
    ]);
  });

  it("reads the validity in configuration (signup_invitation_validity_days)", async () => {
    const days = await scenario(async (tx) => {
      await tx`update leads.sync_settings set value = '7' where key = 'signup_invitation_validity_days'`;
      const created = await createMember(tx, {}, { role: "admin", id: adminA });
      const [row] = await tx<{ days: number }[]>`
        select extract(epoch from expires_at - created_at)::int / 86400 as days
          from backoffice.member_invitations where id = ${created.id}`;
      return row?.days;
    });
    expect(days).toBe(7);
  });

  it("refuses its own address, an address with an account and a second live invitation (23505)", async () => {
    const email = address("m-twice");
    const outcome = await scenario(async (tx) => {
      const call = (target: string) =>
        asInternal(tx, "agent", agentA, () =>
          attempt(tx, CREATE_MEMBER, [target, "creator", "fr", digest()]),
        );
      const own = await call("t2-agent-a@example.test");
      const existing = await call("t2-advertiser-b@example.test");
      await createMember(tx, { email });
      const second = await call(email);
      return [own, existing, second].map((result) =>
        result.outcome === "error" ? result.code : "rows",
      );
    });
    expect(outcome).toEqual([
      UNIQUE_VIOLATION,
      UNIQUE_VIOLATION,
      UNIQUE_VIOLATION,
    ]);
  });

  it("refuses an internal role, a malformed digest (22023) and an untranslated language (23503)", async () => {
    const outcome = await scenario(async (tx) => {
      const call = (role: string, language: string, code: Buffer) =>
        asInternal(tx, "agent", agentA, () =>
          attempt(tx, CREATE_MEMBER, [
            address("m-shape"),
            role,
            language,
            code,
          ]),
        );
      return [
        await call("agent", "fr", digest()),
        await call("creator", "fr", randomBytes(8)),
        await call("creator", "de", digest()),
      ].map((result) => (result.outcome === "error" ? result.code : "rows"));
    });
    expect(outcome).toEqual([
      INVALID_PARAMETER,
      INVALID_PARAMETER,
      FOREIGN_KEY_VIOLATION,
    ]);
  });

  it("refuses a member by privilege and an agent in aal1", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await actAsMember(
        tx,
        "influx_advertiser",
        {
          accountId: dataSet.accounts.advertiser.a.id,
          role: "advertiser",
          aal: "aal1",
        },
        () =>
          attempt(tx, CREATE_MEMBER, [
            address("m-member"),
            "creator",
            "fr",
            digest(),
          ]),
      );
      const aal1 = await asInternal(
        tx,
        "agent",
        agentA,
        () =>
          attempt(tx, CREATE_MEMBER, [
            address("m-aal1"),
            "creator",
            "fr",
            digest(),
          ]),
        "aal1",
      );
      return { member, aal1 };
    });
    expect(outcome.member).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.aal1).toEqual(FORBIDDEN);
  });

  it("lets the author and an admin revoke, never another agent; never the code digest to anyone", async () => {
    const outcome = await scenario(async (tx) => {
      const REVOKE =
        "select backoffice.revoke_member_invitation($1::uuid, 'sent_to_wrong_address')";
      const first = await createMember(tx);
      const byOther = await asInternal(tx, "agent", agentB, () =>
        attempt(tx, REVOKE, [first.id]),
      );
      const byAuthor = await asInternal(tx, "agent", agentA, () =>
        attempt(tx, REVOKE, [first.id]),
      );
      const second = await createMember(tx);
      const byAdmin = await asInternal(tx, "admin", adminB, () =>
        attempt(tx, REVOKE, [second.id]),
      );
      const digestRead = await asInternal(tx, "agent", agentA, () =>
        attempt(
          tx,
          "select code_hash from backoffice.member_invitations limit 1",
        ),
      );
      const lines = await registerLines(
        tx,
        "member_invitation.revoked",
        first.id,
      );
      return {
        byOther,
        byAuthor: byAuthor.outcome,
        byAdmin: byAdmin.outcome,
        digestRead,
        lines,
      };
    });
    expect(outcome.byOther).toEqual(FORBIDDEN);
    expect(outcome.byAuthor).toBe("rows");
    expect(outcome.byAdmin).toBe("rows");
    expect(outcome.digestRead).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.lines).toEqual([
      {
        actor_type: "agent",
        payload: { reason_code: "sent_to_wrong_address" },
      },
    ]);
  });
});

describe("backoffice.redeem_member_invitation() at sign-up (05 RG117, RG119, RG120)", () => {
  it("makes the author the responsible agent, records the source and the history, nothing else", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createMember(tx, { role: "advertiser" });
      // RG117: the invited person chose another role and another address
      const account = await newMember(tx, "creator");
      const consentsBefore = await tx<{ n: number }[]>`
        select count(*)::int as n from identity.consent_events where account_id = ${account}`;
      const result = await redeem(tx, account, created.code);
      const source = await accountSource(tx, account);
      const [assignment] = await tx<
        { agent: string; reason: string; by: string | null; open: boolean }[]
      >`
        select agent_account_id::text as agent, reason_code as reason,
               assigned_by_account_id::text as by, unassigned_at is null as open
          from backoffice.ownership_assignments where account_id = ${account}`;
      const [invitation] = await tx<{ account: string; now: boolean }[]>`
        select account_id::text as account, redeemed_at = now() as now
          from backoffice.member_invitations where id = ${created.id}`;
      const consentsAfter = await tx<{ n: number }[]>`
        select count(*)::int as n from identity.consent_events where account_id = ${account}`;
      const redeemed = await registerLines(
        tx,
        "member_invitation.redeemed",
        created.id,
      );
      const assigned = await registerLines(tx, "ownership.assigned", account);
      return {
        result,
        source,
        assignment,
        invitation,
        consents: [consentsBefore[0]?.n, consentsAfter[0]?.n],
        redeemed,
        assigned,
        account,
        id: created.id,
      };
    });
    expect(outcome.result).toBe("attributed");
    expect(outcome.source).toEqual({
      owner: agentA,
      invitation: outcome.id,
      assignments: 1,
    });
    expect(outcome.assignment).toEqual({
      agent: agentA,
      reason: "member_invitation",
      by: null,
      open: true,
    });
    expect(outcome.invitation).toEqual({ account: outcome.account, now: true });
    expect(outcome.consents).toEqual([0, 0]);
    expect(outcome.redeemed).toEqual([
      { actor_type: "system", payload: { account_id: outcome.account } },
    ]);
    expect(outcome.assigned).toEqual([
      {
        actor_type: "system",
        payload: {
          agent_account_id: agentA,
          reason_code: "member_invitation",
          member_invitation_id: outcome.id,
        },
      },
    ]);
  });

  it("attributes nothing for an expired invitation but records the source, and the sign-up goes on", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createMember(tx);
      await tx`alter table backoffice.member_invitations disable trigger member_invitations_guard_update`;
      await tx`
        update backoffice.member_invitations
           set created_at = created_at - interval '31 days', expires_at = expires_at - interval '31 days'
         where id = ${created.id}`;
      await tx`alter table backoffice.member_invitations enable trigger member_invitations_guard_update`;
      const account = await newMember(tx);
      const result = await redeem(tx, account, created.code);
      // the transaction of the sign-up is not aborted: it keeps writing
      const [alive] = await tx<{ ok: number }[]>`select 1 as ok`;
      return {
        result,
        source: await accountSource(tx, account),
        alive,
        id: created.id,
      };
    });
    expect(outcome.result).toBe("expired");
    expect(outcome.source).toEqual({
      owner: null,
      invitation: outcome.id,
      assignments: 0,
    });
    expect(outcome.alive).toEqual({ ok: 1 });
  });

  it("attributes nothing for a redeemed, a revoked or an unknown code, nor for a deactivated author", async () => {
    const outcome = await scenario(async (tx) => {
      const used = await createMember(tx);
      await redeem(tx, await newMember(tx), used.code);
      const second = await newMember(tx);
      const redeemedAgain = await redeem(tx, second, used.code);

      const revoked = await createMember(tx);
      await asInternal(tx, "agent", agentA, () =>
        attempt(
          tx,
          "select backoffice.revoke_member_invitation($1::uuid, 'no_longer_needed')",
          [revoked.id],
        ),
      );
      const third = await newMember(tx);
      const onRevoked = await redeem(tx, third, revoked.code);

      const fourth = await newMember(tx);
      const unknown = await redeem(tx, fourth, digest());

      const byB = await createMember(tx, {}, { role: "agent", id: agentB });
      await tx`
        update identity.agent_profiles
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${adminA}
         where account_id = ${agentB}`;
      const fifth = await newMember(tx);
      const inactive = await redeem(tx, fifth, byB.code);
      return {
        results: [redeemedAgain, onRevoked, unknown, inactive],
        sources: [
          await accountSource(tx, second),
          await accountSource(tx, third),
          await accountSource(tx, fourth),
          await accountSource(tx, fifth),
        ],
        ids: [used.id, revoked.id, byB.id],
      };
    });
    expect(outcome.results).toEqual([
      "already_redeemed",
      "revoked",
      "unknown",
      "author_inactive",
    ]);
    expect(outcome.sources).toEqual([
      { owner: null, invitation: outcome.ids[0], assignments: 0 },
      { owner: null, invitation: outcome.ids[1], assignments: 0 },
      { owner: null, invitation: null, assignments: 0 },
      { owner: null, invitation: outcome.ids[2], assignments: 0 },
    ]);
  });

  it("is not applicable to an account created earlier, nor twice to one account", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createMember(tx);
      const older = await newMember(tx, "creator", "yesterday");
      const onOlder = await redeem(tx, older, created.code);
      const fresh = await newMember(tx);
      const first = await redeem(tx, fresh, created.code);
      const twice = await redeem(tx, fresh, digest());
      const internal = await redeem(tx, agentA, created.code);
      return {
        onOlder,
        first,
        twice,
        internal,
        older: await accountSource(tx, older),
      };
    });
    expect(outcome).toEqual({
      onOlder: "not_applicable",
      first: "attributed",
      twice: "not_applicable",
      internal: "not_applicable",
      older: { owner: null, invitation: null, assignments: 0 },
    });
  });

  it("keeps the source immutable after the sign-up (RG120), whoever writes", async () => {
    const outcome = await scenario(async (tx) => {
      const created = await createMember(tx);
      return attempt(
        tx,
        "update identity.accounts set signup_invitation_id = $1 where id = $2",
        [created.id, dataSet.accounts.creator.a.id],
      );
    });
    expect(outcome).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("is executable by influx_auth only", async () => {
    const outcome = await scenario(async (tx) => {
      const CALL = "select backoffice.redeem_member_invitation($1::uuid, $2)";
      const params = [dataSet.accounts.creator.a.id, digest()] as const;
      return {
        agent: await asInternal(tx, "agent", agentA, () =>
          attempt(tx, CALL, [...params]),
        ),
        admin: await asInternal(tx, "admin", adminA, () =>
          attempt(tx, CALL, [...params]),
        ),
      };
    });
    expect(outcome.agent).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.admin).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("gives one winner to two concurrent sign-ups presenting the same code (committed fixture)", async () => {
    const pool = connectAsLocalSuperuser({ max: 2 });
    try {
      const code = digest();
      await pool.begin((tx) => createMember(tx, { code }));
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstDone: (value: unknown) => void = () => undefined;
      const firstResult = new Promise<unknown>((resolve) => {
        firstDone = resolve;
      });
      const first = pool.begin(async (tx) => {
        firstDone(await redeem(tx, await newMember(tx), code));
        await hold;
      });
      expect(await firstResult).toBe("attributed");
      const second = inRolledBackTransaction(pool, async (tx) =>
        redeem(tx, await newMember(tx), code),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await first;
      expect(await second).toBe("already_redeemed");
    } finally {
      await pool.end({ timeout: 1 });
    }
  });
});
