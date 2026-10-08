// TM10 (J5, commit 4) — POST /v1/signup on the local stack (docs/mvp/05 RG5, RG7, RG8, RG11 to
// RG38, RG110, RG120, D63; CA2, CA4 to CA8, CA22, CA67; 18 TM10.3 to TM10.5; 21 EC-4, EC-5,
// EC-10, EC-30). Real database, under influx_auth (E-2, identity.complete_signup). The sign-up
// token is issued here with the test signing secret, as verify-code issues it after a verified
// code: GoTrue is not needed (no foreign key to auth.users, 04 §5.1), and the code journey is
// db-tests/t8-verify-code.test.ts. The SQL function alone is tm10-signup-provisioning; what is
// refused before the database, tests/signup-route.test.ts.
// The sign-ups are COMMITTED (random identifiers, disposable local stack, like T8) and read back by
// the migration role. Every log stream is searched BY VALUE (C-1): no address, no GoTrue user, no
// company name, no wording (D60).
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { CONSENT_WORDING_KEYS } from "@influx/contracts/signup";
import type { LightMyRequestResponse } from "fastify";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { createAuthTokenCodec } from "../src/platform/auth-tokens.ts";
import { buildServer } from "../src/server.ts";
import {
  captureLogs,
  testApiConfig,
  TOKEN_SIGNING_SECRET,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole, testDataSet } from "./support.ts";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131.0 marker-5e1a";
/** A country nobody else signs up from in this file; tm10-signup-provisioning blocks AQ. */
const BLOCKED_COUNTRY = "BV";

const tokens = createAuthTokenCodec(TOKEN_SIGNING_SECRET);
let database: ApiDatabase;
let migration: postgres.Sql;
/** The terms of service in force in French, with its text (0109). */
let termsInForce: { id: string; hash: string };
/** A version in force that is not the terms of service: refused as an acceptance. */
let privacyPolicyId: string;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Identity = { authUserId: string; email: string };

function newIdentity(label: string): Identity {
  const authUserId = randomUUID();
  return { authUserId, email: `tm10-su-${label}-${authUserId}@example.test` };
}

function tokenOf(identity: Identity, issuedAt = new Date()): string {
  return tokens.issueSignup(
    {
      verifiedAt: Math.floor(issuedAt.getTime() / 1000),
      authUserId: identity.authUserId,
      email: identity.email,
      door: "creator",
    },
    issuedAt,
  );
}

function advertiserBody(overrides: Record<string, unknown> = {}) {
  return {
    role: "advertiser",
    companyName: "Maison TM10",
    countryCode: "GB",
    preferredLanguage: "en",
    termsVersionId: termsInForce.id,
    termsAccepted: true,
    marketingConsent: true,
    consentWordingKey: CONSENT_WORDING_KEYS.advertiser,
    consentWording:
      "I agree that INFLUX records my contact details in Brevo and Apollo.io.",
    displayLocale: "en",
    ...overrides,
  };
}

function creatorBody(overrides: Record<string, unknown> = {}) {
  return {
    role: "creator",
    countryCode: "FR",
    preferredLanguage: "fr",
    declaredStatus: "individual",
    adultAttested: true,
    termsVersionId: termsInForce.id,
    termsAccepted: true,
    marketingConsent: true,
    consentWordingKey: CONSENT_WORDING_KEYS.creator,
    consentWording:
      "J'accepte qu'INFLUX enregistre mes coordonnées dans Brevo et Apollo.io.",
    displayLocale: "fr",
    ...overrides,
  };
}

function app() {
  const logs = captureLogs();
  const server = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
  });
  return { server, logs };
}

type Server = ReturnType<typeof app>["server"];

async function signUp(
  server: Server,
  body: unknown,
  token: string | null,
  requestId = randomUUID(),
) {
  const response = await server.inject({
    method: "POST",
    url: "/v1/signup",
    headers: {
      "x-influx-internal": WEB_SECRET,
      "sec-fetch-site": "same-origin",
      "client-user-agent": AGENT,
      "content-type": "application/json",
      "x-request-id": requestId,
      ...(token === null
        ? {}
        : { cookie: `__Host-influx-signup=${encodeURIComponent(token)}` }),
    },
    payload: JSON.stringify(body),
  });
  return { response, requestId };
}

