// Backoffice authentication without the database (docs/mvp/03 B-1, MFA-3, §6.2; 18 T8.8; 21 §3
// EC-17, EC-55, EC-57; J3-A d and the security arbitration of B-1): recovery codes and enrollment
// tokens, the rules of a new password and its gate before GoTrue (J3S-5), the k-anonymity lookup
// with a FAKE fetch (no external call), the aal2 assertion, the pass-through of the B-5 guard
// (J3S-4), and the static guards. The flows themselves run on the local stack:
// db-tests/t8-backoffice-sign-in.test.ts.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECOVERY_CODE_DISPLAY_PATTERN } from "@influx/contracts/backoffice-auth";
import { listSourceFiles, SCRIPT_EXTENSIONS } from "@influx/test-kit/static";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  SessionNotFoundError,
  type ApiDatabase,
  type Transaction,
  type UserContext,
} from "../src/db/index.ts";
import { BACKOFFICE_SESSIONLESS_ROUTES } from "../src/domains/identity/backoffice-routes.ts";
import {
  assertBackofficeContext,
  runSensitiveAction,
} from "../src/domains/identity/backoffice-session.ts";
import {
  enrollmentTokenHashOf,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  recoveryCodeHashOf,
} from "../src/domains/identity/mfa-secrets.ts";
import {
  localPasswordVerdict,
  newPasswordVerdict,
  withNewPassword,
} from "../src/domains/identity/password-policy.ts";
import {
  createPwnedPasswordCheck,
  PWNED_PASSWORDS_RANGE_URL,
} from "../src/platform/hibp.ts";
import { ApiError } from "../src/platform/errors.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
} from "./helpers.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function sourceFilesMentioning(pattern: RegExp): string[] {
  return listSourceFiles(path.join(API_ROOT, "src"), SCRIPT_EXTENSIONS)
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(API_ROOT, file).split(path.sep).join("/"))
    .sort();
}

describe("EC-17, J3-C rule 9: recovery codes", () => {
  it("draws ten distinct codes of 16 Crockford characters, shown by groups of four", () => {
    const batch = generateRecoveryCodes();
    expect(batch.displayed).toHaveLength(10);
    expect(new Set(batch.displayed).size).toBe(10);
    for (const code of batch.displayed) {
      expect(code).toMatch(RECOVERY_CODE_DISPLAY_PATTERN);
    }
    expect(batch.hashes).toHaveLength(10);
  });

  it("keeps the SHA-256 of the normalised code only", () => {
    const batch = generateRecoveryCodes();
    const first = batch.displayed[0] ?? "";
    const normalized = normalizeRecoveryCode(first);
    expect(normalized).toBe(first.replaceAll("-", ""));
    expect(
      batch.hashes[0]?.equals(
        createHash("sha256")
          .update(normalized ?? "", "utf8")
          .digest(),
      ),
    ).toBe(true);
  });

  it("ignores case, spaces and dashes, reads O as 0 and I, L as 1", () => {
    expect(normalizeRecoveryCode("abcd efgh-jkmn pqrs")).toBe(
      "ABCDEFGHJKMNPQRS",
    );
    expect(normalizeRecoveryCode("O0IL-1111-2222-3333")).toBe(
      "0011111122223333",
    );
    expect(recoveryCodeHashOf("0011111122223333")).toHaveLength(32);
  });

  it("refuses what cannot be a code (length, U, other characters)", () => {
    for (const typed of [
      "",
      "ABCD-EFGH-JKMN",
      "ABCD-EFGH-JKMN-PQRU",
      "ABCD-EFGH-JKMN-PQR!",
    ]) {
      expect(normalizeRecoveryCode(typed)).toBeNull();
    }
  });
});

