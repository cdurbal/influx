// T8 (J8, commit 8) — the minimal execution of the "mes données" requests (E-5, migrations 0136 and
// 0137; 21 §J8 point 6; 03 P7; 15 RG75 to RG85; 04 §9.2; runbook demandes-rgpd §4 to §6):
// - the roles influx_privacy / influx_privacy_login / influx_privacy_definer, never linked to the
//   worker's roles, influx_privacy without any table right;
// - the approval by an admin under 2V + R (backoffice.approve_data_request_execution, 2V action
//   privacy.approve_data_request), which executes nothing;
// - E-5: privacy.pending_work(), privacy.execute_request() (access: the export built from the base;
//   erasure: the anonymisation of the Lot 1 tables, account.deleted P0), privacy.
//   record_auth_user_deleted(), privacy.complete_request() (RG77, RG79);
// - the anonymising exception of the append-only guards (influx_privacy_definer, marker of an
//   account already deleted, nothing else);
// - the member's export (read, download after a fresh code each time, 3 times, 7 days), the E-4
//   purge, the two Brevo reads of the worker.
// - D72 (0150): the erasure authorised by the member (identity.submit_member_erasure(), CHECKs of
//   T3), its turn of the worker (T4: the open access withdrawn, privacy.erasure_completed queued,
//   its address read by privacy.read_erasure_notification_subject()), the closure on its messageId.
//
// Each case runs in ONE rolled-back transaction of the local superuser, which writes the fixtures
// and acts as apps/api and the worker do (support.ts: actAsInternal, actAsMember, actAs).
import {
  accountIdOf,
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
  migrationRole,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";
const NO_DATA_FOUND = "P0002";
const CHECK_VIOLATION = "23514";

/** The Brevo messageId of the e-mail privacy.erasure_completed (D72, 0150). */
const ERASURE_MESSAGE_ID = "<t8-erasure@smtp-relay.brevo.com>";

/** The 15 category keys of the export, in the order of the notice (EC-J8-48; 0219). */
const CATEGORIES = [
  "account",
  "advertiser_profile",
  "creator_profile",
  "consents",
  "terms_acceptances",
  "sessions",
  "transactional_emails",
  "email_changes",
  "email_delivery_incidents",
  "delivery_reports",
  "brevo_events",
  "activity_log",
  "error_reports",
  "data_requests",
  "recipients",
] as const;

/** A notice of the shape apps/api renders (an object with the same 15 keys). */
const NOTICE = {
  language: "en",
  title: "Your data held by INFLUX",
  categories: Object.fromEntries(
    CATEGORIES.map((key) => [key, `Purpose and retention of ${key}`]),
  ),
};

let dataSet: DataSet;
let migration: postgres.Sql;
let adminA: string;
let adminB: string;
let agentA: string;

beforeAll(async () => {
  dataSet = await testDataSet();
  migration = migrationRole();
  adminA = dataSet.accounts.admin.a.id;
  adminB = dataSet.accounts.admin.b.id;
  agentA = dataSet.accounts.agent.a.id;
});

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[] }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: Tx,
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
    return { outcome: "rows", rows: [...rows] as Row[] };
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

function codeOf(result: Attempt): string {
  return result.outcome === "error" ? result.code : "rows";
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.message}`);
  }
  return result.rows;
}

function asAdmin<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal },
    fn,
  );
}

function asAgent<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    fn,
  );
}

/** As the member, its session being the session of the request (the claim of apps/api, J7S-1). */
function asMember<T>(tx: Tx, member: Member, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    member.role === "advertiser" ? "influx_advertiser" : "influx_creator",
    {
      accountId: member.id,
      role: member.role,
      aal: "aal1",
      sessionId: member.session,
    },
    fn,
  );
}

function asPrivacy<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAs(tx, "privacy", fn);
}

function asWorker<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAs(tx, "worker", fn);
}

type Member = {
  id: string;
  authUserId: string;
  email: string;
  session: string;
  role: "advertiser" | "creator";
};

/** An active member of its own (never a data set account: the cases change it). */
async function newMember(
  tx: Tx,
  role: "advertiser" | "creator" = "creator",
): Promise<Member> {
  const id = randomUUID();
  const authUserId = randomUUID();
  const email = `t8-privacy-${id}@example.test`;
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${authUserId}, ${email}, now(), 'FR', 'en', 'T8 Privacy Person', true, now(),
            ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
  await tx`insert into identity.account_roles (account_id, role)
           values (${id}, ${role}::identity.account_role)`;
  if (role === "advertiser") {
    await tx`insert into profiles.advertiser_profiles (account_id, legal_name)
             values (${id}, 'T8 Privacy Brand')`;
  }
  await tx`
    insert into identity.consent_events (account_id, purpose, granted, source, evidence)
    values (${id}, 'marketing_email', true, 'signup_form', '{"form": "t8-privacy"}')`;
  const [session] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${id}, 'member', 'firefox.linux')
    returning id::text`;
  if (session === undefined) {
    throw new Error("no session");
  }
  return { id, authUserId, email, session: session.id, role };
}

async function deposit(
  tx: Tx,
  member: Member,
  type: "access" | "erasure",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into backoffice.data_subject_requests (request_type, requester_account_id)
    values (${type}::backoffice.data_request_type, ${member.id})
    returning id::text`;
  if (row === undefined) {
    throw new Error("no request");
  }
  return row.id;
}

/** A backoffice session whose TOTP proof is now (R, 0130). */
async function adminSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

/** Moves a session back in time (its guard refuses it: disabled for the statement). */
async function ageSession(
  tx: Tx,
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

const REQUEST_2V =
  "select backoffice.request_dual_control('privacy.approve_data_request', $1::text::jsonb, $2)::text as id";
const CONFIRM_2V =
  "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode";
const APPROVE =
  "select backoffice.approve_data_request_execution($1::uuid, $2::uuid, $3::uuid, " +
  "$4::backoffice.data_request_type, $5)";

function payloadOf(request: string, type: string): string {
  return JSON.stringify({ request_id: request, request_type: type });
}

/** Admin B requests the 2V, admin A confirms it (peer); returns the 2V request and A's session. */
async function confirmedRequest(
  tx: Tx,
  request: string,
  type: "access" | "erasure",
): Promise<{ dualControl: string; session: string }> {
  const requested = await asAdmin(tx, adminB, () =>
    attempt(tx, REQUEST_2V, [payloadOf(request, type), "request_instructed"]),
  );
  const dualControl = String(rowsOf(requested)[0]?.id);
  const session = await adminSession(tx, adminA);
  rowsOf(
    await asAdmin(tx, adminA, () =>
      attemptInSession(tx, CONFIRM_2V, [session, dualControl, null]),
    ),
  );
  return { dualControl, session };
}

/** The whole approval: 2V requested by B, confirmed by A, consumed by A with R. */
async function approve(
  tx: Tx,
  request: string,
  type: "access" | "erasure",
): Promise<string> {
  const { dualControl, session } = await confirmedRequest(tx, request, type);
  rowsOf(
    await asAdmin(tx, adminA, () =>
      attemptInSession(tx, APPROVE, [
        session,
        dualControl,
        request,
        type,
        "request_instructed",
      ]),
    ),
  );
  return dualControl;
}

const EXECUTE =
  "select request_type, auth_user_id::text as auth_user_id " +
  "from privacy.execute_request($1::uuid, $2::text::jsonb)";

function execute(tx: Tx, request: string, notice: unknown): Promise<Attempt> {
  return asPrivacy(tx, () =>
    attempt(tx, EXECUTE, [
      request,
      notice === null ? null : JSON.stringify(notice),
    ]),
  );
}

type Work = {
  request_id: string;
  request_type: string;
  step: string;
  account_id: string;
  preferred_language: string | null;
  auth_user_id: string | null;
};

async function workOf(tx: Tx, request: string): Promise<Work[]> {
  const result = await asPrivacy(tx, () =>
    attempt(
      tx,
      "select request_id::text, request_type, step, account_id::text, preferred_language, " +
        "auth_user_id::text from privacy.pending_work(100)",
    ),
  );
  return (rowsOf(result) as Work[]).filter((row) => row.request_id === request);
}

async function registerLines(
  tx: Tx,
  eventType: string,
  subject: string,
): Promise<{ actor_type: string; payload: Row }[]> {
  return tx<{ actor_type: string; payload: Row }[]>`
    select actor_type::text as actor_type, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_id = ${subject}
     order by seq`;
}

type QueueLine = {
  id: string;
  event_type: string;
  destination: string;
  priority: number;
  payload: Row;
  idempotency_key: string;
};

async function queueLines(
  tx: Tx,
  account: string,
  eventType: string,
): Promise<QueueLine[]> {
  return tx<QueueLine[]>`
    select id::text, event_type, destination::text as destination, priority, payload,
           idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${account}`} and event_type = ${eventType}
     order by destination`;
}

/** Writes the outcome of a queue line as the worker would have (the superuser, the guard keeps
 * the description). */
async function settle(
  tx: Tx,
  account: string,
  eventType: string,
  destination: string,
  outcome: {
    status: "pending" | "succeeded" | "skipped" | "failed";
    dryRun?: boolean;
    skipReason?: string;
    messageId?: string;
  },
): Promise<void> {
  await tx`
    update leads.outbox_events
       set status              = ${outcome.status}::leads.outbox_status,
           dry_run             = ${outcome.dryRun ?? false},
           skip_reason         = ${outcome.skipReason ?? null},
           last_error_code     = ${outcome.status === "failed" ? "brevo.unavailable" : null},
           provider_message_id = ${outcome.messageId ?? null},
           completed_at        = case when ${outcome.status} = 'pending' then null else now() end
     where subject_key = ${`account:${account}`} and event_type = ${eventType}
       and destination = ${destination}::leads.outbox_destination`;
}

/** An approved and executed erasure of a new member (GoTrue deletion not recorded yet). */
async function executedErasure(
  tx: Tx,
): Promise<{ member: Member; request: string }> {
  const member = await newMember(tx);
  const request = await deposit(tx, member, "erasure");
  await approve(tx, request, "erasure");
  rowsOf(await execute(tx, request, null));
  return { member, request };
}

/** An approved and executed access request of a new member: its export is published. */
async function executedAccess(
  tx: Tx,
  role: "advertiser" | "creator" = "creator",
): Promise<{ member: Member; request: string; exportId: string }> {
  const member = await newMember(tx, role);
  const request = await deposit(tx, member, "access");
  await approve(tx, request, "access");
  rowsOf(await execute(tx, request, NOTICE));
  const [row] = await tx<{ id: string }[]>`
    select id::text from privacy.data_exports where request_id = ${request}`;
  return { member, request, exportId: String(row?.id) };
}

// ---------------------------------------------------------------------------------------------

describe("the roles of E-5 (0136, 03 P7)", () => {
  it("creates influx_privacy_login LOGIN NOINHERIT, bounded, member of influx_privacy only; the owner without member", async () => {
    const roles = await migration<
      {
        rolname: string;
        rolcanlogin: boolean;
        rolinherit: boolean;
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolconnlimit: number;
        rolconfig: string[] | null;
      }[]
    >`
      select rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolconnlimit, rolconfig
        from pg_catalog.pg_roles
       where rolname in ('influx_privacy', 'influx_privacy_login', 'influx_privacy_definer')
       order by rolname`;
    expect(
      roles.map((role) => [
        role.rolname,
        role.rolcanlogin,
        role.rolinherit,
        role.rolsuper,
        role.rolbypassrls,
      ]),
    ).toEqual([
      ["influx_privacy", false, false, false, false],
      ["influx_privacy_definer", false, false, false, false],
      ["influx_privacy_login", true, false, false, false],
    ]);
    const login = roles.find((role) => role.rolname === "influx_privacy_login");
    expect(login?.rolconnlimit).toBe(5);
    expect([...(login?.rolconfig ?? [])].sort()).toEqual([
      "idle_in_transaction_session_timeout=30s",
      "statement_timeout=30s",
    ]);

    const memberships = await migration<{ line: string }[]>`
      select mem.rolname || ' in ' || grp.rolname || ' inherit=' || m.inherit_option ||
             ' set=' || m.set_option || ' admin=' || m.admin_option as line
        from pg_catalog.pg_auth_members m
        join pg_catalog.pg_roles mem on mem.oid = m.member
        join pg_catalog.pg_roles grp on grp.oid = m.roleid
       where (mem.rolname like 'influx\\_privacy%' or grp.rolname like 'influx\\_privacy%')
         and mem.rolname <> current_user
       order by 1`;
    expect(memberships.map((row) => row.line)).toEqual([
      "influx_privacy_login in influx_privacy inherit=false set=true admin=false",
    ]);
  });

  it("gives influx_privacy no table right anywhere, and EXECUTE on its five functions and append_elevated() only", async () => {
    const [tables] = await migration<{ granted: string[] }[]>`
      select coalesce(array_agg(c.oid::regclass::text), '{}') as granted
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('identity', 'audit', 'billing', 'backoffice', 'leads', 'profiles',
                           'reference', 'ops', 'privacy', 'influx')
         and c.relkind in ('r', 'p', 'v', 'm', 'S')
         and (has_table_privilege('influx_privacy', c.oid,
                                  'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
              or (c.relkind <> 'S'
                  and has_any_column_privilege('influx_privacy', c.oid,
                                               'SELECT, INSERT, UPDATE, REFERENCES')))`;
    expect(tables?.granted).toEqual([]);

    const functions = await migration<{ name: string }[]>`
      select p.oid::regprocedure::text as name
        from pg_catalog.pg_proc p, aclexplode(p.proacl) a
       where a.grantee = 'influx_privacy'::regrole and a.privilege_type = 'EXECUTE'
       order by 1`;
    expect(functions.map((row) => row.name)).toEqual([
      "audit.append_elevated(text,uuid)",
      "privacy.complete_request(uuid)",
      "privacy.execute_request(uuid,jsonb)",
      "privacy.pending_work(integer)",
      "privacy.read_erasure_notification_subject(uuid)",
      "privacy.record_auth_user_deleted(uuid)",
    ]);
  });

  it("refuses influx_privacy any direct read, even of the privacy tables", async () => {
    const codes = await scenario((tx) =>
      asPrivacy(tx, async () => [
        codeOf(
          await attempt(
            tx,
            "select request_id from privacy.request_executions",
          ),
        ),
        codeOf(await attempt(tx, "select id from privacy.data_exports")),
        codeOf(await attempt(tx, "select id from identity.accounts")),
        codeOf(await attempt(tx, "select id from leads.outbox_events")),
      ]),
    );
    expect(codes).toEqual(Array(4).fill(INSUFFICIENT_PRIVILEGE));
  });

  it("lets agent and admin read the two tables in aal2, never the held address, the messageId, the content nor the digest", async () => {
    const result = await scenario(async (tx) => {
      const allowed = async (role: "agent" | "admin", aal: "aal1" | "aal2") => {
        const act = <T>(fn: () => Promise<T>) =>
          role === "agent" ? asAgent(tx, fn) : asAdmin(tx, adminA, fn, aal);
        return act(async () => ({
          executions: rowsOf(
            await attempt(
              tx,
              "select request_id, request_type, account_id, approved_at, approved_by_account_id, " +
                "executed_at, auth_user_deleted_at, completed_at from privacy.request_executions",
            ),
          ).length,
          exports: rowsOf(
            await attempt(
              tx,
              "select id, request_id, account_id, published_at, expires_at, downloads_count, " +
                "purged_at from privacy.data_exports",
            ),
          ).length,
          forbidden: [
            codeOf(
              await attempt(
                tx,
                "select propagation_email from privacy.request_executions",
              ),
            ),
            codeOf(
              await attempt(
                tx,
                "select notification_message_id from privacy.request_executions",
              ),
            ),
            codeOf(
              await attempt(
                tx,
                "select dual_control_request_id from privacy.request_executions",
              ),
            ),
            codeOf(
              await attempt(tx, "select content from privacy.data_exports"),
            ),
            codeOf(
              await attempt(tx, "select sha256 from privacy.data_exports"),
            ),
          ],
        }));
      };
      return {
        agent: await allowed("agent", "aal2"),
        admin: await allowed("admin", "aal2"),
        adminAal1: await allowed("admin", "aal1"),
      };
    });
    for (const seen of [result.agent, result.admin]) {
      expect(seen.executions).toBeGreaterThanOrEqual(1);
      expect(seen.exports).toBeGreaterThanOrEqual(1);
      expect(seen.forbidden).toEqual(Array(5).fill(INSUFFICIENT_PRIVILEGE));
    }
    expect(result.adminAal1.executions).toBe(0);
    expect(result.adminAal1.exports).toBe(0);
  });

  it("gives a member no right on the two tables (functions only)", async () => {
    const codes = await scenario(async (tx) => {
      const member = await newMember(tx);
      return asMember(tx, member, async () => [
        codeOf(await attempt(tx, "select id from privacy.data_exports")),
        codeOf(
          await attempt(
            tx,
            "select request_id from privacy.request_executions",
          ),
        ),
        codeOf(await attempt(tx, "select * from privacy.pending_work(10)")),
      ]);
    });
    expect(codes).toEqual(Array(3).fill(INSUFFICIENT_PRIVILEGE));
  });
});

