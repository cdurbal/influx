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
//   L2F   (commit 16) creator L: a badge withdrawn under 2V with a message (0231), contested with a
//         text (0232), then the handle of his verified line changed (queue 6, 0233). The old and the
//         new handle, the contest text and the withdrawal message join every sweep and C-1; his own
//         reads carry the new handle and the text, the contestable decision the message; C-2 searches
//         every table of `audit`, `ops` and `leads` for them (fiche L2F invariant 12), with a witness.
//   L2G   (commit 12) creator G, published by agent A through the decisions of 0244: three visuals
//         deposited through PUT …/portfolio, each carrying a file name of origin in a header and in a
//         text chunk of its PNG; a caption (RG83 box ticked) on a PENDING one; one approved; then a
//         bio revised once published (a revision of queue 2). The caption, the file name, the
//         revised text, a slice of the pending visual's bytes and the three object keys join every
//         sweep and C-1 (TM5.5 on the routes: no pending visual reaches a brand); his own reads carry
//         the caption, the revised text (CA48) and the bytes, never the file name, a key nor a URL;
//         T1.5: no URL is emitted,
//         the keys written to Storage are the base's and hold no marker, the bytes no file name; C-2
//         over audit, ops and leads, and the file name in no table of any INFLUX schema.
//   L3B   (commit 08) brand M writes a campaign through /v1/me/campaigns: its title, brief, internal
//         reference, total budget and identifier join every sweep and C-1. No member but brand M
//         reaches it at L3B (a creator reads no campaign before L3D, another brand never): the
//         creator's sweep of T1.6 meets none of them; brand M reads them on its own routes, and its
//         preview of what a creator sees (GET …/creator-view) carries the title, never the internal
//         reference nor the total budget (positive control, CA41, CA68).
// Deferred: the agent's identified view (the queue routes of L2G 11 serve layer I to an agent, by
// design); T1.3 and the "after" of T1.6 (a revealed introduction) at Lot 4. The rights side of the
// same rule (influx_advertiser reaches no `creator_%` object, non reversible) is T1-R, in
// profiles-creator-identity.test.ts.
// Fixtures are COMMITTED by the migration role or through the routes (random identifiers,
// disposable local stack, like the profile routes' files); the brands leave the queue after the
// file, creator G's visuals and entries too. GoTrue and Brevo are doubles that answer "unavailable",
// Storage a double that keeps what is written: nothing leaves the process.
import { accountIdOf, localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
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
const PORTFOLIO = "/v1/me/creator-profile/portfolio";
const CAMPAIGNS = "/v1/me/campaigns";
const HEALTH = "GET /health";
const agentA = accountIdOf("agent", "a");
const PORTFOLIO_BUCKET = "portfolio";

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
/**
 * L2F (commit 16): creator L, whose « Audience vérifiée » was withdrawn with a message, who contests
 * the withdrawal with a text, then changes the handle of his verified line (queue 6). The old handle
 * is served to no member any more; the new one, the text and the message are his own and served to
 * him alone (positive control).
 */
let l2f: {
  creator: Member;
  ids: string[];
  markers: Marker[];
  ownMarkers: Marker[];
  disputeId: string;
  reviewId: string;
};
/**
 * L2G (commit 12): creator G, published, whose visuals carry a file name of origin, one pending visual
 * a caption, and whose published bio waits for its revision. `texts` are the three values the base
 * may hold where 0242 and 0243 keep them, and nowhere else (C-2); `ownMarkers` are served to him alone.
 */
let l2g: {
  creator: Member;
  ids: string[];
  markers: Marker[];
  ownMarkers: Marker[];
  texts: Marker[];
  items: { id: string; objectKey: string }[];
  pendingItem: string;
};

/**
 * L3B (commit 08): the campaign brand M writes, its markers (title, brief, internal reference, total
 * budget, identifier), served to brand M alone at L3B.
 */
let l3b: { campaignId: string; markers: Marker[] };

/** Every marker of both parties, the verification's, L2F's, L2G's and L3B's included. */
function allMarkers(): Marker[] {
  return [
    ...creator.markers,
    ...brand.markers,
    ...verificationMarkers.creator,
    ...verificationMarkers.brand,
    ...l2f.markers,
    ...l2g.markers,
    ...l3b.markers,
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

/** What the routes wrote to Storage, `bucket/key` → bytes, read back as written (T1.5, T9.9). */
const objects = new Map<string, Buffer>();

const store: ObjectStore = {
  write: async (bucket, key, bytes) => {
    objects.set(`${bucket}/${key}`, Buffer.from(bytes));
    return { ok: true, value: null };
  },
  read: async (bucket, key) => ({
    ok: true,
    value: objects.get(`${bucket}/${key}`) ?? null,
  }),
  remove: async (bucket, key) => {
    objects.delete(`${bucket}/${key}`);
    return { ok: true, value: null };
  },
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
  l2f = await l2fFixtures(server);
  l2g = await l2gFixtures(server);
  l3b = await l3bFixtures(server);

  sweepingBrand = await newMember("advertiser");
  sweepingCreator = await newMember("creator");
});

/** L3B (commit 08): brand M's campaign, written through its own route, a draft (RG108). */
async function l3bFixtures(
  server: Server,
): Promise<{ campaignId: string; markers: Marker[] }> {
  const title = `Campagne T1 ${letterName(hex(5))}`;
  const brief = `Brief T1 ${letterName(hex(6))} ${"b".repeat(300)}`;
  const reference = `T1-REF-${hex(4)}`;
  const totalBudget = randomInt(900_000_000, 999_999_999);
  const created = (await through(server, brand, "POST", CAMPAIGNS, {
    title,
    brief,
    internalReference: reference,
    currency: "EUR",
    totalBudgetMinor: totalBudget,
  })) as { id: string };
  return {
    campaignId: created.id,
    markers: [
      { name: "L3B campaign title", value: title },
      { name: "L3B campaign brief", value: brief.slice(0, 24) },
      { name: "L3B internal reference", value: reference },
      { name: "L3B total budget", value: String(totalBudget) },
      { name: "L3B campaign identifier", value: created.id },
    ],
  };
}

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

/** A fresh backoffice session of `account`, TOTP proven now (the 0012 trigger), for R. */
async function backofficeSession(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp',
            'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no backoffice session");
  }
  return row.id;
}

/**
 * L2F: creator L gets « Compte vérifié » then « Audience vérifiée » (as creator A), agent A asks the
 * withdrawal of the audience badge for `terms_breach` with a message, admin A confirms and withdraws
 * (0231, a COMMITTED transaction as apps/api calls them); L contests it through his route with a
 * text (0232), then changes the handle of his line through his route, which opens queue 6 (0233).
 */
async function l2fFixtures(server: Server): Promise<typeof l2f> {
  const l = await newMember("creator");
  const tag = hex(5);
  const oldHandle = `ancien_t1_${tag}`;
  const newHandle = `nouveau_t1_${hex(5)}`;
  const message = `Publications contraires aux conditions ${letterName(hex(6))} ${letterName(hex(6))}`;
  const text = `Le constat a mal lu mes publications ${letterName(hex(6))} ${letterName(hex(6))}`;
  // no URL on the line: the old handle lives in the handle alone
  const created = (await through(server, l, "POST", NETWORKS, {
    networkCode: "instagram",
    handle: oldHandle,
    isPrimary: true,
    followersCount: randomInt(41_000_000, 49_999_999),
  })) as { lineId: string | null };
  const lineId = created.lineId ?? "";
  expect(lineId).not.toBe("");
  await through(server, l, "POST", `${NETWORKS}/${lineId}/figures`, {
    followersCount: randomInt(41_000_000, 49_999_999),
    postsLast30Days: 12,
    avgCommentsPerPost: 31,
  });

  const account = (await through(
    server,
    l,
    "POST",
    `${VERIFICATION}/requests`,
    {
      networkCode: "instagram",
      level: "account_verified",
    },
  )) as OwnRequest;
  const code = account.request.code?.code ?? "";
  await through(
    server,
    l,
    "POST",
    `${VERIFICATION}/requests/${account.request.id}/submit`,
  );
  await agentDecides(
    account.request.id,
    "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, null, null)",
    (token) => [account.request.id, token, code, oldHandle],
  );
  const audience = (await through(
    server,
    l,
    "POST",
    `${VERIFICATION}/requests`,
    {
      networkCode: "instagram",
      level: "audience_verified",
    },
  )) as OwnRequest;
  await localSuperuser()`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${audience.request.id}, ${l.accountId}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  await through(
    server,
    l,
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
      randomInt(51_000_000, 59_999_999),
      23,
      randomInt(1_000_000, 9_999_999),
      412,
      utcDay(-12),
      utcDay(-2),
      oldHandle,
    ],
  );
  const [badge] = await localSuperuser()<{ id: string }[]>`
    select id::text from verification.badges
     where request_id = ${audience.request.id} and state = 'active'`;
  const badgeId = badge?.id ?? "";
  expect(badgeId).not.toBe("");

  // the withdrawal under 2V: the agent asks, a distinct admin confirms and withdraws (peer)
  const adminA = accountIdOf("admin", "a");
  await localSuperuser().begin(async (tx) => {
    const [requested] = await actAsInternal(
      tx,
      "influx_agent",
      { accountId: agentA, role: "agent", aal: "aal2" },
      () => tx<{ id: string }[]>`
        select verification.request_badge_revocation(${badgeId}::uuid, 'terms_breach',
                                                     ${message})::text as id`,
    );
    const request = requested?.id ?? "";
    const session = await backofficeSession(tx, adminA);
    await actAsInternal(
      tx,
      "influx_admin",
      { accountId: adminA, role: "admin", aal: "aal2", sessionId: session },
      async () => {
        await tx`select backoffice.confirm_dual_control(${session}::uuid, ${request}::uuid, null)`;
        await tx`
          select verification.revoke_badge(${session}::uuid, ${request}::uuid, ${badgeId}::uuid,
                                           'terms_breach')`;
      },
    );
  });

  // positive control: the message is served to creator L, with the decision he may contest
  const contestable = await call(
    server,
    "GET",
    `${VERIFICATION}/disputes`,
    await newSession(l.accountId),
  );
  expect(contestable.statusCode).toBe(200);
  expect(valuesFoundIn(contestable.body, [message])).not.toEqual([]);

  // the contest of the withdrawal, then the change of handle, through his routes
  const submitted = (await through(
    server,
    l,
    "POST",
    `${VERIFICATION}/disputes`,
    {
      badgeId,
      reasonCode: "other",
      text,
    },
  )) as { dispute: { id: string } };
  await through(server, l, "PATCH", `${NETWORKS}/${lineId}`, {
    handle: newHandle,
  });
  const [review] = await localSuperuser()<
    { id: string; previous: string | null; next: string | null }[]
  >`
    select id::text, previous_handle as previous, new_handle as next
      from verification.identifier_change_reviews
     where social_account_id = ${lineId} and state = 'open'`;
  // the base holds both handles, internally (08 RG78, CA54)
  expect(review).toMatchObject({ previous: oldHandle, next: newHandle });
  const [held] = await localSuperuser()<
    { message: string | null; text: string | null }[]
  >`
    select q.member_message as message, d.text
      from verification.badge_revocation_requests q
      join verification.disputes d on d.badge_id = q.badge_id
     where q.badge_id = ${badgeId}`;
  expect(held).toEqual({ message, text });

  // what creator L still reads of his own: the new handle and his contest (the message came with the
  // contestable decision, above, and leaves the read once contested)
  const ownMarkers: Marker[] = [
    { name: "L2F new handle", value: newHandle },
    { name: "L2F contest text", value: text },
  ];
  return {
    creator: l,
    ids: [lineId, badgeId, submitted.dispute.id, review?.id ?? "", l.accountId],
    markers: [
      { name: "L2F old handle", value: oldHandle },
      { name: "L2F withdrawal message", value: message },
      ...ownMarkers,
    ],
    ownMarkers,
    disputeId: submitted.dispute.id,
    reviewId: review?.id ?? "",
  };
}

/**
 * A PNG written byte for byte, of incompressible noise (distinct bytes at every call), carrying
 * `fileName` in a text chunk, as a picture saved by a phone carries its title.
 */
function noisePngNamed(
  width: number,
  height: number,
  fileName: string,
): Buffer {
  const stride = 1 + width * 3;
  const raw = randomBytes(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("tEXt", Buffer.from(`Title\0${fileName}`, "latin1")),
    chunk("IDAT", deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A deposit through PUT …/portfolio, the file name of origin in its headers as a browser sends it. */
async function depositVisual(
  server: Server,
  member: Member,
  fileName: string,
): Promise<string> {
  const response = await server.inject({
    method: "PUT",
    url: PORTFOLIO,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      origin: WEB_ORIGIN,
      "sec-fetch-site": "same-origin",
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${fileName}"`,
      "x-file-name": fileName,
      cookie: `__Host-influx-session=${await newSession(member.accountId)}`,
    },
    payload: noisePngNamed(640, 480, fileName),
  });
  expect(response.statusCode, response.body).toBe(200);
  return (response.json() as { item: { id: string } }).item.id;
}

