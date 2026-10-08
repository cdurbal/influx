// POST /v1/signup, screen 3 of the sign-up (docs/mvp/05 RG5, RG7, RG8, RG11 to RG38, RG73, RG110,
// RG120, D63; 21 §5.2, J5 commit 4; 03 P7 E-2, motif identity.complete_signup, 21 EC-5, EC-30).
// The route (routes.ts) owns the body validation (packages/contracts/src/signup.ts) and the
// cookies.
//
//   1  The sign-up token (signature, type `signup`, expiry), else 401: the journey starts again.
//      The address and the GoTrue user come from the token, never from the body (EC-4).
//   2  ONE elevated transaction (E-2): identity.provision_account() writes everything or nothing
//      (RG7) in a savepoint, so that a refusal can still be told apart: terms out of date or not
//      published at all (RG25, RG29), a value refused (D63), an address held by another account.
//   3  `created` or `existing` (RG110: a second submission writes nothing): the account as the
//      database holds it, then a member session, as the verification of the code opens one
//      (verify-code.ts); the audit line elevated.identity.complete_signup is on the account.
//   4  `country_blocked` (RG8): nothing written, a neutral answer, an `info` line with the country.
// No line of the journal carries the address, the GoTrue user, the company name or the wording
// (D60): only the outcome, the role and, for a blocked country, the country code.
import type { SignupBody, SignupResponse } from "@influx/contracts/signup";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import { createHash, randomBytes } from "node:crypto";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import type { AuthTokenCodec } from "../../platform/auth-tokens.ts";
import {
  accountOfAuthUser,
  constraintNameOf,
  insertMemberSession,
  provisionAccount,
  sqlStateOf,
  termsOfServiceArePublished,
  type ProvisionOutcome,
  type ProvisionRequest,
} from "./repository.ts";

const INVALID_PARAMETER_VALUE = "22023";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

export type CompleteSignupLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type CompleteSignupDependencies = {
  database: ApiDatabase;
  tokens: AuthTokenCodec;
  now: () => Date;
};

export type CompleteSignupRequest = {
  requestId: string;
  signupCookie: string | null;
  body: SignupBody;
  browser: UserAgentSummary;
  logger: CompleteSignupLogger;
};

/** What the route does with the outcome. */
export type CompleteSignupResult =
  // Step 1: no valid token. The route clears a cookie that was sent, then answers 401.
  | { kind: "unauthenticated"; clearSignup: boolean }
  // A value the database refused although the contract accepted it: 400 validation_failed.
  | { kind: "invalid"; consentRequired: boolean }
  | {
      kind: "answer";
      response: SignupResponse;
      /** A member session: the raw identifier of the cookie (never stored, never logged). */
      session: { token: string } | null;
      /** The token has been used: the sign-up cookie is cleared. */
      clearSignup: boolean;
    };

/** What the elevated transaction decides. */
type Decision =
  | { kind: "session"; role: "advertiser" | "creator"; created: boolean }
  | { kind: "country_blocked" }
  | { kind: "terms_outdated" }
  | { kind: "terms_not_published" }
  | { kind: "invalid" }
  | { kind: "address_taken" }
  | { kind: "unavailable" };

/** A refusal of identity.provision_account() that has an answer; null for anything else. */
function refusalOf(
  error: unknown,
): "terms" | "invalid" | "address_taken" | null {
  const state = sqlStateOf(error);
  if (state === FOREIGN_KEY_VIOLATION) {
    // The function raises 23503 itself, without a constraint, for the terms version (0109 §5).
    // A named foreign key (country, language) is a value refused: the contract should have
    // stopped it.
    return constraintNameOf(error) === null ? "terms" : "invalid";
  }
  if (state === INVALID_PARAMETER_VALUE || state === CHECK_VIOLATION) {
    return "invalid";
  }
  if (state === UNIQUE_VIOLATION) {
    // accounts_email_key: another account holds the address of the token (the auth_user_id
    // conflict is absorbed by the function, RG110).
    return "address_taken";
  }
  return null;
}

function provisionRequestOf(
  body: SignupBody,
  identity: { authUserId: string; email: string },
): ProvisionRequest {
  const acquisition = body.acquisition;
  const common = {
    authUserId: identity.authUserId,
    email: identity.email,
    countryCode: body.countryCode,
    preferredLanguage: body.preferredLanguage,
    termsVersionId: body.termsVersionId,
    marketingConsent: body.marketingConsent,
    consentWordingKey: body.consentWordingKey,
    consentWording: body.consentWording,
    displayLocale: body.displayLocale,
    utmSource: acquisition?.utmSource ?? null,
    utmMedium: acquisition?.utmMedium ?? null,
    utmCampaign: acquisition?.utmCampaign ?? null,
    referrerDomain: acquisition?.referrerDomain ?? null,
    heardFrom: acquisition?.heardFrom ?? null,
  };
  return body.role === "advertiser"
    ? {
        ...common,
        role: "advertiser",
        declaredStatus: null,
        adultAttested: false,
        legalName: body.companyName,
      }
    : {
        ...common,
        role: "creator",
        declaredStatus: body.declaredStatus,
        adultAttested: body.adultAttested,
        legalName: null,
      };
}

