// Fastify server of apps/api (docs/mvp/02-architecture-3-espaces.md §4 and §9,
// docs/mvp/21-plan-de-developpement.md §4, J1-E and J1-G).
import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import fastifyCookie from "@fastify/cookie";
import { systemStatusSchema } from "@influx/contracts/system";
import Fastify, { LogController } from "fastify";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { DestinationStream } from "pino";
import type { ApiConfig } from "./config/schema.ts";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "./db/index.ts";
import {
  BACKOFFICE_SESSIONLESS_ROUTES,
  registerBackofficeAuthRoutes,
} from "./domains/identity/backoffice-routes.ts";
import { requireBackofficeSession } from "./domains/identity/backoffice-session.ts";
import { registerBackofficeAccountRoutes } from "./domains/backoffice/accounts-routes.ts";
import { registerDataExportRoutes } from "./domains/privacy/member/routes.ts";
import { registerBackofficeActionRoutes } from "./domains/backoffice/actions-routes.ts";
import { registerBackofficeInvitationRoutes } from "./domains/backoffice/invitations-routes.ts";
import { PWNED_PASSWORDS_TIMEOUT_MS } from "./domains/identity/settings.ts";
import {
  registerIdentityRoutes,
  type IdentityDependencies,
} from "./domains/identity/routes.ts";
import { registerBrevoWebhookRoute } from "./domains/leads/brevo-webhook.ts";
import { OpsRecorder } from "./domains/ops/recorder.ts";
import { registerOpsRoutes } from "./domains/ops/routes.ts";
import { createAuthTokenCodec } from "./platform/auth-tokens.ts";
import { createTransactionalSender } from "./platform/brevo-transactional.ts";
import { createPwnedPasswordCheck } from "./platform/hibp.ts";
import { createSupabaseAuth } from "./platform/supabase.ts";
import {
  ApiError,
  classifyError,
  errorEnvelope,
  HTTP_STATUS_BY_CODE,
  RetryLaterError,
  UnserializedResponseError,
} from "./platform/errors.ts";
import {
  API_PREFIX,
  BACKOFFICE_PREFIX,
  checkRouteSurface,
  createSurfaceIdentifier,
  HEALTH_ROUTE,
  INTERNAL_SECRET_HEADER,
  isReachableFrom,
  routeSurface,
  type RouteSurface,
  type SurfaceIdentifier,
} from "./platform/internal-auth.ts";
import {
  CLIENT_ADDRESS_HEADER,
  readClientAddress,
} from "./platform/client-address.ts";
import { createLogger } from "./platform/logger.ts";
import { readClientUserAgent } from "./platform/user-agent.ts";
import {
  withEnvelopeFallback,
  zodSerializerCompiler,
  zodValidatorCompiler,
  type ZodTypeProvider,
} from "./platform/schema-compilers.ts";
import {
  isWriteMethod,
  isWriteOriginAllowed,
  isWriteOriginException,
} from "./platform/write-origin.ts";

declare module "fastify" {
  interface FastifyContextConfig {
    /** "shared" for a route that both fronts may call; otherwise deduced from the prefix. */
    surface?: RouteSurface;
  }
}

/** Same ceiling as the relay of the fronts (`03` PP-9). */
export const MAX_BODY_BYTES = 1_048_576;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Request identifier: the one set by the relay, only when the internal secret is valid and the
 * value has the shape of a UUID (`03` PP-7, 18 T7.11); otherwise a new one. Without the secret
 * condition, anyone reaching the API would choose the identifier of its own log line. It appears
 * in the error envelope and in every log line.
 */
function requestIdOf(
  request: IncomingMessage,
  identifySurface: SurfaceIdentifier,
): string {
  const relayed = request.headers["x-request-id"];
  const isFromRelay =
    identifySurface(request.headers[INTERNAL_SECRET_HEADER]) !== null;
  return isFromRelay &&
    typeof relayed === "string" &&
    UUID_PATTERN.test(relayed)
    ? relayed.toLowerCase()
    : randomUUID();
}

/** Methods whose parameters are in the path: a route of theirs declares no body (21 J3-D). */
const BODYLESS_ROUTE_METHODS: ReadonlySet<string> = new Set(["GET", "DELETE"]);

/**
 * 21 J3-D (C-3): a DELETE carries neither a body nor a content-type. Refused before any parsing,
 * so that the answer never depends on how Fastify treats an empty body.
 */
function deleteCarriesBody(headers: IncomingHttpHeaders): boolean {
  return (
    headers["content-type"] !== undefined ||
    headers["transfer-encoding"] !== undefined ||
    (headers["content-length"] !== undefined &&
      headers["content-length"] !== "0")
  );
}

/** Route-level hooks that could change a response after, or around, its schema (21 N2). */
const ROUTE_HOOKS_REFUSED = ["onSend", "preSerialization"] as const;

