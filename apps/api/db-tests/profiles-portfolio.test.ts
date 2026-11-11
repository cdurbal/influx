// L2G commit 02 — the portfolio: its bucket, its rows, its deposit doors, its retention, 0242
// (jalons/l2g/02.md; l2g/modele.md points 2 to 5, -4, -15, §2, §3 "0242", §4; fiche invariants 1 to
// 5, 10, 16; 07 RG77 to RG83). T9.10 an approval needs exif_stripped, a changed object goes back to
// pending; L2G-D1 the bounds of RG77 and the quotas at their exact frontier; L2G-D2 a replacement
// waits without a place, the approved original served (RG81, CA44); L2G-D3 a refused or withdrawn
// visual is purged at its date (07 Q9, D79 (8)), never at once; T14 another's visual; -15 a former
// creator. The doors run in rolled-back transactions of the local superuser, as apps/api calls them;
// the decisions of 0244 do not exist yet: an approval or a refusal is a direct write (L2G-D3 « par
// écriture directe », modele §7).
import {
  accountIdOf,
  inRolledBackTransaction,
  PORTFOLIO_IDS,
} from "@influx/test-kit/db";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { isObjectKey } from "../src/platform/storage.ts";
import {
  actAs,
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
const PROGRAM_LIMIT_EXCEEDED = "54000";

const MIB = 1_048_576;

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
  constraint: string | undefined;
};
type Parameter = postgres.ParameterOrJSON<never> | undefined;
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message, detail, constraint. */
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
    const found = error as {
      code?: string;
      message?: string;
      detail?: string;
      constraint_name?: string;
    };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      message: found.message ?? "",
      detail: found.detail,
      constraint: found.constraint_name,
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

