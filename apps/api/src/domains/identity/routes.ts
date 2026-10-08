// Routes of the member authentication (docs/mvp/21 §5.2; 02 §18.10; 05 RG42 to RG69). Web surface
// only (prefix): request-code, verify-code, the journey resume (GET /v1/auth/journey and its reset,
// D66), the sign-up (POST /v1/signup, J5), logout, the minimal GET /v1/me of the J3, and the public
// documents read without an account (GET /v1/terms/current, 21 EC-62).
import {
  journeyResetResponseSchema,
  journeyResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  requestCodeBodySchema,
  requestCodeResponseSchema,
  RESEND_DELAY_SECONDS,
  verifyCodeBodySchema,
  verifyCodeResponseSchema,
  type JourneyResetResponse,
  type JourneyResponse,
  type MeResponse,
  type RequestCodeResponse,
  type VerifyCodeBody,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
import {
  signupBodySchema,
  signupResponseSchema,
  type SignupBody,
  type SignupResponse,
} from "@influx/contracts/signup";
import {
  currentTermsQuerySchema,
  currentTermsResponseSchema,
  type CurrentTermsQuery,
  type CurrentTermsResponse,
} from "@influx/contracts/terms";
import type {
  FastifyInstance,
  FastifyReply,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "pino";
import {
  SessionNotFoundError,
  withUserTransaction,
  type ApiDatabase,
} from "../../db/index.ts";
import {
  clearAuthCookie,
  readAuthCookie,
  setAuthCookie,
} from "../../platform/auth-cookies.ts";
import {
  LOGIN_TOKEN_TTL_SECONDS,
  SIGNUP_TOKEN_TTL_SECONDS,
  type AuthTokenCodec,
} from "../../platform/auth-tokens.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import { clientAddressOf } from "../../platform/client-address.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../../platform/errors.ts";
import type { ZodTypeProvider } from "../../platform/schema-compilers.ts";
import type { SupabaseAuth } from "../../platform/supabase.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
import { MinuteCounter } from "../ops/routes.ts";
import { completeSignup } from "./complete-signup.ts";
import { readJourney } from "./journey.ts";
import { requestLoginCode } from "./login-code.ts";
import {
  sessionTokenHashOf,
  setMemberSessionCookie,
  withMemberSession,
} from "./member-session.ts";
import { ownProfile, revokeOwnSession } from "./repository.ts";
import {
  CODE_REQUEST_FLOOR_MS,
  MEMBER_SESSION_IDLE_SECONDS,
} from "./settings.ts";
import {
  createTermsReader,
  databaseTermsLookup,
  TermsUnavailableError,
  type TermsLookup,
} from "./terms.ts";
import { verifyLoginCode } from "./verify-code.ts";

export type IdentityApp = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  Logger,
  ZodTypeProvider
>;

export type IdentityDependencies = {
  database: ApiDatabase;
  supabaseAuth: SupabaseAuth;
  sender: TransactionalSender;
  tokens: AuthTokenCodec;
  /** AUTH_THROTTLE_PEPPER. */
  pepper: string;
  now: () => Date;
  /** G3 (02 §18.4); injectable for the tests and the EC-42 measurement only. */
  codeRequestFloorMs?: number;
  /** EC-40 point 3 (backoffice sign-in, enrollment, R); injectable for the tests only. */
  backofficeAuthFloorMs?: number;
  /** Version in force of a public document (EC-62); the database unless a test replaces it. */
  termsLookup?: TermsLookup;
};

/**
 * Bounds per minute of GET /v1/terms/current (21 EC-62), in memory like the client errors (one
 * instance at the MVP): per client address (an unknown address shares one key), and for the
 * whole instance. A page reads one document; the sign-up panel, one or two.
 */
export const TERMS_READ_RATE = { address: 30, instance: 1200 } as const;

/** Retry-After of a 503 terms_unavailable (21 EC-62 (D)), in seconds. */
export const TERMS_RETRY_AFTER_SECONDS = 30;

/** True when an If-None-Match header names the entity tag (RFC 9110 §13.1.2, weak comparison). */
export function matchesEntityTag(
  ifNoneMatch: string | undefined,
  entityTag: string,
): boolean {
  if (ifNoneMatch === undefined) {
    return false;
  }
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim().replace(/^W\//, ""))
    .some((candidate) => candidate === "*" || candidate === entityTag);
}

/** Waits until `target` (a performance.now() instant), if it is still to come. */
async function waitUntil(target: number): Promise<void> {
  const remaining = target - performance.now();
  if (remaining > 0) {
    await sleep(remaining);
  }
}

export function registerIdentityRoutes(
  app: IdentityApp,
  dependencies: IdentityDependencies,
): void {
  const floorMs = dependencies.codeRequestFloorMs ?? CODE_REQUEST_FLOOR_MS;

  app.post(
    "/v1/auth/request-code",
    { schema: { response: { 200: requestCodeResponseSchema } } },
    async (request, reply): Promise<RequestCodeResponse> => {
      // Step 1: the floor runs from the reception of the request, before any validation (G3).
      const receivedAt = performance.now() - reply.elapsedTime;
      try {
        // Step 2: validated here, not by the route schema, so that a refusal waits for the
        // floor too (02 §18.5 R2).
        const parsed = requestCodeBodySchema.safeParse(request.body);
        if (!parsed.success) {
          throw new RequestValidationError(
            parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join("."),
              issue: issue.code,
            })),
          );
        }
        const { email, locale } = parsed.data;
        const result = await requestLoginCode(dependencies, {
          requestId: request.id,
          email,
          locale,
          clientAddress: clientAddressOf(request),
          browser: userAgentSummaryOf(request),
          logger: request.log,
        });
        // Step 9: the login cookie, only when the code left (RG47, RG48); never the code.
        if (result.journey !== null) {
          setAuthCookie(
            reply,
            "login",
            dependencies.tokens.issueLogin(
              {
                ref: result.journey.reference,
                email: result.journey.email,
                phrase: result.journey.phrase,
              },
              dependencies.now(),
            ),
            LOGIN_TOKEN_TTL_SECONDS,
          );
          return {
            outcome: result.outcome,
            retryAfterSeconds: RESEND_DELAY_SECONDS,
            matchingPhrase: result.journey.phrase,
          };
        }
        return {
          outcome: result.outcome,
          retryAfterSeconds: RESEND_DELAY_SECONDS,
        };
      } finally {
        // Step 10: every outcome, failures included, waits for the floor.
        await waitUntil(receivedAt + floorMs);
      }
    },
  );

  // GET /v1/terms/current (21 EC-62; 05 RG25, RG27): the version in force of a public document,
  // without an account. 400 outside the closed lists, 404 terms_not_published, 429 over the rate;
  // ANY other failure is 503 terms_unavailable with Retry-After, never 500 (EC-62 (D)): the text
  // read from the database fails its check, the database does not answer, or anything else
  // throws. Revalidated at each use (no-cache); the ETag is the version id, so that a version
  // replaced in between is never served from a cache.
  const terms = createTermsReader({
    lookup:
      dependencies.termsLookup ?? databaseTermsLookup(dependencies.database),
  });
  const termsCounter = new MinuteCounter(dependencies.now);
  app.get(
    "/v1/terms/current",
    {
      schema: {
        querystring: currentTermsQuerySchema,
        response: { 200: currentTermsResponseSchema },
      },
    },
    async (request, reply): Promise<CurrentTermsResponse | undefined> => {
      const address = clientAddressOf(request);
      const addressKey =
        address.status === "known" ? address.throttleKey : "unknown";
      if (
        !termsCounter.take(`address:${addressKey}`, TERMS_READ_RATE.address) ||
        !termsCounter.take("instance", TERMS_READ_RATE.instance)
      ) {
        throw new ApiError("rate_limited");
      }
      let version: CurrentTermsResponse | null;
      try {
        version = await terms.current(
          request.query as CurrentTermsQuery,
          request.id,
          request.log,
        );
      } catch (error) {
        if (!(error instanceof TermsUnavailableError)) {
          // terms.ts logs its own failures; anything else is logged here, without its message.
          request.log.error(
            {
              reason: "unexpected_error",
              errorName: error instanceof Error ? error.name : typeof error,
            },
            "public document not served: terms_unavailable",
          );
        }
        throw new RetryLaterError(
          "terms_unavailable",
          TERMS_RETRY_AFTER_SECONDS,
        );
      }
      if (version === null) {
        throw new ApiError("terms_not_published");
      }
      const entityTag = `"${version.id}"`;
      reply.header("cache-control", "no-cache");
      reply.header("etag", entityTag);
      if (matchesEntityTag(request.headers["if-none-match"], entityTag)) {
        // A 304 carries no body, so it has no response schema: the typed reply only knows 200.
        // Nothing of the version is sent; the onSend check sees no payload.
        await (reply as unknown as FastifyReply).code(304).send();
        return;
      }
      return version;
    },
  );

  // POST /v1/auth/verify-code (J3 commit 9). The body is validated by the route schema: a
  // malformed code or an unknown door (`agent`…) is a 400 without any effect (EC-4 (3)).
  app.post(
    "/v1/auth/verify-code",
    {
      schema: {
        body: verifyCodeBodySchema,
        response: { 200: verifyCodeResponseSchema },
      },
    },
    async (request, reply): Promise<VerifyCodeResponse> => {
      const body = request.body as VerifyCodeBody;
      const result = await verifyLoginCode(dependencies, {
        requestId: request.id,
        loginCookie: readAuthCookie(request, "login"),
        code: body.code,
        door: body.door,
        clientAddress: clientAddressOf(request),
        browser: userAgentSummaryOf(request),
        logger: request.log,
      });
      const { effects } = result;
      if (effects.clearLogin) {
        clearAuthCookie(reply, "login");
      }
      if (effects.session !== null) {
        setMemberSessionCookie(
          reply,
          effects.session.token,
          MEMBER_SESSION_IDLE_SECONDS,
        );
      }
      if (effects.signupToken !== null) {
        setAuthCookie(
          reply,
          "signup",
          effects.signupToken,
          SIGNUP_TOKEN_TTL_SECONDS,
        );
      }
      return result.response;
    },
  );

  // GET /v1/auth/journey (D66; 05 RG111): the step a reloaded journey resumes at, from the two
  // signed journey cookies only (journey.ts). No database, no GoTrue, nothing logged: the answer
  // carries the address, so it is never stored by any cache (no-store), relay included.
  app.get(
    "/v1/auth/journey",
    { schema: { response: { 200: journeyResponseSchema } } },
    async (request, reply): Promise<JourneyResponse> => {
      const result = readJourney(
        dependencies.tokens,
        {
          loginCookie: readAuthCookie(request, "login"),
          signupCookie: readAuthCookie(request, "signup"),
        },
        dependencies.now(),
      );
      if (result.clearLogin) {
        clearAuthCookie(reply, "login");
      }
      if (result.clearSignup) {
        clearAuthCookie(reply, "signup");
      }
      reply.header("cache-control", "no-store");
      return result.response;
    },
  );

  // POST /v1/auth/journey/reset (D66): "change address" or "start again" ends the journey of this
  // browser. A named action without a body; both journey cookies are cleared, whatever they hold.
  app.post(
    "/v1/auth/journey/reset",
    { schema: { response: { 200: journeyResetResponseSchema } } },
    async (_request, reply): Promise<JourneyResetResponse> => {
      clearAuthCookie(reply, "login");
      clearAuthCookie(reply, "signup");
      reply.header("cache-control", "no-store");
      return { outcome: "reset" };
    },
  );

  // POST /v1/signup (J5 commit 4): screen 3. The body is validated by the route schema, both
  // variants at once: every invalid field is listed in the 400 (05 RG10, CA69). The sign-up token
  // is the only proof of the address (EC-4); without it, 401 and the journey starts again.
  app.post(
    "/v1/signup",
    {
      schema: {
        body: signupBodySchema,
        response: { 200: signupResponseSchema },
      },
    },
    async (request, reply): Promise<SignupResponse> => {
      const signupCookie = readAuthCookie(request, "signup");
      const result = await completeSignup(dependencies, {
        requestId: request.id,
        signupCookie,
        body: request.body as SignupBody,
        browser: userAgentSummaryOf(request),
        logger: request.log,
      });
      if (result.kind === "unauthenticated") {
        if (result.clearSignup) {
          clearAuthCookie(reply, "signup");
        }
        throw new ApiError("unauthenticated");
      }
      if (result.kind === "invalid") {
        // D63 (RG124, CA5): the front shows signup.consent.errors.required on the checkbox.
        throw new RequestValidationError(
          result.consentRequired
            ? [{ path: "marketingConsent", issue: "consent_required" }]
            : [],
        );
      }
      if (result.clearSignup) {
        clearAuthCookie(reply, "signup");
      }
      if (result.session !== null) {
        setMemberSessionCookie(
          reply,
          result.session.token,
          MEMBER_SESSION_IDLE_SECONDS,
        );
      }
      return result.response;
    },
  );

  // POST /v1/auth/logout: a named action, no body (J3-D). The cookie is cleared even when the
  // session is unknown (security arbitration of the J3, rule 8).
  app.post(
    "/v1/auth/logout",
    { schema: { response: { 200: logoutResponseSchema } } },
    async (request, reply) => {
      const tokenHash = sessionTokenHashOf(
        readAuthCookie(request, "webSession"),
      );
      if (tokenHash !== null) {
        try {
          await withUserTransaction(
            dependencies.database,
            { sessionTokenHash: tokenHash, requestId: request.id },
            async (tx, context) => revokeOwnSession(tx, context.sessionId),
          );
        } catch (error) {
          if (!(error instanceof SessionNotFoundError)) {
            throw error;
          }
          request.log.info({}, "logout without a valid session");
        }
      }
      clearAuthCookie(reply, "webSession");
      return { outcome: "signed_out" as const };
    },
  );

  // GET /v1/me, minimal at J3: the first answer that carries personal data (N2, R-2 in place).
  app.get(
    "/v1/me",
    { schema: { response: { 200: meResponseSchema } } },
    async (request, reply): Promise<MeResponse> =>
      withMemberSession(
        dependencies.database,
        request,
        reply,
        dependencies.now,
        async (tx, context) => {
          const profile = await ownProfile(tx);
          if (profile === null) {
            throw new ApiError("unauthenticated");
          }
          return {
            email: profile.email,
            role: context.role,
            preferredLanguage: profile.preferredLanguage,
          };
        },
      ),
  );
}
