// Routes of the creator profile, "mon profil" (docs/mvp/07 RG1, RG2, RG14, RG16; 18 T14; jalons/l2d,
// commit 08). Web surface only, member session required. The account is always the session's: no
// route takes an account id, and no path carries an object identifier.
// - GET   /v1/me/creator-profile   the profile (blocks 1, 2 and 5), its completeness, what is missing,
//                                  the warnings of the detection, the active codes
// - PATCH /v1/me/creator-profile   autosave of what changed (partial, one transaction)
// and, from commit 09, blocks 3 and 4 (networks.ts), the line's identifier in the path, the account
// always the session's (a line of another creator is an unknown one, T14.1, T14.2):
// - GET    .../networks                     the lines, with their figures, audience and bands
// - POST   .../networks                     a new line (the main one unchecks the old one)
// - PATCH  .../networks/:id                 what changed on a line (figures typed alone: no new date)
// - DELETE .../networks/:id                 a line with its audience
// - POST   .../networks/:id/figures         "Confirmer mes chiffres": the one action that dates them
// - PUT    .../networks/:id/audience        the whole exact audience of a line
// and, from L2G commit 07, block 6 (portfolio.ts), a visual's identifier in the path, the account
// always the session's (a visual of another creator is an unknown one, T14):
// - GET    .../portfolio                    his visuals and the count of RG4, RG88
// - PUT    .../portfolio[?replaces=<uuid>]  the raw bytes of ONE image, 8 MiB at most (the relay's
//                                           exception for this path, D82 (7)), re-encoded; a new visual
//                                           or the replacement of an approved one (RG81)
// - PUT    .../portfolio/order              the placed visuals in his order (RG84)
// - PATCH  .../portfolio/:id                the caption and the box of RG83
// - DELETE .../portfolio/:id                a visual withdrawn (kept 30 days)
// - GET    .../portfolio/:id/image          one of his visuals, as JSON in base64 (no URL, T9.2)
// There is no route of submission or publication at L2D (the status stays `draft`, L2G). Any role
// but creator (a brand included) gets the answer of a route that does not exist: the same code and
// the same body as an unknown address (T14.3, T14.4). The terms gate applies to a creator only, for
// that reason checked here and not by the session helper (the same shape as the brand's).
import {
  confirmCreatorFiguresBodySchema,
  createCreatorNetworkBodySchema,
  creatorNetworkParamsSchema,
  creatorNetworksResponseSchema,
  creatorProfileResponseSchema,
  putCreatorNetworkAudienceBodySchema,
  updateCreatorNetworkBodySchema,
  updateCreatorProfileBodySchema,
  updateCreatorProfileResponseSchema,
  type ConfirmCreatorFiguresBody,
  type CreateCreatorNetworkBody,
  type CreatorNetworkParams,
  type CreatorNetworksResponse,
  type CreatorProfileResponse,
  type PutCreatorNetworkAudienceBody,
  type UpdateCreatorNetworkBody,
  type UpdateCreatorProfileBody,
  type UpdateCreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import {
  PORTFOLIO_MAX_UPLOAD_BYTES,
  portfolioCaptionBodySchema,
  portfolioCaptionResponseSchema,
  portfolioImageResponseSchema,
  portfolioItemParamsSchema,
  portfolioOrderBodySchema,
  portfolioRemovalResponseSchema,
  portfolioResponseSchema,
  portfolioUploadQuerySchema,
  portfolioUploadResponseSchema,
  type PortfolioCaptionBody,
  type PortfolioCaptionResponse,
  type PortfolioImageResponse,
  type PortfolioItemParams,
  type PortfolioOrderBody,
  type PortfolioRemovalResponse,
  type PortfolioResponse,
  type PortfolioUploadQuery,
  type PortfolioUploadResponse,
} from "@influx/contracts/creator-portfolio";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError } from "../../../platform/errors.ts";
import type { ImageSlots } from "../../../platform/images.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../../identity/member-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import {
  confirmCreatorNetworkFigures,
  createCreatorNetwork,
  putCreatorNetworkAudience,
  readCreatorNetworks,
  removeCreatorNetwork,
  updateCreatorNetwork,
} from "./networks.ts";
import {
  readPortfolio,
  readPortfolioImage,
  removePortfolioItem,
  reorderPortfolio,
  setPortfolioCaption,
  uploadPortfolioItem,
  type PortfolioDependencies,
} from "./portfolio.ts";
import { readCreatorProfile, saveCreatorProfile } from "./profile.ts";

