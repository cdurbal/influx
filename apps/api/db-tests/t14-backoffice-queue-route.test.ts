// T14 (L2C, commit 11) — the queue API of the backoffice on queue 1, "profils marque à valider", on the
// local stack through the pools of apps/api (docs/mvp/06 RG19, RG25, RG63, RG64, RG66, RG70, RG80,
// CA17, CA19, CA21; 15 RG28, RG33, RG34, RG36, C1 to C8, CA18, CA19; 18 T14.1 to T14.4;
// jalons/l2c/file.md A1 to A10; l2c-fiche invariants 2, 7, 9, 11 to 14; migrations 0206, 0207, 0210):
//   GET /v1/bo/queues/counters, GET /v1/bo/queues/profiles-advertiser/entries,
//   POST /v1/bo/queues/profiles-advertiser/entries/:id/open;
// commit 12: POST …/entries/:id/{publish, reject, release, extend, force-release} (06 RG6, RG65, RG66,
// CA17, CA18, CA20; 15 C2 to C4, C6, C8, RG36, CA63).
// T14 on each route: the web surface, no session and a member session never reach them; an entry that
// does not exist and the one of the caller's own account answer the same 404, with the same body.
// The fixtures (agents, an admin, brands with their entries) are COMMITTED by the migration role
// (random identifiers, disposable local stack, like T14 of J8); the entries are withdrawn and the
// internal profiles deactivated after the file. Every list is read from the instant this file
// started (`from`): entries of earlier runs and of other files never enter the expectations.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import type { ObjectStore } from "../src/platform/storage.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { localSuperuser, sharedMigrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";
const ENTRIES = "/v1/bo/queues/profiles-advertiser/entries";
const COUNTERS = "/v1/bo/queues/counters";
const ANY_TOKEN = "0".repeat(64);
/** The five acts of commit 12, each with a body that passes its schema (T14.1, T14.2, T14.3). */
const ACTIONS = [
  ["publish", { reviewToken: ANY_TOKEN }],
  [
    "reject",
    { reviewToken: ANY_TOKEN, reasonCode: "presentation_insufficient" },
  ],
  ["release", undefined],
  ["extend", undefined],
  ["force-release", { reasonCode: "holder_absent" }],
] as const;

let database: ApiDatabase;
/** The instant (database clock) before any fixture of this file. */
let startedAt: string;
/**
 * The creation instant of every entry of this file: 400 days back, to the microsecond. The period
 * filter (15 RG33) reads exactly this window, so the entries of other files and of earlier runs
 * never enter the expectations; the deadlines (sla_due_at) stay relative to now.
 */
let base: string;
/** The window of the period filter around `base`. */
let windowFrom: string;
let windowTo: string;
const internals: string[] = [];
const brands: string[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Internal = { accountId: string; name: string; session: string };

/** An active agent or admin with a backoffice session proven by TOTP now, and a display name. */
async function newInternal(
  role: "agent" | "admin",
  name: string,
): Promise<Internal> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-queue-${role}-${accountId}@example.test`},
              now(), 'FR', 'fr', ${name}, true, now(), 'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, ${name}, now(), now(), ${randomUUID()})`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')`;
  });
  internals.push(accountId);
  return { accountId, name, session: token.toString("base64url") };
}

/** A member session, presented on the backoffice surface. */
async function newMemberSession(): Promise<string> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-queue-member-${accountId}@example.test`},
              now(), 'FR', 'fr', true, now(), 'individual')`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')`;
  });
  return token.toString("base64url");
}

type BrandOptions = {
  name?: string;
  country?: string;
  language?: "fr" | "en";
  owner?: string;
  presentation?: string;
  website?: string | null;
  status?: "pending_review" | "published";
  kind?: "submission" | "revision";
  /** The deadline of the entry, as an interval from now (negative: past). */
  dueIn?: string;
  /** An account that is internal: the entry of its own profile. */
  asInternal?: "agent";
  completeness?: number;
  contact?: { firstName: string; email: string; phone: string };
};

type Brand = {
  accountId: string;
  entryId: string;
  name: string;
  contact: { firstName: string; email: string; phone: string };
};

const PRESENTATION =
  "We design durable outdoor gear for people who spend their weekends on the trails. ".repeat(
    2,
  );

