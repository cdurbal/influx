// T14 (J8, commit 6) — the action API of the backoffice v0, on the local stack through the pools of
// apps/api (docs/mvp/05 RG81, RG93, RG101 to RG104, RG108, CA58 to CA63; 15 §F, RG110; 03 §1.3 PD1
// to PD7; 18 T14.1 to T14.4; 21 §J8 commit 6; migrations 0132, 0134):
//   POST /v1/bo/leads/replays, POST /v1/bo/accounts/:id/corrections, GET /v1/bo/settings/apollo,
//   POST /v1/bo/dual-control, GET /v1/bo/dual-control/:id, POST /v1/bo/dual-control/:id/confirm,
//   POST /v1/bo/dual-control/:id/cancel, POST /v1/bo/accounts/:id/brevo-suppression/lift,
//   GET /v1/bo/alerts; and the reads of the screens (J8 commit 9, migration 0138): GET /v1/bo/me
//   (J3S-6, 15 RG107), GET /v1/bo/dual-control, GET /v1/bo/internal-accounts, the B-7 sign-ins
//   of GET /v1/bo/alerts; and the J8 debt of J9 commit 2: the target of a 2V view (J8S-2), GET
//   /v1/bo/dual-control/degraded (J8S-1) and the `admin` grants of GET /v1/bo/alerts (J8S-4);
//   J9 commit 10: AL25 of a destination down or over quota (J8T-2, CA62), and the Apollo country
//   lists through the dual control (0149).
// The fixtures (agent, two admins, members, sessions, queue lines, contact states, a reconciliation
// run) are COMMITTED by the migration role (random identifiers, disposable local stack, like TM1);
// the queue lines are removed, the internal profiles deactivated and the Apollo scope restored
// after the file. Two admins exist, so the dual control here is the peer form (PD7: the degraded
// form is t8-dual-control-service's).
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { localSuperuser, migrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";

/** Every route of the commit, with a body that passes its schema. */
const ROUTES: readonly {
  method: "GET" | "POST";
  url: string;
  body?: object;
}[] = [
  {
    method: "POST",
    url: "/v1/bo/leads/replays",
    body: {
      items: [{ accountId: NIL, destination: "brevo" }],
      reasonCode: "provider_recovered",
    },
  },
  {
    method: "POST",
    url: `/v1/bo/accounts/${NIL}/corrections`,
    body: { reasonCode: "signup_error", countryCode: "BE" },
  },
  { method: "GET", url: "/v1/bo/settings/apollo" },
  {
    method: "POST",
    url: "/v1/bo/dual-control",
    body: {
      code: "leads.change_apollo_setting",
      setting: { key: "apollo_scope", value: "annonceurs_seuls" },
      reasonCode: "founder_decision",
    },
  },
  { method: "GET", url: `/v1/bo/dual-control/${NIL}` },
  { method: "POST", url: `/v1/bo/dual-control/${NIL}/confirm`, body: {} },
  { method: "POST", url: `/v1/bo/dual-control/${NIL}/cancel` },
  {
    method: "POST",
    url: `/v1/bo/accounts/${NIL}/brevo-suppression/lift`,
    body: { reasonCode: "member_request" },
  },
  { method: "GET", url: "/v1/bo/alerts" },
  { method: "GET", url: "/v1/bo/dual-control" },
  { method: "GET", url: "/v1/bo/dual-control/degraded" },
  { method: "GET", url: "/v1/bo/internal-accounts" },
];

let database: ApiDatabase;
const internals: string[] = [];
const members: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];
let apolloScopeBefore: unknown;

let migrationSql: postgres.Sql | undefined;

/** One connection of the migration role for the file (each migrationRole() opens a pool). */
function migration(): postgres.Sql {
  migrationSql ??= migrationRole();
  return migrationSql;
}

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Internal = {
  accountId: string;
  email: string;
  session: string;
  sessionId: string;
};

/** An active agent or admin with a TOTP factor, and a backoffice session proven by TOTP now. */
async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const email = `t14-act-${role}-${accountId}@example.test`;
  const token = randomBytes(32);
  const sessionId = await migration().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', 'Camille', true, now(),
              'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, 'Camille', now(), now(), ${randomUUID()})`;
    const [row] = await tx<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')
      returning id::text`;
    return row?.id ?? "";
  });
  internals.push(accountId);
  watchedValues.push(email);
  return { accountId, email, session: token.toString("base64url"), sessionId };
}

/** Moves the TOTP proof of a session back (R is 300 seconds; the guard is disabled here). */
async function ageSecondFactor(
  sessionId: string,
  seconds: number,
): Promise<void> {
  await migration().begin(async (tx) => {
    await tx`alter table identity.sessions disable trigger sessions_guard_update`;
    await tx`
      update identity.sessions
         set created_at          = created_at          - make_interval(secs => ${seconds}),
             last_activity_at    = last_activity_at    - make_interval(secs => ${seconds}),
             idle_expires_at     = idle_expires_at     - make_interval(secs => ${seconds}),
             absolute_expires_at = absolute_expires_at - make_interval(secs => ${seconds}),
             mfa_verified_at     = mfa_verified_at     - make_interval(secs => ${seconds})
       where id = ${sessionId}`;
    await tx`alter table identity.sessions enable trigger sessions_guard_update`;
  });
}

type Member = { accountId: string; email: string; session: string };

/** A committed member account with its sign-up consent (marketing e-mail), and a session. */
async function newMember(
  role: "advertiser" | "creator",
  options: { owner?: string; consentAt?: string } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `t14-act-member-${accountId}@example.test`;
  const token = randomBytes(32);
  await migration().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
              ${role === "advertiser" ? "business" : "individual"}::identity.declared_status,
              ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    if (role === "advertiser") {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
    }
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
      values (${accountId}, 'marketing_email', true, 'signup_form',
              coalesce(${options.consentAt ?? null}::timestamptz, now()))`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')`;
  });
  members.push(accountId);
  watchedValues.push(email);
  return { accountId, email, session: token.toString("base64url") };
}

type LineSpec = {
  destination: "brevo_contact" | "apollo_contact";
  status: "pending" | "succeeded" | "skipped" | "failed";
  attempts?: number;
  skipReason?: string;
  errorCode?: string;
  /** Seconds back for the creation (and the completion of a closed line). */
  agedSeconds?: number;
  /** How many identical lines (each its own event and key). */
  count?: number;
};

