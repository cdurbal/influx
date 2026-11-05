// L2B commit 07 — the brand profile routes on the local stack (docs/mvp/06 RG2, RG5, RG14, RG17,
// RG57 to RG61, CA1 to CA7, CA14; 18 T14.1 to T14.4; jalons/l2b): GET, PATCH and POST submit of
// /v1/me/brand-profile, through the pools of apps/api (member under influx_app, migrations 0202
// and 0203). The route accounts are COMMITTED by the migration role (random identifiers,
// disposable local stack, like TM1) with their sessions; their queue lines are removed after the
// file. The decisions of an agent are the business of the queue routes (t14-backoffice-queue-route,
// profiles-brand-decision): the states they give are written here by the migration role, as a
// decision would, to prove what the brand then reads and may write (L2C commit 13). Every log stream is searched BY VALUE
// (C-1, D60): no company name, presentation nor contact detail.
import {
  brandProfileResponseSchema,
  type BrandProfileResponse,
  type SubmitBrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { accountIdOf, localRoleUrl, type LoginRole } from "@influx/test-kit/db";
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
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };
import { migrationRole, retireBrandFixtures, testDataSet } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
let termsInForce: { fr: string; label: string };
const accounts: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

/** Active codes of the reference lists, read once. */
let codes: {
  sectors: string[];
  topics: string[];
  networks: string[];
  formats: string[];
  usageRights: string[];
};

/** What an agent writes to the team only: it must never reach the brand (D46, file.md A6). */
const INTERNAL_COMMENT = "NOTE-INTERNE-L2C13-JAMAIS-AU-MEMBRE";

const PRESENTATION = `${"Une marque de cosmétiques engagée, qui cherche des créateurs sincères. ".repeat(3)}Contact par la plateforme.`;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = {
  accountId: string;
  email: string;
  session: string;
};

async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2b-brand-${role}-${accountId}@example.test`;
  const name = `Maison ${accountId.slice(0, 8)}`;
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
        values (${accountId}, ${name})`;
    }
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
  watchedValues.push(email, name);
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  return { accountId, email, session: token.toString("base64url") };
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
  method: "GET" | "PATCH" | "POST",
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

const URL_PROFILE = "/v1/me/brand-profile";
const URL_SUBMIT = "/v1/me/brand-profile/submit";

async function read(
  server: Server,
  member: Member,
): Promise<BrandProfileResponse> {
  const response = await call(server, "GET", URL_PROFILE, member.session);
  expect(response.statusCode).toBe(200);
  return response.json() as BrandProfileResponse;
}

function patch(server: Server, member: Member, body: unknown) {
  return call(server, "PATCH", URL_PROFILE, member.session, body);
}

/** The status and body of an error, without its request id (T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: {
      code: string;
      message: string;
      requestId: string;
      details?: { path: string; issue: string }[];
    };
  };
  return {
    status: response.statusCode,
    code: error.code,
    message: error.message,
  };
}

function issuesOf(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: { details?: { path: string; issue: string }[] };
  };
  return error.details ?? [];
}

/** Everything a complete profile holds, as the form would send it. */
function completeBody() {
  return {
    primarySector: codes.sectors[0],
    companySize: "11_50",
    targetMarkets: ["FR", "BE"],
    workingLanguages: ["fr", "en"],
    presentation: PRESENTATION,
    topics: codes.topics.slice(0, 2),
    networks: codes.networks.slice(0, 2),
    formats: codes.formats.slice(0, 2),
    audienceCountries: ["FR"],
    contactRole: "marketing",
  };
}

