// L2D commit 09 — the network lines, the figures and the audience of the creator profile on the local
// stack (docs/mvp/07 RG41 to RG61, RG113 to RG116, CA10 to CA12, CA18, CA26, CA27; 18 T14.1, T14.2;
// jalons/l2d): /v1/me/creator-profile/networks, through the pools of apps/api (member under
// influx_app, migrations 0216 to 0218). The route accounts are COMMITTED by the migration role
// (random identifiers, disposable local stack), like the profile route's. Every log stream AND the
// tables of `ops` are searched BY VALUE (C-1, D60): no handle, URL, pseudonym nor exact figure.
// N1 one line per network, a handle once per network (CA10, RG42), N2 one main line (CA11), N3 the URL
// of the network (CA12), N4 the figures are whole numbers from zero (RG46, RG116), N5 the date of the
// figures is the confirmation's alone and the history keeps every entry (CA18, EC-L2D-6, RG119),
// N6 the audience adds up to 100 at most (CA26, CA27), N7 the bands of the main line, for its owner
// (RG22), N8 the score and what is missing follow, N9 the line is the session's (T14.1, T14.2), N10 a
// frozen profile, a deletion.
import {
  creatorNetworksResponseSchema,
  type CreatorNetworksResponse,
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

const NETWORKS = "/v1/me/creator-profile/networks";

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; email: string; session: string };

async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2d-networks-${role}-${accountId}@example.test`;
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
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function call(
  server: Server,
  method: Method,
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

/** A call that must succeed, parsed. */
async function ok(
  response: LightMyRequestResponse,
): Promise<CreatorNetworksResponse> {
  expect(response.statusCode, response.body).toBe(200);
  return creatorNetworksResponseSchema.parse(response.json());
}

function lineOf(answer: CreatorNetworksResponse, id: string | null) {
  const line = answer.lines.find((candidate) => candidate.id === id);
  if (line === undefined) {
    throw new Error("the answer holds no such line");
  }
  return line;
}

/** Adds a line and returns its identifier with the whole answer. */
async function addLine(
  server: Server,
  member: Member,
  body: Record<string, unknown>,
): Promise<{ id: string; answer: CreatorNetworksResponse }> {
  const answer = await ok(
    await call(server, "POST", NETWORKS, member.session, body),
  );
  if (answer.lineId === null) {
    throw new Error("a created line answers its identifier");
  }
  return { id: answer.lineId, answer };
}

function read(server: Server, member: Member) {
  return call(server, "GET", NETWORKS, member.session).then(ok);
}

function patchLine(server: Server, member: Member, id: string, body: unknown) {
  return call(server, "PATCH", `${NETWORKS}/${id}`, member.session, body);
}

function confirm(server: Server, member: Member, id: string, body: unknown) {
  return call(
    server,
    "POST",
    `${NETWORKS}/${id}/figures`,
    member.session,
    body,
  );
}

function putAudience(
  server: Server,
  member: Member,
  id: string,
  body: unknown,
) {
  return call(
    server,
    "PUT",
    `${NETWORKS}/${id}/audience`,
    member.session,
    body,
  );
}

/** A handle nobody else typed, kept for the search of the logs. */
function freshHandle(tag: string): string {
  const handle = `${tag}_${randomBytes(5).toString("hex")}`;
  watchedValues.push(handle);
  return handle;
}

/** An address on the network's own host, kept for the search of the logs. */
function profileUrlOf(host: string, handle: string): string {
  const url = `https://www.${host}/${handle}`;
  watchedValues.push(url);
  return url;
}

const EMPTY_AUDIENCE = {
  mainCountry: null,
  otherCountries: [],
  ages: [],
  genders: [],
};

