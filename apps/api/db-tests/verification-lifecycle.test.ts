// L2F commit 05 — the life of a badge, 0230 (jalons/l2f/05.md; l2f/modele.md §1 points 1 to 3, 6, §2,
// §3 "0230", §4; fiche invariants 1, 2, 11, 12, 17; 08 RG69 to RG72, RG100, CA45 to CA48; 06 RG54,
// CA31; 03 C(15)). TM5.3: 90 days -> to_refresh, 120 days -> expired, the public row back to the
// declared, the register without agent, « Compte vérifié » intact, the period replayed without
// effect. L2F-D1 the reminder once (CA45); D2 to_refresh dated, observed (CA46); D3 expired,
// declared, the account intact (CA47); D4 the refresh without the ownership, a new date, the old
// badge replaced (CA48); D5 the brand badge, 12 months and 30 days (06 CA31); D6 the retention of
// the findings. Plus the line deleted (modele point 6) and the rights of the task. The dates are
// moved by the test, never waited for. Each case runs in a rolled-back transaction of the local
// superuser; the task runs as influx_worker on a run of the current period opened by the test.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
  VERIFICATION_IDS,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;

type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
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
    const found = error as { code?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      detail: found.detail,
    };
  }
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asAgent<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    fn,
  );
}

function asCreator<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: creatorA, role: "creator", aal: "aal1" },
    fn,
  );
}

function asBrand<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brandA, role: "advertiser", aal: "aal1" },
    fn,
  );
}

const OPEN = "select * from verification.open_request($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const OPEN_OWN =
  "select request_id::text, status, created from verification.open_own_request($1::uuid, 'audience_verified')";
const OPEN_BRAND =
  "select request_id::text, status, created from profiles.open_own_brand_verification()";

/** The UTC date `days` days from today, as the agent types it. */
function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** A pending request of creator A on line A (as the doors of 0222 leave it), and its code. */
async function pendingRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
): Promise<{ request: string; code: string }> {
  const code = `INFLUX-${randomUUID()
    .replace(/[^2-9]/g, "")
    .padEnd(8, "2")
    .slice(0, 8)}`;
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level, 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${creatorA}, 'network', ${code}, now() + interval '7 days')`;
  }
  return { request: row.id, code };
}

/** Agent A opens `request` and returns its review token. */
async function claim(tx: Tx, request: string): Promise<string> {
  const [opened] = await asAgent(tx, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN, [request]),
  );
  if (opened?.review_token == null) throw new Error("not claimed");
  return opened.review_token;
}

/** An active evidence on `request`, then agent A grants the audience badge. Returns the badge. */
async function grantAudience(tx: Tx, request: string): Promise<string> {
  await tx`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${request}, ${creatorA}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  const token = await claim(tx, request);
  const [granted] = await asAgent(tx, () =>
    tx.unsafe<{ outcome: string; badge_id: string | null }[]>(GRANT_AUDIENCE, [
      request,
      token,
      47_300,
      3,
      250,
      350,
      day(-20),
      day(-1),
      "t2_creator_a",
      null,
    ]),
  );
  if (granted?.badge_id == null)
    throw new Error(`not granted: ${granted?.outcome}`);
  return granted.badge_id;
}

/**
 * Line A declared (120 000 followers, 14 posts, 35 comments), then « Compte vérifié » and « Audience
 * vérifiée » granted by agent A through the functions. Returns both badges.
 */
async function observedLineA(
  tx: Tx,
): Promise<{ account: string; audience: string }> {
  await tx`
    update profiles.creator_social_accounts
       set followers_count = 120000, posts_last_30_days = 14, avg_comments_per_post = 35,
           avg_reach_per_post = 12000, engagement_rate_bp = 900
     where id = ${lineA}`;
  const ownership = await pendingRequest(tx, "account_verified");
  const ownershipToken = await claim(tx, ownership.request);
  const [account] = await asAgent(tx, () =>
    tx.unsafe<{ badge_id: string | null }[]>(GRANT_ACCOUNT, [
      ownership.request,
      ownershipToken,
      ownership.code,
      "t2_creator_a",
      null,
      null,
    ]),
  );
  if (account?.badge_id == null) throw new Error("no account badge");
  const { request } = await pendingRequest(tx, "audience_verified");
  return {
    account: account.badge_id,
    audience: await grantAudience(tx, request),
  };
}

