// L2G commit 08 — the submission of a creator profile and the regime of a published one through
// apps/api, on the local stack (docs/mvp/07 RG4, RG5, RG8 to RG10, RG16, RG90, CA7, CA9, CA48, CA49,
// CA51; 08 RG16; 18 T14; jalons/l2g/modele.md points 6, 7, 11): POST /v1/me/creator-profile/submit,
// PUT .../visibility, and the autosave and the network routes of a PUBLISHED profile. The accounts are
// COMMITTED by the migration role (random identifiers, disposable local stack); a publication or a
// refusal is a direct write (the decisions of 0244 belong to the backoffice, commit 11). Every log
// stream is searched BY VALUE (D60): no title, bio, handle nor address typed here.
// L2G-S1 the submission (CA7, CA9, the nominative list), L2G-S2 the refusal served (RG10, CA51),
// L2G-S3 a published profile: the texts wait, the rest is immediate (CA48, CA49), L2G-S4 the networks
// of a published profile (RG9), L2G-S5 the switch of RG8, L2G-S6 who may reach the routes (T14.3, T14.4).
import {
  CREATOR_REJECTION_NEXT_STEP_OF,
  creatorProfileResponseSchema,
  creatorNetworksResponseSchema,
  creatorVisibilityResponseSchema,
  submitCreatorProfileResponseSchema,
  type CreatorProfileResponse,
  type CreatorNetworksResponse,
} from "@influx/contracts/creator-profile";
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

let codes: {
  topics: string[];
  tones: string[];
  formats: { code: string }[];
};

const URL_PROFILE = "/v1/me/creator-profile";
const URL_SUBMIT = `${URL_PROFILE}/submit`;
const URL_VISIBILITY = `${URL_PROFILE}/visibility`;
const NETWORKS = `${URL_PROFILE}/networks`;

const HEADLINE = "Créatrice de tutoriels cuisine végétale du quotidien";
const BIO = `${"Je partage des recettes simples, de saison, pensées pour les familles pressées. ".repeat(2)}Chaque semaine, une vidéo et une fiche pratique.`;
const NEW_HEADLINE = "Cuisine végétale, recettes de saison et astuces";
const NEW_BIO = `${"Chaque semaine, une recette de saison, une astuce de rangement et un retour d'expérience. ".repeat(2)}Des formats courts, simples à refaire.`;
const SHORT_BIO =
  "Je cuisine végétal, de saison, pour les familles pressées.".repeat(2);

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; session: string };

