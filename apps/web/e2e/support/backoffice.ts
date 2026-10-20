// The people and the facts of the backoffice journeys (J8 commit 10), written straight into the
// local stack by the migration role (loopback only, @influx/test-kit/db), as apps/api's T14 files
// write them: internal accounts with a TOTP factor and a backoffice session proven now (so R, the
// fresh second factor of B-5, holds for 300 s), member accounts with their sign-up consent, and the
// queue lines and contact states the worker would have left (0101, 0111). The session cookie is
// set by the `Set-Cookie` answer of an intercepted request on the backoffice origin, as
// e2e/support/account.ts does for a member. No GoTrue user: no journey here types a password.
import type { Page } from "@playwright/test";
import { connectAsMigrationRole } from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { E2E_RUN_VARIABLE } from "./mailboxes";
import { BACKOFFICE_ORIGIN } from "./servers";

/** apps/api/src/platform/auth-cookies.ts, `backofficeSession`. */
const SESSION_COOKIE = "__Host-influx-ops-session";

/** A path no server answers: only the interception below does. */
const SEED_PATH = "/e2e-session-seed";

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

async function withSql<T>(
  run: (sql: ReturnType<typeof connectAsMigrationRole>) => Promise<T>,
): Promise<T> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** A tag of this run, made of the characters a partial search accepts (05 RG98). */
export function runTag(name: string): string {
  return `e2e${(process.env[E2E_RUN_VARIABLE] ?? "").replace(/[^a-z0-9]/gi, "")}${name}`;
}

export type SeededInternal = {
  accountId: string;
  firstName: string;
  sessionId: string;
};

/** Every internal account of the journeys, deactivated by `retireInternals`. */
const internals: string[] = [];