/** Moves the dates of `badge`: granted `grantedDaysAgo` days ago, expiring in `expiresInDays`. */
async function age(
  tx: Tx,
  badge: string,
  grantedDaysAgo: number,
  expiresInDays: number,
): Promise<void> {
  await tx`
    update verification.badges
       set granted_at = now() - make_interval(days => ${grantedDaysAgo}),
           expires_at = now() + make_interval(days => ${expiresInDays})
     where id = ${badge}`;
}

/** A run of badge_lifecycle for the current period, open; the task and the purge on it. */
async function lifecycleRun(tx: Tx) {
  await tx.unsafe("set local session_replication_role = replica");
  await tx`
    delete from ops.periodic_runs
     where task_code::text = 'badge_lifecycle'
       and period_key = to_char(now() at time zone 'UTC', 'YYYY-MM-DD')`;
  await tx.unsafe("set local session_replication_role = origin");
  const [opened] = await tx<{ id: string }[]>`
    insert into ops.periodic_runs (task_code, period_key)
    values ('badge_lifecycle', to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
    returning id::text`;
  if (opened === undefined) throw new Error("no run");
  const call = async (fn: string): Promise<number> => {
    const [row] = await actAs(tx, "worker", () =>
      tx.unsafe<{ n: number }[]>(`select ${fn}($1::uuid, 1::smallint) as n`, [
        opened.id,
      ]),
    );
    return Number(row?.n);
  };
  return {
    id: opened.id,
    cycle: () => call("ops.run_badge_lifecycle"),
    purge: () => call("ops.purge_verification_findings"),
  };
}

type Badge = {
  state: string;
  granted_at: Date;
  expires_at: Date | null;
  reminder_sent_at: Date | null;
  ended_at: Date | null;
};

async function badgeOf(tx: Tx, badge: string): Promise<Badge> {
  const [row] = await tx<Badge[]>`
    select state::text as state, granted_at, expires_at, reminder_sent_at, ended_at
      from verification.badges where id = ${badge}`;
  if (row === undefined) throw new Error("no badge");
  return row;
}

type RegisterLine = {
  code: string;
  actor_type: string;
  actor: string | null;
  payload: Record<string, unknown>;
};

async function registerOf(tx: Tx, subject: string): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type as code, actor_type::text, actor_account_id::text as actor, payload
      from audit.audit_events
     where subject_id = ${subject} and event_type like 'verification.badge_%'
     order by seq`;
}

type QueueLine = {
  type: string;
  destination: string;
  key: string;
  payload: Record<string, unknown>;
};

/** The e-mails of `badge`, and the lead.updated of `account` written after `mark`. */
async function queueOf(
  tx: Tx,
  badge: string,
  account: string,
  mark: string,
): Promise<{ mails: QueueLine[]; leads: number }> {
  const mails = await tx<QueueLine[]>`
    select event_type as type, destination::text, idempotency_key as key, payload
      from leads.outbox_events
     where payload ->> 'badge_id' = ${badge} order by id`;
  const [leads] = await tx<{ n: number }[]>`
    select count(*)::int as n from leads.outbox_events
     where event_type = 'lead.updated' and subject_key = ${`account:${account}`}
       and id > ${mark}::bigint`;
  return { mails, leads: leads?.n ?? 0 };
}

async function outboxMark(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select coalesce(max(id), 0)::text as id from leads.outbox_events`;
  return row?.id ?? "0";
}

type PublicNetwork = {
  audience_band: string | null;
  engagement_band: string | null;
  figures_source: string;
};

async function publicNetwork(tx: Tx, line: string): Promise<PublicNetwork> {
  const [row] = await tx<PublicNetwork[]>`
    select audience_band, engagement_band, figures_source
      from profiles.creator_public_networks where social_account_id = ${line}`;
  if (row === undefined) throw new Error("no public row");
  return row;
}

const OBSERVED_BANDS = {
  audience_band: "micro",
  engagement_band: "3_6",
  figures_source: "agent_observed",
};
const DECLARED_BANDS = {
  audience_band: "mid",
  engagement_band: null,
  figures_source: "declared",
};