async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2g-submit-${role}-${accountId}@example.test`;
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
    } else {
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
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE",
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

async function profileOf(
  server: Server,
  member: Member,
): Promise<CreatorProfileResponse> {
  const response = await call(server, "GET", URL_PROFILE, member.session);
  expect(response.statusCode, response.body).toBe(200);
  return creatorProfileResponseSchema.parse(response.json());
}

async function patch(
  server: Server,
  member: Member,
  body: unknown,
): Promise<LightMyRequestResponse> {
  return call(server, "PATCH", URL_PROFILE, member.session, body);
}

async function submit(
  server: Server,
  member: Member,
): Promise<LightMyRequestResponse> {
  return call(server, "POST", URL_SUBMIT, member.session);
}

function errorOf(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: {
      code: string;
      message: string;
      details?: { path: string; issue: string }[];
    };
  };
  return {
    status: response.statusCode,
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

/** The status and body of an error, without its request id (T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { status, code, message } = errorOf(response);
  return { status, code, message };
}

const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

/**
 * A creator holding every required field: blocks 1, 2 and 5 saved by the route, the main line with its
 * address, figures and main audience country (as the route of the profile tests write them), three
 * visuals deposited (pending, the deposit counts, RG88) and, when asked, an active « Compte vérifié ».
 * Returns the main line.
 */
async function completeCreator(
  server: Server,
  member: Member,
  options: { badge?: boolean; bio?: string } = {},
): Promise<string> {
  const handle = `l2g_${randomBytes(5).toString("hex")}`;
  watchedValues.push(handle);
  const saved = await patch(server, member, {
    headline: HEADLINE,
    bio: options.bio ?? BIO,
    primaryTopic: codes.topics[0],
    secondaryTopics: [codes.topics[1], codes.topics[2]],
    tones: [codes.tones[0]],
    publicationLanguages: ["fr", "en"],
    travelScope: "domestic",
    formats: [codes.formats[0]?.code, codes.formats[1]?.code],
    usageRights: [],
    maxExclusivity: "le_3m",
    availability: "lt_1m",
  });
  expect(saved.statusCode, saved.body).toBe(200);
  await migration`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, figures_measured_at)
    values (${member.accountId}, 'instagram', true, ${handle},
            ${`https://instagram.com/${handle}`}, 48000, 12, 30, now())`;
  const [line] = await migration<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts
     where account_id = ${member.accountId}`;
  const lineId = line?.id ?? "";
  await migration`
    insert into profiles.creator_audience_countries
      (social_account_id, account_id, slot, country_code, share_percent)
    values (${lineId}, ${member.accountId}, 0, 'FR', 70)`;
  for (let index = 0; index < 3; index += 1) {
    await migration`
      insert into profiles.portfolio_items
        (account_id, state, received_bytes, byte_size, width, height, checksum, exif_stripped,
         stored_at)
      values (${member.accountId}, 'pending', 1000, 900, 1080, 1350,
              ${sha(`${member.accountId}-${index}`)}, false, now())`;
  }
  if (options.badge ?? true) {
    await accountBadge(member.accountId, lineId);
  }
  return lineId;
}

/** An active « Compte vérifié » on `line`, written directly as the decision of 0224 would. */
async function accountBadge(account: string, line: string): Promise<void> {
  await grantBadge(account, line, await fileRequest(account, line));
}

/** The request of « Compte vérifié » filed and approved (a filed request counts in the score, RG87). */
async function fileRequest(account: string, line: string): Promise<string> {
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${account}, ${line}, 'instagram', 'account_verified', 'pending')
    returning id::text`;
  await migration`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  return request?.id ?? "";
}

async function grantBadge(
  account: string,
  line: string,
  requestId: string,
): Promise<void> {
  await migration`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    values (${account}, ${line}, 'instagram', ${requestId}, 'account_verified',
            ${agentA}, now(), 'public_profile', 'x')`;
}

/** The decision of 0244, written directly: published, the main line listed. */
async function publish(member: Member): Promise<void> {
  await migration`
    update profiles.creator_public_profiles set status = 'published', published_at = now()
     where account_id = ${member.accountId}`;
  await migration`
    update profiles.creator_public_networks set listed_at = now()
     where account_id = ${member.accountId}`;
}

async function statusOf(member: Member): Promise<string | undefined> {
  const [row] = await migration<{ status: string }[]>`
    select status::text as status from profiles.creator_public_profiles
     where account_id = ${member.accountId}`;
  return row?.status;
}

/** What a brand would read: the live row, never the typed revision. */
async function liveTexts(member: Member) {
  const [row] = await migration<
    { headline: string | null; bio: string | null }[]
  >`
    select headline, bio from profiles.creator_public_profiles
     where account_id = ${member.accountId}`;
  return row;
}

async function entriesOf(member: Member) {
  return migration<{ id: string; kind: string; state: string }[]>`
    select id::text, kind::text, state::text from profiles.creator_review_entries
     where account_id = ${member.accountId} order by created_at, id`;
}

async function pendingRevisions(member: Member) {
  return migration<
    { field_code: string; row_key: string | null; proposed: unknown }[]
  >`
    select field_code, row_key, proposed_value as proposed
      from profiles.creator_field_revisions
     where account_id = ${member.accountId} and status = 'pending_review'
     order by field_code, row_key`;
}

