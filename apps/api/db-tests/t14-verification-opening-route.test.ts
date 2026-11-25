// T14, L2F-D17 par la route (L2F, commit 15) — a verification opened by an agent and the proof of a brand by
// its login address, on the local stack through the pools of apps/api (docs/mvp/06 RG51, RG52; 08 RG9, RG53;
// 15 RG36; 18 T14.1 to T14.4; jalons/l2f/modele.md §5, §6; decisions-detail.md D83, A + A-bis, Q4;
// l2f-fiche invariants 9, 12, 13, 17):
//   POST /v1/bo/accounts/:id/verification-requests
//   POST /v1/bo/queues/verification-brands/entries/:id/grant-by-login
//   the origin (`openedBy`) in the list and the opening in the dossier of queue 4
// The fixtures (agents, creators, brands) are COMMITTED (random identifiers, disposable local stack, like T14
// of the queue): the requests left pending are cancelled and the internal profiles deactivated after the
// file. The accounts that carry a request are HELD by an agent of the file, which isolates them in the list
// and lets the file prove D83 Q4 at the same time: the holder opens, and decides, a request an agent opened.
// L2F-O1 the opening, its origin in the list and the dossier, the takeover without doubling; L2F-O2 Q4 stops
// where the member opened the request; L2F-O3 the refusals (the audience above all); L2F-O4 the brand's block
// written by the agent; L2F-O5 the grant on the login address; L2F-O6 its refusals, the address never said.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
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
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const COMMENT = "Met on the Lyon trade fair stand, asked for the badge.";

let database: ApiDatabase;
const internals: string[] = [];
const accounts: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

type Internal = { accountId: string; session: string };

/** An active agent or admin with a TOTP factor, and a backoffice session proven by TOTP now. */
async function newInternal(role: "agent" | "admin"): Promise<Internal> {
  const accountId = randomUUID();
  const token = randomBytes(32);
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`t14-open-${role}-${accountId}@example.test`},
              now(), 'FR', 'fr', 'Camille', true, now(), 'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, 'Camille', now(), now(), ${randomUUID()})`;
    await tx`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')`;
  });
  internals.push(accountId);
  return { accountId, session: token.toString("base64url") };
}

/** A code of the shape the table holds (RG23). */
function ownershipCode(): string {
  let signs = "";
  for (const byte of randomBytes(8)) signs += ALPHABET[byte % ALPHABET.length];
  return `INFLUX-${signs}`;
}

type Creator = { accountId: string; lineId: string };

/** A committed creator with one network line, held by `owner`. */
async function newCreator(
  owner: string | null,
  status: "active" | "suspended" = "active",
): Promise<Creator> {
  const accountId = randomUUID();
  const handle = `t14open_${accountId.replace(/-/g, "").slice(0, 12)}`;
  const [line] = await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-open-creator-${accountId}@example.test`},
              now(), 'FR', 'fr', true, now(), 'individual', ${owner})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
    await tx`
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    return tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, pseudonym)
      values (${accountId}, 'instagram', true, ${handle}, ${`Pseudo ${handle.slice(-6)}`})
      returning id::text as id`;
  });
  if (status === "suspended") {
    await sharedMigrationRole()`
      update identity.accounts set status = 'suspended', suspended_at = now()
       where id = ${accountId}`;
  }
  accounts.push(accountId);
  return { accountId, lineId: line?.id ?? "" };
}

type Brand = { accountId: string; domain: string };

type BrandOptions = {
  owner?: string | null;
  /** The login address of the account, its local part made unique (verified unless `unverified`). */
  login?: string;
  unverified?: boolean;
  /** No website domain at all (CA26). */
  noDomain?: boolean;
  /** No internal block (the agent writes it when he opens). */
  noBlock?: boolean;
};

/** A committed brand; its login address is on its own domain unless said otherwise. */
async function newBrand(options: BrandOptions = {}): Promise<Brand> {
  const accountId = randomUUID();
  const tag = accountId.replace(/-/g, "").slice(0, 10);
  const domain = `t14open-${tag}.example.test`;
  await sharedMigrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${options.login === undefined ? `owner@${domain}` : `${tag}.${options.login}`},
              ${options.unverified === true ? null : new Date()}, 'FR', 'en', true, now(),
              'business', ${options.owner ?? null})`;
    await tx`
      insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name, website_domain)
      values (${accountId}, ${`Maison ${tag}`}, ${options.noDomain === true ? null : domain})`;
    if (options.noBlock !== true) {
      await tx`
        insert into profiles.advertiser_internal_details
          (account_id, legal_name, registration_country_code, registration_number)
        values (${accountId}, ${`Societe Anonyme ${tag}`}, 'FR', ${`RCS ${tag}`})`;
    }
  });
  accounts.push(accountId);
  return { accountId, domain };
}