describe("backoffice.approve_data_request_execution() (15 RG75 step 6, RG76: admin, 2V + R)", () => {
  it("records the approval of a peer 2V: execution row, request in_progress, register line; executes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "erasure");
      const dualControl = await approve(tx, request, "erasure");
      const [execution] = await tx<Row[]>`
        select request_type::text, account_id::text, dual_control_request_id::text,
               approved_by_account_id::text, approved_at = now() as approved_now,
               executed_at, propagation_email, completed_at
          from privacy.request_executions where request_id = ${request}`;
      const [status] = await tx<{ status: string }[]>`
        select status::text from backoffice.data_subject_requests where id = ${request}`;
      const [account] = await tx<{ status: string; email: string }[]>`
        select status::text, email from identity.accounts where id = ${member.id}`;
      const [consumed] = await tx<{ consumed: boolean }[]>`
        select consumed_at is not null as consumed from backoffice.dual_control_requests
         where id = ${dualControl}`;
      return {
        member,
        dualControl,
        execution,
        status: status?.status,
        account,
        consumed: consumed?.consumed,
        lines: await registerLines(tx, "privacy.execution_approved", request),
        queued: (await queueLines(tx, member.id, "account.deleted")).length,
      };
    });
    expect(outcome.execution).toEqual({
      request_type: "erasure",
      account_id: outcome.member.id,
      dual_control_request_id: outcome.dualControl,
      approved_by_account_id: adminA,
      approved_now: true,
      executed_at: null,
      propagation_email: null,
      completed_at: null,
    });
    expect(outcome.status).toBe("in_progress");
    expect(outcome.consumed).toBe(true);
    expect(outcome.lines).toEqual([
      {
        actor_type: "admin",
        payload: {
          request_type: "erasure",
          reason_code: "request_instructed",
          dual_control_request_id: outcome.dualControl,
          dual_control: "peer",
        },
      },
    ]);
    // 03 P7: "Non : déclenché par une tâche"
    expect(outcome.account).toEqual({
      status: "active",
      email: outcome.member.email,
    });
    expect(outcome.queued).toBe(0);
  });

  it("accepts the degraded mode of a single admin (PD7), recorded as such", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      await tx`
        update identity.agent_profiles p
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${adminA}
         where p.account_id <> ${adminA} and p.is_active
           and exists (select 1 from identity.account_roles r
                        where r.account_id = p.account_id and r.role = 'admin')`;
      const dualControl = String(
        rowsOf(
          await asAdmin(tx, adminA, () =>
            attempt(tx, REQUEST_2V, [
              payloadOf(request, "access"),
              "request_instructed",
            ]),
          ),
        )[0]?.id,
      );
      await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
      await tx`
        update backoffice.dual_control_requests
           set requested_at = requested_at - interval '61 seconds',
               expires_at   = expires_at   - interval '61 seconds',
               created_at   = created_at   - interval '61 seconds'
         where id = ${dualControl}`;
      await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
      const session = await adminSession(tx, adminA);
      const confirmed = await asAdmin(tx, adminA, () =>
        attemptInSession(tx, CONFIRM_2V, [
          session,
          dualControl,
          "Single admin on duty, the request is due this week.",
        ]),
      );
      const approved = await asAdmin(tx, adminA, () =>
        attemptInSession(tx, APPROVE, [
          session,
          dualControl,
          request,
          "access",
          "request_instructed",
        ]),
      );
      return {
        confirmed: rowsOf(confirmed)[0]?.mode,
        approved: codeOf(approved),
        lines: await registerLines(tx, "privacy.execution_approved", request),
      };
    });
    expect(outcome.confirmed).toBe("degraded_single_operator");
    expect(outcome.approved).toBe("rows");
    expect(outcome.lines[0]?.payload).toMatchObject({
      dual_control: "degraded_single_operator",
    });
  });

  it("refuses an agent (RG76): neither the 2V request nor the approval; the refusal can be traced", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      const { dualControl } = await confirmedRequest(tx, request, "access");
      const session = await adminSession(tx, agentA);
      return asAgent(tx, async () => ({
        request: codeOf(
          await attempt(tx, REQUEST_2V, [
            payloadOf(request, "access"),
            "request_instructed",
          ]),
        ),
        approve: codeOf(
          await attemptInSession(tx, APPROVE, [
            session,
            dualControl,
            request,
            "access",
            "request_instructed",
          ]),
        ),
        traced: codeOf(
          await attempt(
            tx,
            "select backoffice.record_refused_action('privacy.approve_data_request')",
          ),
        ),
      }));
    });
    expect(outcome).toEqual({
      request: INSUFFICIENT_PRIVILEGE,
      approve: INSUFFICIENT_PRIVILEGE,
      traced: "rows",
    });
  });

  it("refuses the approval without a fresh second factor (R), and consumes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      const { dualControl, session } = await confirmedRequest(
        tx,
        request,
        "access",
      );
      await ageSession(tx, session, 301);
      const refused = await asAdmin(tx, adminA, () =>
        attemptInSession(tx, APPROVE, [
          session,
          dualControl,
          request,
          "access",
          "request_instructed",
        ]),
      );
      const [row] = await tx<{ consumed: boolean; executions: number }[]>`
        select (select consumed_at is not null from backoffice.dual_control_requests
                 where id = ${dualControl}) as consumed,
               (select count(*)::int from privacy.request_executions
                 where request_id = ${request}) as executions`;
      return { refused, row };
    });
    expect(outcome.refused).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
      message: "forbidden",
    });
    expect(outcome.row).toEqual({ consumed: false, executions: 0 });
  });

  it("refuses an admin on a request of his own account (C(3)), even with a peer's 2V", async () => {
    const code = await scenario(async (tx) => {
      // a request held by admin A's own account (only the superuser can write one)
      const [row] = await tx<{ id: string }[]>`
        insert into backoffice.data_subject_requests (request_type, requester_account_id)
        values ('access', ${adminA}) returning id::text`;
      const request = String(row?.id);
      const { dualControl, session } = await confirmedRequest(
        tx,
        request,
        "access",
      );
      return codeOf(
        await asAdmin(tx, adminA, () =>
          attemptInSession(tx, APPROVE, [
            session,
            dualControl,
            request,
            "access",
            "request_instructed",
          ]),
        ),
      );
    });
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it.each([
    ["a 2V of the wrong type", "type"],
    ["a payload with another key", "extra"],
    ["an approval of another type than its 2V", "approval_type"],
    ["another reason", "reason"],
    ["a closed request", "closed"],
    ["a requester no longer active", "suspended"],
  ])("refuses %s (42501)", async (_label, variant) => {
    const code = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      if (
        variant === "type" ||
        variant === "extra" ||
        variant === "closed" ||
        variant === "suspended"
      ) {
        if (variant === "closed") {
          await tx`update backoffice.data_subject_requests
                      set status = 'closed', outcome_code = 'sans_objet' where id = ${request}`;
        }
        if (variant === "suspended") {
          await tx`update identity.accounts set status = 'suspended', suspended_at = now()
                    where id = ${member.id}`;
        }
        const payload =
          variant === "type"
            ? payloadOf(request, "erasure")
            : variant === "extra"
              ? JSON.stringify({
                  request_id: request,
                  request_type: "access",
                  account_id: member.id,
                })
              : payloadOf(request, "access");
        return codeOf(
          await asAdmin(tx, adminB, () =>
            attempt(tx, REQUEST_2V, [payload, "request_instructed"]),
          ),
        );
      }
      const { dualControl, session } = await confirmedRequest(
        tx,
        request,
        "access",
      );
      return codeOf(
        await asAdmin(tx, adminA, () =>
          attemptInSession(tx, APPROVE, [
            session,
            dualControl,
            request,
            variant === "approval_type" ? "erasure" : "access",
            variant === "reason" ? "member_request" : "request_instructed",
          ]),
        ),
      );
    });
    expect(code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("refuses a second approval of the same request: no second 2V can even be requested", async () => {
    const codes = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      const dualControl = await approve(tx, request, "access");
      const session = await adminSession(tx, adminA);
      return {
        request: codeOf(
          await asAdmin(tx, adminB, () =>
            attempt(tx, REQUEST_2V, [
              payloadOf(request, "access"),
              "request_instructed",
            ]),
          ),
        ),
        replay: codeOf(
          await asAdmin(tx, adminA, () =>
            attemptInSession(tx, APPROVE, [
              session,
              dualControl,
              request,
              "access",
              "request_instructed",
            ]),
          ),
        ),
      };
    });
    expect(codes).toEqual({
      request: INSUFFICIENT_PRIVILEGE,
      replay: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("privacy.pending_work() (E-5, the worker's loop)", () => {
  it("lists the steps execute, delete_auth_user, complete; the language on execute, the GoTrue id on its step only", async () => {
    const seen = await scenario(async (tx) => {
      const erased = await newMember(tx);
      const erasure = await deposit(tx, erased, "erasure");
      const reader = await newMember(tx);
      const access = await deposit(tx, reader, "access");
      await approve(tx, erasure, "erasure");
      await approve(tx, access, "access");
      const before = [
        ...(await workOf(tx, erasure)),
        ...(await workOf(tx, access)),
      ];
      rowsOf(await execute(tx, erasure, null));
      rowsOf(await execute(tx, access, NOTICE));
      const executed = [
        ...(await workOf(tx, erasure)),
        ...(await workOf(tx, access)),
      ];
      await asPrivacy(tx, () =>
        attempt(tx, "select privacy.record_auth_user_deleted($1::uuid)", [
          erasure,
        ]),
      );
      const recorded = await workOf(tx, erasure);
      return { erased, reader, before, executed, recorded };
    });
    expect(
      seen.before.map((row) => [
        row.request_type,
        row.step,
        row.preferred_language,
        row.auth_user_id,
      ]),
    ).toEqual([
      ["erasure", "execute", "en", null],
      ["access", "execute", "en", null],
    ]);
    expect(
      seen.executed.map((row) => [
        row.request_type,
        row.step,
        row.preferred_language,
        row.auth_user_id,
      ]),
    ).toEqual([
      ["erasure", "delete_auth_user", null, seen.erased.authUserId],
      ["access", "complete", null, null],
    ]);
    expect(seen.recorded.map((row) => row.step)).toEqual(["complete"]);
  });

  it("leaves out an approved request whose account is no longer active (EC-J8-45); bounds its size", async () => {
    const seen = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      await tx`update identity.accounts set status = 'suspended', suspended_at = now()
                where id = ${member.id}`;
      return {
        listed: await workOf(tx, request),
        execute: codeOf(await execute(tx, request, NOTICE)),
        zero: codeOf(
          await asPrivacy(tx, () =>
            attempt(tx, "select * from privacy.pending_work(0)"),
          ),
        ),
        many: codeOf(
          await asPrivacy(tx, () =>
            attempt(tx, "select * from privacy.pending_work(101)"),
          ),
        ),
      };
    });
    expect(seen).toEqual({
      listed: [],
      execute: INSUFFICIENT_PRIVILEGE,
      zero: INVALID_PARAMETER,
      many: INVALID_PARAMETER,
    });
  });

  it("is executable by influx_privacy only (never the worker, never an admin)", async () => {
    const codes = await scenario(async (tx) => ({
      worker: codeOf(
        await asWorker(tx, () =>
          attempt(tx, "select * from privacy.pending_work(1)"),
        ),
      ),
      admin: codeOf(
        await asAdmin(tx, adminA, () =>
          attempt(tx, "select * from privacy.pending_work(1)"),
        ),
      ),
      execute: codeOf(
        await asWorker(tx, () =>
          attempt(
            tx,
            "select * from privacy.execute_request(gen_random_uuid(), null)",
          ),
        ),
      ),
      complete: codeOf(
        await asWorker(tx, () =>
          attempt(tx, "select privacy.complete_request(gen_random_uuid())"),
        ),
      ),
    }));
    expect(codes).toEqual({
      worker: INSUFFICIENT_PRIVILEGE,
      admin: INSUFFICIENT_PRIVILEGE,
      execute: INSUFFICIENT_PRIVILEGE,
      complete: INSUFFICIENT_PRIVILEGE,
    });
  });
});

type ExportFile = {
  format: string;
  version: number;
  generated_at: string;
  account_id: string;
  language: string;
  time_zone: string;
  notice: unknown;
  categories: string[];
  data: Record<string, unknown>;
};

describe("privacy.execute_request(): access (runbook §4)", () => {
  it("builds the export from the base: 15 categories, the notice verbatim, the requester's data only, never a digest", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx);
      const former = `t8-former-${member.id}@example.test`;
      // a completed address change: the former address is still the member's (EC-J8-42)
      const [change] = await tx<{ id: string }[]>`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${member.id}, ${former}, ${member.email}, sha256('t8-old'::bytea),
                sha256('t8-new'::bytea))
        returning id::text`;
      await tx`update identity.email_change_requests
                  set old_confirmed_at = now(), new_confirmed_at = now() where id = ${String(change?.id)}`;
      await tx`update identity.email_change_requests
                  set completed_at = now(), old_code_hash = null, new_code_hash = null
                where id = ${String(change?.id)}`;
      await tx`
        insert into backoffice.code_delivery_reports (login_email, contact_email, message, locale)
        values (${former}, ${`t8-contact-${member.id}@example.test`}, 'member report', 'en'),
               (${stranger.email}, ${stranger.email}, 'stranger report', 'en')`;
      await tx`
        insert into leads.transactional_sends (reference, email_code, priority, recipient_email, locale)
        values (gen_random_uuid(), 'auth.login_code', 'p0', ${former}, 'en'),
               (gen_random_uuid(), 'auth.login_code', 'p0', ${stranger.email}, 'en')`;
      await tx`
        insert into identity.email_delivery_incidents
          (account_id, email_address, channel, incident_type, provider, provider_event_id,
           occurred_at, payload)
        values (${member.id}, ${member.email}, 'marketing', 'soft_bounce', 'brevo',
                ${`t8-incident-${member.id}`}, now(), '{"reason": "mailbox full"}')`;
      await tx`
        insert into ops.error_occurrences
          (group_fingerprint, service, version, route, account_id, message, stack,
           user_agent_summary)
        values (sha256('t2-ops-group'::bytea), 'web', 'local', '/[locale]/compte', ${member.id},
                't8 privacy error', 'secret-stack-frame', 'Firefox 140 on Linux'),
               (sha256('t2-ops-group'::bytea), 'api', 'local', '/v1/me/data-requests',
                ${member.id}, 'violates check constraint t8_server_trace', null, null)`;
      await tx`
        insert into leads.contact_sync_states (account_id, destination, external_contact_id,
                                               last_attempt_at, last_success_at, last_status)
        values (${member.id}, 'brevo_contact', 't8-brevo-42', now(), now(), 'succeeded')`;
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      const executed = await execute(tx, request, NOTICE);
      const [stored] = await tx<
        {
          content: string;
          sha256: Buffer;
          size_bytes: number;
          categories: string[];
          seven_days: boolean;
          purged_at: Date | null;
          downloads_count: number;
        }[]
      >`
        select content, sha256, size_bytes, categories,
               expires_at = published_at + interval '7 days' as seven_days, purged_at,
               downloads_count
          from privacy.data_exports where request_id = ${request}`;
      const [hashes] = await tx<{ token: string; incident: string }[]>`
        select (select encode(token_hash, 'hex') from identity.sessions where id = ${member.session})
                 as token,
               encode(sha256('t8-old'::bytea), 'hex') as incident`;
      const [execution] = await tx<{ executed: boolean; status: string }[]>`
        select e.executed_at is not null as executed, d.status::text as status
          from privacy.request_executions e
          join backoffice.data_subject_requests d on d.id = e.request_id
         where e.request_id = ${request}`;
      return {
        member,
        stranger,
        former,
        request,
        executed,
        stored,
        hashes,
        execution,
      };
    });
    expect(rowsOf(outcome.executed)).toEqual([
      { request_type: "access", auth_user_id: null },
    ]);
    expect(outcome.execution).toEqual({
      executed: true,
      status: "in_progress",
    });
    const stored = outcome.stored;
    if (stored === undefined) {
      throw new Error("no export");
    }
    // the digest and the size are those of the exact bytes delivered
    expect(
      createHash("sha256")
        .update(stored.content, "utf8")
        .digest()
        .equals(stored.sha256),
    ).toBe(true);
    expect(Buffer.byteLength(stored.content, "utf8")).toBe(stored.size_bytes);
    expect(stored.categories).toEqual([...CATEGORIES]);
    expect(stored.seven_days).toBe(true);
    expect(stored.purged_at).toBeNull();
    expect(stored.downloads_count).toBe(0);

    const file = JSON.parse(stored.content) as ExportFile;
    expect(Object.keys(file).sort()).toEqual([
      "account_id",
      "categories",
      "data",
      "format",
      "generated_at",
      "language",
      "notice",
      "time_zone",
      "version",
    ]);
    expect(file).toMatchObject({
      format: "influx.data_export",
      version: 1,
      account_id: outcome.member.id,
      language: "en",
      time_zone: "UTC",
      notice: NOTICE,
    });
    expect(file.generated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(file.categories).toEqual([...CATEGORIES]);
    expect(Object.keys(file.data).sort()).toEqual([...CATEGORIES].sort());

    const data = file.data as Record<string, Row[] & Row>;
    expect(data.account).toMatchObject({
      id: outcome.member.id,
      role: "advertiser",
      email: outcome.member.email,
      status: "active",
      display_name: "T8 Privacy Person",
      adult_attested: true,
    });
    expect(data.advertiser_profile).toMatchObject({
      legal_name: "T8 Privacy Brand",
    });
    expect(data.consents).toEqual([
      expect.objectContaining({
        purpose: "marketing_email",
        granted: true,
        evidence: { form: "t8-privacy" },
      }),
    ]);
    expect(data.sessions).toHaveLength(1);
    expect(Object.keys(data.sessions?.[0] ?? {}).sort()).toEqual([
      "browser",
      "country_code",
      "created_at",
      "last_activity_at",
      "revocation_reason",
      "revoked_at",
      "surface",
    ]);
    // the P0 line sent to the former address, never the stranger's
    expect(data.transactional_emails).toHaveLength(1);
    expect(data.email_changes).toEqual([
      expect.objectContaining({
        old_email: outcome.former,
        new_email: outcome.member.email,
      }),
    ]);
    expect(data.email_delivery_incidents).toEqual([
      expect.objectContaining({
        email_address: outcome.member.email,
        incident_type: "soft_bounce",
      }),
    ]);
    expect(data.delivery_reports).toEqual([
      expect.objectContaining({
        login_email: outcome.former,
        message: "member report",
      }),
    ]);
    // EC-J8-56: the message and the browser of a browser report only; a server report gives its
    // date, route and service
    expect(data.error_reports).toEqual([
      {
        occurred_at: expect.any(String),
        route: "/[locale]/compte",
        service: "web",
        message: "t8 privacy error",
        browser: "Firefox 140 on Linux",
      },
      {
        occurred_at: expect.any(String),
        route: "/v1/me/data-requests",
        service: "api",
        message: null,
        browser: null,
      },
    ]);
    expect(data.recipients).toEqual([
      expect.objectContaining({
        destination: "brevo_contact",
        external_contact_id: "t8-brevo-42",
      }),
    ]);
    expect(data.data_requests).toEqual([
      expect.objectContaining({
        id: outcome.request,
        request_type: "access",
        status: "in_progress",
      }),
    ]);
    expect(data.brevo_events).toEqual([]);
    expect(data.terms_acceptances).toEqual([]);
    // the activity log: code, date, actor (self or INFLUX), never a payload
    const approved = (data.activity_log as Row[]).find(
      (line) => line.code === "privacy.execution_approved",
    );
    expect(approved).toEqual({
      code: "privacy.execution_approved",
      occurred_at: expect.any(String),
      actor: "INFLUX",
    });
    // RG81: nothing of the stranger; never a digest, never the stack
    for (const absent of [
      outcome.stranger.email,
      outcome.stranger.id,
      "stranger report",
      outcome.hashes?.token ?? "",
      outcome.hashes?.incident ?? "",
      "secret-stack-frame",
      "t8_server_trace",
      "row_hash",
      "token_hash",
      "code_hash",
    ]) {
      expect(stored.content.includes(absent), absent).toBe(false);
    }
  });

  it("queues privacy.export_ready (P1, ids only, once) and journals the publication by its digest", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request, exportId } = await executedAccess(tx);
      const [digest] = await tx<{ hex: string; size: number }[]>`
        select encode(sha256, 'hex') as hex, size_bytes as size
          from privacy.data_exports where id = ${exportId}`;
      return {
        member,
        request,
        exportId,
        digest,
        lines: await queueLines(tx, member.id, "privacy.export_ready"),
        register: await registerLines(tx, "privacy.export_published", request),
      };
    });
    expect(outcome.lines).toEqual([
      {
        id: expect.any(String),
        event_type: "privacy.export_ready",
        destination: "brevo_transactional",
        priority: 100,
        payload: {
          event_id: expect.any(String),
          account_id: outcome.member.id,
          request_id: outcome.request,
          export_id: outcome.exportId,
          email_code: "privacy.export_ready",
        },
        idempotency_key: `privacy.export_ready:${outcome.request}`,
      },
    ]);
    expect(outcome.register).toEqual([
      {
        actor_type: "system",
        payload: {
          sha256: outcome.digest?.hex,
          size_bytes: outcome.digest?.size,
          categories: [...CATEGORIES],
        },
      },
    ]);
  });

  it.each([
    ["without a notice", null],
    ["with a notice that is not an object", ["a", "list"]],
    ["with a notice over 64 KiB", { text: "x".repeat(70_000) }],
  ])("refuses an access %s (22023)", async (_label, notice) => {
    const code = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      return codeOf(await execute(tx, request, notice));
    });
    expect(code).toBe(INVALID_PARAMETER);
  });

  it("returns no row for a request not approved, or already executed; refuses a notice on an erasure", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const unapproved = await deposit(tx, member, "access");
      const notApproved = rowsOf(await execute(tx, unapproved, NOTICE));
      const { request } = await executedAccess(tx);
      const again = rowsOf(await execute(tx, request, NOTICE));
      const other = await newMember(tx);
      const erasure = await deposit(tx, other, "erasure");
      await approve(tx, erasure, "erasure");
      return {
        notApproved,
        again,
        notice: codeOf(await execute(tx, erasure, NOTICE)),
      };
    });
    expect(outcome).toEqual({
      notApproved: [],
      again: [],
      notice: INVALID_PARAMETER,
    });
  });
});