/** A committed brand profile with its open entry (a first submission unless said otherwise). */
async function newBrand(options: BrandOptions = {}): Promise<Brand> {
  const accountId = randomUUID();
  // no run of eight digits: a name that looks like a phone number would raise RG19 on the fixture
  // (an all-digit id prefix is 2 % of the names: every digit is replaced)
  const name =
    options.name ?? `Maison ${accountId.slice(0, 8).replace(/\d/g, "x")}`;
  const contact = options.contact ?? {
    firstName: `Prénom${accountId.slice(0, 6)}`,
    email: `contact-${accountId}@brand.example.test`,
    phone: "+33612345678",
  };
  const entryId = randomUUID();
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-queue-brand-${accountId}@example.test`},
              now(), ${options.country ?? "FR"}, ${options.language ?? "fr"}, true, now(),
              'business', ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
    await tx`
      insert into profiles.advertiser_profiles
        (account_id, legal_name, status, submitted_at, presentation, website_domain,
         primary_sector_code, company_size_band, contact_role, completeness_percent,
         first_published_at)
      values (${accountId}, ${name}, ${options.status ?? "pending_review"}::profiles.advertiser_profile_status,
              now(), ${options.presentation ?? PRESENTATION}, ${options.website ?? null},
              'sports_leisure', '11_50', 'marketing', ${options.completeness ?? 80},
              ${options.status === "published" ? new Date() : null})`;
    await tx`
      insert into profiles.advertiser_contact_details
        (account_id, contact_first_name, contact_email, contact_phone)
      values (${accountId}, ${contact.firstName}, ${contact.email}, ${contact.phone})`;
    await tx`
      insert into profiles.advertiser_review_entries (id, account_id, kind)
      values (${entryId}, ${accountId}, ${options.kind ?? "submission"}::profiles.review_entry_kind)`;
    await tx`
      update profiles.advertiser_review_entries
         set created_at = ${base}::timestamptz,
             sla_due_at = case when ${options.dueIn ?? null}::text is null then sla_due_at
                               else now() + (${options.dueIn ?? null}::text)::interval end,
             escalate_at = case when ${options.dueIn ?? null}::text is null then escalate_at
                                else now() + (${options.dueIn ?? null}::text)::interval
                                     + interval '1 day' end
       where id = ${entryId}`;
    await tx`
      insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
      values (${accountId}, 1, 'fashion_accessories')`;
  });
  brands.push(accountId);
  return { accountId, entryId, name, contact };
}

/** A pending revision of a moderated field on a published brand (a `revision` entry). */
async function addRevision(
  brand: Brand,
  fieldCode: string,
  proposed: string | null,
): Promise<string> {
  const [row] = await sharedMigrationRole()<{ id: string }[]>`
    insert into profiles.profile_field_revisions
      (account_id, field_code, proposed_value, advertiser_review_entry_id)
    values (${brand.accountId}, ${fieldCode}, ${proposed}::jsonb, ${brand.entryId})
    returning id::text`;
  return row?.id ?? "";
}

function app(storage?: ObjectStore) {
  return buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
    database,
    ...(storage === undefined ? {} : { storage }),
  });
}

type Server = ReturnType<typeof app>;

function call(
  server: Server,
  method: "GET" | "POST",
  url: string,
  session: string | null,
  options: {
    surface?: "backoffice" | "web";
    cookie?: string;
    body?: object;
  } = {},
): Promise<LightMyRequestResponse> {
  const cookieName = options.cookie ?? "__Host-influx-ops-session";
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal":
        options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null ? {} : { cookie: `${cookieName}=${session}` }),
    },
    ...(options.body === undefined ? {} : { payload: options.body }),
  });
}

function open(
  server: Server,
  entryId: string,
  who: Internal,
): Promise<LightMyRequestResponse> {
  return call(server, "POST", `${ENTRIES}/${entryId}/open`, who.session);
}

/** The whole answer but its request id (18 T14.4). */
function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

type Row = {
  id: string;
  accountId: string;
  kind: string;
  overdue: boolean;
  brandName: string;
  countryCode: string;
  modifiedFields: string[];
  owner: { accountId: string; displayName: string | null } | null;
  claim: {
    holder: { accountId: string; displayName: string | null } | null;
    heldByCaller: boolean;
  };
  alerts: string[];
};
type ListBody = { asOf: string; items: Row[]; nextCursor: string | null };

async function list(
  server: Server,
  who: Internal,
  params: Record<string, string | number> = {},
): Promise<{ status: number; body: ListBody; raw: string }> {
  const query = new URLSearchParams({
    from: windowFrom,
    to: windowTo,
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  });
  const response = await call(
    server,
    "GET",
    `${ENTRIES}?${query.toString()}`,
    who.session,
  );
  return {
    status: response.statusCode,
    body: response.json<ListBody>(),
    raw: response.body,
  };
}

type Opened = {
  outcome: string;
  reviewToken: string | null;
  entry: {
    state: string;
    kind: string;
    overdue: boolean;
    claim: {
      holder: { accountId: string; displayName: string | null } | null;
      heldByCaller: boolean;
    };
    lastForcedRelease: { holderIsCaller: boolean; reasonCode: string } | null;
    decision: unknown;
  };
  account: { preferredLanguage: string; owner: unknown };
  profile: {
    brandName: string;
    presentation: string | null;
    contact: {
      firstName: string | null;
      email: string | null;
      phone: string | null;
    };
    logos: { active: unknown; inReview: unknown };
    lists: { secondarySectors: string[] };
  };
  revisions: {
    fieldCode: string;
    validated: Record<string, unknown>;
    proposed: Record<string, unknown>;
  }[];
  alerts: {
    code: string;
    field?: string;
    signals?: string[];
    matches?: { accountId: string; brandName: string }[];
  }[];
  reasons: {
    code: string;
    position: number;
    requiresMemberMessage: boolean;
    message: string;
    nextStep: string;
  }[];
};

async function opened(
  server: Server,
  entryId: string,
  who: Internal,
): Promise<Opened> {
  const response = await open(server, entryId, who);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Opened>();
}

async function entryState(entryId: string): Promise<{
  claimedBy: string | null;
  state: string;
}> {
  const [row] = await sharedMigrationRole()<
    { claimed_by: string | null; state: string }[]
  >`
    select claimed_by_account_id::text as claimed_by, state::text as state
      from profiles.advertiser_review_entries where id = ${entryId}`;
  return { claimedBy: row?.claimed_by ?? null, state: row?.state ?? "" };
}

async function registerLines(
  subjectId: string,
): Promise<
  { event: string; actor: string | null; payload: Record<string, unknown> }[]
> {
  return sharedMigrationRole()<
    {
      event: string;
      actor: string | null;
      payload: Record<string, unknown>;
    }[]
  >`
    select event_type as event, actor_account_id::text as actor, payload
      from audit.audit_events
     where subject_type = 'queue_entry' and subject_id = ${subjectId}
     order by seq`;
}

let agent: Internal;
let colleague: Internal;
let admin: Internal;
/** The brand that `agent` holds (RG36). */
let held: Brand;
/** A plain submission: the oldest deadline but one. */
let plain: Brand;
/** Past its deadline: in front of the list. */
let late: Brand;
/** Presentation with an address, a number and a handle; website with a punycode label. */
let flagged: Brand;
/** A published brand: the one the next two resemble. */
let published: Brand;
/** Same website domain as `published`, a different name. */
let dupDomain: Brand;
/** Same name as `published` once normalised (accents, case, punctuation). */
let dupName: Brand;
/** A published brand with a pending revision of its presentation, an English-speaking one. */
let revised: Brand;
/** A Belgian brand whose entry is claimed by `colleague`. */
let claimed: Brand;
/** The agent's own account, with a brand profile and an entry (C(3)). */
let ownEntryId: string;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  const [clock] = await sharedMigrationRole()<{ now: string }[]>`
    select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as now`;
  startedAt = clock?.now ?? "";
  const [window] = await sharedMigrationRole()<
    { base: string; from: string; to: string }[]
  >`
    select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as base,
           to_char((t - interval '1 minute') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as from,
           to_char((t + interval '1 minute') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as to
      from (select now() - interval '400 days' as t) x`;
  base = window?.base ?? "";
  windowFrom = window?.from ?? "";
  windowTo = window?.to ?? "";
  agent = await newInternal("agent", "Camille");
  colleague = await newInternal("agent", "Marie");
  admin = await newInternal("admin", "Dominique");

  held = await newBrand({ owner: agent.accountId, country: "ES" });
  plain = await newBrand({ dueIn: "3 hours" });
  late = await newBrand({ dueIn: "-3 hours", country: "DE" });
  flagged = await newBrand({
    name: `Atelier ${randomUUID().slice(0, 6)}`,
    presentation: `${PRESENTATION} Écrivez à secret.contact@exemple.test ou appelez le 06 12 34 56 78, ou suivez @atelier_trail.`,
    website: "xn--atelier-trail-jhb.example.test",
    dueIn: "5 hours",
  });
  const sharedDomain = `${randomUUID().slice(0, 8)}.example.test`;
  const uniqueName = `Éclat Maison ${randomUUID().slice(0, 8).replace(/\d/g, "x")}`;
  published = await newBrand({
    name: uniqueName,
    website: sharedDomain,
    status: "published",
  });
  // a published brand holds no open entry: its own is withdrawn
  await sharedMigrationRole()`
    update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now()
     where id = ${published.entryId}`;
  dupDomain = await newBrand({ website: sharedDomain, dueIn: "6 hours" });
  dupName = await newBrand({
    name: uniqueName.toUpperCase().replace(/É/g, "E").replace(/ /g, "  - "),
    dueIn: "7 hours",
  });
  revised = await newBrand({
    status: "published",
    kind: "revision",
    language: "en",
    dueIn: "8 hours",
    name: `Revised ${randomUUID().slice(0, 6)}`,
  });
  await addRevision(
    revised,
    "advertiser.presentation",
    "New text, reach us at new.contact@exemple.test",
  );
  claimed = await newBrand({ country: "BE", dueIn: "9 hours" });
  await sharedMigrationRole()`
    update profiles.advertiser_review_entries
       set claimed_by_account_id = ${colleague.accountId}, claimed_at = now(),
           claim_expires_at = now() + interval '20 minutes'
     where id = ${claimed.entryId}`;

  // the entry of the agent's OWN account (C(3)): an internal account with a brand profile
  ownEntryId = randomUUID();
  // One role per account (D41): no internal account has a brand profile. The policy that hides such
  // an entry (0207, C(3)) is a second line, tried here with the foreign keys and the trigger of the
  // deadlines out of the way, as the superuser writes it.
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name, status, submitted_at)
      values (${agent.accountId}, 'Own account', 'pending_review', now())`;
    await tx`
      insert into profiles.advertiser_review_entries
        (id, account_id, kind, created_at, sla_due_at, escalate_at)
      values (${ownEntryId}, ${agent.accountId}, 'submission', now(), now() + interval '1 day',
              now() + interval '2 days')`;
  });
});