async function statusOf(accountId: string): Promise<string> {
  const [row] = await migration<{ status: string }[]>`
    select status::text as status from profiles.advertiser_profiles
     where account_id = ${accountId}`;
  return row?.status ?? "";
}

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const versions = await migration<
    { id: string; locale: string; version_label: string }[]
  >`
    select id::text, locale::text as locale, version_label from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  const fr = versions[0];
  if (fr === undefined) {
    throw new Error(
      "no terms of service in force in French, WITH its text (run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = { fr: fr.id, label: fr.version_label };
  const codesOf = (rows: { code: string }[]) => rows.map((row) => row.code);
  codes = {
    sectors: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.sectors where retired_at is null order by code`,
    ),
    topics: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.topics where retired_at is null order by code`,
    ),
    networks: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.networks where retired_at is null order by code`,
    ),
    formats: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.formats where retired_at is null order by code`,
    ),
    usageRights: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.usage_rights
         where retired_at is null and code <> 'none' order by sort_order`,
    ),
  };
  for (const [name, list] of Object.entries(codes)) {
    if (list.length < 3) {
      throw new Error(`reference list ${name} holds fewer than 3 active codes`);
    }
  }
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
  // L2CT-7: no open entry and no published profile of this file stays in the shared stack
  await retireBrandFixtures(migration, accounts);
  if (accounts.length > 0) {
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

describe("GET /v1/me/brand-profile (06 RG2, RG57, RG61, CA1, CA2, CA14)", () => {
  it("answers a new brand its draft, pre-filled from the account, with what is missing in the order of the form (CA1)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const response = await call(server, "GET", URL_PROFILE, member.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const profile = response.json() as BrandProfileResponse;
    expect(profile.status).toBe("draft");
    expect(profile.submittedAt).toBeNull();
    expect(profile.companyName).toBe(`Maison ${member.accountId.slice(0, 8)}`);
    expect(profile.country).toBe("FR");
    expect(profile.preferredLanguage).toBe("fr");
    expect(profile.signInEmail).toBe(member.email);
    expect(profile.missingRequired).toEqual([
      "primarySector",
      "companySize",
      "targetMarkets",
      "workingLanguages",
      "presentation",
      "topics",
      "networks",
      "formats",
      "audienceCountries",
      "contactRole",
    ]);
    // the name and the country are the only points earned: 7 of the 82 reachable today
    expect(profile.completeness).toMatchObject({
      score: 9,
      earnedPoints: 7,
      attainablePoints: 82,
    });
    expect(profile.contact).toEqual({
      firstName: null,
      email: null,
      phone: null,
      url: null,
    });
  });

  it("lists the active codes of each reference list and never `none` among the usage rights", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const { references } = await read(server, member);
    expect(references.sectors).toEqual(codes.sectors);
    expect(references.topics).toEqual(codes.topics);
    expect(references.networks).toEqual(codes.networks);
    expect(references.formats).toEqual(codes.formats);
    expect(references.usageRights).not.toContain("none");
    expect([...references.usageRights].sort()).toEqual(
      [...codes.usageRights].sort(),
    );
    expect([...references.languages].sort()).toEqual(["en", "fr"]);
    expect(references.countries).toContain("FR");
  });

  it("answers with the listed fields only: nothing of the account beyond its own, no social handle (CA14)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const profile = await read(server, member);
    expect(Object.keys(profile).sort()).toEqual(
      Object.keys(brandProfileResponseSchema.shape).sort(),
    );
    expect(Object.keys(profile).join(" ")).not.toMatch(
      /instagram|tiktok|youtube|linkedin|handle|social|budget|price|rate/i,
    );
    expect(Object.keys(profile.contact).sort()).toEqual([
      "email",
      "firstName",
      "phone",
      "url",
    ]);
  });
});

