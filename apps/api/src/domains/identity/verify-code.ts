// POST /v1/auth/verify-code (docs/mvp/05 RG42 to RG47, RG53, RG66 to RG69, RG136 to RG140; 21 §3
// EC-3, EC-4; 03 P7 E-2). The route (routes.ts) owns the validation and the cookies.
//
//   1  The login cookie (signature, type `login`, expiry), else `session_lost` without GoTrue.
//      The address comes from the cookie, never from the body (EC-3 point 3).
//   2  Ten minutes after the request, `expired` whatever the code, no attempt counted (RG136).
//   3  Transaction A, E-2: the failures of the network (20 per hour, RG44, EC-3 point 5), then
//      ONE attempt reserved on the login request (five, EC-3 point 2), before GoTrue is called.
//   4  GoTrue verifies the code (J3-A b3); its session is signed out at once (J3-C rule 2).
//   5  A wrong code: transaction B counts the failure; at the fifth, the code is regenerated
//      without being sent, so that it dies at GoTrue too (EC-3 point 4, G-1).
//   6  A right code: transaction C finds the account by the GoTrue user id (J3-C rule 3) and
//      routes by its real role (RG66 to RG69): member session, sign-up token, or no session.
// Before a successful verification, the outcome depends on the code, the journey and the
// network, never on the account (RG138). A member session opened from a browser the account has not
// used for 30 days queues the e-mail auth.new_device, in the same transaction (05 RG141, RG142,
// EC-43): never a block, never a step more. Steps 3 to 5 (checkEmailCode) also check the code of a
// member re-authentication (reauthentication.ts, J7 decision 4), under its own motif.
import type { SignupDoor, VerifyCodeResponse } from "@influx/contracts/auth";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import { createHash, randomBytes } from "node:crypto";
import {
  withElevatedTransaction,
  type ApiDatabase,
  type ElevatedResult,
  type Transaction,
} from "../../db/index.ts";
import {
  LOGIN_TOKEN_TTL_SECONDS,
  type AuthTokenCodec,
} from "../../platform/auth-tokens.ts";
import {
  gotrueForwardedAddressOf,
  type ClientAddress,
} from "../../platform/client-address.ts";
import type { GoTrueIdentity, SupabaseAuth } from "../../platform/supabase.ts";
import {
  accountOfAuthUser,
  emailIsTaken,
  failureCount,
  insertMemberSession,
  recordAuthFailure,
  recordCodeFailure,
  reserveAuthAttempt,
  signalNewBrowser,
} from "./repository.ts";
import {
  CODE_ATTEMPTS,
  CODE_VALIDITY_SECONDS,
  CODE_VERIFY_FAILURES_PER_IP_HOUR,
  CODE_VERIFY_TIMEOUT_MS,
  VERIFY_FAILURE_SPIKE,
} from "./settings.ts";
import {
  addressThrottleKey,
  emailThrottleKey,
  globalThrottleKey,
  loginRequestThrottleKey,
} from "./throttle-keys.ts";

export type VerifyCodeLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type VerifyCodeDependencies = {
  database: ApiDatabase;
  supabaseAuth: Pick<SupabaseAuth, "verifyEmailCode" | "generateEmailCode">;
  tokens: AuthTokenCodec;
  pepper: string;
  now: () => Date;
};

export type VerifyCodeRequest = {
  requestId: string;
  loginCookie: string | null;
  code: string;
  door: SignupDoor;
  clientAddress: ClientAddress;
  browser: UserAgentSummary;
  logger: VerifyCodeLogger;
};

/** What the route writes besides the answer. */
export type VerifyCodeEffects = {
  clearLogin: boolean;
  /** A member session: the raw identifier of the cookie (never stored, never logged). */
  session: { token: string } | null;
  /** The signed sign-up token (EC-4). */
  signupToken: string | null;
};

export type VerifyCodeResult = {
  response: VerifyCodeResponse;
  effects: VerifyCodeEffects;
};

const NO_EFFECT: VerifyCodeEffects = {
  clearLogin: false,
  session: null,
  signupToken: null,
};

function answer(
  response: VerifyCodeResponse,
  effects: Partial<VerifyCodeEffects> = {},
): VerifyCodeResult {
  return { response, effects: { ...NO_EFFECT, ...effects } };
}

/** What transaction C decides once the code is right (RG66 to RG69, EC-4). */
type Routing =
  | { kind: "session"; role: SignupDoor }
  | { kind: "signup" }
  | { kind: "internal" }
  | { kind: "unavailable" }
  | { kind: "anomaly" };

