// Backoffice sign-in, TOTP enrollment and re-authentication R (docs/mvp/03 §6.1 B-1 to B-8, §6.9
// MFA-1 to MFA-10; 17b §3.14; 21 §4, J3-C rules 2 to 4, 6, 9; EC-17, EC-39, EC-40, EC-44, EC-47,
// EC-55, EC-56, EC-57, G-1). The routes (backoffice-routes.ts) own validation, cookies and floor.
//
// Every operation follows the same order:
//   1  Transaction A (E-2): the attempt is reserved on the counters of EC-47 BEFORE GoTrue (G4).
//   2  GoTrue: password sign-in (EC-57 guard first), then, inside the same GoTrue session, the
//      checks of INFLUX and the second factor (J3-A c5). The GoTrue session is signed out by the
//      adapter whatever happens (rule 2). Database transactions run between GoTrue calls, never
//      around one.
//   3  A last transaction writes the effect (session, pinned factor, fresh proof) and its audit.
//   4  Any failure: transaction F counts it, raises the alerts of EC-47 (audit, `error` line).
// One failure answer whatever the step at fault (17b §3.14 rule 2); `unavailable` only when
// GoTrue could not check the password (rule 5): after it, a breakdown is a refusal too.
import type {
  BackofficeEnrollBody,
  BackofficeEnrollConfirmBody,
  BackofficeEnrollConfirmResponse,
  BackofficeEnrollResponse,
  BackofficeLoginBody,
  BackofficeLoginResponse,
  BackofficeReauthenticateBody,
  BackofficeReauthenticateResponse,
  InternalRole,
} from "@influx/contracts/backoffice-auth";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import { createHash, randomBytes } from "node:crypto";
import {
  withElevatedTransaction,
  type ApiDatabase,
  type ElevatedResult,
  type Transaction,
} from "../../db/index.ts";
import {
  gotrueForwardedAddressOf,
  type ClientAddress,
} from "../../platform/client-address.ts";
import type {
  GoTrueFactor,
  GoTruePasswordSession,
  GoTrueRequestContext,
  SupabaseAuth,
} from "../../platform/supabase.ts";
import {
  acceptTotpCode,
  appendAuthEvent,
  consumeRecoveryCode,
  enrollmentTokenIsValid,
  hasFreshSecondFactorProof,
  insertBackofficeSession,
  internalAccountOfEmail,
  pinMfaFactor,
  recordAuthFailure,
  reauthenticationSessionOf,
  renewSecondFactorProof,
  reserveAuthAttempt,
  revokeAfterFailedReauthentication,
  signInAccountOf,
  sqlStateOf,
  type SignInAccount,
} from "./repository.ts";
import {
  enrollmentTokenHashOf,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  recoveryCodeHashOf,
} from "./mfa-secrets.ts";
import {
  BACKOFFICE_ATTEMPTS_PER_EMAIL_IP_15_MIN,
  BACKOFFICE_ATTEMPTS_PER_IP_HOUR,
  BACKOFFICE_ATTEMPTS_UNKNOWN_IP_HOUR,
  BACKOFFICE_FAILURES_PER_EMAIL_ALERT,
  BACKOFFICE_FAILURES_PLATFORM_ALERT,
  BACKOFFICE_GOTRUE_BUDGET_MS,
  BACKOFFICE_GOTRUE_CALL_TIMEOUT_MS,
  REAUTHENTICATION_FAILURES_PER_SESSION,
  REAUTHENTICATION_FRESHNESS_SECONDS,
  TOTP_FACTOR_NAME,
  TOTP_ISSUER,
} from "./settings.ts";
import {
  addressThrottleKey,
  emailAddressThrottleKey,
  emailThrottleKey,
  globalThrottleKey,
  reauthenticationThrottleKey,
  totpReplayDigest,
} from "./throttle-keys.ts";

export type BackofficeAuthLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type BackofficeAuthDependencies = {
  database: ApiDatabase;
  supabaseAuth: Pick<
    SupabaseAuth,
    "withPasswordSession" | "listFactors" | "deleteFactor"
  >;
  /** AUTH_THROTTLE_PEPPER. */
  pepper: string;
};