/** lead.created queue lines of the account, in a state (constraints of 0101, 0111). */
async function queueLines(accountId: string, line: LineSpec): Promise<void> {
  const closed = line.status !== "pending";
  await migration()`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status, attempts,
       available_at, skip_reason, last_error_code, created_at, completed_at)
    select e.id, 'lead.created', ${line.destination}::leads.outbox_destination,
           ${`account:${accountId}`}, jsonb_build_object('event_id', e.id),
           'lead.created:' || e.id::text, ${line.status}::leads.outbox_status,
           ${line.attempts ?? 0}, now() + interval '10 minutes',
           ${line.status === "skipped" ? (line.skipReason ?? "no_consent") : null},
           ${line.errorCode ?? null},
           now() - make_interval(secs => ${line.agedSeconds ?? 0}),
           case when ${closed} then now() - make_interval(secs => ${line.agedSeconds ?? 0}) end
      from (select gen_random_uuid() as id from generate_series(1, ${line.count ?? 1})) e`;
}

/** The state of a contact at one destination, as the worker writes it (0111). */
async function contactState(
  accountId: string,
  destination: "brevo_contact" | "apollo_contact",
  lastStatus: "succeeded" | "skipped" | "failed",
  lastCode: string | null,
  extra: { unsubscribedAt?: string; suppressed?: string } = {},
): Promise<void> {
  await migration()`
    insert into leads.contact_sync_states
      (account_id, destination, last_attempt_at, last_success_at, last_status, last_error_code,
       unsubscribed_at, suppressed_reason)
    values (${accountId}, ${destination}::leads.outbox_destination, now(),
            case when ${lastStatus === "succeeded"} then now() end,
            ${lastStatus}::leads.outbox_status, ${lastCode},
            ${extra.unsubscribedAt ?? null}::timestamptz, ${extra.suppressed ?? null})`;
}

function app() {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
  });
}

type Server = ReturnType<typeof app>;

function call(
  server: Server,
  method: "GET" | "POST",
  url: string,
  session: string | null,
  body?: object,
  options: { surface?: "backoffice" | "web"; cookie?: string } = {},
): Promise<LightMyRequestResponse> {
  const cookieName = options.cookie ?? "__Host-influx-ops-session";
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

/** The body of an error envelope, without its request id. */
function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json<{
    error: { code: string; message: string; requestId: string };
  }>();
  return { status: response.statusCode, code: error.code };
}

async function registerLines(
  eventType: string,
  subjectId: string,
): Promise<{ actor: string | null; payload: Record<string, unknown> }[]> {
  return migration()<
    { actor: string | null; payload: Record<string, unknown> }[]
  >`
    select actor_account_id::text as actor, payload
      from audit.audit_events
     where event_type = ${eventType} and subject_id = ${subjectId}
     order by seq`;
}