async function storedLines(accountId: string) {
  return migration<
    {
      id: string;
      network_code: string;
      is_primary: boolean;
      figures_source: string;
      figures_measured_at: Date | null;
    }[]
  >`
    select id::text, network_code, is_primary, figures_source, figures_measured_at
      from profiles.creator_social_accounts
     where account_id = ${accountId} order by created_at, id`;
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

describe("L2D-N1 one line per network, each with its own figures and date (07 RG41, RG42, CA10)", () => {
  it("reads an empty list for a new creator, then keeps two networks apart", async () => {
    const server = app();
    const member = await newMember("creator");
    const empty = await read(server, member);
    expect(empty.lines).toEqual([]);
    expect(empty.lineId).toBeNull();
    expect(empty.notices).toEqual([]);

    const first = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("ig"),
      followersCount: 48213907,
      postsLast30Days: 12,
      avgCommentsPerPost: 31,
    });
    const second = await addLine(server, member, {
      networkCode: "tiktok",
      handle: freshHandle("tt"),
      followersCount: 9100,
    });
    expect(second.answer.lines.map((line) => line.networkCode)).toEqual([
      "instagram",
      "tiktok",
    ]);
    const instagram = lineOf(second.answer, first.id);
    const tiktok = lineOf(second.answer, second.id);
    expect(instagram).toMatchObject({
      followersCount: 48213907,
      postsLast30Days: 12,
      avgCommentsPerPost: 31,
      figuresSource: "declared",
      figuresMeasuredAt: null,
    });
    expect(tiktok).toMatchObject({
      followersCount: 9100,
      postsLast30Days: null,
      figuresMeasuredAt: null,
    });
    // reading again gives the same lines
    expect((await read(server, member)).lines).toEqual(second.answer.lines);
  });

  it("refuses the same handle twice on one network, whatever its case, and accepts it on another or as a second account (RG42)", async () => {
    const server = app();
    const member = await newMember("creator");
    const handle = freshHandle("dup");
    await addLine(server, member, { networkCode: "instagram", handle });
    const twice = await call(server, "POST", NETWORKS, member.session, {
      networkCode: "instagram",
      handle: handle.toUpperCase(),
    });
    expect(twice.statusCode).toBe(400);
    expect(issuesOf(twice)).toEqual([{ path: "handle", issue: "duplicate" }]);
    expect(twice.body).not.toContain(handle);
    // the same handle on another network, a second account with another handle: allowed
    await addLine(server, member, { networkCode: "tiktok", handle });
    await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("second"),
    });
    expect((await read(server, member)).lines).toHaveLength(3);
    // another creator may type the same handle
    const other = await newMember("creator");
    await addLine(server, other, { networkCode: "instagram", handle });
  });

  it("trims a handle and a pseudonym, empties them on a blank, refuses a control character or an excess", async () => {
    const server = app();
    const member = await newMember("creator");
    const handle = freshHandle("trim");
    const pseudonym = `Pseudo-${randomBytes(4).toString("hex")}`;
    watchedValues.push(pseudonym);
    const { id } = await addLine(server, member, {
      networkCode: "youtube",
      handle: `  ${handle}  `,
      pseudonym: ` ${pseudonym} `,
    });
    let line = lineOf(await read(server, member), id);
    expect(line.handle).toBe(handle);
    expect(line.pseudonym).toBe(pseudonym);
    line = lineOf(
      await ok(await patchLine(server, member, id, { pseudonym: "   " })),
      id,
    );
    expect(line.pseudonym).toBeNull();
    for (const body of [
      { handle: "ligne\nbrisée" },
      { handle: "h".repeat(101) },
      { pseudonym: "p".repeat(61) },
    ]) {
      const refused = await patchLine(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(lineOf(await read(server, member), id).handle).toBe(handle);
  });

  it("refuses an unknown network, a network sent with an update, and a field the system owns", async () => {
    const server = app();
    const member = await newMember("creator");
    const unknown = await call(server, "POST", NETWORKS, member.session, {
      networkCode: "no_such_network",
    });
    expect(unknown.statusCode).toBe(400);
    expect(issuesOf(unknown)).toEqual([
      { path: "networkCode", issue: "unknown" },
    ]);
    const { id } = await addLine(server, member, { networkCode: "twitch" });
    for (const body of [
      { networkCode: "youtube" },
      { figuresSource: "agent_observed" },
      { figuresMeasuredAt: "2026-01-01T00:00:00.000Z" },
      { accountId: member.accountId },
      { id },
    ]) {
      const refused = await patchLine(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    const stored = await storedLines(member.accountId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      network_code: "twitch",
      figures_source: "declared",
      figures_measured_at: null,
    });
  });
});

describe("L2D-N2 exactly one main line: checking one unchecks the other, explicitly (07 RG41, CA11)", () => {
  it("answers both lines after the change, with the old one unchecked", async () => {
    const server = app();
    const member = await newMember("creator");
    const first = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("main1"),
      isPrimary: true,
    });
    expect(lineOf(first.answer, first.id).isPrimary).toBe(true);
    const second = await addLine(server, member, {
      networkCode: "tiktok",
      handle: freshHandle("main2"),
    });
    expect(lineOf(second.answer, second.id).isPrimary).toBe(false);
    const switched = await ok(
      await patchLine(server, member, second.id, { isPrimary: true }),
    );
    expect(lineOf(switched, first.id).isPrimary).toBe(false);
    expect(lineOf(switched, second.id).isPrimary).toBe(true);
    expect(switched.lines.filter((line) => line.isPrimary)).toHaveLength(1);
    const stored = await storedLines(member.accountId);
    expect(stored.filter((line) => line.is_primary).map((l) => l.id)).toEqual([
      second.id,
    ]);
    // a new line created as the main one takes the place too
    const third = await addLine(server, member, {
      networkCode: "youtube",
      handle: freshHandle("main3"),
      isPrimary: true,
    });
    expect(
      third.answer.lines.filter((line) => line.isPrimary).map((l) => l.id),
    ).toEqual([third.id]);
    // unchecking the main line leaves none, and nothing else takes its place
    const none = await ok(
      await patchLine(server, member, third.id, { isPrimary: false }),
    );
    expect(none.lines.some((line) => line.isPrimary)).toBe(false);
  });
});

