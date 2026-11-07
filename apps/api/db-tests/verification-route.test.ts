// L2E commit 12 — the creator's verification routes on the local stack (docs/mvp/08 RG11 to RG14, RG21
// to RG23, RG56, RG60, CA12, CA16, CA17, CA37, CA38; 18 T14; jalons/l2e/modele.md §4, §6): GET
// /v1/me/verification and the four acts on a request (open, code, submit, cancel), through the pools
// of apps/api (member under influx_app, migrations 0221, 0222). The route accounts are COMMITTED by the
// migration role (random identifiers, disposable local stack, like the creator profile's) with their
// sessions, and every open request is withdrawn at the end. Every log stream is searched BY VALUE
// (C-1, D60, invariant 17): no code, no handle.
// L2E-R1 the state of the lines, L2E-R2 open, code and double click (CA12), L2E-R3 submit and cancel,
// the completeness counting a request filed, L2E-R4 the refusals read by their owner (CA16), L2E-R5 the
// delay and the cap (CA37, CA38), L2E-R6 the expiry of a code (CA17) and the prerequisites, L2E-R7 who
// may reach the routes (T14).
import {
  creatorProfileResponseSchema,
  type CreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import {
  creatorVerificationResponseSchema,
  verificationRequestResponseSchema,
  type CreatorVerificationResponse,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
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
const accounts: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

const URL_STATE = "/v1/me/verification";
const URL_REQUESTS = `${URL_STATE}/requests`;
const CODE_SHAPE = /^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const DAY_MS = 24 * 3_600_000;
const agentA = accountIdOf("agent", "a");

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; email: string; session: string };

async function newMember(
  role: "advertiser" | "creator",
  options: { acceptTerms?: boolean; networks?: string[] } = {},
): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2e-verification-${role}-${accountId}@example.test`;
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
      const networks = options.networks ?? ["instagram"];
      for (const [index, network] of networks.entries()) {
        await tx`
          insert into profiles.creator_social_accounts
            (account_id, network_code, is_primary, handle)
          values (${accountId}, ${network}, ${index === 0},
                  ${`handle_${accountId.slice(0, 8)}_${index}`})`;
      }
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
  accounts.push(accountId);
  watchedValues.push(email, `handle_${accountId.slice(0, 8)}`);
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

async function call(
  server: Server,
  method: "GET" | "POST",
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

async function state(
  server: Server,
  member: Member,
): Promise<CreatorVerificationResponse> {
  const response = await call(server, "GET", URL_STATE, member.session);
  expect(response.statusCode, response.body).toBe(200);
  return creatorVerificationResponseSchema.parse(response.json());
}

/** An act that must succeed, parsed; the code it shows is watched in the logs. */
async function act(
  server: Server,
  member: Member,
  url: string,
  body?: unknown,
): Promise<VerificationRequestResponse> {
  const response = await call(server, "POST", url, member.session, body);
  expect(response.statusCode, response.body).toBe(200);
  const parsed = verificationRequestResponseSchema.parse(response.json());
  if (parsed.request.code !== null) {
    watchedValues.push(parsed.request.code.code);
  }
  return parsed;
}

function open(
  server: Server,
  member: Member,
  networkCode: string,
  level: "account_verified" | "audience_verified" = "account_verified",
) {
  return act(server, member, URL_REQUESTS, { networkCode, level });
}

function onRequest(id: string, name: "code" | "submit" | "cancel"): string {
  return `${URL_REQUESTS}/${id}/${name}`;
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

async function completenessOf(server: Server, member: Member): Promise<number> {
  const response = await call(
    server,
    "GET",
    "/v1/me/creator-profile",
    member.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  const profile: CreatorProfileResponse = creatorProfileResponseSchema.parse(
    response.json(),
  );
  return profile.completeness.score;
}

/** The score stored with the identity: what the backoffice and the search read (07 RG86). */
async function storedScore(member: Member): Promise<number | undefined> {
  const [row] = await migration<{ score: number }[]>`
    select completeness_percent::int as score from profiles.creator_identities
     where account_id = ${member.accountId}`;
  return row?.score;
}

async function lineOf(member: Member, network: string): Promise<string> {
  const [row] = await migration<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts
     where account_id = ${member.accountId} and network_code = ${network}
     order by created_at limit 1`;
  if (row === undefined) {
    throw new Error("no such line");
  }
  return row.id;
}