afterAll(async () => {
  await closeDatabase(database);
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      update profiles.advertiser_review_entries
         set state = 'withdrawn', closed_at = now()
       where state = 'open' and account_id = any(${[...brands, agent.accountId]}::uuid[])`;
    if (internals.length > 0) {
      await tx`
        update identity.agent_profiles
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
         where account_id = any(${internals}::uuid[]) and is_active`;
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe("T14.1, T14.2: the routes of queue 1 are the backoffice's, behind a session of an internal account", () => {
  const routes: readonly (readonly [
    "GET" | "POST",
    string,
    object | undefined,
  ])[] = [
    ["GET", COUNTERS, undefined],
    ["GET", ENTRIES, undefined],
    ["POST", `${ENTRIES}/${NIL}/open`, undefined],
    ["GET", `${ENTRIES}/${NIL}/logo?logo=${NIL}`, undefined],
    ...ACTIONS.map(
      ([action, body]) =>
        ["POST", `${ENTRIES}/${NIL}/${action}`, body] as const,
    ),
  ];

  it("the web surface never reaches them: the 404 of an unknown route, even with a member cookie", async () => {
    const server = app();
    const member = await newMemberSession();
    const unknown = answer(
      await call(server, "GET", "/v1/bo/no-such-route", member, {
        surface: "web",
        cookie: "__Host-influx-session",
      }),
    );
    expect(unknown.status).toBe(404);
    for (const [method, url, body] of routes) {
      expect(
        answer(
          await call(server, method, url, member, {
            surface: "web",
            cookie: "__Host-influx-session",
            ...(body === undefined ? {} : { body }),
          }),
        ),
        url,
      ).toEqual(unknown);
    }
  });

  it("answers 401 without a session and with a member session (a creator or a brand has no route here)", async () => {
    const server = app();
    const member = await newMemberSession();
    for (const [method, url, body] of routes) {
      for (const session of [null, member]) {
        const got = answer(
          await call(
            server,
            method,
            url,
            session,
            body === undefined ? {} : { body },
          ),
        );
        expect(got.status, url).toBe(401);
        expect(got.error.code, url).toBe("unauthenticated");
      }
    }
  });
});

describe("T14.3, T14.4: an entry that is not the caller's to open answers like one that does not exist", () => {
  it("an unknown id and the entry of the caller's own account: the same 404, the same body, for an agent and an admin", async () => {
    const server = app();
    const unknown = await open(server, randomUUID(), agent);
    expect(unknown.statusCode).toBe(404);
    expect(answer(await open(server, ownEntryId, agent))).toEqual(
      answer(unknown),
    );
    // a malformed identifier is a validation error, before any lookup
    expect(
      (await call(server, "POST", `${ENTRIES}/not-an-id/open`, agent.session))
        .statusCode,
    ).toBe(400);
  });

  it("the entry of the caller's own account is not claimed, and leaves no trace of an opening", async () => {
    const server = app();
    await open(server, ownEntryId, agent);
    expect((await entryState(ownEntryId)).claimedBy).toBeNull();
    expect(await registerLines(ownEntryId)).toEqual([]);
  });
});

describe("the list (15 RG26, RG27 C5, RG33, RG34)", () => {
  it("lists the entries that wait, the oldest deadline first, the ones past their deadline in front, with the claim and the holder by name", async () => {
    const { status, body } = await list(app(), agent);
    expect(status).toBe(200);
    const ids = body.items.map((row) => row.id);
    // sorted by deadline: late (-3 h), plain (+3 h), flagged (+5 h), dupDomain, dupName, revised, claimed
    expect(ids).toEqual([
      late.entryId,
      plain.entryId,
      flagged.entryId,
      dupDomain.entryId,
      dupName.entryId,
      revised.entryId,
      claimed.entryId,
    ]);
    const byId = new Map(body.items.map((row) => [row.id, row]));
    expect(byId.get(late.entryId)?.overdue).toBe(true);
    expect(byId.get(plain.entryId)?.overdue).toBe(false);
    expect(byId.get(late.entryId)?.claim.holder).toBeNull();
    expect(byId.get(claimed.entryId)?.claim).toMatchObject({
      holder: { accountId: colleague.accountId, displayName: "Marie" },
      heldByCaller: false,
    });
    expect(byId.get(revised.entryId)).toMatchObject({
      kind: "revision",
      modifiedFields: ["advertiser.presentation"],
    });
    expect(byId.get(plain.entryId)).toMatchObject({
      kind: "submission",
      modifiedFields: [],
      brandName: plain.name,
      countryCode: "FR",
    });
    expect(Date.parse(body.asOf)).not.toBeNaN();
  });

  it("carries no coordinate: not the contact person, not an address, not a number, not a handle (D45, D46, invariant 12)", async () => {
    const { raw, body } = await list(app(), agent);
    for (const brand of [plain, flagged, revised, claimed, late]) {
      expect(raw).not.toContain(brand.contact.email);
      expect(raw).not.toContain(brand.contact.phone);
      expect(raw).not.toContain(brand.contact.firstName);
    }
    expect(raw).not.toContain("secret.contact@exemple.test");
    expect(raw).not.toContain("@atelier_trail");
    expect(raw).not.toContain("t14-queue-brand-");
    for (const row of body.items) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "accountId",
          "alerts",
          "brandName",
          "claim",
          "completenessPercent",
          "countryCode",
          "createdAt",
          "escalateAt",
          "id",
          "kind",
          "modifiedFields",
          "overdue",
          "owner",
          "slaDueAt",
        ].sort(),
      );
    }
  });

  it("raises the alerts of the line: a direct contact, a duplicate by name and by domain, an unusual domain (RG19, RG25, RG70, L2BS-8)", async () => {
    const { body } = await list(app(), agent);
    const alerts = new Map(body.items.map((row) => [row.id, row.alerts]));
    expect(alerts.get(flagged.entryId)).toEqual([
      "direct_contact",
      "unusual_website_domain",
    ]);
    expect(alerts.get(dupDomain.entryId)).toEqual(["duplicate_domain"]);
    expect(alerts.get(dupName.entryId)).toEqual(["duplicate_brand"]);
    // a pending proposal is what is examined: the address is in the proposed presentation
    expect(alerts.get(revised.entryId)).toEqual(["direct_contact"]);
    expect(alerts.get(plain.entryId)).toEqual([]);
  });

  it("filters: kind, country, overdue, holder (free, me, a named colleague), responsible, alert, period (15 RG33)", async () => {
    const server = app();
    const ids = async (params: Record<string, string>) =>
      (await list(server, agent, params)).body.items.map((row) => row.id);
    expect(await ids({ kind: "revision" })).toEqual([revised.entryId]);
    expect(await ids({ country: "BE" })).toEqual([claimed.entryId]);
    expect(await ids({ overdue: "true" })).toEqual([late.entryId]);
    expect(await ids({ holder: colleague.accountId })).toEqual([
      claimed.entryId,
    ]);
    expect(await ids({ holder: "me" })).toEqual([]);
    expect(await ids({ holder: "free" })).not.toContain(claimed.entryId);
    expect(await ids({ holder: "free" })).toContain(plain.entryId);
    expect(await ids({ owner: "none" })).toContain(plain.entryId);
    expect(await ids({ owner: colleague.accountId })).toEqual([]);
    expect(await ids({ alert: "true" })).toEqual([
      flagged.entryId,
      dupDomain.entryId,
      dupName.entryId,
      revised.entryId,
    ]);
    // the period: a window that holds none of them
    expect(
      await ids({
        from: startedAt,
        to: new Date(Date.parse(startedAt) + 60_000).toISOString(),
      }),
    ).toEqual([]);
  });

  it("caps the page and gives a cursor, never an infinite list (15 RG34, CA18)", async () => {
    const server = app();
    const first = await list(server, agent, { limit: 3 });
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(server, agent, {
      limit: 3,
      cursor: first.body.nextCursor ?? "",
    });
    const third = await list(server, agent, {
      limit: 3,
      cursor: second.body.nextCursor ?? "",
    });
    const paged = [
      ...first.body.items,
      ...second.body.items,
      ...third.body.items,
    ];
    expect(paged.map((row) => row.id)).toEqual(
      (await list(server, agent)).body.items.map((row) => row.id),
    );
    expect(third.body.nextCursor).toBeNull();
    for (const params of [
      { limit: 51 },
      { limit: 0 },
      { cursor: "not a cursor!" },
    ] as Record<string, string | number>[]) {
      expect((await list(server, agent, params)).status).toBe(400);
    }
    // a cursor that decodes to nothing is refused, not ignored
    expect(
      (
        await list(server, agent, {
          cursor: Buffer.from("x").toString("base64url"),
        })
      ).status,
    ).toBe(400);
  });

  it("pages the alert filter too, and refuses a filter outside the list (RG33: no filter added)", async () => {
    const server = app();
    const first = await list(server, agent, { alert: "true", limit: 2 });
    expect(first.body.items.map((row) => row.id)).toEqual([
      flagged.entryId,
      dupDomain.entryId,
    ]);
    const next = await list(server, agent, {
      alert: "true",
      limit: 2,
      cursor: first.body.nextCursor ?? "",
    });
    expect(next.body.items.map((row) => row.id)).toEqual([
      dupName.entryId,
      revised.entryId,
    ]);
    expect(next.body.nextCursor).toBeNull();
    expect((await list(server, agent, { sort: "name" })).status).toBe(400);
    expect((await list(server, agent, { export: "csv" })).status).toBe(400);
  });

  it("hides the entries of the accounts the caller holds, and shows them to a colleague (15 RG36, CA19)", async () => {
    const server = app();
    const mine = (await list(server, agent)).body.items.map((row) => row.id);
    const theirs = (await list(server, colleague)).body.items.map(
      (row) => row.id,
    );
    expect(mine).not.toContain(held.entryId);
    expect(theirs).toContain(held.entryId);
    expect(
      (await list(server, admin)).body.items.map((row) => row.id),
    ).toContain(held.entryId);
    // the entry of the caller's own account is hidden by the database (C(3))
    expect(mine).not.toContain(ownEntryId);
  });
});

describe("the counters (15 RG28, RG32, RG38)", () => {
  it("serves the volume, the oldest, those past their deadline, those without a holder, and the delay in clear", async () => {
    const server = app();
    const response = await call(server, "GET", COUNTERS, agent.session);
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      asOf: string;
      queues: {
        queue: string;
        pending: number;
        oldestCreatedAt: string | null;
        overdue: number;
        unclaimed: number;
        lastDecidedAt: string | null;
        policy: Record<string, unknown>;
      }[];
    }>();
    expect(body.queues).toHaveLength(1);
    const [counters] = body.queues;
    expect(counters?.queue).toBe("profiles_advertiser");
    // seven entries of this file wait for the agent: the rest of the queue only adds to it
    expect(counters?.pending).toBeGreaterThanOrEqual(7);
    expect(counters?.overdue).toBeGreaterThanOrEqual(1);
    expect(counters?.unclaimed).toBeGreaterThanOrEqual(6);
    expect(counters?.unclaimed).toBeLessThan(counters?.pending ?? 0);
    expect(Date.parse(counters?.oldestCreatedAt ?? "")).toBeLessThan(
      Date.parse(startedAt),
    );
    expect(counters?.policy).toEqual({
      decisionMinutes: 480,
      claimTargetMinutes: 240,
      escalateAfterMinutes: 960,
      businessHours: true,
    });
  });

  it("counts the queue as the caller sees it: the entry of an account he holds is not counted (RG36)", async () => {
    const server = app();
    const read = async (who: Internal) =>
      (await call(server, "GET", COUNTERS, who.session)).json<{
        queues: { pending: number }[];
      }>().queues[0]?.pending ?? 0;
    // the holder first: an entry that arrives in between can only widen the gap
    const asHolder = await read(agent);
    const asColleague = await read(colleague);
    expect(asColleague - asHolder).toBeGreaterThanOrEqual(1);
  });
});

describe("the opening is the claim (15 C1, C2; CA17; file.md A9, A10)", () => {
  it("takes a free entry: claimed with the token, then held on the second opening, the expiry unchanged", async () => {
    const server = app();
    const first = await opened(server, plain.entryId, agent);
    expect(first.outcome).toBe("claimed");
    expect(first.reviewToken).toMatch(/^[0-9a-f]{64}$/);
    expect(first.entry.claim).toMatchObject({
      holder: { accountId: agent.accountId, displayName: "Camille" },
      heldByCaller: true,
    });
    expect((await entryState(plain.entryId)).claimedBy).toBe(agent.accountId);
    const again = await opened(server, plain.entryId, agent);
    expect(again.outcome).toBe("held");
    expect(again.reviewToken).toBe(first.reviewToken);
    // the list now names the holder
    const row = (await list(server, colleague)).body.items.find(
      (item) => item.id === plain.entryId,
    );
    expect(row?.claim.holder).toEqual({
      accountId: agent.accountId,
      displayName: "Camille",
    });
  });

  it("gives a colleague the read-only view with the name of the holder, no token, no error (C2, CA17)", async () => {
    const server = app();
    const view = await opened(server, claimed.entryId, agent);
    expect(view.outcome).toBe("read_only");
    expect(view.reviewToken).toBeNull();
    expect(view.entry.claim).toMatchObject({
      holder: { accountId: colleague.accountId, displayName: "Marie" },
      heldByCaller: false,
    });
    // reading did not take it
    expect((await entryState(claimed.entryId)).claimedBy).toBe(
      colleague.accountId,
    );
    expect(view.profile.brandName).toBe(claimed.name);
  });

  it("two simultaneous openings of a free entry: one wins, the other reads (invariant 2)", async () => {
    const fresh = await newBrand({ dueIn: "10 hours" });
    const server = app();
    const [first, second] = await Promise.all([
      open(server, fresh.entryId, agent),
      open(server, fresh.entryId, colleague),
    ]);
    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    const outcomes = [first, second]
      .map((response) => response.json<Opened>().outcome)
      .sort();
    expect(outcomes).toEqual(["claimed", "read_only"]);
    const winner =
      first.json<Opened>().outcome === "claimed" ? agent : colleague;
    expect((await entryState(fresh.entryId)).claimedBy).toBe(winner.accountId);
  });

  it("takes an entry whose claim has expired, and writes the abandonment first (A9)", async () => {
    const stale = await newBrand({ dueIn: "11 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries
         set claimed_by_account_id = ${colleague.accountId}, claimed_at = now() - interval '40 minutes',
             claim_expires_at = now() - interval '10 minutes'
       where id = ${stale.entryId}`;
    const server = app();
    const row = (await list(server, agent)).body.items.find(
      (item) => item.id === stale.entryId,
    );
    expect(row?.claim).toMatchObject({ holder: null, heldByCaller: false });
    expect((await opened(server, stale.entryId, agent)).outcome).toBe(
      "claimed",
    );
    const lines = await registerLines(stale.entryId);
    expect(lines.map((line) => line.event)).toEqual([
      "queue.claim_expired",
      "queue.entry_opened",
    ]);
    expect(lines[0]?.payload).toMatchObject({
      queue_code: "profiles_advertiser",
      holder_account_id: colleague.accountId,
    });
  });

  it("answers `closed` for an entry that is no longer open, with no token and no holder (C7)", async () => {
    const done = await newBrand({ dueIn: "12 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now()
       where id = ${done.entryId}`;
    const view = await opened(app(), done.entryId, agent);
    expect(view.outcome).toBe("closed");
    expect(view.reviewToken).toBeNull();
    expect(view.entry).toMatchObject({
      state: "withdrawn",
      claim: { holder: null, heldByCaller: false },
      decision: null,
    });
  });

  it("tells the dispossessed holder, at his next opening, that his claim was lifted (C4, A8)", async () => {
    const lifted = await newBrand({ dueIn: "13 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries
         set forced_release_at = now(), forced_release_by_account_id = ${admin.accountId},
             forced_release_holder_account_id = ${agent.accountId},
             forced_release_reason_code = 'holder_absent'
       where id = ${lifted.entryId}`;
    const server = app();
    const mine = await opened(server, lifted.entryId, agent);
    expect(mine.entry.lastForcedRelease).toMatchObject({
      holderIsCaller: true,
      reasonCode: "holder_absent",
    });
    expect(mine.outcome).toBe("claimed");
    expect(
      (await opened(server, lifted.entryId, colleague)).entry.lastForcedRelease,
    ).toMatchObject({ holderIsCaller: false });
  });
});