/** A brand badge of brand A, granted `grantedDaysAgo` days ago, expiring in `expiresInDays`. */
async function brandBadge(
  tx: Tx,
  grantedDaysAgo: number,
  expiresInDays: number,
): Promise<string> {
  await tx`
    update profiles.advertiser_profiles set website_domain = 'brand-a-lifecycle.example'
     where account_id = ${brandA}`;
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests (account_id, level, status)
    values (${brandA}, 'brand_verified', 'pending') returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] = await tx<{ id: string }[]>`
    insert into verification.badges
      (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
       registry_source_id, expires_at)
    select ${brandA}, ${request?.id ?? null}, 'brand_verified', ${agentA},
           now() - make_interval(days => ${grantedDaysAgo}), 'domain_and_registry', s.id,
           now() + make_interval(days => ${expiresInDays})
      from verification.registry_sources s where s.is_active order by s.id limit 1
    returning id::text`;
  if (badge === undefined) throw new Error("no brand badge");
  return badge.id;
}

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

// ---------------------------------------------------------------------------------------------
// TM5.3: the expiry is a system event (03 C(15), 08 RG69 to RG71)
// ---------------------------------------------------------------------------------------------

describe("TM5.3: the task alone moves a badge to to_refresh then expired, as a system event", () => {
  it("90 days -> to_refresh, 120 days -> expired; the public row back to the declared; no agent in the register; the account badge intact; the period replayed without effect", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      const lifecycle = await lifecycleRun(tx);
      await age(tx, audience, 91, -1);
      await lifecycle.cycle();
      const atRefresh = {
        badge: await badgeOf(tx, audience),
        row: await publicNetwork(tx, lineA),
      };
      await age(tx, audience, 121, -31);
      await lifecycle.cycle();
      const atExpiry = {
        badge: await badgeOf(tx, audience),
        row: await publicNetwork(tx, lineA),
        account: await badgeOf(tx, account),
      };
      const register = await registerOf(tx, audience);
      const mark = await outboxMark(tx);
      const replayed = await lifecycle.cycle();
      return {
        atRefresh,
        atExpiry,
        register,
        replayed,
        afterReplay: {
          register: await registerOf(tx, audience),
          queue: await queueOf(tx, audience, creatorA, mark),
        },
      };
    });
    expect(found.atRefresh.badge.state).toBe("to_refresh");
    expect(found.atRefresh.row).toMatchObject(OBSERVED_BANDS);
    expect(found.atExpiry.badge.state).toBe("expired");
    expect(found.atExpiry.badge.ended_at).not.toBeNull();
    expect(found.atExpiry.row).toMatchObject(DECLARED_BANDS);
    // RG30, RG71: « Compte vérifié » has no expiry and is not touched
    expect(found.atExpiry.account).toMatchObject({
      state: "active",
      expires_at: null,
      reminder_sent_at: null,
    });
    expect(found.register).toEqual([
      {
        code: "verification.badge_to_refresh",
        actor_type: "system",
        actor: null,
        payload: { level: "audience_verified" },
      },
      {
        code: "verification.badge_expired",
        actor_type: "system",
        actor: null,
        payload: { level: "audience_verified", cause: "grace_ended" },
      },
    ]);
    expect(found.replayed).toBe(0);
    expect(found.afterReplay.register).toEqual(found.register);
    expect(found.afterReplay.queue.leads).toBe(0);
  });

  // L2F commit 16 (18 TM5.3 read again): "not as an agent's decision" holds because no other hand can
  // move the state. A mutation that let an agent run the task was seen red above (the register line
  // carried actor_type agent and his account).
  it("leaves the transition to no other hand: neither an agent's nor an admin's direct write, nor an agent's call of the task", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      await age(tx, audience, 91, -1);
      const lifecycle = await lifecycleRun(tx);
      const write = (state: string) =>
        `update verification.badges set state = '${state}' where id = $1`;
      const agentWrites = await asAgent(tx, async () => ({
        toRefresh: await run(tx, write("to_refresh"), [audience]),
        expired: await run(tx, write("expired"), [audience]),
        task: await run(
          tx,
          "select ops.run_badge_lifecycle($1::uuid, 1::smallint)",
          [lifecycle.id],
        ),
      }));
      const adminWrites = await actAsInternal(
        tx,
        "influx_admin",
        {
          accountId: accountIdOf("admin", "a"),
          role: "admin",
          aal: "aal2",
        },
        async () => ({
          toRefresh: await run(tx, write("to_refresh"), [audience]),
          task: await run(
            tx,
            "select ops.run_badge_lifecycle($1::uuid, 1::smallint)",
            [lifecycle.id],
          ),
        }),
      );
      const memberWrites = await asCreator(tx, () =>
        run(tx, write("expired"), [audience]),
      );
      return {
        agentWrites,
        adminWrites,
        memberWrites,
        state: (await badgeOf(tx, audience)).state,
        register: await registerOf(tx, audience),
      };
    });
    const refused = { outcome: "error", code: "42501" };
    expect(found.agentWrites).toEqual({
      toRefresh: expect.objectContaining(refused),
      expired: expect.objectContaining(refused),
      task: expect.objectContaining(refused),
    });
    expect(found.adminWrites).toEqual({
      toRefresh: expect.objectContaining(refused),
      task: expect.objectContaining(refused),
    });
    expect(found.memberWrites).toMatchObject(refused);
    // due since a day, the badge waits for the task: still active, nothing in the register
    expect(found.state).toBe("active");
    expect(found.register).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D1 to D3: the cycle of the audience badge (CA45 to CA47)
