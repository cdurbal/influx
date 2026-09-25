// Fastify server of apps/api (docs/mvp/02-architecture-3-espaces.md §4 and §9,
// docs/mvp/21-plan-de-developpement.md §4, J1-E and J1-G).
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { systemStatusSchema } from "@influx/contracts/system";
import Fastify, { LogController } from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { DestinationStream } from "pino";
import type { ApiConfig } from "./config/schema.ts";
import {
  ApiError,
  classifyError,
  errorEnvelope,
  HTTP_STATUS_BY_CODE,
  UnserializedResponseError,
} from "./platform/errors.ts";
import {
  API_PREFIX,
  createSurfaceIdentifier,
  HEALTH_ROUTE,
  INTERNAL_SECRET_HEADER,
  isReachableFrom,
  routeSurface,
  type RouteSurface,
} from "./platform/internal-auth.ts";
import { createLogger } from "./platform/logger.ts";
import {
  withEnvelopeFallback,
  zodSerializerCompiler,
  zodValidatorCompiler,
  type ZodTypeProvider,
} from "./platform/schema-compilers.ts";

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
 * Request identifier: the one set by the relay when it has the shape of a UUID (`03` PP-7),
 * otherwise a new one. It appears in the error envelope and in every log line.
 */
function requestIdOf(request: IncomingMessage): string {
  const relayed = request.headers["x-request-id"];
  return typeof relayed === "string" && UUID_PATTERN.test(relayed)
    ? relayed.toLowerCase()
    : randomUUID();
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

  const app = Fastify({
    loggerInstance: logger,
    logController: new ApiLogController(),
    genReqId: requestIdOf,
    bodyLimit: MAX_BODY_BYTES,
    // The relay only forwards GET, POST, PATCH, PUT and DELETE (`03` PP-3).
    exposeHeadRoutes: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  // Structural rules on every route, checked when the route is registered: a violation stops
  // the server before it listens (02 §4 rule 1, 21 J1-E).
  app.addHook("onRoute", (route) => {
    const { url } = route;
    const routeName = `${String(route.method)} ${url}`;
    if (url !== HEALTH_ROUTE && !url.startsWith(API_PREFIX)) {
      throw new Error(`Route ${url} is outside /v1/ (02 §9.2)`);
    }
    if (route.serializerCompiler !== undefined) {
      throw new Error(
        `Route ${routeName} sets its own serializer compiler: responses go through zod only`,
      );
    }
    // No response without a schema, and the envelope as fallback (18 TM11.4 b and c).
    route.schema = withEnvelopeFallback(routeName, route.schema);
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

  // Internal secret and surface, before any body parsing (`03` PP-8, T7.9, 21 J1-G).
  app.addHook("onRequest", async (request) => {
    const routeUrl = request.routeOptions.url;
    if (request.method === "GET" && routeUrl === HEALTH_ROUTE) {
      return;
    }
    const caller = identifySurface(request.headers[INTERNAL_SECRET_HEADER]);
    if (caller === null) {
      throw new ApiError("unauthenticated");
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
    } else {
      request.log.info({ errorCode: classified.code }, "request refused");
    }
    return reply.code(statusCode).send(errorEnvelope(classified, request.id));
  });

  // Railway health check: no secret, no detail (21 J1-G). The database check arrives at J2.
  app.get(
    HEALTH_ROUTE,
    { schema: { response: { 200: systemStatusSchema } } },
    async () => ({ status: "ok" as const }),
  );

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
