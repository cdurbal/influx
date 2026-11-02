// Routes of the brand profile, "mon profil" (docs/mvp/06 RG2, RG5, RG14; 18 T14; jalons/l2b,
// commit 07). Web surface only, member session required. The account is always the session's: no
// route takes an account id, and no path carries an object identifier.
// - GET   /v1/me/brand-profile         the profile, its completeness, what is missing, the active codes
// - PATCH /v1/me/brand-profile         autosave of what changed (partial, one transaction)
// - POST  /v1/me/brand-profile/submit  draft or rejected to pending_review (06 RG5)
// Any role but advertiser (a creator included) gets the answer of a route that does not exist:
// the same code and the same body as an unknown address (T14.3, T14.4). The terms gate applies to
// an advertiser only, for that reason checked here and not by the session helper.
import {
  brandProfileResponseSchema,
  submitBrandProfileResponseSchema,
  updateBrandProfileBodySchema,
  updateBrandProfileResponseSchema,
  type BrandProfileResponse,
  type SubmitBrandProfileResponse,
  type UpdateBrandProfileBody,
  type UpdateBrandProfileResponse,
} from "@influx/contracts/brand-profile";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  readBrandProfile,
  saveBrandProfile,
  submitBrandProfile,
} from "./brand-profile.ts";

export type BrandProfileRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export function registerBrandProfileRoutes(
  app: IdentityApp,
  dependencies: BrandProfileRoutesDependencies,
): void {
  const { database, now } = dependencies;

  /** The member session of an advertiser; anything else is "no such route" (T14.3, T14.4). */
  function asAdvertiser<T>(
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
    "/v1/me/brand-profile",
    { schema: { response: { 200: brandProfileResponseSchema } } },
    async (request, reply): Promise<BrandProfileResponse> =>
      asAdvertiser(request, reply, async (tx) => {
        const profile = await readBrandProfile(tx);
        if (profile === null) {
          throw new ApiError("not_found");
        }
        return profile;
      }),
  );

  app.patch(
    "/v1/me/brand-profile",
    {
      schema: {
        body: updateBrandProfileBodySchema,
        response: { 200: updateBrandProfileResponseSchema },
      },
    },
    async (request, reply): Promise<UpdateBrandProfileResponse> => {
      const body = request.body as UpdateBrandProfileBody;
      return asAdvertiser(request, reply, (tx) => saveBrandProfile(tx, body));
    },
  );

  app.post(
    "/v1/me/brand-profile/submit",
    { schema: { response: { 200: submitBrandProfileResponseSchema } } },
    async (request, reply): Promise<SubmitBrandProfileResponse> =>
      asAdvertiser(request, reply, (tx) => submitBrandProfile(tx)),
  );
}