async function linesOf(accountId: string) {
  return migration()<
    {
      event_type: string;
      destination: string;
      status: string;
      attempts: number;
      idempotency_key: string;
    }[]
  >`
    select event_type, destination::text as destination, status::text as status, attempts,
           idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${accountId}`}
     order by id`;
}

let agent: Internal;
let otherAgent: Internal;
let adminA: Internal;
let adminB: Internal;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  agent = await newInternal("agent");
  otherAgent = await newInternal("agent");
  adminA = await newInternal("admin");
  adminB = await newInternal("admin");
  const [scope] = await migration()<{ value: unknown }[]>`
    select value from leads.sync_settings where key = 'apollo_scope'`;
  apolloScopeBefore = scope?.value;
});

afterAll(async () => {
  await closeDatabase(database);
  await migration()`
    update leads.sync_settings set value = to_jsonb(${String(apolloScopeBefore)}::text),
           updated_by_account_id = null
     where key = 'apollo_scope'`;
  if (members.length > 0) {
    await migration()`
      delete from leads.outbox_events
       where subject_key = any (${members.map((id) => `account:${id}`)}::text[])`;
  }
  if (internals.length > 0) {
    await migration()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------

describe("T14 on every action route (18 T14.1; 03 §6.2)", () => {
  it("no session, or a member session, is 401; the web surface never reaches them (404)", async () => {
    const server = app();
    const member = await newMember("creator");
    for (const route of ROUTES) {
      const label = `${route.method} ${route.url}`;
      expect(
        (await call(server, route.method, route.url, null, route.body))
          .statusCode,
        label,
      ).toBe(401);
      expect(
        errorBody(
          await call(
            server,
            route.method,
            route.url,
            member.session,
            route.body,
          ),
        ),
        label,
      ).toEqual({ status: 401, code: "unauthenticated" });
      expect(
        (
          await call(
            server,
            route.method,
            route.url,
            member.session,
            route.body,
            {
              surface: "web",
              cookie: "__Host-influx-session",
            },
          )
        ).statusCode,
        label,
      ).toBe(404);
    }
  });
});

describe("POST /v1/bo/leads/replays (05 RG101 to RG103, CA58 to CA61)", () => {
  it("CA58: puts a failed line back in the queue, same idempotency key, journaled with the agent's name", async () => {
    const member = await newMember("creator", { owner: agent.accountId });
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "apollo.unavailable",
    });
    const [before] = await linesOf(member.accountId);
    const response = await call(
      app(),
      "POST",
      "/v1/bo/leads/replays",
      agent.session,
      {
        items: [{ accountId: member.accountId, destination: "apollo" }],
        reasonCode: "provider_recovered",
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<{
      replayId: string;
      requested: number;
      requeued: number;
      ignored: number;
      refused: number;
      items: { outcome: string; lines: number }[];
    }>();
    expect(body).toMatchObject({
      requested: 1,
      requeued: 1,
      ignored: 0,
      refused: 0,
    });
    expect(body.items).toEqual([
      {
        accountId: member.accountId,
        destination: "apollo",
        outcome: "requeued",
        lines: 1,
      },
    ]);
    const [after] = await linesOf(member.accountId);
    expect(after).toMatchObject({ status: "pending", attempts: 0 });
    expect(after?.idempotency_key).toBe(before?.idempotency_key);
    const journal = await registerLines(
      "leads.replay_requested",
      body.replayId,
    );
    expect(journal).toHaveLength(1);
    expect(journal[0]?.actor).toBe(agent.accountId);
    expect(journal[0]?.payload).toMatchObject({
      reason_code: "provider_recovered",
      requested: 1,
      requeued: 1,
    });
  });

  it("CA82, RG161: a configuration failure is replayable, same line, same key, reason configuration_fixed", async () => {
    const member = await newMember("creator", { owner: agent.accountId });
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "failed",
      errorCode: "list_not_configured",
    });
    const [before] = await linesOf(member.accountId);
    const response = await call(
      app(),
      "POST",
      "/v1/bo/leads/replays",
      agent.session,
      {
        items: [{ accountId: member.accountId, destination: "brevo" }],
        reasonCode: "configuration_fixed",
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json<{ requeued: number }>().requeued).toBe(1);
    const [after] = await linesOf(member.accountId);
    expect(after).toMatchObject({ status: "pending", attempts: 0 });
    expect(after?.idempotency_key).toBe(before?.idempotency_key);
  });

  it("CA60: a contact skipped for want of consent is refused, never replayed, nothing journaled", async () => {
    const member = await newMember("creator");
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "skipped",
      skipReason: "no_consent",
    });
    await contactState(
      member.accountId,
      "brevo_contact",
      "skipped",
      "no_consent",
    );
    const body = (
      await call(app(), "POST", "/v1/bo/leads/replays", agent.session, {
        items: [{ accountId: member.accountId, destination: "brevo" }],
        reasonCode: "transient_failure",
      })
    ).json<{
      replayId: string | null;
      refused: number;
      items: { outcome: string }[];
    }>();
    expect(body.replayId).toBeNull();
    expect(body.refused).toBe(1);
    expect(body.items[0]?.outcome).toBe("no_consent");
    expect((await linesOf(member.accountId))[0]?.status).toBe("skipped");
  });

  it("CA59: 250 pairs selected, 200 at most per operation, lines capped at 200 too, the surplus said", async () => {
    const big = await newMember("creator");
    await queueLines(big.accountId, {
      destination: "brevo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "brevo.unavailable",
      count: 150,
    });
    const next = await newMember("creator");
    await queueLines(next.accountId, {
      destination: "apollo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "apollo.unavailable",
      count: 60,
    });
    const filler = Array.from({ length: 248 }, () => ({
      accountId: randomUUID(),
      destination: "brevo" as const,
    }));
    const response = await call(
      app(),
      "POST",
      "/v1/bo/leads/replays",
      agent.session,
      {
        items: [
          { accountId: big.accountId, destination: "brevo" },
          { accountId: next.accountId, destination: "apollo" },
          ...filler,
        ],
        reasonCode: "provider_recovered",
      },
    );
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      requested: number;
      requeued: number;
      ignored: number;
      refused: number;
      items: { accountId: string; outcome: string; lines: number }[];
    }>();
    expect(body).toMatchObject({
      requested: 250,
      requeued: 1,
      ignored: 0,
      refused: 249,
    });
    expect(body.items[0]).toMatchObject({ outcome: "requeued", lines: 150 });
    // its 60 lines would take the operation past 200 lines
    expect(body.items[1]).toMatchObject({ outcome: "over_cap", lines: 0 });
    expect(
      body.items
        .slice(2, 200)
        .every((item) => item.outcome === "nothing_to_replay"),
    ).toBe(true);
    expect(
      body.items.slice(200).every((item) => item.outcome === "over_cap"),
    ).toBe(true);
    expect(
      (await linesOf(next.accountId)).every((line) => line.status === "failed"),
    ).toBe(true);
  });

  it("CA61: two agents replay the same line at once: one requeues, the other is told it is already in progress", async () => {
    const member = await newMember("advertiser");
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "brevo.rate_limited",
    });
    const server = app();
    const body = {
      items: [{ accountId: member.accountId, destination: "brevo" }],
      reasonCode: "quota_restored",
    };
    const outcomes = await Promise.all(
      [agent, otherAgent].map(
        async (who) =>
          (
            await call(
              server,
              "POST",
              "/v1/bo/leads/replays",
              who.session,
              body,
            )
          ).json<{ items: { outcome: string }[] }>().items[0]?.outcome,
      ),
    );
    expect(outcomes.sort()).toEqual(["already_in_progress", "requeued"]);
    const lines = await linesOf(member.accountId);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.status).toBe("pending");
  });

  it("a synced contact is ignored, an unknown or internal account has nothing to replay", async () => {
    const member = await newMember("advertiser");
    await contactState(member.accountId, "brevo_contact", "succeeded", null);
    const body = (
      await call(app(), "POST", "/v1/bo/leads/replays", adminA.session, {
        items: [
          { accountId: member.accountId, destination: "brevo" },
          { accountId: agent.accountId, destination: "brevo" },
          { accountId: randomUUID(), destination: "apollo" },
        ],
        reasonCode: "data_corrected",
      })
    ).json<{
      ignored: number;
      refused: number;
      items: { outcome: string }[];
    }>();
    expect(body.items.map((item) => item.outcome)).toEqual([
      "already_synced",
      "nothing_to_replay",
      "nothing_to_replay",
    ]);
    expect(body).toMatchObject({ ignored: 1, refused: 2 });
  });
});

describe("POST /v1/bo/accounts/:id/corrections (05 RG108)", () => {
  it("an agent corrects the country with a typed reason: journaled, one lead.updated per destination", async () => {
    const member = await newMember("creator");
    const response = await call(
      app(),
      "POST",
      `/v1/bo/accounts/${member.accountId}/corrections`,
      agent.session,
      {
        reasonCode: "signup_error",
        countryCode: "BE",
        comment: "Pays saisi par erreur",
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ changed: true });
    const journal = await registerLines("account.corrected", member.accountId);
    expect(journal).toEqual([
      {
        actor: agent.accountId,
        payload: {
          field: "country_code",
          from: "FR",
          to: "BE",
          reason_code: "signup_error",
          comment: "Pays saisi par erreur",
        },
      },
    ]);
    expect(
      (await linesOf(member.accountId))
        .filter((line) => line.event_type === "lead.updated")
        .map((line) => line.destination)
        .sort(),
    ).toEqual(["apollo_contact", "brevo_contact"]);
    // the same value again: nothing written
    expect(
      (
        await call(
          app(),
          "POST",
          `/v1/bo/accounts/${member.accountId}/corrections`,
          agent.session,
          { reasonCode: "signup_error", countryCode: "BE" },
        )
      ).json(),
    ).toEqual({ changed: false });
  });

  it("an unknown, internal or own account answers the same 404; an individual advertiser is a 409", async () => {
    const server = app();
    const bodies = [];
    for (const id of [randomUUID(), adminA.accountId, agent.accountId]) {
      bodies.push(
        errorBody(
          await call(
            server,
            "POST",
            `/v1/bo/accounts/${id}/corrections`,
            agent.session,
            {
              reasonCode: "data_quality",
              preferredLanguage: "en",
            },
          ),
        ),
      );
    }
    expect(bodies).toEqual([
      { status: 404, code: "not_found" },
      { status: 404, code: "not_found" },
      { status: 404, code: "not_found" },
    ]);
    const advertiser = await newMember("advertiser");
    expect(
      errorBody(
        await call(
          server,
          "POST",
          `/v1/bo/accounts/${advertiser.accountId}/corrections`,
          agent.session,
          { reasonCode: "data_quality", declaredStatus: "individual" },
        ),
      ),
    ).toEqual({ status: 409, code: "conflict" });
  });
});

describe("Apollo settings under 2V + R (05 RG81, CA63; 03 PD1 to PD7)", () => {
  it("CA63: an agent who reads or requests a change of the Apollo scope is refused, and the attempt journaled", async () => {
    const server = app();
    const before = (
      await registerLines("backoffice.action_refused", agent.accountId)
    ).length;
    expect(
      errorBody(
        await call(server, "GET", "/v1/bo/settings/apollo", agent.session),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
    expect(
      errorBody(
        await call(server, "POST", "/v1/bo/dual-control", agent.session, {
          code: "leads.change_apollo_setting",
          setting: { key: "apollo_scope", value: "tous_les_inscrits" },
          reasonCode: "founder_decision",
        }),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
    const lines = await registerLines(
      "backoffice.action_refused",
      agent.accountId,
    );
    expect(lines.slice(before)).toEqual([
      {
        actor: agent.accountId,
        payload: {
          action_code: "leads.read_apollo_settings",
          required_role: "admin",
        },
      },
      {
        actor: agent.accountId,
        payload: {
          action_code: "backoffice.dual_control",
          required_role: "admin",
        },
      },
    ]);
  });

  it("an admin reads the three keys", async () => {
    const response = await call(
      app(),
      "GET",
      "/v1/bo/settings/apollo",
      adminA.session,
    );
    expect(response.statusCode).toBe(200);
    const keys = response
      .json<{ settings: { setting: { key: string } }[] }>()
      .settings.map((row) => row.setting.key);
    expect(keys).toEqual([
      "apollo_excluded_countries",
      "apollo_legal_basis",
      "apollo_scope",
    ]);
  });

  it("requested by one admin, confirmed by a peer with R: the scope changes and the skipped creators are re-evaluated", async () => {
    const server = app();
    const creator = await newMember("creator");
    await contactState(
      creator.accountId,
      "apollo_contact",
      "skipped",
      "out_of_apollo_scope_individual",
    );
    const requested = await call(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA.session,
      {
        code: "leads.change_apollo_setting",
        setting: { key: "apollo_scope", value: "tous_les_inscrits" },
        reasonCode: "founder_decision",
        reasonNote: "Arbitrage A7",
      },
    );
    expect(requested.statusCode).toBe(200);
    const view = requested.json<{
      id: string;
      state: string;
      next: { kind: string };
      recap: { scope: { kind: string } };
    }>();
    expect(view).toMatchObject({
      state: "pending",
      next: { kind: "await_peer" },
      recap: { scope: { kind: "setting" } },
    });
    const seen = (
      await call(
        server,
        "GET",
        `/v1/bo/dual-control/${view.id}`,
        adminB.session,
      )
    ).json<{ next: { kind: string } }>();
    expect(seen.next).toEqual({ kind: "confirm_as_peer" });

    const confirmed = await call(
      server,
      "POST",
      `/v1/bo/dual-control/${view.id}/confirm`,
      adminB.session,
      {},
    );
    expect(confirmed.statusCode).toBe(200);
    const result = confirmed.json<{ mode: string; reevaluated: number }>();
    expect(result.mode).toBe("peer");
    expect(result.reevaluated).toBeGreaterThanOrEqual(1);
    const [setting] = await migration()<{ value: unknown; by: string }[]>`
      select value, updated_by_account_id::text as by
        from leads.sync_settings where key = 'apollo_scope'`;
    expect(setting).toEqual({
      value: "tous_les_inscrits",
      by: adminB.accountId,
    });
    expect(
      (await linesOf(creator.accountId)).map((line) => [
        line.event_type,
        line.destination,
      ]),
    ).toEqual([["lead.updated", "apollo_contact"]]);
    // 0145: written by the trigger of leads.sync_settings, exactly once for this act, with the
    // context of the backoffice writer (reevaluated included) and nothing of a connection role
    const journal = await migration()<
      { actor: string; payload: Record<string, unknown> }[]
    >`
      select actor_account_id::text as actor, payload from audit.audit_events
       where event_type = 'settings.changed'
         and subject_id = md5('leads.sync_settings:apollo_scope')::uuid
         and payload ->> 'dual_control_request_id' = ${view.id}
       order by seq`;
    expect(journal).toEqual([
      {
        actor: adminB.accountId,
        payload: {
          key: "apollo_scope",
          from: apolloScopeBefore,
          to: "tous_les_inscrits",
          reason_code: "founder_decision",
          dual_control_request_id: view.id,
          dual_control: "peer",
          reevaluated: result.reevaluated,
        },
      },
    ]);
    // single use: a second confirmation is a conflict
    expect(
      errorBody(
        await call(
          server,
          "POST",
          `/v1/bo/dual-control/${view.id}/confirm`,
          adminB.session,
          {},
        ),
      ),
    ).toEqual({ status: 409, code: "conflict" });
  });

  // J9 commit 10 (0149, found by the axe journey J8T-4): a country list reaches the database's
  // check of known codes — before 0149 the definer saw no country and refused every one.
  it("0149: excluded countries and an exception by country are requested, confirmed by a peer and applied", async () => {
    const server = app();
    const sql = migration();
    const saved = await sql<{ key: string; value: unknown }[]>`
      select key, value from leads.sync_settings
       where key in ('apollo_excluded_countries', 'apollo_legal_basis')`;
    try {
      for (const setting of [
        { key: "apollo_excluded_countries", value: ["IT", "DE"] },
        {
          key: "apollo_legal_basis",
          value: {
            default: "consentement_requis",
            byCountry: [
              { countryCode: "BE", basis: "interet_legitime_avec_opposition" },
            ],
          },
        },
      ]) {
        const requested = await call(
          server,
          "POST",
          "/v1/bo/dual-control",
          adminA.session,
          {
            code: "leads.change_apollo_setting",
            setting,
            reasonCode: "legal_restriction",
          },
        );
        expect(requested.statusCode).toBe(200);
        const { id } = requested.json<{ id: string }>();
        const confirmed = await call(
          server,
          "POST",
          `/v1/bo/dual-control/${id}/confirm`,
          adminB.session,
          {},
        );
        expect(confirmed.statusCode).toBe(200);
      }
      const applied = await sql<{ key: string; value: unknown }[]>`
        select key, value from leads.sync_settings
         where key in ('apollo_excluded_countries', 'apollo_legal_basis') order by key`;
      expect(applied).toEqual([
        { key: "apollo_excluded_countries", value: ["DE", "IT"] },
        {
          key: "apollo_legal_basis",
          value: {
            default: "consentement_requis",
            by_country: { BE: "interet_legitime_avec_opposition" },
          },
        },
      ]);
    } finally {
      for (const { key, value } of saved) {
        await sql`
          update leads.sync_settings
             set value = ${JSON.stringify(value)}::text::jsonb, updated_by_account_id = null
           where key = ${key}`;
      }
    }
  });

  it("without a fresh second factor the confirmation is refused and said so; the request stays pending", async () => {
    const server = app();
    const requested = (
      await call(server, "POST", "/v1/bo/dual-control", adminA.session, {
        code: "leads.change_apollo_setting",
        setting: { key: "apollo_scope", value: "annonceurs_seuls" },
        reasonCode: "legal_restriction",
      })
    ).json<{ id: string }>();
    const stale = await newInternal("admin");
    await ageSecondFactor(stale.sessionId, 301);
    expect(
      errorBody(
        await call(
          server,
          "POST",
          `/v1/bo/dual-control/${requested.id}/confirm`,
          stale.session,
          {},
        ),
      ),
    ).toEqual({ status: 403, code: "reauthentication_required" });
    const view = (
      await call(
        server,
        "GET",
        `/v1/bo/dual-control/${requested.id}`,
        adminA.session,
      )
    ).json<{ state: string; executed: boolean }>();
    expect(view).toMatchObject({ state: "pending", executed: false });
    expect(
      (
        await call(
          server,
          "POST",
          `/v1/bo/dual-control/${requested.id}/cancel`,
          adminA.session,
        )
      ).json(),
    ).toEqual({ cancelled: true });
  });

  it("RG108: a role change carries the brand's name in the 2V and becomes an advertiser on confirmation", async () => {
    const server = app();
    const creator = await newMember("creator");
    const requested = await call(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA.session,
      {
        code: "identity.change_member_role",
        accountId: creator.accountId,
        legalName: "Atelier Nord SAS",
        reasonCode: "member_request",
      },
    );
    expect(requested.statusCode).toBe(200);
    const view = requested.json<{
      id: string;
      action: Record<string, unknown>;
    }>();
    expect(view.action).toEqual({
      code: "identity.change_member_role",
      accountId: creator.accountId,
      role: "advertiser",
      legalName: "Atelier Nord SAS",
    });
    expect(
      (
        await call(
          server,
          "POST",
          `/v1/bo/dual-control/${view.id}/confirm`,
          adminB.session,
          {},
        )
      ).json(),
    ).toEqual({ mode: "peer", reevaluated: null });
    const [account] = await migration()<{ role: string; legal_name: string }[]>`
      select r.role::text as role, p.legal_name
        from identity.account_roles r
        join profiles.advertiser_profiles p on p.account_id = r.account_id
       where r.account_id = ${creator.accountId}`;
    expect(account).toEqual({
      role: "advertiser",
      legal_name: "Atelier Nord SAS",
    });
    // the admin's own account, or an internal one: the same 404
    for (const id of [adminA.accountId, agent.accountId]) {
      expect(
        errorBody(
          await call(server, "POST", "/v1/bo/dual-control", adminA.session, {
            code: "identity.change_member_role",
            accountId: id,
            legalName: "Atelier Nord SAS",
            reasonCode: "member_request",
          }),
        ),
      ).toEqual({ status: 404, code: "not_found" });
    }
  });
});

describe("POST /v1/bo/accounts/:id/brevo-suppression/lift (05 RG93, CA55)", () => {
  it("an admin with R lifts a complaint; a consent given after it is sent again to Brevo", async () => {
    const member = await newMember("creator", {
      consentAt: new Date().toISOString(),
    });
    await contactState(member.accountId, "brevo_contact", "succeeded", null, {
      unsubscribedAt: new Date(Date.now() - 3_600_000).toISOString(),
      suppressed: "spam_complaint",
    });
    const url = `/v1/bo/accounts/${member.accountId}/brevo-suppression/lift`;
    const response = await call(app(), "POST", url, adminA.session, {
      reasonCode: "complaint_misattributed",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ resyncQueued: true });
    const [state] = await migration()<{ suppressed: string | null }[]>`
      select suppressed_reason as suppressed from leads.contact_sync_states
       where account_id = ${member.accountId} and destination = 'brevo_contact'`;
    expect(state?.suppressed).toBeNull();
    expect(
      (await linesOf(member.accountId)).map((line) => [
        line.event_type,
        line.destination,
      ]),
    ).toEqual([["consent.granted", "brevo_contact"]]);
    expect(
      await registerLines("leads.suppression_lifted", member.accountId),
    ).toEqual([
      {
        actor: adminA.accountId,
        payload: {
          reason_code: "complaint_misattributed",
          previous_reason: "spam_complaint",
          resync_queued: true,
        },
      },
    ]);
    // nothing left to lift
    expect(
      errorBody(
        await call(app(), "POST", url, adminA.session, {
          reasonCode: "member_request",
        }),
      ),
    ).toEqual({ status: 409, code: "conflict" });
  });

  it("EC-J8-27: without a consent after the complaint, the lift never resubscribes", async () => {
    const member = await newMember("creator", {
      consentAt: new Date(Date.now() - 7_200_000).toISOString(),
    });
    await contactState(member.accountId, "brevo_contact", "succeeded", null, {
      unsubscribedAt: new Date(Date.now() - 3_600_000).toISOString(),
      suppressed: "spam_complaint",
    });
    const response = await call(
      app(),
      "POST",
      `/v1/bo/accounts/${member.accountId}/brevo-suppression/lift`,
      adminA.session,
      { reasonCode: "member_request" },
    );
    expect(response.json()).toEqual({ resyncQueued: false });
    expect(await linesOf(member.accountId)).toEqual([]);
  });

  it("an agent is refused and journaled; an admin without a fresh R is told to re-authenticate", async () => {
    const member = await newMember("creator");
    await contactState(member.accountId, "brevo_contact", "succeeded", null, {
      unsubscribedAt: new Date().toISOString(),
      suppressed: "spam_complaint",
    });
    const url = `/v1/bo/accounts/${member.accountId}/brevo-suppression/lift`;
    expect(
      errorBody(
        await call(app(), "POST", url, agent.session, {
          reasonCode: "member_request",
        }),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
    expect(
      (await registerLines("backoffice.action_refused", agent.accountId)).at(-1)
        ?.payload,
    ).toEqual({
      action_code: "leads.lift_brevo_suppression",
      required_role: "admin",
    });
    const stale = await newInternal("admin");
    await ageSecondFactor(stale.sessionId, 301);
    expect(
      errorBody(
        await call(app(), "POST", url, stale.session, {
          reasonCode: "member_request",
        }),
      ),
    ).toEqual({ status: 403, code: "reauthentication_required" });
  });
});

describe("GET /v1/bo/alerts (05 RG104, CA62; 15 §F)", () => {
  type Alerts = {
    evaluatedAt: string;
    alerts: {
      code: string;
      cause: string;
      destination: string | null;
      setting?: string | null;
      count: number;
    }[];
  };

  function find(body: Alerts, code: string, destination: string | null) {
    return body.alerts.find(
      (alert) => alert.code === code && alert.destination === destination,
    );
  }

  it("CA62: a refused Apollo key raises AL25 at once for the admin, with the lines waiting", async () => {
    const member = await newMember("advertiser");
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      status: "pending",
      attempts: 2,
      errorCode: "apollo.unauthorized",
      agedSeconds: 1200,
      count: 3,
    });
    const body = (
      await call(app(), "GET", "/v1/bo/alerts", adminA.session)
    ).json<Alerts>();
    const alert = find(body, "AL25", "apollo");
    expect(alert?.cause).toBe("access_key_refused");
    expect(alert?.count).toBeGreaterThanOrEqual(3);
  });

  it("CA82, RG160: a missing list raises AL25 at once, naming the setting of the role, never a value", async () => {
    const member = await newMember("creator");
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "failed",
      errorCode: "list_not_configured",
    });
    const body = (
      await call(app(), "GET", "/v1/bo/alerts", adminA.session)
    ).json<Alerts>();
    const alert = body.alerts.find(
      (candidate) =>
        candidate.code === "AL25" &&
        candidate.cause === "configuration_missing" &&
        candidate.destination === "brevo",
    );
    expect(alert).toMatchObject({ setting: "brevo_list_creators" });
    expect(alert?.count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(body)).not.toMatch(/brevo_list_ids/);
  });

  it("AL24: failures past the delay of their queue, the agent's own accounts only, the admin all of them", async () => {
    const server = app();
    const count = async (who: Internal) =>
      find(
        (
          await call(server, "GET", "/v1/bo/alerts", who.session)
        ).json<Alerts>(),
        "AL24",
        "brevo",
      )?.count ?? 0;
    const agentBefore = await count(agent);
    const adminBefore = await count(adminA);
    const owned = await newMember("creator", { owner: agent.accountId });
    const other = await newMember("creator");
    for (const member of [owned, other]) {
      await queueLines(member.accountId, {
        destination: "brevo_contact",
        status: "failed",
        attempts: 10,
        errorCode: "brevo.rejected",
        agedSeconds: 10 * 86_400,
      });
    }
    expect((await count(agent)) - agentBefore).toBe(1);
    expect((await count(adminA)) - adminBefore).toBe(2);
  });

  it("the admin alerts (AL25 to AL27) never reach an agent", async () => {
    const body = (
      await call(app(), "GET", "/v1/bo/alerts", agent.session)
    ).json<Alerts>();
    expect(body.alerts.every((alert) => alert.code === "AL24")).toBe(true);
  });

  it("AL27: the gap of the last reconciliation (ops.periodic_runs.counts) is up for the admin", async () => {
    const period = `${2100 + Math.floor(Math.random() * 800)}-${String(
      1 + Math.floor(Math.random() * 12),
    ).padStart(
      2,
      "0",
    )}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
    await migration()`
      insert into ops.periodic_runs (task_code, period_key, finished_at, outcome, counts)
      values ('brevo_reconciliation', ${period}, now(), 'succeeded', '{"gap": 4, "refused": 0}')`;
    const body = (
      await call(app(), "GET", "/v1/bo/alerts", adminA.session)
    ).json<Alerts>();
    expect(find(body, "AL27", null)).toMatchObject({
      cause: "unsubscribe_gap",
      count: 4,
    });
  });
});