function app() {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: { backofficeAuthFloorMs: 0 },
  });
}

type Server = ReturnType<typeof app>;

function call(
  server: Server,
  method: "GET" | "POST",
  url: string,
  session: string,
  body?: object,
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      cookie: `__Host-influx-ops-session=${session}`,
    },
    ...(body === undefined ? {} : { payload: body }),
  });
}

function issuesOf(response: LightMyRequestResponse) {
  const body = response.json<{
    error?: { details?: { path: string; issue: string }[] };
  }>();
  return body.error?.details ?? [];
}

/** The whole answer but its request id (18 T14.4). */
function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

type Opened = { requestId: string; status: string; created: boolean };

function openUrl(accountId: string): string {
  return `/v1/bo/accounts/${accountId}/verification-requests`;
}

function creatorBody(creator: Creator, extra: object = {}): object {
  return {
    level: "account_verified",
    socialAccountId: creator.lineId,
    openingReasonCode: "existing_client",
    ...extra,
  };
}

const BRAND_BODY = {
  level: "brand_verified",
  socialAccountId: null,
  openingReasonCode: "invited_by_agent",
};

type EntryBody = {
  outcome: string;
  reviewToken: string | null;
  dossier: {
    opening: {
      openedBy: string;
      reasonCode: string | null;
      comment: string | null;
      loginAddressEligible: boolean;
    };
    brand: {
      internalDetails: { legalName: string } | null;
    } | null;
  } | null;
};

/** `who` opens (claims) the entry of queue 4 in its view. */
async function openEntry(
  server: Server,
  view: string,
  requestId: string,
  who: Internal,
) {
  const response = await call(
    server,
    "POST",
    `${view}/${requestId}/open`,
    who.session,
  );
  return { response, body: response.json<EntryBody>() };
}

/** The entries of a view `owner` holds, as `who` lists them (the isolation of the file). */
async function ownedEntries(
  server: Server,
  view: string,
  owner: Internal,
  who: Internal,
) {
  const response = await call(server, "POST", `${view}/search`, who.session, {
    owner: owner.accountId,
  });
  expect(response.statusCode).toBe(200);
  return response.json<{
    items: { id: string; accountId: string; openedBy: string }[];
  }>().items;
}

async function registrySource(country: string): Promise<string> {
  const [row] = await sharedMigrationRole()<{ id: string }[]>`
    select id::text as id from verification.registry_sources
     where is_active and country_code = ${country} limit 1`;
  if (row === undefined)
    throw new Error(`no active registry source for ${country}`);
  return row.id;
}

async function requestCount(accountId: string): Promise<number> {
  const [row] = await sharedMigrationRole()<{ n: number }[]>`
    select count(*)::int as n from verification.verification_requests
     where account_id = ${accountId} and status <> 'cancelled'`;
  return row?.n ?? 0;
}

let agent: Internal;
let colleague: Internal;
let admin: Internal;

beforeAll(async () => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  agent = await newInternal("agent");
  colleague = await newInternal("agent");
  admin = await newInternal("admin");
});

