// TM1 (J7, commit 6) — "mon compte" (1) on the local stack (docs/mvp/05 RG15, RG28, RG34, RG35,
// RG56, RG71, RG73, RG92 to RG95, RG143; CA33, CA35, CA70; 18 T14; 21 §5.2): PATCH /v1/me, GET and
// PUT /v1/me/consent, GET and DELETE /v1/me/sessions[/:id], POST /v1/me/terms/accept and the
// blocking re-acceptance, through the pools of apps/api (member under influx_app, migration 0122).
// The route accounts are COMMITTED by the migration role (random identifiers, disposable local stack,
// like TM10) with their sessions; their queue lines are removed after the file. The SQL cases of
// 0122 that need a state no route can see (a blocked country, a new version in force) are rolled
// back, the member acting through influx_app in the transaction of the local superuser (actAs).
// Every log stream is searched BY VALUE (C-1): no address, company name nor session id (D60).
// The latest drafts are published first when not in force with their text (ensureInForce, like
// TM10): CI publishes the public documents only after `pnpm check`, and the data set of T2 holds
// the French terms only.
import {
  inRolledBackTransaction,
  localRoleUrl,
  probe,
  type LoginRole,
} from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import { actAsMember, localSuperuser, migrationRole } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
/** The terms of service in force in French and in English (the same release), with their text. */
let termsInForce: { fr: string; en: string; label: string };
const accounts: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = {
  accountId: string;
  email: string;
  role: "advertiser" | "creator";
  /** The cookie values of the member's open sessions, the first one being "this browser". */
  sessions: string[];
  sessionIds: string[];
};

/** A committed member account: role, profile, sign-up consent, sessions; the terms if asked. */
async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean; sessions?: number } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `tm1-acct-${role}-${accountId}@example.test`;
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
              ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    if (role === "advertiser") {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
    }
    // RG33: one checkbox, two purposes, at sign-up
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
      select ${accountId}, p, true, 'signup_form', now() - interval '1 day'
        from unnest(array['marketing_email', 'commercial_prospection']::identity.consent_purpose[]) p`;
    if (options.acceptTerms ?? true) {
      await tx`
        insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
        values (${accountId}, ${termsInForce.fr}, 'acceptance', 'signup', 'fr')`;
    }
  });
  accounts.push(accountId);
  watchedValues.push(email);
  const sessions: string[] = [];
  const sessionIds: string[] = [];
  const summaries = ["firefox.windows", "safari.ios", "chrome.android"];
  for (let index = 0; index < (options.sessions ?? 1); index += 1) {
    const token = randomBytes(32);
    const [row] = await migration<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
              ${summaries[index % summaries.length] ?? "firefox.windows"})
      returning id::text as id`;
    sessions.push(token.toString("base64url"));
    sessionIds.push(row?.id ?? "");
  }
  return { accountId, email, role, sessions, sessionIds };
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

