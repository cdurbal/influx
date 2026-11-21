// Routes of the identified creator search of the INFLUX agents (docs/mvp/10 RG4, RG9, RG62, RG71 to RG73,
// RG76, RG78; CA56, CA58, CA61; 17b §3.3; 18 T14, TM12.3, TM12.5; jalons/l3g/modele.md §1, §4, §8; fiche
// invariants 2, 4, 5, 7, 8, 12, 14). Backoffice surface: the aal2 guard of server.ts runs first, then each
// handler reads through withBackofficeSession() (agent and administrator alike); a member never reaches
// these routes (the web surface answers the 404 of a route that does not exist, before any door).
//   POST /v1/bo/creator-search                 {filters, sort, page, campaignId?, prefillId?}: a page of
//        identified rows with the exact count, through search.search_creators_identified() (0328). The
//        door journals the search, nominatively, with its impressions in the transaction that serves
//        (RG78, CA58); a page beyond the cap is journaled and answered AFTER the COMMIT: 400
//        validation_failed on `page` (RG76).
//   POST /v1/bo/campaigns/:id/creator-prefill  the filters drawn from the brief of an admitted campaign,
//        through search.prefill_campaign_filters() (0329); the proposed line is journaled (CA56). 60 a
//        minute per client address (member-rate.ts, before the session).
// Refused by the door before anything is written, the transaction rolled back:
// - a filter out of the base (22023): 400 validation_failed on `filters`;
// - a campaign unknown, erased, in draft or rejected (P0002 campaign), and a prefill that is not the
//   caller's, not of this campaign or older than 24 hours (P0002 prefill, EC-L3G-09-1): 404 not_found,
//   the code and the body of an address that does not exist (T14.3, T14.4);
// - the caller refused by the door (an internal account no longer active): the same 404;
// - a setting of the view missing from the base (55000 creator_search_settings): 503.
// Every answer is `no-store`. No route of export and no size of page exist (TM12.3, RG76). Nothing is
// sent to the outbox, to `matching.*` nor to the creator (D45, RG8).
import {
  campaignPrefillParamsSchema,
  campaignPrefillResponseSchema,
  IDENTIFIED_SEARCH_FILTERS_ISSUE,
  IDENTIFIED_SEARCH_PAGE_CAP_ISSUE,
  identifiedCreatorSearchBodySchema,
  identifiedCreatorSearchResponseSchema,
  type CampaignPrefillParams,
  type CampaignPrefillResponse,
  type IdentifiedCreatorSearchBody,
  type IdentifiedCreatorSearchResponse,
} from "@influx/contracts/identified-creator-search";
import type { ApiDatabase } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError } from "../../../platform/errors.ts";
import { withBackofficeSession } from "../../identity/backoffice-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import {
  isIdentifiedSearchPageCap,
  prefillCampaignFilters,
  searchCreatorsIdentified,
} from "./identified-search.ts";

export type IdentifiedSearchRoutesDependencies = { database: ApiDatabase };

export const IDENTIFIED_SEARCH_ROUTE = "/v1/bo/creator-search";
export const CAMPAIGN_PREFILL_ROUTE = "/v1/bo/campaigns/:id/creator-prefill";

/** The answer of a refusal the door raised before writing anything; else null (the error goes on). */
function doorRefusalOf(error: unknown): ApiError | null {
  const state = sqlStateOf(error);
  const detail = sqlDetailOf(error);
  if (state === "42501" && sqlMessageOf(error) === "forbidden") {
    // a missing GRANT is 42501 too, with another message: a fault, never this answer
    return new ApiError("not_found");
  }
  if (state === "22023" && detail === "filters") {
    return new ApiError("validation_failed", [
      { path: "filters", issue: IDENTIFIED_SEARCH_FILTERS_ISSUE },
    ]);
  }
  if (state === "P0002" && (detail === "campaign" || detail === "prefill")) {
    // T14.3, T14.4: an inadmissible campaign or a foreign prefill answers as one that does not exist
    return new ApiError("not_found");
  }
  if (state === "55000" && detail === "creator_search_settings") {
    return new ApiError("service_unavailable");
  }
  return null;
}

export function registerIdentifiedSearchRoutes(
  app: IdentityApp,
  dependencies: IdentifiedSearchRoutesDependencies,
): void {
  const { database } = dependencies;

  app.post(
    IDENTIFIED_SEARCH_ROUTE,
    {
      schema: {
        body: identifiedCreatorSearchBodySchema,
        response: { 200: identifiedCreatorSearchResponseSchema },
      },
    },
    async (request, reply): Promise<IdentifiedCreatorSearchResponse> => {
      // Identities and exact figures of other members: never kept by a cache.
      void reply.header("cache-control", "no-store");
      const body = request.body as IdentifiedCreatorSearchBody;
      let answer: Awaited<ReturnType<typeof searchCreatorsIdentified>>;
      try {
        answer = await withBackofficeSession(database, request, reply, (tx) =>
          searchCreatorsIdentified(tx, body),
        );
      } catch (error) {
        throw doorRefusalOf(error) ?? error;
      }
      if (isIdentifiedSearchPageCap(answer)) {
        // the line of the attempt is committed (RG76, CA58); the answer follows it
        request.log.info(
          { outcome: answer.state },
          "search.identified.refused",
        );
        throw new ApiError("validation_failed", [
          { path: "page", issue: IDENTIFIED_SEARCH_PAGE_CAP_ISSUE },
        ]);
      }
      return answer;
    },
  );

  app.post(
    CAMPAIGN_PREFILL_ROUTE,
    {
      schema: {
        params: campaignPrefillParamsSchema,
        response: { 200: campaignPrefillResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignPrefillResponse> => {
      void reply.header("cache-control", "no-store");
      const { id } = request.params as CampaignPrefillParams;
      try {
        return await withBackofficeSession(database, request, reply, (tx) =>
          prefillCampaignFilters(tx, id),
        );
      } catch (error) {
        throw doorRefusalOf(error) ?? error;
      }
    },
  );
}