describe("L2D-N3 the URL points to the declared network (07 RG43, CA12)", () => {
  it("refuses an Instagram line pointing to TikTok with the message of its own, on a creation and on an update", async () => {
    const server = app();
    const member = await newMember("creator");
    const handle = freshHandle("cross");
    const tiktokUrl = profileUrlOf("tiktok.com", handle);
    const refused = await call(server, "POST", NETWORKS, member.session, {
      networkCode: "instagram",
      handle,
      profileUrl: tiktokUrl,
    });
    expect(refused.statusCode).toBe(400);
    expect(issuesOf(refused)).toEqual([
      { path: "profileUrl", issue: "wrong_network" },
    ]);
    expect(refused.body).not.toContain(tiktokUrl);
    expect(await storedLines(member.accountId)).toEqual([]);

    const { id } = await addLine(server, member, {
      networkCode: "instagram",
      handle,
      profileUrl: profileUrlOf("instagram.com", handle),
    });
    const updated = await patchLine(server, member, id, {
      profileUrl: tiktokUrl,
    });
    expect(updated.statusCode).toBe(400);
    expect(issuesOf(updated)).toEqual([
      { path: "profileUrl", issue: "wrong_network" },
    ]);
  });

  it("accepts the host and its subdomains, refuses a clear text link, credentials and a lookalike host", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "youtube" });
    const handle = freshHandle("urls");
    const good = `https://m.youtube.com/@${handle}`;
    watchedValues.push(good);
    expect(
      lineOf(
        await ok(await patchLine(server, member, id, { profileUrl: good })),
        id,
      ).profileUrl,
    ).toBe(good);
    for (const [profileUrl, issue] of [
      [`http://www.youtube.com/@${handle}`, "invalid_shape"],
      [`https://user:secret@www.youtube.com/@${handle}`, "credentials"],
      [`https://notyoutube.com/@${handle}`, "wrong_network"],
      [`https://youtube.com.evil.example/@${handle}`, "wrong_network"],
      [`not a link ${handle}`, "invalid_shape"],
    ] as const) {
      const refused = await patchLine(server, member, id, { profileUrl });
      expect(refused.statusCode, profileUrl).toBe(400);
      expect(issuesOf(refused), profileUrl).toEqual([
        { path: "profileUrl", issue },
      ]);
    }
    // a blank link empties the field
    expect(
      lineOf(
        await ok(await patchLine(server, member, id, { profileUrl: " " })),
        id,
      ).profileUrl,
    ).toBeNull();
  });
});

describe("L2D-N4 the figures are whole numbers from zero (07 RG46, RG116)", () => {
  it("accepts zero everywhere and the edge of the engagement rate", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id, answer } = await addLine(server, member, {
      networkCode: "instagram",
      followersCount: 0,
      postsLast30Days: 0,
      avgCommentsPerPost: 0,
      avgReachPerPost: 0,
      engagementRateBp: 0,
    });
    expect(lineOf(answer, id)).toMatchObject({
      followersCount: 0,
      postsLast30Days: 0,
      avgCommentsPerPost: 0,
      avgReachPerPost: 0,
      engagementRateBp: 0,
    });
    const top = lineOf(
      await ok(
        await patchLine(server, member, id, { engagementRateBp: 10000 }),
      ),
      id,
    );
    expect(top.engagementRateBp).toBe(10000);
  });

  it("refuses a negative, a decimal, a text and a rate above 100 %, with the field named, on every route that takes a figure", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, {
      networkCode: "instagram",
      followersCount: 500,
    });
    for (const [body, path] of [
      [{ followersCount: -100 }, "followersCount"],
      [{ avgReachPerPost: -5 }, "avgReachPerPost"],
      [{ postsLast30Days: -3 }, "postsLast30Days"],
      [{ avgCommentsPerPost: 12.5 }, "avgCommentsPerPost"],
      [{ followersCount: 1000.5 }, "followersCount"],
      [{ followersCount: "12000" }, "followersCount"],
      [{ engagementRateBp: 25000 }, "engagementRateBp"],
      [{ engagementRateBp: -1 }, "engagementRateBp"],
      [{ engagementRateBp: 3.5 }, "engagementRateBp"],
    ] as const) {
      const refused = await patchLine(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
      expect(issuesOf(refused).map((issue) => issue.path)).toContain(path);
      const created = await call(server, "POST", NETWORKS, member.session, {
        networkCode: "tiktok",
        ...body,
      });
      expect(created.statusCode, JSON.stringify(body)).toBe(400);
    }
    for (const body of [
      { followersCount: -100, postsLast30Days: 1, avgCommentsPerPost: 1 },
      { followersCount: 1, postsLast30Days: -3, avgCommentsPerPost: 1 },
      { followersCount: 1, postsLast30Days: 1, avgCommentsPerPost: 12.5 },
    ]) {
      const refused = await confirm(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    const line = lineOf(await read(server, member), id);
    expect(line).toMatchObject({
      followersCount: 500,
      postsLast30Days: null,
      figuresMeasuredAt: null,
    });
  });
});

