// Routes of the member authentication (docs/mvp/21 §5.2; 02 §18.10; 05 RG42 to RG69). Web surface
// only (prefix): request-code, verify-code, logout, and the minimal GET /v1/me of the J3.
import {
  logoutResponseSchema,
  meResponseSchema,
  requestCodeBodySchema,
  requestCodeResponseSchema,
  RESEND_DELAY_SECONDS,
  verifyCodeBodySchema,
  verifyCodeResponseSchema,
  type MeResponse,
  type RequestCodeResponse,
  type VerifyCodeBody,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
import type {
  FastifyInstance,
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
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type { ZodTypeProvider } from "../../platform/schema-compilers.ts";
import type { SupabaseAuth } from "../../platform/supabase.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
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
};

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