describe("privacy.execute_request(): erasure (04 §9.2, 21 §J8 point 6)", () => {
  it("anonymises the account and every plain address of the Lot 1 tables, in one transaction; a third party is untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx);
      const former = `t8-former-${member.id}@example.test`;
      const [closed] = await tx<{ id: string }[]>`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${member.id}, ${former}, ${member.email}, sha256('t8-o1'::bytea),
                sha256('t8-n1'::bytea)) returning id::text`;
      await tx`update identity.email_change_requests
                  set old_confirmed_at = now(), new_confirmed_at = now() where id = ${String(closed?.id)}`;
      await tx`update identity.email_change_requests
                  set completed_at = now(), old_code_hash = null, new_code_hash = null
                where id = ${String(closed?.id)}`;
      const [open] = await tx<{ id: string }[]>`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${member.id}, ${member.email}, ${`t8-pending-${member.id}@example.test`},
                sha256('t8-o2'::bytea), sha256('t8-n2'::bytea)) returning id::text`;
      await tx`
        insert into identity.email_delivery_incidents
          (account_id, email_address, channel, incident_type, provider, provider_event_id,
           occurred_at, payload)
        values (${member.id}, ${former}, 'transactional', 'hard_bounce', 'brevo',
                ${`t8-bounce-${member.id}`}, now(), ${JSON.stringify({ reason: `550 <${former}>` })}::text::jsonb),
               (${stranger.id}, ${stranger.email}, 'marketing', 'soft_bounce', 'brevo',
                ${`t8-bounce-${stranger.id}`}, now(), '{}')`;
      await tx`
        insert into backoffice.code_delivery_reports (login_email, contact_email, message, locale)
        values (${former}, ${`t8-contact-${member.id}@example.test`}, 'please help', 'en'),
               (${stranger.email}, ${stranger.email}, 'stranger report', 'en')`;
      await tx`
        insert into leads.transactional_sends (reference, email_code, priority, recipient_email, locale)
        values (gen_random_uuid(), 'auth.login_code', 'p0', ${member.email}, 'en'),
               (gen_random_uuid(), 'auth.login_code', 'p0', ${stranger.email}, 'en')`;
      const [inbound] = await tx<
        {
          by_email: string;
          by_outcome: string;
          by_ref: string;
          stranger_line: string;
        }[]
      >`
        with lines as (
          insert into leads.brevo_inbound_events (origin, dedup_key, event, occurred_at, email,
                                                  account_ref)
          values ('webhook', sha256(gen_random_uuid()::text::bytea), 'unsubscribed', now(),
                  ${member.email}, null),
                 ('webhook', sha256(gen_random_uuid()::text::bytea), 'spam', now(),
                  't8-unknown@example.test', null),
                 ('reconciliation', sha256(gen_random_uuid()::text::bytea), 'blocked', now(),
                  't8-other@example.test', ${member.id}::uuid),
                 ('webhook', sha256(gen_random_uuid()::text::bytea), 'unsubscribed', now(),
                  ${stranger.email}, null)
          returning id, event, account_ref, email)
        select (select id::text from lines where email = ${member.email}) as by_email,
               (select id::text from lines where event = 'spam') as by_outcome,
               (select id::text from lines where account_ref is not null) as by_ref,
               (select id::text from lines where email = ${stranger.email}) as stranger_line`;
      await tx`insert into leads.brevo_inbound_outcomes (event_id, account_id, outcome)
               values (${String(inbound?.by_outcome)}, ${member.id}, 'no_change')`;
      const [invitation] = await tx<{ id: string }[]>`
        insert into backoffice.member_invitations
          (code_hash, email, proposed_role, preferred_language, created_by_account_id)
        values (sha256(gen_random_uuid()::text::bytea), ${former}, 'advertiser', 'en', ${agentA})
        returning id::text`;
      // an export still available before the erasure: purged with it
      const access = await deposit(tx, member, "access");
      await approve(tx, access, "access");
      rowsOf(await execute(tx, access, NOTICE));

      const request = await deposit(tx, member, "erasure");
      await approve(tx, request, "erasure");
      const executed = rowsOf(await execute(tx, request, null));
      const marker = `deleted+${member.id}@invalid`;

      const [account] = await tx<Row[]>`
        select status::text, email, display_name, deleted_at is not null as deleted,
               anonymized_at is not null as anonymized
          from identity.accounts where id = ${member.id}`;
      const [counts] = await tx<Row[]>`
        select (select count(*)::int from identity.sessions where account_id = ${member.id})
                 as sessions,
               (select count(*)::int from identity.sessions where account_id = ${stranger.id})
                 as stranger_sessions`;
      const [profile] = await tx<{ legal_name: string }[]>`
        select legal_name from profiles.advertiser_profiles where account_id = ${member.id}`;
      const changes = await tx<Row[]>`
        select id::text, old_email, new_email, cancel_reason::text,
               old_code_hash is null and new_code_hash is null as digests_cleared,
               completed_at is not null as completed
          from identity.email_change_requests where account_id = ${member.id}
         order by completed_at is null, id`;
      const incidents = await tx<Row[]>`
        select account_id::text, email_address, payload from identity.email_delivery_incidents
         where account_id in (${member.id}, ${stranger.id}) order by email_address`;
      const reports = await tx<Row[]>`
        select login_email, contact_email, message from backoffice.code_delivery_reports
         where login_email in (${marker}, ${stranger.email}) order by login_email`;
      const sends = await tx<Row[]>`
        select recipient_email from leads.transactional_sends
         where recipient_email in (${marker}, ${member.email}, ${stranger.email})
         order by recipient_email`;
      const inboundLines = await tx<Row[]>`
        select id::text, email from leads.brevo_inbound_events
         where id in (${String(inbound?.by_email)}, ${String(inbound?.by_outcome)}, ${String(inbound?.by_ref)},
                      ${String(inbound?.stranger_line)})`;
      const [invited] = await tx<{ email: string }[]>`
        select email from backoffice.member_invitations where id = ${String(invitation?.id)}`;
      const [exported] = await tx<Row[]>`
        select content is null as purged, purged_at is not null as stamped
          from privacy.data_exports where request_id = ${access}`;
      const [held] = await tx<{ propagation_email: string | null }[]>`
        select propagation_email from privacy.request_executions where request_id = ${request}`;
      return {
        member,
        stranger,
        marker,
        executed,
        account,
        counts,
        profile,
        changes,
        closedId: closed?.id,
        openId: open?.id,
        incidents,
        reports,
        sends,
        inbound,
        inboundLines,
        invited,
        exported,
        held,
      };
    });
    const { member, stranger, marker } = outcome;
    expect(outcome.executed).toEqual([
      { request_type: "erasure", auth_user_id: member.authUserId },
    ]);
    expect(outcome.account).toEqual({
      status: "deleted",
      email: marker,
      display_name: null,
      deleted: true,
      anonymized: true,
    });
    expect(outcome.counts).toEqual({ sessions: 0, stranger_sessions: 1 });
    expect(outcome.profile?.legal_name).toBe("[deleted]");
    expect(outcome.changes).toEqual([
      {
        id: outcome.closedId,
        old_email: marker,
        new_email: `deleted+${member.id}.new@invalid`,
        cancel_reason: null,
        digests_cleared: true,
        completed: true,
      },
      {
        id: outcome.openId,
        old_email: marker,
        new_email: `deleted+${member.id}.new@invalid`,
        cancel_reason: "account_deleted",
        digests_cleared: true,
        completed: false,
      },
    ]);
    expect(outcome.incidents).toEqual([
      { account_id: member.id, email_address: marker, payload: {} },
      { account_id: stranger.id, email_address: stranger.email, payload: {} },
    ]);
    expect(outcome.reports).toEqual([
      { login_email: marker, contact_email: marker, message: null },
      {
        login_email: stranger.email,
        contact_email: stranger.email,
        message: "stranger report",
      },
    ]);
    expect(outcome.sends).toEqual([
      { recipient_email: marker },
      { recipient_email: stranger.email },
    ]);
    const inboundEmails = Object.fromEntries(
      outcome.inboundLines.map((line) => [String(line.id), line.email]),
    );
    expect(inboundEmails).toEqual({
      [String(outcome.inbound?.by_email)]: null,
      [String(outcome.inbound?.by_outcome)]: null,
      [String(outcome.inbound?.by_ref)]: null,
      [String(outcome.inbound?.stranger_line)]: stranger.email,
    });
    expect(outcome.invited?.email).toBe(marker);
    expect(outcome.exported).toEqual({ purged: true, stamped: true });
    // the address held for the Brevo deletion until the closure (EC-J8-46)
    expect(outcome.held?.propagation_email).toBe(member.email);
  });

  it("queues account.deleted P0 to Brevo and Apollo (ids only) and writes account.anonymized", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request } = await executedErasure(tx);
      return {
        member,
        request,
        lines: await queueLines(tx, member.id, "account.deleted"),
        register: await registerLines(tx, "account.anonymized", member.id),
      };
    });
    const expected = (destination: string) => ({
      id: expect.any(String),
      event_type: "account.deleted",
      destination,
      priority: 0,
      payload: {
        event_id: expect.any(String),
        account_id: outcome.member.id,
        request_id: outcome.request,
      },
      idempotency_key: `account.deleted:${outcome.member.id}`,
    });
    expect(outcome.lines).toEqual([
      expected("apollo_contact"),
      expected("brevo_contact"),
    ]);
    expect(outcome.lines[0]?.payload.event_id).toBe(
      outcome.lines[1]?.payload.event_id,
    );
    expect(outcome.register).toEqual([
      { actor_type: "system", payload: { request_id: outcome.request } },
    ]);
  });

  it("keeps the guards for everyone else: the owner writes the marker of a DELETED account only, nothing else moves", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const { member: erased } = await executedErasure(tx);
      const erasedMarker = `deleted+${erased.id}@invalid`;
      await tx`
        insert into identity.email_delivery_incidents
          (account_id, email_address, channel, incident_type, provider, provider_event_id,
           occurred_at)
        values (${member.id}, ${member.email}, 'marketing', 'soft_bounce', 'brevo',
                ${`t8-g1-${member.id}`}, now()),
               (${erased.id}, ${erasedMarker}, 'marketing', 'soft_bounce', 'brevo',
                ${`t8-g2-${erased.id}`}, now())`;
      await tx`
        insert into backoffice.code_delivery_reports (login_email, contact_email, locale)
        values (${member.email}, ${member.email}, 'en')`;
      await tx`
        insert into leads.brevo_inbound_events (origin, dedup_key, event, occurred_at, email)
        values ('webhook', sha256(${`t8-g-${member.id}`}::bytea), 'unsubscribed', now(),
                ${member.email})`;
      const asDefiner = async (
        statement: string,
        parameters: string[] = [],
      ) => {
        await tx`set local role influx_privacy_definer`;
        const result = await attempt(tx, statement, parameters);
        await tx`reset role`;
        return result;
      };
      const asLeadsDefiner = async (
        statement: string,
        parameters: string[] = [],
      ) => {
        await tx`set local role influx_leads_definer`;
        const result = await attempt(tx, statement, parameters);
        await tx`reset role`;
        return result;
      };
      await tx`
        insert into leads.transactional_sends (reference, email_code, priority, recipient_email, locale)
        values (gen_random_uuid(), 'auth.login_code', 'p0', ${member.email}, 'en'),
               (gen_random_uuid(), 'auth.login_code', 'p0', ${`t8-g3-${erased.id}@example.test`}, 'en')`;
      return {
        // the migration role (and any role but the privacy owner): append-only, the 0105 message,
        // even towards the marker of a deleted account
        owner: await attempt(
          tx,
          "update identity.email_delivery_incidents set email_address = $1 where account_id = $2",
          [erasedMarker, erased.id],
        ),
        ownerReport: codeOf(
          await attempt(
            tx,
            "update backoffice.code_delivery_reports set login_email = $1, contact_email = $1, " +
              "message = null where login_email = $2",
            [erasedMarker, member.email],
          ),
        ),
        ownerSend: codeOf(
          await attempt(
            tx,
            "update leads.transactional_sends set recipient_email = $1 where recipient_email = $2",
            [erasedMarker, member.email],
          ),
        ),
        // the privacy owner: the row of an ACTIVE account is out of its reach (policy)
        activeIncident: rowsOf(
          await asDefiner(
            "update identity.email_delivery_incidents set email_address = $1 where account_id = $2 " +
              "returning id",
            [`deleted+${member.id}@invalid`, member.id],
          ),
        ).length,
        // the privacy owner: another column, even of a deleted account's row (no right)
        otherColumn: codeOf(
          await asDefiner(
            "update identity.email_delivery_incidents set incident_type = 'hard_bounce' " +
              "where account_id = $1",
            [erased.id],
          ),
        ),
        // the privacy owner: a marker that is not the address of a deleted account
        report: codeOf(
          await asDefiner(
            "update backoffice.code_delivery_reports set login_email = $1, contact_email = $1, " +
              "message = null where login_email = $2",
            [`deleted+${member.id}@invalid`, member.email],
          ),
        ),
        send: codeOf(
          await asDefiner(
            "update leads.transactional_sends set recipient_email = $1 where recipient_email = $2",
            [`deleted+${member.id}@invalid`, member.email],
          ),
        ),
        // the leads owner still clears an address with its outcome only (0116)
        leadsClear: codeOf(
          await asLeadsDefiner(
            "update leads.brevo_inbound_events set email = null where email = $1",
            [member.email],
          ),
        ),
        // an erasure without its GoTrue deletion cannot close (CHECK erasure_completion)
        closeTooEarly: codeOf(
          await attempt(
            tx,
            "update privacy.request_executions set completed_at = now(), propagation_email = null " +
              "where account_id = $1",
            [erased.id],
          ),
        ),
        // the held address is never rewritten
        rewrite: codeOf(
          await attempt(
            tx,
            "update privacy.request_executions set propagation_email = 'other@example.test' " +
              "where account_id = $1",
            [erased.id],
          ),
        ),
        // an execution is never deleted
        deletion: codeOf(
          await attempt(
            tx,
            "delete from privacy.request_executions where account_id = $1",
            [erased.id],
          ),
        ),
      };
    });
    expect(outcome.owner).toMatchObject({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(
      outcome.owner.outcome === "error" && outcome.owner.message,
    ).toContain("append-only");
    expect(outcome.ownerReport).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.ownerSend).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.activeIncident).toBe(0);
    expect(outcome.otherColumn).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.report).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.send).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.leadsClear).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.closeTooEarly).toBe("23514");
    expect(outcome.rewrite).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.deletion).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("takes the erased account out of the GoTrue realignment (0125): it was a candidate, it no longer is", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const [change] = await tx<{ id: string }[]>`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${member.id}, ${`t8-r-${member.id}@example.test`}, ${member.email},
                sha256('t8-r1'::bytea), sha256('t8-r2'::bytea)) returning id::text`;
      await tx`alter table identity.email_change_requests disable trigger email_change_requests_guard_update`;
      await tx`
        update identity.email_change_requests
           set created_at = now() - interval '2 hours', expires_at = now() + interval '22 hours',
               old_confirmed_at = now() - interval '1 hour', new_confirmed_at = now() - interval '1 hour',
               completed_at = now() - interval '1 hour', old_code_hash = null, new_code_hash = null
         where id = ${String(change?.id)}`;
      await tx`alter table identity.email_change_requests enable trigger email_change_requests_guard_update`;
      const [run] = await tx<{ id: string }[]>`
        insert into ops.periodic_runs (task_code, period_key)
        values ('auth_orphan_purge', '2001-01-01T01') returning id::text`;
      const candidates = () =>
        asWorker(tx, () =>
          attempt(
            tx,
            "select account_id::text from ops.gotrue_realignment_candidates($1::uuid, 1::smallint, $2::uuid)",
            [String(run?.id), member.id],
          ),
        );
      const before = rowsOf(await candidates());
      const request = await deposit(tx, member, "erasure");
      await approve(tx, request, "erasure");
      rowsOf(await execute(tx, request, null));
      return { member, before, after: rowsOf(await candidates()) };
    });
    expect(outcome.before).toEqual([{ account_id: outcome.member.id }]);
    expect(outcome.after).toEqual([]);
  });
});