describe("L2D-N5 the date of the figures is the confirmation's alone (07 RG50, RG116, CA18, EC-L2D-6, RG119)", () => {
  it("leaves the date empty after a figure typed alone and asks for the confirmation", async () => {
    const server = app();
    const member = await newMember("creator");
    const created = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("fig"),
      isPrimary: true,
    });
    // a line with no figure asks nothing
    expect(created.answer.notices).toEqual([]);
    const typed = await ok(
      await patchLine(server, member, created.id, { followersCount: 12000 }),
    );
    expect(typed.notices).toEqual(["creatorProfile.figures.confirmAll"]);
    const line = lineOf(typed, created.id);
    expect(line.followersCount).toBe(12000);
    expect(line.figuresMeasuredAt).toBeNull();
    // a text of the line alone asks nothing
    const handleOnly = await ok(
      await patchLine(server, member, created.id, {
        pseudonym: `Alias-${randomBytes(4).toString("hex")}`,
      }),
    );
    expect(handleOnly.notices).toEqual([]);
    // the same figure again changes nothing, so asks nothing
    const same = await ok(
      await patchLine(server, member, created.id, { followersCount: 12000 }),
    );
    expect(same.notices).toEqual([]);
  });

  it("dates the three metrics together on the confirmation, and a figure changed alone after it keeps that date", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("conf"),
      isPrimary: true,
      followersCount: 12000,
    });
    const confirmed = await ok(
      await confirm(server, member, id, {
        followersCount: 12500,
        postsLast30Days: 14,
        avgCommentsPerPost: null,
      }),
    );
    expect(confirmed.notices).toEqual([]);
    expect(confirmed.lineId).toBe(id);
    const dated = lineOf(confirmed, id);
    expect(dated).toMatchObject({
      followersCount: 12500,
      postsLast30Days: 14,
      avgCommentsPerPost: null,
      figuresSource: "declared",
    });
    expect(dated.figuresMeasuredAt).not.toBeNull();

    // a figure changed alone: saved, the date is kept, the message is asked again
    const alone = await ok(
      await patchLine(server, member, id, { followersCount: 13000 }),
    );
    expect(alone.notices).toEqual(["creatorProfile.figures.confirmAll"]);
    expect(lineOf(alone, id)).toMatchObject({
      followersCount: 13000,
      figuresMeasuredAt: dated.figuresMeasuredAt,
      figuresSource: "declared",
    });

    // the history: the entries and the confirmation, in order, the confirmed ones marked
    const history = await migration<
      { followers_count: string | null; confirmed: boolean }[]
    >`
      select followers_count::text, confirmed
        from profiles.creator_network_metrics_history
       where social_account_id = ${id} order by id`;
    expect(history.map((row) => [row.followers_count, row.confirmed])).toEqual([
      ["12000", false],
      ["12500", true],
      ["13000", false],
    ]);

    // the next confirmation renews the date
    await new Promise((resolve) => setTimeout(resolve, 20));
    const again = await ok(
      await confirm(server, member, id, {
        followersCount: 13000,
        postsLast30Days: 14,
        avgCommentsPerPost: 40,
      }),
    );
    const renewed = lineOf(again, id).figuresMeasuredAt;
    expect(renewed).not.toBeNull();
    expect(Date.parse(renewed ?? "")).toBeGreaterThan(
      Date.parse(dated.figuresMeasuredAt ?? ""),
    );
  });

  it("never lets the source or the date be typed: the body of a confirmation holds the three metrics and nothing else", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    for (const body of [
      { followersCount: 1 },
      {
        followersCount: 1,
        postsLast30Days: 1,
        avgCommentsPerPost: 1,
        figuresMeasuredAt: "2020-01-01T00:00:00.000Z",
      },
      {
        followersCount: 1,
        postsLast30Days: 1,
        avgCommentsPerPost: 1,
        figuresSource: "agent_observed",
      },
    ]) {
      const refused = await confirm(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    const [stored] = await storedLines(member.accountId);
    expect(stored).toMatchObject({
      figures_source: "declared",
      figures_measured_at: null,
    });
  });
});

