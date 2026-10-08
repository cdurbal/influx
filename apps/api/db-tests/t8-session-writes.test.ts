// T8 (J3, commit 6) — who writes a session (EC-29), the second-factor freshness on the session
// row (EC-40) and the format of the browser summary (05 Q14), migration 0012. Every case runs in
// a rolled-back transaction, except the fixtures of the renewal cases, which need a session whose
// last activity is in the past: they are committed once per run by the migration role.
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type UserContext,
} from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";

let dataSet: DataSet;
let migration: postgres.Sql;
/** Member session of advertiser A, last active two hours ago (committed fixture). */
let oldMemberSession: string;
/** Backoffice session of agent A, last active two minutes ago (committed fixture). */
let oldBackofficeSession: string;
/** Ids of the data-set sessions: token_hash is readable by the resolver only. */
const sessionIds = new Map<string, string>();

function sessionOf(role: keyof DataSet["accounts"], side: "a" | "b"): string {
  const id = sessionIds.get(`${role}.${side}`);
  if (id === undefined) {
    throw new Error(`no data-set session for ${role} ${side}`);
  }
  return id;
}

function tokenHash(): Buffer {
  return createHash("sha256").update(randomBytes(32)).digest();
}

/**
 * Creates a committed session and moves its clock back by `ago`, trigger disabled for that one
 * statement: the database itself never lets activity go back (0012).
 */