describe("the decision view (06 RG9, RG19, RG25, RG66, RG70, L2BS-7, L2BS-8; 15 C6)", () => {
  it("serves the profile, its lists, the contact person and the logos of the examination", async () => {
    const view = await opened(app(), plain.entryId, agent);
    expect(view.profile).toMatchObject({
      brandName: plain.name,
      presentation: PRESENTATION,
      lists: { secondarySectors: ["fashion_accessories"] },
      contact: {
        firstName: plain.contact.firstName,
        email: plain.contact.email,
        phone: plain.contact.phone,
      },
      logos: { active: null, inReview: null },
    });
    expect(view.entry.kind).toBe("submission");
    expect(view.revisions).toEqual([]);
    expect(view.alerts).toEqual([]);
  });

  it("signals a direct contact in the presentation by field and kind, never by the text that matched (CA19)", async () => {
    const view = await opened(app(), flagged.entryId, agent);
    expect(view.alerts).toEqual([
      {
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["email", "phone", "handle"],
      },
      {
        code: "unusual_website_domain",
        field: "advertiser.website_domain",
      },
    ]);
    // the text is served as it is, to be read; the alerts only name it
    expect(view.profile.presentation).toContain("secret.contact@exemple.test");
    expect(JSON.stringify(view.alerts)).not.toContain("secret.contact");
    // the alert refuses nothing: the entry is taken like any other
    expect(view.outcome).toBe("claimed");
  });

  it("alerts to a published brand of the same domain or the same normalised name, and refuses nothing (CA21, RG25, RG70)", async () => {
    const server = app();
    const byDomain = await opened(server, dupDomain.entryId, agent);
    expect(byDomain.alerts).toEqual([
      {
        code: "duplicate_domain",
        matches: [
          { accountId: published.accountId, brandName: published.name },
        ],
      },
    ]);
    expect(byDomain.outcome).toBe("claimed");
    const byName = await opened(server, dupName.entryId, agent);
    expect(byName.alerts).toEqual([
      {
        code: "duplicate_brand",
        matches: [
          { accountId: published.accountId, brandName: published.name },
        ],
      },
    ]);
    expect(byName.outcome).toBe("claimed");
  });

  it("puts the validated and the proposed value side by side, and examines the proposal (06 RG9)", async () => {
    const view = await opened(app(), revised.entryId, agent);
    expect(view.entry.kind).toBe("revision");
    expect(view.revisions).toHaveLength(1);
    expect(view.revisions[0]).toMatchObject({
      fieldCode: "advertiser.presentation",
      validated: { kind: "text", text: PRESENTATION },
      proposed: {
        kind: "text",
        text: "New text, reach us at new.contact@exemple.test",
      },
    });
    // the live row still holds the validated text; the alert reads the proposal
    expect(view.profile.presentation).toBe(PRESENTATION);
    expect(view.alerts).toEqual([
      {
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["email"],
      },
    ]);
  });

  it("lists the refusal reasons with the message the brand will receive, in the brand's language (RG66, C6)", async () => {
    const server = app();
    const english = await opened(server, revised.entryId, agent);
    expect(english.account.preferredLanguage).toBe("en");
    expect(english.reasons.map((reason) => reason.code)).toEqual([
      "contact_in_public_field",
      "presentation_insufficient",
      "logo_non_compliant",
      "misleading_brand_name",
      "sector_inconsistent",
      "illicit_content",
      "duplicate_brand",
      "other",
    ]);
    expect(english.reasons.map((reason) => reason.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      english.reasons.filter((reason) => reason.requiresMemberMessage),
    ).toHaveLength(1);
    const french = await opened(server, plain.entryId, agent);
    expect(french.account.preferredLanguage).toBe("fr");
    const sector = (view: Opened) =>
      view.reasons.find((reason) => reason.code === "sector_inconsistent");
    expect(sector(french)?.message).toBe(
      "Le secteur déclaré ne correspond pas à votre activité.",
    );
    expect(sector(english)?.message).not.toBe(sector(french)?.message);
    expect(sector(english)?.message).toMatch(/sector/i);
    expect(sector(french)?.nextStep).not.toBe("");
  });

  it("journals every opening nominatively, with its outcome and no free text (invariant 7, L2BS-7)", async () => {
    const fresh = await newBrand({ dueIn: "14 hours" });
    const server = app();
    await opened(server, fresh.entryId, agent);
    await opened(server, fresh.entryId, agent);
    await opened(server, fresh.entryId, colleague);
    const lines = await registerLines(fresh.entryId);
    expect(lines.map((line) => [line.event, line.actor])).toEqual([
      ["queue.entry_opened", agent.accountId],
      ["queue.entry_opened", agent.accountId],
      ["queue.entry_opened", colleague.accountId],
    ]);
    expect(lines.map((line) => line.payload)).toEqual([
      { queue_code: "profiles_advertiser", outcome: "claimed" },
      { queue_code: "profiles_advertiser", outcome: "held" },
      { queue_code: "profiles_advertiser", outcome: "read_only" },
    ]);
    // the list and the counters read nothing privileged: no line for them
    await list(server, agent);
    await call(server, "GET", COUNTERS, agent.session);
    expect(await registerLines(fresh.entryId)).toHaveLength(3);
  });
});

describe("a conflict of interest (15 RG36, 13 RG35, 17b §2.5)", () => {
  it("refuses the opening of an entry of an account the caller holds, by its identifier, and does not claim it", async () => {
    const server = app();
    const refused = await open(server, held.entryId, agent);
    expect(refused.statusCode).toBe(403);
    expect(
      refused.json<{ error: { code: string; details: unknown } }>().error,
    ).toMatchObject({
      code: "forbidden",
      details: [{ path: "entry", issue: "conflict_of_interest" }],
    });
    expect((await entryState(held.entryId)).claimedBy).toBeNull();
    // a colleague, and an admin who does not hold the account, open it normally
    expect((await opened(server, held.entryId, colleague)).outcome).toBe(
      "claimed",
    );
    expect((await opened(server, held.entryId, admin)).outcome).toBe(
      "read_only",
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Commit 12: the decisions, the release, the extension and the forced release
// ---------------------------------------------------------------------------------------------

/** The lists the required fields of 06 RG15 ask for, so that an entry of this file can be published. */
async function completeBrand(brand: Brand): Promise<void> {
  const id = brand.accountId;
  await sharedMigrationRole().begin(async (tx) => {
    await tx`insert into profiles.advertiser_target_markets (account_id, slot, country_code) values (${id}, 1, 'FR')`;
    await tx`insert into profiles.advertiser_working_languages (account_id, language_code) values (${id}, 'fr')`;
    await tx`insert into profiles.advertiser_topics (account_id, slot, topic_code) values (${id}, 1, 'travel')`;
    await tx`insert into profiles.advertiser_networks (account_id, network_code) values (${id}, 'instagram')`;
    await tx`insert into profiles.advertiser_formats (account_id, format_code) values (${id}, 'instagram_post')`;
    await tx`insert into profiles.advertiser_audience_countries (account_id, slot, country_code) values (${id}, 1, 'FR')`;
  });
}

/** A complete brand, opened (claimed) by `who`: its entry and the token of the opening. */
async function claimedBrand(
  who: Internal,
  options: BrandOptions = {},
): Promise<{ brand: Brand; token: string }> {
  const brand = await newBrand(options);
  await completeBrand(brand);
  const view = await opened(app(), brand.entryId, who);
  expect(view.outcome).toBe("claimed");
  return { brand, token: view.reviewToken ?? "" };
}

type Action = "publish" | "reject" | "release" | "extend" | "force-release";

function act(
  server: Server,
  who: Internal,
  entryId: string,
  action: Action,
  body?: object,
): Promise<LightMyRequestResponse> {
  return call(server, "POST", `${ENTRIES}/${entryId}/${action}`, who.session, {
    ...(body === undefined ? {} : { body }),
  });
}

type ErrorBody = {
  error: { code: string; details?: { path: string; issue: string }[] };
};

/** The register lines about an account, by event code (the decisions are written on the profile). */
async function profileLines(
  accountId: string,
  codes: string[],
): Promise<
  { event: string; actor: string | null; payload: Record<string, unknown> }[]
> {
  return sharedMigrationRole()<
    {
      event: string;
      actor: string | null;
      payload: Record<string, unknown>;
    }[]
  >`
    select event_type as event, actor_account_id::text as actor, payload
      from audit.audit_events
     where subject_id = ${accountId} and event_type = any(${codes}::text[])
     order by seq`;
}

async function profileStatusOf(accountId: string): Promise<string> {
  const [row] = await sharedMigrationRole()<{ status: string }[]>`
    select status::text as status from profiles.advertiser_profiles where account_id = ${accountId}`;
  return row?.status ?? "";
}

describe("publish (06 RG6, RG65, RG78; 15 C8; file.md A3; 17b §2.6)", () => {
  it("publishes with the token of the opening: the entry and the profile close together, the journal names the agent, the next entry comes back", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "30 hours" });
    const response = await act(server, agent, brand.entryId, "publish", {
      reviewToken: token,
      internalComment: "checked by hand",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<{
      decidedAt: string;
      late: boolean;
      firstPublication: boolean;
      next: { entryId: string } | null;
    }>();
    expect(body).toMatchObject({ late: false, firstPublication: true });
    expect(await entryState(brand.entryId)).toMatchObject({
      state: "published",
    });
    expect(await profileStatusOf(brand.accountId)).toBe("published");
    const [line] = await profileLines(brand.accountId, ["profile.published"]);
    expect(line).toMatchObject({
      actor: agent.accountId,
      payload: { entry_id: brand.entryId, kind: "submission", late: false },
    });
    // the register carries no free text: not the internal comment
    expect(JSON.stringify(line)).not.toContain("checked by hand");
    // the entry to open next: the oldest deadline that nobody holds and the caller may treat
    const [expected] = await sharedMigrationRole()<{ id: string }[]>`
      select e.id::text as id
        from profiles.advertiser_review_entries e
        join identity.accounts a on a.id = e.account_id
       where e.state = 'open' and e.account_id <> ${agent.accountId}
         and a.owner_agent_id is distinct from ${agent.accountId}::uuid
         and not (e.claimed_by_account_id is not null and e.claim_expires_at > now())
       order by e.sla_due_at, e.created_at, e.id
       limit 1`;
    expect(body.next?.entryId ?? null).toBe(expected?.id ?? null);
    expect(body.next?.entryId).not.toBe(brand.entryId);
  });

  it("answers 409 `entry_closed` to a second decision on the same entry", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "31 hours" });
    await act(server, agent, brand.entryId, "publish", { reviewToken: token });
    const again = await act(server, agent, brand.entryId, "publish", {
      reviewToken: token,
    });
    expect(again.statusCode).toBe(409);
    expect(again.json<ErrorBody>().error).toMatchObject({
      code: "conflict",
      details: [{ path: "entry", issue: "entry_closed" }],
    });
    expect(
      await profileLines(brand.accountId, ["profile.published"]),
    ).toHaveLength(1);
  });

  it("marks a decision made after its deadline, and does not block it (15 C8)", async () => {
    const { brand, token } = await claimedBrand(agent, { dueIn: "-5 hours" });
    const response = await act(app(), agent, brand.entryId, "publish", {
      reviewToken: token,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ late: boolean }>().late).toBe(true);
    const [line] = await profileLines(brand.accountId, ["profile.published"]);
    expect(line?.payload).toMatchObject({ late: true });
  });

  it("refuses a stale token (L2BS-1): the profile changed after the opening; the agent reads again, then publishes", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "32 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_profiles
         set presentation = ${`${PRESENTATION} One sentence more, written after the opening.`}
       where account_id = ${brand.accountId}`;
    const stale = await act(server, agent, brand.entryId, "publish", {
      reviewToken: token,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<ErrorBody>().error.details).toEqual([
      { path: "entry", issue: "stale_token" },
    ]);
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
    const fresh = await opened(server, brand.entryId, agent);
    expect(fresh.outcome).toBe("held");
    expect(fresh.reviewToken).not.toBe(token);
    const done = await act(server, agent, brand.entryId, "publish", {
      reviewToken: fresh.reviewToken,
    });
    expect(done.statusCode, done.body).toBe(200);
  });

  it("refuses a profile whose required field is missing, naming the field, and changes nothing", async () => {
    const server = app();
    // no list at all: the first missing required field of the form is the target markets
    const brand = await newBrand({ dueIn: "33 hours" });
    const view = await opened(server, brand.entryId, agent);
    const response = await act(server, agent, brand.entryId, "publish", {
      reviewToken: view.reviewToken,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorBody>().error.details).toEqual([
      { path: "target_markets", issue: "required_field_missing" },
    ]);
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
    expect(await profileStatusOf(brand.accountId)).toBe("pending_review");
    expect(await profileLines(brand.accountId, ["profile.published"])).toEqual(
      [],
    );
  });

  it("refuses a token that is not 64 hexadecimal characters, an unknown field and an over-long comment before any lookup", async () => {
    const server = app();
    const { brand } = await claimedBrand(agent, { dueIn: "34 hours" });
    for (const body of [
      {},
      { reviewToken: "abc" },
      { reviewToken: ANY_TOKEN, internalComment: "x".repeat(1001) },
      { reviewToken: ANY_TOKEN, internalComment: "" },
      { reviewToken: ANY_TOKEN, decidedBy: agent.accountId },
    ]) {
      const response = await act(server, agent, brand.entryId, "publish", body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
    }
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
  });
});

describe("reject (06 RG65, RG66; 15 C6; CA19, CA20)", () => {
  it("refuses with a typed reason: the entry and the profile are refused, the register carries the code and no text", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "35 hours" });
    const response = await act(server, agent, brand.entryId, "reject", {
      reviewToken: token,
      reasonCode: "presentation_insufficient",
      internalComment: "too short for what it sells",
    });
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json<{ late: boolean; next: unknown }>();
    expect(body.late).toBe(false);
    expect(body).toHaveProperty("next");
    expect(await entryState(brand.entryId)).toMatchObject({
      state: "rejected",
    });
    expect(await profileStatusOf(brand.accountId)).toBe("rejected");
    const [line] = await profileLines(brand.accountId, ["profile.rejected"]);
    expect(line).toMatchObject({
      actor: agent.accountId,
      payload: {
        entry_id: brand.entryId,
        reason_code: "presentation_insufficient",
      },
    });
    expect(JSON.stringify(line)).not.toContain("too short");
    // the entry keeps what the agent wrote: the internal comment is theirs alone
    const [row] = await sharedMigrationRole()<
      { member_message: string | null; internal_comment: string | null }[]
    >`select member_message, internal_comment from profiles.advertiser_review_entries
       where id = ${brand.entryId}`;
    expect(row).toEqual({
      member_message: null,
      internal_comment: "too short for what it sells",
    });
  });

  it("refuses a refusal without a typed reason: absent, outside the closed list, or a message where the reason takes none", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "36 hours" });
    const cases: [object, string, string | null][] = [
      [{ reviewToken: token }, "reasonCode", null],
      [{ reviewToken: token, reasonCode: "because" }, "reasonCode", null],
      [
        {
          reviewToken: token,
          reasonCode: "presentation_insufficient",
          memberMessage: "A message that this reason does not take at all.",
        },
        "memberMessage",
        "invalid_member_message",
      ],
      // "Autre" asks for its text (06 RG66)
      [
        { reviewToken: token, reasonCode: "other" },
        "memberMessage",
        "invalid_member_message",
      ],
    ];
    for (const [body, path, issue] of cases) {
      const response = await act(server, agent, brand.entryId, "reject", body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      const details = response.json<ErrorBody>().error.details ?? [];
      expect(
        details.some((detail) => detail.path === path),
        JSON.stringify(body),
      ).toBe(true);
      if (issue !== null) {
        expect(details).toContainEqual({ path, issue });
      }
    }
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
    expect(await registerLines(brand.entryId)).toHaveLength(1);
  });

  it("takes the agent's own message for `other`, and refuses one that holds a direct contact (RG19, RG158)", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "37 hours" });
    for (const message of [
      "Please write to us at secret.contact@exemple.test to discuss it.",
      "Your offer lives on another site: https://exemple.test/shop today.",
      "Merci de nous appeler au 06 12 34 56 78 pour en discuter aujourd'hui.",
    ]) {
      const refused = await act(server, agent, brand.entryId, "reject", {
        reviewToken: token,
        reasonCode: "other",
        memberMessage: message,
      });
      expect(refused.statusCode, message).toBe(400);
      expect(refused.json<ErrorBody>().error.details).toEqual([
        { path: "memberMessage", issue: "direct_contact" },
      ]);
      // never echoed back
      expect(refused.body).not.toContain("exemple.test");
    }
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
    const accepted = await act(server, agent, brand.entryId, "reject", {
      reviewToken: token,
      reasonCode: "other",
      memberMessage:
        "Please describe what your brand sells, in your own words.",
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    const [row] = await sharedMigrationRole()<
      { member_message: string | null }[]
    >`
      select member_message from profiles.advertiser_review_entries where id = ${brand.entryId}`;
    expect(row?.member_message).toBe(
      "Please describe what your brand sells, in your own words.",
    );
  });

  it("refuses a stale token on a refusal too, and keeps the entry open (L2BS-1)", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "38 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_profiles set contact_role = 'executive'
       where account_id = ${brand.accountId}`;
    const stale = await act(server, agent, brand.entryId, "reject", {
      reviewToken: token,
      reasonCode: "sector_inconsistent",
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json<ErrorBody>().error.details).toEqual([
      { path: "entry", issue: "stale_token" },
    ]);
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
  });
});

describe("the lock on a decision (15 C2, C3; CA17, CA18, RG6)", () => {
  it("CA17: a second agent reads, and cannot decide: 409 with the name of the holder, nothing changed", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "39 hours" });
    // the colleague reads the entry: read only, no token (C2)
    const view = await opened(server, brand.entryId, colleague);
    expect(view.outcome).toBe("read_only");
    expect(view.reviewToken).toBeNull();
    for (const [action, body] of [
      ["publish", { reviewToken: token }],
      ["reject", { reviewToken: token, reasonCode: "illicit_content" }],
      ["extend", undefined],
      ["release", undefined],
    ] as const) {
      const response = await act(
        server,
        colleague,
        brand.entryId,
        action,
        body,
      );
      expect(response.statusCode, action).toBe(409);
      expect(response.json<ErrorBody>().error.details, action).toEqual([
        { path: "claim", issue: "held_by_other" },
        { path: "claim.holder", issue: agent.name },
      ]);
    }
    expect(await entryState(brand.entryId)).toEqual({
      claimedBy: agent.accountId,
      state: "open",
    });
    // an administrator is no exception: the decision belongs to the holder
    expect(
      (
        await act(server, admin, brand.entryId, "publish", {
          reviewToken: token,
        })
      ).statusCode,
    ).toBe(409);
  });

  it("CA18: an expired claim decides no more: 409 `claim_not_held`; the entry is free again and another agent takes it", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(agent, { dueIn: "40 hours" });
    // the test clock: the claim expired ten minutes ago
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries
         set claimed_at = now() - interval '40 minutes',
             claim_expires_at = now() - interval '10 minutes'
       where id = ${brand.entryId}`;
    for (const [action, body] of [
      ["publish", { reviewToken: token }],
      ["reject", { reviewToken: token, reasonCode: "illicit_content" }],
      ["extend", undefined],
      ["release", undefined],
    ] as const) {
      const response = await act(server, agent, brand.entryId, action, body);
      expect(response.statusCode, action).toBe(409);
      expect(response.json<ErrorBody>().error.details, action).toEqual([
        { path: "claim", issue: "claim_not_held" },
      ]);
    }
    expect(await profileStatusOf(brand.accountId)).toBe("pending_review");
    expect((await opened(server, brand.entryId, colleague)).outcome).toBe(
      "claimed",
    );
  });

  it("a released entry answers `claim_not_held`, a closed one `entry_closed`, to every act", async () => {
    const server = app();
    const { brand } = await claimedBrand(agent, { dueIn: "41 hours" });
    expect(
      (await act(server, agent, brand.entryId, "release")).statusCode,
    ).toBe(200);
    const released = await act(server, agent, brand.entryId, "extend");
    expect(released.statusCode).toBe(409);
    expect(released.json<ErrorBody>().error.details).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries set state = 'withdrawn', closed_at = now()
       where id = ${brand.entryId}`;
    for (const [action, body] of [
      ["publish", { reviewToken: ANY_TOKEN }],
      ["release", undefined],
      ["extend", undefined],
    ] as const) {
      const response = await act(server, agent, brand.entryId, action, body);
      expect(response.statusCode, action).toBe(409);
      expect(response.json<ErrorBody>().error.details, action).toEqual([
        { path: "entry", issue: "entry_closed" },
      ]);
    }
  });
});

