// T14, T9.7 (L2E, commit 14) — queue 4, "vérifications", of the backoffice on the local stack through the
// pools of apps/api (docs/mvp/08 RG25, RG36 to RG38bis, RG41, RG42, RG47 to RG54, RG55, RG56, RG62 to
// RG67, RG84, CA27 to CA33, CA39, CA40, CA42 to CA44; 06 RG51, RG52; 15 RG36, C1 to C8; 18 T14.1 to T14.4,
// T9.7; jalons/l2e/modele.md §4, §6; l2e-fiche invariants 2, 5, 6, 9 to 11, 15, 17; migrations 0221,
// 0224): GET /v1/bo/queues/counters, the list of each view and its search, the opening, the acts
// (release, extend, force-release, reexamine, reject, compare, grant-account, grant-audience, grant) and
// the relay of a piece. The fixtures (agents, an admin, creators and brands with their pending requests)
// are COMMITTED (random identifiers, disposable local stack, like T14 of J8); the requests are closed
// and the internal profiles deactivated after the file. Every list is read from the window of the
// submissions this file wrote, so that requests of earlier runs and of other files never enter the
// expectations. Storage is a double in memory: the key is the database's, the bytes are ours.
// L2E-Q1 the surface and the views (T14, CA43), L2E-Q2 the list and its filters (RG62, RG63, CA42),
// L2E-Q3 the opening and the claim (CA39, CA40), L2E-Q4 the account a caller holds (CA31), L2E-Q5 the
// typing and the grants (CA27, CA28, CA29), L2E-Q6 the refusals (CA32, CA33), L2E-Q7 the piece (T9.7),
// L2E-Q8 the brands (06 RG51, RG52), L2E-Q9 the logs (invariant 17), the counters (CA44).
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
import { verificationReasonPreview } from "../src/domains/verification/verification-email.ts";
import type { ObjectStore, StorageOutcome } from "../src/platform/storage.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
} from "../tests/helpers.ts";
import { localSuperuser, sharedMigrationRole } from "./support.ts";

const CREATORS = "/v1/bo/queues/verification-creators/entries";
const BRANDS = "/v1/bo/queues/verification-brands/entries";
const COUNTERS = "/v1/bo/queues/counters";
const ANY_TOKEN = "0".repeat(64);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  randomBytes(40),
  Buffer.from("WEBP"),
]);

/** What a creator declares: distinctive numbers, searched for in every answer (RG47, modele -19). */
const DECLARED = { followers: 123_457, posts: 17, comments: 987_654, bp: 350 };

let database: ApiDatabase;
/** The instant of the first submission of this file, 400 days back: the window of every list. */
let base: string;
let windowFrom: string;
let windowTo: string;
/** Fixtures whose place in a list is not asserted take their instants after the windows of the lists. */
let nextOffset = 1000;
const internals: string[] = [];
const accounts: string[] = [];
const requests: string[] = [];
const watched: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

/** A store in memory: reads what the test put under a key, or fails like Storage that is down. */
function memoryStore(options: { down?: boolean } = {}): ObjectStore & {
  objects: Map<string, Uint8Array>;
  reads: string[];
} {
  const objects = new Map<string, Uint8Array>();
  const reads: string[] = [];
  const failure = {
    ok: false,
    reason: "unavailable",
    status: null,
    errorCode: null,
  } as const;
  return {
    objects,
    reads,
    write: (_bucket, key, bytes): Promise<StorageOutcome<null>> => {
      objects.set(key, bytes);
      return Promise.resolve({ ok: true, value: null });
    },
    read: (_bucket, key): Promise<StorageOutcome<Uint8Array | null>> => {
      reads.push(key);
      return Promise.resolve(
        options.down === true
          ? failure
          : { ok: true, value: objects.get(key) ?? null },
      );
    },
    remove: (_bucket, key): Promise<StorageOutcome<null>> => {
      objects.delete(key);
      return Promise.resolve({ ok: true, value: null });
    },
  };
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
      values (${accountId}, ${randomUUID()}, ${`t14-vq-${role}-${accountId}@example.test`},
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
      values (${accountId}, ${randomUUID()}, ${`t14-vq-member-${accountId}@example.test`},
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

function code(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let signs = "";
  for (const byte of bytes) signs += alphabet[byte % alphabet.length];
  return `INFLUX-${signs}`;
}

/** The UTC date `days` days from today, as the agent types it. */
function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

type Pending = {
  requestId: string;
  code: string | null;
  evidenceId: string | null;
  objectKey: string | null;
};

type Written = {
  level: "account_verified" | "audience_verified" | "brand_verified";
  accountId: string;
  socialAccountId: string | null;
  network: string | null;
  /** Seconds after the first submission of the file: the order of the list. */
  offset?: number;
  /** The deadline, as an interval from now (negative: past). */
  dueIn?: string;
  withEvidence?: boolean;
};

/**
 * A pending request as the doors of 0222 would leave it, with its code and, for an audience request, one
 * active piece: written by the superuser with the triggers out of the way, so that the submission and the
 * deadlines are ours (the doors set them to now()).
 */
async function pendingRequest(written: Written): Promise<Pending> {
  const requestId = randomUUID();
  const offset = written.offset ?? (nextOffset += 1);
  const newCode = written.level === "audience_verified" ? null : code();
  let evidenceId: string | null = null;
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`
      insert into verification.verification_requests
        (id, account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at)
      values (${requestId}, ${written.accountId}, ${written.socialAccountId}, ${written.network},
              ${written.level}::verification.badge_level, 'pending',
              ${base}::timestamptz + make_interval(secs => ${offset}),
              ${base}::timestamptz + make_interval(secs => ${offset}),
              now() + ${written.dueIn ?? "3 hours"}::interval,
              now() + ${written.dueIn ?? "3 hours"}::interval + interval '1 day')`;
    if (newCode !== null) {
      await tx`
        insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
        values (${requestId}, ${written.accountId},
                ${written.level === "brand_verified" ? "domain" : "network"}, ${newCode},
                now() + interval '7 days')`;
    }
    if (written.withEvidence ?? written.level === "audience_verified") {
      const [row] = await tx<{ id: string }[]>`
        insert into verification.evidence_files
          (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
           activated_at, retention_due_at)
        values (${requestId}, ${written.accountId}, 'active', ${WEBP.length}, ${WEBP.length},
                1290, 2796, ${sha256(WEBP)}, now(), now() + interval '45 days')
        returning id::text as id`;
      evidenceId = row?.id ?? null;
    }
  });
  requests.push(requestId);
  let objectKey: string | null = null;
  if (evidenceId !== null) {
    const [row] = await sharedMigrationRole()<{ object_key: string }[]>`
      select object_key from verification.evidence_files where id = ${evidenceId}`;
    objectKey = row?.object_key ?? null;
  }
  if (newCode !== null) watched.push(newCode);
  return { requestId, code: newCode, evidenceId, objectKey };
}

type CreatorOptions = {
  level?: "account_verified" | "audience_verified";
  owner?: string;
  handle?: string;
  network?: string;
  offset?: number;
  dueIn?: string;
  country?: string;
  /** « Compte vérifié » already held on the line (the prerequisite of an audience request, RG12). */
  accountBadge?: boolean;
  declared?: boolean;
};

type Creator = Pending & {
  accountId: string;
  socialAccountId: string;
  handle: string;
  network: string;
};

/** A committed creator with one network line carrying declared figures, and one pending request. */
async function newCreator(options: CreatorOptions = {}): Promise<Creator> {
  const accountId = randomUUID();
  const handle =
    options.handle ?? `t14vq_${accountId.replace(/-/g, "").slice(0, 14)}`;
  const network = options.network ?? "instagram";
  const level = options.level ?? "account_verified";
  const [line] = await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-vq-creator-${accountId}@example.test`},
              now(), ${options.country ?? "FR"}, 'fr', true, now(), 'individual',
              ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
    await tx`
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    const rows = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, pseudonym)
      values (${accountId}, ${network}, true, ${handle}, ${`Pseudo ${handle.slice(-6)}`})
      returning id::text as id`;
    if (options.declared !== false) {
      await tx`
        update profiles.creator_social_accounts
           set followers_count = ${DECLARED.followers}, posts_last_30_days = ${DECLARED.posts},
               avg_comments_per_post = ${DECLARED.comments},
               engagement_rate_bp = ${DECLARED.bp}
         where account_id = ${accountId}`;
    }
    return rows;
  });
  accounts.push(accountId);
  watched.push(handle);
  const socialAccountId = line?.id ?? "";
  if (level === "audience_verified" && options.accountBadge !== false) {
    await accountBadge(accountId, socialAccountId, network, handle);
  }
  const pending = await pendingRequest({
    level,
    accountId,
    socialAccountId,
    network,
    ...(options.offset === undefined ? {} : { offset: options.offset }),
    ...(options.dueIn === undefined ? {} : { dueIn: options.dueIn }),
  });
  return { ...pending, accountId, socialAccountId, handle, network };
}

/** « Compte vérifié » held on a line: an approved request and its badge (superuser, triggers aside). */
async function accountBadge(
  accountId: string,
  socialAccountId: string,
  network: string,
  handle: string,
  grantedBy?: string,
): Promise<void> {
  const requestId = randomUUID();
  const by = grantedBy ?? agent.accountId;
  await localSuperuser().begin(async (tx) => {
    await tx`set local session_replication_role = replica`;
    await tx`
      insert into verification.verification_requests
        (id, account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
      values (${requestId}, ${accountId}, ${socialAccountId}, ${network}, 'account_verified',
              'approved', now() - interval '3 days', now() - interval '3 days',
              now() - interval '2 days', now() - interval '1 day', ${by},
              now() - interval '2 days', now() - interval '2 days')`;
    await tx`
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_handle_at_decision)
      values (${accountId}, ${socialAccountId}, ${network}, ${requestId}, 'account_verified',
              ${by}, now() - interval '2 days', 'public_profile', ${handle})`;
  });
}

type BrandOptions = {
  owner?: string;
  country?: string;
  offset?: number;
  registrationCountry?: string;
};

type Brand = Pending & {
  accountId: string;
  tradeName: string;
  domain: string;
  legalName: string;
  registrationNumber: string;
};

/** A committed brand with its website, its internal block and one pending request on its domain. */
async function newBrand(options: BrandOptions = {}): Promise<Brand> {
  const accountId = randomUUID();
  const tag = accountId.replace(/-/g, "").slice(0, 10);
  const tradeName = `Maison ${tag}`;
  const domain = `t14vq-${tag}.example.test`;
  const legalName = `Societe Anonyme ${tag}`;
  const registrationNumber = `RCS ${tag}`;
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-vq-brand-${accountId}@example.test`},
              now(), ${options.country ?? "FR"}, 'en', true, now(), 'business',
              ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name, website_domain)
      values (${accountId}, ${tradeName}, ${domain})`;
    await tx`
      insert into profiles.advertiser_internal_details
        (account_id, legal_name, registration_country_code, registration_number)
      values (${accountId}, ${legalName}, ${options.registrationCountry ?? "FR"},
              ${registrationNumber})`;
  });
  accounts.push(accountId);
  watched.push(legalName, registrationNumber, domain);
  const pending = await pendingRequest({
    level: "brand_verified",
    accountId,
    socialAccountId: null,
    network: null,
    ...(options.offset === undefined ? {} : { offset: options.offset }),
  });
  return {
    ...pending,
    accountId,
    tradeName,
    domain,
    legalName,
    registrationNumber,
  };
}

function app(store: ObjectStore = defaultStore) {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    storage: store,
  });
}

type Server = ReturnType<typeof app>;

function call(
  server: Server,
  method: "GET" | "POST",
  url: string,
  session: string | null,
  options: { body?: object } = {},
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
    ...(options.body === undefined ? {} : { payload: options.body }),
  });
}

/** The whole answer but its request id (18 T14.4). */
function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

function issuesOf(response: LightMyRequestResponse) {
  const body = response.json<{
    error?: { details?: { path: string; issue: string }[] };
  }>();
  return body.error?.details ?? [];
}

/** The window of the submissions of fixtures written with the offsets `first` to `last` (seconds). */
function between(first: number, last: number): Record<string, string> {
  return {
    from: new Date(Date.parse(base) + (first - 0.5) * 1000).toISOString(),
    to: new Date(Date.parse(base) + (last + 0.5) * 1000).toISOString(),
  };
}

type Row = {
  id: string;
  accountId: string;
  level: string;
  networkCode: string | null;
  displayName: string | null;
  overdue: boolean;
  owner: { accountId: string; displayName: string | null } | null;
  claim: {
    holder: { accountId: string; displayName: string | null } | null;
    heldByCaller: boolean;
  };
  reexamine: { reasonCode: string } | null;
  alerts: string[];
};
type ListBody = { asOf: string; items: Row[]; nextCursor: string | null };

async function list(
  server: Server,
  view: string,
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
  const response = await call(server, "GET", `${view}?${query}`, who.session);
  return {
    status: response.statusCode,
    body:
      response.statusCode === 200
        ? response.json<ListBody>()
        : ({} as ListBody),
    raw: response.body,
  };
}

type Opened = {
  asOf: string;
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
  entry: {
    id: string;
    level: string;
    status: string;
    overdue: boolean;
    claim: {
      holder: { accountId: string; displayName: string | null } | null;
      claimExpiresAt: string | null;
      heldByCaller: boolean;
    };
    lastForcedRelease: {
      holderIsCaller: boolean;
      reasonCode: string;
    } | null;
    reexamine: { reasonCode: string } | null;
    decision: {
      status: string;
      late: boolean;
      reasonCode: string | null;
      internalComment: string | null;
    } | null;
  };
  dossier: {
    codeExpiresAt: string | null;
    creator: {
      handle: string | null;
      pseudonym: string | null;
      profileUrl: string | null;
    } | null;
    brand: {
      tradeName: string | null;
      websiteDomain: string | null;
      internalDetails: {
        legalName: string;
        registrationCountryCode: string;
        registrationNumber: string;
      } | null;
      registrySources: { id: string; sourceType: string }[];
    } | null;
    evidence: { id: string; byteSize: number | null }[];
    history: { status: string; reasonCode: string | null }[];
    badges: { level: string; state: string }[];
    alerts: { code: string; count?: number; accounts?: number }[];
  } | null;
  reasons: {
    code: string;
    requiresMemberMessage: boolean;
    escalatesToAdmin: boolean;
    message: string;
    nextStep: string | null;
  }[];
};

async function opened(
  server: Server,
  view: string,
  requestId: string,
  who: Internal,
): Promise<Opened> {
  const response = await call(
    server,
    "POST",
    `${view}/${requestId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Opened>();
}