async function call(
  server: Server,
  method: "GET" | "PATCH" | "PUT" | "POST" | "DELETE",
  url: string,
  session: string | null,
  body?: unknown,
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

function sessionCookieCleared(response: LightMyRequestResponse): boolean {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [String(header)];
  const ours = cookies.filter((cookie) =>
    cookie.startsWith("__Host-influx-session="),
  );
  // one cookie of that name, and it is the clearing one (the renewal never wins)
  return ours.length === 1 && (ours[0] ?? "").includes("Max-Age=0");
}

type QueueLine = {
  event_type: string;
  destination: string;
  priority: number;
  status: string;
  payload: Record<string, unknown>;
};

async function queueLinesOf(accountId: string): Promise<QueueLine[]> {
  return migration<QueueLine[]>`
    select event_type, destination::text as destination, priority, status::text as status, payload
      from leads.outbox_events
     where subject_key = ${`account:${accountId}`}
     order by id`;
}

/** The body of an error envelope, without its request id (18 T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: { code: string; message: string; requestId: string };
  };
  return {
    status: response.statusCode,
    code: error.code,
    message: error.message,
  };
}

beforeAll(async () => {
  migration = migrationRole();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const versions = await migration<
    { id: string; locale: string; version_label: string }[]
  >`
    select id::text, locale::text as locale, version_label from identity.terms_versions
     where document_kind = 'terms_of_service' and locale in ('fr', 'en')
       and effective_to is null and effective_from <= now() and content is not null`;
  const fr = versions.find((version) => version.locale === "fr");
  const en = versions.find((version) => version.locale === "en");
  if (
    fr === undefined ||
    en === undefined ||
    fr.version_label !== en.version_label
  ) {
    throw new Error(
      "no terms of service of one release in force in French and English, WITH its text (on a " +
        "workstation, run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = { fr: fr.id, en: en.id, label: fr.version_label };
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
});

afterAll(async () => {
  await closeDatabase(database);
  if (accounts.length > 0) {
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

describe("PATCH /v1/me (05 RG15, RG71, RG73; 17 §6.1)", () => {
  it("changes an advertiser's language and company name: ONE lead.updated to Brevo and Apollo, ids only", async () => {
    const server = app();
    const member = await newMember("advertiser");
    watchedValues.push("Maison Nouvelle TM1");

    const before = await call(
      server,
      "GET",
      "/v1/me",
      member.sessions[0] ?? null,
    );
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({
      email: member.email,
      role: "advertiser",
      preferredLanguage: "fr",
      countryCode: "FR",
      declaredStatus: "business",
      companyName: `Maison ${member.accountId.slice(0, 8)}`,
      termsToAccept: null,
    });

    const changed = await call(
      server,
      "PATCH",
      "/v1/me",
      member.sessions[0] ?? null,
      {
        preferredLanguage: "en",
        companyName: "Maison Nouvelle TM1",
        countryCode: "BE",
      },
    );
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      preferredLanguage: "en",
      countryCode: "BE",
      companyName: "Maison Nouvelle TM1",
    });
    const lines = await queueLinesOf(member.accountId);
    expect(
      lines.map((line) => [line.event_type, line.destination, line.priority]),
    ).toEqual([
      ["lead.updated", "brevo_contact", 100],
      ["lead.updated", "apollo_contact", 100],
    ]);
    // RG74: identifiers only
    expect(lines[0]?.payload).toEqual({
      event_id: lines[0]?.payload.event_id,
      account_id: member.accountId,
    });

    // the same values again: nothing changes, nothing is emitted
    const again = await call(
      server,
      "PATCH",
      "/v1/me",
      member.sessions[0] ?? null,
      {
        preferredLanguage: "en",
        companyName: "Maison Nouvelle TM1",
      },
    );
    expect(again.statusCode).toBe(200);
    expect(await queueLinesOf(member.accountId)).toHaveLength(2);
  });

  it("changes a creator's declared status and country together: one lead.updated, one register line", async () => {
    const server = app();
    const member = await newMember("creator");
    const response = await call(
      server,
      "PATCH",
      "/v1/me",
      member.sessions[0] ?? null,
      {
        declaredStatus: "business",
        countryCode: "CA",
      },
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      role: "creator",
      declaredStatus: "business",
      countryCode: "CA",
      companyName: null,
    });
    expect(
      (await queueLinesOf(member.accountId)).map((line) => line.event_type),
    ).toEqual(["lead.updated", "lead.updated"]);
    const register = await migration<{ payload: Record<string, unknown> }[]>`
      select payload from audit.audit_events
       where event_type = 'account.declared_status_changed' and subject_id = ${member.accountId}`;
    expect(register.map((line) => line.payload)).toEqual([
      { from: "individual", to: "business", reason_code: "member_settings" },
    ]);
  });

  it("refuses the field of the other door, an empty body and an unknown field (400), changing nothing", async () => {
    const server = app();
    const creator = await newMember("creator");
    const advertiser = await newMember("advertiser");

    const companyName = await call(
      server,
      "PATCH",
      "/v1/me",
      creator.sessions[0] ?? null,
      {
        companyName: "Maison Créateur",
      },
    );
    expect(companyName.statusCode).toBe(400);
    expect(companyName.json().error.details).toEqual([
      { path: "companyName", issue: "not_allowed" },
    ]);
    const status = await call(
      server,
      "PATCH",
      "/v1/me",
      advertiser.sessions[0] ?? null,
      {
        declaredStatus: "individual",
      },
    );
    expect(status.statusCode).toBe(400);
    expect(status.json().error.details).toEqual([
      { path: "declaredStatus", issue: "not_allowed" },
    ]);
    for (const body of [
      {},
      { email: "autre@example.test" },
      { preferredLanguage: "de" },
    ]) {
      expect(
        (
          await call(
            server,
            "PATCH",
            "/v1/me",
            advertiser.sessions[0] ?? null,
            body,
          )
        ).statusCode,
      ).toBe(400);
    }
    expect(await queueLinesOf(creator.accountId)).toEqual([]);
    expect(await queueLinesOf(advertiser.accountId)).toEqual([]);
  });

  it("answers 401 without a session", async () => {
    const response = await call(app(), "PATCH", "/v1/me", null, {
      countryCode: "BE",
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("identity.update_own_account() and own_terms_to_accept() (0122), rolled back", () => {
  async function asMemberInTransaction<T>(
    fn: (
      tx: postgres.TransactionSql,
      member: { accountId: string },
    ) => Promise<T>,
  ): Promise<T> {
    return inRolledBackTransaction(localSuperuser(), async (tx) => {
      const accountId = randomUUID();
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${accountId}, ${randomUUID()}, ${`tm1-sql-${accountId}@example.test`}, now(),
                'FR', 'fr', true, now(), 'individual')`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
      await tx`
        insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
        values (${accountId}, ${termsInForce.fr}, 'acceptance', 'signup', 'fr')`;
      return fn(tx, { accountId });
    });
  }

  it("refuses a blocked country (RG8, 23514) and writes nothing", async () => {
    await asMemberInTransaction(async (tx, member) => {
      await tx`
        update leads.sync_settings set value = '["KP"]'::jsonb
         where key = 'signup_blocked_countries'`;
      const refused = await actAsMember(
        tx,
        "influx_creator",
        { accountId: member.accountId, role: "creator", aal: "aal1" },
        () =>
          probe(
            tx,
            "select identity.update_own_account('KP', null, null, null)",
          ),
      );
      expect(refused).toEqual({ outcome: "error", code: "23514" });
      const [row] = await tx<{ country_code: string }[]>`
        select country_code from identity.accounts where id = ${member.accountId}`;
      expect(row?.country_code).toBe("FR");
    });
  });

  it("asks again for a new release in force (CA70), whatever the language it was accepted in", async () => {
    await asMemberInTransaction(async (tx, member) => {
      const context = {
        accountId: member.accountId,
        role: "creator" as const,
        aal: "aal1" as const,
      };
      const pending = () =>
        actAsMember(
          tx,
          "influx_creator",
          context,
          () =>
            tx<{ id: string; version_label: string; locale: string }[]>`
            select id::text, version_label, locale::text as locale
              from identity.own_terms_to_accept()`,
        );
      // accepted in French: nothing pending in French nor, after a change of language, in English
      expect(await pending()).toEqual([]);
      await tx`update identity.accounts set preferred_language = 'en' where id = ${member.accountId}`;
      expect(await pending()).toEqual([]);

      // a new release enters into force in both languages
      const label = `tm1-${randomUUID().slice(0, 8)}`;
      await tx`
        update identity.terms_versions set effective_to = now()
         where document_kind = 'terms_of_service' and locale in ('fr', 'en')
           and effective_to is null`;
      const text = `# ${label}\n\nProjet non contractuel.\n`;
      const inserted = await tx<{ id: string; locale: string }[]>`
        insert into identity.terms_versions
          (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
           published_at, effective_from, content)
        select 'terms_of_service', l, ${label}, ${`https://influx.example/legal/${label}`},
               sha256(convert_to(${text}, 'UTF8')), true, now(), now(), ${text}
          from unnest(array['fr', 'en']) l
        returning id::text, locale::text as locale`;
      const english = inserted.find((version) => version.locale === "en");
      expect(await pending()).toEqual([
        { id: english?.id, version_label: label, locale: "en" },
      ]);
    });
  });
});

describe("the blocking re-acceptance of the terms of service (05 RG28, CA70; 17 §6.7)", () => {
  it("blocks every non-exempt route until the version in force is accepted, then lets through", async () => {
    const server = app();
    const member = await newMember("creator", { acceptTerms: false });
    const session = member.sessions[0] ?? null;

    const me = await call(server, "GET", "/v1/me", session);
    expect(me.statusCode).toBe(200);
    expect(me.json().termsToAccept).toMatchObject({
      versionId: termsInForce.fr,
      versionLabel: termsInForce.label,
      locale: "fr",
    });
    const blocked = await call(server, "GET", "/v1/me/email-change", session);
    expect(errorBody(blocked)).toEqual({
      status: 403,
      code: "terms_acceptance_required",
      message: "The terms of service in force must be accepted first",
    });
    // exempt: the rectification (GDPR art. 16), the consent at any time (RG34), the sessions (RG56)
    expect(
      (
        await call(server, "PATCH", "/v1/me", session, {
          countryCode: "BE",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await call(server, "GET", "/v1/me/consent", session)).statusCode,
    ).toBe(200);
    expect(
      (await call(server, "GET", "/v1/me/sessions", session)).statusCode,
    ).toBe(200);

    // another version than the one to accept: 409, nothing written
    const other = await call(server, "POST", "/v1/me/terms/accept", session, {
      termsVersionId: randomUUID(),
    });
    expect(other.statusCode).toBe(409);

    const accepted = await call(
      server,
      "POST",
      "/v1/me/terms/accept",
      session,
      {
        termsVersionId: termsInForce.fr,
      },
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ outcome: "accepted" });
    const acceptances = await migration<
      { channel: string; nature: string; locale: string }[]
    >`
      select channel::text as channel, nature::text as nature, locale::text as locale
        from identity.terms_acceptances where account_id = ${member.accountId}`;
    expect(acceptances).toEqual([
      { channel: "re_acceptance", nature: "acceptance", locale: "fr" },
    ]);

    expect(
      (await call(server, "GET", "/v1/me", session)).json().termsToAccept,
    ).toBeNull();
    expect(
      (await call(server, "PATCH", "/v1/me", session, { countryCode: "BE" }))
        .statusCode,
    ).toBe(200);
    // a second click: accepted already, nothing written
    expect(
      (
        await call(server, "POST", "/v1/me/terms/accept", session, {
          termsVersionId: termsInForce.fr,
        })
      ).json(),
    ).toEqual({ outcome: "accepted" });
    expect(
      await migration`select 1 from identity.terms_acceptances where account_id = ${member.accountId}`,
    ).toHaveLength(1);
  });

  it("refusing signs out without deleting the account (CA70)", async () => {
    const server = app();
    const member = await newMember("advertiser", { acceptTerms: false });
    const session = member.sessions[0] ?? null;
    const logout = await call(server, "POST", "/v1/auth/logout", session);
    expect(logout.statusCode).toBe(200);
    expect((await call(server, "GET", "/v1/me", session)).statusCode).toBe(401);
    const [account] = await migration<{ status: string }[]>`
      select status::text as status from identity.accounts where id = ${member.accountId}`;
    expect(account?.status).toBe("active");
  });
});

describe("GET and PUT /v1/me/consent (05 RG34, RG92 to RG95; CA35)", () => {
  it("withdraws in one gesture: shown at once with its date and origin, consent.revoked priority 0 queued", async () => {
    const server = app();
    const member = await newMember("creator");
    const session = member.sessions[0] ?? null;

    const before = await call(server, "GET", "/v1/me/consent", session);
    expect(before.json()).toMatchObject({
      granted: true,
      source: "signup_form",
    });

    const withdrawn = await call(server, "PUT", "/v1/me/consent", session, {
      granted: false,
    });
    expect(withdrawn.statusCode).toBe(200);
    const body = withdrawn.json();
    expect(body).toMatchObject({
      granted: false,
      source: "account_settings",
      changed: true,
    });
    expect(Date.now() - Date.parse(body.occurredAt)).toBeLessThan(60_000);
    expect(
      await call(server, "GET", "/v1/me/consent", session).then((r) =>
        r.json(),
      ),
    ).toEqual({
      granted: false,
      occurredAt: body.occurredAt,
      source: "account_settings",
    });

    // RG92: recorded in INFLUX while the propagation has not even started (lines pending)
    const lines = await queueLinesOf(member.accountId);
    expect(
      lines.map((line) => [
        line.event_type,
        line.destination,
        line.priority,
        line.status,
      ]),
    ).toEqual([
      ["consent.revoked", "brevo_contact", 0, "pending"],
      ["consent.revoked", "apollo_contact", 0, "pending"],
      ["consent.revoked", "brevo_contact", 0, "pending"],
      ["consent.revoked", "apollo_contact", 0, "pending"],
    ]);
    expect(lines.map((line) => line.payload.purpose).sort()).toEqual([
      "commercial_prospection",
      "commercial_prospection",
      "marketing_email",
      "marketing_email",
    ]);
    // RG94: the account and its session are untouched
    expect((await call(server, "GET", "/v1/me", session)).statusCode).toBe(200);

    // the same gesture again: nothing changes, nothing more is queued
    const again = await call(server, "PUT", "/v1/me/consent", session, {
      granted: false,
    });
    expect(again.json()).toMatchObject({ granted: false, changed: false });
    expect(await queueLinesOf(member.accountId)).toHaveLength(4);

    // given again from the space: consent.granted, normal priority
    const given = await call(server, "PUT", "/v1/me/consent", session, {
      granted: true,
    });
    expect(given.json()).toMatchObject({
      granted: true,
      source: "account_settings",
      changed: true,
    });
    expect(
      (await queueLinesOf(member.accountId))
        .slice(4)
        .map((line) => [line.event_type, line.priority]),
    ).toEqual([
      ["consent.granted", 100],
      ["consent.granted", 100],
      ["consent.granted", 100],
      ["consent.granted", 100],
    ]);
  });

  it("shows a withdrawal come back from Brevo as such, never as an error (RG95, RG96)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await migration`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${member.accountId}, 'marketing_email', false, 'brevo_webhook')`;
    expect(
      (
        await call(server, "GET", "/v1/me/consent", member.sessions[0] ?? null)
      ).json(),
    ).toMatchObject({ granted: false, source: "brevo_webhook" });
  });

  it("refuses a body outside the schema (400)", async () => {
    const member = await newMember("creator");
    for (const body of [
      {},
      { granted: "no" },
      { granted: false, purpose: "marketing_email" },
    ]) {
      expect(
        (
          await call(
            app(),
            "PUT",
            "/v1/me/consent",
            member.sessions[0] ?? null,
            body,
          )
        ).statusCode,
      ).toBe(400);
    }
  });
});

describe("GET and DELETE /v1/me/sessions[/:id] (05 RG56, RG143; CA33; 18 T14)", () => {
  it("lists the open sessions, this browser marked, without any country", async () => {
    const member = await newMember("creator", { sessions: 3 });
    const response = await call(
      app(),
      "GET",
      "/v1/me/sessions",
      member.sessions[0] ?? null,
    );
    expect(response.statusCode).toBe(200);
    const { sessions } = response.json() as {
      sessions: { id: string; browser: string; current: boolean }[];
    };
    expect(sessions.map((session) => session.id).sort()).toEqual(
      [...member.sessionIds].sort(),
    );
    expect(
      sessions
        .filter((session) => session.current)
        .map((session) => session.id),
    ).toEqual([member.sessionIds[0]]);
    expect(sessions.map((session) => session.browser).sort()).toEqual([
      "chrome.android",
      "firefox.windows",
      "safari.ios",
    ]);
    for (const session of sessions) {
      expect(Object.keys(session).sort()).toEqual([
        "browser",
        "createdAt",
        "current",
        "id",
        "lastActivityAt",
      ]);
    }
  });

  it("closes one session; another member's, an unknown or a closed one get the same 404 (T14.2 to T14.4)", async () => {
    const server = app();
    const member = await newMember("creator", { sessions: 2 });
    const other = await newMember("creator", { sessions: 1 });
    const mine = member.sessions[0] ?? null;

    const foreign = await call(
      server,
      "DELETE",
      `/v1/me/sessions/${other.sessionIds[0]}`,
      mine,
    );
    const unknown = await call(
      server,
      "DELETE",
      `/v1/me/sessions/${randomUUID()}`,
      mine,
    );
    expect(errorBody(foreign)).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    expect(errorBody(unknown)).toEqual(errorBody(foreign));
    // the other member's session still works, and is never listed (T14.1)
    expect(
      (await call(server, "GET", "/v1/me", other.sessions[0] ?? null))
        .statusCode,
    ).toBe(200);
    const listed = await call(server, "GET", "/v1/me/sessions", mine);
    expect(JSON.stringify(listed.json())).not.toContain(
      other.sessionIds[0] ?? "-",
    );

    const closed = await call(
      server,
      "DELETE",
      `/v1/me/sessions/${member.sessionIds[1]}`,
      mine,
    );
    expect(closed.json()).toEqual({ outcome: "revoked", signedOut: false });
    expect(
      (await call(server, "GET", "/v1/me", member.sessions[1] ?? null))
        .statusCode,
    ).toBe(401);
    const again = await call(
      server,
      "DELETE",
      `/v1/me/sessions/${member.sessionIds[1]}`,
      mine,
    );
    expect(errorBody(again)).toEqual(errorBody(foreign));
    const [row] = await migration<{ reason: string }[]>`
      select revocation_reason::text as reason from identity.sessions
       where id = ${member.sessionIds[1] ?? ""}`;
    expect(row?.reason).toBe("revoked_by_holder");

    // closing this browser's session signs it out
    const self = await call(
      server,
      "DELETE",
      `/v1/me/sessions/${member.sessionIds[0]}`,
      mine,
    );
    expect(self.json()).toEqual({ outcome: "revoked", signedOut: true });
    expect(sessionCookieCleared(self)).toBe(true);
    expect((await call(server, "GET", "/v1/me", mine)).statusCode).toBe(401);
  });

  it("closes all three sessions at once, this one included (CA33)", async () => {
    const server = app();
    const member = await newMember("advertiser", { sessions: 3 });
    const response = await call(
      server,
      "DELETE",
      "/v1/me/sessions",
      member.sessions[0] ?? null,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "revoked",
      revokedCount: 3,
      signedOut: true,
    });
    expect(sessionCookieCleared(response)).toBe(true);
    for (const session of member.sessions) {
      expect((await call(server, "GET", "/v1/me", session)).statusCode).toBe(
        401,
      );
    }
    const open = await migration`
      select 1 from identity.sessions where account_id = ${member.accountId} and revoked_at is null`;
    expect(open).toHaveLength(0);
  });

  it("refuses a malformed session id (400)", async () => {
    const member = await newMember("creator");
    expect(
      (
        await call(
          app(),
          "DELETE",
          "/v1/me/sessions/not-a-uuid",
          member.sessions[0] ?? null,
        )
      ).statusCode,
    ).toBe(400);
  });
});

describe("C-1 (D60): nothing personal in the logs", () => {
  it("finds no address nor company name in any captured stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(5);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
