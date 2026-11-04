// L2B commit 07 — the brand profile routes on the local stack (docs/mvp/06 RG2, RG5, RG14, RG17,
// RG57 to RG61, CA1 to CA7, CA14; 18 T14.1 to T14.4; jalons/l2b): GET, PATCH and POST submit of
// /v1/me/brand-profile, through the pools of apps/api (member under influx_app, migrations 0202
// and 0203). The route accounts are COMMITTED by the migration role (random identifiers,
// disposable local stack, like TM1) with their sessions; their queue lines are removed after the
// file. The decisions of an agent (rejected, published) do not exist yet (L2C): those states are
// written by the migration role, as a decision would. Every log stream is searched BY VALUE
// (C-1, D60): no company name, presentation nor contact detail.
import {
  brandProfileResponseSchema,
  type BrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
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
import { migrationRole } from "./support.ts";

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
      // the profile is not edited either until INFLUX re-validates a change (EC-L2B-07-1)
      const edit = await patch(server, member, { companySize: "1_10" });
      expect(errorBody(edit), state).toMatchObject({
        status: 409,
        code: "conflict",
      });
      expect(await statusOf(member.accountId)).toBe(state);
    }
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
