// L2E commit 08 — the claims and decisions of queue 4, 0224 (jalons/l2e/08.md; l2e/modele.md §4
// "Agent", "Erreurs", "Registre", "Outbox"; fiche invariants 2, 5, 6, 9 to 11, 17): L2E-D13 the double
// claim, L2E-D14 no decision without the live claim, L2E-D15 the stale token, L2E-D16 an account
// held by the agent, L2E-D17 `minor`, L2E-D18 two accounts on one handle; 08 CA13, CA27, CA29 to
// CA33, cas limite 2; the journalled read of an evidence (invariant 2); the brand grant (06 RG51,
// RG52); the forced release and the registry sources of an administrator. Each case runs in a
// rolled-back transaction of the local superuser, the functions called as apps/api calls them.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const LOCK_NOT_AVAILABLE = "55P03";
const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
};
/** A bound value; an absent one is sent as NULL. */
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as { code?: string; message?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      message: found.message ?? "",
      detail: found.detail,
    };
  }
}

async function rows<T>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<T[]> {
  const found = await run<T>(tx, statement, parameters);
  if (found.outcome === "error") {
    throw new Error(`${found.code} ${found.message} (${found.detail ?? ""})`);
  }
  return found.rows;
}

function refused(code: string, message: string, detail?: string): unknown {
  return detail === undefined
    ? expect.objectContaining({ outcome: "error", code, message })
    : { outcome: "error", code, message, detail };
}

function asInternal<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  role: "agent" | "admin" = "agent",
): Promise<T> {
  return actAsInternal(
    tx,
    role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: account, role, aal: "aal2" },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

const OPEN = "select * from verification.open_request($1::uuid)";
const RELEASE = "select verification.release_request($1::uuid) as done";
const EXTEND = "select verification.extend_request_claim($1::uuid) as expires";
const FORCE =
  "select verification.force_release_request_claim($1::uuid, $2::text) as holder";
const DOSSIER = "select * from verification.read_request_dossier($1::uuid)";
const COMPARE =
  "select * from verification.compare_request_figures($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer)";
const READ_EVIDENCE =
  "select verification.read_evidence($1::uuid) as object_key";
const REEXAMINE =
  "select verification.reexamine_request($1::uuid, $2::text, $3::text) as at";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const GRANT_BRAND =
  "select * from verification.grant_brand_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::uuid, $7::text)";
const REJECT =
  "select * from verification.reject_request($1::uuid, $2::text, $3::text, $4::text, $5::text)";
const SET_SOURCE =
  "select verification.set_registry_source($1::uuid, $2::text, $3::text, $4::date, $5::boolean) as at";

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  review_token: string | null;
};
type Granted = {
  outcome: string;
  badge_id: string | null;
  sla_breached: boolean;
};

/** A code of the shape of 08 RG21 (the generator is the doors' own). */
function freshCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = Buffer.from(randomUUID().replace(/-/g, ""), "hex");
  let signs = "";
  for (let index = 0; index < 8; index += 1) {
    signs += alphabet[(bytes[index] ?? 0) % alphabet.length];
  }
  return `INFLUX-${signs}`;
}

/** The UTC date `days` days from today, as the agent types it. */
function day(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** A pending creator request (superuser, as the doors of 0222 would leave it), with its code. */
async function pendingCreatorRequest(
  tx: Tx,
  account: string,
  line: string,
  network: string,
  level: "account_verified" | "audience_verified",
): Promise<{ request: string; code: string }> {
  const code = freshCode();
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${account}, ${line}, ${network}, ${level}::verification.badge_level, 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${account}, 'network', ${code}, now() + interval '7 days')`;
  }
  return { request: row.id, code };
}

/** A pending brand request of brand A on its domain, with its domain code. */
async function pendingBrandRequest(
  tx: Tx,
): Promise<{ request: string; code: string }> {
  await tx`
    update profiles.advertiser_profiles set website_domain = 't2-brand-a.example'
     where account_id = ${brandA}`;
  const code = freshCode();
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests (account_id, level, status)
    values (${brandA}, 'brand_verified', 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  await tx`
    insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
    values (${row.id}, ${brandA}, 'domain', ${code}, now() + interval '7 days')`;
  return { request: row.id, code };
}

/** An active evidence row of `request` (superuser: the deposit doors are tested by 0223). */
async function activeEvidence(
  tx: Tx,
  request: string,
  account: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${request}, ${account}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')
    returning id::text as id`;
  if (row === undefined) throw new Error("no evidence");
  return row.id;
}

/** Agent A opens `request` and returns its review token. */
async function claim(
  tx: Tx,
  request: string,
  account: string = agentA,
): Promise<string> {
  const [opened] = await asInternal(tx, account, () =>
    rows<Opened>(tx, OPEN, [request]),
  );
  if (opened?.review_token == null)
    throw new Error(`not claimed: ${opened?.outcome}`);
  return opened.review_token;
}

/** Creator A holds « Compte vérifié » on line A, granted through the functions by agent A. */
async function accountVerifiedA(
  tx: Tx,
  handle = "t2_creator_a",
): Promise<string> {
  const { request, code } = await pendingCreatorRequest(
    tx,
    creatorA,
    lineA,
    "instagram",
    "account_verified",
  );
  const token = await claim(tx, request);
  await asInternal(tx, agentA, () =>
    rows(tx, GRANT_ACCOUNT, [request, token, code, handle, null, null]),
  );
  return request;
}

