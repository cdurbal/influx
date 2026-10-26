// POST /v1/webhooks/brevo/:pathToken — what Brevo reports back, received (docs/mvp/16 §M6 RG146,
// RG147; 03 §6.4 A4, A5, PP-2, PP-5, PP-12; 21 EC-12; decisions 1 and 2 of the J7 start; D60).
// Brevo signs nothing: the route authenticates the call itself, before any parsing, in this
// order (decision 1): internal secret (PP-8, server.ts), x-real-ip present, address in Brevo's
// ranges, the two tokens in constant time; then zod, the ±15 min window on ts_event, and the
// idempotence of the database (RG146-5). It writes ONE raw, stateless line through E-1
// (leads.record_brevo_event(), influx_auth) and answers at once (RG147): the worker processes the
// line later (commit 4). No Brevo call (RG148), no cookie, no session.
// Answers: address or token refused => 404, the envelope of an unknown route; authenticated but
// invalid, outside the window or already seen => 200, journaled with a closed reason; the line
// could not be written => 503 (Brevo retries); otherwise 200 {received: true}.
// Log lines: a closed reason, never the URL, the token, the address nor anything of the event.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  BREVO_WEBHOOK_BODY_LIMIT_BYTES,
  BREVO_WEBHOOK_TOKEN_HEADER,
  BREVO_WEBHOOK_WINDOW_SECONDS,
  brevoWebhookEventSchema,
  brevoWebhookReceiptSchema,
  type BrevoWebhookEvent,
  type BrevoWebhookReceipt,
} from "@influx/contracts/brevo-webhook";
import type { FastifyRequest } from "fastify";
import * as z from "zod";
import type { BrevoWebhookSecrets } from "../../config/schema.ts";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import {
  checkAddressInRanges,
  CLIENT_ADDRESS_HEADER,
  type Ipv4Range,
} from "../../platform/client-address.ts";
import { ApiError } from "../../platform/errors.ts";
import type { IdentityApp } from "../identity/routes.ts";
import type { OpsRecorder } from "../ops/recorder.ts";
import {
  isRefusedValue,
  recordBrevoEvent,
  type BrevoRawLine,
} from "./inbound/repository.ts";

/** The route model; the single entry of WRITE_ORIGIN_EXCEPTIONS (write-origin.ts) names it. */
export const BREVO_WEBHOOK_ROUTE = "/v1/webhooks/brevo/:pathToken";

/**
 * RG146-3: the ranges Brevo's webhooks come from, published at
 * https://help.brevo.com/hc/en-us/articles/15127404548498 ("Brevo IP ranges: List of publicly
 * exposed services", webhooks section), checked on 2026-10-13. A change at Brevo that is not
 * carried here cuts the unsubscriptions: a valid token from outside them is logged
 * `webhook.brevo.ip_drift` and counted in `ops` (decision 1).
 */
export const BREVO_WEBHOOK_ADDRESS_RANGES: readonly Ipv4Range[] = [
  { network: "1.179.112.0", prefixLength: 20 },
  { network: "172.246.240.0", prefixLength: 20 },
];

/** Why a call was refused with 404 (`warn`, webhook.brevo.rejected). A closed list. */
export const BREVO_WEBHOOK_REJECTIONS = [
  "address_absent",
  "address_invalid",
  "address_outside_ranges",
  "token_invalid",
] as const;
export type BrevoWebhookRejection = (typeof BREVO_WEBHOOK_REJECTIONS)[number];

/** Why an authenticated call wrote nothing, answered 200 (`info`, webhook.brevo.ignored). */
export const BREVO_WEBHOOK_IGNORED = [
  "invalid_payload",
  "outside_window",
  "duplicate",
] as const;
export type BrevoWebhookIgnored = (typeof BREVO_WEBHOOK_IGNORED)[number];

/**
 * A valid token from an address outside Brevo's ranges: the ranges have probably moved. Counted in
 * the `ops` error groups (D60), by its type; it carries no data.
 */