describe("PATCH /v1/me/brand-profile (06 RG14, RG17, RG27, RG35, CA2 to CA5, CA14)", () => {
  it("saves a partial body, leaves the rest alone and stores the score packages/domain computed (RG57)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const first = await patch(server, member, {
      primarySector: codes.sectors[0],
      companySize: "51_250",
    });
    expect(first.statusCode).toBe(200);
    const after = await patch(server, member, {
      exclusivityBand: "le_3m",
      collaborationRhythm: "recurring",
      offersNonMonetary: true,
    });
    expect(after.statusCode).toBe(200);
    const profile = after.json() as BrandProfileResponse;
    expect(profile).toMatchObject({
      primarySector: codes.sectors[0],
      companySize: "51_250",
      exclusivityBand: "le_3m",
      collaborationRhythm: "recurring",
      offersNonMonetary: true,
    });
    expect(profile.completeness.score).toBeGreaterThan(9);
    const [row] = await migration<{ completeness_percent: number }[]>`
      select completeness_percent from profiles.advertiser_profiles
       where account_id = ${member.accountId}`;
    expect(row?.completeness_percent).toBe(profile.completeness.score);
    // `null` empties a single value
    const emptied = await patch(server, member, { exclusivityBand: null });
    expect((emptied.json() as BrandProfileResponse).exclusivityBand).toBeNull();
  });

  it("asks for neither the country, the language nor the address again, and refuses an unknown field or a social handle (CA2, CA14, RG14)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    for (const body of [
      {},
      { countryCode: "BE" },
      { country: "BE" },
      { preferredLanguage: "en" },
      { email: "autre@example.test" },
      { accountId: randomUUID() },
      { instagram: "@maison" },
      { socialAccounts: ["@maison"] },
      { budgetBand: "up_to_1000" },
      { status: "published" },
    ]) {
      const response = await patch(server, member, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(errorBody(response).code).toBe("validation_failed");
    }
    const profile = await read(server, member);
    expect(profile.country).toBe("FR");
    expect(profile.status).toBe("draft");
  });

  it("writes the trading name through the account: ONE value, ONE lead.updated to Brevo and Apollo, none for the same name (CA3)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    watchedValues.push("Maison Renommée L2B");
    const renamed = await patch(server, member, {
      companyName: "Maison Renommée L2B",
    });
    expect(renamed.statusCode).toBe(200);
    expect((renamed.json() as BrandProfileResponse).companyName).toBe(
      "Maison Renommée L2B",
    );
    const me = await call(server, "GET", "/v1/me", member.session);
    expect((me.json() as { companyName: string }).companyName).toBe(
      "Maison Renommée L2B",
    );
    const lines = await migration<
      { event_type: string; destination: string }[]
    >`
      select event_type, destination::text as destination from leads.outbox_events
       where subject_key = ${`account:${member.accountId}`} order by id`;
    expect(lines.map((line) => [line.event_type, line.destination])).toEqual([
      ["lead.updated", "brevo_contact"],
      ["lead.updated", "apollo_contact"],
    ]);
    await patch(server, member, { companyName: "Maison Renommée L2B" });
    await patch(server, member, { companySize: "1_10" });
    const [count] = await migration<{ n: number }[]>`
      select count(*)::int as n from leads.outbox_events
       where subject_key = ${`account:${member.accountId}`}`;
    expect(count?.n).toBe(2);
    // too short a name: refused by the same rule as at sign-up, nothing written
    const refused = await patch(server, member, { companyName: " a " });
    expect(refused.statusCode).toBe(400);
  });

  it("reduces the website to its domain and says so; refuses what holds no host; empties it on a blank (RG17, CA4)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const typed = await patch(server, member, {
      website: "https://Exemple.com/contact?utm=abc",
    });
    expect(typed.statusCode).toBe(200);
    expect(typed.json()).toMatchObject({
      website: "exemple.com",
      websiteNormalized: true,
    });
    const plain = await patch(server, member, { website: "autre-marque.fr" });
    expect(plain.json()).toMatchObject({
      website: "autre-marque.fr",
      websiteNormalized: false,
    });
    for (const website of [
      "javascript:alert(1)",
      "mailto:a@b.com",
      "localhost",
    ]) {
      const refused = await patch(server, member, { website });
      expect(refused.statusCode, website).toBe(400);
      expect(issuesOf(refused)).toEqual([
        { path: "website", issue: "invalid_host" },
      ]);
    }
    expect((await read(server, member)).website).toBe("autre-marque.fr");
    const blank = await patch(server, member, { website: "  " });
    expect(blank.json()).toMatchObject({
      website: null,
      websiteNormalized: false,
    });
  });

  it("accepts the bands of company size only, never a headcount (CA5)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    for (const band of ["1_10", "11_50", "51_250", "251_1000", "1001_plus"]) {
      const response = await patch(server, member, { companySize: band });
      expect(response.statusCode, band).toBe(200);
    }
    for (const typed of ["12", 12, "50 employés", "1000+", ""]) {
      const response = await patch(server, member, { companySize: typed });
      expect(response.statusCode, String(typed)).toBe(400);
    }
    expect((await read(server, member)).companySize).toBe("1001_plus");
  });

  it("replaces a list as a whole, in the order given, slots from 1 to n; an empty list empties it", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const [a, b, c] = codes.topics;
    const first = await patch(server, member, { topics: [c, a, b] });
    expect((first.json() as BrandProfileResponse).topics).toEqual([c, a, b]);
    const slots = await migration<{ slot: number; topic_code: string }[]>`
      select slot, topic_code from profiles.advertiser_topics
       where account_id = ${member.accountId} order by slot`;
    expect(slots).toEqual([
      { slot: 1, topic_code: c },
      { slot: 2, topic_code: a },
      { slot: 3, topic_code: b },
    ]);
    const second = await patch(server, member, { topics: [b] });
    expect((second.json() as BrandProfileResponse).topics).toEqual([b]);
    const markets = await patch(server, member, {
      targetMarkets: ["BE", "FR"],
      audienceCountries: ["DE"],
      workingLanguages: ["en"],
      secondarySectors: codes.sectors.slice(1, 3),
      networks: codes.networks.slice(0, 2),
      usageRights: codes.usageRights.slice(0, 2),
    });
    expect(markets.json()).toMatchObject({
      targetMarkets: ["BE", "FR"],
      audienceCountries: ["DE"],
      workingLanguages: ["en"],
      secondarySectors: codes.sectors.slice(1, 3),
      networks: codes.networks.slice(0, 2),
      usageRights: codes.usageRights.slice(0, 2),
    });
    const emptied = await patch(server, member, {
      topics: [],
      usageRights: [],
    });
    expect(emptied.json()).toMatchObject({ topics: [], usageRights: [] });
  });

  it("refuses beyond a cap, a duplicate, an unknown code, `none` as a right and a language outside FR/EN (RG15, RG27, L2-amend)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, { topics: [codes.topics[0]] });
    const refusals: [string, unknown][] = [
      ["topics", { topics: codes.topics.slice(0, 4) }],
      ["topics", { topics: [codes.topics[0], codes.topics[0]] }],
      ["secondarySectors", { secondarySectors: codes.sectors.slice(0, 3) }],
      [
        "targetMarkets",
        { targetMarkets: ["FR", "BE", "DE", "ES", "IT", "GB"] },
      ],
      ["audienceCountries", { audienceCountries: ["XX"] }],
      ["workingLanguages", { workingLanguages: ["de"] }],
      ["usageRights", { usageRights: ["none"] }],
      ["primarySector", { primarySector: "Not A Code" }],
    ];
    for (const [name, body] of refusals) {
      const response = await patch(server, member, body);
      expect(response.statusCode, name).toBe(400);
    }
    // well-formed but not in the reference list: the field is named, the value never echoed
    const unknown = await patch(server, member, {
      topics: ["no_such_topic"],
      networks: ["no_such_network"],
    });
    expect(unknown.statusCode).toBe(400);
    expect(issuesOf(unknown)).toEqual([
      { path: "topics", issue: "unknown" },
      { path: "networks", issue: "unknown" },
    ]);
    expect(JSON.stringify(unknown.json())).not.toContain("no_such_topic");
    // a refused save changes nothing
    expect((await read(server, member)).topics).toEqual([codes.topics[0]]);
  });

  it("keeps a presentation as typed up to 1 000 characters, refuses beyond, and empties it on a blank", async () => {
    const server = app();
    const member = await newMember("advertiser");
    watchedValues.push("Présentation L2B secrète");
    const saved = await patch(server, member, {
      presentation: "Présentation L2B secrète\navec une ligne",
    });
    expect((saved.json() as BrandProfileResponse).presentation).toBe(
      "Présentation L2B secrète\navec une ligne",
    );
    expect(
      (await patch(server, member, { presentation: "é".repeat(1000) }))
        .statusCode,
    ).toBe(200);
    expect(
      (await patch(server, member, { presentation: "é".repeat(1001) }))
        .statusCode,
    ).toBe(400);
    expect(
      (await patch(server, member, { presentation: "bad\u0007text" }))
        .statusCode,
    ).toBe(400);
    const blank = await patch(server, member, { presentation: "   " });
    expect((blank.json() as BrandProfileResponse).presentation).toBeNull();
  });

  it("upserts the contact person field by field: the rest is kept, `null` empties one, a malformed value is refused (RG35)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    watchedValues.push("+33612345678", "contact-l2b@exemple.test", "Camille");
    const first = await patch(server, member, {
      contactRole: "partnerships_influence",
      contact: { firstName: "Camille", phone: "+33612345678" },
    });
    expect(first.statusCode).toBe(200);
    expect((first.json() as BrandProfileResponse).contact).toEqual({
      firstName: "Camille",
      email: null,
      phone: "+33612345678",
      url: null,
    });
    const second = await patch(server, member, {
      contact: {
        email: "Contact-L2B@Exemple.test",
        url: "https://exemple.test/contact",
      },
    });
    expect((second.json() as BrandProfileResponse).contact).toEqual({
      firstName: "Camille",
      email: "contact-l2b@exemple.test",
      phone: "+33612345678",
      url: "https://exemple.test/contact",
    });
    const third = await patch(server, member, { contact: { phone: null } });
    expect((third.json() as BrandProfileResponse).contact.phone).toBeNull();
    expect((third.json() as BrandProfileResponse).contact.firstName).toBe(
      "Camille",
    );
    for (const contact of [
      { phone: "06 12 34 56 78" },
      { phone: "+12" },
      { email: "not-an-address" },
      { url: "http://exemple.test" },
      { url: "https://user:pw@exemple.test" },
      { firstName: "x".repeat(41) },
      {},
      { instagram: "@maison" },
    ]) {
      const response = await patch(server, member, { contact });
      expect(response.statusCode, JSON.stringify(contact)).toBe(400);
    }
    // one row only, on account_id
    const [count] = await migration<{ n: number }[]>`
      select count(*)::int as n from profiles.advertiser_contact_details
       where account_id = ${member.accountId}`;
    expect(count?.n).toBe(1);
  });

  it("serialises two saves at the same moment: both answer 200 and one list wins whole", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const [a, b, c] = codes.topics;
    const [one, two] = await Promise.all([
      patch(server, member, { topics: [a, b] }),
      patch(server, member, { topics: [c] }),
    ]);
    expect([one.statusCode, two.statusCode]).toEqual([200, 200]);
    const { topics } = await read(server, member);
    expect([[a, b], [c]]).toContainEqual(topics);
  });
});