export type BackofficeAuthRequest = {
  requestId: string;
  clientAddress: ClientAddress;
  browser: UserAgentSummary;
  logger: BackofficeAuthLogger;
};

/** A new backoffice session: the raw identifier of the cookie (never stored, never logged). */
export type NewSession = { token: string };

type Refused = { outcome: "refused" };
const REFUSED: Refused = { outcome: "refused" };

/** What happened inside the GoTrue session: a result, or a failure to count. */
type Step<Value> = { ok: true; value: Value } | { ok: false };
const FAILED = { ok: false } as const;

/**
 * An elevated transaction of ONE operation, named literally where it is built (18 T6.1): the
 * helpers below run their transactions under the operation of their caller.
 */
type Elevated = <T>(
  fn: (tx: Transaction) => Promise<ElevatedResult<T>>,
) => Promise<T>;

function isInternalRole(role: string): role is InternalRole {
  return role === "agent" || role === "admin";
}

function contextOf(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
): GoTrueRequestContext {
  return {
    forwardedFor: gotrueForwardedAddressOf(
      request.clientAddress,
      dependencies.pepper,
    ),
    timeoutMs: BACKOFFICE_GOTRUE_CALL_TIMEOUT_MS,
    // J3-C rule 6: 5 000 ms for all the GoTrue calls of the request.
    deadline: AbortSignal.timeout(BACKOFFICE_GOTRUE_BUDGET_MS),
  };
}

function newSessionToken(): { token: string; hash: Buffer } {
  const bytes = randomBytes(32);
  return {
    token: bytes.toString("base64url"),
    hash: createHash("sha256").update(bytes).digest(),
  };
}

// ---------------------------------------------------------------------------------------------
// Steps shared by the three operations
// ---------------------------------------------------------------------------------------------

/** Step 1, EC-47: the couple (address, IP), then the IP (or the global ceiling without one). */
async function reserveAttempt(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  elevated: Elevated,
  email: string,
): Promise<boolean> {
  const { pepper } = dependencies;
  return elevated(async (tx) => {
    const couple = await reserveAuthAttempt(
      tx,
      "backoffice_login_email_ip",
      emailAddressThrottleKey(pepper, email, request.clientAddress),
      "15m",
      BACKOFFICE_ATTEMPTS_PER_EMAIL_IP_15_MIN,
    );
    if (!couple) {
      return { value: false, auditSubject: null };
    }
    const network =
      request.clientAddress.status === "known"
        ? await reserveAuthAttempt(
            tx,
            "backoffice_login_ip",
            addressThrottleKey(request.clientAddress),
            "1h",
            BACKOFFICE_ATTEMPTS_PER_IP_HOUR,
          )
        : await reserveAuthAttempt(
            tx,
            "backoffice_login_unknown_ip",
            globalThrottleKey(pepper, "backoffice_login_unknown_ip"),
            "1h",
            BACKOFFICE_ATTEMPTS_UNKNOWN_IP_HOUR,
          );
    return { value: network, auditSubject: null };
  });
}

/**
 * Step 4, EC-47: one failure counted per address and for the platform. Ten in an hour on a known
 * internal address, or one on the break-glass account (MFA-10), raise the audit line and an
 * `error` line without data; never a block (A-4).
 */
async function recordFailure(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  elevated: Elevated,
  email: string,
): Promise<void> {
  const { pepper } = dependencies;
  const counted = await elevated(async (tx) => {
    const ofEmail = await recordAuthFailure(
      tx,
      "backoffice_login_email",
      emailThrottleKey(pepper, email),
      "1h",
    );
    const ofPlatform = await recordAuthFailure(
      tx,
      "backoffice_login_platform",
      globalThrottleKey(pepper, "backoffice_login_platform"),
      "1h",
    );
    const account = await internalAccountOfEmail(tx, email);
    const alert =
      account !== null &&
      (account.isBreakGlass || ofEmail === BACKOFFICE_FAILURES_PER_EMAIL_ALERT);
    if (account !== null && alert) {
      await appendAuthEvent(
        tx,
        "security.backoffice_login_failures",
        account.id,
      );
    }
    return { value: { alert, ofPlatform }, auditSubject: null };
  });
  if (counted.alert) {
    request.logger.error({}, "security.backoffice_login_failures");
  }
  if (counted.ofPlatform >= BACKOFFICE_FAILURES_PLATFORM_ALERT) {
    request.logger.error(
      { failures: counted.ofPlatform },
      "security.backoffice_failure_spike",
    );
  }
}

