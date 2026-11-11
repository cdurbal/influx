// T14 (L2G, commit 11) — the queue API of the backoffice on queue 2, « profils créateur à valider », and
// queue 3, « visuels de portfolio à modérer », on the local stack through the pools of apps/api (docs/mvp/
// 07 RG4 to RG10, RG77 to RG83, RG93 to RG99; 15 RG26 to RG28, RG33 to RG36, C1 to C8, CA18, CA19, CA63;
// 18 T14.1 to T14.4; jalons/l2g/modele.md §3 "0244", §6; l2g-fiche invariants 1, 5, 7, 10, 13, 14;
// migrations 0242, 0243, 0244):
//   GET and POST …/search on both lists, POST …/:id/open, …/release, …/extend, …/force-release,
//   publish and reject (queue 2), approve and reject (queue 3), and the journaled read of a visual.
// T14 on each route: the web surface, no session and a member session never reach them (the inventory of
// t14-backoffice-route-inventory.test.ts); an entry that does not exist and the one of the caller's own
// account answer the same 404 (there too); here, the claim, the token, the account the caller holds, the
// role of an administrator and the refusals of the database as the API answers them.
// The fixtures (agents, an admin, creators with their entries and visuals) are COMMITTED by the migration
// role (random identifiers, disposable local stack, like T14 of J8) and removed after the file. Every list
// is read from a window around the instant given to the entries of this file (`base`, 400 days back): the
// entries of other files and of earlier runs never enter the expectations. No handle, caption nor title
// typed here is searched in the logs by anything but its value (D60).
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
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
} from "../tests/helpers.ts";
import { localSuperuser, letterName, sharedMigrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";
const CREATORS = "/v1/bo/queues/profiles-creator/entries";
const VISUALS = "/v1/bo/queues/portfolio-moderation/entries";
const ANY_TOKEN = "0".repeat(64);
const HEADLINE = "Créatrice de recettes végétales de saison";
const BIO =
  "Je partage chaque semaine des recettes de saison, des idées de repas simples et des astuces de cuisine. ".repeat(
    2,
  );

let database: ApiDatabase;
/** The creation instant of every entry of this file and the window of the period filter around it. */
let base: string;
let windowFrom: string;
let windowTo: string;
const internals: string[] = [];
const creators: string[] = [];
const logStreams: (() => string)[] = [];
/** Values typed in this file that no log may hold (D60). */
const watched: string[] = [];

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
      values (${accountId}, ${randomUUID()}, ${`t14-creator-${role}-${accountId}@example.test`},
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
      values (${accountId}, ${randomUUID()}, ${`t14-creator-member-${accountId}@example.test`},
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

type CreatorOptions = {
  country?: string;
  language?: "fr" | "en";
  owner?: string;
  /** `submission`: a profile waiting for its first publication; `revision`: a published profile that changed. */
  entry?: "submission" | "revision";
  headline?: string;
  bio?: string;
  handle?: string;
  /** Pending visuals deposited, each with the caption given (or none). */
  captions?: (string | null)[];
  /** A pending revision of the headline, written as the creator door of 0243 would. */
  revisedHeadline?: string;
  /** A « Compte vérifié » active on the line. */
  verified?: boolean;
  /** The deadline of the entry, as an interval from now (negative: past). */
  dueIn?: string;
};

type Creator = {
  accountId: string;
  alias: string;
  entryId: string;
  lineId: string;
  handle: string;
  visuals: string[];
};

/** A committed creator with its storefront, its line, its open entry and its pending visuals. */
async function newCreator(options: CreatorOptions = {}): Promise<Creator> {
  const accountId = randomUUID();
  const entryId = randomUUID();
  const handle =
    options.handle ?? `cuisine_${letterName(accountId.slice(0, 8))}`;
  const kind = options.entry ?? "submission";
  watched.push(handle);
  if (options.revisedHeadline !== undefined) {
    watched.push(options.revisedHeadline);
  }
  const visuals: string[] = [];
  let alias = "";
  let lineId = "";
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-creator-member-${accountId}@example.test`},
              now(), ${options.country ?? "FR"}, ${options.language ?? "fr"}, true, now(),
              'individual', ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
    const [profile] = await tx<{ alias: string }[]>`
      insert into profiles.creator_public_profiles
        (account_id, alias, residence_country_code, status, published_at, headline, bio,
         primary_topic_code, availability_band)
      values (${accountId}, profiles.new_creator_alias(), ${options.country ?? "FR"},
              ${kind === "revision" ? "published" : "pending_review"}::profiles.creator_profile_status,
              ${kind === "revision" ? new Date() : null}, ${options.headline ?? HEADLINE},
              ${options.bio ?? BIO}, 'food', 'lt_1m')
      returning alias`;
    alias = profile?.alias ?? "";
    const [line] = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, figures_measured_at)
      values (${accountId}, 'instagram', true, ${handle},
              ${`https://www.instagram.com/${handle}`}, 48000, 12, 30, now())
      returning id::text`;
    lineId = line?.id ?? "";
    await tx`
      insert into profiles.creator_review_entries (id, account_id, kind)
      values (${entryId}, ${accountId}, ${kind}::profiles.review_entry_kind)`;
    await tx`
      update profiles.creator_review_entries
         set created_at = ${base}::timestamptz,
             sla_due_at = case when ${options.dueIn ?? null}::text is null then sla_due_at
                               else now() + (${options.dueIn ?? null}::text)::interval end,
             escalate_at = case when ${options.dueIn ?? null}::text is null then escalate_at
                                else now() + (${options.dueIn ?? null}::text)::interval
                                     + interval '1 day' end
       where id = ${entryId}`;
    for (const caption of options.captions ?? [null, null, null]) {
      const [visual] = await tx<{ id: string }[]>`
        insert into profiles.portfolio_items
          (account_id, state, received_bytes, byte_size, width, height, checksum, exif_stripped,
           stored_at, caption)
        values (${accountId}, 'pending', 500000, 400000, 1080, 1350,
                ${createHash("sha256").update(randomBytes(16)).digest("hex")}, true,
                ${base}::timestamptz, ${caption})
        returning id::text`;
      visuals.push(visual?.id ?? "");
      if (caption !== null) watched.push(caption);
    }
    if (options.revisedHeadline !== undefined) {
      await tx`
        insert into profiles.creator_field_revisions
          (account_id, field_code, proposed_value, creator_review_entry_id)
        values (${accountId}, 'creator.headline', ${options.revisedHeadline}::jsonb,
                ${entryId})`;
    }
    if (options.verified === true) {
      const [request] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status)
        values (${accountId}, ${lineId}, 'instagram', 'account_verified', 'pending')
        returning id::text`;
      await tx`
        update verification.verification_requests
           set status = 'approved', decided_by_account_id = ${internals[0] ?? null},
               decided_at = now(), closed_at = now()
         where id = ${request?.id ?? null}`;
      await tx`
        insert into verification.badges
          (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
           granted_at, evidence_source, observed_handle_at_decision)
        values (${accountId}, ${lineId}, 'instagram', ${request?.id ?? null}, 'account_verified',
                ${internals[0] ?? null}, now(), 'public_profile', ${handle})`;
    }
  });
  creators.push(accountId);
  return { accountId, alias, entryId, lineId, handle, visuals };
}

