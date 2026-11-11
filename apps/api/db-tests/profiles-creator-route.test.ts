// L2D commit 08 — the creator profile routes on the local stack (docs/mvp/07 RG1, RG2, RG14, RG16,
// RG23, RG27, RG28, RG33, RG34, RG73, RG86 to RG91, CA2; 18 T14.1 to T14.4; jalons/l2d): GET and PATCH
// of /v1/me/creator-profile, through the pools of apps/api (member under influx_app, migrations
// 0216 to 0218). The route accounts are COMMITTED by the migration role (random identifiers,
// disposable local stack, like the brand's) with their sessions. Every log stream is searched BY
// VALUE (C-1, D60): no headline, bio, identity field, nor the text a detection matched.
// L2D-A1 the read, L2D-A2 the partial autosave and the stored score, L2D-A3 closed lists and caps,
// L2D-A4 the non-blocking warnings (nothing stored), L2D-A5 the account is the session's.
import {
  creatorProfileResponseSchema,
  type CreatorProfileResponse,
} from "@influx/contracts/creator-profile";
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
import { migrationRole, testDataSet } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
let termsInForce: { fr: string };
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

/** Active codes of the reference lists, read once. */
let codes: {
  topics: string[];
  tones: string[];
  sectors: string[];
  formats: { code: string; networkCode: string | null }[];
  usageRights: string[];
  regionOfFrance: string | undefined;
};

const URL_PROFILE = "/v1/me/creator-profile";

const HEADLINE = "Créatrice de tutoriels cuisine végétale du quotidien";
const BIO = `${"Je partage des recettes simples, de saison, pensées pour les familles pressées. ".repeat(2)}Chaque semaine, une vidéo et une fiche pratique.`;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; email: string; session: string };

