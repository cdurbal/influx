// L2G commit 09 — "ce que voit une marque", from the one public projection, through apps/api on the
// local stack (docs/mvp/07 RG16, RG81, RG84, RG102, RG104, CA4, CA47; 18 T1 (T1.5), T14, TM5.5;
// jalons/l2g/modele.md point 9; fiche L2G invariants 1, 12, 16): GET /v1/me/creator-profile/preview.
// The accounts are COMMITTED by the migration role (random identifiers, disposable local stack); a
// decision of an agent (a visual approved, a profile published) is a direct write, as 0244 would write
// it. Every log stream is searched BY VALUE (D60).
// L2G-P1 the visuals (TM5.5, RG81, RG84, CA47), L2G-P2 the "before" tab holds layer A alone (CA4,
// T1.5), L2G-P3 the "after" tab adds his own layer I, L2G-P4 the lines projected (listed), L2G-P5 who
// may reach the route (T14.3, T14.4).
import { creatorPreviewResponseSchema } from "@influx/contracts/creator-projection";
import type { CreatorPreviewResponse } from "@influx/contracts/creator-projection";
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
import { migrationRole, testDataSet } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
let termsInForce: { fr: string };
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];
const agentA = accountIdOf("agent", "a");

let codes: { topics: string[]; tones: string[]; formats: string[] };

const URL_PROFILE = "/v1/me/creator-profile";
const URL_PREVIEW = `${URL_PROFILE}/preview`;

const HEADLINE = "Créatrice de tutoriels cuisine végétale du quotidien";
const BIO = `${"Je partage des recettes simples, de saison, pensées pour les familles pressées. ".repeat(2)}Chaque semaine, une vidéo et une fiche pratique.`;

/** The keys of a line in layer A (07 RG102 « avant »): codes, bands, the source and date, the badges. */
const LAYER_A_LINE_KEYS = [
  "audienceBand",
  "badges",
  "commentBand",
  "engagementBand",
  "figuresMeasuredAt",
  "figuresSource",
  "isPrimary",
  "networkCode",
  "publicationFrequency",
  "reachBand",
];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; session: string };

async function newMember(
  role: "advertiser" | "creator",
  options: { storefront?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2g-preview-${role}-${accountId}@example.test`;
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
      await tx`
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    }
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
      select ${accountId}, p, true, 'signup_form', now() - interval '1 day'
        from unnest(array['marketing_email', 'commercial_prospection']::identity.consent_purpose[]) p`;
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsInForce.fr}, 'acceptance', 'signup', 'fr')`;
  });
  watchedValues.push(email);
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  return { accountId, session: token.toString("base64url") };
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
  method: "GET" | "PATCH",
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

async function preview(
  server: Server,
  member: Member,
): Promise<{ raw: string; body: CreatorPreviewResponse }> {
  const response = await call(server, "GET", URL_PREVIEW, member.session);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  return {
    raw: response.body,
    body: creatorPreviewResponseSchema.parse(response.json()),
  };
}

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

const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

/** The layer I of a creator, distinct per call: what the « before » tab must never hold. */
type Identity = {
  handle: string;
  url: string;
  firstName: string;
  lastName: string;
  city: string;
  followers: number;
};

/**
 * A creator with blocks 1, 2 and 5 saved by the route, his names and city, the main line with its
 * exact figures and audience, and an active « Compte vérifié » on it. Returns the main line.
 */
