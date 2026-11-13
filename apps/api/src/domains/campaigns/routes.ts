// Routes of the campaigns a brand writes, "mes campagnes" (docs/mvp/09 RG4, RG5, RG14, CA2, CA3,
// CA72; 18 T14; jalons/l3b, commit 07). Web surface only, member session required. The account is
// always the session's: no route takes an account id, and the only identifier of a path is the
// campaign's own, opaque.
// - GET   /v1/me/campaigns             the brand's campaigns: identifier, title, state, dates
// - POST  /v1/me/campaigns             a draft, empty or with the first fields (RG108: never refused
//                                      for what it lacks)
// - GET   /v1/me/campaigns/:id         the campaign, what is missing, the codes of the form
// - PATCH /v1/me/campaigns/:id         autosave of what changed (partial, lists replaced whole)
// - POST  /v1/me/campaigns/:id/submit  draft or rejected to pending_review (09 RG4, RG5, RG85)
// - GET   /v1/me/campaigns/:id/creator-view  what a creator sees of it (RG102, CA68; commit 08)
// Any role but advertiser (a creator included), a campaign of another brand and an identifier that is
// nobody's get the answer of a route that does not exist: the same code and the same body as an
// unknown address (T14.1 to T14.4). The terms gate applies to an advertiser only, for that reason
// checked here and not by the session helper (the same shape as the brand profile's).
import {
  campaignListResponseSchema,
  campaignParamsSchema,
  campaignResponseSchema,
  createCampaignBodySchema,
  submitCampaignBodySchema,
  submitCampaignResponseSchema,
  updateCampaignBodySchema,
  type CampaignListResponse,
  type CampaignParams,
  type CampaignResponse,
  type CreateCampaignBody,
  type SubmitCampaignBody,
  type SubmitCampaignResponse,
  type UpdateCampaignBody,
} from "@influx/contracts/campaign";
import {
  campaignCreatorViewResponseSchema,
  type CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  createCampaign,
  readCampaign,
  readCampaignList,
  saveCampaign,
  submitCampaign,
} from "./campaign.ts";
import { readCampaignCreatorView } from "./creator-view.ts";

export type CampaignRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

const CAMPAIGNS_ROUTE = "/v1/me/campaigns";
const CAMPAIGN_ROUTE = `${CAMPAIGNS_ROUTE}/:id`;

export function registerCampaignRoutes(
  app: IdentityApp,
  dependencies: CampaignRoutesDependencies,
): void {
  const { database, now } = dependencies;

  /** The member session of an advertiser; anything else is "no such route" (T14.3, T14.4). */
  function asAdvertiser<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // Data of the member (budget and internal reference included): never kept by a cache.
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

  /** The campaign of the path, lower case as the database writes it; the account is the session's. */
  const campaignOf = (request: FastifyRequest): string =>
    (request.params as CampaignParams).id.toLowerCase();

  app.get(
    CAMPAIGNS_ROUTE,
    { schema: { response: { 200: campaignListResponseSchema } } },
    async (request, reply): Promise<CampaignListResponse> =>
      asAdvertiser(request, reply, (tx) => readCampaignList(tx)),
  );

  app.post(
    CAMPAIGNS_ROUTE,
    {
      schema: {
        body: createCampaignBodySchema.optional(),
        response: { 200: campaignResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignResponse> => {
      const body = request.body as CreateCampaignBody | undefined;
      return asAdvertiser(request, reply, (tx) => createCampaign(tx, body));
    },
  );

  app.get(
    CAMPAIGN_ROUTE,
    {
      schema: {
        params: campaignParamsSchema,
        response: { 200: campaignResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignResponse> => {
      const campaignId = campaignOf(request);
      return asAdvertiser(request, reply, async (tx) => {
        const campaign = await readCampaign(tx, campaignId);
        if (campaign === null) {
          throw new ApiError("not_found");
        }
        return campaign;
      });
    },
  );

  app.patch(
    CAMPAIGN_ROUTE,
    {
      schema: {
        params: campaignParamsSchema,
        body: updateCampaignBodySchema,
        response: { 200: campaignResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignResponse> => {
      const body = request.body as UpdateCampaignBody;
      const campaignId = campaignOf(request);
      return asAdvertiser(request, reply, (tx) =>
        saveCampaign(tx, campaignId, body),
      );
    },
  );

  app.post(
    `${CAMPAIGN_ROUTE}/submit`,
    {
      schema: {
        params: campaignParamsSchema,
        body: submitCampaignBodySchema,
        response: { 200: submitCampaignResponseSchema },
      },
    },
    async (request, reply): Promise<SubmitCampaignResponse> => {
      const body = request.body as SubmitCampaignBody;
      const campaignId = campaignOf(request);
      return asAdvertiser(request, reply, (tx) =>
        submitCampaign(tx, campaignId, body?.declarationLocale ?? null),
      );
    },
  );

  app.get(
    `${CAMPAIGN_ROUTE}/creator-view`,
    {
      schema: {
        params: campaignParamsSchema,
        response: { 200: campaignCreatorViewResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignCreatorViewResponse> => {
      const campaignId = campaignOf(request);
      return asAdvertiser(request, reply, async (tx) => {
        const view = await readCampaignCreatorView(tx, campaignId);
        if (view === null) {
          throw new ApiError("not_found");
        }
        return view;
      });
    },
  );
}
