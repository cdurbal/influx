// T14 (J8, commit 7) — the invitations of the backoffice on the local stack, through the pools of
// apps/api and the real local GoTrue (docs/mvp/15 RG99, RG101; 05 RG116 to RG119, CA63; 03 §3.1,
// MFA-1, B-1, B-8; 17b §3.14.b; 18 T14.1 to T14.4; 21 §J8 commit 7, EC-45, EC-J8-2, EC-J8-3;
// migrations 0131, 0135):
//   POST/GET /v1/bo/internal-invitations, POST /v1/bo/internal-invitations/:id/revoke,
//   POST/GET /v1/bo/member-invitations, POST /v1/bo/member-invitations/:id/revoke,
//   POST /v1/bo/auth/invitation/accept (then /enroll/confirm, as at J3).
// The fixtures are COMMITTED by the migration role (random identifiers, disposable local stack);
// the internal profiles are deactivated and the GoTrue users deleted after the file. HIBP is a
// stub (no external call): a password containing "pwned" is compromised. Every captured stream is
// read BY VALUE (C-1): never a link, a token, a password nor an address.
import {
  localRoleUrl,
  requireLocalAuth,
  type LocalAuthStack,
  type LoginRole,
} from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { millisecondsLeftInPeriod, totpCode } from "@influx/test-kit/totp";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import {
  createSupabaseAuth,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";
const OPS_COOKIE = "__Host-influx-ops-session";
const BROWSER =
  "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/131.0 marker-7c2e";
/** A password that passes the local rules of B-1 and the HIBP stub. */
const PASSWORD = "quiet meadow under amber skies";

/** Every route of the commit behind a session, with a body that passes its schema. */
const ROUTES: readonly {
  method: "GET" | "POST";
  url: string;
  body?: object;
}[] = [
  {
    method: "POST",
    url: "/v1/bo/internal-invitations",
    body: {
      email: "t14-inv-route@example.test",
      role: "agent",
      reasonCode: "new_team_member",
    },
  },
  { method: "GET", url: "/v1/bo/internal-invitations" },
  {
    method: "POST",
    url: `/v1/bo/internal-invitations/${NIL}/revoke`,
    body: { reasonCode: "no_longer_needed" },
  },
  {
    method: "POST",
    url: "/v1/bo/member-invitations",
    body: {
      email: "t14-inv-route-member@example.test",
      proposedRole: "creator",
      preferredLanguage: "fr",
    },
  },
  { method: "GET", url: "/v1/bo/member-invitations" },
  {
    method: "POST",
    url: `/v1/bo/member-invitations/${NIL}/revoke`,
    body: { reasonCode: "no_longer_needed" },
  },
];

let local: LocalAuthStack;
let database: ApiDatabase;
let gotrue: SupabaseAuth;
const internals: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::7`;
}

type Internal = { accountId: string; session: string; sessionId: string };

/** An active agent or admin with a TOTP factor, and a backoffice session proven by TOTP now. */
async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const email = `t14-inv-${role}-${accountId}@example.test`;
  const token = randomBytes(32);
  const sessionId = await migrationRole().begin(async (tx) => {
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
  return { accountId, session: token.toString("base64url"), sessionId };
}

/** Moves the TOTP proof of a session back (R is 300 seconds; the guard is disabled here). */
async function ageSecondFactor(sessionId: string, seconds: number) {
  await migrationRole().begin(async (tx) => {
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

function app() {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: {
      supabaseAuth: gotrue,
      isPwned: async (password) =>
        password.includes("pwned") ? "compromised" : "clear",
      backofficeAuthFloorMs: 0,
    },
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
  const cookieName = options.cookie ?? OPS_COOKIE;
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "client-user-agent": BROWSER,
      "x-real-ip": newClientAddress(),
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json<{ error: { code: string } }>();
  return { status: response.statusCode, code: error.code };
}

function newAddress(label: string): string {
  const address = `t14-inv-${label}-${randomUUID()}@example.test`;
  watchedValues.push(address);
  return address;
}

type InternalCreated = {
  invitationId: string;
  expiresAt: string;
  link: string;
  dualControlRequestId: string | null;
};

async function inviteInternal(
  server: Server,
  admin: Internal,
  email: string,
  role: "agent" | "admin" = "agent",
): Promise<InternalCreated> {
  const response = await call(
    server,
    "POST",
    "/v1/bo/internal-invitations",
    admin.session,
    { email, role, reasonCode: "new_team_member" },
  );
  expect(response.statusCode).toBe(200);
  const created = response.json<InternalCreated>();
  watchedValues.push(created.link);
  return created;
}

function tokenOfLink(link: string): string {
  return new URL(link).hash.slice(1);
}

function accept(
  server: Server,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return call(server, "POST", "/v1/bo/auth/invitation/accept", null, {
    firstName: "Alex",
    countryCode: "FR",
    preferredLanguage: "fr",
    password: PASSWORD,
    ...body,
  });
}

async function refusedActionsOf(accountId: string) {
  return migrationRole()<{ payload: Record<string, unknown> }[]>`
    select payload from audit.audit_events
     where event_type = 'backoffice.action_refused' and subject_id = ${accountId}
     order by seq`;
}

/** Waits for a new TOTP period when the current one is nearly over: codes of steps -1 to +1. */
async function freshPeriod(): Promise<void> {
  const left = millisecondsLeftInPeriod();
  if (left < 10_000) {
    await sleep(left + 200);
  }
}

let agent: Internal;
let otherAgent: Internal;
let admin: Internal;

beforeAll(async () => {
  local = await requireLocalAuth();
  gotrue = createSupabaseAuth(
    { url: local.apiUrl, secretKey: local.secretKey },
    { warn: () => undefined },
  );
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
  admin = await newInternal("admin");
});

afterAll(async () => {
  await closeDatabase(database);
  for (const text of logStreams) {
    expect(valuesFoundIn(text(), watchedValues)).toEqual([]);
  }
  const accepted = await migrationRole()<{ id: string }[]>`
    select id::text from identity.accounts where email like 't14-inv-%@example.test'`;
  const ids = [...internals, ...accepted.map((row) => row.id)];
  await migrationRole()`
    update identity.agent_profiles
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
     where account_id = any(${ids}::uuid[]) and is_active`;
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 't14-inv-%@example.test'`;
  for (const { id } of users) {
    await gotrue.deleteUser(id);
  }
});

