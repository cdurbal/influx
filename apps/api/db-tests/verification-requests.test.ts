// L2E commit 06 — the member doors of the verification, 0222 (jalons/l2e/06.md; l2e/modele.md §3,
// §4 "Créateur", "Marque", "Erreurs"; fiche invariants 7, 11, 15, 17): L2E-D5 the code generator
// (1 000 draws: alphabet, uniqueness, no input), L2E-D6 the former code invalidated, L2E-D7 one open
// request per triplet, L2E-D8 24 hours and 3 refusals (RG60), L2E-D9 another's line or request; the
// brand (06 CA26, RG47) and its internal block (RG46, RG48); RG12 and -13 at the submission; the
// cancellation and the deleted line (-16). Rights per table and role are probed by T2. Each case
// runs in a rolled-back transaction of the local superuser, the doors called as apps/api calls them.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
  VERIFICATION_IDS,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;

const CODE_SHAPE = /^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
};
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
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

/** The rows of a statement that must succeed. */
async function rows<T>(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
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

function asCreator<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Opened = { request_id: string; status: string; created: boolean };

const OPEN =
  "select * from verification.open_own_request($1::uuid, $2::verification.badge_level)";
const RENEW = "select * from verification.renew_own_code($1::uuid)";
const SUBMIT = "select * from verification.submit_own_request($1::uuid)";
const CANCEL = "select * from verification.cancel_own_request($1::uuid)";

/** Creator A opens a request on `line` at `level` and returns it. */
async function openAs(
  tx: Tx,
  account: string,
  line: string,
  level: "account_verified" | "audience_verified",
): Promise<Opened> {
  const [opened] = await asCreator(tx, account, () =>
    rows<Opened>(tx, OPEN, [line, level]),
  );
  if (opened === undefined) throw new Error("no request opened");
  return opened;
}

type CodeRow = {
  id: string;
  code: string;
  expires_at: Date;
  revoked_at: Date | null;
};

async function codesOf(tx: Tx, request: string): Promise<CodeRow[]> {
  return tx<CodeRow[]>`
    select id, code, expires_at, revoked_at from verification.ownership_codes
     where request_id = ${request} order by created_at, revoked_at nulls last`;
}

/** A refusal of creator A's account request on line A, decided `hoursAgo` hours ago. */
async function insertRefusal(
  tx: Tx,
  hoursAgo: number,
  reason = "ownership_not_proven",
): Promise<void> {
  await tx`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
       rejection_reason_code)
    values (${creatorA}, ${lineA}, 'instagram', 'account_verified', 'rejected',
            now() - make_interval(hours => ${hoursAgo + 1}),
            now() - make_interval(hours => ${hoursAgo + 1}),
            now() - make_interval(hours => ${hoursAgo}),
            now() - make_interval(hours => ${hoursAgo}),
            ${agentA}, now() - make_interval(hours => ${hoursAgo}),
            now() - make_interval(hours => ${hoursAgo}), ${reason})`;
}

/** An active account badge of creator A on line A (from the approved request of the data set). */
async function grantAccountBadge(tx: Tx): Promise<void> {
  await tx`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision, state)
    values (${creatorA}, ${lineA}, 'instagram', ${VERIFICATION_IDS.request.a},
            'account_verified', ${agentA}, now(), 'public_profile', 't2_creator_a', 'active')`;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// L2E-D5: the generator (RG21, RG22, invariant 7)
// ---------------------------------------------------------------------------------------------

describe("L2E-D5: verification.new_ownership_code() (RG21, invariant 7)", () => {
  it("draws 1 000 distinct codes of the closed alphabet, every sign present, from no input", async () => {
    const found = await scenario(async (tx) => {
      const drawn = await tx<{ code: string }[]>`
        select verification.new_ownership_code() as code from generate_series(1, 1000)`;
      const [shape] = await tx<
        { args: number; volatility: string; definer: boolean }[]
      >`
        select pronargs::int as args, provolatile::text as volatility, prosecdef as definer
          from pg_catalog.pg_proc
         where oid = 'verification.new_ownership_code()'::regprocedure`;
      return { codes: drawn.map((row) => row.code), shape };
    });
    expect(found.codes).toHaveLength(1000);
    expect(found.codes.every((code) => CODE_SHAPE.test(code))).toBe(true);
    expect(new Set(found.codes).size).toBe(1000);
    // 8 000 signs over 31: about 258 each; 150 is seven standard deviations below
    const counts = new Map<string, number>();
    for (const code of found.codes) {
      for (const sign of code.slice("INFLUX-".length)) {
        counts.set(sign, (counts.get(sign) ?? 0) + 1);
      }
    }
    expect([...counts.keys()].sort().join("")).toBe(ALPHABET);
    expect(Math.min(...counts.values())).toBeGreaterThan(150);
    // no input: linked to no account, request, handle nor rank; drawn anew at each call
    expect(found.shape).toEqual({ args: 0, volatility: "v", definer: false });
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D6: one valid code per request (RG22, RG23)
// ---------------------------------------------------------------------------------------------

describe("L2E-D6: a renewed code invalidates the former one in the same transaction", () => {
  it("issues a code at the opening, replaces it at the renewal, and never writes the code to the queue nor the register", async () => {
    const found = await scenario(async (tx) => {
      const opened = await openAs(tx, creatorA, lineA, "account_verified");
      const first = await codesOf(tx, opened.request_id);
      const [renewed] = await asCreator(tx, creatorA, () =>
        rows<{ code_id: string; code: string; expires_at: Date }>(tx, RENEW, [
          opened.request_id,
        ]),
      );
      const after = await codesOf(tx, opened.request_id);
      const [validity] = await tx<{ ok: boolean }[]>`
        select bool_and(expires_at = now() + interval '7 days') as ok
          from verification.ownership_codes where request_id = ${opened.request_id}`;
      const queued = await tx<{ type: string; payload: string; key: string }[]>`
        select event_type as type, payload::text as payload, idempotency_key as key
          from leads.outbox_events
         where payload ->> 'request_id' = ${opened.request_id} order by created_at, event_type`;
      const register = await tx<{ code: string; payload: string }[]>`
        select event_type as code, payload::text as payload from audit.audit_events
         where subject_id = ${opened.request_id} order by seq`;
      return { opened, first, renewed, after, validity, queued, register };
    });
    expect(found.opened).toMatchObject({ status: "draft", created: true });
    expect(found.first).toHaveLength(1);
    expect(found.first[0]?.revoked_at).toBeNull();
    expect(found.renewed?.code).toMatch(CODE_SHAPE);
    expect(found.renewed?.code).not.toBe(found.first[0]?.code);
    // the former code revoked, one live code: the renewed one
    const live = found.after.filter((code) => code.revoked_at === null);
    expect(found.after).toHaveLength(2);
    expect(live.map((code) => code.id)).toEqual([found.renewed?.code_id]);
    expect(found.validity?.ok).toBe(true);
    // two e-mails « code generated », keyed by the code row, without the code itself
    expect(found.queued.map((line) => line.type)).toEqual([
      "verification.code_issued",
      "verification.code_issued",
    ]);
    // EC-L2E-16-1 (0227): each line names the e-mail the worker writes, never the code
    for (const line of found.queued) {
      expect(JSON.parse(line.payload).email_code).toBe(
        "verification.code_issued",
      );
    }
    const codes = found.after.map((code) => code.code);
    for (const line of [...found.queued, ...found.register]) {
      for (const code of codes) expect(line.payload).not.toContain(code);
    }
    expect(found.register.map((line) => line.code)).toEqual([
      "verification.requested",
      "verification.code_generated",
      "verification.code_generated",
    ]);
  });

  it("renews only the code of a draft account request (22023 level, 55000 request_not_draft)", async () => {
    const found = await scenario(async (tx) => {
      const audience = await openAs(tx, creatorA, lineA, "audience_verified");
      const account = await openAs(tx, creatorA, lineA, "account_verified");
      return asCreator(tx, creatorA, async () => ({
        audience: await run(tx, RENEW, [audience.request_id]),
        submitted: await run(tx, SUBMIT, [account.request_id]),
        afterSubmit: await run(tx, RENEW, [account.request_id]),
      }));
    });
    expect(found.audience).toEqual(
      refused(INVALID_PARAMETER, "level", "level"),
    );
    expect(found.submitted).toMatchObject({ outcome: "rows" });
    expect(found.afterSubmit).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "request_not_draft",
        "request_not_draft",
      ),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D7: one open request per (account, line, level) (RG14, edge case 3)
// ---------------------------------------------------------------------------------------------

describe("L2E-D7: the triplet", () => {
  it("returns the open draft (double click), opens another level, and refuses a second request while one is pending", async () => {
    const found = await scenario(async (tx) => {
      const first = await openAs(tx, creatorA, lineA, "account_verified");
      const again = await openAs(tx, creatorA, lineA, "account_verified");
      const other = await openAs(tx, creatorA, lineA, "audience_verified");
      const submitted = await asCreator(tx, creatorA, async () => [
        await rows<{ status: string; submitted_at: Date; changed: boolean }>(
          tx,
          SUBMIT,
          [first.request_id],
        ),
        await rows<{ status: string; submitted_at: Date; changed: boolean }>(
          tx,
          SUBMIT,
          [first.request_id],
        ),
      ]);
      const duplicate = await asCreator(tx, creatorA, () =>
        run(tx, OPEN, [lineA, "account_verified"]),
      );
      const [request] = await tx<
        { submitted_at: Date; sla_due_at: Date | null }[]
      >`
        select submitted_at, sla_due_at from verification.verification_requests
         where id = ${first.request_id}`;
      const [count] = await tx<{ count: number }[]>`
        select count(*)::int as count from verification.verification_requests
         where account_id = ${creatorA} and status in ('draft', 'pending')`;
      return { first, again, other, submitted, duplicate, request, count };
    });
    expect(found.again).toEqual({ ...found.first, created: false });
    expect(found.other.request_id).not.toBe(found.first.request_id);
    expect(found.other.created).toBe(true);
    // the second submission writes nothing (edge case 3)
    expect(found.submitted.map((result) => result[0]?.changed)).toEqual([
      true,
      false,
    ]);
    expect(found.request?.sla_due_at).not.toBeNull();
    // « demande déjà en cours depuis le {date} »: the instant of the submission, ISO 8601 UTC
    expect(found.duplicate).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "duplicate_request",
        found.request?.submitted_at.toISOString().replace(/\.\d{3}Z$/, "Z"),
      ),
    );
    expect(found.count?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D8: 24 hours after a refusal, 3 refusals in 30 days (RG60)
// ---------------------------------------------------------------------------------------------

describe("L2E-D8: a new request after a refusal (RG60)", () => {
  it("answers retry_after with the seconds left within 24 hours, opens after them, and never delays after missing_evidence", async () => {
    const found = await scenario(async (tx) => {
      await insertRefusal(tx, 1);
      const early = await asCreator(tx, creatorA, () =>
        run(tx, OPEN, [lineA, "account_verified"]),
      );
      return { early };
    });
    expect(found.early).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
      message: "retry_after",
    });
    const seconds = Number((found.early as Refusal).detail);
    expect(seconds).toBeGreaterThan(23 * 3600 - 60);
    expect(seconds).toBeLessThanOrEqual(23 * 3600);

    const after = await scenario(async (tx) => {
      await insertRefusal(tx, 25);
      return asCreator(tx, creatorA, () =>
        run<Opened>(tx, OPEN, [lineA, "account_verified"]),
      );
    });
    expect(after).toMatchObject({ outcome: "rows", rows: [{ created: true }] });

    const noDelay = await scenario(async (tx) => {
      await insertRefusal(tx, 1, "missing_evidence");
      return asCreator(tx, creatorA, () =>
        run<Opened>(tx, OPEN, [lineA, "account_verified"]),
      );
    });
    expect(noDelay).toMatchObject({
      outcome: "rows",
      rows: [{ created: true }],
    });
  });

  it("answers rejection_cap after 3 refusals of the triplet within 30 days, not for older ones", async () => {
    const capped = await scenario(async (tx) => {
      for (const hours of [26, 48, 30 * 24 - 2]) await insertRefusal(tx, hours);
      return asCreator(tx, creatorA, () =>
        run(tx, OPEN, [lineA, "account_verified"]),
      );
    });
    expect(capped).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "rejection_cap", "rejection_cap"),
    );
    const windowed = await scenario(async (tx) => {
      for (const hours of [26, 48, 30 * 24 + 2]) await insertRefusal(tx, hours);
      return asCreator(tx, creatorA, () =>
        run<Opened>(tx, OPEN, [lineA, "account_verified"]),
      );
    });
    expect(windowed).toMatchObject({
      outcome: "rows",
      rows: [{ created: true }],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D9: another's line, another's request, another role (T14)
// ---------------------------------------------------------------------------------------------

describe("L2E-D9: the doors answer another's line or request as an unknown one (T14)", () => {
  it("refuses creator A on the line and the requests of creator B, and each role the doors of the other", async () => {
    const found = await scenario(async (tx) => {
      const ofB = await openAs(tx, creatorB, lineB, "account_verified");
      const unknown = "00000000-0000-4000-8000-0000000fffff";
      const creator = await asCreator(tx, creatorA, async () => ({
        line: await run(tx, OPEN, [lineB, "account_verified"]),
        unknownLine: await run(tx, OPEN, [unknown, "account_verified"]),
        renew: await run(tx, RENEW, [ofB.request_id]),
        submit: await run(tx, SUBMIT, [ofB.request_id]),
        cancel: await run(tx, CANCEL, [ofB.request_id]),
        unknownRequest: await run(tx, SUBMIT, [unknown]),
        brandLevel: await run(tx, OPEN, [lineA, "brand_verified"]),
        brandDoor: await run(
          tx,
          "select * from profiles.open_own_brand_verification()",
        ),
      }));
      const brand = await asBrand(tx, brandA, async () => ({
        creatorDoor: await run(tx, OPEN, [lineA, "account_verified"]),
        table: await run(
          tx,
          "select 1 from verification.verification_requests",
        ),
      }));
      const [untouched] = await tx<{ status: string }[]>`
        select status::text from verification.verification_requests where id = ${ofB.request_id}`;
      return { creator, brand, untouched };
    });
    for (const outcome of [
      found.creator.line,
      found.creator.unknownLine,
      found.creator.renew,
      found.creator.submit,
      found.creator.cancel,
      found.creator.unknownRequest,
    ]) {
      expect(outcome).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    }
    expect(found.creator.brandLevel).toEqual(
      refused(INVALID_PARAMETER, "level", "level"),
    );
    expect(found.creator.brandDoor).toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
    // the advertiser holds nothing on the schema verification (EC-L2E-18)
    expect(found.brand.creatorDoor).toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
    expect(found.brand.table).toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    expect(found.untouched?.status).toBe("draft");
  });
});

// ---------------------------------------------------------------------------------------------
// The submission: RG12, -13, the live code; the ownership already proven
// ---------------------------------------------------------------------------------------------

describe("the submission of a creator request (RG12, -13, EC-L2E-06-3)", () => {
  it("refuses an audience request without an active account badge, then without an active evidence, then queues it", async () => {
    const found = await scenario(async (tx) => {
      const audience = await openAs(tx, creatorA, lineA, "audience_verified");
      const withoutOwnership = await asCreator(tx, creatorA, () =>
        run(tx, SUBMIT, [audience.request_id]),
      );
      await grantAccountBadge(tx);
      const withoutEvidence = await asCreator(tx, creatorA, () =>
        run(tx, SUBMIT, [audience.request_id]),
      );
      await tx`
        insert into verification.evidence_files
          (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
           activated_at, retention_due_at)
        values (${audience.request_id}, ${creatorA}, 'active', 40000, 20000, 1290, 2796,
                sha256('l2e-06'::bytea), now(), now() + interval '45 days')`;
      const submitted = await asCreator(tx, creatorA, () =>
        run<{ status: string; changed: boolean }>(tx, SUBMIT, [
          audience.request_id,
        ]),
      );
      const queued = await tx<
        { type: string; destination: string; key: string; email_code: string }[]
      >`
        select event_type as type, destination::text, idempotency_key as key,
               payload ->> 'email_code' as email_code
          from leads.outbox_events where payload ->> 'request_id' = ${audience.request_id}`;
      const alreadyProven = await asCreator(tx, creatorA, () =>
        run(tx, OPEN, [lineA, "account_verified"]),
      );
      return {
        audience,
        withoutOwnership,
        withoutEvidence,
        submitted,
        queued,
        alreadyProven,
      };
    });
    expect(found.withoutOwnership).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "ownership_prerequisite",
        "ownership_prerequisite",
      ),
    );
    expect(found.withoutEvidence).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "missing_evidence",
        "missing_evidence",
      ),
    );
    expect(found.submitted).toMatchObject({
      outcome: "rows",
      rows: [{ status: "pending", changed: true }],
    });
    expect(found.queued).toEqual([
      {
        type: "verification.received",
        destination: "brevo_transactional",
        key: `verification.received:${found.audience.request_id}`,
        email_code: "verification.received",
      },
    ]);
    // the ownership of an account is proven once (RG30)
    expect(found.alreadyProven).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "already_verified",
        "already_verified",
      ),
    );
  });

  it("refuses an account request whose code expired (code_expired)", async () => {
    const found = await scenario(async (tx) => {
      const opened = await openAs(tx, creatorA, lineA, "account_verified");
      await tx`update verification.ownership_codes
                  set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
                where request_id = ${opened.request_id}`;
      return asCreator(tx, creatorA, () =>
        run(tx, SUBMIT, [opened.request_id]),
      );
    });
    expect(found).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "code_expired", "code_expired"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The cancellation, and the deleted line (-16)
// ---------------------------------------------------------------------------------------------

describe("the cancellation of a request (RG14, -16)", () => {
  it("cancels an open request and revokes its code, once; refuses an ended one (entry_closed)", async () => {
    const found = await scenario(async (tx) => {
      const opened = await openAs(tx, creatorA, lineA, "account_verified");
      const results = await asCreator(tx, creatorA, async () => [
        await run<{ status: string; changed: boolean }>(tx, CANCEL, [
          opened.request_id,
        ]),
        await run<{ status: string; changed: boolean }>(tx, CANCEL, [
          opened.request_id,
        ]),
        await run(tx, CANCEL, [VERIFICATION_IDS.request.a]),
      ]);
      const codes = await codesOf(tx, opened.request_id);
      const [request] = await tx<{ status: string; closed: boolean }[]>`
        select status::text, closed_at is not null as closed
          from verification.verification_requests where id = ${opened.request_id}`;
      return { results, codes, request };
    });
    expect(found.results[0]).toMatchObject({
      rows: [{ status: "cancelled", changed: true }],
    });
    expect(found.results[1]).toMatchObject({
      rows: [{ status: "cancelled", changed: false }],
    });
    expect(found.results[2]).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "entry_closed", "entry_closed"),
    );
    expect(found.codes.every((code) => code.revoked_at !== null)).toBe(true);
    expect(found.request).toEqual({ status: "cancelled", closed: true });
  });

  it("cancels the open requests of a line its creator deletes, and only them (-16)", async () => {
    const found = await scenario(async (tx) => {
      const [line] = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts (account_id, network_code, handle)
        values (${creatorA}, 'youtube', 'l2e_06_second_line') returning id`;
      if (line === undefined) throw new Error("no line");
      const onLine = await openAs(tx, creatorA, line.id, "account_verified");
      const onPrimary = await openAs(tx, creatorA, lineA, "account_verified");
      await asCreator(
        tx,
        creatorA,
        () =>
          tx`delete from profiles.creator_social_accounts where id = ${line.id}`,
      );
      const states = await tx<{ id: string; status: string }[]>`
        select id, status::text from verification.verification_requests
         where id in (${onLine.request_id}, ${onPrimary.request_id})`;
      const live = await tx<{ count: number }[]>`
        select count(*)::int as count from verification.ownership_codes
         where request_id = ${onLine.request_id} and revoked_at is null`;
      return { onLine, states, live };
    });
    expect(
      Object.fromEntries(
        found.states.map((row) => [
          row.id === found.onLine.request_id ? "line" : "primary",
          row.status,
        ]),
      ),
    ).toEqual({ line: "cancelled", primary: "draft" });
    expect(found.live[0]?.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// The brand: domain (CA26), internal block (RG46 to RG48), its request
// ---------------------------------------------------------------------------------------------

const BRAND_OPEN = "select * from profiles.open_own_brand_verification()";
const BRAND_SAVE =
  "select profiles.save_own_brand_internal_details($1::text, $2::text, $3::text) as at";
const BRAND_SUBMIT = "select * from profiles.submit_own_brand_verification()";
const BRAND_READ = "select * from profiles.read_own_brand_verification()";

describe("the brand request (06 RG46, RG47, RG51, CA26, CA27)", () => {
  it("CA26: refuses the badge request of a profile without a domain (23514)", async () => {
    const found = await scenario(async (tx) =>
      asBrand(tx, brandA, () => run(tx, BRAND_OPEN)),
    );
    expect(found).toEqual(
      refused(
        CHECK_VIOLATION,
        "website_domain_required",
        "website_domain_required",
      ),
    );
  });

  it("opens with a domain code, asks the internal block at the submission, then queues the request", async () => {
    const found = await scenario(async (tx) => {
      await tx`update profiles.advertiser_profiles set website_domain = 't2-brand-a.example'
                where account_id = ${brandA}`;
      await tx`delete from profiles.advertiser_internal_details where account_id = ${brandA}`;
      return asBrand(tx, brandA, async () => {
        const opened = await run<Opened>(tx, BRAND_OPEN);
        const again = await run<Opened>(tx, BRAND_OPEN);
        const withoutBlock = await run(tx, BRAND_SUBMIT);
        const invalid = [
          await run(tx, BRAND_SAVE, ["   ", "FR", "RCS 123"]),
          await run(tx, BRAND_SAVE, ["Brand A SAS", "ZZ", "RCS 123"]),
          await run(tx, BRAND_SAVE, ["Brand A SAS", "FR", "9".repeat(41)]),
        ];
        const saved = await run(tx, BRAND_SAVE, [
          "  Brand A SAS ",
          "fr",
          " RCS 123 ",
        ]);
        const submitted = await run<{ status: string; changed: boolean }>(
          tx,
          BRAND_SUBMIT,
        );
        const read = await run<Record<string, unknown>>(tx, BRAND_READ);
        const duplicate = await run(tx, BRAND_OPEN);
        return {
          opened,
          again,
          withoutBlock,
          invalid,
          saved,
          submitted,
          read,
          duplicate,
        };
      });
    });
    expect(found.opened).toMatchObject({
      rows: [{ status: "draft", created: true }],
    });
    expect(found.again).toMatchObject({
      rows: [{ status: "draft", created: false }],
    });
    expect(found.withoutBlock).toEqual(
      refused(
        CHECK_VIOLATION,
        "internal_details_required",
        "internal_details_required",
      ),
    );
    expect(found.invalid).toEqual([
      refused(INVALID_PARAMETER, "internal_details_invalid", "legal_name"),
      refused(
        INVALID_PARAMETER,
        "internal_details_invalid",
        "registration_country_code",
      ),
      refused(
        INVALID_PARAMETER,
        "internal_details_invalid",
        "registration_number",
      ),
    ]);
    expect(found.saved).toMatchObject({ outcome: "rows" });
    expect(found.submitted).toMatchObject({
      rows: [{ status: "pending", changed: true }],
    });
    const read = (found.read as { rows: Record<string, unknown>[] }).rows;
    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({
      request_status: "pending",
      website_domain: "t2-brand-a.example",
      legal_name: "Brand A SAS",
      registration_country_code: "FR",
      registration_number: "RCS 123",
      badge_state: null,
    });
    expect(String(read[0]?.code)).toMatch(CODE_SHAPE);
    expect(found.duplicate).toMatchObject({
      code: NOT_IN_PREREQUISITE_STATE,
      message: "duplicate_request",
    });
  });

  it("keeps the internal block to its brand and to agent and admin (RG46, RG48)", async () => {
    const found = await scenario(async (tx) => {
      const ofB = await asBrand(tx, brandB, () =>
        rows<{ legal_name: string }>(tx, BRAND_READ),
      );
      const direct = await asBrand(tx, brandA, () =>
        run(tx, "select legal_name from profiles.advertiser_internal_details"),
      );
      const creator = await asCreator(tx, creatorA, () =>
        run(tx, "select legal_name from profiles.advertiser_internal_details"),
      );
      return { ofB, direct, creator };
    });
    expect(found.ofB.map((row) => row.legal_name)).toEqual(["T2 Brand B SAS"]);
    expect(found.direct).toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    expect(found.creator).toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    const rights = await migrationRole()<{ role: string; reads: boolean }[]>`
      select r as role,
             pg_catalog.has_any_column_privilege(r, 'profiles.advertiser_internal_details',
                                                 'SELECT, INSERT, UPDATE') as reads
        from unnest(array['influx_leads_definer', 'influx_worker',
                          'influx_creator_verification_definer']) r order by 1`;
    expect(rights.every((row) => !row.reads)).toBe(true);
  });
});