describe("POST /v1/me/brand-profile/submit (06 RG5, RG6, CA6, CA7, edge cases 3 and 5)", () => {
  it("refuses an incomplete profile and names EVERY missing field, leaving it a draft (CA7)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, {
      ...completeBody(),
      formats: [],
      audienceCountries: [],
    });
    const response = await call(server, "POST", URL_SUBMIT, member.session);
    expect(response.statusCode).toBe(400);
    expect(errorBody(response).code).toBe("validation_failed");
    expect(issuesOf(response)).toEqual([
      { path: "formats", issue: "required" },
      { path: "audienceCountries", issue: "required" },
    ]);
    expect(await statusOf(member.accountId)).toBe("draft");
    const [events] = await migration<{ n: number }[]>`
      select count(*)::int as n from audit.audit_events
       where event_type = 'profile.submitted' and subject_id = ${member.accountId}`;
    expect(events?.n).toBe(0);
  });

  it("refuses a presentation under 120 characters like any other missing field", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, {
      ...completeBody(),
      presentation: "Trop court.",
    });
    const response = await call(server, "POST", URL_SUBMIT, member.session);
    expect(response.statusCode).toBe(400);
    expect(issuesOf(response)).toEqual([
      { path: "presentation", issue: "required" },
    ]);
  });

  it("submits a complete profile: pending_review, the instant, ONE register line; a second click writes nothing (CA6, edge case 3)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const saved = await patch(server, member, completeBody());
    expect((saved.json() as BrandProfileResponse).missingRequired).toEqual([]);
    const response = await call(server, "POST", URL_SUBMIT, member.session);
    expect(response.statusCode).toBe(200);
    const submitted = response.json() as BrandProfileResponse & {
      changed: boolean;
    };
    expect(submitted.status).toBe("pending_review");
    expect(submitted.changed).toBe(true);
    expect(submitted.submittedAt).not.toBeNull();
    expect(await statusOf(member.accountId)).toBe("pending_review");

    const again = await call(server, "POST", URL_SUBMIT, member.session);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({
      status: "pending_review",
      changed: false,
      submittedAt: submitted.submittedAt,
    });
    const lines = await migration<{ payload: unknown }[]>`
      select payload from audit.audit_events
       where event_type = 'profile.submitted' and subject_id = ${member.accountId}`;
    // 0207 (file.md, codes): the line names the entry of queue 1 the submission opened
    expect(lines.map((line) => line.payload)).toEqual([
      { from_status: "draft", entry_id: expect.any(String) },
    ]);
    // waiting for INFLUX, the brand may still correct: the state does not move
    const edited = await patch(server, member, { companySize: "1_10" });
    expect(edited.statusCode).toBe(200);
    expect((edited.json() as BrandProfileResponse).status).toBe(
      "pending_review",
    );
  });

  it("serialises two submissions at the same moment: one changed, one register line, one entry (L2BT-3)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, completeBody());
    const answers = await Promise.all([
      call(server, "POST", URL_SUBMIT, member.session),
      call(server, "POST", URL_SUBMIT, member.session),
    ]);
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);
    const changed = answers.map(
      (answer) => (answer.json() as SubmitBrandProfileResponse).changed,
    );
    expect(changed.filter((value) => value)).toHaveLength(1);
    const [lines] = await migration<{ n: number }[]>`
      select count(*)::int as n from audit.audit_events
       where event_type = 'profile.submitted' and subject_id = ${member.accountId}`;
    expect(lines?.n).toBe(1);
    const [entries] = await migration<{ n: number }[]>`
      select count(*)::int as n from profiles.advertiser_review_entries
       where account_id = ${member.accountId}`;
    expect(entries?.n).toBe(1);
  });

  it("submits again after a refusal by INFLUX (rejected), and refuses a published or suspended profile (409, edge case 5, RG6)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, completeBody());
    await migration`
      update profiles.advertiser_profiles set status = 'rejected'
       where account_id = ${member.accountId}`;
    expect((await read(server, member)).status).toBe("rejected");
    const again = await call(server, "POST", URL_SUBMIT, member.session);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({
      status: "pending_review",
      changed: true,
    });
    const [line] = await migration<{ payload: unknown }[]>`
      select payload from audit.audit_events
       where event_type = 'profile.submitted' and subject_id = ${member.accountId}`;
    expect(line?.payload).toEqual({
      from_status: "rejected",
      entry_id: expect.any(String),
    });

    for (const state of ["published", "suspended"]) {
      await migration`
        update profiles.advertiser_profiles set status = ${state}::profiles.advertiser_profile_status
         where account_id = ${member.accountId}`;
      const submit = await call(server, "POST", URL_SUBMIT, member.session);
      expect(errorBody(submit), state).toEqual({
        status: 409,
        code: "conflict",
        message: "Conflict",
      });
      // a published profile is edited under the regime of RG9 (below); a suspended one is frozen
      const edit = await patch(server, member, { companySize: "1_10" });
      if (state === "suspended") {
        expect(errorBody(edit), state).toMatchObject({
          status: 409,
          code: "conflict",
        });
      } else {
        expect(edit.statusCode, state).toBe(200);
      }
      expect(await statusOf(member.accountId)).toBe(state);
    }
  });
});