describe("release and extension (15 C3; file.md A9)", () => {
  it("the holder gives the entry back: free in the queue, journaled without text, and a colleague takes it", async () => {
    const server = app();
    const { brand } = await claimedBrand(agent, { dueIn: "42 hours" });
    const response = await act(server, agent, brand.entryId, "release");
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ released: true });
    expect(await entryState(brand.entryId)).toEqual({
      claimedBy: null,
      state: "open",
    });
    const lines = await registerLines(brand.entryId);
    expect(lines.map((line) => line.event)).toEqual([
      "queue.entry_opened",
      "queue.claim_released",
    ]);
    expect(lines[1]).toMatchObject({
      actor: agent.accountId,
      payload: { queue_code: "profiles_advertiser" },
    });
    expect((await opened(server, brand.entryId, colleague)).outcome).toBe(
      "claimed",
    );
  });

  it("the holder takes the delay again: a later expiry, journaled", async () => {
    const server = app();
    const { brand } = await claimedBrand(agent, { dueIn: "43 hours" });
    await sharedMigrationRole()`
      update profiles.advertiser_review_entries
         set claim_expires_at = now() + interval '2 minutes'
       where id = ${brand.entryId}`;
    const response = await act(server, agent, brand.entryId, "extend");
    expect(response.statusCode, response.body).toBe(200);
    const { claimExpiresAt } = response.json<{ claimExpiresAt: string }>();
    expect(Date.parse(claimExpiresAt) - Date.now()).toBeGreaterThan(
      10 * 60 * 1000,
    );
    const view = await opened(server, brand.entryId, agent);
    expect(view.outcome).toBe("held");
    expect(view.entry.claim.heldByCaller).toBe(true);
    expect(
      (await registerLines(brand.entryId)).map((line) => line.event),
    ).toContain("queue.claim_extended");
  });
});

