// Routes of the backoffice authentication (docs/mvp/17b §3.14; 03 §6.1 B-1 to B-8, §6.2, §6.9; 21
// §4, J3 commit 10). Backoffice surface only (prefix `/v1/bo/`).
// - Sign-in, enrollment and R: the body is validated INSIDE the floor, and every outcome waits for
//   it (EC-40 point 3): the duration never tells which step failed.
// - Every answer is `Cache-Control: no-store` (EC-17 point 5: the secret and the recovery codes).
// - BACKOFFICE_SESSIONLESS_ROUTES is the closed list of the `/v1/bo/…` routes reached without a
//   session; any other passes the aal2 guard of server.ts first (03 §6.2, 18 T8.8).
import {
  backofficeEnrollBodySchema,
  backofficeEnrollConfirmBodySchema,
  backofficeEnrollConfirmResponseSchema,
  backofficeEnrollResponseSchema,
  backofficeInvitationAcceptBodySchema,
  backofficeInvitationAcceptResponseSchema,
  backofficeLoginBodySchema,
  backofficeLoginResponseSchema,
  backofficeLogoutResponseSchema,
  backofficeMeResponseSchema,
  backofficeReauthenticateBodySchema,
  backofficeReauthenticateResponseSchema,
  type BackofficeEnrollConfirmResponse,
  type BackofficeEnrollResponse,
  type BackofficeEnvironment,
  type BackofficeInvitationAcceptResponse,
  type BackofficeLoginResponse,
  type BackofficeMeResponse,
  type BackofficeReauthenticateResponse,
} from "@influx/contracts/backoffice-auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import { setTimeout as sleep } from "node:timers/promises";
import type * as z from "zod";
import { SessionNotFoundError, withUserTransaction } from "../../db/index.ts";
import { clearAuthCookie } from "../../platform/auth-cookies.ts";
import { clientAddressOf } from "../../platform/client-address.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
import {
  backofficeTokenHashOf,
  requireBackofficeSession,
  setBackofficeSessionCookie,
  withBackofficeSession,
} from "./backoffice-session.ts";
import {
  acceptInternalInvitation,
  confirmTotpEnrollment,
  reauthenticate,
  signInToBackoffice,
  startTotpEnrollment,
  type BackofficeAuthDependencies,
  type BackofficeAuthRequest,
} from "./backoffice-sign-in.ts";
import {
  backofficeSessionState,
  ownProfile,
  peerControlAvailable,
  revokeOwnSession,
} from "./repository.ts";
import type { IdentityApp } from "./routes.ts";
import { BACKOFFICE_AUTH_FLOOR_MS } from "./settings.ts";

/** The `/v1/bo/…` routes reached without a session: a constant, closed list (03 §6.2). */
export const BACKOFFICE_SESSIONLESS_ROUTES: readonly string[] = [
  "/v1/bo/auth/login",
  "/v1/bo/auth/enroll",
  "/v1/bo/auth/enroll/confirm",
  "/v1/bo/auth/invitation/accept",
  "/v1/bo/auth/logout",
];

export type BackofficeRouteDependencies = BackofficeAuthDependencies & {
  /** EC-40 point 3; injectable for the tests only. */
  floorMs?: number;
  /** 16 RG118: the environment and sending mode of the configuration, for the banner. */
  environment: BackofficeEnvironment;
};

/** Waits until `target` (a performance.now() instant), if it is still to come. */
async function waitUntil(target: number): Promise<void> {
  const remaining = target - performance.now();
  if (remaining > 0) {
    await sleep(remaining);
  }
}

/** The body, validated here so that a 400 waits for the floor too. */
function parsed<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        issue: issue.code,
      })),
    );
  }
  return result.data;
}

function authRequestOf(request: FastifyRequest): BackofficeAuthRequest {
  return {
    requestId: request.id,
    clientAddress: clientAddressOf(request),
    browser: userAgentSummaryOf(request),
    logger: request.log,
  };
}

