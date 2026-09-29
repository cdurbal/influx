// Routes of the member authentication (docs/mvp/21 §5.2; 02 §18.10). Web surface only (prefix).
import {
  requestCodeBodySchema,
  requestCodeResponseSchema,
  RESEND_DELAY_SECONDS,
  type RequestCodeResponse,
} from "@influx/contracts/auth";
import type {
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "pino";
import type { ApiDatabase } from "../../db/index.ts";
import { setAuthCookie } from "../../platform/auth-cookies.ts";
import {
  LOGIN_TOKEN_TTL_SECONDS,
  type AuthTokenCodec,
} from "../../platform/auth-tokens.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import { clientAddressOf } from "../../platform/client-address.ts";
import { RequestValidationError } from "../../platform/errors.ts";
import type { ZodTypeProvider } from "../../platform/schema-compilers.ts";
import type { SupabaseAuth } from "../../platform/supabase.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
import { requestLoginCode } from "./login-code.ts";
import { CODE_REQUEST_FLOOR_MS } from "./settings.ts";

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
}