function act(
  server: Server,
  view: string,
  requestId: string,
  name: string,
  who: Internal,
  body?: object,
) {
  return call(server, "POST", `${view}/${requestId}/${name}`, who.session, {
    ...(body === undefined ? {} : { body }),
  });
}

async function requestState(requestId: string): Promise<{
  status: string;
  claimedBy: string | null;
  decidedBy: string | null;
  reason: string | null;
  message: string | null;
  comment: string | null;
  slaDueAt: string;
  reexamine: string | null;
  escalated: boolean;
}> {
  const [row] = await sharedMigrationRole()<
    {
      status: string;
      claimed_by: string | null;
      decided_by: string | null;
      reason: string | null;
      message: string | null;
      comment: string | null;
      sla: string;
      reexamine: string | null;
      escalated: boolean;
    }[]
  >`
    select status::text as status, claimed_by_account_id::text as claimed_by,
           decided_by_account_id::text as decided_by, rejection_reason_code as reason,
           member_message as message, internal_comment as comment,
           sla_due_at::text as sla, reexamine_reason_code as reexamine,
           (escalated_at is not null) as escalated
      from verification.verification_requests where id = ${requestId}`;
  if (row === undefined) throw new Error("no such request");
  return {
    status: row.status,
    claimedBy: row.claimed_by,
    decidedBy: row.decided_by,
    reason: row.reason,
    message: row.message,
    comment: row.comment,
    slaDueAt: row.sla,
    reexamine: row.reexamine,
    escalated: row.escalated,
  };
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
     where subject_id = ${subjectId}
     order by seq`;
}

async function conflictAttempts(who: Internal): Promise<number> {
  const rows = await sharedMigrationRole()<{ n: number }[]>`
    select count(*)::int as n from audit.audit_events
     where event_type = 'backoffice.action_refused' and subject_id = ${who.accountId}
       and payload ->> 'action_code' = 'queue.conflict_of_interest'`;
  return rows[0]?.n ?? 0;
}

async function registrySource(country: string): Promise<string> {
  const [row] = await sharedMigrationRole()<{ id: string }[]>`
    select id::text as id from verification.registry_sources
     where is_active and country_code = ${country} limit 1`;
  if (row === undefined)
    throw new Error(`no active registry source for ${country}`);
  return row.id;
}

let agent: Internal;
let colleague: Internal;
let admin: Internal;
let defaultStore: ReturnType<typeof memoryStore>;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  defaultStore = memoryStore();
  const [window] = await sharedMigrationRole()<
    { base: string; from: string; to: string }[]
  >`
    select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as base,
           to_char((t - interval '1 second') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as from,
           to_char((t + interval '5000 seconds') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as to
      from (select now() - interval '400 days'
                   - make_interval(secs => ${Math.floor(Math.random() * 2_000_000)}) as t) x`;
  base = window?.base ?? "";
  windowFrom = window?.from ?? "";
  windowTo = window?.to ?? "";
  agent = await newInternal("agent", "Camille");
  colleague = await newInternal("agent", "Marie");
  admin = await newInternal("admin", "Dominique");
});

afterAll(async () => {
  await closeDatabase(database);
  await sharedMigrationRole().begin(async (tx) => {
    if (requests.length > 0) {
      await tx`
        update verification.verification_requests
           set status = 'cancelled', cancelled_at = now(), closed_at = now()
         where id = any(${requests}::uuid[]) and status = 'pending'`;
    }
    if (internals.length > 0) {
      await tx`
        update identity.agent_profiles
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
         where account_id = any(${internals}::uuid[]) and is_active`;
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe("T14, CA43: two views of one queue, behind a session of an internal account", () => {
  it("a request of the other view, an unknown one, a draft and the caller's own answer the same 404 on every route", async () => {
    const server = app();
    const creator = await newCreator();
    const brand = await newBrand();
    // a draft is no entry of the queue (EC-L2E-08-10)
    const draft = randomUUID();
    const draftOwner = await newCreator();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (id, account_id, social_account_id, network_code, level, status)
        values (${draft}, ${draftOwner.accountId}, ${draftOwner.socialAccountId}, 'instagram',
                'audience_verified', 'draft')`;
    });
    requests.push(draft);
    // the caller's own account: the policy of 0221 hides it (C(3)), written the way the inventory does
    const own = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (id, account_id, level, status, created_at, submitted_at, sla_due_at, escalate_at)
        values (${own}, ${colleague.accountId}, 'brand_verified', 'pending', now(), now(),
                now() + interval '1 day', now() + interval '2 days')`;
    });
    requests.push(own);

    const acts = [
      ["open", undefined],
      ["release", undefined],
      ["extend", undefined],
      [
        "reexamine",
        { reviewToken: ANY_TOKEN, reasonCode: "network_unreachable" },
      ],
      ["reject", { reviewToken: ANY_TOKEN, reasonCode: "missing_evidence" }],
      [
        "compare",
        {
          reviewToken: ANY_TOKEN,
          followers: 1,
          postsLast30Days: 1,
          avgComments: 1,
          engagementBp: null,
        },
      ],
    ] as const;
    for (const [name, body] of acts) {
      const unknown = answer(
        await act(server, CREATORS, randomUUID(), name, agent, body),
      );
      expect(unknown.status, name).toBe(404);
      for (const id of [brand.requestId, draft]) {
        expect(
          answer(await act(server, CREATORS, id, name, agent, body)),
          `${name} on ${id}`,
        ).toEqual(unknown);
      }
      if (name !== "compare") {
        const unknownBrand = answer(
          await act(server, BRANDS, randomUUID(), name, agent, body),
        );
        expect(
          answer(
            await act(server, BRANDS, creator.requestId, name, agent, body),
          ),
          `${name} on the brand view`,
        ).toEqual(unknownBrand);
      }
    }
    // the own account of the caller, on the view of its population
    const ownUnknown = answer(
      await act(server, BRANDS, randomUUID(), "open", colleague),
    );
    expect(answer(await act(server, BRANDS, own, "open", colleague))).toEqual(
      ownUnknown,
    );
    const piece = answer(
      await call(
        server,
        "GET",
        `${CREATORS}/${randomUUID()}/evidence/${randomUUID()}`,
        agent.session,
      ),
    );
    expect(piece.status).toBe(404);
    expect(
      answer(
        await call(
          server,
          "GET",
          `${CREATORS}/${brand.requestId}/evidence/${randomUUID()}`,
          agent.session,
        ),
      ),
    ).toEqual(piece);
  });

  it("answers 401 to a member session on the lists, and the counters carry one line per view (CA43)", async () => {
    const server = app();
    const member = await newMemberSession();
    for (const url of [CREATORS, BRANDS, COUNTERS]) {
      expect(answer(await call(server, "GET", url, member)).status, url).toBe(
        401,
      );
    }
    const response = await call(server, "GET", COUNTERS, agent.session);
    expect(response.statusCode, response.body).toBe(200);
    const { queues } = response.json<{
      queues: { queue: string; policy: { decisionMinutes: number } }[];
    }>();
    const codes = queues.map((queue) => queue.queue);
    expect(codes).toEqual(
      expect.arrayContaining([
        "profiles_advertiser",
        "verification_creators",
        "verification_brands",
      ]),
    );
    // one delay, the one of the queue `verification` (D39: one business day)
    for (const queue of queues.filter((line) =>
      line.queue.startsWith("verification_"),
    )) {
      expect(queue.policy.decisionMinutes).toBeGreaterThan(0);
    }
  });
});

describe("the list: order, filters, paging, alerts, nothing declared (RG62, RG63, CA42)", () => {
  it("lists a view and only it, the oldest first, the account the caller holds left out, no handle and no declared figure", async () => {
    const server = app();
    const first = await newCreator({ offset: 10 });
    const second = await newCreator({ offset: 20 });
    const held = await newCreator({ offset: 15, owner: agent.accountId });
    const brand = await newBrand({ offset: 12 });
    const found = await list(server, CREATORS, agent, between(9, 21));
    expect(found.status, found.raw).toBe(200);
    expect(found.body.items.map((item) => item.id)).toEqual([
      first.requestId,
      second.requestId,
    ]);
    const [line] = found.body.items;
    expect(line).toMatchObject({
      level: "account_verified",
      networkCode: "instagram",
      overdue: false,
      owner: null,
      claim: { holder: null, heldByCaller: false },
      alerts: [],
    });
    expect(line?.displayName).toEqual(expect.any(String));
    // RG47, modele -19: the line carries neither the handle, nor the code, nor one declared value
    for (const secret of [
      first.handle,
      first.code ?? "",
      String(DECLARED.followers),
      String(DECLARED.comments),
    ]) {
      expect(found.raw).not.toContain(secret);
    }
    // the holder reads the account he holds nowhere, and the colleague reads it
    expect(found.raw).not.toContain(held.requestId);
    const colleagueSees = await list(
      server,
      CREATORS,
      colleague,
      between(9, 21),
    );
    expect(colleagueSees.body.items.map((item) => item.id)).toContain(
      held.requestId,
    );
    // the brands view lists the brand, by its trading name
    const brands = await list(server, BRANDS, agent, between(9, 21));
    expect(brands.body.items).toHaveLength(1);
    expect(brands.body.items[0]).toMatchObject({
      id: brand.requestId,
      level: "brand_verified",
      networkCode: null,
      displayName: brand.tradeName,
    });
    // the legal name and the registration never reach the list
    expect(brands.raw).not.toContain(brand.legalName);
    expect(brands.raw).not.toContain(brand.registrationNumber);
  });

  it("sorts by remaining SLA, level and network, and pages with an opaque cursor that is bound to its sort (RG34, RG62)", async () => {
    const server = app();
    const slowest = await newCreator({ offset: 100, dueIn: "9 hours" });
    const quickest = await newCreator({
      offset: 101,
      dueIn: "1 hour",
      level: "audience_verified",
      network: "tiktok",
    });
    const middle = await newCreator({
      offset: 102,
      dueIn: "4 hours",
      network: "youtube",
    });
    const all = [slowest, quickest, middle];
    const idsOf = (body: ListBody) =>
      body.items
        .map((item) => item.id)
        .filter((id) => all.some((creator) => creator.requestId === id));
    expect(
      idsOf((await list(server, CREATORS, agent, between(99, 103))).body),
    ).toEqual([slowest.requestId, quickest.requestId, middle.requestId]);
    expect(
      idsOf(
        (
          await list(server, CREATORS, agent, {
            ...between(99, 103),
            sort: "sla",
          })
        ).body,
      ),
    ).toEqual([quickest.requestId, middle.requestId, slowest.requestId]);
    expect(
      idsOf(
        (
          await list(server, CREATORS, agent, {
            ...between(99, 103),
            sort: "level",
          })
        ).body,
      ),
    ).toEqual([slowest.requestId, middle.requestId, quickest.requestId]);
    expect(
      idsOf(
        (
          await list(server, CREATORS, agent, {
            ...between(99, 103),
            sort: "network",
          })
        ).body,
      ),
    ).toEqual([slowest.requestId, quickest.requestId, middle.requestId]);
    expect(
      idsOf(
        (
          await list(server, CREATORS, agent, {
            ...between(99, 103),
            level: "audience_verified",
          })
        ).body,
      ),
    ).toEqual([quickest.requestId]);
    expect(
      idsOf(
        (
          await list(server, CREATORS, agent, {
            ...between(99, 103),
            network: "youtube",
          })
        ).body,
      ),
    ).toEqual([middle.requestId]);
    // paging: one line at a time, no line twice, the cursor of one sort is refused by another
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 40; page += 1) {
      const params: Record<string, string | number> = {
        ...between(99, 103),
        sort: "sla",
        limit: 1,
      };
      if (cursor !== null) params.cursor = cursor;
      const found = await list(server, CREATORS, agent, params);
      expect(found.status, found.raw).toBe(200);
      seen.push(...found.body.items.map((item) => item.id));
      cursor = found.body.nextCursor;
      if (cursor === null) break;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.filter((id) => all.some((c) => c.requestId === id))).toEqual([
      quickest.requestId,
      middle.requestId,
      slowest.requestId,
    ]);
    const paged = await list(server, CREATORS, agent, {
      ...between(99, 103),
      sort: "sla",
      limit: 1,
    });
    expect(paged.body.nextCursor).not.toBeNull();
    const wrong = await list(server, CREATORS, agent, {
      ...between(99, 103),
      sort: "age",
      cursor: paged.body.nextCursor ?? "",
    });
    expect(wrong.status).toBe(400);
    expect(
      (await list(server, CREATORS, agent, { cursor: "bm90LWEtY3Vyc29y" }))
        .status,
    ).toBe(400);
  });

  it("marks the one past its deadline and keeps it decidable (CA42, RG65, C8); filters by holder, owner, period, mark", async () => {
    const server = app();
    const late = await newCreator({ offset: 200, dueIn: "-3 hours" });
    const plain = await newCreator({ offset: 201 });
    const owned = await newCreator({ offset: 202, owner: colleague.accountId });
    const overdue = await list(server, CREATORS, agent, {
      ...between(199, 203),
      overdue: "true",
    });
    expect(overdue.body.items.map((item) => item.id)).toEqual([late.requestId]);
    expect(overdue.body.items[0]?.overdue).toBe(true);
    expect(
      (await list(server, CREATORS, agent, between(199, 203))).body.items.find(
        (item) => item.id === plain.requestId,
      )?.overdue,
    ).toBe(false);
    expect(
      (
        await list(server, CREATORS, agent, {
          ...between(199, 203),
          owner: colleague.accountId,
        })
      ).body.items.map((item) => item.id),
    ).toEqual([owned.requestId]);
    expect(
      (
        await list(server, CREATORS, agent, {
          ...between(199, 203),
          owner: "none",
        })
      ).body.items.map((item) => item.id),
    ).not.toContain(owned.requestId);
    // the period of the submission: the late one alone
    const period = await list(server, CREATORS, agent, {
      from: new Date(Date.parse(base) + 199_500).toISOString(),
      to: new Date(Date.parse(base) + 200_500).toISOString(),
    });
    expect(period.body.items.map((item) => item.id)).toEqual([late.requestId]);
    // a period that ends before it starts is refused, not read as an empty list
    expect(
      (await list(server, CREATORS, agent, { from: windowTo, to: windowFrom }))
        .status,
    ).toBe(400);
    // holder: free, me, a named agent
    await opened(server, CREATORS, plain.requestId, agent);
    const free = await list(server, CREATORS, agent, {
      ...between(199, 203),
      holder: "free",
    });
    expect(free.body.items.map((item) => item.id)).not.toContain(
      plain.requestId,
    );
    expect(
      (
        await list(server, CREATORS, agent, {
          ...between(199, 203),
          holder: "me",
        })
      ).body.items.map((item) => item.id),
    ).toEqual([plain.requestId]);
    expect(
      (
        await list(server, CREATORS, colleague, {
          ...between(199, 203),
          holder: agent.accountId,
        })
      ).body.items.map((item) => item.id),
    ).toEqual([plain.requestId]);
    // a decision after the deadline is possible and marked (C8)
    const lateOpen = await opened(server, CREATORS, late.requestId, agent);
    expect(lateOpen.entry.overdue).toBe(true);
    const decided = await act(
      server,
      CREATORS,
      late.requestId,
      "reject",
      agent,
      {
        reviewToken: lateOpen.reviewToken,
        reasonCode: "evidence_unreadable",
      },
    );
    expect(decided.statusCode, decided.body).toBe(200);
    expect(decided.json()).toMatchObject({ status: "rejected", late: true });
  });

  it("shows the alerts, on the line and in the dossier, and none refuses (RG55, RG63)", async () => {
    const server = app();
    const sharedHandle = `t14vq_shared_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const verified = await newCreator({
      handle: sharedHandle,
      offset: 300,
      declared: false,
    });
    await accountBadge(
      verified.accountId,
      verified.socialAccountId,
      "instagram",
      sharedHandle,
    );
    const twin = await newCreator({ handle: sharedHandle, offset: 301 });
    // a refusal of the same triplet, a day ago, inside the window of the cap
    const refused = await newCreator({ offset: 302 });
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
           rejection_reason_code)
        values (${refused.accountId}, ${refused.socialAccountId}, 'instagram', 'account_verified',
                'rejected', now() - interval '3 days', now() - interval '3 days',
                now() - interval '2 days', now() - interval '1 day', ${agent.accountId},
                now() - interval '1 day', now() - interval '1 day', 'missing_evidence')`;
    });
    const quiet = await newCreator({ offset: 303 });
    const alerts = await list(server, CREATORS, agent, {
      ...between(299, 304),
      alert: "true",
    });
    expect(alerts.body.items.map((item) => item.id)).toEqual([
      verified.requestId,
      twin.requestId,
      refused.requestId,
    ]);
    const byId = new Map(
      alerts.body.items.map((item) => [item.id, item.alerts]),
    );
    expect(byId.get(twin.requestId)).toEqual([
      "same_handle_elsewhere",
      "handle_verified_elsewhere",
    ]);
    expect(byId.get(verified.requestId)).toEqual(["same_handle_elsewhere"]);
    expect(byId.get(refused.requestId)).toEqual(["prior_rejections"]);
    expect(byId.has(quiet.requestId)).toBe(false);
    // the dossier says the same, and the history keeps the refusal
    const twinOpen = await opened(server, CREATORS, twin.requestId, agent);
    expect(twinOpen.dossier?.alerts).toEqual([
      { code: "same_handle_elsewhere", accounts: 1 },
      { code: "handle_verified_elsewhere" },
    ]);
    const refusedOpen = await opened(
      server,
      CREATORS,
      refused.requestId,
      agent,
    );
    expect(refusedOpen.dossier?.alerts).toEqual([
      { code: "prior_rejections", count: 1 },
    ]);
    expect(refusedOpen.dossier?.history).toEqual([
      expect.objectContaining({
        status: "rejected",
        reasonCode: "missing_evidence",
      }),
    ]);
    // an alert never refuses: the twin is decided like any other
    const granted = await act(
      server,
      CREATORS,
      twin.requestId,
      "reject",
      agent,
      {
        reviewToken: twinOpen.reviewToken,
        reasonCode: "shared_account",
      },
    );
    expect(granted.statusCode, granted.body).toBe(200);
  });
});

describe("the opening and the claim (RG43, RG64, CA39, CA40, 15 C1 to C4, A8, A9)", () => {
  it("claims on opening and gives the holder the dossier, never a declared figure, a code or a key (RG47, RG55)", async () => {
    const server = app();
    const creator = await newCreator({ level: "audience_verified" });
    const view = await call(
      server,
      "POST",
      `${CREATORS}/${creator.requestId}/open`,
      agent.session,
    );
    expect(view.statusCode, view.body).toBe(200);
    const body = view.json<Opened>();
    expect(body.outcome).toBe("claimed");
    expect(body.reviewToken).toMatch(/^[0-9a-f]{64}$/);
    expect(body.entry).toMatchObject({
      level: "audience_verified",
      status: "pending",
      claim: { heldByCaller: true, holder: { displayName: "Camille" } },
    });
    expect(body.dossier?.creator).toEqual({
      handle: creator.handle,
      pseudonym: `Pseudo ${creator.handle.slice(-6)}`,
      profileUrl: null,
    });
    expect(body.dossier?.evidence).toEqual([
      expect.objectContaining({
        id: creator.evidenceId,
        byteSize: WEBP.length,
      }),
    ]);
    expect(body.dossier?.badges).toEqual([
      expect.objectContaining({ level: "account_verified", state: "active" }),
    ]);
    expect(body.reasons.map((reason) => reason.code)).toContain(
      "evidence_too_old",
    );
    expect(
      body.reasons.find((reason) => reason.code === "minor")?.escalatesToAdmin,
    ).toBe(true);
    expect(
      body.reasons.find((reason) => reason.code === "other")
        ?.requiresMemberMessage,
    ).toBe(true);
    // the reasons of a creator, never the ones of a brand (RG57, CA43)
    expect(body.reasons.map((reason) => reason.code)).not.toContain(
      "name_mismatch",
    );
    // what the agent reads under a reason is the sentence of the e-mail in the language of the account
    // (RG57; L2E-22): the creator is French, and each reason carries its sentence and its next step
    for (const reason of body.reasons) {
      expect(reason).toMatchObject({
        message: verificationReasonPreview(
          "fr",
          "account_verified",
          reason.code,
        )?.message,
        nextStep: verificationReasonPreview(
          "fr",
          "account_verified",
          reason.code,
        )?.nextStep,
      });
      expect(reason.message.length).toBeGreaterThan(0);
    }
    expect(view.headers["cache-control"]).toBe("no-store");
    for (const secret of [
      String(DECLARED.followers),
      String(DECLARED.comments),
      creator.objectKey ?? "unreachable",
      "object_key",
      "objectKey",
    ]) {
      expect(view.body).not.toContain(secret);
    }
    expect(view.body).not.toMatch(/https?:\/\/[^"]*supabase|signed|token=/i);
    // reopening is no second claim; the register keeps one line per opening (L2BS-7)
    const again = await opened(server, CREATORS, creator.requestId, agent);
    expect(again.outcome).toBe("held");
    expect(again.reviewToken).toBe(body.reviewToken);
    const lines = (await registerLines(creator.requestId)).filter(
      (line) => line.event === "queue.entry_opened",
    );
    expect(lines.map((line) => line.payload.outcome)).toEqual([
      "claimed",
      "held",
    ]);
    expect(lines.every((line) => line.actor === agent.accountId)).toBe(true);
  });

  it("shows a colleague « en cours — {first name} », read-only, and refuses his decision (CA39)", async () => {
    const server = app();
    const creator = await newCreator();
    await opened(server, CREATORS, creator.requestId, agent);
    const view = await opened(server, CREATORS, creator.requestId, colleague);
    expect(view.outcome).toBe("read_only");
    expect(view.reviewToken).toBeNull();
    expect(view.dossier).toBeNull();
    expect(view.entry.claim).toMatchObject({
      heldByCaller: false,
      holder: { accountId: agent.accountId, displayName: "Camille" },
    });
    const refused = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      colleague,
      {
        reviewToken: ANY_TOKEN,
        reasonCode: "missing_evidence",
      },
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "claim", issue: "held_by_other" },
      { path: "claim.holder", issue: "Camille" },
    ]);
    for (const name of ["release", "extend"]) {
      expect(
        (await act(server, CREATORS, creator.requestId, name, colleague))
          .statusCode,
        name,
      ).toBe(409);
    }
    expect((await requestState(creator.requestId)).status).toBe("pending");
    const lines = (await registerLines(creator.requestId)).filter(
      (line) => line.event === "queue.entry_opened",
    );
    expect(lines.map((line) => line.payload.outcome)).toEqual([
      "claimed",
      "read_only",
    ]);
  });

  it("frees an entry whose claim expired and says so when it is taken over (CA40, A9)", async () => {
    const server = app();
    const creator = await newCreator();
    await opened(server, CREATORS, creator.requestId, agent);
    await sharedMigrationRole()`
      update verification.verification_requests
         set claimed_at = now() - interval '40 minutes',
             claim_expires_at = now() - interval '10 minutes'
       where id = ${creator.requestId}`;
    const free = await list(server, CREATORS, colleague, { holder: "free" });
    expect(free.body.items.map((item) => item.id)).toContain(creator.requestId);
    const view = await opened(server, CREATORS, creator.requestId, colleague);
    expect(view.outcome).toBe("claimed");
    const events = (await registerLines(creator.requestId)).map(
      (line) => line.event,
    );
    expect(events).toContain("queue.claim_expired");
    // the former holder decides nothing any more: the entry is Marie's
    const refused = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "missing_evidence",
      },
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
  });

  it("extends and gives back the claim; a decision without it is refused (RG64, C3)", async () => {
    const server = app();
    const creator = await newCreator();
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const before = view.entry.claim.claimExpiresAt ?? "";
    await sharedMigrationRole()`
      update verification.verification_requests
         set claim_expires_at = now() + interval '1 minute'
       where id = ${creator.requestId}`;
    const extended = await act(
      server,
      CREATORS,
      creator.requestId,
      "extend",
      agent,
    );
    expect(extended.statusCode, extended.body).toBe(200);
    expect(
      Date.parse(extended.json<{ claimExpiresAt: string }>().claimExpiresAt),
    ).toBeGreaterThan(Date.parse(before) - 5_000);
    const released = await act(
      server,
      CREATORS,
      creator.requestId,
      "release",
      agent,
    );
    expect(released.json()).toEqual({ released: true });
    expect((await requestState(creator.requestId)).claimedBy).toBeNull();
    const refused = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "missing_evidence",
      },
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
  });

  it("lets only an administrator lift a live claim, names the holder and tells him at his next opening (C4, A8, CA63)", async () => {
    const server = app();
    const creator = await newCreator();
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const attempt = await act(
      server,
      CREATORS,
      creator.requestId,
      "force-release",
      colleague,
      {
        reasonCode: "holder_absent",
      },
    );
    expect(attempt.statusCode).toBe(403);
    expect((await requestState(creator.requestId)).claimedBy).toBe(
      agent.accountId,
    );
    const attempts = await sharedMigrationRole()<{ actor: string | null }[]>`
      select actor_account_id::text as actor from audit.audit_events
       where event_type = 'backoffice.action_refused' and subject_id = ${colleague.accountId}
         and payload ->> 'action_code' = 'queue.force_release_claim'`;
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    const lifted = await act(
      server,
      CREATORS,
      creator.requestId,
      "force-release",
      admin,
      {
        reasonCode: "holder_absent",
      },
    );
    expect(lifted.statusCode, lifted.body).toBe(200);
    expect(lifted.json()).toEqual({
      released: true,
      holder: { accountId: agent.accountId, displayName: "Camille" },
    });
    const dispossessed = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "missing_evidence",
      },
    );
    expect(dispossessed.statusCode).toBe(409);
    expect(issuesOf(dispossessed)).toEqual([
      { path: "claim", issue: "claim_lifted" },
    ]);
    const again = await opened(server, CREATORS, creator.requestId, agent);
    expect(again.outcome).toBe("claimed");
    expect(again.entry.lastForcedRelease).toMatchObject({
      reasonCode: "holder_absent",
      holderIsCaller: true,
    });
  });
});

describe("an account the caller holds (08 RG53, CA31, 15 RG36, 0215)", () => {
  it("refuses the opening, the decision, the typing and the piece with the issue conflict_of_interest, the attempt journaled, no claim taken", async () => {
    const server = app();
    const held = await newCreator({
      owner: agent.accountId,
      level: "audience_verified",
    });
    const before = await conflictAttempts(agent);
    const attempts: [string, LightMyRequestResponse][] = [
      ["open", await act(server, CREATORS, held.requestId, "open", agent)],
      [
        "reject",
        await act(server, CREATORS, held.requestId, "reject", agent, {
          reviewToken: ANY_TOKEN,
          reasonCode: "missing_evidence",
        }),
      ],
      [
        "compare",
        await act(server, CREATORS, held.requestId, "compare", agent, {
          reviewToken: ANY_TOKEN,
          followers: 1,
          postsLast30Days: 1,
          avgComments: 1,
          engagementBp: null,
        }),
      ],
      ["extend", await act(server, CREATORS, held.requestId, "extend", agent)],
      [
        "piece",
        await call(
          server,
          "GET",
          `${CREATORS}/${held.requestId}/evidence/${held.evidenceId}`,
          agent.session,
        ),
      ],
    ];
    for (const [name, response] of attempts) {
      expect(response.statusCode, name).toBe(403);
      expect(issuesOf(response), name).toEqual([
        { path: "entry", issue: "conflict_of_interest" },
      ]);
    }
    expect(await conflictAttempts(agent)).toBe(before + attempts.length);
    const state = await requestState(held.requestId);
    expect(state).toMatchObject({ status: "pending", claimedBy: null });
    // the register line is the agent's own, with the typed code and nothing else
    const [line] = await sharedMigrationRole()<
      { actor: string | null; payload: Record<string, unknown> }[]
    >`
      select actor_account_id::text as actor, payload from audit.audit_events
       where event_type = 'backoffice.action_refused' and subject_id = ${agent.accountId}
         and payload ->> 'action_code' = 'queue.conflict_of_interest'
       order by seq desc limit 1`;
    expect(line?.actor).toBe(agent.accountId);
    expect(JSON.stringify(line?.payload)).not.toContain(held.requestId);
    // giving a claim back stays open to him (he gets rid of it, never decides): not a refusal of interest
    const release = await act(
      server,
      CREATORS,
      held.requestId,
      "release",
      agent,
    );
    expect(release.statusCode).not.toBe(403);
    // a colleague treats it like any entry
    expect(
      (await opened(server, CREATORS, held.requestId, colleague)).outcome,
    ).toBe("claimed");
  });
});

describe("the typing, the comparison and the grants (RG25, RG36 to RG42, RG47, RG48, CA13, CA27 to CA30)", () => {
  async function audience(options: CreatorOptions = {}) {
    const server = app();
    const creator = await newCreator({
      level: "audience_verified",
      ...options,
    });
    const view = await opened(server, CREATORS, creator.requestId, agent);
    return { server, creator, token: view.reviewToken ?? "" };
  }

  const FIGURES = {
    followers: 382_000,
    postsLast30Days: 9,
    avgComments: 1_200,
    engagementBp: 420,
  };

  it("hands the declared figures back only in the answer of the typing, with the verdict of the gap, and never refuses on it (RG41, RG42, RG48, CA28)", async () => {
    const { server, creator, token } = await audience();
    // before: nothing declared in the dossier (checked in the opening); then the typing
    const compared = await act(
      server,
      CREATORS,
      creator.requestId,
      "compare",
      agent,
      {
        reviewToken: token,
        ...FIGURES,
      },
    );
    expect(compared.statusCode, compared.body).toBe(200);
    expect(compared.json()).toEqual({
      declared: {
        followers: DECLARED.followers,
        postsLast30Days: DECLARED.posts,
        avgComments: DECLARED.comments,
        engagementBp: DECLARED.bp,
      },
      gapAlertPercent: 30,
      alert: true,
    });
    expect(compared.headers["cache-control"]).toBe("no-store");
    const near = await act(
      server,
      CREATORS,
      creator.requestId,
      "compare",
      agent,
      {
        reviewToken: token,
        followers: 123_500,
        postsLast30Days: 17,
        avgComments: 987_000,
        engagementBp: null,
      },
    );
    expect(near.json()).toMatchObject({ alert: false });
    // 350 % is not a rate, a figure that is not whole is no figure (cas limite 2)
    const wide = await act(
      server,
      CREATORS,
      creator.requestId,
      "compare",
      agent,
      {
        reviewToken: token,
        ...FIGURES,
        engagementBp: 35_000,
      },
    );
    expect(wide.statusCode).toBe(400);
    expect(
      (
        await act(server, CREATORS, creator.requestId, "compare", agent, {
          reviewToken: token,
          ...FIGURES,
          followers: -1,
        })
      ).statusCode,
    ).toBe(400);
    // a comparison writes nothing: the request is as it was
    expect(await requestState(creator.requestId)).toMatchObject({
      status: "pending",
      claimedBy: agent.accountId,
    });
    // a stale token is refused: the creator changed his line since the opening
    await sharedMigrationRole()`
      update profiles.creator_social_accounts set followers_count = followers_count + 1
       where id = ${creator.socialAccountId}`;
    const stale = await act(
      server,
      CREATORS,
      creator.requestId,
      "compare",
      agent,
      {
        reviewToken: token,
        ...FIGURES,
      },
    );
    expect(stale.statusCode).toBe(409);
    expect(issuesOf(stale)).toEqual([{ path: "entry", issue: "stale_token" }]);
  });

  it("refuses a grant without its period or with a period that is not one, and never on a gap of 210 % (CA27, CA28, cas limite 2)", async () => {
    const { server, creator, token } = await audience();
    const body = {
      reviewToken: token,
      ...FIGURES,
      periodStart: day(-5),
      periodEnd: day(-1),
      observedHandle: creator.handle,
    };
    // a period is required: the contract refuses the body before any door
    const withoutPeriod = {
      reviewToken: token,
      ...FIGURES,
      observedHandle: creator.handle,
    };
    expect(
      (
        await act(
          server,
          CREATORS,
          creator.requestId,
          "grant-audience",
          agent,
          withoutPeriod,
        )
      ).statusCode,
    ).toBe(400);
    for (const [period, issue] of [
      [{ periodStart: day(-1), periodEnd: day(-5) }, "period_order"],
      [{ periodStart: day(1), periodEnd: day(2) }, "period_future"],
      [{ periodStart: day(-60), periodEnd: day(-45) }, "period_too_old"],
    ] as const) {
      const refused = await act(
        server,
        CREATORS,
        creator.requestId,
        "grant-audience",
        agent,
        {
          ...body,
          ...period,
        },
      );
      expect(refused.statusCode, issue).toBe(400);
      expect(issuesOf(refused)).toEqual([{ path: "period", issue }]);
    }
    expect((await requestState(creator.requestId)).status).toBe("pending");
    const granted = await act(
      server,
      CREATORS,
      creator.requestId,
      "grant-audience",
      agent,
      body,
    );
    expect(granted.statusCode, granted.body).toBe(200);
    const parsed = granted.json<{
      outcome: string;
      badgeId: string;
      decidedAt: string;
      late: boolean;
      next: unknown;
    }>();
    expect(parsed).toMatchObject({ outcome: "granted", late: false });
    expect(parsed.badgeId).toMatch(/^[0-9a-f-]{36}$/);
    // the gap of 210 % refused nothing; the figures observed and the declared ones side by side
    const [badge] = await sharedMigrationRole()<
      {
        observed_followers: string;
        declared_followers: string;
        granted_by: string;
        state: string;
      }[]
    >`
      select observed_followers::text, declared_followers_at_decision::text as declared_followers,
             granted_by_account_id::text as granted_by, state::text
        from verification.badges where id = ${parsed.badgeId}`;
    expect(badge).toEqual({
      observed_followers: String(FIGURES.followers),
      declared_followers: String(DECLARED.followers),
      granted_by: agent.accountId,
      state: "active",
    });
    expect(await requestState(creator.requestId)).toMatchObject({
      status: "approved",
      decidedBy: agent.accountId,
    });
    // CA30: the decision carries the agent and the instant, in the register, nothing of the figures
    const lines = (await registerLines(creator.requestId)).filter(
      (line) => line.event === "verification.granted",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.actor).toBe(agent.accountId);
    expect(JSON.stringify(lines[0]?.payload)).not.toContain(
      String(FIGURES.followers),
    );
    // a closed entry is decided once: a second decision is refused
    const twice = await act(
      server,
      CREATORS,
      creator.requestId,
      "grant-audience",
      agent,
      body,
    );
    expect(twice.statusCode).toBe(409);
  });

  it("grants « Compte vérifié » on the code read, refuses another, and answers the entry to open next (RG25, CA13)", async () => {
    const server = app();
    const creator = await newCreator();
    const next = await newCreator();
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const wrong = await act(
      server,
      CREATORS,
      creator.requestId,
      "grant-account",
      agent,
      {
        reviewToken: view.reviewToken,
        observedCode: "INFLUX-ABCDEFGH",
        observedHandle: creator.handle,
      },
    );
    expect(wrong.statusCode).toBe(400);
    expect(issuesOf(wrong)).toEqual([
      { path: "observedCode", issue: "code_mismatch" },
    ]);
    const real = await act(
      server,
      CREATORS,
      creator.requestId,
      "grant-account",
      agent,
      {
        reviewToken: view.reviewToken,
        observedCode: creator.code,
        observedHandle: creator.handle,
        internalComment: "Code seen in the biography.",
      },
    );
    expect(real.statusCode, real.body).toBe(200);
    expect(real.json()).toMatchObject({ outcome: "granted", late: false });
    expect(
      real.json<{ next: { entryId: string } | null }>().next,
    ).not.toBeNull();
    const state = await requestState(creator.requestId);
    expect(state).toMatchObject({
      status: "approved",
      decidedBy: agent.accountId,
      comment: "Code seen in the biography.",
    });
    // the next entry is one nobody holds, in the same view: never this one
    expect(
      real.json<{ next: { entryId: string } | null }>().next?.entryId,
    ).not.toBe(creator.requestId);
    expect(next.requestId).toBeTruthy();
  });

  it("answers a second finding of one handle as an outcome: refused ownership_not_proven, both entries escalated, no badge (EC-L2E-08-2)", async () => {
    const server = app();
    const handle = `t14vq_dup_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const first = await newCreator({ handle });
    const second = await newCreator({ handle });
    const one = await opened(server, CREATORS, first.requestId, agent);
    const done = await act(
      server,
      CREATORS,
      first.requestId,
      "grant-account",
      agent,
      {
        reviewToken: one.reviewToken,
        observedCode: first.code,
        observedHandle: handle,
      },
    );
    expect(done.json()).toMatchObject({ outcome: "granted" });
    const two = await opened(server, CREATORS, second.requestId, agent);
    const dup = await act(
      server,
      CREATORS,
      second.requestId,
      "grant-account",
      agent,
      {
        reviewToken: two.reviewToken,
        observedCode: second.code,
        observedHandle: handle,
      },
    );
    expect(dup.statusCode, dup.body).toBe(200);
    expect(dup.json()).toMatchObject({
      outcome: "handle_already_verified",
      badgeId: null,
    });
    expect(await requestState(second.requestId)).toMatchObject({
      status: "rejected",
      reason: "ownership_not_proven",
      escalated: true,
    });
    expect((await requestState(first.requestId)).escalated).toBe(true);
  });

  it("refuses to grant an audience whose account is not verified or without a piece, and the wrong level (RG12, -13)", async () => {
    const server = app();
    const orphan = await newCreator({
      level: "audience_verified",
      accountBadge: false,
    });
    const view = await opened(server, CREATORS, orphan.requestId, agent);
    const body = {
      reviewToken: view.reviewToken,
      ...FIGURES,
      periodStart: day(-5),
      periodEnd: day(-1),
      observedHandle: orphan.handle,
    };
    const refused = await act(
      server,
      CREATORS,
      orphan.requestId,
      "grant-audience",
      agent,
      body,
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "entry", issue: "ownership_prerequisite" },
    ]);
    // an account-level request cannot be compared, nor granted as an audience
    const account = await newCreator();
    const accountView = await opened(
      server,
      CREATORS,
      account.requestId,
      agent,
    );
    const level = await act(
      server,
      CREATORS,
      account.requestId,
      "compare",
      agent,
      {
        reviewToken: accountView.reviewToken,
        ...FIGURES,
      },
    );
    expect(level.statusCode).toBe(400);
    expect(issuesOf(level)).toEqual([
      { path: "level", issue: "invalid_level" },
    ]);
    // no piece: the audience is not granted (a decision needs what was examined)
    const bare = await newCreator({ level: "audience_verified" });
    await sharedMigrationRole()`
      update verification.evidence_files set state = 'purging', purge_requested_at = now()
       where request_id = ${bare.requestId}`;
    const bareView = await opened(server, CREATORS, bare.requestId, agent);
    const missing = await act(
      server,
      CREATORS,
      bare.requestId,
      "grant-audience",
      agent,
      {
        ...body,
        reviewToken: bareView.reviewToken,
        observedHandle: bare.handle,
      },
    );
    expect(missing.statusCode).toBe(409);
    expect(issuesOf(missing)).toEqual([
      { path: "entry", issue: "missing_evidence" },
    ]);
  });

  it("leaves the entry in the queue, its age running, when it is marked « à réexaminer » (RG50, CA29)", async () => {
    const server = app();
    const creator = await newCreator({ level: "audience_verified" });
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const before = await requestState(creator.requestId);
    const marked = await act(
      server,
      CREATORS,
      creator.requestId,
      "reexamine",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "storage_unavailable",
      },
    );
    expect(marked.statusCode, marked.body).toBe(200);
    expect(marked.json<{ reexaminedAt: string }>().reexaminedAt).toMatch(/Z$/);
    const after = await requestState(creator.requestId);
    expect(after).toMatchObject({
      status: "pending",
      claimedBy: null,
      reexamine: "storage_unavailable",
    });
    // the deadlines are frozen: the age runs on
    expect(after.slaDueAt).toBe(before.slaDueAt);
    const found = await list(server, CREATORS, colleague, {
      reexamine: "true",
    });
    expect(found.body.items.map((item) => item.id)).toContain(
      creator.requestId,
    );
    expect(
      found.body.items.find((item) => item.id === creator.requestId)?.reexamine,
    ).toMatchObject({ reasonCode: "storage_unavailable" });
    // the reason is a closed list: a free text is no reason
    const other = await act(
      server,
      CREATORS,
      creator.requestId,
      "reexamine",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "because",
      },
    );
    expect(other.statusCode).toBe(400);
  });
});