function setCookies(response: LightMyRequestResponse): string[] {
  const header = response.headers["set-cookie"];
  return Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [String(header)];
}

function sessionCookieOf(response: LightMyRequestResponse): string | null {
  const cookie = setCookies(response).find((value) =>
    value.startsWith("__Host-influx-session="),
  );
  return cookie === undefined
    ? null
    : decodeURIComponent(cookie.split(";")[0]?.split("=")[1] ?? "");
}

function signupCookieCleared(response: LightMyRequestResponse): boolean {
  return setCookies(response).some(
    (cookie) =>
      cookie.startsWith("__Host-influx-signup=;") &&
      cookie.includes("Max-Age=0"),
  );
}

/** Everything the sign-up writes for this GoTrue user, read back by the migration role. */
async function writtenFor(authUserId: string) {
  return migration.begin(async (tx) => {
    const accounts = await tx<
      {
        id: string;
        email: string;
        verified: boolean;
        country_code: string;
        preferred_language: string;
        declared_status: string;
        is_adult_attested: boolean;
        attested_dated: boolean;
        signup_utm_source: string | null;
        signup_utm_medium: string | null;
        signup_utm_campaign: string | null;
        signup_referrer_domain: string | null;
        signup_heard_from: string | null;
      }[]
    >`
      select id::text, email, email_verified_at is not null as verified, country_code,
             preferred_language, declared_status::text, is_adult_attested,
             adult_attested_at is not null as attested_dated, signup_utm_source,
             signup_utm_medium, signup_utm_campaign, signup_referrer_domain,
             signup_heard_from::text
        from identity.accounts where auth_user_id = ${authUserId}::uuid`;
    const account = accounts[0];
    if (account === undefined) {
      return { accounts, account: null };
    }
    const id = account.id;
    const roles = await tx`
      select role::text from identity.account_roles where account_id = ${id}::uuid`;
    const profiles = await tx`
      select legal_name from profiles.advertiser_profiles where account_id = ${id}::uuid`;
    const acceptances = await tx`
      select terms_version_id::text, channel::text, nature::text, locale::text,
             encode(content_hash, 'hex') as hash
        from identity.terms_acceptances where account_id = ${id}::uuid`;
    const consents = await tx`
      select c.purpose::text, c.granted, c.source::text, c.evidence
        from identity.consent_events c
       where c.account_id = ${id}::uuid order by c.purpose`;
    const queue = await tx<{ destination: string; event_type: string }[]>`
      select o.destination::text, o.event_type from leads.outbox_events o
       where o.subject_key = ${`account:${id}`} order by o.destination`;
    const sessions = await tx`
      select surface::text, aal::text, user_agent_summary from identity.sessions
       where account_id = ${id}::uuid`;
    return {
      accounts,
      account,
      roles,
      profiles,
      acceptances,
      consents,
      queue,
      sessions,
    };
  });
}

async function auditLinesOf(requestId: string) {
  return migration<{ event_type: string; subject_id: string }[]>`
    select event_type, subject_id::text from audit.audit_events
     where request_id = ${requestId}`;
}

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
  const [terms] = await migration<{ id: string; hash: string }[]>`
    select id::text, encode(content_hash, 'hex') as hash from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  const [privacy] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'privacy_policy' and effective_to is null
       and effective_from <= now() and content is not null
     limit 1`;
  if (terms === undefined || privacy === undefined) {
    throw new Error(
      "no terms of service in force in French, or no privacy policy, WITH its text (data set " +
        "of T2; on a workstation, run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = terms;
  privacyPolicyId = privacy.id;
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
});

