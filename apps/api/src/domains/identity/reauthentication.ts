// Re-authentication of a member by a fresh code (docs/mvp/05 RG57, RG41, RG44, RG47; 03 A-10; J7
// decision 4). The engine of the sign-in code, for the address of the SESSION (never one from the
// body), under the motif identity.member_reauthenticate:
//
//   request  the ceilings of the sign-in code (RG44, the same counters: it is the same code), its
//            P0 journal line `auth.login_code` with the account, GoTrue's code without any user
//            creation (generateLink), one send, the outcome; the signed journey (ref, session,
//            purpose) goes back to the page, which sends it back with the code (RG47: the code
//            dies with the tab).
//   verify   the journey (this session, this purpose, ten minutes, RG136), the counters and GoTrue
//            (checkEmailCode, shared with the sign-in), then the account of the GoTrue user must be
//            the session's: the marker of 0118 on this session, for this purpose, at now().
//
// The proof is consumed by the sensitive action itself, in its own transaction (0118
// consume_member_reauthentication(): MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS, single use);
// `requireFreshCode` turns its refusal (55000) into 403 reauthentication_required. Nothing here
// logs an address, a code, a journey token or a session id (D60, C-1).
import type {
  ReauthPurpose,
  ReauthVerifyCodeResponse,
} from "@influx/contracts/account";
import type { RequestCodeOutcome, UiLocale } from "@influx/contracts/auth";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import {
  REAUTH_TOKEN_TTL_SECONDS,
  type AuthTokenCodec,
} from "../../platform/auth-tokens.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import type { ClientAddress } from "../../platform/client-address.ts";
import { ApiError } from "../../platform/errors.ts";
import type { SupabaseAuth } from "../../platform/supabase.ts";
import {
  beforeDeadline,
  FAILURE_OF,
  LOGIN_CODE_TEMPLATE_VERSION,
  OUTCOME_OF,
  reserveCodeRequest,
} from "./login-code.ts";
import {
  DEFAULT_EMAIL_TIME_ZONE,
  renderLoginCodeEmail,
} from "./login-code-email.ts";
import { drawMatchingPhrase } from "./matching-phrase.ts";
import {
  accountOfAuthUser,
  closeP0Send,
  insertLoginCodeSend,
  markMemberReauthenticated,
  sqlStateOf,
} from "./repository.ts";
import {
  CODE_VALIDITY_SECONDS,
  GOTRUE_CODE_BUDGET_MS,
  MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS,
} from "./settings.ts";
import { checkEmailCode, type VerifyCodeLogger } from "./verify-code.ts";

export type ReauthenticationDependencies = {
  database: ApiDatabase;
  supabaseAuth: Pick<SupabaseAuth, "generateEmailCode" | "verifyEmailCode">;
  sender: TransactionalSender;
  tokens: AuthTokenCodec;
  /** AUTH_THROTTLE_PEPPER. */
  pepper: string;
  now: () => Date;
};

/** The member session asking: what withMemberSession read, committed before any call (G4). */
export type ReauthenticatingMember = {
  sessionId: string;
  accountId: string;
  /** The address of the account: the only recipient of the code. */
  email: string;
  /** The account's language: of the phrase and of the e-mail. */
  locale: UiLocale;
};

export type ReauthenticationCodeRequest = {
  requestId: string;
  member: ReauthenticatingMember;
  purpose: ReauthPurpose;
  clientAddress: ClientAddress;
  browser: UserAgentSummary;
  logger: VerifyCodeLogger;
};

export type ReauthenticationCodeResult = {
  outcome: RequestCodeOutcome;
  /** When `sent`: the phrase shown on the page and the signed journey of this code. */
  journey: { phrase: string; token: string } | null;
};