describe("the refusals: typed reason, message, minor, closure (RG54, RG56, RG57, RG59, CA32, CA33)", () => {
  it("never refuses without a typed reason of its own population, nor with a message that does not belong (CA33)", async () => {
    const server = app();
    const creator = await newCreator();
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const send = (body: object) =>
      act(server, CREATORS, creator.requestId, "reject", agent, {
        reviewToken: view.reviewToken,
        ...body,
      });
    expect((await send({})).statusCode).toBe(400);
    const brandReason = await send({ reasonCode: "name_mismatch" });
    expect(brandReason.statusCode).toBe(400);
    expect(issuesOf(brandReason)).toEqual([
      { path: "reasonCode", issue: "invalid_reason" },
    ]);
    const mute = await send({ reasonCode: "other" });
    expect(mute.statusCode).toBe(400);
    expect(issuesOf(mute)).toEqual([
      { path: "memberMessage", issue: "invalid_member_message" },
    ]);
    const message = await send({
      reasonCode: "evidence_unreadable",
      memberMessage:
        "Your capture is not readable at all, please send it again.",
    });
    expect(message.statusCode).toBe(400);
    expect(issuesOf(message)).toEqual([
      { path: "memberMessage", issue: "invalid_member_message" },
    ]);
    // RG19: the message goes out in an e-mail without a link: no direct contact in it
    const contact = await send({
      reasonCode: "other",
      memberMessage:
        "Write to me at secret.contact@exemple.test for details please.",
    });
    expect(contact.statusCode).toBe(400);
    expect(issuesOf(contact)).toEqual([
      { path: "memberMessage", issue: "direct_contact" },
    ]);
    expect(await requestState(creator.requestId)).toMatchObject({
      status: "pending",
      reason: null,
    });
    const own = await send({
      reasonCode: "other",
      memberMessage:
        "The account is too recent to be examined, try again next month.",
      internalComment: "Opened last week.",
    });
    expect(own.statusCode, own.body).toBe(200);
    expect(own.json()).toMatchObject({
      status: "rejected",
      late: false,
      escalated: false,
    });
    expect(await requestState(creator.requestId)).toMatchObject({
      status: "rejected",
      reason: "other",
      message:
        "The account is too recent to be examined, try again next month.",
      comment: "Opened last week.",
      decidedBy: agent.accountId,
    });
    const refused = (await registerLines(creator.requestId)).filter(
      (line) => line.event === "verification.rejected",
    );
    expect(refused).toHaveLength(1);
    expect(JSON.stringify(refused[0]?.payload)).not.toContain(
      "Opened last week",
    );
    // the decision of a closed entry is read back with its comment, for agents (C8)
    const closed = await opened(server, CREATORS, creator.requestId, colleague);
    expect(closed.outcome).toBe("closed");
    expect(closed.dossier).toBeNull();
    expect(closed.entry.decision).toMatchObject({
      status: "rejected",
      reasonCode: "other",
      internalComment: "Opened last week.",
    });
  });

  it("stops everything on a minor: no badge, the reason recorded, an administrator alerted, whatever the version (RG54, CA32)", async () => {
    const server = app();
    const creator = await newCreator({ level: "audience_verified" });
    await opened(server, CREATORS, creator.requestId, agent);
    const minor = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      agent,
      {
        reviewToken: ANY_TOKEN,
        reasonCode: "minor",
      },
    );
    expect(minor.statusCode, minor.body).toBe(200);
    expect(minor.json()).toMatchObject({ status: "rejected", escalated: true });
    expect(await requestState(creator.requestId)).toMatchObject({
      status: "rejected",
      reason: "minor",
      escalated: true,
    });
    const events = (await registerLines(creator.requestId)).map(
      (line) => line.event,
    );
    expect(events).toEqual(
      expect.arrayContaining([
        "verification.rejected",
        "verification.escalated",
      ]),
    );
    const [count] = await sharedMigrationRole()<{ n: number }[]>`
      select count(*)::int as n from verification.badges
       where request_id = ${creator.requestId}`;
    expect(count?.n).toBe(0);
  });

  it("closes the request of an account that is no longer available, and refuses to grant it (EC-L2E-08-5, RG57)", async () => {
    const server = app();
    const creator = await newCreator();
    const view = await opened(server, CREATORS, creator.requestId, agent);
    await sharedMigrationRole()`
      update identity.accounts set status = 'suspended', suspended_at = now() where id = ${creator.accountId}`;
    const refused = await act(
      server,
      CREATORS,
      creator.requestId,
      "grant-account",
      agent,
      {
        reviewToken: view.reviewToken,
        observedCode: creator.code,
        observedHandle: creator.handle,
      },
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "entry", issue: "account_unavailable" },
    ]);
    const closed = await act(
      server,
      CREATORS,
      creator.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "account_unavailable",
      },
    );
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json()).toMatchObject({ status: "closed" });
    expect((await requestState(creator.requestId)).status).toBe("closed");
  });
});

