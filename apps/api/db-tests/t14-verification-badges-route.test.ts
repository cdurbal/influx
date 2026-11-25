// T14, TM5.4 par la route (L2F, commit 13) — the badges of an account and the withdrawal of a badge under
// dual control, on the local stack through the pools of apps/api (docs/mvp/08 RG73 to RG76, CA49 to CA51;
// 06 RG55; 03 §3.2, PD1 to PD7; 15 RG36, RG110; 18 T14.1 to T14.4, TM5.4; jalons/l2f/modele.md §3 "0231", §5;
// l2f-fiche invariants 3 to 5, 13, 17):
//   GET  /v1/bo/accounts/:id/badges
//   POST /v1/bo/accounts/:id/badges/:badgeId/revocation
//   GET  /v1/bo/dual-control/:id and POST /v1/bo/dual-control/:id/confirm for `verification.revoke_badge`.
// The fixtures (an agent, two admins, brands with a badge) are COMMITTED (random identifiers, disposable
// local stack, like T14 of J8); the internal profiles are deactivated and the 2V left pending cancelled
// after the file. A brand badge is enough: the reasons, the 2V and the register do not depend on the
// level, and the creator level is the database's (verification-revocation.test.ts).
// L2F-B1 the block « Badges » and its reasons, L2F-B2 the request (typed values, refusals, the account
// one holds), L2F-B3 the 2V view and the confirmation (TM5.4: nothing is withdrawn without a distinct
// admin, once only), L2F-B4 the identity of the unknown.
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
import { sharedMigrationRole } from "./support.ts";

const NIL = "00000000-0000-4000-8000-000000000000";
const MESSAGE = "Your profile breached the terms on several published posts.";

let database: ApiDatabase;
const internals: string[] = [];
const pending: { id: string; by: Internal }[] = [];

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
      values (${accountId}, ${randomUUID()}, ${`t14-badges-${role}-${accountId}@example.test`},
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

type Brand = { accountId: string; badgeId: string };

/** A committed brand (optionally held by `owner`) holding a « Marque vérifiée » badge granted today. */
async function newBrandWithBadge(owner: string | null): Promise<Brand> {
  const accountId = randomUUID();
  const sql = sharedMigrationRole();
  return sql.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
      values (${accountId}, ${randomUUID()}, ${`t14-badges-brand-${accountId}@example.test`},
              now(), 'FR', 'fr', true, now(), 'business', ${owner})`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, 'advertiser')`;
    await tx`
      insert into profiles.advertiser_profiles (account_id, legal_name)
      values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
    const [request] = await tx<{ id: string }[]>`
      insert into verification.verification_requests (account_id, level, status)
      values (${accountId}, 'brand_verified', 'pending') returning id::text`;
    await tx`
      update verification.verification_requests
         set status = 'approved', decided_by_account_id = ${agent.accountId}, decided_at = now(),
             closed_at = now()
       where id = ${request?.id ?? null}`;
    const [badge] = await tx<{ id: string }[]>`
      insert into verification.badges
        (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
         registry_source_id, expires_at)
      select ${accountId}, ${request?.id ?? null}, 'brand_verified', ${agent.accountId}, now(),
             'domain_and_registry', s.id, now() + interval '12 months'
        from verification.registry_sources s where s.is_active order by s.id limit 1
      returning id::text`;
    if (badge === undefined) throw new Error("no badge");
    return { accountId, badgeId: badge.id };
  });
}

function app() {
  return buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
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

function errorCode(response: LightMyRequestResponse): string | undefined {
  return response.json<{ error?: { code?: string } }>().error?.code;
}

function badgesUrl(brand: Brand): string {
  return `/v1/bo/accounts/${brand.accountId}/badges`;
}

function revocationUrl(brand: Brand, badgeId = brand.badgeId): string {
  return `/v1/bo/accounts/${brand.accountId}/badges/${badgeId}/revocation`;
}

type BadgesBody = {
  badges: {
    id: string;
    level: string;
    networkCode: string | null;
    state: string;
    revocationReasonCode: string | null;
    pendingRevocation: { dualControlRequestId: string; state: string } | null;
  }[];
  reasons: {
    code: string;
    levels: string[];
    requiresMemberMessage: boolean;
    message: string;
  }[];
};

type ViewBody = {
  id: string;
  action: {
    code: string;
    accountId: string;
    badgeId: string;
    reasonCode: string;
  };
  target: {
    kind: string;
    level: string;
    cascadeCount: number;
    memberMessage: string | null;
  };
  recap: {
    scope: { kind: string; count: number };
    consequences: string[];
    reversible: boolean;
  };
  state: string;
  next: { kind: string };
};

let agent: Internal;
let otherAgent: Internal;
let adminA: Internal;
let adminB: Internal;

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
  otherAgent = await newInternal("agent");
  adminA = await newInternal("admin");
  adminB = await newInternal("admin");
});

afterAll(async () => {
  // a 2V left pending is cancelled by its requester: the pending list of other files stays theirs
  const server = app();
  for (const { id, by } of pending) {
    await call(server, "POST", `/v1/bo/dual-control/${id}/cancel`, by.session);
  }
  await closeDatabase(database);
  if (internals.length > 0) {
    await sharedMigrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${internals}::uuid[]) and is_active`;
  }
});