/** J3-C rule 3, EC-55: the GoTrue identity is an active internal account, same address. */
async function internalAccountOf(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  elevated: Elevated,
  session: GoTruePasswordSession,
): Promise<(SignInAccount & { role: InternalRole }) | null> {
  const account = await elevated(async (tx) => ({
    value: await signInAccountOf(tx, session.identity.userId),
    auditSubject: null,
  }));
  if (account === null) {
    return null;
  }
  if (account.email !== session.identity.email) {
    request.logger.error(
      {},
      "backoffice sign-in: account and GoTrue user do not match",
    );
    return null;
  }
  if (
    account.status !== "active" ||
    !isInternalRole(account.role) ||
    account.profileIsActive !== true
  ) {
    // EC-55: a member (or an inactive internal account) gets the uniform refusal.
    return null;
  }
  return { ...account, role: account.role };
}

/**
 * G-1 point 1, EC-56: the factors GoTrue lists. Any verified factor other than `pinned` (any
 * verified factor at all when nothing is pinned yet) is refused, audited, logged, left intact.
 * With a pinned factor, it must be listed, verified and a TOTP. Null: refuse.
 */
async function checkedFactorsOf(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  elevated: Elevated,
  account: { id: string; userId: string; pinned: string | null },
): Promise<GoTrueFactor[] | null> {
  const listed = await dependencies.supabaseAuth.listFactors(account.userId);
  if (!listed.ok) {
    request.logger.warn(
      { errorCode: listed.errorCode, status: listed.status },
      "backoffice sign-in: GoTrue factors unavailable",
    );
    return null;
  }
  const unexpected = listed.value.some(
    (factor) => factor.status === "verified" && factor.id !== account.pinned,
  );
  if (unexpected) {
    await elevated(async (tx) => {
      await appendAuthEvent(tx, "agent.unexpected_mfa_factor", account.id);
      return { value: null, auditSubject: null };
    });
    request.logger.error({}, "security.unexpected_mfa_factor");
    return null;
  }
  const pinnedIsVerified =
    account.pinned === null ||
    listed.value.some(
      (factor) =>
        factor.id === account.pinned &&
        factor.status === "verified" &&
        factor.factorType === "totp",
    );
  return pinnedIsVerified ? listed.value : null;
}

/** A failure of the password step: only an outage before any identifier was checked is told. */
function isUnavailable(outcome: { ok: boolean; reason?: string }): boolean {
  return !outcome.ok && outcome.reason === "unavailable";
}

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/login (J3-C rule 4, EC-40): one request, a session directly in aal2
// ---------------------------------------------------------------------------------------------

export type BackofficeSignInResult = {
  response: BackofficeLoginResponse;
  session: NewSession | null;
};

type SignedIn = {
  role: InternalRole;
  token: string;
  recoveryCodesLeft: number | null;
  isBreakGlass: boolean;
};