/** The brand published by a decision: complete, then the state INFLUX would give it (no decision exists in this file). */
async function newPublishedMember(server: Server): Promise<Member> {
  const member = await newMember("advertiser");
  expect((await patch(server, member, completeBody())).statusCode).toBe(200);
  await migration`
    update profiles.advertiser_profiles set status = 'published'
     where account_id = ${member.accountId}`;
  return member;
}

async function leadUpdatedCount(accountId: string): Promise<number> {
  const [row] = await migration<{ n: number }[]>`
    select count(*)::int as n from leads.outbox_events
     where subject_key = ${`account:${accountId}`} and event_type = 'lead.updated'`;
  return row?.n ?? 0;
}

type RevisionRow = {
  field_code: string;
  status: string;
  proposed_value: unknown;
};

async function revisionsOf(accountId: string): Promise<RevisionRow[]> {
  return migration<RevisionRow[]>`
    select field_code, status::text as status, proposed_value
      from profiles.profile_field_revisions
     where account_id = ${accountId} order by submitted_at, field_code`;
}

async function entriesOf(
  accountId: string,
): Promise<{ kind: string; state: string }[]> {
  return migration<{ kind: string; state: string }[]>`
    select kind::text as kind, state::text as state
      from profiles.advertiser_review_entries
     where account_id = ${accountId} order by created_at`;
}