// ---------------------------------------------------------------------------------------------

describe("T14 on every invitation route (18 T14.1; 03 §6.2)", () => {
  it("no session, or a member session, is 401; the web surface never reaches them (404)", async () => {
    const server = app();
    const memberToken = randomBytes(32);
    const memberId = randomUUID();
    await migrationRole().begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${memberId}, ${randomUUID()}, ${`t14-inv-member-${memberId}@example.test`}, now(),
                'FR', 'fr', true, now(), 'individual')`;
      await tx`insert into identity.account_roles (account_id, role) values (${memberId}, 'creator')`;
      await tx`
        insert into identity.sessions
          (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${sha256(memberToken)}, ${memberId}, 'member', null, 'firefox.windows')`;
    });
    const member = memberToken.toString("base64url");
    for (const route of ROUTES) {
      const label = `${route.method} ${route.url}`;
      expect(
        (await call(server, route.method, route.url, null, route.body))
          .statusCode,
        label,
      ).toBe(401);
      expect(
        errorBody(
          await call(server, route.method, route.url, member, route.body),
        ),
        label,
      ).toEqual({ status: 401, code: "unauthenticated" });
      expect(
        (
          await call(server, route.method, route.url, member, route.body, {
            surface: "web",
            cookie: "__Host-influx-session",
          })
        ).statusCode,
        label,
      ).toBe(404);
    }
  });
});

describe("Internal invitations (15 RG99, RG101; CA63)", () => {
  it("an admin with a fresh R invites an agent: a link shown once, only its digest stored, no 2V", async () => {
    const server = app();
    const email = newAddress("agent-invited");
    const created = await inviteInternal(server, admin, email);
    expect(created.dualControlRequestId).toBeNull();
    expect(created.link).toMatch(
      new RegExp(`^${BACKOFFICE_ORIGIN}/activation#[A-Za-z0-9_-]{43}$`),
    );
    const [row] = await migrationRole()<
      {
        token_hash: Buffer;
        email: string;
        proposed_role: string;
        hours: number;
      }[]
    >`
      select token_hash, email, proposed_role::text,
             extract(epoch from expires_at - created_at)::int / 3600 as hours
        from identity.internal_invitations where id = ${created.invitationId}`;
    expect(row?.email).toBe(email);
    expect(row?.proposed_role).toBe("agent");
    expect(row?.hours).toBe(72);
    expect(
      row?.token_hash.equals(
        enrollmentTokenHashOf(tokenOfLink(created.link)) ?? Buffer.alloc(0),
      ),
    ).toBe(true);

    const list = await call(
      server,
      "GET",
      "/v1/bo/internal-invitations",
      admin.session,
    );
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(list.body).not.toContain(tokenOfLink(created.link));
    const listed = list
      .json<{ invitations: { id: string; state: string }[] }>()
      .invitations.find((item) => item.id === created.invitationId);
    expect(listed?.state).toBe("pending");
  });

  it("B-5: without a fresh R, the creation is refused (reauthentication_required) and nothing is written", async () => {
    const server = app();
    const stale = await newInternal("admin");
    await ageSecondFactor(stale.sessionId, 301);
    const email = newAddress("stale");
    const response = await call(
      server,
      "POST",
      "/v1/bo/internal-invitations",
      stale.session,
      { email, role: "agent", reasonCode: "new_team_member" },
    );
    expect(errorBody(response)).toEqual({
      status: 403,
      code: "reauthentication_required",
    });
    const rows = await migrationRole()`
      select 1 from identity.internal_invitations where email = ${email}`;
    expect(rows).toEqual([]);
  });

  it("EC-J8-12: an admin invitation requests its dual control in the same transaction", async () => {
    const server = app();
    const created = await inviteInternal(
      server,
      admin,
      newAddress("admin-invited"),
      "admin",
    );
    expect(created.dualControlRequestId).not.toBeNull();
    const view = await call(
      server,
      "GET",
      `/v1/bo/dual-control/${created.dualControlRequestId ?? NIL}`,
      admin.session,
    );
    expect(view.statusCode).toBe(200);
    expect(view.json()).toMatchObject({
      action: {
        code: "identity.invite_admin",
        invitationId: created.invitationId,
      },
      reasonCode: "new_team_member",
      state: "pending",
    });
    const listed = (
      await call(server, "GET", "/v1/bo/internal-invitations", admin.session)
    )
      .json<{ invitations: { id: string; state: string }[] }>()
      .invitations.find((item) => item.id === created.invitationId);
    expect(listed?.state).toBe("awaiting_dual_control");
  });

  it("CA63: an agent is refused on every internal route, and each attempt is journaled", async () => {
    const server = app();
    const before = (await refusedActionsOf(otherAgent.accountId)).length;
    for (const route of ROUTES.slice(0, 3)) {
      expect(
        errorBody(
          await call(
            server,
            route.method,
            route.url,
            otherAgent.session,
            route.body,
          ),
        ),
        `${route.method} ${route.url}`,
      ).toEqual({ status: 403, code: "forbidden" });
    }
    const after = await refusedActionsOf(otherAgent.accountId);
    expect(after.slice(before).map((line) => line.payload)).toEqual(
      Array.from({ length: 3 }, () => ({
        action_code: "identity.internal_invitation",
        required_role: "admin",
      })),
    );
  });

  it("revokes an unused invitation once; the link is then refused", async () => {
    const server = app();
    const email = newAddress("revoked");
    const created = await inviteInternal(server, admin, email);
    const url = `/v1/bo/internal-invitations/${created.invitationId}/revoke`;
    const body = { reasonCode: "sent_to_wrong_address" };
    expect(
      (await call(server, "POST", url, admin.session, body)).json(),
    ).toEqual({ revoked: true });
    expect(
      errorBody(await call(server, "POST", url, admin.session, body)),
    ).toEqual({ status: 404, code: "not_found" });
    const accepted = await accept(server, {
      invitationToken: tokenOfLink(created.link),
      email,
    });
    expect(accepted.json()).toEqual({ outcome: "refused" });
    const users = await migrationRole()`
      select 1 from auth.users where email = ${email}`;
    expect(users).toEqual([]);
  });
});