export async function signInToBackoffice(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  body: BackofficeLoginBody,
): Promise<BackofficeSignInResult> {
  const elevated: Elevated = (fn) =>
    withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_sign_in",
      request.requestId,
      fn,
    );
  if (!(await reserveAttempt(dependencies, request, elevated, body.email))) {
    return { response: REFUSED, session: null };
  }
  // EC-17 point 1: a recovery code that cannot be one fails like a wrong one, after GoTrue.
  const normalizedRecovery =
    "recoveryCode" in body ? normalizeRecoveryCode(body.recoveryCode) : null;
  const recoveryHash =
    normalizedRecovery === null ? null : recoveryCodeHashOf(normalizedRecovery);

  const outcome = await dependencies.supabaseAuth.withPasswordSession(
    contextOf(dependencies, request),
    body.email,
    body.password,
    async (session): Promise<Step<SignedIn>> => {
      const account = await internalAccountOf(
        dependencies,
        request,
        elevated,
        session,
      );
      if (account === null || account.mfaFactorId === null) {
        return FAILED;
      }
      const pinned = account.mfaFactorId;
      const factors = await checkedFactorsOf(dependencies, request, elevated, {
        id: account.id,
        userId: session.identity.userId,
        pinned,
      });
      if (factors === null) {
        return FAILED;
      }
      if ("totpCode" in body) {
        const verified = await session.verifyTotp(pinned, body.totpCode);
        if (!verified.ok) {
          return FAILED;
        }
      } else if (recoveryHash === null) {
        return FAILED;
      }
      const { token, hash } = newSessionToken();
      const opened = await elevated(async (tx) => {
        let recoveryCodesLeft: number | null = null;
        if ("totpCode" in body) {
          // EC-39: the same code within 120 s is a replay; nothing is written.
          const accepted = await acceptTotpCode(
            tx,
            account.id,
            totpReplayDigest(dependencies.pepper, pinned, body.totpCode),
          );
          if (!accepted) {
            return { value: null, auditSubject: null };
          }
        } else if (recoveryHash !== null) {
          // EC-17 point 3: single use, in the transaction that creates the session.
          recoveryCodesLeft = await consumeRecoveryCode(
            tx,
            account.id,
            recoveryHash,
          );
          if (recoveryCodesLeft === null) {
            return { value: null, auditSubject: null };
          }
        }
        await insertBackofficeSession(tx, {
          tokenHash: hash,
          accountId: account.id,
          mfaMethod: recoveryCodesLeft === null ? "totp" : "recovery_code",
          userAgentSummary: request.browser,
        });
        if (account.isBreakGlass) {
          // MFA-10, EC-44 (1): every sign-in of the break-glass account.
          await appendAuthEvent(tx, "agent.break_glass_login", account.id);
        }
        return { value: { recoveryCodesLeft }, auditSubject: account.id };
      });
      if (opened === null) {
        return FAILED;
      }
      return {
        ok: true,
        value: {
          role: account.role,
          token,
          recoveryCodesLeft: opened.recoveryCodesLeft,
          isBreakGlass: account.isBreakGlass,
        },
      };
    },
  );

  if (!outcome.ok && isUnavailable(outcome)) {
    request.logger.warn(
      { errorCode: outcome.errorCode, status: outcome.status },
      "backoffice sign-in: GoTrue unavailable",
    );
    return { response: { outcome: "unavailable" }, session: null };
  }
  if (!outcome.ok || !outcome.value.ok) {
    await recordFailure(dependencies, request, elevated, body.email);
    return { response: REFUSED, session: null };
  }
  const signedIn = outcome.value.value;
  // EC-44 (2): an `error` line with a fixed key, no address, no IP, never the code.
  if (signedIn.isBreakGlass) {
    request.logger.error({}, "security.break_glass_login");
  }
  if (signedIn.recoveryCodesLeft !== null) {
    request.logger.error(
      { remaining: signedIn.recoveryCodesLeft },
      "security.recovery_code_consumed",
    );
    return {
      response: {
        outcome: "signed_in",
        role: signedIn.role,
        mfaMethod: "recovery_code",
        recoveryCodesLeft: signedIn.recoveryCodesLeft,
      },
      session: { token: signedIn.token },
    };
  }
  return {
    response: { outcome: "signed_in", role: signedIn.role, mfaMethod: "totp" },
    session: { token: signedIn.token },
  };
}

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/enroll and /enroll/confirm (J3-C rule 4, B-2, MFA-2, MFA-3, G-1, EC-56)
// ---------------------------------------------------------------------------------------------