function secondsOf(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** The per-network key of the verification counters; one global key for an unknown address. */
function networkKey(pepper: string, address: ClientAddress): Buffer {
  return address.status === "known"
    ? addressThrottleKey(address)
    : globalThrottleKey(pepper, "code_verify_unknown_ip");
}

/**
 * Steps 3 to 5 for one code of a known send: the counters, GoTrue, the failures. Shared by the
 * sign-in and the re-authentication of a member (J7 decision 4), each under its own motif. The
 * refusals are outcomes of both contracts.
 */
export type CodeCheck =
  | { kind: "verified"; identity: GoTrueIdentity }
  /** GoTrue verified the code for another address: an anomaly, the journey is lost. */
  | { kind: "mismatch" }
  | {
      kind: "refused";
      response:
        | { outcome: "too_many_requests" }
        | { outcome: "too_many_attempts" }
        | { outcome: "verify_unavailable" }
        | { outcome: "invalid"; attemptsLeft: number };
    };

/**
 * An elevated transaction under the caller's motif, named by the caller as a literal (18 T6.1):
 * identity.verify_code for the sign-in, identity.member_reauthenticate for a re-authentication.
 */
export type ElevatedRunner = <T>(
  fn: (tx: Transaction) => Promise<ElevatedResult<T>>,
) => Promise<T>;

export type CodeCheckRequest = {
  requestId: string;
  /** The random reference of the journal line of the send (EC-3 point 1). */
  reference: string;
  email: string;
  code: string;
  clientAddress: ClientAddress;
  logger: VerifyCodeLogger;
};

export async function checkEmailCode(
  dependencies: Pick<VerifyCodeDependencies, "supabaseAuth" | "pepper">,
  inMotif: ElevatedRunner,
  request: CodeCheckRequest,
): Promise<CodeCheck> {
  const { pepper } = dependencies;
  const referenceKey = loginRequestThrottleKey(pepper, request.reference);
  const ipKey = networkKey(pepper, request.clientAddress);

  // Step 3: transaction A (E-2), committed before GoTrue is called (G4). No audit line: only
  // a counter is written (EC-52).
  const admitted = await inMotif(async (tx) => {
    const ipFailures = await failureCount(tx, "code_verify_ip", ipKey, "1h");
    if (ipFailures >= CODE_VERIFY_FAILURES_PER_IP_HOUR) {
      return { value: "too_many_requests" as const, auditSubject: null };
    }
    const reserved = await reserveAuthAttempt(
      tx,
      "login_request",
      referenceKey,
      "15m",
      CODE_ATTEMPTS,
    );
    return {
      value: reserved ? ("admitted" as const) : ("too_many_attempts" as const),
      auditSubject: null,
    };
  });
  if (admitted !== "admitted") {
    return { kind: "refused", response: { outcome: admitted } };
  }

  // Step 4: GoTrue (J3-A b3), with the pseudonymous address of the client (EC-38).
  const verified = await dependencies.supabaseAuth.verifyEmailCode(
    {
      forwardedFor: gotrueForwardedAddressOf(request.clientAddress, pepper),
      timeoutMs: CODE_VERIFY_TIMEOUT_MS,
    },
    request.email,
    request.code,
  );

  if (!verified.ok) {
    if (verified.reason === "unavailable") {
      request.logger.warn(
        { errorCode: verified.errorCode, status: verified.status },
        "login code: GoTrue verification unavailable",
      );
      return { kind: "refused", response: { outcome: "verify_unavailable" } };
    }
    // Step 5: a wrong (or dead) code. Transaction B (E-2): the failure only, no audit line.
    const failures = await inMotif(async (tx) => {
      const ofCode = await recordAuthFailure(
        tx,
        "login_request",
        referenceKey,
        "15m",
      );
      await recordAuthFailure(tx, "code_verify_ip", ipKey, "1h");
      const ofPlatform = await recordAuthFailure(
        tx,
        "code_verify_platform",
        globalThrottleKey(pepper, "code_verify_platform"),
        "15m",
      );
      // AL59 (J3S-8, 15 RG165): the failures of this address over 24 hours, by its digest only;
      // the alert is the worker's, from its threshold in base, and nothing is ever blocked (A-4).
      await recordCodeFailure(tx, emailThrottleKey(pepper, request.email));
      return { value: { ofCode, ofPlatform }, auditSubject: null };
    });
    if (failures.ofPlatform >= VERIFY_FAILURE_SPIKE) {
      // EC-3 point 6 (A-3): alert of the J9; at J3, an error line without data.
      request.logger.error(
        { failures: failures.ofPlatform },
        "security.verify_failure_spike",
      );
    }
    if (failures.ofCode < CODE_ATTEMPTS) {
      return {
        kind: "refused",
        response: {
          outcome: "invalid",
          attemptsLeft: CODE_ATTEMPTS - failures.ofCode,
        },
      };
    }
    // EC-3 point 4: the fifth failure kills the code at GoTrue too: a new one is generated and
    // thrown away, unread and unlogged (J3-A b4).
    const regenerated = await dependencies.supabaseAuth.generateEmailCode(
      request.email,
    );
    if (!regenerated.ok) {
      request.logger.warn(
        { errorCode: regenerated.errorCode, status: regenerated.status },
        "login code: regeneration after the fifth failure failed",
      );
    }
    return { kind: "refused", response: { outcome: "too_many_attempts" } };
  }

  // Step 6: the identity GoTrue returned (J3-C rule 3); the address must be the journey's.
  if (verified.value.email !== request.email) {
    request.logger.error({}, "login code: GoTrue returned another address");
    return { kind: "mismatch" };
  }
  return { kind: "verified", identity: verified.value };
}

export async function verifyLoginCode(
  dependencies: VerifyCodeDependencies,
  request: VerifyCodeRequest,
): Promise<VerifyCodeResult> {
  const now = dependencies.now();

  // Step 1: the journey (RG47).
  const journey = dependencies.tokens.readLogin(
    request.loginCookie ?? undefined,
    now,
  );
  if (journey === null) {
    return answer(
      { outcome: "session_lost" },
      { clearLogin: request.loginCookie !== null },
    );
  }

  // Step 2: ten minutes after the request, by the server's clock (RG136). The request instant
  // is the expiry of the signed token minus its lifetime.
  const requestedAt = journey.exp - LOGIN_TOKEN_TTL_SECONDS;
  if (secondsOf(now) >= requestedAt + CODE_VALIDITY_SECONDS) {
    return answer({ outcome: "expired" });
  }

  // Steps 3 to 5.
  const checked = await checkEmailCode(
    dependencies,
    (fn) =>
      withElevatedTransaction(
        dependencies.database,
        "identity.verify_code",
        request.requestId,
        fn,
      ),
    {
      requestId: request.requestId,
      reference: journey.ref,
      email: journey.email,
      code: request.code,
      clientAddress: request.clientAddress,
      logger: request.logger,
    },
  );
  if (checked.kind === "mismatch") {
    return answer({ outcome: "session_lost" }, { clearLogin: true });
  }
  if (checked.kind === "refused") {
    // The journey ends with its code; it survives a wrong code, a ceiling or an outage.
    const ends = checked.response.outcome === "too_many_attempts";
    return answer(checked.response, { clearLogin: ends });
  }
  const identity = checked.identity;
  const token = randomBytes(32);
  const outcome = await withElevatedTransaction<Routing>(
    dependencies.database,
    "identity.verify_code",
    request.requestId,
    async (tx) => {
      const account = await accountOfAuthUser(tx, identity.userId);
      if (account === null) {
        // EC-4 point 1: a sign-up token only if no account holds this address either.
        if (await emailIsTaken(tx, identity.email)) {
          return { value: { kind: "anomaly" as const }, auditSubject: null };
        }
        return { value: { kind: "signup" as const }, auditSubject: null };
      }
      if (account.email !== identity.email) {
        return { value: { kind: "anomaly" as const }, auditSubject: null };
      }
      if (account.status !== "active") {
        return { value: { kind: "unavailable" as const }, auditSubject: null };
      }
      if (account.role !== "advertiser" && account.role !== "creator") {
        return { value: { kind: "internal" as const }, auditSubject: null };
      }
      // A member session (A-9): only the SHA-256 of the identifier is stored (EC-2).
      const sessionId = await insertMemberSession(tx, {
        tokenHash: createHash("sha256").update(token).digest(),
        accountId: account.id,
        userAgentSummary: request.browser,
      });
      // RG141, RG142: the first session and a known browser queue nothing.
      if (await signalNewBrowser(tx, sessionId)) {
        request.logger.info({}, "member sign-in: new browser signalled");
      }
      return {
        value: { kind: "session" as const, role: account.role },
        auditSubject: account.id,
      };
    },
  );

  switch (outcome.kind) {
    case "session":
      return answer(
        {
          outcome: "signed_in",
          role: outcome.role,
          roleMismatch: outcome.role !== request.door,
        },
        { clearLogin: true, session: { token: token.toString("base64url") } },
      );
    case "signup":
      return answer(
        { outcome: "signup_required" },
        {
          clearLogin: true,
          signupToken: dependencies.tokens.issueSignup(
            {
              verifiedAt: secondsOf(now),
              authUserId: identity.userId,
              email: identity.email,
              door: request.door,
            },
            now,
          ),
        },
      );
    case "internal":
      return answer({ outcome: "internal_account" }, { clearLogin: true });
    case "unavailable":
      return answer({ outcome: "account_unavailable" }, { clearLogin: true });
    case "anomaly":
      request.logger.error(
        {},
        "login code: account and GoTrue user do not match",
      );
      return answer({ outcome: "account_unavailable" }, { clearLogin: true });
    default:
      throw new Error("unexpected outcome of the verification");
  }
}