async function sessionLastActive(
  account: string,
  surface: "member" | "backoffice",
  ago: string,
): Promise<string> {
  return migration.begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into identity.sessions (token_hash, account_id, surface, mfa_method)
      values (${tokenHash()}, ${account}, ${surface}::identity.session_surface,
              ${surface === "backoffice" ? "totp" : null}::identity.mfa_method)
      returning id`;
    const id = row?.id ?? "";
    await tx`alter table identity.sessions disable trigger sessions_guard_update`;
    await tx`
      update identity.sessions
         set created_at          = now() - ${ago}::interval,
             last_activity_at    = now() - ${ago}::interval,
             mfa_verified_at     = case when surface = 'backoffice'
                                        then now() - ${ago}::interval end,
             absolute_expires_at = now() - ${ago}::interval
                                   + case when surface = 'backoffice' then interval '8 hours'
                                          else interval '4320 hours' end,
             idle_expires_at     = now() - ${ago}::interval
                                   + case when surface = 'backoffice' then interval '30 minutes'
                                          else interval '720 hours' end
       where id = ${id}`;
    await tx`alter table identity.sessions enable trigger sessions_guard_update`;
    return id;
  });
}

function contextOf(
  role: UserContext["role"],
  side: "a" | "b" = "a",
  aal: UserContext["aal"] = role === "agent" || role === "admin"
    ? "aal2"
    : "aal1",
): UserContext {
  return { accountId: dataSet.accounts[role][side].id, role, aal };
}

const TAKEN = {
  advertiser: "influx_advertiser",
  creator: "influx_creator",
  agent: "influx_agent",
  admin: "influx_admin",
} as const;

/** Runs `fn` as a business role with its context, in a rolled-back transaction. */
function asMember<T>(
  context: UserContext,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
    await takeRole(tx, TAKEN[context.role], context);
    return fn(tx);
  });
}

function asAuth<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
    await takeRole(tx, "influx_auth");
    return fn(tx);
  });
}

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
  oldMemberSession = await sessionLastActive(
    dataSet.accounts.advertiser.a.id,
    "member",
    "2 hours",
  );
  oldBackofficeSession = await sessionLastActive(
    dataSet.accounts.agent.a.id,
    "backoffice",
    "2 minutes",
  );
  for (const role of ["advertiser", "creator", "agent", "admin"] as const) {
    for (const side of ["a", "b"] as const) {
      const [row] = await migration<{ id: string }[]>`
        select id from identity.sessions
         where token_hash = ${dataSet.accounts[role][side].sessionTokenHash}`;
      if (row !== undefined) {
        sessionIds.set(`${role}.${side}`, row.id);
      }
    }
  }
});

type SessionRow = {
  aal: string;
  idle: string;
  absolute: string;
  mfa_now: boolean | null;
  mfa_method: string | null;
};

describe("EC-29 point 1: creation by influx_auth, every date computed in base", () => {
  async function created(
    tx: postgres.TransactionSql,
    account: string,
    surface: "member" | "backoffice",
  ): Promise<SessionRow | undefined> {
    const [row] = await tx<{ id: string }[]>`
      insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${tokenHash()}, ${account}, ${surface}::identity.session_surface,
              ${surface === "backoffice" ? "totp" : null}::identity.mfa_method, 'firefox.android')
      returning id`;
    // influx_auth reads neither created_at nor last_activity_at: those instants are checked
    // by the migration-role case below, through the same trigger.
    const [read] = await tx<SessionRow[]>`
      select aal::text,
             (idle_expires_at - now())::text as idle,
             (absolute_expires_at - now())::text as absolute,
             mfa_verified_at = now() as mfa_now, mfa_method::text
        from identity.sessions where id = ${row?.id ?? ""}`;
    return read;
  }

  it("creates a member session in aal1: 30 days sliding, 180 days absolute, no second factor", async () => {
    const row = await asAuth((tx) =>
      created(tx, dataSet.accounts.creator.a.id, "member"),
    );
    expect(row).toEqual({
      aal: "aal1",
      idle: "30 days",
      absolute: "180 days",
      mfa_now: null,
      mfa_method: null,
    });
  });

  it("creates a backoffice session born in aal2 (EC-40): 30 minutes, 8 hours, proof now", async () => {
    const row = await asAuth((tx) =>
      created(tx, dataSet.accounts.admin.a.id, "backoffice"),
    );
    expect(row).toEqual({
      aal: "aal2",
      idle: "00:30:00",
      absolute: "08:00:00",
      mfa_now: true,
      mfa_method: "totp",
    });
  });

  it("sets the three instants to now() and the aal from the surface, whatever is supplied", async () => {
    const row = await inRolledBackTransaction(migration, async (tx) => {
      const [inserted] = await tx<{ id: string }[]>`
        insert into identity.sessions
          (token_hash, account_id, surface, created_at, last_activity_at, updated_at,
           idle_expires_at, absolute_expires_at, aal)
        values (${tokenHash()}, ${dataSet.accounts.creator.a.id}, 'member',
                now() - interval '9 days', now() - interval '9 days',
                now() - interval '9 days', now() + interval '1 hour',
                now() + interval '2 hours', 'aal2')
        returning id`;
      const [read] = await tx<
        { instants_now: boolean; aal: string; idle: string }[]
      >`
        select created_at = now() and last_activity_at = now()
                 and updated_at = now() as instants_now,
               aal::text, (idle_expires_at - now())::text as idle
          from identity.sessions where id = ${inserted?.id ?? ""}`;
      return read;
    });
    expect(row).toEqual({ instants_now: true, aal: "aal1", idle: "30 days" });
  });

  it.each([
    ["created_at", "now() - interval '1 day'"],
    ["last_activity_at", "now()"],
    ["idle_expires_at", "now() + interval '1 year'"],
    ["absolute_expires_at", "now() + interval '1 year'"],
    ["aal", "'aal2'"],
    ["mfa_verified_at", "now()"],
    ["revoked_at", "null"],
  ])("refuses a creation that supplies %s (42501)", async (column, value) => {
    const result = await asAuth((tx) =>
      probe(
        tx,
        `insert into identity.sessions (token_hash, account_id, surface, ${column})
         values ($1, $2, 'member', ${value})`,
        [tokenHash(), dataSet.accounts.creator.a.id],
      ),
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it.each([
    ["a member session for an internal account", "agent", "member", null],
    ["a backoffice session for a member", "creator", "backoffice", "totp"],
  ] as const)(
    "refuses %s (policy, 42501)",
    async (_label, role, surface, method) => {
      const result = await asAuth((tx) =>
        probe(
          tx,
          `insert into identity.sessions (token_hash, account_id, surface, mfa_method)
           values ($1, $2, $3::identity.session_surface, $4::identity.mfa_method)`,
          [tokenHash(), dataSet.accounts[role].a.id, surface, method],
        ),
      );
      expect(result).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  // C6-2 (G-1 point 1): the database refuses a backoffice session before the factor is pinned.
  it("refuses a backoffice session for an internal account whose factor is not pinned (42501)", async () => {
    const unpinned = randomUUID();
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, country_code, preferred_language, declared_status)
        values (${unpinned}, ${randomUUID()}, ${`t8-unpinned-${unpinned}@example.test`}, 'FR', 'fr',
                'business')`;
      await tx`insert into identity.account_roles (account_id, role) values (${unpinned}, 'agent')`;
      await tx`
        insert into identity.agent_profiles (account_id, first_name, mfa_enrolled_at)
        values (${unpinned}, 'T8', now())`;
    });
    const attempt = (account: string) =>
      asAuth((tx) =>
        probe(
          tx,
          `insert into identity.sessions (token_hash, account_id, surface, mfa_method)
           values ($1, $2, 'backoffice', 'totp')`,
          [tokenHash(), account],
        ),
      );
    expect(await attempt(unpinned)).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    // the same agent of the data set, factor pinned: accepted
    expect(await attempt(dataSet.accounts.agent.b.id)).toEqual({
      outcome: "rows",
      count: 1,
    });
  });

  it("refuses a backoffice session without its second-factor method, and a member one with it (23514)", async () => {
    for (const [role, surface, method] of [
      ["agent", "backoffice", null],
      ["advertiser", "member", "totp"],
    ] as const) {
      const result = await asAuth((tx) =>
        probe(
          tx,
          `insert into identity.sessions (token_hash, account_id, surface, mfa_method)
           values ($1, $2, $3::identity.session_surface, $4::identity.mfa_method)`,
          [tokenHash(), dataSet.accounts[role].a.id, surface, method],
        ),
      );
      expect(result, `${role} ${surface}`).toEqual({
        outcome: "error",
        code: CHECK_VIOLATION,
      });
    }
  });

  it("refuses a session created already revoked, even by the migration role (23514)", async () => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      probe(
        tx,
        `insert into identity.sessions (token_hash, account_id, surface, revoked_at, revocation_reason)
         values ($1, $2, 'member', now(), 'logout')`,
        [tokenHash(), dataSet.accounts.creator.a.id],
      ),
    );
    expect(result).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });
});