type EnrollingAccount =
  | {
      kind: "account";
      account: SignInAccount & { role: InternalRole };
      tokenHash: Buffer;
    }
  | { kind: "refused" }
  | { kind: "invitation_invalid" };

/**
 * The checks of both enrollment requests, in the order of EC-56: (counters, password, then) an
 * internal account without a pinned factor, then the enrollment token. Nothing is asked of the
 * factors before the token is valid.
 */
async function enrollingAccountOf(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  elevated: Elevated,
  session: GoTruePasswordSession,
  enrollmentToken: string,
): Promise<EnrollingAccount> {
  const account = await internalAccountOf(
    dependencies,
    request,
    elevated,
    session,
  );
  if (account === null || account.mfaFactorId !== null) {
    // 17b §3.14.b: an account already activated gets the uniform refusal.
    return { kind: "refused" };
  }
  const tokenHash = enrollmentTokenHashOf(enrollmentToken);
  if (tokenHash === null) {
    return { kind: "invitation_invalid" };
  }
  const valid = await elevated(async (tx) => ({
    value: await enrollmentTokenIsValid(tx, account.id, tokenHash),
    auditSubject: null,
  }));
  return valid
    ? { kind: "account", account, tokenHash }
    : { kind: "invitation_invalid" };
}

export async function startTotpEnrollment(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  body: BackofficeEnrollBody,
): Promise<BackofficeEnrollResponse> {
  const elevated: Elevated = (fn) =>
    withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_enroll_totp",
      request.requestId,
      fn,
    );
  if (!(await reserveAttempt(dependencies, request, elevated, body.email))) {
    return REFUSED;
  }
  const outcome = await dependencies.supabaseAuth.withPasswordSession(
    contextOf(dependencies, request),
    body.email,
    body.password,
    async (session): Promise<Step<BackofficeEnrollResponse>> => {
      const checked = await enrollingAccountOf(
        dependencies,
        request,
        elevated,
        session,
        body.enrollmentToken,
      );
      if (checked.kind === "refused") {
        return FAILED;
      }
      if (checked.kind === "invitation_invalid") {
        return { ok: true, value: { outcome: "invitation_invalid" } };
      }
      const factors = await checkedFactorsOf(dependencies, request, elevated, {
        id: checked.account.id,
        userId: session.identity.userId,
        pinned: null,
      });
      if (factors === null) {
        return FAILED;
      }
      // EC-56: GoTrue keeps unverified factors; every unverified TOTP goes before a new one.
      for (const factor of factors) {
        if (factor.factorType !== "totp" || factor.status !== "unverified") {
          continue;
        }
        const deleted = await dependencies.supabaseAuth.deleteFactor(
          session.identity.userId,
          factor.id,
        );
        if (!deleted.ok) {
          request.logger.warn(
            { errorCode: deleted.errorCode, status: deleted.status },
            "backoffice enrollment: unverified factor not deleted",
          );
          return FAILED;
        }
      }
      const enrolled = await session.enrollTotp(TOTP_FACTOR_NAME, TOTP_ISSUER);
      if (!enrolled.ok) {
        request.logger.warn(
          { errorCode: enrolled.errorCode, status: enrolled.status },
          "backoffice enrollment: factor not created",
        );
        return FAILED;
      }
      return {
        ok: true,
        value: {
          outcome: "factor_created",
          qrCodeSvg: enrolled.value.qrCodeSvg,
          secret: enrolled.value.secret,
          uri: enrolled.value.uri,
        },
      };
    },
  );
  if (!outcome.ok && isUnavailable(outcome)) {
    request.logger.warn(
      { errorCode: outcome.errorCode, status: outcome.status },
      "backoffice enrollment: GoTrue unavailable",
    );
    return { outcome: "unavailable" };
  }
  if (outcome.ok && outcome.value.ok) {
    const response = outcome.value.value;
    if (response.outcome !== "factor_created") {
      // An invalid invitation counts as a failed attempt too.
      await recordFailure(dependencies, request, elevated, body.email);
    }
    return response;
  }
  await recordFailure(dependencies, request, elevated, body.email);
  return REFUSED;
}

