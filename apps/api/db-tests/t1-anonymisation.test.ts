// T1 — anonymisation end to end, on the raw payload (docs/mvp/18 T1; jalons/l2d commit 10; 03 P5,
// D46). Not a list of expected fields: every route the server registers is CALLED, and the
// serialised body and headers of each answer are searched BY VALUE for the markers of a creator
// (07 RG16 layers I and N), so that an unforeseen field, a forgotten nested object, a talkative
// error or a header is caught as well.
//   T1.2  the inventory is the server's own: its onRoute hook (src/server.ts, routeInventoryOf),
//         checked against Fastify's route tree; nothing is written by hand, only /health is left out.
//   T1.1  every route, called as a brand on the web surface, with synthesised parameters (the
//         creator's own identifiers among them) and bodies valid or not: no marker.
//   T1.4  the error answers too: 400 and 404 of that sweep, and a 500 provoked on every route by a
//         database whose every call fails with an error carrying the markers.
//   T1.6  before the reveal: a creator sweeping every route meets no marker of another creator and
//         no contact detail of a brand; a brand meets no contact detail of another brand.
//   T1.3  adapted (EC-L2D-3): the creator's own reads DO carry the markers (the routes work and
//         the base holds them), but the account identifier.
//   T1-W  witness: a route added to the server that leaks makes the sweep fail.
//   C-1   every log stream of the file, the provoked failures included, holds no marker (D60).
//   L2E   (commit 17) the markers of the verification join every sweep: the handle the agent typed,
//         the figures he observed, the code of the creator; the registered name, the registration
//         number and the domain code of the brand (fiche L2E invariants 13, 14, 17). Requests and
//         codes go through the members' routes, the decisions through the agent's functions of 0224
//         (a committed transaction of the local superuser, as apps/api calls them), the piece is a row
//         (its bytes are T9.6's, db-tests/t9-evidence-unreachable).
// Deferred: T1.5 (signed URL of the portfolio) and the agent's identified view at L2G, which replays
// this file; T1.3 and the "after" of T1.6 (a revealed introduction) at Lot 4. The rights side of the
// same rule (influx_advertiser reaches no `creator_%` object, non reversible) is T1-R, in
// profiles-creator-identity.test.ts.
// Fixtures are COMMITTED by the migration role or through the routes (random identifiers,
// disposable local stack, like the profile routes' files); the brands leave the queue after the
// file. GoTrue, Brevo and Storage are doubles that answer "unavailable": nothing leaves the process.
import { accountIdOf, localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import type { ConnectionPool } from "../src/db/pool.ts";
import type { TransactionalSender } from "../src/platform/brevo-transactional.ts";
import type { ObjectStore } from "../src/platform/storage.ts";
import type { SupabaseAuth } from "../src/platform/supabase.ts";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import {
  buildServer,
  routeInventoryOf,
  type InventoriedRoute,
} from "../src/server.ts";
import {
  captureLogs,
  registeredRoutes,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import {
  actAsInternal,
  letterName,
  localSuperuser,
  retireBrandFixtures,
  sharedMigrationRole,
  testDataSet,
} from "./support.ts";
import { requestsOf, type Method } from "./route-requests.ts";

const PROFILE = "/v1/me/creator-profile";
const NETWORKS = "/v1/me/creator-profile/networks";
const VERIFICATION = "/v1/me/verification";
const BRAND_VERIFICATION = "/v1/me/brand-verification";
const HEALTH = "GET /health";
const agentA = accountIdOf("agent", "a");

let database: ApiDatabase;
let migration: postgres.Sql;
let termsInForce: string;

type Marker = { name: string; value: string };
type Member = { accountId: string; email: string };

/** Creator A: every identifying field filled through the routes (07 RG16, layers I and N). */
let creator: Member & {
  lineId: string;
  publicRef: string;
  markers: Marker[];
};
/** Brand M: a contact person filled (06 RG35), never served to a creator (D46). */
let brand: Member & { markers: Marker[] };
/**
 * L2E: what the verification wrote of creator A and brand M. Never served to another member; the
 * brand reads its own internal block and live code (positive control), the creator read its code
 * once, at the opening of its request; the finding of the agent is served to no member at all.
 */
let verificationMarkers: { creator: Marker[]; brand: Marker[] };

/** Every marker of both parties, the verification's included. */
function allMarkers(): Marker[] {
  return [
    ...creator.markers,
    ...brand.markers,
    ...verificationMarkers.creator,
    ...verificationMarkers.brand,
  ];
}
/** The brand that sweeps (T1.1), and the creator that sweeps (T1.6). */
let sweepingBrand: Member;
let sweepingCreator: Member;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

async function newMember(role: "advertiser" | "creator"): Promise<Member> {
  const accountId = randomUUID();
  const email = `t1-${role}-${hex(6)}@example.test`;
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
        values (${accountId}, ${`Maison ${letterName(hex(4))}`})`;
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
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsInForce}, 'acceptance', 'signup', 'fr')`;
  });
  return { accountId, email };
}