describe("POST /v1/bo/auth/invitation/accept (15 RG99, B-1, B-8; 17b §3.14.b)", () => {
  it("creates the account with the invited address, then the factor; /enroll/confirm opens the session", async () => {
    const server = app();
    const email = newAddress("accept");
    const created = await inviteInternal(server, admin, email);
    const token = tokenOfLink(created.link);
    await freshPeriod();
    const accepted = await accept(server, { invitationToken: token, email });
    expect(accepted.headers["cache-control"]).toBe("no-store");
    const factor = accepted.json<{ outcome: string; secret: string }>();
    expect(factor.outcome).toBe("factor_created");

    const [account] = await migrationRole()<
      { id: string; role: string; first_name: string; invited_by: string }[]
    >`
      select a.id::text, r.role::text, p.first_name, p.invited_by_account_id::text as invited_by
        from identity.accounts a
        join identity.account_roles r on r.account_id = a.id
        join identity.agent_profiles p on p.account_id = a.id
       where a.email = ${email}`;
    expect(account).toMatchObject({
      role: "agent",
      first_name: "Alex",
      invited_by: admin.accountId,
    });

    const confirmed = await call(
      server,
      "POST",
      "/v1/bo/auth/enroll/confirm",
      null,
      {
        email,
        password: PASSWORD,
        enrollmentToken: token,
        code: totpCode(factor.secret),
      },
    );
    expect(confirmed.json<{ outcome: string; role: string }>()).toMatchObject({
      outcome: "signed_in",
      role: "agent",
    });
    const listed = (
      await call(server, "GET", "/v1/bo/internal-invitations", admin.session)
    )
      .json<{
        invitations: { id: string; state: string; accountId: string }[];
      }>()
      .invitations.find((item) => item.id === created.invitationId);
    expect(listed).toMatchObject({ state: "accepted", accountId: account?.id });
  });

  it("a retry of the same link after the account exists goes straight to the factor", async () => {
    const server = app();
    const email = newAddress("retry");
    const token = tokenOfLink(
      (await inviteInternal(server, admin, email)).link,
    );
    expect(
      (await accept(server, { invitationToken: token, email })).json<{
        outcome: string;
      }>().outcome,
    ).toBe("factor_created");
    expect(
      (await accept(server, { invitationToken: token, email })).json<{
        outcome: string;
      }>().outcome,
    ).toBe("factor_created");
    const accounts = await migrationRole()`
      select 1 from identity.accounts where email = ${email}`;
    expect(accounts).toHaveLength(1);
  });

  it("B-8: bound to the address; another address creates nothing and gets the uniform refusal", async () => {
    const server = app();
    const email = newAddress("bound");
    const other = newAddress("other");
    const token = tokenOfLink(
      (await inviteInternal(server, admin, email)).link,
    );
    expect(
      (await accept(server, { invitationToken: token, email: other })).json(),
    ).toEqual({ outcome: "refused" });
    const users = await migrationRole()`
      select 1 from auth.users where email in (${email}, ${other})`;
    expect(users).toEqual([]);
  });

  it("B-1, J3S-5: a compromised or a contextual password is refused before GoTrue, the invitation stays usable", async () => {
    const server = app();
    const email = newAddress("pwned");
    const token = tokenOfLink(
      (await inviteInternal(server, admin, email)).link,
    );
    expect(
      (
        await accept(server, {
          invitationToken: token,
          email,
          password: "a pwned password of length",
        })
      ).json(),
    ).toEqual({ outcome: "password_refused", reason: "compromised" });
    expect(
      (
        await accept(server, {
          invitationToken: token,
          email,
          password: "influx is my favourite place",
        })
      ).json(),
    ).toEqual({ outcome: "password_refused", reason: "context" });
    const users = await migrationRole()`
      select 1 from auth.users where email = ${email}`;
    expect(users).toEqual([]);
    expect(
      (await accept(server, { invitationToken: token, email })).json<{
        outcome: string;
      }>().outcome,
    ).toBe("factor_created");
  });

  it("EC-J8-12: an admin invitation is unusable until its dual control is confirmed", async () => {
    const server = app();
    const email = newAddress("unconfirmed");
    const created = await inviteInternal(server, admin, email, "admin");
    expect(
      (
        await accept(server, {
          invitationToken: tokenOfLink(created.link),
          email,
        })
      ).json(),
    ).toEqual({ outcome: "refused" });
  });
});