/** The eight list tables of the brand profile (0202) and their code column. */
const BRAND_LISTS = [
  ["advertiser_secondary_sectors", "sector_code"],
  ["advertiser_target_markets", "country_code"],
  ["advertiser_working_languages", "language_code"],
  ["advertiser_topics", "topic_code"],
  ["advertiser_networks", "network_code"],
  ["advertiser_formats", "format_code"],
  ["advertiser_audience_countries", "country_code"],
  ["advertiser_usage_rights", "usage_right_code"],
] as const;

/** Fills blocks 1 to 3 of an advertiser's profile (0202), as the superuser. */
async function fillBrandProfile(
  tx: Tx,
  account: string,
  label: string,
): Promise<void> {
  await tx`
    update profiles.advertiser_profiles
       set primary_sector_code = 'beauty_personal_care', company_size_band = '11_50',
           website_domain = ${`${label}.example`},
           presentation = ${`${label} presentation, a brand that writes its own words.`},
           exclusivity_band = 'le_3m', collaboration_rhythm = 'recurring',
           offers_non_monetary = true, contact_role = 'partnerships_influence',
           completeness_percent = 88
     where account_id = ${account}`;
  await tx`
    insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
    values (${account}, 1, 'home_garden'), (${account}, 2, 'retail_ecommerce')`;
  await tx`
    insert into profiles.advertiser_target_markets (account_id, slot, country_code)
    values (${account}, 1, 'FR'), (${account}, 2, 'BE')`;
  await tx`
    insert into profiles.advertiser_working_languages (account_id, language_code)
    values (${account}, 'fr'), (${account}, 'en')`;
  await tx`
    insert into profiles.advertiser_topics (account_id, slot, topic_code)
    values (${account}, 1, 'beauty'), (${account}, 2, 'wellness')`;
  await tx`
    insert into profiles.advertiser_networks (account_id, network_code)
    values (${account}, 'instagram'), (${account}, 'tiktok')`;
  await tx`
    insert into profiles.advertiser_formats (account_id, format_code)
    values (${account}, 'instagram_reel'), (${account}, 'tiktok_video')`;
  await tx`
    insert into profiles.advertiser_audience_countries (account_id, slot, country_code)
    values (${account}, 1, 'FR'), (${account}, 2, 'CH')`;
  await tx`
    insert into profiles.advertiser_usage_rights (account_id, usage_right_code)
    values (${account}, 'organic_repost')`;
  await tx`
    insert into profiles.advertiser_contact_details
      (account_id, contact_first_name, contact_email, contact_phone, contact_url)
    values (${account}, ${`${label} Camille`}, ${`${label}-contact@example.test`}, '+33612345678',
            ${`https://${label}.example/contact`})`;
}

/** What the base holds of an advertiser's profile, its lists and its contact person. */
async function brandProfileOf(tx: Tx, account: string): Promise<Row> {
  const [profile] = await tx<Row[]>`
    select legal_name, primary_sector_code, company_size_band, website_domain, presentation,
           exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role,
           completeness_percent
      from profiles.advertiser_profiles where account_id = ${account}`;
  const lists: Row = {};
  for (const [table, column] of BRAND_LISTS) {
    const rows = await tx.unsafe<{ code: string }[]>(
      `select ${column}::text as code from profiles.${table}
        where account_id = $1 order by 1`,
      [account],
    );
    lists[table] = rows.map((row) => row.code);
  }
  const contacts = await tx<Row[]>`
    select contact_first_name, contact_email, contact_phone, contact_url
      from profiles.advertiser_contact_details where account_id = ${account}`;
  return { profile, lists, contacts };
}

describe("the full brand profile of 0202 in the export and the erasure (04 §9.2, L2B)", () => {
  it("exports the whole profile, its lists in their order and its contact person; nothing of another brand", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await fillBrandProfile(tx, member.id, "t8-brand");
      await fillBrandProfile(tx, stranger.id, "t8-stranger");
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      rowsOf(await execute(tx, request, NOTICE));
      const [stored] = await tx<{ content: string }[]>`
        select content from privacy.data_exports where request_id = ${request}`;
      return { stored };
    });
    const content = String(outcome.stored?.content);
    const file = JSON.parse(content) as { data: Record<string, unknown> };
    expect(file.data.advertiser_profile).toEqual({
      legal_name: "T8 Privacy Brand",
      status: "draft",
      primary_sector: "beauty_personal_care",
      secondary_sectors: ["home_garden", "retail_ecommerce"],
      company_size: "11_50",
      target_markets: ["FR", "BE"],
      working_languages: ["en", "fr"],
      website_domain: "t8-brand.example",
      presentation: "t8-brand presentation, a brand that writes its own words.",
      topics: ["beauty", "wellness"],
      networks: ["instagram", "tiktok"],
      formats: ["instagram_reel", "tiktok_video"],
      audience_countries: ["FR", "CH"],
      usage_rights: ["organic_repost"],
      exclusivity: "le_3m",
      collaboration_rhythm: "recurring",
      offers_non_monetary: true,
      contact_role: "partnerships_influence",
      contact: {
        first_name: "t8-brand Camille",
        email: "t8-brand-contact@example.test",
        phone: "+33612345678",
        page_url: "https://t8-brand.example/contact",
        updated_at: expect.stringMatching(/Z$/),
      },
      completeness_percent: 88,
      logo_files: [],
      review_entries: [],
      field_revisions: [],
      created_at: expect.stringMatching(/Z$/),
      updated_at: expect.stringMatching(/Z$/),
    });
    // 15 RG81: the requester's data only, never another brand's
    expect(content.includes("t8-stranger")).toBe(false);
  });

  it("exports empty lists and no contact person for a profile never filled in", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      rowsOf(await execute(tx, request, NOTICE));
      const [stored] = await tx<{ content: string }[]>`
        select content from privacy.data_exports where request_id = ${request}`;
      return { stored };
    });
    const file = JSON.parse(String(outcome.stored?.content)) as {
      data: { advertiser_profile: Row };
    };
    expect(file.data.advertiser_profile).toMatchObject({
      legal_name: "T8 Privacy Brand",
      primary_sector: null,
      secondary_sectors: [],
      target_markets: [],
      working_languages: [],
      topics: [],
      networks: [],
      formats: [],
      audience_countries: [],
      usage_rights: [],
      offers_non_monetary: null,
      contact: null,
      completeness_percent: null,
    });
  });

  it("empties every column the brand entered, deletes its lists and empties its contact person (row kept); another brand is untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await fillBrandProfile(tx, member.id, "t8-erased");
      await fillBrandProfile(tx, stranger.id, "t8-kept");
      const request = await deposit(tx, member, "erasure");
      await approve(tx, request, "erasure");
      rowsOf(await execute(tx, request, null));
      return {
        erased: await brandProfileOf(tx, member.id),
        kept: await brandProfileOf(tx, stranger.id),
      };
    });
    expect(outcome.erased).toEqual({
      profile: {
        legal_name: "[deleted]",
        primary_sector_code: null,
        company_size_band: null,
        website_domain: null,
        presentation: null,
        exclusivity_band: null,
        collaboration_rhythm: null,
        offers_non_monetary: null,
        contact_role: null,
        completeness_percent: null,
      },
      lists: Object.fromEntries(BRAND_LISTS.map(([table]) => [table, []])),
      contacts: [
        {
          contact_first_name: null,
          contact_email: null,
          contact_phone: null,
          contact_url: null,
        },
      ],
    });
    expect(outcome.kept).toEqual({
      profile: {
        legal_name: "T8 Privacy Brand",
        primary_sector_code: "beauty_personal_care",
        company_size_band: "11_50",
        website_domain: "t8-kept.example",
        presentation:
          "t8-kept presentation, a brand that writes its own words.",
        exclusivity_band: "le_3m",
        collaboration_rhythm: "recurring",
        offers_non_monetary: true,
        contact_role: "partnerships_influence",
        completeness_percent: 88,
      },
      lists: {
        advertiser_secondary_sectors: ["home_garden", "retail_ecommerce"],
        advertiser_target_markets: ["BE", "FR"],
        advertiser_working_languages: ["en", "fr"],
        advertiser_topics: ["beauty", "wellness"],
        advertiser_networks: ["instagram", "tiktok"],
        advertiser_formats: ["instagram_reel", "tiktok_video"],
        advertiser_audience_countries: ["CH", "FR"],
        advertiser_usage_rights: ["organic_repost"],
      },
      contacts: [
        {
          contact_first_name: "t8-kept Camille",
          contact_email: "t8-kept-contact@example.test",
          contact_phone: "+33612345678",
          contact_url: "https://t8-kept.example/contact",
        },
      ],
    });
  });

  // EC-L2B-05-6: the owner of E-5 anonymises and does nothing else, even on an erased account
  it.each([
    [
      "the name alone, a presentation left",
      "update profiles.advertiser_profiles set legal_name = '[deleted]' where account_id = $1",
    ],
    [
      "a new presentation",
      "update profiles.advertiser_profiles set legal_name = '[deleted]', presentation = 'x', " +
        "primary_sector_code = null, company_size_band = null, website_domain = null, " +
        "exclusivity_band = null, collaboration_rhythm = null, offers_non_monetary = null, " +
        "contact_role = null, completeness_percent = null where account_id = $1",
    ],
    [
      "a contact person rewritten",
      "update profiles.advertiser_contact_details set contact_phone = '+33700000000' " +
        "where account_id = $1",
    ],
  ])(
    "refuses to influx_privacy_definer %s on an erased account (42501)",
    async (_label, statement) => {
      const result = await scenario(async (tx) => {
        const member = await newMember(tx, "advertiser");
        await fillBrandProfile(tx, member.id, "t8-guard");
        await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${member.id}`;
        await tx.unsafe("set local role influx_privacy_definer");
        const attempted = await attempt(tx, statement, [member.id]);
        await tx.unsafe("reset role");
        return attempted;
      });
      expect(codeOf(result)).toBe(INSUFFICIENT_PRIVILEGE);
    },
  );

  it("lets influx_privacy_definer touch nothing of an active account", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      await fillBrandProfile(tx, member.id, "t8-active");
      await tx.unsafe("set local role influx_privacy_definer");
      const results = {
        list: await attempt(
          tx,
          "delete from profiles.advertiser_topics where account_id = $1 returning 1",
          [member.id],
        ),
        contact: await attempt(
          tx,
          "update profiles.advertiser_contact_details set contact_first_name = null, " +
            "contact_email = null, contact_phone = null, contact_url = null " +
            "where account_id = $1 returning 1",
          [member.id],
        ),
      };
      await tx.unsafe("reset role");
      return { results, after: await brandProfileOf(tx, member.id) };
    });
    expect(rowsOf(outcome.results.list)).toEqual([]);
    expect(rowsOf(outcome.results.contact)).toEqual([]);
    expect(outcome.after.lists).toMatchObject({
      advertiser_topics: ["beauty", "wellness"],
    });
    expect(outcome.after.contacts).toEqual([
      expect.objectContaining({ contact_first_name: "t8-active Camille" }),
    ]);
  });
});

/**
 * Gives an advertiser an active logo, an older one still to purge and a pending upload (0204), and
 * the Storage usage of today and of yesterday, as the superuser.
 */
async function giveBrandLogo(tx: Tx, account: string): Promise<void> {
  await tx`
    insert into profiles.brand_logo_objects
      (account_id, state, received_bytes, byte_size, width, height, activated_at,
       purge_requested_at, created_at)
    values (${account}, 'purging', 90000, 40000, 512, 512, now() - interval '2 days',
            now() - interval '1 day', now() - interval '2 days'),
           (${account}, 'active', 80000, 30000, 512, 512, now() - interval '1 day', null,
            now() - interval '1 day'),
           (${account}, 'pending', 70000, null, null, null, null, null, now())`;
  await tx`
    insert into profiles.storage_daily_usage
      (account_id, bucket_id, usage_day, upload_count, received_bytes)
    values (${account}, 'brand-logo', (now() at time zone 'UTC')::date, 1, 70000),
           (${account}, 'brand-logo', (now() at time zone 'UTC')::date - 1, 2, 170000)`;
}

async function brandLogoOf(
  tx: Tx,
  account: string,
): Promise<{ logos: Row[]; usage: number }> {
  const logos = await tx<Row[]>`
    select state::text as state, purge_requested_at is not null as to_purge
      from profiles.brand_logo_objects where account_id = ${account}
     order by created_at`;
  const [usage] = await tx<{ count: number }[]>`
    select count(*)::int as count from profiles.storage_daily_usage
     where account_id = ${account}`;
  return { logos, usage: usage?.count ?? 0 };
}

describe("the brand logo of 0204 in the export and the erasure (04 §9.2, stockage.md §7)", () => {
  it("exports the metadata of each logo file, never its bytes nor its key", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await giveBrandLogo(tx, member.id);
      await giveBrandLogo(tx, stranger.id);
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      rowsOf(await execute(tx, request, NOTICE));
      const [stored] = await tx<{ content: string }[]>`
        select content from privacy.data_exports where request_id = ${request}`;
      return { stored, member, stranger };
    });
    const content = String(outcome.stored?.content);
    const file = JSON.parse(content) as {
      data: { advertiser_profile: { logo_files: unknown } };
    };
    const at = expect.stringMatching(/Z$/);
    expect(file.data.advertiser_profile.logo_files).toEqual([
      {
        state: "purging",
        byte_size: 40000,
        width: 512,
        height: 512,
        created_at: at,
        activated_at: at,
      },
      {
        state: "active",
        byte_size: 30000,
        width: 512,
        height: 512,
        created_at: at,
        activated_at: at,
      },
      {
        state: "pending",
        byte_size: null,
        width: null,
        height: null,
        created_at: at,
        activated_at: null,
      },
    ]);
    // no key, no other brand's file: neither account id appears beyond the account's own fields
    expect(content.includes(".webp")).toBe(false);
    expect(content.includes(outcome.stranger.id)).toBe(false);
  });

  it("sends every logo object of the erased brand to purge and deletes its usage; another brand is untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await giveBrandLogo(tx, member.id);
      await giveBrandLogo(tx, stranger.id);
      const request = await deposit(tx, member, "erasure");
      await approve(tx, request, "erasure");
      rowsOf(await execute(tx, request, null));
      return {
        erased: await brandLogoOf(tx, member.id),
        kept: await brandLogoOf(tx, stranger.id),
      };
    });
    expect(outcome.erased).toEqual({
      logos: [
        { state: "purging", to_purge: true },
        { state: "purging", to_purge: true },
        { state: "purging", to_purge: true },
      ],
      usage: 0,
    });
    expect(outcome.kept).toEqual({
      logos: [
        { state: "purging", to_purge: true },
        { state: "active", to_purge: false },
        { state: "pending", to_purge: false },
      ],
      usage: 2,
    });
  });

  it.each([
    [
      "a logo made active again",
      "update profiles.brand_logo_objects set state = 'active', purge_requested_at = null " +
        "where account_id = $1 and state = 'active'",
    ],
    [
      "a logo resized",
      "update profiles.brand_logo_objects set byte_size = 1 where account_id = $1",
    ],
    [
      "a logo row deleted",
      "delete from profiles.brand_logo_objects where account_id = $1",
    ],
  ])(
    "refuses to influx_privacy_definer %s on an erased account (42501)",
    async (_label, statement) => {
      const result = await scenario(async (tx) => {
        const member = await newMember(tx, "advertiser");
        await giveBrandLogo(tx, member.id);
        await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${member.id}`;
        await tx.unsafe("set local role influx_privacy_definer");
        const attempted = await attempt(tx, statement, [member.id]);
        await tx.unsafe("reset role");
        return attempted;
      });
      expect(codeOf(result)).toBe(INSUFFICIENT_PRIVILEGE);
    },
  );

  it("lets influx_privacy_definer touch no logo nor usage of an active account", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      await giveBrandLogo(tx, member.id);
      await tx.unsafe("set local role influx_privacy_definer");
      const results = {
        logo: await attempt(
          tx,
          "update profiles.brand_logo_objects set state = 'purging', " +
            "purge_requested_at = now() where account_id = $1 returning 1",
          [member.id],
        ),
        usage: await attempt(
          tx,
          "delete from profiles.storage_daily_usage where account_id = $1 returning 1",
          [member.id],
        ),
      };
      await tx.unsafe("reset role");
      return { results, after: await brandLogoOf(tx, member.id) };
    });
    expect(rowsOf(outcome.results.logo)).toEqual([]);
    expect(rowsOf(outcome.results.usage)).toEqual([]);
    expect(outcome.after).toEqual({
      logos: [
        { state: "purging", to_purge: true },
        { state: "active", to_purge: false },
        { state: "pending", to_purge: false },
      ],
      usage: 2,
    });
  });
});

