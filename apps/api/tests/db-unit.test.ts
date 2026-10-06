// Unit parts of 18 T4.6 e, T4.8 and T6.2: the decisions of src/db/ that need no database.
import type { ElevatedOperation } from "@influx/contracts/elevated-operations";
import { describe, expect, it } from "vitest";
import {
  ConnectionPool,
  ElevatedOperationRefusedError,
  SessionNotFoundError,
  withElevatedTransaction,
  withUserTransaction,
  type ApiDatabase,
  type DbLogger,
} from "../src/db/index.ts";
import { checkConnectionIdentity } from "../src/db/pool.ts";
import {
  BUSINESS_ROLES,
  isBusinessRole,
  userRoleStatement,
} from "../src/db/roles.ts";
import { TEST_DATABASE_URLS } from "./helpers.ts";

function recordingLogger(): DbLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (object: object, message: string) => {
    lines.push(`${message} ${JSON.stringify(object)}`);
  };
  return { lines, error: write, warn: write, info: write };
}

/** A pool that fails the test if anything tries to connect through it. */
function untouchablePool(
  role: "influx_app" | "influx_auth_login" | "influx_ops_login",
): ConnectionPool {
  const url = {
    influx_app: TEST_DATABASE_URLS.DATABASE_URL,
    influx_auth_login: TEST_DATABASE_URLS.AUTH_DATABASE_URL,
    influx_ops_login: TEST_DATABASE_URLS.OPS_DATABASE_URL,
  }[role];
  const pool = new ConnectionPool(
    { url, role, tls: false },
    { max: 1, applicationName: "test" },
    recordingLogger(),
  );
  pool.acquire = () => {
    throw new Error("a connection was requested");
  };
  pool.verify = () => {
    throw new Error("a connection was requested");
  };
  return pool;
}

describe("T4.8: the role taken comes from a constant table", () => {
  it("maps exactly the four business roles", () => {
    expect([...BUSINESS_ROLES].sort()).toEqual(
      ["admin", "advertiser", "agent", "creator"].sort(),
    );
    for (const role of BUSINESS_ROLES) {
      expect(userRoleStatement(role)).toBe(`set local role influx_${role}`);
    }
  });

  it.each([
    "service",
    "",
    "Admin",
    "admin;",
    'admin"; drop table x; --',
    "influx_admin",
    "constructor",
    "__proto__",
    "toString",
    null,
    undefined,
    42,
  ])("refuses %j", (value) => {
    expect(isBusinessRole(value)).toBe(false);
    expect(userRoleStatement(value)).toBeNull();
  });
});

describe("T4.6 e: identity of a pool when it opens", () => {
  const good = {
    currentUser: "influx_app",
    sessionUser: "influx_app",
    isSuperuser: false,
    bypassesRls: false,
    reachesSuperuser: false,
    reachesBypassRls: false,
  };

  it("accepts the expected role, neither superuser nor bypassrls, directly or by membership", () => {
    expect(checkConnectionIdentity(good, "influx_app")).toEqual({ ok: true });
  });

  it.each([
    [undefined, "role_not_found"],
    [{ ...good, currentUser: "postgres" }, "unexpected_current_user"],
    [{ ...good, currentUser: "influx_admin" }, "unexpected_current_user"],
    [{ ...good, sessionUser: "postgres" }, "unexpected_session_user"],
    [{ ...good, isSuperuser: true }, "superuser"],
    [{ ...good, bypassesRls: true }, "bypassrls"],
    [{ ...good, reachesSuperuser: true }, "superuser_reachable"],
    [{ ...good, reachesBypassRls: true }, "bypassrls_reachable"],
  ] as const)("refuses %j (%s)", (identity, reason) => {
    expect(checkConnectionIdentity(identity, "influx_app")).toEqual({
      ok: false,
      reason,
    });
  });

  it("refuses the right user for the wrong pool", () => {
    expect(checkConnectionIdentity(good, "influx_auth_login")).toEqual({
      ok: false,
      reason: "unexpected_current_user",
    });
  });
});

describe("T6.2: an operation outside the closed union is refused at runtime", () => {
  it.each([
    // Signed (set P) but without a caller yet (not in U): refused like any other value.
    "identity.complete_signup",
    "leads.drain_outbox",
    "privacy.execute_request",
    "anything",
    "",
  ])(
    "refuses %j before any connection, with an error line and no data",
    async (value) => {
      const logger = recordingLogger();
      const database = {
        elevated: {
          auth: untouchablePool("influx_auth_login"),
          ops: untouchablePool("influx_ops_login"),
        },
        logger,
      };
      let ran = false;
      await expect(
        withElevatedTransaction(
          database,
          value as ElevatedOperation,
          "request-id",
          () => {
            ran = true;
            return Promise.resolve({ value: undefined, auditSubject: null });
          },
        ),
      ).rejects.toBeInstanceOf(ElevatedOperationRefusedError);
      expect(ran).toBe(false);
      expect(logger.lines).toEqual(["elevated operation refused {}"]);
    },
  );
});

describe("withUserTransaction without a well-formed token hash", () => {
  it("refuses before any connection", async () => {
    const database: ApiDatabase = {
      app: untouchablePool("influx_app"),
      elevated: {
        auth: untouchablePool("influx_auth_login"),
        ops: untouchablePool("influx_ops_login"),
      },
      logger: recordingLogger(),
    };
    await expect(
      withUserTransaction(
        database,
        { sessionTokenHash: new Uint8Array(31), requestId: "r" },
        () => Promise.resolve(),
      ),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });
});