describe("G-1 point 2: enrollment tokens", () => {
  it("hashes the 32 bytes of a base64url token, and nothing else", () => {
    const bytes = randomBytes(32);
    const token = bytes.toString("base64url");
    expect(
      enrollmentTokenHashOf(token)?.equals(
        createHash("sha256").update(bytes).digest(),
      ),
    ).toBe(true);
    for (const wrong of ["", "short", `${token}A`, token.replace(/.$/, "+")]) {
      expect(enrollmentTokenHashOf(wrong)).toBeNull();
    }
  });
});

describe("B-1, EC-57: rules of a new password", () => {
  const EMAIL = "camille.martin@example.test";

  it("applies the bounds of EC-57 first", () => {
    expect(localPasswordVerdict("elevenchars", EMAIL)).toBe("too_short");
    expect(localPasswordVerdict("é".repeat(36) + "a", EMAIL)).toBe("too_long");
    expect(localPasswordVerdict("é".repeat(36), EMAIL)).toBe("accepted");
  });

  it("refuses the local part of the address and the word influx, whatever the case", () => {
    expect(localPasswordVerdict("my Camille.Martin phrase", EMAIL)).toBe(
      "context",
    );
    expect(localPasswordVerdict("joining INFLUX today", EMAIL)).toBe("context");
    expect(localPasswordVerdict("four random words here", EMAIL)).toBe(
      "accepted",
    );
  });

  it("looks the password up only when the local rules pass, and fails closed", async () => {
    const looked: string[] = [];
    const lookup =
      (verdict: "clear" | "compromised" | "unavailable") =>
      async (password: string) => {
        looked.push(password);
        return verdict;
      };
    expect(await newPasswordVerdict("short", EMAIL, lookup("clear"))).toBe(
      "too_short",
    );
    expect(looked).toEqual([]);
    const fine = "four random words here";
    expect(await newPasswordVerdict(fine, EMAIL, lookup("clear"))).toBe(
      "accepted",
    );
    expect(await newPasswordVerdict(fine, EMAIL, lookup("compromised"))).toBe(
      "compromised",
    );
    expect(await newPasswordVerdict(fine, EMAIL, lookup("unavailable"))).toBe(
      "check_unavailable",
    );
  });
});