const REVIEW_MESSAGE = "t8-review message to the brand, written by the agent.";
const REVIEW_COMMENT = "t8-review internal comment, never to the brand.";
const REVIEW_VALUE = "t8-review submitted presentation";

/**
 * Gives an advertiser two examinations of queue 1 (0207), as the superuser: a refused submission
 * with its message and its internal comment, and an open revision, claimed, with a pending value.
 */
async function giveReviewEntries(tx: Tx, account: string): Promise<void> {
  const agent = accountIdOf("agent", "a");
  const [refused] = await tx<{ id: string }[]>`
    insert into profiles.advertiser_review_entries (account_id, kind)
    values (${account}, 'submission') returning id::text`;
  await tx`
    update profiles.advertiser_review_entries
       set created_at = now() - interval '1 day', state = 'rejected',
           decided_by_account_id = ${agent}, decided_at = now(), closed_at = now(),
           rejection_reason_code = 'other', member_message = ${REVIEW_MESSAGE},
           internal_comment = ${REVIEW_COMMENT}
     where id = ${String(refused?.id)}`;
  const [open] = await tx<{ id: string }[]>`
    insert into profiles.advertiser_review_entries (account_id, kind)
    values (${account}, 'revision') returning id::text`;
  await tx`
    update profiles.advertiser_review_entries
       set claimed_by_account_id = ${agent}, claimed_at = now(),
           claim_expires_at = now() + interval '30 minutes',
           internal_comment = ${REVIEW_COMMENT}
     where id = ${String(open?.id)}`;
  await tx`
    insert into profiles.profile_field_revisions
      (account_id, field_code, proposed_value, advertiser_review_entry_id)
    values (${account}, 'advertiser.presentation', to_jsonb(${REVIEW_VALUE}::text),
            ${String(open?.id)})`;
}

async function reviewOf(
  tx: Tx,
  account: string,
): Promise<{ entries: Row[]; revisions: number }> {
  const entries = await tx<Row[]>`
    select kind::text as kind, state::text as state, closed_at is not null as closed,
           decided_by_account_id is not null as decided, rejection_reason_code as reason,
           member_message, internal_comment
      from profiles.advertiser_review_entries
     where account_id = ${account}
     order by created_at`;
  const [revisions] = await tx<{ count: number }[]>`
    select count(*)::int as count from profiles.profile_field_revisions
     where account_id = ${account}`;
  return { entries, revisions: revisions?.count ?? 0 };
}