async function completeCreator(
  server: Server,
  member: Member,
): Promise<{ line: string; identity: Identity }> {
  const tag = randomBytes(5).toString("hex");
  const identity: Identity = {
    handle: `l2g_${tag}`,
    url: `https://instagram.com/l2g_${tag}`,
    firstName: `Camille${tag}`,
    lastName: `Durand${tag}`,
    city: `Rennes${tag}`,
    followers: 48731,
  };
  watchedValues.push(
    identity.handle,
    identity.url,
    identity.firstName,
    identity.lastName,
    identity.city,
  );
  const saved = await call(server, "PATCH", URL_PROFILE, member.session, {
    headline: HEADLINE,
    bio: BIO,
    primaryTopic: codes.topics[0],
    secondaryTopics: [codes.topics[1], codes.topics[2]],
    tones: [codes.tones[0]],
    publicationLanguages: ["fr", "en"],
    travelScope: "domestic",
    formats: [codes.formats[0], codes.formats[1]],
    usageRights: [],
    maxExclusivity: "le_3m",
    availability: "lt_1m",
  });
  expect(saved.statusCode, saved.body).toBe(200);
  await migration`
    insert into profiles.creator_identities (account_id, legal_first_name, legal_last_name, city)
    values (${member.accountId}, ${identity.firstName}, ${identity.lastName}, ${identity.city})
    on conflict (account_id) do update
      set legal_first_name = excluded.legal_first_name,
          legal_last_name = excluded.legal_last_name, city = excluded.city`;
  const line = await addLine(member, "instagram", true, identity);
  await migration`
    insert into profiles.creator_audience_countries
      (social_account_id, account_id, slot, country_code, share_percent)
    values (${line}, ${member.accountId}, 0, 'FR', 70)`;
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${member.accountId}, ${line}, 'instagram', 'account_verified', 'pending')
    returning id::text`;
  await migration`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  await migration`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    values (${member.accountId}, ${line}, 'instagram', ${request?.id ?? null}, 'account_verified',
            ${agentA}, now(), 'public_profile', ${identity.handle})`;
  return { line, identity };
}

