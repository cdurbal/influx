// Routes of the creator's read of the open campaigns (docs/mvp/11 RG13 to RG26, RG33, RG35, RG36,
// CA2 to CA5, CA10, CA15 to CA18; 09 RG99 to RG101; 18 T14, T15.3 to T15.5; jalons/l3d/modele.md §5,
// §7; fiche invariants 1, 2, 5 to 8). Web surface only, member session required, creator role only.
// - GET /v1/open-campaigns?sort=recent|deadline&page=1..50   a page of the feed
// - GET /v1/open-campaigns/:id                                the record of an OPEN campaign
// - GET /v1/open-campaigns/:id/brand-logo                     the logo of its brand, relayed as JSON
// Every read goes through a door of the schema `search` (0314), which checks the caller, computes the
// visibility, holds the bucket of the account and journals the outcome; the line is COMMITTED with the
// answer, and a refusal is answered AFTER the COMMIT:
// - an unknown, invisible, greyed (record only), paused, closed, unpublished campaign or one of a brand
//   suspended: 404 not_found, the same code and body as an address that does not exist (T14, RG24);
// - the bucket of the account full: 429 rate_limited with Retry-After (CA18, T15.5);
// - a page beyond the cap of the base: 400 validation_failed on `page` (RG21, CA18);
// - the door refusing the caller (a storefront suspended, RG23): 403 forbidden, nothing journaled.
// Any role but creator gets the answer of a route that does not exist (T14.3): before any door is
// called, and before the terms gate, as the brand's campaign routes do. The rate per client address
// is server.ts's (platform/member-rate.ts), before the session. Every answer is `no-store`.
import {
  OPEN_CAMPAIGNS_PAGE_CAP_ISSUE,
  openCampaignBrandLogoResponseSchema,
  openCampaignParamsSchema,
  openCampaignRecordResponseSchema,
  openCampaignsQuerySchema,
  openCampaignsResponseSchema,
  type OpenCampaignBrandLogoResponse,
  type OpenCampaignParams,
  type OpenCampaignRecordResponse,
  type OpenCampaignsQuery,
  type OpenCampaignsResponse,
} from "@influx/contracts/open-campaigns";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import { ApiError, RetryLaterError } from "../../../platform/errors.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../../identity/member-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import { BRAND_LOGO_BUCKET, brandLogoOf } from "../../profiles/brand-logo.ts";
import {
  isRefusal,
  readOpenCampaign,
  readOpenCampaigns,
  type OpenCampaignRefusal,
} from "./open-campaigns.ts";
import { callOpenCampaignLogoDoor } from "./repository.ts";

export type OpenCampaignRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
  store: ObjectStore;
};

export const OPEN_CAMPAIGNS_ROUTE = "/v1/open-campaigns";
const OPEN_CAMPAIGN_ROUTE = `${OPEN_CAMPAIGNS_ROUTE}/:id`;

/** The door refused the caller (search.require_campaign_reader, 0314): 42501 `forbidden`. */
function isReaderRefused(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const { code, message } = current as Error & { code?: unknown };
    if (code === "42501") {
      // a missing GRANT is 42501 too, with another message: a fault, never a 403
      return message === "forbidden";
    }
    current = current.cause;
  }
  return false;
}

/** The answer of a refusal the base committed (modele §7); the line names no account (D60). */
function refuse(request: FastifyRequest, refusal: OpenCampaignRefusal): never {
  request.log.info(
    { outcome: refusal.outcome },
    "search.open_campaigns.refused",
  );
  switch (refusal.outcome) {
    case "rate_limited":
      throw new RetryLaterError("rate_limited", refusal.retryAfterSeconds);
    case "page_cap":
      throw new ApiError("validation_failed", [
        { path: "page", issue: OPEN_CAMPAIGNS_PAGE_CAP_ISSUE },
      ]);
    case "refused":
      throw new ApiError("not_found");
  }
}

export function registerOpenCampaignRoutes(
  app: IdentityApp,
  dependencies: OpenCampaignRoutesDependencies,
): void {
  const { database, now, store } = dependencies;

  /** The member session of a creator; any other role is "no such route" (T14.3). */
  async function asCreator<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    // What a creator reads of another member's published data: never kept by a cache.
    void reply.header("cache-control", "no-store");
    try {
      return await withMemberSession(
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
    } catch (error) {
      // RG23: a storefront suspended (or no storefront at all); nothing was journaled
      if (isReaderRefused(error)) {
        throw new ApiError("forbidden");
      }
      throw error;
    }
  }

  /** The campaign of the path, lower case as the base writes it. */
  const campaignOf = (request: FastifyRequest): string =>
    (request.params as OpenCampaignParams).id.toLowerCase();

  app.get(
    OPEN_CAMPAIGNS_ROUTE,
    {
      schema: {
        querystring: openCampaignsQuerySchema,
        response: { 200: openCampaignsResponseSchema },
      },
    },
    async (request, reply): Promise<OpenCampaignsResponse> => {
      const { sort, page } = request.query as OpenCampaignsQuery;
      const answer = await asCreator(request, reply, (tx) =>
        readOpenCampaigns(tx, sort, page),
      );
      if (isRefusal(answer)) {
        refuse(request, answer);
      }
      return answer;
    },
  );

  app.get(
    OPEN_CAMPAIGN_ROUTE,
    {
      schema: {
        params: openCampaignParamsSchema,
        response: { 200: openCampaignRecordResponseSchema },
      },
    },
    async (request, reply): Promise<OpenCampaignRecordResponse> => {
      const campaignId = campaignOf(request);
      const answer = await asCreator(request, reply, (tx) =>
        readOpenCampaign(tx, campaignId),
      );
      if (isRefusal(answer)) {
        refuse(request, answer);
      }
      return answer;
    },
  );

  app.get(
    `${OPEN_CAMPAIGN_ROUTE}/brand-logo`,
    {
      schema: {
        params: openCampaignParamsSchema,
        response: { 200: openCampaignBrandLogoResponseSchema },
      },
    },
    async (request, reply): Promise<OpenCampaignBrandLogoResponse> => {
      const campaignId = campaignOf(request);
      const row = await asCreator(request, reply, (tx) =>
        callOpenCampaignLogoDoor(tx, campaignId),
      );
      if (!row.visible) {
        // the campaign is not one of the feed: the answer of a route that does not exist (T14)
        throw new ApiError("not_found");
      }
      if (
        row.objectKey === null ||
        row.width === null ||
        row.height === null ||
        row.activatedAt === null
      ) {
        return { logo: null };
      }
      // the object, by the key of the base: never named by the client, never in an answer nor a log
      const read = await store.read(BRAND_LOGO_BUCKET, row.objectKey);
      if (!read.ok) {
        request.log.error(
          {
            reason: read.reason,
            status: read.status,
            errorCode: read.errorCode,
          },
          "search.open_campaigns.logo_read_failed",
        );
        throw new ApiError("service_unavailable");
      }
      if (read.value === null) {
        // a row without its object: never a broken image; a person looks (D60 error line)
        request.log.error({}, "search.open_campaigns.logo_object_missing");
        return { logo: null };
      }
      return {
        logo: brandLogoOf(read.value, {
          width: row.width,
          height: row.height,
          updatedAt: row.activatedAt,
        }),
      };
    },
  );
}