/** A refusal of the creator's account request on `line`, decided `hoursAgo` hours ago. */
async function insertRefusal(
  member: Member,
  line: string,
  hoursAgo: number,
  options: {
    level?: "account_verified" | "audience_verified";
    reason?: string;
    memberMessage?: string;
    internalComment?: string;
  } = {},
): Promise<void> {
  await migration`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
       rejection_reason_code, member_message, internal_comment)
    values (${member.accountId}, ${line}, 'instagram',
            ${options.level ?? "account_verified"}::verification.badge_level, 'rejected',
            now() - make_interval(hours => ${hoursAgo + 2}),
            now() - make_interval(hours => ${hoursAgo + 2}),
            now() - make_interval(hours => ${hoursAgo}),
            now() - make_interval(hours => ${hoursAgo}),
            ${agentA}, now() - make_interval(hours => ${hoursAgo}),
            now() - make_interval(hours => ${hoursAgo}),
            ${options.reason ?? "ownership_not_proven"},
            ${options.memberMessage ?? null}, ${options.internalComment ?? null})`;
}

/** An active « Compte vérifié » of the creator on `line`, from an approved request. */
async function grantAccountBadge(member: Member, line: string): Promise<void> {
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
    values (${member.accountId}, ${line}, 'instagram', 'account_verified', 'approved',
            now() - interval '3 hours', now() - interval '3 hours',
            now() - interval '1 hour', now() - interval '1 hour',
            ${agentA}, now() - interval '2 hours', now() - interval '2 hours')
    returning id::text`;
  await migration`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision, state)
    values (${member.accountId}, ${line}, 'instagram', ${request?.id ?? null},
            'account_verified', ${agentA}, now() - interval '2 hours', 'public_profile',
            ${`handle_${member.accountId.slice(0, 8)}_0`}, 'active')`;
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
});

describe("L2E-R1 GET /v1/me/verification: the lines, network by network (08 RG13)", () => {
  it("answers a creator one line per network, with nothing asked and nothing obtained, never cached", async () => {
    const server = app();
    const member = await newMember("creator", {
      networks: ["tiktok", "instagram"],
    });
    const response = await call(server, "GET", URL_STATE, member.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const found = creatorVerificationResponseSchema.parse(response.json());
    expect(found.lines).toEqual([
      { networkCode: "instagram", badges: [], requests: [] },
      { networkCode: "tiktok", badges: [], requests: [] },
    ]);
    expect(Number.isNaN(Date.parse(found.asOf))).toBe(false);
    // a creator with no line has no line: nothing is proposed (08 cas limite 1)
    const bare = await newMember("creator", { networks: [] });
    expect((await state(server, bare)).lines).toEqual([]);
  });

  it("shows the badge obtained with its date, its source and no expiry for the account, never an identifier of the network", async () => {
    const server = app();
    const member = await newMember("creator");
    await grantAccountBadge(member, await lineOf(member, "instagram"));
    const found = await state(server, member);
    expect(found.lines).toHaveLength(1);
    expect(found.lines[0]?.badges).toEqual([
      {
        level: "account_verified",
        networkCode: "instagram",
        state: "active",
        grantedAt: expect.stringMatching(/Z$/),
        periodStart: null,
        periodEnd: null,
        evidenceSource: "public_profile",
        expiresAt: null,
      },
    ]);
    // the approved request is the badge's: it is not shown a second time as a request
    expect(found.lines[0]?.requests).toEqual([]);
    expect(JSON.stringify(found)).not.toContain("handle_");
  });
});

describe("L2E-R2 open, renew the code, double click (08 RG14, RG21 to RG23, CA12)", () => {
  it("opens a draft with its code, valid 7 days, and takes the same draft back on a second click (CA12)", async () => {
    const server = app();
    const member = await newMember("creator");
    const first = await open(server, member, "instagram");
    expect(first.created).toBe(true);
    expect(first.request).toMatchObject({
      level: "account_verified",
      status: "draft",
      networkCode: "instagram",
      submittedAt: null,
      evidence: [],
      refusal: null,
    });
    const code = first.request.code;
    expect(code?.code).toMatch(CODE_SHAPE);
    const days =
      (Date.parse(code?.expiresAt ?? "") -
        Date.parse(first.request.createdAt)) /
      DAY_MS;
    expect(days).toBeCloseTo(7, 1);
    // the second click: the same request, the same code, nothing new
    const second = await open(server, member, "instagram");
    expect(second.created).toBe(false);
    expect(second.request.id).toBe(first.request.id);
    expect(second.request.code).toEqual(code);
    const stored = await migration<{ n: number }[]>`
      select count(*)::int as n from verification.ownership_codes
       where request_id = ${first.request.id}`;
    expect(stored[0]?.n).toBe(1);
    const read = await state(server, member);
    expect(read.lines[0]?.requests.map((request) => request.id)).toEqual([
      first.request.id,
    ]);
  });

  it("replaces the code on a renewal: one valid code, the former one revoked (CA12, RG23)", async () => {
    const server = app();
    const member = await newMember("creator");
    const opened = await open(server, member, "instagram");
    const renewed = await act(
      server,
      member,
      onRequest(opened.request.id, "code"),
    );
    expect(renewed.created).toBe(false);
    expect(renewed.request.code?.code).toMatch(CODE_SHAPE);
    expect(renewed.request.code?.code).not.toBe(opened.request.code?.code);
    const codes = await migration<{ code: string; revoked: boolean }[]>`
      select code, revoked_at is not null as revoked from verification.ownership_codes
       where request_id = ${opened.request.id} order by created_at`;
    expect(codes).toEqual([
      { code: opened.request.code?.code, revoked: true },
      { code: renewed.request.code?.code, revoked: false },
    ]);
    // what the creator reads is the live one
    const read = await state(server, member);
    expect(read.lines[0]?.requests[0]?.code?.code).toBe(
      renewed.request.code?.code,
    );
  });

  it("opens an audience request without a code, and refuses a code on it", async () => {
    const server = app();
    const member = await newMember("creator");
    const opened = await open(server, member, "instagram", "audience_verified");
    expect(opened.request).toMatchObject({
      level: "audience_verified",
      status: "draft",
      code: null,
    });
    const renewal = await call(
      server,
      "POST",
      onRequest(opened.request.id, "code"),
      member.session,
    );
    expect(errorBody(renewal)).toMatchObject({
      status: 400,
      code: "validation_failed",
    });
    expect(issuesOf(renewal)).toEqual([
      { path: "level", issue: "invalid_level" },
    ]);
  });

  it("asks nothing of a malformed body: an unknown level, a field of another account, a missing network", async () => {
    const server = app();
    const member = await newMember("creator");
    for (const body of [
      { networkCode: "instagram", level: "brand_verified" },
      {
        networkCode: "instagram",
        level: "account_verified",
        accountId: randomUUID(),
      },
      { level: "account_verified" },
    ]) {
      const response = await call(
        server,
        "POST",
        URL_REQUESTS,
        member.session,
        body,
      );
      expect(response.statusCode).toBe(400);
    }
  });
});

describe("L2E-R3 submit and cancel; the completeness counts a request filed (08 RG14, 07 RG88)", () => {
  it("submits once, whatever the clicks, and refuses a second request on the same level with the date it has been open since (RG14)", async () => {
    const server = app();
    const member = await newMember("creator");
    const opened = await open(server, member, "instagram");
    const submitted = await act(
      server,
      member,
      onRequest(opened.request.id, "submit"),
    );
    expect(submitted.request.status).toBe("pending");
    expect(submitted.request.submittedAt).not.toBeNull();
    // a double click writes nothing more: the same request, the same instant
    const again = await act(
      server,
      member,
      onRequest(opened.request.id, "submit"),
    );
    expect(again.request).toEqual(submitted.request);
    // a second request on the triplet: refused, with the date of the first
    const duplicate = await call(server, "POST", URL_REQUESTS, member.session, {
      networkCode: "instagram",
      level: "account_verified",
    });
    expect(errorBody(duplicate)).toEqual({
      status: 409,
      code: "conflict",
      message: "Conflict",
    });
    const issues = issuesOf(duplicate);
    expect(issues[0]).toEqual({ path: "request", issue: "duplicate_request" });
    expect(issues[1]?.path).toBe("submittedAt");
    expect(Date.parse(issues[1]?.issue ?? "")).toBe(
      Math.floor(Date.parse(submitted.request.submittedAt ?? "") / 1000) * 1000,
    );
    expect(duplicate.headers["retry-after"]).toBeUndefined();
    // a submitted request can no longer be given a new code
    const renewal = await call(
      server,
      "POST",
      onRequest(opened.request.id, "code"),
      member.session,
    );
    expect(issuesOf(renewal)).toEqual([
      { path: "request", issue: "request_not_draft" },
    ]);
    expect(renewal.statusCode).toBe(409);
  });

  it("counts a request filed in the completeness, and no more once it is withdrawn; a withdrawn request may be asked again at once", async () => {
    const server = app();
    const member = await newMember("creator");
    const before = await completenessOf(server, member);
    const opened = await open(server, member, "instagram");
    // a draft is not filed
    expect(await completenessOf(server, member)).toBe(before);
    await act(server, member, onRequest(opened.request.id, "submit"));
    expect(await completenessOf(server, member)).toBe(before + 2);
    // and the score stored with the profile moves in the same transaction as the submission
    expect(await storedScore(member)).toBe(before + 2);
    const cancelled = await act(
      server,
      member,
      onRequest(opened.request.id, "cancel"),
    );
    expect(cancelled.request.status).toBe("cancelled");
    expect(await completenessOf(server, member)).toBe(before);
    expect(await storedScore(member)).toBe(before);
    // a double click on « annuler »: nothing more
    const twice = await act(
      server,
      member,
      onRequest(opened.request.id, "cancel"),
    );
    expect(twice.request).toEqual(cancelled.request);
    // a withdrawn request is not shown, and asking again is not delayed
    expect((await state(server, member)).lines[0]?.requests).toEqual([]);
    const reopened = await open(server, member, "instagram");
    expect(reopened.created).toBe(true);
    expect(reopened.request.id).not.toBe(opened.request.id);
  });
});

describe("L2E-R4 the refusal as its owner reads it (08 RG56, RG57, CA16)", () => {
  it("gives the reason and the agent's own message for `other`, and never the internal comment nor the agent", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await lineOf(member, "instagram");
    const message =
      "Votre bio ne permet pas de retrouver le code, merci de le coller en première ligne.";
    await insertRefusal(member, line, 30, {
      reason: "other",
      memberMessage: message,
      internalComment: "NOTE-INTERNE-ZZ9 doute sur la titularité du compte",
    });
    const response = await call(server, "GET", URL_STATE, member.session);
    expect(response.statusCode).toBe(200);
    const found = creatorVerificationResponseSchema.parse(response.json());
    const request = found.lines[0]?.requests[0];
    expect(request).toMatchObject({
      level: "account_verified",
      status: "rejected",
      code: null,
      refusal: {
        reasonCode: "other",
        message,
        decidedAt: expect.stringMatching(/Z$/),
      },
    });
    expect(response.body).not.toContain("NOTE-INTERNE-ZZ9");
    expect(response.body).not.toContain(agentA);
    expect(response.body).not.toMatch(
      /claim|reviewToken|internal|escalat|reexamin|slaDue|decidedBy/i,
    );
  });

  it("gives a typed reason without a text of the agent, and keeps the latest refusal of each level", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await lineOf(member, "instagram");
    await insertRefusal(member, line, 80, { reason: "evidence_too_old" });
    await insertRefusal(member, line, 30, { reason: "account_not_public" });
    await insertRefusal(member, line, 40, {
      level: "audience_verified",
      reason: "evidence_unreadable",
    });
    const found = await state(server, member);
    const requests = found.lines[0]?.requests ?? [];
    expect(
      requests.map((request) => [request.level, request.refusal?.reasonCode]),
    ).toEqual([
      ["account_verified", "account_not_public"],
      ["audience_verified", "evidence_unreadable"],
    ]);
    expect(requests.map((request) => request.refusal?.message)).toEqual([
      "",
      "",
    ]);
  });
});

describe("L2E-R5 24 hours after a refusal and three refusals in 30 days (08 RG60, CA37, CA38)", () => {
  it("refuses a request 2 hours after a refusal with the delay left in Retry-After only (CA37), and opens it after 24 hours", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await lineOf(member, "instagram");
    await insertRefusal(member, line, 2);
    const refused = await call(server, "POST", URL_REQUESTS, member.session, {
      networkCode: "instagram",
      level: "account_verified",
    });
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "request", issue: "retry_after" },
    ]);
    const seconds = Number(refused.headers["retry-after"]);
    // 24 h less 2 h, to the second the test took
    expect(seconds).toBeGreaterThan(22 * 3600 - 120);
    expect(seconds).toBeLessThanOrEqual(22 * 3600);
    // the seconds travel in the header and nowhere in the body: an issue, and nothing else
    const { error } = refused.json() as { error: Record<string, unknown> };
    expect(Object.keys(error).sort()).toEqual([
      "code",
      "details",
      "message",
      "requestId",
    ]);
    expect((await state(server, member)).lines[0]?.requests).toHaveLength(1);

    const later = await newMember("creator");
    await insertRefusal(later, await lineOf(later, "instagram"), 25);
    const opened = await open(server, later, "instagram");
    expect(opened.created).toBe(true);
  });

  it("refuses the fourth request after three refusals in 30 days (CA38), and counts only the same level and the last 30 days", async () => {
    const server = app();
    const member = await newMember("creator");
    const line = await lineOf(member, "instagram");
    for (const hoursAgo of [30, 100, 400]) {
      await insertRefusal(member, line, hoursAgo);
    }
    const refused = await call(server, "POST", URL_REQUESTS, member.session, {
      networkCode: "instagram",
      level: "account_verified",
    });
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "request", issue: "rejection_cap" },
    ]);
    expect(refused.headers["retry-after"]).toBeUndefined();
    // the audience level of the same line has no refusal: its own count
    const audience = await open(
      server,
      member,
      "instagram",
      "audience_verified",
    );
    expect(audience.created).toBe(true);

    // two refusals in the window and a third 40 days old: not a cap
    const spared = await newMember("creator");
    const sparedLine = await lineOf(spared, "instagram");
    for (const hoursAgo of [30, 100, 40 * 24]) {
      await insertRefusal(spared, sparedLine, hoursAgo);
    }
    expect((await open(server, spared, "instagram")).created).toBe(true);
  });
});

describe("L2E-R6 a code that is not pasted, and the prerequisites (08 RG12, RG30, CA17)", () => {
  it("refuses to submit a draft whose code has lapsed, and lets a new request be opened at once once the request expired (CA17)", async () => {
    const server = app();
    const member = await newMember("creator");
    const opened = await open(server, member, "instagram");
    await migration`
      update verification.ownership_codes
         set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
       where request_id = ${opened.request.id}`;
    const lapsed = await call(
      server,
      "POST",
      onRequest(opened.request.id, "submit"),
      member.session,
    );
    expect(lapsed.statusCode).toBe(409);
    expect(issuesOf(lapsed)).toEqual([
      { path: "request", issue: "code_expired" },
    ]);
    // what the hourly task verification_expiry does (L2E-D12): the draft expires
    await migration`
      update verification.verification_requests
         set status = 'expired', closed_at = now() where id = ${opened.request.id}`;
    const read = await state(server, member);
    expect(read.lines[0]?.requests[0]).toMatchObject({
      id: opened.request.id,
      status: "expired",
      code: null,
      refusal: null,
    });
    // a new code without delay: an expired request is not a refusal (CA17)
    const again = await open(server, member, "instagram");
    expect(again.created).toBe(true);
    expect(again.request.id).not.toBe(opened.request.id);
    expect(again.request.code?.code).toMatch(CODE_SHAPE);
    expect((await state(server, member)).lines[0]?.requests).toHaveLength(1);
  });

  it("refuses the audience of a network whose ownership is not established, written before the button (RG12, CA7), and an account already verified (RG30)", async () => {
    const server = app();
    const member = await newMember("creator");
    const audience = await open(
      server,
      member,
      "instagram",
      "audience_verified",
    );
    const unproven = await call(
      server,
      "POST",
      onRequest(audience.request.id, "submit"),
      member.session,
    );
    expect(unproven.statusCode).toBe(409);
    expect(issuesOf(unproven)).toEqual([
      { path: "request", issue: "ownership_prerequisite" },
    ]);

    await grantAccountBadge(member, await lineOf(member, "instagram"));
    // the ownership is proven once, never asked again
    const already = await call(server, "POST", URL_REQUESTS, member.session, {
      networkCode: "instagram",
      level: "account_verified",
    });
    expect(already.statusCode).toBe(409);
    expect(issuesOf(already)).toEqual([
      { path: "request", issue: "already_verified" },
    ]);
    // the prerequisite met, the audience still needs its piece (-13, deposited at commit 13)
    const missing = await call(
      server,
      "POST",
      onRequest(audience.request.id, "submit"),
      member.session,
    );
    expect(missing.statusCode).toBe(409);
    expect(issuesOf(missing)).toEqual([
      { path: "request", issue: "missing_evidence" },
    ]);
  });
});

describe("L2E-R7 who may reach the routes (18 T14.1 to T14.4)", () => {
  const UNKNOWN = "/v1/me/verification-nothing";

  async function everyRoute(
    server: Server,
    session: string,
    requestId: string,
  ): Promise<Map<string, ReturnType<typeof errorBody>>> {
    const body = { networkCode: "instagram", level: "account_verified" };
    const found = new Map<string, ReturnType<typeof errorBody>>();
    for (const [label, method, url, payload] of [
      ["GET state", "GET", URL_STATE, undefined],
      ["POST open", "POST", URL_REQUESTS, body],
      ["POST code", "POST", onRequest(requestId, "code"), undefined],
      ["POST submit", "POST", onRequest(requestId, "submit"), undefined],
      ["POST cancel", "POST", onRequest(requestId, "cancel"), undefined],
    ] as const) {
      found.set(
        label,
        errorBody(await call(server, method, url, session, payload)),
      );
    }
    return found;
  }

  it("answers a brand, on every route, exactly as an address that does not exist (T14.3, T14.4)", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const creator = await newMember("creator");
    const opened = await open(server, creator, "instagram");
    const expected = errorBody(
      await call(server, "GET", UNKNOWN, brand.session),
    );
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    // the request of a creator, by its real identifier, and one that does not exist
    for (const requestId of [opened.request.id, randomUUID()]) {
      for (const [label, found] of await everyRoute(
        server,
        brand.session,
        requestId,
      )) {
        expect(found, label).toEqual(expected);
      }
    }
    // and nothing was done to the creator's request
    const read = await state(server, creator);
    expect(read.lines[0]?.requests.map((request) => request.status)).toEqual([
      "draft",
    ]);
  });

  it("answers another creator's request, a request that does not exist and a network he has no line on as an unknown address (T14.1, T14.2)", async () => {
    const server = app();
    const owner = await newMember("creator");
    const other = await newMember("creator", { networks: ["tiktok"] });
    const opened = await open(server, owner, "instagram");
    const expected = errorBody(
      await call(server, "GET", UNKNOWN, other.session),
    );
    for (const requestId of [opened.request.id, randomUUID()]) {
      for (const name of ["code", "submit", "cancel"] as const) {
        const response = await call(
          server,
          "POST",
          onRequest(requestId, name),
          other.session,
        );
        expect(errorBody(response), `${name} ${requestId}`).toEqual(expected);
      }
    }
    // a network the other creator has no line on
    const foreign = await call(server, "POST", URL_REQUESTS, other.session, {
      networkCode: "instagram",
      level: "account_verified",
    });
    expect(errorBody(foreign)).toEqual(expected);
    // an identifier that is not one is a malformed address, never a lookup
    const malformed = await call(
      server,
      "POST",
      `${URL_REQUESTS}/not-an-identifier/cancel`,
      other.session,
    );
    expect(malformed.statusCode).toBe(400);
    // the owner's request is as it was, and the other creator reads none of it
    const mine = await state(server, owner);
    expect(mine.lines[0]?.requests.map((request) => request.status)).toEqual([
      "draft",
    ]);
    const theirs = await state(server, other);
    expect(theirs.lines).toEqual([
      { networkCode: "tiktok", badges: [], requests: [] },
    ]);
    expect(JSON.stringify(theirs)).not.toContain(opened.request.id);
    expect(JSON.stringify(theirs)).not.toContain(
      opened.request.code?.code ?? "unreachable",
    );
  });

  it("answers a brand whose terms are pending as unknown too, a creator whose terms are pending 403, and 401 without a session", async () => {
    const server = app();
    const brand = await newMember("advertiser", { acceptTerms: false });
    expect(
      errorBody(await call(server, "GET", URL_STATE, brand.session)),
    ).toEqual({ status: 404, code: "not_found", message: "Not found" });
    const creator = await newMember("creator", { acceptTerms: false });
    expect(
      errorBody(await call(server, "GET", URL_STATE, creator.session)),
    ).toMatchObject({ status: 403, code: "terms_acceptance_required" });
    expect(
      errorBody(
        await call(server, "POST", URL_REQUESTS, creator.session, {
          networkCode: "instagram",
          level: "account_verified",
        }),
      ),
    ).toMatchObject({ status: 403, code: "terms_acceptance_required" });
    expect((await call(server, "GET", URL_STATE, null)).statusCode).toBe(401);
    expect(
      (await call(server, "POST", onRequest(randomUUID(), "submit"), null))
        .statusCode,
    ).toBe(401);
  });
});

describe("C-1 (D60, invariant 17): nothing personal in the logs", () => {
  it("finds no code, no handle and no address in any captured stream", () => {
    expect(logStreams.length).toBeGreaterThanOrEqual(10);
    expect(watchedValues.length).toBeGreaterThan(20);
    expect(
      logStreams.flatMap((text) => valuesFoundIn(text(), watchedValues)),
    ).toEqual([]);
  });
});