describe("the examinations of 0207 in the export and the erasure (file.md A1, 04 §9.2)", () => {
  it("exports each entry and each submitted value, never the internal comment, an agent nor the lock", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await giveReviewEntries(tx, member.id);
      await giveReviewEntries(tx, stranger.id);
      const request = await deposit(tx, member, "access");
      await approve(tx, request, "access");
      rowsOf(await execute(tx, request, NOTICE));
      const [stored] = await tx<{ content: string }[]>`
        select content from privacy.data_exports where request_id = ${request}`;
      return { stored, stranger };
    });
    const content = String(outcome.stored?.content);
    const file = JSON.parse(content) as {
      data: {
        advertiser_profile: {
          review_entries: unknown;
          field_revisions: unknown;
        };
      };
    };
    const at = expect.stringMatching(/Z$/);
    expect(file.data.advertiser_profile.review_entries).toEqual([
      {
        kind: "submission",
        state: "rejected",
        created_at: at,
        decided_at: at,
        rejection_reason: "other",
        member_message: REVIEW_MESSAGE,
        closed_at: at,
      },
      {
        kind: "revision",
        state: "open",
        created_at: at,
        decided_at: null,
        rejection_reason: null,
        member_message: null,
        closed_at: null,
      },
    ]);
    expect(file.data.advertiser_profile.field_revisions).toEqual([
      {
        field: "advertiser.presentation",
        row_key: null,
        proposed_value: REVIEW_VALUE,
        status: "pending_review",
        submitted_at: at,
        closed_at: null,
      },
    ]);
    expect(content.includes(REVIEW_COMMENT)).toBe(false);
    expect(content.includes(accountIdOf("agent", "a"))).toBe(false);
    expect(content.includes(outcome.stranger.id)).toBe(false);
  });

  it("deletes the revisions of the erased brand, empties the texts and withdraws the open entry; another brand is untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const stranger = await newMember(tx, "advertiser");
      await giveReviewEntries(tx, member.id);
      await giveReviewEntries(tx, stranger.id);
      const request = await deposit(tx, member, "erasure");
      await approve(tx, request, "erasure");
      rowsOf(await execute(tx, request, null));
      return {
        erased: await reviewOf(tx, member.id),
        kept: await reviewOf(tx, stranger.id),
      };
    });
    expect(outcome.erased).toEqual({
      entries: [
        {
          kind: "submission",
          state: "rejected",
          closed: true,
          decided: true,
          reason: "other",
          member_message: null,
          internal_comment: null,
        },
        {
          kind: "revision",
          state: "withdrawn",
          closed: true,
          decided: false,
          reason: null,
          member_message: null,
          internal_comment: null,
        },
      ],
      revisions: 0,
    });
    expect(outcome.kept).toEqual({
      entries: [
        {
          kind: "submission",
          state: "rejected",
          closed: true,
          decided: true,
          reason: "other",
          member_message: REVIEW_MESSAGE,
          internal_comment: REVIEW_COMMENT,
        },
        {
          kind: "revision",
          state: "open",
          closed: false,
          decided: false,
          reason: null,
          member_message: null,
          internal_comment: REVIEW_COMMENT,
        },
      ],
      revisions: 1,
    });
  });

  it.each([
    [
      "reading the internal comment",
      "select internal_comment from profiles.advertiser_review_entries where account_id = $1",
    ],
    [
      "reading the holder of the lock",
      "select claimed_by_account_id from profiles.advertiser_review_entries where account_id = $1",
    ],
    [
      "rewriting the author of a decision",
      "update profiles.advertiser_review_entries set decided_by_account_id = account_id " +
        "where account_id = $1",
    ],
    [
      "rewriting the reason of a refusal",
      "update profiles.advertiser_review_entries set rejection_reason_code = null " +
        "where account_id = $1",
    ],
    [
      "reopening an entry of an erased account",
      "update profiles.advertiser_review_entries set state = 'open', closed_at = null " +
        "where account_id = $1 and state = 'withdrawn'",
    ],
    [
      "writing a text on an entry of an erased account",
      "update profiles.advertiser_review_entries set internal_comment = 'written back' " +
        "where account_id = $1 and state = 'withdrawn'",
    ],
    [
      "deleting an entry",
      "delete from profiles.advertiser_review_entries where account_id = $1",
    ],
    [
      "writing back a revision",
      "update profiles.profile_field_revisions set status = 'withdrawn' where account_id = $1",
    ],
  ])(
    "refuses to influx_privacy_definer %s (42501)",
    async (_label, statement) => {
      const result = await scenario(async (tx) => {
        const member = await newMember(tx, "advertiser");
        await giveReviewEntries(tx, member.id);
        await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                  where id = ${member.id}`;
        await tx`
          update profiles.advertiser_review_entries
             set state = 'withdrawn', closed_at = now(), internal_comment = null
           where account_id = ${member.id} and state = 'open'`;
        await tx.unsafe("set local role influx_privacy_definer");
        const attempted = await attempt(tx, statement, [member.id]);
        await tx.unsafe("reset role");
        return attempted;
      });
      expect(codeOf(result)).toBe(INSUFFICIENT_PRIVILEGE);
    },
  );

  it("lets influx_privacy_definer touch no entry nor revision of an active account", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      await giveReviewEntries(tx, member.id);
      const before = await reviewOf(tx, member.id);
      await tx.unsafe("set local role influx_privacy_definer");
      const results = {
        entries: await attempt(
          tx,
          "update profiles.advertiser_review_entries set state = 'withdrawn', " +
            "closed_at = now(), member_message = null, internal_comment = null " +
            "where account_id = $1 returning 1",
          [member.id],
        ),
        revisions: await attempt(
          tx,
          "delete from profiles.profile_field_revisions where account_id = $1 returning 1",
          [member.id],
        ),
      };
      await tx.unsafe("reset role");
      return { results, before, after: await reviewOf(tx, member.id) };
    });
    expect(rowsOf(outcome.results.entries)).toEqual([]);
    expect(rowsOf(outcome.results.revisions)).toEqual([]);
    expect(outcome.after).toEqual(outcome.before);
  });
});

describe("the freeze of 0209 stops a member, never the erasure (file.md A4, 04 §9.2)", () => {
  it.each([["published"], ["suspended"]])(
    "erases a %s profile: its columns and lists emptied, a logo under review sent to purge",
    async (status) => {
      const outcome = await scenario(async (tx) => {
        const member = await newMember(tx, "advertiser");
        await fillBrandProfile(tx, member.id, "t8-frozen");
        await tx`
          insert into profiles.brand_logo_objects
            (account_id, state, received_bytes, byte_size, width, height)
          values (${member.id}, 'in_review', 1000, 500, 512, 512)`;
        await tx.unsafe(
          "update profiles.advertiser_profiles " +
            "set status = $1::profiles.advertiser_profile_status where account_id = $2",
          [status, member.id],
        );
        const request = await deposit(tx, member, "erasure");
        await approve(tx, request, "erasure");
        rowsOf(await execute(tx, request, null));
        return {
          profile: await brandProfileOf(tx, member.id),
          logos: (await brandLogoOf(tx, member.id)).logos,
        };
      });
      expect(outcome.profile).toMatchObject({
        profile: { legal_name: "[deleted]", presentation: null },
        lists: { advertiser_topics: [] },
      });
      expect(outcome.logos).toEqual([{ state: "purging", to_purge: true }]);
    },
  );
});

describe("privacy.record_auth_user_deleted() and privacy.complete_request() (15 RG77, RG79, RG85)", () => {
  it("records the GoTrue deletion once, of an executed erasure only", async () => {
    const outcome = await scenario(async (tx) => {
      const { request } = await executedErasure(tx);
      const { request: access } = await executedAccess(tx);
      const record = (id: string) =>
        asPrivacy(tx, () =>
          attempt(
            tx,
            "select privacy.record_auth_user_deleted($1::uuid) as recorded",
            [id],
          ),
        );
      return {
        first: rowsOf(await record(request))[0]?.recorded,
        second: rowsOf(await record(request))[0]?.recorded,
        access: rowsOf(await record(access))[0]?.recorded,
      };
    });
    expect(outcome).toEqual({ first: true, second: false, access: false });
  });

  type Case = {
    gotrue: boolean;
    brevo: {
      status: "pending" | "succeeded" | "skipped" | "failed";
      dryRun?: boolean;
      skipReason?: string;
    };
    apollo: {
      status: "pending" | "succeeded" | "skipped" | "failed";
      dryRun?: boolean;
      skipReason?: string;
    };
    apolloEverSynced?: boolean;
    /** The e-mail privacy.erasure_completed (D72); sent with its messageId when absent. */
    mail?: {
      status: "pending" | "succeeded" | "failed";
      dryRun?: boolean;
      messageId?: string;
    };
    closes: boolean;
  };
  const SKIPPED = {
    status: "skipped",
    skipReason: "connector_disabled",
  } as const;
  it.each<[string, Case]>([
    [
      "Brevo succeeded live, Apollo skipped never synced: closes",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        closes: true,
      },
    ],
    [
      "Brevo and Apollo succeeded live: closes",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: { status: "succeeded" },
        apolloEverSynced: true,
        closes: true,
      },
    ],
    [
      "the GoTrue user not deleted yet: waits",
      {
        gotrue: false,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        closes: false,
      },
    ],
    [
      "Brevo pending: waits",
      {
        gotrue: true,
        brevo: { status: "pending" },
        apollo: SKIPPED,
        closes: false,
      },
    ],
    [
      "Brevo failed: waits (manual follow-up)",
      {
        gotrue: true,
        brevo: { status: "failed" },
        apollo: SKIPPED,
        closes: false,
      },
    ],
    [
      "Brevo succeeded in dry run: waits",
      {
        gotrue: true,
        brevo: { status: "succeeded", dryRun: true },
        apollo: SKIPPED,
        closes: false,
      },
    ],
    [
      "Brevo skipped: waits",
      {
        gotrue: true,
        brevo: { status: "skipped", skipReason: "contact_absent" },
        apollo: SKIPPED,
        closes: false,
      },
    ],
    [
      "Apollo skipped after it held the contact: waits (EC-J8-43)",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        apolloEverSynced: true,
        closes: false,
      },
    ],
    [
      "Apollo pending: waits",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: { status: "pending" },
        closes: false,
      },
    ],
    [
      "Apollo succeeded in dry run: waits",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: { status: "succeeded", dryRun: true },
        closes: false,
      },
    ],
    [
      "the e-mail privacy.erasure_completed pending: waits (D72)",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        mail: { status: "pending" },
        closes: false,
      },
    ],
    [
      "the e-mail privacy.erasure_completed failed: waits (D72)",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        mail: { status: "failed" },
        closes: false,
      },
    ],
    [
      "the e-mail privacy.erasure_completed in dry run: waits (D72)",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        mail: { status: "succeeded", dryRun: true },
        closes: false,
      },
    ],
    [
      "the e-mail privacy.erasure_completed sent without a messageId: waits (D72)",
      {
        gotrue: true,
        brevo: { status: "succeeded" },
        apollo: SKIPPED,
        mail: { status: "succeeded" },
        closes: false,
      },
    ],
  ])("erasure: %s", async (_label, testCase) => {
    const outcome = await scenario(async (tx) => {
      const { member, request } = await executedErasure(tx);
      if (testCase.apolloEverSynced === true) {
        await tx`
          insert into leads.contact_sync_states (account_id, destination, last_attempt_at,
                                                 last_success_at, last_status)
          values (${member.id}, 'apollo_contact', now() - interval '1 day',
                  now() - interval '1 day', 'succeeded')`;
      }
      if (testCase.gotrue) {
        await asPrivacy(tx, () =>
          attempt(tx, "select privacy.record_auth_user_deleted($1::uuid)", [
            request,
          ]),
        );
      }
      await settle(
        tx,
        member.id,
        "account.deleted",
        "brevo_contact",
        testCase.brevo,
      );
      await settle(
        tx,
        member.id,
        "account.deleted",
        "apollo_contact",
        testCase.apollo,
      );
      await settle(
        tx,
        member.id,
        "privacy.erasure_completed",
        "brevo_transactional",
        testCase.mail ?? { status: "succeeded", messageId: ERASURE_MESSAGE_ID },
      );
      const closed = rowsOf(
        await asPrivacy(tx, () =>
          attempt(tx, "select privacy.complete_request($1::uuid) as outcome", [
            request,
          ]),
        ),
      )[0]?.outcome;
      const [state] = await tx<Row[]>`
        select d.status::text as status, d.outcome_code::text as outcome_code,
               d.completed_at is not null as request_completed,
               e.completed_at is not null as execution_completed, e.propagation_email,
               e.notification_message_id
          from backoffice.data_subject_requests d
          join privacy.request_executions e on e.request_id = d.id
         where d.id = ${request}`;
      return {
        member,
        closed,
        state,
        register: await registerLines(tx, "privacy.request_completed", request),
      };
    });
    if (testCase.closes) {
      expect(outcome.closed).toBe("satisfaite");
      expect(outcome.state).toEqual({
        status: "closed",
        outcome_code: "satisfaite",
        request_completed: true,
        execution_completed: true,
        propagation_email: null,
        notification_message_id: ERASURE_MESSAGE_ID,
      });
      expect(outcome.register).toEqual([
        {
          actor_type: "system",
          payload: {
            request_type: "erasure",
            outcome_code: "satisfaite",
            brevo: { status: "succeeded", skip_reason: null },
            apollo: {
              status: testCase.apollo.status,
              skip_reason: testCase.apollo.skipReason ?? null,
              ever_synced: testCase.apolloEverSynced === true,
            },
          },
        },
      ]);
    } else {
      expect(outcome.closed).toBeNull();
      expect(outcome.state).toEqual({
        status: "in_progress",
        outcome_code: null,
        request_completed: false,
        execution_completed: false,
        propagation_email: outcome.member.email,
        notification_message_id: null,
      });
      expect(outcome.register).toEqual([]);
    }
  });

  it.each([
    [
      "the e-mail sent, with its messageId: closes and keeps the messageId (RG85)",
      { status: "succeeded", messageId: "<t8-message@smtp-relay.brevo.com>" },
      true,
    ],
    [
      "the e-mail in dry run: waits",
      { status: "succeeded", dryRun: true },
      false,
    ],
    ["the e-mail pending: waits", { status: "pending" }, false],
    ["the e-mail failed: waits", { status: "failed" }, false],
  ] as const)("access: %s", async (_label, mail, closes) => {
    const outcome = await scenario(async (tx) => {
      const { member, request } = await executedAccess(tx);
      await settle(
        tx,
        member.id,
        "privacy.export_ready",
        "brevo_transactional",
        { ...mail },
      );
      const closed = rowsOf(
        await asPrivacy(tx, () =>
          attempt(tx, "select privacy.complete_request($1::uuid) as outcome", [
            request,
          ]),
        ),
      )[0]?.outcome;
      const [state] = await tx<Row[]>`
        select d.status::text as status, e.notification_message_id
          from backoffice.data_subject_requests d
          join privacy.request_executions e on e.request_id = d.id
         where d.id = ${request}`;
      return {
        closed,
        state,
        register: await registerLines(tx, "privacy.request_completed", request),
      };
    });
    if (closes) {
      expect(outcome.closed).toBe("satisfaite");
      expect(outcome.state).toEqual({
        status: "closed",
        notification_message_id: "<t8-message@smtp-relay.brevo.com>",
      });
      // never the messageId in the register
      expect(outcome.register).toEqual([
        {
          actor_type: "system",
          payload: { request_type: "access", outcome_code: "satisfaite" },
        },
      ]);
    } else {
      expect(outcome.closed).toBeNull();
      expect(outcome.state).toEqual({
        status: "in_progress",
        notification_message_id: null,
      });
    }
  });
});

// ---------------------------------------------------------------------------------------------
// D72 (0150, D72 §2.1, §2.2, §2.4): the erasure authorised by the member.

const SUBMIT_ERASURE =
  "select request_id::text, status, created from identity.submit_member_erasure()";

/** The fresh code account_deletion of a member session (decision 4 of J7), as E-2 writes it. */
async function markAccountDeletion(tx: Tx, session: string): Promise<void> {
  await tx`update identity.sessions
              set reauthenticated_at = now(), reauth_purpose = 'account_deletion'
            where id = ${session}`;
}

/** A second open member session of the same account (another device). */
async function otherSession(tx: Tx, member: Member): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${member.id}, 'member', 'safari.ios')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

/** The member authorises the erasure of his own account (fresh code, then the function). */
async function memberErasure(tx: Tx, member: Member): Promise<string> {
  await markAccountDeletion(tx, member.session);
  const rows = rowsOf(
    await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
  );
  return String(rows[0]?.request_id);
}

const INSERT_EXECUTION =
  "insert into privacy.request_executions (request_id, request_type, account_id, authorised_by, " +
  "dual_control_request_id, approved_by_account_id) values ($1::uuid, " +
  "$2::backoffice.data_request_type, $3::uuid, $4, $5::uuid, $6::uuid)";

describe("privacy.request_executions: who authorised the execution (0150 §2.4, T3)", () => {
  it("refuses by CHECK a member authorisation of an access, a member authorisation with a 2V, an admin one without it, an approver who is the subject", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const access = await deposit(tx, member, "access");
      const erasure = await deposit(tx, member, "erasure");
      const dualControl = randomUUID();
      const insert = (
        request: string,
        type: "access" | "erasure",
        by: string,
        twoV: string | null,
        approver: string | null,
      ) =>
        attempt(tx, INSERT_EXECUTION, [
          request,
          type,
          member.id,
          by,
          twoV,
          approver,
        ]);
      return {
        memberAccess: codeOf(
          await insert(access, "access", "member_fresh_code", null, null),
        ),
        memberWith2V: codeOf(
          await insert(
            erasure,
            "erasure",
            "member_fresh_code",
            dualControl,
            adminA,
          ),
        ),
        memberWithApprover: codeOf(
          await insert(erasure, "erasure", "member_fresh_code", null, adminA),
        ),
        adminWithout2V: codeOf(
          await insert(erasure, "erasure", "admin_dual_control", null, null),
        ),
        adminWithoutApprover: codeOf(
          await insert(
            erasure,
            "erasure",
            "admin_dual_control",
            dualControl,
            null,
          ),
        ),
        approverIsSubject: codeOf(
          await insert(
            erasure,
            "erasure",
            "admin_dual_control",
            dualControl,
            member.id,
          ),
        ),
        unknown: codeOf(
          await insert(erasure, "erasure", "agent_decision", null, null),
        ),
        // the one valid shape of a member authorisation (written here by the superuser)
        member: codeOf(
          await insert(erasure, "erasure", "member_fresh_code", null, null),
        ),
      };
    });
    expect(outcome).toEqual({
      memberAccess: CHECK_VIOLATION,
      memberWith2V: CHECK_VIOLATION,
      memberWithApprover: CHECK_VIOLATION,
      adminWithout2V: CHECK_VIOLATION,
      adminWithoutApprover: CHECK_VIOLATION,
      approverIsSubject: CHECK_VIOLATION,
      unknown: CHECK_VIOLATION,
      member: "rows",
    });
  });

  it("lets no member, agent nor admin insert an execution directly (42501): only the functions write", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newMember(tx, "creator");
      const advertiser = await newMember(tx, "advertiser");
      const insertOwn = (member: Member, request: string) =>
        asMember(tx, member, () =>
          attempt(tx, INSERT_EXECUTION, [
            request,
            "erasure",
            member.id,
            "member_fresh_code",
            null,
            null,
          ]),
        );
      const creatorRequest = await deposit(tx, creator, "erasure");
      const advertiserRequest = await deposit(tx, advertiser, "erasure");
      return {
        creator: codeOf(await insertOwn(creator, creatorRequest)),
        advertiser: codeOf(await insertOwn(advertiser, advertiserRequest)),
        agent: codeOf(
          await asAgent(tx, () =>
            attempt(tx, INSERT_EXECUTION, [
              creatorRequest,
              "erasure",
              creator.id,
              "member_fresh_code",
              null,
              null,
            ]),
          ),
        ),
        admin: codeOf(
          await asAdmin(tx, adminA, () =>
            attempt(tx, INSERT_EXECUTION, [
              creatorRequest,
              "erasure",
              creator.id,
              "member_fresh_code",
              null,
              null,
            ]),
          ),
        ),
        // the authorisation never changes afterwards (update guard, superuser included)
        frozen: await (async () => {
          rowsOf(
            await attempt(tx, INSERT_EXECUTION, [
              advertiserRequest,
              "erasure",
              advertiser.id,
              "member_fresh_code",
              null,
              null,
            ]),
          );
          return codeOf(
            await attempt(
              tx,
              "update privacy.request_executions set authorised_by = 'admin_dual_control' " +
                "where request_id = $1::uuid",
              [advertiserRequest],
            ),
          );
        })(),
      };
    });
    expect(outcome).toEqual({
      creator: INSUFFICIENT_PRIVILEGE,
      advertiser: INSUFFICIENT_PRIVILEGE,
      agent: INSUFFICIENT_PRIVILEGE,
      admin: INSUFFICIENT_PRIVILEGE,
      frozen: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("identity.submit_member_erasure() (0150 §2.1, D72)", () => {
  it("authorises the erasure in one transaction: request in_progress, execution without 2V, every session revoked, two register lines, no e-mail", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx, "advertiser");
      const second = await otherSession(tx, member);
      await markAccountDeletion(tx, member.session);
      const submitted = rowsOf(
        await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
      );
      const request = String(submitted[0]?.request_id);
      const [row] = await tx<Row[]>`
        select d.request_type::text as request_type, d.channel::text as channel,
               d.status::text as status, e.authorised_by, e.dual_control_request_id,
               e.approved_by_account_id, e.executed_at
          from backoffice.data_subject_requests d
          join privacy.request_executions e on e.request_id = d.id
         where d.id = ${request}`;
      const sessions = await tx<Row[]>`
        select id::text as id, revoked_at is not null as revoked,
               revocation_reason::text as reason, reauth_purpose::text as marker
          from identity.sessions where account_id = ${member.id} order by created_at, id`;
      const [counts] = await tx<{ acks: number; dual_controls: number }[]>`
        select (select count(*)::int from leads.outbox_events
                 where event_type = 'privacy.request_received'
                   and payload ->> 'request_id' = ${request}) as acks,
               (select count(*)::int from backoffice.dual_control_requests
                 where payload ->> 'request_id' = ${request}) as dual_controls`;
      return {
        member,
        second,
        submitted,
        row,
        sessions,
        counts,
        received: await registerLines(tx, "privacy.request_received", request),
        authorised: await registerLines(
          tx,
          "privacy.execution_authorised_by_member",
          request,
        ),
        work: await workOf(tx, request),
      };
    });
    expect(outcome.submitted).toEqual([
      {
        request_id: expect.any(String),
        status: "in_progress",
        created: true,
      },
    ]);
    expect(outcome.row).toEqual({
      request_type: "erasure",
      channel: "self_service",
      status: "in_progress",
      authorised_by: "member_fresh_code",
      dual_control_request_id: null,
      approved_by_account_id: null,
      executed_at: null,
    });
    expect(outcome.sessions).toHaveLength(2);
    for (const session of outcome.sessions) {
      expect(session).toMatchObject({
        revoked: true,
        reason: "revoked_by_holder",
        marker: null,
      });
    }
    expect(outcome.counts).toEqual({ acks: 0, dual_controls: 0 });
    expect(outcome.received).toEqual([
      { actor_type: "member", payload: { request_type: "erasure" } },
    ]);
    expect(outcome.authorised).toEqual([
      {
        actor_type: "member",
        payload: { request_type: "erasure", sessions_revoked: 2 },
      },
    ]);
    // the worker takes it at its next turn, like an approved request
    expect(outcome.work).toEqual([
      expect.objectContaining({
        step: "execute",
        account_id: outcome.member.id,
      }),
    ]);
  });

  it("writes nothing without a fresh code account_deletion of the session (55000), or with the export code", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const none = codeOf(
        await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
      );
      await markDataExport(tx, member.session);
      const wrongPurpose = codeOf(
        await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
      );
      // the code of another session of the same account never serves (J7S-1)
      const second = await otherSession(tx, member);
      await markAccountDeletion(tx, second);
      const otherSessionCode = codeOf(
        await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
      );
      const [counts] = await tx<{ requests: number; revoked: number }[]>`
        select (select count(*)::int from backoffice.data_subject_requests
                 where requester_account_id = ${member.id}) as requests,
               (select count(*)::int from identity.sessions
                 where account_id = ${member.id} and revoked_at is not null) as revoked`;
      return { none, wrongPurpose, otherSessionCode, counts };
    });
    expect(outcome).toEqual({
      none: NOT_IN_PREREQUISITE_STATE,
      wrongPurpose: NOT_IN_PREREQUISITE_STATE,
      otherSessionCode: NOT_IN_PREREQUISITE_STATE,
      counts: { requests: 0, revoked: 0 },
    });
  });

  it("returns an open erasure as it is (created = false) and refuses anyone but an active member", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const open = await deposit(tx, member, "erasure");
      await markAccountDeletion(tx, member.session);
      const again = rowsOf(
        await asMember(tx, member, () => attempt(tx, SUBMIT_ERASURE)),
      );
      const [state] = await tx<{ executions: number; revoked: number }[]>`
        select (select count(*)::int from privacy.request_executions
                 where request_id = ${open}) as executions,
               (select count(*)::int from identity.sessions
                 where account_id = ${member.id} and revoked_at is not null) as revoked`;
      return {
        open,
        again,
        state,
        agent: codeOf(await asAgent(tx, () => attempt(tx, SUBMIT_ERASURE))),
        admin: codeOf(
          await asAdmin(tx, adminA, () => attempt(tx, SUBMIT_ERASURE)),
        ),
        privacy: codeOf(await asPrivacy(tx, () => attempt(tx, SUBMIT_ERASURE))),
        worker: codeOf(await asWorker(tx, () => attempt(tx, SUBMIT_ERASURE))),
      };
    });
    expect(outcome.again).toEqual([
      { request_id: outcome.open, status: "received", created: false },
    ]);
    expect(outcome.state).toEqual({ executions: 0, revoked: 0 });
    expect(outcome.agent).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.admin).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.privacy).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.worker).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("is refused to admin approval afterwards: no 2V can even be requested on it", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await memberErasure(tx, member);
      return codeOf(
        await asAdmin(tx, adminB, () =>
          attempt(tx, REQUEST_2V, [
            payloadOf(request, "erasure"),
            "request_instructed",
          ]),
        ),
      );
    });
    expect(outcome).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("the worker's turn on a member erasure (0150 §2.2, T4)", () => {
  const NOTIFICATION_SUBJECT =
    "select email, preferred_language, time_zone, erased_at is not null as dated " +
    "from privacy.read_erasure_notification_subject($1::uuid)";

  it("anonymises, deletes the sessions, propagates P0, withdraws the open access, purges its export, queues privacy.erasure_completed", async () => {
    const outcome = await scenario(async (tx) => {
      // an access request approved and executed: its export is published, its e-mail pending
      const {
        member,
        request: access,
        exportId,
      } = await executedAccess(tx, "advertiser");
      await tx`update identity.accounts set timezone = 'Europe/Paris', preferred_language = 'fr'
                where id = ${member.id}`;
      const erasure = await memberErasure(tx, member);
      const executed = rowsOf(await execute(tx, erasure, null));
      const [account] = await tx<Row[]>`
        select status::text as status, email, display_name, anonymized_at is not null as anonymized
          from identity.accounts where id = ${member.id}`;
      const [sessions] = await tx<{ n: number }[]>`
        select count(*)::int as n from identity.sessions where account_id = ${member.id}`;
      const [withdrawn] = await tx<Row[]>`
        select status::text as status, outcome_code::text as outcome_code
          from backoffice.data_subject_requests where id = ${access}`;
      const [exported] = await tx<Row[]>`
        select content is null as purged, purged_at is not null as dated
          from privacy.data_exports where id = ${exportId}`;
      return {
        member,
        access,
        erasure,
        executed,
        account,
        sessions: sessions?.n,
        withdrawn,
        exported,
        deleted: await queueLines(tx, member.id, "account.deleted"),
        mail: await queueLines(tx, member.id, "privacy.erasure_completed"),
        accessClosure: await registerLines(
          tx,
          "privacy.request_completed",
          access,
        ),
        anonymized: await registerLines(tx, "account.anonymized", member.id),
        accessWork: await workOf(tx, access),
        erasureWork: await workOf(tx, erasure),
        subject: rowsOf(
          await asPrivacy(tx, () =>
            attempt(tx, NOTIFICATION_SUBJECT, [erasure]),
          ),
        ),
        accessSubject: rowsOf(
          await asPrivacy(tx, () =>
            attempt(tx, NOTIFICATION_SUBJECT, [access]),
          ),
        ),
        accessCompletion: rowsOf(
          await asPrivacy(tx, () =>
            attempt(
              tx,
              "select privacy.complete_request($1::uuid) as outcome",
              [access],
            ),
          ),
        )[0]?.outcome,
      };
    });
    expect(outcome.executed).toEqual([
      { request_type: "erasure", auth_user_id: outcome.member.authUserId },
    ]);
    expect(outcome.account).toEqual({
      status: "deleted",
      email: `deleted+${outcome.member.id}@invalid`,
      display_name: null,
      anonymized: true,
    });
    expect(outcome.sessions).toBe(0);
    expect(outcome.withdrawn).toEqual({
      status: "closed",
      outcome_code: "retiree_par_le_demandeur",
    });
    expect(outcome.exported).toEqual({ purged: true, dated: true });
    expect(
      outcome.deleted.map((line) => [line.destination, line.priority]),
    ).toEqual([
      ["apollo_contact", 0],
      ["brevo_contact", 0],
    ]);
    expect(outcome.mail).toEqual([
      {
        id: expect.any(String),
        event_type: "privacy.erasure_completed",
        destination: "brevo_transactional",
        priority: 100,
        payload: {
          event_id: expect.any(String),
          account_id: outcome.member.id,
          request_id: outcome.erasure,
          email_code: "privacy.erasure_completed",
        },
        idempotency_key: `privacy.erasure_completed:${outcome.erasure}`,
      },
    ]);
    expect(outcome.accessClosure).toEqual([
      {
        actor_type: "system",
        payload: {
          request_type: "access",
          outcome_code: "retiree_par_le_demandeur",
        },
      },
    ]);
    expect(outcome.anonymized).toEqual([
      { actor_type: "system", payload: { request_id: outcome.erasure } },
    ]);
    // the withdrawn access leaves E-5 (EC-DZ-3); the erasure goes on to its GoTrue deletion
    expect(outcome.accessWork).toEqual([]);
    expect(outcome.accessCompletion).toBeNull();
    expect(outcome.erasureWork).toEqual([
      expect.objectContaining({ step: "delete_auth_user" }),
    ]);
    // the e-mail goes to the held address, in the account's language and time zone (§2.3)
    expect(outcome.subject).toEqual([
      {
        email: outcome.member.email,
        preferred_language: "fr",
        time_zone: "Europe/Paris",
        dated: true,
      },
    ]);
    expect(outcome.accessSubject).toEqual([]);
  });

  it("reads the address of the e-mail for influx_privacy only, and never once the erasure is closed", async () => {
    const outcome = await scenario(async (tx) => {
      const member = await newMember(tx);
      const request = await memberErasure(tx, member);
      const read = () =>
        asPrivacy(tx, () => attempt(tx, NOTIFICATION_SUBJECT, [request]));
      const beforeExecution = rowsOf(await read());
      rowsOf(await execute(tx, request, null));
      const executed = rowsOf(await read());
      const worker = codeOf(
        await asWorker(tx, () => attempt(tx, NOTIFICATION_SUBJECT, [request])),
      );
      const admin = codeOf(
        await asAdmin(tx, adminA, () =>
          attempt(tx, NOTIFICATION_SUBJECT, [request]),
        ),
      );
      const own = codeOf(
        await asMember(tx, member, () =>
          attempt(tx, NOTIFICATION_SUBJECT, [request]),
        ),
      );
      await asPrivacy(tx, () =>
        attempt(tx, "select privacy.record_auth_user_deleted($1::uuid)", [
          request,
        ]),
      );
      await settle(tx, member.id, "account.deleted", "brevo_contact", {
        status: "succeeded",
      });
      await settle(tx, member.id, "account.deleted", "apollo_contact", {
        status: "skipped",
        skipReason: "connector_disabled",
      });
      await settle(
        tx,
        member.id,
        "privacy.erasure_completed",
        "brevo_transactional",
        { status: "succeeded", messageId: ERASURE_MESSAGE_ID },
      );
      const closed = rowsOf(
        await asPrivacy(tx, () =>
          attempt(tx, "select privacy.complete_request($1::uuid) as outcome", [
            request,
          ]),
        ),
      )[0]?.outcome;
      return {
        member,
        beforeExecution,
        executed,
        worker,
        admin,
        own,
        closed,
        afterClosure: rowsOf(await read()),
        unknown: rowsOf(
          await asPrivacy(tx, () =>
            attempt(tx, NOTIFICATION_SUBJECT, [randomUUID()]),
          ),
        ),
      };
    });
    expect(outcome.beforeExecution).toEqual([]);
    expect(outcome.executed).toEqual([
      {
        email: outcome.member.email,
        preferred_language: "en",
        time_zone: "UTC",
        dated: true,
      },
    ]);
    expect(outcome.worker).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.admin).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.own).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.closed).toBe("satisfaite");
    expect(outcome.afterClosure).toEqual([]);
    expect(outcome.unknown).toEqual([]);
  });
});

const READ_OWN =
  "select export_id::text, request_id::text, downloads_left, available from privacy.read_own_export()";
const DOWNLOAD =
  "select content, sha256, size_bytes, downloads_left " +
  "from privacy.download_own_export($1::uuid, $2::uuid)";

/** The fresh code data_export of a member session (decision 4 of J7), as E-2 writes it. */
async function markDataExport(tx: Tx, session: string): Promise<void> {
  await tx`update identity.sessions set reauthenticated_at = now(), reauth_purpose = 'data_export'
            where id = ${session}`;
}

describe("the member's export (runbook §4: a fresh code each time, 3 downloads, 7 days)", () => {
  it("shows the latest export of the session's account only; refuses anyone but a member", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request, exportId } = await executedAccess(tx);
      const other = await newMember(tx);
      return {
        exportId,
        request,
        own: rowsOf(await asMember(tx, member, () => attempt(tx, READ_OWN))),
        other: rowsOf(await asMember(tx, other, () => attempt(tx, READ_OWN))),
        agent: codeOf(await asAgent(tx, () => attempt(tx, READ_OWN))),
      };
    });
    expect(outcome.own).toEqual([
      {
        export_id: outcome.exportId,
        request_id: outcome.request,
        downloads_left: 3,
        available: true,
      },
    ]);
    expect(outcome.other).toEqual([]);
    expect(outcome.agent).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("delivers the exact content after a fresh code, consumed at each download, three times at most, each journaled", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request, exportId } = await executedAccess(tx);
      const [stored] = await tx<{ content: string; sha256: Buffer }[]>`
        select content, sha256 from privacy.data_exports where id = ${exportId}`;
      const download = () =>
        asMember(tx, member, () =>
          attempt(tx, DOWNLOAD, [member.session, exportId]),
        );
      const withoutCode = codeOf(await download());
      const results: Attempt[] = [];
      await markDataExport(tx, member.session);
      results.push(await download());
      const reusedMarker = codeOf(await download());
      for (let index = 0; index < 2; index += 1) {
        await markDataExport(tx, member.session);
        results.push(await download());
      }
      await markDataExport(tx, member.session);
      const fourth = codeOf(await download());
      const [marker] = await tx<{ purpose: string | null }[]>`
        select reauth_purpose::text as purpose from identity.sessions where id = ${member.session}`;
      return {
        member,
        request,
        exportId,
        stored,
        withoutCode,
        results,
        reusedMarker,
        fourth,
        marker: marker?.purpose,
        lines: await registerLines(tx, "privacy.export_downloaded", request),
        read: rowsOf(await asMember(tx, member, () => attempt(tx, READ_OWN))),
      };
    });
    expect(outcome.withoutCode).toBe(NOT_IN_PREREQUISITE_STATE);
    const first = rowsOf(
      outcome.results[0] ?? { outcome: "rows", rows: [] },
    )[0];
    expect(first?.content).toBe(outcome.stored?.content);
    expect(
      (first?.sha256 as Buffer).equals(
        outcome.stored?.sha256 ?? Buffer.alloc(0),
      ),
    ).toBe(true);
    expect(
      outcome.results.map((result) => rowsOf(result)[0]?.downloads_left),
    ).toEqual([2, 1, 0]);
    // the marker serves once: the same code does not open a second download
    expect(outcome.reusedMarker).toBe(NOT_IN_PREREQUISITE_STATE);
    // the fourth: P0002 BEFORE the marker is consumed (it stays, the transaction rolled back)
    expect(outcome.fourth).toBe(NO_DATA_FOUND);
    expect(outcome.marker).toBe("data_export");
    expect(outcome.lines).toEqual(
      [1, 2, 3].map((number) => ({
        actor_type: "member",
        payload: {
          export_id: outcome.exportId,
          download_number: number,
          session_id: outcome.member.session,
        },
      })),
    );
    expect(outcome.read).toEqual([
      expect.objectContaining({ downloads_left: 0, available: false }),
    ]);
  });

  it.each([
    ["expired (7 days)", "expired"],
    ["purged", "purged"],
  ])(
    "refuses an export %s (P0002), and another member's export gives no row",
    async (_label, variant) => {
      const outcome = await scenario(async (tx) => {
        const { member, exportId } = await executedAccess(tx);
        if (variant === "expired") {
          await tx`alter table privacy.data_exports disable trigger data_exports_guard_update`;
          await tx`update privacy.data_exports
                    set published_at = published_at - interval '8 days',
                        expires_at = expires_at - interval '8 days'
                  where id = ${exportId}`;
          await tx`alter table privacy.data_exports enable trigger data_exports_guard_update`;
        } else {
          await tx`update privacy.data_exports set content = null where id = ${exportId}`;
        }
        await markDataExport(tx, member.session);
        const refused = codeOf(
          await asMember(tx, member, () =>
            attempt(tx, DOWNLOAD, [member.session, exportId]),
          ),
        );
        const other = await newMember(tx);
        await markDataExport(tx, other.session);
        const stranger = rowsOf(
          await asMember(tx, other, () =>
            attempt(tx, DOWNLOAD, [other.session, exportId]),
          ),
        );
        return { refused, stranger };
      });
      expect(outcome).toEqual({ refused: NO_DATA_FOUND, stranger: [] });
    },
  );
});

describe("ops.purge_data_exports() (E-4, runbook §4)", () => {
  it("erases the content past 7 days or 3 downloads, keeps the digest, journals retention.purged", async () => {
    const outcome = await scenario(async (tx) => {
      const expired = await executedAccess(tx);
      const exhausted = await executedAccess(tx);
      const fresh = await executedAccess(tx);
      await tx`alter table privacy.data_exports disable trigger data_exports_guard_update`;
      await tx`update privacy.data_exports
                  set published_at = published_at - interval '8 days',
                      expires_at = expires_at - interval '8 days'
                where id = ${expired.exportId}`;
      await tx`update privacy.data_exports set downloads_count = 3, last_downloaded_at = now()
                where id = ${exhausted.exportId}`;
      await tx`alter table privacy.data_exports enable trigger data_exports_guard_update`;
      const [run] = await tx<{ id: string }[]>`
        insert into ops.periodic_runs (task_code, period_key)
        values ('data_export_purge', '2001-01-02T03') returning id::text`;
      const purged = rowsOf(
        await asWorker(tx, () =>
          attempt(
            tx,
            "select ops.purge_data_exports($1::uuid, 1::smallint, 10000) as count",
            [String(run?.id)],
          ),
        ),
      )[0]?.count;
      const states = await tx<Row[]>`
        select id::text, content is null as purged, purged_at is not null as stamped,
               octet_length(sha256) as digest
          from privacy.data_exports
         where id in (${expired.exportId}, ${exhausted.exportId}, ${fresh.exportId})`;
      const [line] = await tx<{ payload: Row }[]>`
        select payload from audit.audit_events
         where event_type = 'retention.purged' and subject_id = ${String(run?.id)}::uuid`;
      return { expired, exhausted, fresh, purged, states, line };
    });
    expect(outcome.purged).toBeGreaterThanOrEqual(2);
    const state = (id: string) => outcome.states.find((row) => row.id === id);
    expect(state(outcome.expired.exportId)).toMatchObject({
      purged: true,
      stamped: true,
      digest: 32,
    });
    expect(state(outcome.exhausted.exportId)).toMatchObject({
      purged: true,
      stamped: true,
    });
    expect(state(outcome.fresh.exportId)).toMatchObject({
      purged: false,
      stamped: false,
    });
    expect(outcome.line?.payload).toEqual({
      category: "data_exports",
      count: outcome.purged,
    });
  });

  it("runs inside an open data_export_purge run only, for influx_worker only", async () => {
    const outcome = await scenario(async (tx) => {
      const [run] = await tx<{ id: string }[]>`
        insert into ops.periodic_runs (task_code, period_key)
        values ('brevo_inbound_purge', '2001-01-03') returning id::text`;
      return {
        wrongRun: codeOf(
          await asWorker(tx, () =>
            attempt(
              tx,
              "select ops.purge_data_exports($1::uuid, 1::smallint, 10)",
              [String(run?.id)],
            ),
          ),
        ),
        privacy: codeOf(
          await asPrivacy(tx, () =>
            attempt(
              tx,
              "select ops.purge_data_exports(gen_random_uuid(), 1::smallint, 10)",
            ),
          ),
        ),
      };
    });
    expect(outcome).toEqual({
      wrongRun: NOT_IN_PREREQUISITE_STATE,
      privacy: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("the two Brevo reads of the worker (E-3)", () => {
  const ERASURE_SUBJECT =
    "select external_contact_id, email from leads.read_brevo_erasure_subject($1::bigint, $2)";

  it("gives the Brevo deletion its contact id and the held address, on the worker's own account.deleted line only (EC-J8-50)", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request } = await executedErasure(tx);
      await tx`
        insert into leads.contact_sync_states (account_id, destination, external_contact_id,
                                               last_attempt_at, last_success_at, last_status)
        values (${member.id}, 'brevo_contact', 't8-brevo-7', now(), now(), 'succeeded')`;
      const lines = await queueLines(tx, member.id, "account.deleted");
      const brevo =
        lines.find((line) => line.destination === "brevo_contact")?.id ?? "0";
      const apollo =
        lines.find((line) => line.destination === "apollo_contact")?.id ?? "0";
      const read = (line: string, worker: string) =>
        asWorker(tx, () => attempt(tx, ERASURE_SUBJECT, [line, worker]));
      const notProcessing = rowsOf(await read(brevo, "w1"));
      await tx`update leads.outbox_events set status = 'processing', locked_by = 'w1', locked_at = now()
                where id in (${brevo}, ${apollo})`;
      const own = rowsOf(await read(brevo, "w1"));
      const otherWorker = rowsOf(await read(brevo, "w2"));
      const apolloLine = rowsOf(await read(apollo, "w1"));
      const malformed = codeOf(await read(brevo, "bad worker"));
      const admin = codeOf(
        await asAdmin(tx, adminA, () =>
          attempt(tx, ERASURE_SUBJECT, [brevo, "w1"]),
        ),
      );
      const privacy = codeOf(
        await asPrivacy(tx, () => attempt(tx, ERASURE_SUBJECT, [brevo, "w1"])),
      );
      // after the closure, the address is gone
      await asPrivacy(tx, () =>
        attempt(tx, "select privacy.record_auth_user_deleted($1::uuid)", [
          request,
        ]),
      );
      await tx`update leads.outbox_events set status = 'succeeded', locked_by = null, locked_at = null,
                      completed_at = now() where id = ${brevo}`;
      await tx`update leads.outbox_events set status = 'skipped', skip_reason = 'connector_disabled',
                      locked_by = null, locked_at = null, completed_at = now() where id = ${apollo}`;
      await settle(
        tx,
        member.id,
        "privacy.erasure_completed",
        "brevo_transactional",
        {
          status: "succeeded",
          messageId: ERASURE_MESSAGE_ID,
        },
      );
      rowsOf(
        await asPrivacy(tx, () =>
          attempt(tx, "select privacy.complete_request($1::uuid)", [request]),
        ),
      );
      await tx`update leads.outbox_events set status = 'processing', locked_by = 'w1',
                      locked_at = now(), completed_at = null where id = ${brevo}`;
      const afterClosure = rowsOf(await read(brevo, "w1"));
      return {
        member,
        notProcessing,
        own,
        otherWorker,
        apolloLine,
        malformed,
        admin,
        privacy,
        afterClosure,
      };
    });
    expect(outcome.notProcessing).toEqual([]);
    expect(outcome.own).toEqual([
      { external_contact_id: "t8-brevo-7", email: outcome.member.email },
    ]);
    expect(outcome.otherWorker).toEqual([]);
    expect(outcome.apolloLine).toEqual([]);
    expect(outcome.malformed).toBe(INVALID_PARAMETER);
    expect(outcome.admin).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.privacy).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.afterClosure).toEqual([
      { external_contact_id: "t8-brevo-7", email: null },
    ]);
  });

  it("gives the e-mail privacy.export_ready the expiry of its export and the request it answers", async () => {
    const outcome = await scenario(async (tx) => {
      const { member, request, exportId } = await executedAccess(tx);
      const [line] = await queueLines(tx, member.id, "privacy.export_ready");
      await tx`update leads.outbox_events set status = 'processing', locked_by = 'w1', locked_at = now()
                where id = ${line?.id ?? "0"}`;
      const [expected] = await tx<{ expires_at: Date; received_at: Date }[]>`
        select x.expires_at, d.received_at
          from privacy.data_exports x
          join backoffice.data_subject_requests d on d.id = x.request_id
         where x.id = ${exportId}`;
      const read = rowsOf(
        await asWorker(tx, () =>
          attempt(
            tx,
            "select email, request_type, request_received_at, request_closed, export_expires_at " +
              "from leads.read_brevo_subject($1::bigint, 'w1')",
            [line?.id ?? "0"],
          ),
        ),
      );
      // any other line: no expiry
      await tx`update leads.outbox_events set status = 'pending', locked_by = null, locked_at = null
                where id = ${line?.id ?? "0"}`;
      const [welcome] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           locked_by, locked_at)
        values (gen_random_uuid(), 'lead.created', 'brevo_contact', ${`account:${member.id}`},
                jsonb_build_object('account_id', ${member.id}::uuid, 'export_id', ${exportId}::uuid),
                ${`lead.created:${randomBytes(8).toString("hex")}`}, 'processing', 'w1', now())
        returning id::text`;
      const other = rowsOf(
        await asWorker(tx, () =>
          attempt(
            tx,
            "select request_type, export_expires_at from leads.read_brevo_subject($1::bigint, 'w1')",
            [welcome?.id ?? "0"],
          ),
        ),
      );
      return { member, request, expected, read, other };
    });
    expect(outcome.read).toEqual([
      {
        email: outcome.member.email,
        request_type: "access",
        request_received_at: outcome.expected?.received_at,
        request_closed: false,
        export_expires_at: outcome.expected?.expires_at,
      },
    ]);
    expect(outcome.other).toEqual([
      { request_type: null, export_expires_at: null },
    ]);
  });
});