describe("L2D-N6 the audience adds up to 100 at most (07 RG56 to RG61, CA26, CA27)", () => {
  it("refuses 140 % on the countries, nothing written, and keeps the audience that was saved", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    const saved = await ok(
      await putAudience(server, member, id, {
        ...EMPTY_AUDIENCE,
        mainCountry: { code: "FR", share: 50 },
      }),
    );
    expect(lineOf(saved, id).audience.mainCountry).toEqual({
      code: "FR",
      share: 50,
    });
    const over = await putAudience(server, member, id, {
      ...EMPTY_AUDIENCE,
      mainCountry: { code: "FR", share: 60 },
      otherCountries: [
        { code: "BE", share: 40 },
        { code: "CH", share: 40 },
      ],
    });
    expect(over.statusCode).toBe(400);
    expect(issuesOf(over)).toEqual([
      { path: "countries", issue: "sum_exceeds_100" },
    ]);
    expect(lineOf(await read(server, member), id).audience).toMatchObject({
      mainCountry: { code: "FR", share: 50 },
      otherCountries: [],
    });
  });

  it("refuses an age or a gender dimension above 100 too, each with its own path", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    const over = await putAudience(server, member, id, {
      ...EMPTY_AUDIENCE,
      ages: [
        { code: "18_24", share: 70 },
        { code: "25_34", share: 70 },
      ],
      genders: [
        { code: "female", share: 90 },
        { code: "male", share: 30 },
      ],
    });
    expect(over.statusCode).toBe(400);
    expect(issuesOf(over)).toEqual([
      { path: "ages", issue: "sum_exceeds_100" },
      { path: "genders", issue: "sum_exceeds_100" },
    ]);
  });

  it("accepts 60 % and answers the rest as others, never completed (CA27); 100 % has no rest", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    const answer = await ok(
      await putAudience(server, member, id, {
        mainCountry: { code: "FR", share: 40 },
        otherCountries: [{ code: "BE", share: 20 }],
        ages: [{ code: "18_24", share: 60 }],
        genders: [
          { code: "female", share: 55 },
          { code: "male", share: 45 },
        ],
      }),
    );
    const line = lineOf(answer, id);
    expect(line.remainders).toEqual({ countries: 40, ages: 40, genders: 0 });
    expect(line.audience).toEqual({
      mainCountry: { code: "FR", share: 40 },
      otherCountries: [{ code: "BE", share: 20 }],
      ages: [{ code: "18_24", share: 60 }],
      genders: [
        { code: "female", share: 55 },
        { code: "male", share: 45 },
      ],
    });
    // what is stored is what was typed, no share was added to complete a dimension
    const [sum] = await migration<{ countries: string; ages: string }[]>`
      select (select sum(share_percent) from profiles.creator_audience_countries
               where social_account_id = ${id})::text as countries,
             (select sum(share_percent) from profiles.creator_audience_ages
               where social_account_id = ${id})::text as ages`;
    expect(sum).toEqual({ countries: "60", ages: "60" });
  });

  it("replaces the audience as a whole, and empties it on empty lists", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    await ok(
      await putAudience(server, member, id, {
        mainCountry: { code: "FR", share: 70 },
        otherCountries: [{ code: "BE", share: 10 }],
        ages: [{ code: "25_34", share: 50 }],
        genders: [{ code: "other", share: 5 }],
      }),
    );
    const replaced = await ok(
      await putAudience(server, member, id, {
        mainCountry: { code: "DE", share: null },
        otherCountries: [],
        ages: [{ code: "45_plus", share: 100 }],
        genders: [],
      }),
    );
    expect(lineOf(replaced, id).audience).toEqual({
      mainCountry: { code: "DE", share: null },
      otherCountries: [],
      ages: [{ code: "45_plus", share: 100 }],
      genders: [],
    });
    const cleared = await ok(
      await putAudience(server, member, id, EMPTY_AUDIENCE),
    );
    expect(lineOf(cleared, id).audience).toEqual(EMPTY_AUDIENCE);
    expect(lineOf(cleared, id).remainders).toEqual({
      countries: 100,
      ages: 100,
      genders: 100,
    });
  });

  it("refuses a decimal, a negative, an other country under 10 %, more than four others, a repeated or unknown code, others without a main country", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, { networkCode: "instagram" });
    const main = { code: "FR", share: 30 };
    for (const [body, expected] of [
      [{ ...EMPTY_AUDIENCE, mainCountry: { code: "FR", share: 33.5 } }, null],
      [{ ...EMPTY_AUDIENCE, mainCountry: { code: "FR", share: -1 } }, null],
      [{ ...EMPTY_AUDIENCE, mainCountry: { code: "FR", share: 101 } }, null],
      [
        {
          ...EMPTY_AUDIENCE,
          mainCountry: main,
          otherCountries: [{ code: "BE", share: 9 }],
        },
        null,
      ],
      [
        {
          ...EMPTY_AUDIENCE,
          mainCountry: { code: "FR", share: 10 },
          otherCountries: ["BE", "CH", "DE", "ES", "IT"].map((code) => ({
            code,
            share: 10,
          })),
        },
        null,
      ],
      [
        {
          ...EMPTY_AUDIENCE,
          mainCountry: main,
          otherCountries: [{ code: "FR", share: 20 }],
        },
        { path: "otherCountries", issue: "duplicate" },
      ],
      [
        { ...EMPTY_AUDIENCE, otherCountries: [{ code: "BE", share: 20 }] },
        { path: "mainCountry", issue: "required" },
      ],
      [
        { ...EMPTY_AUDIENCE, ages: [{ code: "no_such_band", share: 10 }] },
        { path: "ages", issue: "unknown" },
      ],
      [
        {
          ...EMPTY_AUDIENCE,
          ages: [
            { code: "18_24", share: 10 },
            { code: "18_24", share: 10 },
          ],
        },
        { path: "ages", issue: "duplicate" },
      ],
      [{ ...EMPTY_AUDIENCE, genders: [{ code: "robot", share: 10 }] }, null],
      [{ ...EMPTY_AUDIENCE, mainCountry: { code: "ZZ", share: 10 } }, null],
      [{ mainCountry: null }, null],
    ] as const) {
      const refused = await putAudience(server, member, id, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
      if (expected !== null) {
        expect(issuesOf(refused), JSON.stringify(body)).toContainEqual(
          expected,
        );
      }
    }
    expect(lineOf(await read(server, member), id).audience).toEqual(
      EMPTY_AUDIENCE,
    );
  });
});