export class BrevoWebhookAddressDriftError extends Error {
  constructor() {
    super("Brevo webhook token valid from outside the published ranges");
    this.name = "BrevoWebhookAddressDriftError";
  }
}

/** The body of a call the content-type parsers could not read: invalid, answered 200. */
const UNREADABLE_BODY = Symbol("unreadable body");

const RECEIVED: BrevoWebhookReceipt = { received: true };

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Two digests per secret, current and previous. A missing value is a random digest that nothing
 * can match: every call compares the same number of fixed-length digests.
 */
function digestsOf(values: readonly string[]): [Buffer, Buffer] {
  const [current, previous] = values;
  return [
    current === undefined ? randomBytes(32) : sha256(current),
    previous === undefined ? randomBytes(32) : sha256(previous),
  ];
}

export type BrevoWebhookAuthenticator = (
  pathToken: unknown,
  headerValue: string | string[] | undefined,
) => boolean;

/**
 * RG146-1 and RG146-2: the path token AND the header token, each against its two accepted values
 * (rotation, skill env-secrets procedure B). The four comparisons always run, in constant time on
 * SHA-256 digests: neither the length nor the matching value can be told from the response time.
 * No value configured: the webhook is closed, nothing ever matches.
 */
export function createBrevoWebhookAuthenticator(
  secrets: BrevoWebhookSecrets,
): BrevoWebhookAuthenticator {
  const pathDigests = digestsOf(secrets.pathTokens);
  const headerDigests = digestsOf(secrets.headerTokens);
  const isOpen =
    secrets.pathTokens.length > 0 && secrets.headerTokens.length > 0;
  return (pathToken, headerValue) => {
    const pathCandidate = sha256(
      typeof pathToken === "string" ? pathToken : "",
    );
    const headerCandidate = sha256(
      typeof headerValue === "string" ? headerValue : "",
    );
    const pathMatches = pathDigests.map((digest) =>
      timingSafeEqual(pathCandidate, digest),
    );
    const headerMatches = headerDigests.map((digest) =>
      timingSafeEqual(headerCandidate, digest),
    );
    return (
      isOpen &&
      typeof pathToken === "string" &&
      typeof headerValue === "string" &&
      pathMatches.includes(true) &&
      headerMatches.includes(true)
    );
  };
}

export type BrevoWebhookDependencies = {
  database: ApiDatabase;
  recorder: OpsRecorder;
  secrets: BrevoWebhookSecrets;
  now: () => Date;
};

/** The arguments of leads.record_brevo_event(): an identifier of 0 is no identifier. */
function rawLineOf(event: BrevoWebhookEvent): BrevoRawLine {
  return {
    event: event.event,
    occurredAt: new Date(event.ts_event * 1000).toISOString(),
    messageId: event["message-id"] ?? null,
    email: event.email ?? null,
    campaignId:
      event.camp_id === undefined || event.camp_id === 0 ? null : event.camp_id,
    templateId:
      event.template_id === undefined || event.template_id === 0
        ? null
        : event.template_id,
    reason: event.reason ?? null,
  };
}

const paramsSchema = z.object({ pathToken: z.string() });