// ---------------------------------------------------------------------------------------------

describe("L2F-B1 the block « Badges » of an account", () => {
  it("serves every badge of a member account to an agent and to an admin, with the reasons and no figure", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    for (const who of [agent, adminA]) {
      const response = await call(server, "GET", badgesUrl(brand), who.session);
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const body = response.json<BadgesBody>();
      expect(body.badges).toEqual([
        expect.objectContaining({
          id: brand.badgeId,
          level: "brand_verified",
          networkCode: null,
          state: "active",
          revocationReasonCode: null,
          pendingRevocation: null,
        }),
      ]);
      // the seven reasons of the closed list, each with the sentence the member receives
      expect(body.reasons.map((reason) => reason.code)).toEqual([
        "forged_evidence",
        "account_closed",
        "owner_changed",
        "terms_breach",
        "influx_error",
        "company_dissolved",
        "domain_transferred",
      ]);
      expect(body.reasons.every((reason) => reason.message.length > 20)).toBe(
        true,
      );
      expect(
        body.reasons.find((reason) => reason.code === "terms_breach"),
      ).toMatchObject({ requiresMemberMessage: true });
      // never a handle, a figure or an agent
      expect(response.body).not.toMatch(/handle|followers|granted_by/i);
    }
  });
});

describe("L2F-B2 the request of a withdrawal", () => {
  it("refuses a reason of another level, a message that is missing, given when refused, or a contact", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const ask = (body: object) =>
      call(server, "POST", revocationUrl(brand), agent.session, body);
    const wrongLevel = await ask({ reasonCode: "account_closed" });
    expect(wrongLevel.statusCode).toBe(400);
    expect(issuesOf(wrongLevel)).toEqual([
      { path: "reasonCode", issue: "invalid_reason" },
    ]);
    const missing = await ask({ reasonCode: "terms_breach" });
    expect(missing.statusCode).toBe(400);
    expect(issuesOf(missing)).toEqual([
      { path: "memberMessage", issue: "invalid_member_message" },
    ]);
    const unwanted = await ask({
      reasonCode: "forged_evidence",
      memberMessage: MESSAGE,
    });
    expect(unwanted.statusCode).toBe(400);
    expect(issuesOf(unwanted)).toEqual([
      { path: "memberMessage", issue: "invalid_member_message" },
    ]);
    const contact = await ask({
      reasonCode: "terms_breach",
      memberMessage: "Write to me at someone@example.test to discuss it.",
    });
    expect(contact.statusCode).toBe(400);
    expect(issuesOf(contact)).toEqual([
      { path: "memberMessage", issue: "direct_contact" },
    ]);
    // nothing was asked: the badge shows no pending withdrawal
    const after = await call(server, "GET", badgesUrl(brand), agent.session);
    expect(after.json<BadgesBody>().badges[0]?.pendingRevocation).toBeNull();
  });

  it("opens one 2V per badge: the second ask is a 409 on `badge`", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const first = await call(
      server,
      "POST",
      revocationUrl(brand),
      agent.session,
      {
        reasonCode: "terms_breach",
        memberMessage: MESSAGE,
      },
    );
    expect(first.statusCode).toBe(200);
    const { dualControlRequestId } = first.json<{
      dualControlRequestId: string;
    }>();
    pending.push({ id: dualControlRequestId, by: agent });
    const again = await call(
      server,
      "POST",
      revocationUrl(brand),
      adminA.session,
      {
        reasonCode: "forged_evidence",
      },
    );
    expect(again.statusCode).toBe(409);
    expect(issuesOf(again)).toEqual([
      { path: "badge", issue: "revocation_pending" },
    ]);
    const block = await call(server, "GET", badgesUrl(brand), adminA.session);
    expect(block.json<BadgesBody>().badges[0]?.pendingRevocation).toEqual({
      dualControlRequestId,
      state: "pending",
    });
  });

  it("refuses an account the caller holds: 403 conflict_of_interest, nothing opened (15 RG36)", async () => {
    const server = app();
    const brand = await newBrandWithBadge(agent.accountId);
    const held = await call(
      server,
      "POST",
      revocationUrl(brand),
      agent.session,
      {
        reasonCode: "forged_evidence",
      },
    );
    expect(held.statusCode).toBe(403);
    expect(issuesOf(held)).toEqual([
      { path: "entry", issue: "conflict_of_interest" },
    ]);
    // the badges stay readable to him, and nothing is pending
    const block = await call(server, "GET", badgesUrl(brand), agent.session);
    expect(block.statusCode).toBe(200);
    expect(block.json<BadgesBody>().badges[0]?.pendingRevocation).toBeNull();
    // another agent asks it
    const other = await call(
      server,
      "POST",
      revocationUrl(brand),
      otherAgent.session,
      {
        reasonCode: "forged_evidence",
      },
    );
    expect(other.statusCode).toBe(200);
    pending.push({
      id: other.json<{ dualControlRequestId: string }>().dualControlRequestId,
      by: otherAgent,
    });
  });
});