describe("05 Q14: the browser summary is a key of the closed list, never a raw user agent", () => {
  it.each([
    "firefox.android",
    "chrome.windows",
    "instagram_in_app.ios",
    "unknown.unknown",
  ])("accepts %s", async (summary) => {
    const result = await asAuth((tx) =>
      probe(
        tx,
        `insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
         values ($1, $2, 'member', $3)`,
        [tokenHash(), dataSet.accounts.creator.a.id, summary],
      ),
    );
    expect(result).toEqual({ outcome: "rows", count: 1 });
  });

  it.each([
    "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Firefox.Android",
    "firefox",
    "firefox.android.14",
    "firefox 131.android",
    "firefox.android\n",
    `${"a".repeat(33)}.linux`,
    "",
  ])("refuses %j (23514)", async (summary) => {
    const result = await asAuth((tx) =>
      probe(
        tx,
        `insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
         values ($1, $2, 'member', $3)`,
        [tokenHash(), dataSet.accounts.creator.a.id, summary],
      ),
    );
    expect(result).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });
});

describe("EC-29 point 2: renewal by identity.touch_session(), dates computed in base", () => {
  it("renews the caller's own session last active two hours ago, once", async () => {
    const result = await asMember(contextOf("advertiser"), async (tx) => {
      const [first] = await tx<{ touched: boolean }[]>`
        select identity.touch_session(${oldMemberSession}) as touched`;
      const [second] = await tx<{ touched: boolean }[]>`
        select identity.touch_session(${oldMemberSession}) as touched`;
      const [row] = await tx<{ activity_now: boolean; idle: string }[]>`
        select last_activity_at = now() as activity_now,
               (idle_expires_at - now())::text as idle
          from identity.sessions where id = ${oldMemberSession}`;
      return { first: first?.touched, second: second?.touched, row };
    });
    expect(result).toEqual({
      first: true,
      second: false,
      row: { activity_now: true, idle: "30 days" },
    });
  });

  it("writes nothing on a session active less than an hour ago (J3-C rule 12)", async () => {
    const touched = await asMember(contextOf("advertiser"), async (tx) => {
      const [row] = await tx<{ touched: boolean }[]>`
        select identity.touch_session(${sessionOf("advertiser", "a")}) as touched`;
      return row?.touched;
    });
    expect(touched).toBe(false);
  });

  it("does nothing on the session of another account", async () => {
    const result = await asMember(contextOf("advertiser", "b"), async (tx) => {
      const [row] = await tx<{ touched: boolean }[]>`
        select identity.touch_session(${oldMemberSession}) as touched`;
      return row?.touched;
    });
    expect(result).toBe(false);
    const [row] = await migration<{ old: boolean }[]>`
      select last_activity_at < now() - interval '1 hour' as old
        from identity.sessions where id = ${oldMemberSession}`;
    expect(row?.old).toBe(true);
  });

  it("renews a backoffice session after one minute, capped by 30 minutes, in aal2 only", async () => {
    const aal2 = await asMember(contextOf("agent"), async (tx) => {
      const [row] = await tx<{ touched: boolean }[]>`
        select identity.touch_session(${oldBackofficeSession}) as touched`;
      const [read] = await tx<{ idle: string }[]>`
        select (idle_expires_at - now())::text as idle
          from identity.sessions where id = ${oldBackofficeSession}`;
      return { touched: row?.touched, idle: read?.idle };
    });
    expect(aal2).toEqual({ touched: true, idle: "00:30:00" });
    const aal1 = await asMember(contextOf("agent", "a", "aal1"), async (tx) => {
      const [row] = await tx<{ touched: boolean }[]>`
          select identity.touch_session(${oldBackofficeSession}) as touched`;
      return row?.touched;
    });
    expect(aal1).toBe(false);
  });

  it("gives no business role a direct UPDATE or DELETE on sessions", async () => {
    for (const statement of [
      "update identity.sessions set last_activity_at = now() where account_id = $1",
      "update identity.sessions set revoked_at = null where account_id = $1",
      "delete from identity.sessions where account_id = $1",
    ]) {
      const result = await asMember(contextOf("advertiser"), (tx) =>
        probe(tx, statement, [dataSet.accounts.advertiser.a.id]),
      );
      expect(result, statement).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
  });
});

describe("EC-29 points 3 and 4: revocation by the holder, and irreversibility", () => {
  it("revokes the caller's own session with logout, once, at now()", async () => {
    const result = await asMember(contextOf("creator"), async (tx) => {
      const id = sessionOf("creator", "a");
      const [first] = await tx<{ done: boolean }[]>`
        select identity.revoke_own_session(${id}, 'logout') as done`;
      const [second] = await tx<{ done: boolean }[]>`
        select identity.revoke_own_session(${id}, 'revoked_by_holder') as done`;
      const [row] = await tx<{ at_now: boolean; reason: string }[]>`
        select revoked_at = now() as at_now, revocation_reason::text as reason
          from identity.sessions where id = ${id}`;
      return { first: first?.done, second: second?.done, row };
    });
    expect(result).toEqual({
      first: true,
      second: false,
      row: { at_now: true, reason: "logout" },
    });
  });

  it.each([
    "revoked_by_admin",
    "account_suspended",
    "role_changed",
    "mfa_reset",
    "reauthentication_failed",
  ])("refuses the reason %s to the holder (22023)", async (reason) => {
    const result = await asMember(contextOf("creator"), (tx) =>
      probe(
        tx,
        "select identity.revoke_own_session($1, $2::identity.session_revocation_reason)",
        [sessionOf("creator", "a"), reason],
      ),
    );
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("does not revoke the session of another account", async () => {
    const result = await asMember(contextOf("creator"), async (tx) => {
      const [row] = await tx<{ done: boolean }[]>`
        select identity.revoke_own_session(${sessionOf("creator", "b")}, 'logout') as done`;
      return row?.done;
    });
    expect(result).toBe(false);
  });

  it("freezes a revoked session and its identity, even for the migration role (42501)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const id = sessionOf("advertiser", "b");
      const attempts: Record<string, unknown> = {};
      for (const statement of [
        "update identity.sessions set token_hash = sha256('x'::bytea) where id = $1",
        "update identity.sessions set account_id = gen_random_uuid() where id = $1",
        "update identity.sessions set absolute_expires_at = absolute_expires_at + interval '1 day' where id = $1",
        "update identity.sessions set user_agent_summary = 'chrome.windows' where id = $1",
        "update identity.sessions set last_activity_at = last_activity_at - interval '1 second' where id = $1",
      ]) {
        attempts[statement] = await probe(tx, statement, [id]);
      }
      await tx`update identity.sessions set revoked_at = now() - interval '1 day',
                      revocation_reason = 'logout' where id = ${id}`;
      const [revoked] = await tx<{ at_now: boolean }[]>`
        select revoked_at = now() as at_now from identity.sessions where id = ${id}`;
      attempts.revokedAtNow = revoked?.at_now;
      attempts.resurrect = await probe(
        tx,
        "update identity.sessions set revoked_at = null, revocation_reason = null where id = $1",
        [id],
      );
      return attempts;
    });
    for (const [statement, result] of Object.entries(results)) {
      if (statement === "revokedAtNow") {
        expect(result, statement).toBe(true);
      } else {
        expect(result, statement).toEqual({
          outcome: "error",
          code: INSUFFICIENT_PRIVILEGE,
        });
      }
    }
  });
});