export type EnrollmentConfirmResult = {
  response: BackofficeEnrollConfirmResponse;
  session: NewSession | null;
};

export async function confirmTotpEnrollment(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  body: BackofficeEnrollConfirmBody,
): Promise<EnrollmentConfirmResult> {
  const elevated: Elevated = (fn) =>
    withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_enroll_totp",
      request.requestId,
      fn,
    );
  if (!(await reserveAttempt(dependencies, request, elevated, body.email))) {
    return { response: REFUSED, session: null };
  }
  const outcome = await dependencies.supabaseAuth.withPasswordSession(
    contextOf(dependencies, request),
    body.email,
    body.password,
    async (session): Promise<Step<EnrollmentConfirmResult>> => {
      const checked = await enrollingAccountOf(
        dependencies,
        request,
        elevated,
        session,
        body.enrollmentToken,
      );
      if (checked.kind === "refused") {
        return FAILED;
      }
      if (checked.kind === "invitation_invalid") {
        return {
          ok: true,
          value: { response: { outcome: "invitation_invalid" }, session: null },
        };
      }
      const { account, tokenHash } = checked;
      const factors = await checkedFactorsOf(dependencies, request, elevated, {
        id: account.id,
        userId: session.identity.userId,
        pinned: null,
      });
      // EC-56: the factor is the ONE unverified TOTP GoTrue lists, never an id of the body.
      const pending = (factors ?? []).filter(
        (factor) =>
          factor.factorType === "totp" && factor.status === "unverified",
      );
      const factor = pending.length === 1 ? pending[0] : undefined;
      if (factor === undefined) {
        return FAILED;
      }
      const verified = await session.verifyTotp(factor.id, body.code);
      if (!verified.ok) {
        return FAILED;
      }
      const batch = generateRecoveryCodes();
      const { token, hash } = newSessionToken();
      let pinned: boolean;
      try {
        pinned = await elevated(async (tx) => {
          const accepted = await acceptTotpCode(
            tx,
            account.id,
            totpReplayDigest(dependencies.pepper, factor.id, body.code),
          );
          if (!accepted) {
            return { value: false, auditSubject: null };
          }
          await pinMfaFactor(tx, {
            accountId: account.id,
            factorId: factor.id,
            enrollmentTokenHash: tokenHash,
            recoveryCodeHashes: batch.hashes,
          });
          await insertBackofficeSession(tx, {
            tokenHash: hash,
            accountId: account.id,
            mfaMethod: "totp",
            userAgentSummary: request.browser,
          });
          return { value: true, auditSubject: account.id };
        });
      } catch (error) {
        // The one refusal of identity.pin_mfa_factor() (token consumed, factor pinned by a
        // concurrent request): uniform refusal. Any other error propagates.
        if (sqlStateOf(error) !== "42501") {
          throw error;
        }
        request.logger.info({}, "backoffice enrollment: pinning refused");
        return FAILED;
      }
      if (!pinned) {
        return FAILED;
      }
      return {
        ok: true,
        value: {
          response: {
            outcome: "signed_in",
            role: account.role,
            recoveryCodes: batch.displayed,
          },
          session: { token },
        },
      };
    },
  );
  if (!outcome.ok && isUnavailable(outcome)) {
    request.logger.warn(
      { errorCode: outcome.errorCode, status: outcome.status },
      "backoffice enrollment: GoTrue unavailable",
    );
    return { response: { outcome: "unavailable" }, session: null };
  }
  if (outcome.ok && outcome.value.ok) {
    const result = outcome.value.value;
    if (result.session === null) {
      await recordFailure(dependencies, request, elevated, body.email);
    }
    return result;
  }
  await recordFailure(dependencies, request, elevated, body.email);
  return { response: REFUSED, session: null };
}

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/reauthenticate — R (B-5, EC-40): password and TOTP, never a recovery code
// ---------------------------------------------------------------------------------------------

export type ReauthenticationResult = {
  response: BackofficeReauthenticateResponse;
  /** The session was revoked at the fifth failure: the route clears the cookie. */
  revoked: boolean;
};