/**
 * L2G: creator G fills every required field (blocks 1, 2 and 5 through the route; his line, its
 * audience and « Compte vérifié » written as 0217 and 0224 would), deposits three visuals through
 * the route, captions the second one (RG83 box ticked) and submits; agent A approves the first one
 * (queue 3) then publishes the profile (queue 2), through the functions of 0244 in a COMMITTED
 * transaction as apps/api calls them; G then revises his published bio (a revision of queue 2).
 */
async function l2gFixtures(server: Server): Promise<typeof l2g> {
  const g = await newMember("creator");
  const fileName = `story-t1-${letterName(hex(6))}.png`;
  const caption = `Atelier lumiere ${letterName(hex(6))} ${letterName(hex(6))}`;
  const revisionText = `Nouvelle saison ${letterName(hex(6))} ${letterName(hex(6))}`;
  const bio = `${"Je partage des recettes simples, de saison, pensées pour les familles pressées. ".repeat(2)}Chaque semaine, une vidéo et une fiche pratique.`;
  const code = async (table: string): Promise<string[]> =>
    (
      await migration.unsafe<{ code: string }[]>(
        `select code from reference.${table} where retired_at is null order by code limit 3`,
      )
    ).map((row) => row.code);
  const [topics, tones, formats] = [
    await code("topics"),
    await code("editorial_tones"),
    await code("formats"),
  ];
  await through(server, g, "PATCH", PROFILE, {
    headline: "Cuisine végétale de saison pour toute la famille",
    bio,
    primaryTopic: topics[0],
    secondaryTopics: [topics[1], topics[2]],
    tones: [tones[0]],
    publicationLanguages: ["fr", "en"],
    travelScope: "domestic",
    formats: [formats[0], formats[1]],
    usageRights: [],
    maxExclusivity: "le_3m",
    availability: "lt_1m",
  });
  const handle = `g_t1_${hex(5)}`;
  const [line] = await migration<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, figures_measured_at)
    values (${g.accountId}, 'instagram', true, ${handle},
            ${`https://instagram.com/${handle}`}, 48000, 12, 30, now())
    returning id::text`;
  const lineId = line?.id ?? "";
  await migration`
    insert into profiles.creator_audience_countries
      (social_account_id, account_id, slot, country_code, share_percent)
    values (${lineId}, ${g.accountId}, 0, 'FR', 70)`;
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${g.accountId}, ${lineId}, 'instagram', 'account_verified', 'pending')
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
    values (${g.accountId}, ${lineId}, 'instagram', ${request?.id ?? null}, 'account_verified',
            ${agentA}, now(), 'public_profile', ${handle})`;

  const deposited: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    deposited.push(await depositVisual(server, g, fileName));
  }
  const [approvedItem = "", pendingItem = ""] = deposited;
  await through(server, g, "PATCH", `${PORTFOLIO}/${pendingItem}`, {
    caption,
    brandDeclared: true,
  });
  const submitted = (await through(server, g, "POST", `${PROFILE}/submit`)) as {
    status: string;
  };
  expect(submitted.status).toBe("pending_review");
  const [submission] = await migration<{ id: string }[]>`
    select id::text from profiles.creator_review_entries
     where account_id = ${g.accountId} and state = 'open'`;
  const submissionId = submission?.id ?? "";
  await localSuperuser().begin((tx) =>
    actAsInternal(
      tx,
      "influx_agent",
      { accountId: agentA, role: "agent", aal: "aal2" },
      async () => {
        const [item] = await tx<{ review_token: string | null }[]>`
          select review_token from profiles.open_portfolio_item(${approvedItem}::uuid)`;
        await tx`
          select * from profiles.approve_portfolio_item(${approvedItem}::uuid,
                                                        ${item?.review_token ?? ""}, null)`;
        const [entry] = await tx<{ review_token: string | null }[]>`
          select review_token from profiles.open_creator_review_entry(${submissionId}::uuid)`;
        await tx`
          select * from profiles.publish_creator_review_entry(${submissionId}::uuid,
                                                              ${entry?.review_token ?? ""}, null)`;
      },
    ),
  );
  // the bio of the published profile, revised: the typed text waits in queue 2, never live (RG9)
  await through(server, g, "PATCH", PROFILE, {
    bio: `${bio} ${revisionText}.`,
  });
  const [state] = await migration<
    { status: string; bio: string | null; revision: string | null }[]
  >`
    select p.status::text, p.bio,
           (select e.id::text from profiles.creator_review_entries e
             where e.account_id = p.account_id and e.state = 'open' and e.kind = 'revision')
             as revision
      from profiles.creator_public_profiles p
     where p.account_id = ${g.accountId}`;
  expect(state).toMatchObject({ status: "published", bio });
  expect(state?.revision ?? null).not.toBeNull();

  const items = await migration<
    { id: string; objectKey: string; state: string }[]
  >`
    select id::text, object_key as "objectKey", state::text from profiles.portfolio_items
     where account_id = ${g.accountId} order by created_at, id`;
  expect(items.map((item) => [item.id, item.state])).toEqual([
    [approvedItem, "approved"],
    [pendingItem, "pending"],
    [deposited[2], "pending"],
  ]);
  const pendingKey = items[1]?.objectKey ?? "";
  const pendingBytes = objects.get(`${PORTFOLIO_BUCKET}/${pendingKey}`);
  if (pendingBytes === undefined) {
    throw new Error("the deposit wrote no object");
  }
  // a slice of the bytes, base64 from an offset that is a multiple of 3, so that any base64 of the
  // whole object carries it
  const bytesMarker: Marker = {
    name: "L2G pending visual bytes (base64)",
    value: pendingBytes.subarray(300, 360).toString("base64"),
  };
  const captionMarker: Marker = { name: "L2G caption", value: caption };
  const revisionMarker: Marker = {
    name: "L2G revision text",
    value: revisionText,
  };
  const texts: Marker[] = [
    captionMarker,
    { name: "L2G file name of origin", value: fileName },
    revisionMarker,
  ];
  return {
    creator: g,
    ids: [...deposited, submissionId, state?.revision ?? "", g.accountId],
    markers: [
      ...texts,
      bytesMarker,
      ...items.map((item, index) => ({
        name: `L2G object key ${index + 1}`,
        value: item.objectKey,
      })),
    ],
    // what he typed while it waits for review is his to read (CA48), never a brand's
    ownMarkers: [captionMarker, revisionMarker, bytesMarker],
    texts,
    items: items.map(({ id, objectKey }) => ({ id, objectKey })),
    pendingItem,
  };
}