/** The refusal of the open entry, written as a decision of an agent would (0244). */
async function refuse(
  member: Member,
  reason: string,
  message: string | null,
  comment: string,
): Promise<void> {
  await migration`
    update profiles.creator_review_entries
       set state = 'rejected', decided_by_account_id = ${agentA}, decided_at = now(),
           rejection_reason_code = ${reason}, member_message = ${message},
           internal_comment = ${comment}, closed_at = now()
     where account_id = ${member.accountId} and state = 'open'`;
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
    formats: await migration<{ code: string }[]>`
      select code from reference.formats where retired_at is null order by code`,
  };
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  watchedValues.push(HEADLINE, NEW_HEADLINE, NEW_BIO, "@monpseudo");
});

afterAll(async () => {
  await closeDatabase(database);
});

describe("L2G-S1 POST …/submit: the nominative list, or the entry of queue 2 (07 RG4, RG90, CA7, CA9)", () => {
  it("names every required field still missing, the portfolio and the account last, and writes nothing", async () => {
    const server = app();
    const member = await newMember("creator");
    const response = await submit(server, member);
    expect(response.statusCode, response.body).toBe(200);
    const answer = submitCreatorProfileResponseSchema.parse(response.json());
    expect(answer.status).toBe("draft");
    // the order of the form, the same list as the profile reads (parity of the base and the domain)
    expect(answer.missing).toEqual(
      (await profileOf(server, member)).missingRequired,
    );
    expect(answer.missing.slice(-2)).toEqual(["portfolio", "accountVerified"]);
    expect(Object.keys(response.json() as object).sort()).toEqual([
      "missing",
      "status",
    ]);
    expect(await statusOf(member)).toBe("draft");
    expect(await entriesOf(member)).toEqual([]);
  });

  it("refuses a bio of 100 characters with the field named, the profile left as it was (CA9)", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member, { bio: SHORT_BIO.slice(0, 100) });
    expect(SHORT_BIO.slice(0, 100)).toHaveLength(100);
    const answer = submitCreatorProfileResponseSchema.parse(
      (await submit(server, member)).json(),
    );
    expect(answer).toEqual({ status: "draft", missing: ["bio"] });
    expect(await statusOf(member)).toBe("draft");
    expect(await entriesOf(member)).toEqual([]);
  });

  it("counts « Compte vérifié » in the list, never in the score (RG16, RG88)", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await completeCreator(server, member, { badge: false });
    // the request filed counts for 2 points (RG87); the badge it obtains counts for none
    const requestId = await fileRequest(member.accountId, line);
    const without = await profileOf(server, member);
    expect(without.missingRequired).toEqual(["accountVerified"]);
    await grantBadge(member.accountId, line, requestId);
    const withBadge = await profileOf(server, member);
    expect(withBadge.missingRequired).toEqual([]);
    expect(withBadge.completeness.score).toBe(without.completeness.score);
  });

  it("submits a complete profile whose bio holds an identifier: pending_review, signalled, never published (CA7)", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member, {
      bio: `${BIO} Retrouvez-moi sur @monpseudo pour la suite.`,
    });
    const response = await submit(server, member);
    expect(response.statusCode, response.body).toBe(200);
    expect(submitCreatorProfileResponseSchema.parse(response.json())).toEqual({
      status: "pending_review",
      missing: [],
    });
    expect(await statusOf(member)).toBe("pending_review");
    const entries = await entriesOf(member);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "submission", state: "open" });
    const profile = await profileOf(server, member);
    expect(profile.status).toBe("pending_review");
    expect(profile.warnings.map((warning) => warning.field)).toContain("bio");
    // the entry's identifier never leaves the API (T14)
    expect(response.body).not.toContain(entries[0]?.id ?? "unknown");
    // submitted again while waiting: nothing written
    const again = await submit(server, member);
    expect(submitCreatorProfileResponseSchema.parse(again.json())).toEqual({
      status: "pending_review",
      missing: [],
    });
    expect(await entriesOf(member)).toHaveLength(1);
    // the typed reason of the refusal exists, and the step the API serves is the catalogue's
    const catalogue = await migration<{ code: string; next_step: string }[]>`
      select code, next_step from profiles.creator_rejection_reasons`;
    expect(
      Object.fromEntries(catalogue.map((r) => [r.code, r.next_step])),
    ).toEqual(CREATOR_REJECTION_NEXT_STEP_OF);
  });

  it("leaves a published or a suspended profile to a decision of INFLUX alone: 409 (RG5)", async () => {
    const server = app();
    const published = await newMember("creator");
    await completeCreator(server, published);
    await publish(published);
    const refused = await submit(server, published);
    expect(errorOf(refused)).toMatchObject({ status: 409, code: "conflict" });
    expect(await statusOf(published)).toBe("published");
    const suspended = await newMember("creator");
    await completeCreator(server, suspended);
    await migration`
      update profiles.creator_public_profiles
         set status = 'suspended', published_at = null, is_searchable = false
       where account_id = ${suspended.accountId}`;
    expect(errorOf(await submit(server, suspended))).toMatchObject({
      status: 409,
      code: "conflict",
    });
    expect(await entriesOf(suspended)).toEqual([]);
  });
});