describe("J3S-5: a chosen password reaches GoTrue only once B-1 accepts it", () => {
  const EMAIL = "camille.martin@example.test";
  const FINE = "four random words here";

  function gate(verdict: "clear" | "compromised" | "unavailable") {
    const lines: { object: object; message: string }[] = [];
    let gotrueCalls = 0;
    const run = (password: string) =>
      withNewPassword(
        async () => verdict,
        { info: (object, message) => lines.push({ object, message }) },
        { password, email: EMAIL },
        async () => {
          gotrueCalls += 1;
          return "user";
        },
      );
    return { run, lines, gotrueCalls: () => gotrueCalls };
  }

  it("calls GoTrue on an accepted password only, and gives back its result", async () => {
    const accepted = gate("clear");
    expect(await accepted.run(FINE)).toEqual({
      verdict: "accepted",
      value: "user",
    });
    expect(accepted.gotrueCalls()).toBe(1);
    expect(accepted.lines).toEqual([]);
  });

  it("never calls GoTrue on a compromised, unverifiable or locally refused password; logs the verdict only", async () => {
    for (const [verdict, password, expected] of [
      ["compromised", FINE, "compromised"],
      ["unavailable", FINE, "check_unavailable"],
      ["clear", "qwerty7", "too_short"],
      ["clear", "joining INFLUX today", "context"],
    ] as const) {
      const refused = gate(verdict);
      expect(await refused.run(password)).toEqual({ verdict: expected });
      expect(refused.gotrueCalls()).toBe(0);
      expect(refused.lines).toEqual([
        { object: { verdict: expected }, message: "new password refused" },
      ]);
      expect(JSON.stringify(refused.lines)).not.toContain(password);
    }
  });

  it("is the one caller of newPasswordVerdict in src/, and the server hands the backoffice a lookup", () => {
    expect(sourceFilesMentioning(/newPasswordVerdict\(/)).toEqual([
      "src/domains/identity/password-policy.ts",
    ]);
    expect(sourceFilesMentioning(/createPwnedPasswordCheck\(/)).toEqual([
      "src/platform/hibp.ts",
      "src/server.ts",
    ]);
  });
});

describe("J3S-4: the guard of the B-5 actions lets every other error through", () => {
  // Neither branch reads the database: the R reading follows a deliberate refusal only.
  const database = {} as ApiDatabase;
  const context = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    accountId: "00000000-0000-4000-8000-000000000002",
    role: "admin",
    aal: "aal2",
  } as const;

  function failingWith(error: Error) {
    return runSensitiveAction(
      database,
      "request",
      (fn) => fn({} as Transaction, context),
      async () => {
        throw error;
      },
    );
  }

  it("keeps a 42501 that is not the database's refusal (a missing grant: our fault, a 500)", async () => {
    const grant = Object.assign(
      new Error("permission denied for function grant_role"),
      { code: "42501" },
    );
    await expect(failingWith(grant)).rejects.toBe(grant);
    const wrapped = new Error("Failed query", { cause: grant });
    await expect(failingWith(wrapped)).rejects.toBe(wrapped);
  });

  it("keeps any other error, and a refusal before the session was resolved", async () => {
    const unique = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    await expect(failingWith(unique)).rejects.toBe(unique);
    const refused = Object.assign(new Error("forbidden"), { code: "42501" });
    await expect(
      runSensitiveAction(
        database,
        "request",
        async () => {
          throw refused;
        },
        async () => "never",
      ),
    ).rejects.toBe(refused);
  });

  it("returns what the action returns", async () => {
    expect(
      await runSensitiveAction(
        database,
        "request",
        (fn) => fn({} as Transaction, context),
        async (_tx, seen) => seen.sessionId,
      ),
    ).toBe(context.sessionId);
  });
});

describe("B-1: k-anonymity lookup, with a fake fetch only", () => {
  const PASSWORD = "correct horse battery staple";
  const DIGEST = createHash("sha1")
    .update(PASSWORD, "utf8")
    .digest("hex")
    .toUpperCase();
  const PREFIX = DIGEST.slice(0, 5);
  const SUFFIX = DIGEST.slice(5);
  const OTHER = "0".repeat(35);

  type Call = { url: string; init: RequestInit | undefined };

  function fakeFetch(
    answer: () => Response | Promise<Response>,
    calls: Call[] = [],
  ): typeof fetch {
    return async (input, init) => {
      calls.push({ url: String(input), init });
      return answer();
    };
  }

  it("(a) sends the five first characters of the SHA-1 only, upper case, padded", async () => {
    const calls: Call[] = [];
    const check = createPwnedPasswordCheck({
      fetch: fakeFetch(() => new Response(`${OTHER}:3\n`), calls),
      timeoutMs: 2_000,
    });
    await check(PASSWORD);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${PWNED_PASSWORDS_RANGE_URL}${PREFIX}`);
    const sent = JSON.stringify(calls);
    expect(sent).not.toContain(PASSWORD);
    expect(sent).not.toContain(SUFFIX);
    expect(sent.toLowerCase()).not.toContain(DIGEST.toLowerCase());
    expect(calls[0]?.init?.headers).toEqual({
      "Add-Padding": "true",
      "User-Agent": "influx-api",
    });
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("(b) refuses a suffix present with a positive count", async () => {
    const check = createPwnedPasswordCheck({
      fetch: fakeFetch(() => new Response(`${OTHER}:1\r\n${SUFFIX}:42\r\n`)),
      timeoutMs: 2_000,
    });
    expect(await check(PASSWORD)).toBe("compromised");
  });

  it("(c) accepts a suffix present with a count of 0 (a padding line)", async () => {
    const check = createPwnedPasswordCheck({
      fetch: fakeFetch(() => new Response(`${SUFFIX}:0\n${OTHER}:5\n`)),
      timeoutMs: 2_000,
    });
    expect(await check(PASSWORD)).toBe("clear");
  });

  it("(d) accepts an absent suffix", async () => {
    const check = createPwnedPasswordCheck({
      fetch: fakeFetch(() => new Response(`${OTHER}:7\n`)),
      timeoutMs: 2_000,
    });
    expect(await check(PASSWORD)).toBe("clear");
  });

  it("(e) fails closed on a time-out, a 503 and a malformed or empty body", async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => new Response("", { status: 503 }),
      () => new Response("<html>not a range</html>"),
      () => new Response(""),
      () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    ];
    for (const answer of answers) {
      const check = createPwnedPasswordCheck({
        fetch: fakeFetch(answer),
        timeoutMs: 2_000,
      });
      expect(await check(PASSWORD)).toBe("unavailable");
    }
  });

  it("(f) is the only module of src/ that names the service", () => {
    expect(sourceFilesMentioning(/pwnedpasswords\.com/i)).toEqual([
      "src/platform/hibp.ts",
    ]);
  });
});

describe("03 §6.2, T8.8: the context of a backoffice route", () => {
  const base = {
    sessionId: "00000000-0000-4000-8000-000000000001",
    accountId: "00000000-0000-4000-8000-000000000002",
  };

  it("accepts an internal account in aal2", () => {
    const context: UserContext = { ...base, role: "agent", aal: "aal2" };
    expect(() => assertBackofficeContext(context)).not.toThrow();
  });

  it("answers 403 to an internal session below aal2", () => {
    const context: UserContext = { ...base, role: "admin", aal: "aal1" };
    expect(() => assertBackofficeContext(context)).toThrow(ApiError);
    try {
      assertBackofficeContext(context);
    } catch (error) {
      expect((error as ApiError).code).toBe("forbidden");
    }
  });

  it("treats a member session as no session (401)", () => {
    const context: UserContext = { ...base, role: "creator", aal: "aal1" };
    expect(() => assertBackofficeContext(context)).toThrow(
      SessionNotFoundError,
    );
  });
});

describe("the aal2 guard of server.ts (03 §6.2, 18 T8.8)", () => {
  let app: ApiServer | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("answers 401 on every /v1/bo/ route outside the closed sessionless list, before its handler", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    let reached = 0;
    app.post(
      "/v1/bo/forgotten-guard",
      { schema: { response: { 200: z.strictObject({}) } } },
      async () => {
        reached += 1;
        return {};
      },
    );
    const headers = {
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
    };
    for (const [method, url] of [
      ["POST", "/v1/bo/forgotten-guard"],
      ["GET", "/v1/bo/me"],
      ["POST", "/v1/bo/auth/reauthenticate"],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: {
          ...headers,
          cookie: `__Host-influx-ops-session=not-a-session`,
        },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("unauthenticated");
    }
    expect(reached).toBe(0);
  });

  it("lists as sessionless the sign-in, the two enrollment requests and the logout only", () => {
    expect([...BACKOFFICE_SESSIONLESS_ROUTES].sort()).toEqual([
      "/v1/bo/auth/enroll",
      "/v1/bo/auth/enroll/confirm",
      "/v1/bo/auth/login",
      "/v1/bo/auth/logout",
    ]);
  });
});

describe("EC-55: a password is verified for the backoffice only", () => {
  it("calls withPasswordSession and verifyPassword from the backoffice sign-in module only", () => {
    expect(
      sourceFilesMentioning(/\.(withPasswordSession|verifyPassword)\(/),
    ).toEqual(["src/domains/identity/backoffice-sign-in.ts"]);
  });

  it("serves the backoffice sign-in routes under /v1/bo/ only", () => {
    expect(sourceFilesMentioning(/["`]\/v1\/bo\/auth\//)).toEqual([
      "src/domains/identity/backoffice-routes.ts",
    ]);
  });
});