/** A route option holding one hook or a list of hooks; an empty list declares none. */
function hasHook(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value !== undefined;
}

/** One log line per request, written on completion: method, route model, status, duration. */
class ApiLogController extends LogController {
  constructor() {
    super({ requestIdLogLabel: "requestId" });
  }

  override incomingRequest(): void {
    // Deliberately silent: the completion line carries everything useful.
  }

  override requestCompleted(
    error: Error | null | undefined,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const fields = {
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    };
    if (error) {
      reply.log.error({ ...fields, err: error }, "request errored");
    } else {
      reply.log.info(fields, "request completed");
    }
  }

  override routeNotFound(request: FastifyRequest): void {
    // The default line quotes the raw URL; the method is enough (02 §20.8).
    request.log.info({ method: request.method }, "route not found");
  }

  // The two lines below use the error's message as the line's message by default: a message may
  // carry values (21 J1-J A1). The error itself goes through the allow-list serializer.
  override defaultErrorLog(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const level = reply.statusCode >= 500 ? "error" : "info";
    reply.log[level](
      { method: request.method, statusCode: reply.statusCode, err: error },
      "request failed in the default error handler",
    );
  }

  override writeHeadError(
    error: Error,
    _request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    reply.log.warn({ err: error }, "response headers could not be written");
  }
}

export type BuildServerOptions = {
  /** Where log lines are written; standard output when absent. Tests capture it. */
  logDestination?: DestinationStream;
  /**
   * The database pools of the process (main.ts creates them once). Absent: created here from the
   * configuration, and closed with the server. They connect on first use only.
   */
  database?: ApiDatabase;
  /** Replacements of the authentication dependencies, for the tests only. */
  identity?: Partial<Omit<IdentityDependencies, "database">>;
  /**
   * The collector of D60 (main.ts creates it and starts its flush). Absent: one is created here,
   * in memory only, never flushed (tests).
   */
  ops?: OpsRecorder;
};

