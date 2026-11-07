// Routes of the brand's own verification request, « Marque vérifiée » (docs/mvp/06 RG46, RG47, RG49 to
// RG52, CA26 to CA29; 18 T14; jalons/l2e/modele.md §6; commit 15). Web surface only, member session
// required. The account is always the session's: no route takes an account id, and no path carries an
// identifier (a brand has ONE request at a time, named by its account).
// - GET  /v1/me/brand-verification                  the badge, the latest request, the internal block
// - PUT  /v1/me/brand-verification/internal-details legal name, country, number: asked at the request
// - POST /v1/me/brand-verification/request          open the request, its domain code issued (CA26: no
//                                                   domain, no request), or take back the open draft
// - POST /v1/me/brand-verification/request/code     a new domain code on the draft (the former revoked)
// - POST /v1/me/brand-verification/request/submit   the draft to queue 4 (domain, block, live code)
// - POST /v1/me/brand-verification/request/cancel   before any decision
// A brand deposits no piece: the agent looks at the domain and at a public register online (EC-L2E-10).
// Any role but advertiser (a creator included) gets the answer of a route that does not exist: the same
// code and the same body as an unknown address (T14.3, T14.4). The terms gate applies to an advertiser
// only, for that reason checked here and not by the session helper. Nothing here is kept by a cache.
import {
  brandVerificationResponseSchema,
  saveBrandInternalDetailsBodySchema,
  verificationRequestResponseSchema,
  type BrandVerificationResponse,
  type SaveBrandInternalDetailsBody,
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
  cancelBrandRequest,
  openBrandRequest,
  readBrandVerification,
  renewBrandCode,
  saveBrandInternalDetails,
  submitBrandRequest,
} from "./brand-service.ts";

export const BRAND_VERIFICATION_ROUTE = "/v1/me/brand-verification";
const REQUEST_ROUTE = `${BRAND_VERIFICATION_ROUTE}/request`;

export type BrandVerificationRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export function registerBrandVerificationRoutes(
  app: IdentityApp,
  dependencies: BrandVerificationRoutesDependencies,
): void {
  const { database, now } = dependencies;

  /** The member session of an advertiser; anything else is "no such route" (T14.3, T14.4). */
  function asAdvertiser<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // Personal data of the member, the legal name and the number of his company: never cached.
    void reply.header("cache-control", "no-store");
    return withMemberSession(
      database,
      request,
      reply,
      now,
      async (tx, context: MemberContext) => {
        if (context.role !== "advertiser") {
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

  app.get(
    BRAND_VERIFICATION_ROUTE,
    { schema: { response: { 200: brandVerificationResponseSchema } } },
    async (request, reply): Promise<BrandVerificationResponse> =>
      asAdvertiser(request, reply, (tx) => readBrandVerification(tx)),
  );

  app.put(
    `${BRAND_VERIFICATION_ROUTE}/internal-details`,
    {
      schema: {
        body: saveBrandInternalDetailsBodySchema,
        response: { 200: brandVerificationResponseSchema },
      },
    },
    async (request, reply): Promise<BrandVerificationResponse> => {
      const body = request.body as SaveBrandInternalDetailsBody;
      return asAdvertiser(request, reply, (tx) =>
        saveBrandInternalDetails(tx, body),
      );
    },
  );

  const acts = [
    ["", openBrandRequest],
    ["/code", renewBrandCode],
    ["/submit", submitBrandRequest],
    ["/cancel", cancelBrandRequest],
  ] as const;
  for (const [suffix, act] of acts) {
    app.post(
      `${REQUEST_ROUTE}${suffix}`,
      { schema: { response: { 200: verificationRequestResponseSchema } } },
      async (request, reply): Promise<VerificationRequestResponse> =>
        asAdvertiser(request, reply, (tx) => act(tx)),
    );
  }
}