function answer(
  response: SignupResponse,
  effects: { session?: { token: string } | null; clearSignup: boolean },
): CompleteSignupResult {
  return {
    kind: "answer",
    response,
    session: effects.session ?? null,
    clearSignup: effects.clearSignup,
  };
}

export async function completeSignup(
  dependencies: CompleteSignupDependencies,
  request: CompleteSignupRequest,
): Promise<CompleteSignupResult> {
  // Step 1: the sign-up token (EC-4, 30 minutes after the verification of the code).
  const signup = dependencies.tokens.readSignup(
    request.signupCookie ?? undefined,
    dependencies.now(),
  );
  if (signup === null) {
    return {
      kind: "unauthenticated",
      clearSignup: request.signupCookie !== null,
    };
  }
  const { body } = request;
  const provision = provisionRequestOf(body, signup);
  const token = randomBytes(32);

  // Steps 2 and 3: one elevated transaction (E-2).
  const decision = await withElevatedTransaction<Decision>(
    dependencies.database,
    "identity.complete_signup",
    request.requestId,
    async (tx) => {
      let provisioned: ProvisionOutcome;
      try {
        // A savepoint: after a refusal, the transaction can still read the terms in force.
        provisioned = await tx.transaction((savepoint) =>
          provisionAccount(savepoint, provision),
        );
      } catch (error) {
        const refusal = refusalOf(error);
        if (refusal === null) {
          throw error;
        }
        if (refusal === "terms") {
          const published = await termsOfServiceArePublished(
            tx,
            body.displayLocale,
          );
          return {
            value: published
              ? { kind: "terms_outdated" as const }
              : { kind: "terms_not_published" as const },
            auditSubject: null,
          };
        }
        if (refusal === "invalid") {
          if (body.marketingConsent) {
            // The contract checks every rule of the function but the consent (D63): a drift.
            request.logger.error(
              { sqlState: sqlStateOf(error), role: body.role },
              "sign-up refused by the database after the contract accepted it",
            );
          }
          return { value: { kind: "invalid" as const }, auditSubject: null };
        }
        // A unique violation is raised only once the other transaction has committed. Two
        // simultaneous first submissions (RG110) can race past the auth_user_id check of the
        // function and meet on the address: the account of the first one is then this one's.
        const first = await accountOfAuthUser(tx, signup.authUserId);
        if (first === null) {
          return {
            value: { kind: "address_taken" as const },
            auditSubject: null,
          };
        }
        provisioned = { outcome: "existing", accountId: first.id };
      }
      if (provisioned.outcome === "country_blocked") {
        return {
          value: { kind: "country_blocked" as const },
          auditSubject: null,
        };
      }
      // The account as the database holds it: on a replay (RG110) its role is the one of the
      // first submission, whatever this body says (RG66).
      const account = await accountOfAuthUser(tx, signup.authUserId);
      if (
        account === null ||
        account.id !== provisioned.accountId ||
        account.email !== signup.email ||
        account.status !== "active" ||
        (account.role !== "advertiser" && account.role !== "creator")
      ) {
        return { value: { kind: "unavailable" as const }, auditSubject: null };
      }
      // A member session (A-9): only the SHA-256 of the identifier is stored (EC-2).
      await insertMemberSession(tx, {
        tokenHash: createHash("sha256").update(token).digest(),
        accountId: account.id,
        userAgentSummary: request.browser,
      });
      return {
        value: {
          kind: "session" as const,
          role: account.role,
          created: provisioned.outcome === "created",
        },
        auditSubject: account.id,
      };
    },
  );

  switch (decision.kind) {
    case "session":
      request.logger.info(
        {
          outcome: decision.created ? "created" : "existing",
          role: decision.role,
        },
        "sign-up completed",
      );
      return answer(
        { outcome: "signed_up", role: decision.role },
        { session: { token: token.toString("base64url") }, clearSignup: true },
      );
    case "country_blocked":
      // RG8, CA67: journalled, with the country only.
      request.logger.info(
        { outcome: "country_blocked", countryCode: body.countryCode },
        "sign-up refused: country blocked",
      );
      return answer({ outcome: "country_blocked" }, { clearSignup: false });
    case "terms_outdated":
      request.logger.info(
        { outcome: "terms_outdated" },
        "sign-up refused: terms version not in force",
      );
      return answer({ outcome: "terms_outdated" }, { clearSignup: false });
    case "terms_not_published":
      request.logger.error(
        { outcome: "terms_not_published" },
        "sign-up refused: no terms of service in force",
      );
      return answer({ outcome: "terms_not_published" }, { clearSignup: false });
    case "invalid":
      // D63: with the consent refused, the consent is what the database refused (the contract
      // checks every other rule of the function first).
      if (!body.marketingConsent) {
        request.logger.info(
          { outcome: "consent_required" },
          "sign-up refused: marketing consent required (D63)",
        );
      }
      return { kind: "invalid", consentRequired: !body.marketingConsent };
    case "address_taken":
    case "unavailable":
      request.logger.error(
        { outcome: decision.kind },
        "sign-up: no usable account for the GoTrue user of the token",
      );
      return answer({ outcome: "account_unavailable" }, { clearSignup: true });
    default:
      throw new Error("unexpected outcome of the sign-up");
  }
}