describe("an address reused by another account (EC-J8-55, review F1)", () => {
  it("neither exports nor erases another account's rows when the address it once held is now someone else's", async () => {
    const outcome = await scenario(async (tx) => {
      // A moved from x@ to y@ (its current address), then B signed up with x@
      const a = await newMember(tx);
      const reused = `t8-reused-${a.id}@example.test`;
      const [change] = await tx<{ id: string }[]>`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${a.id}, ${reused}, ${a.email}, sha256('t8-x1'::bytea), sha256('t8-x2'::bytea))
        returning id::text`;
      await tx`update identity.email_change_requests
                  set old_confirmed_at = now(), new_confirmed_at = now()
                where id = ${String(change?.id)}`;
      await tx`update identity.email_change_requests
                  set completed_at = now(), old_code_hash = null, new_code_hash = null
                where id = ${String(change?.id)}`;
      const b = await newMember(tx);
      await tx`update identity.accounts set email = ${reused} where id = ${b.id}`;
      // B's rows, by the reused address
      await tx`
        insert into leads.transactional_sends (reference, email_code, priority, recipient_email, locale)
        values (gen_random_uuid(), 'auth.login_code', 'p0', ${reused}, 'en')`;
      await tx`
        insert into backoffice.code_delivery_reports (login_email, contact_email, message, locale)
        values (${reused}, ${reused}, 'B report', 'en'),
               (${a.email}, ${a.email}, 'A report', 'en')`;
      const [open] = await tx<{ id: string }[]>`
        insert into backoffice.member_invitations
          (code_hash, email, proposed_role, preferred_language, created_by_account_id)
        values (sha256(gen_random_uuid()::text::bytea), ${reused}, 'creator', 'en', ${agentA})
        returning id::text`;
      const [redeemed] = await tx<{ id: string }[]>`
        insert into backoffice.member_invitations
          (code_hash, email, proposed_role, preferred_language, created_by_account_id)
        values (sha256(gen_random_uuid()::text::bytea), ${reused}, 'creator', 'en', ${agentA})
        returning id::text`;
      await tx`update backoffice.member_invitations set redeemed_at = now(), account_id = ${b.id}
                where id = ${String(redeemed?.id)}`;
      const [event] = await tx<{ id: string }[]>`
        insert into leads.brevo_inbound_events (origin, dedup_key, event, occurred_at, email)
        values ('webhook', sha256(gen_random_uuid()::text::bytea), 'unsubscribed', now(),
                ${reused})
        returning id::text`;
      await tx`insert into leads.brevo_inbound_outcomes (event_id, account_id, outcome)
               values (${String(event?.id)}, ${b.id}, 'no_change')`;

      // the export of A
      const access = await deposit(tx, a, "access");
      await approve(tx, access, "access");
      rowsOf(await execute(tx, access, NOTICE));
      const [stored] = await tx<{ content: string }[]>`
        select content from privacy.data_exports where request_id = ${access}`;

      // the erasure of A
      const erasure = await deposit(tx, a, "erasure");
      await approve(tx, erasure, "erasure");
      rowsOf(await execute(tx, erasure, null));
      const [after] = await tx<Row[]>`
        select (select count(*)::int from leads.transactional_sends
                 where recipient_email = ${reused}) as b_sends,
               (select message from backoffice.code_delivery_reports
                 where login_email = ${reused}) as b_report,
               (select count(*)::int from backoffice.code_delivery_reports
                 where login_email = ${`deleted+${a.id}@invalid`} and message is null) as a_reports,
               (select array_agg(email order by id) from backoffice.member_invitations
                 where id in (${String(open?.id)}, ${String(redeemed?.id)})) as invitations,
               (select email from leads.brevo_inbound_events where id = ${String(event?.id)})
                 as b_event,
               (select email from identity.accounts where id = ${b.id}) as b_email,
               (select count(*)::int from identity.sessions where account_id = ${b.id})
                 as b_sessions`;
      return { a, b, reused, content: String(stored?.content), after };
    });
    const file = JSON.parse(outcome.content) as ExportFile;
    const data = file.data as Record<string, Row[]>;
    // A's own report (its current address) is exported; nothing of B's
    expect(data.delivery_reports?.map((row) => row.message)).toEqual([
      "A report",
    ]);
    expect(data.transactional_emails).toEqual([]);
    expect(data.brevo_events).toEqual([]);
    for (const absent of ["B report", outcome.b.id]) {
      expect(outcome.content.includes(absent), absent).toBe(false);
    }
    // the erasure of A leaves B's rows as they were
    expect(outcome.after).toEqual({
      b_sends: 1,
      b_report: "B report",
      a_reports: 1,
      invitations: [outcome.reused, outcome.reused],
      b_event: outcome.reused,
      b_email: outcome.reused,
      b_sessions: 1,
    });
  });

  it("drops from the account's addresses any address another account holds or held", async () => {
    const outcome = await scenario(async (tx) => {
      const a = await newMember(tx);
      const reused = `t8-reused2-${a.id}@example.test`;
      const kept = `t8-kept-${a.id}@example.test`;
      await tx`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${a.id}, ${reused}, ${a.email}, sha256('t8-k1'::bytea), sha256('t8-k2'::bytea))`;
      await tx`update identity.email_change_requests
                  set cancelled_at = now(), cancel_reason = 'superseded',
                      old_code_hash = null, new_code_hash = null
                where account_id = ${a.id}`;
      await tx`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${a.id}, ${kept}, ${a.email}, sha256('t8-k3'::bytea), sha256('t8-k4'::bytea))`;
      const b = await newMember(tx);
      // B once held the reused address: the old address of a completed change of B
      await tx`
        insert into identity.email_change_requests
          (account_id, old_email, new_email, old_code_hash, new_code_hash)
        values (${b.id}, ${reused}, ${b.email}, sha256('t8-k5'::bytea), sha256('t8-k6'::bytea))`;
      await tx`set local role influx_privacy_definer`;
      const [row] = await tx<{ addresses: string[] }[]>`
        select privacy.account_addresses(${a.id}::uuid) as addresses`;
      await tx`reset role`;
      return { a, kept, addresses: row?.addresses };
    });
    expect([...(outcome.addresses ?? [])].sort()).toEqual(
      [outcome.a.email, outcome.kept].sort(),
    );
  });
});