describe("the piece: relayed by apps/api, journaled by the database, never by an address (T9.7, RG84, D82 (5))", () => {
  it("relays the bytes as JSON, no-store and nosniff, one register line per reading, no address and no key anywhere", async () => {
    const store = memoryStore();
    const server = app(store);
    const creator = await newCreator({ level: "audience_verified" });
    store.objects.set(creator.objectKey ?? "", WEBP);
    await opened(server, CREATORS, creator.requestId, agent);
    const url = `${CREATORS}/${creator.requestId}/evidence/${creator.evidenceId}`;
    const read = await call(server, "GET", url, agent.session);
    expect(read.statusCode, read.body.slice(0, 200)).toBe(200);
    expect(read.headers["cache-control"]).toBe("no-store");
    expect(read.headers["x-content-type-options"]).toBe("nosniff");
    expect(read.headers["content-type"]).toMatch(/^application\/json/);
    const body = read.json<{
      contentType: string;
      width: number;
      height: number;
      byteSize: number;
      data: string;
    }>();
    expect(body).toMatchObject({
      contentType: "image/webp",
      width: 1290,
      height: 2796,
      byteSize: WEBP.length,
    });
    expect(Buffer.from(body.data, "base64").equals(WEBP)).toBe(true);
    // T9.7: no address of Storage, no token, no key, no signed URL in the answer
    const headers = JSON.stringify(read.headers);
    for (const text of [read.body.replace(body.data, ""), headers]) {
      expect(text).not.toMatch(/supabase|signed|token=|https?:\/\//i);
      expect(text).not.toContain(creator.objectKey ?? "unreachable");
    }
    expect(Object.keys(body).sort()).toEqual([
      "byteSize",
      "contentType",
      "data",
      "height",
      "width",
    ]);
    // each opening is one nominative line, in the transaction that handed the key over
    await call(server, "GET", url, agent.session);
    const lines = (await registerLines(creator.requestId)).filter(
      (line) => line.event === "verification.evidence_viewed",
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.actor).toBe(agent.accountId);
      expect(line.payload).toMatchObject({
        evidence_id: creator.evidenceId,
        level: "audience_verified",
      });
      expect(JSON.stringify(line.payload)).not.toContain(
        creator.objectKey ?? "unreachable",
      );
    }
    expect(store.reads).toEqual([creator.objectKey, creator.objectKey]);
  });

  it("reads nothing for an agent who does not hold the claim, for a piece of another request or an unknown one, and writes no line", async () => {
    const store = memoryStore();
    const server = app(store);
    const creator = await newCreator({ level: "audience_verified" });
    const other = await newCreator({ level: "audience_verified" });
    store.objects.set(creator.objectKey ?? "", WEBP);
    store.objects.set(other.objectKey ?? "", WEBP);
    const url = (request: string, piece: string | null) =>
      `${CREATORS}/${request}/evidence/${piece}`;
    // nobody holds it: no live claim, nothing is read
    const free = await call(
      server,
      "GET",
      url(creator.requestId, creator.evidenceId),
      agent.session,
    );
    expect(free.statusCode).toBe(409);
    expect(issuesOf(free)).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
    await opened(server, CREATORS, creator.requestId, agent);
    // a colleague's read-only view never reads the piece
    const colleagueRead = await call(
      server,
      "GET",
      url(creator.requestId, creator.evidenceId),
      colleague.session,
    );
    expect(colleagueRead.statusCode).toBe(409);
    expect(issuesOf(colleagueRead)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
    // the piece of another request, named on this one, and an unknown piece: one answer
    const foreign = answer(
      await call(
        server,
        "GET",
        url(creator.requestId, other.evidenceId),
        agent.session,
      ),
    );
    const unknown = answer(
      await call(
        server,
        "GET",
        url(creator.requestId, randomUUID()),
        agent.session,
      ),
    );
    expect(foreign.status).toBe(404);
    expect(foreign).toEqual(unknown);
    expect(store.reads).toEqual([]);
    expect(
      (await registerLines(creator.requestId)).filter(
        (line) => line.event === "verification.evidence_viewed",
      ),
    ).toEqual([]);
    expect(
      (await registerLines(other.requestId)).filter(
        (line) => line.event === "verification.evidence_viewed",
      ),
    ).toEqual([]);
  });

  it("blocks the decision when Storage does not answer: 503 decision_blocked, and « à réexaminer » stays open; a missing object is a 404", async () => {
    const down = memoryStore({ down: true });
    const server = app(down);
    const creator = await newCreator({ level: "audience_verified" });
    const view = await opened(server, CREATORS, creator.requestId, agent);
    const blocked = await call(
      server,
      "GET",
      `${CREATORS}/${creator.requestId}/evidence/${creator.evidenceId}`,
      agent.session,
    );
    expect(blocked.statusCode).toBe(503);
    expect(issuesOf(blocked)).toEqual([
      { path: "evidence", issue: "decision_blocked" },
    ]);
    expect(blocked.body).not.toContain(creator.objectKey ?? "unreachable");
    const marked = await act(
      server,
      CREATORS,
      creator.requestId,
      "reexamine",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "storage_unavailable",
      },
    );
    expect(marked.statusCode, marked.body).toBe(200);
    // an object that is not there: the row exists, the bytes do not (the logs say it, the screen too)
    const empty = memoryStore();
    const emptyServer = app(empty);
    const orphan = await newCreator({ level: "audience_verified" });
    await opened(emptyServer, CREATORS, orphan.requestId, agent);
    const missing = await call(
      emptyServer,
      "GET",
      `${CREATORS}/${orphan.requestId}/evidence/${orphan.evidenceId}`,
      agent.session,
    );
    expect(missing.statusCode).toBe(404);
  });
});