/** An active agent or admin, signed in on this page's backoffice origin. */
export async function seedInternal(
  page: Page,
  role: "agent" | "admin",
  firstName: string,
): Promise<SeededInternal> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  const sessionId = await withSql((sql) =>
    sql.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           display_name, is_adult_attested, adult_attested_at, declared_status)
        values (${accountId}, ${randomUUID()},
                ${`e2e-${accountId.slice(0, 8)}-${role}@example.test`}, now(), 'FR', 'fr',
                ${firstName}, true, now(), 'business')`;
      await tx`
        insert into identity.account_roles (account_id, role)
        values (${accountId}, ${role}::identity.account_role)`;
      await tx`
        insert into identity.agent_profiles
          (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
        values (${accountId}, ${firstName}, now(), now(), ${randomUUID()})`;
      const [row] = await tx<{ id: string }[]>`
        insert into identity.sessions
          (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'chrome.linux')
        returning id::text`;
      return row?.id ?? "";
    }),
  );
  internals.push(accountId);
  const url = `${BACKOFFICE_ORIGIN}${SEED_PATH}`;
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      headers: {
        "set-cookie": `${SESSION_COOKIE}=${token.toString("base64url")}; Path=/; Secure; HttpOnly; SameSite=Strict`,
      },
      body: "",
    }),
  );
  await page.goto(url);
  await page.unroute(url);
  return { accountId, firstName, sessionId };
}

/** After the journeys: the internal accounts never stay active peers of other runs. */
export async function retireInternals(): Promise<void> {
  if (internals.length === 0) {
    return;
  }
  await withSql(
    (sql) => sql`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`,
  );
}

/** Admin profiles deactivated by `onlyAdmin`, until `restoreAdmins`. */
const deactivated = new Set<string>();

/** PD7: deactivates every other active admin profile (as t8-dual-control-service does). */
export async function onlyAdmin(accountId: string): Promise<void> {
  const rows = await withSql(
    (sql) => sql<{ account_id: string }[]>`
      update identity.agent_profiles p
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${accountId}
       where p.account_id <> ${accountId}
         and p.is_active
         and exists (select 1 from identity.account_roles r
                      where r.account_id = p.account_id and r.role = 'admin')
       returning p.account_id::text as account_id`,
  );
  for (const row of rows) {
    deactivated.add(row.account_id);
  }
}

export async function restoreAdmins(): Promise<void> {
  const ids = [...deactivated];
  if (ids.length === 0) {
    return;
  }
  await withSql(
    (sql) => sql`
      update identity.agent_profiles
         set is_active = true, deactivated_at = null, deactivated_by_account_id = null
       where account_id = any(${ids}::uuid[])`,
  );
  deactivated.clear();
}

/** Every member account of the journeys, whose queue lines `removeQueueLines` deletes. */
const members: string[] = [];

/** The address of a member seeded by `seedSignup`, from its tag and its id. */
export function seededAddress(tag: string, accountId: string): string {
  return `${tag}-${accountId.slice(0, 8)}@example.test`;
}

/**
 * A member who signed up today (or `daysAgo` days ago, for the period filters of 05 RG97), with or
 * without the marketing consent (05 RG33).
 */
export async function seedSignup(options: {
  tag: string;
  role: "advertiser" | "creator";
  countryCode: string;
  language: "fr" | "en";
  consent: boolean;
  daysAgo?: number;
}): Promise<string> {
  const accountId = randomUUID();
  await withSql((sql) =>
    sql.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status, created_at)
        values (${accountId}, ${randomUUID()}, ${seededAddress(options.tag, accountId)}, now(),
                ${options.countryCode}, ${options.language}, true, now(),
                ${options.role === "advertiser" ? "business" : "individual"}::identity.declared_status,
                now() - make_interval(days => ${options.daysAgo ?? 0}))`;
      await tx`
        insert into identity.account_roles (account_id, role)
        values (${accountId}, ${options.role}::identity.account_role)`;
      if (options.role === "advertiser") {
        await tx`
          insert into profiles.advertiser_profiles (account_id, legal_name)
          values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
      }
      await tx`
        insert into identity.consent_events (account_id, purpose, granted, source)
        select ${accountId}, p, ${options.consent}, 'signup_form'
          from unnest(array['marketing_email', 'commercial_prospection']::identity.consent_purpose[]) p`;
    }),
  );
  members.push(accountId);
  return accountId;
}

type Destination = "brevo_contact" | "apollo_contact";

/** A lead.created line in a closed state, and the contact state it left (0101, 0111). */
export async function closedLine(
  accountId: string,
  destination: Destination,
  outcome:
    | { status: "failed"; errorCode: string }
    | { status: "skipped"; skipReason: string },
): Promise<void> {
  const code =
    outcome.status === "failed" ? outcome.errorCode : outcome.skipReason;
  await withSql((sql) =>
    sql.begin(async (tx) => {
      await tx`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           attempts, available_at, skip_reason, last_error_code, completed_at)
        select e.id, 'lead.created', ${destination}::leads.outbox_destination,
               ${`account:${accountId}`}, jsonb_build_object('event_id', e.id),
               'lead.created:' || e.id::text, ${outcome.status}::leads.outbox_status,
               ${outcome.status === "failed" ? 10 : 0}, now(),
               ${outcome.status === "skipped" ? outcome.skipReason : null},
               ${outcome.status === "failed" ? outcome.errorCode : null}, now()
          from (select gen_random_uuid() as id) e`;
      await tx`
        insert into leads.contact_sync_states
          (account_id, destination, last_attempt_at, last_status, last_error_code)
        values (${accountId}, ${destination}::leads.outbox_destination, now(),
                ${outcome.status}::leads.outbox_status, ${code})`;
    }),
  );
}

/** Lines waiting after a refused key (AL25, CA62), created `agedMinutes` ago. */
export async function refusedKeyLines(
  accountId: string,
  destination: Destination,
  count: number,
  agedMinutes: number,
): Promise<void> {
  await withSql(
    (sql) => sql`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
         attempts, available_at, last_error_code, created_at)
      select e.id, 'lead.created', ${destination}::leads.outbox_destination,
             ${`account:${accountId}`}, jsonb_build_object('event_id', e.id),
             'lead.created:' || e.id::text, 'pending', 2, now() + interval '10 minutes',
             ${destination === "apollo_contact" ? "apollo.unauthorized" : "brevo.unauthorized"},
             now() - make_interval(mins => ${agedMinutes})
        from (select gen_random_uuid() as id from generate_series(1, ${count})) e`,
  );
}

/** After the journeys: no line of theirs stays in the queue (it would raise alerts for others). */
export async function removeQueueLines(): Promise<void> {
  if (members.length === 0) {
    return;
  }
  await withSql(
    (sql) => sql`
      delete from leads.outbox_events
       where subject_key = any (${members.map((id) => `account:${id}`)}::text[])`,
  );
}

/** The lead.created lines of an account, oldest first. */
export async function linesOf(
  accountId: string,
): Promise<{ status: string; attempts: number; idempotencyKey: string }[]> {
  return withSql(async (sql) => [
    ...(await sql<
      { status: string; attempts: number; idempotencyKey: string }[]
    >`
      select status::text as status, attempts, idempotency_key as "idempotencyKey"
        from leads.outbox_events
       where subject_key = ${`account:${accountId}`} and event_type = 'lead.created'
       order by id`),
  ]);
}

/** The register lines of one type written by an actor, oldest first. */
export async function registerLinesBy(
  eventType: string,
  actorAccountId: string,
): Promise<{ subjectId: string | null; payload: Record<string, unknown> }[]> {
  return withSql(async (sql) => [
    ...(await sql<
      { subjectId: string | null; payload: Record<string, unknown> }[]
    >`
      select subject_id::text as "subjectId", payload
        from audit.audit_events
       where event_type = ${eventType} and actor_account_id = ${actorAccountId}
       order by seq`),
  ]);
}

/** Moves a dual control request back past its 60 seconds (PD2; the guard is disabled here). */
export async function pastTheDelay(requestId: string): Promise<void> {
  await withSql((sql) =>
    sql.begin(async (tx) => {
      await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
      await tx`
        update backoffice.dual_control_requests
           set requested_at = requested_at - interval '61 seconds',
               expires_at   = expires_at   - interval '61 seconds',
               created_at   = created_at   - interval '61 seconds'
         where id = ${requestId}`;
      await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
    }),
  );
}

/** A dual control request: its state and how it was confirmed. */
export async function dualControlFacts(requestId: string): Promise<{
  state: string;
  degraded: boolean;
  justified: boolean;
} | null> {
  return withSql(async (sql) => {
    const [row] = await sql<
      { state: string; degraded: boolean; justified: boolean }[]
    >`
      select state::text as state, degraded_confirmed_at is not null as degraded,
             coalesce(length(degraded_justification), 0) >= 20 as justified
        from backoffice.dual_control_requests where id = ${requestId}`;
    return row ?? null;
  });
}

/** The Apollo scope in force, and its restoration after the journey that changes it. */
export async function apolloScope(): Promise<string> {
  return withSql(async (sql) => {
    const [row] = await sql<{ value: string }[]>`
      select value #>> '{}' as value from leads.sync_settings where key = 'apollo_scope'`;
    return row?.value ?? "";
  });
}