async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean; storefront?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2d-creator-${role}-${accountId}@example.test`;
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
    } else if (options.storefront ?? true) {
      // as identity.provision_account() does at sign-up (0216): the storefront, then its identity row
      await tx`
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (${accountId}, profiles.new_creator_alias(), 'FR')`;
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
  watchedValues.push(email);
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

async function read(
  server: Server,
  member: Member,
): Promise<CreatorProfileResponse> {
  const response = await call(server, "GET", URL_PROFILE, member.session);
  expect(response.statusCode).toBe(200);
  return creatorProfileResponseSchema.parse(response.json());
}

function patch(server: Server, member: Member, body: unknown) {
  return call(server, "PATCH", URL_PROFILE, member.session, body);
}

/** A PATCH that must succeed, parsed. */
async function save(
  server: Server,
  member: Member,
  body: unknown,
): Promise<CreatorProfileResponse> {
  const response = await patch(server, member, body);
  expect(response.statusCode, response.body).toBe(200);
  return creatorProfileResponseSchema.parse(response.json());
}

/** The status and body of an error, without its request id (T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: { code: string; message: string };
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

async function storedScore(accountId: string): Promise<number | undefined> {
  const [row] = await migration<{ score: number }[]>`
    select completeness_percent::int as score from profiles.creator_identities
     where account_id = ${accountId}`;
  return row?.score;
}

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const versions = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  const fr = versions[0];
  if (fr === undefined) {
    throw new Error(
      "no terms of service in force in French, WITH its text (run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = { fr: fr.id };
  const codesOf = (rows: { code: string }[]) => rows.map((row) => row.code);
  const [region] = await migration<{ code: string }[]>`
    select code from reference.regions
     where country_code = 'FR' and retired_at is null order by code limit 1`;
  codes = {
    topics: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.topics where retired_at is null order by code`,
    ),
    tones: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.editorial_tones where retired_at is null order by code`,
    ),
    sectors: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.sectors where retired_at is null order by code`,
    ),
    formats: (
      await migration<{ code: string; network_code: string | null }[]>`
        select code, network_code from reference.formats
         where retired_at is null order by code`
    ).map((row) => ({ code: row.code, networkCode: row.network_code })),
    usageRights: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.usage_rights
         where retired_at is null and code <> 'none' order by sort_order`,
    ),
    regionOfFrance: region?.code,
  };
  for (const [name, list] of Object.entries(codes)) {
    if (Array.isArray(list) && list.length < 3) {
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
});

/** Blocks 1, 2 and 5 filled as the form would send them. */
function completeBody() {
  return {
    headline: HEADLINE,
    bio: BIO,
    primaryTopic: codes.topics[0],
    secondaryTopics: [codes.topics[1], codes.topics[2]],
    tones: [codes.tones[0]],
    publicationLanguages: ["fr", "en"],
    travelScope: "domestic",
    formats: [codes.formats[0]?.code, codes.formats[1]?.code],
    usageRights: [{ code: codes.usageRights[0], inclusion: "included" }],
    maxExclusivity: "le_3m",
    availability: "lt_1m",
  };
}

describe("L2D-A1 GET /v1/me/creator-profile (07 RG1, RG2, RG86, RG90, CA2)", () => {
  it("answers a new creator its draft with the alias, pre-filled from the account, and what is missing in the order of the form", async () => {
    const server = app();
    const member = await newMember("creator");
    const response = await call(server, "GET", URL_PROFILE, member.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const profile = creatorProfileResponseSchema.parse(response.json());
    expect(profile.status).toBe("draft");
    expect(profile.alias).toMatch(/^[2-9BCDFGHJKLMNPQRSTVWXZ]{6}$/);
    expect(profile.residenceCountry).toBe("FR");
    expect(profile.preferredLanguage).toBe("fr");
    expect(profile.missingRequired).toEqual([
      "headline",
      "bio",
      "primaryTopic",
      "publicationLanguages",
      "networkLines",
      "primaryAccount",
      "handle",
      "profileUrl",
      "followers",
      "figuresDate",
      "mainAudienceCountry",
      "mainAudienceShare",
      "formats",
      "availability",
      // L2G 06, 08: required too (the visuals deposited, an active « Compte vérifié »)
      "portfolio",
      "accountVerified",
    ]);
    // the country of residence is the only point earned: 1 of the 100 reachable since L2G 06 (RG87, EC-L2D-5: every criterion is offered)
    expect(profile.completeness).toMatchObject({
      score: 1,
      earnedPoints: 1,
      attainablePoints: 100,
    });
    expect(profile.identity).toEqual({
      legalFirstName: null,
      legalLastName: null,
      contactEmail: null,
      contactPhone: null,
      addressLine: null,
      postalCode: null,
      city: null,
      addressCountry: null,
    });
    expect(profile.warnings).toEqual([]);
    expect(profile.acceptsNonMonetary).toBe(false);
    expect(profile.availabilityDeclaredAt).toBeNull();
  });

  it("lists the active codes of each reference list, never `none` among the usage rights, the network of each format", async () => {
    const server = app();
    const member = await newMember("creator");
    const { references } = await read(server, member);
    expect(references.topics).toEqual(codes.topics);
    expect(references.tones).toEqual(codes.tones);
    expect(references.sectors).toEqual(codes.sectors);
    expect(references.formats).toEqual(codes.formats);
    expect(
      references.formats.some((format) => format.networkCode === null),
    ).toBe(true);
    expect(references.usageRights).not.toContain("none");
    expect([...references.usageRights].sort()).toEqual(
      [...codes.usageRights].sort(),
    );
    expect(references.languages).toEqual(expect.arrayContaining(["fr", "en"]));
    expect(references.languages.length).toBeGreaterThan(100);
    expect(references.regions.length > 0).toBe(
      codes.regionOfFrance !== undefined,
    );
  });

  it("serves no storefront identifier: no account, no public reference, no band of the storefront (the switch of RG8 is his own, L2G 08)", async () => {
    const server = app();
    const member = await newMember("creator");
    await save(server, member, completeBody());
    const [storefront] = await migration<{ public_ref: string }[]>`
      select public_ref::text from profiles.creator_public_profiles
       where account_id = ${member.accountId}`;
    const raw = (await call(server, "GET", URL_PROFILE, member.session)).body;
    expect(raw).not.toContain(member.accountId);
    expect(raw).not.toContain(storefront?.public_ref ?? "no-reference");
    for (const key of [
      "accountId",
      "publicRef",
      "publishedAt",
      "audienceBand",
      "reachBand",
    ]) {
      expect(raw, key).not.toContain(`"${key}"`);
    }
  });

  it("reads a creator granted its role after the sign-up as an empty draft, which nothing can write into", async () => {
    const server = app();
    const member = await newMember("creator", { storefront: false });
    const profile = await read(server, member);
    expect(profile).toMatchObject({
      status: "draft",
      alias: null,
      residenceCountry: "FR",
      headline: null,
      secondaryTopics: [],
      completeness: { score: 1 },
    });
    const refused = await patch(server, member, { headline: HEADLINE });
    expect(errorBody(refused)).toMatchObject({ status: 409, code: "conflict" });
  });
});

describe("L2D-A2 PATCH /v1/me/creator-profile: partial autosave, merged, with the score stored (07 RG111, RG86)", () => {
  it("saves what is sent and leaves the rest, over several saves", async () => {
    const server = app();
    const member = await newMember("creator");
    watchedValues.push(HEADLINE, "Chaque semaine, une vidéo et une fiche");
    const first = await save(server, member, { headline: HEADLINE });
    expect(first.headline).toBe(HEADLINE);
    expect(first.bio).toBeNull();
    const second = await save(server, member, {
      bio: BIO,
      travelScope: "international",
      acceptsNonMonetary: true,
    });
    expect(second).toMatchObject({
      headline: HEADLINE,
      bio: BIO,
      travelScope: "international",
      acceptsNonMonetary: true,
    });
    const read1 = await read(server, member);
    expect(read1).toMatchObject({
      headline: HEADLINE,
      bio: BIO,
      travelScope: "international",
      acceptsNonMonetary: true,
      collaborationExperience: null,
    });
    // the score follows: the title 5, the bio 10, the travel 1, the country 1
    expect(read1.completeness.score).toBe(17);
    expect(await storedScore(member.accountId)).toBe(17);
  });

  it("recomputes the score at every save and stores it on the identity row, never on the storefront", async () => {
    const server = app();
    const member = await newMember("creator");
    const saved = await save(server, member, completeBody());
    // blocks 1 and 2: 5+10+5+2+2+3+1+1 = 29 · block 5: 8+3+3+2+1+2 = 19 · no network line yet
    expect(saved.completeness.score).toBe(48);
    // every criterion is offered since L2G 06 (the portfolio counts once deposited, RG88)
    expect(saved.completeness.attainablePoints).toBe(100);
    expect(saved.missingRequired).toEqual([
      "networkLines",
      "primaryAccount",
      "handle",
      "profileUrl",
      "followers",
      "figuresDate",
      "mainAudienceCountry",
      "mainAudienceShare",
      "portfolio",
      "accountVerified",
    ]);
    expect(await storedScore(member.accountId)).toBe(48);
    await save(server, member, { formats: [] });
    // the two offer lines and the formats go: 8+3+3 = 14 points
    expect(await storedScore(member.accountId)).toBe(34);
    const columns = await migration<{ column_name: string }[]>`
      select column_name::text from information_schema.columns
       where table_schema = 'profiles' and table_name = 'creator_public_profiles'
         and column_name like '%complete%'`;
    expect(columns).toEqual([]);
  });

  it("counts the network lines the creator already holds in the score and in what is missing (blocks 3 and 4 read, not written)", async () => {
    const server = app();
    const member = await newMember("creator");
    await migration`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, figures_measured_at)
      values (${member.accountId}, 'instagram', true, 'cuisine_verte_l2d',
              'https://instagram.com/cuisine_verte_l2d', 4321987, 8, 14, now())`;
    const [line] = await migration<{ id: string }[]>`
      select id::text from profiles.creator_social_accounts
       where account_id = ${member.accountId}`;
    await migration`
      insert into profiles.creator_audience_countries
        (social_account_id, account_id, slot, country_code, share_percent)
      values (${line?.id ?? ""}, ${member.accountId}, 0, 'FR', 70)`;
    const saved = await save(server, member, completeBody());
    // 48 + the first line 16 + the main audience country 10
    expect(saved.completeness.score).toBe(74);
    // blocks 1 to 5 are complete; the portfolio and the badge are the two left
    expect(saved.missingRequired).toEqual(["portfolio", "accountVerified"]);
    expect(await storedScore(member.accountId)).toBe(74);
    // the exact figures of the line are never part of the answer of the profile
    const raw = (await call(server, "GET", URL_PROFILE, member.session)).body;
    expect(raw).not.toContain("cuisine_verte_l2d");
    expect(raw).not.toContain("4321987");
  });

  it("removes the main topic from the secondary ones, whichever of the two is saved", async () => {
    const server = app();
    const member = await newMember("creator");
    const [a, b, c] = codes.topics;
    const first = await save(server, member, {
      primaryTopic: a,
      secondaryTopics: [a, b, c],
    });
    expect(first.secondaryTopics).toEqual([b, c]);
    const second = await save(server, member, { primaryTopic: b });
    expect(second.primaryTopic).toBe(b);
    expect(second.secondaryTopics).toEqual([c]);
    const third = await save(server, member, { secondaryTopics: [b, a] });
    expect(third.secondaryTopics).toEqual([a]);
  });

  it("replaces the lists as a whole, in the order given, and empties them on an empty list", async () => {
    const server = app();
    const member = await newMember("creator");
    const [r1, r2] = codes.usageRights;
    const first = await save(server, member, {
      tones: [codes.tones[1], codes.tones[0]],
      publicationLanguages: ["en", "fr", "de"],
      usageRights: [
        { code: r1, inclusion: "included" },
        { code: r2, inclusion: "optional" },
      ],
      refusedSectors: [codes.sectors[1], codes.sectors[0]],
    });
    expect(first.tones).toEqual([codes.tones[1], codes.tones[0]]);
    expect(first.publicationLanguages).toEqual(["en", "fr", "de"]);
    expect(first.usageRights).toEqual(
      expect.arrayContaining([
        { code: r1, inclusion: "included" },
        { code: r2, inclusion: "optional" },
      ]),
    );
    expect([...first.refusedSectors].sort()).toEqual(
      [codes.sectors[0], codes.sectors[1]].sort(),
    );
    const second = await save(server, member, {
      tones: [],
      publicationLanguages: ["fr"],
      usageRights: [{ code: r1, inclusion: "optional" }],
      refusedSectors: [],
    });
    expect(second.tones).toEqual([]);
    expect(second.publicationLanguages).toEqual(["fr"]);
    expect(second.usageRights).toEqual([{ code: r1, inclusion: "optional" }]);
    expect(second.refusedSectors).toEqual([]);
  });

  it("keeps the declared availability dated by the system, and empties a value on null (RG74)", async () => {
    const server = app();
    const member = await newMember("creator");
    const declared = await save(server, member, { availability: "lt_2w" });
    expect(declared.availability).toBe("lt_2w");
    expect(declared.availabilityDeclaredAt).not.toBeNull();
    const emptied = await save(server, member, {
      availability: null,
      headline: null,
    });
    expect(emptied.availability).toBeNull();
    expect(emptied.headline).toBeNull();
  });

  it("empties a text that is only margins and trims the others", async () => {
    const server = app();
    const member = await newMember("creator");
    await save(server, member, { headline: HEADLINE });
    const blank = await save(server, member, { headline: "   " });
    expect(blank.headline).toBeNull();
    const trimmed = await save(server, member, { bio: `  ${BIO}\n ` });
    expect(trimmed.bio).toBe(BIO);
    const kept = await save(server, member, { bio: "Une ligne.\nUne autre." });
    expect(kept.bio).toBe("Une ligne.\nUne autre.");
  });

  it("keeps the identifying fields of the creator for the creator alone (layer N): saved, emptied, blank read as empty", async () => {
    const server = app();
    const member = await newMember("creator");
    const identity = {
      legalFirstName: "Camille",
      legalLastName: "Durandière-Zz",
      contactEmail: "Camille.Contact.L2D@Example.test",
      contactPhone: "+33612345678",
      addressLine: "12 rue des Lilas",
      postalCode: "75011",
      city: "Paris",
      addressCountry: "FR",
    };
    watchedValues.push(
      identity.legalFirstName,
      identity.legalLastName,
      identity.contactEmail.toLowerCase(),
      identity.contactPhone,
      identity.addressLine,
    );
    const saved = await save(server, member, { identity });
    expect(saved.identity).toEqual({
      ...identity,
      contactEmail: "camille.contact.l2d@example.test",
    });
    const partial = await save(server, member, {
      identity: { city: "  ", contactPhone: null },
    });
    expect(partial.identity).toMatchObject({
      legalFirstName: "Camille",
      city: null,
      contactPhone: null,
    });
    // the storefront never holds them
    const [storefront] = await migration<{ row: string }[]>`
      select to_jsonb(p)::text as row from profiles.creator_public_profiles p
       where account_id = ${member.accountId}`;
    expect(storefront?.row).not.toContain("Camille");
    expect(storefront?.row).not.toContain("Paris");
  });

  it("never lets the system's fields be written: alias, status, visibility, bands, account, country, language, price", async () => {
    const server = app();
    const member = await newMember("creator");
    const before = await read(server, member);
    for (const body of [
      { alias: "ZZZZZZ" },
      { status: "published" },
      { isSearchable: false },
      { publishedAt: "2026-11-06T10:00:00.000Z" },
      { publicRef: randomUUID() },
      { accountId: randomUUID() },
      { residenceCountry: "BE" },
      { preferredLanguage: "en" },
      { audienceBand: "macro" },
      { availabilityDeclaredAt: "2026-11-06T10:00:00.000Z" },
      { completeness: 100 },
      { rate: 1000 },
      { price: 1000 },
      { currency: "EUR" },
      {},
    ]) {
      const response = await patch(server, member, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(errorBody(response).code).toBe("validation_failed");
    }
    const after = await read(server, member);
    expect(after).toEqual(before);
    expect(after.status).toBe("draft");
    const [row] = await migration<{ status: string; alias: string }[]>`
      select status::text as status, alias from profiles.creator_public_profiles
       where account_id = ${member.accountId}`;
    expect(row).toEqual({ status: "draft", alias: before.alias });
  });

  it("freezes the profile outside the states a creator writes in, and still reads it (a published one has the regime of RG9, L2G 08)", async () => {
    const server = app();
    const member = await newMember("creator");
    await save(server, member, { headline: HEADLINE });
    for (const status of ["suspended"]) {
      await migration`
        update profiles.creator_public_profiles set status = ${status}::profiles.creator_profile_status
         where account_id = ${member.accountId}`;
      const refused = await patch(server, member, { travelScope: "none" });
      expect(errorBody(refused), status).toMatchObject({
        status: 409,
        code: "conflict",
      });
      expect((await read(server, member)).headline).toBe(HEADLINE);
    }
    await migration`
      update profiles.creator_public_profiles set status = 'rejected'
       where account_id = ${member.accountId}`;
    expect(
      (await save(server, member, { travelScope: "none" })).travelScope,
    ).toBe("none");
  });

  it("accepts a region of the country of residence and refuses another country's", async () => {
    const server = app();
    const member = await newMember("creator");
    const refused = await patch(server, member, {
      residenceRegion: "BE-BRU",
    });
    expect(refused.statusCode).toBe(400);
    expect(issuesOf(refused)).toEqual([
      { path: "residenceRegion", issue: "unknown" },
    ]);
    if (codes.regionOfFrance !== undefined) {
      const saved = await save(server, member, {
        residenceRegion: codes.regionOfFrance,
      });
      expect(saved.residenceRegion).toBe(codes.regionOfFrance);
      const emptied = await save(server, member, { residenceRegion: null });
      expect(emptied.residenceRegion).toBeNull();
    }
  });
});

describe("L2D-A3 closed lists, caps and shapes: refused with the field named, nothing written (07 RG14, RG25, RG26, RG33, RG34, RG73)", () => {
  it("refuses a code outside the active lists, one issue per field, never the value", async () => {
    const server = app();
    const member = await newMember("creator");
    const refused = await patch(server, member, {
      primaryTopic: "no_such_topic",
      secondaryTopics: ["another_unknown"],
      tones: ["unknown_tone"],
      publicationLanguages: ["zz"],
      formats: ["unknown_format"],
      refusedSectors: ["unknown_sector"],
      usageRights: [{ code: "unknown_right", inclusion: "included" }],
    });
    expect(refused.statusCode).toBe(400);
    expect(errorBody(refused).code).toBe("validation_failed");
    expect(issuesOf(refused)).toEqual([
      { path: "primaryTopic", issue: "unknown" },
      { path: "secondaryTopics", issue: "unknown" },
      { path: "tones", issue: "unknown" },
      { path: "publicationLanguages", issue: "unknown" },
      { path: "formats", issue: "unknown" },
      { path: "usageRights", issue: "unknown" },
      { path: "refusedSectors", issue: "unknown" },
    ]);
    expect(refused.body).not.toContain("no_such_topic");
    expect((await read(server, member)).primaryTopic).toBeNull();
  });

  it("refuses more than three secondary topics, two tones, five languages, a repeated choice", async () => {
    const server = app();
    const member = await newMember("creator");
    const [t0, t1, t2] = codes.topics;
    expect(codes.topics.length).toBeGreaterThanOrEqual(4);
    for (const body of [
      { secondaryTopics: [...codes.topics.slice(0, 4)] },
      { tones: codes.tones.slice(0, 3) },
      { publicationLanguages: ["fr", "en", "de", "es", "it", "pt"] },
      { secondaryTopics: [t0, t0] },
      { tones: [codes.tones[0], codes.tones[0]] },
      { refusedSectors: [codes.sectors[0], codes.sectors[0]] },
      { formats: [codes.formats[0]?.code, codes.formats[0]?.code] },
    ]) {
      const response = await patch(server, member, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(errorBody(response).code).toBe("validation_failed");
    }
    // three secondary topics, two tones, five languages: at the cap, accepted
    const saved = await save(server, member, {
      primaryTopic: codes.topics[3] ?? t2,
      secondaryTopics: [t0, t1, t2],
      tones: codes.tones.slice(0, 2),
      publicationLanguages: ["fr", "en", "de", "es", "it"],
    });
    expect(saved.secondaryTopics).toHaveLength(3);
    expect(saved.tones).toHaveLength(2);
    expect(saved.publicationLanguages).toHaveLength(5);
  });

  it("refuses `none` as a usage right, a right both included and optional, and an unknown inclusion", async () => {
    const server = app();
    const member = await newMember("creator");
    const [right] = codes.usageRights;
    for (const usageRights of [
      [{ code: "none", inclusion: "included" }],
      [{ code: "none", inclusion: "optional" }],
      [
        { code: right, inclusion: "included" },
        { code: right, inclusion: "optional" },
      ],
      [{ code: right, inclusion: "maybe" }],
    ]) {
      const response = await patch(server, member, { usageRights });
      expect(response.statusCode, JSON.stringify(usageRights)).toBe(400);
      expect(errorBody(response).code).toBe("validation_failed");
    }
    expect((await read(server, member)).usageRights).toEqual([]);
  });

  it("refuses a title over 120 characters, a bio over 800, a control character, a bad band, a bad address", async () => {
    const server = app();
    const member = await newMember("creator");
    for (const body of [
      { headline: "x".repeat(121) },
      { headline: "Titre\nsur deux lignes" },
      { bio: "y".repeat(801) },
      { bio: "Un texte avec une tabulation\tinterdite" },
      { travelScope: "worldwide" },
      { availability: "tomorrow" },
      { maxExclusivity: "forever" },
      { deliveryLead: "instant" },
      { collaborationExperience: "many" },
      { acceptsNonMonetary: "yes" },
      { identity: { contactEmail: "not-an-address" } },
      { identity: { contactPhone: "0612345678" } },
      { identity: { postalCode: "--" } },
      { identity: {} },
    ]) {
      const response = await patch(server, member, body);
      expect(response.statusCode, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(errorBody(response).code).toBe("validation_failed");
    }
    // a title of exactly 120 characters and a bio of exactly 800 are accepted
    const edge = await save(server, member, {
      headline: "h".repeat(120),
      bio: "b".repeat(800),
    });
    expect(edge.headline).toHaveLength(120);
    expect(edge.bio).toHaveLength(800);
  });

  it("saves a title or a bio below the minimum, as a draft in progress: it counts for nothing and is listed as missing", async () => {
    const server = app();
    const member = await newMember("creator");
    const saved = await save(server, member, {
      headline: "Court",
      bio: "Trop court encore.",
    });
    expect(saved).toMatchObject({
      headline: "Court",
      bio: "Trop court encore.",
    });
    expect(saved.missingRequired.slice(0, 2)).toEqual(["headline", "bio"]);
    expect(saved.completeness.score).toBe(1);
  });

  it("answers a failed save without a trace of the failed values (nothing written by a refused body)", async () => {
    const server = app();
    const member = await newMember("creator");
    await save(server, member, { headline: HEADLINE });
    const refused = await patch(server, member, {
      headline: "Nouveau titre refusé",
      tones: codes.tones.slice(0, 3),
    });
    expect(refused.statusCode).toBe(400);
    expect((await read(server, member)).headline).toBe(HEADLINE);
  });
});

describe("L2D-A4 the detection of an identifying element is a warning: its type and place, never stored (07 RG27, RG28)", () => {
  it("warns of a handle, an address and a link in the two texts, with their places only", async () => {
    const server = app();
    const member = await newMember("creator");
    const headline = "Cuisine végétale par @cuisine_verte_zz chaque semaine";
    const bio = `${"Des recettes de saison pour toute la famille, simples et rapides. ".repeat(2)}Écrivez-moi : contact.zz@example.test ou https://exemple-zz.fr/moi`;
    watchedValues.push(
      "@cuisine_verte_zz",
      "contact.zz@example.test",
      "exemple-zz.fr",
    );
    const saved = await save(server, member, { headline, bio });
    // the texts are saved as they were typed: the detection signals and never blocks (RG27)
    expect(saved.headline).toBe(headline);
    expect(saved.bio).toBe(bio);
    const signals = saved.warnings.map((warning) => [
      warning.field,
      warning.signal,
    ]);
    expect(signals).toEqual(
      expect.arrayContaining([
        ["headline", "handle"],
        ["bio", "email"],
        ["bio", "url"],
      ]),
    );
    for (const warning of saved.warnings) {
      expect(Object.keys(warning).sort()).toEqual([
        "end",
        "field",
        "signal",
        "start",
      ]);
    }
    const handle = saved.warnings.find(
      (warning) => warning.signal === "handle",
    );
    expect(handle?.start).toBe(headline.indexOf("@cuisine_verte_zz"));
    expect(handle?.end).toBe(
      headline.indexOf("@cuisine_verte_zz") + "@cuisine_verte_zz".length,
    );
    // the same warnings on the next read: computed, not remembered
    expect((await read(server, member)).warnings).toEqual(saved.warnings);
  });

  it("stores no detection: the profile tables hold no warning, and a text without any element warns of nothing", async () => {
    const server = app();
    const member = await newMember("creator");
    const clean = await save(server, member, { headline: HEADLINE, bio: BIO });
    expect(clean.warnings).toEqual([]);
    const tables = await migration<
      { table_name: string; column_name: string }[]
    >`
      select table_name::text, column_name::text from information_schema.columns
       where table_schema = 'profiles' and table_name like 'creator\\_%'
         and (column_name ilike '%warning%' or column_name ilike '%detect%'
              or column_name ilike '%signal%')`;
    expect(tables).toEqual([]);
  });
});

