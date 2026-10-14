// T8 (J7, commit 8) — the "new browser" signal, the database half (migration 0126; 05 RG141, RG142,
// CA80, CA81; 16 RG85, RG157; 21 EC-43): identity.signal_new_browser(), E-2 identity.verify_code,
// influx_auth only. The route half (a real sign-in) is in t8-verify-code.
//
// Each case runs in ONE rolled-back transaction of the local superuser: the account and its past
// sessions are written there (past dates with session_replication_role = replica: the BEFORE
// INSERT trigger of 0012 would set them to now()), then the session of "this sign-in" is opened
// normally, and the signal is called as apps/api calls it (actAs auth).
import {
  inRolledBackTransaction,
  probe,
  type DataSet,
  type ProbeResult,
  type UserContext,
} from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { actAs, actAsMember, localSuperuser, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const SIGNAL = "select identity.signal_new_browser($1::uuid) as queued";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

async function newAccount(tx: postgres.TransactionSql): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`t8-nb-${id}@example.test`}, now(), 'FR', 'fr',
            true, now(), 'individual'::identity.declared_status)`;
  await tx`
    insert into identity.account_roles (account_id, role)
    values (${id}, 'creator'::identity.account_role)`;
  return id;
}

function tokenHash(): Buffer {
  return createHash("sha256").update(randomBytes(32)).digest();
}

/** A past member session, last active `daysAgo` days ago (null summary allowed: an old row). */
async function pastSession(
  tx: postgres.TransactionSql,
  account: string,
  summary: string | null,
  daysAgo: number,
  revoked = false,
): Promise<string> {
  await tx`set local session_replication_role = replica`;
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions
      (token_hash, account_id, surface, created_at, updated_at, last_activity_at,
       idle_expires_at, absolute_expires_at, user_agent_summary, revoked_at, revocation_reason)
    values (${tokenHash()}, ${account}, 'member',
            now() - make_interval(days => ${daysAgo + 1}),
            now() - make_interval(days => ${daysAgo}),
            now() - make_interval(days => ${daysAgo}),
            now() - make_interval(days => ${daysAgo}) + interval '1 hour',
            now() - make_interval(days => ${daysAgo}) + interval '1 hour',
            ${summary},
            case when ${revoked} then now() - make_interval(days => ${daysAgo}) end,
            case when ${revoked} then 'revoked_by_holder'::identity.session_revocation_reason end)
    returning id::text as id`;
  await tx`set local session_replication_role = origin`;
  return row?.id ?? "";
}

/** The session of this sign-in, opened as verify-code opens it (dates from the trigger). */
async function openSession(
  tx: postgres.TransactionSql,
  account: string,
  summary: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions
      (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${tokenHash()}, ${account}, 'member', null, ${summary})
    returning id::text as id`;
  return row?.id ?? "";
}

async function signal(
  tx: postgres.TransactionSql,
  session: string,
): Promise<boolean> {
  return actAs(tx, "auth", async () => {
    const [row] = await tx.unsafe<{ queued: boolean }[]>(SIGNAL, [session]);
    return row?.queued === true;
  });
}

type Line = {
  event_type: string;
  destination: string;
  priority: number;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

async function linesOf(
  tx: postgres.TransactionSql,
  account: string,
): Promise<Line[]> {
  return tx<Line[]>`
    select event_type, destination::text as destination, priority, payload, idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${account}`} and event_type = 'auth.new_device'
     order by id`;
}

async function today(tx: postgres.TransactionSql): Promise<string> {
  const [row] = await tx<{ day: string }[]>`
    select to_char(now() at time zone 'UTC', 'YYYY-MM-DD') as day`;
  return row?.day ?? "";
}