describe("PATCH on a published profile: the regime of 06 RG9 (CA15, CA16, RG78; jalons/l2c/file.md A2 to A4)", () => {
  it("proposes a moderated change: the validated version stays, the change waits, ONE entry, no lead.updated (CA15)", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    const validated = PRESENTATION;
    const first = `${"Nouvelle présentation de la marque, plus précise et plus engageante. ".repeat(3)}Fin.`;
    const proposed = await patch(server, member, { presentation: first });
    expect(proposed.statusCode).toBe(200);
    const body = proposed.json() as BrandProfileResponse;
    // the status stays published (A2) and every field is the validated value
    expect(body.status).toBe("published");
    expect(body.presentation).toBe(validated);
    expect(body.pendingChanges).toEqual([
      {
        field: "presentation",
        change: "set",
        value: first,
        submittedAt: expect.any(String),
      },
    ]);
    expect(body.refusal).toBeNull();
    const [live] = await migration<{ presentation: string }[]>`
      select presentation from profiles.advertiser_profiles
       where account_id = ${member.accountId}`;
    expect(live?.presentation).toBe(validated);
    expect(await entriesOf(member.accountId)).toEqual([
      { kind: "revision", state: "open" },
    ]);
    expect(await leadUpdatedCount(member.accountId)).toBe(0);
    // the read says the same (CA15)
    const read1 = await read(server, member);
    expect(read1.presentation).toBe(validated);
    expect(read1.pendingChanges).toHaveLength(1);

    // a second value replaces the first: one pending revision per field, the first superseded
    const second = `${"Une autre présentation, relue et corrigée par la marque elle-même. ".repeat(3)}Fin.`;
    await patch(server, member, { presentation: second });
    expect((await read(server, member)).pendingChanges[0]?.value).toBe(second);
    expect(
      (await revisionsOf(member.accountId)).map((row) => row.status),
    ).toEqual(["superseded", "pending_review"]);
    expect(await entriesOf(member.accountId)).toHaveLength(1);

    // back to the validated value: nothing waits, the entry is withdrawn, no forced reading
    const back = await patch(server, member, { presentation: validated });
    expect((back.json() as BrandProfileResponse).pendingChanges).toEqual([]);
    expect(await entriesOf(member.accountId)).toEqual([
      { kind: "revision", state: "withdrawn" },
    ]);
    expect(await leadUpdatedCount(member.accountId)).toBe(0);
  });

  it("proposes each moderated field, trading name included, and keeps the validated values in every field", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    const before = await read(server, member);
    const otherSector = codes.sectors.find(
      (code) => code !== before.primarySector,
    );
    watchedValues.push("Maison Révisée L2C13");
    const response = await patch(server, member, {
      companyName: "Maison Révisée L2C13",
      primarySector: otherSector,
      website: "https://www.maison-revisee.example/boutique",
      contactRole: "executive",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as BrandProfileResponse & {
      websiteNormalized: boolean;
    };
    expect(body.websiteNormalized).toBe(true);
    expect(body.companyName).toBe(before.companyName);
    expect(body.primarySector).toBe(before.primarySector);
    expect(body.website).toBe(before.website);
    expect(body.contactRole).toBe("marketing");
    expect(
      body.pendingChanges
        .map((change) => [change.field, change.change, change.value])
        .sort(),
    ).toEqual(
      [
        ["companyName", "set", "Maison Révisée L2C13"],
        ["primarySector", "set", otherSector],
        ["website", "set", "www.maison-revisee.example"],
        ["contactRole", "set", "executive"],
      ].sort(),
    );
    // emptying an optional moderated field is a proposal too (the website is not required)
    await migration`
      update profiles.advertiser_profiles set website_domain = 'maison-validee.example'
       where account_id = ${member.accountId}`;
    const cleared = await patch(server, member, { website: null });
    expect(
      (cleared.json() as BrandProfileResponse).pendingChanges.find(
        (change) => change.field === "website",
      ),
    ).toMatchObject({ change: "clear", value: null });
    expect(await entriesOf(member.accountId)).toEqual([
      { kind: "revision", state: "open" },
    ]);
    expect(await leadUpdatedCount(member.accountId)).toBe(0);
  });

  it("applies a field with immediate effect at once: ONE lead.updated per save that changed something, none otherwise (CA16, RG78)", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    const first = await patch(server, member, { companySize: "251_1000" });
    expect(first.statusCode).toBe(200);
    // no re-validation: applied, visible at once, nothing waits, no entry (CA16)
    expect((first.json() as BrandProfileResponse).companySize).toBe("251_1000");
    expect((first.json() as BrandProfileResponse).pendingChanges).toEqual([]);
    expect(await entriesOf(member.accountId)).toEqual([]);
    expect(await leadUpdatedCount(member.accountId)).toBe(2);
    const lines = await migration<{ destination: string; payload: unknown }[]>`
      select destination::text as destination, payload from leads.outbox_events
       where subject_key = ${`account:${member.accountId}`} and event_type = 'lead.updated'
       order by id`;
    expect(lines.map((line) => line.destination)).toEqual([
      "brevo_contact",
      "apollo_contact",
    ]);
    expect(lines[0]?.payload).toEqual({
      event_id: expect.any(String),
      account_id: member.accountId,
    });

    // the same value again: nothing; a list and the contact in ONE save: exactly one more
    await patch(server, member, { companySize: "251_1000" });
    expect(await leadUpdatedCount(member.accountId)).toBe(2);
    await patch(server, member, {
      targetMarkets: ["FR", "DE"],
      topics: codes.topics.slice(1, 3),
      contact: { firstName: "Camille" },
    });
    expect(await leadUpdatedCount(member.accountId)).toBe(4);
    expect((await read(server, member)).targetMarkets).toEqual(["FR", "DE"]);

    // a save of both regimes: the moderated field waits, the other applies, ONE lead.updated
    const mixed = await patch(server, member, {
      presentation: `${"Présentation proposée en même temps qu'une taille d'entreprise. ".repeat(3)}Fin.`,
      companySize: "1_10",
    });
    const mixedBody = mixed.json() as BrandProfileResponse;
    expect(mixedBody.companySize).toBe("1_10");
    expect(mixedBody.presentation).toBe(PRESENTATION);
    expect(mixedBody.pendingChanges.map((change) => change.field)).toEqual([
      "presentation",
    ]);
    expect(await leadUpdatedCount(member.accountId)).toBe(6);
  });

  it("refuses to empty a required field of a published profile, naming it and writing nothing (EC-L2C-01-2)", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    for (const [body, path] of [
      [{ presentation: "   " }, "presentation"],
      [{ presentation: "Trop court." }, "presentation"],
      [{ primarySector: null }, "primarySector"],
      [{ contactRole: null }, "contactRole"],
      [{ companySize: null }, "companySize"],
      [{ targetMarkets: [] }, "targetMarkets"],
      [{ topics: [] }, "topics"],
    ] as const) {
      const response = await patch(server, member, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(issuesOf(response), JSON.stringify(body)).toEqual([
        { path, issue: "required" },
      ]);
    }
    const after = await read(server, member);
    expect(after.pendingChanges).toEqual([]);
    expect(after.targetMarkets).toEqual(["FR", "BE"]);
    expect(await revisionsOf(member.accountId)).toEqual([]);
    expect(await leadUpdatedCount(member.accountId)).toBe(0);
    // what is not required can be emptied at once (06 RG15)
    expect(
      (await patch(server, member, { secondarySectors: [] })).statusCode,
    ).toBe(200);
  });

  it("refuses every edit of a suspended profile (409), and the base refuses it around the API too (L2BS-1)", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    await migration`
      update profiles.advertiser_profiles set status = 'suspended'
       where account_id = ${member.accountId}`;
    for (const body of [
      { companySize: "1_10" },
      { presentation: PRESENTATION },
      { companyName: "Maison Suspendue" },
      { targetMarkets: ["FR"] },
      { contact: { firstName: "Camille" } },
    ]) {
      expect(
        errorBody(await patch(server, member, body)),
        JSON.stringify(body),
      ).toEqual({
        status: 409,
        code: "conflict",
        message: "Conflict",
      });
    }
    expect(await revisionsOf(member.accountId)).toEqual([]);
    const me = await call(server, "PATCH", "/v1/me", member.session, {
      companyName: "Maison Suspendue",
    });
    expect(me.statusCode).toBe(409);
  });
});