describe("L2F-B3 the 2V view and the confirmation (TM5.4)", () => {
  async function asked(
    brand: Brand,
    by: Internal,
    body: object,
  ): Promise<string> {
    const response = await call(
      app(),
      "POST",
      revocationUrl(brand),
      by.session,
      body,
    );
    expect(response.statusCode).toBe(200);
    const { dualControlRequestId } = response.json<{
      dualControlRequestId: string;
    }>();
    pending.push({ id: dualControlRequestId, by });
    return dualControlRequestId;
  }

  it("shows an admin the badge, the reason and the message before he confirms, and shows an agent nothing", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const id = await asked(brand, agent, {
      reasonCode: "terms_breach",
      memberMessage: MESSAGE,
    });
    const view = await call(
      server,
      "GET",
      `/v1/bo/dual-control/${id}`,
      adminA.session,
    );
    expect(view.statusCode).toBe(200);
    const body = view.json<ViewBody>();
    expect(body).toMatchObject({
      id,
      action: {
        code: "verification.revoke_badge",
        accountId: brand.accountId,
        badgeId: brand.badgeId,
        reasonCode: "terms_breach",
      },
      target: {
        kind: "badge",
        level: "brand_verified",
        cascadeCount: 0,
        memberMessage: MESSAGE,
      },
      recap: {
        scope: { kind: "badge", count: 1 },
        reversible: false,
      },
      state: "pending",
      next: { kind: "confirm_as_peer" },
    });
    expect(body.recap.consequences).toEqual([
      "badge_withdrawn",
      "public_row_recomputed",
      "member_notified",
    ]);
    // an agent never reaches the dual control (CA63), whoever asked
    const refused = await call(
      server,
      "GET",
      `/v1/bo/dual-control/${id}`,
      agent.session,
    );
    expect(refused.statusCode).toBe(403);
  });

  it("is never requested through the generic request of a 2V (the database refuses that door)", async () => {
    const brand = await newBrandWithBadge(null);
    const response = await call(
      app(),
      "POST",
      "/v1/bo/dual-control",
      adminA.session,
      {
        code: "verification.revoke_badge",
        accountId: brand.accountId,
        badgeId: brand.badgeId,
        reasonCode: "forged_evidence",
      },
    );
    expect(response.statusCode).toBe(400);
    const after = await call(app(), "GET", badgesUrl(brand), adminA.session);
    expect(after.json<BadgesBody>().badges[0]?.state).toBe("active");
  });

  it("withdraws nothing for an agent, nor for the admin who asked while another admin exists, and withdraws once for a distinct admin", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const id = await asked(brand, adminA, { reasonCode: "forged_evidence" });
    const confirm = (who: Internal) =>
      call(
        server,
        "POST",
        `/v1/bo/dual-control/${id}/confirm`,
        who.session,
        {},
      );
    const stillActive = async () =>
      (
        await call(server, "GET", badgesUrl(brand), adminB.session)
      ).json<BadgesBody>().badges[0];

    // an agent: refused, journaled as an admin-only act
    expect((await confirm(agent)).statusCode).toBe(403);
    expect((await stillActive())?.state).toBe("active");
    // the requester alone, a peer admin existing (PD7): refused, nothing withdrawn
    expect((await confirm(adminA)).statusCode).toBe(403);
    expect((await stillActive())?.state).toBe("active");

    // a distinct admin: withdrawn, as a peer
    const done = await confirm(adminB);
    expect(done.statusCode).toBe(200);
    expect(done.json<{ mode: string }>().mode).toBe("peer");
    expect(await stillActive()).toMatchObject({
      state: "revoked",
      revocationReasonCode: "forged_evidence",
      pendingRevocation: null,
    });
    // the e-mail of the withdrawal is queued once, ids only (08 RG94)
    const queued = await sharedMigrationRole()<{ n: number }[]>`
      select count(*)::int as n from leads.outbox_events
       where event_type = 'verification.revoked_notice'
         and idempotency_key = ${`verification.revoked_notice:${brand.badgeId}`}`;
    expect(queued[0]?.n).toBe(1);

    // consumed once: a second confirmation is a conflict, the view says it was executed
    const second = await confirm(adminB);
    expect(second.statusCode).toBe(409);
    const view = await call(
      server,
      "GET",
      `/v1/bo/dual-control/${id}`,
      adminB.session,
    );
    expect(view.json<ViewBody & { executed: boolean }>()).toMatchObject({
      state: "confirmed",
      executed: true,
      next: { kind: "none" },
    });
  });

  it("refuses the confirmation of an admin who holds the account, with the trace of the attempt", async () => {
    const server = app();
    const brand = await newBrandWithBadge(adminB.accountId);
    const id = await asked(brand, agent, { reasonCode: "influx_error" });
    const held = await call(
      server,
      "POST",
      `/v1/bo/dual-control/${id}/confirm`,
      adminB.session,
      {},
    );
    expect(held.statusCode).toBe(403);
    expect(issuesOf(held)).toEqual([
      { path: "entry", issue: "conflict_of_interest" },
    ]);
    const block = await call(server, "GET", badgesUrl(brand), adminA.session);
    expect(block.json<BadgesBody>().badges[0]?.state).toBe("active");
    // another administrator confirms it
    const done = await call(
      server,
      "POST",
      `/v1/bo/dual-control/${id}/confirm`,
      adminA.session,
      {},
    );
    expect(done.statusCode).toBe(200);
  });

  it("says a badge that no longer holds is a 409 on `badge`, the request left as it was", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const id = await asked(brand, agent, { reasonCode: "influx_error" });
    // the badge ended since the request (as the task of the cycle would end it)
    await sharedMigrationRole()`
      update verification.badges set state = 'expired' where id = ${brand.badgeId}`;
    const stale = await call(
      server,
      "POST",
      `/v1/bo/dual-control/${id}/confirm`,
      adminB.session,
      {},
    );
    expect(stale.statusCode).toBe(409);
    expect(issuesOf(stale)).toEqual([
      { path: "badge", issue: "badge_not_holding" },
    ]);
    const view = await call(
      server,
      "GET",
      `/v1/bo/dual-control/${id}`,
      adminB.session,
    );
    expect(view.json<ViewBody>().state).toBe("pending");
  });
});