describe("L2D-N7 the bands of the main line come back to its owner only (07 RG22, RG45, RG114, RG115)", () => {
  it("derives and returns the bands on the main line, none on the others, never an exact figure among them", async () => {
    const server = app();
    const member = await newMember("creator");
    const main = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("band"),
      isPrimary: true,
    });
    const side = await addLine(server, member, {
      networkCode: "tiktok",
      handle: freshHandle("side"),
      followersCount: 700000,
    });
    // before any figure the main line has a row of bands, all empty
    expect(lineOf(side.answer, main.id).bands).toEqual({
      audienceBand: null,
      reachBand: null,
      publicationFrequency: null,
      commentBand: null,
    });
    const confirmed = await ok(
      await confirm(server, member, main.id, {
        followersCount: 12000,
        postsLast30Days: 14,
        avgCommentsPerPost: 30,
      }),
    );
    const bands = lineOf(confirmed, main.id).bands;
    expect(bands).not.toBeNull();
    expect(bands?.audienceBand).toBe("micro");
    expect(bands?.publicationFrequency).not.toBeNull();
    expect(bands?.commentBand).not.toBeNull();
    // the other line carries none, whatever its figures
    expect(lineOf(confirmed, side.id).bands).toBeNull();
    // moving the main line to the other one moves the bands with it
    const moved = await ok(
      await patchLine(server, member, side.id, { isPrimary: true }),
    );
    expect(lineOf(moved, main.id).bands).toBeNull();
    expect(lineOf(moved, side.id).bands?.audienceBand).toBe("macro");
  });
});

describe("L2D-N8 the score and what is missing follow the lines (07 RG86 to RG90)", () => {
  it("recomputes and stores the score after every write, and shrinks the list of what is missing", async () => {
    const server = app();
    const member = await newMember("creator");
    const start = await read(server, member);
    expect(start.missingRequired).toEqual(
      expect.arrayContaining([
        "networkLines",
        "primaryAccount",
        "handle",
        "profileUrl",
        "followers",
        "figuresDate",
        "mainAudienceCountry",
        "mainAudienceShare",
      ]),
    );
    const scoreBefore = await storedScore(member.accountId);
    const handle = freshHandle("score");
    const { id, answer } = await addLine(server, member, {
      networkCode: "instagram",
      handle,
      profileUrl: profileUrlOf("instagram.com", handle),
      isPrimary: true,
      followersCount: 12000,
    });
    expect(answer.missingRequired).not.toContain("networkLines");
    expect(answer.missingRequired).not.toContain("primaryAccount");
    expect(answer.missingRequired).not.toContain("handle");
    expect(answer.missingRequired).not.toContain("profileUrl");
    expect(answer.missingRequired).not.toContain("followers");
    // the figures are typed but not confirmed: the date is still missing
    expect(answer.missingRequired).toContain("figuresDate");
    const confirmed = await ok(
      await confirm(server, member, id, {
        followersCount: 12000,
        postsLast30Days: null,
        avgCommentsPerPost: null,
      }),
    );
    expect(confirmed.missingRequired).not.toContain("figuresDate");
    const withAudience = await ok(
      await putAudience(server, member, id, {
        ...EMPTY_AUDIENCE,
        mainCountry: { code: "FR", share: 70 },
      }),
    );
    expect(withAudience.missingRequired).not.toContain("mainAudienceCountry");
    expect(withAudience.missingRequired).not.toContain("mainAudienceShare");
    expect(withAudience.completeness.score).toBeGreaterThan(
      start.completeness.score,
    );
    expect(await storedScore(member.accountId)).toBe(
      withAudience.completeness.score,
    );
    // the first read stored nothing: the score on the identity row is still the one of the creation
    expect(scoreBefore).toBe(0);
    // a read stores nothing and says the same
    const reread = await read(server, member);
    expect(reread.completeness).toEqual(withAudience.completeness);
    expect(reread.missingRequired).toEqual(withAudience.missingRequired);
    // taking the line away brings the missing fields back
    const removed = await ok(
      await call(server, "DELETE", `${NETWORKS}/${id}`, member.session),
    );
    expect(removed.missingRequired).toContain("networkLines");
    expect(await storedScore(member.accountId)).toBe(
      removed.completeness.score,
    );
  });
});