afterAll(async () => {
  await closeDatabase(database);
  await sharedMigrationRole().begin(async (tx) => {
    if (accounts.length > 0) {
      await tx`
        update verification.verification_requests
           set status = 'cancelled', cancelled_at = now(), closed_at = now()
         where account_id = any(${accounts}::uuid[]) and status = 'pending'`;
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

describe("L2F-O1 the opening by an agent, its origin and the takeover", () => {
  it("opens « Compte vérifié » of a creator he holds: pending, the origin in the list, the reason in the dossier, the holder may open it (Q4); asked again, the same request, never doubled", async () => {
    const server = app();
    // a holder of his own: the list of the entries he holds is the isolation of the case
    const holder = await newInternal("agent");
    const creator = await newCreator(holder.accountId);
    const first = await call(
      server,
      "POST",
      openUrl(creator.accountId),
      holder.session,
      creatorBody(creator, { openingComment: COMMENT }),
    );
    expect(first.statusCode).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    const opened = first.json<Opened>();
    expect(opened).toEqual({
      requestId: opened.requestId,
      status: "pending",
      created: true,
    });
    // the comment is internal: never in the answer of the opening
    expect(first.body).not.toContain(COMMENT);

    // the origin, in the list of the holder's own entries (Q4: an agent's request is not masked from him)
    const listed = await ownedEntries(server, CREATORS, holder, holder);
    expect(listed).toEqual([
      expect.objectContaining({
        id: opened.requestId,
        accountId: creator.accountId,
        openedBy: "agent",
      }),
    ]);

    // the holder takes it, and reads who opened it and why
    const claimed = await openEntry(server, CREATORS, opened.requestId, holder);
    expect(claimed.response.statusCode).toBe(200);
    expect(claimed.body.outcome).toBe("claimed");
    expect(claimed.body.dossier?.opening).toEqual({
      openedBy: "agent",
      reasonCode: "existing_client",
      comment: COMMENT,
      // a creator's request has no login-address proof
      loginAddressEligible: false,
    });

    // asked again, by a colleague: the same request, taken over, never doubled
    const again = await call(
      server,
      "POST",
      openUrl(creator.accountId),
      colleague.session,
      creatorBody(creator, { openingReasonCode: "past_collaboration" }),
    );
    expect(again.statusCode).toBe(200);
    expect(again.json<Opened>()).toEqual({
      requestId: opened.requestId,
      status: "pending",
      created: false,
    });
    expect(await requestCount(creator.accountId)).toBe(1);
    // the reason written at the creation stays
    const reread = await openEntry(server, CREATORS, opened.requestId, holder);
    expect(reread.body.dossier?.opening.reasonCode).toBe("existing_client");
    // nothing the agent typed went to the logs (D60)
    for (const text of logStreams.map((read) => read())) {
      expect(text).not.toContain(COMMENT);
    }
  });
});

describe("L2F-O2 D83 Q4 stops where the member opened the request", () => {
  it("keeps the refusal of a held account on a request the member opened, even once an agent took it over", async () => {
    const server = app();
    const holder = await newInternal("agent");
    const creator = await newCreator(holder.accountId);
    // the member's own pending request, as the doors of 0222 would leave it
    const memberRequest = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (id, account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at)
        values (${memberRequest}, ${creator.accountId}, ${creator.lineId}, 'instagram',
                'account_verified', 'pending', now(), now(), now() + interval '1 day',
                now() + interval '2 days')`;
    });
    // masked from its holder (15 RG36): absent from his list, refused at the opening
    expect(await ownedEntries(server, CREATORS, holder, holder)).toEqual([]);
    const refused = await openEntry(server, CREATORS, memberRequest, holder);
    expect(refused.response.statusCode).toBe(403);
    expect(issuesOf(refused.response)).toEqual([
      { path: "entry", issue: "conflict_of_interest" },
    ]);
    // the holder asks to open the verification: the member's request is taken over, never doubled ...
    const taken = await call(
      server,
      "POST",
      openUrl(creator.accountId),
      holder.session,
      creatorBody(creator),
    );
    expect(taken.json<Opened>()).toEqual({
      requestId: memberRequest,
      status: "pending",
      created: false,
    });
    expect(await requestCount(creator.accountId)).toBe(1);
    // ... and it keeps its origin: still the member's, still refused to its holder
    const stillRefused = await openEntry(
      server,
      CREATORS,
      memberRequest,
      holder,
    );
    expect(stillRefused.response.statusCode).toBe(403);
    expect(await ownedEntries(server, CREATORS, holder, holder)).toEqual([]);
    // a colleague sees it, with its member origin
    const seen = await ownedEntries(server, CREATORS, holder, colleague);
    expect(seen).toEqual([
      expect.objectContaining({ id: memberRequest, openedBy: "member" }),
    ]);
    const claimed = await openEntry(server, CREATORS, memberRequest, colleague);
    expect(claimed.body.dossier?.opening.openedBy).toBe("member");
  });
});

describe("L2F-O3 the refusals of the opening", () => {
  it("refuses « Audience vérifiée » whatever the body says, and creates nothing", async () => {
    const server = app();
    const creator = await newCreator(null);
    for (const body of [
      creatorBody(creator, { level: "audience_verified" }),
      { ...BRAND_BODY, level: "audience_verified" },
    ]) {
      const response = await call(
        server,
        "POST",
        openUrl(creator.accountId),
        agent.session,
        body,
      );
      expect(response.statusCode).toBe(400);
    }
    expect(await requestCount(creator.accountId)).toBe(0);
  });

  it("refuses a reason out of the list, a comment that is missing for `other`, a line that does not match the level, a block given for a creator", async () => {
    const server = app();
    const creator = await newCreator(null);
    const ask = (body: object) =>
      call(server, "POST", openUrl(creator.accountId), agent.session, body);
    expect(
      (await ask(creatorBody(creator, { openingReasonCode: "friend" })))
        .statusCode,
    ).toBe(400);
    expect(
      (await ask(creatorBody(creator, { openingReasonCode: "other" })))
        .statusCode,
    ).toBe(400);
    expect(
      (await ask({ ...creatorBody(creator), socialAccountId: null }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await ask(
          creatorBody(creator, {
            legalName: "X SAS",
            registrationCountryCode: "FR",
            registrationNumber: "1",
          }),
        )
      ).statusCode,
    ).toBe(400);
    expect(await requestCount(creator.accountId)).toBe(0);
  });

  it("answers an unknown account, an internal one, the caller's own, a line that is not the account's and the other population as one and the same 404", async () => {
    const server = app();
    const creator = await newCreator(null);
    const other = await newCreator(null);
    const brand = await newBrand();
    const unknown = await call(
      server,
      "POST",
      openUrl(randomUUID()),
      agent.session,
      creatorBody(creator),
    );
    expect(unknown.statusCode).toBe(404);
    const same = [
      [colleague.accountId, creatorBody(creator)],
      [agent.accountId, creatorBody(creator)],
      [admin.accountId, creatorBody(creator)],
      // the line of another account
      [creator.accountId, creatorBody(other)],
      // a creator for the brand level, a brand for the creator level
      [creator.accountId, BRAND_BODY],
      [brand.accountId, creatorBody(creator)],
    ] as const;
    for (const [accountId, body] of same) {
      const response = await call(
        server,
        "POST",
        openUrl(accountId),
        agent.session,
        body,
      );
      expect(answer(response)).toEqual(answer(unknown));
    }
    expect(await requestCount(creator.accountId)).toBe(0);
    expect(await requestCount(brand.accountId)).toBe(0);
  });

  it("says a suspended account, a brand without its domain and a brand without its block as a 409 on `request`", async () => {
    const server = app();
    const suspended = await newCreator(null, "suspended");
    const noDomain = await newBrand({ noDomain: true });
    const noBlock = await newBrand({ noBlock: true });
    const ask = (accountId: string, body: object) =>
      call(server, "POST", openUrl(accountId), agent.session, body);
    const unavailable = await ask(suspended.accountId, creatorBody(suspended));
    expect(unavailable.statusCode).toBe(409);
    expect(issuesOf(unavailable)).toEqual([
      { path: "request", issue: "account_unavailable" },
    ]);
    const domainless = await ask(noDomain.accountId, BRAND_BODY);
    expect(domainless.statusCode).toBe(409);
    expect(issuesOf(domainless)).toEqual([
      { path: "request", issue: "website_domain_required" },
    ]);
    const blockless = await ask(noBlock.accountId, BRAND_BODY);
    expect(blockless.statusCode).toBe(409);
    expect(issuesOf(blockless)).toEqual([
      { path: "request", issue: "internal_details_required" },
    ]);
    // the block given while the record already holds one: refused on the block
    const holder = await newBrand();
    const given = await ask(holder.accountId, {
      ...BRAND_BODY,
      legalName: "X SAS",
      registrationCountryCode: "FR",
      registrationNumber: "1",
    });
    expect(given.statusCode).toBe(400);
    expect(issuesOf(given)).toEqual([
      { path: "internalDetails", issue: "internal_details_present" },
    ]);
    for (const account of [suspended, noDomain, noBlock, holder]) {
      expect(await requestCount(account.accountId)).toBe(0);
    }
  });
});

describe("L2F-O4 the internal block of a brand, written by the agent", () => {
  it("writes the three fields of a brand that holds none, and shows them to the agent who takes the request", async () => {
    const server = app();
    const brand = await newBrand({ noBlock: true, owner: agent.accountId });
    const response = await call(
      server,
      "POST",
      openUrl(brand.accountId),
      agent.session,
      {
        ...BRAND_BODY,
        legalName: "Maison Dupont SAS",
        registrationCountryCode: "FR",
        registrationNumber: "552 081 317",
      },
    );
    expect(response.statusCode).toBe(200);
    const opened = response.json<Opened>();
    expect(opened.created).toBe(true);
    const [block] = await sharedMigrationRole()<
      { legal_name: string; country: string; number: string }[]
    >`
      select legal_name, registration_country_code::text as country,
             registration_number as number
        from profiles.advertiser_internal_details where account_id = ${brand.accountId}`;
    expect(block).toEqual({
      legal_name: "Maison Dupont SAS",
      country: "FR",
      number: "552 081 317",
    });
    const claimed = await openEntry(server, BRANDS, opened.requestId, agent);
    expect(claimed.body.dossier?.brand?.internalDetails?.legalName).toBe(
      "Maison Dupont SAS",
    );
    // the address of the login is on the domain: the grant on it is offered (A-bis)
    expect(claimed.body.dossier?.opening).toMatchObject({
      openedBy: "agent",
      reasonCode: "invited_by_agent",
      loginAddressEligible: true,
    });
  });
});

describe("L2F-O5 the grant on the login address (A-bis)", () => {
  it("grants « Marque vérifiée » with the register consulted, nothing typed about the domain, the address never said", async () => {
    const server = app();
    const brand = await newBrand({ owner: agent.accountId });
    const opened = (
      await call(
        server,
        "POST",
        openUrl(brand.accountId),
        agent.session,
        BRAND_BODY,
      )
    ).json<Opened>();
    const claimed = await openEntry(server, BRANDS, opened.requestId, agent);
    expect(claimed.body.dossier?.opening.loginAddressEligible).toBe(true);
    const token = claimed.body.reviewToken ?? "";
    const source = await registrySource("FR");
    // a typed domain is no field of the body
    const strict = await call(
      server,
      "POST",
      `${BRANDS}/${opened.requestId}/grant-by-login`,
      agent.session,
      {
        reviewToken: token,
        registrySourceId: source,
        observedDomain: brand.domain,
      },
    );
    expect(strict.statusCode).toBe(400);
    const granted = await call(
      server,
      "POST",
      `${BRANDS}/${opened.requestId}/grant-by-login`,
      agent.session,
      {
        reviewToken: token,
        registrySourceId: source,
        internalComment: "Register consulted, the company is active.",
      },
    );
    expect(granted.statusCode).toBe(200);
    const body = granted.json<{
      outcome: string;
      badgeId: string | null;
      late: boolean;
    }>();
    expect(body.outcome).toBe("granted");
    expect(body.badgeId).not.toBeNull();
    // the login address, nor anything of it, is in the answer
    expect(granted.body).not.toContain("owner@");
    // the badge, and the finding on the code: channel `login_address`, the domain of the website
    const [badge] = await sharedMigrationRole()<
      { state: string; level: string; channel: string; domain: string }[]
    >`
      select b.state, b.level::text as level, c.observed_channel as channel,
             c.observed_domain as domain
        from verification.badges b
        join verification.ownership_codes c on c.request_id = b.request_id
       where b.id = ${body.badgeId}`;
    expect(badge).toEqual({
      state: "active",
      level: "brand_verified",
      channel: "login_address",
      domain: brand.domain,
    });
    // the register carries the channel and the origin, never the address
    const [line] = await sharedMigrationRole()<
      { payload: Record<string, unknown> }[]
    >`
      select payload from audit.audit_events
       where subject_id = ${opened.requestId} and event_type = 'verification.granted'`;
    expect(line?.payload).toMatchObject({
      channel: "login_address",
      agent_opened: true,
      responsible_agent: true,
    });
    expect(JSON.stringify(line?.payload)).not.toContain("owner@");
    // closed: a second grant is the answer of a closed entry
    const closed = await call(
      server,
      "POST",
      `${BRANDS}/${opened.requestId}/grant-by-login`,
      agent.session,
      { reviewToken: token, registrySourceId: source },
    );
    expect(closed.statusCode).toBe(409);
    for (const text of logStreams.map((read) => read())) {
      expect(text).not.toContain("owner@");
    }
  });

  it("grants for a member-opened request too, by a colleague (the origin does not matter, the address does)", async () => {
    const server = app();
    const brand = await newBrand();
    const memberRequest = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into verification.verification_requests
          (id, account_id, level, status, created_at, submitted_at, sla_due_at, escalate_at)
        values (${memberRequest}, ${brand.accountId}, 'brand_verified', 'pending', now(), now(),
                now() + interval '1 day', now() + interval '2 days')`;
      await tx`
        insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
        values (${memberRequest}, ${brand.accountId}, 'domain',
                ${ownershipCode()},
                now() + interval '7 days')`;
    });
    const claimed = await openEntry(server, BRANDS, memberRequest, colleague);
    expect(claimed.body.dossier?.opening).toMatchObject({
      openedBy: "member",
      reasonCode: null,
      loginAddressEligible: true,
    });
    const granted = await call(
      server,
      "POST",
      `${BRANDS}/${memberRequest}/grant-by-login`,
      colleague.session,
      {
        reviewToken: claimed.body.reviewToken ?? "",
        registrySourceId: await registrySource("FR"),
      },
    );
    expect(granted.statusCode).toBe(200);
    const [line] = await sharedMigrationRole()<
      { payload: Record<string, unknown> }[]
    >`
      select payload from audit.audit_events
       where subject_id = ${memberRequest} and event_type = 'verification.granted'`;
    expect(line?.payload).toMatchObject({
      channel: "login_address",
      agent_opened: false,
    });
  });
});

describe("L2F-O6 the grant on the login address refused", () => {
  it("says why as a word and never the address: a consumer mailbox, another domain, an address not verified; nothing is written", async () => {
    const server = app();
    const cases = [
      { options: { login: "someone@gmail.com" }, reason: "consumer_domain" },
      {
        options: { login: "someone@elsewhere.example.test" },
        reason: "other_domain",
      },
      { options: { unverified: true }, reason: "unverified" },
    ] as const;
    for (const { options, reason } of cases) {
      const brand = await newBrand({ ...options, owner: agent.accountId });
      const opened = (
        await call(
          server,
          "POST",
          openUrl(brand.accountId),
          agent.session,
          BRAND_BODY,
        )
      ).json<Opened>();
      const claimed = await openEntry(server, BRANDS, opened.requestId, agent);
      // the dossier does not offer the grant, and says nothing of the address
      expect(claimed.body.dossier?.opening.loginAddressEligible, reason).toBe(
        false,
      );
      const refused = await call(
        server,
        "POST",
        `${BRANDS}/${opened.requestId}/grant-by-login`,
        agent.session,
        {
          reviewToken: claimed.body.reviewToken ?? "",
          registrySourceId: await registrySource("FR"),
        },
      );
      expect(refused.statusCode, reason).toBe(409);
      expect(issuesOf(refused), reason).toEqual([
        { path: "entry", issue: "login_address_ineligible" },
        { path: "entry.loginAddress", issue: reason },
      ]);
      expect(refused.body, reason).not.toMatch(/someone@|gmail|elsewhere/);
      const [state] = await sharedMigrationRole()<
        { status: string; badges: number }[]
      >`
        select r.status::text as status,
               (select count(*)::int from verification.badges b where b.account_id = r.account_id)
                 as badges
          from verification.verification_requests r where r.id = ${opened.requestId}`;
      expect(state, reason).toEqual({ status: "pending", badges: 0 });
    }
  });

  it("answers an unknown entry and a creator's request like one another (404), and refuses a body without its token", async () => {
    const server = app();
    const creator = await newCreator(null);
    const opened = (
      await call(
        server,
        "POST",
        openUrl(creator.accountId),
        agent.session,
        creatorBody(creator),
      )
    ).json<Opened>();
    const body = {
      reviewToken: "0".repeat(64),
      registrySourceId: await registrySource("FR"),
    };
    const unknown = await call(
      server,
      "POST",
      `${BRANDS}/${randomUUID()}/grant-by-login`,
      colleague.session,
      body,
    );
    const otherView = await call(
      server,
      "POST",
      `${BRANDS}/${opened.requestId}/grant-by-login`,
      colleague.session,
      body,
    );
    expect(unknown.statusCode).toBe(404);
    expect(answer(otherView)).toEqual(answer(unknown));
    const bare = await call(
      server,
      "POST",
      `${BRANDS}/${opened.requestId}/grant-by-login`,
      colleague.session,
      { registrySourceId: body.registrySourceId },
    );
    expect(bare.statusCode).toBe(400);
  });
});

describe("L2F-O7 what the opening offers on an account (0239)", () => {
  it("serves the lines of a creator and the brand with the request already open, never a handle, and answers an unknown, an internal or the caller's own account as one 404", async () => {
    const server = app();
    const creator = await newCreator(agent.accountId);
    const before = await call(
      server,
      "GET",
      openUrl(creator.accountId),
      agent.session,
    );
    expect(before.statusCode).toBe(200);
    expect(before.headers["cache-control"]).toBe("no-store");
    expect(before.json<{ openings: unknown[] }>().openings).toEqual([
      {
        socialAccountId: creator.lineId,
        networkCode: "instagram",
        level: "account_verified",
        request: null,
        brand: null,
      },
    ]);
    const opened = (
      await call(
        server,
        "POST",
        openUrl(creator.accountId),
        agent.session,
        creatorBody(creator),
      )
    ).json<Opened>();
    const after = await call(
      server,
      "GET",
      openUrl(creator.accountId),
      colleague.session,
    );
    expect(after.json<{ openings: unknown[] }>().openings).toEqual([
      {
        socialAccountId: creator.lineId,
        networkCode: "instagram",
        level: "account_verified",
        request: { id: opened.requestId, status: "pending", openedBy: "agent" },
        brand: null,
      },
    ]);
    // no handle, no pseudonym, no comment in the answer
    expect(after.body).not.toMatch(/t14open_|Pseudo |handle|comment/u);

    const brand = await newBrand({ noBlock: true, noDomain: true });
    const brandRead = await call(
      server,
      "GET",
      openUrl(brand.accountId),
      admin.session,
    );
    expect(brandRead.json<{ openings: unknown[] }>().openings).toEqual([
      {
        socialAccountId: null,
        networkCode: null,
        level: "brand_verified",
        request: null,
        brand: { hasWebsiteDomain: false, hasInternalDetails: false },
      },
    ]);

    const unknown = await call(
      server,
      "GET",
      openUrl(randomUUID()),
      agent.session,
    );
    expect(unknown.statusCode).toBe(404);
    for (const id of [admin.accountId, agent.accountId]) {
      const refused = await call(server, "GET", openUrl(id), agent.session);
      expect(answer(refused)).toEqual(answer(unknown));
    }
  });
});