describe("reads of the screens (J8 commit 9; 15 RG107, 17b §3.13, §3.14.e, J3S-6)", () => {
  it("GET /v1/bo/me: the factor of THIS session, and peer control with two active admins (CA71)", async () => {
    const response = await call(app(), "GET", "/v1/bo/me", agent.session);
    expect(response.json()).toEqual({
      email: agent.email,
      role: "agent",
      secondFactor: { method: "totp" },
      peerControlAvailable: true,
      // 16 RG118 (D70): the environment banner, from the configuration of the api.
      environment: { name: "development", brevoMode: "disabled" },
    });
  });

  it("GET /v1/bo/dual-control: an admin lists the pending requests with their PD7 step; an agent is refused and journaled", async () => {
    const server = app();
    const creator = await newMember("creator");
    const requested = await call(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA.session,
      {
        code: "identity.change_member_role",
        accountId: creator.accountId,
        legalName: "Maison Listée",
        reasonCode: "member_request",
      },
    );
    expect(requested.statusCode, requested.body).toBe(200);
    const id = requested.json<{ id: string }>().id;
    const listed = (
      await call(server, "GET", "/v1/bo/dual-control", adminB.session)
    ).json<{ requests: { id: string; next: { kind: string } }[] }>();
    expect(listed.requests.find((request) => request.id === id)?.next).toEqual({
      kind: "confirm_as_peer",
    });
    const own = (
      await call(server, "GET", "/v1/bo/dual-control", adminA.session)
    ).json<{ requests: { id: string; next: { kind: string } }[] }>();
    expect(own.requests.find((request) => request.id === id)?.next).toEqual({
      kind: "await_peer",
    });
    expect(
      errorBody(
        await call(server, "GET", "/v1/bo/dual-control", agent.session),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
    await call(
      server,
      "POST",
      `/v1/bo/dual-control/${id}/cancel`,
      adminA.session,
    );
    const after = (
      await call(server, "GET", "/v1/bo/dual-control", adminB.session)
    ).json<{ requests: { id: string }[] }>();
    expect(after.requests.some((request) => request.id === id)).toBe(false);
  });

  it("GET /v1/bo/internal-accounts: the admin sees the team with the accounts each one owns; an agent is refused", async () => {
    const server = app();
    await newMember("creator", { owner: otherAgent.accountId });
    const body = (
      await call(server, "GET", "/v1/bo/internal-accounts", adminA.session)
    ).json<{
      accounts: {
        id: string;
        role: string;
        firstName: string | null;
        secondFactorActive: boolean;
        active: boolean;
        breakGlass: boolean;
        ownedAccounts: number;
      }[];
    }>();
    expect(
      body.accounts.find((row) => row.id === otherAgent.accountId),
    ).toMatchObject({
      role: "agent",
      firstName: "Camille",
      secondFactorActive: true,
      active: true,
      breakGlass: false,
      ownedAccounts: 1,
    });
    // the active accounts first, admins before agents
    const active = body.accounts.filter((row) => row.active);
    expect(body.accounts.slice(0, active.length)).toEqual(active);
    const roles = active.map((row) => row.role);
    expect(roles.indexOf("agent")).toBeGreaterThan(roles.lastIndexOf("admin"));
    expect(
      errorBody(
        await call(server, "GET", "/v1/bo/internal-accounts", agent.session),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
  });

  it("B-7, RG145: an agent.new_browser line reaches the admins through GET /v1/bo/alerts, never an agent", async () => {
    const server = app();
    await localSuperuser()`
      select audit.append('agent.new_browser', 'account', ${otherAgent.accountId}::uuid,
                          jsonb_build_object('session_id', gen_random_uuid(),
                                             'browser', 'chrome.windows'))`;
    const forAdmin = (
      await call(server, "GET", "/v1/bo/alerts", adminA.session)
    ).json<{
      newBrowserSignIns: {
        accountId: string;
        firstName: string | null;
        browser: string;
      }[];
    }>();
    expect(
      forAdmin.newBrowserSignIns.find(
        (signIn) => signIn.accountId === otherAgent.accountId,
      ),
    ).toMatchObject({ firstName: "Camille", browser: "chrome.windows" });
    const forAgent = (
      await call(server, "GET", "/v1/bo/alerts", agent.session)
    ).json<{ newBrowserSignIns: unknown[] }>();
    expect(forAgent.newBrowserSignIns).toEqual([]);
  });
});

describe("J9 commit 2: the J8 debt of the 2V and of the home (J8S-1, J8S-2, J8S-4)", () => {
  it("J8S-2 (PD1): a 2V view names the member account by role, country, sign-up and brand, never by its address", async () => {
    const server = app();
    const creator = await newMember("creator");
    const requested = await call(
      server,
      "POST",
      "/v1/bo/dual-control",
      adminA.session,
      {
        code: "identity.change_member_role",
        accountId: creator.accountId,
        legalName: "Maison Visée",
        reasonCode: "member_request",
      },
    );
    expect(requested.statusCode, requested.body).toBe(200);
    const view = requested.json<{ id: string; target: unknown }>();
    expect(view.target).toEqual({
      kind: "member_account",
      accountId: creator.accountId,
      role: "creator",
      countryCode: "FR",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
      companyName: null,
    });
    // the address is read on the record only, whose opening is journaled (05 RG40)
    expect(requested.body).not.toContain(creator.email);
    expect(requested.body).not.toContain("@");
    const listed = (
      await call(server, "GET", "/v1/bo/dual-control", adminB.session)
    ).json<{ requests: { id: string; target: unknown }[] }>();
    expect(
      listed.requests.find((request) => request.id === view.id)?.target,
    ).toEqual(view.target);
    await call(
      server,
      "POST",
      `/v1/bo/dual-control/${view.id}/cancel`,
      adminA.session,
    );
  });

  it("J8S-2 (PD1): the 2V of an admin invitation names the address invited and the role, not an identifier", async () => {
    const server = app();
    const email = `t14-act-invited-${randomUUID()}@example.test`;
    watchedValues.push(email);
    const created = await call(
      server,
      "POST",
      "/v1/bo/internal-invitations",
      adminA.session,
      { email, role: "admin", reasonCode: "new_team_member" },
    );
    expect(created.statusCode, created.body).toBe(200);
    const { invitationId, dualControlRequestId } = created.json<{
      invitationId: string;
      dualControlRequestId: string | null;
    }>();
    expect(dualControlRequestId).not.toBeNull();
    const view = (
      await call(
        server,
        "GET",
        `/v1/bo/dual-control/${dualControlRequestId ?? ""}`,
        adminB.session,
      )
    ).json<{ action: unknown; target: unknown }>();
    expect(view.action).toEqual({
      code: "identity.invite_admin",
      invitationId,
    });
    expect(view.target).toEqual({
      kind: "internal_invitation",
      email,
      role: "admin",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
    });
    await call(
      server,
      "POST",
      `/v1/bo/dual-control/${dualControlRequestId ?? ""}/cancel`,
      adminA.session,
    );
    await call(
      server,
      "POST",
      `/v1/bo/internal-invitations/${invitationId}/revoke`,
      adminA.session,
      { reasonCode: "no_longer_needed" },
    );
  });

  it("J8S-1 (PD6): GET /v1/bo/dual-control/degraded gives the admin the weeks asked; an agent is refused and journaled", async () => {
    const server = app();
    const review = await call(
      server,
      "GET",
      "/v1/bo/dual-control/degraded",
      adminA.session,
    );
    expect(review.statusCode, review.body).toBe(200);
    expect(review.headers["cache-control"]).toBe("no-store");
    const body = review.json<{
      weeks: number;
      evaluatedAt: string;
      review: { week: string; confirmations: { requestedBy: string }[] }[];
    }>();
    expect(body.weeks).toBe(4);
    expect(body.review.length).toBeLessThanOrEqual(4);
    for (const week of body.review) {
      expect(week.week).toMatch(/^\d{4}-W\d{2}$/);
      expect(week.confirmations.length).toBeGreaterThan(0);
    }
    expect(
      (
        await call(
          server,
          "GET",
          "/v1/bo/dual-control/degraded?weeks=53",
          adminA.session,
        )
      ).json<{ weeks: number }>().weeks,
    ).toBe(53);
    for (const weeks of ["0", "54", "two"]) {
      expect(
        errorBody(
          await call(
            server,
            "GET",
            `/v1/bo/dual-control/degraded?weeks=${weeks}`,
            adminA.session,
          ),
        ),
        weeks,
      ).toEqual({ status: 400, code: "validation_failed" });
    }
    const before = (
      await registerLines("backoffice.action_refused", agent.accountId)
    ).length;
    expect(
      errorBody(
        await call(
          server,
          "GET",
          "/v1/bo/dual-control/degraded",
          agent.session,
        ),
      ),
    ).toEqual({ status: 403, code: "forbidden" });
    expect(
      (await registerLines("backoffice.action_refused", agent.accountId)).slice(
        before,
      ),
    ).toEqual([
      {
        actor: agent.accountId,
        payload: {
          action_code: "backoffice.dual_control",
          required_role: "admin",
        },
      },
    ]);
  });

  it("J8S-4 (RG101): an `admin` role granted reaches the admins through GET /v1/bo/alerts, never an agent", async () => {
    const server = app();
    const promoted = await newInternal("agent");
    await localSuperuser()`
      select audit.append('account.role_granted', 'account', ${promoted.accountId}::uuid,
                          jsonb_build_object('role', 'admin',
                                             'reason_code', 'internal_invitation',
                                             'granted_by_account_id', ${adminA.accountId}::text))`;
    const forAdmin = (
      await call(server, "GET", "/v1/bo/alerts", adminB.session)
    ).json<{ adminRoleGrants: { accountId: string }[] }>();
    expect(
      forAdmin.adminRoleGrants.find(
        (grant) => grant.accountId === promoted.accountId,
      ),
    ).toEqual({
      accountId: promoted.accountId,
      firstName: "Camille",
      grantedBy: adminA.accountId,
      grantedByFirstName: "Camille",
      grantedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
    });
    const forAgent = (
      await call(server, "GET", "/v1/bo/alerts", agent.session)
    ).json<{ adminRoleGrants: unknown[] }>();
    expect(forAgent.adminRoleGrants).toEqual([]);
  });
});

describe("J8T-2 (05 CA62, RG104): AL25 of a destination down, the query of the queue", () => {
  type Al25 = {
    alerts: {
      code: string;
      cause: string;
      destination: string | null;
      count: number;
      since: string | null;
    }[];
  };

  // The query reads the whole queue: each case owns it. Database files run one after the other
  // and remove their own lines; what an interrupted run left behind is removed here too.
  beforeEach(async () => {
    await migration()`
      delete from leads.outbox_events
       where destination in ('brevo_contact', 'apollo_contact')`;
  });

  /** The AL25 alerts of the contact destinations (thresholds in force: 15 minutes, 0134). */
  async function al25(): Promise<Al25["alerts"]> {
    const body = (
      await call(app(), "GET", "/v1/bo/alerts", adminA.session)
    ).json<Al25>();
    return body.alerts.filter(
      (alert) =>
        alert.code === "AL25" &&
        (alert.cause === "destination_down" ||
          alert.cause === "quota_exceeded"),
    );
  }

  const FAILING_FOR_20_MIN = {
    status: "pending",
    attempts: 2,
    agedSeconds: 20 * 60,
  } as const;

  it("lines failing for more than 15 minutes, nothing succeeded since: destination_down, with every line waiting", async () => {
    const member = await newMember("advertiser");
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      ...FAILING_FOR_20_MIN,
      errorCode: "apollo.unavailable",
      count: 2,
    });
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      ...FAILING_FOR_20_MIN,
      agedSeconds: 40 * 60,
      errorCode: "apollo.unreachable",
    });
    // Waiting, never tried: counted as waiting, not as failing.
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      status: "pending",
    });
    // A success OUTSIDE the window says nothing of now.
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      status: "succeeded",
      attempts: 1,
      agedSeconds: 16 * 60,
    });
    const alerts = await al25();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      cause: "destination_down",
      destination: "apollo",
      count: 4,
    });
    // `since`: the oldest line still failing, 40 minutes ago.
    const age = Date.now() - Date.parse(alerts[0]?.since ?? "");
    expect(age).toBeGreaterThan(39 * 60_000);
    expect(age).toBeLessThan(41 * 60_000);
  });

  it("a quota code among the failing lines names the cause quota_exceeded", async () => {
    const member = await newMember("creator");
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      ...FAILING_FOR_20_MIN,
      errorCode: "brevo.rate_limited",
    });
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      ...FAILING_FOR_20_MIN,
      errorCode: "brevo.unavailable",
    });
    expect(await al25()).toEqual([
      expect.objectContaining({
        cause: "quota_exceeded",
        destination: "brevo",
        count: 2,
      }),
    ]);
  });

  it("no alert under 15 minutes, nor once a line of the same destination succeeded within them", async () => {
    const member = await newMember("creator");
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      ...FAILING_FOR_20_MIN,
      agedSeconds: 10 * 60,
      errorCode: "brevo.unavailable",
    });
    expect(await al25()).toEqual([]);

    await queueLines(member.accountId, {
      destination: "brevo_contact",
      ...FAILING_FOR_20_MIN,
      errorCode: "brevo.unavailable",
    });
    expect(await al25()).toHaveLength(1);
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "succeeded",
      attempts: 1,
      agedSeconds: 2 * 60,
    });
    expect(await al25()).toEqual([]);
  });

  it("a success of Brevo does not clear Apollo; a closed failed line is AL24's, never waiting", async () => {
    const member = await newMember("advertiser");
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      ...FAILING_FOR_20_MIN,
      errorCode: "apollo.unavailable",
    });
    await queueLines(member.accountId, {
      destination: "apollo_contact",
      status: "failed",
      attempts: 10,
      errorCode: "apollo.unavailable",
      agedSeconds: 60 * 60,
    });
    await queueLines(member.accountId, {
      destination: "brevo_contact",
      status: "succeeded",
      attempts: 1,
      agedSeconds: 60,
    });
    expect(
      (await al25()).map(
        (alert) => `${alert.destination} ${alert.cause} ${alert.count}`,
      ),
    ).toEqual(["apollo destination_down 1"]);
  });
});

describe("D60: no address in the logs", () => {
  it("no address of this file in any log stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
