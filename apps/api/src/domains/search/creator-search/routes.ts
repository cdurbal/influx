// Route of the brand's anonymous creator search (docs/mvp/10 RG1, RG2, RG57 to RG59, RG63 to RG66,
// CA1, CA3, CA34 to CA36, CA41, CA42, CA47, CA59, CA65; 18 T14, T15.2 to T15.5, TM12.2 to TM12.4;
// jalons/l3e/modele.md §4, §5, §8, §10; fiche invariants 2, 3, 6, 10, 12 to 14). Web surface only,
// member session required, advertiser role only.
// - POST /v1/creator-search  {filters, sort, page, campaignId?}  a state, or a page of cards
// The read goes through the door search.search_creators() (0319, 0320), which checks the caller, the
// brand's profile, the switch, the bucket of the account, the filters, the campaign, the cap and k,
// and journals what it serves or refuses; the line is COMMITTED with the answer, and a refusal is
// answered AFTER the COMMIT:
// - the bucket of the account full: 429 rate_limited with Retry-After (RG64, T15.2, T15.5);
// - a page beyond the cap of the base: 400 validation_failed on `page` (RG63, CA42);
// Refused by the door before anything is written, the transaction rolled back:
// - a facet of the base closed in table: 400 validation_failed on `filters` (22023);
// - a campaign of origin unknown, of another brand or erased: 404 not_found, the same code and body
//   as an address that does not exist (P0002, T14.3, T14.4);
// - the caller refused by the door (an account no longer active, EC-L3E-08-1): the answer of RG1.
// Any role but advertiser gets the answer of a route that does not exist (T14.3), before the door is
// called, and before the terms gate, as the brand's campaign routes do. The rate per client address
// is server.ts's (platform/member-rate.ts), before the session. Every answer is `no-store`. No route
// of export and no size of page exist (TM12.3, RG63). Nothing is sent to the creator, to the outbox,
// to Brevo nor to Apollo (RG8, CA64).
import {
  CREATOR_SEARCH_FILTERS_ISSUE,
  CREATOR_SEARCH_PAGE_CAP_ISSUE,
  creatorSearchBodySchema,
  creatorSearchResponseSchema,
  type CreatorSearchBody,
  type CreatorSearchResponse,
} from "@influx/contracts/creator-search";
import type { FastifyRequest } from "fastify";
import type { ApiDatabase } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RetryLaterError } from "../../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../../identity/member-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import {
  isCreatorSearchRefusal,
  searchCreators,
  type CreatorSearchRefusal,
} from "./creator-search.ts";

export type CreatorSearchRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export const CREATOR_SEARCH_ROUTE = "/v1/creator-search";

/** The answer of a refusal the base committed (modele §4); the line names no account (D60). */
function refuse(request: FastifyRequest, refusal: CreatorSearchRefusal): never {
  request.log.info({ outcome: refusal.state }, "search.creator_search.refused");
  switch (refusal.state) {
    case "rate_limited":
      throw new RetryLaterError("rate_limited", refusal.retryAfterSeconds);
    case "page_cap":
      throw new ApiError("validation_failed", [
        { path: "page", issue: CREATOR_SEARCH_PAGE_CAP_ISSUE },
      ]);
  }
}

/** A refusal the door raised before writing anything, as the answer of the API; else null. */
function doorRefusalOf(error: unknown): CreatorSearchResponse | Error | null {
  const state = sqlStateOf(error);
  const detail = sqlDetailOf(error);
  if (state === "42501" && sqlMessageOf(error) === "forbidden") {
    // a missing GRANT is 42501 too, with another message: a fault, never this answer
    return creatorSearchResponseSchema.parse({ state: "brand_not_published" });
  }
  if (state === "22023" && detail === "filters") {
    return new ApiError("validation_failed", [
      { path: "filters", issue: CREATOR_SEARCH_FILTERS_ISSUE },
    ]);
  }
  if (state === "P0002" && detail === "campaign") {
    // T14.3, T14.4: another brand's campaign answers as one that does not exist
    return new ApiError("not_found");
  }
  return null;
}

export function registerCreatorSearchRoutes(
  app: IdentityApp,
  dependencies: CreatorSearchRoutesDependencies,
): void {
  const { database, now } = dependencies;

  app.post(
    CREATOR_SEARCH_ROUTE,
    {
      schema: {
        body: creatorSearchBodySchema,
        response: { 200: creatorSearchResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorSearchResponse> => {
      // What a brand reads of other members' published data: never kept by a cache.
      void reply.header("cache-control", "no-store");
      const body = request.body as CreatorSearchBody;
      let answer: CreatorSearchResponse | CreatorSearchRefusal;
      try {
        answer = await withMemberSession(
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
            return searchCreators(tx, body);
          },
          { terms: "exempt" },
        );
      } catch (error) {
        const refusal = doorRefusalOf(error);
        if (refusal === null) {
          throw error;
        }
        if (refusal instanceof Error) {
          throw refusal;
        }
        return refusal;
      }
      if (isCreatorSearchRefusal(answer)) {
        refuse(request, answer);
      }
      return answer;
    },
  );
}