describe("L2G-S2 the refusal served to its owner (07 RG10, RG96, CA51)", () => {
  it("serves the reason and its step, then clears it once the profile is submitted again; never the agent nor the comment", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await submit(server, member);
    await refuse(member, "bio_insufficient", null, "COMMENT-INTERNE-L2G-08");
    await migration`
      update profiles.creator_public_profiles set status = 'rejected'
       where account_id = ${member.accountId}`;
    const refused = await call(server, "GET", URL_PROFILE, member.session);
    const profile = creatorProfileResponseSchema.parse(refused.json());
    expect(profile.status).toBe("rejected");
    expect(profile.refusal).toMatchObject({
      kind: "submission",
      reasonCode: "bio_insufficient",
      nextStep: "fix",
      memberMessage: null,
    });
    expect(refused.body).not.toContain("COMMENT-INTERNE-L2G-08");
    expect(refused.body).not.toContain(agentA);
    // modifiable, and submitted again without delay (RG10)
    expect(
      (await patch(server, member, { headline: NEW_HEADLINE })).statusCode,
    ).toBe(200);
    expect((await profileOf(server, member)).refusal).not.toBeNull();
    const again = await submit(server, member);
    expect(submitCreatorProfileResponseSchema.parse(again.json()).status).toBe(
      "pending_review",
    );
    expect((await profileOf(server, member)).refusal).toBeNull();
    expect((await entriesOf(member)).map((entry) => entry.state)).toEqual([
      "rejected",
      "open",
    ]);
  });

  it("serves the message of the reason `other`, and the contact step of the reasons that ask for it", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await submit(server, member);
    const message =
      "Votre profil renvoie vers une activité que nous ne pouvons pas accepter.";
    await refuse(member, "other", message, "interne");
    await migration`
      update profiles.creator_public_profiles set status = 'rejected'
       where account_id = ${member.accountId}`;
    expect((await profileOf(server, member)).refusal).toMatchObject({
      reasonCode: "other",
      nextStep: "contact",
      memberMessage: message,
    });
  });

  it("serves the refusal of a revision while the profile stays published with its validated version (CA48, CA51)", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await publish(member);
    expect((await patch(server, member, { bio: NEW_BIO })).statusCode).toBe(
      200,
    );
    await refuse(member, "identifier_in_text", null, "interne");
    await migration`
      update profiles.creator_field_revisions
         set status = 'rejected', closed_at = now()
       where account_id = ${member.accountId} and status = 'pending_review'`;
    const profile = await profileOf(server, member);
    expect(profile.status).toBe("published");
    expect(profile.refusal).toMatchObject({
      kind: "revision",
      reasonCode: "identifier_in_text",
      nextStep: "fix",
    });
    expect(profile.pendingRevisions).toEqual([]);
    expect(profile.bio).toBe(BIO);
  });
});