// ---------------------------------------------------------------------------------------------

describe("L2F-D1 to D3: the reminder, « à rafraîchir », the expiry (08 RG70, CA45 to CA47)", () => {
  it("L2F-D1: reminds once at J-15, by e-mail (ids only), the badge unchanged (CA45)", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      await age(tx, audience, 76, 14);
      const before = await badgeOf(tx, audience);
      const mark = await outboxMark(tx);
      const lifecycle = await lifecycleRun(tx);
      await lifecycle.cycle();
      const after = await badgeOf(tx, audience);
      await lifecycle.cycle();
      return {
        before,
        after,
        again: await badgeOf(tx, audience),
        queue: await queueOf(tx, audience, creatorA, mark),
        register: await registerOf(tx, audience),
        audience,
      };
    });
    expect(found.after).toMatchObject({
      state: "active",
      granted_at: found.before.granted_at,
      expires_at: found.before.expires_at,
    });
    expect(found.after.reminder_sent_at).not.toBeNull();
    expect(found.again.reminder_sent_at).toEqual(found.after.reminder_sent_at);
    expect(found.queue.mails).toHaveLength(1);
    expect(found.queue.mails[0]).toMatchObject({
      type: "verification.expiry_reminder",
      destination: "brevo_transactional",
      key: `verification.expiry_reminder:${found.audience}`,
    });
    expect(Object.keys(found.queue.mails[0]?.payload ?? {}).sort()).toEqual([
      "account_id",
      "badge_id",
      "email_code",
      "event_id",
    ]);
    // the badge did not change: no lead.updated
    expect(found.queue.leads).toBe(0);
    expect(found.register.map((line) => line.code)).toEqual([
      "verification.badge_reminded",
    ]);
  });

  it("L2F-D2: at 90 days the badge is to_refresh, dated by its decision, the public row still observed, with its e-mail and lead.updated (CA46)", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      await age(tx, audience, 90, 0);
      const before = await badgeOf(tx, audience);
      const mark = await outboxMark(tx);
      const lifecycle = await lifecycleRun(tx);
      const changed = await lifecycle.cycle();
      return {
        before,
        changed,
        after: await badgeOf(tx, audience),
        row: await publicNetwork(tx, lineA),
        queue: await queueOf(tx, audience, creatorA, mark),
      };
    });
    expect(found.changed).toBeGreaterThanOrEqual(1);
    expect(found.after).toMatchObject({
      state: "to_refresh",
      granted_at: found.before.granted_at,
      ended_at: null,
    });
    expect(found.row).toMatchObject(OBSERVED_BANDS);
    expect(found.queue.mails.map((mail) => mail.type)).toEqual([
      "verification.expiry_to_refresh",
    ]);
    expect(found.queue.leads).toBe(1);
  });

  it("L2F-D3: at the end of the grace the audience badge disappears, the figures are declared again, the engagement band hidden, the account badge intact (CA47)", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      await tx`update verification.badges set state = 'to_refresh' where id = ${audience}`;
      await age(tx, audience, 120, -30);
      const mark = await outboxMark(tx);
      const lifecycle = await lifecycleRun(tx);
      await lifecycle.cycle();
      return {
        audience: await badgeOf(tx, audience),
        account: await badgeOf(tx, account),
        row: await publicNetwork(tx, lineA),
        queue: await queueOf(tx, audience, creatorA, mark),
      };
    });
    expect(found.audience.state).toBe("expired");
    expect(found.account.state).toBe("active");
    expect(found.row).toMatchObject(DECLARED_BANDS);
    expect(found.queue.mails.map((mail) => mail.type)).toEqual([
      "verification.expiry_removed",
    ]);
    expect(found.queue.leads).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D4: the refresh (08 RG72, CA48)