describe("POST /v1/signup: one transaction per door (RG7, EC-30, EC-10)", () => {
  it("creates an advertiser, opens its session and clears the token (CA2, CA22)", async () => {
    const { server, logs } = app();
    const identity = newIdentity("adv");
    try {
      const { response, requestId } = await signUp(
        server,
        advertiserBody({
          acquisition: {
            utmSource: "Spring Launch",
            utmMedium: "email",
            utmCampaign: "j5",
            referrerDomain: "WWW.Example.COM",
            heardFrom: "event",
          },
        }),
        tokenOf(identity),
      );
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({
        outcome: "signed_up",
        role: "advertiser",
      });
      expect(signupCookieCleared(response)).toBe(true);
      const session = sessionCookieOf(response);
      expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const written = await writtenFor(identity.authUserId);
      expect(written.account).toMatchObject({
        email: identity.email,
        verified: true, // CA22: no other confirmation step
        country_code: "GB",
        preferred_language: "en",
        declared_status: "business", // RG22
        is_adult_attested: false,
        attested_dated: false,
        signup_utm_source: "spring-launch",
        signup_utm_medium: "email",
        signup_utm_campaign: "j5",
        signup_referrer_domain: "www.example.com",
        signup_heard_from: "event",
      });
      expect(written.roles).toEqual([{ role: "advertiser" }]);
      expect(written.profiles).toEqual([{ legal_name: "Maison TM10" }]);
      // TM10.4: the version in force, its hash copied, the language of the version shown
      expect(written.acceptances).toEqual([
        {
          terms_version_id: termsInForce.id,
          channel: "signup",
          nature: "acceptance",
          locale: "fr",
          hash: termsInForce.hash,
        },
      ]);
      const evidence = {
        form: "signup_advertiser",
        wording_key: CONSENT_WORDING_KEYS.advertiser,
        wording:
          "I agree that INFLUX records my contact details in Brevo and Apollo.io.",
        locale: "en",
      };
      expect(written.consents).toEqual([
        {
          purpose: "marketing_email",
          granted: true,
          source: "signup_form",
          evidence,
        },
        {
          purpose: "commercial_prospection",
          granted: true,
          source: "signup_form",
          evidence,
        },
      ]);
      expect(written.queue).toEqual([
        { destination: "brevo_contact", event_type: "lead.created" },
        { destination: "apollo_contact", event_type: "lead.created" },
        { destination: "brevo_transactional", event_type: "lead.created" },
      ]);
      expect(written.sessions).toEqual([
        {
          surface: "member",
          aal: "aal1",
          user_agent_summary: "firefox.windows",
        },
      ]);
      // 03 §6.7: the elevated transaction is audited on the account it created
      expect(await auditLinesOf(requestId)).toEqual([
        {
          event_type: "elevated.identity.complete_signup",
          subject_id: written.account?.id,
        },
      ]);

      // The session opened by the sign-up is a real one (RG71: the home of the role)
      const me = await server.inject({
        method: "GET",
        url: "/v1/me",
        headers: {
          "x-influx-internal": WEB_SECRET,
          cookie: `__Host-influx-session=${session ?? ""}`,
        },
      });
      expect(me.json()).toEqual({
        email: identity.email,
        role: "advertiser",
        preferredLanguage: "en",
      });
      expect(
        valuesFoundIn(logs.text(), [
          identity.email,
          identity.authUserId,
          "Maison TM10",
          "records my contact details",
          session ?? "",
        ]),
      ).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("creates a creator with its declared status and its dated attestation (CA6, RG20)", async () => {
    const { server, logs } = app();
    const identity = newIdentity("cre");
    try {
      const { response } = await signUp(
        server,
        creatorBody({ declaredStatus: "business" }),
        tokenOf(identity),
      );
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({
        outcome: "signed_up",
        role: "creator",
      });
      const written = await writtenFor(identity.authUserId);
      expect(written.account).toMatchObject({
        country_code: "FR",
        preferred_language: "fr",
        declared_status: "business",
        is_adult_attested: true,
        attested_dated: true,
        signup_utm_source: null,
        signup_referrer_domain: null,
        signup_heard_from: null,
      });
      expect(written.roles).toEqual([{ role: "creator" }]);
      expect(written.profiles).toEqual([]);
      expect(written.consents?.map((row) => row.purpose)).toEqual([
        "marketing_email",
        "commercial_prospection",
      ]);
      expect(written.queue).toHaveLength(3);
      expect(
        valuesFoundIn(logs.text(), [identity.email, identity.authUserId]),
      ).toEqual([]);
    } finally {
      await server.close();
    }
  });
});

describe("POST /v1/signup: a second submission has no effect (RG110)", () => {
  it("answers the same success to a replay, with the role of the first submission (RG66)", async () => {
    const { server } = app();
    const identity = newIdentity("replay");
    const token = tokenOf(identity);
    try {
      const first = await signUp(server, creatorBody(), token);
      // back button, second tab: same token, another role chosen in between
      const second = await signUp(server, advertiserBody(), token);
      expect(first.response.json()).toEqual({
        outcome: "signed_up",
        role: "creator",
      });
      expect(second.response.json()).toEqual({
        outcome: "signed_up",
        role: "creator",
      });
      const written = await writtenFor(identity.authUserId);
      expect(written.accounts).toHaveLength(1);
      expect(written.roles).toEqual([{ role: "creator" }]);
      expect(written.profiles).toEqual([]);
      expect(written.acceptances).toHaveLength(1);
      expect(written.consents).toHaveLength(2);
      expect(written.queue).toHaveLength(3);
    } finally {
      await server.close();
    }
  });

  it("creates one account for a double click (two simultaneous submissions)", async () => {
    const { server } = app();
    const identity = newIdentity("double");
    const token = tokenOf(identity);
    try {
      const answers = await Promise.all([
        signUp(server, creatorBody(), token),
        signUp(server, creatorBody(), token),
      ]);
      for (const { response } of answers) {
        expect(response.json()).toEqual({
          outcome: "signed_up",
          role: "creator",
        });
      }
      const written = await writtenFor(identity.authUserId);
      expect(written.accounts).toHaveLength(1);
      expect(written.consents).toHaveLength(2);
      expect(written.queue).toHaveLength(3);
    } finally {
      await server.close();
    }
  });
});

describe("POST /v1/signup: refusals, nothing written (RG5)", () => {
  it("answers country_blocked for a blocked country, journalled with the country only (RG8, CA67)", async () => {
    const { server, logs } = app();
    const identity = newIdentity("blocked");
    await migration`
      update leads.sync_settings set value = value || jsonb_build_array(${BLOCKED_COUNTRY}::text)
       where key = 'signup_blocked_countries'`;
    try {
      const { response, requestId } = await signUp(
        server,
        creatorBody({ countryCode: BLOCKED_COUNTRY }),
        tokenOf(identity),
      );
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ outcome: "country_blocked" });
      expect(sessionCookieOf(response)).toBeNull();
      expect(signupCookieCleared(response)).toBe(false);
      expect((await writtenFor(identity.authUserId)).accounts).toEqual([]);
      expect(await auditLinesOf(requestId)).toEqual([]);
      const line = logs
        .text()
        .split("\n")
        .find((text) => text.includes("country blocked"));
      expect(line).toBeDefined();
      expect(JSON.parse(line ?? "{}")).toMatchObject({
        outcome: "country_blocked",
        countryCode: BLOCKED_COUNTRY,
      });
      expect(
        valuesFoundIn(logs.text(), [identity.email, identity.authUserId]),
      ).toEqual([]);
    } finally {
      await migration`
        update leads.sync_settings set value = value - ${BLOCKED_COUNTRY}::text
         where key = 'signup_blocked_countries'`;
    }
    await server.close();
  });

  it.each([
    ["an unknown version", () => randomUUID()],
    ["a version in force of another document", () => privacyPolicyId],
  ])(
    "answers terms_outdated to %s: the front reloads the terms (RG25, RG29)",
    async (_label, versionId) => {
      const { server } = app();
      const identity = newIdentity("terms");
      try {
        const { response } = await signUp(
          server,
          creatorBody({ termsVersionId: versionId() }),
          tokenOf(identity),
        );
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ outcome: "terms_outdated" });
        expect(signupCookieCleared(response)).toBe(false);
        expect((await writtenFor(identity.authUserId)).accounts).toEqual([]);
      } finally {
        await server.close();
      }
    },
  );

  it("refuses an unchecked consent while it is required (D63, RG124), the token kept", async () => {
    const { server } = app();
    const identity = newIdentity("noconsent");
    try {
      const { response } = await signUp(
        server,
        advertiserBody({ marketingConsent: false }),
        tokenOf(identity),
      );
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatchObject({
        code: "validation_failed",
        details: [{ path: "marketingConsent", issue: "consent_required" }],
      });
      expect(setCookies(response)).toEqual([]);
      expect((await writtenFor(identity.authUserId)).accounts).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("records two refused consents when the setting lifts the obligation (D63 way back, CA5)", async () => {
    const { server } = app();
    const identity = newIdentity("consentoff");
    await migration`
      update leads.sync_settings set value = 'false'::jsonb
       where key = 'signup_consent_required'`;
    try {
      const { response } = await signUp(
        server,
        advertiserBody({ marketingConsent: false }),
        tokenOf(identity),
      );
      expect(response.json()).toEqual({
        outcome: "signed_up",
        role: "advertiser",
      });
      const written = await writtenFor(identity.authUserId);
      expect(
        written.consents?.map((row) => [row.purpose, row.granted]),
      ).toEqual([
        ["marketing_email", false],
        ["commercial_prospection", false],
      ]);
    } finally {
      await migration`
        update leads.sync_settings set value = 'true'::jsonb
         where key = 'signup_consent_required'`;
      await server.close();
    }
  });

  it.each([
    [
      "an advertiser with a declared status (RG22)",
      () => advertiserBody({ declaredStatus: "individual" }),
    ],
    [
      "a creator without the adult attestation (D15, CA8)",
      () => creatorBody({ adultAttested: false }),
    ],
    [
      "a creator without declared status (RG18, CA7)",
      () => creatorBody({ declaredStatus: undefined }),
    ],
    [
      "unchecked terms (RG23, CA4)",
      () => creatorBody({ termsAccepted: false }),
    ],
  ])("refuses %s with 400, called directly (TM10.3)", async (_label, body) => {
    const { server } = app();
    const identity = newIdentity("invalid");
    try {
      const { response } = await signUp(server, body(), tokenOf(identity));
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("validation_failed");
      expect((await writtenFor(identity.authUserId)).accounts).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it.each([
    ["no token", () => null],
    [
      "an expired token (30 minutes)",
      (identity: Identity) =>
        tokenOf(identity, new Date(Date.now() - 31 * 60 * 1000)),
    ],
  ])("answers 401 with %s, nothing written (EC-4)", async (_label, token) => {
    const { server } = app();
    const identity = newIdentity("notoken");
    try {
      const { response } = await signUp(server, creatorBody(), token(identity));
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("unauthenticated");
      expect((await writtenFor(identity.authUserId)).accounts).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("answers account_unavailable when another account holds the address of the token", async () => {
    const { server, logs } = app();
    const holder = newIdentity("holder");
    const intruder = { authUserId: randomUUID(), email: holder.email };
    try {
      await signUp(server, creatorBody(), tokenOf(holder));
      const { response } = await signUp(
        server,
        creatorBody(),
        tokenOf(intruder),
      );
      expect(response.json()).toEqual({ outcome: "account_unavailable" });
      expect(sessionCookieOf(response)).toBeNull();
      expect(signupCookieCleared(response)).toBe(true);
      expect((await writtenFor(intruder.authUserId)).accounts).toEqual([]);
      expect(
        valuesFoundIn(logs.text(), [holder.email, intruder.authUserId]),
      ).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