describe("L2G-S3 a published profile: the texts wait, the rest is immediate (07 RG9, CA48, CA49)", () => {
  it("keeps the validated bio and title served while the new ones wait for review, and answers them to their owner", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await publish(member);
    const response = await patch(server, member, {
      bio: NEW_BIO,
      headline: NEW_HEADLINE,
    });
    expect(response.statusCode, response.body).toBe(200);
    const saved = creatorProfileResponseSchema.parse(response.json());
    expect(saved.status).toBe("published");
    expect(saved.bio).toBe(NEW_BIO);
    expect(saved.headline).toBe(NEW_HEADLINE);
    expect(
      saved.pendingRevisions.map((pending) => pending.field).sort(),
    ).toEqual(["bio", "headline"]);
    // what a brand reads is untouched
    expect(await liveTexts(member)).toEqual({ headline: HEADLINE, bio: BIO });
    expect(await statusOf(member)).toBe("published");
    const entries = await entriesOf(member);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "revision", state: "open" });
    expect((await pendingRevisions(member)).map((r) => r.field_code)).toEqual([
      "creator.bio",
      "creator.headline",
    ]);
    // back to the validated bio: the revision withdrawn, nothing pending for it
    const back = creatorProfileResponseSchema.parse(
      (await patch(server, member, { bio: BIO })).json(),
    );
    expect(back.bio).toBe(BIO);
    expect(back.pendingRevisions).toEqual([
      { field: "headline", rowKey: null },
    ]);
    // a reading serves the same: the text typed, then the validated one
    const read = await profileOf(server, member);
    expect(read.headline).toBe(NEW_HEADLINE);
    expect(read.bio).toBe(BIO);
  });

  it("applies every other field at once, without any revision, and stores the score of the base (CA49)", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await completeCreator(server, member);
    await publish(member);
    const response = await patch(server, member, {
      tones: [codes.tones[1]],
      travelScope: "international",
      availability: "full",
    });
    expect(response.statusCode, response.body).toBe(200);
    const saved = creatorProfileResponseSchema.parse(response.json());
    expect(saved).toMatchObject({
      tones: [codes.tones[1]],
      travelScope: "international",
      availability: "full",
      pendingRevisions: [],
    });
    expect(await pendingRevisions(member)).toEqual([]);
    expect(await entriesOf(member)).toEqual([]);
    // the figures of the line too (07 RG9, CA49): no revision, the new figure stored
    const figures = await call(
      server,
      "POST",
      `${NETWORKS}/${line}/figures`,
      member.session,
      { followersCount: 52000, postsLast30Days: 14, avgCommentsPerPost: 33 },
    );
    expect(figures.statusCode, figures.body).toBe(200);
    const [stored] = await migration<{ followers_count: number }[]>`
      select followers_count from profiles.creator_social_accounts where id = ${line}`;
    expect(Number(stored?.followers_count)).toBe(52000);
    expect(await pendingRevisions(member)).toEqual([]);
    expect(await entriesOf(member)).toEqual([]);
  });

  it("refuses to empty the title or the bio of a published profile, the profile left as it was", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await publish(member);
    for (const field of ["headline", "bio"] as const) {
      const refused = await patch(server, member, { [field]: "  " });
      expect(errorOf(refused)).toMatchObject({
        status: 400,
        details: [{ path: field, issue: "required" }],
      });
    }
    expect(await pendingRevisions(member)).toEqual([]);
    expect(await liveTexts(member)).toEqual({ headline: HEADLINE, bio: BIO });
  });

  it("freezes a suspended profile on every write (L2DS-4)", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await completeCreator(server, member);
    await migration`
      update profiles.creator_public_profiles
         set status = 'suspended', published_at = null, is_searchable = false
       where account_id = ${member.accountId}`;
    for (const [method, url, body] of [
      ["PATCH", URL_PROFILE, { tones: [codes.tones[1]] }],
      ["PATCH", `${NETWORKS}/${line}`, { postsLast30Days: 2 }],
      ["PUT", URL_VISIBILITY, { isSearchable: true }],
    ] as const) {
      expect(
        errorOf(await call(server, method, url, member.session, body)),
        `${method} ${url}`,
      ).toMatchObject({ status: 409, code: "conflict" });
    }
    expect((await profileOf(server, member)).status).toBe("suspended");
  });
});