export async function reauthenticate(
  dependencies: BackofficeAuthDependencies,
  request: BackofficeAuthRequest,
  sessionId: string,
  body: BackofficeReauthenticateBody,
): Promise<ReauthenticationResult> {
  const elevated: Elevated = (fn) =>
    withElevatedTransaction(
      dependencies.database,
      "identity.backoffice_reauthenticate",
      request.requestId,
      fn,
    );
  const held = await elevated(async (tx) => ({
    value: await reauthenticationSessionOf(tx, sessionId),
    auditSubject: null,
  }));
  if (held === null) {
    return { response: REFUSED, revoked: false };
  }
  if (held.mfaMethod === "recovery_code") {
    // EC-17 point 4: a session opened by a recovery code never satisfies R.
    return { response: { outcome: "recovery_session" }, revoked: false };
  }

  const outcome = await dependencies.supabaseAuth.withPasswordSession(
    contextOf(dependencies, request),
    held.email,
    body.password,
    async (session): Promise<Step<null>> => {
      if (session.identity.userId !== held.authUserId) {
        request.logger.error(
          {},
          "reauthentication: GoTrue returned another user",
        );
        return FAILED;
      }
      const factors = await checkedFactorsOf(dependencies, request, elevated, {
        id: held.accountId,
        userId: held.authUserId,
        pinned: held.mfaFactorId,
      });
      if (factors === null) {
        return FAILED;
      }
      const verified = await session.verifyTotp(held.mfaFactorId, body.code);
      if (!verified.ok) {
        return FAILED;
      }
      const renewed = await elevated(async (tx) => {
        const accepted = await acceptTotpCode(
          tx,
          held.accountId,
          totpReplayDigest(dependencies.pepper, held.mfaFactorId, body.code),
        );
        if (!accepted || !(await renewSecondFactorProof(tx, sessionId))) {
          return { value: false, auditSubject: null };
        }
        return { value: true, auditSubject: held.accountId };
      });
      return renewed ? { ok: true, value: null } : FAILED;
    },
  );
  if (!outcome.ok && isUnavailable(outcome)) {
    request.logger.warn(
      { errorCode: outcome.errorCode, status: outcome.status },
      "reauthentication: GoTrue unavailable",
    );
    return { response: { outcome: "unavailable" }, revoked: false };
  }
  if (outcome.ok && outcome.value.ok) {
    return { response: { outcome: "confirmed" }, revoked: false };
  }

  // EC-40 point 5: five failures of R on this session in 15 minutes revoke it.
  const revoked = await elevated(async (tx) => {
    const failures = await recordAuthFailure(
      tx,
      "backoffice_reauth_session",
      reauthenticationThrottleKey(dependencies.pepper, sessionId),
      "15m",
    );
    if (
      failures < REAUTHENTICATION_FAILURES_PER_SESSION ||
      !(await revokeAfterFailedReauthentication(tx, sessionId))
    ) {
      return { value: false, auditSubject: null };
    }
    await appendAuthEvent(tx, "agent.reauthentication_failed", held.accountId);
    return { value: true, auditSubject: held.accountId };
  });
  if (revoked) {
    request.logger.error({}, "security.reauthentication_failed");
    return { response: { outcome: "session_revoked" }, revoked: true };
  }
  return { response: REFUSED, revoked: false };
}

/**
 * EC-40 point 2: whether R holds on this session right now — a TOTP proof at most five minutes
 * old, read by the database clock. Called by the sensitive actions of B-5 before they act.
 */
export function hasFreshReauthentication(
  database: ApiDatabase,
  requestId: string,
  sessionId: string,
): Promise<boolean> {
  return withElevatedTransaction(
    database,
    "identity.backoffice_reauthenticate",
    requestId,
    async (tx) => ({
      value: await hasFreshSecondFactorProof(
        tx,
        sessionId,
        REAUTHENTICATION_FRESHNESS_SECONDS,
      ),
      auditSubject: null,
    }),
  );
}