describe("L2D-N9 the line is the session's: who may reach the routes (18 T14.1, T14.2, T14.3, T14.4)", () => {
  it("answers a brand on all six routes exactly as an address that does not exist", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const creator = await newMember("creator");
    const { id } = await addLine(server, creator, { networkCode: "instagram" });
    const unknown = await call(
      server,
      "GET",
      "/v1/me/creator-profile/nothing-here",
      brand.session,
    );
    const expected = errorBody(unknown);
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    const audience = {
      ...EMPTY_AUDIENCE,
      mainCountry: { code: "FR", share: 1 },
    };
    const figures = {
      followersCount: 1,
      postsLast30Days: 1,
      avgCommentsPerPost: 1,
    };
    for (const [method, url, body] of [
      ["GET", NETWORKS, undefined],
      ["POST", NETWORKS, { networkCode: "instagram" }],
      ["PATCH", `${NETWORKS}/${id}`, { handle: "x_brand_try" }],
      ["DELETE", `${NETWORKS}/${id}`, undefined],
      ["POST", `${NETWORKS}/${id}/figures`, figures],
      ["PUT", `${NETWORKS}/${id}/audience`, audience],
    ] as const) {
      const response = await call(server, method, url, brand.session, body);
      expect(errorBody(response), `${method} ${url}`).toEqual(expected);
    }
    // nothing of the creator's line moved
    expect((await read(server, creator)).lines).toHaveLength(1);
  });

  it("answers 401 without a session, and 403 to a creator whose terms are pending", async () => {
    const server = app();
    const pending = await newMember("creator", { acceptTerms: false });
    for (const [method, url, body] of [
      ["GET", NETWORKS, undefined],
      ["POST", NETWORKS, { networkCode: "instagram" }],
    ] as const) {
      const anonymous = await call(server, method, url, null, body);
      expect(anonymous.statusCode, `${method} ${url}`).toBe(401);
      const gated = await call(server, method, url, pending.session, body);
      expect(gated.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it("answers the line of another creator, and a line that does not exist, with the same code and the same body, and writes nothing", async () => {
    const server = app();
    const owner = await newMember("creator");
    const intruder = await newMember("creator");
    const handle = freshHandle("owner");
    const { id } = await addLine(server, owner, {
      networkCode: "instagram",
      handle,
      isPrimary: true,
      followersCount: 4000,
    });
    await ok(
      await confirm(server, owner, id, {
        followersCount: 4000,
        postsLast30Days: 3,
        avgCommentsPerPost: 2,
      }),
    );
    const before = await storedLines(owner.accountId);
    const absent = randomUUID();
    const audience = {
      ...EMPTY_AUDIENCE,
      mainCountry: { code: "FR", share: 99 },
    };
    const figures = {
      followersCount: 1,
      postsLast30Days: 1,
      avgCommentsPerPost: 1,
    };
    const attempts = (target: string) =>
      [
        [
          "PATCH",
          `${NETWORKS}/${target}`,
          { followersCount: 1, isPrimary: false },
        ],
        ["DELETE", `${NETWORKS}/${target}`, undefined],
        ["POST", `${NETWORKS}/${target}/figures`, figures],
        ["PUT", `${NETWORKS}/${target}/audience`, audience],
      ] as const;
    for (const [index, [method, url, body]] of attempts(id).entries()) {
      const theirs = await call(server, method, url, intruder.session, body);
      const [, unknownUrl] = attempts(absent)[index] ?? [];
      const nobody = await call(
        server,
        method,
        unknownUrl ?? url,
        intruder.session,
        body,
      );
      expect(errorBody(theirs), `${method} ${url}`).toEqual(errorBody(nobody));
      expect(errorBody(theirs).status).toBe(404);
      expect(errorBody(theirs).code).toBe("not_found");
    }
    // the intruder reads none of it, and the line of the owner is as it was
    expect((await read(server, intruder)).lines).toEqual([]);
    expect(await storedLines(owner.accountId)).toEqual(before);
    const kept = lineOf(await read(server, owner), id);
    expect(kept).toMatchObject({
      followersCount: 4000,
      postsLast30Days: 3,
      isPrimary: true,
    });
    expect(kept.audience).toEqual(EMPTY_AUDIENCE);
    // no identifier goes in a body: the account and the line are the session's and the path's
    for (const body of [
      { networkCode: "tiktok", accountId: owner.accountId },
      { networkCode: "tiktok", id },
    ]) {
      const refused = await call(
        server,
        "POST",
        NETWORKS,
        intruder.session,
        body,
      );
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
    }
    // a malformed identifier is no line either
    const malformed = await call(
      server,
      "DELETE",
      `${NETWORKS}/not-a-line`,
      intruder.session,
    );
    expect(malformed.statusCode).toBeGreaterThanOrEqual(400);
    expect(malformed.statusCode).toBeLessThan(500);
    // the owner's response never carries the account
    expect(JSON.stringify(kept)).not.toContain(owner.accountId);
  });
});

describe("L2D-N10 a frozen profile, a deletion, and what stays of a deleted line", () => {
  it("refuses every write once the profile is out of the states a creator writes in, and still reads it", async () => {
    const server = app();
    const member = await newMember("creator");
    const { id } = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("freeze"),
    });
    await migration`
      update profiles.creator_public_profiles set status = 'suspended'
       where account_id = ${member.accountId}`;
    for (const [method, url, body] of [
      ["POST", NETWORKS, { networkCode: "tiktok" }],
      ["PATCH", `${NETWORKS}/${id}`, { followersCount: 5 }],
      ["DELETE", `${NETWORKS}/${id}`, undefined],
      [
        "POST",
        `${NETWORKS}/${id}/figures`,
        { followersCount: 1, postsLast30Days: 1, avgCommentsPerPost: 1 },
      ],
      ["PUT", `${NETWORKS}/${id}/audience`, EMPTY_AUDIENCE],
    ] as const) {
      const response = await call(server, method, url, member.session, body);
      expect(errorBody(response), `${method} ${url}`).toMatchObject({
        status: 409,
        code: "conflict",
      });
    }
    expect((await read(server, member)).lines).toHaveLength(1);
  });

  it("deletes a line with its audience and its bands, takes no other line as the main one, and answers 404 the second time", async () => {
    const server = app();
    const member = await newMember("creator");
    const main = await addLine(server, member, {
      networkCode: "instagram",
      handle: freshHandle("del1"),
      isPrimary: true,
      followersCount: 20000,
    });
    const other = await addLine(server, member, {
      networkCode: "tiktok",
      handle: freshHandle("del2"),
    });
    await ok(
      await putAudience(server, member, main.id, {
        ...EMPTY_AUDIENCE,
        mainCountry: { code: "FR", share: 60 },
        ages: [{ code: "18_24", share: 30 }],
        genders: [{ code: "female", share: 50 }],
      }),
    );
    const removed = await ok(
      await call(server, "DELETE", `${NETWORKS}/${main.id}`, member.session),
    );
    expect(removed.lineId).toBeNull();
    expect(removed.lines.map((line) => line.id)).toEqual([other.id]);
    expect(removed.lines.some((line) => line.isPrimary)).toBe(false);
    const [left] = await migration<
      { audience: string; networks: string; history: string }[]
    >`
      select (select count(*) from profiles.creator_audience_countries
               where social_account_id = ${main.id})::text
             || (select count(*) from profiles.creator_audience_ages
                  where social_account_id = ${main.id})::text
             || (select count(*) from profiles.creator_audience_genders
                  where social_account_id = ${main.id})::text as audience,
             (select count(*) from profiles.creator_public_networks
               where social_account_id = ${main.id})::text as networks,
             (select count(*) from profiles.creator_network_metrics_history
               where social_account_id = ${main.id})::text as history`;
    expect(left).toEqual({ audience: "000", networks: "0", history: "1" });
    const again = await call(
      server,
      "DELETE",
      `${NETWORKS}/${main.id}`,
      member.session,
    );
    expect(errorBody(again)).toMatchObject({ status: 404, code: "not_found" });
    // changing the network of a line is a deletion, then a new line
    const redone = await addLine(server, member, {
      networkCode: "youtube",
      handle: freshHandle("del3"),
      isPrimary: true,
    });
    expect(redone.answer.lines).toHaveLength(2);
  });
});

describe("C-1 (D60): nothing personal in the logs nor in `ops`", () => {
  it("finds no handle, URL, pseudonym, address nor exact figure in any captured stream or in the monitoring tables", async () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    watchedValues.push("48213907");
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
    const rows = await migration<{ row: string }[]>`
      select row_to_json(t)::text as row from ops.error_groups t
      union all select row_to_json(t)::text from ops.error_occurrences t
      union all select row_to_json(t)::text from ops.request_metrics t`;
    expect(
      valuesFoundIn(rows.map((row) => row.row).join("\n"), watchedValues),
    ).toEqual([]);
  });
});