afterAll(async () => {
  await closeDatabase(database);
  // no visual nor entry of creator G stays in queues 2 and 3 of the shared stack
  if (l2g !== undefined) {
    const account = l2g.creator.accountId;
    await migration`
      update profiles.portfolio_items set state = 'withdrawn'
       where account_id = ${account} and state in ('pending', 'approved')`;
    await migration`
      update profiles.creator_review_entries set state = 'withdrawn', closed_at = now()
       where account_id = ${account} and state = 'open'`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = ${account}`;
    await migration`
      delete from leads.outbox_events where subject_key = ${`account:${account}`}`;
  }
  // no entry of this file stays in queues 5 and 6 of the shared stack
  if (l2f !== undefined) {
    await migration`
      update verification.disputes
         set state = 'withdrawn', withdrawn_cause = 'account_erased', closed_at = now()
       where id = ${l2f.disputeId}::uuid and state = 'open'`;
    await migration`
      update verification.identifier_change_reviews
         set state = 'withdrawn', withdrawn_cause = 'account_erased', closed_at = now()
       where id = ${l2f.reviewId}::uuid and state = 'open'`;
  }
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
    // the routes added at L2D, and at L2G 07 to 09 (the portfolio, the submission, the switch, the
    // preview), are swept by themselves
    expect(swept.filter((route) => route.includes(PROFILE)).sort()).toEqual(
      [
        `GET ${PROFILE}`,
        `PATCH ${PROFILE}`,
        `GET ${PROFILE}/preview`,
        `POST ${PROFILE}/submit`,
        `PUT ${PROFILE}/visibility`,
        `GET ${PROFILE}/portfolio`,
        `PUT ${PROFILE}/portfolio`,
        `PUT ${PROFILE}/portfolio/order`,
        `PATCH ${PROFILE}/portfolio/:id`,
        `DELETE ${PROFILE}/portfolio/:id`,
        `GET ${PROFILE}/portfolio/:id/image`,
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

describe("L2F (commit 16): the withdrawal, the contest and the changed handle join the sweeps", () => {
  it("T1.2: the routes of L2F are in the inventory the sweeps walk", async () => {
    const swept = (await sweptRoutes(app())).map(routeName);
    for (const route of [
      `GET ${VERIFICATION}/disputes`,
      `POST ${VERIFICATION}/disputes`,
      "GET /v1/bo/queues/verification-disputes/entries",
      "GET /v1/bo/queues/identifier-changes/entries",
      "GET /v1/bo/accounts/:id/badges",
      "POST /v1/bo/accounts/:id/badges/:badgeId/revocation",
      "GET /v1/bo/accounts/:id/verification-requests",
      "POST /v1/bo/accounts/:id/verification-requests",
    ]) {
      expect(swept, route).toContain(route);
    }
  });

  it("T1.3 adapted: creator L reads his new handle and his contest text (the withdrawal message before he contests, in the fixture); the markers are real", async () => {
    const server = app();
    const texts: string[] = [];
    for (const url of [NETWORKS, `${VERIFICATION}/disputes`]) {
      const response = await call(
        server,
        "GET",
        url,
        await newSession(l2f.creator.accountId),
      );
      expect(response.statusCode, url).toBe(200);
      texts.push(response.body);
    }
    expect(markersIn(texts.join("\n"), l2f.ownMarkers)).toEqual(
      l2f.ownMarkers.map((marker) => marker.name),
    );
    // and nothing of creator A, nor of brand M, comes to creator L
    expect(
      markersIn(texts.join("\n"), [
        ...creator.markers,
        ...brand.markers,
        ...verificationMarkers.creator,
        ...verificationMarkers.brand,
      ]),
    ).toEqual([]);
  });

  it("C-2 (D60, RG99; fiche L2F invariant 12): no L2F marker in the register, the outbox or any table of ops", async () => {
    const sql = localSuperuser();
    const values = l2f.markers.map((marker) => marker.value);
    const relations = await sql<{ name: string }[]>`
      select n.nspname || '.' || c.relname as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('audit', 'ops', 'leads') and c.relkind in ('r', 'p')
         and not c.relispartition
       order by 1`;
    const names = relations.map((relation) => relation.name);
    expect(names).toEqual(
      expect.arrayContaining(["audit.audit_events", "leads.outbox_events"]),
    );
    expect(
      names.filter((name) => name.startsWith("ops.")).length,
    ).toBeGreaterThan(3);
    /** `relation: marker` for every L2F marker a row of `relations` holds, its JSON form searched. */
    const findingsIn = async (relations: string[]): Promise<string[]> => {
      const findings: string[] = [];
      for (const name of relations) {
        const rows = await sql.unsafe<{ marker: string }[]>(
          `select distinct m.value as marker
             from ${name} t, unnest($1::text[]) m(value)
            where strpos(to_jsonb(t)::text, m.value) > 0`,
          [values] as postgres.ParameterOrJSON<never>[],
        );
        for (const row of rows) {
          const marker = l2f.markers.find(
            (entry) => entry.value === row.marker,
          );
          findings.push(`${name}: ${marker?.name ?? "?"}`);
        }
      }
      return findings.sort();
    };
    expect(await findingsIn(names)).toEqual([]);
    // witness: the same search finds each marker where the base keeps it, internally
    expect(
      await findingsIn([
        "verification.badge_revocation_requests",
        "verification.disputes",
        "verification.identifier_change_reviews",
      ]),
    ).toEqual(
      [
        "verification.badge_revocation_requests: L2F withdrawal message",
        "verification.disputes: L2F contest text",
        "verification.identifier_change_reviews: L2F new handle",
        "verification.identifier_change_reviews: L2F old handle",
      ].sort(),
    );
    // the facts themselves are in the register, by their codes and identifiers
    const [facts] = await sql<{ codes: string[] }[]>`
      select coalesce(array_agg(distinct event_type order by event_type), '{}') as codes
        from audit.audit_events
       where subject_id::text = any (${l2f.ids}::text[])`;
    expect(facts?.codes ?? []).toContain("verification.badge_revoked");
  });
});

describe("L2G (commit 12): the portfolio, the submission and the revision join the sweeps", () => {
  it("T1.2: the routes of the portfolio, the preview and queues 2 and 3 are in the inventory the sweeps walk", async () => {
    const swept = (await sweptRoutes(app())).map(routeName);
    for (const route of [
      `PUT ${PORTFOLIO}`,
      `GET ${PORTFOLIO}/:id/image`,
      `GET ${PROFILE}/preview`,
      `POST ${PROFILE}/submit`,
      "GET /v1/bo/queues/profiles-creator/entries",
      "GET /v1/bo/queues/portfolio-moderation/entries",
      "GET /v1/bo/queues/profiles-creator/entries/:id/portfolio/:itemId/image",
      "GET /v1/bo/queues/portfolio-moderation/entries/:id/image",
    ]) {
      expect(swept, route).toContain(route);
    }
  });

  it("T1.3 adapted: creator G reads his caption, his revised text (CA48) and his pending visual's bytes, never the file name of origin, an object key nor a URL (T1.5)", async () => {
    const server = app();
    const reads: { url: string; body: string }[] = [];
    for (const url of [
      PROFILE,
      PORTFOLIO,
      `${PORTFOLIO}/${l2g.pendingItem}/image`,
      `${PROFILE}/preview`,
    ]) {
      const response = await call(
        server,
        "GET",
        url,
        await newSession(l2g.creator.accountId),
      );
      expect(response.statusCode, url).toBe(200);
      reads.push({
        url,
        body: `${response.body}\n${JSON.stringify(response.headers)}`,
      });
    }
    const all = reads.map((read) => read.body).join("\n");
    expect(markersIn(all, l2g.ownMarkers)).toEqual(
      l2g.ownMarkers.map((marker) => marker.name),
    );
    // the file name of origin was never kept; the keys never leave the base
    expect(
      markersIn(
        all,
        l2g.markers.filter((marker) => !l2g.ownMarkers.includes(marker)),
      ),
    ).toEqual([]);
    // T1.5 (D82 (7)): no URL of a visual, no host of Storage, no token, in his portfolio reads
    for (const read of reads.filter((entry) =>
      entry.url.startsWith(PORTFOLIO),
    )) {
      expect(read.body, read.url).not.toMatch(/https?:|\/storage\/v1|token=/i);
    }
    // and nothing of creator A, of brand M nor of creator L comes to creator G
    expect(
      markersIn(all, [
        ...creator.markers,
        ...brand.markers,
        ...verificationMarkers.creator,
        ...verificationMarkers.brand,
        ...l2f.markers,
      ]),
    ).toEqual([]);
  });

  it("T1.5, T9.9: the keys written to Storage are the base's, <account>/<item>.webp, without a marker; the bytes hold no file name", () => {
    const written = [...objects.keys()].filter((key) =>
      key.startsWith(`${PORTFOLIO_BUCKET}/${l2g.creator.accountId}/`),
    );
    expect(written.sort()).toEqual(
      l2g.items.map((item) => `${PORTFOLIO_BUCKET}/${item.objectKey}`).sort(),
    );
    for (const item of l2g.items) {
      // the key is generated by the base from the two identifiers (modele 4), and nothing else
      expect(item.objectKey).toBe(`${l2g.creator.accountId}/${item.id}.webp`);
    }
    const identifying = allMarkers().filter(
      (marker) =>
        marker.name !== "account identifier" &&
        !marker.name.startsWith("L2G object key"),
    );
    expect(markersIn(written.join("\n"), identifying)).toEqual([]);
    for (const key of written) {
      const bytes = objects.get(key) ?? Buffer.alloc(0);
      expect(bytes.subarray(8, 12).toString("latin1"), key).toBe("WEBP");
      expect(markersIn(bytes.toString("latin1"), l2g.texts), key).toEqual([]);
    }
  });

  it("C-2 (D60, RG99; fiche L2G invariant 13): no L2G text in audit, ops nor leads, and the file name of origin in no table of any INFLUX schema", async () => {
    const sql = localSuperuser();
    const relations = await sql<{ name: string }[]>`
      select n.nspname || '.' || c.relname as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspowner = 'postgres'::regrole::oid and n.nspname !~ '^(_|pg_)'
         and n.nspname <> 'supabase_migrations'
         and c.relkind in ('r', 'p') and not c.relispartition
       order by 1`;
    const names = relations.map((relation) => relation.name);
    const schemas = new Set(names.map((name) => name.split(".")[0]));
    for (const schema of [
      "audit",
      "identity",
      "leads",
      "ops",
      "profiles",
      "verification",
    ]) {
      expect(schemas.has(schema), schema).toBe(true);
    }
    const values = l2g.texts.map((marker) => marker.value);
    const findings: string[] = [];
    for (const name of names) {
      const rows = await sql.unsafe<{ marker: string }[]>(
        `select distinct m.value as marker
           from ${name} t, unnest($1::text[]) m(value)
          where strpos(to_jsonb(t)::text, m.value) > 0`,
        [values] as postgres.ParameterOrJSON<never>[],
      );
      for (const row of rows) {
        const marker = l2g.texts.find((entry) => entry.value === row.marker);
        findings.push(`${name}: ${marker?.name ?? "?"}`);
      }
    }
    // the caption where 0242 keeps it (the visual, the declaration of RG83), the revised text where
    // 0243 keeps it (the revision): nowhere else, and the file name nowhere at all
    expect(findings.sort()).toEqual(
      [
        "profiles.creator_field_revisions: L2G revision text",
        "profiles.portfolio_brand_declarations: L2G caption",
        "profiles.portfolio_items: L2G caption",
      ].sort(),
    );
    // the facts themselves are in the register, by their codes and identifiers
    const [facts] = await sql<{ codes: string[] }[]>`
      select coalesce(array_agg(distinct event_type order by event_type), '{}') as codes
        from audit.audit_events
       where subject_id::text = any (${l2g.ids}::text[])`;
    expect(facts?.codes ?? []).toEqual(
      expect.arrayContaining([
        "creator_profile.published",
        "creator_profile.revision_submitted",
        "portfolio.approved",
        "portfolio.deposited",
      ]),
    );
  });
});

describe("L3B-T9: L3B (commit 08): the campaign of a brand joins the sweeps", () => {
  it("T1.2: the routes of L3B are in the inventory the sweeps walk", async () => {
    const swept = (await sweptRoutes(app())).map(routeName);
    expect(
      swept
        .filter((route) => route.split(" ")[1]?.startsWith(CAMPAIGNS))
        .sort(),
    ).toEqual(
      [
        `GET ${CAMPAIGNS}`,
        `POST ${CAMPAIGNS}`,
        `GET ${CAMPAIGNS}/:id`,
        `PATCH ${CAMPAIGNS}/:id`,
        `POST ${CAMPAIGNS}/:id/submit`,
        `GET ${CAMPAIGNS}/:id/creator-view`,
      ].sort(),
    );
  });

  it("serves brand M its campaign, and its preview of what a creator sees the title alone, never the internal reference nor the total budget (CA41, CA68)", async () => {
    const server = app();
    const own = await call(
      server,
      "GET",
      `${CAMPAIGNS}/${l3b.campaignId}`,
      await newSession(brand.accountId),
    );
    expect(own.statusCode).toBe(200);
    expect(markersIn(own.body, l3b.markers)).toEqual(
      l3b.markers.map((marker) => marker.name),
    );
    const preview = await call(
      server,
      "GET",
      `${CAMPAIGNS}/${l3b.campaignId}/creator-view`,
      await newSession(brand.accountId),
    );
    expect(preview.statusCode).toBe(200);
    expect(markersIn(preview.body, l3b.markers)).toEqual([
      "L3B campaign title",
      "L3B campaign brief",
    ]);
    // nor a contact of brand M, whose profile is not published: no brand at all (06 RG73)
    expect(markersIn(preview.body, brand.markers)).toEqual([]);
    expect((preview.json() as { brand: unknown }).brand).toBeNull();
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
      // L2F: creator L's line, withdrawn badge, contest and queue 6 entry
      ...l2f.ids,
      // L2G: creator G's three visuals, his two entries of queue 2 and his account
      ...l2g.ids,
      // L3B: brand M's campaign, another brand's for the sweeping one (T14)
      l3b.campaignId,
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
    // the routes of the backoffice answer the web surface 404 by design (T14.1): the 500 is the web routes'
    const webRoutes = [...result.statuses.keys()].filter(
      (route) => !route.includes(" /v1/bo/"),
    );
    expect(errors.length).toBeGreaterThan(webRoutes.length);
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
      ...l2f.ids,
      ...l2g.ids,
      // L3B: brand M's campaign, which no creator reads at L3B
      l3b.campaignId,
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
      // L2G: nor a visual of another creator (T14)
      `PATCH ${PORTFOLIO}/:id`,
      `DELETE ${PORTFOLIO}/:id`,
      `GET ${PORTFOLIO}/:id/image`,
      // L3B: nor any campaign, a brand's route answering a creator as unknown (T14.3)
      `GET ${CAMPAIGNS}`,
      `GET ${CAMPAIGNS}/:id`,
      `PATCH ${CAMPAIGNS}/:id`,
      `POST ${CAMPAIGNS}/:id/submit`,
      `GET ${CAMPAIGNS}/:id/creator-view`,
    ]) {
      expect(result.statuses.get(route), route).not.toContain(200);
    }
    // and nothing of creator A moved, nor of creator G's visuals
    await expectMarkersStillServedToTheCreator();
    const states = await migration<{ state: string }[]>`
      select state::text from profiles.portfolio_items
       where account_id = ${l2g.creator.accountId} order by created_at, id`;
    expect(states.map((row) => row.state)).toEqual([
      "approved",
      "pending",
      "pending",
    ]);
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