describe("the brands view: domain code, register, reasons of its own (06 RG51, RG52, 08 RG56, RG57, CA43)", () => {
  it("opens the dossier with the internal block and the registers of its country, and grants on the code found at the domain", async () => {
    const server = app();
    const brand = await newBrand();
    const source = await registrySource("FR");
    const view = await opened(server, BRANDS, brand.requestId, agent);
    expect(view.outcome).toBe("claimed");
    expect(view.dossier?.creator).toBeNull();
    expect(view.dossier?.brand).toMatchObject({
      tradeName: brand.tradeName,
      websiteDomain: brand.domain,
      internalDetails: {
        legalName: brand.legalName,
        registrationCountryCode: "FR",
        registrationNumber: brand.registrationNumber,
      },
    });
    expect(
      view.dossier?.brand?.registrySources.map((entry) => entry.id),
    ).toContain(source);
    expect(view.dossier?.codeExpiresAt).toMatch(/Z$/);
    expect(JSON.stringify(view)).not.toContain(brand.code ?? "unreachable");
    // the reasons of a brand, never the ones of a creator (CA43)
    const reasonCodes = view.reasons.map((reason) => reason.code);
    expect(reasonCodes).toContain("registration_not_found");
    expect(reasonCodes).not.toContain("evidence_too_old");
    // the brand reads English: its sentences are the English ones of the e-mail (RG57)
    expect(
      view.reasons.find((reason) => reason.code === "name_mismatch")?.message,
    ).toBe(
      verificationReasonPreview("en", "brand_verified", "name_mismatch")
        ?.message,
    );
    expect(
      view.reasons.find((reason) => reason.code === "name_mismatch")?.message,
    ).toMatch(/legal name/i);
    const grant = {
      reviewToken: view.reviewToken,
      observedCode: brand.code,
      observedDomain: brand.domain,
      observedChannel: "dns_txt",
      registrySourceId: source,
    };
    const wrongCode = await act(
      server,
      BRANDS,
      brand.requestId,
      "grant",
      agent,
      {
        ...grant,
        observedCode: "INFLUX-ABCDEFGH",
      },
    );
    expect(wrongCode.statusCode).toBe(400);
    expect(issuesOf(wrongCode)).toEqual([
      { path: "observedCode", issue: "code_mismatch" },
    ]);
    const foreignDomain = await act(
      server,
      BRANDS,
      brand.requestId,
      "grant",
      agent,
      {
        ...grant,
        observedDomain: "elsewhere.example.test",
      },
    );
    expect(foreignDomain.statusCode).toBe(400);
    expect(issuesOf(foreignDomain)).toEqual([
      { path: "observedDomain", issue: "invalid_observed_domain" },
    ]);
    // a register of another country is no register of this brand (RG52)
    const otherSource = await registrySource("DE");
    const noSource = await act(
      server,
      BRANDS,
      brand.requestId,
      "grant",
      agent,
      {
        ...grant,
        registrySourceId: otherSource,
      },
    );
    expect(noSource.statusCode).toBe(409);
    expect(issuesOf(noSource)).toEqual([
      { path: "entry", issue: "no_registry_source" },
    ]);
    const granted = await act(
      server,
      BRANDS,
      brand.requestId,
      "grant",
      agent,
      grant,
    );
    expect(granted.statusCode, granted.body).toBe(200);
    expect(granted.json()).toMatchObject({ outcome: "granted", late: false });
    expect(await requestState(brand.requestId)).toMatchObject({
      status: "approved",
      decidedBy: agent.accountId,
    });
  });

  it("refuses a brand with a reason of its own and not with a creator's (CA33, EC-L2E-11)", async () => {
    const server = app();
    const brand = await newBrand();
    const view = await opened(server, BRANDS, brand.requestId, agent);
    const creatorReason = await act(
      server,
      BRANDS,
      brand.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "evidence_too_old",
      },
    );
    expect(creatorReason.statusCode).toBe(400);
    expect(issuesOf(creatorReason)).toEqual([
      { path: "reasonCode", issue: "invalid_reason" },
    ]);
    const refused = await act(
      server,
      BRANDS,
      brand.requestId,
      "reject",
      agent,
      {
        reviewToken: view.reviewToken,
        reasonCode: "name_mismatch",
      },
    );
    expect(refused.statusCode, refused.body).toBe(200);
    expect(refused.json()).toMatchObject({
      status: "rejected",
      escalated: false,
    });
    expect(await requestState(brand.requestId)).toMatchObject({
      status: "rejected",
      reason: "name_mismatch",
      message: null,
    });
  });

  it("hides an account held from its holder in both views (CA31)", async () => {
    const server = app();
    const held = await newBrand({ owner: agent.accountId });
    const open = await act(server, BRANDS, held.requestId, "open", agent);
    expect(open.statusCode).toBe(403);
    expect(issuesOf(open)).toEqual([
      { path: "entry", issue: "conflict_of_interest" },
    ]);
    expect((await list(server, BRANDS, agent)).raw).not.toContain(
      held.requestId,
    );
  });
});