describe("EC-40: the freshness of R and the revocation by influx_auth", () => {
  it("records a new TOTP proof at now(), and nothing else", async () => {
    const results = await asAuth(async (tx) => {
      const id = sessionOf("agent", "b");
      return {
        now: await probe(
          tx,
          "update identity.sessions set mfa_verified_at = now(), mfa_method = 'totp' where id = $1",
          [id],
        ),
        past: await probe(
          tx,
          "update identity.sessions set mfa_verified_at = now() - interval '1 minute' where id = $1",
          [id],
        ),
        recovery: await probe(
          tx,
          "update identity.sessions set mfa_verified_at = now(), mfa_method = 'recovery_code' where id = $1",
          [id],
        ),
      };
    });
    expect(results).toEqual({
      now: { outcome: "rows", count: 1 },
      past: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      recovery: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });

  it("touches no member session (policy: backoffice only)", async () => {
    const result = await asAuth((tx) =>
      probe(
        tx,
        "update identity.sessions set mfa_verified_at = now(), mfa_method = 'totp' where account_id = $1",
        [dataSet.accounts.advertiser.a.id],
      ),
    );
    expect(result).toEqual({ outcome: "rows", count: 0 });
  });

  it("revokes with reauthentication_failed only", async () => {
    const results = await asAuth(async (tx) => {
      const id = sessionOf("agent", "b");
      return {
        logout: await probe(
          tx,
          "update identity.sessions set revoked_at = now(), revocation_reason = 'logout' where id = $1",
          [id],
        ),
        failed: await probe(
          tx,
          "update identity.sessions set revoked_at = now(), revocation_reason = 'reauthentication_failed' where id = $1",
          [id],
        ),
      };
    });
    expect(results).toEqual({
      logout: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      failed: { outcome: "rows", count: 1 },
    });
  });
});