export function registerBrevoWebhookRoute(
  app: IdentityApp,
  dependencies: BrevoWebhookDependencies,
): void {
  const authenticate = createBrevoWebhookAuthenticator(dependencies.secrets);
  if (
    dependencies.secrets.pathTokens.length === 0 ||
    dependencies.secrets.headerTokens.length === 0
  ) {
    app.log.info({}, "webhook.brevo.closed: no token configured");
  }

  /** Refused: the envelope of an unknown route (decision 1), one `warn` line with the reason. */
  function reject(
    request: FastifyRequest,
    reason: BrevoWebhookRejection,
  ): never {
    request.log.warn({ reason }, "webhook.brevo.rejected");
    throw new ApiError("not_found");
  }

  function ignore(
    request: FastifyRequest,
    reason: BrevoWebhookIgnored,
  ): BrevoWebhookReceipt {
    request.log.info({ reason }, "webhook.brevo.ignored");
    // AL61 (15 RG165): the share of authenticated calls that wrote nothing.
    dependencies.recorder.recordSignal("webhook_brevo_ignored");
    return RECEIVED;
  }

  // A context of its own: its content-type parsers never throw, so that an authenticated call
  // whose body cannot be read is answered 200 like any invalid event (decision 1). JSON only; any
  // other type is read as unreadable. The body limit still answers 413 above 64 KiB.
  void app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "string", bodyLimit: BREVO_WEBHOOK_BODY_LIMIT_BYTES },
      (_request, body, done) => {
        try {
          done(null, JSON.parse(String(body)) as unknown);
        } catch {
          done(null, UNREADABLE_BODY);
        }
      },
    );
    scope.addContentTypeParser(
      "*",
      { parseAs: "buffer", bodyLimit: BREVO_WEBHOOK_BODY_LIMIT_BYTES },
      (_request, _body, done) => {
        done(null, UNREADABLE_BODY);
      },
    );

    scope.post(
      BREVO_WEBHOOK_ROUTE,
      {
        bodyLimit: BREVO_WEBHOOK_BODY_LIMIT_BYTES,
        schema: {
          params: paramsSchema,
          response: { 200: brevoWebhookReceiptSchema },
        },
        // Before any parsing: the address, then the two tokens (decision 1). The internal
        // secret and the surface were checked by the server-wide hook (PP-8).
        onRequest: async (request) => {
          const address = checkAddressInRanges(
            request.headers[CLIENT_ADDRESS_HEADER],
            BREVO_WEBHOOK_ADDRESS_RANGES,
          );
          if (address === "absent") {
            reject(request, "address_absent");
          }
          if (address === "invalid") {
            reject(request, "address_invalid");
          }
          // The router always sets a string; read through the schema, params are typed later.
          const params = paramsSchema.safeParse(request.params);
          const isAuthenticated = authenticate(
            params.success ? params.data.pathToken : undefined,
            request.headers[BREVO_WEBHOOK_TOKEN_HEADER],
          );
          if (address === "outside") {
            if (isAuthenticated) {
              request.log.error({}, "webhook.brevo.ip_drift");
              // AL62 (15 RG165): counted, and kept as a server error group as before.
              dependencies.recorder.recordSignal("webhook_brevo_ip_drift");
              dependencies.recorder.recordServerError(
                new BrevoWebhookAddressDriftError(),
                { route: BREVO_WEBHOOK_ROUTE, requestId: request.id },
              );
              throw new ApiError("not_found");
            }
            reject(request, "address_outside_ranges");
          }
          if (!isAuthenticated) {
            reject(request, "token_invalid");
          }
          dependencies.recorder.recordSignal("webhook_brevo_authenticated");
        },
      },
      async (request) => {
        const parsed = brevoWebhookEventSchema.safeParse(request.body);
        if (!parsed.success) {
          return ignore(request, "invalid_payload");
        }
        const line = rawLineOf(parsed.data);
        const skewMs = Math.abs(
          dependencies.now().getTime() - parsed.data.ts_event * 1000,
        );
        if (skewMs > BREVO_WEBHOOK_WINDOW_SECONDS * 1000) {
          return ignore(request, "outside_window");
        }
        let recordedId: string | null;
        try {
          recordedId = await withElevatedTransaction(
            dependencies.database,
            "leads.receive_brevo_event",
            request.id,
            async (tx) => {
              const id = await recordBrevoEvent(tx, line);
              // One audit line per raw line written; none for a duplicate (decision 1).
              return { value: id, auditSubject: id };
            },
          );
        } catch (error) {
          if (isRefusedValue(error)) {
            return ignore(request, "invalid_payload");
          }
          request.log.error({ err: error }, "webhook.brevo.write_failed");
          throw new ApiError("service_unavailable");
        }
        if (recordedId === null) {
          return ignore(request, "duplicate");
        }
        return RECEIVED;
      },
    );
  });
}