describe("the forced release (15 C4, CA63; file.md A8)", () => {
  it("an administrator lifts a live claim with a typed reason: journaled, the holder named; his next act is told it was lifted", async () => {
    const server = app();
    const { brand, token } = await claimedBrand(colleague, {
      dueIn: "44 hours",
    });
    const response = await act(server, admin, brand.entryId, "force-release", {
      reasonCode: "holder_absent",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      released: true,
      holder: { accountId: colleague.accountId, displayName: colleague.name },
    });
    expect(await entryState(brand.entryId)).toEqual({
      claimedBy: null,
      state: "open",
    });
    const lines = await registerLines(brand.entryId);
    expect(lines.at(-1)).toMatchObject({
      event: "queue.claim_forced_release",
      actor: admin.accountId,
      payload: {
        queue_code: "profiles_advertiser",
        holder_account_id: colleague.accountId,
        reason_code: "holder_absent",
      },
    });
    // the dispossessed holder: his decision is refused with the notice, the opening shows it (A8)
    const late = await act(server, colleague, brand.entryId, "publish", {
      reviewToken: token,
    });
    expect(late.statusCode).toBe(409);
    expect(late.json<ErrorBody>().error.details).toEqual([
      { path: "claim", issue: "claim_lifted" },
    ]);
    expect(
      (await opened(server, brand.entryId, colleague)).entry.lastForcedRelease,
    ).toMatchObject({ holderIsCaller: true, reasonCode: "holder_absent" });
  });

  it("an agent who tries is refused 403 and the attempt is journaled; the claim stands (CA63)", async () => {
    const server = app();
    const { brand } = await claimedBrand(colleague, { dueIn: "45 hours" });
    const response = await act(server, agent, brand.entryId, "force-release", {
      reasonCode: "holder_absent",
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<ErrorBody>().error.code).toBe("forbidden");
    expect((await entryState(brand.entryId)).claimedBy).toBe(
      colleague.accountId,
    );
    const attempts = await sharedMigrationRole()<
      { payload: Record<string, unknown>; actor: string | null }[]
    >`
      select payload, actor_account_id::text as actor from audit.audit_events
       where event_type = 'backoffice.action_refused' and subject_id = ${agent.accountId}
         and payload ->> 'action_code' = 'queue.force_release_claim'`;
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    expect(attempts[0]).toMatchObject({
      actor: agent.accountId,
      payload: { required_role: "admin" },
    });
    // the same refusal whatever the entry: no probe through the identifier (T14.3)
    expect(
      answer(
        await act(server, agent, randomUUID(), "force-release", {
          reasonCode: "holder_absent",
        }),
      ),
    ).toEqual(answer(response));
  });

  it("asks for a reason of the closed list, and lifts nothing that is not held", async () => {
    const server = app();
    const brand = await newBrand({ dueIn: "46 hours" });
    for (const body of [
      {},
      { reasonCode: "because" },
      { reasonCode: "holder_absent", comment: "x" },
    ]) {
      expect(
        (await act(server, admin, brand.entryId, "force-release", body))
          .statusCode,
        JSON.stringify(body),
      ).toBe(400);
    }
    const free = await act(server, admin, brand.entryId, "force-release", {
      reasonCode: "wrong_claim",
    });
    expect(free.statusCode).toBe(409);
    expect(free.json<ErrorBody>().error.details).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
  });
});

describe("a conflict of interest on a decision (15 RG36, CA19; 13 RG35)", () => {
  it("refuses to decide or extend an entry of an account the caller holds: 403 `conflict_of_interest`, nothing written; a colleague decides it", async () => {
    const server = app();
    const brand = await newBrand({
      owner: agent.accountId,
      dueIn: "47 hours",
    });
    await completeBrand(brand);
    const colleagueView = await opened(server, brand.entryId, colleague);
    for (const [action, body] of [
      ["publish", { reviewToken: colleagueView.reviewToken }],
      [
        "reject",
        {
          reviewToken: colleagueView.reviewToken,
          reasonCode: "illicit_content",
        },
      ],
      ["extend", undefined],
    ] as const) {
      const response = await act(server, agent, brand.entryId, action, body);
      expect(response.statusCode, action).toBe(403);
      expect(response.json<ErrorBody>().error).toMatchObject({
        code: "forbidden",
        details: [{ path: "entry", issue: "conflict_of_interest" }],
      });
    }
    expect(await entryState(brand.entryId)).toEqual({
      claimedBy: colleague.accountId,
      state: "open",
    });
    // not a refusal of the entry: the colleague who holds the claim publishes it
    const done = await act(server, colleague, brand.entryId, "publish", {
      reviewToken: colleagueView.reviewToken,
    });
    expect(done.statusCode, done.body).toBe(200);
  });

  it("an unknown entry and the one of the caller's own account answer the same 404 on every act", async () => {
    const server = app();
    for (const [action, body] of ACTIONS) {
      if (action === "force-release") continue;
      const unknown = await act(server, agent, randomUUID(), action, body);
      expect(unknown.statusCode, action).toBe(404);
      expect(
        answer(await act(server, agent, ownEntryId, action, body)),
        action,
      ).toEqual(answer(unknown));
    }
    expect((await entryState(ownEntryId)).claimedBy).toBeNull();
  });
});

describe("only a human decision publishes (06 RG6)", () => {
  it("a member session reaches none of the acts, and a token is no capability for a colleague", async () => {
    const server = app();
    const member = await newMemberSession();
    const { brand, token } = await claimedBrand(agent, { dueIn: "48 hours" });
    for (const [action, body] of ACTIONS) {
      const response = await call(
        server,
        "POST",
        `${ENTRIES}/${brand.entryId}/${action}`,
        member,
        body === undefined ? {} : { body },
      );
      expect(response.statusCode, action).toBe(401);
    }
    expect(await entryState(brand.entryId)).toMatchObject({ state: "open" });
    expect(await profileStatusOf(brand.accountId)).toBe("pending_review");
    // the token is no capability: a colleague holding the right token still cannot decide
    expect(
      (
        await act(server, colleague, brand.entryId, "publish", {
          reviewToken: token,
        })
      ).statusCode,
    ).toBe(409);
  });
});

// ---------------------------------------------------------------------------------------------
// Commit 18b: the logo of an entry (founder's decision of 2026-11-05; 0213; stockage.md §4)
// ---------------------------------------------------------------------------------------------

/** Storage in memory: what the route reads by the key of the database, and what it was asked for. */
function memoryStore(
  objects: Map<string, Uint8Array>,
  mode: { unavailable: boolean } = { unavailable: false },
): ObjectStore & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    write: async () => ({ ok: true, value: null }),
    remove: async () => ({ ok: true, value: null }),
    read: async (_bucket, key) => {
      asked.push(key);
      return mode.unavailable
        ? { ok: false, reason: "unavailable", status: 503, errorCode: null }
        : { ok: true, value: objects.get(key) ?? null };
    },
  };
}