/** A fresh member session: a route of the sweep may end the one it was given (logout). */
async function newSession(accountId: string): Promise<string> {
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  return token.toString("base64url");
}

// ---------------------------------------------------------------------------------------------
// Doubles: nothing leaves the process
// ---------------------------------------------------------------------------------------------

const GOTRUE_UNAVAILABLE = {
  ok: false,
  reason: "unavailable",
  errorCode: null,
  status: null,
} as const;

/** Every GoTrue call answers "unavailable" (no user is created, no code is generated). */
const supabaseAuth = new Proxy(
  {},
  {
    get: (_target, key) =>
      key === "then" ? undefined : async () => GOTRUE_UNAVAILABLE,
  },
) as SupabaseAuth;

const sender: TransactionalSender = {
  send: async () => ({ status: "unavailable" }),
};

const store: ObjectStore = {
  write: async () => ({ ok: true, value: null }),
  read: async () => ({ ok: true, value: null }),
  remove: async () => ({ ok: true, value: null }),
};

/** Every log stream of the file, searched at the end (C-1, D60). */
const logStreams: (() => string)[] = [];

function app(over: ApiDatabase = database) {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database: over,
    identity: { supabaseAuth, sender },
    storage: store,
  });
}

type Server = ReturnType<typeof app>;
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
      origin: WEB_ORIGIN,
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

/** A call through the routes that must succeed: the fixtures are written by the doors themselves. */
async function through(
  server: Server,
  member: Member,
  method: Method,
  url: string,
  body?: unknown,
): Promise<unknown> {
  const response = await call(
    server,
    method,
    url,
    await newSession(member.accountId),
    body,
  );
  expect(response.statusCode, `${method} ${url}: ${response.body}`).toBe(200);
  return response.json();
}

function routeName(route: InventoriedRoute): string {
  return `${route.method} ${route.url}`;
}

/** The inventory of a server, /health left out (it belongs to no surface, and serves no data). */
async function sweptRoutes(server: Server): Promise<InventoriedRoute[]> {
  await server.ready();
  return routeInventoryOf(server).filter(
    (route) => routeName(route) !== HEALTH,
  );
}

type SweepResult = {
  /** `METHOD /path (status): marker` for every marker found; empty when nothing leaked. */
  findings: string[];
  /** Status codes seen, per route model. */
  statuses: Map<string, number[]>;
  calls: number;
};

/**
 * Calls every route of the inventory as `caller` (a fresh session per call, null for none), and
 * searches the serialised body and headers of every answer for each marker, in every form a value
 * may take on the way (raw, JSON-escaped, percent-encoded, base64).
 */
async function sweep(
  server: Server,
  caller: Member | null,
  ids: readonly string[],
  markers: readonly Marker[],
): Promise<SweepResult> {
  const findings: string[] = [];
  const statuses = new Map<string, number[]>();
  let calls = 0;
  for (const route of await sweptRoutes(server)) {
    const seen: number[] = [];
    statuses.set(routeName(route), seen);
    for (const request of requestsOf(route, ids)) {
      const session =
        caller === null ? null : await newSession(caller.accountId);
      const response = await call(
        server,
        request.method,
        request.url,
        session,
        request.body,
      );
      calls += 1;
      seen.push(response.statusCode);
      const raw = `${response.body}\n${JSON.stringify(response.headers)}`;
      for (const marker of markers) {
        if (valuesFoundIn(raw, [marker.value]).length > 0) {
          findings.push(
            `${routeName(route)} (${response.statusCode}): ${marker.name}`,
          );
        }
      }
    }
  }
  return { findings, statuses, calls };
}

