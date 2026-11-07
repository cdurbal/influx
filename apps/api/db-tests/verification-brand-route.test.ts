// L2E commit 15 — the brand's verification routes and the registry sources on the local stack (docs/mvp/06
// RG46 to RG52, RG59, RG101, CA26 to CA29, CA32, CA33; 18 T14; jalons/l2e/modele.md §4, §6;
// l2e/registres.md): GET /v1/me/brand-verification, PUT …/internal-details, POST …/request and its code,
// submit and cancel (through the six doors of 0222 in the schema `profiles`, the advertiser holding nothing
// on `verification`), the hand-off to queue 4 (an agent grants or refuses, the brand reads the outcome),
// and GET, PUT /v1/bo/verification/registry-sources (read by agent and admin, written by an admin). The
// accounts are COMMITTED by the migration role (random identifiers, disposable local stack, like the
// creator's) with their sessions; every open request is withdrawn at the end, and the one source this file
// renames is put back. Every log stream is searched BY VALUE (C-1, D60, invariant 17): no code, no legal
// name, no number of registration, no domain.
// L2E-B1 the state and the internal block (RG46, RG47), L2E-B2 no domain, no request; the code (CA26,
// CA27), L2E-B3 submit, cancel, the completeness (RG59), L2E-B4 the code found, the badge (CA28, CA32),
// L2E-B5 a country without a register (CA29), L2E-B6 who may reach the routes (T14, CA33), L2E-B7 the
// registry sources (RG52, RG101), L2E-B8 the logs.
import {
  brandVerificationResponseSchema,
  verificationOpenResponseSchema,
  verificationRegistrySourcesResponseSchema,
  verificationRequestResponseSchema,
  type BrandVerificationResponse,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import {
  brandProfileResponseSchema,
  type BrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
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
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole, testDataSet } from "./support.ts";

let database: ApiDatabase;
let migration: postgres.Sql;
let termsInForce: { fr: string };
const accounts: string[] = [];
const internals: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

const URL_STATE = "/v1/me/brand-verification";
const URL_DETAILS = `${URL_STATE}/internal-details`;
const URL_REQUEST = `${URL_STATE}/request`;
const URL_SOURCES = "/v1/bo/verification/registry-sources";
const BRANDS = "/v1/bo/queues/verification-brands/entries";
const CODE_SHAPE = /^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const DAY_MS = 24 * 3_600_000;
const SECRET_COMMENT = "L2E15-internal-comment-never-to-a-member";

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = {
  accountId: string;
  email: string;
  session: string;
  domain: string | null;
  tradeName: string;
};

async function newBrand(
  options: { domain?: string | null; acceptTerms?: boolean } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const tag = accountId.replace(/-/g, "").slice(0, 10);
  const email = `l2e15-brand-${accountId}@example.test`;
  const tradeName = `Maison ${accountId.slice(0, 8)}`;
  const domain =
    options.domain === undefined ? `l2e15-${tag}.example.test` : options.domain;
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
              'business'::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'advertiser'::identity.account_role)`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name, website_domain)
      values (${accountId}, ${tradeName}, ${domain})`;
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
  accounts.push(accountId);
  watchedValues.push(email, tradeName);
  if (domain !== null) {
    watchedValues.push(domain);
  }
  return {
    accountId,
    email,
    session: await memberSession(accountId, "member"),
    domain,
    tradeName,
  };
}

async function newCreator(): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2e15-creator-${accountId}@example.test`;
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
              'individual'::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'creator'::identity.account_role)`;
    await tx`
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsInForce.fr}, 'acceptance', 'signup', 'fr')`;
  });
  accounts.push(accountId);
  return {
    accountId,
    email,
    session: await memberSession(accountId, "member"),
    domain: null,
    tradeName: "",
  };
}

