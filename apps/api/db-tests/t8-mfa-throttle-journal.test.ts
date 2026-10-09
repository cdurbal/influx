// T8 (J3, commit 6) — second factor of internal accounts (EC-17, EC-39, G-1; 0013), rate-limit
// counters (EC-3, EC-47; 0014) and the journal of the sign-in code (D43, EC-6, EC-7; 0015).
// Cases run as influx_auth through its real connection role, in rolled-back transactions; the
// cases that need several connections or a committed effect (concurrency, audit lines) commit
// fixtures on fresh, random keys and accounts (18 Q5: reset before a triple run).
import {
  connectAsLoginRole,
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
} from "@influx/test-kit/db";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

function digest(value: string = randomUUID()): Buffer {
  return createHash("sha256").update(value).digest();
}

function hexes(buffers: readonly Buffer[]): string[] {
  return buffers.map((buffer) => buffer.toString("hex"));
}

function asAuth<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
    await takeRole(tx, "influx_auth");
    return fn(tx);
  });
}

type InternalFixture = { account: string; token: Buffer };

/**
 * A committed internal account (agent) without a pinned factor, and an enrollment token whose
 * digest is returned (G-1 point 2: SHA-256 only in base).
 */
async function internalAccount(
  options: { status?: "active" | "suspended"; tokenAge?: string } = {},
): Promise<InternalFixture> {
  const account = randomUUID();
  const token = digest();
  await migration.begin(async (tx) => {
    const suspended = options.status === "suspended";
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, country_code, preferred_language, status, suspended_at,
         declared_status)
      values (${account}, ${randomUUID()}, ${`t8-mfa-${account}@example.test`}, 'FR', 'fr',
              ${suspended ? "suspended" : "active"}::identity.account_status,
              ${suspended ? new Date() : null}, 'business')`;
    await tx`insert into identity.account_roles (account_id, role) values (${account}, 'agent')`;
    await tx`insert into identity.agent_profiles (account_id, first_name) values (${account}, 'T8')`;
    const age = options.tokenAge ?? "0 seconds";
    await tx`
      insert into identity.mfa_enrollment_tokens (account_id, token_hash, created_at, expires_at)
      values (${account}, ${token}, now() - ${age}::interval,
              now() - ${age}::interval + interval '72 hours')`;
  });
  return { account, token };
}

async function tokenIsValid(
  tx: postgres.TransactionSql,
  account: string,
  token: Buffer,
): Promise<boolean | undefined> {
  const [row] = await tx<{ valid: boolean }[]>`
    select identity.enrollment_token_is_valid(${account}, ${token}) as valid`;
  return row?.valid;
}

function pin(
  tx: postgres.TransactionSql,
  fixture: InternalFixture,
  codes: readonly Buffer[],
  factor: string = randomUUID(),
): Promise<ProbeResult> {
  return probe(
    tx,
    `select identity.pin_mfa_factor($1, $2, $3,
       (select array_agg(decode(h, 'hex')) from unnest($4::text[]) h))`,
    [fixture.account, factor, fixture.token, hexes(codes)],
  );
}

async function consume(
  tx: postgres.TransactionSql,
  account: string,
  code: Buffer,
): Promise<number | null | undefined> {
  const [row] = await tx<{ left: number | null }[]>`
    select remaining as left from identity.consume_recovery_code(${account}, ${code})`;
  return row?.left;
}

const tenCodes = (): Buffer[] => Array.from({ length: 10 }, () => digest());

// ---------------------------------------------------------------------------------------------

describe("G-1 and EC-17: enrollment token, pinned factor, recovery codes (0013)", () => {
  let fixture: InternalFixture;
  let other: InternalFixture;

  beforeAll(async () => {
    fixture = await internalAccount();
    other = await internalAccount();
  });

  it("validates the token of this account only, and nothing else", async () => {
    const results = await asAuth(async (tx) => ({
      own: await tokenIsValid(tx, fixture.account, fixture.token),
      wrongToken: await tokenIsValid(tx, fixture.account, digest()),
      otherAccount: await tokenIsValid(tx, other.account, fixture.token),
      shortDigest: await tokenIsValid(tx, fixture.account, Buffer.alloc(16)),
    }));
    expect(results).toEqual({
      own: true,
      wrongToken: false,
      otherAccount: false,
      shortDigest: false,
    });
  });

  it("pins the factor once, consumes the token, and makes each recovery code single-use", async () => {
    const codes = tenCodes();
    const results = await asAuth(async (tx) => ({
      pinned: await pin(tx, fixture, codes),
      tokenAfter: await tokenIsValid(tx, fixture.account, fixture.token),
      pinnedAgain: await pin(tx, fixture, tenCodes()),
      first: await consume(tx, fixture.account, codes[0] ?? digest()),
      firstAgain: await consume(tx, fixture.account, codes[0] ?? digest()),
      second: await consume(tx, fixture.account, codes[1] ?? digest()),
      unknown: await consume(tx, fixture.account, digest()),
      otherAccount: await consume(tx, other.account, codes[2] ?? digest()),
    }));
    expect(results).toEqual({
      pinned: { outcome: "rows", count: 1 },
      tokenAfter: false,
      pinnedAgain: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      first: 9,
      firstAgain: null,
      second: 8,
      unknown: null,
      otherAccount: null,
    });
  });

  it.each([
    ["nine codes", () => tenCodes().slice(0, 9)],
    ["eleven codes", () => [...tenCodes(), digest()]],
    [
      "a duplicated code",
      () => {
        const codes = tenCodes();
        return [...codes.slice(0, 9), codes[0] ?? digest()];
      },
    ],
    [
      "a digest of 16 bytes",
      () => [...tenCodes().slice(0, 9), Buffer.alloc(16, 1)],
    ],
  ])("refuses an enrollment with %s (22023)", async (_label, codes) => {
    const result = await asAuth((tx) => pin(tx, other, codes()));
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("refuses the same uniform 42501 for an expired token, a suspended account or a wrong token", async () => {
    const expired = await internalAccount({ tokenAge: "73 hours" });
    const suspended = await internalAccount({ status: "suspended" });
    const results = await asAuth(async (tx) => ({
      expiredValid: await tokenIsValid(tx, expired.account, expired.token),
      expired: await pin(tx, expired, tenCodes()),
      suspendedValid: await tokenIsValid(
        tx,
        suspended.account,
        suspended.token,
      ),
      suspended: await pin(tx, suspended, tenCodes()),
      wrongToken: await pin(
        tx,
        { account: other.account, token: digest() },
        tenCodes(),
      ),
    }));
    expect(results).toEqual({
      expiredValid: false,
      expired: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      suspendedValid: false,
      suspended: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      wrongToken: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });

  it("writes agent.mfa_enrolled, agent.recovery_codes_generated and agent.recovery_code_consumed, never a code (EC-44)", async () => {
    const committed = await internalAccount();
    const codes = tenCodes();
    const factor = randomUUID();
    await loginRole("influx_auth_login").begin(async (tx) => {
      await takeRole(tx, "influx_auth");
      expect(await pin(tx, committed, codes, factor)).toEqual({
        outcome: "rows",
        count: 1,
      });
      expect(await consume(tx, committed.account, codes[3] ?? digest())).toBe(
        9,
      );
    });
    const lines = await migration<
      {
        event_type: string;
        actor_type: string;
        payload: Record<string, unknown>;
      }[]
    >`
      select event_type, actor_type::text, payload from audit.audit_events
       where subject_type = 'account' and subject_id = ${committed.account}
       order by seq`;
    expect(lines).toEqual([
      { event_type: "agent.mfa_enrolled", actor_type: "system", payload: {} },
      {
        event_type: "agent.recovery_codes_generated",
        actor_type: "system",
        payload: { count: 10 },
      },
      {
        event_type: "agent.recovery_code_consumed",
        actor_type: "system",
        payload: { remaining: 9 },
      },
    ]);
    const text = JSON.stringify(lines);
    for (const code of [...hexes(codes), committed.token.toString("hex")]) {
      expect(text).not.toContain(code);
    }
    const [profile] = await migration<{ factor: string; enrolled: boolean }[]>`
      select mfa_factor_id::text as factor, mfa_enrolled_at is not null as enrolled
        from identity.agent_profiles where account_id = ${committed.account}`;
    expect(profile).toEqual({ factor, enrolled: true });
  });

  it("lets only the end of a code or of a token be written, once, even by the migration role", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const [code] = await tx<{ id: string }[]>`
        insert into identity.mfa_recovery_codes (account_id, batch_id, code_hash)
        values (${fixture.account}, gen_random_uuid(), ${digest()}) returning id`;
      const id = code?.id ?? "";
      const [token] = await tx<{ id: string }[]>`
        select id from identity.mfa_enrollment_tokens where account_id = ${other.account}`;
      return {
        rehash: await probe(
          tx,
          "update identity.mfa_recovery_codes set code_hash = sha256('x'::bytea) where id = $1",
          [id],
        ),
        consumed: await probe(
          tx,
          "update identity.mfa_recovery_codes set consumed_at = now() where id = $1",
          [id],
        ),
        revive: await probe(
          tx,
          "update identity.mfa_recovery_codes set consumed_at = null where id = $1",
          [id],
        ),
        tokenConsumed: await probe(
          tx,
          "update identity.mfa_enrollment_tokens set consumed_at = now() where id = $1",
          [token?.id ?? ""],
        ),
        tokenAgain: await probe(
          tx,
          "update identity.mfa_enrollment_tokens set consumed_at = now() where id = $1",
          [token?.id ?? ""],
        ),
        tokenExtended: await probe(
          tx,
          "update identity.mfa_enrollment_tokens set expires_at = now() + interval '1 hour' where account_id = $1",
          [fixture.account],
        ),
      };
    });
    expect(results).toEqual({
      rehash: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      consumed: { outcome: "rows", count: 1 },
      revive: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      tokenConsumed: { outcome: "rows", count: 1 },
      tokenAgain: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      tokenExtended: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });
});

describe("EC-39: the same TOTP code is refused for 120 seconds (0013)", () => {
  let fixture: InternalFixture;

  beforeAll(async () => {
    fixture = await internalAccount();
  });

  async function accept(
    tx: postgres.TransactionSql,
    code: Buffer,
  ): Promise<boolean | undefined> {
    const [row] = await tx<{ accepted: boolean }[]>`
      select identity.accept_totp_code(${fixture.account}, ${code}) as accepted`;
    return row?.accepted;
  }

  it("accepts a code once, refuses it again, accepts another one and refuses the older one", async () => {
    const [a, b] = [digest(), digest()];
    const results = await asAuth(async (tx) => [
      await accept(tx, a),
      await accept(tx, a),
      await accept(tx, b),
      await accept(tx, a),
    ]);
    expect(results).toEqual([true, false, true, false]);
  });

  it("gives one winner to two concurrent transactions presenting the same code", async () => {
    const code = digest();
    const pool = connectAsLoginRole("influx_auth_login", { max: 2 });
    try {
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstDone: (value: boolean | undefined) => void = () => undefined;
      const firstAccepted = new Promise<boolean | undefined>((resolve) => {
        firstDone = resolve;
      });
      const first = pool.begin(async (tx) => {
        await takeRole(tx, "influx_auth");
        firstDone(await accept(tx, code));
        await hold;
      });
      expect(await firstAccepted).toBe(true);
      const second = pool.begin(async (tx) => {
        await takeRole(tx, "influx_auth");
        return accept(tx, code);
      });
      // the second one waits on the key until the first commits
      await new Promise((resolve) => setTimeout(resolve, 200));
      release();
      await first;
      expect(await second).toBe(false);
    } finally {
      await pool.end({ timeout: 1 });
    }
  });

  it("accepts the same code again once 120 seconds have passed", async () => {
    const code = digest();
    await loginRole("influx_auth_login").begin(async (tx) => {
      await takeRole(tx, "influx_auth");
      expect(await accept(tx, code)).toBe(true);
    });
    await migration`
      update identity.totp_replay_guards set created_at = now() - interval '121 seconds'
       where account_id = ${fixture.account} and code_hmac = ${code}`;
    const again = await asAuth((tx) => accept(tx, code));
    expect(again).toBe(true);
  });
});

describe("EC-3 and EC-47: the rate-limit counters (0014)", () => {
  function reserve(
    tx: postgres.TransactionSql,
    key: Buffer,
    limit: number,
    scope = "login_request",
    window = "15m",
  ): Promise<ProbeResult> {
    return probe(
      tx,
      `select 1 from (select identity.reserve_auth_attempt($1::identity.throttle_scope, $2,
         $3::identity.throttle_window, $4) as allowed) r where allowed`,
      [scope, key, window, limit],
    );
  }

  it("allows five attempts on a login request, then refuses the sixth", async () => {
    const key = digest();
    const results = await asAuth(async (tx) => {
      const outcomes: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const result = await reserve(tx, key, 5);
        outcomes.push(result.outcome === "rows" ? result.count : -1);
      }
      return outcomes;
    });
    expect(results).toEqual([1, 1, 1, 1, 1, 0]);
  });

  it("gives exactly five attempts to ten parallel requests on the same key", async () => {
    const key = digest();
    const pool = connectAsLoginRole("influx_auth_login", { max: 10 });
    try {
      const allowed = await Promise.all(
        Array.from({ length: 10 }, () =>
          pool.begin(async (tx) => {
            await takeRole(tx, "influx_auth");
            const [row] = await tx<{ allowed: boolean }[]>`
              select identity.reserve_auth_attempt('login_request', ${key}, '15m', 5) as allowed`;
            return row?.allowed;
          }),
        ),
      );
      expect(allowed.filter((value) => value === true)).toHaveLength(5);
    } finally {
      await pool.end({ timeout: 1 });
    }
    const [row] = await migration<{ requests: number; denied: number }[]>`
      select request_count as requests, denied_count as denied
        from identity.auth_request_throttle
       where scope = 'login_request' and scope_key_hash = ${key} and window_code = '15m'`;
    expect(row).toEqual({ requests: 5, denied: 5 });
  });

  it("restarts the window after its end, and counts the failures of the current window", async () => {
    const key = digest();
    await loginRole("influx_auth_login").begin(async (tx) => {
      await takeRole(tx, "influx_auth");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await tx`select identity.reserve_auth_attempt('backoffice_login_ip', ${key}, '1h', 3)`;
        await tx`select identity.record_auth_failure('backoffice_login_ip', ${key}, '1h')`;
      }
    });
    const before = await asAuth(async (tx) => {
      const [refused] = await tx<{ allowed: boolean }[]>`
        select identity.reserve_auth_attempt('backoffice_login_ip', ${key}, '1h', 3) as allowed`;
      const [count] = await tx<{ failures: number }[]>`
        select identity.auth_failure_count('backoffice_login_ip', ${key}, '1h') as failures`;
      return { allowed: refused?.allowed, failures: count?.failures };
    });
    expect(before).toEqual({ allowed: false, failures: 3 });
    await migration`
      update identity.auth_request_throttle set window_started_at = now() - interval '61 minutes'
       where scope = 'backoffice_login_ip' and scope_key_hash = ${key}`;
    const after = await asAuth(async (tx) => {
      const [count] = await tx<{ failures: number }[]>`
        select identity.auth_failure_count('backoffice_login_ip', ${key}, '1h') as failures`;
      const [allowed] = await tx<{ allowed: boolean }[]>`
        select identity.reserve_auth_attempt('backoffice_login_ip', ${key}, '1h', 3) as allowed`;
      const [failure] = await tx<{ failures: number }[]>`
        select identity.record_auth_failure('backoffice_login_ip', ${key}, '1h') as failures`;
      return {
        before: count?.failures,
        allowed: allowed?.allowed,
        failures: failure?.failures,
      };
    });
    expect(after).toEqual({ before: 0, allowed: true, failures: 1 });
  });

  it.each([
    ["a key that is not a 32-byte digest", Buffer.alloc(16), 5],
    ["a limit of zero", digest(), 0],
    ["an absurd limit", digest(), 100000],
  ])("refuses %s (22023)", async (_label, key, limit) => {
    const result = await asAuth((tx) => reserve(tx, key, limit));
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("gives influx_auth no direct right on the counters: it cannot reset one", async () => {
    for (const statement of [
      "select request_count from identity.auth_request_throttle limit 1",
      "update identity.auth_request_throttle set request_count = 0",
      "delete from identity.auth_request_throttle",
    ]) {
      expect(await asAuth((tx) => probe(tx, statement)), statement).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
  });
});

describe("D43: the journal of the sign-in code (0015)", () => {
  const agent = () => dataSet.accounts.agent.a.id;

  function insert(columns: string, values: string, parameters: unknown[] = []) {
    return asAuth((tx) =>
      probe(
        tx,
        `insert into leads.transactional_sends (${columns}) values (${values})`,
        parameters as never[],
      ),
    );
  }

  it("journals a P0 line with an account, and reads back its id and random reference", async () => {
    const row = await asAuth(async (tx) => {
      const [inserted] = await tx<
        { id: string; reference: string; status: string }[]
      >`
        insert into leads.transactional_sends (email_code, priority, account_id, locale)
        values ('auth.login_code', 'p0', ${agent()}, 'fr')
        returning id::text, reference::text, status::text`;
      return inserted;
    });
    expect(row?.status).toBe("queued");
    expect(row?.reference).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it.each([
    [
      "an account AND an address",
      "email_code, priority, account_id, recipient_email, locale",
      "'auth.login_code', 'p0', $1, 'x@example.test', 'fr'",
      true,
    ],
    [
      "neither an account nor an address",
      "email_code, priority, locale",
      "'auth.login_code', 'p0', 'fr'",
      false,
    ],
    [
      "an address that is not normalised",
      "email_code, priority, recipient_email, locale",
      "'auth.login_code', 'p0', 'Someone@Example.test', 'fr'",
      false,
    ],
    [
      "a template without its version (EC-6)",
      "email_code, priority, account_id, locale, template_ref",
      "'auth.login_code', 'p0', $1, 'fr', 'auth.login_code'",
      true,
    ],
  ])("refuses %s (23514)", async (_label, columns, values, withAccount) => {
    const result = await insert(columns, values, withAccount ? [agent()] : []);
    expect(result).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });

  it.each([
    [
      "a P1 line",
      "email_code, priority, account_id, locale",
      "'auth.new_device', 'p1', $1, 'fr'",
    ],
    [
      "a non-authentication e-mail",
      "email_code, priority, account_id, locale",
      "'marketing.newsletter', 'p0', $1, 'fr'",
    ],
    [
      "a queue event (EC-7)",
      "email_code, priority, account_id, locale, outbox_event_id",
      "'auth.login_code', 'p0', $1, 'fr', 1",
    ],
    [
      "a status other than queued",
      "email_code, priority, account_id, locale, status",
      "'auth.login_code', 'p0', $1, 'fr', 'sent'",
    ],
  ])("refuses %s to influx_auth (42501)", async (_label, columns, values) => {
    const result = await insert(columns, values, [agent()]);
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("records the single attempt: sent with a message id, or failed with one of three causes", async () => {
    const results = await asAuth(async (tx) => {
      const lines: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        const [row] = await tx<{ id: string }[]>`
          insert into leads.transactional_sends (email_code, priority, account_id, locale)
          values ('auth.login_code', 'p0', ${agent()}, 'fr') returning id::text`;
        lines.push(row?.id ?? "");
      }
      const [noId, sent, badCause, failed] = lines;
      return {
        sentWithoutId: await probe(
          tx,
          "update leads.transactional_sends set status = 'sent' where id = $1",
          [noId ?? ""],
        ),
        sent: await probe(
          tx,
          "update leads.transactional_sends set status = 'sent', provider_message_id = $2 where id = $1",
          [sent ?? "", `<${randomUUID()}@smtp-relay.example.test>`],
        ),
        afterSent: await probe(
          tx,
          "update leads.transactional_sends set status = 'failed', failure_code = 'provider_unavailable' where id = $1",
          [sent ?? ""],
        ),
        badCause: await probe(
          tx,
          "update leads.transactional_sends set status = 'failed', failure_code = 'account_unknown' where id = $1",
          [badCause ?? ""],
        ),
        failed: await probe(
          tx,
          "update leads.transactional_sends set status = 'failed', failure_code = 'provider_unavailable' where id = $1",
          [failed ?? ""],
        ),
        deleted: await probe(
          tx,
          "delete from leads.transactional_sends where id = $1",
          [failed ?? ""],
        ),
        readAccount: await probe(
          tx,
          "select account_id from leads.transactional_sends",
        ),
      };
    });
    expect(results).toEqual({
      sentWithoutId: { outcome: "error", code: CHECK_VIOLATION },
      sent: { outcome: "rows", count: 1 },
      // the policy only lets influx_auth touch a queued line: the acknowledgement is the worker's
      afterSent: { outcome: "rows", count: 0 },
      badCause: { outcome: "error", code: CHECK_VIOLATION },
      failed: { outcome: "rows", count: 1 },
      deleted: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      readAccount: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });

  it("keeps the description append-only and the status moving forward, even for the migration role", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into leads.transactional_sends (email_code, priority, account_id, locale)
        values ('auth.login_code', 'p0', ${agent()}, 'fr') returning id::text`;
      const id = row?.id ?? "";
      const outcome = {
        recode: await probe(
          tx,
          "update leads.transactional_sends set email_code = 'auth.new_device' where id = $1",
          [id],
        ),
        skip: await probe(
          tx,
          "update leads.transactional_sends set status = 'delivered', sent_at = now(), delivered_at = now(), provider_message_id = 'm' where id = $1",
          [id],
        ),
        backdated: await probe(
          tx,
          "update leads.transactional_sends set status = 'sent', provider_message_id = 'm', sent_at = now() - interval '1 day' where id = $1",
          [id],
        ),
      };
      const [read] = await tx<{ sent_now: boolean }[]>`
        select sent_at = now() as sent_now from leads.transactional_sends where id = ${id}`;
      return {
        ...outcome,
        sentNow: read?.sent_now,
        back: await probe(
          tx,
          "update leads.transactional_sends set status = 'queued', sent_at = null where id = $1",
          [id],
        ),
        newId: await probe(
          tx,
          "update leads.transactional_sends set provider_message_id = 'other' where id = $1",
          [id],
        ),
      };
    });
    expect(results).toEqual({
      recode: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      skip: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      backdated: { outcome: "rows", count: 1 },
      sentNow: true,
      back: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      newId: { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    });
  });
});