export async function restoreApolloScope(value: string): Promise<void> {
  await withSql(
    (sql) => sql`
      update leads.sync_settings set value = to_jsonb(${value}::text), updated_by_account_id = null
       where key = 'apollo_scope'`,
  );
}

/** What an invitation left on the account signed up with it (05 RG119, RG120; 0131, 0135). */
export async function attributionOf(email: string): Promise<{
  accountId: string;
  ownerAgentId: string | null;
  assignments: { agentAccountId: string; reasonCode: string }[];
  invitationRedeemed: boolean;
} | null> {
  return withSql(async (sql) => {
    const [account] = await sql<
      { id: string; owner_agent_id: string | null }[]
    >`
      select id::text, owner_agent_id::text from identity.accounts where email = ${email}`;
    if (account === undefined) {
      return null;
    }
    members.push(account.id);
    const assignments = await sql<
      { agentAccountId: string; reasonCode: string }[]
    >`
      select agent_account_id::text as "agentAccountId", reason_code as "reasonCode"
        from backoffice.ownership_assignments
       where account_id = ${account.id}::uuid and unassigned_at is null`;
    const [invitation] = await sql<{ redeemed: boolean }[]>`
      select redeemed_at is not null as redeemed from backoffice.member_invitations
       where account_id = ${account.id}::uuid`;
    return {
      accountId: account.id,
      ownerAgentId: account.owner_agent_id,
      assignments: [...assignments],
      invitationRedeemed: invitation?.redeemed === true,
    };
  });
}