async function memberSession(
  accountId: string,
  surface: "member" | "backoffice",
  mfaMethod: "totp" | null = null,
): Promise<string> {
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, ${surface}::identity.session_surface,
            ${mfaMethod}, 'firefox.windows')`;
  return token.toString("base64url");
}

type Internal = { accountId: string; name: string; session: string };

/** An active agent or admin with a backoffice session proven by TOTP now. */
async function newInternal(
  role: "agent" | "admin",
  name: string,
): Promise<Internal> {
  const accountId = randomUUID();
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${`l2e15-${role}-${accountId}@example.test`},
              now(), 'FR', 'fr', ${name}, true, now(), 'business')`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${accountId}, ${name}, now(), now(), ${randomUUID()})`;
  });
  internals.push(accountId);
  return {
    accountId,
    name,
    session: await memberSession(accountId, "backoffice", "totp"),
  };
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
type Method = "GET" | "POST" | "PUT";

/** A member's call, on the web surface. */
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

/** An internal account's call, on the backoffice surface. */
async function callBo(
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
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
      "x-request-id": randomUUID(),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-ops-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body as object }),
  });
}

async function state(
  server: Server,
  member: Member,
): Promise<BrandVerificationResponse> {
  const response = await call(server, "GET", URL_STATE, member.session);
  expect(response.statusCode, response.body).toBe(200);
  return brandVerificationResponseSchema.parse(response.json());
}

const DETAILS = {
  legalName: "Maison Exemple SAS",
  registrationCountryCode: "FR",
  registrationNumber: "RCS Paris 123 456 789",
};

async function saveDetails(
  server: Server,
  member: Member,
  details: {
    legalName: string;
    registrationCountryCode: string;
    registrationNumber: string;
  } = DETAILS,
): Promise<BrandVerificationResponse> {
  watchedValues.push(details.legalName, details.registrationNumber);
  const response = await call(
    server,
    "PUT",
    URL_DETAILS,
    member.session,
    details,
  );
  expect(response.statusCode, response.body).toBe(200);
  return brandVerificationResponseSchema.parse(response.json());
}

/** An act that must succeed, parsed; the code it shows is watched in the logs. */
async function act(
  server: Server,
  member: Member,
  name: "" | "/code" | "/submit" | "/cancel",
): Promise<VerificationRequestResponse> {
  const response = await call(
    server,
    "POST",
    `${URL_REQUEST}${name}`,
    member.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  const parsed = verificationRequestResponseSchema.parse(response.json());
  if (parsed.request.code !== null) {
    watchedValues.push(parsed.request.code.code);
  }
  return parsed;
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

function issuesOf(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: { details?: { path: string; issue: string }[] };
  };
  return error.details ?? [];
}

async function completenessOf(
  server: Server,
  member: Member,
): Promise<BrandProfileResponse["completeness"]> {
  const response = await call(
    server,
    "GET",
    "/v1/me/brand-profile",
    member.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return brandProfileResponseSchema.parse(response.json()).completeness;
}

async function storedScore(member: Member): Promise<number | null> {
  const [row] = await migration<{ score: number | null }[]>`
    select completeness_percent::int as score from profiles.advertiser_profiles
     where account_id = ${member.accountId}`;
  return row?.score ?? null;
}

async function registrySource(country: string): Promise<string> {
  const [row] = await migration<{ id: string }[]>`
    select id::text as id from verification.registry_sources
     where is_active and country_code = ${country} limit 1`;
  if (row === undefined) {
    throw new Error(`no active registry source for ${country}`);
  }
  return row.id;
}

let agent: Internal;
let admin: Internal;

/** Opens the entry of a brand on queue 4 as `who`: the dossier and the review token of its version. */
async function openEntry(server: Server, requestId: string, who: Internal) {
  const response = await callBo(
    server,
    "POST",
    `${BRANDS}/${requestId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return verificationOpenResponseSchema.parse(response.json());
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
  agent = await newInternal("agent", "Camille");
  admin = await newInternal("admin", "Dominique");
});

