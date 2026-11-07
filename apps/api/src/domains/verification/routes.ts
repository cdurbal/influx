// Routes of the creator's own verification requests (docs/mvp/08 RG11 to RG14, RG21 to RG23, RG60;
// 18 T14; jalons/l2e/modele.md §6; commit 12). Web surface only, member session required. The account
// is always the session's: no route takes an account id, and a request is reached by its identifier AND
// the account (another creator's request is an unknown one, T14).
// - GET  /v1/me/verification                       the lines, network by network: badges, requests
// - POST /v1/me/verification/requests              open the request of a (network, level), or take back
//                                                  the open draft; the line is named by its network
// - POST /v1/me/verification/requests/:id/code     a new code on the draft (the former one revoked)
// - POST /v1/me/verification/requests/:id/submit   the draft to the queue
// - POST /v1/me/verification/requests/:id/cancel   before any decision
// - PUT  /v1/me/verification/requests/:id/evidence the raw bytes of ONE image, 8 MiB at most (the
//                                                  only exception to the relay's 2 MiB, D82 (1)),
//                                                  re-encoded; the piece as metadata (commit 13)
// - DELETE …/requests/:id/evidence/:evidenceId     a piece of the draft withdrawn (commit 13)
// Any role but creator (a brand included) gets the answer of a
// route that does not exist: the same code and the same body as an unknown address (T14.3, T14.4).
// The terms gate applies to a creator only, for that reason checked here and not by the session
// helper (the same shape as the creator profile's). Nothing here is kept by a cache.
import {
  creatorVerificationResponseSchema,
  openVerificationRequestBodySchema,
  VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES,
  verificationEvidenceParamsSchema,
  verificationEvidenceResponseSchema,
  verificationRequestParamsSchema,
  verificationRequestResponseSchema,
  type CreatorVerificationResponse,
  type OpenVerificationRequestBody,
  type VerificationEvidenceParams,
  type VerificationEvidenceResponse,
  type VerificationRequestParams,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import type { ImageSlots } from "../../platform/images.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  removeEvidence,
  uploadEvidence,
  type EvidenceDependencies,
} from "./evidence.ts";
import {
  cancelCreatorRequest,
  openCreatorRequest,
  readCreatorVerification,
  renewCreatorCode,
  submitCreatorRequest,
} from "./service.ts";

export const VERIFICATION_ROUTE = "/v1/me/verification";
const REQUESTS_ROUTE = `${VERIFICATION_ROUTE}/requests`;
const REQUEST_ROUTE = `${REQUESTS_ROUTE}/:id`;

/** The deposit of a piece (D82 (1)); the relay holds the same exception (relay.ts). */
export const EVIDENCE_ROUTE = `${REQUEST_ROUTE}/evidence`;
const ONE_EVIDENCE_ROUTE = `${EVIDENCE_ROUTE}/:evidenceId`;

/** The only type of body the deposit reads: the raw bytes of the file, never a name (T9.9). */
export const EVIDENCE_CONTENT_TYPE = "application/octet-stream";

export type VerificationRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
  /** Supabase Storage, through src/platform/storage.ts (D82 (3)). */
  store: ObjectStore;
  /** The two slots of re-encoding of the process, shared with the logo (D82 (2)). */
  slots: ImageSlots;
};

export function registerVerificationRoutes(
  app: IdentityApp,
  dependencies: VerificationRoutesDependencies,
): void {
  const { database, now, store, slots } = dependencies;

  /** The member session of a creator; anything else is "no such route" (T14.3, T14.4). */
  function asCreator<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // Personal data of the member: never kept by a cache.
    void reply.header("cache-control", "no-store");
    return withMemberSession(
      database,
      request,
      reply,
      now,
      async (tx, context: MemberContext) => {
        if (context.role !== "creator") {
          throw new ApiError("not_found");
        }
        if (context.termsToAccept !== null) {
          throw new ApiError("terms_acceptance_required");
        }
        return work(tx);
      },
      { terms: "exempt" },
    );
  }

  const requestIdOf = (request: FastifyRequest): string =>
    (request.params as VerificationRequestParams).id;

  app.get(
    VERIFICATION_ROUTE,
    { schema: { response: { 200: creatorVerificationResponseSchema } } },
    async (request, reply): Promise<CreatorVerificationResponse> =>
      asCreator(request, reply, (tx) => readCreatorVerification(tx)),
  );

  app.post(
    REQUESTS_ROUTE,
    {
      schema: {
        body: openVerificationRequestBodySchema,
        response: { 200: verificationRequestResponseSchema },
      },
    },
    async (request, reply): Promise<VerificationRequestResponse> => {
      const body = request.body as OpenVerificationRequestBody;
      return asCreator(request, reply, (tx) => openCreatorRequest(tx, body));
    },
  );

  const acts = [
    ["code", renewCreatorCode],
    ["submit", submitCreatorRequest],
    ["cancel", cancelCreatorRequest],
  ] as const;
  for (const [name, act] of acts) {
    app.post(
      `${REQUEST_ROUTE}/${name}`,
      {
        schema: {
          params: verificationRequestParamsSchema,
          response: { 200: verificationRequestResponseSchema },
        },
      },
      async (request, reply): Promise<VerificationRequestResponse> => {
        const requestId = requestIdOf(request);
        return asCreator(request, reply, (tx) => act(tx, requestId));
      },
    );
  }

  /** The evidence service, with the creator's transactions of THIS request (session checked each time). */
  function evidenceOf(
    request: FastifyRequest,
    reply: FastifyReply,
  ): EvidenceDependencies {
    return {
      inTransaction: (work) => asCreator(request, reply, work),
      store,
      slots,
      log: request.log,
      now,
    };
  }

  app.delete(
    ONE_EVIDENCE_ROUTE,
    {
      schema: {
        params: verificationEvidenceParamsSchema,
        response: { 200: verificationRequestResponseSchema },
      },
    },
    async (request, reply): Promise<VerificationRequestResponse> => {
      const params = request.params as VerificationEvidenceParams;
      return removeEvidence(
        evidenceOf(request, reply),
        params.id,
        params.evidenceId,
      );
    },
  );

  // The deposit has a context of its own: raw bytes only, up to 8 MiB (the relay's exception for this
  // path, D82 (1)), whatever the 1 MiB of every other route; any other type is refused (415, read as
  // validation_failed) before the handler. Model: the logo (profiles/routes.ts).
  void app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      EVIDENCE_CONTENT_TYPE,
      { parseAs: "buffer", bodyLimit: VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES },
      (_request, body, done) => {
        done(null, body);
      },
    );

    scope.put(
      EVIDENCE_ROUTE,
      {
        bodyLimit: VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES,
        schema: {
          params: verificationRequestParamsSchema,
          response: { 200: verificationEvidenceResponseSchema },
        },
      },
      async (request, reply): Promise<VerificationEvidenceResponse> => {
        const requestId = requestIdOf(request);
        const body: unknown = request.body;
        const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
        if (bytes.length === 0) {
          // The session first: a brand or a stranger learns nothing of the route (T14).
          await asCreator(request, reply, async () => undefined);
          throw new ApiError("image_rejected", [
            { path: "evidence", issue: "empty" },
          ]);
        }
        return uploadEvidence(evidenceOf(request, reply), requestId, bytes);
      },
    );
  });
}
