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
// Deferred: T1.5 (signed URL of the portfolio) and the agent's identified view at L2G, which replays
// this file; T1.3 and the "after" of T1.6 (a revealed introduction) at Lot 4. The rights side of the
// same rule (influx_advertiser reaches no `creator_%` object, non reversible) is T1-R, in
// profiles-creator-identity.test.ts.
// Fixtures are COMMITTED by the migration role or through the routes (random identifiers,
// disposable local stack, like the profile routes' files); the brands leave the queue after the
// file. GoTrue, Brevo and Storage are doubles that answer "unavailable": nothing leaves the process.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
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
  letterName,
  retireBrandFixtures,
  sharedMigrationRole,
  testDataSet,
} from "./support.ts";

const PROFILE = "/v1/me/creator-profile";
const NETWORKS = "/v1/me/creator-profile/networks";
const HEALTH = "GET /health";

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

// ---------------------------------------------------------------------------------------------
// Synthesis of the requests of a route: parameters, query and body from its own schemas
// ---------------------------------------------------------------------------------------------

type JsonSchema = Readonly<Record<string, unknown>>;

function isZodSchema(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "_zod" in value;
}

/** The JSON Schema of a zod input, or null when it has none (a raw body, no schema). */
function jsonSchemaOf(schema: unknown): JsonSchema | null {
  if (!isZodSchema(schema)) {
    return null;
  }
  try {
    return z.toJSONSchema(schema, {
      io: "input",
      unrepresentable: "any",
    }) as JsonSchema;
  } catch {
    return {};
  }
}

function asSchema(value: unknown): JsonSchema | null {
  return typeof value === "object" && value !== null
    ? (value as JsonSchema)
    : null;
}

/** Follows a local `$ref` (`#` or `#/$defs/name`). */
function resolved(schema: JsonSchema, root: JsonSchema): JsonSchema {
  const ref = schema.$ref;
  if (typeof ref !== "string") {
    return schema;
  }
  if (ref === "#") {
    return root;
  }
  const name = ref.replace(/^#\/(\$defs|definitions)\//, "");
  const defs = asSchema(root.$defs) ?? asSchema(root.definitions) ?? {};
  return asSchema(defs[name]) ?? {};
}

/** Strings likely to satisfy the shapes of the contracts: tried in order against each pattern. */
function stringCandidates(uuid: string): string[] {
  return [
    "t1-sweep@example.test",
    "https://www.example.test/t1-sweep",
    "+33600000001",
    "123456",
    "FR",
    "fr",
    "instagram",
    "x",
    uuid,
    "2026-01-01",
    "2026-01-01T00:00:00.000Z",
    "0".repeat(64),
    "sweep_value",
    "Valeur de balayage",
  ];
}

function matchesPattern(value: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return true;
    }
  }
}

function sampleString(schema: JsonSchema, uuid: string): string {
  const format = schema.format;
  if (format === "email") {
    return "t1-sweep@example.test";
  }
  if (format === "uuid" || format === "guid") {
    return uuid;
  }
  if (format === "date-time") {
    return new Date().toISOString();
  }
  if (format === "date") {
    return "2026-01-01";
  }
  if (format === "uri" || format === "url") {
    return "https://www.example.test/t1-sweep";
  }
  const min = typeof schema.minLength === "number" ? schema.minLength : 0;
  const max =
    typeof schema.maxLength === "number"
      ? schema.maxLength
      : Number.POSITIVE_INFINITY;
  const pattern = typeof schema.pattern === "string" ? schema.pattern : null;
  const fit = stringCandidates(uuid).find(
    (candidate) =>
      candidate.length >= min &&
      candidate.length <= max &&
      (pattern === null || matchesPattern(candidate, pattern)),
  );
  return fit ?? "x".repeat(Math.max(1, Math.min(min, 4096)));
}

