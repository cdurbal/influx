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
// The deposit of a piece is commit 13. Any role but creator (a brand included) gets the answer of a
// route that does not exist: the same code and the same body as an unknown address (T14.3, T14.4).
// The terms gate applies to a creator only, for that reason checked here and not by the session
// helper (the same shape as the creator profile's). Nothing here is kept by a cache.
import {
  creatorVerificationResponseSchema,
  openVerificationRequestBodySchema,
  verificationRequestParamsSchema,
  verificationRequestResponseSchema,
  type CreatorVerificationResponse,
  type OpenVerificationRequestBody,
  type VerificationRequestParams,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
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

export type VerificationRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export function registerVerificationRoutes(
  app: IdentityApp,
  dependencies: VerificationRoutesDependencies,
): void {
  const { database, now } = dependencies;

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
}