const NETWORKS_ROUTE = "/v1/me/creator-profile/networks";
const NETWORK_ROUTE = `${NETWORKS_ROUTE}/:id`;

/** The deposit of a visual (D82 (7)); the relay holds the same exception (relay.ts). */
export const PORTFOLIO_ROUTE = "/v1/me/creator-profile/portfolio";
const PORTFOLIO_ITEM_ROUTE = `${PORTFOLIO_ROUTE}/:id`;

/** The only type of body the deposit reads: the raw bytes of the file, never a name (T9.9). */
export const PORTFOLIO_CONTENT_TYPE = "application/octet-stream";

export type CreatorProfileRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
  /** Supabase Storage, through src/platform/storage.ts (D82 (3), (7)). */
  store: ObjectStore;
  /** The two slots of re-encoding of the process, shared with the logo and the pieces (D82 (2)). */
  slots: ImageSlots;
};

export function registerCreatorProfileRoutes(
  app: IdentityApp,
  dependencies: CreatorProfileRoutesDependencies,
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

  /** The line of the path, lower case as the database writes it; the account is the session's. */
  const lineOf = (request: FastifyRequest): string =>
    (request.params as CreatorNetworkParams).id.toLowerCase();

  app.get(
    NETWORKS_ROUTE,
    { schema: { response: { 200: creatorNetworksResponseSchema } } },
    async (request, reply): Promise<CreatorNetworksResponse> =>
      asCreator(request, reply, (tx) => readCreatorNetworks(tx)),
  );

  app.post(
    NETWORKS_ROUTE,
    {
      schema: {
        body: createCreatorNetworkBodySchema,
        response: { 200: creatorNetworksResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorNetworksResponse> => {
      const body = request.body as CreateCreatorNetworkBody;
      return asCreator(request, reply, (tx) => createCreatorNetwork(tx, body));
    },
  );

  app.patch(
    NETWORK_ROUTE,
    {
      schema: {
        params: creatorNetworkParamsSchema,
        body: updateCreatorNetworkBodySchema,
        response: { 200: creatorNetworksResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorNetworksResponse> => {
      const body = request.body as UpdateCreatorNetworkBody;
      const lineId = lineOf(request);
      return asCreator(request, reply, (tx) =>
        updateCreatorNetwork(tx, lineId, body),
      );
    },
  );

  app.delete(
    NETWORK_ROUTE,
    {
      schema: {
        params: creatorNetworkParamsSchema,
        response: { 200: creatorNetworksResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorNetworksResponse> => {
      const lineId = lineOf(request);
      return asCreator(request, reply, (tx) =>
        removeCreatorNetwork(tx, lineId),
      );
    },
  );

  app.post(
    `${NETWORK_ROUTE}/figures`,
    {
      schema: {
        params: creatorNetworkParamsSchema,
        body: confirmCreatorFiguresBodySchema,
        response: { 200: creatorNetworksResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorNetworksResponse> => {
      const body = request.body as ConfirmCreatorFiguresBody;
      const lineId = lineOf(request);
      return asCreator(request, reply, (tx) =>
        confirmCreatorNetworkFigures(tx, lineId, body),
      );
    },
  );

  app.put(
    `${NETWORK_ROUTE}/audience`,
    {
      schema: {
        params: creatorNetworkParamsSchema,
        body: putCreatorNetworkAudienceBodySchema,
        response: { 200: creatorNetworksResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorNetworksResponse> => {
      const body = request.body as PutCreatorNetworkAudienceBody;
      const lineId = lineOf(request);
      return asCreator(request, reply, (tx) =>
        putCreatorNetworkAudience(tx, lineId, body),
      );
    },
  );

  /** The portfolio service, with the creator's transactions of THIS request (session checked each time). */
  function portfolioOf(
    request: FastifyRequest,
    reply: FastifyReply,
  ): PortfolioDependencies {
    return {
      inTransaction: (work) => asCreator(request, reply, work),
      store,
      slots,
      log: request.log,
      now,
    };
  }

  /** The visual of the path, lower case as the database writes it; the account is the session's. */
  const itemOf = (request: FastifyRequest): string =>
    (request.params as PortfolioItemParams).id.toLowerCase();

  app.get(
    PORTFOLIO_ROUTE,
    { schema: { response: { 200: portfolioResponseSchema } } },
    async (request, reply): Promise<PortfolioResponse> =>
      readPortfolio(portfolioOf(request, reply)),
  );

  app.put(
    `${PORTFOLIO_ROUTE}/order`,
    {
      schema: {
        body: portfolioOrderBodySchema,
        response: { 200: portfolioResponseSchema },
      },
    },
    async (request, reply): Promise<PortfolioResponse> => {
      const body = request.body as PortfolioOrderBody;
      return reorderPortfolio(
        portfolioOf(request, reply),
        body.itemIds.map((id) => id.toLowerCase()),
      );
    },
  );

  app.patch(
    PORTFOLIO_ITEM_ROUTE,
    {
      schema: {
        params: portfolioItemParamsSchema,
        body: portfolioCaptionBodySchema,
        response: { 200: portfolioCaptionResponseSchema },
      },
    },
    async (request, reply): Promise<PortfolioCaptionResponse> => {
      const body = request.body as PortfolioCaptionBody;
      return setPortfolioCaption(
        portfolioOf(request, reply),
        itemOf(request),
        body,
      );
    },
  );

  app.delete(
    PORTFOLIO_ITEM_ROUTE,
    {
      schema: {
        params: portfolioItemParamsSchema,
        response: { 200: portfolioRemovalResponseSchema },
      },
    },
    async (request, reply): Promise<PortfolioRemovalResponse> =>
      removePortfolioItem(portfolioOf(request, reply), itemOf(request)),
  );

  app.get(
    `${PORTFOLIO_ITEM_ROUTE}/image`,
    {
      schema: {
        params: portfolioItemParamsSchema,
        response: { 200: portfolioImageResponseSchema },
      },
    },
    async (request, reply): Promise<PortfolioImageResponse> =>
      readPortfolioImage(portfolioOf(request, reply), itemOf(request)),
  );

  // The deposit has a context of its own: raw bytes only, up to 8 MiB (the relay's exception for this
  // path, D82 (7)), whatever the 1 MiB of every other route; any other type is refused (415, read as
  // validation_failed) before the handler. Model: the pieces (verification/routes.ts).
  void app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      PORTFOLIO_CONTENT_TYPE,
      { parseAs: "buffer", bodyLimit: PORTFOLIO_MAX_UPLOAD_BYTES },
      (_request, body, done) => {
        done(null, body);
      },
    );

    scope.put(
      PORTFOLIO_ROUTE,
      {
        bodyLimit: PORTFOLIO_MAX_UPLOAD_BYTES,
        schema: {
          querystring: portfolioUploadQuerySchema,
          response: { 200: portfolioUploadResponseSchema },
        },
      },
      async (request, reply): Promise<PortfolioUploadResponse> => {
        const query = request.query as PortfolioUploadQuery;
        const body: unknown = request.body;
        const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
        if (bytes.length === 0) {
          // The session first: a brand or a stranger learns nothing of the route (T14).
          await asCreator(request, reply, async () => undefined);
          throw new ApiError("image_rejected", [
            { path: "portfolio", issue: "empty" },
          ]);
        }
        return uploadPortfolioItem(
          portfolioOf(request, reply),
          bytes,
          query.replaces?.toLowerCase() ?? null,
        );
      },
    );
  });
}