/** A refusal by its SQLSTATE and message (the code itself), with its DETAIL when given. */
function refused(code: string, message: string, detail?: string): unknown {
  return expect.objectContaining(
    detail === undefined
      ? { outcome: "error", code, message }
      : { outcome: "error", code, message, detail },
  );
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

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

const BEGIN =
  "select * from profiles.begin_portfolio_upload($1::integer, $2::uuid)";
const STORE =
  "select * from profiles.store_portfolio_item($1::uuid, $2::integer, $3::integer, $4::integer, $5::text)";
const DISCARD = "select profiles.discard_portfolio_upload($1::uuid) as done";
const FAIL = "select profiles.fail_portfolio_upload($1::uuid) as done";
const REORDER = "select profiles.reorder_own_portfolio($1::uuid[]) as done";
const REMOVE = "select profiles.remove_own_portfolio_item($1::uuid) as done";

/** The SHA-256 of a stored WebP, as apps/api writes it (lowercase hexadecimal). */
const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

type Begun = { item_id: string; object_key: string };
type Stored = { state: string; display_order: number | null };

/** `account` begins a deposit (optionally the replacement of `replaces`). */
async function begin(
  tx: Tx,
  account: string,
  replaces: string | null = null,
  bytes = 500_000,
): Promise<Begun> {
  return asCreator(tx, account, async () => {
    const [begun] = await rows<Begun>(tx, BEGIN, [
      bytes,
      replaces ?? undefined,
    ]);
    if (begun === undefined) throw new Error("no deposit");
    return begun;
  });
}

/** `account` deposits a visual: begin, then store with `seed` as checksum. */
async function deposit(
  tx: Tx,
  account: string,
  replaces: string | null = null,
): Promise<Begun & Stored> {
  const begun = await begin(tx, account, replaces);
  const stored = await asCreator(tx, account, async () => {
    const [row] = await rows<Stored>(tx, STORE, [
      begun.item_id,
      400_000,
      1080,
      1350,
      sha(begun.item_id),
    ]);
    if (row === undefined) throw new Error("not stored");
    return row;
  });
  return { ...begun, ...stored };
}

/** The decision of 0244, written directly by the superuser (modele §7: « D3 par écriture directe »). */
async function decide(
  tx: Tx,
  item: string,
  decision: "approved" | "rejected",
): Promise<void> {
  await tx`
    update profiles.portfolio_items
       set state = ${decision}::profiles.portfolio_item_state,
           decided_by_account_id = ${agentA}, decided_at = now(),
           rejection_reason_code = ${decision === "rejected" ? "watermark" : null}
     where id = ${item}`;
}

type Item = {
  state: string;
  display_order: number | null;
  exif_stripped: boolean;
  stored: boolean;
  sla_due_at: Date | null;
  escalate_at: Date | null;
  decided: boolean;
  rejection_reason_code: string | null;
  retention_days: number | null;
  withdrawn: boolean;
  purge_requested: boolean;
  purged: boolean;
  caption: string | null;
};

async function itemOf(tx: Tx, id: string): Promise<Item | null> {
  const [row] = await tx<Item[]>`
    select state::text as state, display_order, exif_stripped, stored_at is not null as stored,
           sla_due_at, escalate_at, decided_at is not null as decided, rejection_reason_code,
           round(extract(epoch from retention_due_at - now()) / 86400)::int as retention_days,
           withdrawn_at is not null as withdrawn, purge_requested_at is not null as purge_requested,
           purged_at is not null as purged, caption
      from profiles.portfolio_items where id = ${id}`;
  return row ?? null;
}

/**
 * The register lines of a visual, their payload without `db_session_user` (written by
 * audit.append() when the session is the superuser of the tests, never by apps/api).
 */
async function linesOf(tx: Tx, item: string, event: string) {
  return tx<{ payload: Record<string, unknown> }[]>`
    select payload - 'db_session_user' as payload from audit.audit_events
     where event_type = ${event} and subject_type = 'portfolio_item' and subject_id = ${item}
     order by seq`;
}

async function publish(tx: Tx, account: string): Promise<void> {
  await tx`
    update profiles.creator_public_profiles set status = 'published', published_at = now()
     where account_id = ${account}`;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// The bucket, the quotas, the grid, the key
// ---------------------------------------------------------------------------------------------

describe("T9.1, T9.3: the bucket portfolio, its quotas, its retention, its grid and the key of the base (modele §4)", () => {
  it("is private, WebP only, 8 MiB; 16 uploads and 64 MiB a day; 30 days of retention; the closed grid of RG79", async () => {
    const migration = migrationRole();
    const [bucket] = await migration<
      { public: boolean; size: number; types: string[] }[]
    >`
      select public, file_size_limit::int as size, allowed_mime_types as types
        from storage.buckets where id = 'portfolio'`;
    expect(bucket).toEqual({
      public: false,
      size: 8 * MIB,
      types: ["image/webp"],
    });
    const [quota] = await migration<{ uploads: number; bytes: string }[]>`
      select max_uploads_per_day as uploads, max_bytes_per_day::text as bytes
        from profiles.storage_quotas where bucket_id = 'portfolio'`;
    expect(quota).toEqual({ uploads: 16, bytes: String(64 * MIB) });
    const [setting] = await migration<{ value: unknown }[]>`
      select value from backoffice.operational_settings where key = 'portfolio_retention_days'`;
    expect(setting?.value).toBe(30);
    const reasons = await migration<
      { code: string; grid_control: number | null }[]
    >`
      select code, grid_control from profiles.portfolio_rejection_reasons order by position`;
    expect(reasons).toEqual([
      { code: "watermark", grid_control: 1 },
      { code: "handle_in_image", grid_control: 2 },
      { code: "app_interface", grid_control: 3 },
      { code: "text_naming_account_or_brand", grid_control: 4 },
      { code: "identifiable_place", grid_control: 5 },
      { code: "statistics_screenshot", grid_control: 7 },
      { code: "illicit_content", grid_control: 9 },
      { code: "caption_identifier", grid_control: null },
      { code: "caption_brand_unauthorised", grid_control: null },
    ]);
  });

  it("generates the key <account>/<visual>.webp, the shape storage.ts accepts and nothing else", async () => {
    const begun = await scenario((tx) => begin(tx, creatorA));
    expect(begun.object_key).toBe(`${creatorA}/${begun.item_id}.webp`);
    expect(isObjectKey("portfolio", begun.object_key)).toBe(true);
    expect(
      isObjectKey("portfolio", `${creatorA}/../${begun.item_id}.webp`),
    ).toBe(false);
    expect(
      isObjectKey("portfolio", `${creatorA}/x/${begun.item_id}.webp`),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// T9.10: no approval without the metadata removed; a changed object is examined again
// ---------------------------------------------------------------------------------------------

describe("T9.10: an approved visual has its metadata removed; a changed object goes back to pending (04 l. 1290-1292)", () => {
  it("refuses an approval without exif_stripped, and exif_stripped taken back from an approved visual (23514)", async () => {
    const outcomes = await scenario(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into profiles.portfolio_items
          (account_id, state, received_bytes, byte_size, width, height, checksum, exif_stripped,
           stored_at)
        values (${creatorA}, 'pending', 1000, 900, 1080, 1350, ${sha("t9-10")}, false, now())
        returning id::text as id`;
      if (row === undefined) throw new Error("no row");
      const approvedWithoutStrip = await run(
        tx,
        `update profiles.portfolio_items
            set state = 'approved', decided_by_account_id = $2::uuid, decided_at = now()
          where id = $1::uuid`,
        [row.id, agentA],
      );
      const stored = await deposit(tx, creatorA);
      await decide(tx, stored.item_id, "approved");
      const stripTakenBack = await run(
        tx,
        "update profiles.portfolio_items set exif_stripped = false where id = $1::uuid",
        [stored.item_id],
      );
      return { approvedWithoutStrip, stripTakenBack };
    });
    expect(outcomes.approvedWithoutStrip).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "portfolio_items_approved_exif_stripped",
    });
    expect(outcomes.stripTakenBack).toMatchObject({
      outcome: "error",
      code: CHECK_VIOLATION,
      constraint: "portfolio_items_approved_exif_stripped",
    });
  });

  it("sends an approved or refused visual whose object changed back to pending, its decision emptied, its deadlines new", async () => {
    const result = await scenario(async (tx) => {
      const approved = await deposit(tx, creatorA);
      const refusedOne = await deposit(tx, creatorA);
      await decide(tx, approved.item_id, "approved");
      await decide(tx, refusedOne.item_id, "rejected");
      const before = await itemOf(tx, approved.item_id);
      // a later instant for the deadline of the new examination
      await tx`select pg_sleep(0.01)`;
      for (const item of [approved.item_id, refusedOne.item_id]) {
        await tx`
          update profiles.portfolio_items set checksum = ${sha(`changed ${item}`)}
           where id = ${item}`;
      }
      return {
        before,
        approved: await itemOf(tx, approved.item_id),
        refused: await itemOf(tx, refusedOne.item_id),
      };
    });
    expect(result.before?.state).toBe("approved");
    for (const item of [result.approved, result.refused]) {
      expect(item).toMatchObject({
        state: "pending",
        decided: false,
        rejection_reason_code: null,
        retention_days: null,
      });
      expect(item?.sla_due_at).not.toBeNull();
    }
    expect(result.approved?.sla_due_at?.getTime()).toBeGreaterThanOrEqual(
      result.before?.sla_due_at?.getTime() ?? Number.POSITIVE_INFINITY,
    );
  });

  it("moves the life forward only: an approved visual never goes back to uploading, a purged one never leaves (55000 item_state)", async () => {
    const outcomes = await scenario(async (tx) => {
      const stored = await deposit(tx, creatorA);
      await decide(tx, stored.item_id, "approved");
      const toUploading = await run(
        tx,
        "update profiles.portfolio_items set state = 'uploading' where id = $1::uuid",
        [stored.item_id],
      );
      const purgedLeaves = await run(
        tx,
        "update profiles.portfolio_items set state = 'withdrawn' where id = $1::uuid",
        [PORTFOLIO_IDS.item.a],
      );
      return { toUploading, purgedLeaves };
    });
    expect(outcomes.toUploading).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
      detail: "item_state",
    });
    expect(outcomes.purgedLeaves).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
      detail: "item_state",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D1: the bounds of RG77, the quotas, the removal, the order
// ---------------------------------------------------------------------------------------------

describe("L2G-D1: 3 to 8 visuals, the quotas at their exact frontier (07 RG77; 18 T9.8; modele points 4, 5)", () => {
  it("stores a deposit pending, metadata removed, in the smallest free place, its deadlines frozen; portfolio.deposited", async () => {
    const result = await scenario(async (tx) => {
      const first = await deposit(tx, creatorA);
      const second = await deposit(tx, creatorA);
      const before = await itemOf(tx, first.item_id);
      // a later write never moves the deadlines
      await tx`update profiles.portfolio_items set display_order = display_order where id = ${first.item_id}`;
      const after = await itemOf(tx, first.item_id);
      await asCreator(tx, creatorA, () => rows(tx, REMOVE, [first.item_id]));
      const third = await deposit(tx, creatorA);
      const [count] = await tx<{ n: number }[]>`
        select profiles.deposited_portfolio_count(${creatorA}::uuid) as n`;
      return {
        first,
        second,
        third,
        before,
        after,
        count: count?.n,
        lines: await linesOf(tx, first.item_id, "portfolio.deposited"),
      };
    });
    expect([result.first.state, result.first.display_order]).toEqual([
      "pending",
      1,
    ]);
    expect(result.second.display_order).toBe(2);
    // the freed place 1 is the smallest free one
    expect(result.third.display_order).toBe(1);
    expect(result.before).toMatchObject({
      state: "pending",
      exif_stripped: true,
      stored: true,
    });
    expect(result.before?.sla_due_at).not.toBeNull();
    expect(result.before?.escalate_at?.getTime()).toBeGreaterThan(
      result.before?.sla_due_at?.getTime() ?? Number.POSITIVE_INFINITY,
    );
    expect(result.after?.sla_due_at).toEqual(result.before?.sla_due_at);
    expect(result.count).toBe(2);
    expect(result.lines.map((line) => line.payload)).toEqual([
      { kind: "deposit", replaces_item_id: null },
    ]);
  });

  it("refuses a ninth place (55000 portfolio_full), the uploads in progress counted, a refused visual not", async () => {
    const outcomes = await scenario(async (tx) => {
      const refusedOne = await deposit(tx, creatorA);
      await decide(tx, refusedOne.item_id, "rejected");
      for (let index = 0; index < 7; index += 1) {
        await deposit(tx, creatorA);
      }
      // the eighth place, taken by an upload in progress
      await begin(tx, creatorA);
      const ninth = await asCreator(tx, creatorA, () =>
        run(tx, BEGIN, [500_000, undefined]),
      );
      const [count] = await tx<{ n: number }[]>`
        select profiles.deposited_portfolio_count(${creatorA}::uuid) as n`;
      return { ninth, count: count?.n };
    });
    expect(outcomes.ninth).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "portfolio_full", "portfolio_full"),
    );
    expect(outcomes.count).toBe(7);
  });

  it("counts 16 uploads and 64 MiB received per UTC day (54000), one upload of 1 to 8 MiB (22023)", async () => {
    const outcomes = await scenario(async (tx) => {
      await tx`
        insert into profiles.storage_daily_usage
          (account_id, bucket_id, usage_day, upload_count, received_bytes)
        values (${creatorA}, 'portfolio', (now() at time zone 'UTC')::date, 15, ${64 * MIB - 200})`;
      return asCreator(tx, creatorA, async () => ({
        tooLarge: await run(tx, BEGIN, [8 * MIB + 1, undefined]),
        empty: await run(tx, BEGIN, [0, undefined]),
        beyondBytes: await run(tx, BEGIN, [201, undefined]),
        lastUpload: await run(tx, BEGIN, [200, undefined]),
        beyondUploads: await run(tx, BEGIN, [1, undefined]),
      }));
    });
    expect(outcomes.tooLarge).toEqual(
      refused(INVALID_PARAMETER, "received_bytes", "received_bytes"),
    );
    expect(outcomes.empty).toEqual(
      refused(INVALID_PARAMETER, "received_bytes", "received_bytes"),
    );
    expect(outcomes.beyondBytes).toEqual(
      refused(PROGRAM_LIMIT_EXCEEDED, "upload_quota_exceeded", "bytes"),
    );
    expect(outcomes.lastUpload).toMatchObject({ outcome: "rows" });
    expect(outcomes.beyondUploads).toEqual(
      refused(PROGRAM_LIMIT_EXCEEDED, "upload_quota_exceeded", "uploads"),
    );
  });

  it("withdraws a removed visual for 30 days, its place freed (never purging at once); a published profile keeps three (55000 portfolio_minimum)", async () => {
    const result = await scenario(async (tx) => {
      const deposits = [];
      for (let index = 0; index < 3; index += 1) {
        deposits.push(await deposit(tx, creatorA));
      }
      const [first, second] = deposits;
      if (first === undefined || second === undefined)
        throw new Error("no deposit");
      await decide(tx, first.item_id, "approved");
      await publish(tx, creatorA);
      const underMinimum = await asCreator(tx, creatorA, () =>
        run(tx, REMOVE, [first.item_id]),
      );
      await deposit(tx, creatorA);
      const removed = await asCreator(tx, creatorA, () =>
        rows<{ done: boolean }>(tx, REMOVE, [first.item_id]),
      );
      const again = await asCreator(tx, creatorA, () =>
        rows<{ done: boolean }>(tx, REMOVE, [first.item_id]),
      );
      return {
        underMinimum,
        removed: removed[0]?.done,
        again: again[0]?.done,
        item: await itemOf(tx, first.item_id),
        lines: await linesOf(tx, first.item_id, "portfolio.withdrawn"),
      };
    });
    expect(result.underMinimum).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "portfolio_minimum",
        "portfolio_minimum",
      ),
    );
    expect(result.removed).toBe(true);
    expect(result.again).toBe(false);
    expect(result.item).toMatchObject({
      state: "withdrawn",
      display_order: null,
      withdrawn: true,
      retention_days: 30,
      purge_requested: false,
      // the decision is kept (modele point 3)
      decided: true,
    });
    expect(result.lines.map((line) => line.payload)).toEqual([
      { cause: "removed" },
    ]);
  });

  it("reorders the placed visuals; an incomplete list, a repeated, an unknown or another's visual answers 22023 order", async () => {
    const result = await scenario(async (tx) => {
      const [a, b, c] = [
        await deposit(tx, creatorA),
        await deposit(tx, creatorA),
        await deposit(tx, creatorA),
      ];
      const other = await deposit(tx, creatorB);
      const list = (ids: string[]) => `{${ids.join(",")}}`;
      const wrong = await asCreator(tx, creatorA, async () => ({
        incomplete: await run(tx, REORDER, [list([a.item_id, b.item_id])]),
        repeated: await run(tx, REORDER, [
          list([a.item_id, b.item_id, b.item_id]),
        ]),
        unknown: await run(tx, REORDER, [
          list([a.item_id, b.item_id, randomUUID()]),
        ]),
        another: await run(tx, REORDER, [
          list([a.item_id, b.item_id, other.item_id]),
        ]),
      }));
      await asCreator(tx, creatorA, () =>
        rows(tx, REORDER, [list([c.item_id, a.item_id, b.item_id])]),
      );
      const places = await tx<{ id: string; display_order: number }[]>`
        select id::text, display_order from profiles.portfolio_items
         where account_id = ${creatorA} and display_order is not null order by display_order`;
      return { wrong, places, ids: [a.item_id, b.item_id, c.item_id] };
    });
    for (const outcome of Object.values(result.wrong)) {
      expect(outcome).toEqual(refused(INVALID_PARAMETER, "order", "order"));
    }
    const [a, b, c] = result.ids;
    expect(result.places).toEqual([
      { id: c, display_order: 1 },
      { id: a, display_order: 2 },
      { id: b, display_order: 3 },
    ]);
  });

  it("discards an upload refused by its checks, purges a broken one, never touches a stored one", async () => {
    const result = await scenario(async (tx) => {
      const discarded = await begin(tx, creatorA);
      const broken = await begin(tx, creatorA);
      const stored = await deposit(tx, creatorA);
      const extra = await begin(tx, creatorA);
      const doors = await asCreator(tx, creatorA, async () => ({
        discard: (
          await rows<{ done: boolean }>(tx, DISCARD, [discarded.item_id])
        )[0]?.done,
        discardAgain: (
          await rows<{ done: boolean }>(tx, DISCARD, [discarded.item_id])
        )[0]?.done,
        fail: (await rows<{ done: boolean }>(tx, FAIL, [broken.item_id]))[0]
          ?.done,
        failStored: (
          await rows<{ done: boolean }>(tx, FAIL, [stored.item_id])
        )[0]?.done,
        storeBroken: await run(tx, STORE, [
          broken.item_id,
          400_000,
          1080,
          1350,
          sha("broken"),
        ]),
        badChecksum: await run(tx, STORE, [
          extra.item_id,
          400_000,
          1080,
          1350,
          "NOT-A-SHA",
        ]),
      }));
      return {
        ...doors,
        discardedRow: await itemOf(tx, discarded.item_id),
        brokenRow: await itemOf(tx, broken.item_id),
        storedRow: await itemOf(tx, stored.item_id),
      };
    });
    expect(result.discard).toBe(true);
    expect(result.discardAgain).toBe(false);
    expect(result.fail).toBe(true);
    expect(result.failStored).toBe(false);
    expect(result.storeBroken).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "item_not_uploading",
        "item_not_uploading",
      ),
    );
    expect(result.badChecksum).toEqual(
      refused(INVALID_PARAMETER, "checksum", "checksum"),
    );
    expect(result.discardedRow).toBeNull();
    expect(result.brokenRow).toMatchObject({
      state: "purging",
      purge_requested: true,
    });
    expect(result.storedRow?.state).toBe("pending");
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D2: the replacement (RG81, CA44, 04 l. 1493-1495)
// ---------------------------------------------------------------------------------------------

describe("L2G-D2: a replacement waits in queue 3 without a place, the approved original served (07 RG81)", () => {
  it("keeps the original approved in its place, the new one pending without a place; one at a time; an approved visual only", async () => {
    const result = await scenario(async (tx) => {
      const original = await deposit(tx, creatorA);
      const pendingOne = await deposit(tx, creatorA);
      await decide(tx, original.item_id, "approved");
      const replacement = await deposit(tx, creatorA, original.item_id);
      const [count] = await tx<{ n: number }[]>`
        select profiles.deposited_portfolio_count(${creatorA}::uuid) as n`;
      const refusals = await asCreator(tx, creatorA, async () => ({
        second: await run(tx, BEGIN, [500_000, original.item_id]),
        ofPending: await run(tx, BEGIN, [500_000, pendingOne.item_id]),
      }));
      return {
        replacement,
        count: count?.n,
        refusals,
        original: await itemOf(tx, original.item_id),
        lines: await linesOf(tx, replacement.item_id, "portfolio.deposited"),
        originalId: original.item_id,
      };
    });
    expect(result.replacement).toMatchObject({
      state: "pending",
      display_order: null,
    });
    expect(result.original).toMatchObject({
      state: "approved",
      display_order: 1,
    });
    // a pending replacement shares the place of its original (modele point 5)
    expect(result.count).toBe(2);
    expect(result.refusals.second).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "replacement_pending",
        "replacement_pending",
      ),
    );
    expect(result.refusals.ofPending).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "not_replaceable", "not_replaceable"),
    );
    expect(result.lines.map((line) => line.payload)).toEqual([
      { kind: "replacement", replaces_item_id: result.originalId },
    ]);
  });

  it("lets a full portfolio replace a visual (no place taken); the removal of the original takes its replacement with it", async () => {
    const result = await scenario(async (tx) => {
      const original = await deposit(tx, creatorA);
      await decide(tx, original.item_id, "approved");
      for (let index = 0; index < 7; index += 1) {
        await deposit(tx, creatorA);
      }
      const replacement = await deposit(tx, creatorA, original.item_id);
      const removed = await asCreator(tx, creatorA, () =>
        rows<{ done: boolean }>(tx, REMOVE, [original.item_id]),
      );
      return {
        replacement: await itemOf(tx, replacement.item_id),
        removed: removed[0]?.done,
        original: await itemOf(tx, original.item_id),
        lines: await linesOf(tx, replacement.item_id, "portfolio.withdrawn"),
      };
    });
    expect(result.removed).toBe(true);
    expect(result.original?.state).toBe("withdrawn");
    expect(result.replacement).toMatchObject({
      state: "withdrawn",
      retention_days: 30,
    });
    expect(result.lines.map((line) => line.payload)).toEqual([
      { cause: "removed" },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D3: the retention of a refused or withdrawn visual (07 Q9, D79 (8); E-4 storage_purge)
// ---------------------------------------------------------------------------------------------

describe("L2G-D3: a refused or withdrawn visual is removed at its date, never before; the row and its decision kept", () => {
  it("claims the due ones and the uploads left 15 minutes, then purges them, caption emptied; never a pending, an approved nor an early one", async () => {
    const result = await scenario(async (tx) => {
      const due = {
        refused: await deposit(tx, creatorA),
        withdrawn: await deposit(tx, creatorA),
      };
      const kept = {
        early: await deposit(tx, creatorA),
        pending: await deposit(tx, creatorA),
        approved: await deposit(tx, creatorA),
      };
      await decide(tx, due.refused.item_id, "rejected");
      await decide(tx, kept.early.item_id, "rejected");
      await decide(tx, kept.approved.item_id, "approved");
      await decide(tx, due.withdrawn.item_id, "approved");
      await asCreator(tx, creatorA, () =>
        rows(tx, REMOVE, [due.withdrawn.item_id]),
      );
      const left = await begin(tx, creatorA);
      // the caption the purge empties (0243 writes it; here directly)
      await tx`
        update profiles.portfolio_items set caption = 'Une légende de test'
         where id = ${due.refused.item_id}`;
      await tx`
        update profiles.portfolio_items set retention_due_at = now() - interval '1 minute'
         where id in (${due.refused.item_id}, ${due.withdrawn.item_id})`;
      // an upload begun 20 minutes ago (the trigger freezes created_at: replica for this write)
      await tx`set local session_replication_role = replica`;
      await tx`
        update profiles.portfolio_items set created_at = now() - interval '20 minutes'
         where id = ${left.item_id}`;
      await tx`set local session_replication_role = origin`;

      const [run] = await tx<{ id: string }[]>`
        insert into ops.periodic_runs (task_code, period_key)
        values ('storage_purge', '2000-01-01T00') returning id::text as id`;
      if (run === undefined) throw new Error("no run");
      const ours = [due.refused.item_id, due.withdrawn.item_id, left.item_id];
      const mine = [
        ...ours,
        ...Object.values(kept).map((item) => item.item_id),
      ];
      const claimed = await actAs(
        tx,
        "worker",
        () =>
          tx<{ object_id: string; bucket_id: string; object_key: string }[]>`
          select object_id::text, bucket_id, object_key
            from ops.claim_storage_purges(${run.id}::uuid, 1::smallint, 1000)`,
      );
      const completed = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ n: number }[]>`
          select ops.complete_storage_purges(${run.id}::uuid, 1::smallint, ${ours}::uuid[]) as n`;
        return row?.n;
      });
      const [line] = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'retention.purged' and subject_id = ${run.id}`;
      return {
        claimed: claimed
          .filter((row) => mine.includes(row.object_id))
          .sort((x, y) => x.object_id.localeCompare(y.object_id)),
        expected: ours
          .map((id) => ({
            object_id: id,
            bucket_id: "portfolio",
            object_key: `${creatorA}/${id}.webp`,
          }))
          .sort((x, y) => x.object_id.localeCompare(y.object_id)),
        completed,
        line: line?.payload,
        refused: await itemOf(tx, due.refused.item_id),
        withdrawn: await itemOf(tx, due.withdrawn.item_id),
        early: await itemOf(tx, kept.early.item_id),
        pending: await itemOf(tx, kept.pending.item_id),
        approved: await itemOf(tx, kept.approved.item_id),
      };
    });
    expect(result.claimed).toEqual(result.expected);
    expect(result.completed).toBe(3);
    expect(result.line).toEqual({ category: "portfolio_objects", count: 3 });
    expect(result.refused).toMatchObject({
      state: "purged",
      purged: true,
      caption: null,
      decided: true,
      rejection_reason_code: "watermark",
    });
    expect(result.withdrawn).toMatchObject({
      state: "purged",
      withdrawn: true,
      decided: true,
    });
    expect(result.early).toMatchObject({
      state: "rejected",
      retention_days: 30,
    });
    expect(result.pending?.state).toBe("pending");
    expect(result.approved?.state).toBe("approved");
  });
});

// ---------------------------------------------------------------------------------------------
// T14, fiche invariants 1, 14: another's visual, the advertiser, the creator's own read
// ---------------------------------------------------------------------------------------------

describe("T14: another's visual answers as an unknown one; the advertiser reaches nothing (fiche invariants 1, 14)", () => {
  it("refuses creator B every door on a visual of creator A as on an unknown one (42501, false)", async () => {
    const result = await scenario(async (tx) => {
      const stored = await deposit(tx, creatorA);
      await decide(tx, stored.item_id, "approved");
      const upload = await begin(tx, creatorA);
      const forB = await asCreator(tx, creatorB, async () => ({
        store: await run(tx, STORE, [
          upload.item_id,
          400_000,
          1080,
          1350,
          sha("b"),
        ]),
        storeUnknown: await run(tx, STORE, [
          randomUUID(),
          400_000,
          1080,
          1350,
          sha("b"),
        ]),
        remove: await run(tx, REMOVE, [stored.item_id]),
        removeUnknown: await run(tx, REMOVE, [randomUUID()]),
        replace: await run(tx, BEGIN, [500_000, stored.item_id]),
        replaceUnknown: await run(tx, BEGIN, [500_000, randomUUID()]),
        discard: await run(tx, DISCARD, [upload.item_id]),
        fail: await run(tx, FAIL, [upload.item_id]),
        sees: await run<{ id: string }>(
          tx,
          "select id::text from profiles.portfolio_items where account_id = $1::uuid",
          [creatorA],
        ),
      }));
      return { forB, upload: await itemOf(tx, upload.item_id) };
    });
    const forbidden = refused(INSUFFICIENT_PRIVILEGE, "forbidden");
    expect(result.forB.store).toEqual(forbidden);
    expect(result.forB.storeUnknown).toEqual(forbidden);
    expect(result.forB.remove).toEqual(forbidden);
    expect(result.forB.removeUnknown).toEqual(forbidden);
    expect(result.forB.replace).toEqual(forbidden);
    expect(result.forB.replaceUnknown).toEqual(forbidden);
    expect(result.forB.discard).toEqual({
      outcome: "rows",
      rows: [{ done: false }],
    });
    expect(result.forB.fail).toEqual({
      outcome: "rows",
      rows: [{ done: false }],
    });
    expect(result.forB.sees).toEqual({ outcome: "rows", rows: [] });
    expect(result.upload?.state).toBe("uploading");
  });

  it("gives the advertiser no door, no row, no grid; the creator never reads the lock, the agent nor the comment", async () => {
    const result = await scenario(async (tx) => {
      const asBrand = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        async () => ({
          begin: await run(tx, BEGIN, [500_000, undefined]),
          items: await run(
            tx,
            "select id from profiles.portfolio_items limit 1",
          ),
          reasons: await run(
            tx,
            "select code from profiles.portfolio_rejection_reasons limit 1",
          ),
          declarations: await run(
            tx,
            "select id from profiles.portfolio_brand_declarations limit 1",
          ),
        }),
      );
      const asOwner = await asCreator(tx, creatorA, async () => ({
        lock: await run(
          tx,
          "select claimed_by_account_id from profiles.portfolio_items",
        ),
        agent: await run(
          tx,
          "select decided_by_account_id from profiles.portfolio_items",
        ),
        comment: await run(
          tx,
          "select internal_comment from profiles.portfolio_items",
        ),
        own: await run<{ id: string }>(
          tx,
          "select id::text from profiles.portfolio_items",
        ),
        declarations: await run<{ id: string }>(
          tx,
          "select id::text from profiles.portfolio_brand_declarations",
        ),
      }));
      return { asBrand, asOwner };
    });
    for (const outcome of Object.values(result.asBrand)) {
      expect(outcome).toMatchObject({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
    for (const outcome of [
      result.asOwner.lock,
      result.asOwner.agent,
      result.asOwner.comment,
    ]) {
      expect(outcome).toMatchObject({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
    expect(result.asOwner.own).toEqual({
      outcome: "rows",
      rows: [{ id: PORTFOLIO_IDS.item.a }],
    });
    expect(result.asOwner.declarations).toEqual({
      outcome: "rows",
      rows: [{ id: PORTFOLIO_IDS.declaration.a }],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// modele -15: the visuals of a former creator
// ---------------------------------------------------------------------------------------------

describe("modele -15: the creator role removed, the visuals leave (never on the erasure)", () => {
  it("withdraws the pending and approved visuals, purges an upload in progress; portfolio.withdrawn {cause former_creator}", async () => {
    const result = await scenario(async (tx) => {
      const approved = await deposit(tx, creatorA);
      await decide(tx, approved.item_id, "approved");
      const pending = await deposit(tx, creatorA);
      const upload = await begin(tx, creatorA);
      await tx`
        delete from identity.account_roles where account_id = ${creatorA} and role = 'creator'`;
      const [trigger] = await tx<{ definition: string }[]>`
        select pg_catalog.pg_get_triggerdef(t.oid) as definition
          from pg_catalog.pg_trigger t
         where t.tgname = 'account_roles_withdraw_portfolio'`;
      return {
        approved: await itemOf(tx, approved.item_id),
        pending: await itemOf(tx, pending.item_id),
        upload: await itemOf(tx, upload.item_id),
        lines: [
          ...(await linesOf(tx, approved.item_id, "portfolio.withdrawn")),
          ...(await linesOf(tx, pending.item_id, "portfolio.withdrawn")),
        ],
        trigger: trigger?.definition,
      };
    });
    expect(result.approved).toMatchObject({
      state: "withdrawn",
      retention_days: 30,
    });
    expect(result.pending).toMatchObject({
      state: "withdrawn",
      retention_days: 30,
    });
    expect(result.upload?.state).toBe("purging");
    expect(result.lines.map((line) => line.payload)).toEqual([
      { cause: "former_creator" },
      { cause: "former_creator" },
    ]);
    // the erasure keeps its own way (0245)
    expect(result.trigger).toContain(
      "(CURRENT_USER <> 'influx_privacy_definer'::name)",
    );
  });
});