// ---------------------------------------------------------------------------------------------

describe("L2F-D4: a refresh asks no ownership, a new decision gives a new date (RG72, CA48)", () => {
  it("opens the refresh of a badge to_refresh without any code, the badge still shown, and the grant replaces it with a new date", async () => {
    const found = await scenario(async (tx) => {
      const { account, audience } = await observedLineA(tx);
      await age(tx, audience, 91, -1);
      const lifecycle = await lifecycleRun(tx);
      await lifecycle.cycle();
      const atRefresh = await asCreator(tx, () =>
        run<{ request_id: string; created: boolean }>(tx, OPEN_OWN, [lineA]),
      );
      const request =
        atRefresh.outcome === "rows"
          ? (atRefresh.rows[0]?.request_id ?? "")
          : "";
      const [codes] = await tx<{ n: number }[]>`
        select count(*)::int as n from verification.ownership_codes where request_id = ${request}`;
      const old = await badgeOf(tx, audience);
      await tx`update verification.verification_requests set status = 'pending' where id = ${request}`;
      const fresh = await grantAudience(tx, request);
      return {
        codes: codes?.n,
        atRefresh,
        old,
        replaced: await badgeOf(tx, audience),
        fresh: await badgeOf(tx, fresh),
        account: await badgeOf(tx, account),
      };
    });
    expect(found.atRefresh).toMatchObject({
      outcome: "rows",
      rows: [{ status: "draft", created: true }],
    });
    // RG72: no ownership asked again, no code issued for the audience
    expect(found.codes).toBe(0);
    expect(found.old.state).toBe("to_refresh");
    expect(found.replaced.state).toBe("replaced");
    expect(found.replaced.ended_at).not.toBeNull();
    expect(found.fresh.state).toBe("active");
    expect(found.fresh.granted_at.getTime()).toBeGreaterThan(
      found.old.granted_at.getTime(),
    );
    expect(found.fresh.expires_at?.getTime()).toBeGreaterThan(Date.now());
    expect(found.account.state).toBe("active");
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D5: the brand badge, 12 months and 30 days (06 RG54, CA31)
// ---------------------------------------------------------------------------------------------

describe("L2F-D5: the brand badge follows the same cycle (06 RG54, CA31)", () => {
  it("is to_refresh at 12 months, opens its refresh then, and is removed 30 days later", async () => {
    const found = await scenario(async (tx) => {
      const badge = await brandBadge(tx, 300, 65);
      await tx`
        update verification.badges
           set granted_at = now() - interval '12 months', expires_at = now()
         where id = ${badge}`;
      const lifecycle = await lifecycleRun(tx);
      await lifecycle.cycle();
      const atRefresh = await badgeOf(tx, badge);
      const opened = await asBrand(tx, () => run(tx, OPEN_BRAND));
      await tx`
        update verification.badges
           set granted_at = now() - interval '13 months', expires_at = now() - interval '30 days'
         where id = ${badge}`;
      await lifecycle.cycle();
      return {
        atRefresh,
        opened,
        expired: await badgeOf(tx, badge),
        register: await registerOf(tx, badge),
      };
    });
    expect(found.atRefresh.state).toBe("to_refresh");
    expect(found.opened).toMatchObject({
      outcome: "rows",
      rows: [{ status: "draft", created: true }],
    });
    expect(found.expired.state).toBe("expired");
    expect(found.register.map((line) => line.payload)).toEqual([
      { level: "brand_verified" },
      { level: "brand_verified", cause: "grace_ended" },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2F-D6: the retention of the findings (08 RG100, modele point 3)
// ---------------------------------------------------------------------------------------------

describe("L2F-D6: the findings are erased after the retention, the rows kept for the register", () => {
  it("erases the figures and the handle of a badge ended 3 years ago, deletes the codes and purged evidence rows of an old closed request and empties its texts; spares the recent", async () => {
    const found = await scenario(async (tx) => {
      const { audience } = await observedLineA(tx);
      await tx`update verification.badges set state = 'replaced' where id = ${audience}`;
      await tx.unsafe("set local session_replication_role = replica");
      await tx`
        update verification.badges set ended_at = now() - interval '1100 days'
         where id = ${audience}`;
      const [old] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at, decided_by_account_id, decided_at, rejection_reason_code,
           member_message, internal_comment, closed_at)
        values (${creatorB}, ${lineB}, 'tiktok', 'account_verified', 'rejected',
                now() - interval '1200 days', now() - interval '1200 days',
                now() - interval '1199 days', now() - interval '1197 days', ${agentA},
                now() - interval '1199 days', 'other', 'A message long enough for the member.',
                'An internal comment.', now() - interval '1199 days')
        returning id::text`;
      const oldRequest = old?.id ?? "";
      await tx`
        insert into verification.ownership_codes
          (request_id, account_id, kind, code, created_at, expires_at)
        values (${oldRequest}, ${creatorB}, 'network', 'INFLUX-PURGE234',
                now() - interval '1200 days', now() - interval '1193 days')`;
      await tx`
        insert into verification.evidence_files
          (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
           created_at, activated_at, retention_due_at, purge_requested_at, deleted_at)
        values (${oldRequest}, ${creatorB}, 'purged', 40000, 20000, 1290, 2796,
                sha256('lifecycle-old'::bytea), now() - interval '1200 days',
                now() - interval '1200 days', now() - interval '1150 days',
                now() - interval '1150 days', now() - interval '1150 days')`;
      await tx.unsafe("set local session_replication_role = origin");
      const lifecycle = await lifecycleRun(tx);
      const purged = await lifecycle.purge();
      const [badge] = await tx<
        {
          state: string;
          followers: string | null;
          declared: number | null;
          period: string | null;
          handle: string | null;
          erased: boolean;
        }[]
      >`
        select state::text, observed_followers::text as followers,
               declared_posts_at_decision as declared, observed_period_start::text as period,
               observed_handle_at_decision as handle, findings_erased_at is not null as erased
          from verification.badges where id = ${audience}`;
      const [recent] = await tx<{ handle: string | null; erased: boolean }[]>`
        select observed_handle_at_decision as handle, findings_erased_at is not null as erased
          from verification.badges where id = ${VERIFICATION_IDS.badge.a}`;
      const [request] = await tx<
        { message: string | null; comment: string | null; status: string }[]
      >`
        select member_message as message, internal_comment as comment, status::text
          from verification.verification_requests where id = ${oldRequest}`;
      const [left] = await tx<
        { codes: number; evidence: number; recent_codes: number }[]
      >`
        select (select count(*)::int from verification.ownership_codes
                 where request_id = ${oldRequest}) as codes,
               (select count(*)::int from verification.evidence_files
                 where request_id = ${oldRequest}) as evidence,
               (select count(*)::int from verification.ownership_codes
                 where id = ${VERIFICATION_IDS.code.a}) as recent_codes`;
      const register = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'retention.purged' and subject_id = ${lifecycle.id}
         order by seq`;
      return {
        purged,
        badge,
        recent,
        request,
        left,
        register: register.map((line) => line.payload),
      };
    });
    expect(found.purged).toBeGreaterThanOrEqual(4);
    expect(found.badge).toEqual({
      state: "replaced",
      followers: null,
      declared: null,
      period: null,
      handle: "[deleted]",
      erased: true,
    });
    expect(found.recent).toEqual({ handle: "t2_creator_a", erased: false });
    expect(found.request).toEqual({
      message: null,
      comment: null,
      status: "rejected",
    });
    expect(found.left).toEqual({ codes: 0, evidence: 0, recent_codes: 1 });
    for (const category of [
      "verification_evidence_rows",
      "verification_codes",
      "verification_request_texts",
      "verification_badge_findings",
    ]) {
      expect(found.register).toContainEqual(
        expect.objectContaining({ category }),
      );
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The line deleted (modele point 6) and the rights of the task
// ---------------------------------------------------------------------------------------------

describe("the task ends the badges of a deleted line, and runs only as influx_worker in its run", () => {
  it("expires a holding badge whose line no longer exists, cause line_deleted, without any e-mail", async () => {
    const found = await scenario(async (tx) => {
      const [line] = await tx<{ id: string }[]>`
        insert into profiles.creator_social_accounts
          (account_id, network_code, is_primary, handle, followers_count)
        values (${creatorA}, 'youtube', false, 'lifecycle_yt', 1000)
        returning id::text`;
      const [request] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status)
        values (${creatorA}, ${line?.id ?? null}, 'youtube', 'account_verified', 'pending')
        returning id::text`;
      await tx`
        update verification.verification_requests
           set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
               closed_at = now()
         where id = ${request?.id ?? null}`;
      const [badge] = await tx<{ id: string }[]>`
        insert into verification.badges
          (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
           granted_at, evidence_source, observed_handle_at_decision)
        values (${creatorA}, ${line?.id ?? null}, 'youtube', ${request?.id ?? null},
                'account_verified', ${agentA}, now(), 'public_profile', 'lifecycle_yt')
        returning id::text`;
      const id = badge?.id ?? "";
      await tx`delete from profiles.creator_social_accounts where id = ${line?.id ?? null}`;
      const mark = await outboxMark(tx);
      const lifecycle = await lifecycleRun(tx);
      await lifecycle.cycle();
      return {
        badge: await badgeOf(tx, id),
        register: await registerOf(tx, id),
        queue: await queueOf(tx, id, creatorA, mark),
      };
    });
    expect(found.badge.state).toBe("expired");
    expect(found.register).toEqual([
      {
        code: "verification.badge_expired",
        actor_type: "system",
        actor: null,
        payload: { level: "account_verified", cause: "line_deleted" },
      },
    ]);
    expect(found.queue.mails).toEqual([]);
    expect(found.queue.leads).toBe(1);
  });

  it("refuses the task and the purge outside an open badge_lifecycle run (55000); influx_worker alone executes them", async () => {
    const refused = await scenario(async (tx) =>
      actAs(tx, "worker", async () => ({
        cycle: await run(
          tx,
          "select ops.run_badge_lifecycle($1::uuid, 1::smallint)",
          [randomUUID()],
        ),
        purge: await run(
          tx,
          "select ops.purge_verification_findings($1::uuid, 1::smallint)",
          [randomUUID()],
        ),
      })),
    );
    expect(refused.cycle).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
    expect(refused.purge).toMatchObject({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
    const [rights] = await migration<Record<string, boolean>[]>`
      select
        has_function_privilege('influx_worker', 'ops.run_badge_lifecycle(uuid,smallint)',
                               'EXECUTE') as worker_cycle,
        has_function_privilege('influx_worker', 'ops.purge_verification_findings(uuid,smallint)',
                               'EXECUTE') as worker_purge,
        has_function_privilege('influx_agent', 'ops.run_badge_lifecycle(uuid,smallint)',
                               'EXECUTE') as agent,
        has_function_privilege('influx_advertiser', 'ops.run_badge_lifecycle(uuid,smallint)',
                               'EXECUTE') as advertiser,
        has_function_privilege('influx_worker', 'ops.queue_badge_change(uuid,uuid,text,boolean)',
                               'EXECUTE') as helper,
        has_column_privilege('influx_maintenance_definer', 'verification.badges',
                             'observed_handle_at_decision', 'SELECT') as handle,
        has_column_privilege('influx_maintenance_definer', 'verification.verification_requests',
                             'member_message', 'SELECT') as message`;
    expect(rights).toEqual({
      worker_cycle: true,
      worker_purge: true,
      agent: false,
      advertiser: false,
      helper: false,
      handle: false,
      message: false,
    });
  });
});