describe("the closed lists of the owners (review F7) and the hourly purge (EC-J8-57)", () => {
  it("lets influx_privacy_definer own exactly the ten functions of E-5; only the member's two identity functions read the exports", async () => {
    const owned = await migration<{ name: string; definer: boolean }[]>`
      select p.oid::regprocedure::text as name, p.prosecdef as definer
        from pg_catalog.pg_proc p
       where p.proowner = 'influx_privacy_definer'::regrole
       order by 1`;
    expect(owned).toEqual([
      { name: "leads.read_brevo_erasure_subject(bigint,text)", definer: true },
      { name: "privacy.account_addresses(uuid)", definer: false },
      { name: "privacy.complete_request(uuid)", definer: true },
      { name: "privacy.execute_request(uuid,jsonb)", definer: true },
      { name: "privacy.export_categories()", definer: false },
      { name: "privacy.export_document(uuid,text[],jsonb)", definer: false },
      { name: "privacy.iso_utc(timestamp with time zone)", definer: false },
      { name: "privacy.pending_work(integer)", definer: true },
      {
        name: "privacy.read_erasure_notification_subject(uuid)",
        definer: true,
      },
      { name: "privacy.record_auth_user_deleted(uuid)", definer: true },
    ]);
    const readers = await migration<{ name: string; owner: string }[]>`
      select p.oid::regprocedure::text as name, pg_catalog.pg_get_userbyid(p.proowner) as owner
        from pg_catalog.pg_proc p
       where p.prosrc like '%privacy.data_exports%'
         and p.proowner <> 'influx_privacy_definer'::regrole
       order by 1`;
    expect(readers).toEqual([
      // the E-3 read of the e-mail privacy.export_ready (its expiry) and the E-4 purge
      {
        name: "leads.read_brevo_subject(bigint,text)",
        owner: "influx_leads_definer",
      },
      {
        name: "ops.purge_data_exports(uuid,smallint,integer)",
        owner: "influx_maintenance_definer",
      },
      {
        name: "privacy.download_own_export(uuid,uuid)",
        owner: "influx_identity_definer",
      },
      { name: "privacy.read_own_export()", owner: "influx_identity_definer" },
    ]);
  });

  it("claims data_export_purge per UTC hour, never per day", async () => {
    const outcome = await scenario(async (tx) => {
      const [keys] = await tx<{ hour: string; day: string }[]>`
        select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as hour,
               to_char(now() at time zone 'UTC', 'YYYY-MM-DD') as day`;
      const claim = (key: string) =>
        asWorker(tx, () =>
          attempt(
            tx,
            "select run_id::text, attempt from ops.claim_periodic_run('data_export_purge', $1)",
            [key],
          ),
        );
      return {
        hour: codeOf(await claim(String(keys?.hour))),
        day: codeOf(await claim(String(keys?.day))),
        check: codeOf(
          await attempt(
            tx,
            "insert into ops.periodic_runs (task_code, period_key) values ('data_export_purge', '2001-01-05')",
          ),
        ),
      };
    });
    expect(outcome).toEqual({
      hour: "rows",
      day: INVALID_PARAMETER,
      check: "23514",
    });
  });
});