function app(storage?: ObjectStore) {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
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
  body?: object,
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-ops-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

/** The whole answer but its request id (18 T14.4). */
function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

type Issue = { path: string; issue: string };
function issuesOf(response: LightMyRequestResponse): Issue[] {
  return (
    response.json<{ error?: { details?: Issue[] } }>().error?.details ?? []
  );
}

type Claim = {
  holder: { accountId: string; displayName: string | null } | null;
  heldByCaller: boolean;
};
type CreatorRow = {
  id: string;
  accountId: string;
  kind: string;
  overdue: boolean;
  alias: string;
  countryCode: string;
  networks: string[];
  badges: { networkCode: string; level: string }[];
  modifiedFields: string[];
  claim: Claim;
  alerts: string[];
};
type ListBody<Row> = {
  asOf: string;
  counters: {
    queue: string;
    pending: number;
    unclaimed: number;
    policy: Record<string, unknown>;
  } | null;
  items: Row[];
  nextCursor: string | null;
};

async function list<Row = CreatorRow>(
  server: Server,
  base_: string,
  who: Internal,
  params: Record<string, string | number> = {},
): Promise<{ status: number; body: ListBody<Row>; raw: string }> {
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
    `${base_}?${query.toString()}`,
    who.session,
  );
  return {
    status: response.statusCode,
    body: response.json<ListBody<Row>>(),
    raw: response.body,
  };
}

type OpenedCreator = {
  outcome: string;
  reviewToken: string | null;
  entry: { state: string; kind: string; claim: Claim; decision: unknown };
  account: { id: string; preferredLanguage: string };
  profile: {
    alias: string;
    headline: string | null;
    lines: {
      id: string;
      handle: string | null;
      listed: boolean;
      badge: string | null;
    }[];
    visuals: { id: string; state: string; caption: string | null }[];
  };
  revisions: {
    field: string;
    validated: Record<string, unknown> | null;
    proposed: Record<string, unknown>;
  }[];
  alerts: {
    code: string;
    field: string;
    rowKey: string | null;
    signals: string[];
  }[];
  reasons: {
    code: string;
    message: string;
    nextStep: string;
    requiresMemberMessage: boolean;
  }[];
};

async function openCreator(
  server: Server,
  entryId: string,
  who: Internal,
): Promise<OpenedCreator> {
  const response = await call(
    server,
    "POST",
    `${CREATORS}/${entryId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<OpenedCreator>();
}

type OpenedVisual = {
  outcome: string;
  reviewToken: string | null;
  item: {
    id: string;
    kind: string;
    state: string;
    caption: string | null;
    replaces: unknown;
  };
  account: { alias: string };
  alerts: { field: string; rowKey: string | null; signals: string[] }[];
  reasons: { code: string; message: string; gridControl: number | null }[];
};

async function openVisual(
  server: Server,
  itemId: string,
  who: Internal,
): Promise<OpenedVisual> {
  const response = await call(
    server,
    "POST",
    `${VISUALS}/${itemId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<OpenedVisual>();
}

async function registerLines(subjectId: string, event?: string) {
  return sharedMigrationRole()<
    { event: string; actor: string | null; payload: Record<string, unknown> }[]
  >`
    select event_type as event, actor_account_id::text as actor, payload
      from audit.audit_events
     where subject_id = ${subjectId} and (${event ?? null}::text is null or event_type = ${event ?? null})
     order by seq`;
}

async function refusedActions(actor: string): Promise<string[]> {
  const rows = await sharedMigrationRole()<
    { payload: { action_code?: string } }[]
  >`
    select payload from audit.audit_events
     where event_type = 'backoffice.action_refused' and actor_account_id = ${actor}
     order by seq`;
  return rows.map((row) => row.payload.action_code ?? "");
}

async function outboxOf(accountId: string) {
  return sharedMigrationRole()<{ event_type: string; destination: string }[]>`
    select event_type, destination::text from leads.outbox_events
     where subject_key = ${`account:${accountId}`} order by id`;
}

/** Storage in memory: what the route reads by the key of the database, and what it was asked for. */
function memoryStore(
  objects: Map<string, Uint8Array>,
): ObjectStore & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    write: async () => ({ ok: true, value: null }),
    remove: async () => ({ ok: true, value: null }),
    read: async (_bucket, key) => {
      asked.push(key);
      return { ok: true, value: objects.get(key) ?? null };
    },
  };
}

async function keyOf(itemId: string): Promise<string> {
  const [row] = await sharedMigrationRole()<{ object_key: string }[]>`
    select object_key from profiles.portfolio_items where id = ${itemId}`;
  return row?.object_key ?? "";
}

let agent: Internal;
let colleague: Internal;
let admin: Internal;
/** The creator that `agent` holds (RG36). */
let heldCreator: Creator;
let plain: Creator;
let late: Creator;
let flagged: Creator;
let revised: Creator;
let verified: Creator;
let claimed: Creator;
let belgian: Creator;
let forOther: Creator;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  const [window] = await sharedMigrationRole()<
    { base: string; from: string; to: string }[]
  >`
    select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as base,
           to_char((t - interval '1 second') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as from,
           to_char((t + interval '1 second') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as to
      from (select now() - interval '400 days'
                   - make_interval(secs => ${Math.floor(Math.random() * 2_000_000)}) as t) x`;
  base = window?.base ?? "";
  windowFrom = window?.from ?? "";
  windowTo = window?.to ?? "";
  agent = await newInternal("agent", "Camille");
  colleague = await newInternal("agent", "Marie");
  admin = await newInternal("admin", "Dominique");

  heldCreator = await newCreator({ owner: agent.accountId, country: "ES" });
  plain = await newCreator({ dueIn: "3 hours" });
  late = await newCreator({ dueIn: "-3 hours", country: "DE" });
  flagged = await newCreator({
    dueIn: "5 hours",
    captions: [
      `Voir le profil @${letterName(randomUUID().slice(0, 8))} pour la recette`,
      null,
      null,
    ],
  });
  revised = await newCreator({
    entry: "revision",
    language: "en",
    revisedHeadline: "Cuisine végétale, recettes de saison et astuces",
    dueIn: "6 hours",
  });
  verified = await newCreator({
    entry: "revision",
    verified: true,
    dueIn: "7 hours",
  });
  claimed = await newCreator({ dueIn: "8 hours" });
  belgian = await newCreator({ country: "BE", dueIn: "9 hours" });
  forOther = await newCreator({ dueIn: "10 hours" });

  // the deadline of a visual is the database's (the trigger of 0242 dates it at its passage to pending):
  // the superuser, with the triggers out of the way, puts the visuals of `late` past theirs
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`
      update profiles.portfolio_items
         set sla_due_at = now() - interval '3 hours', escalate_at = now() - interval '2 hours'
       where account_id = ${late.accountId}`;
  });

  // `colleague` holds the entry of `claimed`
  await sharedMigrationRole()`
    update profiles.creator_review_entries
       set claimed_by_account_id = ${colleague.accountId}, claimed_at = now(),
           claim_expires_at = now() + interval '30 minutes'
     where id = ${claimed.entryId}`;
}, 60_000);