describe("L2G-S4 the networks of a published profile (07 RG9, modele point 6)", () => {
  it("saves a new line unlisted and asks for its listing; refuses it as the main one", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await publish(member);
    const handle = `tt_${randomBytes(4).toString("hex")}`;
    watchedValues.push(handle);
    const refusedMain = await call(server, "POST", NETWORKS, member.session, {
      networkCode: "tiktok",
      isPrimary: true,
      handle,
    });
    expect(errorOf(refusedMain)).toMatchObject({
      status: 409,
      code: "conflict",
    });
    const created = await call(server, "POST", NETWORKS, member.session, {
      networkCode: "tiktok",
      handle,
    });
    expect(created.statusCode, created.body).toBe(200);
    const answer: CreatorNetworksResponse = creatorNetworksResponseSchema.parse(
      created.json(),
    );
    expect(answer.lineId).not.toBeNull();
    const [listing] = await migration<{ listed: boolean }[]>`
      select exists (select 1 from profiles.creator_public_networks
                      where social_account_id = ${answer.lineId} and listed_at is not null) as listed`;
    expect(listing?.listed).toBe(false);
    expect(await pendingRevisions(member)).toEqual([
      expect.objectContaining({
        field_code: "creator.network_line",
        row_key: answer.lineId,
      }),
    ]);
    expect((await profileOf(server, member)).pendingRevisions).toEqual([
      { field: "network_line", rowKey: answer.lineId },
    ]);
  });

  it("holds the handle and the address of a listed line for review, the validated ones served", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await completeCreator(server, member, { badge: false });
    await publish(member);
    const [before] = await migration<{ handle: string; profile_url: string }[]>`
      select handle, profile_url from profiles.creator_social_accounts where id = ${line}`;
    const handle = `new_${randomBytes(4).toString("hex")}`;
    watchedValues.push(handle);
    const url = `https://www.instagram.com/${handle}`;
    watchedValues.push(url);
    const response = await call(
      server,
      "PATCH",
      `${NETWORKS}/${line}`,
      member.session,
      { handle, profileUrl: url, postsLast30Days: 20 },
    );
    expect(response.statusCode, response.body).toBe(200);
    const answer = creatorNetworksResponseSchema.parse(response.json());
    // the validated handle and address stay served; the figure typed is immediate (CA49)
    expect(answer.lines[0]).toMatchObject({
      handle: before?.handle,
      profileUrl: before?.profile_url,
      postsLast30Days: 20,
    });
    expect((await pendingRevisions(member)).map((r) => r.field_code)).toEqual([
      "creator.network_handle",
      "creator.network_url",
    ]);
    expect(
      (await profileOf(server, member)).pendingRevisions
        .map((pending) => pending.field)
        .sort(),
    ).toEqual(["network_handle", "network_url"]);
    // a listed line keeps both: neither can be emptied (RG16)
    const emptied = await call(
      server,
      "PATCH",
      `${NETWORKS}/${line}`,
      member.session,
      { handle: null },
    );
    expect(errorOf(emptied)).toMatchObject({
      status: 400,
      details: [{ path: "handle", issue: "required" }],
    });
  });

  it("applies at once the handle of a line holding an active « Compte vérifié »: queue 6 alone controls it", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await completeCreator(server, member, { badge: true });
    await publish(member);
    const handle = `ver_${randomBytes(4).toString("hex")}`;
    watchedValues.push(handle);
    const response = await call(
      server,
      "PATCH",
      `${NETWORKS}/${line}`,
      member.session,
      { handle },
    );
    expect(response.statusCode, response.body).toBe(200);
    const [after] = await migration<{ handle: string }[]>`
      select handle from profiles.creator_social_accounts where id = ${line}`;
    expect(after?.handle).toBe(handle);
    expect(await pendingRevisions(member)).toEqual([]);
  });
});

