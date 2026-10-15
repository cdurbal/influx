// EC-44 (21 §3; J6T-2): what sendCriticalAlerts() does when nothing can be sent, on a fake
// database: no active admin to alert, or a journal that cannot be written. Neither throws (the
// sign-in answer never depends on the alert), neither calls Brevo (a P0 line is written before its
// call), each leaves one `error` line without any data (D60). The real database is
// t8-backoffice-sign-in.
import { describe, expect, it } from "vitest";
import { ConnectionPool, type ApiDatabase } from "../src/db/index.ts";
import { sendCriticalAlerts } from "../src/domains/identity/critical-alert.ts";
import type { TransactionalSender } from "../src/platform/brevo-transactional.ts";
import { TEST_DATABASE_URLS } from "./helpers.ts";

type Line = { message: string; object: object };

function recorder(): { lines: Line[]; write: (o: object, m: string) => void } {
  const lines: Line[] = [];
  return {
    lines,
    write: (object, message) => {
      lines.push({ message, object });
    },
  };
}

/** A pool of the given role whose connections come from `acquire`. */
function fakePool(
  role: "influx_app" | "influx_auth_login" | "influx_ops_login",
  acquire: ConnectionPool["acquire"],
): ConnectionPool {
  const url = {
    influx_app: TEST_DATABASE_URLS.DATABASE_URL,
    influx_auth_login: TEST_DATABASE_URLS.AUTH_DATABASE_URL,
    influx_ops_login: TEST_DATABASE_URLS.OPS_DATABASE_URL,
  }[role];
  const log = recorder();
  const pool = new ConnectionPool(
    { url, role, tls: false },
    { max: 1, applicationName: "test" },
    { error: log.write, warn: log.write, info: log.write },
  );
  pool.acquire = acquire;
  return pool;
}

/** A connection of influx_auth_login on which every query but the role guard returns no row. */
function emptyConnection(statements: unknown[]): ConnectionPool["acquire"] {
  const tx = {
    execute: (statement: unknown) => {
      statements.push(statement);
      return Promise.resolve(
        statements.length === 1
          ? [
              {
                current_user: "influx_auth_login",
                session_user: "influx_auth_login",
              },
            ]
          : [],
      );
    },
  };
  const connection = {
    transaction: <T>(body: (transaction: typeof tx) => Promise<T>) => body(tx),
  };
  // The fake implements only what runGuardedTransaction uses.
  return () =>
    Promise.resolve(
      connection as unknown as Awaited<ReturnType<ConnectionPool["acquire"]>>,
    );
}

function databaseWith(auth: ConnectionPool): ApiDatabase {
  const log = recorder();
  const untouched: ConnectionPool["acquire"] = () => {
    throw new Error("a connection was requested");
  };
  return {
    app: fakePool("influx_app", untouched),
    elevated: { auth, ops: fakePool("influx_ops_login", untouched) },
    logger: { error: log.write, warn: log.write, info: log.write },
  };
}

function senderThatMustNotBeCalled(): TransactionalSender & { calls: number } {
  const sender = {
    calls: 0,
    send: () => {
      sender.calls += 1;
      return Promise.resolve({ status: "unavailable" as const });
    },
  };
  return sender as TransactionalSender & { calls: number };
}

const ALERT = {
  eventType: "agent.break_glass_login" as const,
  auditSeq: "4817",
  recoveryCodesLeft: null,
};

describe("EC-44: a critical alert that cannot leave (J6T-2)", () => {
  it("no active admin: security.critical_alert_no_recipient, nothing written, nothing sent", async () => {
    const statements: unknown[] = [];
    const sender = senderThatMustNotBeCalled();
    const log = recorder();
    await expect(
      sendCriticalAlerts(
        {
          database: databaseWith(
            fakePool("influx_auth_login", emptyConnection(statements)),
          ),
          sender,
        },
        { requestId: "r-1", logger: { error: log.write } },
        "7f6c2a52-1f4e-4c55-9a52-3c1b3b0e8a11",
        [ALERT],
      ),
    ).resolves.toBeUndefined();
    expect(log.lines).toEqual([
      { message: "security.critical_alert_no_recipient", object: {} },
    ]);
    expect(sender.calls).toBe(0);
    // the guard, the role, the request id and the read of the recipients: no journal line
    expect(statements).toHaveLength(4);
  });

  it("the journal cannot be written: security.critical_alert_failed journal_unavailable, nothing sent", async () => {
    const sender = senderThatMustNotBeCalled();
    const log = recorder();
    await expect(
      sendCriticalAlerts(
        {
          database: databaseWith(
            fakePool("influx_auth_login", () =>
              Promise.reject(new Error("connection refused")),
            ),
          ),
          sender,
        },
        { requestId: "r-2", logger: { error: log.write } },
        "7f6c2a52-1f4e-4c55-9a52-3c1b3b0e8a11",
        [ALERT],
      ),
    ).resolves.toBeUndefined();
    expect(log.lines).toEqual([
      {
        message: "security.critical_alert_failed",
        object: { failureCode: "journal_unavailable" },
      },
    ]);
    expect(sender.calls).toBe(0);
  });
});