function statusesOf(result: SweepResult): number[] {
  return [...result.statuses.values()].flat();
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

beforeAll(async () => {
  migration = sharedMigrationRole();
  await testDataSet();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const [fr] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  if (fr === undefined) {
    throw new Error(
      "no terms of service in force in French, WITH its text (run db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = fr.id;
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  const server = app();

  // Creator A, through the routes: identity (N), one main network line (I), figures confirmed.
  const a = await newMember("creator");
  const tag = hex(5);
  const handle = `pseudo_t1_${tag}`;
  const pseudonym = `PseudoT1-${letterName(hex(3))}`;
  const profileUrl = `https://www.instagram.com/${handle}`;
  const legalFirstName = `Marie-${letterName(hex(3))}`;
  const legalLastName = `Dupont-${letterName(hex(4))}`;
  const contactEmail = `t1-contact-${hex(5)}@example.test`;
  const contactPhone = `+3361${String(randomInt(1_000_000, 9_999_999))}`;
  const followers = randomInt(41_000_000, 49_999_999);
  await through(server, a, "PATCH", PROFILE, {
    headline: "Cuisine végétale du quotidien pour les familles",
    identity: {
      legalFirstName,
      legalLastName,
      contactEmail,
      contactPhone,
      city: "Lyon",
      addressCountry: "FR",
    },
  });
  const created = (await through(server, a, "POST", NETWORKS, {
    networkCode: "instagram",
    handle,
    pseudonym,
    profileUrl,
    isPrimary: true,
    followersCount: followers,
  })) as { lineId: string | null };
  const lineId = created.lineId ?? "";
  expect(lineId).not.toBe("");
  await through(server, a, "POST", `${NETWORKS}/${lineId}/figures`, {
    followersCount: followers,
    postsLast30Days: 12,
    avgCommentsPerPost: 31,
  });
  const [storefront] = await migration<{ public_ref: string }[]>`
    select public_ref::text from profiles.creator_public_profiles
     where account_id = ${a.accountId}`;
  creator = {
    ...a,
    lineId,
    publicRef: storefront?.public_ref ?? "",
    // the seven markers of 18 T1 (the file of origin waits for the portfolio, L2G), then four more
    markers: [
      { name: "pseudo (handle)", value: handle },
      { name: "network URL", value: profileUrl },
      { name: "legal last name", value: legalLastName },
      { name: "contact e-mail", value: contactEmail },
      { name: "phone", value: contactPhone },
      { name: "account identifier", value: a.accountId },
      { name: "exact follower count", value: String(followers) },
      { name: "pseudonym", value: pseudonym },
      { name: "legal first name", value: legalFirstName },
      { name: "sign-in e-mail", value: a.email },
      { name: "network line identifier", value: lineId },
    ],
  };

  // Brand M, with a contact person (06 RG35).
  const m = await newMember("advertiser");
  const brandEmail = `t1-brand-contact-${hex(5)}@example.test`;
  const brandPhone = `+3362${String(randomInt(1_000_000, 9_999_999))}`;
  const brandPage = `https://www.example.test/contact-${hex(5)}`;
  await through(server, m, "PATCH", "/v1/me/brand-profile", {
    contactRole: "marketing",
    contact: {
      firstName: "Camille",
      email: brandEmail,
      phone: brandPhone,
      url: brandPage,
    },
  });
  brand = {
    ...m,
    markers: [
      { name: "brand contact e-mail", value: brandEmail },
      { name: "brand contact phone", value: brandPhone },
      { name: "brand contact page", value: brandPage },
      { name: "brand sign-in e-mail", value: m.email },
      { name: "brand account identifier", value: m.accountId },
    ],
  };

  verificationMarkers = await verificationFixtures(server, tag);

  sweepingBrand = await newMember("advertiser");
  sweepingCreator = await newMember("creator");
});

type OwnRequest = {
  request: { id: string; code: { code: string } | null };
};

/** The UTC date `days` days from today, as the agent types it. */
function utcDay(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Agent A claims `request` and decides it through the functions of 0224, in a COMMITTED transaction
 * of the local superuser taking the agent's role the way apps/api does (aal2).
 */
async function agentDecides(
  request: string,
  decision: string,
  parameters: (token: string) => (string | number | null)[],
): Promise<void> {
  await localSuperuser().begin((tx) =>
    actAsInternal(
      tx,
      "influx_agent",
      { accountId: agentA, role: "agent", aal: "aal2" },
      async () => {
        const [opened] = await tx<{ review_token: string | null }[]>`
          select review_token from verification.open_request(${request}::uuid)`;
        const token = opened?.review_token ?? null;
        if (token === null) {
          throw new Error(`request ${request} not claimed`);
        }
        await tx.unsafe(
          decision,
          parameters(token) as postgres.ParameterOrJSON<never>[],
        );
      },
    ),
  );
}

/**
 * L2E: creator A gets « Compte vérifié » then « Audience vérifiée » on its line (the agent typing a
 * handle and figures of his own), brand M fills its internal block and opens its request (a live
 * domain code). Returns the markers, each checked to be held by the base or served to its owner.
 */
async function verificationFixtures(
  server: Server,
  tag: string,
): Promise<{ creator: Marker[]; brand: Marker[] }> {
  // L2ES-2 (0228): the agent reads the handle the line declares (`pseudo_t1_${tag}`); he types it
  // with its `@`, the raw form of his finding, which no member is ever served
  const observedHandle = `@pseudo_t1_${tag}`;
  const observedFollowers = randomInt(51_000_000, 59_999_999);
  const observedComments = randomInt(1_000_000, 9_999_999);

  const account = (await through(
    server,
    creator,
    "POST",
    `${VERIFICATION}/requests`,
    {
      networkCode: "instagram",
      level: "account_verified",
    },
  )) as OwnRequest;
  const creatorCode = account.request.code?.code ?? "";
  expect(creatorCode).toMatch(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  await through(
    server,
    creator,
    "POST",
    `${VERIFICATION}/requests/${account.request.id}/submit`,
  );
  await agentDecides(
    account.request.id,
    "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, null, null)",
    (token) => [account.request.id, token, creatorCode, observedHandle],
  );

  const audience = (await through(
    server,
    creator,
    "POST",
    `${VERIFICATION}/requests`,
    {
      networkCode: "instagram",
      level: "audience_verified",
    },
  )) as OwnRequest;
  // the piece as a row (its bytes are T9.6's): the deposit doors are tested by verification-evidence*
  await localSuperuser()`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${audience.request.id}, ${creator.accountId}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  await through(
    server,
    creator,
    "POST",
    `${VERIFICATION}/requests/${audience.request.id}/submit`,
  );
  await agentDecides(
    audience.request.id,
    `select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer,
       $5::bigint, $6::integer, $7::date, $8::date, $9::text, null)`,
    (token) => [
      audience.request.id,
      token,
      observedFollowers,
      23,
      observedComments,
      412,
      utcDay(-12),
      utcDay(-2),
      observedHandle,
    ],
  );
  const [held] = await localSuperuser()<
    { followers: number; comments: number; handle: string }[]
  >`
    select b.observed_followers::int as followers, b.observed_avg_comments::int as comments,
           b.observed_handle_at_decision as handle
      from verification.badges b
     where b.request_id = ${audience.request.id} and b.state = 'active'`;
  expect(held).toEqual({
    followers: observedFollowers,
    comments: observedComments,
    handle: observedHandle,
  });

  const legalName = `Societe ${letterName(hex(5))} Holding`;
  const registrationNumber = `RCS ${String(randomInt(100_000_000, 999_999_999))}`;
  await migration`
    update profiles.advertiser_profiles set website_domain = ${`t1-${hex(5)}.example.test`}
     where account_id = ${brand.accountId}`;
  await through(
    server,
    brand,
    "PUT",
    `${BRAND_VERIFICATION}/internal-details`,
    {
      legalName,
      registrationCountryCode: "FR",
      registrationNumber,
    },
  );
  const opened = (await through(
    server,
    brand,
    "POST",
    `${BRAND_VERIFICATION}/request`,
  )) as OwnRequest;
  const domainCode = opened.request.code?.code ?? "";
  expect(domainCode).toMatch(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  const brandMarkers: Marker[] = [
    { name: "brand registered name", value: legalName },
    { name: "brand registration number", value: registrationNumber },
    { name: "brand domain code", value: domainCode },
  ];
  // positive control: the brand reads its own block and live code
  const own = await call(
    server,
    "GET",
    BRAND_VERIFICATION,
    await newSession(brand.accountId),
  );
  expect(own.statusCode).toBe(200);
  expect(markersIn(own.body, brandMarkers)).toEqual(
    brandMarkers.map((marker) => marker.name),
  );

  return {
    creator: [
      { name: "observed handle", value: observedHandle },
      { name: "observed follower count", value: String(observedFollowers) },
      { name: "observed average comments", value: String(observedComments) },
      { name: "creator ownership code", value: creatorCode },
    ],
    brand: brandMarkers,
  };
}

afterAll(async () => {
  await closeDatabase(database);
  await retireBrandFixtures(migration, [
    brand.accountId,
    sweepingBrand.accountId,
  ]);
});

/** The markers still come out of creator A's own reads: a sweep that finds nothing proves something. */
async function creatorOwnReads(server: Server): Promise<string> {
  const texts: string[] = [];
  for (const url of [PROFILE, NETWORKS, "/v1/me"]) {
    const response = await call(
      server,
      "GET",
      url,
      await newSession(creator.accountId),
    );
    expect(response.statusCode, url).toBe(200);
    texts.push(response.body);
  }
  return texts.join("\n");
}

function markersIn(text: string, markers: readonly Marker[]): string[] {
  return markers
    .filter((marker) => valuesFoundIn(text, [marker.value]).length > 0)
    .map((marker) => marker.name);
}

async function expectMarkersStillServedToTheCreator(): Promise<void> {
  const own = await creatorOwnReads(app());
  expect(markersIn(own, creator.markers)).toEqual(
    creator.markers
      .filter((marker) => marker.name !== "account identifier")
      .map((marker) => marker.name),
  );
}

// ---------------------------------------------------------------------------------------------

describe("T1.2 the inventory is the server's own, never a list kept by hand (18 T1.2)", () => {
  it("is what the onRoute hook saw, equal to Fastify's route tree, with every route of the creator profile in it", async () => {
    const server = app();
    await server.ready();
    const inventory = routeInventoryOf(server).map(routeName).sort();
    expect(inventory).toEqual(await registeredRoutes(server));
    const swept = (await sweptRoutes(server)).map(routeName);
    expect(swept.length).toBe(inventory.length - 1);
    expect(inventory.filter((route) => !swept.includes(route))).toEqual([
      HEALTH,
    ]);
    // the routes added at L2D are swept by themselves
    expect(swept.filter((route) => route.includes(PROFILE)).sort()).toEqual(
      [
        `GET ${PROFILE}`,
        `PATCH ${PROFILE}`,
        `GET ${NETWORKS}`,
        `POST ${NETWORKS}`,
        `PATCH ${NETWORKS}/:id`,
        `DELETE ${NETWORKS}/:id`,
        `POST ${NETWORKS}/:id/figures`,
        `PUT ${NETWORKS}/:id/audience`,
      ].sort(),
    );
    // and the routes of L2E: the member's verification, the brand's, queue 4 and the registers
    for (const prefix of [
      `${VERIFICATION}`,
      `${BRAND_VERIFICATION}`,
      "/v1/bo/queues/verification-creators",
      "/v1/bo/queues/verification-brands",
      "/v1/bo/verification/registry-sources",
    ]) {
      expect(
        swept.filter((route) => route.split(" ")[1]?.startsWith(prefix)).length,
        prefix,
      ).toBeGreaterThan(0);
    }
  });
});

describe("T1.3 adapted (EC-L2D-3): the creator's own reads carry the markers", () => {
  it("serves the creator its handle, URL, names, addresses, phone, exact figure and line, never its account identifier, and no contact of a brand", async () => {
    const own = await creatorOwnReads(app());
    await expectMarkersStillServedToTheCreator();
    expect(
      markersIn(own, [...brand.markers, ...verificationMarkers.brand]),
    ).toEqual([]);
  });

  it("never serves the creator the finding of the agent, nor the code of a decided request (L2E)", async () => {
    const server = app();
    const texts: string[] = [await creatorOwnReads(server)];
    const response = await call(
      server,
      "GET",
      VERIFICATION,
      await newSession(creator.accountId),
    );
    expect(response.statusCode).toBe(200);
    texts.push(response.body);
    expect(markersIn(texts.join("\n"), verificationMarkers.creator)).toEqual(
      [],
    );
  });
});

describe("T1.1, T1.4 every route, called as a brand on the web surface: no marker of a creator, errors included", () => {
  it("finds no marker in any body or header, over 2xx, 400 and 404 answers", async () => {
    const server = app();
    const ids = [
      creator.lineId,
      creator.accountId,
      creator.publicRef,
      randomUUID(),
      "x",
    ];
    const result = await sweep(server, sweepingBrand, ids, allMarkers());
    expect(result.findings).toEqual([]);
    // the sweep reached the handlers: successes, refused bodies and unknown objects were all seen
    const statuses = statusesOf(result);
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
    expect(statuses).toContain(404);
    expect(result.statuses.get("GET /v1/me")).toContain(200);
    expect(result.statuses.get("GET /v1/me/brand-profile")).toContain(200);
    // the creator routes answer the brand as unknown, whatever the identifier; a body refused by
    // its schema is refused first, as on every route (the schema runs before the session, EC-L2D-10-1)
    for (const [route, seen] of result.statuses) {
      if (route.includes(PROFILE)) {
        expect(seen, route).toContain(404);
        expect(
          seen.filter((status) => status !== 404 && status !== 400),
          route,
        ).toEqual([]);
      }
    }
    expect(result.calls).toBeGreaterThan(result.statuses.size);
    await expectMarkersStillServedToTheCreator();
  });

  it("answers a 500 provoked on every route, by an error carrying every marker, without any of them", async () => {
    const markers = allMarkers();
    const text = markers.map((marker) => marker.value).join(" ");
    // as a driver error would: the values in the message, the detail and the hint
    const failure = Object.assign(new Error(`database failure near ${text}`), {
      code: "XX000",
      detail: `Key (handle)=(${text}) already exists.`,
      hint: text,
    });
    const failing = {
      role: "influx_app",
      acquire: () => Promise.reject(failure),
      verify: () => Promise.reject(failure),
      destroy: async () => undefined,
      close: async () => undefined,
    } as unknown as ConnectionPool;
    const broken: ApiDatabase = {
      app: failing,
      elevated: { auth: failing, ops: failing },
      logger: database.logger,
    };
    const server = app(broken);
    // a handler that throws the same error itself
    server.get(
      "/v1/me/t1-witness-throws",
      { schema: { response: { 200: z.strictObject({ ok: z.boolean() }) } } },
      async () => {
        throw failure;
      },
    );
    const ids = [creator.lineId, creator.accountId, randomUUID()];
    const result = await sweep(server, sweepingBrand, ids, markers);
    expect(result.findings).toEqual([]);
    const errors = statusesOf(result).filter((status) => status >= 500);
    expect(errors.length).toBeGreaterThan(result.statuses.size);
    expect(result.statuses.get("GET /v1/me/t1-witness-throws")).toEqual([500]);
    expect(result.statuses.get("GET /v1/me")).toContain(500);
  });
});

describe("T1.6 before the reveal: no contact of the other party, no data of another member", () => {
  it("lets a creator who sweeps every route meet no marker of another creator, nor any contact of a brand", async () => {
    const server = app();
    const ids = [
      creator.lineId,
      creator.accountId,
      creator.publicRef,
      brand.accountId,
      randomUUID(),
      "x",
    ];
    const result = await sweep(server, sweepingCreator, ids, allMarkers());
    expect(result.findings).toEqual([]);
    const statuses = statusesOf(result);
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
    expect(statuses).toContain(404);
    // the creator's own routes worked, on its own profile
    expect(result.statuses.get(`GET ${PROFILE}`)).toContain(200);
    expect(result.statuses.get(`GET ${NETWORKS}`)).toContain(200);
    // the line of another creator is never reached: the answer of an unknown line
    for (const route of [
      `PATCH ${NETWORKS}/:id`,
      `DELETE ${NETWORKS}/:id`,
      `POST ${NETWORKS}/:id/figures`,
      `PUT ${NETWORKS}/:id/audience`,
    ]) {
      expect(result.statuses.get(route), route).not.toContain(200);
    }
    // and nothing of creator A moved
    await expectMarkersStillServedToTheCreator();
  });
});

describe("T1-W witness: a route that leaks makes the sweep fail", () => {
  it("finds the marker served by a route added to the server, which the inventory swept by itself", async () => {
    const server = app();
    const [handle] = creator.markers;
    server.get(
      "/v1/me/t1-witness-leaks",
      {
        schema: { response: { 200: z.strictObject({ handle: z.string() }) } },
      },
      async () => ({ handle: handle?.value ?? "" }),
    );
    const result = await sweep(
      server,
      sweepingBrand,
      [randomUUID()],
      [...creator.markers],
    );
    expect(result.findings).toEqual([
      "GET /v1/me/t1-witness-leaks (200): pseudo (handle)",
    ]);
  });
});

describe("C-1 (D60): nothing of either party in the logs, the provoked failures included", () => {
  it("finds no marker in any captured stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(6);
    expect(
      logStreams.flatMap((text) => markersIn(text(), allMarkers())),
    ).toEqual([]);
  });
});