type AuditLine = {
  event_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

async function auditOf(tx: Tx, subject: string): Promise<AuditLine[]> {
  return tx<AuditLine[]>`
    select event_type, actor_account_id::text as actor_account_id, payload
      from audit.audit_events where subject_id = ${subject} order by seq`;
}

async function requestOf(tx: Tx, request: string) {
  const [row] = await tx<
    {
      status: string;
      decided_by: string | null;
      decided: boolean;
      closed: boolean;
      reason: string | null;
      claimed_by: string | null;
      escalated: boolean;
      reexamine: string | null;
      sla_due_at: Date | null;
      member_message: string | null;
    }[]
  >`
    select status::text as status, decided_by_account_id::text as decided_by,
           decided_at is not null as decided, closed_at is not null as closed,
           rejection_reason_code as reason, claimed_by_account_id::text as claimed_by,
           escalated_at is not null as escalated, reexamine_reason_code as reexamine, sla_due_at,
           member_message
      from verification.verification_requests where id = ${request}`;
  if (row === undefined) throw new Error("no request");
  return row;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// The claim: L2E-D13, L2E-D14, L2E-D16 (08 RG43, RG53, RG64; CA31)
// ---------------------------------------------------------------------------------------------

describe("L2E-D13, L2E-D14: the claim is atomic, and no decision without it (RG64)", () => {
  it("L2E-D13: a second agent reads « En cours », gets no token and cannot decide", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const first = await asInternal(tx, agentA, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const again = await asInternal(tx, agentA, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const second = await asInternal(tx, agentB, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const decided = await asInternal(tx, agentB, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          first[0]?.review_token,
          code,
          "t2_creator_a",
          null,
          null,
        ]),
      );
      const opened = await auditOf(tx, request);
      return { first, again, second, decided, opened };
    });
    expect(found.first[0]).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentA,
    });
    expect(found.first[0]?.review_token).toMatch(/^[0-9a-f]{64}$/);
    expect(found.again[0]).toMatchObject({
      outcome: "held",
      holder_account_id: agentA,
    });
    expect(found.second[0]).toMatchObject({
      outcome: "read_only",
      holder_account_id: agentA,
      review_token: null,
    });
    expect(found.decided).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentA),
    );
    expect(
      found.opened
        .filter((line) => line.event_type === "queue.entry_opened")
        .map((line) => [
          line.actor_account_id,
          line.payload.outcome,
          line.payload.queue_code,
        ]),
    ).toEqual([
      [agentA, "claimed", "verification"],
      [agentA, "held", "verification"],
      [agentB, "read_only", "verification"],
    ]);
  });

  it("L2E-D14: without a claim, after a release, past its expiry: 55P03; an expired claim is taken over and journalled", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const grant = (token: string | null | undefined, account = agentA) =>
        asInternal(tx, account, () =>
          run(tx, GRANT_ACCOUNT, [
            request,
            token,
            code,
            "t2_creator_a",
            null,
            null,
          ]),
        );
      const unclaimed = await grant("0".repeat(64));
      const token = await claim(tx, request);
      const extended = await asInternal(tx, agentA, () =>
        rows<{ expires: Date }>(tx, EXTEND, [request]),
      );
      await asInternal(tx, agentA, () => rows(tx, RELEASE, [request]));
      const released = await grant(token);
      const releasedTwice = await asInternal(tx, agentA, () =>
        run(tx, RELEASE, [request]),
      );
      const token2 = await claim(tx, request);
      await tx`
        update verification.verification_requests
           set claimed_at = now() - interval '2 hours', claim_expires_at = now() - interval '1 hour'
         where id = ${request}`;
      const expired = await grant(token2);
      const dossier = await asInternal(tx, agentA, () =>
        run(tx, DOSSIER, [request]),
      );
      const takenOver = await asInternal(tx, agentB, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const lines = await auditOf(tx, request);
      const state = await requestOf(tx, request);
      return {
        unclaimed,
        extended,
        released,
        releasedTwice,
        expired,
        dossier,
        takenOver,
        lines,
        state,
      };
    });
    expect(found.unclaimed).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.extended).toHaveLength(1);
    expect(found.released).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.releasedTwice).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.expired).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.dossier).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.takenOver[0]).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentB,
    });
    expect(found.lines.map((line) => line.event_type)).toEqual([
      "queue.entry_opened",
      "queue.claim_extended",
      "queue.claim_released",
      "queue.entry_opened",
      "queue.claim_expired",
      "queue.entry_opened",
    ]);
    expect(found.lines[4]?.payload).toMatchObject({
      queue_code: "verification",
      holder_account_id: agentA,
    });
    expect(found.state).toMatchObject({
      status: "pending",
      decided: false,
      claimed_by: agentB,
    });
  });

  it("L2E-D16, CA31: an account the agent holds, or his own, is refused 42501, the refusal journalled by its door", async () => {
    const found = await scenario(async (tx) => {
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${creatorA}`;
      const held = await asInternal(tx, agentA, () => run(tx, OPEN, [request]));
      const other = await asInternal(tx, agentB, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const journalled = await asInternal(tx, agentA, () =>
        run(
          tx,
          "select backoffice.record_refused_action('queue.conflict_of_interest')",
        ),
      );
      const [refusal] = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'backoffice.action_refused' and actor_account_id = ${agentA}
         order by seq desc limit 1`;
      // a brand request on the agent's own account (C(3)): unknown to him
      const [own] = await tx<{ id: string }[]>`
        insert into verification.verification_requests (account_id, level, status)
        values (${agentA}, 'brand_verified', 'pending') returning id::text as id`;
      const ownOpen = await asInternal(tx, agentA, () =>
        run(tx, OPEN, [own?.id]),
      );
      const draft = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level)
        values (${creatorB}, ${CREATOR_SOCIAL_ACCOUNT_IDS.b}, 'tiktok', 'account_verified')
        returning id::text as id`;
      const draftOpen = await asInternal(tx, agentA, () =>
        run(tx, OPEN, [draft[0]?.id]),
      );
      const unknown = await asInternal(tx, agentA, () =>
        run(tx, OPEN, [randomUUID()]),
      );
      const aal1 = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal1" },
        () => run(tx, OPEN, [request]),
      );
      return {
        held,
        other,
        journalled,
        refusal,
        ownOpen,
        draftOpen,
        unknown,
        aal1,
      };
    });
    expect(found.held).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.other[0]).toMatchObject({
      outcome: "claimed",
      holder_account_id: agentB,
    });
    expect(found.journalled).toMatchObject({ outcome: "rows" });
    expect(found.refusal?.payload).toMatchObject({
      action_code: "queue.conflict_of_interest",
      reason: "conflict_of_interest",
    });
    expect(found.ownOpen).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.draftOpen).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(found.unknown).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.aal1).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
  });

  it("15 C4: an administrator lifts a live claim with a typed reason; an agent may not", async () => {
    const found = await scenario(async (tx) => {
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      await claim(tx, request);
      const byAgent = await asInternal(tx, agentB, () =>
        run(tx, FORCE, [request, "holder_absent"]),
      );
      const noReason = await asInternal(
        tx,
        adminA,
        () => run(tx, FORCE, [request, "bored"]),
        "admin",
      );
      const lifted = await asInternal(
        tx,
        adminA,
        () => rows<{ holder: string }>(tx, FORCE, [request, "holder_absent"]),
        "admin",
      );
      const [forced] = await tx<
        { by: string; holder: string; reason: string }[]
      >`
        select forced_release_by_account_id::text as by,
               forced_release_holder_account_id::text as holder,
               forced_release_reason_code as reason
          from verification.verification_requests where id = ${request}`;
      const lines = await auditOf(tx, request);
      return { byAgent, noReason, lifted, forced, lines };
    });
    expect(found.byAgent).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.noReason).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(found.lifted[0]?.holder).toBe(agentA);
    expect(found.forced).toEqual({
      by: adminA,
      holder: agentA,
      reason: "holder_absent",
    });
    expect(found.lines.at(-1)).toMatchObject({
      event_type: "queue.claim_forced_release",
      actor_account_id: adminA,
      payload: {
        queue_code: "verification",
        holder_account_id: agentA,
        reason_code: "holder_absent",
      },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// « Compte vérifié »: CA13, CA30, L2E-D15, L2E-D18
// ---------------------------------------------------------------------------------------------

describe("CA13, CA30: the agent reads the code on line and types the handle; the decision is his", () => {
  it("grants with the finding on the code, a badge without expiry, the e-mail and the attribute queued, ids only", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const token = await claim(tx, request);
      const dossier = await asInternal(tx, agentA, () =>
        rows<Record<string, unknown>>(tx, DOSSIER, [request]),
      );
      const mismatch = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          "INFLUX-AAAAAAAA",
          "t2_creator_a",
          null,
          null,
        ]),
      );
      const blank = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [request, token, code, "   ", null, null]),
      );
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_ACCOUNT, [
          request,
          token,
          ` ${code.toLowerCase()} `,
          " t2_creator_a ",
          "17841400000000001",
          "seen in the bio",
        ]),
      );
      const [finding] = await tx<
        { by: string; handle: string; ref: string; observed: boolean }[]
      >`
        select observed_by_account_id::text as by, observed_handle as handle,
               observed_platform_account_ref as ref, observed_at is not null as observed
          from verification.ownership_codes where request_id = ${request}`;
      const [badge] = await tx<
        {
          level: string;
          state: string;
          granted_by: string;
          source: string;
          expires: Date | null;
          handle: string;
        }[]
      >`
        select level::text as level, state::text as state,
               granted_by_account_id::text as granted_by, evidence_source as source,
               expires_at as expires, observed_handle_at_decision as handle
          from verification.badges where request_id = ${request}`;
      const outbox = await tx<
        {
          event_type: string;
          destination: string;
          key: string;
          payload: Record<string, unknown>;
        }[]
      >`
        select event_type, destination::text as destination, idempotency_key as key, payload
          from leads.outbox_events
         where payload ->> 'account_id' = ${creatorA} and created_at = now()
           and event_type in ('verification.decision', 'lead.updated')
         order by id`;
      const lines = await auditOf(tx, request);
      const state = await requestOf(tx, request);
      const decidedAgain = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "t2_creator_a",
          null,
          null,
        ]),
      );
      return {
        dossier,
        mismatch,
        blank,
        granted,
        finding,
        badge,
        outbox,
        lines,
        state,
        decidedAgain,
      };
    });
    // EC-L2E-08-3, -19: the dossier shows the line, never the code nor a declared figure
    const dossier = found.dossier[0] ?? {};
    expect(dossier).toMatchObject({
      handle: "t2_creator_a",
      level: "account_verified",
    });
    expect(Object.keys(dossier)).not.toContain("code");
    expect(
      Object.keys(dossier).filter((key) =>
        /followers|comments|posts/.test(key),
      ),
    ).toEqual([]);
    expect(found.mismatch).toEqual(
      refused(INVALID_PARAMETER, "code_mismatch", "code_mismatch"),
    );
    expect(found.blank).toEqual(
      refused(INVALID_PARAMETER, "observed_handle", "observed_handle"),
    );
    expect(found.granted[0]).toMatchObject({
      outcome: "granted",
      sla_breached: false,
    });
    expect(found.finding).toEqual({
      by: agentA,
      handle: "t2_creator_a",
      ref: "17841400000000001",
      observed: true,
    });
    expect(found.badge).toEqual({
      level: "account_verified",
      state: "active",
      granted_by: agentA,
      source: "public_profile",
      expires: null,
      handle: "t2_creator_a",
    });
    expect(found.state).toMatchObject({
      status: "approved",
      decided_by: agentA,
      closed: true,
    });
    // modele "Outbox": one decision per request, the Brevo attribute, never Apollo, ids only
    expect(
      found.outbox.map((line) => [
        line.event_type,
        line.destination,
        Object.keys(line.payload).sort(),
      ]),
    ).toEqual([
      [
        "verification.decision",
        "brevo_transactional",
        // EC-L2E-16-1 (0227): the e-mail code is a constant of the line, not a datum
        ["account_id", "email_code", "event_id", "request_id"],
      ],
      ["lead.updated", "brevo_contact", ["account_id", "event_id"]],
    ]);
    expect(found.outbox[0]?.key).toBe(
      `verification.decision:${String(found.outbox[0]?.payload.request_id)}`,
    );
    expect(JSON.stringify(found.outbox)).not.toContain("t2_creator_a");
    // CA30: the decision carries its agent; no handle nor comment in the register
    const granted = found.lines.find(
      (line) => line.event_type === "verification.granted",
    );
    expect(granted).toMatchObject({
      actor_account_id: agentA,
      payload: { level: "account_verified", late: false },
    });
    expect(JSON.stringify(found.lines)).not.toMatch(
      /t2_creator_a|seen in the bio|INFLUX-/,
    );
    expect(found.decidedAgain).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "entry_closed", "entry_closed"),
    );
  });

  it("L2E-D15: a line changed after the opening makes the token stale; the reopening gives the new one", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const token = await claim(tx, request);
      await tx`update profiles.creator_social_accounts set handle = 't2_creator_a_new' where id = ${lineA}`;
      const stale = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "t2_creator_a_new",
          null,
          null,
        ]),
      );
      const missing = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          null,
          code,
          "t2_creator_a_new",
          null,
          null,
        ]),
      );
      const reopened = await asInternal(tx, agentA, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_ACCOUNT, [
          request,
          reopened[0]?.review_token,
          code,
          "t2_creator_a_new",
          null,
          null,
        ]),
      );
      return { token, stale, missing, reopened, granted };
    });
    expect(found.stale).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
    expect(found.missing).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
    expect(found.reopened[0]?.outcome).toBe("held");
    expect(found.reopened[0]?.review_token).not.toBe(found.token);
    expect(found.granted[0]?.outcome).toBe("granted");
  });

  it("L2E-D18: two accounts on one handle: the first finding wins, the second is refused, both escalated", async () => {
    const found = await scenario(async (tx) => {
      // L2ES-2 (0228): a grant reads the handle its line declares. Line A declared the shared handle
      // when it was verified, then changed it (the case of queue 6, L2F commit 08): the badge keeps
      // the handle observed, and no other account declares it any more
      await tx`update profiles.creator_social_accounts set handle = 'Shared.Handle' where id = ${lineA}`;
      const first = await accountVerifiedA(tx, "Shared.Handle");
      await tx`update profiles.creator_social_accounts set handle = 't2_creator_a' where id = ${lineA}`;
      const [line] = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts (account_id, network_code, handle)
        values (${creatorB}, 'instagram', 'shared.handle') returning id::text as id`;
      if (line === undefined) throw new Error("no line");
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorB,
        line.id,
        "instagram",
        "account_verified",
      );
      const token = await claim(tx, request);
      const dossier = await asInternal(tx, agentA, () =>
        rows<{
          same_handle_accounts: number;
          handle_verified_elsewhere: boolean;
        }>(tx, DOSSIER, [request]),
      );
      const second = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "@shared.handle",
          null,
          null,
        ]),
      );
      const badges = await tx<{ n: number }[]>`
        select count(*)::int as n from verification.badges where request_id = ${request}`;
      return {
        dossier,
        second,
        badges,
        loser: await requestOf(tx, request),
        winner: await requestOf(tx, first),
        loserLines: await auditOf(tx, request),
        winnerLines: await auditOf(tx, first),
      };
    });
    expect(found.dossier[0]).toMatchObject({
      same_handle_accounts: 0,
      handle_verified_elsewhere: true,
    });
    expect(found.second[0]).toMatchObject({
      outcome: "handle_already_verified",
      badge_id: null,
    });
    expect(found.badges[0]?.n).toBe(0);
    expect(found.loser).toMatchObject({
      status: "rejected",
      reason: "ownership_not_proven",
      decided_by: agentA,
      escalated: true,
    });
    expect(found.winner).toMatchObject({ status: "approved", escalated: true });
    expect(found.loserLines.map((line) => line.event_type).slice(-2)).toEqual([
      "verification.rejected",
      "verification.escalated",
    ]);
    expect(found.winnerLines.at(-1)).toMatchObject({
      event_type: "verification.escalated",
      payload: { cause: "handle_already_verified" },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D19 (L2ES-2, 0228; l2f fiche invariant 7): every grant compares the handle read with the
// handle declared on the line, after one normalisation (edge spaces, leading `@`, case)
// ---------------------------------------------------------------------------------------------

describe("L2F-D19: the handle read is the handle declared on the line (L2ES-2)", () => {
  it("« Compte vérifié »: case and `@` admitted, another handle or none refused, nothing written; the same call with the declared handle is granted", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const token = await claim(tx, request);
      const other = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "t2_creator_b",
          null,
          null,
        ]),
      );
      const near = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "t2_creator_a_",
          null,
          null,
        ]),
      );
      const [finding] = await tx<
        { observed: boolean; handle: string | null }[]
      >`
        select observed_at is not null as observed, observed_handle as handle
          from verification.ownership_codes where request_id = ${request}`;
      const [counted] = await tx<{ badges: number }[]>`
        select count(*)::int as badges from verification.badges where request_id = ${request}`;
      const pending = await requestOf(tx, request);
      const linesBefore = await auditOf(tx, request);
      // the control: same request, token and code; only the handle differs (case, `@`, spaces)
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          " @T2_Creator_A ",
          null,
          null,
        ]),
      );
      const [badge] = await tx<{ handle: string }[]>`
        select observed_handle_at_decision as handle
          from verification.badges where request_id = ${request}`;

      // a line without a handle is never granted, whatever is typed
      const line = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts (account_id, network_code)
        values (${creatorB}, 'tiktok') returning id::text as id`;
      const bare = await pendingCreatorRequest(
        tx,
        creatorB,
        line[0]?.id ?? "",
        "tiktok",
        "account_verified",
      );
      const bareToken = await claim(tx, bare.request);
      const noHandle = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          bare.request,
          bareToken,
          bare.code,
          "anyone",
          null,
          null,
        ]),
      );
      return {
        other,
        near,
        finding,
        counted,
        pending,
        linesBefore,
        granted,
        badge,
        noHandle,
        bareState: await requestOf(tx, bare.request),
      };
    });
    const mismatch = refused(
      INVALID_PARAMETER,
      "observed_handle_mismatch",
      "observed_handle_mismatch",
    );
    expect(found.other).toEqual(mismatch);
    expect(found.near).toEqual(mismatch);
    expect(found.noHandle).toEqual(mismatch);
    // nothing written by a refused grant: no finding on the code, no badge, the request pending
    expect(found.finding).toEqual({ observed: false, handle: null });
    expect(found.counted?.badges).toBe(0);
    expect(found.pending).toMatchObject({ status: "pending", decided: false });
    expect(found.bareState).toMatchObject({
      status: "pending",
      decided: false,
    });
    expect(
      found.linesBefore.filter((line) =>
        /verification\.(granted|rejected)/.test(line.event_type),
      ),
    ).toEqual([]);
    // the control is green: the refusal was the handle and nothing else
    expect(found.granted[0]?.outcome).toBe("granted");
    expect(found.badge?.handle).toBe("@T2_Creator_A");
  });

  it("« Audience vérifiée »: the handle read again is compared the same way; the control with the declared handle is granted", async () => {
    const found = await scenario(async (tx) => {
      await accountVerifiedA(tx);
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      await activeEvidence(tx, request, creatorA);
      const token = await claim(tx, request);
      const typed = (handle: string) => [
        request,
        token,
        38_000,
        12,
        40,
        null,
        day(-20),
        day(-1),
        handle,
        null,
      ];
      const other = await asInternal(tx, agentA, () =>
        run(tx, GRANT_AUDIENCE, typed("someone_else")),
      );
      const [counted] = await tx<{ badges: number }[]>`
        select count(*)::int as badges from verification.badges where request_id = ${request}`;
      const pending = await requestOf(tx, request);
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_AUDIENCE, typed("@T2_CREATOR_A")),
      );
      return { other, counted, pending, granted };
    });
    expect(found.other).toEqual(
      refused(
        INVALID_PARAMETER,
        "observed_handle_mismatch",
        "observed_handle_mismatch",
      ),
    );
    expect(found.counted?.badges).toBe(0);
    expect(found.pending).toMatchObject({ status: "pending", decided: false });
    expect(found.granted[0]?.outcome).toBe("granted");
  });
});

// ---------------------------------------------------------------------------------------------
// « Audience vérifiée »: CA27, cas limite 2, RG12, -13, RG40 to RG42, the journalled read
// ---------------------------------------------------------------------------------------------

describe("CA27, cas limite 2: the agent types the figures and the period; the server holds the bounds", () => {
  it("refuses a missing, reversed, future or stale period and an impossible figure; requires the ownership and an evidence", async () => {
    const found = await scenario(async (tx) => {
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      const token = await claim(tx, request);
      const grant = (values: Parameter[]) =>
        asInternal(tx, agentA, () =>
          run(tx, GRANT_AUDIENCE, [request, token, ...values]),
        );
      const ok = [38_000, 12, 40, 350, day(-20), day(-1), "t2_creator_a", null];
      const withValue = (index: number, value: Parameter) =>
        ok.map((entry, position) => (position === index ? value : entry));
      const withPeriod = (start: string, end: string) =>
        ok.map((entry, position) =>
          position === 4 ? start : position === 5 ? end : entry,
        );
      return {
        noPeriod: await grant(withValue(5, null)),
        reversed: await grant(withPeriod(day(-1), day(-5))),
        future: await grant(withValue(5, day(1))),
        // CA18: a period ending 45 days ago; RG36: exactly 30 days is no longer « moins de 30 »
        stale: await grant(withPeriod(day(-60), day(-45))),
        edge: await grant(withPeriod(day(-60), day(-30))),
        negative: await grant(withValue(0, -1)),
        noComments: await grant(withValue(2, null)),
        engagement: await grant(withValue(3, 35_000)),
        prerequisite: await grant(ok),
      };
    });
    expect(found.noPeriod).toEqual(
      refused(INVALID_PARAMETER, "period_invalid", "period_missing"),
    );
    expect(found.reversed).toEqual(
      refused(INVALID_PARAMETER, "period_invalid", "period_order"),
    );
    expect(found.future).toEqual(
      refused(INVALID_PARAMETER, "period_invalid", "period_future"),
    );
    expect(found.stale).toEqual(
      refused(INVALID_PARAMETER, "period_invalid", "period_too_old"),
    );
    expect(found.edge).toEqual(
      refused(INVALID_PARAMETER, "period_invalid", "period_too_old"),
    );
    expect(found.negative).toEqual(
      refused(INVALID_PARAMETER, "figures_invalid", "followers"),
    );
    expect(found.noComments).toEqual(
      refused(INVALID_PARAMETER, "figures_invalid", "avg_comments"),
    );
    expect(found.engagement).toEqual(
      refused(INVALID_PARAMETER, "figures_invalid", "engagement_bp"),
    );
    expect(found.prerequisite).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "ownership_prerequisite",
        "ownership_prerequisite",
      ),
    );
  });

  it("grants with the typed figures beside the declared ones (CA26), 90 days, the evidence kept 45 days after the decision", async () => {
    const found = await scenario(async (tx) => {
      await accountVerifiedA(tx);
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      const token = await claim(tx, request);
      const noEvidence = await asInternal(tx, agentA, () =>
        run(tx, GRANT_AUDIENCE, [
          request,
          token,
          38_000,
          12,
          40,
          null,
          day(-20),
          day(-1),
          "t2_creator_a",
          null,
        ]),
      );
      const evidence = await activeEvidence(tx, request, creatorA);
      const staleAfterDeposit = await asInternal(tx, agentA, () =>
        run(tx, GRANT_AUDIENCE, [
          request,
          token,
          38_000,
          12,
          40,
          null,
          day(-20),
          day(-1),
          "t2_creator_a",
          null,
        ]),
      );
      const reopened = await asInternal(tx, agentA, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const fresh = reopened[0]?.review_token;
      // RG48, -19: the declared figures come back after the typing only
      const compared = await asInternal(tx, agentA, () =>
        rows<Record<string, number | null>>(tx, COMPARE, [
          request,
          fresh,
          38_000,
          12,
          40,
          null,
        ]),
      );
      const compareBad = await asInternal(tx, agentA, () =>
        run(tx, COMPARE, [request, fresh, -3, 12, 40, null]),
      );
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_AUDIENCE, [
          request,
          fresh,
          38_000,
          12,
          40,
          null,
          day(-20),
          day(-1),
          "t2_creator_a",
          null,
        ]),
      );
      const [badge] = await tx<
        {
          followers: string;
          posts: number;
          comments: string;
          engagement: number | null;
          declared_followers: string;
          declared_posts: number;
          declared_comments: string;
          days: number;
          source: string;
        }[]
      >`
        select observed_followers::text as followers, observed_posts_last_30_days as posts,
               observed_avg_comments::text as comments, observed_engagement_bp as engagement,
               declared_followers_at_decision::text as declared_followers,
               declared_posts_at_decision as declared_posts,
               declared_comments_at_decision::text as declared_comments,
               extract(day from expires_at - granted_at)::int as days, evidence_source as source
          from verification.badges where request_id = ${request}`;
      const [kept] = await tx<{ days: number; state: string }[]>`
        select extract(day from e.retention_due_at - r.decided_at)::int as days, e.state::text as state
          from verification.evidence_files e
          join verification.verification_requests r on r.id = e.request_id
         where e.id = ${evidence}`;
      const [line] = await tx<{ followers: string; source: string }[]>`
        select followers_count::text as followers, figures_source as source
          from profiles.creator_social_accounts where id = ${lineA}`;
      return {
        noEvidence,
        staleAfterDeposit,
        compared,
        compareBad,
        granted,
        badge,
        kept,
        line,
      };
    });
    expect(found.noEvidence).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "missing_evidence",
        "missing_evidence",
      ),
    );
    expect(found.staleAfterDeposit).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
    );
    expect(found.compared[0]).toEqual({
      declared_followers: "47312",
      declared_posts_last_30_days: 14,
      declared_avg_comments: "35",
      declared_engagement_bp: null,
      gap_alert_percent: 30,
    });
    expect(found.compareBad).toEqual(
      refused(INVALID_PARAMETER, "figures_invalid", "followers"),
    );
    expect(found.granted[0]?.outcome).toBe("granted");
    expect(found.badge).toEqual({
      followers: "38000",
      posts: 12,
      comments: "40",
      engagement: null,
      declared_followers: "47312",
      declared_posts: 14,
      declared_comments: "35",
      days: 90,
      source: "native_dashboard",
    });
    expect(found.kept).toEqual({ days: 45, state: "active" });
    // RG40: the declared value is never overwritten (the public bands come with 0225)
    expect(found.line).toEqual({ followers: "47312", source: "declared" });
  });

  it("invariant 2, T9.7: the key of an active evidence, to the holder only, each opening journalled", async () => {
    const found = await scenario(async (tx) => {
      await accountVerifiedA(tx);
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      const evidence = await activeEvidence(tx, request, creatorA);
      const unclaimed = await asInternal(tx, agentA, () =>
        run(tx, READ_EVIDENCE, [evidence]),
      );
      await claim(tx, request);
      const other = await asInternal(tx, agentB, () =>
        run(tx, READ_EVIDENCE, [evidence]),
      );
      const read = await asInternal(tx, agentA, () =>
        rows<{ object_key: string }>(tx, READ_EVIDENCE, [evidence]),
      );
      const unknown = await asInternal(tx, agentA, () =>
        run(tx, READ_EVIDENCE, [randomUUID()]),
      );
      await tx`
        update verification.evidence_files set state = 'purging', purge_requested_at = now()
         where id = ${evidence}`;
      const purging = await asInternal(tx, agentA, () =>
        run(tx, READ_EVIDENCE, [evidence]),
      );
      const direct = await asInternal(tx, agentA, () =>
        run(tx, "select object_key from verification.evidence_files"),
      );
      const lines = (await auditOf(tx, request)).filter(
        (line) => line.event_type === "verification.evidence_viewed",
      );
      return {
        request,
        evidence,
        unclaimed,
        other,
        read,
        unknown,
        purging,
        direct,
        lines,
      };
    });
    expect(found.unclaimed).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(found.other).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentA),
    );
    expect(found.read[0]?.object_key).toBe(
      `${creatorA}/${found.request}/${found.evidence}.webp`,
    );
    expect(found.unknown).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.purging).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.direct).toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    expect(found.lines).toEqual([
      {
        event_type: "verification.evidence_viewed",
        actor_account_id: agentA,
        payload: { evidence_id: found.evidence, level: "audience_verified" },
      },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// The refusal and « à réexaminer »: CA29, CA32, CA33, L2E-D17, RG88
// ---------------------------------------------------------------------------------------------

describe("CA29, CA33: two issues, a typed reason; « à réexaminer » keeps the entry", () => {
  it("CA29: to re-examine keeps the request pending, its deadline, releases the claim, journals the internal reason", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const before = await requestOf(tx, request);
      const token = await claim(tx, request);
      const badReason = await asInternal(tx, agentA, () =>
        run(tx, REEXAMINE, [request, token, "tired"]),
      );
      const done = await asInternal(tx, agentA, () =>
        rows<{ at: Date }>(tx, REEXAMINE, [
          request,
          token,
          "network_unreachable",
        ]),
      );
      const after = await requestOf(tx, request);
      const decide = await asInternal(tx, agentA, () =>
        run(tx, GRANT_ACCOUNT, [
          request,
          token,
          code,
          "t2_creator_a",
          null,
          null,
        ]),
      );
      const lines = await auditOf(tx, request);
      return { before, badReason, done, after, decide, lines };
    });
    expect(found.badReason).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(found.done).toHaveLength(1);
    expect(found.after).toMatchObject({
      status: "pending",
      decided: false,
      claimed_by: null,
      reexamine: "network_unreachable",
    });
    expect(found.after.sla_due_at).toEqual(found.before.sla_due_at);
    expect(found.decide).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(
      found.lines
        .slice(-2)
        .map((line) => [line.event_type, line.payload.reason_code ?? null]),
    ).toEqual([
      ["queue.claim_released", null],
      ["verification.to_reexamine", "network_unreachable"],
    ]);
  });

  it("CA33: no refusal without a reason of its population; the message only where required", async () => {
    const found = await scenario(async (tx) => {
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      const token = await claim(tx, request);
      const reject = (reason: Parameter, message: Parameter = null) =>
        asInternal(tx, agentA, () =>
          run(tx, REJECT, [request, token, reason, message, null]),
        );
      return {
        none: await reject(null),
        brandReason: await reject("domain_code_not_found"),
        otherMute: await reject("other"),
        otherShort: await reject("other", "too short"),
        extraMessage: await reject(
          "ownership_not_proven",
          "A message that is long enough here.",
        ),
        refused: await asInternal(tx, agentA, () =>
          rows<{ status: string; escalated: boolean }>(tx, REJECT, [
            request,
            token,
            "other",
            "Votre profil n'a pas pu être consulté depuis notre poste.",
            "internal only",
          ]),
        ),
        state: await requestOf(tx, request),
        lines: await auditOf(tx, request),
      };
    });
    expect(found.none).toEqual(refused(INVALID_PARAMETER, "reason", "reason"));
    expect(found.brandReason).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(found.otherMute).toEqual(
      refused(INVALID_PARAMETER, "member_message", "member_message"),
    );
    expect(found.otherShort).toEqual(
      refused(INVALID_PARAMETER, "member_message", "member_message"),
    );
    expect(found.extraMessage).toEqual(
      refused(INVALID_PARAMETER, "member_message", "member_message"),
    );
    expect(found.refused[0]).toMatchObject({
      status: "rejected",
      escalated: false,
    });
    expect(found.state).toMatchObject({
      status: "rejected",
      reason: "other",
      decided_by: agentA,
    });
    expect(found.lines.at(-1)).toMatchObject({
      event_type: "verification.rejected",
      actor_account_id: agentA,
      payload: { level: "account_verified", reason_code: "other", late: false },
    });
    expect(JSON.stringify(found.lines)).not.toMatch(/internal only|consulté/);
  });

  it("L2E-D17, CA32: `minor` stops at any step, without a badge, escalated to an administrator", async () => {
    const found = await scenario(async (tx) => {
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "account_verified",
      );
      await claim(tx, request);
      await tx`update profiles.creator_social_accounts set pseudonym = 'changed' where id = ${lineA}`;
      const stopped = await asInternal(tx, agentA, () =>
        rows<{ status: string; escalated: boolean }>(tx, REJECT, [
          request,
          null,
          "minor",
          null,
          null,
        ]),
      );
      const badges = await tx<{ n: number }[]>`
        select count(*)::int as n from verification.badges where request_id = ${request}`;
      return {
        stopped,
        badges,
        state: await requestOf(tx, request),
        lines: await auditOf(tx, request),
      };
    });
    expect(found.stopped[0]).toEqual({
      status: "rejected",
      decided_at: expect.any(Date),
      sla_breached: false,
      escalated: true,
    });
    expect(found.badges[0]?.n).toBe(0);
    expect(found.state).toMatchObject({
      status: "rejected",
      reason: "minor",
      escalated: true,
    });
    expect(found.lines.slice(-2).map((line) => line.event_type)).toEqual([
      "verification.rejected",
      "verification.escalated",
    ]);
  });

  it("RG88: evidence_too_wide purges the evidence at once; account_unavailable closes; a grant on a suspended account is refused", async () => {
    const found = await scenario(async (tx) => {
      await accountVerifiedA(tx);
      const { request } = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      const evidence = await activeEvidence(tx, request, creatorA);
      const token = await claim(tx, request);
      await asInternal(tx, agentA, () =>
        rows(tx, REJECT, [request, token, "evidence_too_wide", null, null]),
      );
      const [purged] = await tx<{ state: string }[]>`
        select state::text as state from verification.evidence_files where id = ${evidence}`;

      const next = await pendingCreatorRequest(
        tx,
        creatorA,
        lineA,
        "instagram",
        "audience_verified",
      );
      await activeEvidence(tx, next.request, creatorA);
      const token2 = await claim(tx, next.request);
      await tx`
        update identity.accounts set status = 'suspended', suspended_at = now()
         where id = ${creatorA}`;
      const suspended = await asInternal(tx, agentA, () =>
        run(tx, GRANT_AUDIENCE, [
          next.request,
          token2,
          38_000,
          12,
          40,
          null,
          day(-20),
          day(-1),
          "t2_creator_a",
          null,
        ]),
      );
      const closed = await asInternal(tx, agentA, () =>
        rows<{ status: string }>(tx, REJECT, [
          next.request,
          token2,
          "account_unavailable",
          null,
          null,
        ]),
      );
      const lines = await auditOf(tx, next.request);
      return {
        purged,
        suspended,
        closed,
        state: await requestOf(tx, next.request),
        lines,
      };
    });
    expect(found.purged?.state).toBe("purging");
    expect(found.suspended).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "account_unavailable",
        "account_unavailable",
      ),
    );
    expect(found.closed[0]?.status).toBe("closed");
    expect(found.state).toMatchObject({
      status: "closed",
      reason: "account_unavailable",
      closed: true,
    });
    expect(found.lines.at(-1)?.event_type).toBe("verification.closed");
  });
});

// ---------------------------------------------------------------------------------------------
// « Marque vérifiée » and the registry sources (06 RG51, RG52; D79 (12))
// ---------------------------------------------------------------------------------------------

describe("06 RG51, RG52: the brand badge, its domain code and its register", () => {
  it("grants on the brand's domain with a register of its country or GLEIF; refuses another domain or source", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingBrandRequest(tx);
      const token = await claim(tx, request);
      const sources = await tx<{ id: string; key: string }[]>`
        select id::text as id,
               coalesce(country_code::text, 'GLEIF') || ':' || is_active::text as key
          from verification.registry_sources
         where (country_code in ('FR', 'AU', 'GB') and source_type <> 'national')
            or (country_code in ('AU', 'GB') and source_type = 'national')
            or source_type = 'gleif'`;
      const source = (key: string) =>
        sources.find((row) => row.key === key)?.id;
      const grant = (
        domain: string,
        channel: string,
        registry: string | undefined,
        typed = code,
      ) =>
        asInternal(tx, agentA, () =>
          run(tx, GRANT_BRAND, [
            request,
            token,
            typed,
            domain,
            channel,
            registry,
            null,
          ]),
        );
      const otherDomain = await grant(
        "evil.example",
        "dns_txt",
        source("FR:true"),
      );
      const suffix = await grant(
        "nott2-brand-a.example",
        "dns_txt",
        source("FR:true"),
      );
      const badChannel = await grant(
        "t2-brand-a.example",
        "email",
        source("FR:true"),
      );
      const otherCountry = await grant(
        "t2-brand-a.example",
        "dns_txt",
        source("AU:true"),
      );
      const inactive = await grant(
        "t2-brand-a.example",
        "dns_txt",
        source("GB:false"),
      );
      const mismatch = await grant(
        "t2-brand-a.example",
        "dns_txt",
        source("FR:true"),
        "INFLUX-AAAAAAAA",
      );
      const granted = await asInternal(tx, agentA, () =>
        rows<Granted>(tx, GRANT_BRAND, [
          request,
          token,
          code,
          "WWW.T2-brand-a.example.",
          "dns_txt",
          source("GLEIF:true"),
          null,
        ]),
      );
      const [badge] = await tx<
        { months: number; source: string; registry: boolean }[]
      >`
        select (extract(year from age(expires_at, granted_at)) * 12
                + extract(month from age(expires_at, granted_at)))::int as months,
               evidence_source as source, registry_source_id is not null as registry
          from verification.badges where request_id = ${request}`;
      const [finding] = await tx<
        { domain: string; channel: string; by: string }[]
      >`
        select observed_domain as domain, observed_channel as channel,
               observed_by_account_id::text as by
          from verification.ownership_codes where request_id = ${request}`;
      return {
        otherDomain,
        suffix,
        badChannel,
        otherCountry,
        inactive,
        mismatch,
        granted,
        badge,
        finding,
      };
    });
    expect(found.otherDomain).toEqual(
      refused(INVALID_PARAMETER, "observed_domain", "observed_domain"),
    );
    expect(found.suffix).toEqual(
      refused(INVALID_PARAMETER, "observed_domain", "observed_domain"),
    );
    expect(found.badChannel).toEqual(
      refused(INVALID_PARAMETER, "observed_channel", "observed_channel"),
    );
    expect(found.otherCountry).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "no_registry_source",
        "no_registry_source",
      ),
    );
    expect(found.inactive).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "no_registry_source",
        "no_registry_source",
      ),
    );
    expect(found.mismatch).toEqual(
      refused(INVALID_PARAMETER, "code_mismatch", "code_mismatch"),
    );
    expect(found.granted[0]?.outcome).toBe("granted");
    expect(found.badge).toEqual({
      months: 12,
      source: "domain_and_registry",
      registry: true,
    });
    expect(found.finding).toEqual({
      domain: "www.t2-brand-a.example",
      channel: "dns_txt",
      by: agentA,
    });
  });

  it("refuses a creator reason on a brand request, and a brand without its internal block", async () => {
    const found = await scenario(async (tx) => {
      const { request, code } = await pendingBrandRequest(tx);
      const token = await claim(tx, request);
      const creatorReason = await asInternal(tx, agentA, () =>
        run(tx, REJECT, [request, token, "evidence_too_old", null, null]),
      );
      await tx`delete from profiles.advertiser_internal_details where account_id = ${brandA}`;
      const reopened = await asInternal(tx, agentA, () =>
        rows<Opened>(tx, OPEN, [request]),
      );
      const [gleif] = await tx<{ id: string }[]>`
        select id::text as id from verification.registry_sources where source_type = 'gleif'`;
      const noDetails = await asInternal(tx, agentA, () =>
        run(tx, GRANT_BRAND, [
          request,
          reopened[0]?.review_token,
          code,
          "t2-brand-a.example",
          "web_page",
          gleif?.id,
          null,
        ]),
      );
      return { creatorReason, noDetails };
    });
    expect(found.creatorReason).toEqual(
      refused(INVALID_PARAMETER, "reason", "reason"),
    );
    expect(found.noDetails).toEqual(
      refused(
        CHECK_VIOLATION,
        "internal_details_required",
        "internal_details_required",
      ),
    );
  });

  it("RG101: an administrator updates a source, journalled before and after; an agent may not", async () => {
    const found = await scenario(async (tx) => {
      const [gb] = await tx<{ id: string }[]>`
        select id::text as id from verification.registry_sources
         where country_code = 'GB' and source_type = 'national'`;
      const values = [
        gb?.id,
        "Companies House",
        "https://find-and-update.company-information.service.gov.uk/",
        day(0),
        true,
      ];
      const byAgent = await asInternal(tx, agentA, () =>
        run(tx, SET_SOURCE, values),
      );
      const future = await asInternal(
        tx,
        adminA,
        () =>
          run(
            tx,
            SET_SOURCE,
            values.map((value, index) => (index === 3 ? day(2) : value)),
          ),
        "admin",
      );
      const done = await asInternal(
        tx,
        adminA,
        () => run(tx, SET_SOURCE, values),
        "admin",
      );
      const [row] = await tx<{ active: boolean; by: string }[]>`
        select is_active as active, updated_by_account_id::text as by
          from verification.registry_sources where id = ${gb?.id ?? null}`;
      const lines = await auditOf(tx, gb?.id ?? randomUUID());
      return { byAgent, future, done, row, lines };
    });
    expect(found.byAgent).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(found.future).toEqual(
      refused(INVALID_PARAMETER, "checked_on", "checked_on"),
    );
    expect(found.done).toMatchObject({ outcome: "rows" });
    expect(found.row).toEqual({ active: true, by: adminA });
    expect(found.lines.at(-1)).toMatchObject({
      event_type: "verification.registry_source_changed",
      actor_account_id: adminA,
      payload: { before: { is_active: false }, after: { is_active: true } },
    });
  });
});

describe("Rights: the decisions belong to agent and admin, never to a member", () => {
  it("no member role executes a function of 0224; the owner holds no write on the evidence", async () => {
    const rights = await migrationRole()<{ fn: string; role: string }[]>`
      select p.oid::regprocedure::text as fn, r as role
        from pg_catalog.pg_proc p, unnest(array['influx_advertiser', 'influx_creator', 'influx_worker']) r
       where p.pronamespace = 'verification'::regnamespace
         and pg_catalog.pg_get_userbyid(p.proowner) = 'influx_verification_definer'
         and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE')`;
    expect(rights).toEqual([]);
    const [writes] = await migrationRole()<{ writes: boolean }[]>`
      select pg_catalog.has_any_column_privilege('influx_verification_definer',
               'verification.evidence_files', 'INSERT, UPDATE')
             or pg_catalog.has_table_privilege('influx_verification_definer',
               'verification.evidence_files', 'DELETE') as writes`;
    expect(writes?.writes).toBe(false);
  });
});