describe("L2D-A5 the account is the session's: who may reach the routes (18 T14.1 to T14.4, 07 RG1)", () => {
  it("answers a brand, on both routes, exactly as an address that does not exist (T14.3, T14.4)", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const unknown = await call(
      server,
      "GET",
      "/v1/me/creator-profile-nothing",
      brand.session,
    );
    const expected = errorBody(unknown);
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const [method, body] of [
      ["GET", undefined],
      ["PATCH", { headline: HEADLINE }],
    ] as const) {
      const response = await call(
        server,
        method,
        URL_PROFILE,
        brand.session,
        body,
      );
      expect(errorBody(response), method).toEqual(expected);
    }
  });

  it("answers a brand whose terms are pending as unknown too, a creator whose terms are pending 403", async () => {
    const server = app();
    const brand = await newMember("advertiser", { acceptTerms: false });
    expect(
      errorBody(await call(server, "GET", URL_PROFILE, brand.session)),
    ).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    const creator = await newMember("creator", { acceptTerms: false });
    for (const [method, body] of [
      ["GET", undefined],
      ["PATCH", { headline: HEADLINE }],
    ] as const) {
      const response = await call(
        server,
        method,
        URL_PROFILE,
        creator.session,
        body,
      );
      expect(errorBody(response), method).toMatchObject({
        status: 403,
        code: "terms_acceptance_required",
      });
    }
  });

  it("answers 401 without a session", async () => {
    const server = app();
    expect((await call(server, "GET", URL_PROFILE, null)).statusCode).toBe(401);
    expect(
      (await call(server, "PATCH", URL_PROFILE, null, { headline: HEADLINE }))
        .statusCode,
    ).toBe(401);
  });

  it("serves each creator its own profile only: no identifier in a path, none accepted in a body, no write reaches another (T14.1, T14.2)", async () => {
    const server = app();
    const first = await newMember("creator");
    const second = await newMember("creator");
    await save(server, first, {
      headline: HEADLINE,
      identity: { legalFirstName: "Prénom-Premier-Zz" },
    });
    await save(server, second, { travelScope: "none" });
    const other = await call(server, "PATCH", URL_PROFILE, second.session, {
      accountId: first.accountId,
      headline: "Pris à un autre compte",
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
    expect(mine.headline).toBe(HEADLINE);
    expect(theirs).toMatchObject({ headline: null, travelScope: "none" });
    expect(mine.alias).not.toBe(theirs.alias);
    expect(JSON.stringify(theirs)).not.toContain("Prénom-Premier-Zz");
    expect(JSON.stringify(theirs)).not.toContain(first.email);
    expect(JSON.stringify(theirs)).not.toContain(first.accountId);
  });
});

describe("C-1 (D60): nothing personal in the logs", () => {
  it("finds no title, bio, identity field nor matched element in any captured stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