describe("RG141, CA81: when nothing is signalled", () => {
  it("the first member session of an account never signals (CA81)", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      const queued = await signal(
        tx,
        await openSession(tx, account, "safari.ios"),
      );
      return { queued, lines: await linesOf(tx, account) };
    });
    expect(result).toEqual({ queued: false, lines: [] });
  });

  it("a session with the same summary active within 30 days makes the browser known, revoked or not", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      await pastSession(tx, account, "firefox.windows", 29, true);
      const queued = await signal(
        tx,
        await openSession(tx, account, "firefox.windows"),
      );
      return { queued, lines: await linesOf(tx, account) };
    });
    expect(result).toEqual({ queued: false, lines: [] });
  });

  it("'unidentified' is a value like any other (an old row without summary counts as it)", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      await pastSession(tx, account, null, 10);
      return signal(
        tx,
        await openSession(tx, account, "unidentified.unidentified"),
      );
    });
    expect(result).toBe(false);
  });
});

describe("RG141, RG142, CA80: a new browser queues ONE auth.new_device, P1, ids only", () => {
  it("the only session of the last 30 days is Firefox on Windows; Safari on iOS signals", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      await pastSession(tx, account, "firefox.windows", 2);
      // the same summary, but older than 30 days: no longer a known browser
      await pastSession(tx, account, "safari.ios", 31);
      const session = await openSession(tx, account, "safari.ios");
      const queued = await signal(tx, session);
      return {
        account,
        session,
        queued,
        lines: await linesOf(tx, account),
        day: await today(tx),
      };
    });
    expect(result.queued).toBe(true);
    expect(result.lines).toHaveLength(1);
    const [line] = result.lines;
    expect(line).toMatchObject({
      event_type: "auth.new_device",
      destination: "brevo_transactional",
      priority: 100,
      idempotency_key: `auth.new_device:${result.account}:safari.ios:${result.day}`,
    });
    // RG74: identifiers only
    expect(Object.keys(line?.payload ?? {}).sort()).toEqual([
      "account_id",
      "email_code",
      "event_id",
      "session_id",
    ]);
    expect(line?.payload).toMatchObject({
      account_id: result.account,
      session_id: result.session,
      email_code: "auth.new_device",
    });
  });

  it("the sessions of another account never make a browser known", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      const other = await newAccount(tx);
      await pastSession(tx, account, "firefox.windows", 1);
      await pastSession(tx, other, "chrome.android", 1);
      return signal(tx, await openSession(tx, account, "chrome.android"));
    });
    expect(result).toBe(true);
  });

  it("at most one per account, summary and UTC day: the key of the day already there, nothing more", async () => {
    const result = await scenario(async (tx) => {
      const account = await newAccount(tx);
      await pastSession(tx, account, "firefox.windows", 1);
      const day = await today(tx);
      const event = randomUUID();
      // the line of an earlier sign-in of the same day, its session since aged out of the window
      await tx`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
        values (${event}, 'auth.new_device', 'brevo_transactional', ${`account:${account}`}, 100,
                jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                   'email_code', 'auth.new_device'),
                ${`auth.new_device:${account}:safari.ios:${day}`})`;
      const queued = await signal(
        tx,
        await openSession(tx, account, "safari.ios"),
      );
      return { queued, lines: (await linesOf(tx, account)).length };
    });
    expect(result).toEqual({ queued: false, lines: 1 });
  });
});

describe("0126: who may raise it, and on which session", () => {
  it("only on a member session opened by the calling transaction (55000 otherwise)", async () => {
    const results = await scenario(async (tx) => {
      const account = await newAccount(tx);
      const old = await pastSession(tx, account, "firefox.windows", 1);
      return actAs(tx, "auth", async () => [
        await probe(tx, SIGNAL, [old]),
        await probe(tx, SIGNAL, [randomUUID()]),
      ]);
    });
    expect(results).toEqual([
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
      { outcome: "error", code: NOT_IN_PREREQUISITE_STATE },
    ]);
  });

  it("EXECUTE for influx_auth only: a member and the worker are refused (42501)", async () => {
    const member: UserContext = {
      accountId: dataSet.accounts.advertiser.a.id,
      role: "advertiser",
      aal: "aal1",
    };
    const results = await scenario(async (tx): Promise<ProbeResult[]> => {
      const account = await newAccount(tx);
      const session = await openSession(tx, account, "safari.ios");
      return [
        await actAsMember(tx, "influx_advertiser", member, () =>
          probe(tx, SIGNAL, [session]),
        ),
        await actAs(tx, "worker", () => probe(tx, SIGNAL, [session])),
      ];
    });
    expect(results).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });
});