describe("L2G-S5 PUT …/visibility: the switch of RG8", () => {
  it("switches « visible dans la recherche » on a published profile and reads it back, nothing else moving", async () => {
    const server = app();
    const member = await newMember("creator");
    await completeCreator(server, member);
    await publish(member);
    expect((await profileOf(server, member)).isSearchable).toBe(true);
    const off = await call(server, "PUT", URL_VISIBILITY, member.session, {
      isSearchable: false,
    });
    expect(off.statusCode, off.body).toBe(200);
    expect(creatorVisibilityResponseSchema.parse(off.json())).toEqual({
      isSearchable: false,
    });
    const profile = await profileOf(server, member);
    expect(profile).toMatchObject({ isSearchable: false, status: "published" });
    expect(await entriesOf(member)).toEqual([]);
    const on = await call(server, "PUT", URL_VISIBILITY, member.session, {
      isSearchable: true,
    });
    expect(creatorVisibilityResponseSchema.parse(on.json())).toEqual({
      isSearchable: true,
    });
    // no register line, no lead event: a column the member writes himself (modele point 11)
    const [register] = await migration<{ total: number }[]>`
      select count(*)::int as total from audit.audit_events
       where subject_type = 'creator_profile' and subject_id = ${member.accountId}
         and event_type <> 'lead.updated'`;
    expect(register?.total).toBe(0);
  });

  it("refuses a body that is not exactly a boolean switch, and writes nothing", async () => {
    const server = app();
    const member = await newMember("creator");
    for (const body of [
      {},
      { isSearchable: "no" },
      { isSearchable: true, status: "published" },
    ]) {
      expect(
        (await call(server, "PUT", URL_VISIBILITY, member.session, body))
          .statusCode,
      ).toBe(400);
    }
    expect((await profileOf(server, member)).isSearchable).toBe(true);
  });
});

describe("L2G-S6 who may reach the routes (18 T14.1 to T14.4)", () => {
  it("answers a brand exactly as an address that does not exist (T14.3, T14.4), on each new route", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const creator = await newMember("creator");
    await completeCreator(server, creator);
    const unknown = await call(
      server,
      "GET",
      `${URL_PROFILE}/nothing-here`,
      brand.session,
    );
    const expected = errorBody(unknown);
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const [method, url, body] of [
      ["POST", URL_SUBMIT, undefined],
      ["PUT", URL_VISIBILITY, { isSearchable: false }],
      ["PATCH", URL_PROFILE, { headline: NEW_HEADLINE }],
    ] as const) {
      expect(
        errorBody(await call(server, method, url, brand.session, body)),
        `${method} ${url}`,
      ).toEqual(expected);
    }
    // the creator's profile did not move
    expect(await statusOf(creator)).toBe("draft");
    expect(await liveTexts(creator)).toEqual({ headline: HEADLINE, bio: BIO });
  });

  it("answers 401 without a session, and 403 to a creator whose terms are pending", async () => {
    const server = app();
    const pending = await newMember("creator", { acceptTerms: false });
    for (const [method, url, body] of [
      ["POST", URL_SUBMIT, undefined],
      ["PUT", URL_VISIBILITY, { isSearchable: false }],
    ] as const) {
      expect((await call(server, method, url, null, body)).statusCode).toBe(
        401,
      );
      expect(
        errorOf(await call(server, method, url, pending.session, body)),
      ).toMatchObject({ status: 403, code: "terms_acceptance_required" });
    }
    expect(await statusOf(pending)).toBe("draft");
    expect(await entriesOf(pending)).toEqual([]);
  });

  it("keeps every typed text out of the logs (D60)", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