describe("GET /v1/me/brand-profile: the refusal of INFLUX, typed, in the language of the account (06 RG10, RG66, CA20)", () => {
  async function decide(
    accountId: string,
    entryKind: "submission" | "revision",
    reason: string,
    memberMessage: string | null,
  ): Promise<void> {
    const [entry] = await migration<{ id: string }[]>`
      select id::text as id from profiles.advertiser_review_entries
       where account_id = ${accountId} and kind = ${entryKind}::profiles.review_entry_kind
         and state = 'open'`;
    if (entry === undefined) {
      throw new Error("no open entry to decide");
    }
    await migration`
      update profiles.advertiser_review_entries
         set state = 'rejected', decided_by_account_id = ${accountIdOf("agent", "a")},
             decided_at = now(), closed_at = now(), rejection_reason_code = ${reason},
             member_message = ${memberMessage}, internal_comment = ${INTERNAL_COMMENT}
       where id = ${entry.id}`;
    await migration`
      update profiles.profile_field_revisions set status = 'rejected', closed_at = now()
       where advertiser_review_entry_id = ${entry.id} and status = 'pending_review'`;
  }

  it("serves a refused submission with its reason and the text of the agent for `other` only, FR then EN, never the internal comment", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await patch(server, member, completeBody());
    expect(
      (await call(server, "POST", URL_SUBMIT, member.session)).statusCode,
    ).toBe(200);
    expect((await read(server, member)).refusal).toBeNull();

    const written =
      "Merci de préciser votre activité principale et vos produits.";
    await decide(member.accountId, "submission", "other", written);
    await migration`
      update profiles.advertiser_profiles set status = 'rejected'
       where account_id = ${member.accountId}`;
    const response = await call(server, "GET", URL_PROFILE, member.session);
    const refused = brandProfileResponseSchema.parse(response.json());
    expect(response.body).not.toContain(INTERNAL_COMMENT);
    expect(refused.status).toBe("rejected");
    expect(refused.refusal).toEqual({
      kind: "submission",
      reasonCode: "other",
      message: french.email.profileDecision.reason.other,
      memberMessage: written,
      fields: [],
      decidedAt: expect.any(String),
    });
    // the language of the account
    await migration`
      update identity.accounts set preferred_language = 'en' where id = ${member.accountId}`;
    expect((await read(server, member)).refusal?.message).toBe(
      english.email.profileDecision.reason.other,
    );
    // a typed reason carries its message, and no text of the agent even when one is stored
    await migration`
      update profiles.advertiser_review_entries
         set rejection_reason_code = 'logo_non_compliant'
       where account_id = ${member.accountId}`;
    expect((await read(server, member)).refusal).toMatchObject({
      reasonCode: "logo_non_compliant",
      message: english.email.profileDecision.reason.logo_non_compliant,
      memberMessage: null,
    });
    // the profile stays editable and a new submission gives way to the examination (RG10)
    expect(
      (await patch(server, member, { companySize: "1_10" })).statusCode,
    ).toBe(200);
    expect(
      (await call(server, "POST", URL_SUBMIT, member.session)).statusCode,
    ).toBe(200);
    expect((await read(server, member)).refusal).toBeNull();
  });

  it("serves the refusal of a revision: the profile stays published, the fields refused are named", async () => {
    const server = app();
    const member = await newPublishedMember(server);
    await patch(server, member, {
      presentation: `${"Présentation corrigée, contact par la plateforme uniquement. ".repeat(3)}Fin.`,
      primarySector: codes.sectors.at(-1),
    });
    await decide(
      member.accountId,
      "revision",
      "presentation_insufficient",
      null,
    );
    const refused = await read(server, member);
    expect(refused.status).toBe("published");
    expect(refused.presentation).toBe(PRESENTATION);
    expect(refused.pendingChanges).toEqual([]);
    expect(refused.refusal).toMatchObject({
      kind: "revision",
      reasonCode: "presentation_insufficient",
      message: french.email.profileDecision.reason.presentation_insufficient,
      memberMessage: null,
      fields: ["presentation", "primarySector"],
    });
    // a new proposal gives way to the examination
    await patch(server, member, { contactRole: "executive" });
    expect((await read(server, member)).refusal).toBeNull();
  });
});