export function registerBackofficeAuthRoutes(
  app: IdentityApp,
  dependencies: BackofficeRouteDependencies,
): void {
  const floorMs = dependencies.floorMs ?? BACKOFFICE_AUTH_FLOOR_MS;

  /** Runs a handler under the constant floor, from the reception of the request (EC-40). */
  async function underFloor<T>(
    reply: FastifyReply,
    handler: () => Promise<T>,
  ): Promise<T> {
    const receivedAt = performance.now() - reply.elapsedTime;
    void reply.header("cache-control", "no-store");
    try {
      return await handler();
    } finally {
      await waitUntil(receivedAt + floorMs);
    }
  }

  app.post(
    "/v1/bo/auth/login",
    { schema: { response: { 200: backofficeLoginResponseSchema } } },
    async (request, reply): Promise<BackofficeLoginResponse> =>
      underFloor(reply, async () => {
        const body = parsed(backofficeLoginBodySchema, request.body);
        const result = await signInToBackoffice(
          dependencies,
          authRequestOf(request),
          body,
        );
        if (result.session !== null) {
          setBackofficeSessionCookie(reply, result.session.token);
        }
        return result.response;
      }),
  );

  // First enrollment request: the factor is created, no session (J3-C rule 4, EC-56).
  app.post(
    "/v1/bo/auth/enroll",
    { schema: { response: { 200: backofficeEnrollResponseSchema } } },
    async (request, reply): Promise<BackofficeEnrollResponse> =>
      underFloor(reply, async () =>
        startTotpEnrollment(
          dependencies,
          authRequestOf(request),
          parsed(backofficeEnrollBodySchema, request.body),
        ),
      ),
  );

  // The activation link of an internal invitation (15 RG99, J8 commit 7): the account, then the
  // factor, as the first enrollment request; the second one is /enroll/confirm.
  app.post(
    "/v1/bo/auth/invitation/accept",
    { schema: { response: { 200: backofficeInvitationAcceptResponseSchema } } },
    async (request, reply): Promise<BackofficeInvitationAcceptResponse> =>
      underFloor(reply, async () =>
        acceptInternalInvitation(
          dependencies,
          authRequestOf(request),
          parsed(backofficeInvitationAcceptBodySchema, request.body),
        ),
      ),
  );

  // Second enrollment request: the session in aal2 and the ten codes, shown once (MFA-3).
  app.post(
    "/v1/bo/auth/enroll/confirm",
    { schema: { response: { 200: backofficeEnrollConfirmResponseSchema } } },
    async (request, reply): Promise<BackofficeEnrollConfirmResponse> =>
      underFloor(reply, async () => {
        const result = await confirmTotpEnrollment(
          dependencies,
          authRequestOf(request),
          parsed(backofficeEnrollConfirmBodySchema, request.body),
        );
        if (result.session !== null) {
          setBackofficeSessionCookie(reply, result.session.token);
        }
        return result.response;
      }),
  );

  // R (B-5, EC-40): behind the aal2 guard of server.ts.
  app.post(
    "/v1/bo/auth/reauthenticate",
    { schema: { response: { 200: backofficeReauthenticateResponseSchema } } },
    async (request, reply): Promise<BackofficeReauthenticateResponse> =>
      underFloor(reply, async () => {
        const body = parsed(backofficeReauthenticateBodySchema, request.body);
        const context = await requireBackofficeSession(
          dependencies.database,
          request,
          reply,
        );
        const result = await reauthenticate(
          dependencies,
          authRequestOf(request),
          context.sessionId,
          body,
        );
        if (result.revoked) {
          clearAuthCookie(reply, "backofficeSession");
        }
        return result.response;
      }),
  );

  // Logout: a named action, no body. The cookie is cleared even when the session is unknown.
  app.post(
    "/v1/bo/auth/logout",
    { schema: { response: { 200: backofficeLogoutResponseSchema } } },
    async (request, reply) => {
      void reply.header("cache-control", "no-store");
      const tokenHash = backofficeTokenHashOf(request);
      if (tokenHash !== null) {
        try {
          await withUserTransaction(
            dependencies.database,
            { sessionTokenHash: tokenHash, requestId: request.id },
            async (tx, context) => {
              if (context.role !== "agent" && context.role !== "admin") {
                // A member session presented on the backoffice surface is no session here.
                throw new SessionNotFoundError();
              }
              return revokeOwnSession(tx, context.sessionId);
            },
          );
        } catch (error) {
          if (!(error instanceof SessionNotFoundError)) {
            throw error;
          }
          request.log.info({}, "backoffice logout without a valid session");
        }
      }
      clearAuthCookie(reply, "backofficeSession");
      return { outcome: "signed_out" as const };
    },
  );

  // GET /v1/bo/me: the first backoffice answer that carries personal data. J3S-6: the second
  // factor of THIS session (the recovery banner); 15 RG107: whether peer control exists; 16 RG118:
  // the environment and its sending mode (the environment banner).
  app.get(
    "/v1/bo/me",
    { schema: { response: { 200: backofficeMeResponseSchema } } },
    async (request, reply): Promise<BackofficeMeResponse> => {
      void reply.header("cache-control", "no-store");
      return withBackofficeSession(
        dependencies.database,
        request,
        reply,
        async (tx, context) => {
          const profile = await ownProfile(tx);
          const secondFactor = await backofficeSessionState(
            tx,
            context.sessionId,
          );
          if (profile === null || secondFactor === null) {
            throw new ApiError("unauthenticated");
          }
          return {
            email: profile.email,
            role: context.role,
            secondFactor,
            peerControlAvailable: await peerControlAvailable(tx),
            environment: dependencies.environment,
          };
        },
      );
    },
  );
}