/** A logo of the brand, its object stored in `objects` under the key the database generated. */
async function newLogo(
  brand: Brand,
  state: "active" | "in_review",
  objects: Map<string, Uint8Array> | null,
): Promise<{ id: string; key: string; bytes: Uint8Array }> {
  const bytes = randomBytes(1500);
  const [row] = await sharedMigrationRole()<
    { id: string; object_key: string }[]
  >`
    insert into profiles.brand_logo_objects
      (account_id, state, received_bytes, byte_size, width, height, activated_at)
    values (${brand.accountId}, ${state}::profiles.brand_logo_state, 4000, ${bytes.length},
            512, 480, ${state === "active" ? new Date() : null})
    returning id::text, object_key`;
  const id = row?.id ?? "";
  const key = row?.object_key ?? "";
  objects?.set(key, bytes);
  return { id, key, bytes };
}

type LogoBody = {
  state: string;
  logo: {
    contentType: string;
    width: number;
    height: number;
    byteSize: number;
    data: string;
    updatedAt: string;
  };
};

function readLogo(
  server: Server,
  entryId: string,
  logoId: string,
  who: Internal,
): Promise<LightMyRequestResponse> {
  return call(
    server,
    "GET",
    `${ENTRIES}/${entryId}/logo?logo=${logoId}`,
    who.session,
  );
}