afterAll(async () => {
  await closeDatabase(database);
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    if (creators.length > 0) {
      const ids = [...creators];
      await tx`delete from verification.badges where account_id = any(${ids}::uuid[])`;
      await tx`delete from verification.verification_requests where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_field_revisions where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.portfolio_items where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.portfolio_brand_declarations where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_review_entries where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_public_networks where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_social_accounts where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_identities where account_id = any(${ids}::uuid[])`;
      await tx`delete from profiles.creator_public_profiles where account_id = any(${ids}::uuid[])`;
    }
  });
  if (internals.length > 0) {
    await sharedMigrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------
// Queue 2: the list (15 RG26, RG27 C5, RG33, RG34, RG36; 17b §2.7 line 2)
// ---------------------------------------------------------------------------------------------

describe("queue 2: the list (15 RG26, RG28, RG33, RG34, RG36; 17b §2.7)", () => {
  it("lists the waiting profiles oldest deadline first, the late one in front, with the counters of the queue", async () => {
    const server = app();
    const { status, body } = await list(server, CREATORS, agent);
    expect(status).toBe(200);
    const ids = body.items.map((item) => item.id);
    // the account `agent` holds is hidden from him, the others are there, the late one first
    expect(ids).not.toContain(heldCreator.entryId);
    expect(ids).toEqual([
      late.entryId,
      plain.entryId,
      flagged.entryId,
      revised.entryId,
      verified.entryId,
      claimed.entryId,
      belgian.entryId,
      forOther.entryId,
    ]);
    expect(body.items[0]).toMatchObject({
      overdue: true,
      alias: late.alias,
      countryCode: "DE",
      kind: "submission",
      networks: ["instagram"],
    });
    expect(body.counters).toMatchObject({
      queue: "profiles_creator",
      policy: {
        decisionMinutes: 480,
        claimTargetMinutes: 240,
        escalateAfterMinutes: 960,
        businessHours: true,
      },
    });
    expect(body.counters?.pending).toBeGreaterThanOrEqual(8);
  });

  it("carries no handle, link, figure, title, bio nor caption: an alias, codes and a score (invariant 13)", async () => {
    const server = app();
    const { raw } = await list(server, CREATORS, agent);
    for (const creator of [plain, flagged, revised]) {
      expect(raw).not.toContain(creator.handle);
    }
    expect(raw).not.toContain("instagram.com/");
    expect(raw).not.toContain(HEADLINE);
    expect(raw).not.toContain("recettes de saison");
    expect(raw).not.toContain("48000");
  });

  it("filters by kind, country, network and badge, and pages without a cursor longer than the cap (RG33, RG34)", async () => {
    const server = app();
    const revisions = await list(server, CREATORS, agent, { kind: "revision" });
    expect(revisions.body.items.map((item) => item.id)).toEqual([
      revised.entryId,
      verified.entryId,
    ]);
    expect(revisions.body.items[0]?.modifiedFields).toEqual(["headline"]);
    const belgians = await list(server, CREATORS, agent, { country: "BE" });
    expect(belgians.body.items.map((item) => item.id)).toEqual([
      belgian.entryId,
    ]);
    const networked = await list(server, CREATORS, agent, {
      network: "instagram",
      kind: "submission",
    });
    expect(networked.body.items).toHaveLength(6);
    const without = await list(server, CREATORS, agent, { badge: "without" });
    expect(without.body.items.map((item) => item.id)).not.toContain(
      verified.entryId,
    );
    const withBadge = await list(server, CREATORS, agent, { badge: "with" });
    expect(withBadge.body.items.map((item) => item.id)).toEqual([
      verified.entryId,
    ]);
    expect(withBadge.body.items[0]?.badges).toEqual([
      { networkCode: "instagram", level: "account_verified" },
    ]);
    const first = await list(server, CREATORS, agent, { limit: 3 });
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(server, CREATORS, agent, {
      limit: 3,
      cursor: first.body.nextCursor ?? "",
    });
    expect(second.body.items.map((item) => item.id)).toEqual([
      revised.entryId,
      verified.entryId,
      claimed.entryId,
    ]);
    const search = await call(
      server,
      "POST",
      `${CREATORS}/search`,
      agent.session,
      {
        from: windowFrom,
        to: windowTo,
        cursor: first.body.nextCursor,
        limit: 3,
      },
    );
    expect(
      search.json<ListBody<CreatorRow>>().items.map((item) => item.id),
    ).toEqual(second.body.items.map((item) => item.id));
    const bad = await call(
      server,
      "GET",
      `${CREATORS}?cursor=not-a-cursor&limit=3`,
      agent.session,
    );
    expect(bad.statusCode).toBe(400);
  });

  it("signals an identifying element in a caption by the kind of signal, never by the text (EC-L2G-12)", async () => {
    const server = app();
    const alerted = await list(server, CREATORS, agent, { alert: "true" });
    expect(alerted.body.items.map((item) => item.id)).toEqual([
      flagged.entryId,
    ]);
    expect(alerted.body.items[0]?.alerts).toEqual(["direct_contact"]);
    const view = await openCreator(server, flagged.entryId, agent);
    expect(view.alerts).toEqual([
      {
        code: "direct_contact",
        field: "portfolio_caption",
        rowKey: flagged.visuals[0],
        signals: ["handle"],
      },
    ]);
    await call(
      server,
      "POST",
      `${CREATORS}/${flagged.entryId}/release`,
      agent.session,
    );
  });

  it("counts the queue as the caller sees it: the entry of an account he holds is not counted (RG36)", async () => {
    const server = app();
    const read = async (who: Internal) =>
      (await list(server, CREATORS, who)).body.counters?.pending ?? 0;
    const asHolder = await read(agent);
    const asColleague = await read(colleague);
    expect(asColleague - asHolder).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Queue 2: the opening is the claim (15 C1, C2; file.md A3, A9)
// ---------------------------------------------------------------------------------------------

describe("queue 2: the opening is the claim (15 C1, C2; l2c/file.md A3, A9, A10)", () => {
  it("takes a free entry with the version token and the view of the profile, then holds it on the second opening", async () => {
    const server = app();
    const first = await openCreator(server, plain.entryId, agent);
    expect(first.outcome).toBe("claimed");
    expect(first.reviewToken).toMatch(/^[0-9a-f]{64}$/);
    expect(first.entry.claim).toMatchObject({
      holder: { accountId: agent.accountId, displayName: "Camille" },
      heldByCaller: true,
    });
    expect(first.profile.alias).toBe(plain.alias);
    expect(first.profile.headline).toBe(HEADLINE);
    // the layer I is here, for the agent who moderates it
    expect(first.profile.lines[0]).toMatchObject({
      id: plain.lineId,
      handle: plain.handle,
      listed: false,
    });
    expect(first.profile.visuals).toHaveLength(3);
    expect(
      first.profile.visuals.every((visual) => visual.state === "pending"),
    ).toBe(true);
    const again = await openCreator(server, plain.entryId, agent);
    expect(again.outcome).toBe("held");
    expect(again.reviewToken).toBe(first.reviewToken);
    await call(
      server,
      "POST",
      `${CREATORS}/${plain.entryId}/release`,
      agent.session,
    );
  });

  it("gives a colleague the read-only view with the name of the holder, no token, no error (C2)", async () => {
    const server = app();
    const view = await openCreator(server, claimed.entryId, agent);
    expect(view.outcome).toBe("read_only");
    expect(view.reviewToken).toBeNull();
    expect(view.entry.claim).toMatchObject({
      holder: { accountId: colleague.accountId, displayName: "Marie" },
      heldByCaller: false,
    });
  });

  it("serves a pending revision beside the validated value, and the refusal reasons in the language of the creator without any @ (EC-L2G-10-1)", async () => {
    const server = app();
    const view = await openCreator(server, revised.entryId, agent);
    expect(view.account.preferredLanguage).toBe("en");
    expect(view.revisions).toEqual([
      expect.objectContaining({
        field: "headline",
        validated: { kind: "text", text: HEADLINE },
        proposed: {
          kind: "text",
          text: "Cuisine végétale, recettes de saison et astuces",
        },
      }),
    ]);
    expect(view.reasons.map((reason) => reason.code)).toEqual([
      "identifier_in_text",
      "bio_insufficient",
      "portfolio_insufficient",
      "portfolio_non_compliant",
      "network_link_inconsistent",
      "figures_inconsistent",
      "topic_inconsistent",
      "illicit_content",
      "age_doubt",
      "other",
    ]);
    const identifier = view.reasons[0];
    expect(identifier?.message).toContain("at sign");
    for (const reason of view.reasons) {
      expect(reason.message).not.toContain("@");
    }
    expect(view.reasons.at(-1)).toMatchObject({
      requiresMemberMessage: true,
      nextStep: "contact",
    });
    await call(
      server,
      "POST",
      `${CREATORS}/${revised.entryId}/release`,
      agent.session,
    );
  });

  it("answers a visual of the profile only to the holder of a live claim (D82 (7)), journaled, and never an address", async () => {
    const objects = new Map<string, Uint8Array>();
    const store = memoryStore(objects);
    const server = app(store);
    const visualId = forOther.visuals[0] ?? "";
    const bytes = randomBytes(1200);
    objects.set(await keyOf(visualId), bytes);
    const url = `${CREATORS}/${forOther.entryId}/portfolio/${visualId}/image`;
    // no claim: 409 `claim_not_held`, nothing read from Storage
    const unclaimed = await call(server, "GET", url, agent.session);
    expect(unclaimed.statusCode).toBe(409);
    expect(issuesOf(unclaimed)).toContainEqual({
      path: "claim",
      issue: "claim_not_held",
    });
    expect(store.asked).toEqual([]);
    // the holder reads it, one line of the register, no key in the answer
    await openCreator(server, forOther.entryId, agent);
    const read = await call(server, "GET", url, agent.session);
    expect(read.statusCode, read.body).toBe(200);
    const body = read.json<{
      state: string;
      image: { contentType: string; byteSize: number; data: string };
    }>();
    expect(body.state).toBe("pending");
    expect(body.image.contentType).toBe("image/webp");
    expect(
      Buffer.from(body.image.data, "base64").equals(Buffer.from(bytes)),
    ).toBe(true);
    expect(read.body).not.toContain(await keyOf(visualId));
    expect(read.headers["cache-control"]).toBe("no-store");
    const lines = await registerLines(forOther.entryId, "queue.portfolio_read");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      actor: agent.accountId,
      payload: {
        queue_code: "profiles_creator",
        item_id: visualId,
        state: "pending",
      },
    });
    // a colleague, who does not hold it, gets the holder's name and no byte
    store.asked.length = 0;
    const refused = await call(server, "GET", url, colleague.session);
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toContainEqual({
      path: "claim",
      issue: "held_by_other",
    });
    expect(issuesOf(refused)).toContainEqual({
      path: "claim.holder",
      issue: "Camille",
    });
    expect(store.asked).toEqual([]);
    // a visual that is not one of the account's answers like an unknown one (T14)
    const foreign = await call(
      server,
      "GET",
      `${CREATORS}/${forOther.entryId}/portfolio/${plain.visuals[0]}/image`,
      agent.session,
    );
    const unknown = await call(
      server,
      "GET",
      `${CREATORS}/${forOther.entryId}/portfolio/${randomUUID()}/image`,
      agent.session,
    );
    expect(answer(foreign)).toEqual(answer(unknown));
    expect(answer(foreign).status).toBe(404);
    await call(
      server,
      "POST",
      `${CREATORS}/${forOther.entryId}/release`,
      agent.session,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Queue 2: the decisions (07 RG5, RG10, RG96, RG98; 15 C3, C4, C6, C8; l2g/modele.md §3 "Erreurs")
// ---------------------------------------------------------------------------------------------

describe("queue 2: the decisions, their refusals as the API answers them (0244)", () => {
  it("refuses a decision without the live claim of the caller (409 claim_not_held) and a stale token (409 stale_token)", async () => {
    const server = app();
    const noClaim = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/publish`,
      agent.session,
      { reviewToken: ANY_TOKEN },
    );
    expect(noClaim.statusCode).toBe(409);
    expect(issuesOf(noClaim)).toContainEqual({
      path: "claim",
      issue: "claim_not_held",
    });
    const opened = await openCreator(server, belgian.entryId, agent);
    expect(opened.reviewToken).not.toBeNull();
    const stale = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      { reviewToken: ANY_TOKEN, reasonCode: "bio_insufficient" },
    );
    expect(stale.statusCode).toBe(409);
    expect(issuesOf(stale)).toContainEqual({
      path: "entry",
      issue: "stale_token",
    });
    // the token is no capability: a colleague holding the right token still cannot decide
    const borrowed = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/publish`,
      colleague.session,
      { reviewToken: opened.reviewToken },
    );
    expect(borrowed.statusCode).toBe(409);
    expect(issuesOf(borrowed)).toContainEqual({
      path: "claim",
      issue: "held_by_other",
    });
    expect(issuesOf(borrowed)).toContainEqual({
      path: "claim.holder",
      issue: "Camille",
    });
    await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/release`,
      agent.session,
    );
  });

  it("answers the same 409 on an entry closed in the meantime (entry_closed) and says nothing of who closed it", async () => {
    const server = app();
    const twin = await newCreator({ dueIn: "11 hours" });
    const opened = await openCreator(server, twin.entryId, agent);
    await sharedMigrationRole()`
      update profiles.creator_review_entries
         set state = 'withdrawn', closed_at = now() where id = ${twin.entryId}`;
    const response = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/reject`,
      agent.session,
      { reviewToken: opened.reviewToken, reasonCode: "bio_insufficient" },
    );
    expect(response.statusCode).toBe(409);
    expect(issuesOf(response)).toContainEqual({
      path: "entry",
      issue: "entry_closed",
    });
  });

  it("refuses the message of `other` that is missing, or that holds a direct contact, as a 400 on `memberMessage` (RG98, RG158)", async () => {
    const server = app();
    const opened = await openCreator(server, belgian.entryId, agent);
    const missing = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      { reviewToken: opened.reviewToken, reasonCode: "other" },
    );
    expect(missing.statusCode).toBe(400);
    expect(issuesOf(missing)).toContainEqual({
      path: "memberMessage",
      issue: "invalid_member_message",
    });
    const contact = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      {
        reviewToken: opened.reviewToken,
        reasonCode: "other",
        memberMessage: "Écrivez-moi à moi@exemple.test pour en parler.",
      },
    );
    expect(contact.statusCode).toBe(400);
    expect(issuesOf(contact)).toContainEqual({
      path: "memberMessage",
      issue: "direct_contact",
    });
    const unneeded = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      {
        reviewToken: opened.reviewToken,
        reasonCode: "bio_insufficient",
        memberMessage: "Ce message n'est pas attendu pour ce motif-là.",
      },
    );
    expect(unneeded.statusCode).toBe(400);
    expect(issuesOf(unneeded)).toContainEqual({
      path: "memberMessage",
      issue: "invalid_member_message",
    });
    // the entry is still open: nothing was decided by any of the three
    const [entry] = await sharedMigrationRole()<{ state: string }[]>`
      select state::text from profiles.creator_review_entries where id = ${belgian.entryId}`;
    expect(entry?.state).toBe("open");
    await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/release`,
      agent.session,
    );
  });

  it("refuses a submission with a typed reason: the decision, the creator e-mail queued, the next entry to open (RG10, RG99)", async () => {
    const server = app();
    const opened = await openCreator(server, belgian.entryId, agent);
    const response = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      {
        reviewToken: opened.reviewToken,
        reasonCode: "bio_insufficient",
        internalComment: "La bio ne dit pas ce que fait la personne.",
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json<{
      decidedAt: string;
      late: boolean;
      next: { entryId: string } | null;
    }>();
    expect(Date.parse(body.decidedAt)).toBeGreaterThan(Date.now() - 60_000);
    expect(body.late).toBe(false);
    expect(body.next?.entryId).toBe(late.entryId);
    const [entry] = await sharedMigrationRole()<
      { state: string; reason: string | null; decided_by: string | null }[]
    >`
      select state::text, rejection_reason_code as reason,
             decided_by_account_id::text as decided_by
        from profiles.creator_review_entries where id = ${belgian.entryId}`;
    expect(entry).toEqual({
      state: "rejected",
      reason: "bio_insufficient",
      decided_by: agent.accountId,
    });
    expect(
      (await outboxOf(belgian.accountId)).map((row) => row.event_type),
    ).toEqual(["creator_profile.decision"]);
    const refused = await registerLines(
      belgian.accountId,
      "creator_profile.rejected",
    );
    expect(refused).toHaveLength(1);
    expect(refused[0]?.payload).toMatchObject({
      kind: "submission",
      reason_code: "bio_insufficient",
    });
    // the same entry cannot be decided twice
    const again = await call(
      server,
      "POST",
      `${CREATORS}/${belgian.entryId}/reject`,
      agent.session,
      { reviewToken: opened.reviewToken, reasonCode: "bio_insufficient" },
    );
    expect(again.statusCode).toBe(409);
  });

  it("publishes a revision of a published profile: lead.updated, never profile.completed, the version applied and the decision e-mail (RG106)", async () => {
    const server = app();
    const opened = await openCreator(server, revised.entryId, agent);
    const response = await call(
      server,
      "POST",
      `${CREATORS}/${revised.entryId}/publish`,
      agent.session,
      { reviewToken: opened.reviewToken },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(
      response.json<{ firstPublication: boolean }>().firstPublication,
    ).toBe(false);
    const [profile] = await sharedMigrationRole()<{ headline: string }[]>`
      select headline from profiles.creator_public_profiles where account_id = ${revised.accountId}`;
    expect(profile?.headline).toBe(
      "Cuisine végétale, recettes de saison et astuces",
    );
    const events = (await outboxOf(revised.accountId)).map(
      (row) => `${row.event_type}:${row.destination}`,
    );
    expect(events).toContain("creator_profile.decision:brevo_transactional");
    expect(events).toContain("lead.updated:brevo_contact");
    expect(events).toContain("lead.updated:apollo_contact");
    expect(events.some((event) => event.startsWith("profile.completed"))).toBe(
      false,
    );
  });

  it("refuses the handle of a line under an active « Compte vérifié »: 409 verified_handle, nothing applied (EC-L2G-04-5)", async () => {
    const server = app();
    await sharedMigrationRole()`
      insert into profiles.creator_field_revisions
        (account_id, field_code, row_key, proposed_value, creator_review_entry_id)
      values (${verified.accountId}, 'creator.network_handle', ${verified.lineId},
              ${`nouveau_${verified.handle}`}::jsonb, ${verified.entryId})`;
    const opened = await openCreator(server, verified.entryId, agent);
    expect(opened.revisions[0]).toMatchObject({
      field: "network_handle",
      validated: { kind: "text", text: verified.handle },
    });
    expect(opened.profile.lines[0]?.badge).toBe("account_verified");
    const response = await call(
      server,
      "POST",
      `${CREATORS}/${verified.entryId}/publish`,
      agent.session,
      { reviewToken: opened.reviewToken },
    );
    expect(response.statusCode).toBe(409);
    expect(issuesOf(response)).toContainEqual({
      path: "entry",
      issue: "verified_handle",
    });
    const [line] = await sharedMigrationRole()<{ handle: string }[]>`
      select handle from profiles.creator_social_accounts where id = ${verified.lineId}`;
    expect(line?.handle).toBe(verified.handle);
    // the agent refuses the revision instead: it leaves the profile published
    const rejected = await call(
      server,
      "POST",
      `${CREATORS}/${verified.entryId}/reject`,
      agent.session,
      {
        reviewToken: opened.reviewToken,
        reasonCode: "network_link_inconsistent",
      },
    );
    expect(rejected.statusCode, rejected.body).toBe(200);
    const [profile] = await sharedMigrationRole()<{ status: string }[]>`
      select status::text from profiles.creator_public_profiles where account_id = ${verified.accountId}`;
    expect(profile?.status).toBe("published");
  });
});

// ---------------------------------------------------------------------------------------------
// Both queues: release, extension, forced release (15 C3, C4; file.md A8, A9; CA63)
// ---------------------------------------------------------------------------------------------

describe("release, extension and forced release on both queues (15 C3, C4, A8, A9, CA63)", () => {
  it("gives the entry back, then refuses a second release as a claim not held", async () => {
    const server = app();
    const twin = await newCreator({ dueIn: "12 hours" });
    await openCreator(server, twin.entryId, agent);
    const released = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/release`,
      agent.session,
    );
    expect(released.statusCode).toBe(200);
    expect(released.json()).toEqual({ released: true });
    const again = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/release`,
      agent.session,
    );
    expect(again.statusCode).toBe(409);
    expect(issuesOf(again)).toContainEqual({
      path: "claim",
      issue: "claim_not_held",
    });
    const taken = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/extend`,
      agent.session,
    );
    expect(taken.statusCode).toBe(409);
  });

  it("extends a live claim to a later expiry, on a visual as on a profile", async () => {
    const server = app();
    const twin = await newCreator({ dueIn: "13 hours", captions: [null] });
    const profile = await openCreator(server, twin.entryId, agent);
    const first = (
      await call(
        server,
        "POST",
        `${CREATORS}/${twin.entryId}/extend`,
        agent.session,
      )
    ).json<{
      claimExpiresAt: string;
    }>();
    expect(Date.parse(first.claimExpiresAt)).toBeGreaterThan(Date.now());
    expect(profile.entry.claim.heldByCaller).toBe(true);
    const visual = twin.visuals[0] ?? "";
    await openVisual(server, visual, agent);
    const extended = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/extend`,
      agent.session,
    );
    expect(extended.statusCode, extended.body).toBe(200);
    expect(
      Date.parse(extended.json<{ claimExpiresAt: string }>().claimExpiresAt),
    ).toBeGreaterThan(Date.now());
    await call(server, "POST", `${VISUALS}/${visual}/release`, agent.session);
    await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/release`,
      agent.session,
    );
  });

  it("refuses an agent's forced release and journals the attempt (CA63); an administrator lifts it with a typed reason and the holder learns it (A8)", async () => {
    const server = app();
    const twin = await newCreator({ dueIn: "14 hours" });
    await openCreator(server, twin.entryId, colleague);
    const before = (await refusedActions(agent.accountId)).length;
    const refused = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/force-release`,
      agent.session,
      { reasonCode: "holder_absent" },
    );
    expect(refused.statusCode).toBe(403);
    expect((await refusedActions(agent.accountId)).slice(before)).toEqual([
      "queue.force_release_claim",
    ]);
    const lifted = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/force-release`,
      admin.session,
      { reasonCode: "holder_absent" },
    );
    expect(lifted.statusCode, lifted.body).toBe(200);
    expect(lifted.json()).toEqual({
      released: true,
      holder: { accountId: colleague.accountId, displayName: "Marie" },
    });
    // the holder, dispossessed, is told at his next act (A8), then reads the notice at the opening
    const act = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/reject`,
      colleague.session,
      { reviewToken: ANY_TOKEN, reasonCode: "bio_insufficient" },
    );
    expect(act.statusCode).toBe(409);
    expect(issuesOf(act)).toContainEqual({
      path: "claim",
      issue: "claim_lifted",
    });
    const reopened = await openCreator(server, twin.entryId, colleague);
    expect(reopened.outcome).toBe("claimed");
    // an unknown reason is no reason (the schema is closed)
    const unknown = await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/force-release`,
      admin.session,
      { reasonCode: "because" },
    );
    expect(unknown.statusCode).toBe(400);
    await call(
      server,
      "POST",
      `${CREATORS}/${twin.entryId}/release`,
      colleague.session,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The account the caller holds (15 RG36, 13 RG35; CA19; 0215)
// ---------------------------------------------------------------------------------------------

describe("the account the caller HOLDS is his to hold, not to examine (15 RG36, CA19)", () => {
  it("refuses the opening, the read of a visual and every decision with 403 conflict_of_interest, the attempt journaled, and lets him give a claim back", async () => {
    const server = app();
    const visual = heldCreator.visuals[0] ?? "";
    const attempts: [string, string, object?][] = [
      ["POST", `${CREATORS}/${heldCreator.entryId}/open`],
      ["GET", `${CREATORS}/${heldCreator.entryId}/portfolio/${visual}/image`],
      [
        "POST",
        `${CREATORS}/${heldCreator.entryId}/publish`,
        { reviewToken: ANY_TOKEN },
      ],
      [
        "POST",
        `${CREATORS}/${heldCreator.entryId}/reject`,
        { reviewToken: ANY_TOKEN, reasonCode: "bio_insufficient" },
      ],
      ["POST", `${CREATORS}/${heldCreator.entryId}/extend`],
      ["POST", `${VISUALS}/${visual}/open`],
      ["GET", `${VISUALS}/${visual}/image`],
      ["POST", `${VISUALS}/${visual}/approve`, { reviewToken: ANY_TOKEN }],
      [
        "POST",
        `${VISUALS}/${visual}/reject`,
        { reviewToken: ANY_TOKEN, reasonCode: "watermark" },
      ],
      ["POST", `${VISUALS}/${visual}/extend`],
    ];
    const before = (await refusedActions(agent.accountId)).length;
    for (const [method, url, body] of attempts) {
      const response = await call(
        server,
        method as "GET" | "POST",
        url,
        agent.session,
        body,
      );
      expect(response.statusCode, `${method} ${url}`).toBe(403);
      expect(issuesOf(response), url).toEqual([
        { path: "entry", issue: "conflict_of_interest" },
      ]);
    }
    expect((await refusedActions(agent.accountId)).slice(before)).toEqual(
      attempts.map(() => "queue.conflict_of_interest"),
    );
    // nothing of that account is in his lists or counters
    const lists = [
      (await list(server, CREATORS, agent)).body.items.map((item) => item.id),
      (await list<{ id: string }>(server, VISUALS, agent)).body.items.map(
        (item) => item.id,
      ),
    ];
    expect(lists[0]).not.toContain(heldCreator.entryId);
    expect(lists[1]).not.toContain(visual);
    // giving a claim back stays open to him: the answer is the one of a claim not held, never a 403
    const release = await call(
      server,
      "POST",
      `${CREATORS}/${heldCreator.entryId}/release`,
      agent.session,
    );
    expect(release.statusCode).toBe(409);
    expect(issuesOf(release)).toContainEqual({
      path: "claim",
      issue: "claim_not_held",
    });
    const releaseVisual = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/release`,
      agent.session,
    );
    expect(releaseVisual.statusCode).toBe(409);
    // and a claim he already holds (the account was handed to him after the opening) is given back
    await sharedMigrationRole()`
      update profiles.creator_review_entries
         set claimed_by_account_id = ${agent.accountId}, claimed_at = now(),
             claim_expires_at = now() + interval '30 minutes'
       where id = ${heldCreator.entryId}`;
    const given = await call(
      server,
      "POST",
      `${CREATORS}/${heldCreator.entryId}/release`,
      agent.session,
    );
    expect(given.statusCode, given.body).toBe(200);
    // a colleague, who does not hold the account, reads it as anyone
    const asColleague = await openCreator(
      server,
      heldCreator.entryId,
      colleague,
    );
    expect(asColleague.outcome).toBe("claimed");
    await call(
      server,
      "POST",
      `${CREATORS}/${heldCreator.entryId}/release`,
      colleague.session,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Queue 3: the visuals (07 RG77 to RG83, RG95, RG97; 15 RG26 to RG36; modele points 2, 3, 10)
// ---------------------------------------------------------------------------------------------

describe("queue 3: the visuals, one entry each, no thumbnail (07 RG78; D82 (7))", () => {
  it("lists the pending visuals oldest deadline first with the profile, the kind and the visuals of the profile, no thumbnail nor caption", async () => {
    const server = app();
    const { status, body, raw } = await list<{
      id: string;
      accountId: string;
      alias: string;
      kind: string;
      visualCount: number;
      overdue: boolean;
      alerts: string[];
      claim: Claim;
    }>(server, VISUALS, agent, { limit: 50 });
    expect(status).toBe(200);
    expect(body.counters).toMatchObject({ queue: "portfolio_moderation" });
    const ids = body.items.map((item) => item.id);
    expect(ids).not.toContain(heldCreator.visuals[0]);
    expect(ids).toContain(plain.visuals[0]);
    const row = body.items.find((item) => item.id === plain.visuals[0]);
    expect(row).toMatchObject({
      accountId: plain.accountId,
      alias: plain.alias,
      kind: "deposit",
      visualCount: 3,
      alerts: [],
    });
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "accountId",
      "alerts",
      "alias",
      "claim",
      "createdAt",
      "escalateAt",
      "id",
      "kind",
      "overdue",
      "owner",
      "slaDueAt",
      "visualCount",
    ]);
    expect(raw).not.toMatch(/thumb|image|data:|base64|objectKey|checksum/i);
    expect(raw).not.toContain("instagram");
    // the late one first (C5)
    expect(ids.indexOf(late.visuals[0] ?? "")).toBeLessThan(
      ids.indexOf(plain.visuals[0] ?? ""),
    );
    expect(
      body.items.find((item) => item.id === late.visuals[0]),
    ).toMatchObject({
      overdue: true,
    });
    // the profile filter and the alert filter (EC-L2G-12)
    const byProfile = await list<{ id: string }>(server, VISUALS, agent, {
      account: flagged.accountId,
    });
    expect(byProfile.body.items.map((item) => item.id).sort()).toEqual(
      [...flagged.visuals].sort(),
    );
    const alerted = await list<{ id: string; alerts: string[] }>(
      server,
      VISUALS,
      agent,
      {
        alert: "true",
      },
    );
    expect(alerted.body.items.map((item) => item.id)).toEqual([
      flagged.visuals[0],
    ]);
    expect(alerted.body.items[0]?.alerts).toEqual(["direct_contact"]);
    const replacements = await list<{ id: string }>(server, VISUALS, agent, {
      kind: "replacement",
    });
    expect(replacements.body.items).toEqual([]);
  });

  it("opens a visual: the token, the grid of RG79 with the message of the e-mail, no byte, and the colleague reads it read-only", async () => {
    const server = app();
    const visual = belgian.visuals[0] ?? "";
    const viewed = await openVisual(server, visual, agent);
    expect(viewed.outcome).toBe("claimed");
    expect(viewed.reviewToken).toMatch(/^[0-9a-f]{64}$/);
    expect(viewed.account.alias).toBe(belgian.alias);
    expect(viewed.reasons.map((reason) => reason.code)).toEqual([
      "watermark",
      "handle_in_image",
      "app_interface",
      "text_naming_account_or_brand",
      "identifiable_place",
      "statistics_screenshot",
      "illicit_content",
      "caption_identifier",
      "caption_brand_unauthorised",
    ]);
    expect(viewed.reasons.map((reason) => reason.gridControl)).toEqual([
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      null,
      null,
    ]);
    for (const reason of viewed.reasons) {
      expect(reason.message).not.toContain("@");
    }
    const asColleague = await openVisual(server, visual, colleague);
    expect(asColleague.outcome).toBe("read_only");
    expect(asColleague.reviewToken).toBeNull();
    const objects = new Map<string, Uint8Array>();
    const readable = app(memoryStore(objects));
    objects.set(await keyOf(visual), randomBytes(900));
    const asHolder = await call(
      readable,
      "GET",
      `${VISUALS}/${visual}/image`,
      agent.session,
    );
    expect(asHolder.statusCode, asHolder.body).toBe(200);
    expect(asHolder.json<{ state: string }>().state).toBe("pending");
    expect(
      (await registerLines(visual, "queue.portfolio_read")).map(
        (line) => line.payload,
      ),
    ).toEqual([
      { queue_code: "portfolio_moderation", item_id: visual, state: "pending" },
    ]);
    // the colleague does not hold it: no byte (D82 (7))
    const refused = await call(
      readable,
      "GET",
      `${VISUALS}/${visual}/image`,
      colleague.session,
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toContainEqual({
      path: "claim",
      issue: "held_by_other",
    });
    await call(server, "POST", `${VISUALS}/${visual}/release`, agent.session);
  });

  it("refuses a decision on a stale version, approves with the instant and the lateness, and queues one e-mail (RG95, RG99)", async () => {
    const server = app();
    const visual = belgian.visuals[1] ?? "";
    const viewed = await openVisual(server, visual, agent);
    const stale = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/approve`,
      agent.session,
      {
        reviewToken: ANY_TOKEN,
      },
    );
    expect(stale.statusCode).toBe(409);
    expect(issuesOf(stale)).toContainEqual({
      path: "entry",
      issue: "stale_token",
    });
    const approved = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/approve`,
      agent.session,
      {
        reviewToken: viewed.reviewToken,
        internalComment: "Rien à signaler.",
      },
    );
    expect(approved.statusCode, approved.body).toBe(200);
    const body = approved.json<{
      decidedAt: string;
      late: boolean;
      next: unknown;
    }>();
    expect(Date.parse(body.decidedAt)).toBeGreaterThan(Date.now() - 60_000);
    expect(body.late).toBe(false);
    expect(Object.keys(body).sort()).toEqual(["decidedAt", "late", "next"]);
    const [item] = await sharedMigrationRole()<
      {
        state: string;
        decided_by: string | null;
        display_order: number | null;
      }[]
    >`
      select state::text, decided_by_account_id::text as decided_by,
             display_order::int as display_order
        from profiles.portfolio_items where id = ${visual}`;
    expect(item).toMatchObject({
      state: "approved",
      decided_by: agent.accountId,
    });
    expect(
      (await outboxOf(belgian.accountId))
        .filter((row) => row.event_type === "portfolio.decision")
        .map((row) => row.destination),
    ).toEqual(["brevo_transactional"]);
    // decided once: the same visual is closed
    const again = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/reject`,
      agent.session,
      {
        reviewToken: viewed.reviewToken,
        reasonCode: "watermark",
      },
    );
    expect(again.statusCode).toBe(409);
  });

  it("refuses with a reason of the grid, never `other`, and the creator keeps the others (RG79, RG97)", async () => {
    const server = app();
    const visual = belgian.visuals[2] ?? "";
    const viewed = await openVisual(server, visual, agent);
    const other = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/reject`,
      agent.session,
      {
        reviewToken: viewed.reviewToken,
        reasonCode: "other",
      },
    );
    expect(other.statusCode).toBe(400);
    const message = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/reject`,
      agent.session,
      {
        reviewToken: viewed.reviewToken,
        reasonCode: "watermark",
        memberMessage: "Merci de vérifier la signature visible en bas.",
      },
    );
    expect(message.statusCode).toBe(400);
    const rejected = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/reject`,
      agent.session,
      {
        reviewToken: viewed.reviewToken,
        reasonCode: "watermark",
      },
    );
    expect(rejected.statusCode, rejected.body).toBe(200);
    const [item] = await sharedMigrationRole()<
      { state: string; reason: string | null; retention_days: number | null }[]
    >`
      select state::text, rejection_reason_code as reason,
             round(extract(epoch from (retention_due_at - now())) / 86400)::int as retention_days
        from profiles.portfolio_items where id = ${visual}`;
    expect(item).toEqual({
      state: "rejected",
      reason: "watermark",
      retention_days: 30,
    });
    const refused = await registerLines(visual, "portfolio.rejected");
    expect(refused).toHaveLength(1);
    expect(refused[0]?.payload).toMatchObject({ reason_code: "watermark" });
  });

  it("refuses a replacement whose original is no longer approved: 409 not_replaceable (RG81)", async () => {
    const server = app();
    const twin = await newCreator({ dueIn: "15 hours", captions: [null] });
    const [original] = await sharedMigrationRole()<{ id: string }[]>`
      insert into profiles.portfolio_items
        (account_id, state, received_bytes, byte_size, width, height, checksum, exif_stripped,
         stored_at, sla_due_at, escalate_at, decided_by_account_id, decided_at, display_order)
      values (${twin.accountId}, 'approved', 500000, 400000, 1080, 1350, ${"b".repeat(64)}, true,
              ${base}::timestamptz, now() + interval '1 day', now() + interval '2 days',
              ${colleague.accountId}, ${base}::timestamptz + interval '1 minute', 1)
      returning id::text`;
    const [replacement] = await sharedMigrationRole()<{ id: string }[]>`
      insert into profiles.portfolio_items
        (account_id, state, received_bytes, byte_size, width, height, checksum, exif_stripped,
         stored_at, replaces_item_id)
      values (${twin.accountId}, 'pending', 500000, 400000, 1080, 1350, ${"c".repeat(64)}, true,
              ${base}::timestamptz, ${original?.id ?? null})
      returning id::text`;
    const replacementId = replacement?.id ?? "";
    const rows = await list<{ id: string; kind: string }>(
      server,
      VISUALS,
      agent,
      {
        kind: "replacement",
      },
    );
    expect(rows.body.items.map((item) => item.id)).toEqual([replacementId]);
    const viewed = await openVisual(server, replacementId, agent);
    expect(viewed.item.kind).toBe("replacement");
    expect(viewed.item.replaces).toMatchObject({
      id: original?.id,
      displayOrder: 1,
    });
    await sharedMigrationRole()`
      update profiles.portfolio_items set state = 'withdrawn' where id = ${original?.id ?? null}`;
    const response = await call(
      server,
      "POST",
      `${VISUALS}/${replacementId}/approve`,
      agent.session,
      { reviewToken: viewed.reviewToken },
    );
    expect(response.statusCode, response.body).toBe(409);
    expect(issuesOf(response)).toContainEqual({
      path: "entry",
      issue: "not_replaceable",
    });
    await call(
      server,
      "POST",
      `${VISUALS}/${replacementId}/release`,
      agent.session,
    );
  });

  it("forces the release of a visual by an administrator only (15 C4, CA63)", async () => {
    const server = app();
    const visual = forOther.visuals[1] ?? "";
    await openVisual(server, visual, colleague);
    const refused = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/force-release`,
      agent.session,
      {
        reasonCode: "overdue_entry",
      },
    );
    expect(refused.statusCode).toBe(403);
    const lifted = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/force-release`,
      admin.session,
      {
        reasonCode: "overdue_entry",
      },
    );
    expect(lifted.statusCode, lifted.body).toBe(200);
    expect(
      lifted.json<{ holder: { displayName: string } }>().holder.displayName,
    ).toBe("Marie");
    const act = await call(
      server,
      "POST",
      `${VISUALS}/${visual}/approve`,
      colleague.session,
      {
        reviewToken: ANY_TOKEN,
      },
    );
    expect(issuesOf(act)).toContainEqual({
      path: "claim",
      issue: "claim_lifted",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// T14.1, T14.2, T14.4: who reaches these routes, and the logs
// ---------------------------------------------------------------------------------------------

describe("who reaches these routes, and what the logs hold (18 T14; D60)", () => {
  it("answers 401 to no session and to a member session on a read, an opening and a decision of each queue", async () => {
    const server = app();
    const member = await newMemberSession();
    const routes: [string, string, object?][] = [
      ["GET", CREATORS],
      ["POST", `${CREATORS}/${plain.entryId}/open`],
      [
        "POST",
        `${CREATORS}/${plain.entryId}/publish`,
        { reviewToken: ANY_TOKEN },
      ],
      ["GET", `${VISUALS}`],
      [
        "POST",
        `${VISUALS}/${plain.visuals[0]}/approve`,
        { reviewToken: ANY_TOKEN },
      ],
      ["GET", `${VISUALS}/${plain.visuals[0]}/image`],
    ];
    for (const [method, url, body] of routes) {
      for (const session of [null, member]) {
        const response = await call(
          server,
          method as "GET" | "POST",
          url,
          session,
          body,
        );
        expect(response.statusCode, `${method} ${url}`).toBe(401);
      }
    }
    // nothing of the entries moved
    const [entry] = await sharedMigrationRole()<{ state: string }[]>`
      select state::text from profiles.creator_review_entries where id = ${plain.entryId}`;
    expect(entry?.state).toBe("open");
    // an unknown entry and an unknown visual answer one and the same 404
    const unknown = [
      await call(server, "POST", `${CREATORS}/${NIL}/open`, agent.session),
      await call(server, "POST", `${VISUALS}/${NIL}/open`, agent.session),
    ];
    expect(answer(unknown[0] as LightMyRequestResponse)).toEqual(
      answer(unknown[1] as LightMyRequestResponse),
    );
    expect(unknown[0]?.statusCode).toBe(404);
  });

  it("wrote no handle, title, caption nor message typed here in any log of the file (invariant 13)", () => {
    expect(logStreams.length).toBeGreaterThan(0);
    const text = logStreams.map((stream) => stream()).join("\n");
    expect(valuesFoundIn(text, [...new Set(watched)])).toEqual([]);
  });
});