describe("the counters and the empty state (15 RG28, RG32, CA44), and the logs (D60, invariant 17)", () => {
  it("counts what the caller sees, tells when the last request was handled, and an empty view is an empty list, not an error (CA44)", async () => {
    const server = app();
    const creator = await newCreator({ offset: 400 });
    await newBrand({ offset: 401, owner: agent.accountId });
    const counters = async (who: Internal) =>
      (await call(server, "GET", COUNTERS, who.session)).json<{
        asOf: string;
        queues: {
          queue: string;
          pending: number;
          unclaimed: number;
          overdue: number;
          oldestCreatedAt: string | null;
          lastDecidedAt: string | null;
        }[];
      }>();
    const seen = await counters(agent);
    const creators = seen.queues.find(
      (queue) => queue.queue === "verification_creators",
    );
    expect(creators?.pending).toBeGreaterThanOrEqual(1);
    expect(creators?.unclaimed).toBeGreaterThanOrEqual(1);
    expect(creators?.oldestCreatedAt).toMatch(/Z$/);
    // the held brand is not counted for its holder, and counted for a colleague
    const holderBrands = seen.queues.find(
      (queue) => queue.queue === "verification_brands",
    );
    const colleagueBrands = (await counters(colleague)).queues.find(
      (queue) => queue.queue === "verification_brands",
    );
    expect(colleagueBrands?.pending).toBeGreaterThanOrEqual(
      holderBrands?.pending ?? 0,
    );
    // a decision gives the empty state its « last handled » line
    const view = await opened(server, CREATORS, creator.requestId, agent);
    await act(server, CREATORS, creator.requestId, "reject", agent, {
      reviewToken: view.reviewToken,
      reasonCode: "evidence_unreadable",
    });
    const after = (await counters(agent)).queues.find(
      (queue) => queue.queue === "verification_creators",
    );
    expect(after?.lastDecidedAt).toMatch(/Z$/);
    // an empty view: no line, no cursor, a 200
    const empty = await call(
      server,
      "GET",
      `${CREATORS}?${new URLSearchParams({
        from: "2001-01-01T00:00:00.000Z",
        to: "2001-01-02T00:00:00.000Z",
      })}`,
      agent.session,
    );
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({ items: [], nextCursor: null });
  });

  it("writes no handle, code, figure, legal name or registration number in any log (invariant 17, D60)", () => {
    expect(watched.length).toBeGreaterThan(10);
    const leaked = logStreams.flatMap((text) => valuesFoundIn(text(), watched));
    expect(leaked).toEqual([]);
    const logs = logStreams.map((text) => text()).join("");
    expect(logs).not.toContain(String(DECLARED.followers));
    expect(logs).not.toContain(String(DECLARED.comments));
  });
});