describe("L2F-B4 the unknown answer alike (T14.3, T14.4)", () => {
  it("answers the same 404 for an unknown account, an internal one, the caller's own and a badge of another account", async () => {
    const server = app();
    const brand = await newBrandWithBadge(null);
    const other = await newBrandWithBadge(null);
    const unknown = await call(
      server,
      "GET",
      `/v1/bo/accounts/${randomUUID()}/badges`,
      agent.session,
    );
    expect(unknown.statusCode).toBe(404);
    for (const id of [adminA.accountId, agent.accountId, NIL]) {
      const response = await call(
        server,
        "GET",
        `/v1/bo/accounts/${id}/badges`,
        agent.session,
      );
      expect(response.statusCode).toBe(404);
      expect(errorCode(response)).toBe(errorCode(unknown));
    }
    const body = { reasonCode: "forged_evidence" };
    const noBadge = await call(
      server,
      "POST",
      revocationUrl(brand, randomUUID()),
      agent.session,
      body,
    );
    expect(noBadge.statusCode).toBe(404);
    // the badge exists, but is another account's
    const foreign = await call(
      server,
      "POST",
      revocationUrl(brand, other.badgeId),
      agent.session,
      body,
    );
    expect(foreign.statusCode).toBe(404);
    expect(errorCode(foreign)).toBe(errorCode(noBadge));
    expect(foreign.json()).toEqual({
      error: expect.objectContaining({ code: errorCode(noBadge) }),
    });
  });
});