export function buildServer(
  config: ApiConfig,
  options: BuildServerOptions = {},
) {
  const logger = createLogger(
    {
      service: "api",
      environment: config.environment,
      version: config.version,
    },
    options.logDestination,
  );
  const identifySurface = createSurfaceIdentifier(config.internalSecrets);
  const ops =
    options.ops ??
    new OpsRecorder({ version: config.version, instance: config.instance });

  const app = Fastify({
    loggerInstance: logger,
    logController: new ApiLogController(),
    genReqId: (request) => requestIdOf(request, identifySurface),
    bodyLimit: MAX_BODY_BYTES,
    // The client address comes from the relayed x-real-ip only, read after the internal secret;
    // request.ip is never used (03 §6.4 A5, point 1).
    trustProxy: false,
    // The relay only forwards GET, POST, PATCH, PUT and DELETE (`03` PP-3).
    exposeHeadRoutes: false,
    // The router answers a malformed URL (FST_ERR_BAD_URL), a parameter over 100 characters
    // (FST_ERR_MAX_PARAM_LENGTH) or a failed async constraint (FST_ERR_ASYNC_CONSTRAINT) before
    // any hook: by default in Fastify's own format, quoting the URL, and before the secret check.
    // Answered here in the envelope instead: 401 without a known secret, otherwise 404; nothing
    // of the request is copied back, and the line carries the code only (21 §3 EC-27, EC-26).
    frameworkErrors: (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const caller = identifySurface(request.headers[INTERNAL_SECRET_HEADER]);
      const code = caller === null ? "unauthenticated" : "not_found";
      request.log.info(
        { errorCode: code, err: error },
        "request refused by the router",
      );
      void reply
        .code(HTTP_STATUS_BY_CODE[code])
        .send(errorEnvelope({ code }, request.id));
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  app.decorateRequest("clientAddress", null);
  app.decorateRequest("surface", null);
  // Cookies (21 J3-C rule 8): parsing and serialisation only. No automatic parsing (`hook:
  // false`): src/platform/auth-cookies.ts parses the header on demand, after the internal secret.
  // No secret here: the short tokens are signed by src/platform/auth-tokens.ts alone.
  void app.register(fastifyCookie, { hook: false });

  // Structural rules on every route, checked when the route is registered: a violation stops
  // the server before it listens (02 §4 rule 1, 21 J1-E).
  app.addHook("onRoute", (route) => {
    const { url } = route;
    const routeName = `${String(route.method)} ${url}`;
    if (url !== HEALTH_ROUTE && !url.startsWith(API_PREFIX)) {
      throw new Error(`Route ${url} is outside /v1/ (02 §9.2)`);
    }
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const bodyless = methods.filter((method) =>
      BODYLESS_ROUTE_METHODS.has(String(method)),
    );
    if (bodyless.length > 0 && route.schema?.body !== undefined) {
      throw new Error(
        `Route ${routeName} declares a body for ${bodyless.join(", ")}: its parameters are in the ` +
          "path; a deletion that needs a body is a POST on a named action (21 J3-D)",
      );
    }
    if (route.serializerCompiler !== undefined) {
      throw new Error(
        `Route ${routeName} sets its own serializer compiler: responses go through zod only`,
      );
    }
    // A route hook may rewrite the payload after the response schema (onSend) or hand it a value
    // the schema never sees as intended (preSerialization): only the server-wide hooks below
    // exist (21 J1-J N2, F-1).
    for (const hook of ROUTE_HOOKS_REFUSED) {
      if (hasHook(route[hook])) {
        throw new Error(
          `Route ${routeName} declares its own ${hook} hook: the response filter allows none`,
        );
      }
    }
    // No response without a schema, and the envelope as fallback (18 TM11.4 b and c).
    route.schema = withEnvelopeFallback(routeName, route.schema);
    // Surface bound to the prefix (21 J1-G, J1-J A2). /health belongs to no surface.
    if (url !== HEALTH_ROUTE) {
      checkRouteSurface(url, route.config?.surface);
    }
  });

  // 18 TM11.4 (c): a body reaches the client only through a response schema. A string, a buffer
  // or a stream skips serialization entirely: preSerialization never runs for it. Such a reply
  // is refused like an undeclared status code, and answered as a 500 envelope.
  const serializedReplies = new WeakSet<FastifyReply>();
  app.addHook("preSerialization", async (_request, reply, payload) => {
    serializedReplies.add(reply);
    return payload;
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    if (
      payload !== undefined &&
      payload !== null &&
      !serializedReplies.has(reply)
    ) {
      throw new UnserializedResponseError();
    }
    return payload;
  });

  // Internal secret and surface, before any body parsing (`03` PP-8, T7.9, 21 J1-G); then, for
  // an identified surface only: the surface whose cookies may be read (J3-C rule 8), the client
  // address (A5), the browser agent (05 Q14), the origin of writes (A4, but for its single closed
  // exception, the Brevo webhook, which authenticates itself) and the bodiless DELETE (C-3).
  // Nothing of the request is read before the secret is validated.
  app.addHook("onRequest", async (request) => {
    const routeUrl = request.routeOptions.url;
    if (request.method === "GET" && routeUrl === HEALTH_ROUTE) {
      return;
    }
    const caller = identifySurface(request.headers[INTERNAL_SECRET_HEADER]);
    if (caller === null) {
      throw new ApiError("unauthenticated");
    }
    request.surface = caller;
    request.clientAddress = readClientAddress(
      request.headers[CLIENT_ADDRESS_HEADER],
      config.authThrottlePepper,
    );
    readClientUserAgent(request);
    if (
      isWriteMethod(request.method) &&
      !isWriteOriginException(request.method, routeUrl, caller) &&
      !isWriteOriginAllowed(request.headers, config.publicOrigins[caller])
    ) {
      throw new ApiError("forbidden");
    }
    if (request.method === "DELETE" && deleteCarriesBody(request.headers)) {
      throw new ApiError("validation_failed");
    }
    if (routeUrl === undefined) {
      return; // Unknown route: the not-found handler answers 404.
    }
    const owner = routeSurface(routeUrl, request.routeOptions.config.surface);
    if (!isReachableFrom(owner, caller)) {
      // Same answer as an unknown route: the other surface's routes are not disclosed.
      throw new ApiError("not_found");
    }
  });

  // D60 (02 §20.5): every completed request, by route model, in memory; written each minute.
  app.addHook("onResponse", async (request, reply) => {
    ops.recordRequest(
      request.method,
      request.routeOptions.url,
      reply.statusCode,
      reply.elapsedTime,
    );
  });

  app.setNotFoundHandler(async (request, reply) => {
    return reply
      .code(HTTP_STATUS_BY_CODE.not_found)
      .send(errorEnvelope({ code: "not_found" }, request.id));
  });

  app.setErrorHandler(async (error, request, reply) => {
    const classified = classifyError(error);
    const statusCode = HTTP_STATUS_BY_CODE[classified.code];
    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
      ops.recordServerError(error, {
        route: request.routeOptions.url,
        requestId: request.id,
      });
    } else {
      request.log.info({ errorCode: classified.code }, "request refused");
    }
    if (error instanceof RetryLaterError) {
      void reply.header("retry-after", String(error.retryAfterSeconds));
    }
    return reply.code(statusCode).send(errorEnvelope(classified, request.id));
  });

  // Railway health check: no secret, no detail (21 J1-G). The database check arrives at J2.
  app.get(
    HEALTH_ROUTE,
    { schema: { response: { 200: systemStatusSchema } } },
    async () => ({ status: "ok" as const }),
  );

  // Authentication of the members and of the backoffice (21 §4, J3 commits 8 to 10).
  const ownsDatabase = options.database === undefined;
  const database =
    options.database ?? createApiDatabase(config.database, app.log);
  if (ownsDatabase) {
    app.addHook("onClose", async () => {
      await closeDatabase(database);
    });
  }
  // 03 §6.2, 18 T8.8: no `/v1/bo/…` handler runs for a session that is not internal and in aal2,
  // whatever the handler does itself; only the closed list of sessionless routes escapes.
  app.addHook("preHandler", async (request, reply) => {
    const routeUrl = request.routeOptions.url;
    if (
      routeUrl !== undefined &&
      routeUrl.startsWith(BACKOFFICE_PREFIX) &&
      !BACKOFFICE_SESSIONLESS_ROUTES.includes(routeUrl)
    ) {
      await requireBackofficeSession(database, request, reply);
    }
  });
  const supabaseAuth =
    options.identity?.supabaseAuth ??
    createSupabaseAuth(config.supabase, app.log);
  // One P0 sender, one circuit (02 §18.6): the sign-in code and the alerts of EC-44.
  const sender =
    options.identity?.sender ??
    createTransactionalSender(
      {
        mode: config.brevo.mode,
        testRecipients: config.brevo.testRecipients,
        apiKey: config.brevoTransport.apiKey,
        baseUrl: config.brevoTransport.baseUrl,
        senderEmail: config.brevoTransport.senderTransactional,
      },
      { logger: app.log },
    );
  registerIdentityRoutes(app, {
    database,
    supabaseAuth,
    sender,
    tokens:
      options.identity?.tokens ??
      createAuthTokenCodec(config.authTokenSigningSecret),
    pepper: config.authThrottlePepper,
    now: options.identity?.now ?? (() => new Date()),
    ...(options.identity?.codeRequestFloorMs === undefined
      ? {}
      : { codeRequestFloorMs: options.identity.codeRequestFloorMs }),
    ...(options.identity?.deliveryReportFloorMs === undefined
      ? {}
      : { deliveryReportFloorMs: options.identity.deliveryReportFloorMs }),
    ...(options.identity?.termsLookup === undefined
      ? {}
      : { termsLookup: options.identity.termsLookup }),
    ...(options.identity?.emailSwitch === undefined
      ? {}
      : { emailSwitch: options.identity.emailSwitch }),
  });
  // "Mes données": the export downloaded in the member space (21 §J8 commit 8).
  registerDataExportRoutes(app, {
    database,
    now: options.identity?.now ?? (() => new Date()),
  });

  // Authentication of the backoffice (21 §4, J3 commit 10).
  registerBackofficeAuthRoutes(app, {
    environment: { name: config.environment, brevoMode: config.brevo.mode },
    database,
    supabaseAuth,
    sender,
    pepper: config.authThrottlePepper,
    // J3S-5: every password chosen on the backoffice is looked up (B-1), the service of production.
    isPwned:
      options.identity?.isPwned ??
      createPwnedPasswordCheck({
        fetch,
        timeoutMs: PWNED_PASSWORDS_TIMEOUT_MS,
      }),
    ...(options.identity?.backofficeAuthFloorMs === undefined
      ? {}
      : { floorMs: options.identity.backofficeAuthFloorMs }),
  });

  // Read API of the backoffice v0 on member accounts (05 §K, 21 §J8 commit 5).
  registerBackofficeAccountRoutes(app, { database });

  // Action API of the backoffice v0: replay, corrections, 2V, Apollo, suppression, alerts (21 §J8
  // commit 6).
  registerBackofficeActionRoutes(app, { database });

  // Invitations of an internal account and of a member (21 §J8 commit 7).
  registerBackofficeInvitationRoutes(app, {
    database,
    publicOrigins: config.publicOrigins,
  });

  // Browser errors of the connected spaces (D60, 02 §20.5).
  registerOpsRoutes(app, {
    database,
    recorder: ops,
    now: options.identity?.now ?? (() => new Date()),
  });

  // What Brevo reports back, received through the relay of web (21 EC-12, J7 decision 1).
  registerBrevoWebhookRoute(app, {
    database,
    recorder: ops,
    secrets: config.brevoWebhook,
    now: options.identity?.now ?? (() => new Date()),
  });

  // Minimal public route, reachable from both fronts: target of the relay checks (21 J1-G).
  app.get(
    "/v1/status",
    {
      schema: { response: { 200: systemStatusSchema } },
      config: { surface: "shared" },
    },
    async () => ({ status: "ok" as const }),
  );

  return app;
}

export type ApiServer = ReturnType<typeof buildServer>;