async function logoLines(entryId: string) {
  return (await registerLines(entryId)).filter(
    (line) => line.event === "queue.logo_read",
  );
}

describe("the logo of an entry (06 RG9, RG15; 15 RG36, C2; invariants 7, 11, 13; stockage.md §4)", () => {
  it("serves the logo the view named, as the member route does, to the holder, a colleague and an admin, and writes one nominative line per read, never the key", async () => {
    const objects = new Map<string, Uint8Array>();
    const store = memoryStore(objects);
    const server = app(store);
    const brand = await newBrand({ dueIn: "30 hours" });
    const active = await newLogo(brand, "active", objects);
    const proposed = await newLogo(brand, "in_review", objects);

    // the ids come from the decision view (the holder opens it), the images from this route
    const view = await opened(server, brand.entryId, agent);
    const shown = view.profile.logos as {
      active: { id: string } | null;
      inReview: { id: string } | null;
    };
    expect(shown.active?.id).toBe(active.id);
    expect(shown.inReview?.id).toBe(proposed.id);

    const reads: [Internal, typeof active, string][] = [
      [agent, active, "active"],
      [colleague, proposed, "in_review"],
      [admin, active, "active"],
    ];
    for (const [who, logo, state] of reads) {
      const response = await readLogo(server, brand.entryId, logo.id, who);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const body = response.json<LogoBody>();
      expect(body.state).toBe(state);
      expect(body.logo).toMatchObject({
        contentType: "image/webp",
        width: 512,
        height: 480,
        byteSize: logo.bytes.length,
      });
      expect(
        Buffer.from(body.logo.data, "base64").equals(Buffer.from(logo.bytes)),
      ).toBe(true);
      // the closed answer: no key, no account, no address of Storage, no token (T9.2 as D80 amends it)
      expect(Object.keys(body).sort()).toEqual(["logo", "state"]);
      for (const forbidden of [
        logo.key,
        brand.accountId,
        "supabase",
        "token",
        "http",
      ]) {
        expect(response.body.toLowerCase(), forbidden).not.toContain(
          forbidden.toLowerCase(),
        );
      }
    }
    // the object is asked for by the key of the database, nothing else
    expect(store.asked).toEqual([active.key, proposed.key, active.key]);

    // one line per read, the opening's line apart
    const lines = await logoLines(brand.entryId);
    const payload = (logo: { id: string }, state: string) => ({
      queue_code: "profiles_advertiser",
      logo_id: logo.id,
      state,
    });
    expect(lines.map((line) => [line.actor, line.payload])).toEqual([
      [agent.accountId, payload(active, "active")],
      [colleague.accountId, payload(proposed, "in_review")],
      [admin.accountId, payload(active, "active")],
    ]);
    expect(JSON.stringify(lines)).not.toContain(active.key);
  });

  it("T14.3, T14.4: an unknown entry, the caller's own account, an unknown logo and another account's logo answer alike, and leave no line", async () => {
    const objects = new Map<string, Uint8Array>();
    const server = app(memoryStore(objects));
    const brand = await newBrand({ dueIn: "31 hours" });
    const other = await newBrand({ dueIn: "32 hours" });
    const mine = await newLogo(brand, "active", objects);
    const foreign = await newLogo(other, "active", objects);
    const purging = await newLogo(brand, "in_review", objects);
    await sharedMigrationRole()`
      update profiles.brand_logo_objects
         set state = 'purging', purge_requested_at = now() where id = ${purging.id}`;

    const unknown = await readLogo(server, randomUUID(), mine.id, agent);
    expect(unknown.statusCode).toBe(404);
    const cases: [string, LightMyRequestResponse][] = [
      ["own account", await readLogo(server, ownEntryId, mine.id, agent)],
      [
        "unknown logo",
        await readLogo(server, brand.entryId, randomUUID(), agent),
      ],
      [
        "logo of another account",
        await readLogo(server, brand.entryId, foreign.id, agent),
      ],
      [
        "entry of another account",
        await readLogo(server, other.entryId, mine.id, agent),
      ],
      [
        "logo that is neither active nor in review",
        await readLogo(server, brand.entryId, purging.id, agent),
      ],
    ];
    for (const [name, response] of cases) {
      expect(answer(response), name).toEqual(answer(unknown));
    }
    for (const entryId of [brand.entryId, other.entryId, ownEntryId]) {
      expect(await logoLines(entryId)).toEqual([]);
    }
  });

  it("refuses a logo that is not named, not an identifier, or a query that is not the route's, before any lookup", async () => {
    const server = app(memoryStore(new Map()));
    const brand = await newBrand({ dueIn: "33 hours" });
    for (const query of [
      "",
      "?logo=not-an-id",
      `?logo=${NIL}&key=a`,
      `?other=${NIL}`,
    ]) {
      const response = await call(
        server,
        "GET",
        `${ENTRIES}/${brand.entryId}/logo${query}`,
        agent.session,
      );
      expect(response.statusCode, query).toBe(400);
    }
    const badEntry = await call(
      server,
      "GET",
      `${ENTRIES}/not-an-id/logo?logo=${NIL}`,
      agent.session,
    );
    expect(badEntry.statusCode).toBe(400);
    expect(await registerLines(brand.entryId)).toEqual([]);
  });

  it("RG36: the logo of an entry of an account the caller holds answers 403 `conflict_of_interest`, with no line and no read of Storage; a colleague reads it", async () => {
    const objects = new Map<string, Uint8Array>();
    const store = memoryStore(objects);
    const server = app(store);
    const mine = await newBrand({ owner: agent.accountId, dueIn: "34 hours" });
    const logo = await newLogo(mine, "active", objects);

    const refused = await readLogo(server, mine.entryId, logo.id, agent);
    expect(refused.statusCode).toBe(403);
    expect(
      refused.json<{ error: { code: string; details: unknown } }>().error,
    ).toMatchObject({
      code: "forbidden",
      details: [{ path: "entry", issue: "conflict_of_interest" }],
    });
    expect(store.asked).toEqual([]);
    expect(await registerLines(mine.entryId)).toEqual([]);
    const allowed = await readLogo(server, mine.entryId, logo.id, colleague);
    expect(allowed.statusCode).toBe(200);
    expect(store.asked).toEqual([logo.key]);
  });

  it("says Storage is unavailable (503) and that an object it does not hold is not there (404), never a key or a byte", async () => {
    const brand = await newBrand({ dueIn: "35 hours" });
    const missing = await newLogo(brand, "active", null);
    const gone = await readLogo(
      app(memoryStore(new Map())),
      brand.entryId,
      missing.id,
      agent,
    );
    expect(gone.statusCode).toBe(404);
    expect(gone.body).not.toContain(missing.key);

    const objects = new Map<string, Uint8Array>();
    const stored = await newLogo(brand, "in_review", objects);
    const down = await readLogo(
      app(memoryStore(objects, { unavailable: true })),
      brand.entryId,
      stored.id,
      agent,
    );
    expect(down.statusCode).toBe(503);
    expect(down.body).not.toContain(stored.key);
  });
});