afterAll(async () => {
  await closeDatabase(database);
  if (accounts.length > 0) {
    // no open request of this file stays in the queue of the shared stack
    await migration`
      update verification.verification_requests
         set status = 'cancelled', cancelled_at = now(), closed_at = now()
       where account_id = any (${accounts}::uuid[]) and status in ('draft', 'pending')`;
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
  if (internals.length > 0) {
    await migration`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any (${internals}::uuid[]) and is_active`;
  }
});

describe("L2E-B1 GET /v1/me/brand-verification and the internal block (06 RG46, RG47)", () => {
  it("answers a brand with nothing asked and nothing obtained, never cached", async () => {
    const server = app();
    const member = await newBrand();
    const response = await call(server, "GET", URL_STATE, member.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const found = brandVerificationResponseSchema.parse(response.json());
    expect(found).toMatchObject({
      badge: null,
      request: null,
      internalDetails: null,
    });
    expect(Number.isNaN(Date.parse(found.asOf))).toBe(false);
  });

  it("saves the block at any time, trimmed, and gives it back to its owner alone (RG46, RG47)", async () => {
    const server = app();
    const member = await newBrand();
    const saved = await saveDetails(server, member, {
      legalName: "  Maison Exemple SAS  ",
      registrationCountryCode: "FR",
      registrationNumber: "  RCS Paris 123 456 789 ",
    });
    expect(saved.internalDetails).toEqual(DETAILS);
    expect((await state(server, member)).internalDetails).toEqual(DETAILS);
    // changed again: the last write stands, one row
    const changed = await saveDetails(server, member, {
      ...DETAILS,
      registrationCountryCode: "DE",
    });
    expect(changed.internalDetails?.registrationCountryCode).toBe("DE");
    const rows = await migration<{ n: number }[]>`
      select count(*)::int as n from profiles.advertiser_internal_details
       where account_id = ${member.accountId}`;
    expect(rows[0]?.n).toBe(1);
  });

  it("refuses a block that is not one, naming the field and never echoing the value (RG46)", async () => {
    const server = app();
    const member = await newBrand();
    const blank = await call(server, "PUT", URL_DETAILS, member.session, {
      ...DETAILS,
      legalName: "   ",
    });
    expect(blank.statusCode).toBe(400);
    expect(issuesOf(blank)).toEqual([{ path: "legalName", issue: "invalid" }]);
    const unknownCountry = await call(
      server,
      "PUT",
      URL_DETAILS,
      member.session,
      { ...DETAILS, registrationCountryCode: "ZZ" },
    );
    expect(unknownCountry.statusCode).toBe(400);
    expect(issuesOf(unknownCountry).map((issue) => issue.path)).toEqual([
      "registrationCountryCode",
    ]);
    expect(unknownCountry.body).not.toContain("ZZ");
    const tooLong = await call(server, "PUT", URL_DETAILS, member.session, {
      ...DETAILS,
      registrationNumber: "1".repeat(41),
    });
    expect(tooLong.statusCode).toBe(400);
    const extra = await call(server, "PUT", URL_DETAILS, member.session, {
      ...DETAILS,
      accountId: randomUUID(),
    });
    expect(extra.statusCode).toBe(400);
    const missing = await call(server, "PUT", URL_DETAILS, member.session, {
      legalName: DETAILS.legalName,
    });
    expect(missing.statusCode).toBe(400);
    expect((await state(server, member)).internalDetails).toBeNull();
  });
});

describe("L2E-B2 no domain, no request; the code of the domain (06 RG51, CA26, CA27)", () => {
  it("refuses the request of a brand without a domain, with the reason, and opens nothing (CA26)", async () => {
    const server = app();
    const member = await newBrand({ domain: null });
    const response = await call(server, "POST", URL_REQUEST, member.session);
    expect(response.statusCode).toBe(409);
    expect(issuesOf(response)).toEqual([
      { path: "request", issue: "website_domain_required" },
    ]);
    expect((await state(server, member)).request).toBeNull();
  });

  it("opens a draft with a code valid 7 days, takes the same draft back on a second click, and renews the code leaving one valid (CA27, RG23)", async () => {
    const server = app();
    const member = await newBrand();
    const first = await act(server, member, "");
    expect(first.created).toBe(true);
    expect(first.request).toMatchObject({
      level: "brand_verified",
      status: "draft",
      networkCode: null,
      submittedAt: null,
      evidence: [],
      refusal: null,
    });
    const code = first.request.code;
    expect(code?.code).toMatch(CODE_SHAPE);
    const asOf = (await state(server, member)).asOf;
    const validity = Date.parse(code?.expiresAt ?? "") - Date.parse(asOf);
    expect(validity).toBeGreaterThan(6.9 * DAY_MS);
    expect(validity).toBeLessThan(7.1 * DAY_MS);

    const again = await act(server, member, "");
    expect(again.created).toBe(false);
    expect(again.request.id).toBe(first.request.id);
    expect(again.request.code?.code).toBe(code?.code);

    const renewed = await act(server, member, "/code");
    expect(renewed.request.id).toBe(first.request.id);
    expect(renewed.request.code?.code).toMatch(CODE_SHAPE);
    expect(renewed.request.code?.code).not.toBe(code?.code);
    const codes = await migration<{ live: number; total: number }[]>`
      select count(*) filter (where revoked_at is null)::int as live, count(*)::int as total
        from verification.ownership_codes where request_id = ${first.request.id}`;
    expect(codes[0]).toEqual({ live: 1, total: 2 });
    // the member reads this very code, and no other
    expect((await state(server, member)).request?.code?.code).toBe(
      renewed.request.code?.code,
    );
  });

  it("refuses a new code when no draft is open (RG23)", async () => {
    const server = app();
    const member = await newBrand();
    const response = await call(
      server,
      "POST",
      `${URL_REQUEST}/code`,
      member.session,
    );
    expect(response.statusCode).toBe(409);
    expect(issuesOf(response)).toEqual([
      { path: "request", issue: "request_not_draft" },
    ]);
  });
});

describe("L2E-B3 submit and cancel; the completeness counts a request filed (06 RG47, RG59)", () => {
  it("asks the block before the submission, files the request once whatever the clicks, and refuses a second with the date it has been open since (RG47, RG14)", async () => {
    const server = app();
    const member = await newBrand();
    await act(server, member, "");
    const early = await call(
      server,
      "POST",
      `${URL_REQUEST}/submit`,
      member.session,
    );
    expect(early.statusCode).toBe(409);
    expect(issuesOf(early)).toEqual([
      { path: "request", issue: "internal_details_required" },
    ]);
    await saveDetails(server, member);
    const filed = await act(server, member, "/submit");
    expect(filed.request.status).toBe("pending");
    const submittedAt = filed.request.submittedAt;
    expect(submittedAt).not.toBeNull();
    // a double click writes nothing more
    const twice = await act(server, member, "/submit");
    expect(twice.request.submittedAt).toBe(submittedAt);
    const rows = await migration<{ n: number }[]>`
      select count(*)::int as n from verification.verification_requests
       where account_id = ${member.accountId} and level = 'brand_verified'`;
    expect(rows[0]?.n).toBe(1);
    // a second request while one is open: refused, with the date
    const duplicate = await call(server, "POST", URL_REQUEST, member.session);
    expect(duplicate.statusCode).toBe(409);
    expect(issuesOf(duplicate)).toEqual([
      { path: "request", issue: "duplicate_request" },
      { path: "submittedAt", issue: expect.stringMatching(/Z$/) as string },
    ]);
  });

  it("counts a request filed in the completeness and stores it, and no more once it is withdrawn; a withdrawn request may be asked again at once (RG59)", async () => {
    const server = app();
    const member = await newBrand();
    const earned = async () =>
      (await completenessOf(server, member)).blocks
        .flatMap((block) => block.criteria)
        .find((criterion) => criterion.code === "badgeRequested");
    expect(await earned()).toMatchObject({ offered: true, earned: false });
    const before = (await completenessOf(server, member)).score;
    await saveDetails(server, member);
    await act(server, member, "");
    // a draft is no request filed
    expect((await earned())?.earned).toBe(false);
    await act(server, member, "/submit");
    expect(await earned()).toMatchObject({ offered: true, earned: true });
    const filedScore = (await completenessOf(server, member)).score;
    expect(filedScore).toBeGreaterThan(before);
    expect(await storedScore(member)).toBe(filedScore);

    const cancelled = await act(server, member, "/cancel");
    expect(cancelled.request.status).toBe("cancelled");
    expect((await earned())?.earned).toBe(false);
    expect(await storedScore(member)).toBe(before);
    // withdrawn twice: nothing more
    expect((await act(server, member, "/cancel")).request.status).toBe(
      "cancelled",
    );
    // asked again at once: a withdrawal leaves no delay (RG60 counts refusals)
    const reopened = await act(server, member, "");
    expect(reopened.created).toBe(true);
    expect(reopened.request.status).toBe("draft");
    expect(reopened.request.id).not.toBe(cancelled.request.id);
  });

  it("refuses to submit a draft whose code has lapsed, the member renewing it (RG22)", async () => {
    const server = app();
    const member = await newBrand();
    await saveDetails(server, member);
    const opened = await act(server, member, "");
    await migration`
      update verification.ownership_codes
         set created_at = now() - interval '9 days', expires_at = now() - interval '2 days'
       where request_id = ${opened.request.id} and revoked_at is null`;
    const lapsed = await call(
      server,
      "POST",
      `${URL_REQUEST}/submit`,
      member.session,
    );
    expect(lapsed.statusCode).toBe(409);
    expect(issuesOf(lapsed)).toEqual([
      { path: "request", issue: "code_expired" },
    ]);
    await act(server, member, "/code");
    expect((await act(server, member, "/submit")).request.status).toBe(
      "pending",
    );
  });
});

describe("L2E-B4 the code found at the domain, the badge, a badge withdrawn (06 RG49, RG51, CA28, CA32)", () => {
  it("lets an agent grant on the code he reads and the register of the country, and gives the brand a dated badge with nothing of the constat", async () => {
    const server = app();
    const member = await newBrand();
    await saveDetails(server, member);
    const draft = await act(server, member, "");
    const code = draft.request.code?.code ?? "";
    await act(server, member, "/submit");
    const source = await registrySource("FR");

    const view = await openEntry(server, draft.request.id, agent);
    expect(view.outcome).toBe("claimed");
    expect(view.dossier?.brand?.internalDetails).toMatchObject({
      legalName: DETAILS.legalName,
    });
    expect(view.dossier?.brand?.registrySources.map((s) => s.id)).toContain(
      source,
    );
    const granted = await callBo(
      server,
      "POST",
      `${BRANDS}/${draft.request.id}/grant`,
      agent.session,
      {
        reviewToken: view.reviewToken,
        observedCode: code,
        observedDomain: member.domain,
        observedChannel: "dns_txt",
        registrySourceId: source,
        internalComment: SECRET_COMMENT,
      },
    );
    expect(granted.statusCode, granted.body).toBe(200);
    expect(granted.json()).toMatchObject({ outcome: "granted" });

    const raw = await call(server, "GET", URL_STATE, member.session);
    const found = brandVerificationResponseSchema.parse(raw.json());
    expect(found.request).toMatchObject({
      status: "approved",
      code: null,
      refusal: null,
    });
    expect(found.badge).toMatchObject({
      level: "brand_verified",
      networkCode: null,
      state: "active",
      periodStart: null,
      periodEnd: null,
      evidenceSource: "domain_and_registry",
    });
    expect(Date.parse(found.badge?.grantedAt ?? "")).not.toBeNaN();
    // 12 months (06 RG54): dated, with its deadline
    const months =
      (Date.parse(found.badge?.expiresAt ?? "") -
        Date.parse(found.badge?.grantedAt ?? "")) /
      DAY_MS;
    expect(months).toBeGreaterThan(360);
    expect(months).toBeLessThan(370);
    // nothing of the constat: no agent, no comment, no channel, no register, no code
    for (const hidden of [
      agent.name,
      SECRET_COMMENT,
      "dns_txt",
      source,
      code,
      "observed",
      "agent",
    ]) {
      expect(raw.body, hidden).not.toContain(hidden);
    }
    // the refresh of the badge: a new request opens while the badge holds (08 edge case 3)
    const refresh = await act(server, member, "");
    expect(refresh.created).toBe(true);
    expect((await state(server, member)).badge?.state).toBe("active");
  });

  it("makes a badge withdrawn disappear at once, the request staying what it was (CA32)", async () => {
    const server = app();
    const member = await newBrand();
    await saveDetails(server, member);
    const draft = await act(server, member, "");
    const code = draft.request.code?.code ?? "";
    await act(server, member, "/submit");
    const source = await registrySource("FR");
    const view = await openEntry(server, draft.request.id, agent);
    const granted = await callBo(
      server,
      "POST",
      `${BRANDS}/${draft.request.id}/grant`,
      agent.session,
      {
        reviewToken: view.reviewToken,
        observedCode: code,
        observedDomain: member.domain,
        observedChannel: "web_page",
        registrySourceId: source,
      },
    );
    expect(granted.statusCode, granted.body).toBe(200);
    expect((await state(server, member)).badge).not.toBeNull();
    const [reason] = await migration<{ code: string }[]>`
      select code from verification.revocation_reasons order by code limit 1`;
    await migration`
      update verification.badges
         set state = 'revoked', revoked_at = now(), revocation_reason_code = ${reason?.code ?? ""}
       where account_id = ${member.accountId} and level = 'brand_verified'`;
    expect((await state(server, member)).badge).toBeNull();
  });
});

describe("L2E-B5 a country whose register cannot be read: a reasoned refusal, no degraded badge (06 RG52, CA29)", () => {
  it("serves the register of the country, refuses with the dedicated reason, and shows the brand its refusal without the agent's words (CA29)", async () => {
    const server = app();
    const member = await newBrand();
    await saveDetails(server, member, {
      ...DETAILS,
      registrationCountryCode: "KR",
    });
    const draft = await act(server, member, "");
    await act(server, member, "/submit");

    const view = await openEntry(server, draft.request.id, agent);
    // no register of its own for KR (registres.md): GLEIF alone is served
    expect(
      view.dossier?.brand?.registrySources.map((s) => s.sourceType),
    ).toEqual(["gleif"]);
    const refused = await callBo(
      server,
      "POST",
      `${BRANDS}/${draft.request.id}/reject`,
      agent.session,
      {
        reviewToken: view.reviewToken,
        reasonCode: "registration_unverifiable_country",
        internalComment: SECRET_COMMENT,
      },
    );
    expect(refused.statusCode, refused.body).toBe(200);

    const raw = await call(server, "GET", URL_STATE, member.session);
    const found = brandVerificationResponseSchema.parse(raw.json());
    expect(found.badge).toBeNull();
    expect(found.request).toMatchObject({
      status: "rejected",
      code: null,
      refusal: {
        reasonCode: "registration_unverifiable_country",
        message: "",
      },
    });
    expect(raw.body).not.toContain(SECRET_COMMENT);
    expect(raw.body).not.toContain(agent.name);
    // a new request the day of the refusal: the delay says when, in Retry-After only (RG60)
    const early = await call(server, "POST", URL_REQUEST, member.session);
    expect(early.statusCode).toBe(409);
    expect(issuesOf(early)).toEqual([
      { path: "request", issue: "retry_after" },
    ]);
    expect(Number(early.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("L2E-B6 who may reach the routes (18 T14.3, T14.4, 06 CA33)", () => {
  const UNKNOWN = "/v1/me/brand-verification-nothing";
  const ROUTES: readonly (readonly [Method, string])[] = [
    ["GET", URL_STATE],
    ["PUT", URL_DETAILS],
    ["POST", URL_REQUEST],
    ["POST", `${URL_REQUEST}/code`],
    ["POST", `${URL_REQUEST}/submit`],
    ["POST", `${URL_REQUEST}/cancel`],
  ];

  it("answers a creator, on every route, exactly as an address that does not exist, and a brand has no path to a piece (CA33)", async () => {
    const server = app();
    const creator = await newCreator();
    const brand = await newBrand();
    await saveDetails(server, brand);
    const draft = await act(server, brand, "");
    const expected = errorBody(
      await call(server, "GET", UNKNOWN, creator.session),
    );
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const [method, url] of ROUTES) {
      const response = await call(
        server,
        method,
        url,
        creator.session,
        method === "PUT" ? DETAILS : undefined,
      );
      expect(errorBody(response), `${method} ${url}`).toEqual(expected);
    }
    // nothing was done to the brand's request nor to its block
    expect((await state(server, brand)).request).toMatchObject({
      id: draft.request.id,
      status: "draft",
    });
    // the pieces of verification are the creator's own: a brand reaches none of them, by any identifier
    for (const [method, url] of [
      ["POST", `/v1/me/verification/requests/${draft.request.id}/submit`],
      ["POST", `/v1/me/verification/requests/${draft.request.id}/cancel`],
      ["GET", "/v1/me/verification"],
    ] as const) {
      const response = await call(server, method, url, brand.session);
      expect(errorBody(response), url).toEqual(expected);
    }
    // and the creator's session on the queue of the agents: no session at all there
    const onQueue = await callBo(server, "GET", BRANDS, creator.session);
    expect(onQueue.statusCode).toBe(401);
  });

  it("answers 401 without a session, 403 for a brand whose terms are pending, and refuses a body on a route that takes none to be read", async () => {
    const server = app();
    for (const [method, url] of ROUTES) {
      const response = await call(
        server,
        method,
        url,
        null,
        method === "PUT" ? DETAILS : undefined,
      );
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
    const pending = await newBrand({ acceptTerms: false });
    const refused = await call(server, "GET", URL_STATE, pending.session);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({
      error: { code: "terms_acceptance_required" },
    });
  });

  it("answers a brand without a profile as an unknown address too", async () => {
    const server = app();
    const brand = await newBrand();
    await migration`
      delete from profiles.advertiser_profiles where account_id = ${brand.accountId}`;
    const expected = errorBody(
      await call(server, "GET", UNKNOWN, brand.session),
    );
    // the doors that need a profile say so as an unknown address; the ones that look for a request
    // answer what they answer to any brand that has none
    for (const [method, url] of [
      ["GET", URL_STATE],
      ["PUT", URL_DETAILS],
      ["POST", URL_REQUEST],
    ] as const) {
      const response = await call(
        server,
        method,
        url,
        brand.session,
        method === "PUT" ? DETAILS : undefined,
      );
      expect(errorBody(response), `${method} ${url}`).toEqual(expected);
    }
  });
});

describe("L2E-B7 the registry sources: read by agent and admin, written by an admin, journaled (06 RG52, RG101)", () => {
  async function sourceOf(country: string, type: string) {
    const [row] = await migration<
      {
        id: string;
        name: string;
        url: string;
        checked_on: string;
        is_active: boolean;
      }[]
    >`
      select id::text as id, name, url, to_char(checked_on, 'YYYY-MM-DD') as checked_on, is_active
        from verification.registry_sources
       where country_code = ${country} and source_type = ${type}`;
    if (row === undefined) {
      throw new Error(`no ${type} source for ${country}`);
    }
    return row;
  }

  it("serves every source, the inactive ones too, to an agent and to an admin, never cached; a member and a visitor read none", async () => {
    const server = app();
    for (const who of [agent, admin]) {
      const response = await callBo(server, "GET", URL_SOURCES, who.session);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const { sources } = verificationRegistrySourcesResponseSchema.parse(
        response.json(),
      );
      expect(sources.length).toBeGreaterThanOrEqual(41);
      expect(sources.every((source) => source.url.startsWith("https://"))).toBe(
        true,
      );
      // GLEIF answers for every country, last in the list; a source "à confirmer" is inactive
      const gleif = sources.find((source) => source.sourceType === "gleif");
      expect(gleif).toMatchObject({ countryCode: null, isActive: true });
      expect(sources.at(-1)?.sourceType).toBe("gleif");
      expect(
        sources.find(
          (source) =>
            source.countryCode === "GB" && source.sourceType === "national",
        ),
      ).toMatchObject({ isActive: false });
      // one active source per country
      const active = sources
        .filter((source) => source.isActive)
        .map((source) => source.countryCode ?? "");
      expect(new Set(active).size).toBe(active.length);
    }
    const member = await newBrand();
    expect(
      (await callBo(server, "GET", URL_SOURCES, member.session)).statusCode,
    ).toBe(401);
    expect((await callBo(server, "GET", URL_SOURCES, null)).statusCode).toBe(
      401,
    );
  });

  it("refuses an agent the write and changes nothing; lets an admin rename a source, the former and the new value journaled, then puts it back", async () => {
    const server = app();
    const before = await sourceOf("GB", "national");
    const change = {
      name: `${before.name} (checked by L2E-15)`,
      url: before.url,
      checkedOn: before.checked_on,
      isActive: before.is_active,
    };
    const byAgent = await callBo(
      server,
      "PUT",
      `${URL_SOURCES}/${before.id}`,
      agent.session,
      change,
    );
    expect(byAgent.statusCode).toBe(403);
    expect((await sourceOf("GB", "national")).name).toBe(before.name);

    try {
      const done = await callBo(
        server,
        "PUT",
        `${URL_SOURCES}/${before.id}`,
        admin.session,
        change,
      );
      expect(done.statusCode, done.body).toBe(200);
      expect(done.headers["cache-control"]).toBe("no-store");
      expect(done.json()).toMatchObject({
        source: {
          id: before.id,
          name: change.name,
          countryCode: "GB",
          isActive: false,
        },
      });
      const lines = await migration<
        {
          event: string;
          actor: string;
          payload: {
            before: { name: string; is_active: boolean };
            after: { name: string; is_active: boolean };
          };
        }[]
      >`
        select event_type as event, actor_account_id::text as actor, payload
          from audit.audit_events
         where subject_id = ${before.id}
           and event_type = 'verification.registry_source_changed'
         order by seq`;
      expect(lines.at(-1)).toMatchObject({
        actor: admin.accountId,
        payload: {
          before: { name: before.name, is_active: false },
          after: { name: change.name, is_active: false },
        },
      });
    } finally {
      await migration`
        update verification.registry_sources
           set name = ${before.name}, updated_by_account_id = null
         where id = ${before.id}`;
    }
    expect((await sourceOf("GB", "national")).name).toBe(before.name);
  });

  it("refuses what is not a page of https, a day in the future, a second active source for a country, and an unknown source (RG52)", async () => {
    const server = app();
    const gb = await sourceOf("GB", "national");
    const valid = {
      name: gb.name,
      url: gb.url,
      checkedOn: gb.checked_on,
      isActive: false,
    };
    const put = (id: string, body: unknown) =>
      callBo(server, "PUT", `${URL_SOURCES}/${id}`, admin.session, body);

    for (const url of [
      "http://example.test/register",
      "ftp://example.test/register",
      "https://exa mple.test/register",
      "javascript:alert(1)",
    ]) {
      const response = await put(gb.id, { ...valid, url });
      expect(response.statusCode, url).toBe(400);
    }
    const future = await put(gb.id, {
      ...valid,
      checkedOn: new Date(Date.now() + 3 * DAY_MS).toISOString().slice(0, 10),
    });
    expect(future.statusCode).toBe(400);
    expect(issuesOf(future)).toEqual([
      { path: "checkedOn", issue: "invalid_checked_on" },
    ]);
    // a field the body does not know, a name too short
    expect((await put(gb.id, { ...valid, countryCode: "FR" })).statusCode).toBe(
      400,
    );
    expect((await put(gb.id, { ...valid, name: "x" })).statusCode).toBe(400);

    // NO is served by e-Justice already: its national register stays inactive until that one is
    const no = await sourceOf("NO", "national");
    const second = await put(no.id, {
      name: no.name,
      url: no.url,
      checkedOn: no.checked_on,
      isActive: true,
    });
    expect(second.statusCode).toBe(409);
    expect(issuesOf(second)).toEqual([
      { path: "source", issue: "active_source_exists" },
    ]);
    expect((await sourceOf("NO", "national")).is_active).toBe(false);

    const unknown = await put(randomUUID(), valid);
    expect(unknown.statusCode).toBe(404);
    expect(
      (
        await callBo(
          server,
          "PUT",
          `${URL_SOURCES}/not-an-id`,
          admin.session,
          valid,
        )
      ).statusCode,
    ).toBe(400);
    // the sources are unchanged by every refusal above
    expect(await sourceOf("GB", "national")).toEqual(gb);
  });
});

describe("C-1 (D60, invariant 17): nothing personal in the logs", () => {
  it("finds no code, no legal name, no number of registration and no domain in any captured stream", () => {
    expect(watchedValues.length).toBeGreaterThan(10);
    const found = valuesFoundIn(
      logStreams.map((read) => read()).join("\n"),
      watchedValues,
    );
    expect(found).toEqual([]);
  });
});