/** A value of the schema, best effort: a body that fails its schema is a case of T1.4. */
function sample(
  value: unknown,
  root: JsonSchema,
  uuid: string,
  depth = 0,
): unknown {
  const raw = asSchema(value);
  if (raw === null || depth > 10) {
    return null;
  }
  const schema = resolved(raw, root);
  if ("const" in schema) {
    return schema.const;
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum[0] ?? null;
  }
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      const chosen =
        options.find((option) => asSchema(option)?.type !== "null") ??
        options[0];
      return sample(chosen, root, uuid, depth + 1);
    }
  }
  if (Array.isArray(schema.allOf)) {
    return sample(schema.allOf[0], root, uuid, depth + 1);
  }
  const type = Array.isArray(schema.type)
    ? (schema.type as unknown[]).find((candidate) => candidate !== "null")
    : schema.type;
  if (type === "object" || asSchema(schema.properties) !== null) {
    const properties = asSchema(schema.properties) ?? {};
    return Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        sample(property, root, uuid, depth + 1),
      ]),
    );
  }
  if (type === "array") {
    const count = typeof schema.minItems === "number" ? schema.minItems : 0;
    const prefix = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
    const items = Array.from(
      { length: Math.max(count, prefix.length) },
      (_unused, index) =>
        sample(prefix[index] ?? schema.items, root, uuid, depth + 1),
    );
    return items;
  }
  if (type === "string") {
    return sampleString(schema, uuid);
  }
  if (type === "integer" || type === "number") {
    if (typeof schema.minimum === "number") {
      return Math.ceil(schema.minimum);
    }
    if (typeof schema.exclusiveMinimum === "number") {
      return Math.floor(schema.exclusiveMinimum) + 1;
    }
    return 0;
  }
  if (type === "boolean") {
    return false;
  }
  return null;
}

/**
 * The bodies tried on a route: the whole sample, its required fields alone, an empty object, and
 * each field alone with the required ones; none for a route without a body schema.
 */
function bodiesOf(route: InventoriedRoute, uuid: string): unknown[] {
  const root = jsonSchemaOf(route.schema.body);
  if (root === null) {
    return [undefined];
  }
  const whole = sample(root, root, uuid);
  if (typeof whole !== "object" || whole === null || Array.isArray(whole)) {
    return [whole, {}];
  }
  const object = resolved(root, root);
  const required = new Set(
    Array.isArray(object.required) ? (object.required as string[]) : [],
  );
  const entries = Object.entries(whole);
  const base = Object.fromEntries(entries.filter(([key]) => required.has(key)));
  const bodies: unknown[] = [whole, base, {}];
  for (const [key, field] of entries) {
    if (!required.has(key)) {
      bodies.push({ ...base, [key]: field });
    }
  }
  const seen = new Set<string>();
  return bodies.filter((body) => {
    const text = JSON.stringify(body);
    return seen.has(text) ? false : (seen.add(text), true);
  });
}

function queryOf(route: InventoriedRoute, uuid: string): string {
  const root = jsonSchemaOf(route.schema.querystring);
  if (root === null) {
    return "";
  }
  const values = sample(root, root, uuid);
  if (typeof values !== "object" || values === null) {
    return "";
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && typeof value !== "object") {
      query.set(key, String(value));
    }
  }
  const text = query.toString();
  return text === "" ? "" : `?${text}`;
}

type Request = { method: Method; url: string; body: unknown };

/**
 * The requests of one route: each identifier of the path takes each of `ids` (the other party's
 * among them), the first one with every body, the others with the whole sample.
 */
function requestsOf(
  route: InventoriedRoute,
  ids: readonly string[],
): Request[] {
  const method = route.method as Method;
  const hasParameter = /:[A-Za-z]+/.test(route.url);
  const values = hasParameter ? ids : [randomUUID()];
  const requests: Request[] = [];
  values.forEach((id, index) => {
    const url = `${route.url.replace(/:[A-Za-z]+/g, encodeURIComponent(id))}${queryOf(route, id)}`;
    const bodies = bodiesOf(route, id);
    for (const body of index === 0 ? bodies : bodies.slice(0, 1)) {
      requests.push({ method, url, body });
    }
  });
  return requests;
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

  sweepingBrand = await newMember("advertiser");
  sweepingCreator = await newMember("creator");
});

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
  });
});

describe("T1.3 adapted (EC-L2D-3): the creator's own reads carry the markers", () => {
  it("serves the creator its handle, URL, names, addresses, phone, exact figure and line, never its account identifier, and no contact of a brand", async () => {
    const own = await creatorOwnReads(app());
    await expectMarkersStillServedToTheCreator();
    expect(markersIn(own, brand.markers)).toEqual([]);
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
    const result = await sweep(server, sweepingBrand, ids, [
      ...creator.markers,
      ...brand.markers,
    ]);
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
    const markers = [...creator.markers, ...brand.markers];
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
    const result = await sweep(server, sweepingCreator, ids, [
      ...creator.markers,
      ...brand.markers,
    ]);
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
      logStreams.flatMap((text) =>
        markersIn(text(), [...creator.markers, ...brand.markers]),
      ),
    ).toEqual([]);
  });
});