export async function requestReauthenticationCode(
  dependencies: ReauthenticationDependencies,
  request: ReauthenticationCodeRequest,
): Promise<ReauthenticationCodeResult> {
  const requestedAt = dependencies.now();
  const { member } = request;

  // The ceilings and the P0 line (E-1 shape, motif of decision 4): the account is the subject.
  const opened = await withElevatedTransaction(
    dependencies.database,
    "identity.member_reauthenticate",
    request.requestId,
    async (tx) => {
      if (
        !(await reserveCodeRequest(tx, dependencies.pepper, {
          clientAddress: request.clientAddress,
          email: member.email,
        }))
      ) {
        return { value: null, auditSubject: null };
      }
      const line = await insertLoginCodeSend(tx, {
        accountId: member.accountId,
        email: member.email,
        locale: member.locale,
        templateVersion: LOGIN_CODE_TEMPLATE_VERSION,
      });
      return {
        value: { line, phrase: drawMatchingPhrase(member.locale) },
        auditSubject: member.accountId,
      };
    },
  );
  if (opened === null) {
    return { outcome: "rate_limited", journey: null };
  }

  // No transaction open from here (G4). The GoTrue user exists: no creation, a new code only,
  // which replaces any pending one of the user (J3-A b4).
  const generated = await beforeDeadline(
    dependencies.supabaseAuth
      .generateEmailCode(member.email)
      .then((outcome) => {
        if (!outcome.ok) {
          request.logger.warn(
            {
              reason: outcome.reason,
              errorCode: outcome.errorCode,
              status: outcome.status,
            },
            "reauthentication: GoTrue code not generated",
          );
          return null;
        }
        return outcome.value;
      }),
    performance.now() + GOTRUE_CODE_BUDGET_MS,
  );
  // The code of another GoTrue user is never sent (J3-C rule 3).
  const code =
    generated !== null && generated.email === member.email
      ? generated.code
      : null;

  const sent =
    code === null
      ? ({ status: "unavailable" } as const)
      : await dependencies.sender.send({
          template: "auth.login_code",
          to: member.email,
          idempotencyKey: `auth.login_code:${opened.line.id}`,
          ...renderLoginCodeEmail({
            locale: member.locale,
            code,
            phrase: opened.phrase,
            requestedAt,
            timeZone: DEFAULT_EMAIL_TIME_ZONE,
            browser: request.browser,
          }),
        });

  // The outcome only; no audit line (EC-52 (3)).
  await withElevatedTransaction(
    dependencies.database,
    "identity.member_reauthenticate",
    request.requestId,
    async (tx) => {
      const closed = await closeP0Send(
        tx,
        opened.line.reference,
        sent.status === "sent"
          ? { status: "sent", messageId: sent.messageId }
          : { status: "failed", failureCode: FAILURE_OF[sent.status] },
      );
      if (!closed) {
        throw new Error(
          "journal line of the reauthentication code was not queued",
        );
      }
      return { value: undefined, auditSubject: null };
    },
  );

  if (sent.status !== "sent") {
    return { outcome: OUTCOME_OF[sent.status], journey: null };
  }
  return {
    outcome: "sent",
    journey: {
      phrase: opened.phrase,
      token: dependencies.tokens.issueReauth(
        {
          ref: opened.line.reference,
          sid: member.sessionId,
          purpose: request.purpose,
        },
        requestedAt,
      ),
    },
  };
}

export type ReauthenticationVerifyRequest = {
  requestId: string;
  member: ReauthenticatingMember;
  purpose: ReauthPurpose;
  code: string;
  token: string;
  clientAddress: ClientAddress;
  logger: VerifyCodeLogger;
};

function secondsOf(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export async function verifyReauthenticationCode(
  dependencies: ReauthenticationDependencies,
  request: ReauthenticationVerifyRequest,
): Promise<ReauthVerifyCodeResponse> {
  const now = dependencies.now();
  const { member } = request;

  // The journey: this session, this purpose (RG47); ten minutes after the request (RG136).
  const journey = dependencies.tokens.readReauth(request.token, now);
  if (
    journey === null ||
    journey.sid !== member.sessionId ||
    journey.purpose !== request.purpose
  ) {
    return { outcome: "session_lost" };
  }
  if (
    secondsOf(now) >=
    journey.exp - REAUTH_TOKEN_TTL_SECONDS + CODE_VALIDITY_SECONDS
  ) {
    return { outcome: "expired" };
  }

  const checked = await checkEmailCode(
    dependencies,
    (fn) =>
      withElevatedTransaction(
        dependencies.database,
        "identity.member_reauthenticate",
        request.requestId,
        fn,
      ),
    {
      requestId: request.requestId,
      reference: journey.ref,
      email: member.email,
      code: request.code,
      clientAddress: request.clientAddress,
      logger: request.logger,
    },
  );
  if (checked.kind === "mismatch") {
    return { outcome: "session_lost" };
  }
  if (checked.kind === "refused") {
    return checked.response;
  }
  const identity = checked.identity;

  // The GoTrue user must be the session's account (J3-C rule 3); then the marker (E-2).
  const marked = await withElevatedTransaction(
    dependencies.database,
    "identity.member_reauthenticate",
    request.requestId,
    async (tx) => {
      const account = await accountOfAuthUser(tx, identity.userId);
      if (account === null || account.id !== member.accountId) {
        return { value: "anomaly" as const, auditSubject: null };
      }
      const accountId = await markMemberReauthenticated(
        tx,
        member.sessionId,
        request.purpose,
      );
      return accountId === null
        ? { value: "session_closed" as const, auditSubject: null }
        : { value: "marked" as const, auditSubject: accountId };
    },
  );
  if (marked === "anomaly") {
    request.logger.error(
      {},
      "reauthentication: GoTrue user and session account do not match",
    );
    return { outcome: "session_lost" };
  }
  if (marked === "session_closed") {
    // Closed or expired meanwhile: the space asks to sign in again.
    throw new ApiError("unauthenticated");
  }
  return {
    outcome: "reauthenticated",
    purpose: request.purpose,
    validForSeconds: MEMBER_REAUTHENTICATION_FRESHNESS_SECONDS,
  };
}

/**
 * The shared guard of the sensitive actions (RG57): runs `action`, whose database function consumes
 * the marker of 0118; its refusal (55000, no fresh code for this action on this session) becomes
 * 403 reauthentication_required. Anything else goes through.
 */
export async function requireFreshCode<T>(
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (sqlStateOf(error) === "55000") {
      throw new ApiError("reauthentication_required");
    }
    throw error;
  }
}