describe("who may reach it (18 T14.1 to T14.4, 05 RG28)", () => {
  it("answers a creator, on all three routes, exactly as an address that does not exist (T14.3, T14.4)", async () => {
    const server = app();
    const creator = await newMember("creator");
    const unknown = await call(
      server,
      "GET",
      "/v1/me/brand-profile-nothing",
      creator.session,
    );
    const expected = errorBody(unknown);
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const [method, url, body] of [
      ["GET", URL_PROFILE, undefined],
      ["PATCH", URL_PROFILE, { companySize: "1_10" }],
      ["POST", URL_SUBMIT, undefined],
    ] as const) {
      const response = await call(server, method, url, creator.session, body);
      expect(errorBody(response), `${method} ${url}`).toEqual(expected);
    }
  });

  it("answers 401 without a session and 403 while the terms in force are not accepted", async () => {
    const server = app();
    expect((await call(server, "GET", URL_PROFILE, null)).statusCode).toBe(401);
    expect(
      (await call(server, "PATCH", URL_PROFILE, null, { companySize: "1_10" }))
        .statusCode,
    ).toBe(401);
    const member = await newMember("advertiser", { acceptTerms: false });
    for (const [method, url, body] of [
      ["GET", URL_PROFILE, undefined],
      ["PATCH", URL_PROFILE, { companySize: "1_10" }],
      ["POST", URL_SUBMIT, undefined],
    ] as const) {
      const response = await call(server, method, url, member.session, body);
      expect(errorBody(response), `${method} ${url}`).toMatchObject({
        status: 403,
        code: "terms_acceptance_required",
      });
    }
  });

  it("serves each brand its own profile only: no identifier in a path, none accepted in a body, no write reaches another (T14.1, T14.2)", async () => {
    const server = app();
    const first = await newMember("advertiser");
    const second = await newMember("advertiser");
    await patch(server, first, {
      companySize: "251_1000",
      topics: [codes.topics[0]],
    });
    await patch(server, second, { companySize: "1_10" });
    const other = await call(server, "PATCH", URL_PROFILE, second.session, {
      accountId: first.accountId,
      companySize: "51_250",
    });
    expect(other.statusCode).toBe(400);
    const byPath = await call(
      server,
      "GET",
      `${URL_PROFILE}/${first.accountId}`,
      second.session,
    );
    expect(errorBody(byPath)).toMatchObject({ status: 404, code: "not_found" });
    const mine = await read(server, first);
    const theirs = await read(server, second);
    expect(mine).toMatchObject({
      companySize: "251_1000",
      topics: [codes.topics[0]],
    });
    expect(theirs).toMatchObject({ companySize: "1_10", topics: [] });
    expect(JSON.stringify(theirs)).not.toContain(first.email);
    expect(JSON.stringify(theirs)).not.toContain(first.accountId);
  });
});

describe("C-1 (D60): nothing personal in the logs", () => {
  it("finds no name, address, presentation nor contact detail in any captured stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