async function addLine(
  member: Member,
  network: string,
  primary: boolean,
  identity: Pick<Identity, "handle" | "url" | "followers">,
): Promise<string> {
  const [row] = await migration<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, figures_measured_at)
    values (${member.accountId}, ${network}, ${primary}, ${identity.handle}, ${identity.url},
            ${identity.followers}, 12, 30, now())
    returning id::text`;
  return row?.id ?? "";
}

/** A visual stored (pending), at a place of the creator's order or none. */
async function deposit(
  member: Member,
  order: number | null,
  replaces: string | null = null,
): Promise<string> {
  const [row] = await migration<{ id: string }[]>`
    insert into profiles.portfolio_items
      (account_id, state, replaces_item_id, display_order, received_bytes, byte_size, width, height,
       checksum, exif_stripped, stored_at)
    values (${member.accountId}, 'pending', ${replaces}, ${order}, 1000, 900, 1080, 1350,
            ${sha(randomUUID())}, true, now())
    returning id::text`;
  return row?.id ?? "";
}

/** The decision of 0244 on a visual, written directly: approved by agent A, with its caption. */
async function approve(item: string, caption: string | null): Promise<void> {
  await migration`
    update profiles.portfolio_items
       set state = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           caption = ${caption}
     where id = ${item}`;
}

/** The decision of 0244 on the profile, written directly: published, its lines listed. */
async function publish(member: Member): Promise<void> {
  await migration`
    update profiles.creator_public_profiles set status = 'published', published_at = now()
     where account_id = ${member.accountId}`;
  await migration`
    update profiles.creator_public_networks set listed_at = now()
     where account_id = ${member.accountId}`;
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
  codes = {
    topics: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.topics where retired_at is null order by code`,
    ),
    tones: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.editorial_tones where retired_at is null order by code`,
    ),
    formats: codesOf(
      await migration<{ code: string }[]>`
        select code from reference.formats where retired_at is null order by code`,
    ),
  };
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  watchedValues.push(HEADLINE);
});

afterAll(async () => {
  await closeDatabase(database);
});

describe("L2G-P1 the visuals: approved alone, in the creator's order (TM5.5, RG81, RG84, CA47)", () => {
  it("shows no image while no visual is approved, three pending ones deposited (CA47, TM5.5)", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    const pending = [
      await deposit(member, 1),
      await deposit(member, 2),
      await deposit(member, 3),
    ];
    const { raw, body } = await preview(server, member);
    expect(body.published).toBe(false);
    expect(body.before.visuals).toEqual([]);
    expect(body.after.visuals).toEqual([]);
    for (const id of pending) {
      expect(raw).not.toContain(id);
    }
  });

  it("serves the approved ones in the creator's order, numbered 1 to n, a pending or refused one absent", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    const first = await deposit(member, 1);
    const waiting = await deposit(member, 2);
    const third = await deposit(member, 3);
    const refused = await deposit(member, 4);
    await approve(third, "Atelier de cuisine de saison");
    await approve(first, null);
    await migration`
      update profiles.portfolio_items
         set state = 'rejected', decided_by_account_id = ${agentA}, decided_at = now(),
             rejection_reason_code = 'watermark', display_order = null
       where id = ${refused}`;
    const { raw, body } = await preview(server, member);
    expect(body.before.visuals).toEqual([
      { id: first, order: 1, caption: null },
      { id: third, order: 2, caption: "Atelier de cuisine de saison" },
    ]);
    // the same projection on both tabs (RG104)
    expect(body.after.visuals).toEqual(body.before.visuals);
    expect(raw).not.toContain(waiting);
    expect(raw).not.toContain(refused);
  });

  it("keeps the approved visual served while its replacement waits, never the replacement (RG81, CA44)", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    const original = await deposit(member, 1);
    await approve(original, null);
    const replacement = await deposit(member, null, original);
    const { raw, body } = await preview(server, member);
    expect(body.before.visuals.map((visual) => visual.id)).toEqual([original]);
    expect(raw).not.toContain(replacement);
  });
});

describe("L2G-P2 the « before » tab holds layer A alone (07 RG102, CA4, 18 T1.5)", () => {
  it("serves bands, codes and badges, never a handle, URL, name, city, exact figure, score or key", async () => {
    const server = app();
    const member = await newMember("creator");
    const { line, identity } = await completeCreator(server, member);
    const item = await deposit(member, 1);
    await approve(item, "Recette de saison en vidéo");
    await publish(member);
    const { raw, body } = await preview(server, member);
    expect(body.published).toBe(true);
    const before = JSON.stringify(body.before);
    const [storefront] = await migration<
      { public_ref: string; alias: string }[]
    >`
      select public_ref::text, alias from profiles.creator_public_profiles
       where account_id = ${member.accountId}`;
    const [stored] = await migration<
      { object_key: string; checksum: string }[]
    >`
      select object_key, checksum from profiles.portfolio_items where id = ${item}`;
    expect(body.before.alias).toBe(storefront?.alias);
    for (const value of [
      identity.handle,
      identity.url,
      identity.firstName,
      identity.lastName,
      identity.city,
      String(identity.followers),
      line,
      member.accountId,
      storefront?.public_ref ?? "public_ref",
    ]) {
      expect(before, value).not.toContain(value);
    }
    // T1.5: no URL emitted, no object key, no checksum, on either tab
    for (const value of [
      stored?.object_key ?? "object_key",
      stored?.checksum ?? "checksum",
      "supabase",
      "/storage/",
    ]) {
      expect(raw, value).not.toContain(value);
    }
    expect(before).not.toMatch(/https?:/);
    const [network] = body.before.networks;
    expect(Object.keys(network ?? {}).sort()).toEqual(LAYER_A_LINE_KEYS);
    expect(network).toMatchObject({
      networkCode: "instagram",
      isPrimary: true,
      figuresSource: "declared",
      engagementBand: null,
    });
    expect(network?.badges.map((badge) => badge.level)).toEqual([
      "account_verified",
    ]);
    expect(body.before.mainAudienceCountry).toBe("FR");
    // no completeness, status, region, refused sectors nor price exists in the tab
    for (const key of [
      "completeness",
      "status",
      "residenceRegion",
      "refusedSectors",
      "publicRef",
    ]) {
      expect(Object.keys(body.before)).not.toContain(key);
    }
  });
});

describe("L2G-P3 the « after » tab adds his own layer I to the same lines (modele point 9)", () => {
  it("adds the handle, the URL, the declared exact figures and the exact audience of the main line", async () => {
    const server = app();
    const member = await newMember("creator");
    const { identity } = await completeCreator(server, member);
    await publish(member);
    const { body } = await preview(server, member);
    const [network] = body.after.networks;
    expect(network).toMatchObject({
      handle: identity.handle,
      profileUrl: identity.url,
      followersCount: identity.followers,
      postsLast30Days: 12,
      avgCommentsPerPost: 30,
      avgReachPerPost: null,
    });
    // layer A of the line unchanged under its layer I
    const layerA = Object.fromEntries(
      Object.entries(network ?? {}).filter(([key]) =>
        LAYER_A_LINE_KEYS.includes(key),
      ),
    );
    expect(layerA).toEqual(body.before.networks[0]);
    expect(body.after.audienceShares).toEqual([
      { dimension: "country", code: "FR", share: 70 },
    ]);
    // never the names nor the city: they are layer N, revealed to no brand (07 RG102)
    const after = JSON.stringify(body.after);
    for (const value of [
      identity.firstName,
      identity.lastName,
      identity.city,
    ]) {
      expect(after, value).not.toContain(value);
    }
  });

  it("serves no declared value as the exact figure of a line whose figures are observed (08 RG19, RG40)", async () => {
    const server = app();
    const member = await newMember("creator");
    const { line } = await completeCreator(server, member);
    await publish(member);
    await migration`
      update profiles.creator_public_networks
         set figures_source = 'agent_observed', figures_measured_at = now()
       where social_account_id = ${line}`;
    const { body } = await preview(server, member);
    const [network] = body.after.networks;
    expect(network?.figuresSource).toBe("agent_observed");
    expect(network).toMatchObject({
      followersCount: null,
      postsLast30Days: null,
      avgCommentsPerPost: null,
      avgReachPerPost: null,
    });
    expect(network?.handle).not.toBeNull();
  });
});

describe("L2G-P4 the lines projected: the listed ones (modele point 6)", () => {
  it("shows every line of a profile never published, the listed ones only once it is", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    const tiktok = {
      handle: `l2g_${randomBytes(5).toString("hex")}`,
      url: "https://www.tiktok.com/@l2g",
      followers: 9100,
    };
    watchedValues.push(tiktok.handle);
    await addLine(member, "tiktok", false, tiktok);
    const draft = await preview(server, member);
    expect(draft.body.before.networks.map((n) => n.networkCode)).toEqual([
      "instagram",
      "tiktok",
    ]);
    await publish(member);
    // a line added to a published profile waits for its listing (a revision network_line)
    const youtube = {
      handle: `l2g_${randomBytes(5).toString("hex")}`,
      url: "https://www.youtube.com/@l2g",
      followers: 2200,
    };
    watchedValues.push(youtube.handle);
    await addLine(member, "youtube", false, youtube);
    const published = await preview(server, member);
    expect(published.body.before.networks.map((n) => n.networkCode)).toEqual([
      "instagram",
      "tiktok",
    ]);
    expect(published.body.after.networks.map((n) => n.handle)).not.toContain(
      youtube.handle,
    );
    expect(published.raw).not.toContain(youtube.handle);
  });
});

describe("L2G-P5 who may reach the route (18 T14.1 to T14.4)", () => {
  it("answers a brand exactly as an address that does not exist (T14.3, T14.4)", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const creator = await newMember("creator");
    await completeCreator(server, creator);
    const expected = errorBody(
      await call(server, "GET", `${URL_PROFILE}/nothing-here`, brand.session),
    );
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    expect(
      errorBody(await call(server, "GET", URL_PREVIEW, brand.session)),
    ).toEqual(expected);
  });

  it("answers 401 without a session, and not_found to a creator holding no storefront", async () => {
    const server = app();
    expect((await call(server, "GET", URL_PREVIEW, null)).statusCode).toBe(401);
    const bare = await newMember("creator", { storefront: false });
    expect(
      errorBody(await call(server, "GET", URL_PREVIEW, bare.session)),
    ).toMatchObject({ status: 404, code: "not_found" });
  });

  it("keeps every typed text out of the logs (D60)", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(8);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
