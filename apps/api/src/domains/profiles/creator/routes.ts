// Routes of the creator profile, "mon profil" (docs/mvp/07 RG1, RG2, RG14, RG16; 18 T14; jalons/l2d,
// commit 08). Web surface only, member session required. The account is always the session's: no
// route takes an account id, and no path carries an object identifier.
// - GET   /v1/me/creator-profile   the profile (blocks 1, 2 and 5), its completeness, what is missing,
//                                  the warnings of the detection, the active codes
// - PATCH /v1/me/creator-profile   autosave of what changed (partial, one transaction)
// There is no route of submission or publication at L2D (the status stays `draft`, L2G). Any role
// but creator (a brand included) gets the answer of a route that does not exist: the same code and
// the same body as an unknown address (T14.3, T14.4). The terms gate applies to a creator only, for
// that reason checked here and not by the session helper (the same shape as the brand's).
import {
  creatorProfileResponseSchema,
  updateCreatorProfileBodySchema,
  updateCreatorProfileResponseSchema,
  type CreatorProfileResponse,
  type UpdateCreatorProfileBody,
  type UpdateCreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../../identity/member-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import { readCreatorProfile, saveCreatorProfile } from "./profile.ts";

export type CreatorProfileRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export function registerCreatorProfileRoutes(
  app: IdentityApp,
  dependencies: CreatorProfileRoutesDependencies,
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

  app.get(
    "/v1/me/creator-profile",
    { schema: { response: { 200: creatorProfileResponseSchema } } },
    async (request, reply): Promise<CreatorProfileResponse> =>
      asCreator(request, reply, async (tx) => {
        const profile = await readCreatorProfile(tx);
        if (profile === null) {
          throw new ApiError("not_found");
        }
        return profile;
      }),
  );

  app.patch(
    "/v1/me/creator-profile",
    {
      schema: {
        body: updateCreatorProfileBodySchema,
        response: { 200: updateCreatorProfileResponseSchema },
      },
    },
    async (request, reply): Promise<UpdateCreatorProfileResponse> => {
      const body = request.body as UpdateCreatorProfileBody;
      return asCreator(request, reply, (tx) => saveCreatorProfile(tx, body));
    },
  );
}