describe("Member invitations (05 RG116 to RG119, D54; EC-J8-3)", () => {
  type MemberCreated = {
    invitationId: string;
    expiresAt: string;
    link: string;
  };

  async function inviteMember(
    server: Server,
    by: Internal,
    email: string,
    language: "fr" | "en" = "fr",
  ): Promise<LightMyRequestResponse> {
    const response = await call(
      server,
      "POST",
      "/v1/bo/member-invitations",
      by.session,
      { email, proposedRole: "advertiser", preferredLanguage: language },
    );
    if (response.statusCode === 200) {
      watchedValues.push(response.json<MemberCreated>().link);
    }
    return response;
  }

  it("an agent invites a brand: the link opens the door of the language, the code in the fragment", async () => {
    const server = app();
    const email = newAddress("brand");
    const fr = (await inviteMember(server, agent, email)).json<MemberCreated>();
    expect(fr.link).toMatch(
      new RegExp(
        `^${WEB_ORIGIN}/fr/inscription/marque#invitation=[A-Za-z0-9_-]{43}$`,
      ),
    );
    const en = (
      await inviteMember(server, agent, newAddress("brand-en"), "en")
    ).json<MemberCreated>();
    expect(en.link).toMatch(
      new RegExp(`^${WEB_ORIGIN}/en/signup/brand#invitation=`),
    );
    const code = new URLSearchParams(new URL(fr.link).hash.slice(1)).get(
      "invitation",
    );
    const [row] = await migrationRole()<{ code_hash: Buffer }[]>`
      select code_hash from backoffice.member_invitations where id = ${fr.invitationId}`;
    expect(
      row?.code_hash.equals(
        createHash("sha256")
          .update(Buffer.from(code ?? "", "base64url"))
          .digest(),
      ),
    ).toBe(true);
  });

  it("EC-J8-15: a second live invitation for the address is a conflict", async () => {
    const server = app();
    const email = newAddress("twice");
    expect((await inviteMember(server, agent, email)).statusCode).toBe(200);
    expect(errorBody(await inviteMember(server, otherAgent, email))).toEqual({
      status: 409,
      code: "conflict",
    });
  });

  it("EC-J8-31: an agent lists his own invitations, an admin all; never a code", async () => {
    const server = app();
    const mine = (
      await inviteMember(server, agent, newAddress("mine"))
    ).json<MemberCreated>();
    const theirs = (
      await inviteMember(server, otherAgent, newAddress("theirs"))
    ).json<MemberCreated>();
    const ids = async (who: Internal) => {
      const response = await call(
        server,
        "GET",
        "/v1/bo/member-invitations",
        who.session,
      );
      expect(response.body).not.toContain("#invitation=");
      return response
        .json<{ invitations: { id: string; state: string }[] }>()
        .invitations.map((item) => item.id);
    };
    const ofAgent = await ids(agent);
    expect(ofAgent).toContain(mine.invitationId);
    expect(ofAgent).not.toContain(theirs.invitationId);
    const ofAdmin = await ids(admin);
    expect(ofAdmin).toEqual(
      expect.arrayContaining([mine.invitationId, theirs.invitationId]),
    );
  });

  it("revoked by its author or an admin, never by another agent (404)", async () => {
    const server = app();
    const created = (
      await inviteMember(server, agent, newAddress("revoke"))
    ).json<MemberCreated>();
    const url = `/v1/bo/member-invitations/${created.invitationId}/revoke`;
    const body = { reasonCode: "no_longer_needed" };
    expect(
      errorBody(await call(server, "POST", url, otherAgent.session, body)),
    ).toEqual({ status: 404, code: "not_found" });
    expect(
      (await call(server, "POST", url, admin.session, body)).json(),
    ).toEqual({ revoked: true });
    expect(
      errorBody(await call(server, "POST", url, agent.session, body)),
    ).toEqual({ status: 404, code: "not_found" });
  });
});
